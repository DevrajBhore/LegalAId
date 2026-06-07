// Regression test for the clause-library search index.
// Run: node tests/clauseSearch.test.mjs
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");
const toUrl = (p) => "file://" + (p.startsWith("/") ? p : "/" + p.replace(/\\/g, "/"));

const { preloadKnowledgeBase } = await import(toUrl(path.join(backend, "services/clauseAssembler.js")));
const { searchClauses } = await import(toUrl(path.join(backend, "services/clauseSearch.js")));
const { DOCUMENT_CONFIG } = await import(toUrl(path.join(backend, "config/documentConfig.js")));

preloadKnowledgeBase({ documentTypes: Object.keys(DOCUMENT_CONFIG) });

// Empty query is handled.
assert.strictEqual(searchClauses("").count, 0);

// Confidentiality search returns confidentiality-category clauses, ranked.
const conf = searchClauses("confidential information", { limit: 5 });
assert.ok(conf.count > 0, "confidentiality search returns results");
assert.ok(
  conf.results.some((r) => /CONFIDENTIAL/i.test(r.category || "")),
  "top results include confidentiality clauses"
);
assert.ok(conf.results[0].snippet.length > 0, "results carry a snippet");
assert.ok(conf.results[0].score > 0, "results carry a score");

// Termination search finds the variants we authored.
const term = searchClauses("termination for convenience notice", { limit: 10 });
assert.ok(
  term.results.some((r) => r.clause_id === "SERVICE_TERMINATION_CONVENIENCE_001"),
  "finds the convenience termination variant"
);

// document_type filter narrows results.
const filtered = searchClauses("payment", { documentType: "SERVICE_AGREEMENT", limit: 10 });
assert.ok(
  filtered.results.every(
    (r) => r.document_types.includes("ALL") || r.document_types.some((t) => /SERVICE/i.test(t))
  ),
  "document_type filter restricts to matching clauses"
);

console.log("Clause search test passed.");
