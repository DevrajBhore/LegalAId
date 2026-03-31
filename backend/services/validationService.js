import { validate } from "../ire/runner.js";
import { commercialValidate } from "../ire/commercialValidator.js";
import { validateDraftConsistency } from "./draftConsistencyValidator.js";
import { validateDocumentHardening } from "./documentHardening.js";
import { validateClauseQuality } from "./clauseQualityNormalizer.js";

function resolveSourceVariables(draft, sourceVariables) {
  if (sourceVariables && typeof sourceVariables === "object") {
    return sourceVariables;
  }

  if (draft?.metadata?.source_variables) {
    return draft.metadata.source_variables;
  }

  if (draft?.source_variables) {
    return draft.source_variables;
  }

  return null;
}

function resolveIsUserEdit(draft, isUserEdit) {
  if (typeof isUserEdit === "boolean") {
    return isUserEdit;
  }

  return Boolean(
    draft?.metadata?.user_edited ||
      draft?.metadata?.ai_touched ||
      draft?.metadata?.review_state === "edited"
  );
}

export async function runDocumentValidation(
  draft,
  {
    mode = "final",
    documentType,
    extraIssues = [],
    sourceVariables,
    isUserEdit,
  } = {}
) {
  const resolvedDocumentType = documentType || draft?.document_type;
  const resolvedSourceVariables = resolveSourceVariables(draft, sourceVariables);
  const coreValidation = await validate(draft, {
    mode,
    isUserEdit: resolveIsUserEdit(draft, isUserEdit),
  });
  const commercialIssues = resolvedDocumentType
    ? commercialValidate(draft, resolvedDocumentType)
    : [];
  const consistencyIssues =
    resolvedDocumentType && resolvedSourceVariables
      ? validateDraftConsistency(draft, {
          documentType: resolvedDocumentType,
          variables: resolvedSourceVariables,
        })
      : [];
  const hardeningIssues = resolvedDocumentType
    ? validateDocumentHardening(draft, { documentType: resolvedDocumentType })
    : [];
  const clauseQualityIssues = validateClauseQuality(draft);

  return formatValidationResult({
    mode: coreValidation.mode || mode,
    issues: [
      ...(coreValidation.issues || []),
      ...commercialIssues,
      ...consistencyIssues,
      ...hardeningIssues,
      ...clauseQualityIssues,
      ...extraIssues,
    ],
    layers: {
      ...(coreValidation._layers || {}),
      commercial_issues: commercialIssues.length,
      consistency_issues: consistencyIssues.length,
      hardening_issues: hardeningIssues.length,
      clause_quality_issues: clauseQualityIssues.length,
      extra_issues: extraIssues.length,
    },
  });
}

export function formatValidationResult({
  mode = "final",
  issues = [],
  layers = {},
} = {}) {
  const dedupedIssues = collapseClauseIssueNoise(deduplicateIssues(issues));
  const notices = dedupedIssues.filter(isNoticeIssue);
  const actionableIssues = dedupedIssues.filter((issue) => !isNoticeIssue(issue));
  const blockingIssues = actionableIssues.filter(isBlockingIssue);
  const advisoryIssues = actionableIssues.filter(
    (issue) => !isBlockingIssue(issue)
  );
  
  let critical = 0, high = 0, medium = 0, low = 0;
  
  actionableIssues.forEach(issue => {
    if (issue.severity === "CRITICAL" || issue.blocks_generation) critical++;
    else if (issue.severity === "HIGH") high++;
    else if (issue.severity === "MEDIUM") medium++;
    else low++;
  });

  // Calculate Weighted Score
  let score = 100 - (critical * 40) - (high * 20) - (medium * 10) - (low * 2);
  score = Math.max(0, score);

  // Determine Certification Band
  let certification = "Certified";
  if (blockingIssues.length > 0) certification = "Blocked";
  else if (actionableIssues.length > 0) certification = "Review Required";

  let overallRisk = "LOW";
  if (blockingIssues.length > 0) overallRisk = "BLOCKED";
  else if (high > 0) overallRisk = "HIGH";
  else if (medium > 0) overallRisk = "MEDIUM";

  return {
    mode,
    score,
    certification,
    risk: overallRisk,
    overall_risk: overallRisk,
    risk_level: overallRisk,
    certified: actionableIssues.length === 0,
    blockingIssues,
    advisoryIssues,
    notices,
    noticeCount: notices.length,
    issues: blockingIssues,
    advisory_issues: advisoryIssues,
    issueCount: actionableIssues.length,
    issue_count: blockingIssues.length,
    openIssueCount: actionableIssues.length,
    open_issue_count: actionableIssues.length,
    layers: layers || {},
    issues_summary: {
      critical,
      high,
      medium,
      low,
      notices: notices.length,
      total: actionableIssues.length
    },
    summary: {
      blocking: blockingIssues.length,
      advisory: advisoryIssues.length,
      notices: notices.length,
      total: actionableIssues.length,
    },
  };
}

function isBlockingIssue(issue) {
  return issue?.blocks_generation === true || issue?.severity === "CRITICAL";
}

function impactsCertification(issue) {
  if (!issue) return false;
  if (isBlockingIssue(issue)) return true;
  if (issue.stamp_advisory === true) return false;
  if (issue.recommendation_only === true) return false;
  if (issue.manual_review_required === true) return true;
  return false;
}

function isNoticeIssue(issue) {
  return issue?.stamp_advisory === true || issue?.notice_only === true;
}

function deduplicateIssues(issues = []) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = [
      issue?.rule_id || "UNKNOWN_RULE",
      issue?.offending_clause_id || "",
      issue?.message || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    if (!issue?.rule_id) return true;
    return true;
  });
}

function getClauseIssuePriority(issue) {
  const ruleId = issue?.rule_id || "";

  if (ruleId === "CLAUSE_TAMPER_DETECTED") return 100;
  if (ruleId === "AI_INTEGRITY_VIOLATION") return 95;
  if (ruleId.startsWith("AI_SEMANTIC_")) return 90;
  if (ruleId === "AI_CHECK_UNAVAILABLE") return 80;
  if (ruleId.startsWith("INPUT_MISMATCH_")) return 70;
  if (ruleId.startsWith("CLAUSE_TEXT_")) return 30;

  return isBlockingIssue(issue) ? 60 : 40;
}

function collapseClauseIssueNoise(issues = []) {
  const issuesByClause = new Map();
  const passthrough = [];

  for (const issue of issues) {
    const clauseId = issue?.offending_clause_id;
    if (!clauseId) {
      passthrough.push(issue);
      continue;
    }

    if (!issuesByClause.has(clauseId)) {
      issuesByClause.set(clauseId, []);
    }

    issuesByClause.get(clauseId).push(issue);
  }

  const collapsed = [];

  for (const clauseIssues of issuesByClause.values()) {
    const sortedIssues = [...clauseIssues].sort(
      (left, right) => getClauseIssuePriority(right) - getClauseIssuePriority(left)
    );
    const primaryIssue = sortedIssues[0];
    const primaryPriority = getClauseIssuePriority(primaryIssue);

    if (primaryPriority >= 95) {
      collapsed.push(primaryIssue);
      continue;
    }

    collapsed.push(...sortedIssues);
  }

  return [...passthrough, ...collapsed];
}
