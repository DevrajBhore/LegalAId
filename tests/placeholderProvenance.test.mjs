/**
 * placeholderProvenance.test.mjs — D4.42
 *
 * PINS WHAT FILLS A SLOT, AS OBSERVED. REPAIRS NOTHING.
 *
 * D4.42 measured where the values in a shipped instrument come from. The product
 * records none of it, and D4.42 was not authorised to change the generation path.
 * Every check below is driven through generateDocument with real form fields and
 * reads the shipped text. Each asserts CURRENT behaviour: when someone changes one,
 * this file fails, and knowledge-base/governance/placeholder-provenance.json must be
 * updated in the same change. A pin is not an endorsement.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { injectVariables } from "../backend/services/variableInjector.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { ESSENTIAL_FIELDS } from "../backend/config/essentialFields.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/governance/placeholder-provenance.json"), "utf8"));
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };
const CHANGED = (id) => `behaviour CHANGED for ${id}. Update knowledge-base/governance/placeholder-provenance.json in the same change.`;
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
const W = (t) => ({ ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
const ship = async (t, v) => {
  const out = await generateDocument({ document_type: t, variables: v });
  return out?.draft?.clauses?.length ? out.draft.clauses.map((c) => ({ id: c.clause_id, text: norm(c.text) })) : null;
};
const clause = (d, id) => d?.find((c) => c.id === id)?.text;
const without = (v, k) => { const o = { ...v }; delete o[k]; return o; };

await check("the record lists exactly the findings this file pins", () => {
  assert.deepStrictEqual(R.verified_findings.map((f) => f.id), [
    "TWO_RENDERING_PATHS_TWO_DEFAULTS",
    "RESTRICTIVE_PERIOD_FILLED_FROM_NO_INPUT",
    "NA_INVITED_BY_LABEL_REFUSED_BY_VALIDATOR",
    "SELF_REFERENTIAL_FILL",
    "PLACE_OF_EXECUTION_DERIVED_FROM_PARTY_ADDRESS",
    "CLIENT_DEFAULTS_ARRIVE_AS_ANSWERS",
    "ONE_CONCEPT_TWO_CHAINS_TWO_SOURCES",
    "REQUIRED_FREE_TEXT_ANSWER_WITH_NO_EFFECT",
  ]);
});

await check("TWO_RENDERING_PATHS_TWO_DEFAULTS — the injector's default is not what ships", async () => {
  assert.strictEqual(injectVariables("{{non_compete_period}}", {}), "12 months", CHANGED("the injector constant"));
  const d = await ship("NDA", without({ ...W("NDA"), include_non_compete: "Yes" }, "non_compete_period"));
  const t = clause(d, "NDA_NON_COMPETE_001");
  assert.ok(t && t.includes("twelve (12) months") && !t.includes("12 months thereafter"), CHANGED("NDA_NON_COMPETE_001 unanswered period"));
});

await check("RESTRICTIVE_PERIOD_FILLED_FROM_NO_INPUT — opted in, period unanswered, twelve months ships", async () => {
  for (const [t, id] of [["NDA", "NDA_NON_COMPETE_001"], ["NDA", "NDA_NON_SOLICITATION_001"],
    ["INDEPENDENT_CONTRACTOR_AGREEMENT", "EMP_NON_COMPETE_001"], ["CONSULTANCY_AGREEMENT", "EMP_NON_SOLICITATION_001"]]) {
    assert.strictEqual(getVariables(t).non_compete_period.required, false, `premise changed: ${t} now requires the period.`);
    const base = { ...W(t), include_non_compete: "Yes", include_non_solicit: "Yes" };
    for (const v of [without(base, "non_compete_period"), { ...base, non_compete_period: "" }]) {
      assert.ok(clause(await ship(t, v), id)?.includes("twelve (12) months"), CHANGED(`${t}/${id}`));
    }
  }
});

await check("NA_INVITED_BY_LABEL_REFUSED_BY_VALIDATOR — even with both restrictions off", async () => {
  assert.match(getVariables("NDA").non_compete_period.label, /\bNA\b/, "premise changed: the label no longer invites NA.");
  const out = await generateDocument({ document_type: "NDA",
    variables: { ...W("NDA"), include_non_compete: "No", include_non_solicit: "No", non_compete_period: "NA" } });
  assert.ok(!out?.draft?.clauses?.length && /INVALID_INPUT_1/.test(JSON.stringify(out)), CHANGED("NA refusal"));
});

await check("SELF_REFERENTIAL_FILL — probation refers to a period the agreement never states", async () => {
  const d = await ship("EMPLOYMENT_CONTRACT", without(W("EMPLOYMENT_CONTRACT"), "probation_period"));
  assert.ok(clause(d, "EMP_PROBATION_001")?.includes("for the period expressly stated in this Agreement"), CHANGED("EMP_PROBATION_001"));
  const elsewhere = d.filter((c) => c.id !== "EMP_PROBATION_001" && /probation/i.test(c.text)).map((c) => c.id);
  assert.deepStrictEqual(elsewhere, [], CHANGED("probation stated elsewhere"));
});

await check("PLACE_OF_EXECUTION_DERIVED_FROM_PARTY_ADDRESS — and it follows the address", async () => {
  const base = without(W("NDA"), "execution_city");
  const moved = { ...base, party_1_address: base.party_1_address.replace(/Mumbai/g, "Nagpur") };
  for (const [v, city] of [[base, "Mumbai"], [moved, "Nagpur"]]) {
    const d = await ship("NDA", v);
    assert.ok(clause(d, "CORE_IDENTITY_001")?.includes(`executed at ${city}`), CHANGED(`executed at ${city}`));
    assert.ok(clause(d, "CORE_GOVERNING_LAW_001")?.includes(`courts at ${city}`), CHANGED(`forum ${city}`));
  }
  assert.strictEqual(getVariables("NDA").execution_city.required, true);
  assert.ok(!DOCUMENT_CONFIG.NDA.requiredFields.includes("execution_city"), CHANGED("server-side requiredness"));
  assert.ok(!ESSENTIAL_FIELDS.NDA.includes("execution_city"), CHANGED("quick-mode visibility"));
});

await check("CLIENT_DEFAULTS_ARRIVE_AS_ANSWERS — the browser writes values the server cannot tell apart", () => {
  const form = fs.readFileSync(path.join(ROOT, "frontend/src/pages/Form.jsx"), "utf8");
  const block = form.slice(form.indexOf("const SELECT_DEFAULTS"), form.indexOf("};", form.indexOf("const SELECT_DEFAULTS")));
  assert.match(block, /ip_ownership:\s*"Employer owns work product IP"/, CHANGED("SELECT_DEFAULTS"));
  assert.ok(getVariables("EMPLOYMENT_CONTRACT").ip_ownership.options.includes("Employer owns work product IP"), CHANGED("where the default applies"));
  assert.ok(!ESSENTIAL_FIELDS.EMPLOYMENT_CONTRACT.includes("ip_ownership"), CHANGED("ip_ownership now shown in quick mode"));
  const call = form.slice(form.indexOf("await generateDocument({"), form.indexOf("});", form.indexOf("await generateDocument({")));
  assert.ok(!/provenance|defaulted|source/i.test(call), CHANGED("the request now carries provenance"));
  /* $declaration_level: this reads source. What it pins is the ABSENCE of a channel. */
});

await check("ONE_CONCEPT_TWO_CHAINS_TWO_SOURCES — SOFTWARE_DEVELOPMENT_AGREEMENT purpose", async () => {
  const d = await ship("SOFTWARE_DEVELOPMENT_AGREEMENT", { ...W("SOFTWARE_DEVELOPMENT_AGREEMENT"),
    services_description: "design, development and deployment of a mobile inventory-tracking application for the Client's warehouses",
    project_description: "a cross-platform inventory management app with barcode scanning and offline sync" });
  const recital = clause(d, "CORE_IDENTITY_001"), purpose = clause(d, "CORE_PURPOSE_001");
  assert.ok(recital.includes("mobile inventory-tracking") && !recital.includes("barcode scanning"), CHANGED("recital source"));
  assert.ok(purpose.includes("barcode scanning") && !purpose.includes("mobile inventory-tracking"), CHANGED("purpose-clause source"));
});

await check("REQUIRED_FREE_TEXT_ANSWER_WITH_NO_EFFECT — LOAN repayment_schedule", async () => {
  assert.strictEqual(getVariables("LOAN_AGREEMENT").repayment_schedule.required, true);
  const a = await ship("LOAN_AGREEMENT", W("LOAN_AGREEMENT"));
  const b = await ship("LOAN_AGREEMENT", { ...W("LOAN_AGREEMENT"), repayment_schedule: "Six quarterly instalments beginning after a nine-month moratorium." });
  assert.deepStrictEqual(a, b, CHANGED("repayment_schedule now reaches the instrument"));
});

console.log(`\n${checks} checks passed`);
