import assert from "node:assert";
import { applyDocumentHardening } from "../backend/services/documentHardening.js";

// Wave 1: every bilateral instrument inherits a floor of general provisions from
// drafting_policies.json -> hardening.baselineClauseIds, unioned with whatever
// the document type adds in requiredClauseIds. Before this, RENTAL_AGREEMENT
// shipped with none of them.

const variables = {
  party_1_name: "Rajput Private Limited", party_1_type: "Private Limited Company",
  party_1_address: "12 Market Road, Mumbai, Maharashtra 400001",
  party_2_name: "Sharma Trading Co", party_2_type: "Partnership Firm",
  party_2_address: "44 Industrial Estate, Pune, Maharashtra 411001",
  effective_date: "2026-07-31", execution_city: "Mumbai", purpose: "the lease of commercial premises",
};

// A deliberately bare draft — the general provisions must be supplied by the baseline.
const bare = (documentType) => ({
  document_type: documentType,
  clauses: [
    { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Parties", text: "placeholder" },
    { clause_id: "CORE_GOVERNING_LAW_001", category: "GOVERNING_LAW", title: "Governing Law", text: "Laws of India." },
    { clause_id: "CORE_SIGNATURE_BLOCK_001", category: "SIGNATURE_BLOCK", title: "Execution", text: "IN WITNESS WHEREOF..." },
  ],
});

const idsFor = (dt) =>
  applyDocumentHardening(bare(dt), { document_type: dt, variables }).clauses.map((c) => c.clause_id);

const BASELINE = [
  "CORE_DEFINITIONS_001","CORE_INTERPRETATION_001","CORE_NOTICE_001","CORE_SEVERABILITY_001",
  "CORE_WAIVER_001","CORE_ENTIRE_AGREEMENT_001","CORE_AMENDMENT_001","CORE_ASSIGNMENT_001",
  "CORE_COUNTERPARTS_001","CORE_FORCE_MAJEURE_001","CORE_SURVIVAL_001",
  "CORE_STAMP_AND_COSTS_001","CORE_FURTHER_ASSURANCE_001",
];

// 1. Rental had ZERO general provisions before this change.
const rental = idsFor("RENTAL_AGREEMENT");
for (const id of BASELINE) {
  assert.ok(rental.includes(id), `RENTAL_AGREEMENT should now carry ${id}`);
}
console.log(`PASS  RENTAL_AGREEMENT: 3 clauses in -> ${rental.length} out, all 13 general provisions present`);

// 2. Loan disallows FORCE_MAJEURE — the baseline must not smuggle it back in.
const loan = idsFor("LOAN_AGREEMENT");
assert.ok(!loan.includes("CORE_FORCE_MAJEURE_001"),
  "LOAN_AGREEMENT disallows FORCE_MAJEURE; baseline must not re-inject it");
assert.ok(loan.includes("CORE_STAMP_AND_COSTS_001"), "LOAN_AGREEMENT should still get the rest of the baseline");
console.log("PASS  LOAN_AGREEMENT: disallowedProtections still honoured (no force majeure), baseline otherwise applied");

const guarantee = idsFor("GUARANTEE_AGREEMENT");
assert.ok(!guarantee.includes("CORE_FORCE_MAJEURE_001"), "GUARANTEE_AGREEMENT disallows FORCE_MAJEURE");
console.log("PASS  GUARANTEE_AGREEMENT: force majeure correctly withheld");

// 3. Unilateral instruments get the narrow set, not the bilateral one.
const tos = idsFor("TERMS_OF_SERVICE");
for (const id of ["CORE_DEFINITIONS_001","CORE_INTERPRETATION_001","CORE_SEVERABILITY_001",
                  "CORE_ENTIRE_AGREEMENT_001","CORE_WAIVER_001"]) {
  assert.ok(tos.includes(id), `TERMS_OF_SERVICE should carry ${id}`);
}
for (const id of ["CORE_COUNTERPARTS_001","CORE_ASSIGNMENT_001","CORE_FURTHER_ASSURANCE_001",
                  "CORE_RELATIONSHIP_OF_PARTIES_001"]) {
  assert.ok(!tos.includes(id), `TERMS_OF_SERVICE must NOT carry ${id} (no counterparty, no execution)`);
}
console.log("PASS  TERMS_OF_SERVICE: narrow unilateral baseline applied, bilateral provisions withheld");

// 4. Independent-contractor characterisation only where correct.
assert.ok(idsFor("SERVICE_AGREEMENT").includes("CORE_RELATIONSHIP_OF_PARTIES_001"),
  "SERVICE_AGREEMENT should state the parties are independent contractors");
assert.ok(!idsFor("EMPLOYMENT_CONTRACT").includes("CORE_RELATIONSHIP_OF_PARTIES_001"),
  "EMPLOYMENT_CONTRACT must NOT state the parties are independent contractors");
console.log("PASS  Relationship-of-parties: present for services, correctly absent for employment");

// 5. No duplicates introduced.
for (const dt of ["RENTAL_AGREEMENT","SERVICE_AGREEMENT","LOAN_AGREEMENT","NDA"]) {
  const ids = idsFor(dt);
  assert.strictEqual(new Set(ids).size, ids.length, `${dt} has duplicate clause_ids`);
}
console.log("PASS  No duplicate clauses introduced");
console.log("\nALL GREEN");

// ── 6. Every blueprint must be reachable ────────────────────────────────────
// A blueprint with no DOCUMENT_CONFIG entry has no intake form, so no party
// fields, so getParticipantExpectations() returns [] and the formal deed
// opening in documentHardening silently falls back to the raw library text.
// The document type cannot actually be generated. Three such orphans exist
// today (CONTRACTOR_AGREEMENT, EMPLOYMENT_AGREEMENT, IP_ASSIGNMENT_AGREEMENT),
// each superseded by a configured type. This test pins that list so a NEW
// orphan is caught, rather than silently shipping a broken document type.
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");
const fsMod = await import("node:fs");
const bpDir = new URL("../knowledge-base/clause_library/blueprints/", import.meta.url);

const KNOWN_ORPHAN_BLUEPRINTS = new Set([
  "CONTRACTOR_AGREEMENT",
  "EMPLOYMENT_AGREEMENT",
  "IP_ASSIGNMENT_AGREEMENT",
]);

// A blueprint flagged `_unreachable` is deliberately not offered: it is either
// superseded, or a finished type held back as a product decision. The loader,
// the library review tools and the required-field coverage test all skip these,
// and so does this check — otherwise withdrawing a type would mean either
// deleting work that is finished, or leaving a test permanently red.
const orphans = fsMod.readdirSync(bpDir)
  .filter((f) => f.endsWith(".blueprint.json"))
  .map((f) => JSON.parse(fsMod.readFileSync(new URL(f, bpDir), "utf8")))
  .filter((bp) => bp._unreachable !== true)
  .map((bp) => bp.document_type)
  .filter((dt) => !DOCUMENT_CONFIG[dt]);

const unexpected = orphans.filter((dt) => !KNOWN_ORPHAN_BLUEPRINTS.has(dt));
assert.deepStrictEqual(
  unexpected,
  [],
  `Blueprint(s) with no DOCUMENT_CONFIG entry — these cannot be generated: ${unexpected.join(", ")}`
);
console.log(
  `PASS  Blueprint reachability: ${orphans.length} known orphan(s), no new ones`
);
