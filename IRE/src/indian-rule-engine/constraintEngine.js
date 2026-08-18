/**
 * constraintEngine.js
 *
 * Evaluates constraint rules against a draft.
 *
 * Rules live in knowledge-base/constraints/<domain>.constraints.json and are
 * written to be read and approved by a lawyer, not a programmer. The predicate
 * vocabulary below is deliberately CLOSED: a general expression language would
 * stop being reviewable, which is the whole point of keeping rules out of code.
 *
 * ── Rule shape ───────────────────────────────────────────────────────────────
 *   {
 *     "rule_id":   "RENTAL_REGISTRATION_MANDATORY_OVER_12M",
 *     "severity":  "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
 *     "description": "A lease for a term of 12 months or more must be registered.",
 *     "statutory_reference": "Registration Act 1908 - S.17(1)(d)",
 *     "reviewed_by": "adv-name", "reviewed_on": "2026-08-20",
 *     "applies_to_doc_types": ["RENTAL_AGREEMENT"],   // allow-list
 *     "excludes_doc_types":   ["TERMS_OF_SERVICE"],   // deny-list, wins
 *     "notice_only": true,           // informational: never counts as an issue
 *                                    // that blocks generation or export
 *     "when":   [ ...predicates ],   // ALL must hold, else the rule does not apply
 *     "assert": [ ...predicates ],   // ALL must hold, else the rule FIRES
 *     "remedy": "Add the mandatory-registration clause."
 *   }
 *
 * Legacy rules using "fails_if": [clause_id, ...] keep working unchanged --
 * it is sugar for assert: [{ clause_present: [...] }].
 *
 * ── Predicates ───────────────────────────────────────────────────────────────
 *   { "doc_type_in": ["RENTAL_AGREEMENT", ...] } document type matches one
 *   { "clause_present": ["ID", ...] }   at least one of these clause_ids present
 *   { "clause_absent":  ["ID", ...] }   none of these clause_ids present
 *   { "category_present": ["IDENTITY"] } at least one clause in that category
 *   { "state_in": ["Maharashtra", ...] } operating/governing state matches
 *   { "var": "field" | ["field","alt"], "op": "...", "value": X }
 *   { "not": <predicate> }
 *   { "any_of": [<predicate>, ...] }
 *
 * ── Operators for "var" ──────────────────────────────────────────────────────
 *   present | absent            was the field answered at all
 *   eq | neq                    case-insensitive string compare
 *   contains | not_contains     substring, case-insensitive
 *   in | not_in                 value is / is not in the given list
 *   matches                     regular expression (string), case-insensitive
 *   gt | gte | lt | lte         numeric compare
 *   months_gte | months_lt      duration compare -- "24 months", "2 years", "18"
 *                               all normalise to a month count
 */

// ── Value helpers ────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null) return false;
  const text = normalizeText(value);
  return text !== "" && !["na", "n/a", "none", "nil", "not applicable"].includes(text);
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value ?? "").replace(/[\s,]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, eighteen: 18,
  twenty: 20, "twenty-four": 24, thirty: 30, "thirty-six": 36,
};

/**
 * "24 months" -> 24 | "2 years" -> 24 | "eleven months" -> 11 | "18" -> 18
 * A bare number is read as MONTHS, which is how these intake fields are used.
 * Returns null when no duration can be read, so a rule guarded on a duration
 * simply does not apply rather than firing on a value it cannot understand.
 */
export function parseDurationMonths(value) {
  const text = normalizeText(value);
  if (!text) return null;

  let quantity = toNumber(text);
  if (quantity === null) {
    for (const [word, number] of Object.entries(WORD_NUMBERS)) {
      if (new RegExp(`\\b${word}\\b`).test(text)) {
        quantity = number;
        break;
      }
    }
  }
  if (quantity === null) return null;

  if (/\byears?\b|\byrs?\b/.test(text)) return quantity * 12;
  if (/\bdays?\b/.test(text)) return quantity / 30;
  if (/\bweeks?\b/.test(text)) return quantity / 4.345;
  return quantity; // months, stated or assumed
}

// ── Predicate evaluation ─────────────────────────────────────────────────────

function readVar(names, variables) {
  const candidates = Array.isArray(names) ? names : [names];
  for (const name of candidates) {
    const value = variables?.[name];
    if (hasMeaningfulValue(value)) return value;
  }
  return undefined;
}

function evaluateVarPredicate(predicate, variables) {
  const value = readVar(predicate.var, variables);
  const op = String(predicate.op || "present").toLowerCase();
  const expected = predicate.value;

  if (op === "present") return value !== undefined;
  if (op === "absent") return value === undefined;

  // Every remaining operator is a comparison, and a comparison against a value
  // the user never supplied is not a violation -- it is simply not applicable.
  if (value === undefined) return false;

  const text = normalizeText(value);

  switch (op) {
    case "eq":           return text === normalizeText(expected);
    case "neq":          return text !== normalizeText(expected);
    case "contains":     return text.includes(normalizeText(expected));
    case "not_contains": return !text.includes(normalizeText(expected));
    case "in":
      return (expected || []).some((entry) => normalizeText(entry) === text);
    case "not_in":
      return !(expected || []).some((entry) => normalizeText(entry) === text);
    case "matches":
      try {
        return new RegExp(String(expected), "i").test(String(value));
      } catch {
        return false;
      }
    case "gt": case "gte": case "lt": case "lte": {
      const left = toNumber(value);
      const right = toNumber(expected);
      if (left === null || right === null) return false;
      if (op === "gt") return left > right;
      if (op === "gte") return left >= right;
      if (op === "lt") return left < right;
      return left <= right;
    }
    case "months_gte": case "months_lt": {
      const months = parseDurationMonths(value);
      const threshold = toNumber(expected);
      if (months === null || threshold === null) return false;
      return op === "months_gte" ? months >= threshold : months < threshold;
    }
    default:
      return false;
  }
}

function evaluatePredicate(predicate, context) {
  if (!predicate || typeof predicate !== "object") return true;

  if (predicate.not) return !evaluatePredicate(predicate.not, context);
  if (Array.isArray(predicate.any_of)) {
    return predicate.any_of.some((entry) => evaluatePredicate(entry, context));
  }

  if (Array.isArray(predicate.doc_type_in)) {
    const current = String(context.docType || "").toUpperCase();
    return predicate.doc_type_in.some(
      (entry) => String(entry || "").toUpperCase() === current
    );
  }
  if (Array.isArray(predicate.clause_present)) {
    return predicate.clause_present.some((id) => context.clauseIds.has(id));
  }
  if (Array.isArray(predicate.clause_absent)) {
    return !predicate.clause_absent.some((id) => context.clauseIds.has(id));
  }
  if (Array.isArray(predicate.category_present)) {
    return predicate.category_present.some((category) =>
      context.categories.has(String(category || "").toUpperCase())
    );
  }
  if (Array.isArray(predicate.state_in)) {
    const state = normalizeText(
      readVar(["governing_law_state", "operating_state", "state"], context.variables)
    );
    return predicate.state_in.some((entry) => normalizeText(entry) === state);
  }
  if (predicate.var !== undefined) {
    return evaluateVarPredicate(predicate, context.variables);
  }

  return true;
}

function evaluateAll(predicates, context) {
  if (!Array.isArray(predicates) || predicates.length === 0) return true;
  return predicates.every((predicate) => evaluatePredicate(predicate, context));
}

function ruleAppliesToDocType(rule, docType) {
  const normalized = String(docType || "").toUpperCase();

  // Deny-list wins: a rule can be scoped out of specific document types even
  // when it otherwise applies to everything (e.g. the bilateral general-
  // provisions floor must not apply to unilateral published terms).
  if (Array.isArray(rule.excludes_doc_types)) {
    const excluded = rule.excludes_doc_types.some(
      (entry) => String(entry || "").toUpperCase() === normalized
    );
    if (excluded) return false;
  }

  if (!Array.isArray(rule.applies_to_doc_types)) return true;
  return rule.applies_to_doc_types.some((entry) => {
    const candidate = String(entry || "").toUpperCase();
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
}

function describeUnmetAssertion(rule) {
  for (const predicate of rule.assert || []) {
    if (Array.isArray(predicate.clause_present)) return predicate.clause_present[0];
  }
  if (Array.isArray(rule.fails_if)) return rule.fails_if[0];
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {string[]} presentClauseIds  clause_ids present in the draft
 * @param {Array}    rules             constraint rules for the relevant domains
 * @param {string}   docType
 * @param {object}   context           { variables, clauses } -- lets a rule test
 *                                     its own condition (lease term, state, ...)
 * @returns {{violations: Array, evaluated: Array}}
 */
export function runConstraints(presentClauseIds = [], rules = [], docType = "", context = {}) {
  const evaluationContext = {
    clauseIds: new Set(presentClauseIds || []),
    categories: new Set(
      (context.clauses || []).map((clause) =>
        String(clause?.category || "").toUpperCase()
      )
    ),
    variables: context.variables || {},
    docType: docType || "",
  };

  const violations = [];
  const evaluated = [];

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule?.rule_id) continue;
    if (!ruleAppliesToDocType(rule, docType)) {
      evaluated.push({ rule_id: rule.rule_id, outcome: "not_applicable" });
      continue;
    }

    // A rule with neither assert nor fails_if asserts nothing; record that
    // rather than treating it as vacuously passing, so an empty rule is visible.
    const assertions = Array.isArray(rule.assert)
      ? rule.assert
      : Array.isArray(rule.fails_if)
        ? [{ clause_present: rule.fails_if }]
        : null;

    if (!assertions) {
      evaluated.push({ rule_id: rule.rule_id, outcome: "no_assertion" });
      continue;
    }

    if (!evaluateAll(rule.when, evaluationContext)) {
      evaluated.push({ rule_id: rule.rule_id, outcome: "not_applicable" });
      continue;
    }

    if (evaluateAll(assertions, evaluationContext)) {
      evaluated.push({ rule_id: rule.rule_id, outcome: "pass" });
      continue;
    }

    evaluated.push({ rule_id: rule.rule_id, outcome: "fail" });
    violations.push({
      rule_id: rule.rule_id,
      severity: rule.severity || "HIGH",
      message:
        rule.description ||
        `Constraint "${rule.rule_id}" is not satisfied by this document.`,
      missing_clause_id: describeUnmetAssertion(rule),
      statutory_reference: rule.statutory_reference || null,
      suggestion: rule.remedy || null,
      // A notice tells the user something they should know; it is not a defect
      // in the draft. formatValidationResult routes these away from the
      // actionable set, so they never block generation or export.
      ...(rule.notice_only === true
        ? { notice_only: true, blocks_generation: false }
        : {}),
    });
  }

  return { violations, evaluated };
}

/**
 * Backwards-compatible wrapper: the original signature returned violations only.
 * Existing callers keep working; new callers use runConstraints() to also get
 * the per-rule outcomes needed for honest coverage reporting.
 */
export function evaluateConstraints(presentClauseIds = [], rules = [], docType = "", context = {}) {
  return runConstraints(presentClauseIds, rules, docType, context).violations;
}
