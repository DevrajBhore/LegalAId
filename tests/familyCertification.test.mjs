/**
 * familyCertification.test.mjs
 *
 * The dangerous claim this exists to prevent:
 *
 *     40 document types
 *     40 generators that run
 *     40 documents called "supported"
 *
 * when five have been substantively tested. "It generates" and "it has been
 * shown to do the legal work it claims" are different sentences.
 *
 * STATUS IS DERIVED, NEVER DECLARED. No family can be promoted by writing a
 * better word in a file. The one rung with an authored component — falsification
 * — requires naming the specific attack and the false green it produced, because
 * "we tested it" is not evidence and "we fed it a boilerplate façade and it
 * reported 1 of 13" is.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { certify, RUNG } from "../backend/services/familyCertification.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";

const baseline = JSON.parse(fs.readFileSync(path.resolve("tests/baseline/clause-baseline.json"), "utf8"));
const generates = new Set(
  Object.entries(baseline.types || {})
    .filter(([, record]) => (record?.full?.clauses || []).length)
    .map(([documentType]) => documentType)
);
const { families, counts, approved, total } = certify({ generates });
let checks = 0;

// ── 1. Nothing claims approval it has not earned ────────────────────────────
assert.strictEqual(approved, 0,
  `${approved} families report APPROVED. With zero advocate sign-off anywhere in the system, ` +
  `that is impossible, and the ladder has started accepting a declaration in place of evidence.`);
for (const [documentType, family] of Object.entries(families)) {
  assert.ok(RUNG.includes(family.status), `${documentType}: unknown status "${family.status}"`);
  if (family.status !== "NOT_ASSESSED") {
    assert.ok(family.reasons.length >= 2,
      `${documentType} claims ${family.status} with ${family.reasons.length} piece(s) of evidence`);
  }
  checks += 2;
}
console.log(`PASS  ${total} families, ${approved} approved, status derived from evidence`);

// ── 2. Falsification cannot be claimed, only described ──────────────────────
// A family reaching this rung must name an attack and the false green it found.
// "Tested" is not evidence.
const requirements = loadDocumentRequirements();
const attacked = Object.entries(families).filter(([, f]) =>
  ["FALSIFICATION_PASSED", "ADVOCATE_REVIEW", "APPROVED"].includes(f.status)
);
for (const [documentType] of attacked) {
  const record = requirements.get(documentType).find((r) => r.falsification);
  assert.ok(String(record?.falsification?.attack || "").length > 60,
    `${documentType} claims falsification without describing the attack`);
  assert.ok(String(record?.falsification?.false_green || "").length > 40,
    `${documentType} claims falsification without naming the false green it produced. A family ` +
    `that was attacked and held tells you nothing; a family that was attacked and BROKE is what ` +
    `made the abstraction better.`);
  checks += 2;
}
assert.ok(attacked.length >= 4,
  `only ${attacked.length} families have survived adversarial testing`);
console.log(`PASS  ${attacked.length} families name a specific attack and the false green it found`);

// ── 3. The ladder is monotone in evidence ───────────────────────────────────
// Removing evidence must lower the rung. Tested by withholding the generation
// baseline, which is the one input the assessment cannot fake.
const withoutBaselines = certify({ generates: new Set() });
for (const [documentType, family] of Object.entries(withoutBaselines.families)) {
  const withEvidence = RUNG.indexOf(families[documentType].status);
  const without = RUNG.indexOf(family.status);
  assert.ok(without <= withEvidence,
    `${documentType} rose from ${family.status} to ${families[documentType].status} when ` +
    `evidence was REMOVED, so the ladder is not reading evidence at all`);
  checks += 1;
}
assert.strictEqual(withoutBaselines.families.MASTER_SERVICE_AGREEMENT.status, "REQUIREMENTS_ADMITTED",
  "a family whose generation baseline is withheld must fall back to what its requirements alone prove");
checks += 1;
console.log("PASS  the ladder falls when evidence is withheld");

// ── 4. The honest headline ──────────────────────────────────────────────────
// The number that may be put in front of a user as "supported" is APPROVED, and
// it is zero. Everything else is work in progress with a name.
assert.ok(counts.NOT_ASSESSED > 0,
  "every family reporting as assessed would be a stronger claim than this system can make");
console.log(
  "PASS  " + RUNG.filter((r) => counts[r]).map((r) => `${r}=${counts[r]}`).join("  ")
);
checks += 1;

console.log(`\nALL GREEN (${checks} checks)`);
