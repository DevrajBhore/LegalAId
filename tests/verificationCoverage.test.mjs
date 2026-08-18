import assert from "node:assert";
import { formatValidationResult } from "../backend/services/validationService.js";

// ── 1. "Certified" no longer appears as a user-facing verdict ────────────────
const clean = formatValidationResult({ issues: [] });
assert.strictEqual(clean.certification, "No issues detected",
  'a clean run must not be labelled "Certified"');
assert.strictEqual(clean.certified, true, "the internal export gate is retained");
assert.strictEqual(clean.checks_passed, true);
console.log("PASS  clean run reported as 'No issues detected', gate flag retained");

const blocked = formatValidationResult({
  issues: [{ rule_id: "X", severity: "CRITICAL", message: "m" }],
});
assert.strictEqual(blocked.certification, "Blocked");
assert.strictEqual(blocked.certified, false);

const advisory = formatValidationResult({
  issues: [{ rule_id: "Y", severity: "MEDIUM", message: "m" }],
});
assert.strictEqual(advisory.certification, "Review Required");
console.log("PASS  blocked / review-required bands unchanged");

// ── 2. Coverage is carried through ──────────────────────────────────────────
const withCoverage = formatValidationResult({
  issues: [],
  coverage: {
    layers_run: ["rule_engine", "commercial"],
    layers_skipped: [{ layer: "input_consistency", reason: "form values unavailable" }],
    rules_evaluated: 13, rules_passed: 11, rules_failed: 0, rules_not_applicable: 2,
    not_machine_verified: [{ id: "STAMP_DUTY_ADEQUACY", area: "Stamp duty", statement: "..." }],
  },
});
assert.ok(withCoverage.coverage, "coverage must survive formatting");
assert.strictEqual(withCoverage.coverage.rules_evaluated, 13);
assert.strictEqual(withCoverage.coverage.not_machine_verified.length, 1);
console.log("PASS  coverage object carried through");

// ── 3. A clean run still discloses what was NOT checked ─────────────────────
// This is the whole point: an empty issue list plus a disclosure list, rather
// than a bare pass that reads as a legal seal.
assert.strictEqual(clean.coverage, null,
  "coverage is null when formatValidationResult is called without it (blocked-generation path)");
console.log("PASS  coverage defaults to null rather than fabricating a denominator");

// ── 4. The disclosure file is loadable and shaped as expected ───────────────
const disclosure = JSON.parse(
  await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../knowledge-base/metadata/verification_coverage.json", import.meta.url), "utf8"))
);
assert.ok(Array.isArray(disclosure.not_machine_verified) && disclosure.not_machine_verified.length >= 5);
for (const entry of disclosure.not_machine_verified) {
  assert.ok(entry.id && entry.area && entry.statement, `malformed disclosure entry: ${JSON.stringify(entry)}`);
}
assert.strictEqual(disclosure.review_status, "draft-needs-legal-review");
console.log(`PASS  disclosure file: ${disclosure.not_machine_verified.length} global items, ` +
            `${Object.keys(disclosure.by_document_type || {}).length} doc-type specific`);

console.log("\nALL GREEN");
