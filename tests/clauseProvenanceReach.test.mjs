/**
 * clauseProvenanceReach.test.mjs
 *
 * EVERY CLAUSE IN A SHIPPED DOCUMENT MUST BE A KNOWLEDGE-BASE CLAUSE.
 *
 * A review of the NDA surfaced `AUTO-INDEM-001` and `AUTO-LIAB-001` in the
 * output. They come from backend/commercial/protectionLibrary.js — a second
 * clause library, outside the knowledge base, injected after hardening has run.
 *
 * Clauses from there are invisible to everything this system uses to keep itself
 * honest. They carry no review_status, so no advocate can sign them off. They
 * carry no structured legal_basis and no invalid_if, so the intelligence report
 * and the drafting-defect checks pass over them. They are not in
 * getAllClauses(), so the clause library counts and the unreviewed-backlog
 * ceiling do not see them. A knowledge-defined document family cannot reach,
 * override or replace them, which quietly contradicts the universality claim.
 *
 * This test does not pretend that is fixed. It pins the reach so it cannot grow
 * while the migration is outstanding — the same ratchet as the unreviewed-clause
 * ceiling, and for the same reason: debt that cannot expand is survivable, debt
 * that spreads silently is not.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getClauseById } from "../backend/services/clauseAssembler.js";

const baseline = JSON.parse(fs.readFileSync(path.resolve("tests/baseline/clause-baseline.json"), "utf8"));
let checks = 0;

// Known shadow-library clauses reaching shipped documents, and the types that
// receive them. Lowering either number is progress; raising one is a
// regression. The fix is migration into the knowledge base, not a longer list.
// Zero. Not a ceiling — an invariant.
//
//     runtime_shipped_clause_ids  subset-of  getAllClauses().ids
//
// This started as a containment ratchet at 3 ids across 7 types while the second
// library was migrated. The migration is done: protectionLibrary.js no longer
// builds clauses, it maps a requested protection to a governed clause id, and
// the injector refuses rather than falling back to hand-built text. A single
// exception here would make invariant 12 false again.
const KNOWN_SHADOW_IDS = new Set();
const KNOWN_AFFECTED_TYPES = 0;

const shadow = new Map();
for (const [documentType, record] of Object.entries(baseline.types || {})) {
  for (const level of ["minimal", "full"]) {
    for (const clauseId of record?.[level]?.clauses || []) {
      if (getClauseById(clauseId)) continue;
      if (!shadow.has(clauseId)) shadow.set(clauseId, new Set());
      shadow.get(clauseId).add(documentType);
    }
  }
}

const unexpected = [...shadow.keys()].filter((id) => !KNOWN_SHADOW_IDS.has(id));
assert.deepStrictEqual(unexpected, [],
  `${unexpected.join(", ")} appear in shipped documents and are not knowledge-base clauses. ` +
  `A clause outside the library has no review status an advocate can sign, no structured legal ` +
  `basis, no invalid_if, and cannot be reached or overridden by a knowledge-defined family. ` +
  `Add it to the knowledge base rather than to this list.`);
checks += 1;

const affected = new Set([...shadow.values()].flatMap((types) => [...types]));
assert.ok(affected.size <= KNOWN_AFFECTED_TYPES,
  `${affected.size} document types now ship clauses from outside the knowledge base, above the ` +
  `pinned ${KNOWN_AFFECTED_TYPES}: ${[...affected].sort().join(", ")}`);
checks += 1;

for (const [clauseId, types] of shadow) {
  assert.ok(types.size > 0, `${clauseId} recorded with no affected type`);
  checks += 1;
}
console.log(
  `PASS  every clause in every shipped document is a governed knowledge-base clause ` +
  `(${Object.keys(baseline.types || {}).length} document types checked)`
);

console.log(`\nALL GREEN (${checks} checks)`);
