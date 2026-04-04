function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeBooleanLike(value) {
  if (typeof value === "boolean") return value;

  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;

  if (["true", "yes", "y", "1", "on", "applicable", "required"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "off", "na", "n/a", "none", "nil", "not applicable"].includes(normalized)) {
    return false;
  }

  return null;
}

export function isAffirmative(value) {
  return normalizeBooleanLike(value) === true;
}

export function isNegative(value) {
  return normalizeBooleanLike(value) === false;
}

export function hasMeaningfulValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (isNegative(normalized)) return false;
  return true;
}

function mentionsReporting(value = "") {
  return /\breport|reporting|dashboard|status update|milestone update\b/i.test(
    normalizeText(value)
  );
}

export function deriveGenerationControls(documentType, variables = {}) {
  const derived = { ...(variables || {}) };

  const hasRestrictionPeriod = hasMeaningfulValue(variables.non_compete_period);
  const explicitNonSolicit = normalizeBooleanLike(variables.include_non_solicit);
  const explicitNonCompete = normalizeBooleanLike(variables.include_non_compete);
  const explicitSla = normalizeBooleanLike(variables.include_sla);
  const explicitReporting = normalizeBooleanLike(
    variables.include_reporting ?? variables.reporting_required
  );
  const explicitPersonalData = normalizeBooleanLike(variables.processes_personal_data);
  const explicitExclusiveTerritory = normalizeBooleanLike(variables.exclusive_territory);

  if (explicitNonSolicit !== null) {
    derived.include_non_solicit = explicitNonSolicit;
  } else if (hasRestrictionPeriod) {
    derived.include_non_solicit = hasRestrictionPeriod;
  }

  if (explicitNonCompete !== null) {
    derived.include_non_compete = explicitNonCompete;
  } else if (explicitExclusiveTerritory === true) {
    derived.include_non_compete = explicitExclusiveTerritory === true;
  } else {
    derived.include_non_compete = false;
  }

  if (explicitSla !== null) {
    derived.include_sla = explicitSla;
  } else {
    derived.include_sla = hasMeaningfulValue(variables.service_levels);
  }

  if (explicitReporting !== null) {
    derived.include_reporting = explicitReporting;
    derived.reporting_required = explicitReporting;
  } else {
    const inferredReporting =
      mentionsReporting(variables.deliverables) ||
      mentionsReporting(variables.services_description) ||
      mentionsReporting(variables.consulting_services);
    derived.include_reporting = inferredReporting;
    derived.reporting_required = inferredReporting;
  }

  if (explicitPersonalData !== null) {
    derived.processes_personal_data = explicitPersonalData;
  }

  if (explicitExclusiveTerritory !== null) {
    derived.exclusive_territory = explicitExclusiveTerritory;
  }

  return derived;
}
