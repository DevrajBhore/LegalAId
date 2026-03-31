/**
 * deterministicFixer.js
 *
 * Applies hardcoded deterministic repairs before invoking the AI.
 */

import { injectProtection } from "../commercial/injector.js";

export function applyDeterministicFixes(draft, issues = []) {
  if (!draft || !Array.isArray(draft.clauses) || !issues.length) {
    return draft;
  }

  let nextDraft = draft;

  const protectionFixMap = {
    LIABILITY_CAP_MISSING: "LIABILITY_CAP",
    INDEMNITY_MISSING: "INDEMNITY",
    FORCE_MAJEURE_MISSING: "FORCE_MAJEURE",
    IP_OWNERSHIP_UNCLEAR: "IP_OWNERSHIP",
    LATE_PAYMENT_INTEREST_MISSING: "LATE_PAYMENT_INTEREST",
    TERMINATION_NOTICE_UNCLEAR: "TERMINATION_NOTICE",
  };

  for (const issue of issues) {
    const protectionType = protectionFixMap[issue?.rule_id];
    if (protectionType) {
      nextDraft = injectProtection(nextDraft, protectionType);
    }
  }

  const clauseScopedIssues = issues.filter(
    (issue) => issue.auto_fixable && issue.offending_clause_id
  );

  if (clauseScopedIssues.length === 0) {
    return nextDraft;
  }

  const modifiedClauses = nextDraft.clauses.map((clause) => {
    let newText = clause.text;

    clauseScopedIssues.forEach((issue) => {
      if (issue.offending_clause_id === clause.clause_id && !clause.locked) {
        switch (issue.rule_id) {
          case "USURIOUS_INTEREST_RATE":
            newText = newText.replace(/(?:4[0-9]|[5-9]\d|\d{3,})\s*%/g, "24%");
            break;

          case "ICA_S28_OUSTER_OF_COURTS":
            newText =
              "All disputes arising out of this agreement shall be submitted to binding arbitration governed by the Arbitration and Conciliation Act, 1996.";
            break;

          case "MSME_PAYMENT_DELAY":
            newText = newText.replace(
              /(?:6[0-9]|[7-9]\d|\d{3,})\s*(?:days)/gi,
              "45 days"
            );
            break;
        }
      }
    });

    return {
      ...clause,
      text: newText,
    };
  });

  return {
    ...nextDraft,
    clauses: modifiedClauses,
  };
}
