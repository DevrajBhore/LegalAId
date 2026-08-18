import assert from "node:assert";
import fs from "node:fs";
import { runConstraints, parseDurationMonths } from "../IRE/src/indian-rule-engine/constraintEngine.js";

const load = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../knowledge-base/constraints/${name}`, import.meta.url), "utf8")).rules;

const rental = load("rental.constraints.json");
const general = load("general_provisions.constraints.json");

const fired = (result, ruleId) => result.violations.some((v) => v.rule_id === ruleId);

// ── 1. Duration parsing ──────────────────────────────────────────────────────
assert.strictEqual(parseDurationMonths("24 months"), 24);
assert.strictEqual(parseDurationMonths("2 years"), 24);
assert.strictEqual(parseDurationMonths("11 months"), 11);
assert.strictEqual(parseDurationMonths("eleven months"), 11);
assert.strictEqual(parseDurationMonths("18"), 18, "a bare number reads as months");
assert.strictEqual(parseDurationMonths(""), null);
assert.strictEqual(parseDurationMonths("as mutually agreed"), null, "unreadable duration must not guess");
console.log("PASS  duration parsing");

// ── 2. The rule that could not express its own condition ─────────────────────
// Before: fails_if could only ask "is a registration clause present?", so an
// 11-month licence was nagged and an 18-month lease passed on any registration
// prose. Both directions are now tested.
const RULE = "RENTAL_REGISTRATION_MANDATORY_OVER_12M";
const rentalClauses = ["RENTAL_PROPERTY_DESCRIPTION_001","RENTAL_RENT_PAYMENT_001",
  "RENTAL_SECURITY_DEPOSIT_001","RENTAL_TERM_001","RENTAL_TERMINATION_001"];

const longLeaseNoReg = runConstraints(rentalClauses, rental, "RENTAL_AGREEMENT",
  { variables: { lease_term: "18 months" } });
assert.ok(fired(longLeaseNoReg, RULE), "18-month lease without a registration clause MUST fail");

const longLeaseWithReg = runConstraints([...rentalClauses, "PROP_REGISTRATION_MANDATORY_001"],
  rental, "RENTAL_AGREEMENT", { variables: { lease_term: "18 months" } });
assert.ok(!fired(longLeaseWithReg, RULE), "18-month lease WITH a registration clause must pass");

const shortLicence = runConstraints(rentalClauses, rental, "RENTAL_AGREEMENT",
  { variables: { lease_term: "11 months" } });
assert.ok(!fired(shortLicence, RULE),
  "11-month licence must NOT be told it needs compulsory registration (the old false positive)");

const shortLicenceOverstated = runConstraints([...rentalClauses, "PROP_REGISTRATION_MANDATORY_001"],
  rental, "RENTAL_AGREEMENT", { variables: { lease_term: "11 months" } });
assert.ok(fired(shortLicenceOverstated, "RENTAL_SHORT_TERM_REGISTRATION_NOT_REQUIRED"),
  "a sub-12-month tenancy carrying the mandatory-registration clause overstates the requirement");

const unknownTerm = runConstraints(rentalClauses, rental, "RENTAL_AGREEMENT",
  { variables: { lease_term: "as mutually agreed" } });
assert.ok(!fired(unknownTerm, RULE),
  "an unreadable term must make the rule not-applicable, not fire it");
console.log("PASS  registration rule fires on term, in both directions");

// ── 3. Legacy fails_if rules still work ──────────────────────────────────────
const missingDescription = runConstraints(["RENTAL_TERM_001"], rental, "RENTAL_AGREEMENT", {});
assert.ok(fired(missingDescription, "RENTAL_REQUIRES_PROPERTY_DESCRIPTION"),
  "legacy fails_if rules must keep working unchanged");
console.log("PASS  legacy fails_if rules unchanged");

// ── 4. General-provisions floor ──────────────────────────────────────────────
const bare = runConstraints(["CORE_IDENTITY_001"], general, "SERVICE_AGREEMENT", {});
assert.ok(bare.violations.length >= 12, `bare service agreement should breach the floor, got ${bare.violations.length}`);

const full = runConstraints(
  ["CORE_DEFINITIONS_001","CORE_INTERPRETATION_001","CORE_NOTICE_001","CORE_SEVERABILITY_001",
   "CORE_WAIVER_001","CORE_ENTIRE_AGREEMENT_001","CORE_AMENDMENT_001","CORE_ASSIGNMENT_001",
   "CORE_COUNTERPARTS_001","CORE_FORCE_MAJEURE_001","CORE_SURVIVAL_001",
   "CORE_STAMP_AND_COSTS_001","CORE_FURTHER_ASSURANCE_001"],
  general, "SERVICE_AGREEMENT", {});
assert.strictEqual(full.violations.length, 0, "a document meeting the floor must not breach it");

const loan = runConstraints(
  ["CORE_DEFINITIONS_001","CORE_INTERPRETATION_001","CORE_NOTICE_001","CORE_SEVERABILITY_001",
   "CORE_WAIVER_001","CORE_ENTIRE_AGREEMENT_001","CORE_AMENDMENT_001","CORE_ASSIGNMENT_001",
   "CORE_COUNTERPARTS_001","CORE_SURVIVAL_001","CORE_STAMP_AND_COSTS_001",
   "CORE_FURTHER_ASSURANCE_001"],
  general, "LOAN_AGREEMENT", {});
assert.strictEqual(loan.violations.length, 0,
  "Loan disallows force majeure by policy; the floor must not demand it");

const tos = runConstraints(["CORE_DEFINITIONS_001"], general, "TERMS_OF_SERVICE", {});
assert.strictEqual(tos.violations.length, 0,
  "unilateral instruments are excluded from the bilateral floor");
console.log("PASS  general-provisions floor, with force-majeure and unilateral exemptions");

// ── 5. Coverage data ─────────────────────────────────────────────────────────
const outcomes = full.evaluated.map((e) => e.outcome);
assert.ok(outcomes.length === general.length, "every rule must report an outcome");
assert.ok(outcomes.every((o) => ["pass","fail","not_applicable","no_assertion"].includes(o)));
console.log(`PASS  per-rule outcomes reported (${outcomes.filter(o=>o==="pass").length} pass, ` +
            `${outcomes.filter(o=>o==="not_applicable").length} n/a)`);

console.log("\nALL GREEN");
