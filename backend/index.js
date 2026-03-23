import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { loadVariables } from "./services/variableLoader.js";
import { generateDocument } from "./services/documentService.js";
import { validate } from "./ire/runner.js";
import { DOCUMENT_CONFIG } from "./config/documentConfig.js";
import { getVariables } from "./config/variableConfig.js";
import { draftToDocx, draftToText } from "./services/exportService.js";

import authRoutes from "./auth/authRoutes.js";
import { protect } from "./auth/authMiddleware.js";

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err.message));

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use("/auth", authRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "LegalAId backend running", version: "2.0" });
});

// ── Get all supported document types (public — needed for home page) ──────────
app.get("/document-types", (_req, res) => {
  const types = Object.entries(DOCUMENT_CONFIG).map(([key, config]) => ({
    type: key,
    displayName: key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    signatureType: config.signatureType,
    requiredFields: config.requiredFields,
  }));
  res.json({ types });
});

// ── Document config (public — needed for form page) ───────────────────────────
app.get("/document-config/:type", (req, res) => {
  const config = DOCUMENT_CONFIG[req.params.type];
  if (!config)
    return res
      .status(404)
      .json({ error: `Unknown document type: ${req.params.type}` });

  const vars = getVariables(req.params.type);

  const sections =
    config.sections?.map((s) => ({
      title: s.title,
      fields: s.fields.map((varName) => {
        const v = vars[varName] || {
          label: varName,
          type: "text",
          required: false,
        };
        return {
          name: varName,
          label: v.label,
          type: v.type || "text",
          options: v.options || null,
          required: config.requiredFields.includes(varName),
        };
      }),
    })) || null;

  const fields = Object.entries(vars).map(([name, v]) => ({
    name: name,
    label: v.label,
    type: v.type || "text",
    options: v.options || null,
    required: config.requiredFields.includes(name),
  }));

  res.json({
    type: req.params.type,
    fields,
    sections,
    signatureType: config.signatureType,
  });
});

// ── Protected routes (require login + verified email) ────────────────────────

// Get variable schema
app.get("/variables/:documentType", protect, (req, res) => {
  try {
    const schema = loadVariables(req.params.documentType);
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate document
app.post("/generate", protect, async (req, res) => {
  try {
    const result = await generateDocument(req.body);
    if (result.error) {
      return res.status(503).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("Generate error:", error);
    res
      .status(500)
      .json({ error: "Generation failed", details: error.message });
  }
});

// Validate document
app.post("/validate", protect, async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.document_type || !body.clauses) {
      return res
        .status(400)
        .json({ error: "Missing document_type or clauses in request body" });
    }
    // deep=true → full AI semantic safety check (user-triggered "Validate & Download")
    // deep=false → fast regex-only check (background auto-check after edits)
    const isDeep = body.deep === true;
    const result = await validate(body, { isUserEdit: isDeep });
    res.json(result);
  } catch (error) {
    console.error("Validation error:", error);
    res
      .status(500)
      .json({ error: "Validation failed", details: error.message });
  }
});

// Export document
app.post("/export", protect, async (req, res) => {
  try {
    const { draft, validation, format = "docx" } = req.body;
    if (!draft)
      return res.status(400).json({ error: "Missing draft in request body" });

    const docTitle = (draft.document_type || "legal_document")
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (format === "txt") {
      const text = draftToText(draft);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${docTitle}.txt"`
      );
      return res.send(text);
    }

    const buffer = await draftToDocx(draft, validation);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${docTitle}.docx"`
    );
    return res.send(buffer);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Export failed", details: error.message });
  }
});

// AI Chat
app.post("/chat", protect, async (req, res) => {
  try {
    const { draft, message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    const { callGeminiChat } = await import("./ai/geminiClient.js");
    const result = await callGeminiChat(draft, message);
    res.json(result);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed", details: error.message });
  }
});

// ── AI Fix Issue (repair a specific IRE-flagged clause) ───────────────────────
app.post("/fix-issue", protect, async (req, res) => {
  try {
    const { draft, issue } = req.body;
    if (!draft || !issue)
      return res.status(400).json({ error: "Missing draft or issue" });

    const { callGeminiFix } = await import("./ai/geminiClient.js");
    const result = await callGeminiFix(draft, issue);
    res.json(result);
  } catch (error) {
    console.error("Fix issue error:", error);
    res.status(500).json({ error: "Fix failed", details: error.message });
  }
});

// ── List available Gemini models (diagnostic) ─────────────────────────────────
app.get("/admin/models", async (req, res) => {
  const { listAvailableModels } = await import("./ai/geminiClient.js");
  const models = await listAvailableModels();
  res.json(models);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 LegalAId backend v2.0 running on port ${PORT}`);
  console.log(
    `   Auth: POST /auth/register, /auth/login, GET /auth/verify-email, /auth/me`
  );
  console.log(`   Docs: GET /document-types, /document-config/:type`);
  console.log(`   Protected: POST /generate, /validate, /export, /chat`);
});
