import { createHash } from "crypto";
/**
 * mutationGuard.js — D4.46
 *
 * ONE rule, applied on every path that changes clause text after the engine has
 * rendered it: deterministic repair, AI tailoring, and /fix-issue.
 *
 *   1. A locked or protected clause is never changed by a machine.
 *   2. A value the user supplied (an amount, a rate, a period, a count) that the
 *      clause carried before the change must still be in it afterwards.
 *   3. AI may not introduce a figure the clause did not carry: tailoring is
 *      wording, not terms.
 *
 * A change that breaks a rule is not applied: the clause keeps its previous
 * text, and the refusal is recorded. Flagging a legal or commercial concern about
 * a value (an interest rate above a statutory ceiling, say) is the validator's
 * job, as a finding the user sees; changing the value is never the repair's.
 *
 * Found by the D4.45 mapping: the deterministic fixer rewrote any interest rate of
 * 40% or more to "24%" and any payment period of 60 days or more to "45 days";
 * /fix-issue applied AI edits to locked clauses; the clause locker said its locks
 * were "for the AI /fix-issue generator", which never read them.
 */

// The single definition of a protected clause. clauseLocker stamps `locked` from
// it; documentService's AI merge and every guard below read it. Before D4.46 the
// two lists were kept separately and could drift.
export const PROTECTED_CATEGORIES = new Set([
  "IDENTITY",
  "GOVERNING_LAW",
  "DISPUTE_RESOLUTION",
  "SIGNATURE_BLOCK",
  "SIGNATURES",
  "LIABILITY_CAP",
]);

export const PROTECTED_CLAUSE_IDS = new Set([
  "CORE_IDENTITY_001",
  "CORE_GOVERNING_LAW_001",
  "CORE_DISPUTE_RESOLUTION_001",
  "CORE_SIGNATURE_BLOCK_001",
  "CORE_LIABILITY_CAP_001",
]);

export function isProtectedClause(clause = {}) {
  return Boolean(
    clause?.locked ||
      PROTECTED_CATEGORIES.has(clause?.category) ||
      PROTECTED_CLAUSE_IDS.has(clause?.clause_id)
  );
}

/* ── User values ─────────────────────────────────────────────────────────── */

// Fields whose value is a commercial or temporal TERM. Identifiers (PAN, CIN,
// GSTIN, phone) and addresses carry digits that are not terms and are protected
// by the identity checks instead.
const TERM_FIELD = /(amount|rate|price|fee|fees|percent|percentage|days|period|months|years|term|value|salary|stipend|rent|deposit|interest|multiple|shares|duration|instal|consideration|capital|valuation|investment|cap|notice|premium|penalty|discount|bonus|count|quantity|number_of|pool|hours|age)/i;
const NOT_A_TERM = /(_pan$|_cin$|_gstin$|_llpin$|_din$|phone|mobile|pincode|pin_code|_address$|_name$|email|date$|_date_|year_of|registration_number|account)/i;

function toNumber(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Every figure in a piece of text, as numbers (Indian grouping and decimals). */
export function figuresIn(text = "") {
  const out = new Set();
  for (const m of String(text).matchAll(/(?<![A-Za-z0-9])\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|(?<![A-Za-z0-9.])\d+(?:\.\d+)?/g)) {
    const n = toNumber(m[0]);
    if (n !== null) out.add(n);
  }
  return out;
}

/**
 * The figures the user supplied for terms of the document. Only intake fields
 * (no derived "__" keys); a field qualifies if it is numeric in the schema or its
 * name says it is a term.
 */
export function userValueFigures(variables = {}, schema = {}) {
  const figures = new Map();
  for (const [key, value] of Object.entries(variables || {})) {
    if (key.startsWith("__") || value === undefined || value === null || value === "") continue;
    if (NOT_A_TERM.test(key)) continue;
    const numericField = schema?.[key]?.type === "number";
    if (!numericField && !TERM_FIELD.test(key)) continue;
    for (const n of figuresIn(String(value))) {
      if (!figures.has(n)) figures.set(n, key);
    }
  }
  return figures;
}

/* ── The guard ───────────────────────────────────────────────────────────── */

/**
 * Why a change from `before` to `after` may not be applied, or [] if it may.
 * `introducedFiguresForbidden` is set for AI changes.
 */
export function refusalReasons(before, after, { userFigures = new Map(), introducedFiguresForbidden = false } = {}) {
  if (!before || !after) return [];
  const oldText = String(before.text || "");
  const newText = String(after.text || "");
  if (oldText === newText) return [];
  const reasons = [];
  if (isProtectedClause(before)) {
    reasons.push({ code: "PROTECTED_CLAUSE", detail: `${before.clause_id} is locked or protected` });
    return reasons;
  }
  const had = figuresIn(oldText);
  const has = figuresIn(newText);
  for (const [figure, field] of userFigures) {
    if (had.has(figure) && !has.has(figure)) {
      reasons.push({ code: "USER_VALUE_REMOVED", detail: `${figure} (${field}) would be removed`, figure, field });
    }
  }
  if (introducedFiguresForbidden) {
    for (const figure of has) {
      if (!had.has(figure)) reasons.push({ code: "FIGURE_INTRODUCED", detail: `${figure} would be introduced`, figure });
    }
  }
  return reasons;
}

/**
 * Apply `after` over `before` clause by clause, keeping the previous text of any
 * clause whose change is refused. Returns the guarded draft and the refusals.
 * Clause membership and order come from `after`: the guard governs text, not
 * structure.
 */
export function guardDraftMutation(beforeDraft, afterDraft, { userFigures, source, introducedFiguresForbidden = false } = {}) {
  if (!beforeDraft?.clauses || !afterDraft?.clauses) return { draft: afterDraft, refused: [] };
  const beforeById = new Map(beforeDraft.clauses.map((c) => [c.clause_id, c]));
  const refused = [];
  const clauses = afterDraft.clauses.map((clause) => {
    const before = beforeById.get(clause.clause_id);
    const reasons = refusalReasons(before, clause, { userFigures, introducedFiguresForbidden });
    if (!reasons.length) return clause;
    refused.push({ clause_id: clause.clause_id, source, reasons });
    return { ...clause, text: before.text, title: before.title ?? clause.title, category: before.category ?? clause.category };
  });
  if (!refused.length) return { draft: afterDraft, refused };
  return {
    draft: {
      ...afterDraft,
      clauses,
      metadata: {
        ...(afterDraft.metadata || {}),
        refused_mutations: [...(afterDraft.metadata?.refused_mutations || []), ...refused],
      },
    },
    refused,
  };
}

/* ── Independent check on the validation path ───────────────────────────────
 *
 * The guards above prevent; this verifies. For every clause whose text is still
 * exactly what the AI produced (its sha matches _ai_text_sha), compare it with the
 * immutable pre-AI text in metadata.pre_ai_baseline. A clause the user has since
 * edited is the user's own and is not judged here. Runs only on AI-touched
 * drafts, so no deterministic document is affected.
 */
const sha = (text) => createHash("sha256").update(String(text || "")).digest("hex");

export function validateAIIntegrity(draft, { userFigures = new Map() } = {}) {
  const baseline = draft?.metadata?.pre_ai_baseline;
  if (!baseline || !Array.isArray(draft?.clauses)) return [];
  const issues = [];
  for (const clause of draft.clauses) {
    if (!clause?._ai_text_sha || sha(clause.text) !== clause._ai_text_sha) continue;
    const preAiText = baseline[clause.clause_id];
    if (typeof preAiText !== "string" || preAiText === clause.text) continue;
    const reasons = [];
    if (isProtectedClause(clause)) {
      reasons.push({ code: "PROTECTED_CLAUSE", detail: `${clause.clause_id} is locked or protected` });
    }
    // Judge the figures as if the clause were unprotected, so a protected clause
    // reports every reason, not only the first.
    const unprotected = { clause_id: clause.clause_id, text: preAiText };
    reasons.push(...refusalReasons(unprotected, { ...clause, locked: false, category: null }, { userFigures, introducedFiguresForbidden: true }));
    if (!reasons.length) continue;
    issues.push({
      rule_id: "AI_CHANGED_AGREED_TERMS",
      severity: "CRITICAL",
      blocks_generation: true,
      layer: "ai_integrity",
      offending_clause_id: clause.clause_id,
      message: `AI tailoring changed ${clause.title || clause.clause_id} beyond wording: ${reasons.map((r) => r.detail).join("; ")}. Compared with the clause as the engine drafted it before any AI change.`,
      suggestion: "Restore the clause to its drafted wording, or edit the figure yourself if it should change.",
      evidence: { reasons, pre_ai_text: preAiText.slice(0, 400), observed_text: String(clause.text).slice(0, 400) },
    });
  }
  return issues;
}
