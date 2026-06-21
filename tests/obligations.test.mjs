import assert from "node:assert";
import { buildObligations } from "../backend/services/obligationTracker.js";

// Lease: 24-month term, 6-month lock-in, registration clause present, monthly rent.
const lease = {
  clauses: [
    { clause_id: "PROP_REGISTRATION_MANDATORY_001", text: "Stamp duty and registration apply." },
    { clause_id: "RENTAL_RENT_PAYMENT_001", text: "Rent of INR 50,000 payable monthly in advance." },
    { clause_id: "RENT_LOCKIN_PERIOD_001", text: "Lock-in period applies." },
  ],
};
const o = buildObligations(lease, { effective_date: "2026-07-01", lease_term: "24", lock_in_period: "6", notice_period_days: "30" });
const byType = Object.fromEntries(o.obligations.map((x) => [x.type, x]));

assert.ok(byType.STAMP_DUTY, "stamp duty obligation");
assert.strictEqual(byType.STAMP_DUTY.due_date, "2026-07-01", "stamp at execution");
assert.strictEqual(byType.REGISTRATION_DEADLINE.due_date, "2026-11-01", "register within 4 months");
assert.strictEqual(byType.AGREEMENT_EXPIRY.due_date, "2028-07-01", "24-month term expiry");
assert.strictEqual(byType.LOCK_IN_END.due_date, "2027-01-01", "6-month lock-in end");
assert.strictEqual(byType.TERMINATION_NOTICE_DEADLINE.due_date, "2028-06-01", "30 days before expiry");
assert.strictEqual(byType.PAYMENT_RECURRING.recurrence, "monthly", "recurring rent");
// obligations sorted ascending by date; `next` is the earliest dated one.
assert.strictEqual(o.next.due_date, "2026-07-01", "next obligation is earliest");

// Employment: probation confirmation.
const emp = buildObligations({ clauses: [] }, { start_date: "2026-07-15", probation_period: "6" });
assert.strictEqual(emp.obligations.find((x) => x.type === "PROBATION_CONFIRMATION").due_date, "2027-01-15");

// NDA: confidentiality survives past expiry.
const nda = buildObligations({ clauses: [] }, { effective_date: "2026-01-01", agreement_term: "2", confidentiality_period: "3" });
const surv = nda.obligations.find((x) => x.type === "CONFIDENTIALITY_SURVIVAL_END");
assert.strictEqual(surv.due_date, "2031-01-01", "expiry (2yr) + confidentiality (3yr)");

// Duration parsing.
const yr = buildObligations({ clauses: [] }, { effective_date: "2026-01-01", agreement_term: "2 years" });
assert.strictEqual(yr.obligations.find((x) => x.type === "AGREEMENT_EXPIRY").due_date, "2028-01-01");

console.log("Obligation tracker test passed.");
