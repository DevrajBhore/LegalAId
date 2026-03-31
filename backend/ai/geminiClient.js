/**
 * geminiClient.js - gemini-2.5-flash only
 *
 * No model fallback loop. gemini-2.5-flash is the only model used.
 * If it 429s, wait for the retry-after time from the response header,
 * then try once more before giving up.
 *
 * responseMimeType: "application/json" is set so Gemini skips markdown
 * wrapping and returns raw JSON directly.
 */

import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";
const TIMEOUT = 90_000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const BASE_GENERATION_CONFIG = {
  temperature: 0.15,
  responseMimeType: "application/json",
  maxOutputTokens: 8192,
};

const DRAFT_SCHEMA = {
  type: SchemaType.OBJECT,
  required: ["document_type", "jurisdiction", "clauses"],
  properties: {
    document_type: { type: SchemaType.STRING },
    jurisdiction: { type: SchemaType.STRING },
    clauses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        required: ["clause_id", "category", "text"],
        properties: {
          clause_id: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          statutory_reference: {
            type: SchemaType.STRING,
            nullable: true,
          },
        },
      },
    },
  },
};

const CHAT_SCHEMA = {
  type: SchemaType.OBJECT,
  required: ["type", "reply", "edits"],
  properties: {
    type: {
      type: SchemaType.STRING,
      enum: ["edit", "reply"],
    },
    reply: { type: SchemaType.STRING },
    edits: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        required: ["clause_id", "new_text"],
        properties: {
          clause_id: { type: SchemaType.STRING },
          new_text: { type: SchemaType.STRING },
        },
      },
    },
  },
};

const FIX_SCHEMA = {
  type: SchemaType.OBJECT,
  required: ["explanation", "edits"],
  properties: {
    explanation: { type: SchemaType.STRING },
    edits: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        required: ["clause_id", "new_text"],
        properties: {
          clause_id: { type: SchemaType.STRING },
          new_text: { type: SchemaType.STRING },
        },
      },
    },
  },
};

const model = genAI.getGenerativeModel({ model: MODEL });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(errMsg = "") {
  const match =
    errMsg.match(/retry[_\s-]+(?:after|in)[:\s]+(\d+)/i) ||
    errMsg.match(/(\d+)\s*s(?:econds?)?/i);
  if (match) {
    return Math.min(parseInt(match[1], 10) * 1000, 30_000);
  }
  return 15_000;
}

function extractJSON(raw) {
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

function buildGenerateRequest(prompt, responseSchema) {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: responseSchema
      ? {
          ...BASE_GENERATION_CONFIG,
          responseSchema,
        }
      : BASE_GENERATION_CONFIG,
  };
}

async function repairJSONResponse(rawText, responseSchema) {
  const repairPrompt = `Repair the following model output into strict valid JSON.
Preserve the meaning and structure.
Return JSON only with no markdown, commentary, or code fences.

RAW OUTPUT:
${rawText}`;

  return callModel(repairPrompt, { responseSchema });
}

async function parseModelJSON(text, responseSchema) {
  try {
    return extractJSON(text);
  } catch (error) {
    if (!(error instanceof SyntaxError) || !responseSchema) {
      throw error;
    }

    const repaired = await repairJSONResponse(text, responseSchema);
    return extractJSON(repaired);
  }
}

function normalizeGeminiError(error) {
  const msg = error.message || "";
  return {
    error:
      error._type === "TIMEOUT"
        ? "TIMEOUT"
        : msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("RESOURCE_EXHAUSTED")
        ? "RATE_LIMITED"
        : "AI_PROVIDER_ERROR",
    details: msg,
  };
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

async function callModel(prompt, { responseSchema } = {}) {
  const attempt = async () => {
    const result = await Promise.race([
      model.generateContent(buildGenerateRequest(prompt, responseSchema)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT)
      ),
    ]);
    const text = await result.response.text();
    if (!text || text.trim().length < 10) {
      throw new Error("EMPTY_RESPONSE");
    }
    return text;
  };

  try {
    console.log(`[Gemini] ${MODEL} generating...`);
    const text = await attempt();
    console.log(`[Gemini] ${MODEL} done`);
    return text;
  } catch (error) {
    const msg = error.message || "";
    if (msg === "TIMEOUT") {
      throw Object.assign(error, { _type: "TIMEOUT" });
    }

    const is429 =
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("quota");

    if (is429) {
      const wait = parseRetryAfter(msg);
      console.log(`[Gemini] rate limited - retrying in ${wait / 1000}s...`);
      await sleep(wait);
      console.log(`[Gemini] ${MODEL} retrying...`);
      const text = await attempt();
      console.log(`[Gemini] ${MODEL} done (retry)`);
      return text;
    }

    throw error;
  }
}

export async function callGemini(prompt) {
  try {
    const text = await callModel(prompt, { responseSchema: DRAFT_SCHEMA });
    return { success: true, draft: await parseModelJSON(text, DRAFT_SCHEMA) };
  } catch (error) {
    console.error("[callGemini] Failed:", error.message);
    return { success: false, ...normalizeGeminiError(error) };
  }
}

export async function callGeminiChatRaw(draft, message) {
  const prompt = buildChatPrompt(draft, message);

  try {
    const text = await callModel(prompt, { responseSchema: CHAT_SCHEMA });
    return { success: true, data: await parseModelJSON(text, CHAT_SCHEMA) };
  } catch (error) {
    return { success: false, ...normalizeGeminiError(error) };
  }
}

export async function callGeminiChat(draft, message) {
  const result = await callGeminiChatRaw(draft, message);

  if (result.success) {
    return result.data;
  }

  console.error("[callGeminiChat] Failed:", result.details);
  return {
    type: "reply",
    reply:
      result.error === "RATE_LIMITED"
        ? "Rate limited - please wait a moment and try again."
        : "AI temporarily unavailable. Please try again.",
  };
}

export async function callGeminiFixRaw(draft, issue) {
  const prompt = buildFixPrompt(draft, issue);

  try {
    const text = await callModel(prompt, { responseSchema: FIX_SCHEMA });
    return { success: true, data: await parseModelJSON(text, FIX_SCHEMA) };
  } catch (error) {
    return { success: false, ...normalizeGeminiError(error) };
  }
}

export async function callGeminiFix(draft, issue) {
  const result = await callGeminiFixRaw(draft, issue);

  if (result.success) {
    return result.data;
  }

  console.error("[callGeminiFix] Failed:", result.details);
  return { explanation: "Fix failed - please try again.", edits: [] };
}

export async function callGeminiSafetyRaw(prompt, { responseSchema } = {}) {
  try {
    const text = await callModel(prompt, { responseSchema });
    const data = responseSchema
      ? await parseModelJSON(text, responseSchema)
      : extractJSON(text);
    return { success: true, data };
  } catch (error) {
    console.error("[callGeminiSafety] Failed:", error.message);
    return { success: false, ...normalizeGeminiError(error) };
  }
}

export async function callGeminiSafety(prompt, { responseSchema } = {}) {
  const result = await callGeminiSafetyRaw(prompt, { responseSchema });
  if (!result.success) {
    throw new Error(result.details || result.error || "AI_PROVIDER_ERROR");
  }
  return result.data;
}

export async function listAvailableModels() {
  const key = process.env.GEMINI_API_KEY;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    const json = await response.json();
    if (json.error) {
      return { error: json.error.message };
    }

    return (json.models || [])
      .filter((item) => item.supportedGenerationMethods?.includes("generateContent"))
      .map((item) => ({
        name: item.name.replace("models/", ""),
        displayName: item.displayName,
      }));
  } catch (error) {
    return { error: error.message };
  }
}
