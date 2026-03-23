export function certify(validationResult) {

  const issues = validationResult.issues || [];

  const critical = issues.filter(i => i.severity === "CRITICAL").length;
  const high = issues.filter(i => i.severity === "HIGH").length;

  let risk = "LOW";

  if (critical > 0) risk = "HIGH";
  else if (high > 1) risk = "MODERATE";

  return {
    certified: critical === 0,
    risk_level: risk,
    issue_count: issues.length
  };
}