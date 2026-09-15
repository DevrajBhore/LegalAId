/**
 * timingAssessment.test.mjs
 *
 * A DOCUMENT STATING THAT A STATUTORY PERIOD WAS COMPLIED WITH CANNOT ITSELF
 * ESTABLISH THAT IT WAS.
 *
 * The same distinction the tenancy established for a formal act — a clause
 * saying "the parties shall register this Agreement" does not make the
 * instrument registered — now applied to temporal world state. A notice under
 * section 138 of the Negotiable Instruments Act, 1881 has almost none of its
 * legal effect in its words: three months to present the cheque, thirty days
 * from receipt of the bank's memo to demand, fifteen for the drawer to pay, a
 * month to complain. A flawlessly drafted notice served on the thirty-first day
 * is worth nothing.
 *
 * WHY THIS FAMILY. The portfolio inventory reported CHEQUE_BOUNCE_NOTICE at
 * rung NOT REGISTERED with all its requirements reading "family does not
 * generate", and it was the ONLY family exercising the timing dimension.
 *
 * The reason turned out not to be a gap in the discovery path. The family is
 * WITHHELD ON PURPOSE -- `_unreachable: true` on its blueprint, a `_held_note`
 * saying so, and a comment in the registry explaining that the entries were
 * removed as a product decision rather than a quality one. Bringing it into the
 * product to make a coverage number change would have been shipping somebody
 * else's decision to satisfy a metric.
 *
 * So the timing work below stands on its own, against the assessor rather than
 * against a generated document, exactly as the other requirement tests do. What
 * the inventory measured remains true and remains open: the timing dimension is
 * exercised only by a family the product does not offer.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRequirements, loadDocumentRequirements, COVERAGE, FINDING }
  from "../backend/services/documentRequirements.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

let checks = 0;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const TYPE = "CHEQUE_BOUNCE_NOTICE";

// ── 1. The family is withheld, and that stays a decision nobody drifts into ─
//
// If it is ever offered, that must be because someone chose to offer it. This
// asserts the hold is INTACT AND EXPLAINED, not that it is permanent: delete
// the flag deliberately and this test tells you to update it.
const blueprint = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/clause_library/blueprints/cheque_bounce_notice.blueprint.json"),
  "utf8"
));
assert.strictEqual(blueprint._unreachable, true,
  `${TYPE} is no longer withheld. If that was deliberate, say so here and check that the ` +
  `intake collects memo_receipt_date and cheque_presentation_date — the assessment below is ` +
  `honest about not having them, and a shipped family should not need to be.`);
assert.ok(String(blueprint._held_note || "").length > 40, "a hold must say why it is held");
assert.ok(!DOCUMENT_TYPE_REGISTRY[TYPE], `${TYPE} is withheld and yet offered`);
checks += 3;

const CLAUSES = [
  "NOTICE_ADDRESSEE_001", "S138_SUBJECT_001", "NOTICE_INSTRUCTIONS_001",
  "S138_CHEQUE_PARTICULARS_001", "S138_DISHONOUR_001", "S138_STATUTORY_DEMAND_001",
  "S138_PAYMENT_PERIOD_001", "S138_CONSEQUENCE_001", "NOTICE_RESERVATION_001",
  "CORE_SIGNATURE_BLOCK_001",
];
loadDocumentRequirements({ refresh: true });
const at = (variables) => assessRequirements(TYPE, CLAUSES, {}, variables);
const demand = (a) => a.results.find((r) => r.id === "NOTICE_GIVEN_IN_TIME");
const presented = (a) => a.results.find((r) => r.id === "CHEQUE_PRESENTED_IN_TIME");

// ── 2. THE MATRIX ───────────────────────────────────────────────────────────
//
// Every row is the SAME well-drafted notice. Only what the system knows about
// the world changes.
const MATRIX = [
  ["required date unknown",
   {}, COVERAGE.UNVERIFIABLE],
  ["trigger established, deadline not yet passed",
   { memo_receipt_date: "2026-08-01", notice_date: "2026-08-20" }, COVERAGE.RESOLVED],
  ["trigger established, deadline already passed",
   { memo_receipt_date: "2026-07-01", notice_date: "2026-08-20" }, COVERAGE.OUT_OF_TIME],
  ["trigger established, deadline passed by one day",
   { memo_receipt_date: "2026-07-21", notice_date: "2026-08-21" }, COVERAGE.OUT_OF_TIME],
  ["trigger established, on the last day of the window",
   { memo_receipt_date: "2026-07-21", notice_date: "2026-08-20" }, COVERAGE.RESOLVED],
  ["proxy supplied, legal trigger not established",
   { return_memo_date: "2026-08-01", notice_date: "2026-08-20" }, COVERAGE.UNVERIFIABLE],
  ["contradictory dates: the notice predates the event it answers",
   { memo_receipt_date: "2026-08-20", notice_date: "2026-08-01" }, COVERAGE.CONTRADICTED],
];
for (const [label, variables, expected] of MATRIX) {
  const result = demand(at(variables));
  assert.strictEqual(result.coverage, expected,
    `${label}: expected ${expected}, got ${result.coverage}${result.detail ? ` — ${result.detail}` : ""}`);
  checks += 1;
}
console.log(`PASS  timing matrix: ${MATRIX.length} states of world knowledge, ${
  new Set(MATRIX.map((m) => m[2])).size} distinct findings`);

// ── 3. A PROXY CAN NEVER PRODUCE A POSITIVE FINDING ─────────────────────────
//
// Proviso (b) runs thirty days from the drawer's RECEIPT of the bank's memo.
// The intake collected the memo's DATE, which is a different event and usually
// an earlier one, and the assessment computed from it and reported RESOLVED.
// That told a payee their notice was in time on the strength of an assumption
// nobody stated — and where the notice went out on day twenty-nine, a two-day
// postal delay is the whole case.
//
// Tested at ONE day elapsed, where the proxy answer is not merely inside the
// window but comfortably so: a mechanism that let "obviously fine" through
// would be exactly the mechanism that lets day twenty-nine through.
const comfortable = demand(at({ return_memo_date: "2026-08-01", notice_date: "2026-08-02" }));
assert.strictEqual(comfortable.coverage, COVERAGE.UNVERIFIABLE,
  "a proxy produced a positive finding because the answer looked safe");
assert.strictEqual(comfortable.finding, FINDING.NOT_ESTABLISHED);
assert.strictEqual(comfortable.computed_from_proxy, "return_memo_date");
// The assumption is NAMED, and so is the answer it would have given. An
// UNVERIFIABLE that says nothing is a worse report than a wrong one, because
// the reader cannot act on it.
assert.match(comfortable.assumption, /received the memo on the day the bank wrote it/);
assert.match(comfortable.detail, /would be in time/);
assert.match(comfortable.detail, /statute runs from memo_receipt_date/);
checks += 6;

// And supplying the real trigger must change the answer — otherwise the proxy
// distinction costs the user something and buys nothing.
assert.strictEqual(
  demand(at({ memo_receipt_date: "2026-08-01", notice_date: "2026-08-02" })).coverage,
  COVERAGE.RESOLVED,
  "establishing the legal trigger must be able to produce a positive finding"
);
checks += 1;
console.log("PASS  a proxy for the legal trigger reports UNVERIFIABLE and names its assumption");

// ── 4. THE REGRESSION: the notice's own words establish nothing ─────────────
//
// Every clause is present. The notice states the fifteen-day period, states the
// consequence of default, and reads as a complete instrument. The system knows
// no dates at all. Before TIMING existed this reported 7 of 7 RESOLVED.
const wordsOnly = at({});
const timingResults = wordsOnly.results.filter((r) => r.kind === "TIMING");
assert.ok(timingResults.length >= 3, "the family must exercise more than one timing window");
for (const result of timingResults) {
  assert.notStrictEqual(result.coverage, COVERAGE.RESOLVED,
    `${result.id}: the notice says the period was complied with, and saying so is not complying`);
  assert.strictEqual(result.finding, FINDING.NOT_ESTABLISHED);
  checks += 2;
}
// And the summary must not let them look like success.
assert.strictEqual(wordsOnly.summary.resolved, wordsOnly.results.length - timingResults.length,
  "a timing requirement was counted as resolved for a notice with no dates");
assert.ok(wordsOnly.summary.unverifiable >= 3);
checks += 2;
console.log(
  `PASS  ${timingResults.length} statutory windows, none established by the notice's own words`
);

// ── 5. Calendar months are not thirty-day approximations ────────────────────
//
// "Three months" and "ninety days" are different periods, and a cheque
// presented on the ninety-second day may be perfectly in time. Encoding the
// statute as 90 days would have shipped a rule that is wrong for most of the
// year — quietly, and against the payee.
const dayNinetyTwo = presented(at({ cheque_date: "2026-01-31", cheque_presentation_date: "2026-05-01" }));
assert.strictEqual(dayNinetyTwo.coverage, COVERAGE.OUT_OF_TIME,
  "31 January plus three months is 30 April; 1 May is out of time");
const lastDay = presented(at({ cheque_date: "2026-01-31", cheque_presentation_date: "2026-04-30" }));
assert.strictEqual(lastDay.coverage, COVERAGE.RESOLVED,
  "31 January plus three calendar months clamps to 30 April, which is the last day in time");
assert.match(lastDay.window, /calendar month/);
// A ninety-day reading would have called 30 April late (it is day 89 -- in
// time either way) and 1 May late as well; the discriminating case is a cheque
// dated in a long-month run.
const dayNinetyOne = presented(at({ cheque_date: "2026-03-31", cheque_presentation_date: "2026-06-30" }));
assert.strictEqual(dayNinetyOne.coverage, COVERAGE.RESOLVED,
  "31 March plus three calendar months is 30 June — day 91, and in time");
checks += 4;
console.log("PASS  windows expressed in months are computed in calendar months");

// ── 6. The family's own falsification is recorded ───────────────────────────
const list = loadDocumentRequirements().get(TYPE);
const attacked = list.filter((r) => r.falsification?.attack && r.falsification?.false_green);
assert.ok(attacked.length, `${TYPE} names no attack`);
checks += 1;

console.log(`\nALL GREEN (${checks} checks)`);
