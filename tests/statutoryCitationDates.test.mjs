import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  resolveStatutoryCitations,
  parseEffectiveDate,
  statutesSensitiveTo,
} from "../backend/services/statutoryCitationResolver.js";

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

const ids = (issues) => issues.map((issue) => issue.rule_id);
const draftOf = (...texts) => ({
  clauses: texts.map((clause_text, index) => ({ clause_id: `C_${index}`, clause_text })),
});

test("dates are read in the forms a document actually carries", () => {
  assert.strictEqual(parseEffectiveDate("2026-09-01")?.toISOString().slice(0, 10), "2026-09-01");
  assert.strictEqual(parseEffectiveDate("01.09.2026")?.toISOString().slice(0, 10), "2026-09-01");
  assert.strictEqual(parseEffectiveDate("1 September 2026")?.toISOString().slice(0, 10), "2026-09-01");
  assert.strictEqual(parseEffectiveDate("21st November, 2025")?.toISOString().slice(0, 10), "2025-11-21");
  assert.strictEqual(parseEffectiveDate("sometime next year"), null);
  assert.strictEqual(parseEffectiveDate(""), null);
  assert.strictEqual(parseEffectiveDate(null), null);
});

test("a repealed Act cited for a present-day document is caught", () => {
  const issues = resolveStatutoryCitations(
    draftOf("Wages are payable under the Payment of Wages Act, 1936 S.5."),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  const issue = issues.find((entry) => entry.rule_id === "CITES_REPEALED_STATUTE");
  assert.ok(issue, "expected the repeal to be caught");
  assert.strictEqual(issue.severity, "HIGH");
  assert.match(issue.suggestion, /Code on Wages, 2019/);
});

// The point of the whole layer: the same citation is CORRECT for a document
// that took effect before the repeal, and must not be reported as a defect.
test("the same citation is right for a document predating the repeal", () => {
  const issues = resolveStatutoryCitations(
    draftOf("Wages are payable under the Payment of Wages Act, 1936 S.5."),
    { effectiveDate: "2024-06-01", asOf: "2026-08-28" }
  );
  assert.ok(!ids(issues).includes("CITES_REPEALED_STATUTE"));
  const issue = issues.find((entry) => entry.rule_id === "TRANSITIONAL_STATUTE_APPLIES");
  assert.ok(issue, "expected the transitional position to be recorded");
  assert.strictEqual(issue.severity, "LOW");
});

test("a Code cited for a document predating its commencement is caught", () => {
  const issues = resolveStatutoryCitations(
    draftOf("Wages are payable under the Code on Wages, 2019 S.17."),
    { effectiveDate: "2024-06-01", asOf: "2026-08-28" }
  );
  assert.ok(ids(issues).includes("CITES_UNCOMMENCED_PROVISION"));
});

test("the same Code is right for a document after commencement", () => {
  const issues = resolveStatutoryCitations(
    draftOf("Wages are payable under the Code on Wages, 2019 S.17."),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.deepStrictEqual(issues, []);
});

test("the DPDP Rules resolve per rule, not per instrument", () => {
  // Rule 17 commenced on publication; Rule 6 does not until 14 May 2027.
  const early = resolveStatutoryCitations(
    draftOf("The Board proceeds under Rule 17 of the Digital Personal Data Protection Rules, 2025."),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.deepStrictEqual(ids(early), []);

  const deferred = resolveStatutoryCitations(
    draftOf("Safeguards are those in Rule 6 of the Digital Personal Data Protection Rules, 2025."),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.ok(ids(deferred).includes("CITES_UNCOMMENCED_PROVISION"));

  const afterwards = resolveStatutoryCitations(
    draftOf("Safeguards are those in Rule 6 of the Digital Personal Data Protection Rules, 2025."),
    { effectiveDate: "2027-09-01", asOf: "2026-08-28" }
  );
  assert.deepStrictEqual(ids(afterwards), []);
});

test("a clause that states the commencement is not punished for it", () => {
  const issues = resolveStatutoryCitations(
    draftOf(
      "The Parties adopt the measures prescribed by Rule 6 of the Digital Personal Data Protection Rules, 2025 by contract, and record that Rule 6 itself comes into force on 14 May 2027."
    ),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.deepStrictEqual(ids(issues), []);
});

test("disclosure in one clause covers a back-reference in another", () => {
  const issues = resolveStatutoryCitations(
    draftOf(
      "The Parties adopt Rule 6 of the Digital Personal Data Protection Rules, 2025 by contract, and record that it comes into force on 14 May 2027.",
      "Every sub-processor is bound by the safeguards this Agreement adopts from Rule 6 of the Digital Personal Data Protection Rules, 2025."
    ),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.deepStrictEqual(ids(issues), []);
});

test("a clause that states the WRONG commencement date is caught", () => {
  const issues = resolveStatutoryCitations(
    draftOf(
      "Rule 6 of the Digital Personal Data Protection Rules, 2025 comes into force on 1 January 2026."
    ),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.ok(ids(issues).includes("COMMENCEMENT_MISSTATED"));
});

test("with no effective date, a not-yet-commenced provision is a notice", () => {
  const issues = resolveStatutoryCitations(
    draftOf("Safeguards are those in Rule 6 of the Digital Personal Data Protection Rules, 2025."),
    { asOf: "2026-08-28" }
  );
  const issue = issues.find((entry) => entry.rule_id === "PROVISION_NOT_YET_IN_FORCE");
  assert.ok(issue);
  assert.strictEqual(issue.severity, "MEDIUM");
});

test("one finding per Act however often the citation repeats", () => {
  const issues = resolveStatutoryCitations(
    draftOf(
      "See the Payment of Wages Act, 1936 S.5.",
      "And again the Payment of Wages Act, 1936 S.5.",
      "And once more the Payment of Wages Act, 1936."
    ),
    { effectiveDate: "2026-09-01", asOf: "2026-08-28" }
  );
  assert.strictEqual(
    issues.filter((entry) => entry.rule_id === "CITES_REPEALED_STATUTE").length,
    1
  );
});

test("an empty or unclaused draft is left alone", () => {
  assert.deepStrictEqual(resolveStatutoryCitations({}, { effectiveDate: "2026-09-01" }), []);
  assert.deepStrictEqual(resolveStatutoryCitations({ clauses: [] }, {}), []);
});

test("the intake can be warned before drafting", () => {
  const sensitive = statutesSensitiveTo("2024-06-01");
  const names = sensitive.map((entry) => entry.act);
  assert.ok(names.some((name) => name.startsWith("Code on Wages")));
  assert.ok(names.some((name) => name.startsWith("Payment of Wages Act")));
  assert.deepStrictEqual(statutesSensitiveTo("not a date"), []);
});

// The live library, read as a present-day document. No clause may still cite an
// Act the Codes repealed.
test("no clause in the live library cites a repealed Act", () => {
  const libRoot = new URL("../knowledge-base/clause_library/", import.meta.url).pathname;
  const clauses = [];
  for (const folder of fs.readdirSync(libRoot, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === "blueprints") continue;
    for (const file of fs.readdirSync(path.join(libRoot, folder.name))) {
      if (!file.endsWith(".json")) continue;
      try {
        const clause = JSON.parse(fs.readFileSync(path.join(libRoot, folder.name, file), "utf8"));
        if (clause?.clause_id && clause.deprecated !== true) clauses.push(clause);
      } catch {
        /* parse failures are the citation checker's business, not this test's */
      }
    }
  }
  assert.ok(clauses.length > 200, `expected the whole library, got ${clauses.length} clauses`);

  const issues = resolveStatutoryCitations({ clauses }, {
    effectiveDate: "2026-09-01",
    asOf: "2026-08-28",
  }).filter((entry) => entry.rule_id === "CITES_REPEALED_STATUTE");

  assert.deepStrictEqual(
    issues.map((entry) => entry.message),
    [],
    "clauses still citing repealed Acts"
  );
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
