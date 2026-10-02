/**
 * provenanceInjector.test.mjs — D4.43
 *
 * The first producer instrumented: the variable injector. Recording where a value
 * came from must change nothing that ships, must use only the closed vocabulary,
 * must never attach a record to text it does not describe, and must not become a
 * satisfaction verdict.
 *
 * The byte-for-byte gate over the whole corpus is tests/provenanceConservation.test.mjs.
 * This file proves the injector itself against a frozen copy of its pre-D4.43 code.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectVariables } from "../backend/services/variableInjector.js";
import { injectVariables as referenceInject } from "./fixtures/variableInjector.D4_42.reference.mjs";
import {
  SOURCE_CLASS, NOT_YET_RECORDED, PRODUCERS, INSTRUMENTED, withProvenanceRecording, isRecording, sha256,
} from "../backend/services/provenance.js";
import { generateDocument } from "../backend/services/documentService.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };
const W = (t) => ({ ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });

/* ── 1. The injector returns what it returned before ─────────────────────── */

const KEYS = ["party_1_name", "employer_name", "shareholder_1_name", "partner_1_name", "company_name", "party_2_name",
  "employee_name", "guarantor_name", "party_1_address", "employer_address", "company_address", "party_2_address",
  "guarantor_address", "party_1_type", "party_2_type", "guarantor_type", "party_1_cin", "employer_pan", "company_gstin",
  "party_2_llpin", "guarantor_pan", "purpose", "services_description", "project_description", "partnership_name",
  "jv_name", "loan_amount", "guaranteed_amount", "property_address", "confidentiality_period", "agreement_term",
  "contract_duration", "non_compete_period", "license_fee", "rent_amount", "license_term", "lease_term", "permitted_use",
  "prepayment_premium", "organisation_address", "arbitration_city", "execution_city"];
const DERIVED = ["party_1_name", "party_2_name", "party_1_address", "party_2_address", "party_1_type", "party_2_type",
  "party_1_descriptor", "party_2_descriptor", "guarantor_name", "guarantor_address", "guarantor_type", "guarantor_descriptor",
  "purpose", "confidentiality_period", "agreement_term", "non_compete_period", "occupancy_fee", "occupancy_term",
  "permitted_use", "prepayment_premium", "organisation_address", "arbitration_city"];
const POOL = [undefined, null, "", "   ", "Alpha Industries Private Limited", "Beta Consulting LLP", "Gamma Partnership",
  "Delta Rao", "Mumbai", "24 months", 0, 7, "12,00,000", "{{purpose}}", "[PARTY_1_NAME]", " padded value "];
/* mulberry32 — 32-bit integer arithmetic throughout. A float LCG loses precision above
   2^53 and collapses; the first version of this test used one and exercised almost
   nothing (a whitespace-handling mutation passed 4000 "random" cases). */
let seed = 20260901 >>> 0;
const rand = (n) => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) % n);
};
const TEMPLATE = [...DERIVED.map((k) => `{{${k}}}`), ...DERIVED.map((k) => `[${k.toUpperCase()}]`), "{{ purpose }}", "{{unknown_key}}"].join(" | ");

await check("instrumented injectVariables is byte-identical to the frozen pre-D4.43 injector, 4000 random inputs", async () => {
  for (let i = 0; i < 4000; i++) {
    const vars = {};
    for (const k of KEYS) if (rand(3) === 0) vars[k] = POOL[rand(POOL.length)];
    const expected = referenceInject(TEMPLATE, vars);
    assert.strictEqual(injectVariables(TEMPLATE, vars), expected, `outside recording, input ${JSON.stringify(vars)}`);
    const { result } = await withProvenanceRecording(async () => injectVariables(TEMPLATE, vars));
    assert.strictEqual(result, expected, `inside recording, input ${JSON.stringify(vars)}`);
  }
});

await check("recording happens only inside a generation that asked for it", async () => {
  assert.strictEqual(isRecording(), false);
  const { recorder } = await withProvenanceRecording(async () => { assert.strictEqual(isRecording(), true); injectVariables("{{purpose}}", {}); });
  assert.strictEqual(recorder.injections.length, 1);
  assert.deepStrictEqual(recorder.injections[0].slots.map((s) => [s.key, s.source_class, s.chosen_by]),
    [["purpose", SOURCE_CLASS.CONSTANT_DEFAULT, "variableInjector"]]);
  assert.strictEqual(isRecording(), false);
});

await check("the injector labels each choice by what won, not by what the key is called", async () => {
  const { recorder } = await withProvenanceRecording(async () => injectVariables(
    "{{party_1_name}}|{{party_1_type}}|{{purpose}}|{{agreement_term}}|{{non_compete_period}}|{{arbitration_city}}",
    { employer_name: "Alpha Industries Private Limited", company_name: "Alpha Industries Private Limited", contract_duration: "18 months", non_compete_period: "6 months", execution_city: "Pune" }));
  const by = Object.fromEntries(recorder.injections[0].slots.map((s) => [s.key, s]));
  assert.deepStrictEqual([by.party_1_name.source_class, by.party_1_name.from], [SOURCE_CLASS.ALIAS, ["employer_name"]]);
  assert.deepStrictEqual([by.party_1_type.source_class, by.party_1_type.value], [SOURCE_CLASS.DERIVED, "Private Limited Company"]);
  assert.deepStrictEqual([by.purpose.source_class, by.purpose.from], [SOURCE_CLASS.SYNTHESISED, ["company_name"]]);
  assert.deepStrictEqual([by.agreement_term.source_class, by.agreement_term.from], [SOURCE_CLASS.ALIAS, ["contract_duration"]]);
  assert.deepStrictEqual([by.non_compete_period.source_class, by.non_compete_period.chosen_by], [NOT_YET_RECORDED, "input"],
    "a value passed in was chosen UPSTREAM. The injector must not call it USER_SUPPLIED on the upstream producer's behalf.");
  assert.deepStrictEqual([by.arbitration_city.source_class, by.arbitration_city.from], [SOURCE_CLASS.ALIAS, ["execution_city"]]);
});

/* ── 2. The record on shipped drafts ───────────────────────────────────────── */

const ALLOWED = new Set([...Object.values(SOURCE_CLASS), NOT_YET_RECORDED]);
const shipped = [];
for (const t of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const out = await generateDocument({ document_type: t, variables: W(t) });
  if (out?.draft?.clauses?.length) shipped.push([t, out]);
}

await check("every shipped draft carries a record, and says which producers it does NOT yet cover", () => {
  assert.ok(shipped.length >= 29, `premise changed: only ${shipped.length} families ship under the fixture.`);
  for (const [t, out] of shipped) {
    const p = out.draft.metadata.provenance;
    assert.ok(p, `${t}: no provenance record`);
    assert.deepStrictEqual(p.producers_instrumented, [...INSTRUMENTED]);
    assert.deepStrictEqual(p.producers_not_yet_instrumented, PRODUCERS.filter((x) => !INSTRUMENTED.includes(x)));
    assert.deepStrictEqual(Object.keys(p.clauses).sort(), out.draft.clauses.map((c) => c.clause_id).sort(), `${t}: record and draft disagree on clauses`);
  }
});

await check("closed vocabulary: every recorded slot carries one class from the contract, or NOT_YET_RECORDED", () => {
  for (const [t, out] of shipped) for (const [id, c] of Object.entries(out.draft.metadata.provenance.clauses))
    for (const s of [...(c.injector?.slots || []), ...(c.recorded_choices || [])]) assert.ok(ALLOWED.has(s.source_class), `${t}/${id}/${s.key || s.field}: ${s.source_class}`);
});

await check("a record is attached only to the exact text it describes", () => {
  for (const [t, out] of shipped) for (const clause of out.draft.clauses) {
    const r = out.draft.metadata.provenance.clauses[clause.clause_id];
    assert.strictEqual(r.text_sha256, sha256(clause.text || ""), `${t}/${clause.clause_id}: hash does not describe the shipped text`);
    if (r.injector) {
      assert.deepStrictEqual(r.artifact_survival, { state: "SURVIVED", producer: "variableInjector" }, `${t}/${clause.clause_id}: injector record attached to text the injector did not produce`);
      for (const s of r.injector.slots) if (!s.empty) assert.ok(clause.text.includes(s.value), `${t}/${clause.clause_id}: recorded value ${JSON.stringify(s.value)} is not in the text`);
    }
  }
});

await check("D4.42 at runtime — the injector's non-compete default is NOT what ships, and the record says so", async () => {
  const v = { ...W("NDA"), include_non_compete: "Yes" }; delete v.non_compete_period;
  const out = await generateDocument({ document_type: "NDA", variables: v });
  const c = out.draft.clauses.find((x) => x.clause_id === "NDA_NON_COMPETE_001");
  assert.ok(c.text.includes("twelve (12) months"));
  const r = out.draft.metadata.provenance.clauses.NDA_NON_COMPETE_001;
  assert.strictEqual(r.injector, undefined,
    "the renderer re-rendered this clause after injection. An injector record attached here would describe '12 months', which is not what shipped.");
  assert.deepStrictEqual(r.artifact_survival, { state: "SURVIVED", producer: "documentHardening" });
});

await check("an injector choice that DOES ship is recorded against the text it is in", async () => {
  const out = await generateDocument({ document_type: "SHARE_SUBSCRIPTION_AGREEMENT", variables: W("SHARE_SUBSCRIPTION_AGREEMENT") });
  const r = out.draft.metadata.provenance.clauses.CORE_PURPOSE_001;
  assert.deepStrictEqual(r.artifact_survival, { state: "SURVIVED", producer: "variableInjector" });
  const s = r.injector.slots.find((x) => x.key === "purpose");
  assert.deepStrictEqual([s.source_class, s.from, s.chosen_by], [SOURCE_CLASS.SYNTHESISED, ["company_name"], "variableInjector"]);
});

await check("concurrent generations keep separate records", async () => {
  const a = { ...W("NDA"), purpose: "Evaluating a Quillfeather supply arrangement between the parties." };
  const b = W("LOAN_AGREEMENT");
  const [ra, rb] = await Promise.all([
    generateDocument({ document_type: "NDA", variables: a }),
    generateDocument({ document_type: "LOAN_AGREEMENT", variables: b }),
  ]);
  const recordText = (r) => JSON.stringify(r.draft.metadata.provenance);
  assert.ok(!recordText(rb).includes("Quillfeather"), "the loan's record contains a value from the NDA generation running beside it");
  assert.deepStrictEqual(Object.keys(rb.draft.metadata.provenance.clauses).sort(), rb.draft.clauses.map((c) => c.clause_id).sort());
});

/* ── 3. The boundary ────────────────────────────────────────────────────────── */

await check("provenance is read by nothing on the generation path, and the satisfaction layer does not import it", () => {
  const readers = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(m?js|jsx)$/.test(e.name)) continue;
      if (p.endsWith(path.join("services", "provenance.js"))) continue; // the writer
      const src = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      if (/metadata\??\.provenance|\["provenance"\]/.test(src)) readers.push(path.relative(ROOT, p));
    }
  })(path.join(ROOT, "backend"));
  assert.deepStrictEqual(readers, [], `something in backend reads the provenance record: ${readers.join(", ")}`);
  const sat = fs.readFileSync(path.join(ROOT, "backend/services/propositionSatisfaction.js"), "utf8");
  assert.ok(!/provenance/.test(sat.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
    "propositionSatisfaction references provenance. Source says where a value came from; it may not decide satisfaction (D4.40/D4.41).");
});

console.log(`\n${checks} checks passed`);
