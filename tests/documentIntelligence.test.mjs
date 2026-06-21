// Tests the risk-&-explainability layer: surfaces per-clause basis/hotspots, an
// overall risk/enforceability/statutes summary, and cross-clause conflicts.
import assert from "node:assert";
import { buildDocumentIntelligence } from "../backend/services/documentIntelligence.js";

// 1. Synthetic draft exercising all three conflict detectors.
const draft = { clauses: [
  { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Parties", text: "The parties are A and B.", legal_basis: [{act:"Indian Contract Act, 1872", section:"10"}], enforceability:"HIGH", inclusion_reason:"Identify the parties.", dispute_hotspots:["Wrong entity named"] },
  { clause_id: "CORE_LIMITATION_LIABILITY_001", category: "LIABILITY", title: "Limitation of Liability", text: "The aggregate liability shall not exceed the fees paid.", enforceability:"MEDIUM" },
  { clause_id: "CORE_INDEMNITY_001", category: "INDEMNITY", title: "Indemnity", text: "Each party shall indemnify the other for third-party claims.", enforceability:"HIGH", legal_basis:["Indian Contract Act, 1872 – S.124"] },
  { clause_id: "CORE_GOVERNING_LAW_001", category: "GOVERNING_LAW", title: "Governing Law", text: "India.", conflicts_with:["DUP_GL_001"] },
  { clause_id: "DUP_GL_001", category: "GOVERNING_LAW", title: "Governing Law (dup)", text: "India again." },
]};
const intel = buildDocumentIntelligence(draft, { score: 80, certified: true, certification: "Certified", risk_level: "LOW" });

// overall summary
assert.strictEqual(intel.overall.clause_count, 5);
assert.strictEqual(intel.overall.risk_score, 80);
assert.strictEqual(intel.overall.certified, true);
assert.ok(intel.overall.statutes_referenced.includes("Indian Contract Act, 1872"), "statutes surfaced");
assert.strictEqual(intel.overall.enforceability.HIGH, 2, "enforceability tally");

// per-clause explainability
const identity = intel.clauses.find(c => c.clause_id === "CORE_IDENTITY_001");
assert.strictEqual(identity.why, "Identify the parties.");
assert.deepStrictEqual(identity.legal_basis, ["Indian Contract Act, 1872 – S.10"]);
assert.deepStrictEqual(identity.dispute_hotspots, ["Wrong entity named"]);

// conflicts: indemnity-not-carved-out + duplicate singleton + declared
const types = intel.conflicts.map(c => c.type);
assert.ok(types.includes("INDEMNITY_NOT_CARVED_OUT"), "liability cap vs indemnity flagged");
assert.ok(types.includes("DUPLICATE_SINGLETON"), "two governing-law clauses flagged");
assert.ok(types.includes("DECLARED_CONFLICT"), "conflicts_with flagged");
assert.strictEqual(intel.overall.conflict_count, intel.conflicts.length);

// 2. A clean draft (cap that carves out indemnity, single governing law) → no conflicts.
const clean = { clauses: [
  { clause_id: "CAP", category: "LIABILITY", text: "Aggregate liability shall not exceed fees, except for indemnity obligations." },
  { clause_id: "IND", category: "INDEMNITY", text: "Party shall indemnify." },
  { clause_id: "GL", category: "GOVERNING_LAW", text: "India." },
]};
assert.strictEqual(buildDocumentIntelligence(clean, {}).conflicts.length, 0, "carve-out + single GL = no conflicts");

console.log("Document intelligence test passed.");
