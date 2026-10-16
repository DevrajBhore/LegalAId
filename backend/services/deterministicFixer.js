/**
 * deterministicFixer.js
 *
 * Applies hardcoded deterministic repairs before invoking the AI.
 *
 * It may ADD a protection the user has not declined. It may not change any text
 * the engine has rendered (D4.46).
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

  // D4.46. This file used to rewrite clause text to "fix" three findings:
  // USURIOUS_INTEREST_RATE replaced any rate of 40% or more with "24%",
  // MSME_PAYMENT_DELAY replaced any period of 60 days or more with "45 days", and
  // ICA_S28_OUSTER_OF_COURTS replaced the clause with an arbitration clause. Each
  // changed a term the user had agreed, without asking, and the document then
  // shipped. A finding about a value is for the user to act on; the repair never
  // changes it (backend/services/mutationGuard.js enforces that on every path).
  return nextDraft;
}
