/**
 * instrumentKnowledge.js — D4.44
 *
 * The engine half of `rendering.instrument` in drafting_policies.json. The
 * family describes what kind of instrument it is (its noun, its opening, which
 * provisions bind, the terms it must state, the choices that must come from an
 * answer, and how each term is phrased for each answer). This module applies
 * that description. It holds no knowledge of any particular instrument.
 *
 * A document type with no `instrument` entry is untouched by everything here.
 */
import { getDocumentDraftingPolicy } from "./draftingPolicy.js";
import { formatIndianAmount, formatFormalDate, parseNumberish } from "./formattingEngine.js";

export const PROVISION_STATUS = Object.freeze({
  BINDING_NOW: "BINDING_NOW",
  NON_BINDING: "NON_BINDING",
  UNRESOLVED_PENDING_REVIEW: "UNRESOLVED_PENDING_REVIEW",
});

/** The marker every unresolved term carries in the rendered text. */
export const UNRESOLVED_PREFIX = "[To be agreed: ";

export function getInstrument(documentType) {
  const instrument = getDocumentDraftingPolicy(documentType)?.instrument;
  return instrument && typeof instrument === "object" ? instrument : null;
}

export function provisionStatusOf(documentType, clauseId) {
  const instrument = getInstrument(documentType);
  if (!instrument) return null;
  return instrument.provision_status?.[clauseId] || PROVISION_STATUS.UNRESOLVED_PENDING_REVIEW;
}

export function isSemanticTailoringDisabled(documentType) {
  return getDocumentDraftingPolicy(documentType)?.generation?.semantic_tailoring === false;
}

/* ── Terms ──────────────────────────────────────────────────────────────────
 *
 * Each term is phrased from the answers. A case applies when its `when` holds
 * (or it has none). Its text substitutes `{field|format}` and computed
 * `{=expr|format}` slots. If no case applies, or a slot reads an unanswered
 * field, the term is UNRESOLVED and renders as "[To be agreed: …]" — it is
 * never given a value nobody chose.
 */

const answered = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "" &&
  String(value).trim().toLowerCase() !== "to be agreed";

function holds(when, variables) {
  if (!when) return true;
  if (Array.isArray(when.all)) return when.all.every((w) => holds(w, variables));
  const value = variables?.[when.field];
  if (Array.isArray(when.in)) return answered(value) && when.in.includes(String(value).trim());
  if (when.answered === true) return answered(value);
  if (when.answered === false) return !answered(value);
  return false;
}

class Unanswered extends Error {}

function numberOf(field, variables) {
  const value = variables?.[field];
  if (!answered(value)) throw new Unanswered(field);
  const n = parseNumberish(value);
  if (n === null || !Number.isFinite(n)) throw new Unanswered(field);
  return n;
}

// add(a,b) divide(a,b) multiply(a,b) floor(a) percent(a,b) over field names
// and nested calls. Nothing else is accepted.
function evaluate(expr, variables) {
  const source = String(expr).trim();
  const call = /^([a-z]+)\((.*)\)$/.exec(source);
  if (!call) {
    if (/^[a-z_0-9]+$/.test(source)) return numberOf(source, variables);
    if (/^-?\d+(\.\d+)?$/.test(source)) return Number(source);
    throw new Error(`instrument term expression not understood: ${source}`);
  }
  const [, op, inner] = call;
  const args = [];
  let depth = 0, current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { args.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current);
  const v = args.map((a) => evaluate(a, variables));
  switch (op) {
    case "add": return v.reduce((a, b) => a + b, 0);
    case "multiply": return v.reduce((a, b) => a * b, 1);
    case "divide":
      if (v[1] === 0) throw new Unanswered("division by zero");
      return v[0] / v[1];
    case "floor": return Math.floor(v[0]);
    case "percent":
      if (v[1] === 0) throw new Unanswered("division by zero");
      return (v[0] / v[1]) * 100;
    default: throw new Error(`instrument term operation not allowed: ${op}`);
  }
}

const IN2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function format(value, fmt) {
  switch (fmt) {
    case "inr": return formatIndianAmount(value, { includeWords: true });
    case "inr2": return `₹${IN2.format(value)}`;
    case "int": return INT.format(Math.floor(value));
    case "pct": return (Math.round(value * 100) / 100).toString();
    case "num": return String(Math.round(value * 10000) / 10000);
    default: return String(value);
  }
}

function fill(template, variables) {
  return String(template).replace(/\{(=?)([^{}|]+)(?:\|([a-z0-9]+))?\}/g, (_, computed, body, fmt) => {
    if (computed) return format(evaluate(body, variables), fmt);
    const field = body.trim();
    const value = variables?.[field];
    if (!answered(value)) throw new Unanswered(field);
    if (fmt === "date") return formatFormalDate(value);
    if (["inr", "inr2", "int", "pct", "num"].includes(fmt)) return format(numberOf(field, variables), fmt);
    return String(value).trim().replace(/\s*[.;]\s*$/, "");
  });
}

export function unresolvedText(what) {
  return what ? `${UNRESOLVED_PREFIX}${what}]` : "";
}

/**
 * The phrased terms for this document, as variables the clause templates read.
 * Returns {} for a document type with no instrument terms.
 */
export function deriveInstrumentTerms(documentType, variables = {}) {
  const instrument = getInstrument(documentType);
  if (!instrument || !Array.isArray(instrument.terms)) return {};
  const out = {};
  for (const term of instrument.terms) {
    const chosen = (term.cases || []).find((c) => holds(c.when, variables));
    if (!chosen) { out[term.key] = unresolvedText(term.unresolved); continue; }
    try {
      out[term.key] = fill(chosen.text, variables);
    } catch (error) {
      if (!(error instanceof Unanswered)) throw error;
      out[term.key] = unresolvedText(term.unresolved);
    }
  }
  return out;
}

/* ── The noun the instrument uses for itself ───────────────────────────────
 *
 * Shared clauses (governing law, dispute resolution, the signature block) call
 * every document "this Agreement". A term sheet that calls itself an agreement
 * in its own governing-law clause hands a party the argument that it was meant
 * to be one.
 */
export function applyInstrumentNoun(clause, documentType) {
  const noun = getInstrument(documentType)?.noun;
  if (!noun || !clause || typeof clause.text !== "string") return clause;
  const swap = (text) =>
    text
      .replace(/\(\s*"Agreement"\s*\)/g, `("${noun}")`)
      .replace(/\bthis Agreement\b/g, `this ${noun}`)
      .replace(/\bThis Agreement\b/g, `This ${noun}`)
      .replace(/\bthe Agreement\b/g, `this ${noun}`);
  const text = swap(clause.text);
  const title = typeof clause.title === "string" ? swap(clause.title) : clause.title;
  if (text === clause.text && title === clause.title) return clause;
  return { ...clause, text, title };
}
