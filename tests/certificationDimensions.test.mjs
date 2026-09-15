/**
 * certificationDimensions.test.mjs — THREE AXES THAT MUST NOT MERGE
 *
 * The D4.3 trace established that a family can survive every falsification
 * attack written for it while no fact reaching its clauses is tied to a statute:
 * 3 of 17 facts reach the document, 10 carry statutory authority, none does
 * both. Those are independent properties, and a single ladder cannot express
 * them without one silently standing in for the other.
 *
 * The concrete danger this test exists to prevent is RETROACTIVE REDEFINITION.
 * Ten families earned FALSIFICATION_PASSED under a claim that was true when
 * made: "this family survived the falsification corpus applicable to the current
 * implementation". Folding legal-knowledge validation into that rung would
 * convert it into a claim nobody has evidence for — "the legal reasoning
 * underneath this family is validated" — without anyone editing a single
 * falsification record.
 *
 * So: the generation axis must keep its ten, the legal axis must start honest,
 * and nothing may be fully certified while the concept resolver reaches one
 * concept. A test that only asserted the counts would pass if the axes were
 * wired to the same source, so the last block moves each axis independently and
 * checks the others do not follow.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  certify, LEGAL_KNOWLEDGE_STATUS, GENERATION_STATUS, HUMAN_STATUS,
} from "../backend/services/familyCertification.js";
import { getAllClauses } from "../backend/services/clauseAssembler.js";

let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

/*
 * The real portfolio. Evidence is gathered the same way the report gathers it —
 * from the clause baseline and the library — so this test cannot pass against a
 * convenient fixture while the product tells a different story. Legal-knowledge
 * and specificity evidence are deliberately NOT supplied: that absence is the
 * true state of the system, not a pessimistic choice.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
  fs.readFileSync(path.join(HERE, "baseline/clause-baseline.json"), "utf8"));
const generates = new Set(Object.entries(baseline.types || {})
  .filter(([, r]) => (r?.full?.clauses || []).length).map(([t]) => t));
const emits = new Map(Object.entries(baseline.types || {})
  .map(([t, r]) => [t, r?.full?.clauses || []]));
const reviewedClauses = new Set(getAllClauses()
  .filter((c) => c.review_status && !/draft|needs/i.test(c.review_status))
  .map((c) => c.clause_id));
const EVIDENCE = { generates, emits, reviewedClauses };

const live = certify({ ...EVIDENCE });

check("the ten falsification results survive the split", () => {
  const passed = Object.values(live.families)
    .filter((f) => f.generation_status === "FALSIFICATION_PASSED");
  assert.strictEqual(passed.length, 10,
    `expected the 10 earned falsification results to be preserved, got ${passed.length}`);
});

check("every family is NOT_ASSESSED on legal knowledge", () => {
  const assessed = Object.entries(live.families)
    .filter(([, f]) => f.legal_knowledge_status !== "NOT_ASSESSED");
  assert.deepStrictEqual(assessed.map(([t]) => t), [],
    "a family claims validated legal knowledge; no concept resolver exists to support that");
});

check("nothing is fully certified", () => {
  assert.strictEqual(live.fully_certified, 0,
    "fully_certified must require all three axes plus specificity, and none holds today");
});

check("advocate review lives on the human axis, not the generation ladder", () => {
  for (const [type, f] of Object.entries(live.families)) {
    assert.ok(GENERATION_STATUS.includes(f.generation_status),
      `${type}: generation_status '${f.generation_status}' is not on the generation ladder`);
    assert.ok(HUMAN_STATUS.includes(f.human_status), `${type}: human_status off-axis`);
    assert.ok(LEGAL_KNOWLEDGE_STATUS.includes(f.legal_knowledge_status),
      `${type}: legal_knowledge_status off-axis`);
  }
});

/*
 * INDEPENDENCE. Raising one axis to its top must not raise another. Without
 * this, three fields reading one source would satisfy every assertion above.
 */
const subject = Object.entries(live.families)
  .find(([, f]) => f.generation_status === "FALSIFICATION_PASSED")?.[0];
assert.ok(subject, "no falsification-passed family to test independence against");

check("legal-knowledge evidence does not move the generation or human axis", () => {
  const raised = certify({ ...EVIDENCE,
    legalKnowledge: new Map([[subject, "CONSEQUENCE_VALIDATED"]]),
  }).families[subject];
  assert.strictEqual(raised.legal_knowledge_status, "CONSEQUENCE_VALIDATED");
  assert.strictEqual(raised.generation_status, live.families[subject].generation_status,
    "raising legal knowledge moved the generation axis");
  assert.strictEqual(raised.human_status, live.families[subject].human_status,
    "raising legal knowledge moved the human axis");
});

check("specificity evidence alone certifies nothing", () => {
  const raised = certify({ ...EVIDENCE, specificity: new Set([subject]) }).families[subject];
  assert.strictEqual(raised.specificity_tested, true);
  assert.strictEqual(raised.fully_certified, false,
    "specificity is necessary for full certification, never sufficient");
});

check("full certification needs all three axes and specificity together", () => {
  const none = certify({ ...EVIDENCE,
    legalKnowledge: new Map([[subject, "CONSEQUENCE_VALIDATED"]]),
    specificity: new Set([subject]),
  }).families[subject];
  assert.strictEqual(none.fully_certified, false,
    "certified without any advocate approval on the human axis");
});

console.log(`\nALL GREEN (${checks} checks)`);
