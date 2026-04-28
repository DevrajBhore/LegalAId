import { getClauseById } from "./clauseAssembler.js";
import { injectVariables } from "./variableInjector.js";
import { normalizeClauseCategory, sortClausesByOrder } from "../config/clauseOrder.js";
import { hasMeaningfulValue } from "./generationControls.js";
import {
  getDocumentDraftingPolicy,
  getDocumentRoleContext,
  getPartyNamingLabels,
  getParticipantExpectations,
} from "./draftingPolicy.js";

function getRequiredHardeningClauseIds(documentType) {
  return getDocumentDraftingPolicy(documentType)?.hardening?.requiredClauseIds || [];
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isNotApplicable(value = "") {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return !normalized || ["na", "n/a", "none", "nil", "not applicable"].includes(normalized);
}

function parseNumberish(value) {
  if (value === undefined || value === null || value === "") return null;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  const numeric = parseNumberish(value);
  if (numeric === null) return "the agreed amount";
  return `₹${numeric.toLocaleString("en-IN")}`;
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "the agreed date";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-GB");
}

function formatFormalExecutionDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "this day and year first written above";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const day = parsed.getDate();
  const modTen = day % 10;
  const modHundred = day % 100;
  let suffix = "th";

  if (modTen === 1 && modHundred !== 11) suffix = "st";
  else if (modTen === 2 && modHundred !== 12) suffix = "nd";
  else if (modTen === 3 && modHundred !== 13) suffix = "rd";

  const month = parsed.toLocaleString("en-US", { month: "long" });
  return `this ${day}${suffix} day of ${month}, ${parsed.getFullYear()}`;
}

function resolveExecutionVenue(variables = {}) {
  return stripExternalReferencePhrases(
    variables.execution_city ||
      variables.arbitration_city ||
      variables.delivery_location ||
      variables.operating_state,
    ""
  );
}

function withIndefiniteArticle(value = "") {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  const article = /^[aeiou]/i.test(normalized) ? "an" : "a";
  return `${article} ${normalized}`;
}

function resolveAgreementDuration(documentType, variables = {}) {
  const duration = normalizeWhitespace(
    variables.contract_duration ||
      variables.agreement_term ||
      variables.jv_duration ||
      variables.mou_duration ||
      variables.guarantee_period
  );

  if (duration) {
    return duration;
  }

  const numericLeaseTerm = parseNumberish(variables.lease_term);
  if (numericLeaseTerm !== null) {
    return `${numericLeaseTerm} months`;
  }

  const numericLicenseTerm = parseNumberish(variables.license_term);
  if (numericLicenseTerm !== null) {
    return `${numericLicenseTerm} months`;
  }

  return "";
}

function resolveRenewalSentence(variables = {}) {
  const renewalOption = normalizeWhitespace(variables.renewal_option).toLowerCase();
  const renewalTerms = stripExternalReferencePhrases(variables.renewal_terms, "");

  if (!renewalOption || renewalOption === "no") {
    return "Upon expiry of the initial term, this Agreement shall automatically expire unless the Parties expressly agree in writing to renew or extend it.";
  }

  if (renewalOption.includes("automatic")) {
    if (renewalTerms) {
      return `Upon expiry of the initial term, this Agreement shall automatically renew in accordance with the following renewal arrangement: ${renewalTerms}.`;
    }

    return "Upon expiry of the initial term, this Agreement shall automatically renew for successive periods on the same terms unless either Party gives prior written notice of non-renewal.";
  }

  if (renewalTerms) {
    return `Upon expiry of the initial term, this Agreement may be renewed or extended only in accordance with the following renewal arrangement: ${renewalTerms}.`;
  }

  return "Upon expiry of the initial term, this Agreement may be renewed or extended only by mutual written agreement of the Parties.";
}

function resolveTerminationNoticeDays(variables = {}) {
  const numericValue = parseNumberish(variables.termination_notice_period);
  if (numericValue === null || numericValue <= 0) {
    return 30;
  }

  return Math.round(numericValue);
}

function resolveCurePeriodDays(variables = {}, fallback = 15) {
  const numericValue = parseNumberish(variables.cure_period_days);
  if (numericValue === null || numericValue <= 0) {
    return fallback;
  }

  return Math.round(numericValue);
}

function normalizeBooleanChoice(value, fallback = true) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return fallback;
  if (["yes", "y", "true", "1"].includes(normalized)) return true;
  if (["no", "n", "false", "0"].includes(normalized)) return false;
  return fallback;
}

function resolveGenericTerminationText(namedParties, variables = {}) {
  const allowConvenience = normalizeBooleanChoice(
    variables.termination_for_convenience,
    true
  );
  const allowCause = normalizeBooleanChoice(variables.termination_for_cause, true);
  const noticeDays = resolveTerminationNoticeDays(variables);
  const cureDays = resolveCurePeriodDays(variables, 15);
  const grounds = [];

  if (allowConvenience) {
    grounds.push(
      `(a) by either ${namedParties.first} or ${namedParties.second} for convenience upon ${noticeDays} days' prior written notice to the other Party`
    );
  }

  if (allowCause) {
    grounds.push(
      `(b) by either Party with immediate effect if the other Party commits a material breach of this Agreement and, where such breach is capable of remedy, fails to cure it within ${cureDays} days after receipt of written notice requiring the same to be remedied`
    );
  }

  grounds.push(
    `(c) by either Party with immediate effect if the other Party becomes insolvent, is wound up, enters into a composition with creditors, or ceases to carry on business`
  );

  return `This Agreement may be terminated ${grounds.join(
    "; "
  )}. Upon termination or expiry, each Party shall remain liable for accrued payment obligations and for all obligations which by their nature are intended to survive, including confidentiality, dispute resolution, indemnity, and any accrued rights or remedies.`;
}

function resolveRestrictionPeriod(variables = {}) {
  const period = normalizeWhitespace(variables.non_compete_period);
  return isNotApplicable(period) ? "twelve (12) months" : period;
}

function buildInvoiceComplianceSentence(payeeLabel, variables = {}) {
  const gstApplicable = normalizeWhitespace(variables.gst_applicable).toLowerCase();
  const payeeGstin = normalizeWhitespace(variables.party_2_gstin);
  const payerGstin = normalizeWhitespace(variables.party_1_gstin);

  if (gstApplicable === "no") {
    return "All invoices shall be raised in Indian Rupees and shall describe the relevant services or deliverables, the amount payable, and the due date. If GST or any similar indirect tax becomes applicable under law, the Parties shall update the invoicing mechanics accordingly.";
  }

  const details = [
    "invoice date",
    "description of the relevant services or deliverables",
    "taxable value",
    "applicable GST amount",
    "place of supply",
  ];

  if (payeeGstin) {
    details.unshift(`${payeeLabel} GSTIN ${payeeGstin}`);
  }

  if (payerGstin) {
    details.push(`recipient GSTIN ${payerGstin} where required`);
  }

  return `All invoices shall be raised in Indian Rupees as valid GST-compliant tax invoices and shall specify the ${details.join(
    ", "
  )}.`;
}

function resolveServicePurposeClause(documentType, namedParties, variables = {}) {
  const purposeMode =
    getDocumentDraftingPolicy(documentType)?.rendering?.purposeMode || "none";
  const projectDescription = normalizeWhitespace(
    variables.project_description || variables.deliverables
  );
  const serviceDescription = normalizeWhitespace(
    variables.consulting_services || variables.services_description
  );
  const engagementModel = normalizeWhitespace(variables.engagement_model);

  switch (purposeMode) {
    case "confidential_disclosure": {
      const disclosurePurpose = stripExternalReferencePhrases(
        variables.purpose || variables.permitted_use,
        "evaluating and discussing the contemplated relationship or transaction between the Parties"
      );
      const ndaType = normalizeWhitespace(variables.nda_type).toLowerCase();

      if (ndaType.includes("mutual")) {
        return `The purpose of this Agreement is to govern the mutual disclosure and protected use of Confidential Information exchanged between the ${namedParties.first} and the ${namedParties.second} for ${disclosurePurpose}. This Agreement is intended to operate as a mutual NDA, and each Party may act as both a disclosing and a receiving party in relation to Confidential Information shared for the permitted purpose.`;
      }

      return `The purpose of this Agreement is to govern the disclosure of Confidential Information by the ${namedParties.first} to the ${namedParties.second} for ${disclosurePurpose}. This Agreement is intended to operate as a one-way NDA unless the Parties expressly agree in writing that confidential disclosures may flow in both directions.`;
    }

    case "employment_engagement":
      return `The purpose of this Agreement is to record the appointment of the Employee as ${normalizeWhitespace(
        variables.job_title || "the agreed role"
      )}${hasMeaningfulValue(variables.department) ? ` in the ${stripExternalReferencePhrases(
        variables.department,
        ""
      )} department` : ""}, on the terms governing the Employee's services, compensation, benefits, confidentiality obligations, and post-employment responsibilities while working from ${normalizeWhitespace(
        variables.work_location || "the agreed work location"
      )}.`;

    case "partnership_business":
      return `The purpose of this Deed is to regulate the partnership business carried on under the name ${normalizeWhitespace(
        variables.partnership_name || "the agreed firm name"
      )}${hasMeaningfulValue(variables.business_address) ? ` from ${stripExternalReferencePhrases(
        variables.business_address,
        ""
      )}` : ""} for the business activity of ${stripExternalReferencePhrases(
        variables.business_purpose,
        "the agreed lawful business of the Firm"
      )}, including the Partners' capital, management, profit sharing, and exit rights.`;

    case "shareholder_governance":
      return `The purpose of this Agreement is to regulate the relationship of the Shareholders in connection with ${normalizeWhitespace(
        variables.company_name || "the Company"
      )}${hasMeaningfulValue(variables.company_cin) ? ` bearing Corporate Identification Number ${normalizeWhitespace(
        variables.company_cin
      )}` : ""}${hasMeaningfulValue(variables.company_address) ? ` and having its registered office at ${stripExternalReferencePhrases(
        variables.company_address,
        ""
      )}` : ""}, including shareholding, governance, transfer restrictions, reserved matters, and shareholder exit rights.`;

    case "joint_venture_purpose":
      return `The purpose of this Agreement is to establish and govern the Joint Venture${hasMeaningfulValue(
        variables.jv_name
      ) ? ` known as ${normalizeWhitespace(variables.jv_name)}` : ""} for ${stripExternalReferencePhrases(
        variables.jv_purpose,
        "the agreed joint business objective"
      )}.${hasMeaningfulValue(variables.jv_structure) ? ` The Parties further agree that the joint venture structure shall be as follows: ${stripExternalReferencePhrases(
        variables.jv_structure,
        ""
      )}.` : ""}`;

    case "memorandum_cooperation":
      return `The purpose of this Memorandum of Understanding is to record the commercial understanding of the Parties in relation to ${stripExternalReferencePhrases(
        variables.mou_purpose || variables.purpose,
        "the contemplated cooperation between the Parties"
      )}.${hasMeaningfulValue(variables.mou_scope) ? ` The scope of this understanding shall include ${stripExternalReferencePhrases(
        variables.mou_scope,
        ""
      )}.` : ""}`;

    case "consultancy_engagement":
      return `The purpose of this Agreement is to set out the terms on which the ${namedParties.first} retains the ${namedParties.second} to provide consultancy and advisory services in relation to ${serviceDescription || "the agreed business requirements"} and to deliver the agreed work product under a clearly defined professional engagement${engagementModel ? ` on a ${engagementModel.toLowerCase()} basis` : ""}.`;
    case "independent_contractor_engagement":
      return `The purpose of this Agreement is to set out the terms on which the ${namedParties.first} engages the ${namedParties.second}, as an independent contractor and not an employee, to perform the agreed services and deliverables described in this Agreement.`;
    case "software_delivery":
      return `The purpose of this Agreement is to set out the terms on which the ${namedParties.first} engages the ${namedParties.second} to design, develop, test, and deliver ${projectDescription || "the software solution described in this Agreement"} together with the associated services and deliverables.`;
    case "distribution_appointment":
      return `The purpose of this Agreement is to record the appointment of the ${namedParties.second} as ${hasMeaningfulValue(
        variables.exclusivity
      ) ? `${normalizeWhitespace(variables.exclusivity).toLowerCase()} distributor` : "distributor"} of ${normalizeWhitespace(
        variables.product_description || "the Products"
      )}${normalizeWhitespace(variables.territory) ? ` in ${normalizeWhitespace(variables.territory)}` : ""} and to set out the commercial and operational terms governing that distribution relationship.`;
    case "service_engagement":
      return `The purpose of this Agreement is to set out the terms on which the ${namedParties.first} engages the ${namedParties.second} to perform the agreed services and associated deliverables described in this Agreement.`;
    default:
      return "";
  }
}

function resolveServiceTermClause(documentType, namedParties, variables = {}) {
  const effectiveDate = formatDate(variables.effective_date);
  const duration = resolveAgreementDuration(documentType, variables);
  const renewalSentence = resolveRenewalSentence(variables);

  if (duration) {
    return `This Agreement shall commence on ${effectiveDate} (the "Effective Date") and, unless terminated earlier in accordance with this Agreement, shall remain in force for ${duration} from the Effective Date. ${renewalSentence}`;
  }

  return `This Agreement shall commence on ${effectiveDate} (the "Effective Date") and shall continue in force until terminated in accordance with this Agreement. ${renewalSentence}`;
}

function resolveExpensePolicyClause(documentType, serviceLabels, variables = {}) {
  const actor = serviceLabels.payee;
  const payer = serviceLabels.payer;
  const policy = normalizeWhitespace(variables.expenses_policy);

  if (!hasMeaningfulValue(policy)) {
    return `Except as expressly approved in writing in advance by ${payer}, all out-of-pocket, travel, accommodation, communication, and incidental expenses incurred by ${actor} in performing the Services shall be borne solely by ${actor}.`;
  }

  return `The following expense reimbursement arrangement shall apply under this Agreement: ${policy}. Any reimbursable expense claimed by ${actor} shall be supported by reasonable documentary evidence and, unless the stated policy provides otherwise, shall require the prior written approval of ${payer}.`;
}

function resolveServiceFee(variables = {}) {
  return (
    variables.contract_value ||
    variables.consulting_fee ||
    variables.total_fee ||
    variables.price ||
    "the agreed fee"
  );
}

function resolveMaintenanceSentence(variables = {}) {
  const maintenance = normalizeWhitespace(variables.maintenance_party).toLowerCase();
  if (!maintenance) {
    return "The Landlord shall be responsible for property tax and building-level outgoings, while the Tenant shall bear utilities consumed at the Premises.";
  }
  if (maintenance.includes("landlord") || maintenance.includes("licensor")) {
    return "The Landlord shall be responsible for property tax, building maintenance charges, and society maintenance charges.";
  }
  if (maintenance.includes("tenant") || maintenance.includes("licensee")) {
    return "The Tenant shall be responsible for building maintenance charges and society maintenance charges, while the Landlord shall remain responsible for property tax unless applicable law requires otherwise.";
  }
  return "The Landlord and the Tenant shall bear building maintenance and society maintenance charges equally, while property tax shall remain the responsibility of the Landlord unless applicable law requires otherwise.";
}

function stripExternalReferencePhrases(value = "", fallback = "") {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return fallback;

  const rewritten = normalized
    .replace(
      /\b(?:as\s+per|set\s+out\s+in|specified\s+in|described\s+in)\s+(?:the\s+)?(?:annexed\s+|attached\s+)?(?:schedule\b|annexure\b|appendix\b|exhibit\b)\s*[a-z0-9-]*\b/gi,
      "as expressly stated in this Agreement"
    )
    .replace(
      /\b(?:annexed\s+|attached\s+)?(?:schedule\b|annexure\b|appendix\b|exhibit\b)\s*[a-z0-9-]*\b/gi,
      "this Agreement"
    )
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .trim();

  return rewritten || fallback;
}

function splitStructuredItems(value = "", { allowComma = false } = {}) {
  const normalized = String(value || "")
    .replace(/\r/g, "")
    .replace(/\u2022/g, "\n")
    .trim();

  if (!normalized) return [];

  let items = normalized
    .split(/\n+|;\s*/)
    .map((item) =>
      item
        .replace(/^\(?[a-z0-9ivxlcdm]+\)?[.)-]?\s+/i, "")
        .replace(/^[-*]\s+/, "")
        .trim()
    )
    .filter(Boolean);

  if (items.length <= 1 && allowComma) {
    const commaItems = normalized
      .split(/\s*,\s*/)
      .map((item) => item.trim())
      .filter((item) => item && item.split(/\s+/).length <= 12);

    if (commaItems.length >= 2) {
      items = commaItems;
    }
  }

  return items.filter((item, index, list) => list.indexOf(item) === index);
}

function formatStructuredSubparts(items = []) {
  return items
    .map((item, index) => {
      const marker = String.fromCharCode(97 + (index % 26));
      return `(${marker}) ${item}`;
    })
    .join("\n");
}

function buildCustomDefinitionEntries(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .split(/\n+|;\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const cleaned = normalizeWhitespace(entry).replace(/\.$/, "");
      if (!cleaned) return null;

      const explicitSplit = cleaned.match(/^([^:=]{2,80})\s*[:=]\s*(.+)$/);
      if (explicitSplit) {
        return {
          term: normalizeWhitespace(explicitSplit[1]).replace(/^"|"$/g, ""),
          meaning: normalizeWhitespace(explicitSplit[2]),
        };
      }

      const meansSplit = cleaned.match(/^(.+?)\s+means\s+(.+)$/i);
      if (meansSplit) {
        return {
          term: normalizeWhitespace(meansSplit[1]).replace(/^"|"$/g, ""),
          meaning: normalizeWhitespace(meansSplit[2]),
        };
      }

      return {
        term: "",
        meaning: cleaned,
      };
    })
    .filter(Boolean);
}

function renderStructuredDetailText(prefix, value, options = {}) {
  const items = splitStructuredItems(value, options);
  if (!items.length) {
    return prefix;
  }

  if (items.length === 1) {
    return `${prefix} ${items[0]}`;
  }

  return `${prefix}\n${formatStructuredSubparts(items)}`;
}

function resolveNamedPartyLabels(documentType) {
  return (
    getPartyNamingLabels(documentType) || {
      first: "Party 1",
      second: "Party 2",
    }
  );
}

function resolveAvailabilitySentence(actor, variables = {}) {
  const availability = stripExternalReferencePhrases(
    variables.consultant_availability,
    ""
  );
  if (!availability) return "";

  return ` ${actor} shall remain reasonably available as follows: ${availability}.`;
}

function resolveSupportMaintenanceSentence(variables = {}) {
  const supportTerms = stripExternalReferencePhrases(
    variables.support_maintenance,
    ""
  );
  if (!supportTerms) return "";

  return ` The following support, maintenance, or post-delivery obligations shall also apply: ${supportTerms}.`;
}

function resolveDelayRemediesSentence(reviewer, variables = {}) {
  const remedies = stripExternalReferencePhrases(variables.delay_remedies, "");
  if (!remedies) return "";

  return ` If delay is attributable to the service provider, ${reviewer} shall be entitled to the following delay remedies: ${remedies}.`;
}

function resolveMilestoneSentence(variables = {}) {
  const milestonePlan = stripExternalReferencePhrases(variables.milestone_plan, "");
  if (!milestonePlan) return "";

  return ` The delivery plan and milestone structure shall be as follows: ${milestonePlan}.`;
}

function resolveSourceCodeDeliverySentence(variables = {}) {
  const sourceCodeTerms = stripExternalReferencePhrases(
    variables.source_code_delivery,
    ""
  );
  if (!sourceCodeTerms) return "";

  return ` Source code delivery, repositories, credentials, and related handover obligations shall be governed by the following arrangement: ${sourceCodeTerms}.`;
}

function resolveLiabilityCapText(variables = {}) {
  const basis = normalizeWhitespace(variables.liability_cap_basis).toLowerCase();
  const amount = parseNumberish(variables.liability_cap_amount);

  if (basis.includes("specific amount") && amount !== null) {
    return `shall not exceed ${formatCurrency(amount)} in the aggregate`;
  }

  if (basis.includes("direct damages only")) {
    return "shall be limited to direct damages only and, in any event, shall not exceed the aggregate fees paid or payable under this Agreement during the twelve (12) months preceding the event giving rise to the claim";
  }

  if (basis.includes("unlimited") || basis.includes("uncapped")) {
    return "shall not be subject to a pre-agreed monetary cap, provided that nothing in this clause shall permit recovery of punitive damages except where such remedy is non-excludable under applicable law";
  }

  return "shall not exceed the aggregate fees paid or payable under this Agreement during the twelve (12) months preceding the event giving rise to the claim";
}

function resolveIndemnityScopeText(variables = {}) {
  const scope = normalizeWhitespace(variables.indemnity_scope).toLowerCase();

  if (scope.includes("third-party claims only")) {
    return "any third-party claim, proceeding, liability, loss, cost, or expense arising from that Party's acts, omissions, or breach of this Agreement";
  }

  if (scope.includes("breach of agreement only")) {
    return "losses, liabilities, costs, and expenses directly arising from that Party's material breach of this Agreement";
  }

  if (scope.includes("breach, negligence, and third-party claims")) {
    return "any loss, liability, cost, or expense arising from that Party's breach of this Agreement, negligence, wilful misconduct, or any related third-party claim";
  }

  return "any loss, liability, cost, or expense arising from that Party's breach of this Agreement, breach of confidentiality, infringement or misappropriation of intellectual property rights, negligence, wilful misconduct, or any related third-party claim";
}

function resolveStructuredRepaymentTerms(variables = {}) {
  const frequency = normalizeWhitespace(variables.repayment_frequency);
  const tenureMonths = parseNumberish(variables.repayment_tenure_months);
  const instalmentAmount = parseNumberish(variables.instalment_amount);

  if (!frequency && tenureMonths === null && instalmentAmount === null) {
    return "";
  }

  const parts = [];
  if (instalmentAmount !== null) {
    parts.push(`${formatCurrency(instalmentAmount)} each`);
  }
  if (frequency) {
    parts.push(frequency.toLowerCase());
  }
  if (tenureMonths !== null) {
    parts.push(`for ${Math.round(tenureMonths)} months`);
  }

  return parts.join(" ");
}

function resolveGstRateSentence(variables = {}) {
  const gstRate = normalizeWhitespace(variables.gst_rate);
  if (!gstRate) {
    return "";
  }

  return ` The Parties presently contemplate that GST, where chargeable on the relevant supply, shall be levied at ${gstRate}% or such other rate as may be required by applicable law from time to time.`;
}

function resolveOwnershipAssignmentClause(ownerLabel, creatorLabel, ownershipValue = "") {
  const ownership = normalizeWhitespace(ownershipValue).toLowerCase();

  if (ownership.includes("shared") || ownership.includes("custom")) {
    return `Intellectual property rights in deliverables, work product, and developed materials arising under this Agreement shall be allocated in accordance with the following arrangement: ${normalizeWhitespace(
      ownershipValue
    )}. Each Party shall retain ownership of its respective pre-existing intellectual property, know-how, tools, templates, and materials contributed to the relationship, unless expressly assigned in writing.`;
  }

  if (ownership.includes("retains")) {
    return `${creatorLabel} shall retain ownership of its pre-existing intellectual property, tools, methodologies, frameworks, and other background materials, and shall retain ownership of newly created intellectual property only to the extent expressly stated in this Agreement. To the extent any deliverable is intended for ${ownerLabel}'s operational use, ${creatorLabel} grants ${ownerLabel} a perpetual, irrevocable, transferable, and royalty-free licence to use, reproduce, modify, and exploit such deliverables for its internal business purposes, subject to the payment obligations under this Agreement.`;
  }

  return `All deliverables, work product, inventions, developments, documents, reports, source code, designs, materials, discoveries, and other intellectual property created, conceived, authored, or reduced to practice in the course of performing this Agreement for ${ownerLabel} shall vest exclusively in ${ownerLabel} from creation, and to the extent any such rights do not automatically vest by operation of law, ${creatorLabel} hereby irrevocably assigns, and shall procure the assignment of, all such rights to ${ownerLabel}. ${creatorLabel} shall retain ownership only of pre-existing intellectual property, general know-how, and reusable tools that are not specific to ${ownerLabel}, but grants ${ownerLabel} a non-exclusive, perpetual, royalty-free licence to use any such background materials to the extent embedded in or necessary to use the deliverables.`;
}

function buildParticipantDescriptor(participant, variables = {}) {
  const name = normalizeWhitespace(participant?.name);
  if (!name) return "";

  const segments = [name];
  if (hasMeaningfulValue(participant?.type)) {
    segments.push(withIndefiniteArticle(normalizeWhitespace(participant.type).toLowerCase()));
  }

  if (participant?.id === "employer" && hasMeaningfulValue(variables.employer_cin)) {
    segments.push(`bearing Corporate Identification Number ${normalizeWhitespace(variables.employer_cin)}`);
  }

  if (participant?.id === "employee" && hasMeaningfulValue(variables.employee_pan)) {
    segments.push(`holding PAN ${normalizeWhitespace(variables.employee_pan)}`);
  }

  let descriptor = segments.join(", ");
  if (hasMeaningfulValue(participant?.address)) {
    descriptor += `, having the address at ${stripExternalReferencePhrases(
      participant.address,
      ""
    )}`;
  }

  return descriptor;
}

function resolveSuccessorPhrase(participant = {}) {
  const entityType = normalizeWhitespace(participant?.type).toLowerCase();

  if (
    entityType.includes("company") ||
    entityType.includes("llp") ||
    entityType.includes("corporation") ||
    entityType.includes("firm")
  ) {
    return "which expression shall, unless repugnant to the context or meaning thereof, include its successors and permitted assigns";
  }

  return "which expression shall, unless repugnant to the context or meaning thereof, include his, her, or their legal heirs, representatives, executors, administrators, and permitted assigns";
}

function buildFormalPartyIntroduction(
  descriptor,
  label,
  positionLabel,
  participant = {},
  lineEnding = ";"
) {
  return `${descriptor} (hereinafter referred to as the "${label}", ${resolveSuccessorPhrase(
    participant
  )}) of the ${positionLabel} Part${lineEnding}`;
}

function buildDefinitionsClauseText(documentType, namedParties, variables = {}) {
  const customDefinitions = buildCustomDefinitionEntries(variables.nomenclature_terms);
  if (customDefinitions.length) {
    const customText = customDefinitions
      .map(({ term, meaning }, index) => {
        const marker = String.fromCharCode(97 + (index % 26));
        if (term) {
          return `(${marker}) "${term}" means ${meaning};`;
        }

        return `(${marker}) ${meaning};`;
      })
      .join("\n");

    return `In this Agreement, unless the context otherwise requires, the following nomenclature and defined terms shall apply:\n${customText}\nThe headings used in this Agreement are for convenience only and shall not affect interpretation. References to the singular include the plural and vice versa, references to a person include any individual, firm, company, LLP, body corporate, or governmental authority, and references to writing include email and other legally admissible electronic communication unless this Agreement expressly requires a signed physical instrument.`;
  }

  const entries = [
    [
      "Agreement",
      "this Agreement together with its schedules, annexures, written amendments, and other documents expressly incorporated by reference",
    ],
    [
      "Effective Date",
      formatDate(variables.effective_date),
    ],
  ];

  const purpose = stripExternalReferencePhrases(
    variables.purpose || variables.mou_purpose,
    ""
  );
  if (purpose) {
    entries.push(["Permitted Purpose", purpose]);
  }

  const services = stripExternalReferencePhrases(
    variables.services_description || variables.consulting_services,
    ""
  );
  if (services) {
    entries.push(["Services", services]);
  }

  const deliverables = stripExternalReferencePhrases(variables.deliverables, "");
  if (deliverables) {
    entries.push(["Deliverables", deliverables]);
  }

  const goods = stripExternalReferencePhrases(
    variables.goods_description || variables.product_description,
    ""
  );
  if (goods) {
    entries.push(["Goods", goods]);
  }

  const property = stripExternalReferencePhrases(variables.property_description, "");
  if (property) {
    entries.push(["Premises", property]);
  }

  const project = stripExternalReferencePhrases(variables.project_description, "");
  if (project) {
    entries.push(["Project", project]);
  }

  const territory = stripExternalReferencePhrases(variables.territory, "");
  if (territory) {
    entries.push(["Territory", territory]);
  }

  if (documentType === "NDA") {
    entries.push([
      "Confidential Information",
      stripExternalReferencePhrases(
        variables.confidential_information_definition,
        "all non-public, proprietary, commercial, financial, technical, operational, and business information disclosed in connection with the permitted purpose"
      ),
    ]);
  }

  if (documentType === "SOFTWARE_DEVELOPMENT_AGREEMENT") {
    entries.push([
      "Software",
      stripExternalReferencePhrases(
        variables.project_description || variables.deliverables,
        "the software, deliverables, and related materials to be designed, developed, tested, and delivered under this Agreement"
      ),
    ]);
  }

  return [
    "In this Agreement, unless the context otherwise requires, the following expressions shall have the meanings set out below:",
    formatStructuredSubparts(
      entries.map(([term, definition]) => `"${term}" means ${definition}.`)
    ),
  ].join("\n");
}

function buildInterpretationClauseText() {
  return [
    "In this Agreement, unless the context otherwise requires:",
    formatStructuredSubparts([
      "headings and titles are inserted for convenience only and shall not affect interpretation",
      "words importing the singular include the plural and vice versa, and words importing a gender include every gender",
      'the words "including", "includes", and similar expressions shall be construed as illustrative and not exhaustive',
      "references to any law, statute, rule, regulation, or governmental direction include all amendments, consolidations, re-enactments, and subordinate legislation made thereunder from time to time",
      "any schedule, annexure, appendix, or statement expressly incorporated into this Agreement shall form part of this Agreement, and in the event of inconsistency, the more specific commercial or technical provision shall prevail over the more general provision to the extent of that inconsistency",
    ]),
  ].join("\n");
}

function buildSignatureBlockText(documentType, participants = []) {
  const lines = [
    "IN WITNESS WHEREOF, the Parties hereto have executed this Agreement on the day and year first above written.",
    "",
  ];

  for (const participant of participants) {
    const name = normalizeWhitespace(participant?.name) || "____________________";
    const entityType = normalizeWhitespace(
      participant?.type || participant?.name
    ).toLowerCase();
    const usesRepresentative =
      entityType.includes("company") ||
      entityType.includes("llp") ||
      entityType.includes("corporation") ||
      entityType.includes("private limited") ||
      entityType.includes("limited");

    if (usesRepresentative) {
      lines.push(`For and on behalf of ${name}`);
      lines.push("______________________________");
      lines.push("Authorized Signatory");
      lines.push("Name: ________________________");
      lines.push("Designation: __________________");
    } else {
      lines.push(`${name}`);
      lines.push("______________________________");
      lines.push(`Name: ${name}`);
    }

    lines.push("");
  }

  if (
    documentType === "COMMERCIAL_LEASE_AGREEMENT" ||
    documentType === "LEAVE_AND_LICENSE_AGREEMENT"
  ) {
    lines.push("Witnesses:");
    lines.push("1. ______________________________");
    lines.push("2. ______________________________");
  }

  return lines.join("\n").trim();
}

function renderMutualNonSolicitationClause(namedParties, variables = {}) {
  return `During the term of this Agreement and for a period of ${resolveRestrictionPeriod(
    variables
  )} following its termination or expiry, neither the ${namedParties.first} nor the ${namedParties.second} shall, directly or indirectly, solicit, induce, recruit, or encourage any employee, personnel member, independent contractor, or key representative of the other Party to terminate their engagement with such other Party or to enter into any employment or engagement with the soliciting Party or any of its affiliates, without the prior written consent of the other Party.`;
}

function renderDocumentSpecificNonCompeteClause(documentType, namedParties, variables = {}) {
  const restrictionMode =
    getDocumentDraftingPolicy(documentType)?.rendering?.restrictionMode ||
    "confidentiality_limited";

  if (restrictionMode === "territorial_distribution") {
    return `During the term of this Agreement and within the agreed Territory, the ${namedParties.second} shall not market, distribute, promote, or sell any products that directly compete with the Products covered by this Agreement without the prior written consent of the ${namedParties.first}. This restraint is limited to the contractual term, the agreed Territory, and the Product category expressly contemplated by this Agreement and is intended solely to protect the legitimate commercial interests and confidential business information of the ${namedParties.first}.`;
  }

  return `During the term of this Agreement and for a period of ${resolveRestrictionPeriod(
    variables
  )} thereafter, the ${namedParties.second} shall not, without the prior written consent of the ${namedParties.first}, directly or indirectly provide substantially similar services in a manner that relies upon or uses the confidential information, proprietary methods, or trade-sensitive know-how of the ${namedParties.first}. This restriction is limited to protecting legitimate confidential and proprietary interests and shall be construed accordingly under applicable Indian law.`;
}

function renderMouBindingClause(variables = {}) {
  const bindingNature = normalizeWhitespace(variables.binding_nature).toLowerCase();

  if (bindingNature === "binding") {
    return "This Memorandum of Understanding is intended to be binding and to create legally enforceable obligations in accordance with its terms. The Parties acknowledge that the operative commitments, timelines, confidentiality obligations, governing law provisions, dispute resolution mechanism, and all other clauses expressly stated in this MOU are intended to be enforceable according to applicable law.";
  }

  if (bindingNature === "partly binding") {
    return "This Memorandum of Understanding is partly binding. Except for those provisions expressly stated to be binding, including Confidentiality, Governing Law, Dispute Resolution, and any clause that by its nature is intended to survive or be enforceable, this MOU is not intended to create legally binding obligations. The remaining provisions reflect the current commercial understanding of the Parties and are intended to guide their ongoing discussions and cooperation.";
  }

  return "This Memorandum of Understanding is non-binding except as expressly stated herein. The Parties acknowledge that this MOU is not intended to create legally binding obligations and does not constitute a binding contract. Either Party may withdraw from the arrangement contemplated herein upon written notice to the other Party, without liability. Notwithstanding the foregoing, the provisions relating to Confidentiality, Governing Law, and Dispute Resolution shall be binding on the Parties.";
}

function getSemanticParticipantDescriptors(semanticContext = {}) {
  return Array.isArray(semanticContext?.participants)
    ? semanticContext.participants
        .map((participant) => normalizeWhitespace(participant?.descriptor))
        .filter(Boolean)
    : [];
}

function renderHardClause(
  clause,
  variables = {},
  documentType = "",
  semanticContext = {}
) {
  const roleContext = getDocumentRoleContext(documentType);
  const serviceLabels = {
    payer: roleContext.payer.ref,
    payee: roleContext.payee.ref,
  };
  const timelineLabels = {
    performer: roleContext.performer.ref,
    reviewer: roleContext.reviewer.ref,
  };
  const namedParties = resolveNamedPartyLabels(documentType);
  const actor = roleContext.performer.label || namedParties.second;
  const paymentMode =
    getDocumentDraftingPolicy(documentType)?.rendering?.paymentMode || "generic";
  const renderers = {
    CORE_IDENTITY_001: () => {
      const semanticDescriptors = getSemanticParticipantDescriptors(semanticContext);
      const participants = getParticipantExpectations(documentType, variables);
      if (participants.length < 2 && semanticDescriptors.length < 2) {
        return clause.text;
      }

      const firstDescriptor = semanticDescriptors[0]
        ? semanticDescriptors[0]
        : buildParticipantDescriptor(participants[0], variables) || namedParties.first;
      const secondDescriptor = semanticDescriptors[1]
        ? semanticDescriptors[1]
        : buildParticipantDescriptor(participants[1], variables) || namedParties.second;

      const executionVenue = resolveExecutionVenue(variables);
      const recitalPurpose = stripExternalReferencePhrases(
        variables.purpose ||
          variables.mou_purpose ||
          variables.business_purpose ||
          variables.jv_purpose ||
          variables.services_description ||
          variables.consulting_services ||
          variables.project_description ||
          variables.goods_description ||
          variables.product_description ||
          variables.property_description ||
          variables.permitted_use,
        "the lawful commercial relationship and obligations contemplated by the Parties"
      );

      return [
        `THIS AGREEMENT ("Agreement") is made and executed${
          executionVenue ? ` at ${executionVenue}` : ""
        } on ${formatFormalExecutionDate(variables.effective_date)}.`,
        "",
        "BY AND BETWEEN",
        "",
        buildFormalPartyIntroduction(
          firstDescriptor,
          namedParties.first,
          "First",
          participants[0],
          ";"
        ),
        "",
        "AND",
        "",
        buildFormalPartyIntroduction(
          secondDescriptor,
          namedParties.second,
          "Second",
          participants[1],
          "."
        ),
        "",
        `The ${namedParties.first} and the ${namedParties.second} are hereinafter collectively referred to as the "Parties" and individually as a "Party".`,
        "",
        `WHEREAS, the Parties intend to enter into a legally binding arrangement in relation to ${recitalPurpose};`,
        "",
        "WHEREAS, the Parties desire to record the terms and conditions governing their respective rights, obligations, responsibilities, and risk allocation in a formal written instrument; and",
        "",
        "WHEREAS, the transaction contemplated herein is intended for a lawful object and lawful consideration under applicable Indian law;",
        "",
        "NOW, THEREFORE, in consideration of the mutual covenants and undertakings contained herein, and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:",
      ].join("\n");
    },

    CORE_PURPOSE_001: () => {
      const rendered = resolveServicePurposeClause(documentType, namedParties, variables);
      return rendered || normalizeWhitespace(semanticContext?.objective_summary) || clause.text;
    },

    CORE_DEFINITIONS_001: () => ({
      title: hasMeaningfulValue(variables.nomenclature_terms)
        ? "Nomenclature and Definitions"
        : "Definitions",
      text: buildDefinitionsClauseText(documentType, namedParties, variables),
    }),

    CORE_INTERPRETATION_001: () => ({
      title: "Interpretation",
      text: buildInterpretationClauseText(),
    }),

    CORE_TERM_001: () => resolveServiceTermClause(documentType, namedParties, variables),

    CORE_TERMINATION_001: () => ({
      title: "Termination",
      text: resolveGenericTerminationText(namedParties, variables),
    }),

    EMPLOYMENT_ROLE_001: () =>
      `The Employer hereby appoints the Employee as ${normalizeWhitespace(
        variables.job_title || "the agreed role"
      )}${hasMeaningfulValue(variables.department) ? ` in the ${stripExternalReferencePhrases(
        variables.department,
        ""
      )} department` : ""}, and the Employee accepts such appointment. The Employee shall ordinarily work from ${normalizeWhitespace(
        variables.work_location || "the agreed work location"
      )}, shall report to the persons designated by the Employer from time to time, and shall devote full working time and attention to the Employer's business and affairs.${hasMeaningfulValue(
        variables.role_responsibilities
      ) ? ` The core role responsibilities shall include ${stripExternalReferencePhrases(
        variables.role_responsibilities,
        ""
      )}.` : ""}`,

    EMPLOYMENT_COMPENSATION_001: () =>
      `In consideration of the Employee's services, the Employer shall provide the Employee with an annual cost-to-company of ${formatCurrency(
        variables.salary
      )}, payable in the structure and cadence set out in this Agreement.${hasMeaningfulValue(
        variables.bonus_terms
      ) ? ` The following bonus, variable-pay, or incentive arrangement shall also apply: ${stripExternalReferencePhrases(
        variables.bonus_terms,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.statutory_benefits) ? ` The Employee shall additionally receive the following statutory or policy-linked benefits: ${stripExternalReferencePhrases(
        variables.statutory_benefits,
        ""
      )}.` : ""}`,

    EMP_WAGES_001: () =>
      `The Employer shall pay the Employee a gross annual cost-to-company of ${formatCurrency(
        variables.salary
      )} ('CTC'), inclusive of all statutory contributions. The salary shall be disbursed monthly on or before the seventh (7th) day of the following month, in accordance with applicable law. The compensation structure shall comprise the salary components communicated in writing by the Employer${
        variables.salary_components
          ? `, including ${normalizeWhitespace(variables.salary_components)}`
          : ""
      }. The Employer shall deduct TDS as required under the Income Tax Act, 1961${
        hasMeaningfulValue(variables.employee_pan)
          ? ` using the Employee's PAN ${normalizeWhitespace(variables.employee_pan)}`
          : ""
      }, and shall issue Form 16 annually.${hasMeaningfulValue(variables.bonus_terms) ? ` Bonus or incentive compensation shall be governed by the following arrangement: ${stripExternalReferencePhrases(
        variables.bonus_terms,
        ""
      )}.` : ""} Any revision to the Employee's compensation shall be communicated in writing. The Employer shall ensure that the total compensation is not less than the applicable minimum wage prescribed for the relevant category of employment.`,

    SERVICE_PAYMENT_001: () => {
      if (paymentMode === "distribution") {
        const pricingTerms = stripExternalReferencePhrases(
          variables.price_terms || variables.pricing_model,
          "the commercial pricing terms expressly agreed between the Parties"
        );
        return `${serviceLabels.payer} shall purchase the Products from ${serviceLabels.payee} in accordance with the following pricing arrangement: ${pricingTerms}.${hasMeaningfulValue(
          variables.minimum_purchase_quantity
        ) && hasMeaningfulValue(variables.minimum_purchase_unit) ? ` The Distributor shall maintain a minimum purchase commitment of ${normalizeWhitespace(
          variables.minimum_purchase_quantity
        )} ${normalizeWhitespace(
          variables.minimum_purchase_unit
        ).toLowerCase()}.` : hasMeaningfulValue(variables.min_purchase) ? ` The Distributor shall also comply with the following minimum purchase commitment: ${normalizeWhitespace(
          variables.min_purchase
        )}.` : ""} Payment shall be made in accordance with the following payment terms: ${normalizeWhitespace(
          variables.payment_terms || "within thirty (30) days of receipt of a valid tax invoice"
        )}. ${buildInvoiceComplianceSentence(serviceLabels.payee, variables)}${resolveGstRateSentence(
          variables
        )} In the event of delayed payment beyond the agreed due date, ${serviceLabels.payee} shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the outstanding amount from the due date until the date of actual payment. All payments shall be made by electronic transfer to the bank account designated by ${serviceLabels.payee} in writing.`;
      }

      return `In consideration of the Services rendered under this Agreement, ${serviceLabels.payer} shall pay ${serviceLabels.payee} fees of ${formatCurrency(
        resolveServiceFee(variables)
      )}. Payment shall be made in accordance with the following payment terms: ${normalizeWhitespace(
        variables.payment_terms || "within thirty (30) days of receipt of a valid tax invoice"
      )}. ${buildInvoiceComplianceSentence(serviceLabels.payee, variables)}${resolveGstRateSentence(
        variables
      )}${hasMeaningfulValue(variables.tax_responsibility) ? ` The Parties further agree that tax responsibility shall operate as follows: ${stripExternalReferencePhrases(
        variables.tax_responsibility,
        ""
      )}.` : ""} In the event of delayed payment beyond the agreed due date, ${serviceLabels.payee} shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the outstanding amount from the due date until the date of actual payment. All payments shall be made by electronic transfer to the bank account designated by ${serviceLabels.payee} in writing.`;
    },

    SERVICE_SCOPE_001: () => {
      const serviceScopeText = renderStructuredDetailText(
        `The ${actor} shall provide the following services under this Agreement:`,
        stripExternalReferencePhrases(
          variables.services_description ||
            variables.consulting_services ||
            variables.project_description ||
            "the services expressly described in this Agreement",
          "the services expressly described in this Agreement"
        ),
        { allowComma: true }
      );

      const techStackText = hasMeaningfulValue(variables.tech_stack)
        ? `The technical stack, tools, frameworks, or implementation environment currently contemplated by the Parties shall include ${stripExternalReferencePhrases(
            variables.tech_stack,
            ""
          )}.`
        : "";

      const deliverablesSentence = hasMeaningfulValue(variables.deliverables)
        ? "The Parties acknowledge that the service scope is expected to culminate in the delivery of the outputs, work product, and reporting items expressly identified in this Agreement."
        : "";
      const acceptanceSentence = hasMeaningfulValue(variables.acceptance_criteria)
        ? `The services shall be measured against the following acceptance, review, or completion standard: ${stripExternalReferencePhrases(
            variables.acceptance_criteria,
            ""
          )}.`
        : "";
      const changeControlSentence =
        documentType === "SOFTWARE_DEVELOPMENT_AGREEMENT" &&
        hasMeaningfulValue(variables.change_request_process)
          ? `Any material change to the service scope, specifications, or delivery expectations shall be handled in accordance with the following change-control process: ${stripExternalReferencePhrases(
              variables.change_request_process,
              ""
            )}.`
          : "Any material expansion or variation of the service scope, timeline, or output expectations shall require prior written agreement between the Parties, including any corresponding commercial adjustment where applicable.";

      return `${serviceScopeText}${techStackText ? `\n${techStackText}` : ""}\nThe ${actor} shall perform the services with reasonable skill, care, and diligence, in accordance with the specifications, milestones, and service standards set out in this Agreement.${resolveAvailabilitySentence(
        actor,
        variables
      )}${resolveSupportMaintenanceSentence(variables)}${deliverablesSentence ? ` ${deliverablesSentence}` : ""}${acceptanceSentence ? ` ${acceptanceSentence}` : ""} ${changeControlSentence}`;
    },

    SERVICE_DELIVERABLES_001: () => {
      const deliverablesText = renderStructuredDetailText(
        `The ${actor} shall deliver the following deliverables under this Agreement:`,
        stripExternalReferencePhrases(
          variables.deliverables ||
            variables.project_description ||
            variables.services_description ||
            "the deliverables expressly described in this Agreement",
          "the deliverables expressly described in this Agreement"
        ),
        { allowComma: true }
      );

      return `${deliverablesText}\nEach deliverable shall be provided in a form reasonably necessary for ${timelineLabels.reviewer} to review, use, and implement it, together with supporting documentation where commercially appropriate.${resolveMilestoneSentence(
        variables
      )}${resolveSourceCodeDeliverySentence(variables)}`;
    },

    SERVICE_EXPENSES_001: () =>
      resolveExpensePolicyClause(documentType, serviceLabels, variables),

    SERVICE_TERMINATION_001: () => ({
      title: "Termination",
      text: `${resolveGenericTerminationText(namedParties, variables)}${hasMeaningfulValue(
        variables.underperformance_termination
      ) ? ` The Parties additionally agree that underperformance-based termination shall operate as follows: ${stripExternalReferencePhrases(
        variables.underperformance_termination,
        ""
      )}.` : ""} Upon termination: (i) ${serviceLabels.payer} shall pay all undisputed fees accrued up to the date of termination; (ii) ${serviceLabels.payee} shall deliver all work product, work-in-progress, and data to ${serviceLabels.payer}; and (iii) both Parties shall return or securely destroy all Confidential Information of the other Party.`,
    }),

    CORE_CONFIDENTIALITY_001: () =>
      `The ${namedParties.first} and the ${namedParties.second} shall each keep confidential all Confidential Information disclosed by the other in connection with this Agreement and shall use such Confidential Information solely for the performance or enjoyment of rights under this Agreement. Neither Party shall disclose Confidential Information to any third party except to its employees, professional advisers, auditors, or subcontractors who have a strict need to know the same and who are bound by confidentiality obligations no less protective than those contained herein, or where disclosure is required by applicable law, stock exchange regulation, or order of a competent court or authority.${hasMeaningfulValue(
        variables.confidentiality_access_scope
      ) ? ` The Parties specifically agree that access to Confidential Information shall be restricted as follows: ${stripExternalReferencePhrases(
        variables.confidentiality_access_scope,
        ""
      )}.` : ""} Each Party shall exercise at least reasonable care to protect the other Party's Confidential Information and shall, upon termination or written request, promptly return or securely destroy the Confidential Information of the other Party except to the extent retention is required by law or bona fide internal record-keeping policies.`,

    NDA_CONFIDENTIAL_INFORMATION_SCOPE_001: () =>
      `"Confidential Information" means ${stripExternalReferencePhrases(
        variables.confidential_information_definition,
        "all non-public, proprietary, commercially sensitive, technical, financial, business, strategic, operational, customer, vendor, employee, and other information disclosed by either Party, whether in oral, written, visual, digital, or other form, which is designated as confidential or which by its nature ought reasonably to be regarded as confidential"
      )}.${hasMeaningfulValue(variables.confidentiality_access_scope) ? ` Access to such Confidential Information shall be limited to ${stripExternalReferencePhrases(
        variables.confidentiality_access_scope,
        ""
      )}.` : " Access to such Confidential Information shall be limited to persons with a strict need to know for the permitted purpose and who are bound by confidentiality obligations no less protective than those contained in this Agreement."}${normalizeWhitespace(
        variables.residual_knowledge_treatment
      ).toLowerCase().includes("permitted")
        ? " The Receiving Party may use information retained in the unaided memory of its personnel, provided that this does not permit deliberate memorisation, copying, or use of source materials contrary to this Agreement."
        : " No residual knowledge carve-out shall permit the Receiving Party or its personnel to use, retain, or exploit Confidential Information except as expressly permitted under this Agreement."}`,

    NDA_EXCLUSIONS_001: () =>
      `Confidential Information shall not include information that${hasMeaningfulValue(
        variables.confidentiality_exclusions
      ) ? `, in addition to the standard exclusions recognised under applicable law, is expressly agreed by the Parties to include the following excluded categories: ${stripExternalReferencePhrases(
        variables.confidentiality_exclusions,
        ""
      )}` : " is or becomes publicly available without breach of this Agreement, was lawfully known to the receiving party without restriction before disclosure, is lawfully received from a third party without confidentiality restriction, or is independently developed without reference to the disclosing party's Confidential Information"}.`,

    NDA_DISCLOSURE_PERMITTED_001: () =>
      `The ${namedParties.second} shall use Confidential Information solely for ${stripExternalReferencePhrases(
        variables.permitted_use || variables.purpose,
        "the permitted purpose expressly stated in this Agreement"
      )}.${normalizeWhitespace(variables.nda_type).toLowerCase().includes("mutual") ? ` Where the Agreement operates as a mutual NDA, each Party shall be entitled to use the other Party's Confidential Information only for that same permitted purpose.` : ""}`,

    NDA_RETURN_OF_INFORMATION_001: () => {
      const option = normalizeWhitespace(variables.return_destruction_option).toLowerCase();

      if (option.includes("return only")) {
        return `Upon expiry or earlier termination of this Agreement, or upon written demand by the ${namedParties.first}, the ${namedParties.second} shall promptly return all Confidential Information and all copies, extracts, and embodiments thereof to the ${namedParties.first}, and shall not retain any copy except where retention is mandatorily required by law.`;
      }

      if (option.includes("destroy only")) {
        return `Upon expiry or earlier termination of this Agreement, or upon written demand by the ${namedParties.first}, the ${namedParties.second} shall permanently delete, destroy, or render unreadable all Confidential Information and all copies, reproductions, summaries, and extracts thereof in its possession or control, and shall certify such destruction in writing upon request.`;
      }

      return `Upon expiry or earlier termination of this Agreement, or upon written demand by the ${namedParties.first}, the ${namedParties.second} shall return or securely destroy all Confidential Information and all copies, reproductions, summaries, and extracts thereof in accordance with the following return-and-destruction arrangement: ${stripExternalReferencePhrases(
        variables.return_destruction_option,
        "all physical copies shall be returned, all electronic copies shall be securely destroyed, and the receiving party shall certify compliance upon request"
      )}.`;
    },

    EMP_CONFIDENTIALITY_001: () =>
      `The Employee acknowledges that, during the course of employment, the Employee shall have access to confidential and proprietary information of the Employer, including information relating to business operations, finances, technology, customers, suppliers, pricing, plans, personnel, and trade secrets. The Employee shall keep all such information strictly confidential, shall use it solely for the purposes of employment with the Employer, and shall not disclose it to any third party except as required for the proper performance of duties or as required by law.${hasMeaningfulValue(
        variables.employee_confidentiality_scope
      ) ? ` The Parties specifically agree that the Employee's confidentiality obligations shall operate as follows: ${stripExternalReferencePhrases(
        variables.employee_confidentiality_scope,
        ""
      )}.` : ""} Upon cessation of employment, the Employee shall promptly return all confidential materials, records, credentials, devices, and property of the Employer and shall not retain copies except where required by law.`,

    IP_OWNERSHIP_001: () =>
      resolveOwnershipAssignmentClause(
        serviceLabels.payer || namedParties.first,
        serviceLabels.payee || namedParties.second,
        variables.ip_ownership
      ),

    IP_ASSIGNMENT_001: () =>
      resolveOwnershipAssignmentClause(
        serviceLabels.payer || namedParties.first,
        serviceLabels.payee || namedParties.second,
        variables.ip_ownership
      ),

    EMP_IP_ASSIGNMENT_001: () =>
      `All intellectual property, inventions, discoveries, improvements, documents, code, designs, materials, and work product created, conceived, authored, or reduced to practice by the Employee in the course of employment or using the Employer's resources shall be dealt with as follows: ${stripExternalReferencePhrases(
        variables.ip_ownership,
        "all such rights shall vest exclusively in the Employer from creation, and the Employee shall execute all documents reasonably required to perfect or record such vesting or assignment"
      )}. The Employee shall promptly disclose to the Employer all such intellectual property and shall retain ownership only of pre-existing materials that were created independently of the employment and are not incorporated into the Employer's work product except under an agreed licence.`,

    CORE_INDEMNITY_001: () =>
      `Each Party ('Indemnifying Party') shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives from and against ${resolveIndemnityScopeText(
        variables
      )}. The indemnified Party shall promptly notify the Indemnifying Party of any claim for which indemnity is sought, shall provide reasonable cooperation at the cost of the Indemnifying Party, and shall not settle any third-party claim affecting the Indemnifying Party without prior consultation, except where urgent action is reasonably required to mitigate loss.`,

    CORE_LIABILITY_CAP_001: () =>
      `Except for liability arising from fraud, wilful misconduct, breach of confidentiality, deliberate infringement or misappropriation of intellectual property rights, and any liability that cannot be excluded or limited under applicable law, the aggregate liability of either Party under or in connection with this Agreement, whether in contract, tort (including negligence), breach of statutory duty, or otherwise, ${resolveLiabilityCapText(
        variables
      )}. Neither Party shall be liable for indirect, incidental, special, punitive, exemplary, or consequential loss, including loss of profits, loss of opportunity, or loss of business, except to the extent expressly recoverable under an agreed indemnity or as mandated by law.`,

    CORE_LIMITATION_LIABILITY_001: () =>
      `Except for liability arising from fraud, wilful misconduct, breach of confidentiality, deliberate infringement or misappropriation of intellectual property rights, and any liability that cannot be excluded or limited under applicable law, the aggregate liability of either Party under or in connection with this Agreement, whether in contract, tort (including negligence), breach of statutory duty, or otherwise, ${resolveLiabilityCapText(
        variables
      )}. Neither Party shall be liable for indirect, incidental, special, punitive, exemplary, or consequential loss, including loss of profits, loss of opportunity, or loss of business, except to the extent expressly recoverable under an agreed indemnity or as mandated by law.`,

    EMP_NON_SOLICITATION_001: () => ({
      title: "Non-Solicitation",
      text: `During the term of this Agreement and for a period of ${resolveRestrictionPeriod(
        variables
      )} following its termination or expiry, neither the ${namedParties.first} nor the ${namedParties.second} shall, directly or indirectly, solicit, induce, recruit, or encourage any employee, personnel member, independent contractor, or key representative of the other Party to terminate their engagement with such other Party or to enter into any employment or engagement with the soliciting Party or any of its affiliates, without the prior written consent of the other Party.`,
    }),

    EMP_NON_COMPETE_001: () => ({
      title: "Non-Compete",
      text: renderDocumentSpecificNonCompeteClause(documentType, namedParties, variables),
    }),

    NDA_NON_SOLICITATION_001: () => ({
      title: "Non-Solicitation",
      text: renderMutualNonSolicitationClause(namedParties, variables),
    }),

    NDA_NON_COMPETE_001: () => ({
      title: "Non-Compete",
      text: renderDocumentSpecificNonCompeteClause(documentType, namedParties, variables),
    }),

    MOU_NON_BINDING_001: () => ({
      title: "Binding Nature",
      text: renderMouBindingClause(variables),
    }),

    SERVICE_REPORTING_001: () => {
      return `The ${actor} shall submit written progress and status reports to ${timelineLabels.reviewer}, setting out the work completed, milestones achieved, issues encountered, anticipated delays, and next steps, at a reasonable periodic frequency consistent with the deliverables and reporting requirements recorded in this Agreement.`;
    },

    SERVICE_SLA_001: () => {
      return `The ${actor} shall meet the following service levels and performance standards under this Agreement: ${normalizeWhitespace(
        variables.service_levels || "the service levels expressly recorded in this Agreement"
      )}. If ${timelineLabels.performer} fails to meet a material service level, ${timelineLabels.reviewer} shall be entitled to require a remediation plan, reasonable corrective action, and such service credits or other contractual remedies as are expressly stated in this Agreement.${resolveDelayRemediesSentence(
        timelineLabels.reviewer,
        variables
      )} The ${actor} shall also provide timely performance reporting reasonably necessary to verify compliance with these service levels.`;
    },

    SUPPLY_DELIVERY_001: () =>
      `The Supplier shall deliver the Goods${hasMeaningfulValue(
        variables.quantity
      ) ? ` in the quantity of ${normalizeWhitespace(variables.quantity)}` : ""}${hasMeaningfulValue(
        variables.delivery_location
      ) ? ` to ${stripExternalReferencePhrases(variables.delivery_location, "")}` : " to the agreed delivery location"}${hasMeaningfulValue(
        variables.delivery_date
      ) ? ` on or before ${formatDate(variables.delivery_date)}` : ""}. Delivery shall be carried out in accordance with the following delivery arrangement: ${stripExternalReferencePhrases(
        variables.delivery_terms,
        "delivery shall be completed in the ordinary course using commercially reasonable transport, packaging, and handover procedures"
      )}. Delivery shall be deemed complete only when the Goods and all accompanying documentation have been tendered in accordance with this Agreement.`,

    SUPPLY_PAYMENT_001: () =>
      `The Buyer shall pay the Supplier the purchase price of ${formatCurrency(
        variables.price
      )} in accordance with the following payment terms: ${normalizeWhitespace(
        variables.payment_terms || "within thirty (30) days of receipt of a valid invoice"
      )}. ${buildInvoiceComplianceSentence("the Supplier", variables)}${resolveGstRateSentence(
        variables
      )} All payments shall be made by electronic transfer to the Supplier's designated bank account. In the event of delayed payment, the Supplier shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the overdue amount from the due date until actual payment. All amounts are exclusive of GST and other applicable taxes which shall be borne by the Buyer. The Buyer shall not withhold payment on account of any disputed claim without the Supplier's written consent.`,

    SUPPLY_QUALITY_001: () =>
      `The Supplier warrants that all Goods supplied under this Agreement, namely ${normalizeWhitespace(
        variables.goods_description || variables.product_description || "the agreed goods"
      )}, shall conform strictly to the specifications, descriptions, and samples described in this Agreement and related purchase documentation; be of merchantable quality and fit for their intended purpose; be free from defects in design, materials, and workmanship; comply with all applicable Indian standards and legal requirements; and be properly labelled and packaged in accordance with applicable law. The Supplier shall maintain a quality management system and shall permit the Buyer to conduct quality audits upon reasonable notice.`,

    SUPPLY_WARRANTY_001: () =>
      `The Supplier warrants that all Goods supplied under this Agreement shall be free from defects in materials, workmanship, and design for a period of ${normalizeWhitespace(
        variables.warranty_period || "twelve (12) months"
      )} from the date of delivery ('Warranty Period'); shall conform to the agreed specifications and applicable standards; and shall be fit for their intended purpose. During the Warranty Period, the Supplier shall, at the Buyer's option and at the Supplier's cost, repair or replace defective Goods or refund the purchase price for any defective Goods that cannot be rectified within a reasonable time.`,

    SUPPLY_INSPECTION_001: () =>
      `The Buyer shall have the right to inspect the Goods upon delivery and before final acceptance to ascertain their conformity with the specifications and terms of this Agreement. The Buyer shall complete such inspection within ${Math.max(
        2,
        parseNumberish(variables.inspection_timeline_days) || 7
      )} Business Days after delivery.${hasMeaningfulValue(
        variables.inspection_acceptance_terms
      ) ? ` The Parties specifically agree that inspection and acceptance shall operate as follows: ${stripExternalReferencePhrases(
        variables.inspection_acceptance_terms,
        ""
      )}.` : " If the Goods are non-conforming, the Buyer shall give written notice specifying the defects in reasonable detail, and the Supplier shall promptly replace, repair, or otherwise remedy the non-conformity in accordance with this Agreement."}`,

    SUPPLY_RISK_TRANSFER_001: () =>
      `Risk of loss, damage, or destruction of the Goods shall pass from the Supplier to the Buyer ${normalizeWhitespace(
        variables.risk_transfer_stage
      ).toLowerCase().includes("carrier")
        ? "upon delivery of the Goods to the first carrier"
        : normalizeWhitespace(variables.risk_transfer_stage).toLowerCase().includes(
            "destination"
          )
          ? `upon delivery of the Goods at ${normalizeWhitespace(
              variables.delivery_location || "the agreed destination"
            )}`
          : normalizeWhitespace(variables.risk_transfer_stage).toLowerCase().includes(
              "inspection"
            )
            ? "upon completion of inspection and acceptance by the Buyer"
            : normalizeWhitespace(variables.risk_transfer_stage).toLowerCase().includes(
                "title"
              )
              ? "simultaneously with transfer of title"
              : `upon delivery of the Goods at ${normalizeWhitespace(
                  variables.delivery_location || "the agreed delivery location"
                )}`}, provided that the Goods conform to the contract description and are accompanied by all required documentation.${hasMeaningfulValue(
        variables.risk_transfer_terms
      ) ? ` The Parties specifically agree that risk transfer shall operate as follows: ${stripExternalReferencePhrases(
        variables.risk_transfer_terms,
        ""
      )}.` : " Where delivery is by carrier, risk shall pass to the Buyer upon delivery to the first carrier unless the Supplier has specifically arranged for transit insurance, in which case risk passes upon delivery at the destination."} ${hasMeaningfulValue(
        variables.title_transfer_terms
      ) ? `Title to the Goods shall pass in accordance with the following arrangement: ${stripExternalReferencePhrases(
        variables.title_transfer_terms,
        ""
      )}.` : "Title to the Goods shall pass to the Buyer simultaneously with the passing of risk, subject to the Supplier's receipt of full payment of the applicable invoice."}`,

    SERVICE_TIMELINES_001: () =>
      `${timelineLabels.performer} shall perform the Services in accordance with the project timeline and milestones expressly agreed in this Agreement${
        variables.delivery_date
          ? `, with the target completion date being ${formatDate(
              variables.delivery_date
            )}`
          : variables.contract_duration
            ? `, over the duration of ${normalizeWhitespace(variables.contract_duration)}`
            : ""
      }. Time is of the essence in respect of any milestone dates expressly agreed between the Parties.${resolveMilestoneSentence(
        variables
      )} In the event that ${timelineLabels.performer} anticipates a delay in meeting any milestone, ${timelineLabels.performer} shall notify ${timelineLabels.reviewer} in writing at least seven (7) days in advance, specifying the cause of the delay and a revised completion date. ${timelineLabels.reviewer} shall not unreasonably withhold approval of a revised timeline where delay has been caused by ${timelineLabels.reviewer}'s failure to provide timely inputs, approvals, or resources.${resolveDelayRemediesSentence(
        timelineLabels.reviewer,
        variables
      )}`,

    TECH_ACCEPTANCE_001: () =>
      `Upon delivery of the Software or any milestone deliverable, ${serviceLabels.payer} shall have a period of fifteen (15) business days ('Acceptance Testing Period') to test and evaluate the Software against ${stripExternalReferencePhrases(
        variables.acceptance_criteria,
        "the agreed acceptance criteria described in this Agreement"
      )} and the project scope${
        variables.project_description
          ? ` for ${normalizeWhitespace(variables.project_description)}`
          : ""
      }. If the Software meets the Acceptance Criteria, ${serviceLabels.payer} shall issue a written acceptance notice. If the Software fails to meet the Acceptance Criteria, ${serviceLabels.payer} shall notify ${serviceLabels.payee} in writing specifying the defects in reasonable detail, and ${serviceLabels.payee} shall remedy such defects within fifteen (15) business days of such notice, following which the Acceptance Testing Period shall recommence.${resolveSourceCodeDeliverySentence(
        variables
      )} If ${serviceLabels.payer} fails to issue an acceptance notice or a defect notice within the Acceptance Testing Period, the Software shall be deemed accepted.`,

    SERVICE_ACCEPTANCE_001: () =>
      `${serviceLabels.payer} shall review the relevant Services or deliverables against ${stripExternalReferencePhrases(
        variables.acceptance_criteria,
        "the agreed specifications and acceptance criteria described in this Agreement"
      )}. Unless a different review period is expressly agreed, ${serviceLabels.payer} shall notify ${serviceLabels.payee} of any material non-conformity within ${Math.max(
        5,
        resolveCurePeriodDays(variables, 10)
      )} Business Days after the relevant delivery or completion milestone. If ${serviceLabels.payer} does not issue such notice within that period, the Services or deliverables shall be deemed accepted. Upon receipt of a valid non-conformity notice, ${serviceLabels.payee} shall promptly correct the identified deficiencies and resubmit the affected Services or deliverables for review.`,

    SERVICE_CHANGE_REQUEST_001: () =>
      `Any request for a change to the Services, scope of work, specifications, timelines, fees, or deliverables under this Agreement shall be raised through the following change-control mechanism: ${stripExternalReferencePhrases(
        variables.change_request_process,
        "the requesting Party shall submit a written change request describing the proposed change, the Parties shall assess its legal, commercial, technical, and timeline impact, and no change shall become binding unless approved in writing by authorised representatives of both Parties"
      )}. Until such written approval is granted, the existing scope, timelines, fees, and obligations shall continue to apply.`,

    EMP_PROBATION_001: () =>
      `The Employee shall be on probation for ${normalizeWhitespace(
        variables.probation_period || "the period expressly stated in this Agreement"
      )}, during which the Employer shall assess performance, conduct, role fit, and overall suitability. During probation, the employment may be confirmed, extended, or terminated in accordance with applicable labour laws, the notice obligations under this Agreement, and the Employer's lawful policies.`,

    EMP_DUTIES_001: () =>
      `The Employee shall, during the term of employment, faithfully and diligently perform the duties attached to the Employee's role and shall comply with all lawful directions of the Employer that are consistent with the Employee's designation.${hasMeaningfulValue(
        variables.role_responsibilities
      ) ? ` The Parties specifically agree that the Employee's core duties and responsibilities shall include ${stripExternalReferencePhrases(
        variables.role_responsibilities,
        ""
      )}.` : ""} The Employee shall avoid conflicts of interest, shall not misuse the Employer's information or resources, and shall act at all times in the best interests of the Employer within the scope of employment.`,

    EMP_WORKING_HOURS_001: () =>
      `The Employee's normal working hours shall be ${normalizeWhitespace(
        variables.working_hours || "the hours prescribed by the Employer's lawful policy"
      )} hours per week${hasMeaningfulValue(variables.work_location) ? ` at ${stripExternalReferencePhrases(
        variables.work_location,
        ""
      )}` : ""}, subject always to applicable labour laws, rest intervals, and overtime requirements. The Employer may require reasonable additional hours where business necessity so requires, provided that all statutory limits, overtime rules, and safety obligations are complied with.`,

    EMP_LEAVE_POLICY_001: () =>
      `The Employee shall be entitled to leave in accordance with applicable labour laws and the following leave policy: ${stripExternalReferencePhrases(
        variables.leave_policy,
        "earned leave, sick leave, casual leave, public holidays, and such other leave as may be mandated by law or prescribed under the Employer's policy"
      )}. Leave shall be administered in accordance with the Employer's lawful leave-approval process, and statutory leave entitlements shall not be reduced or denied by policy.`,

    EMP_BENEFITS_001: () =>
      `During the term of employment, the Employee shall receive statutory and policy-based benefits in accordance with applicable law.${hasMeaningfulValue(
        variables.statutory_benefits
      ) ? ` The Parties specifically agree that the benefits package shall include ${stripExternalReferencePhrases(
        variables.statutory_benefits,
        ""
      )}.` : " This shall include Provident Fund, Employee State Insurance where applicable, gratuity when statutorily due, and such other mandatory benefits as are required under applicable law."}${hasMeaningfulValue(
        variables.bonus_terms
      ) ? ` Any performance-linked or discretionary bonus shall be governed by the following terms: ${stripExternalReferencePhrases(
        variables.bonus_terms,
        ""
      )}.` : ""}`,

    EMP_NOTICE_PERIOD_001: () =>
      `Either the Employer or the Employee may terminate the employment relationship by giving ${Math.max(
        1,
        parseNumberish(variables.notice_period_days) || 30
      )} days' prior written notice or salary in lieu of such notice, subject to the Employee's termination structure and applicable law. Any shorter or longer notice arrangement shall operate only to the extent lawfully permissible and expressly recorded in this Agreement.`,

    EMPLOYMENT_TERMINATION_001: () => {
      const terminationType = normalizeWhitespace(
        variables.employment_termination_type
      ).toLowerCase();
      const noticeDays = parseNumberish(variables.notice_period_days) || 30;
      const cureDays = resolveCurePeriodDays(variables, 7);

      let structure =
        `Either the Employer or the Employee may terminate the employment relationship by giving ${noticeDays} days' prior written notice or salary in lieu of such notice, subject to applicable labour laws.`;
      if (terminationType.includes("cause")) {
        structure =
          `The Employer may terminate the Employee for cause, including misconduct, fraud, gross negligence, wilful disobedience, breach of confidentiality, or material violation of lawful policy, subject to applicable labour-law process and natural justice, and the Employee may resign upon ${noticeDays} days' prior written notice unless otherwise waived in writing by the Employer.`;
      } else if (terminationType.includes("fixed-term")) {
        structure =
          `This employment is intended to continue for the agreed tenure unless terminated earlier in accordance with this Agreement, including by either Party upon ${noticeDays} days' prior written notice and by the Employer for cause in accordance with applicable law.`;
      }

      return `${structure} Where any breach is capable of remedy, the defaulting Party shall be afforded up to ${cureDays} days to remedy the same after written notice if such cure period is required by applicable law or the Employer's policies. On termination, the Employee shall remain entitled to accrued salary, reimbursable expenses, earned statutory dues, and other amounts lawfully payable up to the termination date.`;
    },

    EMP_TERMINATION_001: () => ({
      title: "Termination Consequences",
      text: `Upon cessation of employment for any reason, the Employee shall immediately cease representing the Employer, shall return all records, confidential information, devices, credentials, and property belonging to the Employer, shall complete all reasonable handover requirements, and shall cooperate in the orderly transition of pending responsibilities. All confidentiality, intellectual property, restrictive covenant, and other survival obligations that by their nature are intended to continue after termination shall remain in full force according to their terms.`,
    }),

    JV_CONTRIBUTION_001: () =>
      `Each Party shall contribute to the Joint Venture the agreed resources, expertise, and capital. Party 1 shall contribute ${formatCurrency(
        variables.capital_contribution_1
      )} and Party 2 shall contribute ${formatCurrency(
        variables.capital_contribution_2
      )}. Profits and losses arising from the Joint Venture shall be shared between the Parties in the ratio of ${normalizeWhitespace(
        variables.profit_sharing_ratio || "the agreed ratio"
      )}. Each Party's contribution shall be made within the timeframes agreed between the Parties in writing, and failure to contribute shall constitute a material breach of this Agreement.`,

    JV_GOVERNANCE_001: () =>
      `The Joint Venture shall be managed by a Management Committee comprising equal representatives from each Party.${hasMeaningfulValue(
        variables.jv_structure
      ) ? ` The Parties further agree that the Joint Venture structure shall be as follows: ${stripExternalReferencePhrases(
        variables.jv_structure,
        ""
      )}.` : ""}${hasMeaningfulValue(
        variables.management_control
      ) ? ` The Parties specifically agree that management control shall operate as follows: ${stripExternalReferencePhrases(
        variables.management_control,
        ""
      )}.` : " Decisions of the Management Committee shall require unanimous consent for major decisions and a simple majority for routine operational decisions."} Major decisions shall include approval of the annual budget, entry into any third-party contract outside the ordinary course of business, any material change in the scope of the Joint Venture, and admission of any new party to the Joint Venture. Each Party shall designate its representatives to the Management Committee in writing and may replace them at any time on written notice.`,

    CORP_SHARE_SUBSCRIPTION_001: () =>
      `Each Shareholder shall subscribe to and hold shares in ${normalizeWhitespace(
        variables.company_name || "the Company"
      )}${hasMeaningfulValue(variables.company_cin) ? ` bearing Corporate Identification Number ${normalizeWhitespace(
        variables.company_cin
      )}` : ""}${hasMeaningfulValue(variables.company_address) ? ` and having its registered office at ${stripExternalReferencePhrases(
        variables.company_address,
        ""
      )}` : ""} in the proportions recorded in this Agreement. Shareholder 1 shall hold ${normalizeWhitespace(
        variables.shareholding_percentage_1 || "the agreed"
      )}% and Shareholder 2 shall hold ${normalizeWhitespace(
        variables.shareholding_percentage_2 || "the agreed"
      )}%. The subscription for shares constitutes lawful consideration for this Agreement. Any further issue of shares shall be subject to the pre-emptive and transfer rights set out in this Agreement and the applicable provisions of the Companies Act, 2013.`,

    CORP_BOARD_COMPOSITION_001: () =>
      `The governance structure of the Company shall operate as follows: ${stripExternalReferencePhrases(
        variables.board_structure,
        "the Board of Directors shall comprise the agreed number of directors, with nomination and participation rights allocated in accordance with this Agreement"
      )}.${hasMeaningfulValue(
        variables.voting_rights
      ) ? ` Voting rights on shareholder and board matters shall be exercised in accordance with the following arrangement: ${stripExternalReferencePhrases(
        variables.voting_rights,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.reserved_matters) ? ` The following matters shall constitute reserved matters requiring the specified higher approval threshold: ${stripExternalReferencePhrases(
        variables.reserved_matters,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.dividend_policy) ? ` Dividend declaration and distribution shall be governed by the following policy: ${stripExternalReferencePhrases(
        variables.dividend_policy,
        ""
      )}.` : ""}`,

    PARTNERSHIP_CAPITAL_001: () =>
      `Each Partner shall contribute capital to the partnership in the following amounts: Partner 1 shall contribute ${formatCurrency(
        variables.capital_contribution_1
      )} and Partner 2 shall contribute ${formatCurrency(
        variables.capital_contribution_2
      )}. The capital contributions shall be held in the name of the partnership${hasMeaningfulValue(
        variables.partnership_name
      ) ? `, namely ${normalizeWhitespace(variables.partnership_name)}` : ""}${hasMeaningfulValue(
        variables.business_address
      ) ? `, carrying on business from ${stripExternalReferencePhrases(
        variables.business_address,
        ""
      )}` : ""}, and shall not be withdrawn except in accordance with this Deed. Profits and losses of the partnership shall be shared among the Partners in the ratio of ${normalizeWhitespace(
        variables.profit_sharing_ratio || "the agreed ratio"
      )}, and each Partner acknowledges that the capital contribution constitutes lawful consideration for this Agreement within the meaning of Section 2(d) of the Indian Contract Act, 1872.${hasMeaningfulValue(
        variables.partner_roles
      ) ? ` The roles and duties of the Partners shall be as follows: ${stripExternalReferencePhrases(
        variables.partner_roles,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.decision_making_rules) ? ` Decisions concerning the business and affairs of the Firm shall be taken in accordance with the following arrangement: ${stripExternalReferencePhrases(
        variables.decision_making_rules,
        ""
      )}.` : ""}${hasMeaningfulValue(
        variables.partner_dispute_resolution
      ) ? ` Any dispute between the Partners in relation to the affairs of the Firm shall first be handled as follows: ${stripExternalReferencePhrases(
        variables.partner_dispute_resolution,
        ""
      )}.` : ""}${hasMeaningfulValue(
        variables.admission_removal_terms
      ) ? ` Admission of new Partners and removal or retirement of existing Partners shall be governed by the following arrangement: ${stripExternalReferencePhrases(
        variables.admission_removal_terms,
        ""
      )}.` : ""}${hasMeaningfulValue(
        variables.partner_exit_mechanism
      ) ? ` The following partner exit mechanism shall apply: ${stripExternalReferencePhrases(
        variables.partner_exit_mechanism,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.bank_name) ? ` The Firm's banking operations shall be conducted through ${stripExternalReferencePhrases(
        variables.bank_name,
        ""
      )}${hasMeaningfulValue(variables.drawing_limit) ? ` with partner drawing authority operating in accordance with the following limit or approval arrangement: ${stripExternalReferencePhrases(
        variables.drawing_limit,
        ""
      )}` : ""}.` : ""}${hasMeaningfulValue(variables.dissolution_terms) ? ` Dissolution shall be governed by the following agreed terms: ${stripExternalReferencePhrases(
        variables.dissolution_terms,
        ""
      )}.` : ""}`,

    CORP_SHARE_TRANSFER_001: () =>
      `No Shareholder shall transfer, assign, pledge, or otherwise dispose of any shares held by it without complying with the transfer restrictions in this Agreement. Before transferring any shares to a third party, the transferring Shareholder shall first offer those shares to the remaining Shareholders on a pro-rata basis under a right of first refusal. The remaining Shareholders shall have ${Math.max(
        15,
        parseNumberish(variables.rofr_period) || 30
      )} days from receipt of the transfer notice to exercise that right.${hasMeaningfulValue(
        variables.exit_rights
      ) ? ` The Parties further agree that shareholder exit and liquidity rights shall operate as follows: ${stripExternalReferencePhrases(
        variables.exit_rights,
        ""
      )}.` : ""} Any transfer made in breach of this clause shall be void to the fullest extent permitted by applicable law and the constitutional documents of the Company shall, where necessary, be aligned with these transfer restrictions.`,

    CORP_TAG_ALONG_001: () =>
      `If any Shareholder proposes to sell, transfer, or otherwise dispose of any shares to a third-party purchaser, each other Shareholder shall have the right, but not the obligation, to participate in such sale by selling a pro-rata portion of its shares to such third party on the same price, terms, and conditions. The Selling Shareholder shall give not less than thirty (30) days' prior written notice to all other Shareholders before completing any such sale.${hasMeaningfulValue(
        variables.tag_along_rights
      ) ? ` The Parties specifically agree that the tag-along mechanics shall operate as follows: ${stripExternalReferencePhrases(
        variables.tag_along_rights,
        ""
      )}.` : ""}${hasMeaningfulValue(variables.exit_rights) ? ` These tag-along rights form part of the overall shareholder exit rights agreed between the Parties, including the following liquidity protection: ${stripExternalReferencePhrases(
        variables.exit_rights,
        ""
      )}.` : ""}`,

    CORP_DRAG_ALONG_001: () =>
      `If the Majority Shareholders, holding more than ${normalizeWhitespace(
        variables.drag_threshold || "75"
      )}% of the issued and paid-up share capital, receive a bona fide offer from a third party to acquire one hundred percent (100%) of the shares of the Company, they shall have the right to require all other Shareholders to sell their shares to such third party on the same price, terms, and conditions as accepted by the Majority Shareholders. The Majority Shareholders shall give not less than thirty (30) days' prior written notice before exercising such right, and the drag-along price per share shall not be less than the price per share offered to the Majority Shareholders.`,

    CORP_DEADLOCK_001: () =>
      `A deadlock shall be deemed to occur if the relevant decision-making body or the Parties fail to reach a decision on a reserved or material matter within thirty (30) days after the matter is first tabled.${hasMeaningfulValue(
        variables.deadlock_resolution
      ) ? ` Upon the occurrence of a deadlock, the following mechanism shall apply: ${stripExternalReferencePhrases(
        variables.deadlock_resolution,
        ""
      )}.` : " Upon the occurrence of a deadlock, senior representatives of the Parties shall meet in good faith to attempt a resolution, failing which either Party may invoke the agreed dispute-resolution mechanism or trigger a valuation-led buyout or sale process where such remedy is expressly available under this Agreement."}`,

    JV_EXIT_001: () =>
      `Upon termination of this Agreement or upon a Party's wish to exit the Joint Venture, the following exit mechanism shall apply: ${stripExternalReferencePhrases(
        variables.exit_terms,
        "the exiting Party shall give not less than ninety (90) days' prior written notice, the non-exiting Party shall have a right of first offer to acquire the exiting Party's interest at fair market value determined by an independent valuer, and if no buyout is completed within the agreed period the Parties shall jointly implement a commercially reasonable unwind, transfer, or sale process"
      )}. Unless the Parties agree otherwise in writing, the allocation of assets, liabilities, contracts, and intellectual property on exit shall reflect the agreed ownership structure and the Parties' respective contributions.`,

    IP_TRADEMARK_USAGE_001: () =>
      `Subject to the terms and conditions of this Agreement, ${namedParties.first} grants ${namedParties.second} a limited licence to use the relevant trade names, marks, logos, and brand materials solely for the purpose of marketing and distributing the contracted products within the agreed Territory during the term of this Agreement.${hasMeaningfulValue(
        variables.branding_rights
      ) ? ` The Parties specifically agree that branding and trademark usage shall operate as follows: ${stripExternalReferencePhrases(
        variables.branding_rights,
        ""
      )}.` : ""} ${namedParties.second} shall comply with all brand guidelines, quality standards, and approval requirements communicated by ${namedParties.first}, shall not register or attempt to register any confusingly similar mark, and acknowledges that all goodwill arising from use of the marks shall inure solely to the benefit of ${namedParties.first}.`,

    RENT_PROPERTY_USE_001: () =>
      `The Tenant shall use the Premises solely for the purpose of ${normalizeWhitespace(
        variables.permitted_use || "lawful use of the premises"
      )}, and for no other purpose whatsoever without the prior written consent of the Landlord. The Tenant shall not carry out any illegal or immoral activity on the Premises, store hazardous goods without prior consent, use the Premises in a manner constituting a nuisance, or sublet or licence the Premises without prior written consent.${hasMeaningfulValue(
        variables.society_rules
      ) ? ` The Tenant shall also comply with the following building, society, or occupier rules: ${stripExternalReferencePhrases(
        variables.society_rules,
        ""
      )}.` : ""} Any breach of this clause shall entitle the Landlord to terminate this Agreement after written notice in accordance with applicable law.`,

    RENT_UTILITIES_001: () =>
      `The Tenant shall be responsible for payment of all utility charges in respect of the Premises during the tenancy, including electricity, water, gas, internet, telephone, and cable charges, based on actual consumption. The Tenant shall pay such bills directly to the respective utility providers before the due date and shall ensure no default occurs. ${resolveMaintenanceSentence(
        variables
      )} Upon vacation, the Tenant shall provide the Landlord with final meter readings or no-dues confirmations from the relevant utility providers. Any arrears of utility charges attributable to the Tenant's period of occupation may be deducted from the Security Deposit.`,

    RENT_SECURITY_DEPOSIT_001: () =>
      `The Tenant shall pay to the Landlord a refundable security deposit of ${formatCurrency(
        variables.security_deposit
      )} prior to or at the time of execution of this Agreement. The Security Deposit shall be held as security for due performance of the Tenant's obligations, shall not carry interest unless expressly agreed otherwise, and shall be refunded within thirty (30) days after the Tenant vacates and delivers peaceful possession, subject only to deductions for unpaid rent, documented damage beyond fair wear and tear, and other amounts lawfully due under this Agreement.`,

    RENTAL_SECURITY_DEPOSIT_001: () =>
      `The Licensee/Tenant shall pay a refundable security deposit of ${formatCurrency(
        variables.security_deposit
      )} prior to or at the time of execution of this Agreement. The security deposit shall be held as security for the due performance of the Licensee/Tenant's obligations and shall not carry interest. The Licensor/Landlord shall refund the security deposit within thirty (30) days of the Licensee/Tenant vacating the Premises and delivering peaceful possession, after deducting any outstanding dues, unpaid license fee or rent, or costs of repairing damage caused by the Licensee/Tenant beyond fair wear and tear. The Licensor/Landlord shall furnish a written account of all deductions made.`,

    RENT_RENT_INCREASE_001: () =>
      `The monthly rent or licence fee payable under this Agreement shall be subject to periodic escalation at the rate of ${normalizeWhitespace(
        variables.rent_escalation || "five"
      )}% on each anniversary of the commencement date or at such other interval expressly stated in this Agreement. Any renewal of this Agreement shall use the then-current rent as the base for subsequent escalation calculations unless the Parties agree otherwise in writing.`,

    RENT_LOCKIN_PERIOD_001: () =>
      `The Parties agree that this Agreement shall be subject to a lock-in period of ${normalizeWhitespace(
        variables.lock_in_period || "the agreed lock-in period"
      )}, during which neither Party may terminate for convenience except as expressly provided for material breach or non-payment. If the occupant vacates during the lock-in period without a contractual right to do so, the financial and handover consequences shall be determined in accordance with this Agreement and applicable law.`,

    RENT_TERMINATION_001: () =>
      `This Agreement may be terminated by either Party upon ${Math.max(
        15,
        resolveTerminationNoticeDays(variables)
      )} days' prior written notice after expiry of the lock-in period, if any.${hasMeaningfulValue(
        variables.lock_in_period
      ) ? ` The Parties confirm that the lock-in period shall be ${normalizeWhitespace(
        variables.lock_in_period
      )}.` : ""} This Agreement may also be terminated earlier for non-payment, unlawful use, material damage, or other material breach that remains unremedied after notice. Upon termination, the Tenant shall vacate the Premises, return possession, and comply with all exit and settlement obligations under this Agreement.`,

    RENTAL_TERMINATION_001: () =>
      `This Agreement may be terminated: (a) by either Party by providing ${Math.max(
        15,
        resolveTerminationNoticeDays(variables)
      )} days' prior written notice after expiry of the lock-in period, if any${hasMeaningfulValue(
        variables.lock_in_period
      ) ? `, such lock-in period being ${normalizeWhitespace(variables.lock_in_period)}` : ""}; and (b) by the Licensor/Landlord immediately upon material breach, persistent payment default, or unlawful use, subject to the contractual cure process and applicable law. Upon termination, the Licensee/Tenant shall vacate the Premises within the notice period, return them in the same condition as at commencement (reasonable wear and tear excepted), and hand over all keys and access devices.`,

    PROP_REGISTRATION_001: () =>
      `The Parties acknowledge that this Agreement shall be stamped and, where required by law, registered in accordance with the applicable State Stamp Act and the Registration Act, 1908.${normalizeBooleanChoice(
        variables.police_verification_required,
        false
      ) ? " Police verification of the occupant shall be mandatory, and the Parties shall cooperate in filing the prescribed police-verification or tenant-information forms with the competent local authority." : ""}${hasMeaningfulValue(
        variables.society_rules
      ) ? ` The Parties shall also comply with the following society, association, or building-compliance requirements: ${stripExternalReferencePhrases(
        variables.society_rules,
        ""
      )}.` : ""} Stamp duty and registration charges shall be borne in the manner agreed by the Parties or, in the absence of a specific agreement, equally.`,

    CORE_RELATIONSHIP_OF_PARTIES_001: () =>
      `The Parties acknowledge and agree that the relationship created by this Agreement is that of independent contracting parties and not of employer and employee, partnership, joint venture, agency, or fiduciary relationship.${normalizeBooleanChoice(
        variables.no_employment_ack,
        false
      ) ? ` The Parties expressly acknowledge that no employment, labour, or service relationship is intended or created by this Agreement, and neither Party shall represent otherwise.` : ""}${hasMeaningfulValue(
        variables.tax_responsibility
      ) ? ` Responsibility for GST, TDS, professional tax, income tax, and other applicable taxes shall be allocated as follows: ${stripExternalReferencePhrases(
        variables.tax_responsibility,
        ""
      )}.` : ""}`,

    CORE_SIGNATURE_BLOCK_001: () => ({
      title: clause.title || "Execution and Signatures",
      text: buildSignatureBlockText(
        documentType,
        getParticipantExpectations(documentType, variables)
      ),
    }),

    TECH_SOURCE_CODE_001: () =>
      `The Developer shall, upon final acceptance of the Software, deliver to the Client all source code, object code, technical documentation, build scripts, repositories, credentials, and related materials in accordance with the following arrangement: ${stripExternalReferencePhrases(
        variables.source_code_delivery,
        "the complete and current source materials shall be transferred to the Client together with all credentials, deployment artefacts, and technical documentation reasonably necessary to use, maintain, and modify the Software"
      )}.${normalizeBooleanChoice(variables.escrow_required, false) ? " The Parties shall also establish and maintain a source-code escrow arrangement with a mutually agreed escrow agent, with release events tied to insolvency, prolonged maintenance default, or cessation of business by the Developer." : " No source-code escrow arrangement shall apply unless the Parties separately agree otherwise in writing."}`,

    TECH_WARRANTY_001: () =>
      `The Developer warrants that the Software shall substantially conform to the agreed specifications and requirements for a period of ${normalizeWhitespace(
        variables.warranty_period || "ninety (90) days"
      )} from acceptance ('Warranty Period'); shall be free from material defects in design, code, and functionality; and shall not contain malicious code or undisclosed back-door access. During the Warranty Period, the Developer shall remedy defects at no additional cost. ${hasMeaningfulValue(
        variables.support_maintenance
      ) ? ` Post-warranty support and maintenance shall operate in accordance with the following arrangement: ${stripExternalReferencePhrases(
        variables.support_maintenance,
        ""
      )}.` : " Any post-warranty maintenance or support shall be governed by the support obligations expressly stated in this Agreement or in a separate maintenance arrangement."}`,

    SERVICE_WARRANTY_001: () =>
      `The ${actor} warrants that the Services and all Deliverables shall be performed with reasonable skill, care, diligence, and professional competence and shall materially conform to the agreed specifications, service standards, and acceptance criteria stated in this Agreement.${hasMeaningfulValue(
        variables.acceptance_criteria
      ) ? ` For clarity, conformity shall be tested against the following completion or acceptance standard: ${stripExternalReferencePhrases(
          variables.acceptance_criteria,
          ""
        )}.` : ""} If any Service or Deliverable is found during the warranty period to be materially defective, incomplete, non-conforming, or not in accordance with this Agreement, the ${actor} shall, at its own cost and within a commercially reasonable time, correct, re-perform, update, or replace the affected Service or Deliverable. The warranty period for this clause shall be ${normalizeWhitespace(
        variables.warranty_period || "ninety (90) days from delivery or acceptance"
      )}.${hasMeaningfulValue(
        variables.support_maintenance
      ) ? ` Post-warranty support, maintenance, or additional support obligations shall operate in accordance with the following arrangement: ${stripExternalReferencePhrases(
          variables.support_maintenance,
          ""
        )}.` : ""}`,

    LOAN_AMOUNT_001: () =>
      `Subject to the terms and conditions of this Agreement, the Lender agrees to lend to the Borrower, and the Borrower agrees to borrow from the Lender, a principal sum of ${formatCurrency(
        variables.loan_amount
      )} ('Principal Amount'). The Principal Amount shall be disbursed by electronic transfer to the Borrower's designated bank account within seven (7) Business Days of completion of the agreed conditions precedent, including know-your-customer checks, execution of this Agreement, and creation of the agreed security. The Borrower shall utilise the Principal Amount solely for ${normalizeWhitespace(
        variables.purpose || "the agreed purpose"
      )} and shall not divert funds for any other purpose.`,

    LOAN_INTEREST_001: () =>
      `The Borrower shall pay interest on the outstanding Principal Amount at the rate of ${normalizeWhitespace(
        variables.interest_rate || "the agreed"
      )}% per annum ('Interest Rate'), calculated on the basis of a 365-day year and the actual number of days elapsed. Interest shall accrue daily from the date of disbursement and shall be payable in accordance with the repayment schedule set out in this Agreement. In the event of a payment default, default interest shall accrue on the overdue amount at a rate equal to the Default Interest Rate agreed in this Agreement${
        variables.default_interest_rate
          ? `, being ${normalizeWhitespace(variables.default_interest_rate)}% per annum`
          : ""
      }, from the due date until the date of actual payment. All interest payments shall be subject to applicable TDS requirements, and the Borrower shall not be entitled to set off any amount against interest payments due under this Agreement.`,

    LOAN_REPAYMENT_001: () =>
      `The Borrower shall repay the Principal Amount together with all accrued interest in accordance with the following repayment schedule: ${resolveStructuredRepaymentTerms(
        variables
      ) || normalizeWhitespace(
        variables.repayment_schedule || "the agreed repayment schedule"
      )}. Repayments shall commence on ${formatDate(
        variables.repayment_start_date
      )} and shall be made by electronic transfer to the Lender's designated bank account on or before each due date. If any due date falls on a day that is not a Business Day, payment shall be made on the immediately preceding Business Day. Time of payment is of the essence. The Borrower shall not reduce or defer any repayment instalment without the prior written consent of the Lender.`,

    LOAN_PREPAYMENT_001: () =>
      `Prepayment of the Loan shall be governed by the following terms: ${normalizeWhitespace(
        variables.prepayment_terms || "any prepayment requires the Lender's prior written consent"
      )}. Any permitted prepayment shall be accompanied by all accrued interest on the amount prepaid up to the date of prepayment. Partial prepayments shall be applied first to costs and expenses, then to accrued interest, and then to principal in inverse order of maturity. The Parties shall comply with any applicable RBI directions concerning foreclosure charges and prepayment restrictions.`,

    LOAN_SECURITY_001: () => {
      const collateral = normalizeWhitespace(variables.security_collateral);
      if (!collateral || /^unsecured$/i.test(collateral)) {
        return "This Loan is unsecured. The Borrower confirms that no security interest is being created in favour of the Lender under this Agreement, but all repayment and default obligations under this Agreement shall remain fully enforceable.";
      }
      return `As security for the due repayment of the Loan and discharge of all obligations under this Agreement, the Borrower shall create and maintain the following security in favour of the Lender: ${collateral}. The Borrower shall execute all ancillary security documents, complete all filings or registrations required by applicable law, and maintain adequate insurance over any secured assets where commercially appropriate.`;
    },

    LOAN_COVENANTS_001: () =>
      `For so long as any amount remains outstanding under this Agreement, the Borrower undertakes that it shall maintain its legal existence and necessary approvals, promptly notify the Lender of any default or material adverse event, provide financial information reasonably requested by the Lender, not create any encumbrance over its assets except as permitted under this Agreement, not materially alter the nature of its business without prior written consent of the Lender, and comply with all applicable laws and regulatory directions.`,

    LOAN_DEFAULT_001: () =>
      `Each of the following shall constitute an Event of Default under this Agreement: ${stripExternalReferencePhrases(
        variables.events_of_default,
        "(a) failure by the Borrower to pay any principal, interest, or other sum due under this Agreement within five (5) Business Days of the due date; (b) material breach by the Borrower of any representation, warranty, or covenant under this Agreement, which, if capable of remedy, remains unremedied for thirty (30) days after written notice; (c) insolvency of the Borrower, filing of any petition under the Insolvency and Bankruptcy Code, 2016, or appointment of a liquidator, receiver, or administrator; (d) any judgment, attachment, or enforcement action against the Borrower that materially impairs the Borrower's ability to perform its obligations under this Agreement; (e) any material adverse change in the financial condition or business of the Borrower; (f) cross-default under any other material financing agreement of the Borrower; or (g) if any security created under this Agreement ceases to be valid, enforceable, or perfected"
      )}. Upon the occurrence of an Event of Default, the Lender may exercise all rights under this Agreement and applicable law.`,

    GUARANTEE_OBLIGATION_001: () =>
      `In consideration of the Lender agreeing to extend financial accommodation to the Principal Debtor, the Guarantor hereby unconditionally and irrevocably guarantees to the Lender the due and punctual payment of all amounts payable by the Principal Debtor under the underlying financing arrangements up to ${formatCurrency(
        variables.guaranteed_amount
      )}. This Guarantee shall be invoked in the circumstances described as follows: ${stripExternalReferencePhrases(
        variables.invocation_conditions,
        "upon any payment default, material breach, insolvency event, or other event of default under the underlying financing arrangements"
      )}.${hasMeaningfulValue(variables.invocation_procedure) ? ` The parties further agree that invocation shall be carried out in accordance with the following procedure: ${stripExternalReferencePhrases(
        variables.invocation_procedure,
        ""
      )}.` : " The Lender may invoke this Guarantee by written demand to the Guarantor specifying the default, the amount due, and the basis of the demand."} The liability of the Guarantor shall be co-extensive with that of the Principal Debtor except to the extent expressly limited in this Agreement.`,

    GUARANTEE_CONTINUING_001: () =>
      `This Guarantee is a ${normalizeWhitespace(
        variables.guarantee_type || "continuing guarantee"
      ).toLowerCase()} and shall remain in full force and effect for ${normalizeWhitespace(
        variables.guarantee_period || "so long as any guaranteed obligation remains outstanding"
      )}. The Guarantor's liability shall not be affected, impaired, or discharged by any amendment, indulgence, waiver, variation, delay in enforcement, or insolvency affecting the Principal Debtor, except to the extent discharge is required by non-excludable law.`,

    GUARANTEE_INDEMNITY_001: () =>
      `The Guarantor shall indemnify and hold harmless the Lender against all losses, damages, costs, and expenses suffered or incurred as a result of or in connection with any failure by the Principal Debtor to perform its obligations under the underlying financing arrangements. Upon the Guarantor making any payment under this Guarantee, the Guarantor shall be subrogated to the rights and remedies of the Lender against the Principal Debtor to the extent of such payment, provided that the Guarantor shall not exercise such subrogation rights until the Lender has been paid in full.`,
  };

  const render = renderers[clause.clause_id];
  if (!render) {
    return clause;
  }

  const rendered = render();
  if (!rendered) {
    return clause;
  }

  if (typeof rendered === "object") {
    const nextTitle = rendered.title ?? clause.title;
    const nextText = rendered.text ?? clause.text;

    if (nextTitle === clause.title && nextText === clause.text) {
      return clause;
    }

    return {
      ...clause,
      title: nextTitle,
      text: nextText,
    };
  }

  if (rendered === clause.text) {
    return clause;
  }

  return {
    ...clause,
    text: rendered,
  };
}

function cloneClauseForDraft(clauseId, variables = {}) {
  const clause = getClauseById(clauseId);
  if (!clause) {
    throw new Error(`Document hardening references missing clause_id "${clauseId}".`);
  }

  return {
    ...clause,
    category: normalizeClauseCategory(clause.category),
    title: clause.title || clause.name || null,
    text: injectVariables(clause.text || "", variables),
  };
}

export function getDisallowedProtections(documentType) {
  return new Set(
    getDocumentDraftingPolicy(documentType)?.hardening?.disallowedProtections || []
  );
}

export function applyDocumentHardening(draft, input = {}) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const documentType = input.document_type || draft.document_type;
  const variables = input.variables || draft.metadata?.source_variables || {};
  const semanticContext =
    input.semanticContext || draft.metadata?.interpreted_facts || {};
  const requiredClauseIds = getRequiredHardeningClauseIds(documentType);
  const genericClausesToRemove = new Set();
  const disallowedProtections = getDisallowedProtections(documentType);

  if (disallowedProtections.has("LIABILITY_CAP")) {
    genericClausesToRemove.add("AUTO-LIAB-001");
    genericClausesToRemove.add("CORE_LIABILITY_CAP_001");
    genericClausesToRemove.add("CORE_LIMITATION_LIABILITY_001");
  }

  if (disallowedProtections.has("INDEMNITY")) {
    genericClausesToRemove.add("AUTO-INDEM-001");
    genericClausesToRemove.add("CORE_INDEMNITY_001");
  }

  if (disallowedProtections.has("FORCE_MAJEURE")) {
    genericClausesToRemove.add("AUTO-FM-001");
    genericClausesToRemove.add("CORE_FORCE_MAJEURE_001");
  }

  const baseClauses = draft.clauses.filter(
    (clause) => !genericClausesToRemove.has(String(clause.clause_id || ""))
  );
  const existingClauseIds = new Set(baseClauses.map((clause) => clause.clause_id));

  const extraClauses = requiredClauseIds
    .filter((clauseId) => !existingClauseIds.has(clauseId))
    .map((clauseId) => cloneClauseForDraft(clauseId, variables));

  const clauses = [...baseClauses, ...extraClauses].map((clause) =>
    renderHardClause(clause, variables, documentType, semanticContext)
  );

  return {
    ...draft,
    clauses: sortClausesByOrder(clauses),
  };
}

function buildIssue(ruleId, severity, message, suggestion, clauseId = null) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    offending_clause_id: clauseId,
    blocks_generation: severity === "CRITICAL",
  };
}

function hasExternalScheduleReference(text = "") {
  const normalized = String(text || "");
  return (
    /\b(?:specified|set out|described|contained|included|recorded)\s+in\s+(?:the\s+)?(?:schedule|annexure|appendix)\s*[a-z0-9-]*\b/i.test(
      normalized
    ) ||
    /\b(?:schedule|annexure|appendix)\s+(?:[0-9]+|[A-Z]|[IVXLCM]+)\b/.test(
      normalized
    )
  );
}

function findUnresolvedScheduleReferenceIssues(draft) {
  return (draft.clauses || [])
    .filter((clause) => hasExternalScheduleReference(clause.text || ""))
    .map((clause) =>
      buildIssue(
        "UNRESOLVED_SCHEDULE_REFERENCE",
        "CRITICAL",
        `Clause "${clause.clause_id}" still references a schedule or annexure that is not rendered inline in the generated draft.`,
        "Render the referenced commercial or technical details directly in the clause text or add a real schedule section to the draft.",
        clause.clause_id
      )
    );
}

function findMissingRequiredClauseIssues(draft, documentType) {
  const requiredClauseIds = getRequiredHardeningClauseIds(documentType);
  const existingClauseIds = new Set((draft.clauses || []).map((clause) => clause.clause_id));
  return requiredClauseIds
    .filter((clauseId) => !existingClauseIds.has(clauseId))
    .map((clauseId) =>
      buildIssue(
        `MISSING_REQUIRED_CLAUSE_${clauseId}`,
        "HIGH",
        `Required hardening clause "${clauseId}" is missing from this ${documentType} draft.`,
        "Rebuild the draft with the mandatory completeness clauses for this document type."
      )
    );
}

function findDisallowedProtectionIssues(draft, documentType) {
  const disallowed = getDisallowedProtections(documentType);
  if (!disallowed.size) return [];

  const issues = [];
  for (const clause of draft.clauses || []) {
    const clauseId = String(clause.clause_id || "");
    if (
      disallowed.has("LIABILITY_CAP") &&
      (
        clauseId === "AUTO-LIAB-001" ||
        clauseId === "CORE_LIABILITY_CAP_001" ||
        clauseId === "CORE_LIMITATION_LIABILITY_001"
      )
    ) {
      issues.push(
        buildIssue(
          "DISALLOWED_LIABILITY_CAP",
          "HIGH",
          `${documentType} should not contain a generic bilateral limitation of liability clause.`,
          "Remove the generic liability cap and use finance-appropriate risk allocation instead.",
          clauseId
        )
      );
    }

    if (
      disallowed.has("INDEMNITY") &&
      (clauseId === "AUTO-INDEM-001" || clauseId === "CORE_INDEMNITY_001")
    ) {
      issues.push(
        buildIssue(
          "DISALLOWED_GENERIC_INDEMNITY",
          "HIGH",
          `${documentType} should not contain a generic mutual indemnity clause.`,
          "Replace the generic indemnity with a document-specific indemnity structure or omit it where inappropriate.",
          clauseId
        )
      );
    }

    if (
      disallowed.has("FORCE_MAJEURE") &&
      (clauseId === "AUTO-FM-001" || clauseId === "CORE_FORCE_MAJEURE_001")
    ) {
      issues.push(
        buildIssue(
          "DISALLOWED_FORCE_MAJEURE",
          "MEDIUM",
          `${documentType} should not contain a generic force majeure clause that could dilute payment or guarantee obligations.`,
          "Remove the generic force majeure language or replace it with a narrower clause tailored to the document type.",
          clauseId
        )
      );
    }
  }

  return issues;
}

export function validateDocumentHardening(draft, { documentType } = {}) {
  if (!draft?.clauses?.length || !documentType) {
    return [];
  }

  return [
    ...findMissingRequiredClauseIssues(draft, documentType),
    ...findUnresolvedScheduleReferenceIssues(draft),
    ...findDisallowedProtectionIssues(draft, documentType),
  ];
}
