// Tests the AI-authoring safety bounding: reused clause ids must exist and not
// already be present; drafted clauses must be non-trivial. The AI call itself
// isn't exercised (needs a provider key + Mongo).
// Run: node tests/clauseAuthoring.test.mjs
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");
const toUrl = (p) => "file://" + (p.startsWith("/") ? p : "/" + p.replace(/\\/g, "/"));
const { _validateProposal } = await import(
  toUrl(path.join(backend, "services/clauseAuthoringService.js"))
);

const library = new Map([
  ["CORE_INDEMNITY_001", { clause_id: "CORE_INDEMNITY_001", category: "INDEMNITY" }],
]);
const present = new Set(["CORE_GOVERNING_LAW_001"]);

// 1. Valid reuse of an existing, not-present clause.
const reuse = _validateProposal(
  { protection: "Indemnity", why: "needed", rule_when: "include_indemnity == true", reuse_clause_id: "CORE_INDEMNITY_001" },
  present,
  library
);
assert.ok(reuse && reuse.kind === "reuse" && reuse.clause_id === "CORE_INDEMNITY_001");

// 2. Reusing a clause that doesn't exist is rejected.
assert.strictEqual(
  _validateProposal({ protection: "X", why: "y", rule_when: "always", reuse_clause_id: "MADE_UP_001" }, present, library),
  null
);

// 3. Reusing a clause already present is rejected (no duplicate).
assert.strictEqual(
  _validateProposal({ protection: "X", why: "y", rule_when: "always", reuse_clause_id: "CORE_GOVERNING_LAW_001" }, present, library),
  null
);

// 4. A drafted clause is accepted and flagged for review.
const draft = _validateProposal(
  { protection: "Limitation of Liability", why: "caps exposure", rule_when: "include_limitation == true", draft_clause_text: "Neither party shall be liable for indirect or consequential damages arising under this Agreement." },
  present,
  library
);
assert.ok(draft && draft.kind === "draft");
assert.strictEqual(draft.review_status, "draft-needs-legal-review");
assert.strictEqual(draft.category, "LIMITATION_OF_LIABILITY");

// 5. Trivial / empty draft is rejected.
assert.strictEqual(
  _validateProposal({ protection: "X", why: "y", rule_when: "always", draft_clause_text: "too short" }, present, library),
  null
);

// 6. Missing required fields rejected.
assert.strictEqual(_validateProposal({ protection: "X" }, present, library), null);

console.log("Clause authoring safety test passed.");
