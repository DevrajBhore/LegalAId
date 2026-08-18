/**
 * Golden corpus harness.
 *
 * Runs every fixture through the real generation + validation pipeline and
 * scores two failure modes SEPARATELY:
 *
 *   FALSE NEGATIVE  a defect the fixture says must be caught, and was not
 *   FALSE POSITIVE  a correct document blocked, or a rule fired that should not
 *
 * False positives matter as much as false negatives: a validator that blocks
 * correct documents trains users to ignore it. Exit code is non-zero on either.
 */
import fs from "node:fs";
import { generateDocument } from "../backend/services/documentService.js";

const corpus = JSON.parse(
  fs.readFileSync(new URL("./golden/corpus.json", import.meta.url), "utf8")
);

const falseNegatives = [];
const falsePositives = [];
const fixtureErrors = [];
const rows = [];

for (const fixture of corpus.fixtures) {
  const variables = { ...corpus.shared_variables, ...fixture.variables };
  const result = await generateDocument({
    document_type: fixture.document_type,
    variables,
  });

  const validation = result.validation || {};
  const allIssueIds = [
    ...(validation.blockingIssues || []),
    ...(validation.advisoryIssues || []),
  ].map((issue) => issue.rule_id);
  const noticeIds = (validation.notices || []).map((issue) => issue.rule_id);
  const clauseIds = (result.draft?.clauses || []).map((c) => c.clause_id);
  const fullText = (result.draft?.clauses || []).map((c) => c.text || "").join("\n");
  const expect = fixture.expect || {};

  // A fixture whose intake is incomplete is a CORPUS bug, not an engine result.
  // Reported separately so it can never be mistaken for a validator finding.
  const inputErrors = allIssueIds.filter((id) => id.startsWith("INVALID_INPUT_"));
  if (inputErrors.length) {
    fixtureErrors.push({
      fixture: fixture.id,
      detail: (validation.blockingIssues || []).map((i) => i.message).join("; "),
    });
    rows.push([fixture.id, "FIXTURE ERROR", "-", "-"]);
    continue;
  }

  let fn = 0;
  let fp = 0;

  if (expect.must_generate === true && !result.draft) {
    fp += 1;
    falsePositives.push({
      fixture: fixture.id,
      reason: `expected to generate but was blocked: ${
        (validation.blockingIssues || []).map((i) => i.rule_id).join(", ") || result.error
      }`,
    });
  }

  for (const ruleId of expect.must_flag || []) {
    if (!allIssueIds.includes(ruleId)) {
      fn += 1;
      falseNegatives.push({ fixture: fixture.id, reason: `expected ${ruleId} to fire, it did not` });
    }
  }

  for (const ruleId of expect.must_not_flag || []) {
    if (allIssueIds.includes(ruleId)) {
      fp += 1;
      falsePositives.push({ fixture: fixture.id, reason: `${ruleId} fired on a correct document` });
    }
  }

  // Notices are advisory findings (stamp duty, registration, authority to
  // execute). They must not block, but they must still appear when they apply.
  for (const ruleId of expect.must_notice || []) {
    if (!noticeIds.includes(ruleId)) {
      fn += 1;
      falseNegatives.push({ fixture: fixture.id, reason: `expected notice ${ruleId}, it was not raised` });
    }
  }
  for (const ruleId of expect.must_not_notice || []) {
    if (noticeIds.includes(ruleId)) {
      fp += 1;
      falsePositives.push({ fixture: fixture.id, reason: `notice ${ruleId} raised when it should not apply` });
    }
  }
  for (const snippet of expect.must_contain_text || []) {
    if (!fullText.includes(snippet)) {
      fn += 1;
      falseNegatives.push({ fixture: fixture.id, reason: `draft does not contain: "${snippet}"` });
    }
  }

  for (const clauseId of expect.must_contain_clauses || []) {
    if (!clauseIds.includes(clauseId)) {
      fn += 1;
      falseNegatives.push({ fixture: fixture.id, reason: `clause ${clauseId} missing from the draft` });
    }
  }

  rows.push([
    fixture.id,
    result.draft ? `${clauseIds.length} clauses` : "BLOCKED",
    fn === 0 ? "-" : String(fn),
    fp === 0 ? "-" : String(fp),
  ]);
}

console.log("\nFIXTURE".padEnd(32) + "RESULT".padEnd(16) + "FN".padEnd(6) + "FP");
console.log("-".repeat(60));
for (const [id, res, fn, fp] of rows) {
  console.log(id.padEnd(32) + res.padEnd(16) + fn.padEnd(6) + fp);
}
console.log("-".repeat(60));
console.log(
  `${corpus.fixtures.length} fixtures | ${falseNegatives.length} false negative(s) | ` +
  `${falsePositives.length} false positive(s) | ${fixtureErrors.length} fixture error(s)`
);

if (fixtureErrors.length) {
  console.log("\nFIXTURE ERRORS (bad corpus data, not an engine finding):");
  fixtureErrors.forEach((e) => console.log(`  ${e.fixture}: ${e.detail}`));
}
if (falseNegatives.length) {
  console.log("\nFALSE NEGATIVES (defect not caught):");
  falseNegatives.forEach((e) => console.log(`  ${e.fixture}: ${e.reason}`));
}
if (falsePositives.length) {
  console.log("\nFALSE POSITIVES (correct document penalised):");
  falsePositives.forEach((e) => console.log(`  ${e.fixture}: ${e.reason}`));
}

const failed = falseNegatives.length + falsePositives.length + fixtureErrors.length;
console.log(failed === 0 ? "\nALL GREEN" : "\nFAILED");
process.exit(failed === 0 ? 0 : 1);
