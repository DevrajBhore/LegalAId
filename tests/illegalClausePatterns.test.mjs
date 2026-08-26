/**
 * The illegal-clause rules must catch what they are for, and must not refuse a
 * document for using the vocabulary of the law it is complying with.
 *
 * Both halves are load-bearing. These rules carry blocks_generation, so a false
 * positive does not merely warn -- it refuses to produce the document. That is
 * how a PoSH policy became ungeneratable: "not.*employ.*women" matched "Not
 * fewer than two members are drawn from among the employees, preferably
 * committed to the cause of women".
 */

import assert from "node:assert/strict";
import { illegalClauseValidate } from "../IRE/src/indian-rule-engine/illegalClauseValidator.js";

const scan = (text) =>
  illegalClauseValidate({ clauses: [{ clause_id: "TEST_001", category: "TEST", text }] })
    .map((i) => i.rule_id);

/* ── Must still be caught ────────────────────────────────────────────────── */

const MUST_CATCH = [
  ["DISCRIMINATION_PROHIBITED", "The Company shall not employ women in the night shift under any circumstances."],
  ["DISCRIMINATION_PROHIBITED", "No female candidate shall be hired for this role."],
  ["DISCRIMINATION_PROHIBITED", "Only men shall be hired for field operations."],
  ["CHILD_LABOUR_PROHIBITION", "The Contractor may employ any child under 14 years for light work."],
  ["ICA_S28_OUSTER_OF_COURTS", "The parties waive all rights to approach any court of law in respect of this Agreement."],
];

for (const [rule, text] of MUST_CATCH) {
  const hits = scan(text);
  assert.ok(hits.includes(rule), `expected ${rule} for: ${text}\n  got: ${hits.join(", ") || "(nothing)"}`);
}
console.log(`PASS  ${MUST_CATCH.length} genuinely unlawful clauses are still caught`);

/* ── Must NOT be caught ──────────────────────────────────────────────────── */

const MUST_NOT_FIRE = [
  ["PoSH committee composition",
   "Not fewer than two members are drawn from among the employees, preferably committed to the " +
   "cause of women, or having experience in social work, or having legal knowledge."],
  ["non-discrimination covenant",
   "The Employer shall not discriminate against any employee on the basis of caste, religion, sex, " +
   "gender, place of birth, or any of them."],
  ["PoSH scope clause",
   "No woman shall be subjected to sexual harassment at any workplace of the Organisation. This " +
   "Policy is adopted under the Sexual Harassment of Women at Workplace (Prevention, Prohibition " +
   "and Redressal) Act, 2013."],
  ["maternity benefit",
   "The Employee shall be entitled to maternity benefit in accordance with Chapter VI of the Code " +
   "on Social Security, 2020, including protection against dismissal during the maternity period."],
  ["ordinary employment clause naming children",
   "The Employer shall extend medical insurance cover to the Employee, the Employee's spouse, and " +
   "the Employee's children, on the terms of the policy in force from time to time."],
  ["arbitration, not an ouster of courts",
   "Any dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. " +
   "Nothing in this clause prevents either Party from seeking interim relief from a court under " +
   "Section 9 of that Act."],
];

for (const [label, text] of MUST_NOT_FIRE) {
  const hits = scan(text);
  assert.deepStrictEqual(hits, [], `${label} should not be flagged, got: ${hits.join(", ")}`);
}
console.log(`PASS  ${MUST_NOT_FIRE.length} lawful clauses are left alone`);

/* ── The compiled window must not span a sentence ────────────────────────── */

{
  const { compilePattern } = await import("../IRE/src/indian-rule-engine/illegalClauseValidator.js");
  const rx = compilePattern("penalty.*entire.*contract.*value");
  assert.ok(
    rx.test("a penalty equal to the entire value of the contract value shall apply"),
    "a bounded pattern must still match words that are genuinely near each other"
  );
  assert.ok(
    !rx.test(
      "A penalty is payable on late delivery. " +
      "X".repeat(400) +
      " The entire agreement supersedes prior terms. The contract value is stated in Schedule 1."
    ),
    "a bounded pattern must not span sentences and hundreds of characters"
  );
  console.log("PASS  `.*` compiles to a bounded, sentence-respecting window");
}

console.log("\nALL GREEN");
