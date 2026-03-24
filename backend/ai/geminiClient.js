import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Model priority list ───────────────────────────────────────────────────────
// Ordered by speed/cost. All have free tier quota.
// gemini-1.5-flash-8b: 15 RPM, 1M TPM, 1500 req/day — highest free tier
// gemini-1.5-flash:    15 RPM, 1M TPM, 1500 req/day
// gemini-2.0-flash-lite: fast but lower daily quota on free tier
const MODEL_PRIORITY = [
  "gemini-2.0-flash-lite", // fastest
  "gemini-2.0-flash-lite-001", // pinned version fallback
  "gemini-2.0-flash", // more capable
  "gemini-1.5-flash-8b", // highest free-tier daily quota
  "gemini-1.5-flash", // solid fallback
  "gemini-2.5-flash", // best quality, try last
];

const TIMEOUT_MS = 60000;

// Session cache — remembers the last working model to skip re-trying
// slower fallbacks on subsequent requests within the same server session.
let _workingModel = null;

// Returns a model object for the given name + config.
// Does NOT probe — probing wastes quota and triggers RPM limits.
// Callers (callGemini etc.) handle 429/404 and call tryNextModel() to advance.
function getModel(modelName, config = {}) {
  return genAI.getGenerativeModel({ model: modelName, ...config });
}

// Returns the current model name to try, or throws if all are exhausted.
let _modelIndex = 0;

function currentModelName() {
  if (_modelIndex >= MODEL_PRIORITY.length) {
    _modelIndex = 0; // reset for next call
    throw new Error(
      "All Gemini models are unavailable right now.\n" +
        "This is usually a temporary rate limit (RPM), not a daily quota issue.\n" +
        "Options:\n" +
        "  1. Wait 60 seconds and try again\n" +
        "  2. Visit https://aistudio.google.com to verify your API key\n" +
        "  3. Upgrade to a paid API key for higher limits"
    );
  }
  return MODEL_PRIORITY[_modelIndex];
}

function advanceModel(reason) {
  console.log(`[Gemini] ✗ ${MODEL_PRIORITY[_modelIndex]}: ${reason}`);
  _modelIndex++;
}

function resetModelIndex() {
  _modelIndex = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);
}

function extractJSON(text) {
  return JSON.parse(
    text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  );
}

// ── Shared retry helper ───────────────────────────────────────────────────────
// Tries each model in MODEL_PRIORITY in order, skipping on 429/404.
// On success, remembers the working index for the session.
async function callWithFallback(buildRequest, label) {
  resetModelIndex();
  while (true) {
    const modelName = currentModelName(); // throws when list exhausted
    console.log(`[Gemini] Trying ${modelName} for ${label}...`);
    try {
      const model = getModel(modelName, {
        generationConfig: { temperature: 0.2 },
      });
      const result = await withTimeout(buildRequest(model), TIMEOUT_MS, label);
      const text = await result.response.text();
      if (!text) throw new Error("EMPTY_RESPONSE");
      console.log(`[Gemini] ✅ ${modelName} succeeded`);
      _workingModel = modelName; // cache for subsequent calls this session
      return text;
    } catch (e) {
      const is429 =
        e.message?.includes("429") ||
        e.message?.includes("quota") ||
        e.message?.includes("RESOURCE_EXHAUSTED");
      const is404 =
        e.message?.includes("404") || e.message?.includes("not found");
      const isTimeout = e.message?.includes("timed out");
      if (is429) {
        advanceModel("rate limited — trying next");
        continue;
      }
      if (is404) {
        advanceModel("not available — trying next");
        continue;
      }
      if (isTimeout) throw Object.assign(e, { _type: "TIMEOUT" });
      throw e; // unexpected error — don't swallow
    }
  }
}

// ── Document generation ───────────────────────────────────────────────────────
export async function callGemini(prompt) {
  try {
    const text = await callWithFallback(
      (model) => model.generateContent(prompt),
      "generate"
    );
    return { success: true, draft: extractJSON(text) };
  } catch (error) {
    console.error("[callGemini] Failed:", error.message);
    return {
      success: false,
      error:
        error._type === "TIMEOUT"
          ? "TIMEOUT"
          : error.message?.includes("All Gemini") ||
            error.message?.includes("unavailable")
          ? "NO_MODEL_AVAILABLE"
          : "AI_PROVIDER_ERROR",
    };
  }
}

// ── AI chat ───────────────────────────────────────────────────────────────────
export async function callGeminiChat(draft, message) {
  const clauseList = (draft?.clauses || [])
    .map(
      (c, i) =>
        `${i + 1}. [${c.clause_id}] "${c.title || c.category}"\n${(
          c.text || ""
        ).slice(0, 1200)}`
    )
    .join("\n\n");

  const prompt = `You are an expert Indian legal document editor.

DOCUMENT TYPE: ${draft?.document_type || "Unknown"}
JURISDICTION: India

CURRENT CLAUSES:
${clauseList}

USER REQUEST: "${message}"

If the user wants to MODIFY/REWRITE/CHANGE a clause — return edits.
If the user is asking a QUESTION — return just a reply.

Respond ONLY with valid JSON:
{
  "type": "edit" | "reply",
  "reply": "Your response (always required, max 100 words)",
  "edits": [{ "clause_id": "exact clause_id", "new_text": "complete new clause text" }]
}
"edits" only when type is "edit". Return ONLY the JSON.`;

  try {
    const text = await callWithFallback(
      (model) => model.generateContent(prompt),
      "chat"
    );
    return extractJSON(text);
  } catch (error) {
    console.error("[callGeminiChat] Failed:", error.message);
    return {
      type: "reply",
      reply: error.message?.includes("unavailable")
        ? "All AI models are rate-limited right now. Please wait 60 seconds and try again."
        : "AI temporarily unavailable. Please try again.",
    };
  }
}

// ── AI issue fixer ────────────────────────────────────────────────────────────
export async function callGeminiFix(draft, issue) {
  const clauseList = (draft?.clauses || [])
    .map(
      (c, i) =>
        `${i + 1}. [${c.clause_id}] ${c.title || c.category}: ${(
          c.text || ""
        ).slice(0, 1200)}`
    )
    .join("\n\n");

  const prompt = `You are an Indian legal document repair engine.

IRE flagged:
ISSUE: ${issue.rule_id} — ${issue.message}
${issue.suggestion ? `SUGGESTION: ${issue.suggestion}` : ""}
${issue.statutory_reference ? `STATUTE: ${issue.statutory_reference}` : ""}

DOCUMENT TYPE: ${draft?.document_type}
CLAUSES:
${clauseList}

Fix the clause causing this issue. Respond ONLY with valid JSON:
{
  "explanation": "What was wrong and what you fixed (max 60 words)",
  "edits": [{ "clause_id": "exact clause_id", "new_text": "complete corrected clause text" }]
}`;

  try {
    const text = await callWithFallback(
      (model) => model.generateContent(prompt),
      "fix"
    );
    return extractJSON(text);
  } catch (error) {
    console.error("[callGeminiFix] Failed:", error.message);
    return {
      explanation: error.message?.includes("unavailable")
        ? "AI models are rate-limited. Please wait 60 seconds and try again."
        : "Fix failed. Please try again.",
      edits: [],
    };
  }
}

// ── AI legal safety validator ─────────────────────────────────────────────────
export async function callGeminiSafety(prompt) {
  try {
    const text = await callWithFallback(
      (model) => model.generateContent(prompt),
      "safety"
    );
    return extractJSON(text);
  } catch (error) {
    console.error("[callGeminiSafety] Failed:", error.message);
    return { violations: [] };
  }
}

// ── Diagnostic: list available models ────────────────────────────────────────
export async function listAvailableModels() {
  const key = process.env.GEMINI_API_KEY;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    const json = await res.json();
    if (json.error) return { error: json.error.message };
    return (json.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        name: m.name.replace("models/", ""),
        displayName: m.displayName,
      }));
  } catch (e) {
    return { error: e.message };
  }
}
