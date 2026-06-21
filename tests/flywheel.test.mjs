// Tests the AI-proposal flywheel promotion: an AI-proposed review row produces a
// near-complete clause (real legal_basis, scoped document_types) + a wiring rule;
// a mined row still produces the safe "needs legal basis" stub.
import assert from "node:assert";
import { buildPromotedArtifacts } from "../backend/services/clauseReviewService.js";

// 1. AI-proposed clause → structured legal_basis + scoped doc type + wiring rule.
const ai = buildPromotedArtifacts({
  _id: "abc123", category: "indemnity", fingerprint: "deadbeefcafe0000",
  clauseName: "Mutual Indemnity", text: "Each Party shall indemnify the other against losses arising from its breach.",
  riskLevel: "high", source: "ai-proposed", documentType: "SERVICE_AGREEMENT",
  legalBasis: "Indian Contract Act, 1872 - S.124; Indian Contract Act 1872 - S.125",
  ruleWhen: "include_indemnity == true", ruleAction: "add", proposalWhy: "Allocates liability for breach.",
});
assert.strictEqual(ai.clauseId, "INDEMNITY_REVIEWED_DEADBEEF", "clause id derived from category+fingerprint");
assert.deepStrictEqual(ai.stub.document_types, ["SERVICE_AGREEMENT"], "AI clause scoped to its doc type");
assert.strictEqual(ai.stub.needs_legal_basis, false, "AI clause has reviewed legal basis");
assert.strictEqual(ai.stub.legal_basis[0].act, "Indian Contract Act, 1872", "parsed act");
assert.strictEqual(ai.stub.legal_basis[0].section, "124", "parsed section");
assert.strictEqual(ai.stub.legal_basis.length, 2, "both sections parsed");
assert.ok(ai.wiringRule, "AI proposal yields a wiring rule");
assert.strictEqual(ai.wiringRule.include_if, "include_indemnity == true", "rule carries the include_if");
assert.strictEqual(ai.wiringRule.clause, ai.clauseId, "rule points at the new clause");

// 2. Replace-action proposal → variant slot wiring.
const rep = buildPromotedArtifacts({
  _id: "x", category: "confidentiality", fingerprint: "1111222233334444",
  text: "Heightened confidentiality...", source: "ai-proposed", documentType: "NDA",
  legalBasis: "ICA 1872 - S.27", ruleWhen: "involves_trade_secrets == true", ruleAction: "replace",
});
assert.strictEqual(rep.wiringRule.action, "replace");
assert.ok(rep.wiringRule.slot, "replace rule has a variant slot");

// 3. Mined clause → safe stub requiring legal basis, document_types ALL, no rule.
const mined = buildPromotedArtifacts({
  _id: "y", category: "termination", fingerprint: "9999888877776666",
  text: "Either party may terminate on notice.", source: "mined",
});
assert.deepStrictEqual(mined.stub.document_types, ["ALL"]);
assert.strictEqual(mined.stub.needs_legal_basis, true, "mined stub still needs legal basis");
assert.strictEqual(mined.stub.legal_basis[0].act, "REVIEW REQUIRED");
assert.strictEqual(mined.wiringRule, null, "mined clause has no auto wiring rule");

console.log("Flywheel promotion test passed.");
