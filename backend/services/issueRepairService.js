import { callAIFix } from "../ai/aiClient.js";
import {
  normalizeClauseText,
  normalizeSingleClause,
} from "./clauseQualityNormalizer.js";
import { runDocumentValidation } from "./validationService.js";

const DETERMINISTIC_REPAIR_RULES = new Set([
  "CLAUSE_TAMPER_DETECTED",
  "AI_INTEGRITY_VIOLATION",
  "CLAUSE_TEXT_LOWERCASE_START",
  "CLAUSE_TEXT_REPEATED_PUNCTUATION",
]);

function cloneDraft(draft) {
  return JSON.parse(JSON.stringify(draft));
}

function getOpenIssueCount(validation) {
  return validation?.summary?.total ?? validation?.issueCount ?? 0;
}

function getSourceVariables(draft) {
  return draft?.metadata?.source_variables || draft?.source_variables || null;
}

function updateClause(draft, clauseId, updater) {
  if (!draft?.clauses?.length || !clauseId) {
    return draft;
  }

  let changed = false;
  const clauses = draft.clauses.map((clause) => {
    if (clause.clause_id !== clauseId) {
      return clause;
    }

    changed = true;
    return updater(clause);
  });

  if (!changed) {
    return draft;
  }

  return {
    ...draft,
    clauses,
  };
}

function buildEditsFromDrafts(previousDraft, nextDraft) {
  const previousMap = new Map(
    (previousDraft?.clauses || []).map((clause) => [clause.clause_id, clause])
  );

  return (nextDraft?.clauses || [])
    .filter((clause) => {
      const previous = previousMap.get(clause.clause_id);
      return previous && previous.text !== clause.text;
    })
    .map((clause) => ({
      clause_id: clause.clause_id,
      new_text: clause.text,
    }));
}

function buildIssueMatcher(issue) {
  return (candidateIssue) =>
    candidateIssue?.rule_id === issue?.rule_id &&
    (candidateIssue?.offending_clause_id || null) ===
      (issue?.offending_clause_id || null);
}

function applyBaselineRestore(draft, issue) {
  const clauseId = issue?.offending_clause_id;
  const baseline = clauseId
    ? draft?.metadata?.baseline_clause_map?.[clauseId]
    : null;

  if (!clauseId || !baseline?.text) {
    return null;
  }

  const restored = updateClause(draft, clauseId, (clause) => ({
    ...clause,
    title: baseline.title || clause.title,
    category: baseline.category || clause.category,
    text: baseline.text,
  }));

  return restored === draft ? null : restored;
}

function applyClauseNormalization(draft, issue) {
  const clauseId = issue?.offending_clause_id;
  if (!clauseId) return null;

  const normalized = updateClause(draft, clauseId, (clause) =>
    normalizeSingleClause(clause)
  );

  return normalized === draft ? null : normalized;
}

function applyStructuralNormalization(draft, issue) {
  if (issue?.rule_id !== "OVERLAPPING_CLAUSE_SECTIONS") {
    return null;
  }

  const normalized = normalizeClauseText(draft);
  return normalized === draft ? null : normalized;
}

function applyDeterministicIssueRepair(draft, issue) {
  if (!issue) return null;

  if (DETERMINISTIC_REPAIR_RULES.has(issue.rule_id)) {
    return applyBaselineRestore(draft, issue) || applyClauseNormalization(draft, issue);
  }

  return applyStructuralNormalization(draft, issue);
}

function applyAIEdits(draft, edits = []) {
  if (!edits.length) return draft;

  const editMap = new Map(
    edits
      .filter((edit) => edit?.clause_id && typeof edit?.new_text === "string")
      .map((edit) => [edit.clause_id, edit.new_text])
  );

  if (!editMap.size) {
    return draft;
  }

  return {
    ...draft,
    clauses: (draft?.clauses || []).map((clause) =>
      editMap.has(clause.clause_id)
        ? {
            ...clause,
            text: editMap.get(clause.clause_id),
          }
        : clause
    ),
  };
}

async function validateRepairCandidate(draft, issue) {
  const validation = await runDocumentValidation(draft, {
    mode: "final",
    documentType: draft?.document_type,
    sourceVariables: getSourceVariables(draft),
    isUserEdit: true,
  });

  const matcher = buildIssueMatcher(issue);
  const remainingIssues = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ];

  return {
    validation,
    targetedIssueResolved: !remainingIssues.some(matcher),
  };
}

function attachRepairMetadata(draft, { aiTouched = false } = {}) {
  return {
    ...draft,
    metadata: {
      ...(draft?.metadata || {}),
      user_edited: true,
      review_state: "edited",
      ai_touched: aiTouched === true || draft?.metadata?.ai_touched === true,
    },
  };
}

export async function repairDocumentIssue(draft, issue) {
  const workingDraft = attachRepairMetadata(cloneDraft(draft));
  const originalValidation = await runDocumentValidation(workingDraft, {
    mode: "final",
    documentType: workingDraft?.document_type,
    sourceVariables: getSourceVariables(workingDraft),
    isUserEdit: true,
  });
  const originalIssueCount = getOpenIssueCount(originalValidation);

  const deterministicDraft = applyDeterministicIssueRepair(workingDraft, issue);
  if (deterministicDraft) {
    const candidateDraft = attachRepairMetadata(deterministicDraft);
    const result = await validateRepairCandidate(candidateDraft, issue);
    const candidateIssueCount = getOpenIssueCount(result.validation);

    if (result.targetedIssueResolved && candidateIssueCount <= originalIssueCount) {
      return {
        fixed: true,
        source: "deterministic",
        explanation:
          issue?.rule_id === "CLAUSE_TAMPER_DETECTED" ||
          issue?.rule_id === "AI_INTEGRITY_VIOLATION"
            ? "Restored the affected clause to the last validated wording."
            : "Normalized the affected clause and revalidated the draft.",
        edits: buildEditsFromDrafts(workingDraft, candidateDraft),
        draft: candidateDraft,
        validation: result.validation,
      };
    }
  }

  const aiResult = await callAIFix(workingDraft, issue);
  if (aiResult?.edits?.length) {
    const aiDraft = attachRepairMetadata(
      applyAIEdits(workingDraft, aiResult.edits),
      { aiTouched: true }
    );
    const result = await validateRepairCandidate(aiDraft, issue);
    const candidateIssueCount = getOpenIssueCount(result.validation);

    if (result.targetedIssueResolved && candidateIssueCount <= originalIssueCount) {
      return {
        fixed: true,
        source: "ai",
        explanation:
          aiResult.explanation ||
          "Applied a focused clause repair and confirmed it against final validation.",
        edits: buildEditsFromDrafts(workingDraft, aiDraft),
        draft: aiDraft,
        validation: result.validation,
      };
    }
  }

  return {
    fixed: false,
    source: "none",
    explanation:
      "No reliable automatic fix could be validated for this issue. Please edit the clause manually or restore it to the last validated wording.",
    edits: [],
    draft: workingDraft,
    validation: originalValidation,
  };
}
