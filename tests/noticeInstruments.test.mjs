import assert from "node:assert";
import { executionValidate } from "../IRE/src/indian-rule-engine/executionValidator.js";
import {
  documentShape, isNotice, isSworn, isAgreement, isDemandNotice,
} from "../shared/documentShape.js";
import {
  chequeBounceSchedule, limitationPosition, computeDeadlines,
  deadlineVariables, addMonths, addDays, parseDate, formatLegalDate,
} from "../backend/services/statutoryDeadlines.js";

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL  ${name}`); console.log(`      ${error.message}`); }
}

const ids = (issues) => issues.map((i) => i.rule_id);
const draft = (...texts) => ({
  clauses: texts.map((text, i) => ({ clause_id: `C${i}`, text, category: i === 0 ? "IDENTITY" : "NOTICE_DEMAND" })),
});

// ── shape classification ────────────────────────────────────────────────────
test("shapes are classified, and default to agreement", () => {
  assert.strictEqual(documentShape("CHEQUE_BOUNCE_NOTICE"), "NOTICE");
  assert.strictEqual(documentShape("AFFIDAVIT"), "SWORN");
  assert.strictEqual(documentShape("PRIVACY_POLICY"), "POLICY");
  assert.strictEqual(documentShape("NDA"), "AGREEMENT");
  assert.strictEqual(documentShape("SETTLEMENT_AGREEMENT"), "AGREEMENT");
  assert.strictEqual(documentShape("SOMETHING_NEW"), "AGREEMENT");
  assert.ok(isNotice("LEGAL_NOTICE") && isSworn("INDEMNITY_BOND") && isAgreement("NDA"));
  // A reply answers a demand and makes none of its own.
  assert.ok(isDemandNotice("LEGAL_NOTICE"));
  assert.ok(!isDemandNotice("REPLY_TO_LEGAL_NOTICE"));
});

// ── a notice is not held to the agreement checks ────────────────────────────
test("a notice is not asked for governing law or a dispute clause", () => {
  const notice = draft(
    "To,\nBeta Traders\n12 MG Road, Pune\nDear Sir/Madam,",
    "Under instructions from and on behalf of my client, Alpha Industries Private Limited, I call upon you to pay Rs. 4,50,000 within fifteen days of receipt, failing which legal proceedings will follow. Yours faithfully.",
    "Signed on 21st August, 2026."
  );
  const found = ids(executionValidate(notice, "LEGAL_NOTICE"));
  for (const absent of ["NO_GOVERNING_LAW_REFERENCE", "NO_DISPUTE_MECHANISM", "NO_PARTY_IDENTIFICATION"]) {
    assert.ok(!found.includes(absent), `${absent} should not fire on a notice; got ${found.join(", ")}`);
  }
});

test("the same document as an agreement still fails those checks", () => {
  const found = ids(executionValidate(draft(
    "To,\nBeta Traders\nDear Sir/Madam,",
    "Pay Rs. 4,50,000 within fifteen days, failing which proceedings follow. Yours faithfully.",
    "Signed on 21st August, 2026."
  ), "NDA"));
  assert.ok(found.includes("NO_GOVERNING_LAW_REFERENCE"), `expected the agreement checks to bite: ${found.join(", ")}`);
});

test("a notice must name an addressee and a sender", () => {
  const anonymous = ids(executionValidate(draft(
    "Pay Rs. 4,50,000 within fifteen days, failing which proceedings follow. Signed 21st August, 2026."
  ), "LEGAL_NOTICE"));
  assert.ok(anonymous.includes("NOTICE_HAS_NO_ADDRESSEE"));
  assert.ok(anonymous.includes("NOTICE_HAS_NO_SENDER"));
});

test("a demand notice must state a deadline and a consequence", () => {
  const vague = ids(executionValidate(draft(
    "To,\nBeta Traders\nDear Sir/Madam,",
    "Under instructions from my client, I call upon you to pay Rs. 4,50,000. Yours faithfully. Signed 21st August, 2026."
  ), "LEGAL_NOTICE"));
  assert.ok(vague.includes("NOTICE_STATES_NO_DEADLINE"));
  assert.ok(vague.includes("NOTICE_STATES_NO_CONSEQUENCE"));

  // A reply makes no demand, so neither is required of it.
  const reply = ids(executionValidate(draft(
    "To,\nBeta Traders\nDear Sir/Madam,",
    "Under instructions from my client, I deny each allegation. Yours faithfully. Signed 21st August, 2026."
  ), "REPLY_TO_LEGAL_NOTICE"));
  assert.ok(!reply.includes("NOTICE_STATES_NO_DEADLINE"), reply.join(", "));
});

test("a sworn instrument must name its executant", () => {
  const nameless = ids(executionValidate(draft(
    "The following facts are stated. Signed on 21st August, 2026."
  ), "AFFIDAVIT"));
  assert.ok(nameless.includes("NO_EXECUTANT_IDENTIFICATION"));

  const proper = ids(executionValidate(draft(
    "I, Ramesh Kulkarni, aged about 42 years, do hereby solemnly affirm and state on oath as follows. Signed 21st August, 2026."
  ), "AFFIDAVIT"));
  assert.ok(!proper.includes("NO_EXECUTANT_IDENTIFICATION"), proper.join(", "));
});

// ── the Section 138 chain ───────────────────────────────────────────────────
test("the s.138 chain computes from the dates given", () => {
  const v = deadlineVariables("CHEQUE_BOUNCE_NOTICE", {
    cheque_date: "2026-06-15", return_memo_date: "2026-07-20",
    notice_date: "2026-08-05", notice_service_date: "2026-08-08",
  });
  // 15 days from receipt; the offence completes on the 16th day; one month to complain.
  assert.strictEqual(v.s138_payment_deadline, "23rd August, 2026");
  assert.strictEqual(v.s138_cause_of_action_date, "24th August, 2026");
  assert.strictEqual(v.s138_complaint_deadline, "24th September, 2026");
  // Thirty days from the return memo to send the notice.
  assert.strictEqual(v.s138_notice_deadline, "19th August, 2026");
});

test("a notice outside the thirty-day window is refused outright", () => {
  const { issues } = chequeBounceSchedule({
    returnMemoDate: "2026-07-20", noticeDate: "2026-09-03",
  });
  const issue = issues.find((i) => i.rule_id === "S138_NOTICE_OUT_OF_TIME");
  assert.ok(issue, "expected the window to be enforced");
  assert.strictEqual(issue.severity, "CRITICAL");
  assert.strictEqual(issue.blocks_generation, true);
  assert.match(issue.statutory_reference, /proviso \(b\)/);
});

test("a notice inside the window passes, and one near the edge warns", () => {
  assert.deepStrictEqual(
    chequeBounceSchedule({ returnMemoDate: "2026-07-20", noticeDate: "2026-08-05" }).issues, []
  );
  assert.ok(
    chequeBounceSchedule({ returnMemoDate: "2026-07-20", noticeDate: "2026-08-18" })
      .issues.some((i) => i.rule_id === "S138_NOTICE_NEAR_DEADLINE")
  );
});

test("impossible date orderings are caught", () => {
  const back = ids(chequeBounceSchedule({ returnMemoDate: "2026-07-20", noticeDate: "2026-07-01" }).issues);
  assert.ok(back.includes("S138_NOTICE_PREDATES_DISHONOUR"));
  const stale = ids(chequeBounceSchedule({ chequeDate: "2026-01-05", returnMemoDate: "2026-07-20", noticeDate: "2026-08-05" }).issues);
  assert.ok(stale.includes("S138_CHEQUE_PRESENTED_LATE"));
});

// ── month arithmetic, which is where date code usually breaks ───────────────
test("a statutory month is a calendar month, and clamps", () => {
  const on = (iso, n) => formatLegalDate(addMonths(parseDate(iso), n));
  assert.strictEqual(on("2026-01-31", 1), "28th February, 2026");
  assert.strictEqual(on("2024-02-29", 12), "28th February, 2025");
  assert.strictEqual(on("2025-12-31", 3), "31st March, 2026");
  assert.strictEqual(formatLegalDate(addDays(parseDate("2026-08-08"), 15)), "23rd August, 2026");
  // Ordinal suffixes, which read wrong in the teens if done naively.
  for (const [iso, want] of [["2026-08-01","1st"],["2026-08-02","2nd"],["2026-08-03","3rd"],
                             ["2026-08-11","11th"],["2026-08-12","12th"],["2026-08-13","13th"],
                             ["2026-08-21","21st"],["2026-08-22","22nd"]]) {
    assert.ok(formatLegalDate(parseDate(iso)).startsWith(want), `${iso} -> ${formatLegalDate(parseDate(iso))}`);
  }
});

test("limitation is reported, and an acknowledgement only helps in time", () => {
  const barred = limitationPosition({ causeOfActionDate: "2021-01-10", asOf: "2026-08-05" });
  assert.ok(ids(barred.issues).includes("CLAIM_APPEARS_TIME_BARRED"));

  // An acknowledgement made before expiry starts a fresh three years.
  const revived = limitationPosition({
    causeOfActionDate: "2024-01-10", acknowledgementDate: "2025-06-01", asOf: "2026-08-05",
  });
  assert.deepStrictEqual(ids(revived.issues), []);
  assert.strictEqual(revived.schedule.limitationAcknowledgementIsEffective, true);

  // One made after expiry does not.
  const tooLate = limitationPosition({
    causeOfActionDate: "2020-01-10", acknowledgementDate: "2025-06-01", asOf: "2026-08-05",
  });
  assert.ok(ids(tooLate.issues).includes("CLAIM_APPEARS_TIME_BARRED"));
  assert.strictEqual(tooLate.schedule.limitationAcknowledgementIsEffective, false);
});

test("the two-month government bar is raised where it applies", () => {
  const gov = computeDeadlines("LEGAL_NOTICE", {
    notice_date: "2026-08-05", addressee_name: "State of Maharashtra",
  });
  const issue = gov.issues.find((i) => i.rule_id === "CPC_S80_TWO_MONTH_BAR");
  assert.ok(issue, "expected the S.80 bar");
  assert.match(issue.message, /5th October, 2026/);

  const priv = computeDeadlines("LEGAL_NOTICE", {
    notice_date: "2026-08-05", addressee_name: "Beta Traders Private Limited",
  });
  assert.ok(!ids(priv.issues).includes("CPC_S80_TWO_MONTH_BAR"));
});

test("a notice never prints a date derived from an assumed service date", () => {
  // The period runs from receipt; the notice is written before it is served.
  // Printing a computed date would understate the period the addressee has.
  const v = deadlineVariables("CHEQUE_BOUNCE_NOTICE", {
    return_memo_date: "2026-07-20", notice_date: "2026-08-05",
  });
  assert.strictEqual(v.s138_payment_deadline, undefined);
  assert.strictEqual(v.s138_notice_deadline, "19th August, 2026");
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
