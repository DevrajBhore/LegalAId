/**
 * documentWithdrawals.js
 *
 * Document types withdrawn from public generation because a shipped output was
 * found to be substantively wrong while the validator called it clean.
 *
 * Withdrawal is not deletion. The blueprint, clauses and fixtures stay, so the
 * defect can be studied and the type rebuilt. What changes:
 *
 *   - no new document of the type can be generated or started through any
 *     public route (listing, form config, interview, intake assistant, generate);
 *   - every validation of a document of the type, new or previously saved, is
 *     reported as REQUIRES REVIEW with no score, because a score the engine
 *     awarded to a known-defective output must not go on implying correctness.
 *
 * Documents users already generated are preserved and remain theirs to open,
 * edit and download. Only the assurance attached to them is withdrawn.
 *
 * Shared between backend and frontend; keep it dependency-free.
 */

export const WITHDRAWN_DOCUMENT_TYPES = Object.freeze({
  TERM_SHEET: Object.freeze({
    withdrawn_on: "2026-10-09",
    reason:
      "A generated term sheet contradicted itself on whether it binds, imposed obligations on people who are not parties, and left out core deal terms, while automated checks scored it 100 with no issues. It is being rebuilt.",
    user_message:
      "The Term Sheet is temporarily unavailable while it is rebuilt. Term sheets generated earlier were found to contain serious errors; have any you already hold reviewed by an advocate before relying on them.",
    regression_fixture: "tests/fixtures/termSheet.D4_44.defective.json",
    restore_requires: [
      "the rebuilt output passes the rendered-document coherence checks",
      "the frozen defective sample fails those checks for its named reasons",
      "advocate review of the rebuilt term sheet",
      "advocate review of the family for more than two principals (its founders are parties), recorded in knowledge-base/governance/cardinality-support.json",
    ],
  }),
});

export const WITHDRAWAL_RULE_ID = "DOCUMENT_TYPE_WITHDRAWN";

export function withdrawalFor(documentType) {
  if (!documentType) return null;
  return WITHDRAWN_DOCUMENT_TYPES[String(documentType)] || null;
}

export function isWithdrawn(documentType) {
  return withdrawalFor(documentType) !== null;
}

export function withdrawalIssue(documentType) {
  const w = withdrawalFor(documentType);
  if (!w) return null;
  return {
    rule_id: WITHDRAWAL_RULE_ID,
    severity: "HIGH",
    message: w.user_message,
    suggestion: "Have a qualified advocate review this document before you sign or rely on it.",
    manual_review_required: true,
    layer: "withdrawal",
  };
}

/**
 * Return a copy of a validation result with its assurance withdrawn.
 *
 * Idempotent, and a no-op for types that are not withdrawn. Works on full
 * validation results and on the stored summaries, and on null (a saved draft
 * that was never validated still gets the review requirement).
 */
export function withValidationAssuranceWithdrawn(validation, documentType) {
  const w = withdrawalFor(documentType);
  if (!w) return validation;
  if (validation && validation.assurance_withdrawn) return validation;

  const base = validation && typeof validation === "object" ? validation : {};
  const issue = withdrawalIssue(documentType);
  const advisory = Array.isArray(base.advisoryIssues) ? base.advisoryIssues : [];
  const hasIssue = advisory.some((i) => i?.rule_id === WITHDRAWAL_RULE_ID);
  const advisoryIssues = hasIssue ? advisory : [issue, ...advisory];
  const added = hasIssue ? 0 : 1;
  const bump = (n) => (typeof n === "number" ? n + added : added);

  return {
    ...base,
    score: null,
    certification: "Requires review",
    certified: false,
    checks_passed: false,
    assurance_withdrawn: {
      document_type: String(documentType),
      withdrawn_on: w.withdrawn_on,
      reason: w.reason,
      // Kept for audit only. It is the figure the engine gave before the type was
      // found defective, and it must not be displayed as a quality score.
      superseded_assessment:
        base.score != null || base.certification
          ? { score: base.score ?? null, certification: base.certification ?? null }
          : null,
    },
    advisoryIssues,
    advisory_issues: advisoryIssues,
    issueCount: bump(base.issueCount),
    openIssueCount: bump(base.openIssueCount),
    open_issue_count: bump(base.open_issue_count),
    summary: {
      ...(base.summary || {}),
      advisory: bump(base.summary?.advisory),
      total: bump(base.summary?.total),
    },
  };
}
