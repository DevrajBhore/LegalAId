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

// D4.47: numbers written as words are figures too. "five years" changed to
// "three years" carried no digit, so the figure guard could not see it. "one" is
// left out: as a pronoun ("one Party") it is not a figure.
const WORD_FIGURES = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, forty_five: 45, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

/** Every figure in a piece of text, as numbers (Indian grouping, decimals, words). */
export function figuresIn(text = "") {
  const out = new Set();
  for (const m of String(text).matchAll(/(?<![A-Za-z0-9])\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|(?<![A-Za-z0-9.])\d+(?:\.\d+)?/g)) {
    const n = toNumber(m[0]);
    if (n !== null) out.add(n);
  }
  for (const m of String(text).toLowerCase().matchAll(/\b(forty[- ]five|[a-z]+)\b/g)) {
    const n = WORD_FIGURES[m[1].replace(/[- ]/, "_")];
    if (n !== undefined) out.add(n);
  }
  return out;
}

/* ── Meaning markers (D4.47) ─────────────────────────────────────────────────
 *
 * Figures and locks are not the whole of a clause's meaning. An AI rewording
 * can keep every number and still turn "shall" into "may", drop "not", lose an
 * "unless", put the Borrower where the Lender was, or remove a remedy. These
 * markers are read deterministically from the words; an AI change that alters
 * any of them is not wording, and is refused. It is deliberately coarse: a
 * refused tailoring keeps the engine's text, which is the safe direction.
 */
const MARKERS = {
  negation: /\b(not|no|never|neither|nor|without)\b/gi,
  obligation: /\b(shall not|must not|may not|shall|must|may|will not|will|is entitled to|is not entitled to)\b/gi,
  condition: /\b(unless|except|excluding|provided that|subject to|notwithstanding|only if|save that|if|where)\b/gi,
  remedy: /\b(indemnif\w*|damages|terminat\w*|injunct\w*|specific performance|interest|penalt\w*|liquidated|refund\w*|forfeit\w*|set[- ]off|suspend\w*)\b/gi,
};

function countsOf(text, pattern) {
  const counts = new Map();
  for (const m of String(text || "").matchAll(pattern)) {
    const key = m[1].toLowerCase().replace(/\s+/g, " ");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sameCounts(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function sameKeys(a, b) {
  return a.size === b.size && [...a.keys()].every((k) => b.has(k));
}

/**
 * Defined party names in a draft: (the "Lender"), ("Company"), hereinafter "X",
 * read from the clause that identifies the parties. Other defined terms ("this
 * Agreement", "Effective Date") are not parties.
 */
const NOT_A_PARTY = new Set(["Agreement", "Deed", "Effective Date", "Parties", "Party", "Company Act", "Schedule"]);

export function partyNamesOf(draft) {
  const names = new Set();
  const identity = (draft?.clauses || []).filter((c) => c?.category === "IDENTITY" || /IDENTITY/.test(String(c?.clause_id || "")));
  for (const clause of identity) {
    for (const m of String(clause.text || "").matchAll(/\((?:hereinafter\s+(?:referred to as\s+)?)?(?:the\s+)?["\u201c]([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?)["\u201d]/g)) {
      if (!NOT_A_PARTY.has(m[1])) names.add(m[1]);
    }
  }
  return names;
}

export function meaningChanges(oldText, newText, { partyNames = new Set() } = {}) {
  const reasons = [];
  const neg = [countsOf(oldText, MARKERS.negation), countsOf(newText, MARKERS.negation)];
  const negTotal = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  if (negTotal(neg[0]) !== negTotal(neg[1])) reasons.push({ code: "NEGATION_CHANGED", detail: "a negation was added or removed" });
  const obl = [countsOf(oldText, MARKERS.obligation), countsOf(newText, MARKERS.obligation)];
  if (!sameKeys(obl[0], obl[1])) reasons.push({ code: "OBLIGATION_CHANGED", detail: `obligation words changed (${[...obl[0].keys()].join("/") || "none"} -> ${[...obl[1].keys()].join("/") || "none"})` });
  const cond = [countsOf(oldText, MARKERS.condition), countsOf(newText, MARKERS.condition)];
  if (!sameCounts(cond[0], cond[1])) reasons.push({ code: "CONDITION_CHANGED", detail: "a condition, qualification or exception was added or removed" });
  const rem = [countsOf(oldText, MARKERS.remedy), countsOf(newText, MARKERS.remedy)];
  const stems = (m) => new Set([...m.keys()].map((k) => k.slice(0, 6)));
  if (!sameKeys(new Map([...stems(rem[0])].map((k) => [k, 1])), new Map([...stems(rem[1])].map((k) => [k, 1])))) {
    reasons.push({ code: "REMEDY_CHANGED", detail: "a remedy was added or removed" });
  }
  if (partyNames.size) {
    const roleCounts = (t) => {
      const m = new Map();
      for (const name of partyNames) {
        const c = (String(t || "").match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
        if (c) m.set(name, c);
      }
      return m;
    };
    const [a, b] = [roleCounts(oldText), roleCounts(newText)];
    const swapped = [...partyNames].some((x) => (b.get(x) || 0) > (a.get(x) || 0)) && [...partyNames].some((x) => (b.get(x) || 0) < (a.get(x) || 0));
    // Who does what: each party name with the word that follows it ("Borrower
    // shall", "Lender agrees"). Exchanging the parties keeps every count and
    // changes these pairs.
    const actions = (t) => {
      const set = new Set();
      for (const name of partyNames) {
        for (const m of String(t || "").matchAll(new RegExp(`\\b${name}\\b\\s+([a-z]+)`, "g"))) set.add(`${name}:${m[1]}`);
      }
      return set;
    };
    const [pa, pb] = [actions(oldText), actions(newText)];
    const exchanged = [...pa].some((x) => !pb.has(x) && [...pb].some((y) => y.split(":")[1] === x.split(":")[1] && y.split(":")[0] !== x.split(":")[0] && !pa.has(y)));
    if (!sameKeys(a, b) || swapped || exchanged) reasons.push({ code: "PARTY_CHANGED", detail: "the parties the clause binds or benefits changed" });
  }
  return reasons;
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
export function refusalReasons(before, after, {
  userFigures = new Map(),
  introducedFiguresForbidden = false,
  // D4.47: meaning markers are checked for AI changes by default.
  meaningGuarded = introducedFiguresForbidden,
  partyNames = new Set(),
  // Figures the user stated in the instruction that asked for this change
  // (/chat). A figure the user typed is authorised, and naming one is taken as
  // the user replacing the value it stands in for.
  authorisedFigures = new Set(),
} = {}) {
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
    if (had.has(figure) && !has.has(figure) && !authorisedFigures.size) {
      reasons.push({ code: "USER_VALUE_REMOVED", detail: `${figure} (${field}) would be removed`, figure, field });
    }
  }
  if (introducedFiguresForbidden) {
    for (const figure of has) {
      if (!had.has(figure) && !authorisedFigures.has(figure)) reasons.push({ code: "FIGURE_INTRODUCED", detail: `${figure} would be introduced`, figure });
    }
  }
  if (meaningGuarded) reasons.push(...meaningChanges(oldText, newText, { partyNames }));
  return reasons;
}

/**
 * Apply `after` over `before` clause by clause, keeping the previous text of any
 * clause whose change is refused. Returns the guarded draft and the refusals.
 * Clause membership and order come from `after`: the guard governs text, not
 * structure.
 */
export function guardDraftMutation(beforeDraft, afterDraft, {
  userFigures, source, introducedFiguresForbidden = false, meaningGuarded = introducedFiguresForbidden, authorisedFigures,
} = {}) {
  if (!beforeDraft?.clauses || !afterDraft?.clauses) return { draft: afterDraft, refused: [] };
  const beforeById = new Map(beforeDraft.clauses.map((c) => [c.clause_id, c]));
  const partyNames = meaningGuarded ? partyNamesOf(beforeDraft) : new Set();
  const refused = [];
  const clauses = afterDraft.clauses.map((clause) => {
    const before = beforeById.get(clause.clause_id);
    const reasons = refusalReasons(before, clause, { userFigures, introducedFiguresForbidden, meaningGuarded, partyNames, authorisedFigures });
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
    reasons.push(...refusalReasons(unprotected, { ...clause, locked: false, category: null }, { userFigures, introducedFiguresForbidden: true, partyNames: partyNamesOf(draft) }));
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
