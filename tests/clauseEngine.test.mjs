// Regression test for the context-aware clause engine.
// Run: node tests/clauseEngine.test.mjs
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../backend");

const { preloadKnowledgeBase, assembleDocument } = await import(
  pathToUrl(path.join(backend, "services/clauseAssembler.js"))
);
const { validateDocumentIntakeConfiguration } = await import(
  pathToUrl(path.join(backend, "services/documentIntakeConfig.js"))
);
const { DOCUMENT_CONFIG } = await import(
  pathToUrl(path.join(backend, "config/documentConfig.js"))
);

function pathToUrl(p) {
  return "file://" + (p.startsWith("/") ? p : "/" + p.replace(/\\/g, "/"));
}

const ids = (type, vars) => assembleDocument(type, vars).clauses.map((c) => c.clause_id);
const has = (type, vars, id) => ids(type, vars).includes(id);

// 1. Boots clean: full schema + reference + coverage validation.
const stats = preloadKnowledgeBase({ documentTypes: Object.keys(DOCUMENT_CONFIG) });
assert.ok(stats.clauseCount > 100, "clause library should load");
validateDocumentIntakeConfiguration();

// 2. NDA confidentiality variant swap + context conditionals.
const ndaBase = { party_1_name: "A", party_2_name: "B", purpose: "x", confidentiality_period: "2y", agreement_term: "2y" };
assert.ok(has("NDA", ndaBase, "CORE_CONFIDENTIALITY_001"), "plain NDA uses standard confidentiality");
assert.ok(
  has("NDA", { ...ndaBase, involves_trade_secrets: "Yes" }, "NDA_CONFIDENTIALITY_TRADE_SECRET_001"),
  "trade-secret NDA swaps to trade-secret confidentiality"
);
assert.ok(
  !has("NDA", { ...ndaBase, involves_trade_secrets: "Yes" }, "CORE_CONFIDENTIALITY_001"),
  "variant replaces the standard confidentiality clause"
);
assert.ok(has("NDA", { ...ndaBase, involves_source_code: "Yes" }, "NDA_SOURCE_CODE_PROTECTION_001"));
assert.ok(has("NDA", { ...ndaBase, counterparty_type: "Vendor" }, "NDA_NON_CIRCUMVENTION_001"));

// 3. Employment rebalance: junior has no non-compete; opt-in adds it.
const empBase = { employer_name: "X", employee_name: "Y", job_title: "Dev", salary: "100000", work_location: "BLR", notice_period_days: "30" };
assert.ok(!has("EMPLOYMENT_CONTRACT", empBase, "EMP_NON_COMPETE_001"), "junior employment has no non-compete");
assert.ok(has("EMPLOYMENT_CONTRACT", { ...empBase, include_non_compete: "Yes" }, "EMP_NON_COMPETE_001"));
assert.ok(has("EMPLOYMENT_CONTRACT", { ...empBase, seniority_level: "Senior / Leadership" }, "EMP_GARDEN_LEAVE_001"));

// 4. Service termination variant slot.
const svc = (style) => ids("SERVICE_AGREEMENT", style ? { termination_style: style } : {}).find((id) => id.includes("TERMINATION"));
assert.strictEqual(svc(), "SERVICE_TERMINATION_001", "default termination clause");
assert.strictEqual(svc("Convenience"), "SERVICE_TERMINATION_CONVENIENCE_001");
assert.strictEqual(svc("Default"), "SERVICE_TERMINATION_DEFAULT_001");
assert.strictEqual(svc("Cause"), "SERVICE_TERMINATION_CAUSE_001");

// 4b. Service payment variant slot.
const pay = (model) => ids("SERVICE_AGREEMENT", model ? { payment_model: model } : {}).find((id) => id.includes("PAYMENT"));
assert.strictEqual(pay(), "SERVICE_PAYMENT_001", "default payment clause");
assert.strictEqual(pay("Milestone"), "SERVICE_PAYMENT_MILESTONE_001");
assert.strictEqual(pay("Retainer"), "SERVICE_PAYMENT_RETAINER_001");
assert.strictEqual(pay("Fixed"), "SERVICE_PAYMENT_FIXED_FEE_001");

// 5. Cross-type personal-data toggle adds the data-processing clause.
for (const type of ["SALES_OF_GOODS_AGREEMENT", "MOU", "GUARANTEE_AGREEMENT"]) {
  assert.ok(!has(type, {}, "CORE_DATA_PROCESSING_001"), `${type} omits data-processing by default`);
  assert.ok(
    has(type, { involves_personal_data: "Yes" }, "CORE_DATA_PROCESSING_001"),
    `${type} adds data-processing when personal data is involved`
  );
}

// 6. Every configured type assembles without error.
for (const type of Object.keys(DOCUMENT_CONFIG)) {
  assert.ok(ids(type, {}).length > 0, `${type} assembles a non-empty clause set`);
}

console.log("Clause engine regression test passed.");
