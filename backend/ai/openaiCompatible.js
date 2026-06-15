/**
 * openaiCompatible.js
 *
 * Factory for any OpenAI-compatible chat-completions provider (OpenAI, Groq,
 * Together, OpenRouter, local vLLM, etc.). Both groqClient and openaiClient are
 * thin wrappers over this, so adding/swapping a provider is just config — the
 * drafting/chat/fix/safety behavior stays identical across providers.
 */

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "jurisdiction", "clauses"],
  properties: {
    document_type: { type: "string" },
    jurisdiction: { type: "string" },
    clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clause_id", "category", "title", "text", "statutory_reference"],
        properties: {
          clause_id: { type: "string" },
          category: { type: "string" },
          title: { type: ["string", "null"] },
          text: { type: "string" },
          statutory_reference: { type: ["string", "null"] },
        },
      },
    },
  },
};

const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "reply", "edits"],
  properties: {
    type: { type: "string", enum: ["edit", "reply"] },
    reply: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clause_id", "new_text"],
        properties: {
          clause_id: { type: "string" },
          new_text: { type: "string" },
        },
      },
    },
  },
};

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "edits"],
  properties: {
    explanation: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clause_id", "new_text"],
        properties: {
          clause_id: { type: "string" },
          new_text: { type: "string" },
        },
      },
    },
  },
};

function extractJSON(raw = "") {
  let text = raw.replace(/^﻿/, "").trim();
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  }
  text = text.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(text);
}

function buildChatPrompt(draft, message) {
  const clauseList = (draft?.clauses || [])
    .map(
      (clause, index) =>
        `${index + 1}. [${clause.clause_id}] "${clause.title || clause.category}"\n${(
          clause.text || ""
        ).slice(0, 800)}`
    )
    .join("\n\n");

  return `You are an expert Indian legal document editor.
You are the LegalAId AI assistant.
Do not reveal the underlying model, provider, vendor, backend stack, or implementation details.
If asked what system powers you, identify yourself only as the LegalAId AI assistant and redirect to helping with the document.

DOCUMENT: ${draft?.document_type || "Unknown"} | JURISDICTION: India

CLAUSES:
${clauseList}

REQUEST: "${message}"

If user wants to MODIFY a clause - return edits.
If user is asking a QUESTION - return reply only.

JSON only:
{"type":"edit"|"reply","reply":"max 100 words","edits":[{"clause_id":"exact id","new_text":"complete text"}]}
edits only when type=edit.`;
}

function buildFixPrompt(draft, issue) {
  const targetClause = issue?.offending_clause_id
    ? (draft?.clauses || []).find((clause) => clause.clause_id === issue.offending_clause_id)
    : null;
  const baselineClause =
    issue?.offending_clause_id &&
    draft?.metadata?.baseline_clause_map?.[issue.offending_clause_id]
      ? draft.metadata.baseline_clause_map[issue.offending_clause_id]
      : null;
  const clauseList = targetClause
    ? `[${targetClause.clause_id}] ${targetClause.title || targetClause.category}:\n${(
        targetClause.text || ""
      ).slice(0, 1800)}`
    : (draft?.clauses || [])
        .map(
          (clause, index) =>
            `${index + 1}. [${clause.clause_id}] ${clause.title || clause.category}: ${(
              clause.text || ""
            ).slice(0, 800)}`
        )
        .join("\n\n");

  return `Indian legal document repair. Fix the IRE-flagged issue below.

ISSUE: ${issue.rule_id} - ${issue.message}
${issue.suggestion ? `SUGGESTION: ${issue.suggestion}` : ""}
${issue.statutory_reference ? `STATUTE: ${issue.statutory_reference}` : ""}

DOC TYPE: ${draft?.document_type}
${baselineClause?.text ? `ORIGINAL CLEAN CLAUSE:\n[${baselineClause.clause_id}] ${baselineClause.title || baselineClause.category}:\n${baselineClause.text.slice(0, 1800)}\n\n` : ""}CLAUSE TO FIX:
${clauseList}

Return the minimum necessary edits only.
Do not modify unrelated clauses.
If the original clean clause already resolves the issue, restore that wording instead of inventing new text.

JSON only:
{"explanation":"what was wrong + what you fixed (max 60 words)","edits":[{"clause_id":"exact id","new_text":"complete corrected text"}]}`;
}

function normalizeError(status, details = "") {
  if (status === 429 || /429|quota|rate limit|rate_limit/i.test(details)) return "RATE_LIMITED";
  if (/timeout/i.test(details)) return "TIMEOUT";
  return "AI_PROVIDER_ERROR";
}

// OpenAI/Groq strict json_schema mode requires additionalProperties:false on
// every object; enforce it recursively so callers don't have to.
function enforceStrictSchema(node) {
  if (Array.isArray(node)) return node.map(enforceStrictSchema);
  if (node && typeof node === "object") {
    const next = {};
    for (const [key, value] of Object.entries(node)) next[key] = enforceStrictSchema(value);
    if (next.type === "object" && next.additionalProperties === undefined) {
      next.additionalProperties = false;
    }
    return next;
  }
  return node;
}

export function createOpenAICompatibleClient({
  label,
  apiKeyName,
  getApiKey,
  getBaseUrl,
  getModel,
  timeout = 60_000,
}) {
  // Detects "the model's OUTPUT failed strict-schema validation" (common with
  // smaller models) — distinct from a malformed-schema error on our side.
  function isOutputValidationFailure(details = "") {
    return /failed to validate json|json_validate_failed/i.test(details);
  }

  async function attempt(messages, responseFormat) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const model = getModel();

    try {
      const response = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          messages,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Surface what the model actually produced when schema validation failed.
        const failedGen = payload?.error?.failed_generation;
        const details = [
          payload?.error?.message || `${response.status} ${response.statusText}`.trim(),
          failedGen ? `failed_generation: ${String(failedGen).slice(0, 300)}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        throw Object.assign(new Error(details), { status: response.status });
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw Object.assign(new Error("EMPTY_RESPONSE"), { status: response.status });
      }

      return { success: true, data: extractJSON(content) };
    } catch (error) {
      const details = error.name === "AbortError" ? "TIMEOUT" : error.message || "Unknown error";
      return {
        success: false,
        error: error.name === "AbortError" ? "TIMEOUT" : normalizeError(error.status, details),
        details,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function request(messages, { schemaName, schema }) {
    if (!getApiKey()) {
      return { success: false, error: "AI_PROVIDER_ERROR", details: `Missing ${apiKeyName}` };
    }

    const model = getModel();
    console.log(`[${label}] ${model} generating...`);

    // First try strict schema-constrained output.
    let result = await attempt(messages, {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema: enforceStrictSchema(schema) },
    });

    // If the MODEL's output failed strict validation (small models often do),
    // retry once in plain JSON mode. The prompt already demands strict JSON and
    // every caller validates/sanitizes the parsed result server-side, so this
    // is a safe resilience fallback — not a loosening of any safety guarantee.
    if (!result.success && isOutputValidationFailure(result.details)) {
      console.warn(`[${label}] strict schema output failed — retrying in json_object mode.`);
      result = await attempt(messages, { type: "json_object" });
    }

    if (result.success) console.log(`[${label}] ${model} done`);
    else console.error(`[${label}] Failed:`, result.details);
    return result;
  }

  return {
    isConfigured: () => Boolean(getApiKey()),

    async callGenerate(prompt) {
      const result = await request([{ role: "user", content: prompt }], {
        schemaName: "legal_draft",
        schema: DRAFT_SCHEMA,
      });
      return result.success ? { success: true, draft: result.data } : result;
    },

    async callChat(draft, message) {
      return request([{ role: "user", content: buildChatPrompt(draft, message) }], {
        schemaName: "chat_response",
        schema: CHAT_SCHEMA,
      });
    },

    async callFix(draft, issue) {
      return request([{ role: "user", content: buildFixPrompt(draft, issue) }], {
        schemaName: "fix_response",
        schema: FIX_SCHEMA,
      });
    },

    async callSafetyRaw(prompt, { schemaName = "safety_response", schema } = {}) {
      return request([{ role: "user", content: prompt }], { schemaName, schema });
    },
  };
}
