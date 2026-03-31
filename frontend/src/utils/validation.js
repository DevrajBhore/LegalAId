function highestAdvisoryRisk(advisoryIssues = []) {
  if (advisoryIssues.some((issue) => issue?.severity === "HIGH")) {
    return "HIGH";
  }

  if (advisoryIssues.some((issue) => issue?.severity === "MEDIUM")) {
    return "MEDIUM";
  }

  if (advisoryIssues.length > 0) {
    return "LOW";
  }

  return "LOW";
}

export function normalizeValidation(validation) {
  if (!validation) {
    return {
      raw: null,
      blockingIssues: [],
      advisoryIssues: [],
      blockingCount: 0,
      advisoryCount: 0,
      totalCount: 0,
      riskLevel: "UNKNOWN",
      certified: false,
      reviewStatus: "UNKNOWN",
      legalRisk: null,
      commercialRisk: null,
      isGenerated: false,
    };
  }

  const blockingIssues = validation.issues || validation.blockingIssues || [];
  const advisoryIssues =
    validation.advisory_issues || validation.advisoryIssues || [];

  const blockingCount =
    validation.summary?.blocking ??
    validation.issue_count ??
    validation.blockingIssueCount ??
    blockingIssues.length;

  const advisoryCount =
    validation.summary?.advisory ??
    validation.advisory_count ??
    validation.advisoryIssueCount ??
    advisoryIssues.length;

  const totalCount =
    validation.summary?.total ??
    validation.open_issue_count ??
    validation.openIssueCount ??
    blockingCount + advisoryCount;

  const rawRisk =
    validation.overall_risk || validation.risk_level || validation.risk || "LOW";

  const riskLevel =
    blockingCount > 0
      ? "BLOCKED"
      : rawRisk === "BLOCKED"
        ? highestAdvisoryRisk(advisoryIssues)
        : rawRisk;

  const certified =
    typeof validation.certified === "boolean"
      ? validation.certified
      : totalCount === 0;
  const reviewStatus =
    blockingCount > 0
      ? "BLOCKED"
      : certified
        ? "CERTIFIED"
        : totalCount > 0
          ? "IN_REVIEW"
          : "UNKNOWN";

  return {
    raw: validation,
    blockingIssues,
    advisoryIssues,
    blockingCount,
    advisoryCount,
    totalCount,
    riskLevel,
    certified,
    reviewStatus,
    legalRisk: validation.legal_risk || validation.legalRisk || null,
    commercialRisk:
      validation.commercial_risk || validation.commercialRisk || null,
    isGenerated: Boolean(validation.is_generated || validation.isGenerated),
  };
}
