/**
 * nPartyIdentity.test.mjs — D4.45 P0
 *
 * Identity checks reach every actual party, not four fixed positions: a term
 * sheet's founders (party_3, party_4), a partnership's third partner, and the
 * named principals of a shareholders' agreement, whose identifiers sit in
 * party_N_* while their names sit in shareholder_N_*. Names, entity types,
 * identifiers and defined roles are each tested, with negative controls.
 */
import assert from "node:assert";
import fs from "fs";

const { validatePartyIdentity } = await import("../backend/services/partyIdentityValidator.js");
const { validateDraftConsistency } = await import("../backend/services/draftConsistencyValidator.js");
const { generateDocument } = await import("../backend/services/documentService.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; console.log(`PASS  ${msg}`); };
const I = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.inputs.json", import.meta.url), "utf8"));
const ids = (type, v) => validatePartyIdentity({ documentType: type, variables: v }).map((i) => i.rule_id);
const sev = (type, v, rule) => validatePartyIdentity({ documentType: type, variables: v }).find((i) => i.rule_id === rule)?.severity;

/* Term sheet founders (parties 3 and 4) */
ok(ids("TERM_SHEET", I.complete).length === 0, "negative control: a correct four-party term sheet raises nothing");
ok(ids("TERM_SHEET", { ...I.complete, party_3_pan: "ABCPR1234K" }).length === 0, "negative control: a founder with a personal PAN raises nothing");
ok(ids("TERM_SHEET", { ...I.complete, party_3_pan: "AABCK1234C" }).includes("ENTITY_TYPE_CONTRADICTS_PAN_PARTY_3"),
  "a founder (party 3) carrying a company PAN is caught");
ok(sev("TERM_SHEET", { ...I.complete, party_1_pan: "AABCK1234C", party_4_pan: "AABCK1234C" }, "DUPLICATE_PAN_ACROSS_PARTIES") === "CRITICAL",
  "founder 2 carrying the Company's own PAN is the same person: CRITICAL");
ok(ids("TERM_SHEET", { ...I.complete, party_3_pan: "ABC12" }).includes("INVALID_PARTY_3_PAN"), "a malformed founder PAN is caught");
ok(ids("TERM_SHEET", { ...I.complete, party_3_name: "Kestrel Holdings Private Limited" }).includes("INDIVIDUAL_NAME_READS_AS_ENTITY_PARTY_3"),
  "a founder declared Individual but named as a company is caught");
ok(sev("TERM_SHEET", { ...I.complete, party_4_name: "Ananya Rao" }, "DUPLICATE_PARTY_NAME") === "CRITICAL",
  "two founders with the same name are one person: CRITICAL");
ok(ids("TERM_SHEET", { ...I.complete, party_4_name: "", party_4_address: "", party_4_type: "" })
  .every((r) => !/PARTY_4/.test(r)), "negative control: an unused optional founder slot is not a party");

/* Non-individual principals beyond the first two */
const deed = { partner_1_name: "Asha Rao", partner_1_type: "Individual", partner_2_name: "Ravi Kumar", partner_2_type: "Individual", party_1_pan: "ABCPR1234K" };
ok(ids("PARTNERSHIP_DEED", { ...deed, partner_3_name: "Meera Iyer", partner_3_type: "Private Limited Company" }).includes("ENTITY_TYPE_CONTRADICTS_NAME_PARTNER_3"),
  "a third partner declared a company but named as a person is caught");
ok(ids("PARTNERSHIP_DEED", { ...deed, partner_3_name: "Gamma Ventures Private Limited", partner_3_type: "Private Limited Company", partner_3_pan: "AABCG3456C" })
  .every((r) => !/PARTNER_3/.test(r)), "negative control: a correctly described corporate third partner raises nothing");
ok(ids("PARTNERSHIP_DEED", { ...deed, partner_3_name: "Meera Iyer", partner_3_pan: "ABC" }).includes("INVALID_PARTNER_3_PAN"),
  "a third partner's malformed PAN is caught");

/* Principals whose names and identifiers live in different slots */
ok(ids("SHAREHOLDERS_AGREEMENT", { shareholder_1_name: "Asha Rao", shareholder_1_type: "Private Limited Company",
  shareholder_2_name: "Beta Holdings Private Limited", shareholder_2_type: "Private Limited Company" })
  .includes("ENTITY_TYPE_CONTRADICTS_NAME_PARTY_1"),
  "a shareholder's name is now checked against its type (it used to be checked with no name)");
ok(sev("SHAREHOLDERS_AGREEMENT", { shareholder_1_name: "Beta Holdings Private Limited", shareholder_1_type: "Private Limited Company",
  shareholder_2_name: "Beta Holdings Private Limited", shareholder_2_type: "Private Limited Company" }, "DUPLICATE_PARTY_NAME") === "CRITICAL",
  "two shareholders with the same name are caught");

/* Defined roles in the rendered document */
const r = await generateDocument({ document_type: "TERM_SHEET", variables: I.complete });
const consistency = (clauses) => validateDraftConsistency({ ...r.draft, clauses }, { documentType: "TERM_SHEET", variables: I.complete }).map((i) => i.rule_id);
ok(!consistency(r.draft.clauses).some((x) => /ROLE_LABEL/.test(x)), "negative control: every founder is defined by role in the rebuilt term sheet");
const planted = r.draft.clauses.map((c) => (c.clause_id === "CORE_IDENTITY_001" ? { ...c, text: c.text.replace('the "Founder 2"', 'the "Second Promoter"') } : c));
ok(consistency(planted).includes("INPUT_MISMATCH_PARTY_4_ROLE_LABEL"), "planted: a founder introduced under the wrong role label is caught");
const unsigned = r.draft.clauses.map((c) => (c.clause_id === "CORE_SIGNATURE_BLOCK_001" ? { ...c, text: c.text.replace(/Vikram Shetty/g, "") } : c));
ok(consistency(unsigned).includes("INPUT_MISMATCH_PARTY_4_SIGNATURE_NAME"), "planted: a founder missing from the signature block is caught");

// A name field is not a party. Found by the conservation comparison: the
// deponent's parent was counted as a second deponent.
const affidavit = { deponent_name: "Ramesh Kulkarni", deponent_parent_name: "Ramesh Kulkarni", deponent_address: "1 First Road, Mumbai 400001" };
ok(!ids("AFFIDAVIT", affidavit).includes("DUPLICATE_PARTY_NAME"),
  "negative control: a deponent whose parent shares the name is not two parties");
ok(ids("INDEMNITY_BOND", { obligor_name: "Alpha Industries Private Limited", beneficiary_name: "Alpha Industries Private Limited" }).includes("DUPLICATE_PARTY_NAME"),
  "a role the schema describes as a party (obligor, beneficiary) is checked: two parties with one name are caught");

console.log(`\nnPartyIdentity: ${checks} checks passed`);
process.exit(0);
