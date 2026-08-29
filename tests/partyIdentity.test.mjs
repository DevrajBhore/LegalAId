import assert from "node:assert";
import {
  validatePartyIdentity,
  isValidPan,
  isValidGstin,
  isValidCin,
  gstinChecksum,
  panHolderCode,
} from "../backend/services/partyIdentityValidator.js";

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error.message}`);
  }
}

const run = (variables, documentType = "NDA") =>
  validatePartyIdentity({ documentType, variables });
const ids = (issues) => issues.map((issue) => issue.rule_id);

// A clean pair, used as the baseline for every "must not fire" assertion below.
const CLEAN = {
  party_1_name: "Acme Industries Private Limited",
  party_1_type: "Private Limited Company",
  party_1_pan: "AAACA1234C",
  party_1_cin: "U72900MH2019PTC123456",
  party_2_name: "Rajesh Kumar Sharma",
  party_2_type: "Individual",
  party_2_pan: "ABCPK1234E",
};

test("a clean pair produces nothing", () => {
  assert.deepStrictEqual(run(CLEAN), []);
});

test("PAN format", () => {
  assert.ok(isValidPan("AAACA1234C"));
  assert.ok(isValidPan("aaaca1234c"), "case is not the drafter's problem");
  assert.ok(!isValidPan("AAACA1234"));
  assert.ok(!isValidPan("AAAC1A234C"));
  assert.ok(!isValidPan(""));
  assert.strictEqual(panHolderCode("AAACA1234C"), "C");
  assert.strictEqual(panHolderCode("ABCPK1234E"), "P");
  assert.strictEqual(panHolderCode("nonsense"), null);
});

test("GSTIN check digit is computed, not assumed", () => {
  assert.strictEqual(gstinChecksum("27AAPFU0939F1ZV"), "V");
  assert.ok(isValidGstin("27AAPFU0939F1ZV"));
  // Same string with the check digit altered: right shape, wrong number.
  assert.ok(!isValidGstin("27AAPFU0939F1ZX"));
  // State code 45 is not allotted.
  assert.ok(!isValidGstin("45AAPFU0939F1ZV"));
  // The fourteenth character is fixed as Z.
  assert.ok(!isValidGstin("27AAPFU0939F1YV"));
});

test("a GSTIN that fails only its check digit says so", () => {
  const issue = run({ ...CLEAN, party_1_gstin: "27AAACA1234C1ZX" }).find(
    (entry) => entry.rule_id === "INVALID_PARTY_1_GSTIN"
  );
  assert.ok(issue, "expected the GSTIN to be rejected");
  assert.match(issue.message, /fails its check digit/);
});

test("CIN format", () => {
  assert.ok(isValidCin("U72900MH2019PTC123456"));
  assert.ok(isValidCin("L17110MH1973PLC019786"));
  assert.ok(!isValidCin("X72900MH2019PTC123456"));
  assert.ok(!isValidCin("U72900MH2019PTC12345"));
});

test("a GSTIN must embed its own PAN", () => {
  const issues = run({
    ...CLEAN,
    party_1_pan: "AAACA1234C",
    party_1_gstin: "27AAPFU0939F1ZV",
  });
  assert.ok(ids(issues).includes("MISMATCHED_PARTY_1_PAN_IN_GSTIN"));
});

test("two parties cannot share a PAN", () => {
  const issue = run({
    ...CLEAN,
    party_2_pan: "AAACA1234C",
    party_2_type: "Private Limited Company",
    party_2_name: "Beta Ventures Private Limited",
    party_2_cin: "U72900MH2020PTC654321",
  }).find((entry) => entry.rule_id === "DUPLICATE_PAN_ACROSS_PARTIES");
  assert.ok(issue, "expected the duplicate PAN to be caught");
  assert.strictEqual(issue.severity, "CRITICAL");
  assert.strictEqual(issue.blocks_generation, true);
  assert.match(issue.suggestion, /S\.10/);
});

test("a guarantor sharing a PAN is told why it matters", () => {
  const issue = validatePartyIdentity({
    documentType: "GUARANTEE_AGREEMENT",
    variables: {
      party_1_name: "Acme Industries Private Limited",
      party_1_type: "Private Limited Company",
      party_1_pan: "AAACA1234C",
      guarantor_name: "Acme Industries Private Limited",
      guarantor_type: "Private Limited Company",
      guarantor_pan: "AAACA1234C",
    },
  }).find((entry) => entry.rule_id === "DUPLICATE_PAN_ACROSS_PARTIES");
  assert.ok(issue, "expected the guarantor duplicate to be caught");
  assert.match(issue.suggestion, /S\.126/);
});

test("two parties cannot share a name", () => {
  const issue = run({
    ...CLEAN,
    party_2_name: "Acme Industries Private Limited",
    party_2_type: "Private Limited Company",
    party_2_pan: "AAACB5678C",
    party_2_cin: "U72900MH2020PTC654321",
  }).find((entry) => entry.rule_id === "DUPLICATE_PARTY_NAME");
  assert.ok(issue, "expected the duplicate name to be caught");
  assert.strictEqual(issue.severity, "CRITICAL");
});

test("a company named as a person is caught", () => {
  const issues = run({ ...CLEAN, party_1_name: "Rajesh Kumar Sharma" });
  assert.ok(ids(issues).includes("ENTITY_TYPE_CONTRADICTS_NAME_PARTY_1"));
});

test("a person named as a company is caught", () => {
  const issues = run({ ...CLEAN, party_2_name: "Sunrise Solutions Private Limited" });
  assert.ok(ids(issues).includes("INDIVIDUAL_NAME_READS_AS_ENTITY_PARTY_2"));
});

test("the PAN holder code contradicts a wrong entity type", () => {
  // A P-series PAN belongs to a natural person; the party says it is a company.
  const issues = run({ ...CLEAN, party_1_pan: "ABCPK1234E" });
  const issue = issues.find((entry) => entry.rule_id === "ENTITY_TYPE_CONTRADICTS_PAN_PARTY_1");
  assert.ok(issue, "expected the holder code to contradict the type");
  assert.match(issue.message, /an individual/);
});

test("an individual cannot hold a CIN", () => {
  const issues = run({ ...CLEAN, party_2_cin: "U72900MH2019PTC123456" });
  assert.ok(ids(issues).includes("CIN_ON_UNINCORPORATED_PARTY_2"));
});

test("a sole proprietorship is not held to the corporate name test", () => {
  const issues = run({
    ...CLEAN,
    party_1_type: "Sole Proprietorship",
    party_1_name: "Sharma Traders",
    party_1_pan: "ABCPK1234E",
    party_1_cin: "",
  });
  assert.deepStrictEqual(
    issues.filter((entry) => entry.rule_id.startsWith("ENTITY_TYPE_CONTRADICTS")),
    []
  );
});

test("fields the document never asks for are not invented", () => {
  assert.deepStrictEqual(validatePartyIdentity({ documentType: "NDA", variables: {} }), []);
  assert.deepStrictEqual(validatePartyIdentity({}), []);
  assert.deepStrictEqual(validatePartyIdentity({ documentType: "", variables: CLEAN }), []);
});

test("a partly filled form is not punished for what is missing", () => {
  // Only names given: nothing to validate, nothing to complain about beyond the
  // status marker, which is a notice rather than a blocker.
  const issues = run({
    party_1_name: "Acme Industries Private Limited",
    party_1_type: "Private Limited Company",
    party_2_name: "Rajesh Kumar Sharma",
    party_2_type: "Individual",
  });
  assert.ok(
    issues.every((entry) => entry.severity !== "CRITICAL"),
    `nothing here should block: ${ids(issues).join(", ")}`
  );
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
