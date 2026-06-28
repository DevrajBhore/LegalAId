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
import { DOCUMENT_CONFIG } from "../config/documentConfig.js";
import { ESSENTIAL_FIELDS } from "../config/essentialFields.js";

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
  if (field.type === "date") parts.push("format=YYYY-MM-DD");
  if (field.type === "number") parts.push("format=plain number, no symbols");
  if (field.description) parts.push(`desc=${field.description}`);
  const flag = HIGH_IMPACT_FIELDS.has(field.name) ? " [HIGH IMPACT]" : "";
  return `- ${parts.join(" ; ")}${flag}`;
}

function clampConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.min(1, Math.max(0, num));
}

// Common phrasings an LLM (or user) produces that don't string-match the canonical
// option but clearly mean it. Keys/values are normalized (lowercase, sp-collapsed).
// Only used to REWRITE the candidate value before snapping — never to invent one.
const OPTION_SYNONYMS = {
  company: "private limited company",
  "pvt ltd": "private limited company",
  "pvt. ltd.": "private limited company",
  "private limited": "private limited company",
  "private company": "private limited company",
  corporation: "private limited company",
  corporate: "private limited company",
  "ltd": "private limited company",
  llc: "llp",
  "limited liability partnership": "llp",
  person: "individual",
  proprietor: "sole proprietorship",
  "sole proprietor": "sole proprietorship",
  partnership: "partnership firm",
  "notice based": "notice-based termination",
  "for cause": "termination for cause and notice",
  "fixed term": "fixed-term with early termination rights",
};

function normalizeOptionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[".,/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeOptionText(value).split(" ").filter(Boolean));
}

// Conservatively snap a free-text value to one of the allowed select options.
// Order: exact → synonym-rewrite exact → unambiguous token-subset containment →
// unambiguous best token-overlap (>=0.5). Returns the canonical option or null.
// Ambiguity (more than one equally-good option) always yields null so we never
// guess wrong — the field is simply left for the user instead.
function snapToOption(rawValue, options) {
  const value = normalizeOptionText(rawValue);
  if (!value) return null;

  const norm = options.map((option) => ({ option, key: normalizeOptionText(option) }));

  // 1. exact (normalized) match
  const exact = norm.find((o) => o.key === value);
  if (exact) return exact.option;

  // 2. synonym rewrite, then exact
  const rewritten = OPTION_SYNONYMS[value];
  if (rewritten) {
    const viaSynonym = norm.find((o) => o.key === rewritten);
    if (viaSynonym) return viaSynonym.option;
  }

  const valueTokens = tokenSet(value);

  // 3. token-subset containment (value ⊆ option or option ⊆ value), must be unique
  const contained = norm.filter((o) => {
    const optTokens = tokenSet(o.key);
    const valSubset = [...valueTokens].every((t) => optTokens.has(t));
    const optSubset = [...optTokens].every((t) => valueTokens.has(t));
    return valSubset || optSubset;
  });
  if (contained.length === 1) return contained[0].option;

  // 4. best token-overlap (Jaccard), require a clear, unique winner
  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const o of norm) {
    const optTokens = tokenSet(o.key);
    const inter = [...valueTokens].filter((t) => optTokens.has(t)).length;
    const union = new Set([...valueTokens, ...optTokens]).size;
    const score = union ? inter / union : 0;
    if (score > bestScore) {
      bestScore = score;
      best = o.option;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  if (best && bestScore >= 0.5 && !tie) return best;

  return null;
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
    // Snap to a real option (exact → synonym → fuzzy, conservatively); reject if
    // nothing clearly matches so we never feed the form an out-of-schema value.
    const match = snapToOption(value, field.options);
    if (!match) return null;
    value = match;
  }

  if (field.type === "date") {
    // Normalize to YYYY-MM-DD; reject unparseable dates.
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    value = parsed.toISOString().slice(0, 10);
  }

  if (field.type === "number") {
    // Strip currency symbols/commas; reject non-numeric values.
    const numeric = value.replace(/[₹$,\s]/g, "").replace(/\/-$/, "");
    if (!/^\d+(\.\d+)?$/.test(numeric)) return null;
    value = numeric;
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
The user will describe their situation in plain language. Your job is to FILL AS MUCH
OF THE INTAKE FORM AS POSSIBLE from that description, so the user barely has to type.

Rules:
- Extract EVERY field the description supports: party/company names, addresses,
  entity types, amounts, dates, durations, purpose/scope text, locations — not just
  the context toggles. A thorough extraction of 10+ fields is better than 3.
- For text/textarea fields, you may lightly normalise the user's wording into a
  clean form value (e.g. "sharing my pricing data" → purpose: "Sharing of
  confidential pricing data for supplier negotiations").
- Only use fields from the AVAILABLE FIELDS list. Never invent a field.
- For select fields, the value MUST be exactly one of the listed options.
- For date fields use YYYY-MM-DD. For number fields use plain digits only.
- Prioritise [HIGH IMPACT] fields — they change which clauses appear.
- Do not invent facts the user did not state or clearly imply. If a key fact is
  missing, omit the field and add a short followup_question instead.
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
    // Highest-confidence, high-impact first. Generous cap — the goal is to fill
    // as much of the form as the description supports.
    .sort((a, b) => {
      const impact =
        Number(HIGH_IMPACT_FIELDS.has(b.field)) - Number(HIGH_IMPACT_FIELDS.has(a.field));
      return impact || b.confidence - a.confidence;
    })
    .slice(0, 30);

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

// ── Conversational intake ────────────────────────────────────────────────────
// A bounded, one-question-at-a-time flow that feels like talking to a paralegal.
// It reuses the SAME schema-safe extraction as the interview (no invented fields
// or options), then deterministically asks for the next still-empty ESSENTIAL
// field. Because it walks the essentials list, it can never wander — it asks at
// most as many questions as there are essential fields, then signals "ready".

function humanizeFieldName(name = "") {
  return String(name).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Craft a natural, paralegal-style question for a single field from its schema.
function buildConversationalQuestion(field) {
  if (!field) return null;
  const label = field.label || humanizeFieldName(field.name);
  const name = String(field.name).toLowerCase();

  if (field.type === "select" && field.options?.length) {
    return `${label}? You can choose from: ${field.options.join(", ")}.`;
  }
  if (name.includes("party_1") && name.includes("name")) {
    return "Who is the first party — the full legal name of the person or company?";
  }
  if (name.includes("party_2") && name.includes("name")) {
    return "And who is the second party — their full legal name?";
  }
  if (name.includes("employer") && name.includes("name")) {
    return "Who is the employer — the company's full legal name?";
  }
  if (name.includes("employee") && name.includes("name")) {
    return "Who is the employee — their full name?";
  }
  if (name.endsWith("_name")) {
    return `What is the full legal name for the ${label.toLowerCase()}?`;
  }
  if (name.includes("operating_state")) {
    return "Which Indian state is this agreement most connected to?";
  }
  if (name.includes("effective_date") || field.type === "date") {
    return `What date should apply for the ${label.toLowerCase()}? (any clear date is fine)`;
  }
  if (name.includes("purpose") || name.includes("scope") || name.includes("services") || name.includes("description")) {
    return `In a sentence, what's the ${label.toLowerCase()}?`;
  }
  if (name.includes("amount") || name.includes("fee") || name.includes("salary") || name.includes("price") || name.includes("value")) {
    return `What is the ${label.toLowerCase()}? (just the figure is fine)`;
  }
  return `What is the ${label.toLowerCase()}?`;
}

function essentialsForType(documentType) {
  const essentials = ESSENTIAL_FIELDS[documentType];
  if (Array.isArray(essentials) && essentials.length) return essentials;
  return DOCUMENT_CONFIG[documentType]?.requiredFields || [];
}

function isBlankValue(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

/**
 * One conversational turn. Extracts field values from the user's latest answer
 * (schema-validated), merges them into what's already filled, then returns the
 * single next essential field to ask about — or ready:true when done.
 *
 * @param {object} args
 * @param {string} args.documentType
 * @param {string} [args.message]      the user's latest answer (empty on the first call)
 * @param {object} [args.filled]       field values gathered so far
 * @param {string} [args.targetField]  the field the last question was about (improves extraction)
 */
export async function getConversationalStep({ documentType, message, filled = {}, targetField = null }) {
  if (!documentType) {
    const error = new Error("document_type is required.");
    error.statusCode = 400;
    throw error;
  }

  const fields = buildDocumentFields(documentType);
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const meta = buildDocumentTypeMeta(documentType);
  const merged = { ...(filled || {}) };
  let updates = [];
  let summary = "";
  let available = true;

  const trimmed = String(message || "").trim();
  if (trimmed) {
    const targetLabel = fieldsByName.get(targetField)?.label || targetField || null;
    const prompt = `You are the LegalAId legal-interview assistant for Indian legal drafting.
The user is in a step-by-step conversation. Extract any intake-field values their
latest answer supports — primarily the field they were just asked about, but also
any other fields the answer clearly reveals.

Rules:
- Only use fields from the AVAILABLE FIELDS list. Never invent a field.
- For select fields, the value MUST be exactly one of the listed options.
- For date fields use YYYY-MM-DD. For number fields use plain digits only.
- Do not invent facts the user did not state or clearly imply.
- confidence is 0..1.

DOCUMENT TYPE: ${meta.displayName || documentType}
${targetLabel ? `THE USER WAS JUST ASKED ABOUT: ${targetLabel} (field: ${targetField})` : ""}

AVAILABLE FIELDS:
${fields.map(describeField).join("\n")}

USER ANSWER:
${trimmed}

Return strict JSON only:
{
  "summary": "one-sentence restatement of what the user just told you",
  "field_updates": [
    { "field": "exact_field_name", "value": "value or exact option", "confidence": 0.0, "reason": "why" }
  ],
  "followup_questions": []
}`;

    const response = await callAISafetyRaw(prompt, {
      schemaName: "legal_interview_response",
      schema: INTERVIEW_SCHEMA,
    });

    if (!response?.success) {
      available = false;
    } else {
      const data = response.data || {};
      summary = String(data.summary || "").trim();
      updates = (Array.isArray(data.field_updates) ? data.field_updates : [])
        .map((update) => validateUpdate(update, fieldsByName))
        .filter(Boolean);
      for (const update of updates) {
        merged[update.field] = update.value;
      }
    }
  }

  // Deterministically pick the next still-empty essential field — this bounds
  // the conversation and guarantees we collect everything a quick draft needs.
  const essentials = essentialsForType(documentType);
  const remaining = essentials.filter((name) => isBlankValue(merged[name]));
  const nextField = remaining.length ? fieldsByName.get(remaining[0]) : null;

  return {
    summary,
    field_updates: updates,
    filled: merged,
    next_field: nextField?.name || null,
    next_question: nextField ? buildConversationalQuestion(nextField) : null,
    remaining_count: remaining.length,
    ready: remaining.length === 0,
    available,
  };
}
