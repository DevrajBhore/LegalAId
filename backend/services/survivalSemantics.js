/**
 * survivalSemantics.js — D4.47
 *
 * Which provisions an agreement says survive termination, established from the
 * clauses the FINAL document contains, by clause id, against an authored list
 * (knowledge-base/metadata/survival_semantics.json). Not from titles.
 *
 * Also verifies a rendered document: the survival list it prints must name
 * exactly the surviving provisions it contains.
 */
import fs from "fs";

const FILE = new URL("../../knowledge-base/metadata/survival_semantics.json", import.meta.url);
let cache = null;

export function loadSurvivalSemantics() {
  if (cache) return cache;
  const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const seen = new Map();
  for (const concept of doc.concepts) {
    for (const id of concept.clause_ids) {
      if (seen.has(id)) throw new Error(`survival_semantics: ${id} is listed under both ${seen.get(id)} and ${concept.concept}`);
      seen.set(id, concept.concept);
    }
    for (const { clause_id } of concept.excluded || []) {
      if (seen.has(clause_id)) throw new Error(`survival_semantics: ${clause_id} is both included and excluded`);
    }
  }
  cache = {
    concepts: doc.concepts.filter((c) => c.survives === true),
    referencedBy: new Set(doc.referenced_by.clause_ids),
    conceptOf: seen,
  };
  return cache;
}

/** Labels of the surviving provisions a clause set contains, in authored order. */
export function survivingLabels(clauseIds) {
  const present = new Set(clauseIds);
  return loadSurvivalSemantics()
    .concepts.filter((c) => c.clause_ids.some((id) => present.has(id)))
    .map((c) => c.label);
}

export function survivalReferencingClauseIds() {
  return loadSurvivalSemantics().referencedBy;
}

/* ── Verification against the final document ───────────────────────────── */

// The sentences the engine renders. A clause that has been rewritten so that
// neither is found is not read (no finding either way), because guessing at a
// list in free text is how a check produces confident wrong answers.
const SURVIVAL_SENTENCE = /provisions of this Agreement relating to (.+?) shall survive/i;
const TERMINATION_SENTENCE = /intended to survive, including (.+?)\.(?:\s|$)/i;

export function verifySurvivalReferences(draft) {
  const clauses = draft?.clauses || [];
  const ids = clauses.map((c) => c.clause_id);
  const expected = survivingLabels(ids);
  const known = new Set(loadSurvivalSemantics().concepts.map((c) => c.label));
  const issues = [];
  for (const clause of clauses) {
    if (!survivalReferencingClauseIds().has(clause.clause_id)) continue;
    const text = String(clause.text || "");
    const m = text.match(SURVIVAL_SENTENCE) || text.match(TERMINATION_SENTENCE);
    if (!m) continue;
    // Each known label is looked for in the enumerated series; the labels are
    // distinct phrases ("governing law and jurisdiction" contains "and", so the
    // series is not split on it).
    const series = m[1].toLowerCase();
    const named = [...known].filter((label) => series.includes(label));
    const missing = expected.filter((label) => !named.includes(label));
    const absent = named.filter((label) => !expected.includes(label));
    if (!missing.length && !absent.length) continue;
    issues.push({
      rule_id: "SURVIVAL_REFERENCES_MISMATCH",
      severity: "HIGH",
      blocks_generation: false,
      release_outcome: "REQUIRES_LEGAL_REVIEW",
      manual_review_required: true,
      layer: "survival",
      offending_clause_id: clause.clause_id,
      message:
        `${clause.title || clause.clause_id} does not match the provisions this document contains: ` +
        [
          missing.length ? `it omits ${missing.join(", ")}, which the document contains and which survive` : "",
          absent.length ? `it names ${absent.join(", ")}, which the document does not contain` : "",
        ].filter(Boolean).join("; ") + ".",
      suggestion: "Make the survival list name exactly the surviving provisions in this document, or have a lawyer confirm the difference is intended.",
      evidence: { expected, named },
    });
  }
  return issues;
}
