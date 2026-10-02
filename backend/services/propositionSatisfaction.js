/**
 * propositionSatisfaction.js — D4.41 reduction proof for case B (joint satisfaction).
 *
 * NOT WIRED INTO GENERATION. Nothing on the generation path imports this module,
 * and tests/satisfactionReduction.test.mjs asserts that. It exists to prove that
 * joint satisfaction can be expressed by COMPOSING machinery this repository
 * already executes, without writing a new evaluator and without inheriting
 * anyone else's semantics.
 *
 *   REUSED (mechanism)  matches() — the repository's one predicate evaluator.
 *                       Nothing else from the concept layer; nothing at all from
 *                       the evidence layer.
 *   OWNED  (meaning)    the truth condition, what an unevaluable condition means,
 *                       what vacuity means, and what an undeclared clause means.
 *   REFUSED (admission) every input the reused mechanism is known to evaluate
 *                       silently and wrongly.
 *
 * Case E (context-dependent satisfaction) is deliberately NOT here. It could not
 * be reduced without duplicating the placeholder fallback chain or changing the
 * injector; see knowledge-base/governance/satisfaction-reduction.json.
 *
 * THE SHAPE, fixed at depth two with no operators and no nesting:
 *
 *   proposition = { proposition_id, dimensions?: [ { dimension_id, required_when? } ] }
 *
 *   — every REQUIRED dimension must be satisfied                 (AND across)
 *   — a dimension is satisfied by ANY present clause declaring it (OR within)
 *
 * The proposition names NO clauses. Clauses declare what they establish, on the
 * clause, where the knowledge is authored (D4.38 case C). A proposition carrying
 * a list of clause ids would be the id-list coupling D4.35 and D4.37 measured,
 * rebuilt one layer over.
 */
import { matches } from "./conceptResolver.js";

export const SATISFACTION = Object.freeze({
  ESTABLISHED: "ESTABLISHED",
  NOT_ESTABLISHED: "NOT_ESTABLISHED",
  UNRESOLVED: "UNRESOLVED",
});

export const DIMENSION = Object.freeze({
  SATISFIED: "SATISFIED",
  UNSATISFIED: "UNSATISFIED",
  NOT_REQUIRED: "NOT_REQUIRED",
  UNRESOLVED: "UNRESOLVED",
});

/* A proposition without explicit dimensions has exactly one, satisfied by any
   clause declaring the whole proposition. Case A, and the live MOU declaration. */
const WHOLE = "*";

/* Keys that would put clause identity on the proposition. Refused by name. */
const CLAUSE_LIST_KEYS = ["satisfied_by", "fails_if", "clauses", "clause_ids", "implemented_by"];

/* The one operator the demonstrated case needs. matches() also implements
   `present` and `in`; neither is demonstrated for required_when, and admitting
   them would generalise past the evidence. */
const ADMITTED_REQUIRED_WHEN_OPS = new Set(["eq"]);

const isAbsent = (v) => v === undefined || v === null || String(v).trim() === "";

/* ── Admission ──────────────────────────────────────────────────────────────── */

/**
 * Check a proposition before anything evaluates it. Returns every problem, not
 * the first, so an author sees the whole record's defects at once.
 */
export function admitProposition(p) {
  const problems = [];
  if (!p || typeof p !== "object") return { ok: false, problems: ["not an object"] };
  if (typeof p.proposition_id !== "string" || !p.proposition_id) problems.push("proposition_id is required");

  for (const key of CLAUSE_LIST_KEYS) {
    if (key in p) problems.push(
      `${key}: a proposition must not name the clauses that satisfy it. Clauses declare what they ` +
      `establish; a list here rebuilds the id-list coupling this reduction exists to remove.`);
  }
  if ("requires_content" in p || (p.dimensions || []).some((d) => d && "requires_content" in d)) {
    problems.push("requires_content: context-dependent satisfaction (case E) is not reduced. See satisfaction-reduction.json.");
  }

  if (p.dimensions !== undefined) {
    if (!Array.isArray(p.dimensions) || !p.dimensions.length) problems.push("dimensions, when given, must be a non-empty array");
    const seen = new Set();
    for (const d of p.dimensions || []) {
      const id = d?.dimension_id;
      if (typeof id !== "string" || !id || id === WHOLE) { problems.push(`dimension_id must be a non-empty string other than "${WHOLE}"`); continue; }
      if (seen.has(id)) problems.push(`${id}: duplicate dimension_id`);
      seen.add(id);
      for (const key of CLAUSE_LIST_KEYS) if (key in d) problems.push(`${id}.${key}: a dimension must not name its clauses either`);

      const w = d.required_when;
      if (w === undefined) continue;
      /* The reused mechanism reads condition.var as a property key. An array is
         coerced to one comma-joined key that never exists, so the condition is
         silently false — observed live in two concept records. Refused here so
         this layer cannot inherit that failure. */
      if (!w || typeof w !== "object") { problems.push(`${id}.required_when must be an object`); continue; }
      if (typeof w.var !== "string" || !w.var) problems.push(`${id}.required_when.var must be ONE variable name (an array is silently mis-evaluated by the reused mechanism)`);
      /* An unknown op makes matches() return false — silently. */
      if (!ADMITTED_REQUIRED_WHEN_OPS.has(w.op)) problems.push(`${id}.required_when.op must be one of: ${[...ADMITTED_REQUIRED_WHEN_OPS].join(", ")} (got ${JSON.stringify(w.op)})`);
      if (w.value === undefined) problems.push(`${id}.required_when.value is required`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/* ── Declarations (clause side) ─────────────────────────────────────────────── */

/**
 * Normalise what one clause declares about ONE proposition.
 *
 *   undefined      the clause has never declared what it establishes
 *   []             it has declared, and establishes nothing in this proposition
 *   [dims…]        it establishes these dimensions (WHOLE for an undimensioned one)
 *   "AMBIGUOUS"    it names the proposition without a dimension, but the proposition
 *                  has dimensions — a claim that cannot be read either way
 *
 * The first two are different facts. Reading `undefined` as `[]` is exactly the
 * D4.35 false negative, and D4.38's first guardrail.
 */
function declaredDimensions(rawImplements, propositionId, dimensioned) {
  if (rawImplements === undefined || rawImplements === null) return undefined;
  if (!Array.isArray(rawImplements)) return undefined;
  const dims = [];
  let ambiguous = false;
  for (const entry of rawImplements) {
    if (typeof entry === "string") {
      if (entry !== propositionId) continue;
      if (dimensioned) ambiguous = true; else dims.push(WHOLE);
    } else if (entry && typeof entry === "object" && entry.proposition_id === propositionId) {
      if (entry.dimension_id) dims.push(entry.dimension_id);
      else if (dimensioned) ambiguous = true;
      else dims.push(WHOLE);
    }
  }
  return ambiguous ? "AMBIGUOUS" : dims;
}

/* ── The truth condition, stated with no evaluator and no context ──────────── */

/**
 * What it MEANS for the proposition to be satisfied. Takes nothing but the
 * proposition: no evaluator, no document, no concept record, no evidence. If
 * this function ever needs one of those, semantic ownership has leaked out of
 * the proposition and into a mechanism.
 */
export function describeSatisfaction(p) {
  const admitted = admitProposition(p);
  if (!admitted.ok) throw new Error(`cannot describe an inadmissible proposition: ${admitted.problems.join("; ")}`);
  const tail =
    " A clause that has never declared what it establishes is never read as establishing nothing:" +
    " if such a clause is present, a dimension no declaring clause covers is unresolved rather than unsatisfied.";
  if (!p.dimensions) {
    return `${p.proposition_id} is established when at least one clause present in the document declares that it establishes ${p.proposition_id}.` + tail;
  }
  const parts = p.dimensions.map((d) => {
    const w = d.required_when;
    return w ? `${d.dimension_id} (required only when ${w.var} ${w.op} ${JSON.stringify(w.value)})` : `${d.dimension_id} (always required)`;
  });
  return (
    `${p.proposition_id} is established when every required dimension is satisfied: ${parts.join("; ")}.` +
    " A dimension is satisfied when at least one clause present in the document declares that it establishes that dimension;" +
    " alternatives within a dimension are alternatives, and none is preferred." +
    " If the condition deciding whether a dimension is required cannot be evaluated, the proposition is unresolved — an absent value is not a false one." +
    " If no dimension is required in the document's context, the proposition is unresolved: whether it is then established is a legal question, not a default." +
    tail
  );
}

/* ── Evaluation ─────────────────────────────────────────────────────────────── */

/**
 * @param {object}   p                   an admitted proposition
 * @param {object}   opts
 * @param {string[]} opts.presentClauseIds  clause ids in the document being judged
 * @param {Function} opts.declarationsOf    clauseId -> that clause's raw `implements`
 *                                          value (undefined if it has never declared)
 * @param {object}   [opts.context]         the values required_when is judged against —
 *                                          the SAME object the blueprint gates saw
 * @param {Function} [opts.evaluator]       the predicate mechanism; defaults to matches()
 */
export function evaluateSatisfaction(p, { presentClauseIds = [], declarationsOf, context, evaluator = matches } = {}) {
  const admitted = admitProposition(p);
  if (!admitted.ok) throw new Error(`inadmissible proposition ${p?.proposition_id}: ${admitted.problems.join("; ")}`);
  if (typeof declarationsOf !== "function") throw new Error("declarationsOf is required: satisfaction is read from what clauses declare");

  const dimensioned = Array.isArray(p.dimensions);
  const dimensions = dimensioned ? p.dimensions : [{ dimension_id: WHOLE }];

  /* What every present clause says about THIS proposition. */
  const byClause = presentClauseIds.map((id) => ({ id, dims: declaredDimensions(declarationsOf(id), p.proposition_id, dimensioned) }));
  const undeclared = byClause.filter((c) => c.dims === undefined).map((c) => c.id);
  const ambiguous = byClause.filter((c) => c.dims === "AMBIGUOUS").map((c) => c.id);

  const results = dimensions.map((d) => {
    /* 1 — is this dimension required here? The mechanism evaluates the
       condition; THIS layer decides what an unevaluable condition means. */
    const w = d.required_when;
    if (w) {
      if (!context || typeof context !== "object") {
        return { dimension_id: d.dimension_id, state: DIMENSION.UNRESOLVED, reason: "no context was supplied, so whether this dimension is required cannot be decided" };
      }
      if (isAbsent(context[w.var])) {
        /* The reused mechanism would return FALSE here and the dimension would
           be dropped as not required — a false positive for the proposition.
           Absent is not false. */
        return { dimension_id: d.dimension_id, state: DIMENSION.UNRESOLVED, reason: `${w.var} is absent from the context, so whether this dimension is required cannot be decided. Absent is not false.` };
      }
      if (!evaluator(w, context)) {
        return { dimension_id: d.dimension_id, state: DIMENSION.NOT_REQUIRED, reason: `${w.var} ${w.op} ${JSON.stringify(w.value)} does not hold in this document's context` };
      }
    }

    /* 2 — is it satisfied? Any present declaring clause will do. */
    const satisfiers = byClause.filter((c) => Array.isArray(c.dims) && c.dims.includes(d.dimension_id)).map((c) => c.id);
    if (satisfiers.length) return { dimension_id: d.dimension_id, state: DIMENSION.SATISFIED, satisfied_by: satisfiers };

    /* 3 — nothing declares it. Unsatisfied ONLY if every present clause has made
       a declaration that could have covered it. */
    if (undeclared.length || ambiguous.length) {
      return {
        dimension_id: d.dimension_id, state: DIMENSION.UNRESOLVED,
        reason: `no present clause declares this dimension, but ${undeclared.length} present clause(s) have never declared what they establish` +
          (ambiguous.length ? ` and ${ambiguous.length} declare the proposition without naming a dimension` : "") +
          "; any of them may establish it. A missing declaration is not a denial.",
        undeclared_present: undeclared.length, ambiguous_present: ambiguous,
      };
    }
    return { dimension_id: d.dimension_id, state: DIMENSION.UNSATISFIED, reason: "required, and every present clause has declared what it establishes without covering this dimension" };
  });

  /* Aggregation. A definite failure in a conjunction is a definite failure —
     logic, not an assumption. Anything else short of full satisfaction escalates. */
  let state, reason;
  if (results.some((r) => r.state === DIMENSION.UNSATISFIED)) {
    state = SATISFACTION.NOT_ESTABLISHED; reason = "a required dimension is definitely unsatisfied";
  } else if (results.some((r) => r.state === DIMENSION.UNRESOLVED)) {
    state = SATISFACTION.UNRESOLVED; reason = "at least one dimension could not be decided, and none is definitely unsatisfied";
  } else if (results.every((r) => r.state === DIMENSION.NOT_REQUIRED)) {
    state = SATISFACTION.UNRESOLVED; reason = "VACUOUS: no dimension is required in this context. Whether the proposition is then established is a legal question, and a default here would be the vacuous satisfaction D4.37 measured.";
  } else {
    state = SATISFACTION.ESTABLISHED; reason = "every required dimension is satisfied by a present, declaring clause";
  }
  return { proposition_id: p.proposition_id, state, reason, dimensions: results };
}
