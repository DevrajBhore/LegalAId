import fs from "fs";

import { validate } from "../ire/runner.js";
import { summariseProvenance } from "../../shared/clauseProvenance.js";
import { buildStatutoryChecklistNotices } from "./statutoryChecklist.js";
import { commercialValidate } from "../ire/commercialValidator.js";
import { validateDraftConsistency } from "./draftConsistencyValidator.js";
import { validateDocumentHardening } from "./documentHardening.js";
import { validateClauseQuality } from "./clauseQualityNormalizer.js";
import { validateDocumentQuality } from "./documentQualityControl.js";

const COVERAGE_FILE = new URL(
  "../../knowledge-base/metadata/verification_coverage.json",
  import.meta.url
);

let coverageCache = null;

function loadCoverageDisclosure() {
  if (coverageCache === null) {
    try {
      coverageCache = JSON.parse(fs.readFileSync(COVERAGE_FILE, "utf8"));
    } catch {
      coverageCache = { not_machine_verified: [], by_document_type: {} };
    }
  }
  return coverageCache;
}

// What this run actually checked, and what it could not. Reported alongside the
// issues so an empty issue list is never presented as "legally compliant" -- it
// means the checks that ran found nothing, which is a different statement.
function buildCoverage({ documentType, layersRun, layersSkipped, constraintOutcomes, clauses }) {
  const disclosure = loadCoverageDisclosure();
  const outcomes = Array.isArray(constraintOutcomes) ? constraintOutcomes : [];
  const counted = (name) => outcomes.filter((entry) => entry.outcome === name).length;

  // How much of THIS document has actually been through legal review. Reported
  // beside the issue list so an empty issue list is never read as "an advocate
  // has approved this".
  const provenance = summariseProvenance(clauses || []);

  return {
    layers_run: layersRun,
    layers_skipped: layersSkipped,
    clause_review: {
      total_clauses: provenance.total,
      advocate_reviewed: provenance.reviewed,
      awaiting_review: provenance.awaiting_review,
      unmarked: provenance.unmarked,
      reviewed_fraction: provenance.reviewed_fraction,
    },
    rules_evaluated: outcomes.length,
    rules_passed: counted("pass"),
    rules_failed: counted("fail"),
    rules_not_applicable: counted("not_applicable"),
    not_machine_verified: [
      ...(disclosure.not_machine_verified || []),
      ...((disclosure.by_document_type || {})[documentType] || []),
    ],
  };
}

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
  const layersRun = [];
  const layersSkipped = [];

  const coreValidation = await validate(draft, {
    mode,
    isUserEdit: resolveIsUserEdit(draft, isUserEdit),
  });
  layersRun.push("rule_engine");

  const runLayer = (name, condition, run, skipReason) => {
    if (!condition) {
      layersSkipped.push({ layer: name, reason: skipReason });
      return [];
    }
    layersRun.push(name);
    return run();
  };

  const commercialIssues = runLayer(
    "commercial",
    Boolean(resolvedDocumentType),
    () => commercialValidate(draft, resolvedDocumentType),
    "document type unknown"
  );
  const consistencyIssues = runLayer(
    "input_consistency",
    Boolean(resolvedDocumentType && resolvedSourceVariables),
    () =>
      validateDraftConsistency(draft, {
        documentType: resolvedDocumentType,
        variables: resolvedSourceVariables,
      }),
    resolvedDocumentType
      ? "the submitted form values were not available to compare against"
      : "document type unknown"
  );
  const hardeningIssues = runLayer(
    "hardening",
    Boolean(resolvedDocumentType),
    () => validateDocumentHardening(draft, { documentType: resolvedDocumentType }),
    "document type unknown"
  );
  layersRun.push("clause_quality");
  const clauseQualityIssues = validateClauseQuality(draft);
  const statutoryChecklistNotices = runLayer(
    "statutory_checklist",
    Boolean(resolvedDocumentType),
    () => buildStatutoryChecklistNotices(resolvedDocumentType),
    "document type unknown"
  );
  const finalQualityIssues = runLayer(
    "document_quality",
    Boolean(resolvedDocumentType),
    () =>
      validateDocumentQuality(draft, {
        documentType: resolvedDocumentType,
        variables: resolvedSourceVariables || {},
      }),
    "document type unknown"
  );

  return formatValidationResult({
    mode: coreValidation.mode || mode,
    issues: [
      ...(coreValidation.issues || []),
      ...commercialIssues,
      ...consistencyIssues,
      ...hardeningIssues,
      ...clauseQualityIssues,
      ...finalQualityIssues,
      ...statutoryChecklistNotices,
      ...extraIssues,
    ],
    layers: {
      ...(coreValidation._layers || {}),
      commercial_issues: commercialIssues.length,
      consistency_issues: consistencyIssues.length,
      hardening_issues: hardeningIssues.length,
      clause_quality_issues: clauseQualityIssues.length,
      final_quality_issues: finalQualityIssues.length,
      statutory_checklist_items: statutoryChecklistNotices[0]?.items?.length || 0,
      extra_issues: extraIssues.length,
    },
    coverage: buildCoverage({
      documentType: resolvedDocumentType,
      layersRun,
      layersSkipped,
      constraintOutcomes:
        coreValidation.constraint_outcomes || coreValidation._constraint_outcomes,
      clauses: draft?.clauses || [],
    }),
  });
}

export function formatValidationResult({
  mode = "final",
  issues = [],
  layers = {},
  coverage = null,
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

  // Weighted score, plus the arithmetic that produced it. "Why is this 92 and
  // not 100?" was unanswerable from the output: the score appeared as a bare
  // number with no way to see which findings cost what. Every deduction is now
  // itemised, so the number can be traced back to named issues.
  const SEVERITY_WEIGHTS = { CRITICAL: 40, HIGH: 20, MEDIUM: 10, LOW: 2 };

  const deductions = actionableIssues.map((issue) => {
    const severity =
      issue.severity === "CRITICAL" || issue.blocks_generation
        ? "CRITICAL"
        : ["HIGH", "MEDIUM", "LOW"].includes(issue.severity)
          ? issue.severity
          : "LOW";
    return {
      rule_id: issue.rule_id || "UNKNOWN_RULE",
      severity,
      points: SEVERITY_WEIGHTS[severity],
      message: issue.message || null,
      offending_clause_id: issue.offending_clause_id || null,
    };
  });

  const deducted = deductions.reduce((total, entry) => total + entry.points, 0);
  let score = Math.max(0, 100 - deducted);

  const scoreBreakdown = {
    starting_score: 100,
    deducted,
    final_score: score,
    weights: SEVERITY_WEIGHTS,
    // Notices (stamp duty, registration, statutory checklist) never cost points
    // -- they are information, not defects. Counted here so their absence from
    // the arithmetic is visible rather than mysterious.
    notices_excluded: notices.length,
    deductions: deductions.sort((left, right) => right.points - left.points),
  };

  // Verification band. Deliberately NOT the word "certified": passing means the
  // checks that ran found nothing, which is a narrower claim than compliance.
  // The `certified` field below is retained as the internal export gate.
  let certification = "No issues detected";
  if (blockingIssues.length > 0) certification = "Blocked";
  else if (actionableIssues.length > 0) certification = "Review Required";

  let overallRisk = "LOW";
  if (blockingIssues.length > 0) overallRisk = "BLOCKED";
  else if (high > 0) overallRisk = "HIGH";
  else if (medium > 0) overallRisk = "MEDIUM";

  return {
    mode,
    score,
    score_breakdown: scoreBreakdown,
    certification,
    risk: overallRisk,
    overall_risk: overallRisk,
    risk_level: overallRisk,
    // Internal gate flag consumed by the generation and export paths. It means
    // "every check that ran passed", not "this document is legally compliant".
    certified: actionableIssues.length === 0,
    checks_passed: actionableIssues.length === 0,
    coverage,
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
