import { getPartyNamingLabels } from "./draftingPolicy.js";

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

  // Party labels as data, not baked into clause prose.
  //
  // Five property clauses are shared by RENTAL_AGREEMENT, COMMERCIAL_LEASE_AGREEMENT
  // and LEAVE_AND_LICENSE_AGREEMENT, which use different role names (Landlord/Tenant
  // vs Licensor/Licensee). That was handled by writing a dual label -- "the
  // Landlord/Licensor" -- into the text by hand, and a later bulk rename of
  // Licensor -> Landlord turned 24 of them into "the Landlord/Landlord". Exposing
  // the resolved labels as variables lets a shared clause say {{party_1_label}}
  // and read correctly in every document type that uses it.
  const namingLabels = getPartyNamingLabels(documentType);
  if (namingLabels) {
    if (!hasMeaningfulValue(derived.party_1_label)) derived.party_1_label = namingLabels.first;
    if (!hasMeaningfulValue(derived.party_2_label)) derived.party_2_label = namingLabels.second;
  }

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
      derived.jv_processes_personal_data = true;
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

  // Employment statutory-compliance triggers.
  const gender = normalizeText(variables.employee_gender).toLowerCase();
  if (gender) derived.is_female_employee = gender.includes("female");
  const headcount = normalizeText(variables.workplace_headcount).toLowerCase();
  if (headcount) derived.employer_headcount_ge_10 = headcount.includes("10 or more");

  // Employment seniority drives garden leave and exclusivity.
  const seniority = normalizeText(variables.seniority_level).toLowerCase();
  if (seniority) {
    derived.is_senior_employee =
      seniority.includes("senior") ||
      seniority.includes("leadership") ||
      seniority.includes("exec");
  }

  // Fixed-term employment (IR Code / IESO Rules 2018) — distinct term, non-renewal
  // treatment, and pro-rata gratuity. Derived from the termination-structure enum.
  const terminationType = normalizeText(variables.employment_termination_type).toLowerCase();
  if (terminationType) {
    derived.is_fixed_term = terminationType.includes("fixed");
  }

  // Factory vs shop/office workplace selects the stricter Factories Act, 1948
  // working-hours regime (variant slot working_hours_regime).
  const workplaceType = normalizeText(variables.workplace_type).toLowerCase();
  if (workplaceType) {
    derived.is_factory = workplaceType.includes("factory");
  }

  // ESOP / variable pay clause (Companies Act s.62; SEBI SBEB) — opt-in.
  const explicitEsop = normalizeBooleanLike(variables.has_esop_or_variable_pay);
  if (explicitEsop !== null) {
    derived.has_esop_or_variable_pay = explicitEsop;
  }

  // Secured vs unsecured loan: a security clause must only appear when there is
  // actual collateral. Explicit flag wins; otherwise infer from collateral.
  const explicitSecured = normalizeBooleanLike(
    variables.loan_is_secured ?? variables.is_secured
  );
  derived.is_secured =
    explicitSecured !== null
      ? explicitSecured
      : hasMeaningfulValue(variables.security_collateral);

  // Lender-type regulatory triggers (finance ruleset feature class).
  const lender = normalizeText(variables.lender_type).toLowerCase();
  if (lender) {
    derived.lender_is_nbfc = lender.includes("nbfc");
    derived.lender_is_regulated = lender.includes("bank") || lender.includes("nbfc");
    derived.is_cross_border = lender.includes("foreign");
  }

  // NOTE: loan `personal_guarantee_required` is intentionally NOT wired to an
  // intake question yet — the conditional clause it gates (GUARANTEE_OBLIGATION_001)
  // introduces a third "Guarantor" party that the loan's Lender/Borrower model
  // doesn't define, so enabling it produces a label-inconsistent draft. Needs a
  // dedicated loan-guarantee clause + a guarantor party (name/descriptor/signature)
  // before it can be exposed. Tracked in memory.

  // Joint venture: whether partners contribute equity / share capital (drives the
  // equity-contribution & shareholding clauses rather than a pure contractual JV).
  const explicitJvEquity = normalizeBooleanLike(variables.jv_involves_equity);
  if (explicitJvEquity !== null) {
    derived.jv_involves_equity = explicitJvEquity;
  }

  // Shareholders: company holds IP assets → adds an IP-ownership/assignment clause.
  const explicitCompanyIp = normalizeBooleanLike(variables.company_has_ip_assets);
  if (explicitCompanyIp !== null) {
    derived.company_has_ip_assets = explicitCompanyIp;
  }

  // Loan repayment structure: amortising (default) vs bullet/balloon.
  const repaymentStructure = normalizeText(variables.repayment_structure).toLowerCase();
  if (repaymentStructure) {
    derived.is_bullet_repayment =
      repaymentStructure.includes("bullet") || repaymentStructure.includes("balloon");
  }

  // Guarantee extent: unlimited (default, co-extensive) vs limited/capped.
  const guaranteeExtent = normalizeText(variables.guarantee_extent).toLowerCase();
  if (guaranteeExtent) {
    derived.is_limited_guarantee =
      (guaranteeExtent.includes("limit") && !guaranteeExtent.includes("unlimit")) ||
      guaranteeExtent.includes("cap");
  }

  // Software IP ownership: client owns (default) vs developer retains + licenses.
  // Reads the existing `ip_ownership` select.
  const ipOwnership = normalizeText(variables.ip_ownership).toLowerCase();
  if (ipOwnership) {
    derived.is_developer_ip =
      ipOwnership.includes("developer retains") || ipOwnership.includes("contractor retains");
  }

  // Shareholders governance posture: founder-controlled (default) vs investor-protective.
  const governanceControl = normalizeText(variables.governance_control).toLowerCase();
  if (governanceControl) {
    derived.is_investor_controlled =
      governanceControl.includes("investor") || governanceControl.includes("protective");
  }

  // MOU binding nature: non-binding (default) vs legally binding. Reads the
  // existing `binding_nature` intake field (Non-binding / Binding / Partly
  // binding); "Binding" or "Partly binding" select the binding-nature variant.
  const mouBinding = normalizeText(variables.binding_nature ?? variables.mou_binding).toLowerCase();
  const explicitBindingMou = normalizeBooleanLike(variables.is_binding_mou);
  if (mouBinding || explicitBindingMou !== null) {
    derived.is_binding_mou =
      explicitBindingMou !== null
        ? explicitBindingMou
        : mouBinding.includes("binding") && !mouBinding.startsWith("non");
  }

  // Lease/leave-and-license term (in months) → registration regime. A lease
  // exceeding one year is compulsorily registrable (Registration Act, 1908 s.17;
  // TPA s.107), so it gets the stronger mandatory-registration variant; a long
  // term also warrants force-majeure cover (previously a dead `long_term_lease`).
  // Sale/supply of goods: retention of title (Romalpa) — title stays with the
  // seller until full payment even though risk passes on delivery. Explicit, or
  // implied when the buyer pays on credit / deferred terms (the seller's security).
  const explicitRetention = normalizeBooleanLike(variables.retention_of_title);
  if (explicitRetention !== null) {
    derived.retention_of_title = explicitRetention;
  } else {
    const paymentTiming = normalizeText(
      variables.title_transfer ?? variables.payment_timing ?? variables.payment_terms
    ).toLowerCase();
    if (paymentTiming) {
      derived.retention_of_title =
        paymentTiming.includes("full payment") ||
        paymentTiming.includes("credit") ||
        paymentTiming.includes("deferred");
    }
  }

  // Buyer's right to inspect and reject non-conforming goods (SoGA s.41).
  const explicitInspection = normalizeBooleanLike(variables.include_inspection_rights);
  if (explicitInspection !== null) {
    derived.include_inspection_rights = explicitInspection;
  }

  // Distribution exclusivity: non-exclusive (default) / sole / exclusive. Reads
  // the existing `exclusivity` intake field (Exclusive / Non-Exclusive /
  // Semi-Exclusive ≈ sole); selects the appointment-clause variant and, for
  // sole/exclusive, adds a Competition Act, 2002 compliance clause. Back-compat:
  // legacy exclusive_territory == true.
  const distributionType = normalizeText(
    variables.exclusivity ?? variables.distribution_type
  ).toLowerCase();
  const legacyExclusive = normalizeBooleanLike(variables.exclusive_territory) === true;
  if (distributionType || legacyExclusive) {
    derived.is_exclusive_distribution =
      (distributionType.includes("exclusive") &&
        !distributionType.includes("non") &&
        !distributionType.includes("semi")) ||
      legacyExclusive;
    derived.is_sole_distribution =
      distributionType.includes("semi") || distributionType.includes("sole");
    derived.include_competition_compliance =
      derived.is_exclusive_distribution === true || derived.is_sole_distribution === true;
  }

  const leaseTermRaw = String(variables.lease_term ?? variables.license_term ?? "")
    .replace(/[\s,]/g, "")
    .match(/\d+(?:\.\d+)?/);
  if (leaseTermRaw) {
    const leaseMonths = Number(leaseTermRaw[0]);
    derived.is_registrable = leaseMonths >= 12;
    derived.long_term_lease = leaseMonths >= 12;
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
