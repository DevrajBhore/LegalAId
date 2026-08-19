/**
 * statutoryChecklist.js
 *
 * Surfaces the `mandatory_legal_checks` recorded on each blueprint.
 *
 * Eighteen blueprints carry these -- roughly eighty items covering TDS, GST,
 * FEMA, CCI, BIS, registration and statutory caps. A grep across backend/ and
 * IRE/ returned zero references: they were documentation that read as
 * enforcement. Each item now has one of two honest dispositions:
 *
 *   - mechanically checkable  ->  a constraint rule that runs
 *   - needs a human           ->  surfaced here as a declared checklist
 *
 * Nothing stays as inert prose claiming to be a check. These are notices: they
 * are matters for the drafter and the supervising advocate to confirm, not
 * defects in the generated text, so they must never block generation.
 */

import { getBlueprintForDocumentType } from "./clauseAssembler.js";

export function buildStatutoryChecklistNotices(documentType) {
  if (!documentType) return [];

  let blueprint = null;
  try {
    blueprint = getBlueprintForDocumentType(documentType);
  } catch {
    return [];
  }

  const checks = (blueprint?.mandatory_legal_checks || []).filter(
    (entry) => typeof entry === "string" && entry.trim()
  );
  if (!checks.length) return [];

  return [
    {
      rule_id: "STATUTORY_CHECKLIST",
      severity: "LOW",
      blocks_generation: false,
      notice_only: true,
      message:
        `${checks.length} statutory matter(s) apply to a ${String(documentType)
          .replace(/_/g, " ")
          .toLowerCase()} and are not verified automatically. Confirm each with your adviser.`,
      items: checks,
      suggestion:
        "Work through each item against the facts of this transaction before the instrument is executed.",
    },
  ];
}
