import { getPartyNamingLabels } from "./draftingPolicy.js";
import { resolveRoster } from "./partyRoster.js";
import { resolveAllocations, ATTRIBUTION, ARITY, BASIS } from "./economicAllocation.js";
import { amountToIndianWords } from "./formattingEngine.js";
import { riskProfileControls } from "./riskProfile.js";
import { deadlineVariables } from "./statutoryDeadlines.js";

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

// ── Tri-state positions ─────────────────────────────────────────────────────
// A flag is not a boolean. It records where the user stands on a mechanism, and
// there are three places they can stand:
//
//   TRUE     the user has affirmatively selected or required this
//   FALSE    the user has affirmatively rejected this
//   UNKNOWN  the user has not expressed a position
//
// UNKNOWN is not FALSE. Silence is not rejection, and the drafting engine is
// free to conclude that a mechanism is legally appropriate even though nobody
// asked for it. Reading UNKNOWN as FALSE converts the absence of information
// into an affirmative contractual position, which is the defect this replaces:
// a Quick Form draft used to arrive at the generator as thirteen deliberate
// refusals by a user who had never been asked a single one of the questions.
//
// REQUIRED_BY_LAW is deliberately NOT one of these states. Whether a provision
// may lawfully be omitted is a property of the document and the governing
// statute, not of the user's preference, so it is decided by the constraint
// engine over the position rather than stored alongside it. A user may reject a
// mechanism the law still requires; both facts have to remain visible.
export const POSITION = { TRUE: "TRUE", FALSE: "FALSE", UNKNOWN: "UNKNOWN" };

export function positionOf(value) {
  const normalized = normalizeBooleanLike(value);
  if (normalized === true) return POSITION.TRUE;
  if (normalized === false) return POSITION.FALSE;
  return POSITION.UNKNOWN;
}

// The rule that fixes the whole class at once.
//
// A position the user STATED is authoritative in both directions: yes is yes and
// no is no. An INFERENCE drawn from the rest of the intake can only ever
// establish a position, never reject one. If the facts point at the mechanism
// -- a warranty period was given, the scope mentions reporting -- that is good
// evidence the user wants it. If the facts are silent, the only thing that has
// been established is that nobody asked, and the answer is UNKNOWN.
//
// Every call site below used to end `: false`, which is what manufactured the
// refusals.
function statedOrInferred(stated, inferred) {
  if (stated !== null && stated !== undefined) return stated;
  return inferred ? true : null;
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

  // Amount in words, derived rather than typed.
  //
  // The intake asks separately for an amount and for that amount IN WORDS, and
  // a notice under Section 138 of the Negotiable Instruments Act turns on the
  // sum demanded. Asking a person to retype a figure as words is asking them to
  // introduce a discrepancy the machine can neither see nor defend -- and a
  // cheque notice whose numeral and words disagree is exactly the kind of defect
  // an opposing advocate looks for. amountToIndianWords already exists; the
  // words are now computed from the figure unless the user overrode them.
  for (const [amountField, wordsField] of [
    ["settlement_amount", "settlement_amount_words"],
    ["cheque_amount", "cheque_amount_words"],
  ]) {
    const words = derived[wordsField];
    const looksTyped = hasMeaningfulValue(words) && /[a-z]{3}/i.test(String(words));
    if (looksTyped) continue;

    const numeric = Number(String(derived[amountField] ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      derived[wordsField] = `Rupees ${amountToIndianWords(Math.round(numeric))}`;
    }
  }

  // Audit, information, escalation and additional-protection terms were
  // collected on seven document types and rendered on none of them unless the
  // document happened to carry a reporting or JV-governance clause.
  derived.include_governance_protections = statedOrInferred(
    null,
    ["audit_rights", "information_rights", "escalation_mechanism", "additional_protection_clauses"]
      .some((field) => hasMeaningfulValue(variables[field]))
  );

  // What shape of service the terms govern. All four were previously invisible
  // to the document, which is why a free read-only site and a paid marketplace
  // received identical terms.
  // Unanswered defaults to TRUE, and the asymmetry is the reason. A service that
  // does host user content and has no licence to display it has no right to show
  // what its own users post -- a substantive exposure. A read-only site that
  // carries the clause anyway has a paragraph it does not need, which is
  // cosmetic. The golden corpus caught this: the marketplace fixture does not
  // answer the question, and defaulting to false silently stripped its
  // user-content licence.
  const ugc = normalizeBooleanLike(variables.hosts_user_content);
  derived.hosts_user_content = ugc === null ? true : ugc;

  // deriveGenerationControls runs TWICE on the same object -- once in
  // prepareGenerationInput and again inside assembleDocument -- so every
  // derivation here has to be idempotent. The first version read
  // `normalizeText(value).startsWith("yes")`, which on the second pass saw the
  // boolean `true` it had just written, stringified it to "true", and flipped
  // the flag back to false. The fees clause never appeared for a paid service
  // and the account provisions never appeared for a service with accounts.
  // Anything already reduced to a boolean is left alone.
  const asFlag = (value, test) => {
    if (typeof value === "boolean") return value;
    const text = normalizeText(value).toLowerCase();
    return text ? test(text) : null;
  };

  const account = asFlag(variables.requires_account, (t) => t.startsWith("yes"));
  if (account !== null) derived.requires_account = account;

  const paid = asFlag(variables.is_paid_service, (t) => t.startsWith("yes"));
  if (paid !== null) derived.is_paid_service = paid;
  const subscription = asFlag(variables.is_paid_service, (t) => t.includes("subscription"));
  if (subscription !== null && typeof variables.is_paid_service !== "boolean") {
    derived.is_subscription = subscription;
  }

  const minors = asFlag(variables.minimum_age, (t) => t.includes("under 18"));
  if (minors !== null) derived.minors_permitted = minors;

  // Which assignment clauses an IP deed carries. Copyright, patents and trade
  // marks assign under different statutes and different formalities, and the
  // blueprint previously included all three in every deed.
  const ipTypes = typeof variables.ip_types === "string"
    ? normalizeText(variables.ip_types).toLowerCase()
    : "";
  if (ipTypes) {
    const mixed = ipTypes.includes("mix");
    derived.assigns_copyright = mixed || ipTypes.includes("copyright");
    derived.assigns_patents = mixed || ipTypes.includes("patent");
    derived.assigns_trademarks = mixed || ipTypes.includes("trade mark") || ipTypes.includes("trademark");
  } else {
    // No answer: assign copyright only. It is the commonest case and the one
    // the assigned-work description almost always describes, and drafting a
    // trade mark assignment nobody asked for is worse than omitting one.
    derived.assigns_copyright = true;
    derived.assigns_patents = false;
    derived.assigns_trademarks = false;
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

  derived.include_non_compete = statedOrInferred(
    explicitNonCompete,
    explicitExclusiveTerritory === true
  );

  derived.include_sla = statedOrInferred(
    explicitSla,
    hasMeaningfulValue(variables.service_levels)
  );

  const reportingPosition = statedOrInferred(
    explicitReporting,
    mentionsReporting(variables.deliverables) ||
      mentionsReporting(variables.services_description) ||
      mentionsReporting(variables.consulting_services)
  );
  derived.include_reporting = reportingPosition;
  derived.reporting_required = reportingPosition;

  if (explicitPersonalData !== null) {
    derived.processes_personal_data = explicitPersonalData;
  }

  if (explicitExclusiveTerritory !== null) {
    derived.exclusive_territory = explicitExclusiveTerritory;
  }

  derived.include_indemnity_clause = statedOrInferred(
    explicitIndemnity,
    hasMeaningfulValue(variables.indemnity_scope) ||
      hasMeaningfulValue(variables.ip_ownership) ||
      hasMeaningfulValue(variables.tax_responsibility)
  );

  derived.include_warranty_clause = statedOrInferred(
    explicitWarranty,
    hasMeaningfulValue(variables.warranty_period) ||
      hasMeaningfulValue(variables.support_maintenance) ||
      hasMeaningfulValue(variables.acceptance_criteria)
  );

  derived.include_nomenclature_clause = statedOrInferred(
    explicitNomenclature,
    hasMeaningfulValue(variables.nomenclature_terms) ||
      hasMeaningfulValue(variables.acceptance_criteria)
  );

  derived.include_deliverables = statedOrInferred(
    null,
    hasMeaningfulValue(variables.deliverables)
  );

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
  if (headcount) {
    derived.employer_headcount_ge_10 = headcount.includes("10 or more");
    // Whether the ESTABLISHMENT is covered, which is a different question from
    // who the employee is. MATERNITY_ENTITLEMENT used to be gated on
    // is_female_employee while its own statement said "where the establishment
    // is covered" — it named one boundary and implemented another.
    //
    // Derived from the same headcount answer the user already gave, so nobody
    // is asked twice. VERIFY: that the Maternity Benefit Act's coverage
    // threshold is the same ten this field expresses; it is being reused
    // because it is the closest established fact, not because the two
    // thresholds have been checked against each other.
    derived.establishment_is_covered = headcount.includes("10 or more");
  }

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

  // Secured vs unsecured: DECLARED, never inferred from the collateral text.
  //
  // The inference read `hasMeaningfulValue(security_collateral)` — not empty and
  // not one of six bare tokens. Nine plain-English ways of writing "there is
  // none" therefore produced a SECURED loan, including "Unsecured", which the
  // field's own help text told the user to write. An explicit negative became an
  // affirmative contractual position, and the security and SARFAESI clauses
  // followed from it.
  //
  // A description is not a position. Where the question is unanswered this stays
  // UNKNOWN and the gate does not fire — silence selects nothing, which is the
  // rule everywhere else in this file.
  derived.is_secured = normalizeBooleanLike(
    variables.loan_is_secured ?? variables.is_secured
  );

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

  // Statutory deadlines, computed rather than typed. These go on TOP of the
  // user's own values, not underneath them: they are arithmetic on dates the
  // user gave, and a user who overrides the fifteen-day period in a Section 138
  // notice has not customised the notice, they have destroyed it.
  Object.assign(derived, deadlineVariables(documentType, derived));

  // ── Objectives → clause selection ────────────────────────────────────────
  // Placed LAST deliberately. The include_* defaults above infer intent from
  // whether a field happens to be filled in; an objective the user actually
  // ticked is a stronger signal than that inference and must win. Running this
  // block earlier meant every flag it set was quietly overwritten further down.
  // The intent layer. Everything else in this function derives a flag from a
  // FACT the user stated; this derives flags from what the user said they are
  // trying to avoid. It is the input the clause library was always missing:
  // 224 domain clauses average 1.5 appearances across the product because
  // nothing in the intake ever selected them.
  //
  // Each objective maps to the clauses that actually deal with it. An objective
  // the user did not pick adds nothing, which is how the document stays shorter
  // for someone with simpler needs.
  const objectives = normalizeText(variables.protect_against).toLowerCase();
  if (objectives) {
    const wants = (...phrases) => phrases.some((phrase) => objectives.includes(phrase));

    // Late delivery -> delivery timelines, and the remedies for missing them.
    if (wants("late or missed delivery", "missed deadlines")) {
      derived.include_delivery_terms = true;
      derived.include_sla = true;
      derived.include_timelines = true;
      derived.include_reporting = true;
    }
    // Quality -> inspection, rejection, warranty, replacement.
    if (wants("defective", "poor-quality", "not meeting the agreed standard")) {
      derived.include_inspection_rights = true;
      derived.include_warranty_clause = true;
      derived.return_policy_required = true;
    }
    // Price movement -> a price-revision mechanism rather than silence.
    if (wants("price increases")) derived.include_price_revision = true;
    // Confidentiality -> the confidentiality family, and data terms with it.
    if (wants("confidentiality breaches")) {
      derived.include_confidentiality = true;
      derived.involves_trade_secrets = true;
    }
    // Third-party and regulatory exposure -> indemnity, insurance, compliance.
    if (wants("third-party", "regulatory claims")) {
      derived.include_indemnity_clause = true;
      derived.include_insurance = true;
    }
    // Counterparty leaving -> notice, transition and handover obligations.
    if (wants("walking away early", "leaving mid-project")) {
      derived.include_transition_assistance = true;
      derived.termination_for_convenience = "No";
    }
    // Ownership of paid-for work -> IP assignment, not a licence.
    if (wants("losing ownership")) {
      derived.is_developer_ip = false;
      derived.include_ip_assignment = true;
    }
    // Competitor work -> restraint, within what s.27 of the Contract Act allows.
    if (wants("working for a competitor")) {
      derived.include_non_compete = true;
      derived.include_non_solicit = true;
    }
    // Cost overrun -> expenses and change-control.
    if (wants("unexpected costs", "costs creeping")) {
      derived.include_expenses = true;
      derived.include_change_control = true;
    }
    // Disputes about scope -> deliverables and acceptance criteria.
    if (wants("disputes over what was ordered")) {
      derived.include_deliverables = true;
      derived.include_inspection_rights = true;
    }
  }

  // ── How many principals ──────────────────────────────────────────────────
  // Exposed as ordinary variables so a knowledge-base rule can ask the question
  // in the existing closed predicate vocabulary rather than needing an engine
  // change. MORE_PRINCIPALS_THAN_THE_INSTRUMENT_BINDS uses it: the notice fires
  // when free text describes a third principal AND the roster does not carry
  // one, which is the case where the deed recites a person it does not bind.
  // Where the roster does carry them, the notice would now be false.
  const roster = resolveRoster(derived);
  derived.__roster_count = roster.count;
  derived.__roster_prefix = roster.prefix;
  // An unreconciled roster is not a count anybody should rely on, so it is
  // carried separately rather than folded into the number.
  derived.__roster_reconciled = roster.reconciled;

  // ── Economic allocation state ────────────────────────────────────────────
  // Exposed as counts so a knowledge-base rule can ask about them in the closed
  // predicate vocabulary. UNATTRIBUTED is deliberately reported at EVERY party
  // count, not only above two: "60:40" between two partners never said whose 60
  // it was either. The roster work made the defect visible; it did not cause it.
  const allocations = resolveAllocations(documentType, derived);
  derived.__allocation_unattributed = allocations.filter(
    (a) => a.attribution === ATTRIBUTION.UNATTRIBUTED
  ).length;
  derived.__allocation_conflict = allocations.filter(
    (a) => a.attribution === ATTRIBUTION.CONFLICT
  ).length;
  derived.__allocation_arity_mismatch = allocations.filter(
    (a) => a.arity === ARITY.FEWER_PARTS_THAN_PRINCIPALS ||
           a.arity === ARITY.MORE_PARTS_THAN_PRINCIPALS
  ).length;
  derived.__allocation_attributable = allocations.filter((a) => a.resolved).length;
  // A colon series whose parts do not total 100. Under a PERCENTAGE reading that
  // leaves part of the firm unallocated; under a RATIO reading 40:40:30 is
  // perfectly good and means 40/110, 40/110 and 30/110. The field is called a
  // ratio and every example it gives totals 100, so it teaches one reading and
  // is named for the other. Reported as the ambiguity it is — and never
  // rescaled, because rescaling picks the reading and moves money.
  derived.__allocation_total_ambiguous = allocations.filter(
    (a) => a.basis === BASIS.COLON_SERIES && a.sum !== null && a.totals_100 === false
  ).length;

  // Free-text special terms are recorded verbatim as a term of the agreement.
  // They are NOT interpreted into clause selection: turning a sentence into a
  // clause choice is the concept resolver's job, and doing it here with string
  // matching would be guessing at law.
  derived.has_special_terms = hasMeaningfulValue(variables.special_terms);

  // ── Resolved positions ───────────────────────────────────────────────────
  // Last, and above everything else in this function, because these are answers
  // the user gave to a question that was put to them directly. Everything above
  // infers a position from a fact or a default; this IS the position. An
  // explicit answer must not be overridden by an inference drawn from something
  // else the user happened to write.
  const resolved = variables.__resolved_positions;
  if (resolved && typeof resolved === "object") {
    for (const [flag, value] of Object.entries(resolved)) {
      if (value === null || value === undefined) continue;
      derived[flag] = value;
    }
  }

  return derived;
}
