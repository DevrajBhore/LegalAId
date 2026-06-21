import assert from "node:assert";
import { extractGaps } from "../backend/services/gapSignalService.js";

// A draft missing indemnity/force-majeure/dispute, with a surviving advisory.
const draft = { clauses: [
  { clause_id: "CORE_IDENTITY_001", category: "IDENTITY" },
  { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY" },
]};
const validation = { advisoryIssues: [
  { rule_id: "STAMP_ACT_S17_NOTICE", message: "Stamp duty applies." },
  { rule_id: "STAMP_ACT_S17_NOTICE", message: "dup" }, // de-duped
]};
const gaps = extractGaps(draft, validation);
const keys = gaps.map((g) => g.gapKey);

assert.ok(keys.includes("STAMP_ACT_S17_NOTICE"), "advisory captured");
assert.ok(keys.includes("INDEMNITY"), "missing indemnity captured");
assert.ok(keys.includes("FORCE_MAJEURE"), "missing force majeure captured");
assert.ok(keys.includes("DISPUTE_RESOLUTION"), "missing dispute resolution captured");
assert.ok(!keys.includes("CONFIDENTIALITY"), "present protection not flagged");
assert.strictEqual(keys.filter((k) => k === "STAMP_ACT_S17_NOTICE").length, 1, "de-duped");
assert.strictEqual(gaps.find((g) => g.gapKey === "INDEMNITY").gapType, "missing_protection");

// A complete draft → no gaps.
const complete = { clauses: [
  { category: "LIABILITY" }, { category: "INDEMNITY" }, { category: "FORCE_MAJEURE" },
  { category: "DISPUTE_RESOLUTION" }, { category: "CONFIDENTIALITY" },
]};
assert.strictEqual(extractGaps(complete, {}).length, 0, "complete draft has no gaps");

console.log("Gap signal test passed.");
