export function createRequirement({
    act,
    section,
    rule_type,
    threshold = null,
    unit = null,
    condition = null,
    severity = "HIGH"
  }) {
    return {
      act,
      section,
      rule_type,
      threshold,
      unit,
      condition,
      severity
    };
  }