export function computeRisk(issues = []) {
    const hasCritical = issues.some(i => i.severity === "CRITICAL");
    const hasHigh = issues.some(i => i.severity === "HIGH");
    const hasMedium = issues.some(i => i.severity === "MEDIUM");
  
    if (hasCritical) return "BLOCKED";
    if (hasHigh) return "HIGH";
    if (hasMedium) return "MEDIUM";
    return "LOW";
  }