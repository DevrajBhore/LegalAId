import { getPartyNamingLabels } from "./draftingPolicy.js";
import { riskProfileControls } from "./riskProfile.js";

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

const REGISTRATION_THRESHOLD_MONTHS = 12;

// A seat of arbitration is conventionally a place, not a state. Indian postal
// addresses in this system read "1 First Road, Mumbai, Maharashtra 400001", so
// the city is the segment immediately before the one carrying the state name or
// the PIN. Returns "" when the address cannot be read confidently, and the
// caller then falls back to the state.
function cityFromAddress(address = "", state = "") {
  const segments = normalizeText(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length < 2) return "";

  const stateName = normalizeText(state).toLowerCase();
  const isStateOrPin = (part) => {
    const lowered = part.toLowerCase();
    if (stateName && lowered.includes(stateName)) return true;
    return /^\d{6}$/.test(part.replace(/\s/g, ""));
  };

  for (let index = segments.length - 1; index >= 1; index -= 1) {
    if (!isStateOrPin(segments[index])) continue;
    const candidate = segments[index - 1];
    // A street line ("1 First Road") is not a city; a city segment is words only.
    if (/^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(candidate)) return candidate;
  }

  return "";
}

export function deriveGenerationControls(documentType, variables = {}) {
  // The commercial magnitude of the deal, derived from the user's own figures,
  // exposed as ordinary variables so blueprint conditions and clause builders
  // can respond to it. Explicit answers still win: these are only defaults for
  // dimensions the intake never asked about.
  const derived = {
    ...riskProfileControls(documentType, variables),
    ...(variables || {}),
  };

  // Party labels as data, not baked into clause prose.
  //
  // Five property clauses are shared by RENTAL_AGREEMENT, COMMERCIAL_LEASE_AGREEMENT
  // and LEAVE_AND_LICENSE_AGREEMENT, which use different role names (Landlord/Tenant
  // vs Licensor/Licensee). That was handled by writing a dual label -- "the
  // Landlord/Licensor" -- into the text by hand, and a later bulk rename of
  // Licensor -> Landlord turned 24 of them into "the Landlord/Landlord". Exposing
  // the resolved labels as variables lets a shared clause say {{party_1_label}}
  // and read correctly in every document type that uses it.
  // The seat of arbitration is no longer asked for separately: the jurisdiction
  // the user already gave supplies it. The seat is NOT the same thing as the
  // governing law -- under the Arbitration and Conciliation Act, 1996 the seat
  // fixes which court exercises supervisory jurisdiction over the arbitration --
  // so the clause must still state one. It is derived here rather than dropped.
  if (!hasMeaningfulValue(derived.arbitration_city)) {
    const seat =
      variables.execution_city ||
      cityFromAddress(variables.party_1_address, variables.operating_state) ||
      variables.governing_law_state ||
      variables.operating_state;
    if (hasMeaningfulValue(seat)) derived.arbitration_city = normalizeText(seat);
  }

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

  // Fixed-term employment (Industrial Relations Code, 2020 s.2(o)) — distinct term,
  // non-renewal treatment, and gratuity on one year rather than five. The IESO
  // Rules 2018 that previously carried this were repealed on 21 November 2025.
  // Derived from the termination-structure enum.
  const terminationType = normalizeText(variables.employment_termination_type).toLowerCase();
  if (terminationType) {
    derived.is_fixed_term = terminationType.includes("fixed");
  }

  // Factory vs shop/office workplace selects the stricter working-hours regime in
  // the OSH Code, 2020 ss.25-27 (variant slot working_hours_regime). The Factories
  // Act, 1948 that previously governed this was repealed on 21 November 2025.
  const workplaceType = normalizeText(variables.workplace_type).toLowerCase();
  if (workplaceType) {
    derived.is_factory = workplaceType.includes("factory");
  }

  // How a services engagement is billed. The three payment clauses state the
  // actual mechanics — retainer in advance, milestone on acceptance, fixed fee —
  // where the generic clause only points at a fee schedule, and the mechanics are
  // what a payment dispute actually turns on.
  const engagement = normalizeText(variables.engagement_model).toLowerCase();
  if (engagement) {
    derived.is_retainer_engagement = engagement.includes("retainer");
    derived.is_milestone_engagement = engagement.includes("project");
    derived.is_fixed_fee_engagement =
      engagement.includes("fixed") || engagement.includes("advisory");
  }

  // ── Conditions the blueprints ask for but nothing was answering ──────────
  //
  // Each of these gates a clause that exists and is good, and each was silently
  // false forever, so the clause could never appear. None of them needs a new
  // question: the answer is already sitting in something the user typed.

  // NOT derived: `personal_guarantee_required` in LOAN_AGREEMENT. Setting it
  // pulls in GUARANTEE_OBLIGATION_001, which is the guarantor's own covenant —
  // and a two-party loan has no guarantor to give it. The consistency validator
  // rightly refuses the draft ("uses the conflicting role label Guarantor").
  // Making this work means adding a third participant and guarantor fields to
  // the loan intake, not flipping a flag; until then the correct answer is a
  // separate Guarantee Agreement, which the product already generates.

  // A "rental agreement" let for an office, shop or godown is a commercial
  // letting, and pulls the maintenance and permitted-use clauses written for
  // one. The residential form is the default.
  const use = normalizeText(variables.permitted_use).toLowerCase();
  if (use) {
    derived.is_commercial_lease =
      /\boffice|\bshop\b|\bretail\b|\bcommercial\b|\bbusiness\b|\bwarehouse|\bgodown|\bclinic|\brestaurant|\bcafe|\bstudio\b|\bshowroom/.test(use);
  }

  // A letting that says nothing about subletting has a hole in it, whichever way
  // the parties want it resolved, so the clause is included and states the
  // position rather than leaving it unaddressed.
  if (/RENTAL|LEASE|LICENSE|LICENCE/i.test(String(documentType || ""))) {
    derived.subletting_addressed = true;
  }

  // Goods sold or supplied need a stated returns position and a shortage
  // mechanism; both clauses exist and neither was reachable.
  const goods = normalizeText(
    variables.goods_description || variables.product_description
  );
  if (goods) {
    derived.return_policy_required = true;
    derived.shortage_risk = true;
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

  // The registration ruleset (knowledge-base/rules/registration.rules.json) reads
  // the term from any of five intake fields, but this derivation only looked at
  // two of them -- so a rental agreement, whose intake field is `occupancy_term`,
  // never set is_registrable and the blueprint condition that swaps in the
  // mandatory-registration clause could never fire.
  const TERM_FIELDS = [
    "lease_term",
    "occupancy_term",
    "license_term",
    "rental_term",
    "agreement_term",
  ];

  for (const field of TERM_FIELDS) {
    const match = String(variables[field] ?? "")
      .replace(/[\s,]/g, "")
      .match(/\d+(?:\.\d+)?/);
    if (!match) continue;

    const raw = Number(match[0]);
    // "2 years" and "24 months" are the same term; normalise to months so the
    // 12-month threshold in Registration Act s.17(1)(d) is applied to both.
    const months = /year/i.test(String(variables[field])) ? raw * 12 : raw;

    derived.lease_term_months = months;
    // Threshold kept identical to knowledge-base/rules/registration.rules.json
    // (threshold_months: 12, at-or-above). NOTE for the supervising advocate:
    // Registration Act s.17(1)(d) speaks of a term "exceeding one year", so a
    // lease of exactly 12 months is arguably outside it. The rule file and this
    // derivation both currently treat exactly 12 months as registrable. If that
    // is wrong, change BOTH -- they must not diverge.
    derived.is_registrable = months >= REGISTRATION_THRESHOLD_MONTHS;
    derived.long_term_lease = months >= REGISTRATION_THRESHOLD_MONTHS;
    break;
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
