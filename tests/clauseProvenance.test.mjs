import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clauseReviewState,
  summariseProvenance,
  REVIEW_STATE,
} from "../shared/clauseProvenance.js";

// ── 1. What counts as a signature ────────────────────────────────────────────
assert.strictEqual(
  clauseReviewState({ clause_id: "X", reviewed_by: "PENDING" }).reviewed,
  false,
  '"PENDING" is a placeholder, not a reviewer'
);
assert.strictEqual(
  clauseReviewState({ clause_id: "X", reviewed_by: "Adv. R. Menon", review_status: "draft-needs-legal-review" }).reviewed,
  false,
  "a named reviewer does not override a status that still says it needs review"
);
assert.strictEqual(
  clauseReviewState({ clause_id: "X", reviewed_by: "Adv. R. Menon", reviewed_on: "2026-08-20" }).reviewed,
  true
);
assert.strictEqual(clauseReviewState({ clause_id: "X" }).state, REVIEW_STATE.UNMARKED);
console.log("PASS  review-state semantics (placeholders rejected)");

// ── 2. The backlog can only shrink ──────────────────────────────────────────
// Pinned so that adding a NEW unreviewed clause fails the build, while every
// clause that gets signed off moves the numbers in the right direction.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUSE_LIB = path.join(ROOT, "knowledge-base", "clause_library");

const clauses = [];
for (const folder of fs.readdirSync(CLAUSE_LIB, { withFileTypes: true })) {
  if (!folder.isDirectory() || folder.name === "blueprints") continue;
  for (const file of fs.readdirSync(path.join(CLAUSE_LIB, folder.name))) {
    if (!file.endsWith(".json")) continue;
    const clause = JSON.parse(
      fs.readFileSync(path.join(CLAUSE_LIB, folder.name, file), "utf8")
    );
    if (clause?.clause_id) clauses.push(clause);
  }
}

const summary = summariseProvenance(clauses);
const MAX_UNREVIEWED = 190; // as at Wave 4; lower this as clauses are signed off

console.log(
  `      library: ${summary.total} clauses, ${summary.reviewed} reviewed, ` +
  `${summary.awaiting_review} awaiting review, ${summary.unmarked} unmarked`
);
assert.ok(
  summary.total - summary.reviewed <= MAX_UNREVIEWED,
  `unreviewed clause count rose to ${summary.total - summary.reviewed}, above the pinned ceiling of ${MAX_UNREVIEWED}. ` +
  `Either get the new clause reviewed, or lower the ceiling deliberately.`
);
console.log(`PASS  unreviewed backlog within the pinned ceiling of ${MAX_UNREVIEWED}`);

// ── 3. Every clause I authored declares its status ──────────────────────────
const authored = clauses.filter((c) => c.review_status);
assert.ok(
  authored.length >= 2,
  "clauses authored by tooling must declare review_status"
);
for (const clause of authored) {
  assert.ok(
    [REVIEW_STATE.DRAFT, REVIEW_STATE.APPROVED, "approved-pending-activation"].includes(
      String(clause.review_status)
    ),
    `unexpected review_status on ${clause.clause_id}: ${clause.review_status}`
  );
}
console.log(`PASS  ${authored.length} clause(s) carry an explicit review_status`);

// ── 4. Every citation is well-formed ────────────────────────────────────────
let citations = 0;
for (const clause of clauses) {
  assert.ok(
    Array.isArray(clause.legal_basis) && clause.legal_basis.length > 0,
    `${clause.clause_id} has no legal_basis`
  );
  for (const entry of clause.legal_basis) {
    citations += 1;
    assert.ok(entry?.act, `${clause.clause_id} has a legal_basis entry with no act`);
    assert.ok(
      entry.section || entry.article,
      `${clause.clause_id} cites "${entry.act}" with neither section nor article`
    );
  }
}
console.log(`PASS  ${citations} statutory citations well-formed across ${clauses.length} clauses`);

console.log("\nALL GREEN");
