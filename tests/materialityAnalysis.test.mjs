/**
 * materialityAnalysis.test.mjs
 *
 * Phase 3. An open position is not a question. These tests pin the two rules
 * that stop the gap check turning into another questionnaire:
 *
 *   1. Only a legally-material unknown is ever a candidate, and
 *   2. even then it is asked only where no conservative default exists.
 *
 * Plus the invariant that caught the rental defect: NO BLUEPRINT MAY GATE A
 * CLAUSE ON A FLAG NO INTAKE FIELD CAN REACH. A gate like that is decided by
 * silence forever, which is how every tenancy came to say the tenant pays all
 * utilities and that arrears come out of the deposit.
 */
import assert from "node:assert";
import { analyseOpenPositions, CLASSIFICATION, PROVENANCE } from "../backend/services/materialityAnalysis.js";

const CASES = [
  ["CONSULTANCY_AGREEMENT", {
    party_1_name: "Devraj Vishal Bhore", party_2_name: "Varun Raghunath Shastri",
    consulting_fee: "30000", contract_duration: "12 months",
    services_description: "Strategic advisory covering market entry.",
  }],
  ["RENTAL_AGREEMENT", {
    party_1_name: "Ramesh Anant Kulkarni", party_2_name: "Sneha Vikram Deshpande",
    property_address: "Flat 4B, Sunshine Apartments, MG Road, Pune, Maharashtra 411001",
    occupancy_fee: "25000", security_deposit: "100000", occupancy_term: "11 months",
  }],
  ["VENDOR_AGREEMENT", {
    party_1_name: "Ashwin Traders Private Limited", party_2_name: "Kesari Components LLP",
    goods_description: "Precision-machined brass fittings.", contract_value: "4500000",
  }],
];

let checks = 0;
const results = CASES.map(([documentType, variables]) =>
  analyseOpenPositions({ documentType, variables })
);

// ── 1. No gate is unreachable ───────────────────────────────────────────────
for (const { documentType, unreachable } of results) {
  assert.deepStrictEqual(
    unreachable.map((u) => `${u.flag} -> ${u.clauseIds.join("/")}`),
    [],
    `${documentType} gates a clause on a flag no intake field can set. That gate is ` +
    `decided by silence, which is a defect, not a default. Either collect the field or ` +
    `remove the gate.`
  );
  checks += 1;
}
console.log(`PASS  every blueprint gate is reachable from the intake (${results.length} types)`);

// ── 2. A benign unknown is never raised ─────────────────────────────────────
for (const { documentType, positions } of results) {
  const raised = positions.filter(
    (p) => p.classification === CLASSIFICATION.BENIGN && p.disposition !== "IGNORE"
  );
  assert.deepStrictEqual(raised.map((p) => p.flag), [],
    `${documentType} would raise a benign unknown: ${raised.map((p) => p.flag).join(", ")}`);
  checks += 1;
}

// ── 3. A position the law will not choose is never defaulted ────────────────
for (const { documentType, positions } of results) {
  const defaulted = positions.filter(
    (p) => p.provenance === PROVENANCE.REQUIRES_CHOICE && p.disposition !== "ASK"
  );
  assert.deepStrictEqual(defaulted.map((p) => p.flag), [],
    `${documentType} would adopt a default for a position the parties must elect: ` +
    `${defaulted.map((p) => p.flag).join(", ")}. Silently choosing one of these ` +
    `represents the user as having negotiated a term they never saw.`);
  checks += 1;
}
console.log("PASS  benign unknowns ignored; elective positions never defaulted");

// ── 4. The gap check stays a gap check ──────────────────────────────────────
// A checklist of twenty questions is the questionnaire this was built to avoid.
for (const { documentType, positions } of results) {
  const asks = positions.filter((p) => p.disposition === "ASK");
  assert.ok(
    asks.length <= 8,
    `${documentType} would ask ${asks.length} questions after a minimal intake. ` +
    `Above eight this has stopped being a gap check. Either the classification has ` +
    `drifted or a mechanism needs a conservative default it does not have.`
  );
  checks += 1;
}
console.log(
  "PASS  question counts stay bounded: " +
  results.map((r) => `${r.documentType.split("_")[0]}=${r.positions.filter((p) => p.disposition === "ASK").length}`).join(", ")
);

// ── 5. The rental utilities case, specifically ──────────────────────────────
const rental = results.find((r) => r.documentType === "RENTAL_AGREEMENT");
const utilities = rental.positions.find((p) => p.flag === "utilities_included");
assert.ok(utilities, "utilities_included must appear as an open position on a minimal tenancy");
assert.strictEqual(utilities.classification, CLASSIFICATION.LEGALLY_MATERIAL,
  "a clause that allocates every utility bill and creates a deposit set-off is legally material, " +
  "whatever category it sits in for ordering purposes");
assert.strictEqual(utilities.disposition, "ASK",
  "there is no conservative default for who pays the utilities; the parties have to say");
checks += 3;
console.log("PASS  rental utilities is legally material and asked, not assumed");

console.log(`\nALL GREEN (${checks} checks)`);
