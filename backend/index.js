import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { loadVariables } from "./services/variableLoader.js";
import { generateDocument } from "./services/documentService.js";
import { preloadKnowledgeBase } from "./services/clauseAssembler.js";
import { buildDocumentTypeMeta } from "./services/documentTypeNormalizer.js";
import {
  buildDocumentFields,
  buildDocumentSections,
  validateDocumentIntakeConfiguration,
} from "./services/documentIntakeConfig.js";
import { DOCUMENT_CONFIG } from "./config/documentConfig.js";
import { draftToDocx, draftToText } from "./services/exportService.js";
import { runDocumentValidation } from "./services/validationService.js";
import { callAIChat } from "./ai/aiClient.js";
import { listAvailableModels } from "./ai/geminiClient.js";
import { repairDocumentIssue } from "./services/issueRepairService.js";

import authRoutes from "./auth/authRoutes.js";
import { protect } from "./auth/authMiddleware.js";
import documentHistoryRoutes from "./routes/documentHistoryRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

const VALIDATION_MODES = new Set(["background", "generation", "final"]);

try {
  validateDocumentIntakeConfiguration();
  const stats = preloadKnowledgeBase({
    documentTypes: Object.keys(DOCUMENT_CONFIG),
  });
  console.log(
    `[KnowledgeBase] Preloaded ${stats.clauseCount} clauses and ${stats.blueprintCount} blueprints for ${stats.documentTypeCount} document types`
  );
} catch (error) {
  console.error("[KnowledgeBase] Startup failed:", error.message);
  process.exit(1);
}

// ── Memoize document-config responses (static data) ──────────────────────────
const documentConfigCache = new Map();
for (const [key, config] of Object.entries(DOCUMENT_CONFIG)) {
  const sections = buildDocumentSections(key);
  const fields = buildDocumentFields(key);
  documentConfigCache.set(key, {
    ...buildDocumentTypeMeta(key),
    fields,
    sections,
    signatureType: config.signatureType,
  });
}
console.log(`[Config] Memoized ${documentConfigCache.size} document configs`);

function resolveValidationMode(mode, deep) {
  if (mode == null) {
    if (deep === true) return "final";
    if (deep === false) return "background";
    return "final";
  }

  return VALIDATION_MODES.has(mode) ? mode : null;
}

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    if (process.env.GEMINI_WARMUP_ON_STARTUP === "true") {
      import("./ai/geminiClient.js")
        .then(({ callGeminiSafety }) => {
          callGeminiSafety('{"warmup":true}').catch(() => {});
          console.log("[Gemini] Model warm-up initiated");
        })
        .catch(() => {});
    } else {
      console.log("[Gemini] Startup warm-up skipped");
    }
  })
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
    ...buildDocumentTypeMeta(key),
    signatureType: config.signatureType,
    requiredFields: config.requiredFields,
  }));
  res.json({ types });
});

// ── Document config (public — needed for form page) ───────────────────────────
app.get("/document-config/:type", (req, res) => {
  const cached = documentConfigCache.get(req.params.type);
  if (!cached)
    return res
      .status(404)
      .json({ error: `Unknown document type: ${req.params.type}` });
  res.json(cached);
});

// ── Protected routes (require login + verified email) ────────────────────────

// Get variable schema
app.use("/history", protect, documentHistoryRoutes);

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
      return res
        .status(result.statusCode || 503)
        .json({ error: result.error, validation: result.validation || null });
    }
    res.json({
      ...result,
      documentMeta: req.body?.document_type
        ? buildDocumentTypeMeta(req.body.document_type)
        : null,
    });
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
    // Prefer mode="background" | "generation" | "final".
    // deep=true/false is still accepted for backward compatibility.
    const mode = resolveValidationMode(body.mode, body.deep);
    if (!mode) {
      return res.status(400).json({
        error:
          'Invalid validation mode. Expected "background", "generation", or "final".',
      });
    }
    const validation = await runDocumentValidation(body, {
      mode,
      documentType: body.document_type,
      sourceVariables: body.variables,
    });
    res.json({ validation });
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
    const { draft, format = "docx" } = req.body;
    if (!draft)
      return res.status(400).json({ error: "Missing draft in request body" });

    const validation = await runDocumentValidation(draft, {
      mode: "final",
      documentType: draft.document_type,
      sourceVariables: req.body?.variables,
    });

    const openIssueCount =
      validation?.summary?.total ?? validation?.issueCount ?? 0;
    const canExport =
      validation?.certified === true &&
      validation?.risk !== "BLOCKED" &&
      openIssueCount === 0;

    if (!canExport) {
      return res.status(422).json({
        error:
          "This document must pass final validation with zero open issues before export.",
        validation,
      });
    }

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

    const buffer = await draftToDocx(draft);
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
    const result = await callAIChat(draft, message);
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

    const result = await repairDocumentIssue(draft, issue);

    if (!result.fixed) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Fix issue error:", error);
    res.status(500).json({ error: "Fix failed", details: error.message });
  }
});

// ── List available Gemini models (diagnostic) ─────────────────────────────────
app.get("/admin/models", protect, async (req, res) => {
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
  console.log(`   Protected: POST /generate, /validate, /export, /chat, /history/*`);
});
