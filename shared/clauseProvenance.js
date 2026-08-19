/**
 * clauseProvenance.js
 *
 * Who approved a clause, and when.
 *
 * `review_status` was previously written by the authoring services and read by
 * nothing: the only gate on unreviewed clause text reaching production was a
 * human remembering to move a file into clause_library/. This module makes the
 * field mean something, and — more importantly — makes the BACKLOG visible,
 * because as at the time of writing 0 of 190 clauses carry a reviewer.
 *
 * A hard refusal is therefore not shippable today. The gate is graduated:
 *
 *   default                                   load everything, report the gap
 *   LEGALAID_REQUIRE_REVIEWED_CLAUSES=1       refuse to load unreviewed clauses
 *
 * Turn the flag on once the library has been through review. Until then the
 * per-document review coverage is surfaced to the user alongside the issue list,
 * so "no issues found" is never mistaken for "an advocate has seen this".
 */

export const REVIEW_STATE = {
  APPROVED: "approved",
  DRAFT: "draft-needs-legal-review",
  UNMARKED: "unmarked",
};

// Values that look like a reviewer but are not one.
const PLACEHOLDER_REVIEWERS = new Set(["", "pending", "tbd", "todo", "none", "n/a", "unknown"]);

function isRealReviewer(value) {
  return (
    typeof value === "string" &&
    !PLACEHOLDER_REVIEWERS.has(value.trim().toLowerCase())
  );
}

/**
 * A clause counts as reviewed only when a named reviewer signed it AND its
 * status does not still say it needs review. A `reviewed_by` of "PENDING"
 * is explicitly not a signature.
 */
export function clauseReviewState(clause = {}) {
  const reviewer = clause.reviewed_by;
  const status = String(clause.review_status || "").trim().toLowerCase();
  const hasReviewer = isRealReviewer(reviewer);

  if (hasReviewer && status !== REVIEW_STATE.DRAFT) {
    return {
      state: REVIEW_STATE.APPROVED,
      reviewed: true,
      reviewed_by: reviewer,
      reviewed_on: clause.reviewed_on || null,
    };
  }

  return {
    state: status === REVIEW_STATE.DRAFT ? REVIEW_STATE.DRAFT : REVIEW_STATE.UNMARKED,
    reviewed: false,
    reviewed_by: hasReviewer ? reviewer : null,
    reviewed_on: clause.reviewed_on || null,
  };
}

/**
 * Aggregate view over a set of clauses — the whole library at bootstrap, or
 * just the clauses that made it into one document.
 */
export function summariseProvenance(clauses = []) {
  const summary = {
    total: 0,
    reviewed: 0,
    awaiting_review: 0,
    unmarked: 0,
    unreviewed_clause_ids: [],
  };

  for (const clause of clauses) {
    if (!clause?.clause_id) continue;
    summary.total += 1;
    const { state, reviewed } = clauseReviewState(clause);
    if (reviewed) {
      summary.reviewed += 1;
      continue;
    }
    if (state === REVIEW_STATE.DRAFT) summary.awaiting_review += 1;
    else summary.unmarked += 1;
    summary.unreviewed_clause_ids.push(clause.clause_id);
  }

  summary.reviewed_fraction =
    summary.total === 0 ? null : Number((summary.reviewed / summary.total).toFixed(3));

  return summary;
}

export function strictReviewRequired() {
  return String(process.env.LEGALAID_REQUIRE_REVIEWED_CLAUSES || "") === "1";
}
