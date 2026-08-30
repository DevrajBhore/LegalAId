// Guards the two defects that made every published document display a health
// score of 73-76 and the words "Needs Review", regardless of how it was filled in:
//
//   1. Statutory identifiers the intake form collects -- PAN, GSTIN, CIN, LLPIN --
//      never reached the draft for any document whose participant slots are not
//      literally named `party_N`. The reflection layer reported each one as a
//      HIGH finding, which banded the document HIGH and cost it 20 points apiece.
//
//   2. STALE_CITATION_AWAITING_REVIEW -- a note that OUR clause library has
//      tombstoned a citation and queued it for the supervising advocate -- was
//      scored as a defect in the USER'S document. It rides on the general
//      provisions baseline, so it appeared in every document by construction and
//      put a permanent -10 and a MEDIUM band on the entire catalogue.
//
// Neither was visible from the outside: the sweep reported the scores and nobody
// asked why the distribution had no mass above 90.

import assert from "node:assert";
import fs from "node:fs";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor } from "../sweep.mjs";

let failures = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS  ${name}`))
    .catch((error) => {
      failures += 1;
      console.log(`FAIL  ${name}`);
      console.log(`      ${error.message}`);
    });
}

const IDENTIFIER_FIELD = /_(?:pan|gstin|cin|llpin)$/;

// What the intake form actually puts in front of the user for this type. The
// fixture fills everything in VARIABLE_CONFIG.COMMON, which is a superset --
// asserting against that would be testing the fixture, not the product.
function fieldsOnTheForm(documentType) {
  const sections = DOCUMENT_CONFIG[documentType]?.sections || [];
  return new Set(sections.flatMap((section) => section.fields || []));
}

const drafts = new Map();
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const variables = variablesFor(documentType);
  let result = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      result = await generateDocument({ document_type: documentType, variables });
    } catch {
      result = null;
      break;
    }
    if (result?.draft) break;
    const missing = String(result?.error || "").match(/Missing required field: (\w+)/);
    if (!missing || variables[missing[1]] !== undefined) break;
    variables[missing[1]] = "2026-09-01";
  }
  // A type that cannot generate at all is the business of optionalFieldSafety
  // and bootInvariants, not of this file.
  if (result?.draft) drafts.set(documentType, { result, variables });
}

await test("the fixture corpus still generates", () => {
  assert.ok(
    drafts.size >= 30,
    `only ${drafts.size} types generated; this file cannot report on a corpus that small`
  );
});

await test("every statutory identifier the form collects reaches the draft", () => {
  const dropped = [];
  let checked = 0;
  for (const [documentType, { result, variables }] of drafts) {
    const offered = fieldsOnTheForm(documentType);
    const text = (result.draft.clauses || []).map((clause) => clause.text).join("\n");
    for (const [field, value] of Object.entries(variables)) {
      if (!IDENTIFIER_FIELD.test(field) || !offered.has(field)) continue;
      if (!value || !String(value).trim()) continue;
      checked += 1;
      if (!text.includes(String(value).trim())) dropped.push(`${documentType}.${field}`);
    }
  }
  assert.ok(checked > 0, "no identifier field was exercised; the fixture has stopped filling them");
  assert.deepStrictEqual(
    dropped,
    [],
    `identifiers collected by the form but absent from the draft:\n  ${dropped.join("\n  ")}`
  );
});

await test("no document reports a form value it silently dropped", () => {
  const unreflected = [];
  for (const [documentType, { result }] of drafts) {
    const issues = [
      ...(result.validation?.blockingIssues || []),
      ...(result.validation?.advisoryIssues || []),
    ];
    for (const issue of issues) {
      if (/^FORM_VALUE_NOT_REFLECTED_/.test(issue.rule_id || "")) {
        unreflected.push(`${documentType}: ${issue.rule_id}`);
      }
    }
  }
  assert.deepStrictEqual(unreflected, [], `\n  ${unreflected.join("\n  ")}`);
});

await test("a citation queued for the advocate never costs the document points", () => {
  const charged = [];
  for (const [documentType, { result }] of drafts) {
    for (const deduction of result.validation?.score_breakdown?.deductions || []) {
      if (deduction.rule_id === "STALE_CITATION_AWAITING_REVIEW") {
        charged.push(`${documentType} (-${deduction.points})`);
      }
    }
  }
  assert.deepStrictEqual(charged, [], `scored as a defect in:\n  ${charged.join("\n  ")}`);
});

await test("the score is the arithmetic its own breakdown reports", () => {
  for (const [documentType, { result }] of drafts) {
    const breakdown = result.validation?.score_breakdown;
    assert.ok(breakdown, `${documentType} carries no score_breakdown`);
    const deducted = breakdown.deductions.reduce((total, entry) => total + entry.points, 0);
    assert.strictEqual(
      result.validation.score,
      Math.max(0, 100 - deducted),
      `${documentType}: score ${result.validation.score} does not follow from its deductions`
    );
  }
});

await test("a well-filled document is not banded as a risk by notes alone", () => {
  // Not a ratchet on any particular type -- a ratchet on the shape of the
  // distribution. Before the fix, exactly zero types scored 100 and the mode was
  // 75; if that returns, something is charging every document for the same thing.
  const perfect = [...drafts.values()].filter((d) => d.result.validation?.score === 100);
  assert.ok(
    perfect.length >= drafts.size / 2,
    `only ${perfect.length} of ${drafts.size} types are clean; a defect common to the whole catalogue is the likely cause`
  );
});

await test("the panel displays the engine's score rather than re-deriving one", () => {
  // The engine computed an itemised score and the panel threw it away, showing a
  // number derived from the coarse risk band instead: a 100 displayed as 92 and a
  // 90 displayed as 75. Nothing in the backend could catch that.
  const panel = fs.readFileSync(
    new URL("../frontend/src/components/RiskPanel.jsx", import.meta.url),
    "utf8"
  );
  assert.match(
    panel,
    /typeof validation\.score === "number"/,
    "RiskPanel no longer reads validation.score as its primary source"
  );
});

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
