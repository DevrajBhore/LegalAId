/**
 * satisfactionCapabilityAudit.test.mjs — D4.39
 *
 * PINS AN AUDIT TO THE MACHINERY IT AUDITED.
 *
 * D4.39 claims that every satisfaction requirement needing a new primitive
 * already has a working precedent in this repository. That claim is only worth
 * anything while the precedents still exist and still have the property cited.
 *
 * So this file checks the PRECEDENTS, not the prose. If the concept layer loses
 * its conjunction, or the evidence layer collapses its state vocabulary, the
 * audit's central finding is false and someone has to know.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVIDENCE, APPLICABILITY } from "../backend/services/evidencePropositions.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const A = readJson(path.join(ROOT, "knowledge-base/governance/satisfaction-capability-audit.json"));
const CASES = new Map(A.the_audit.map((c) => [c.case, c]));

check("every case D4.38 raised is audited exactly once", () => {
  const contract = readJson(path.join(ROOT, "knowledge-base/governance/satisfaction-contract.json"));
  const raised = contract.the_cases_the_contract_must_handle.cases.map((c) => c.id).sort();
  assert.deepStrictEqual([...CASES.keys()].sort(), raised,
    "the audited cases and the cases D4.38 raised no longer match. A requirement with no audit row is " +
    "unassessed, and an audit row with no requirement is answering a question nobody asked.");
});

check("the tally accounts for all eight and claims no unprecedented primitive", () => {
  const t = A.the_tally;
  const all = [...t.already_representable, ...t.representable_in_form_but_unenforced,
    ...t.new_primitive_with_an_existing_precedent, ...t.new_primitive_with_no_precedent];
  assert.strictEqual(all.length, CASES.size, `the tally covers ${all.length} cases, the audit has ${CASES.size}.`);
  assert.strictEqual(new Set(all).size, all.length, "a case appears in two tally buckets.");
  assert.deepStrictEqual(t.new_primitive_with_no_precedent, [],
    "a requirement now needs machinery with no precedent in the repository. That is the audit's central " +
    "finding reversed, and it changes the next decision entirely.");
});

/* ── The precedents themselves ────────────────────────────────────────────── */

check("case B's precedent — the operations execute, and the dimension shape is declaration only", () => {
  /*
   * CORRECTED IN D4.41. This check once treated requires_dimensions as executed
   * machinery. No code reads it; it is a data shape. What B actually reuses is
   * executed inside resolveConcept: one predicate (matches), conjunction across a
   * source's `when` list, disjunction across sources. The shape assertions below
   * remain, and are now labelled for what they are.
   */
  const resolverSrc = fs.readFileSync(path.join(ROOT, "backend/services/conceptResolver.js"), "utf8");
  assert.match(resolverSrc, /conditions\.every\(\(c\) => matches\(c, values\)\)/,
    "resolveConcept no longer conjoins a source's conditions through matches() — the executed conjunction B reuses is gone.");
  assert.match(resolverSrc, /evidence\.find\(\(e\) => e\.state === CONCEPT_STATE\.PRESENT\)/,
    "resolveConcept no longer takes the first positive source — the executed disjunction B reuses is gone.");
  /*
   * requires_dimensions is a conjunction across keys with disjunction inside
   * each. That is the exact shape joint satisfaction needs: copyright AND
   * patents AND trademarks, each satisfied by any of its own clauses.
   */
  const dir = path.join(ROOT, "knowledge-base/concepts");
  const withDimensions = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.includes("schema") && f !== "dimensions.json")
    .map((f) => readJson(path.join(dir, f)))
    .filter((c) => c.requires_dimensions && Object.keys(c.requires_dimensions).length);
  assert.ok(withDimensions.length >= 5,
    `only ${withDimensions.length} concepts declare requires_dimensions. Case B's precedent is disappearing.`);
  const multiKey = withDimensions.find((c) => Object.keys(c.requires_dimensions).length > 1);
  assert.ok(multiKey,
    "no concept requires more than one dimension any more, so the conjunction-across-keys pattern the audit " +
    "cites for joint satisfaction no longer exists in the repository.");
  const anyList = Object.values(multiKey.requires_dimensions).some((v) => Array.isArray(v) && v.length > 1);
  assert.ok(anyList,
    "no dimension offers alternatives, so the disjunction-within-conjunction shape is gone — and that shape, " +
    "not conjunction alone, is what case B needs.");
});

check("case E's precedent — the concept layer still carries content predicates", () => {
  /*
   * detection carries {var, op, value} over field:/control: sources, and
   * attributes types the values. Together they already express 'this holds when
   * this field has this value' — pointed at applicability.
   */
  const dir = path.join(ROOT, "knowledge-base/concepts");
  let withPredicates = 0, withTypedAttributes = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || f.includes("schema") || f === "dimensions.json") continue;
    const c = readJson(path.join(dir, f));
    const rules = Object.values(c.detection || {}).flat().filter(Boolean);
    if (rules.some((r) => Array.isArray(r?.when) && r.when.some((w) => w && "var" in w && "op" in w))) withPredicates += 1;
    if (c.attributes && Object.values(c.attributes).some((a) => a && a.type)) withTypedAttributes += 1;
  }
  assert.ok(withPredicates >= 3,
    `only ${withPredicates} concepts carry {var, op, value} detection predicates. Case E's precedent is the ` +
    `claim that context machinery already exists; without these it does not.`);
  assert.ok(withTypedAttributes >= 3,
    `only ${withTypedAttributes} concepts declare typed attributes. Predicates without typed values are half ` +
    `the precedent.`);
});

check("case G's precedent — the evidence layer still refuses to collapse its states", () => {
  /*
   * The strongest precedent, because it is the same lesson already learned
   * here: absent says nothing either way, and is not a denial. The satisfaction
   * layer currently repeats the mistake this vocabulary exists to correct.
   */
  const required = ["PRESENT", "ABSENT", "MISMATCHED", "INADMISSIBLE", "AMBIGUOUS", "STALE", "CONFLICTING"];
  for (const k of required) {
    assert.ok(EVIDENCE[k], `the evidence vocabulary lost ${k}. Each was a distinct false positive once; ` +
      `collapsing any two recreates the bug that separated them, and case G's precedent rests on all seven.`);
  }
  assert.strictEqual(new Set(Object.values(EVIDENCE)).size, required.length,
    "two evidence states now share a value, which is collapse by another route.");
  assert.ok(APPLICABILITY.UNKNOWN,
    "APPLICABILITY.UNKNOWN is gone — the fourth value that stops 'nobody established this' reading as " +
    "'this does not apply'.");
});

check("case D's precedent — a review surface that refuses an answer without its basis", () => {
  const src = fs.readFileSync(path.join(ROOT, "backend/services/constraintScopeReviewService.js"), "utf8");
  assert.match(src, /authority/i,
    "the constraint scope review service no longer requires an authority. The audit cites it as the " +
    "repository's precedent for a review that will not accept an answer without its basis.");
});

check("case C's precedent — an admission gate that makes silent omission impossible", () => {
  const src = fs.readFileSync(path.join(ROOT, "backend/services/documentRequirements.js"), "utf8");
  assert.match(src, /admit/,
    "documentRequirements no longer exposes an admission gate. Case C's fix — requiring a declaration so " +
    "omission cannot be silent — cites it as the existing pattern.");
});

/* ── The audit must stay an audit ─────────────────────────────────────────── */

check("no schema was proposed, and nothing was migrated", () => {
  assert.ok(/no representation selected/i.test(String(A.status || "")),
    "the audit's status no longer says no representation was selected.");
  const joined = JSON.stringify(A.what_this_record_does_not_do || []);
  assert.ok(/no schema, no field names/i.test(joined) && /migrate/i.test(joined),
    "the audit no longer disclaims proposing a schema or migrating anything.");
});

check("the legal residue is still listed and still six items", () => {
  /*
   * The list that does not shrink. A schema appearing to shorten it has
   * absorbed a judgement into a default, which is the failure mode every phase
   * of this investigation has refused.
   */
  const j = A.what_no_primitive_will_settle?.judgements || [];
  assert.ok(j.length >= 6,
    `the legal-residue list is down to ${j.length}. It does not shrink because machinery was added; if it ` +
    `looks shorter, a judgement was absorbed into a default.`);
  assert.ok(A.what_no_primitive_will_settle.$this_list_does_not_shrink,
    "the note explaining why the list does not shrink was dropped, which is the half that prevents misreading it.");
});

check("F's design constraint on B is kept", () => {
  /*
   * The one cross-case constraint: existential satisfaction must survive
   * whatever joint satisfaction is built, or the opposite-outcomes case breaks.
   */
  const f = CASES.get("F_OPPOSITE_OUTCOMES_BOTH_SATISFY");
  assert.ok(f?.$the_design_constraint_this_creates,
    "the record no longer states that existential satisfaction must survive case B's repair. That is the " +
    "constraint most easily lost when joint satisfaction is designed.");
});

console.log(`\n${checks} checks passed`);
