/**
 * satisfactionReduction.test.mjs — D4.41
 *
 * PROVES TWO THINGS ABOUT THE REDUCTION OF CASE B, AND PINS WHY E WAS NOT REDUCED.
 *
 *   1. NO NEW EXPRESSION EVALUATOR. Joint satisfaction is expressed by composing
 *      matches() — the repository's one predicate evaluator — with a fixed
 *      depth-two traversal. Nothing is parsed, nothing nests, no operator is added.
 *
 *   2. NO SEMANTIC LEAKAGE. The mechanism evaluates conditions; it never supplies
 *      the truth condition, the meaning of an unevaluable condition, the meaning
 *      of vacuity, or the meaning of a clause that has not declared anything.
 *
 * The acceptance test for (2) is the one D4.41 was given: remove the concept and
 * evidence semantic interpretation, keep the mechanical evaluator, and the model
 * must still be able to STATE what it means for the proposition to be satisfied.
 *
 * Every run below is against a real assembled draft. Only the AUTHORING — which
 * dimensions a proposition has, which dimension a clause claims — is fixture,
 * because that authoring does not exist in the repository and D4.41 may not add it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assembleDocument, getClauseById } from "../backend/services/clauseAssembler.js";
import { matches } from "../backend/services/conceptResolver.js";
import {
  evaluateSatisfaction, describeSatisfaction, admitProposition, SATISFACTION, DIMENSION,
} from "../backend/services/propositionSatisfaction.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const MODULE = fs.readFileSync(path.join(ROOT, "backend/services/propositionSatisfaction.js"), "utf8");
const F = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/satisfaction-reduction.fixtures.json"), "utf8"));
const P = F.propositions;
const FD = F.clause_declarations;

/* Declaration sources. `live` is repository content; `withFixture` overlays the
   fixture authoring; `complete` is HYPOTHETICAL — case C satisfied, every present
   clause having declared what it establishes. */
const live = (id) => getClauseById(id)?.implements;
const withFixture = (id) => (id in FD ? FD[id] : live(id));
const complete = (id) => withFixture(id) ?? [];

const draftOf = (t, extra = {}) =>
  assembleDocument(t, { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }), ...extra });
const idsOf = (d) => d.clauses.map((c) => c.clause_id);

/* STAGE, stated (D4.42): case B is judged on the ASSEMBLED draft, not a shipped one,
   because IP_ASSIGNMENT_AGREEMENT does not ship under the well-filled fixture. What is
   judged is clause selection, which assembly completes; rendering is not in question.
   Case A/G1 below is judged on shipped drafts. */
const IP = draftOf("IP_ASSIGNMENT_AGREEMENT");
/* The SAME object the blueprint gates saw. The raw intake carries no assigns_*
   at all; the gate read derived controls. Judging required_when against anything
   else would be a trace of a different object. */
const IP_CTX = IP.metadata.resolved_generation_controls;
const ALL = P.IP_ASSIGNMENT_SPECIFIED__ALL_RIGHTS;
const IN_PLAY = P.IP_ASSIGNMENT_SPECIFIED__RIGHTS_IN_PLAY;
const run = (p, extra = {}) => evaluateSatisfaction(p, { presentClauseIds: idsOf(IP), declarationsOf: complete, context: IP_CTX, ...extra });

/* ═══ 1. NO NEW EXPRESSION EVALUATOR ═══════════════════════════════════════════ */

check("the module imports exactly one thing: matches, from the concept resolver", () => {
  const imports = [...MODULE.matchAll(/^\s*import\s+([^;]+?)\s+from\s+["']([^"']+)["']/gm)]
    .map((m) => ({ what: m[1].replace(/\s+/g, " ").trim(), from: m[2] }));
  assert.deepStrictEqual(imports, [{ what: "{ matches }", from: "./conceptResolver.js" }],
    `the reduction's import surface changed: ${JSON.stringify(imports)}. It may reuse mechanism and nothing ` +
    `else — any further import is a place semantics can arrive from.`);
});

check("the module contains no parser, no dispatch and no dynamic code", () => {
  /*
   * An evaluator is something that interprets a grammar. The reduction has none:
   * it walks a fixed two-level structure and hands every condition to matches().
   */
  for (const [pattern, what] of [
    [/\bswitch\s*\(/, "a switch"], [/\bcase\s+["'`]/, "a case label"], [/\beval\s*\(/, "eval"],
    [/new\s+Function\s*\(/, "new Function"], [/\bFunction\s*\(/, "Function()"],
  ]) {
    assert.ok(!pattern.test(MODULE),
      `propositionSatisfaction.js now contains ${what}. D4.40's operational rule: if implementing ` +
      `satisfaction requires writing an expression evaluator, stop.`);
  }
});

check("every evaluable condition goes through the injected mechanism, once, unaltered", () => {
  const calls = [];
  const spy = (cond, ctx) => { calls.push(cond); return matches(cond, ctx); };
  run(IN_PLAY, { evaluator: spy });
  const expected = IN_PLAY.dimensions.map((d) => d.required_when);
  assert.deepStrictEqual(calls, expected,
    "the reduction did not hand each required_when to the evaluator exactly once and unchanged. If it " +
    "rewrites or pre-evaluates a condition, it has become an evaluator itself.");
});

check("the layer defers to the mechanism on every condition it CAN evaluate", () => {
  /*
   * Invert the evaluator and the requiredness of every evaluable dimension must
   * invert with it. A layer that second-guessed the mechanism would not flip.
   */
  const normal = run(IN_PLAY).dimensions.map((d) => d.state);
  const inverted = run(IN_PLAY, { evaluator: (c, x) => !matches(c, x) }).dimensions.map((d) => d.state);
  assert.deepStrictEqual(normal, [DIMENSION.SATISFIED, DIMENSION.NOT_REQUIRED, DIMENSION.NOT_REQUIRED]);
  assert.deepStrictEqual(inverted, [DIMENSION.NOT_REQUIRED, DIMENSION.UNSATISFIED, DIMENSION.UNSATISFIED],
    "inverting the mechanism did not invert requiredness. The layer is deciding conditions itself.");
});

/* ═══ 2. NO SEMANTIC LEAKAGE — the acceptance test D4.41 was given ════════════ */

check("the module never names concept or evidence semantics", () => {
  for (const term of ["unresolved_behaviour", "resolveConcept", "loadConcepts", "conceptAttaches",
    "evidencePropositions", "EVIDENCE_", "APPLICABILITY", "safe_default", "assume"]) {
    assert.ok(!MODULE.includes(term),
      `propositionSatisfaction.js mentions "${term}". It may borrow the concept layer's predicate and nothing ` +
      `of its meaning — above all not its assumption machinery, whose 'assume present' turned around reads ` +
      `'assume the requirement is met'.`);
  }
});

check("REMOVE THE SEMANTICS, KEEP THE MECHANISM: the proposition still states its own truth condition", () => {
  /*
   * describeSatisfaction takes the proposition and nothing else — no evaluator,
   * no document, no concept record, no evidence. If it could not state what
   * satisfaction means without one of those, meaning would live in the mechanism.
   */
  for (const [name, p] of Object.entries(P)) {
    const text = describeSatisfaction(p);
    assert.ok(text.startsWith(p.proposition_id), `${name}: the statement does not open with the proposition.`);
    assert.ok(/never read as establishing nothing/.test(text),
      `${name}: the statement no longer says an undeclared clause is not a denial.`);
    if (p.dimensions?.some((d) => d.required_when)) {
      assert.ok(/absent value is not a false one/.test(text), `${name}: the statement dropped the absent-is-not-false rule.`);
      assert.ok(/legal question, not a default/.test(text), `${name}: the statement dropped the vacuity rule.`);
    }
  }
  assert.strictEqual(describeSatisfaction.length, 1,
    "describeSatisfaction now takes more than the proposition. Whatever was added is where meaning is leaking in from.");
});

check("swapping the mechanism for any implementation of its contract changes no verdict", () => {
  /*
   * A test double that knows only matches()'s documented `eq` contract — booleans
   * normalised — and nothing about concepts. Identical verdicts mean the
   * satisfaction semantics depend on the mechanism through its contract alone.
   */
  const bool = (v) => (v === undefined || v === null ? undefined
    : ["yes", "true", "y"].includes(String(v).trim().toLowerCase()) ? true
    : ["no", "false", "n"].includes(String(v).trim().toLowerCase()) ? false : String(v).trim().toLowerCase());
  const double = (c, x) => bool(x?.[c.var]) === bool(c.value);
  for (const p of [ALL, IN_PLAY]) {
    assert.deepStrictEqual(run(p, { evaluator: double }), run(p),
      `${p.proposition_id}: a contract-only evaluator changed the verdict, so the verdict depended on something ` +
      `in the concept layer beyond the mechanical contract.`);
  }
});

check("LEAK PROBE — an absent condition: the mechanism says false, the layer says unresolved", () => {
  /*
   * The concrete leak D4.41 exists to prevent. matches() returns false for an
   * absent variable. Used directly, that drops the dimension as not required and
   * the proposition goes green on a question nobody answered.
   */
  const ctx = { ...IP_CTX }; delete ctx.assigns_patents;
  const cond = IN_PLAY.dimensions[1].required_when;
  assert.strictEqual(matches(cond, ctx), false, "premise changed: the mechanism no longer returns false for an absent variable.");

  const calls = [];
  const spy = (c, x) => { calls.push(c.var); return matches(c, x); };
  const layer = run(IN_PLAY, { context: ctx, evaluator: spy });
  assert.strictEqual(layer.dimensions[1].state, DIMENSION.UNRESOLVED,
    `an ABSENT required_when variable produced ${layer.dimensions[1].state}. Absent is not false: the layer must hold it unresolved rather than let the mechanism's false drop the dimension.`);
  assert.strictEqual(layer.state, SATISFACTION.UNRESOLVED);
  assert.ok(!calls.includes("assigns_patents"),
    "the layer passed an absent variable to the mechanism. The meaning of absence must be decided HERE, before the mechanism is asked.");

  /* What the leak would have concluded: treating absent as false is exactly the
     context with the variable set to false — and that goes green. */
  const leaked = run(IN_PLAY, { context: { ...ctx, assigns_patents: false } });
  assert.strictEqual(leaked.state, SATISFACTION.ESTABLISHED,
    "premise changed: absent-as-false no longer produces a false ESTABLISHED, so this probe no longer demonstrates the leak.");
});

check("LEAK PROBE — an array var: refused, because the mechanism silently mis-reads it", () => {
  /*
   * matches() reads condition.var as a property key. An array coerces to one
   * comma-joined key that never exists. Observed live: supplying a GSTIN makes
   * GST_TAXABLE_SUPPLY resolve ABSENT (concept-layer-gaps.json).
   */
  assert.strictEqual(matches({ var: ["party_1_gstin", "party_2_gstin"], op: "present" }, { party_1_gstin: "27AAACA1234A1Z5" }), false,
    "premise changed: the mechanism now evaluates an array var. Update concept-layer-gaps.json and relax this admission rule deliberately.");
  const p = { proposition_id: "X", dimensions: [{ dimension_id: "d", required_when: { var: ["a", "b"], op: "eq", value: true } }] };
  assert.ok(!admitProposition(p).ok && /ONE variable name/.test(admitProposition(p).problems.join(" ")),
    "an array var was admitted. The reduction would inherit the mechanism's silent failure.");
});

check("LEAK PROBE — an unknown or undemonstrated operator: refused, not silently false", () => {
  assert.strictEqual(matches({ var: "x", op: "gte", value: 3 }, { x: 5 }), false,
    "premise changed: the mechanism now implements `gte`.");
  for (const op of ["gte", "present", "in"]) {
    const p = { proposition_id: "X", dimensions: [{ dimension_id: "d", required_when: { var: "x", op, value: true } }] };
    assert.ok(!admitProposition(p).ok,
      `required_when.op "${op}" was admitted. Only "eq" is demonstrated for B; anything else generalises past the evidence.`);
  }
});

check("LEAK PROBE — vacuity: nothing required is unresolved, never established", () => {
  const r = run(IN_PLAY, { context: { assigns_copyright: false, assigns_patents: false, assigns_trademarks: false } });
  assert.ok(r.dimensions.every((d) => d.state === DIMENSION.NOT_REQUIRED));
  assert.strictEqual(r.state, SATISFACTION.UNRESOLVED,
    "a proposition with no required dimension was not held unresolved. That default is the vacuous satisfaction D4.37 measured.");
  assert.match(r.reason, /VACUOUS/);
});

check("LEAK PROBE — a missing declaration is not a denial", () => {
  /*
   * D4.38's first guardrail, and the D4.35 false negative. With the live library
   * — twelve present clauses that have never declared anything — the all-rights
   * authoring cannot honestly be NOT_ESTABLISHED.
   */
  const today = run(ALL, { declarationsOf: withFixture });
  assert.strictEqual(today.state, SATISFACTION.UNRESOLVED,
    `with undeclared clauses present the verdict was ${today.state}. Reading silence as 'establishes nothing' is the D4.35 defect.`);
  const hypothetical = run(ALL, { declarationsOf: complete });
  assert.strictEqual(hypothetical.state, SATISFACTION.NOT_ESTABLISHED,
    "with every present clause declared (case C satisfied) the all-rights authoring should be definitely unsatisfied.");
});

/* ═══ 3. THE DEMONSTRATED CASES, ON REAL DRAFTS ════════════════════════════════ */

check("the context is the object the gates saw, and the raw intake is not it", () => {
  const raw = variablesFor("IP_ASSIGNMENT_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED });
  for (const v of ["assigns_copyright", "assigns_patents", "assigns_trademarks"]) {
    assert.ok(raw[v] === undefined, `premise changed: the raw intake now carries ${v}.`);
    assert.ok(IP_CTX[v] !== undefined, `the gate context no longer carries ${v}.`);
  }
  /* And the wrong object fails SAFE — everything escalates, nothing is decided. */
  const wrong = run(IN_PLAY, { context: raw });
  assert.ok(wrong.dimensions.every((d) => d.state === DIMENSION.UNRESOLVED) && wrong.state === SATISFACTION.UNRESOLVED,
    "judged against the raw intake, the reduction reached a verdict. Absent-is-not-false should make the wrong object fail safe.");
});

check("case B — the same real draft, two legal answers, two verdicts, and the evaluator chose neither", () => {
  assert.deepStrictEqual(idsOf(IP).filter((i) => /COPYRIGHT_ASSIGN|PATENT_RIGHTS|TRADEMARK_ASSIGN/.test(i)), ["IPA_COPYRIGHT_ASSIGNMENT_001"],
    "premise changed: the real IP draft no longer carries exactly the copyright grant.");
  const all = run(ALL), inPlay = run(IN_PLAY);
  assert.strictEqual(all.state, SATISFACTION.NOT_ESTABLISHED);
  assert.strictEqual(inPlay.state, SATISFACTION.ESTABLISHED);
  assert.strictEqual(ALL.proposition_id, IN_PLAY.proposition_id,
    "the two authorings must be the SAME proposition written two ways; otherwise this proves nothing about the evaluator.");
});

check("case B today — rights-in-play is established even with undeclared clauses present", () => {
  /* Undeclared clauses only block a NEGATIVE verdict; positive evidence stands. */
  assert.strictEqual(run(IN_PLAY, { declarationsOf: withFixture }).state, SATISFACTION.ESTABLISHED);
});

check("case F — opposite allocations both satisfy, inside a dimensioned proposition", () => {
  /*
   * Existential satisfaction must survive B. Driven through the real intake field
   * with its real options; the Shared world is excluded because IP_OWNERSHIP_001's
   * rendered text there is a different allocation under the same id (a G1 hazard).
   */
  const seen = {};
  for (const choice of ["Client owns all IP", "Developer retains IP"]) {
    const d = draftOf("SOFTWARE_DEVELOPMENT_AGREEMENT", { ip_ownership: choice });
    const r = evaluateSatisfaction(P.IP_OWNERSHIP_ALLOCATED, { presentClauseIds: idsOf(d), declarationsOf: withFixture });
    assert.strictEqual(r.state, SATISFACTION.ESTABLISHED, `"${choice}": opposite-allocation satisfaction failed.`);
    seen[choice] = r.dimensions[0].satisfied_by;
  }
  assert.deepStrictEqual(seen, { "Client owns all IP": ["IP_OWNERSHIP_001"], "Developer retains IP": ["IP_DEVELOPER_RETAINS_001"] },
    "the two worlds are no longer satisfied by the two opposite clauses — case F is not being demonstrated.");
});

/* D4.42 CORRECTION. As first written this case set `is_binding_mou` directly and ran
   assembleDocument. `is_binding_mou` is the DERIVED control the blueprint gate reads
   (generationControls derives it from `binding_nature`); it is not a form field, and
   assembleDocument does not sanitise to the form. So the test injected the gate's input
   instead of the user's answer, skipping the derivation, and judged an assembled draft.
   The conclusion held, but the door and the stage were wrong. It now goes through the
   real field, `binding_nature`, and generateDocument: the object judged is the one a
   user receives, reached the way a user reaches it. */
const MOU_FIXTURE = variablesFor("MOU", { profile: FIXTURE_PROFILE.WELL_FILLED });
const shippedIds = async (t, v) => ((await generateDocument({ document_type: t, variables: v }))?.draft?.clauses || []).map((c) => c.clause_id);
const MOU_SHIPPED = {
  Binding: await shippedIds("MOU", { ...MOU_FIXTURE, binding_nature: "Binding" }),
  "Non-binding": await shippedIds("MOU", { ...MOU_FIXTURE, binding_nature: "Non-binding" }),
};

check("case A and G1 — the LIVE declaration, world-correct by clause identity (shipped, real field)", () => {
  assert.ok(!("is_binding_mou" in (getVariables("MOU") || {})) && "binding_nature" in (getVariables("MOU") || {}),
    "premise changed: the MOU form's binding field is no longer `binding_nature`.");
  const binding = { clauses: MOU_SHIPPED.Binding.map((clause_id) => ({ clause_id })) };
  const nonBinding = { clauses: MOU_SHIPPED["Non-binding"].map((clause_id) => ({ clause_id })) };
  assert.ok(idsOf(binding).includes("MOU_BINDING_001") && idsOf(nonBinding).includes("MOU_NON_BINDING_001"),
    "premise changed: the shipped MOU no longer selects the two polarity clauses from binding_nature.");
  const a = evaluateSatisfaction(P.LEGAL_RELATIONS_INTENDED, { presentClauseIds: idsOf(binding), declarationsOf: live });
  const g1 = evaluateSatisfaction(P.LEGAL_RELATIONS_INTENDED, { presentClauseIds: idsOf(nonBinding), declarationsOf: live });
  assert.strictEqual(a.state, SATISFACTION.ESTABLISHED, "the binding MOU is not established from its live declaration.");
  assert.notStrictEqual(g1.state, SATISFACTION.ESTABLISHED,
    "the NON-binding MOU was established. That is the G1 false positive — one id carrying a claim into the wrong world.");
});

/* ═══ 4. SCOPE — what D4.41 did not touch ══════════════════════════════════════ */

check("nothing on the generation path imports the reduction", () => {
  const importers = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(m?js|jsx)$/.test(e.name) || p.endsWith("propositionSatisfaction.js")) continue;
      if (/propositionSatisfaction/.test(fs.readFileSync(p, "utf8"))) importers.push(path.relative(ROOT, p));
    }
  })(path.join(ROOT, "backend"));
  for (const extra of ["shared", "IRE"]) {
    (function walk(dir) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
        if (/\.(m?js)$/.test(e.name) && /propositionSatisfaction/.test(fs.readFileSync(p, "utf8"))) importers.push(path.relative(ROOT, p));
      }
    })(path.join(ROOT, extra));
  }
  assert.deepStrictEqual(importers, [],
    `the reduction is now reachable from ${importers.join(", ")}. D4.41 proves a reduction; wiring it into ` +
    `generation is a separate decision with its own record.`);
});

check("the concept resolver changed visibility only", () => {
  const src = fs.readFileSync(path.join(ROOT, "backend/services/conceptResolver.js"), "utf8");
  assert.match(src, /export function matches\(condition, values\)/, "matches is no longer exported under its original signature.");
  const callers = (src.match(/[^.\w]matches\(/g) || []).length - 1;   // minus the definition
  assert.strictEqual(callers, 1, `matches now has ${callers} callers inside the concept resolver; it had one.`);
});

check("case E is refused, not approximated", () => {
  const p = { proposition_id: "X", dimensions: [{ dimension_id: "d", requires_content: [{ var: "purpose", op: "present" }] }] };
  const verdict = admitProposition(p);
  assert.ok(!verdict.ok && /case E\) is not reduced/.test(verdict.problems.join(" ")),
    "context-dependent satisfaction was admitted. D4.41 found E irreducible without duplicating the placeholder " +
    "fallback chain or changing the injector; approximating it would be exactly that duplication.");
});

check("a proposition may not name its clauses", () => {
  for (const key of ["satisfied_by", "fails_if", "clauses"]) {
    const verdict = admitProposition({ proposition_id: "X", [key]: ["SOME_CLAUSE_001"] });
    assert.ok(!verdict.ok, `a proposition carrying ${key} was admitted — the id-list coupling, rebuilt.`);
  }
});

console.log(`\n${checks} checks passed`);
