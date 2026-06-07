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
  const explicitIndemnity = normalizeBooleanLike(variables.include_indemnity_clause);
  const explicitWarranty = normalizeBooleanLike(variables.include_warranty_clause);
  const explicitNomenclature = normalizeBooleanLike(variables.include_nomenclature_clause);

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

  if (explicitIndemnity !== null) {
    derived.include_indemnity_clause = explicitIndemnity;
  } else {
    derived.include_indemnity_clause =
      hasMeaningfulValue(variables.indemnity_scope) ||
      hasMeaningfulValue(variables.ip_ownership) ||
      hasMeaningfulValue(variables.tax_responsibility);
  }

  if (explicitWarranty !== null) {
    derived.include_warranty_clause = explicitWarranty;
  } else {
    derived.include_warranty_clause =
      hasMeaningfulValue(variables.warranty_period) ||
      hasMeaningfulValue(variables.support_maintenance) ||
      hasMeaningfulValue(variables.acceptance_criteria);
  }

  if (explicitNomenclature !== null) {
    derived.include_nomenclature_clause = explicitNomenclature;
  } else {
    derived.include_nomenclature_clause =
      hasMeaningfulValue(variables.nomenclature_terms) ||
      hasMeaningfulValue(variables.acceptance_criteria);
  }

  derived.include_deliverables = hasMeaningfulValue(variables.deliverables);

  // ── Context & risk-profile flags ──────────────────────────────────────────
  // These map intake "context questions" onto the boolean / token flags that
  // blueprint variant slots and conditional clauses test via include_if.
  const sourceCode = normalizeBooleanLike(variables.involves_source_code);
  if (sourceCode !== null) derived.involves_source_code = sourceCode;

  const tradeSecrets = normalizeBooleanLike(variables.involves_trade_secrets);
  if (tradeSecrets !== null) derived.involves_trade_secrets = tradeSecrets;

  const personalData = normalizeBooleanLike(
    variables.involves_personal_data ?? variables.processes_personal_data
  );
  if (personalData !== null) {
    derived.involves_personal_data = personalData;
    derived.processes_personal_data =
      personalData || derived.processes_personal_data === true;
    // Bridge the shared question onto blueprint-specific personal-data flags so
    // a single intake answer drives data-processing clauses across all types.
    if (personalData) {
      derived.firm_processes_personal_data = true;
      derived.company_processes_personal_data = true;
    }
  }

  // Counterparty type is captured as a free/select token; expose stable boolean
  // flags so blueprint conditions don't depend on exact option wording.
  const counterparty = normalizeText(variables.counterparty_type).toLowerCase();
  if (counterparty) {
    derived.counterparty_is_investor = counterparty.includes("investor");
    derived.counterparty_is_vendor =
      counterparty.includes("vendor") || counterparty.includes("supplier");
    derived.counterparty_is_employee = counterparty.includes("employee");
    derived.counterparty_is_customer = counterparty.includes("customer");
  }

  // Employment seniority drives garden leave and exclusivity.
  const seniority = normalizeText(variables.seniority_level).toLowerCase();
  if (seniority) {
    derived.is_senior_employee =
      seniority.includes("senior") ||
      seniority.includes("leadership") ||
      seniority.includes("exec");
  }

  // Moonlighting / exclusivity restriction: explicit opt-in, or implied by a
  // senior role or sensitive IP / trade-secret exposure.
  const explicitMoonlighting = normalizeBooleanLike(
    variables.restrict_moonlighting
  );
  if (explicitMoonlighting !== null) {
    derived.restrict_moonlighting = explicitMoonlighting;
  } else {
    derived.restrict_moonlighting =
      derived.is_senior_employee === true ||
      derived.involves_source_code === true ||
      derived.involves_trade_secrets === true;
  }

  return derived;
}
