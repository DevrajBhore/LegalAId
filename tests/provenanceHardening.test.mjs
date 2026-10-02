/**
 * provenanceHardening.test.mjs — D4.43 stages 1 and 2
 *
 * Stage 1: renderHardClause is observed centrally. That is COVERAGE: which renderer
 * ran, what it read, what it found missing, whether its text shipped. It is not
 * provenance, and nothing here may treat it as provenance.
 *
 * Stage 2: the fallback branches of the 20 fields D4.42 showed shipping unchosen
 * wording record their choice at the moment they make it. These are the rows the
 * advocate report will be built from.
 *
 * Two dimensions are kept apart throughout: artifact_survival (did the text reach
 * the artifact) and source class (where a value came from).
 * The byte-for-byte gate is tests/provenanceConservation.test.mjs.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { SOURCE_CLASS, NOT_YET_RECORDED, SURVIVAL, STATUS, INSTRUMENTATION } from "../backend/services/provenance.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };
const W = (t) => ({ ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
const without = (v, ...keys) => { const o = { ...v }; for (const k of keys) delete o[k]; return o; };
const gen = async (t, v) => (await generateDocument({ document_type: t, variables: v }));
const rec = (out, id) => out.draft.metadata.provenance.clauses[id];
const choiceOf = (out, id, field) => (rec(out, id)?.recorded_choices || []).filter((c) => c.field === field);

const corpus = [];
for (const t of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const out = await gen(t, W(t));
  if (out?.draft?.clauses?.length) corpus.push([t, out]);
}

/* ── Stage 1: coverage ─────────────────────────────────────────────────────── */

await check("the record declares hardening as OBSERVED with selected choices, not as instrumented", () => {
  assert.strictEqual(INSTRUMENTATION.documentHardening, "OBSERVED_WITH_SELECTED_CHOICES_RECORDED");
  for (const [, out] of corpus) assert.strictEqual(out.draft.metadata.provenance.instrumentation.documentHardening, "OBSERVED_WITH_SELECTED_CHOICES_RECORDED");
});

await check("every renderer invocation is observed: identity, reads split into present and missing, whether it shipped", () => {
  let observed = 0;
  for (const [t, out] of corpus) for (const [id, r] of Object.entries(out.draft.metadata.provenance.clauses)) {
    if (!r.renderer) continue;
    observed += 1;
    assert.strictEqual(r.renderer.renderer, `documentHardening.renderHardClause[${id}]`);
    const both = r.renderer.read_and_present.filter((k) => r.renderer.read_and_missing.includes(k));
    assert.deepStrictEqual(both, [], `${t}/${id}: a key is both present and missing`);
    assert.strictEqual(typeof r.renderer.produced_shipped_text, "boolean");
    assert.ok(r.renderer.invocations >= 1);
  }
  assert.ok(observed > 400, `premise changed: only ${observed} renderer clauses observed`);
});

await check("coverage is not provenance: a renderer clause is never RECORDED as a whole", () => {
  for (const [t, out] of corpus) for (const [id, r] of Object.entries(out.draft.metadata.provenance.clauses))
    if (r.artifact_survival.producer === "documentHardening")
      assert.strictEqual(r.provenance_status, STATUS.NOT_YET_RECORDED, `${t}/${id}: renderer clause reported ${r.provenance_status}`);
});

/* ── The two dimensions ────────────────────────────────────────────────────── */

await check("survival and source are different dimensions and never mix", () => {
  const survivalStates = new Set(Object.values(SURVIVAL));
  const classes = new Set([...Object.values(SOURCE_CLASS), NOT_YET_RECORDED]);
  for (const [t, out] of corpus) for (const [id, r] of Object.entries(out.draft.metadata.provenance.clauses)) {
    assert.ok(survivalStates.has(r.artifact_survival.state), `${t}/${id}: survival ${r.artifact_survival.state}`);
    for (const c of [...(r.recorded_choices || []), ...(r.injector?.slots || [])]) {
      assert.ok(classes.has(c.source_class), `${t}/${id}: class ${c.source_class}`);
      assert.ok(!survivalStates.has(c.source_class), `${t}/${id}: a survival state used as a source class`);
    }
    if (r.provenance_status === STATUS.WITHHELD) {
      assert.ok(survivalStates.has(r.withheld_reason) && r.withheld_reason !== SURVIVAL.SURVIVED);
      assert.ok(!r.recorded_choices && !r.injector, `${t}/${id}: a withheld clause carries value-level claims`);
    }
  }
});

await check("TRANSFORMED_AFTER_PRODUCTION withholds a real default: the service-level text is changed after the renderer", async () => {
  const out = await gen("SERVICE_AGREEMENT", without(W("SERVICE_AGREEMENT"), "service_levels"));
  const r = rec(out, "SERVICE_SLA_001");
  assert.ok(out.draft.clauses.find((c) => c.clause_id === "SERVICE_SLA_001").text.includes("the service levels expressly recorded in this Agreement"));
  assert.strictEqual(r.provenance_status, STATUS.WITHHELD);
  assert.deepStrictEqual(r.artifact_survival, { state: SURVIVAL.TRANSFORMED_AFTER_PRODUCTION, last_producer: "documentHardening" });
  assert.ok(r.withheld_choice_count >= 1, "the renderer did choose; the choice is counted but not asserted against text it did not produce");
});

/* ── Stage 2: labelled fallback branches ───────────────────────────────────── */

const ADVOCATE_ROWS = [
  ["NDA", { include_non_compete: "Yes", include_non_solicit: "Yes" }, ["non_compete_period"], "NDA_NON_COMPETE_001", "non_compete_period", "twelve (12) months", "documentHardening.resolveRestrictionPeriod"],
  ["NDA", { include_non_compete: "Yes", include_non_solicit: "Yes" }, ["non_compete_period"], "NDA_NON_SOLICITATION_001", "non_compete_period", "twelve (12) months", "documentHardening.resolveRestrictionPeriod"],
  ["INDEPENDENT_CONTRACTOR_AGREEMENT", { include_non_compete: "Yes", include_non_solicit: "Yes" }, ["non_compete_period"], "EMP_NON_COMPETE_001", "non_compete_period", "twelve (12) months", "documentHardening.resolveRestrictionPeriod"],
  ["EMPLOYMENT_CONTRACT", {}, ["probation_period"], "EMP_PROBATION_001", "probation_period", "the period expressly stated in this Agreement", "documentHardening.renderers.EMP_PROBATION_001"],
  ["EMPLOYMENT_CONTRACT", {}, ["leave_policy"], "EMP_LEAVE_POLICY_001", "leave_policy", null, "documentHardening.renderers.EMP_LEAVE_POLICY_001"],
  ["SOFTWARE_DEVELOPMENT_AGREEMENT", {}, ["change_request_process"], "SERVICE_CHANGE_REQUEST_001", "change_request_process", null, "documentHardening.renderers.SERVICE_CHANGE_REQUEST_001"],
  ["JOINT_VENTURE_AGREEMENT", {}, ["exit_terms"], "JV_EXIT_001", "exit_terms", null, "documentHardening.renderers.JV_EXIT_001"],
  ["LOAN_AGREEMENT", {}, ["events_of_default"], "LOAN_DEFAULT_001", "events_of_default", null, "documentHardening.renderers.LOAN_DEFAULT_001"],
];

await check("an unanswered material field whose text survives yields an advocate-grade row", async () => {
  for (const [t, extra, drop, id, field, literal, producer] of ADVOCATE_ROWS) {
    const out = await gen(t, without({ ...W(t), ...extra }, ...drop));
    const r = rec(out, id);
    assert.deepStrictEqual(r.artifact_survival, { state: SURVIVAL.SURVIVED, producer: "documentHardening" }, `${t}/${id}`);
    const cs = choiceOf(out, id, field);
    assert.ok(cs.length >= 1, `${t}/${id}: no choice recorded for ${field}`);
    for (const c of cs) {
      assert.strictEqual(c.source_class, SOURCE_CLASS.CONSTANT_DEFAULT, `${t}/${id}/${field}`);
      assert.strictEqual(c.producer, producer);
      assert.strictEqual(c.field_answered, false);
      if (literal) assert.strictEqual(c.value, literal);
      const shipped = out.draft.clauses.find((x) => x.clause_id === id).text;
      assert.ok(shipped.includes(c.value.split("; ")[0].trim()), `${t}/${id}: the recorded default is not in the shipped text`);
    }
  }
});

await check("the answered branch records the answer as passed in, never as a default", async () => {
  const out = await gen("NDA", { ...W("NDA"), include_non_compete: "Yes", non_compete_period: "24 months" });
  const [c] = choiceOf(out, "NDA_NON_COMPETE_001", "non_compete_period");
  assert.deepStrictEqual([c.source_class, c.chosen_by, c.value, c.field_answered], [NOT_YET_RECORDED, "input", "24 months", true]);
});

await check("the class comes from the branch, not from how the text looks", async () => {
  // A user who TYPES the default's exact words chose them. Same text, different source.
  const out = await gen("NDA", { ...W("NDA"), include_non_compete: "Yes", non_compete_period: "twelve (12) months" });
  const [c] = choiceOf(out, "NDA_NON_COMPETE_001", "non_compete_period");
  assert.deepStrictEqual([c.value, c.source_class, c.field_answered], ["twelve (12) months", NOT_YET_RECORDED, true]);
});

await check("the place of execution derived upstream is an ALIAS here, with the upstream producer named, not guessed", async () => {
  const out = await gen("NDA", without(W("NDA"), "execution_city"));
  const [c] = choiceOf(out, "CORE_GOVERNING_LAW_001", "execution_city");
  assert.deepStrictEqual([c.source_class, c.from, c.value, c.field_answered], [SOURCE_CLASS.ALIAS, ["arbitration_city"], "Mumbai", false]);
  assert.match(c.upstream, /generationControls \(not yet instrumented\)/);
});

await check("an unanswered optional sentence that is simply left out is WITHDRAWN, not a default", async () => {
  // CORE_CONFIDENTIALITY_001 adds an access-restriction sentence only when one was given.
  const out = await gen("SERVICE_AGREEMENT", without(W("SERVICE_AGREEMENT"), "confidentiality_access_scope"));
  assert.strictEqual(rec(out, "CORE_CONFIDENTIALITY_001").artifact_survival.state, SURVIVAL.SURVIVED);
  const [c] = choiceOf(out, "CORE_CONFIDENTIALITY_001", "confidentiality_access_scope");
  assert.deepStrictEqual([c.source_class, c.value, c.field_answered], [SOURCE_CLASS.WITHDRAWN, "", false]);
});

await check("where the renderer substitutes its own standard instead, that is a CONSTANT_DEFAULT", async () => {
  const out = await gen("SOFTWARE_DEVELOPMENT_AGREEMENT", without(W("SOFTWARE_DEVELOPMENT_AGREEMENT"), "acceptance_criteria"));
  const [c] = choiceOf(out, "TECH_ACCEPTANCE_001", "acceptance_criteria");
  assert.deepStrictEqual([c.source_class, c.field_answered], [SOURCE_CLASS.CONSTANT_DEFAULT, false]);
  assert.match(c.value, /^the requirements of the Services and the deliverables described in this Agreement/);
});

await check("only the 20 D4.42 fields record choices inside the renderers", () => {
  const FIELDS = new Set(["execution_city", "confidential_information_definition", "confidentiality_exclusions", "confidentiality_access_scope",
    "non_compete_period", "probation_period", "leave_policy", "service_levels", "expenses_policy", "warranty_period", "acceptance_criteria",
    "management_control", "exit_terms", "risk_transfer_terms", "title_transfer_terms", "events_of_default", "invocation_conditions",
    "invocation_procedure", "change_request_process", "retention_period"]);
  const src = fs.readFileSync(path.join(ROOT, "backend/services/documentHardening.js"), "utf8");
  const labelled = new Set([...src.matchAll(/(?:chose|orConstant|strippedOrConstant|sentenceFor)\(\s*"([a-z_]+)"/g)].map((m) => m[1]));
  assert.deepStrictEqual([...labelled].filter((f) => !FIELDS.has(f)), [], "a field outside the D4.42 set was labelled without evidence");
  assert.deepStrictEqual([...FIELDS].filter((f) => !labelled.has(f)), [], "a D4.42 field has no labelled branch");
});

console.log(`\n${checks} checks passed`);
