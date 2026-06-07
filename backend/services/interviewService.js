/**
 * interviewService.js
 *
 * "Legal Interview" layer: turns a free-text description of the user's situation
 * into the structured intake-field values the generation engine already reads.
 * It NEVER invents fields or options — every suggestion is validated against the
 * document's schema (variableConfig via buildDocumentFields), and select values
 * are snapped to a real option. The output only PRE-FILLS the form; the user
 * still reviews and submits, so this cannot bypass any validation or the export gate.
 */
import { buildDocumentFields } from "./documentIntakeConfig.js";
import { buildDocumentTypeMeta } from "./documentTypeNormalizer.js";
import { callAISafetyRaw } from "../ai/aiClient.js";

const INTERVIEW_SCHEMA = {
  type: "object",
  required: ["summary", "field_updates", "followup_questions"],
  properties: {
    summary: { type: "string" },
    field_updates: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "value", "confidence", "reason"],
        properties: {
          field: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
    followup_questions: { type: "array", items: { type: "string" } },
  },
};

// Fields that most change the SHAPE of the document — the interview prioritises these.
const HIGH_IMPACT_FIELDS = new Set([
  "counterparty_type",
  "involves_source_code",
  "involves_trade_secrets",
  "involves_personal_data",
  "include_non_compete",
  "include_non_solicit",
  "seniority_level",
  "termination_style",
  "payment_model",
  "include_force_majeure",
  "include_entire_agreement",
]);

function describeField(field) {
  const parts = [`name=${field.name}`, `type=${field.type}`];
  if (field.label) parts.push(`label=${field.label}`);
  if (field.options?.length) parts.push(`options=${field.options.join(" | ")}`);
  if (field.description) parts.push(`desc=${field.description}`);
  const flag = HIGH_IMPACT_FIELDS.has(field.name) ? " [HIGH IMPACT]" : "";
  return `- ${parts.join(" ; ")}${flag}`;
}

function clampConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.min(1, Math.max(0, num));
}

// Validate one suggested update against the field schema. Returns a normalized
// update or null if the field/value is not valid for this document.
// Exported for unit testing the safety guarantee (no invented fields/options).
export function validateInterviewUpdate(rawUpdate, fieldsByName) {
  return validateUpdate(rawUpdate, fieldsByName);
}

function validateUpdate(rawUpdate, fieldsByName) {
  const name = String(rawUpdate?.field || "").trim();
  const field = fieldsByName.get(name);
  if (!field) return null;

  let value = String(rawUpdate?.value ?? "").trim();
  if (!value) return null;

  if (field.type === "select" && Array.isArray(field.options) && field.options.length) {
    // Snap to a real option (case-insensitive); reject if no option matches.
    const match = field.options.find(
      (option) => option.toLowerCase() === value.toLowerCase()
    );
    if (!match) return null;
    value = match;
  }

  return {
    field: name,
    label: field.label || name,
    value,
    confidence: clampConfidence(rawUpdate?.confidence),
    reason: String(rawUpdate?.reason || "").trim() || "Inferred from your description.",
  };
}

export async function getInterviewResponse({ documentType, message }) {
  const trimmed = String(message || "").trim();
  if (!documentType || !trimmed) {
    const error = new Error("document_type and message are required.");
    error.statusCode = 400;
    throw error;
  }

  const fields = buildDocumentFields(documentType);
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const meta = buildDocumentTypeMeta(documentType);

  const prompt = `You are the LegalAId legal-interview assistant for Indian legal drafting.
The user will describe their situation in plain language. Map that description to the
structured intake fields below so the document can be shaped correctly.

Rules:
- Only use fields from the AVAILABLE FIELDS list. Never invent a field.
- For select fields, the value MUST be exactly one of the listed options.
- Prioritise [HIGH IMPACT] fields — they change which clauses appear.
- Do not invent facts the user did not state or clearly imply. If unsure, omit the
  field and instead add a short followup_question.
- confidence is 0..1 (how strongly the description supports the value).
- Do not discuss internal AI systems or providers.

DOCUMENT TYPE: ${meta.displayName || documentType}

AVAILABLE FIELDS:
${fields.map(describeField).join("\n")}

USER SITUATION:
${trimmed}

Return strict JSON only:
{
  "summary": "one-sentence restatement of the user's situation",
  "field_updates": [
    { "field": "exact_field_name", "value": "value or exact option", "confidence": 0.0, "reason": "why" }
  ],
  "followup_questions": ["a question to ask when a key field can't be inferred"]
}`;

  const response = await callAISafetyRaw(prompt, {
    schemaName: "legal_interview_response",
    schema: INTERVIEW_SCHEMA,
  });

  if (!response?.success) {
    return {
      summary:
        response?.error === "RATE_LIMITED"
          ? "The interview assistant is temporarily busy. Please try again shortly."
          : "The interview assistant is temporarily unavailable. You can fill the form manually.",
      field_updates: [],
      followup_questions: [],
      available: false,
    };
  }

  const data = response.data || {};
  const fieldUpdates = (Array.isArray(data.field_updates) ? data.field_updates : [])
    .map((update) => validateUpdate(update, fieldsByName))
    .filter(Boolean)
    // Highest-confidence, high-impact first; cap to keep the UI focused.
    .sort((a, b) => {
      const impact =
        Number(HIGH_IMPACT_FIELDS.has(b.field)) - Number(HIGH_IMPACT_FIELDS.has(a.field));
      return impact || b.confidence - a.confidence;
    })
    .slice(0, 12);

  const followups = (Array.isArray(data.followup_questions) ? data.followup_questions : [])
    .map((q) => String(q || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    summary: String(data.summary || "").trim(),
    field_updates: fieldUpdates,
    followup_questions: followups,
    available: true,
  };
}
