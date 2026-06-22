import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";

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
import {
  draftToDocx,
  draftToPdf,
  draftToText,
  normalizeExportFormat,
} from "./services/exportService.js";
import { runDocumentValidation } from "./services/validationService.js";
import { callAIChat } from "./ai/aiClient.js";
import { listAvailableModels } from "./ai/geminiClient.js";
import { repairDocumentIssue } from "./services/issueRepairService.js";
import { getIntakeAssistantResponse } from "./services/intakeAssistantService.js";
import { searchClauses } from "./services/clauseSearch.js";
import { getInterviewResponse } from "./services/interviewService.js";
import { applyDocumentQualityControls } from "./services/documentQualityControl.js";

import authRoutes from "./auth/authRoutes.js";
import { protect, requireAdmin } from "./auth/authMiddleware.js";
import documentHistoryRoutes from "./routes/documentHistoryRoutes.js";
import clauseReviewRoutes from "./routes/clauseReviewRoutes.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const app = express();
// Render (and most PaaS) put the app behind a reverse proxy that sets
// X-Forwarded-For. Trust the first proxy hop so express-rate-limit can key on
// the real client IP instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "5mb";

// Restrict CORS to configured client origin(s). CLIENT_URL may be a single
// origin or a comma-separated list; if unset, fall back to permissive (dev).
// Origins are normalized (trailing slash stripped, lower-cased) because browser
// Origin headers never carry a trailing slash while CLIENT_URL often does.
const normalizeOrigin = (value) =>
  String(value || "").trim().replace(/\/+$/, "").toLowerCase();
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
if (ALLOWED_ORIGINS.length) {
  console.log(`[CORS] Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
}
app.use(
  cors(
    ALLOWED_ORIGINS.length
      ? {
          origin(origin, callback) {
            // Allow same-origin / server-to-server (no Origin header) and listed origins.
            if (!origin || ALLOWED_ORIGINS.includes(normalizeOrigin(origin))) {
              return callback(null, true);
            }
            // Deny without throwing (avoids noisy 500 stack traces); the browser
            // simply won't receive CORS headers. Log so misconfig is visible.
            console.warn(`[CORS] Blocked origin: ${origin}`);
            return callback(null, false);
          },
          credentials: true,
        }
      : // No CLIENT_URL configured: reflect the request origin (NOT wildcard) so
        // credentialed requests still work. Wildcard "*" is incompatible with
        // credentials:true and would be blocked by the browser.
        { origin: true, credentials: true }
  )
);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

const VALIDATION_MODES = new Set(["background", "generation", "final"]);

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Sensitive auth endpoints (login/register/reset) — protect against brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many authentication attempts. Please wait a few minutes and try again.",
  },
});

// Expensive AI/generation endpoints — protect provider quota and server load.
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "You are generating documents very quickly. Please wait a moment before trying again.",
  },
});

// ── Config ⊆ registry invariant ──────────────────────────────────────────────
// The shared registry may stage types ahead of config, but backend config must
// never reference a document type that is missing from the registry.
{
  const unregistered = Object.keys(DOCUMENT_CONFIG).filter(
    (type) => !DOCUMENT_TYPE_REGISTRY[type]
  );
  if (unregistered.length > 0) {
    console.error(
      "[Config] Document types missing from shared registry:",
      unregistered.join(", ")
    );
    process.exit(1);
  }
}

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

function buildGenerationErrorInfo({ error, details, validation, statusCode }) {
  const text = `${error || ""} ${details || ""}`.toLowerCase();
  const firstIssue = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ].find(Boolean);

  if (firstIssue) {
    return {
      category: "VALIDATION_BLOCKED",
      cause: firstIssue.message,
      solution:
        firstIssue.suggestion ||
        "Correct the related intake fields and generate the document again.",
    };
  }

  if (
    text.includes("rate_limited") ||
    text.includes("rate limited") ||
    statusCode === 429
  ) {
    return {
      category: "AI_RATE_LIMITED",
      cause: "The configured AI provider is temporarily rate limiting requests.",
      solution:
        "Wait a short time and retry. If this repeats, reduce very long inputs or check provider quota.",
    };
  }

  if (
    text.includes("ai_provider_error") ||
    text.includes("no_model_available") ||
    text.includes("timeout")
  ) {
    return {
      category: "AI_PROVIDER_UNAVAILABLE",
      cause:
        "The AI drafting provider failed, timed out, or no configured model was available.",
      solution:
        "Retry after a short wait, and verify backend AI provider keys and model configuration if it keeps failing.",
    };
  }

  if (statusCode === 400 || statusCode === 422) {
    return {
      category: "INPUT_ERROR",
      cause:
        error ||
        "The backend could not safely use the submitted form inputs.",
      solution:
        "Review the form values, fill missing details, correct invalid formats, and try again.",
    };
  }

  return {
    category: "GENERATION_FAILED",
    cause:
      details ||
      error ||
      "The backend failed before returning a generated draft.",
    solution:
      "Try again once. If the failure repeats, check backend logs and service configuration.",
  };
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

// ── Auth routes (public, rate limited) ────────────────────────────────────────
app.use("/auth", authLimiter, authRoutes);

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

// Clause legal-review workflow (admin only)
app.use("/admin/clause-reviews", protect, requireAdmin, clauseReviewRoutes);

// AI clause authoring / gap analysis (admin only) — proposes missing protections
// for a document type into the review queue. Build-time acceleration only.
app.post("/admin/clause-authoring/propose", protect, requireAdmin, aiLimiter, async (req, res) => {
  try {
    const documentType = req.body?.document_type;
    if (!documentType) {
      return res.status(400).json({ error: "Missing document_type." });
    }
    const { proposeProtectionsForType } = await import(
      "./services/clauseAuthoringService.js"
    );
    const result = await proposeProtectionsForType({ documentType });
    res.json(result);
  } catch (error) {
    console.error("Clause authoring error:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: "Clause authoring failed", details: error.message });
  }
});

app.get("/variables/:documentType", protect, (req, res) => {
  try {
    const schema = loadVariables(req.params.documentType);
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full-text clause-library search
app.get("/search/clauses", protect, (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ error: "Missing search query parameter 'q'." });
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = searchClauses(query, {
      limit,
      documentType: req.query.document_type || null,
    });
    res.json(result);
  } catch (error) {
    console.error("Clause search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// Generate document
app.post("/generate", protect, aiLimiter, async (req, res) => {
  try {
    const result = await generateDocument(req.body);
    if (result.error) {
      const statusCode = result.statusCode || 503;
      return res
        .status(statusCode)
        .json({
          error: result.error,
          validation: result.validation || null,
          issue: buildGenerationErrorInfo({
            error: result.error,
            validation: result.validation,
            statusCode,
          }),
        });
    }
    res.json({
      ...result,
      documentMeta: req.body?.document_type
        ? buildDocumentTypeMeta(req.body.document_type)
        : null,
    });
    // Auto-seed the flywheel: record any gaps this generation revealed. Fire-and-
    // forget — never affects the response or fails the request.
    import("./services/gapSignalService.js")
      .then(({ recordGaps }) => recordGaps(req.body?.document_type, result.draft, result.validation))
      .catch(() => {});
  } catch (error) {
    console.error("Generate error:", error);
    const details = error.message;
    res
      .status(500)
      .json({
        error: "Generation failed",
        details,
        issue: buildGenerationErrorInfo({
          error: "Generation failed",
          details,
          statusCode: 500,
        }),
      });
  }
});

// Legal interview — free-text situation → structured field pre-fills
app.post("/interview", protect, aiLimiter, async (req, res) => {
  try {
    const { document_type: documentType, message } = req.body || {};
    if (!documentType || !String(message || "").trim()) {
      return res
        .status(400)
        .json({ error: "Missing document_type or message in request body" });
    }
    const result = await getInterviewResponse({ documentType, message });
    res.json(result);
  } catch (error) {
    console.error("Interview error:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: "Interview failed", details: error.message });
  }
});

// Intake assistant
app.post("/intake-assistant", protect, aiLimiter, async (req, res) => {
  try {
    const { document_type: documentType, variables, message } = req.body || {};
    if (!documentType || !String(message || "").trim()) {
      return res.status(400).json({
        error: "Missing document_type or message in request body",
      });
    }

    const result = await getIntakeAssistantResponse({
      documentType,
      variables,
      message,
    });

    res.json(result);
  } catch (error) {
    console.error("Intake assistant error:", error);
    res.status(500).json({
      error: "Intake assistant failed",
      details: error.message,
    });
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
    const resolvedFormat = normalizeExportFormat(format);
    if (!resolvedFormat) {
      return res.status(400).json({
        error: 'Unsupported export format. Expected "docx", "pdf", or "txt".',
      });
    }

    const exportDraft = applyDocumentQualityControls(draft, {
      document_type: draft.document_type,
      variables: req.body?.variables || draft?.metadata?.source_variables || {},
    });

    const validation = await runDocumentValidation(exportDraft, {
      mode: "final",
      documentType: exportDraft.document_type,
      sourceVariables: req.body?.variables || exportDraft?.metadata?.source_variables,
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

    if (resolvedFormat === "txt") {
      const text = draftToText(exportDraft);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${docTitle}.txt"`
      );
      return res.send(text);
    }

    if (resolvedFormat === "pdf") {
      const buffer = await draftToPdf(exportDraft);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${docTitle}.pdf"`
      );
      return res.send(buffer);
    }

    const buffer = await draftToDocx(exportDraft);
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
app.post("/chat", protect, aiLimiter, async (req, res) => {
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
app.post("/fix-issue", protect, aiLimiter, async (req, res) => {
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
app.get("/admin/models", protect, requireAdmin, async (req, res) => {
  const models = await listAvailableModels();
  res.json(models);
});

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request payload too large.",
      details: `The submitted document data exceeds the current request size limit of ${REQUEST_BODY_LIMIT}.`,
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  return next(error);
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
