/**
 * clauseSuccession.js — D4.48
 *
 * When a blueprint replaces clauses, a document saved under the earlier version
 * lacks the new ones. The engine's blueprint check (IRE blueprintValidator.js)
 * reports every missing required clause as CRITICAL, and the export gate refuses
 * a CRITICAL finding. So the day the Privacy Policy blueprint replaced its
 * contract clauses with PRIVACY_SECURITY_SHARING_001 and
 * PRIVACY_LAW_AND_COMPLAINTS_001, every Privacy Policy a user had already saved,
 * shown "Automated checks passed", would have been refused at download: the
 * defect D4.47 fixed (a refusal for something the user did not do and could not
 * see), arriving by another route.
 *
 * The blueprint records the succession as knowledge:
 *
 *   "succession": {
 *     "<new clause id>": { "introduced_in": "D4.48", "replaces": ["<old id>", ...] }
 *   }
 *
 * A missing required clause is re-scoped here only when the document carries at
 * least one clause it replaced, which is the evidence that the document was
 * generated before the change, not that the engine has lost a clause. It then
 * asks for legal review, and says how to bring the document up to date. A
 * document that lacks both the new clause and every clause it replaced keeps
 * the CRITICAL finding: that is a real omission, whatever its age.
 */
import { getBlueprintForDocumentType, getClauseById } from "./clauseAssembler.js";

export const SUCCEEDED_CLAUSE_RULE_ID = "SUPERSEDED_TEMPLATE_CLAUSE";

function missingClauseId(issue) {
  if (issue?.rule_id !== "MISSING_REQUIRED_CLAUSE") return null;
  if (issue.missing_clause_id) return issue.missing_clause_id;
  return /requires clause (\S+) but it is missing/.exec(String(issue.message || ""))?.[1] || null;
}

const titleOf = (id) => getClauseById(id)?.title || id;

export function successionFor(documentType) {
  const succession = documentType ? getBlueprintForDocumentType(documentType)?.succession : null;
  return succession && typeof succession === "object" ? succession : null;
}

export function rescopeSucceededClauseFindings(issues = [], draft, documentType) {
  const succession = successionFor(documentType);
  if (!succession || !Array.isArray(issues)) return issues;
  const present = new Set((draft?.clauses || []).map((c) => c?.clause_id));
  return issues.map((issue) => {
    const id = missingClauseId(issue);
    const entry = id ? succession[id] : null;
    if (!entry) return issue;
    const predecessors = (entry.replaces || []).filter((old) => present.has(old));
    if (!predecessors.length) return issue;
    return {
      rule_id: SUCCEEDED_CLAUSE_RULE_ID,
      severity: "HIGH",
      release_outcome: "REQUIRES_LEGAL_REVIEW",
      manual_review_required: true,
      layer: "clause_succession",
      rescoped_from: issue.rule_id,
      missing_clause_id: id,
      offending_clause_id: predecessors[0],
      message: `This document was generated from an earlier version of its template. "${titleOf(id)}" now replaces ${predecessors.map((p) => `"${titleOf(p)}"`).join(" and ")}, which this document still carries.`,
      suggestion: "Generate the document again to use the current version, or have a lawyer review it before relying on it.",
    };
  });
}
