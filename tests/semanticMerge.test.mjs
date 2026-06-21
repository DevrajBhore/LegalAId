// The resilient per-clause merge: AI tailors the clauses it rewrote, the seed's
// deterministic text is kept for the rest, and the rule-decided structure (clause
// set + ids) is never changed by the AI.
import assert from "node:assert";
import { mergeAIDraftWithSeed } from "../backend/services/documentService.js";

const seed = { document_type: "NDA", jurisdiction: "India", clauses: [
  { clause_id: "A", category: "IDENTITY", title: "Parties", text: "SEED A text." },
  { clause_id: "B", category: "PURPOSE", title: "Purpose", text: "SEED B text." },
  { clause_id: "C", category: "CONFIDENTIALITY", title: "Confidentiality", text: "SEED C text." },
], metadata: {} };
const input = { document_type: "NDA", variables: {} };

// 1. AI tailored A and C, dropped B → merged keeps all 3, A/C use AI text, B kept.
const partial = mergeAIDraftWithSeed(seed, { document_type: "NDA", clauses: [
  { clause_id: "A", text: "AI-tailored A for this exact deal." },
  { clause_id: "C", text: "AI-tailored C for trade secrets." },
] }, input, "gemini");
assert.ok(partial, "partial AI draft is NOT discarded (old code returned null here)");
assert.strictEqual(partial.clauses.length, 3, "all seed clauses preserved");
assert.strictEqual(partial.clauses.find((c) => c.clause_id === "A").text, "AI-tailored A for this exact deal.");
assert.strictEqual(partial.clauses.find((c) => c.clause_id === "C").text, "AI-tailored C for trade secrets.");
assert.strictEqual(partial.clauses.find((c) => c.clause_id === "B").text, "SEED B text.", "untailored clause keeps deterministic text");
assert.strictEqual(partial.metadata.ai_tailored_clause_count, 2);
assert.strictEqual(partial.metadata.ai_total_clause_count, 3);

// 2. AI returns the WRONG document type → reject (structure is the engine's).
assert.strictEqual(
  mergeAIDraftWithSeed(seed, { document_type: "EMPLOYMENT_CONTRACT", clauses: [{ clause_id: "A", text: "x" }] }, input, "g"),
  null,
  "wrong doc type rejected"
);

// 3. AI invents a NEW clause id → it is ignored (cannot add structure).
const invented = mergeAIDraftWithSeed(seed, { document_type: "NDA", clauses: [
  { clause_id: "A", text: "tailored A" },
  { clause_id: "ZZZ_INVENTED", text: "an invented clause" },
] }, input, "g");
assert.strictEqual(invented.clauses.length, 3, "invented clause not added");
assert.ok(!invented.clauses.some((c) => c.clause_id === "ZZZ_INVENTED"), "AI cannot add clauses");

// 4. AI returns nothing usable (empty text) → fall back to deterministic.
assert.strictEqual(
  mergeAIDraftWithSeed(seed, { document_type: "NDA", clauses: [{ clause_id: "A", text: "  " }] }, input, "g"),
  null,
  "no usable AI text → deterministic fallback"
);

console.log("Semantic merge test passed.");
