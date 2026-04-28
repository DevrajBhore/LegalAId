import dotenv from "dotenv";
dotenv.config();

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const TIMEOUT = 60_000;

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
        required: [
          "clause_id",
          "category",
          "title",
          "text",
          "statutory_reference",
        ],
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
  let text = raw.replace(/^\uFEFF/, "").trim();
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      text = text.slice(start, end + 1);
    }
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
If asked about what system powers you, identify yourself only as the LegalAId AI assistant and redirect to helping with the document.

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
    ? (draft?.clauses || []).find(
        (clause) => clause.clause_id === issue.offending_clause_id
      )
    : null;
  const baselineClause =
    issue?.offending_clause_id &&
    draft?.metadata?.baseline_clause_map?.[issue.offending_clause_id]
      ? draft.metadata.baseline_clause_map[issue.offending_clause_id]
      : null;
  const clauseList = targetClause
    ? `[${targetClause.clause_id}] ${targetClause.title || targetClause.category}:\n${
        (targetClause.text || "").slice(0, 1800)
      }`
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
  if (status === 429 || /429|quota|rate limit|rate_limit/i.test(details)) {
    return "RATE_LIMITED";
  }

  if (/timeout/i.test(details)) {
    return "TIMEOUT";
  }

  return "AI_PROVIDER_ERROR";
}

async function requestGroq(messages, { schemaName, schema }) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "AI_PROVIDER_ERROR",
      details: "Missing GROQ_API_KEY",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    console.log(`[Groq] ${MODEL} generating...`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.15,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details =
        payload?.error?.message ||
        `${response.status} ${response.statusText}`.trim();
      throw Object.assign(new Error(details), { status: response.status });
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw Object.assign(new Error("EMPTY_RESPONSE"), { status: response.status });
    }

    console.log(`[Groq] ${MODEL} done`);
    return { success: true, data: extractJSON(content) };
  } catch (error) {
    const details =
      error.name === "AbortError" ? "TIMEOUT" : error.message || "Unknown error";
    console.error("[Groq] Failed:", details);
    return {
      success: false,
      error:
        error.name === "AbortError"
          ? "TIMEOUT"
          : normalizeError(error.status, details),
      details,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callGroq(prompt) {
  const result = await requestGroq([{ role: "user", content: prompt }], {
    schemaName: "legal_draft",
    schema: DRAFT_SCHEMA,
  });

  if (!result.success) {
    return result;
  }

  return { success: true, draft: result.data };
}

export async function callGroqChat(draft, message) {
  const result = await requestGroq(
    [{ role: "user", content: buildChatPrompt(draft, message) }],
    {
      schemaName: "chat_response",
      schema: CHAT_SCHEMA,
    }
  );

  if (!result.success) {
    return result;
  }

  return { success: true, data: result.data };
}

export async function callGroqFix(draft, issue) {
  const result = await requestGroq(
    [{ role: "user", content: buildFixPrompt(draft, issue) }],
    {
      schemaName: "fix_response",
      schema: FIX_SCHEMA,
    }
  );

  if (!result.success) {
    return result;
  }

  return { success: true, data: result.data };
}

export async function callGroqSafetyRaw(
  prompt,
  { schemaName = "safety_response", schema } = {}
) {
  const result = await requestGroq([{ role: "user", content: prompt }], {
    schemaName,
    schema,
  });

  if (!result.success) {
    return result;
  }

  return { success: true, data: result.data };
}
