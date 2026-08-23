import { getClauseById } from "./clauseAssembler.js";
import { injectVariables } from "./variableInjector.js";
import { normalizeClauseCategory, sortClausesByOrder } from "../config/clauseOrder.js";
import { hasMeaningfulValue } from "./generationControls.js";
import { deriveRiskProfile } from "./riskProfile.js";
import {
  getDocumentDraftingPolicy,
  getDocumentRoleContext,
  getPartyNamingLabels,
  getParticipantExpectations,
} from "./draftingPolicy.js";
import {
  formatFormalDate,
  formatIndianAmount,
  parseNumberish as parseFormattedNumber,
} from "./formattingEngine.js";

// A document's clause floor comes from two places: `baselineClauseIds`, the
// general provisions every instrument of that kind carries (declared once in
// defaults/families), plus the `requiredClauseIds` the specific document type
// adds on top. They are UNIONED here rather than merged upstream, because
// mergePolicy REPLACES arrays -- a document declaring requiredClauseIds would
// otherwise silently wipe out the inherited baseline.
function getRequiredHardeningClauseIds(documentType) {
  const hardening = getDocumentDraftingPolicy(documentType)?.hardening || {};
  const baseline = Array.isArray(hardening.baselineClauseIds)
    ? hardening.baselineClauseIds
    : [];
  const required = Array.isArray(hardening.requiredClauseIds)
    ? hardening.requiredClauseIds
    : [];
  return [...new Set([...baseline, ...required])];
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isNotApplicable(value = "") {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return !normalized || ["na", "n/a", "none", "nil", "not applicable"].includes(normalized);
}

function parseNumberish(value) {
  return parseFormattedNumber(value);
}

function formatCurrency(value, options = {}) {
  const numeric = parseNumberish(value);
  if (numeric === null) return "the agreed amount";
  return formatIndianAmount(numeric, options);
}

// Free-text fields that may hold either a bare amount ("10000") or a description
// ("joint signatures required") — render a bare number as Indian currency, else
// leave the text as-is.
function formatAmountOrText(value) {
  const s = String(value || "").trim();
  if (/^[₹\s]*-?\d[\d,\s]*(?:\.\d+)?$/.test(s)) return formatIndianAmount(parseNumberish(s));
  return s;
}

function formatDate(value) {
  return formatFormalDate(value);
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

  // A user who describes a renewal arrangement has, by doing so, elected to
  // allow renewal -- even if the separate renewal_option select was left
  // untouched. Previously this branch was reached first and discarded
  // renewal_terms entirely; the consistency validator then correctly observed
  // that the term clause did not reflect the supplied renewal terms and blocked
  // the whole document, so answering an optional question produced no draft at
  // all and an error the user had no way to act on.
  if ((!renewalOption || renewalOption === "no") && renewalTerms) {
    return `Upon expiry of the initial term, this Agreement may be renewed or extended only in accordance with the following renewal arrangement: ${renewalTerms}.`;
  }

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
  if (numericValue !== null && numericValue > 0) {
    return Math.round(numericValue);
  }

  // No stated notice period. Rather than a flat 30 days for every engagement
  // regardless of size, fall back to the period the deal's own magnitude
  // suggests -- a three-year, multi-crore contract unwound on the same notice
  // as a one-off small engagement is not a considered position, it is a default
  // nobody chose. deriveGenerationControls supplies this from the intake.
  const scaled = parseNumberish(variables.default_termination_notice_days);
  if (scaled !== null && scaled > 0) {
    return Math.round(scaled);
  }

  return 30;
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

function resolveGenericTerminationText(namedParties, variables = {}, present = EMPTY_PRESENCE) {
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
      `by either ${namedParties.first} or ${namedParties.second} for convenience upon ${noticeDays} days' prior written notice to the other Party`
    );
  }

  if (allowCause) {
    grounds.push(
      `by either Party with immediate effect if the other Party commits a material breach of this Agreement and, where such breach is capable of remedy, fails to cure it within ${cureDays} days after receipt of written notice requiring the same to be remedied`
    );
  }

  grounds.push(
    `by either Party with immediate effect if the other Party becomes insolvent, is wound up, enters into a composition with creditors, or ceases to carry on business`
  );

  // Lettered from position rather than written in. With convenience termination
  // switched off the list used to open at "(b)", which reads as though an item
  // had been deleted from the executed document.
  const lettered = grounds.map((ground, index) => `(${String.fromCharCode(97 + index)}) ${ground}`);

  // The surviving provisions are named from what the document actually
  // contains. This sentence used to promise that confidentiality and indemnity
  // survive in agreements that had neither.
  const surviving = joinSeries([
    ...survivingProvisionLabels(present).filter((label) => label !== "this clause"),
    "any accrued rights or remedies",
  ]);

  return `This Agreement may be terminated ${lettered.join(
    "; "
  )}. Upon termination or expiry, each Party shall remain liable for accrued payment obligations and for all obligations which by their nature are intended to survive, including ${surviving}.`;
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

  return `All invoices shall be raised in Indian Rupees as valid GST-compliant tax invoices and shall specify the ${joinSeries(
    details
  )}.`;
}

function resolveServicePurposeClause(documentType, namedParties, variables = {}) {
  const purposeMode =
    getDocumentDraftingPolicy(documentType)?.rendering?.purposeMode || "none";
  // The same treatment the recital gets. These values land mid sentence
  // ("...in relation to X and to deliver..."), so an imperative or a stray
  // terminal stop from the intake form reads as broken prose on the page.
  const projectDescription = toRecitalPhrase(
    normalizeWhitespace(variables.project_description || variables.deliverables)
  );
  const serviceDescription = toRecitalPhrase(
    normalizeWhitespace(variables.consulting_services || variables.services_description)
  );
  const engagementModel = normalizeWhitespace(variables.engagement_model);

  switch (purposeMode) {
    case "guarantee": {
      const guaranteed = toRecitalPhrase(
        normalizeWhitespace(
          variables.underlying_agreement_description ||
            variables.loan_purpose ||
            variables.guarantee_purpose
        )
      );
      return `The purpose of this Agreement is to record the guarantee given by the ${
        namedParties.third || "Guarantor"
      } to the ${
        namedParties.first
      } in respect of the due and punctual performance and payment of the obligations of the ${
        namedParties.second
      }${
        guaranteed ? ` arising in relation to ${guaranteed}` : ""
      }, and to set out the terms on which that guarantee may be invoked, enforced, and discharged.`;
    }

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
      return [
        `The purpose of this Agreement is to establish and govern the Joint Venture${hasMeaningfulValue(
          variables.jv_name
        ) ? ` known as ${normalizeWhitespace(variables.jv_name)}` : ""} for ${stripExternalReferencePhrases(
          variables.jv_purpose,
          "the agreed joint business objective"
        )}.`,
        `The Joint Venture shall operate through the structure selected by the Parties, being ${stripExternalReferencePhrases(
          variables.jv_structure,
          "the agreed contractual or entity-based joint venture structure"
        )}, and that structure shall be used to allocate ownership, voting control, contribution obligations, operational responsibilities, and authority to bind the Joint Venture.`,
        `The commercial objectives of the Joint Venture shall include pursuing the business activities described in this Agreement, using the Parties' respective capital, personnel, know-how, intellectual property, regulatory permissions, and market access only for the agreed purpose.`,
        "Governance of the Joint Venture shall be exercised through the agreed management mechanism, reserved matters, deadlock procedure, reporting obligations, and exit rights set out in this Agreement, so that no Party can unilaterally alter the scope, ownership economics, or risk profile of the Joint Venture except as expressly permitted.",
      ].join(" ");

    case "memorandum_cooperation":
      return `The purpose of this Memorandum of Understanding is to record the commercial understanding of the Parties in relation to ${stripExternalReferencePhrases(
        variables.mou_purpose || variables.purpose,
        "the contemplated cooperation between the Parties"
      )}.${hasMeaningfulValue(variables.mou_scope) ? ` The scope of this understanding shall include ${stripExternalReferencePhrases(
        variables.mou_scope,
        ""
      )}.` : ""}`;

    case "consultancy_engagement":
      return `The purpose of this Agreement is to set out the terms on which the ${namedParties.first} retains the ${namedParties.second} to provide consultancy and advisory services in relation to ${serviceDescription || "the agreed business requirements"}, and to deliver the agreed work product under a clearly defined professional engagement${engagementModel ? ` on a ${engagementModel.toLowerCase()} basis` : ""}.`;
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

  // Whichever way expenses fall, the clause needs the mechanics: what evidence
  // is required, by when a claim must be made, when it is paid, and what is not
  // reimbursable. Without them "reimbursed at actuals" is an argument waiting to
  // happen.
  const mechanics = formatStructuredSubparts([
    `a claim for reimbursement shall be made within thirty (30) days of the expense being incurred, supported by the original invoice or receipt and a short statement of the purpose for which it was incurred`,
    `${payer} shall pay an approved claim within thirty (30) days of receiving it, together with the next payment falling due under this Agreement where that is more convenient`,
    `where the expense attracts GST and ${actor} is registered, the claim shall be raised as a GST-compliant tax invoice so that input credit is not lost`,
    `expenses of a personal nature, fines and penalties, and any cost arising from ${actor}'s own delay, breach, or failure to obtain approval are not reimbursable`,
    `${payer} may decline a claim that was not approved in advance where approval was required, and shall give reasons in writing for doing so`,
  ]);

  if (!hasMeaningfulValue(policy)) {
    return `Except as expressly approved in writing in advance by ${payer}, all out-of-pocket, travel, accommodation, communication, and incidental expenses incurred by ${actor} in performing the Services shall be borne solely by ${actor}. Where an expense is approved in advance, the following shall apply:\n${mechanics}`;
  }

  return `The following expense reimbursement arrangement shall apply under this Agreement: ${policy}. Any reimbursable expense claimed by ${actor} shall be supported by reasonable documentary evidence and, unless the stated policy provides otherwise, shall require the prior written approval of ${payer}. In addition:\n${mechanics}`;
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

// Sentences that state what is NOT covered. These must never be rendered as a
// service the party has agreed to perform.
const EXCLUSION_LEAD =
  /^(?:excludes?|excluding|does not include|shall not include|not included|other than)\b[:\s]*/i;

// Splits free text into sentences. Deliberately sentence-first: this previously
// split the whole field on commas, which turned
//   "Provide strategic business advisory covering market entry, regulatory
//    compliance, and operational efficiency. Deliver monthly strategy reports,
//    quarterly workshops, and ad-hoc policy drafting. Excludes direct
//    implementation of policies."
// into five fragments, two of which ran across a full stop -- "(c) and
// operational efficiency. Deliver monthly strategy reports" -- and one of which
// presented an EXCLUSION as an included service. A comma inside a sentence is
// almost always qualifying one obligation, not separating two.
function splitSentences(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\u2022/g, "\n")
    .split(/\n+|;\s*|(?<=\.)\s+(?=[A-Z(])/)
    .map((part) =>
      part
        .trim()
        .replace(/^\(?[a-z0-9ivxlcdm]{1,4}\)?[.)-]\s+/i, "")
        .replace(/^[-*]\s+/, "")
        .replace(/\s*\.\s*$/, "")
        .trim()
    )
    .filter(Boolean);
}

/**
 * Normalises a free-text scope / deliverables field into what is included and
 * what is expressly excluded.
 *
 * @returns {{ items: string[], exclusions: string[] }}
 */
// Joins a series for prose. Steps the separator up to a semicolon when any
// member already contains a comma, so the reader can still see where one member
// ends and the next begins.
function joinSeries(parts = []) {
  const items = parts.filter(Boolean);
  if (items.length <= 1) return items[0] || "";

  const separator = items.some((item) => item.includes(",")) ? "; " : ", ";
  const head = items.slice(0, -1).join(separator);
  const tail = items[items.length - 1];

  // The serial comma is carried throughout the drafting, so a two-item series
  // takes a bare conjunction and anything longer keeps the separator before it.
  if (items.length === 2 && separator === ", ") return `${head} and ${tail}`;
  return `${head}${separator.trimEnd()} and ${tail}`;
}

// Turns free-form purpose text into something that reads inside a recital.
//
// A recital continues the sentence "…in relation to …", so whatever follows has
// to be a noun phrase. Users write scope fields as instructions — "Provide
// strategic business advisory… Deliver monthly reports… Excludes direct
// implementation" — and dropping that in verbatim produced "in relation to
// Provide strategic business advisory", which reads as a command and starts
// mid-recital with a capital. Raw input is not publication-ready legal prose and
// should not be treated as though it were.
const IMPERATIVE_LEAD =
  /^(?:to\s+)?(?:provide|deliver|supply|perform|render|undertake|carry out|offer|furnish|prepare|conduct)\s+/i;

// Lower-casing the first word is right for a common noun sitting mid sentence
// ("Monthly reports" -> "monthly reports") and wrong for a name ("Mumbai Office
// Fit-out"). A name is taken to be a token that is all capitals, carries an
// internal capital, or is followed by another capitalised word -- the cases
// where lower-casing would visibly corrupt the party's own wording.
function looksLikeProperNoun(phrase = "") {
  const [first = "", second = ""] = String(phrase).trim().split(/\s+/);
  if (!/^[A-Z]/.test(first)) return false;
  if (first === first.toUpperCase() && first.length > 1) return true;
  if (/[A-Z]/.test(first.slice(1))) return true;
  return /^[A-Z][a-z]/.test(second);
}

function openLowerCase(phrase = "") {
  const value = String(phrase).trim();
  if (!value || looksLikeProperNoun(value)) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function toRecitalPhrase(value = "") {
  const sentences = String(value || "")
    .split(/(?<=\.)\s+(?=[A-Z(])/)
    .map((part) => part.trim().replace(/\s*[.;,]\s*$/, ""))
    .filter(Boolean);

  if (!sentences.length) return "";

  const included = [];
  const excluded = [];

  for (const sentence of sentences) {
    if (EXCLUSION_LEAD.test(sentence)) {
      const carved = sentence.replace(EXCLUSION_LEAD, "").trim();
      if (carved) excluded.push(openLowerCase(carved));
      continue;
    }
    // Strip the imperative and lower-case what remains: the phrase sits mid
    // sentence, so it should read as a thing, not an instruction.
    const phrase = sentence.replace(IMPERATIVE_LEAD, "").trim();
    if (phrase) included.push(openLowerCase(phrase));
  }

  // Each limb is usually itself a comma-separated list ("market entry,
  // regulatory compliance, and operational efficiency"). Joining those with
  // another comma buries the boundary between them, so the separator steps up
  // to a semicolon whenever a limb already contains a comma -- the same rule a
  // drafter applies to a series with internal punctuation.
  const body = joinSeries(included);

  if (!excluded.length) return body;

  const carveOut = `excluding ${joinSeries(excluded)}`;

  return body ? `${body}, but ${carveOut}` : carveOut;
}

function normaliseDetailItems(value = "", { allowComma = false } = {}) {
  const sentences = splitSentences(value);
  if (!sentences.length) return { items: [], exclusions: [] };

  const items = [];
  const exclusions = [];

  for (const sentence of sentences) {
    if (EXCLUSION_LEAD.test(sentence)) {
      const carved = sentence.replace(EXCLUSION_LEAD, "").trim();
      if (carved) exclusions.push(carved);
      continue;
    }
    // The lead-in above these limbs reads "...shall provide the following
    // services:", so each limb has to be a thing, not an order. Users type scope
    // fields as instructions ("Provide strategic advisory", "Deliver monthly
    // reports"), which rendered as "shall provide the following services:
    // Provide strategic advisory".
    const phrase = sentence.replace(IMPERATIVE_LEAD, "").trim();
    items.push(phrase || sentence);
  }

  // Only fragment on commas when the whole field is a single sentence reading as
  // a bare list ("market entry, regulatory compliance, operational efficiency"),
  // never when it is a sentence describing one obligation.
  if (allowComma && items.length === 1 && !exclusions.length) {
    const parts = items[0]
      .split(/\s*,\s*/)
      .map((part) => part.replace(/^(?:and|or)\s+/i, "").trim())
      .filter(Boolean);

    const bareList =
      parts.length >= 2 && parts.every((part) => part.split(/\s+/).length <= 6);

    if (bareList) return { items: parts, exclusions };
  }

  const dedupe = (list) => list.filter((item, i, all) => all.indexOf(item) === i);
  return { items: dedupe(items), exclusions: dedupe(exclusions) };
}

// Retained for callers that only need the included items.
function splitStructuredItems(value = "", options = {}) {
  return normaliseDetailItems(value, options).items;
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
  const { items, exclusions } = normaliseDetailItems(value, options);
  if (!items.length && !exclusions.length) {
    return prefix;
  }

  // An exclusion the user wrote into a scope field is a negative obligation and
  // is drafted as one. Folding it into the list of services would state the
  // opposite of what they asked for.
  const excluded = exclusions.length
    ? `\nThe following are expressly excluded from the scope of this Agreement and shall not be undertaken unless the Parties agree otherwise in writing: ${joinSeries(
        exclusions
      )}.`
    : "";

  if (!items.length) return `${prefix.replace(/:\s*$/, ".")}${excluded}`;
  if (items.length === 1) return `${prefix} ${items[0]}.${excluded}`;

  return `${prefix}\n${formatStructuredSubparts(items)}${excluded}`;
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

function resolveGovernanceProtectionSentences(variables = {}) {
  return [
    hasMeaningfulValue(variables.audit_rights)
      ? ` Audit rights shall operate as follows: ${stripExternalReferencePhrases(
          variables.audit_rights,
          ""
        )}.`
      : "",
    hasMeaningfulValue(variables.information_rights)
      ? ` Information rights and periodic reporting shall operate as follows: ${stripExternalReferencePhrases(
          variables.information_rights,
          ""
        )}.`
      : "",
    hasMeaningfulValue(variables.escalation_mechanism)
      ? ` Operational escalation shall follow this mechanism before formal remedies are invoked where commercially reasonable: ${stripExternalReferencePhrases(
          variables.escalation_mechanism,
          ""
        )}.`
      : "",
    hasMeaningfulValue(variables.additional_protection_clauses)
      ? ` The following additional protection clauses shall also apply: ${stripExternalReferencePhrases(
          variables.additional_protection_clauses,
          ""
        )}.`
      : "",
  ].join("");
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

  // Default market position: twelve months' charges. That is a formula, not a
  // number -- and on a 36-month, multi-crore engagement neither party can tell
  // from the page what they have actually agreed to. Where the consideration and
  // the term are both known, state the indicative figure alongside the formula.
  // This discloses the effect of the existing term; it does not alter it.
  const annualised = annualisedConsideration(variables);
  const indication = annualised
    ? `, which on the consideration and term recorded in this Agreement the Parties presently estimate at approximately ${formatCurrency(
        annualised
      )}`
    : "";

  return `shall not exceed the aggregate fees paid or payable under this Agreement during the twelve (12) months preceding the event giving rise to the claim${indication}`;
}

// The value of twelve months of the engagement, from the total consideration and
// the term. Returns null when either is unknown, so the clause simply omits the
// indication rather than guessing.
function annualisedConsideration(variables = {}) {
  const total = parseNumberish(variables.contract_value_inr);
  const months = parseNumberish(variables.term_months);
  if (total === null || total <= 0) return null;
  if (months === null || months <= 0) return null;
  if (months <= 12) return total;
  return Math.round((total * 12) / months);
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

function renderSecuritySchedule(collateral = "") {
  const value = normalizeWhitespace(collateral);
  if (!value || /^unsecured$/i.test(value)) return "";
  const lower = value.toLowerCase();
  if (lower.includes("gold")) {
    return [
      "Schedule B - Description of Gold Security",
      "(a) Description: gold ornaments, bullion, coins, or other gold assets described by the Borrower and accepted by the Lender as security",
      "(b) Weight: as recorded in the security creation documents or valuation certificate",
      "(c) Purity: as recorded in the valuation certificate or assayer's report",
      "(d) Identification: photographs, inventory references, pouch numbers, locker details, or other identification particulars recorded at the time of pledge",
      "(e) Valuation: fair market value determined by an independent or lender-approved valuer on or before creation of security",
      `(f) Additional particulars supplied by the Parties: ${value}.`,
    ].join("\n");
  }

  return [
    "Schedule B - Description of Security",
    `(a) Collateral: ${value}.`,
    "(b) Identification: serial numbers, registration details, title documents, account references, possession records, or other identifying particulars applicable to the collateral.",
    "(c) Valuation: the value accepted by the Lender at the time of security creation or as updated under the security documents.",
    "(d) Perfection: filings, registrations, stamping, possession, notices, or control arrangements required under applicable law shall be completed by the Borrower.",
  ].join("\n");
}

function resolveJointVentureTerminationText(variables = {}) {
  const cureDays = resolveCurePeriodDays(variables, 30);
  return [
    "This Agreement may terminate only on the occurrence of one or more of the following events:",
    formatStructuredSubparts([
      "mutual written agreement of the Parties",
      `material breach by a Party which remains uncured for ${cureDays} days after written notice requiring cure`,
      "insolvency, liquidation, dissolution, or cessation of business of a Party",
      "a regulatory prohibition, change in law, or governmental order that makes continuation of the Joint Venture unlawful or commercially impossible",
      "a deadlock exit event where the deadlock remains unresolved after escalation under this Agreement",
      "expiry of the agreed Joint Venture term without renewal",
    ]),
    "Termination shall not by itself extinguish accrued rights, payment obligations, confidentiality obligations, dispute resolution provisions, or the exit and unwind obligations expressly stated in this Agreement.",
  ].join("\n");
}

// The DURATION of the guarantee. Its continuing character and the mechanics of
// revocation belong to GUARANTEE_CONTINUING_001; drafting both from one function
// produced two identical clauses under different headings.
function resolveGuaranteeTermText(variables = {}) {
  const guaranteeType = normalizeWhitespace(variables.guarantee_type).toLowerCase();
  const period = stripExternalReferencePhrases(
    variables.guarantee_period || variables.guarantee_duration,
    ""
  );

  if (guaranteeType.includes("continuing")) {
    const duration = period
      ? `This Guarantee shall remain in force for ${period} from the Effective Date, and thereafter until all guaranteed obligations outstanding at the end of that period have been discharged in full.`
      : "This Guarantee shall remain in force until all guaranteed obligations have been discharged in full, or until it is validly revoked as to future transactions in accordance with this Agreement, whichever is later.";

    return `This Guarantee shall commence on ${formatDate(
      variables.effective_date
    )} (the "Effective Date"). ${duration} The discharge of this Guarantee shall not release the Guarantor from any liability that accrued before discharge, and the Lender shall, on written request following full discharge, provide the Guarantor with written confirmation that this Guarantee has been released.`;
  }

  if (period) {
    return `This Guarantee shall commence on ${formatDate(
      variables.effective_date
    )} (the "Effective Date") and shall remain in force for ${period}, expiring automatically at the end of that period save in respect of any claim made in writing by the Lender before expiry. The Guarantor shall remain liable for any such claim until it is finally resolved.`;
  }

  return resolveServiceTermClause("GUARANTEE_AGREEMENT", resolveNamedPartyLabels("GUARANTEE_AGREEMENT"), variables);
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

// A company or LLP contracts through a natural person. Indian instruments show
// that authority on the face of the deed -- "represented by its authorised
// signatory Mr X, duly authorised vide Board Resolution dated Y" -- so that the
// signatory's capacity is not left to be proved later. Rendered only when the
// details were supplied; an entity party with no authority details is reported
// separately as an advisory rather than papered over with blanks.
function buildAuthorityPhrase(participant, variables = {}) {
  const id = participant?.id;
  if (!id) return "";

  const signatory = normalizeWhitespace(variables[`${id}_signatory_name`]);
  const designation = normalizeWhitespace(variables[`${id}_signatory_designation`]);
  const authority = normalizeWhitespace(variables[`${id}_authority_reference`]);

  if (!signatory && !authority) return "";

  const parts = [];
  if (signatory) {
    parts.push(
      `represented by ${signatory}${designation ? `, ${designation}` : ""}`
    );
  } else {
    parts.push("represented by its authorised signatory");
  }
  if (authority) {
    parts.push(`duly authorised vide ${authority}`);
  }

  return `, ${parts.join(", ")}`;
}

// A participant's entity type decides how it is described in the testatum, which
// statutory incorporation recital is used, whether its registration numbers are
// recited, and which successor wording applies. Where the intake did not capture
// a type, infer it from the identifiers and the name rather than silently
// falling through to natural-person treatment -- which is what produced
// employers described as a bare name with "legal heirs, executors and
// administrators", and dropped the CIN the user had supplied.
function inferParticipantType(participant = {}, variables = {}) {
  const explicit = normalizeWhitespace(participant?.type);
  if (explicit) return explicit.toLowerCase();

  const id = participant?.id;
  const has = (suffix) =>
    hasMeaningfulValue(participant?.[suffix]) ||
    (id && hasMeaningfulValue(variables[`${id}_${suffix}`]));

  if (has("llpin")) return "llp";
  if (has("cin")) return "private limited company";

  const name = normalizeWhitespace(participant?.name).toLowerCase();
  if (/\bllp\b/.test(name)) return "llp";
  if (/\bprivate\s+limited\b|\bpvt\.?\s*ltd\b/.test(name)) return "private limited company";
  if (/\blimited\b|\bltd\b/.test(name)) return "public limited company";
  if (/\b(?:and|&)\s+(?:co|company|sons|associates)\b|\bpartnership\b/.test(name))
    return "partnership firm";
  if (/\btrust\b/.test(name)) return "trust";

  return "";
}

function buildParticipantDescriptor(participant, variables = {}) {
  const name = normalizeWhitespace(participant?.name);
  if (!name) return "";

  const type = inferParticipantType(participant, variables);
  const pan = normalizeWhitespace(participant?.pan || variables[`${participant?.id}_pan`]);
  const gstin = normalizeWhitespace(participant?.gstin || variables[`${participant?.id}_gstin`]);
  const cin = normalizeWhitespace(
    participant?.cin || variables[`${participant?.id}_cin`] || variables.employer_cin
  );
  const llpin = normalizeWhitespace(participant?.llpin || variables[`${participant?.id}_llpin`]);

  let descriptor = name;
  if (type.includes("individual")) {
    descriptor = `${name}, an individual${hasMeaningfulValue(participant?.address) ? ` residing at ${stripExternalReferencePhrases(participant.address, "")}` : ""}${pan ? ` having PAN ${pan}` : ""}`;
    return descriptor;
  }

  if (type.includes("private limited")) {
    descriptor = `${name}, a private limited company${cin ? ` having Corporate Identity Number (CIN) ${cin}` : ""} incorporated under the provisions of the Companies Act, 2013${pan ? ` and PAN ${pan}` : ""}${gstin ? ` and GSTIN ${gstin}` : ""}`;
  } else if (type.includes("public limited") || type === "public company") {
    descriptor = `${name}, a public limited company${cin ? ` having Corporate Identity Number (CIN) ${cin}` : ""} incorporated under the provisions of the Companies Act, 2013${pan ? ` and PAN ${pan}` : ""}${gstin ? ` and GSTIN ${gstin}` : ""}`;
  } else if (type.includes("llp")) {
    descriptor = `${name}, a Limited Liability Partnership duly registered under the provisions of the Limited Liability Partnership Act, 2008${llpin ? ` having LLPIN ${llpin}` : ""}${pan ? ` and PAN ${pan}` : ""}${gstin ? ` and GSTIN ${gstin}` : ""}`;
  } else if (type.includes("partnership")) {
    descriptor = `${name}, a Partnership Firm governed by the provisions of the Indian Partnership Act, 1932${pan ? ` having PAN ${pan}` : ""}${gstin ? ` and GSTIN ${gstin}` : ""}`;
  } else if (type.includes("proprietorship")) {
    descriptor = `${name}, a sole proprietorship business carried on under the name and style of ${name}${pan ? ` having PAN ${pan}` : ""}${gstin ? ` and GSTIN ${gstin}` : ""}`;
  } else if (type) {
    descriptor = `${name}, ${withIndefiniteArticle(type)}`;
  }

  if (hasMeaningfulValue(participant?.address)) {
    descriptor += `, having its address at ${stripExternalReferencePhrases(
      participant.address,
      ""
    )}`;
  }

  descriptor += buildAuthorityPhrase(participant, variables);

  return descriptor;
}

function resolveSuccessorPhrase(participant = {}, variables = {}) {
  const entityType = inferParticipantType(participant, variables);

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
  lineEnding = ";",
  variables = {}
) {
  return `${descriptor} (hereinafter referred to as the "${label}", ${resolveSuccessorPhrase(
    participant,
    variables
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
    entries.push(["Permitted Purpose", toRecitalPhrase(purpose)]);
  }

  const services = stripExternalReferencePhrases(
    variables.services_description || variables.consulting_services,
    ""
  );
  if (services) {
    entries.push(["Services", toRecitalPhrase(services)]);
  }

  const deliverables = stripExternalReferencePhrases(variables.deliverables, "");
  if (deliverables) {
    entries.push(["Deliverables", toRecitalPhrase(deliverables)]);
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

  // NOTE: NDAs intentionally do NOT define "Confidential Information" here.
  // The dedicated NDA_CONFIDENTIAL_INFORMATION_SCOPE_001 clause is the
  // authoritative definition; redefining it in the general Definitions clause
  // created a genuine duplicate definition that blocked the export gate.

  if (documentType === "SOFTWARE_DEVELOPMENT_AGREEMENT") {
    entries.push([
      "Software",
      stripExternalReferencePhrases(
        variables.project_description || variables.deliverables,
        "the software, deliverables, and related materials to be designed, developed, tested, and delivered under this Agreement"
      ),
    ]);
  }

  // Beyond the terms derived from intake answers, every commercial instrument
  // needs the standard interpretive vocabulary. Clauses elsewhere in the
  // document already used "Applicable Law", "Business Day", "Affiliate" and
  // "Force Majeure Event" as though they were defined terms, and they were not
  // defined anywhere -- so a capitalised term carried no agreed meaning and a
  // court would have been left to supply one.
  const defined = new Set(entries.map(([term]) => term));
  const push = (term, definition) => {
    if (!defined.has(term)) {
      entries.push([term, definition]);
      defined.add(term);
    }
  };

  push(
    "Affiliate",
    'in relation to a Party, any entity that directly or indirectly controls, is controlled by, or is under common control with that Party, where "control" means the ownership of more than fifty percent (50%) of the voting securities of an entity, or the power to direct its management and policies, whether through ownership of voting securities, by contract, or otherwise'
  );
  push(
    "Applicable Law",
    "all statutes, enactments, ordinances, rules, regulations, notifications, circulars, guidelines, policies, directions, judgments, decrees, and orders of any Government Authority having the force of law in India, as in force from time to time and as amended, consolidated, re-enacted, or replaced"
  );
  push(
    "Business Day",
    "a day other than a Saturday, a Sunday, or a day declared to be a public holiday under the Negotiable Instruments Act, 1881 in the State in which this Agreement is executed, on which scheduled commercial banks are open for normal banking business in that State"
  );
  push(
    "Government Authority",
    "any national, state, municipal, or local government, any statutory, regulatory, or self-regulatory authority, tribunal, commission, board, or agency, and any court or other judicial body exercising jurisdiction in India"
  );
  push(
    "Force Majeure Event",
    "any event or circumstance beyond the reasonable control of the affected Party which prevents or materially impedes the performance of its obligations, including act of God, fire, flood, earthquake, cyclone, epidemic, pandemic, lockdown or other restriction imposed by order of a Government Authority, war, hostilities, act of terrorism, riot, civil commotion, strike or other industrial action not confined to the affected Party's own workforce, failure of public utilities or telecommunications infrastructure, and any change in Applicable Law that renders performance unlawful"
  );
  push(
    "Intellectual Property Rights",
    "all rights in patents, copyright and related rights, moral rights, trade marks, service marks, trade names, domain names, designs, semiconductor topographies, database rights, trade secrets, know-how, and confidential information, together with all applications, registrations, renewals, and extensions of any of them, in each case subsisting under the laws of India and all analogous rights subsisting under the laws of every other jurisdiction"
  );
  push(
    "Term",
    "the period commencing on the Effective Date and continuing until this Agreement expires or is terminated in accordance with its terms"
  );

  // NDAs carry their own authoritative definition in
  // NDA_CONFIDENTIAL_INFORMATION_SCOPE_001; defining it twice would create a
  // genuine duplicate definition and block the export gate.
  if (documentType !== "NDA" && documentType !== "NON_DISCLOSURE_AGREEMENT") {
    push(
      "Confidential Information",
      "all non-public, proprietary, commercially sensitive, technical, financial, business, strategic, operational, customer, vendor, and personnel information disclosed by or on behalf of a Party, in oral, written, visual, digital, or any other form, whether or not marked as confidential, which is designated as confidential or which by its nature ought reasonably to be regarded as confidential, together with all copies, notes, analyses, and derivative materials containing or derived from it"
    );
  }

  if (
    variables.processes_personal_data === true ||
    variables.involves_personal_data === true
  ) {
    push(
      "Personal Data",
      "any data about an individual who is identifiable by or in relation to such data, within the meaning of the Digital Personal Data Protection Act, 2023"
    );
  }

  return [
    "In this Agreement, unless the context otherwise requires, the following expressions shall have the meanings set out below, and cognate expressions shall be construed accordingly:",
    formatStructuredSubparts(
      entries.map(([term, definition]) => `"${term}" means ${definition}.`)
    ),
    "A term defined in this clause bears that meaning wherever it appears in this Agreement in capitalised form, including in the recitals, the schedules, and any annexure, unless the context otherwise requires.",
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
      // A signature date is separate from the execution date on the face of the
      // deed: parties frequently sign on different days, and the date each one
      // actually signed is what evidences when they became bound.
      lines.push("Date: ________________________");
    } else {
      lines.push(`${name}`);
      lines.push("______________________________");
      lines.push(`Name: ${name}`);
      lines.push("Date: ________________________");
    }

    lines.push("");
  }

  if (
    documentType === "COMMERCIAL_LEASE_AGREEMENT" ||
    documentType === "LEAVE_AND_LICENSE_AGREEMENT"
  ) {
    // Attestation clause. The set of instruments that carry witnesses is a
    // legal question and is deliberately left as-is; only the FORM of the
    // block is corrected here -- an attestation line plus the particulars a
    // witness must actually give.
    lines.push("IN THE PRESENCE OF:");
    lines.push("");
    lines.push("WITNESSES:");
    lines.push("");
    lines.push("1. ______________________________");
    lines.push("   Name: ________________________");
    lines.push("   Address: _____________________");
    lines.push("");
    lines.push("2. ______________________________");
    lines.push("   Name: ________________________");
    lines.push("   Address: _____________________");
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

// States that have their own consolidated stamp legislation. Everywhere else the
// Indian Stamp Act, 1899 applies as amended in its application to that State,
// which is what the fallback says rather than inventing a local Act.
const STATE_STAMP_ACTS = {
  Maharashtra: "the Maharashtra Stamp Act, 1958",
  Karnataka: "the Karnataka Stamp Act, 1957",
  Gujarat: "the Gujarat Stamp Act, 1958",
  Kerala: "the Kerala Stamp Act, 1959",
  Rajasthan: "the Rajasthan Stamp Act, 1998",
  "Uttar Pradesh": "the Uttar Pradesh Stamp Act, 2008",
};

// The concepts a document can claim elsewhere, and what counts as proof that it
// really carries one. Matched on clause id and category rather than on prose,
// because a clause that merely mentions confidentiality is not a confidentiality
// clause.
const CONCEPT_MARKERS = [
  { concept: "confidentiality", label: "confidentiality", id: /CONFIDENTIAL/i, category: /CONFIDENTIAL/i },
  {
    concept: "intellectual_property",
    label: "ownership of intellectual property",
    // Clause ids are underscore-joined, and \b does not fire between "_" and a
    // letter, so IP_OWNERSHIP_001 has to be matched on the underscore boundary.
    id: /(?:^|_)IP(?:_|$)|INTELLECTUAL/i,
    category: /^IP$|INTELLECTUAL/i,
  },
  { concept: "indemnity", label: "indemnity", id: /INDEMNIT/i, category: /INDEMNIT/i },
  {
    concept: "liability_cap",
    label: "limitation of liability",
    id: /LIABILITY/i,
    category: /LIABILITY/i,
  },
  {
    concept: "dispute_resolution",
    label: "dispute resolution",
    id: /DISPUTE|ARBITRAT/i,
    category: /DISPUTE|ARBITRAT/i,
  },
  {
    concept: "governing_law",
    label: "governing law and jurisdiction",
    id: /GOVERNING_LAW|JURISDICTION/i,
    category: /GOVERNING_LAW|JURISDICTION/i,
  },
  { concept: "notices", label: "notices", id: /NOTICE/i, category: /NOTICE/i },
  {
    concept: "representations",
    label: "representations and warranties",
    id: /REPRESENTATION|WARRANT/i,
    category: /REPRESENTATION|WARRANT/i,
  },
  {
    concept: "security",
    label: "security",
    id: /SECURITY|PLEDGE|MORTGAGE|CHARGE|HYPOTHEC/i,
    category: /SECURITY|COLLATERAL/i,
  },
  {
    concept: "insurance",
    label: "insurance",
    id: /INSURANCE/i,
    category: /INSURANCE/i,
  },
];

const EMPTY_PRESENCE = { has: () => false, concepts: new Set(), clauseIds: new Set() };

function buildClausePresence(clauses = []) {
  const clauseIds = new Set(clauses.map((clause) => String(clause?.clause_id || "")));
  const concepts = new Set();

  for (const clause of clauses) {
    const id = String(clause?.clause_id || "");
    const category = String(clause?.category || "");
    for (const marker of CONCEPT_MARKERS) {
      if (marker.id.test(id) || marker.category.test(category)) concepts.add(marker.concept);
    }
  }

  return { has: (concept) => concepts.has(concept), concepts, clauseIds };
}

// The survival list, built from what the document contains rather than from a
// fixed sentence. Order follows the order a reader meets the provisions.
const SURVIVAL_ORDER = [
  "confidentiality",
  "intellectual_property",
  "indemnity",
  "liability_cap",
  "dispute_resolution",
  "governing_law",
  "notices",
];

function survivingProvisionLabels(present) {
  const labels = SURVIVAL_ORDER.filter((concept) => present.has(concept)).map(
    (concept) => CONCEPT_MARKERS.find((marker) => marker.concept === concept).label
  );
  labels.push("this clause");
  return labels;
}

function renderHardClause(
  clause,
  variables = {},
  documentType = "",
  semanticContext = {},
  present = EMPTY_PRESENCE
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

      const firstDescriptor =
        buildParticipantDescriptor(participants[0], variables) ||
        semanticDescriptors[0] ||
        namedParties.first;
      const secondDescriptor =
        buildParticipantDescriptor(participants[1], variables) ||
        semanticDescriptors[1] ||
        namedParties.second;

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
          ";",
          variables
        ),
        "",
        "AND",
        "",
        buildFormalPartyIntroduction(
          secondDescriptor,
          namedParties.second,
          "Second",
          participants[1],
          ".",
          variables
        ),
        "",
        `The ${namedParties.first} and the ${namedParties.second} are hereinafter collectively referred to as the "Parties" and individually as a "Party".`,
        "",
        // Indian drafting convention letters the recitals and uses AND WHEREAS
        // from the second onward, so they can be cross-referred as Recital a/b/c.
        // A recital is one grammatical sentence closing with a semicolon. The
        // purpose text is free-form and usually ends with a full stop of its
        // own, which produced "…implementation of policies. ;". Fold multiple
        // sentences into a single clause and strip the terminal stop so the
        // semicolon lands cleanly.
        `a. WHEREAS, the Parties intend to enter into a legally binding arrangement in relation to ${toRecitalPhrase(
          recitalPurpose
        )};`,
        "",
        "b. AND WHEREAS, the Parties desire to record the terms and conditions governing their respective rights, obligations, responsibilities, and risk allocation in a formal written instrument; and",
        "",
        "c. AND WHEREAS, the transaction contemplated herein is intended for a lawful object and lawful consideration under applicable Indian law;",
        "",
        "NOW, THEREFORE, in consideration of the mutual covenants and undertakings contained herein, and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:",
      ].join("\n");
    },

    GUARANTEE_IDENTITY_001: () => {
      const participants = getParticipantExpectations(documentType, variables);
      if (participants.length < 3) return clause.text;

      const [creditor, debtor, guarantor] = participants;
      const creditorDescriptor = buildParticipantDescriptor(creditor, variables);
      const debtorDescriptor = buildParticipantDescriptor(debtor, variables);
      const guarantorDescriptor = buildParticipantDescriptor(guarantor, variables);

      return [
        `THIS GUARANTEE AGREEMENT ("Agreement") is made and executed on ${formatFormalExecutionDate(
          variables.effective_date
        )}.`,
        "",
        "BY AND AMONG",
        "",
        `${creditorDescriptor} (hereinafter referred to as the "Creditor", ${resolveSuccessorPhrase(
          creditor,
          variables
        )});`,
        "",
        `${debtorDescriptor} (hereinafter referred to as the "Principal Debtor", ${resolveSuccessorPhrase(
          debtor,
          variables
        )}); and`,
        "",
        `${guarantorDescriptor} (hereinafter referred to as the "Guarantor", ${resolveSuccessorPhrase(
          guarantor,
          variables
        )}).`,
        "",
        `The Creditor, the Principal Debtor, and the Guarantor are collectively referred to as the "Parties" and individually as a "Party".`,
        "",
        "a. WHEREAS, the Creditor has agreed to extend, continue, or secure financial accommodation to the Principal Debtor on the faith of this Guarantee;",
        "",
        "b. AND WHEREAS, the Guarantor has agreed to guarantee the due performance and payment obligations of the Principal Debtor in relation to the underlying financial accommodation; and",
        "",
        "NOW, THEREFORE, in consideration of the mutual covenants, promises, and obligations contained herein, the Parties agree as follows:",
      ].join("\n");
    },

    CORE_PURPOSE_001: () => {
      // `objective_summary` used to be the fallback here. It is an INTERNAL
      // description of what the generator should produce ("This Guarantee
      // Agreement should read as a coherent Indian legal document ...") and it
      // was printing as Clause 1 for every document type with no purposeMode.
      // An instruction to the drafter is not a term of the contract, and nothing
      // written for the generator may ever reach the page.
      const rendered = resolveServicePurposeClause(documentType, namedParties, variables);
      return rendered || clause.text;
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

    CORE_TERM_001: () =>
      documentType === "GUARANTEE_AGREEMENT"
        ? resolveGuaranteeTermText(variables)
        : resolveServiceTermClause(documentType, namedParties, variables),

    CORE_TERMINATION_001: () => {
      // A guarantee has its own exit: revocation as to future transactions under
      // Section 130, and discharge when the guaranteed obligations are paid. A
      // generic convenience-termination clause sat beside that and contradicted
      // it -- and, as drafted, let the Principal Debtor walk away from a
      // guarantee given for the Creditor's benefit on thirty days' notice.
      if (documentType === "GUARANTEE_AGREEMENT") {
        return {
          title: "Revocation and Discharge",
          text: "This Guarantee may not be terminated for convenience by any Party. The Guarantor may revoke this Guarantee only as to future transactions, in the manner and with the effect set out in the continuing guarantee clause of this Agreement and Section 130 of the Indian Contract Act, 1872. This Guarantee is otherwise discharged only when the guaranteed obligations have been paid or performed in full, and no revocation, expiry, or discharge shall release the Guarantor from liability for any obligation that had accrued before it took effect.",
        };
      }

      return {
        title: "Termination",
        text:
          documentType === "JOINT_VENTURE_AGREEMENT"
            ? resolveJointVentureTerminationText(variables)
            : resolveGenericTerminationText(namedParties, variables, present),
      };
    },

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
      )}.` : ""}\n${formatStructuredSubparts([
        "salary shall be paid in arrears by direct credit to the Employee's designated bank account on or before the seventh (7th) day of the following month, consistent with the wage period and payment timelines under the Payment of Wages Act, 1936",
        "the Employer shall deduct tax at source under Section 192 of the Income Tax Act, 1961, together with such other deductions as are authorised or required by law, including the Employee's contribution to the Employees' Provident Fund and, where applicable, professional tax and Employees' State Insurance",
        "no deduction shall be made from the Employee's wages otherwise than as permitted by Section 7 of the Payment of Wages Act, 1936",
        "the Employer shall issue a monthly pay slip recording gross salary, each deduction, and net pay, and shall furnish Form 16 within the time prescribed under the Income Tax Rules, 1962",
        "the compensation is reviewed annually at the Employer's discretion and any revision shall be recorded in writing; a review does not of itself create an entitlement to an increase",
      ])}`,

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

      return `${serviceScopeText}${techStackText ? `\n${techStackText}` : ""}\nThe ${actor} shall perform the services with reasonable skill, care, and diligence, in accordance with the scope described above and with the standard of skill and care reasonably expected of a competent provider of comparable services.${resolveAvailabilitySentence(
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
      text: `${resolveGenericTerminationText(namedParties, variables, present)}${hasMeaningfulValue(
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

    // The clause stated the permitted purpose and stopped. Every NDA also needs a
    // route for disclosure compelled by law or by a regulator -- without one the
    // receiving party is contractually bound either to breach the agreement or
    // to breach the order.
    NDA_DISCLOSURE_PERMITTED_001: () => ({
      title: "Permitted Use and Disclosure",
      text: [
        `The ${namedParties.second} shall use Confidential Information solely for ${stripExternalReferencePhrases(
          variables.permitted_use || variables.purpose,
          "the permitted purpose expressly stated in this Agreement"
        )}.${normalizeWhitespace(variables.nda_type).toLowerCase().includes("mutual") ? ` Where this Agreement operates as a mutual non-disclosure agreement, each Party may use the other Party's Confidential Information only for that same permitted purpose.` : ""} Disclosure is permitted only as follows:`,
        formatStructuredSubparts([
          "to those of its personnel, professional advisers, and auditors who need the Confidential Information for the permitted purpose and who are bound by obligations of confidence no less protective than those in this Agreement, the recipient remaining responsible for their compliance",
          "where disclosure is required by Applicable Law, by a court or tribunal of competent jurisdiction, by a regulator, or by the rules of a stock exchange to which the recipient is subject",
          "where disclosure is compelled under the preceding limb, the recipient shall, to the extent legally permitted, give the other Party prompt written notice before disclosing so that it may seek a protective order, and shall disclose only the minimum required while using reasonable endeavours to obtain confidential treatment",
          "no other disclosure is permitted, and a disclosure made in reliance on this clause does not otherwise release the Confidential Information from the obligations of this Agreement",
        ]),
      ].join("\n"),
    }),

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

    CORE_INDEMNITY_001: () => ({
      title: "Indemnity",
      text: [
        `Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives (each an "Indemnified Party") from and against ${resolveIndemnityScopeText(
          variables
        )}. The conduct of any claim to which this indemnity applies shall be governed as follows:`,
        formatStructuredSubparts([
          "the Indemnified Party shall notify the Indemnifying Party in writing as soon as reasonably practicable after becoming aware of a claim for which indemnity is sought, giving reasonable particulars of the claim; a delay in giving notice shall reduce the Indemnifying Party's liability only to the extent it is actually prejudiced by that delay",
          "the Indemnifying Party may, on written notice, assume conduct of the defence of the claim at its own cost using legal advisers reasonably acceptable to the Indemnified Party, and the Indemnified Party shall provide reasonable cooperation, access to relevant records, and assistance at the Indemnifying Party's cost",
          "the Indemnifying Party shall not settle or compromise a claim on terms that impose a non-indemnified liability, an admission of wrongdoing, or an ongoing restriction on the Indemnified Party without that Party's prior written consent, and the Indemnified Party shall not settle or compromise a claim without prior consultation with the Indemnifying Party except where urgent action is reasonably required to mitigate loss",
          "the Indemnified Party shall take reasonable steps to mitigate its loss, and the indemnity shall not extend to loss to the extent caused or increased by the Indemnified Party's own breach, negligence, or failure to mitigate",
          "recovery under this indemnity shall be reduced by any amount actually recovered by the Indemnified Party from insurance or from a third party in respect of the same loss, so that the Indemnified Party is not compensated twice for the same loss",
        ]),
      ].join("\n"),
    }),

    CORE_LIABILITY_CAP_001: () =>
      [
      `Subject to the carve-outs below, the aggregate liability of either Party under or in connection with this Agreement, whether arising in contract, tort (including negligence), breach of statutory duty, restitution, or otherwise, ${resolveLiabilityCapText(
        variables
      )}.`,
      formatStructuredSubparts([
        "neither Party shall be liable for indirect, incidental, special, punitive, exemplary, or consequential loss, or for loss of profits, loss of anticipated savings, loss of opportunity, loss of goodwill, or loss of business, in each case whether or not that loss was foreseeable at the date of this Agreement",
        "the limitations and exclusions in this clause shall not apply to liability arising from fraud or fraudulent misrepresentation, wilful misconduct, breach of the confidentiality provisions of this Agreement, deliberate infringement or misappropriation of intellectual property rights, a Party's payment obligations in respect of amounts properly due, or any liability which cannot lawfully be excluded or limited",
        "the cap in this clause applies to the aggregate of all claims taken together and not to each claim separately, and each Party's liability shall be reduced to the extent that the loss was caused or contributed to by the other Party's own breach, negligence, or failure to mitigate",
        "the Parties confirm that the allocation of risk recorded in this clause is a genuine and reasonable commercial apportionment, negotiated in light of the consideration payable under this Agreement, and that each Party has had the opportunity to price and insure the risk it bears",
      ]),
    ].join("\n"),

    CORE_LIMITATION_LIABILITY_001: () =>
      [
      `Subject to the carve-outs below, the aggregate liability of either Party under or in connection with this Agreement, whether arising in contract, tort (including negligence), breach of statutory duty, restitution, or otherwise, ${resolveLiabilityCapText(
        variables
      )}.`,
      formatStructuredSubparts([
        "neither Party shall be liable for indirect, incidental, special, punitive, exemplary, or consequential loss, or for loss of profits, loss of anticipated savings, loss of opportunity, loss of goodwill, or loss of business, in each case whether or not that loss was foreseeable at the date of this Agreement",
        "the limitations and exclusions in this clause shall not apply to liability arising from fraud or fraudulent misrepresentation, wilful misconduct, breach of the confidentiality provisions of this Agreement, deliberate infringement or misappropriation of intellectual property rights, a Party's payment obligations in respect of amounts properly due, or any liability which cannot lawfully be excluded or limited",
        "the cap in this clause applies to the aggregate of all claims taken together and not to each claim separately, and each Party's liability shall be reduced to the extent that the loss was caused or contributed to by the other Party's own breach, negligence, or failure to mitigate",
        "the Parties confirm that the allocation of risk recorded in this clause is a genuine and reasonable commercial apportionment, negotiated in light of the consideration payable under this Agreement, and that each Party has had the opportunity to price and insure the risk it bears",
      ]),
    ].join("\n"),

    // ── Boilerplate depth ────────────────────────────────────────────────
    // These provisions were one-sentence stubs. A stub is not merely thin: a
    // notices clause with no deemed-receipt rule cannot fix the date a notice
    // took effect, a severability clause with no reading-down limb forces an
    // all-or-nothing result, and a force majeure clause with no prolonged-event
    // limb leaves the parties bound indefinitely. Each is now drafted as
    // numbered sub-clauses so it can be cross-referred to.

    CORE_FORCE_MAJEURE_001: () => ({
      title: "Force Majeure",
      text: [
        "Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement to the extent that the failure or delay is caused by a Force Majeure Event, provided that the affected Party complies with this clause. An obligation to pay an amount already due and payable shall not be excused by a Force Majeure Event.",
        formatStructuredSubparts([
          "the affected Party shall notify the other Party in writing within seven (7) days of becoming aware of the Force Majeure Event, describing the event, the obligations affected, and its anticipated duration, and shall keep the other Party reasonably informed of material developments",
          "the affected Party's obligations shall be suspended for so long as the Force Majeure Event continues, and the time for performance shall be extended by the period of suspension",
          "the affected Party shall use reasonable endeavours to mitigate the effect of the Force Majeure Event and to resume full performance as soon as reasonably practicable, and shall notify the other Party promptly upon the event ceasing",
          "if a Force Majeure Event continues for a continuous period exceeding sixty (60) days, either Party may terminate this Agreement by written notice to the other, without liability except in respect of obligations accrued before the date of termination",
        ]),
      ].join("\n"),
    }),

    // Stamp duty is a State subject. Naming only the Indian Stamp Act, 1899 in a
    // Maharashtra instrument is not wrong so much as incomplete -- the duty
    // actually payable is fixed by the State's own Act and Schedule. States with
    // their own consolidated stamp Act are named; the rest are referred to the
    // Indian Stamp Act as in force there, which is the accurate description
    // rather than a guess at a local Act that may not exist.
    // The supervising advocate should confirm this list against current State
    // legislation before it is relied on for a filing.
    CORE_STAMP_AND_COSTS_001: () => {
      const state = normalizeWhitespace(
        variables.operating_state || variables.governing_law_state
      );
      const statute = state
        ? `${STATE_STAMP_ACTS[state] || `the Indian Stamp Act, 1899 as in force in ${state}`}`
        : "the Indian Stamp Act, 1899 read with the stamp legislation in force in the State in which this Agreement is executed";

      return {
        title: "Stamp Duty, Registration and Costs",
        text: [
          `This Agreement shall be stamped with non-judicial stamp duty of the value payable under ${statute}, and shall be stamped before or at the time of execution.`,
          "Unless otherwise expressly agreed in writing, the stamp duty, registration fees where registration is required under applicable law, and all incidental charges payable in respect of this Agreement shall be borne equally by the Parties, and each Party shall bear its own legal, professional, and advisory costs.",
          "The Parties acknowledge that an instrument which is not duly stamped is inadmissible in evidence until the deficiency in duty, together with any penalty, is made good in accordance with the applicable stamp legislation.",
        ].join("\n"),
      };
    },

    CORE_NOTICE_001: () => {
      // The clause used to point at "the address set out in this Agreement",
      // which made a reader hunt through the recitals and made the clause fail
      // outright if no address had been captured. The addresses are set out
      // here, in the clause that uses them, so a notice can be served from this
      // page alone.
      const noticeParties = getParticipantExpectations(documentType, variables)
        .map((participant) => {
          const address = stripExternalReferencePhrases(participant.address, "");
          if (!hasMeaningfulValue(address)) return "";
          const email = normalizeWhitespace(participant.email);
          const label = participant.label || participant.name;
          return `${label}: ${normalizeWhitespace(participant.name)}, ${address}${
            email ? `, marked for the attention of the authorised signatory, email ${email}` : ""
          }`;
        })
        .filter(Boolean);

      const addressBlock = noticeParties.length
        ? `\nThe addresses for notices are:\n${formatStructuredSubparts(noticeParties)}`
        : "";

      return {
      title: "Notices",
      text: [
        "Any notice, consent, approval, demand, or other communication required or permitted under this Agreement shall be in writing in the English language and shall be sent to the address of the recipient Party set out in this clause, or to such other address as that Party may notify under this clause. A communication shall be deemed to have been received as follows:",
        formatStructuredSubparts([
          "if delivered by hand, on the date of delivery where delivered on a Business Day before 5:00 p.m. local time, and otherwise on the next Business Day",
          "if sent by registered post or speed post with acknowledgement due, on the date recorded on the acknowledgement or on the fifth (5th) Business Day after posting, whichever is earlier",
          "if sent by a reputed courier service, on the second (2nd) Business Day after the date of dispatch",
          "if sent by electronic mail to the address notified for that purpose, on the date of transmission where sent on a Business Day before 5:00 p.m. local time and no delivery-failure notification is received, and otherwise on the next Business Day",
        ]),
        "A Party changing its address or electronic mail address for notices shall give the other Party not less than seven (7) days' prior written notice of the change, and until that notice is given a communication sent to the last notified address shall be validly given.",
      ].join("\n") + addressBlock,
      };
    },

    CORE_SURVIVAL_001: () => ({
      title: "Survival",
      text: `Expiry or termination of this Agreement shall not affect any right, remedy, obligation, or liability of a Party that has accrued as at the date of expiry or termination, and shall not affect the coming into force or the continuance in force of any provision which is expressly, or by implication, intended to come into force or to continue in force on or after that date. Without limiting the generality of the foregoing, the provisions of this Agreement relating to ${joinSeries(
        survivingProvisionLabels(present)
      )} shall survive expiry or termination and shall continue to bind the Parties.`,
    }),

    CORE_ASSIGNMENT_001: () => ({
      title: "Assignment",
      text: [
        "Neither Party shall assign, transfer, charge, subcontract, or otherwise deal with all or any of its rights or obligations under this Agreement without the prior written consent of the other Party, such consent not to be unreasonably withheld or delayed.",
        formatStructuredSubparts([
          "a Party may, on written notice to the other Party, assign or novate this Agreement to an Affiliate, or to a successor in title to substantially the whole of the business or assets to which this Agreement relates, provided that the assignee agrees in writing to be bound by this Agreement",
          "any purported assignment, transfer, or charge in breach of this clause shall be void and of no effect",
          "this Agreement shall be binding on, and shall enure for the benefit of, each Party and its permitted successors and assigns",
        ]),
      ].join("\n"),
    }),

    CORE_SEVERABILITY_001: () => ({
      title: "Severability",
      text: "If any provision or part-provision of this Agreement is or becomes invalid, illegal, or unenforceable under Applicable Law, it shall be deemed modified to the minimum extent necessary to make it valid, legal, and enforceable, and if such modification is not possible, the provision or part-provision concerned shall be deemed deleted. Any modification to, or deletion of, a provision or part-provision under this clause shall not affect the validity and enforceability of the remainder of this Agreement, which shall continue in full force and effect. Where a provision is modified or deleted under this clause, the Parties shall negotiate in good faith to substitute a valid and enforceable provision that achieves, so far as possible, the commercial result originally intended.",
    }),

    CORE_WAIVER_001: () => ({
      title: "Waiver",
      text: "No failure, delay, or indulgence by a Party in exercising any right, power, or remedy under this Agreement shall operate as a waiver of that right, power, or remedy, nor shall any single or partial exercise of it preclude any further exercise of that or any other right, power, or remedy. A waiver of any right, power, or remedy under this Agreement is effective only if it is given in writing and signed by or on behalf of the waiving Party, and shall not be treated as a waiver of any subsequent breach or default. The rights and remedies provided under this Agreement are cumulative and are not exclusive of any rights or remedies available under Applicable Law.",
    }),

    CORE_AMENDMENT_001: () => ({
      title: "Amendment",
      text: "No amendment, variation, or modification of this Agreement shall be valid or binding unless it is recorded in writing, expressly refers to this Agreement, and is signed by or on behalf of each Party by a person duly authorised for that purpose. No course of dealing between the Parties, exchange of correspondence, or oral assurance shall operate to vary this Agreement. Where an amendment attracts stamp duty or compulsory registration under Applicable Law, that amendment shall be duly stamped and, where required, registered before either Party relies upon it.",
    }),

    CORE_COUNTERPARTS_001: () => ({
      title: "Counterparts and Electronic Execution",
      text: "This Agreement may be executed in any number of counterparts, each of which when executed and delivered shall constitute an original, and all counterparts taken together shall constitute one and the same instrument. A Party may enter into this Agreement by executing a counterpart and delivering it by electronic mail in portable document format, or by affixing an electronic signature to it. The Parties acknowledge that, under Section 5 of the Information Technology Act, 2000, an electronic signature affixed in the prescribed manner satisfies a requirement of law that information be authenticated by signature, save in respect of the classes of document excluded by the First Schedule to that Act; and where this Agreement or any amendment to it falls within that Schedule, it shall be executed as a physical instrument bearing wet-ink signatures.",
    }),

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
      return `The ${actor} shall submit written progress and status reports to ${timelineLabels.reviewer}, setting out the work completed, milestones achieved, issues encountered, anticipated delays, and next steps, at a reasonable periodic frequency consistent with the deliverables and reporting requirements recorded in this Agreement.${resolveGovernanceProtectionSentences(
        variables
      )}`;
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
        // No acceptance criteria were supplied, so the test is the scope and
        // deliverables the document actually defines. Pointing at "the criteria
        // described in this Agreement" would reference nothing.
        "the requirements of the Services and the deliverables described in this Agreement, and its fitness for the purpose for which it was commissioned"
      )} and the project scope${
        variables.project_description
          ? ` for ${normalizeWhitespace(variables.project_description)}`
          : ""
      } (together, the "Acceptance Criteria"). If the Software meets the Acceptance Criteria, ${serviceLabels.payer} shall issue a written acceptance notice. If the Software fails to meet the Acceptance Criteria, ${serviceLabels.payer} shall notify ${serviceLabels.payee} in writing specifying the defects in reasonable detail, and ${serviceLabels.payee} shall remedy such defects within fifteen (15) business days of such notice, following which the Acceptance Testing Period shall recommence.${resolveSourceCodeDeliverySentence(
        variables
      )} If ${serviceLabels.payer} fails to issue an acceptance notice or a defect notice within the Acceptance Testing Period, the Software shall be deemed accepted.`,

    SERVICE_ACCEPTANCE_001: () =>
      `${serviceLabels.payer} shall review the relevant Services or deliverables against ${stripExternalReferencePhrases(
        variables.acceptance_criteria,
        "the scope of Services and the deliverables described in this Agreement, and their fitness for the purpose for which they were commissioned"
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
      `Each Party shall contribute to the Joint Venture the agreed resources, expertise, and capital. The ${namedParties.first} shall contribute ${formatCurrency(
        variables.capital_contribution_1
      )} and the ${namedParties.second} shall contribute ${formatCurrency(
        variables.capital_contribution_2
      )}. Profits and losses arising from the Joint Venture shall be shared between the Parties in the ratio of ${normalizeWhitespace(
        variables.profit_sharing_ratio || "the agreed ratio"
      )}. Each Party's contribution shall be made within the timeframes agreed between the Parties in writing, and failure to contribute shall constitute a material breach of this Agreement.`,

    JV_GOVERNANCE_001: () =>
      `The Joint Venture shall be managed by a Management Committee comprising representatives from each Party. The agreed structure of the Joint Venture is ${stripExternalReferencePhrases(
        variables.jv_structure,
        "the structure expressly agreed between the Parties"
      )}, and the Parties shall use that structure to govern ownership economics, contribution obligations, decision rights, operational responsibility, and authority to deal with third parties.${hasMeaningfulValue(
        variables.management_control
      ) ? ` The Parties specifically agree that management control shall operate as follows: ${stripExternalReferencePhrases(
        variables.management_control,
        ""
      )}.` : " Decisions of the Management Committee shall require unanimous consent for major decisions and a simple majority for routine operational decisions."} Major decisions shall include approval of the annual budget, entry into any third-party contract outside the ordinary course of business, any material change in the scope of the Joint Venture, and admission of any new party to the Joint Venture. Each Party shall designate its representatives to the Management Committee in writing and may replace them at any time on written notice.${resolveGovernanceProtectionSentences(
        variables
      )}`,

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
      )}${hasMeaningfulValue(variables.drawing_limit) ? ` with partner drawing authority operating in accordance with the following limit or approval arrangement: ${formatAmountOrText(stripExternalReferencePhrases(
        variables.drawing_limit,
        ""
      ))}` : ""}.` : ""}${hasMeaningfulValue(variables.dissolution_terms) ? ` Dissolution shall be governed by the following agreed terms: ${stripExternalReferencePhrases(
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
      [
        `Exit from the Joint Venture shall be treated separately from termination of this Agreement. The agreed exit mechanism shall apply as follows: ${stripExternalReferencePhrases(
          variables.exit_terms,
          "the exiting Party shall give not less than ninety (90) days' prior written notice, the non-exiting Party shall have a right of first offer to acquire the exiting Party's interest at fair market value determined by an independent valuer, and if no buyout is completed within the agreed period the Parties shall jointly implement a commercially reasonable unwind, transfer, or sale process"
        )}.`,
        "Where an exit is implemented by buyout, the purchase price, valuation date, payment timeline, transfer documentation, and release of guarantees or support obligations shall be documented in writing.",
        "Where an exit is implemented by winding up or unwind, the Parties shall allocate assets, liabilities, contracts, employees or personnel, receivables, payables, licences, and permits in a commercially reasonable manner consistent with their ownership structure and accrued obligations.",
        "Intellectual property created for or used by the Joint Venture shall be allocated in accordance with the agreed IP ownership terms, and each Party shall retain only those rights expressly reserved to it or necessary to comply with post-exit obligations.",
      ].join(" "),

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
      `The Tenant shall pay a refundable security deposit of ${formatCurrency(
        variables.security_deposit
      )} prior to or at the time of execution of this Agreement. The security deposit shall be held as security for the due performance of the Tenant's obligations and shall not carry interest. The Landlord shall refund the security deposit within thirty (30) days of the Tenant vacating the Premises and delivering peaceful possession, after deducting any outstanding dues, unpaid rent, or costs of repairing damage caused by the Tenant beyond fair wear and tear. The Landlord shall furnish a written account of all deductions made.`,

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
      ) ? `, such lock-in period being ${normalizeWhitespace(variables.lock_in_period)}` : ""}; and (b) by the Landlord immediately upon material breach, persistent payment default, or unlawful use, subject to the contractual cure process and applicable law. Upon termination, the Tenant shall vacate the Premises within the notice period, return them in the same condition as at commencement (reasonable wear and tear excepted), and hand over all keys and access devices.`,

    // The engine already determines whether THIS instrument is compulsorily
    // registrable -- an 11-month tenancy and a 24-month tenancy produce
    // different registration notices. The clause itself, however, said "where
    // required by law" in both cases, so the document hedged on a question the
    // system had already answered from the user's own term. It now states the
    // position, the s.23 presentation deadline, and the s.49 consequence.
    PROP_REGISTRATION_001: () => {
      const months = Number(variables.lease_term_months);
      const registrable = variables.is_registrable === true;
      const termPhrase = Number.isFinite(months) ? ` of ${months} months` : "";

      const position = registrable
        ? `The Parties acknowledge that, the term of this Agreement${termPhrase} being such as to attract Section 17(1)(d) of the Registration Act, 1908 read with Section 107 of the Transfer of Property Act, 1882, this Agreement is compulsorily registrable. The Parties shall present this Agreement for registration before the jurisdictional Sub-Registrar within four (4) months of its execution as required by Section 23 of the Registration Act, 1908. The Parties are aware that, under Section 49 of that Act, an instrument requiring registration which is not registered cannot be received in evidence of any transaction affecting the immovable property to which it relates.`
        : `The Parties acknowledge that, the term of this Agreement${termPhrase} being within the threshold in Section 17(1)(d) of the Registration Act, 1908, registration of this Agreement is not compulsory. The Parties may nonetheless present it for registration, and shall do so if the term is extended or renewed such that the aggregate term attracts compulsory registration.`;

      return `${position} This Agreement shall in any event be stamped in accordance with the applicable State Stamp Act before execution.${normalizeBooleanChoice(
        variables.police_verification_required,
        false
      ) ? " Police verification of the occupant shall be mandatory, and the Parties shall cooperate in filing the prescribed police-verification or tenant-information forms with the competent local authority." : ""}${hasMeaningfulValue(
        variables.society_rules
      ) ? ` The Parties shall also comply with the following society, association, or building-compliance requirements: ${stripExternalReferencePhrases(
        variables.society_rules,
        ""
      )}.` : ""} Stamp duty and registration charges shall be borne in the manner agreed by the Parties or, in the absence of a specific agreement, equally.`;
    },

    // ── Depth, tranche 2 ─────────────────────────────────────────────────
    // These rendered under 40 words. Each was thin in a way that costs something
    // concrete: a governing-law clause that never names a forum, an indemnity
    // four document types received in a 29-word form while every other type got
    // the full one, and confidentiality provisions with no security standard,
    // no compelled-disclosure procedure and no route to an injunction.

    // Governing law is not the same question as forum. This clause appeared in
    // all 22 document types stating the applicable law and then stopping, so no
    // court was ever named as having jurisdiction.
    CORE_GOVERNING_LAW_001: () => {
      const state = normalizeWhitespace(
        variables.governing_law_state || variables.operating_state
      );
      // A forum is a place. "the courts at Maharashtra" names nowhere a party
      // can actually file, so compose "City, State" when the city is known and
      // fall back to the competent courts OF the state when it is not.
      const city = normalizeWhitespace(
        variables.execution_city || variables.arbitration_city
      );
      const forum = city && state && city.toLowerCase() !== state.toLowerCase()
        ? `${city}, ${state}`
        : city;

      return {
        title: "Governing Law and Jurisdiction",
        text: [
          `This Agreement, and any dispute or claim arising out of or in connection with it, its subject matter or its formation (including non-contractual disputes or claims), shall be governed by and construed in accordance with the laws of India${
            state ? `, and where local procedural, registration, or stamp matters are relevant, as applied in the State of ${state}` : ""
          }.`,
          formatStructuredSubparts([
            forum
              ? `subject to the dispute resolution provisions of this Agreement, the competent courts at ${forum} shall have exclusive jurisdiction to settle any dispute or claim arising out of or in connection with this Agreement, and each Party irrevocably submits to that jurisdiction`
              : state
                ? `subject to the dispute resolution provisions of this Agreement, the competent courts having territorial jurisdiction in the State of ${state} shall have exclusive jurisdiction to settle any dispute or claim arising out of or in connection with this Agreement, and each Party irrevocably submits to that jurisdiction`
                : "subject to the dispute resolution provisions of this Agreement, the competent courts of India shall have exclusive jurisdiction to settle any dispute or claim arising out of or in connection with this Agreement, and each Party irrevocably submits to that jurisdiction",
            "where this Agreement provides for arbitration, the jurisdiction conferred above is the supervisory jurisdiction over the arbitration, and nothing in this clause shall be read as permitting either Party to commence substantive proceedings in court in place of arbitration",
            "each Party waives any objection to that forum on the ground of inconvenient forum or that proceedings have been brought in an inappropriate court",
            "the rules of private international law shall not apply to the extent they would result in the application of the law of any jurisdiction other than India",
            "nothing in this clause shall prevent either Party from applying to any court of competent jurisdiction for interim or protective relief, including injunctive relief, to preserve its rights pending resolution of the dispute",
          ]),
        ].join("\n"),
      };
    },

    // The static text read "the goods specifically described and specified in
    // this Agreement" -- but nothing in the Agreement ever described them. The
    // detailed goods_description the user typed was discarded, so a supply
    // contract went out with no identification of its own subject matter.
    SUPPLY_GOODS_DESCRIPTION_001: () => {
      const goods = stripExternalReferencePhrases(
        variables.goods_description || variables.product_description,
        ""
      );
      const quantity = stripExternalReferencePhrases(variables.quantity, "");

      const opening = goods
        ? `The Seller shall supply to the Purchaser the following goods${
            quantity ? `, in the quantity of ${quantity}` : ""
          }: ${goods}.`
        : "The Seller shall supply to the Purchaser the goods described in the Schedule to this Agreement, in the quantities stated there.";

      return {
        title: "Description of Goods",
        text: [
          opening,
          formatStructuredSubparts([
            "the goods shall correspond with that description, and where the sale is by description the Purchaser is entitled to reject goods that do not so correspond, in accordance with Section 15 of the Sale of Goods Act, 1930",
            "the goods shall be of merchantable quality and, where the Purchaser has made known the particular purpose for which they are required so as to show reliance on the Seller's skill or judgement, shall be reasonably fit for that purpose, in accordance with Section 16 of that Act",
            "where the sale is by sample as well as by description, the bulk shall correspond with both the sample and the description",
            "the goods shall be packed and marked so as to withstand the agreed mode of carriage, and shall be accompanied by the test certificates, manuals, and statutory documentation applicable to goods of that kind",
            "any variation in specification, model, grade, or quantity requires the Purchaser's prior written agreement, and goods delivered outside the agreed specification are delivered at the Seller's risk",
          ]),
        ].join("\n"),
      };
    },

    IP_COPYRIGHT_001: () => ({
      title: "Copyright",
      text: [
        "Copyright and all other rights in the works, materials, designs, code, text, images, and other subject matter created under this Agreement shall vest as set out in the intellectual property provisions of this Agreement, and the following shall apply to that vesting:",
        formatStructuredSubparts([
          "an assignment of copyright under this Agreement is made in writing and signed as required by Section 19 of the Copyright Act, 1957, and takes effect on creation of the work or on the date of this Agreement, whichever is later",
          "the Parties agree that Section 19(4) of that Act, under which an assignment lapses if the assignee does not exercise the rights within one year, shall not operate to defeat the assignment, and the assignee may exercise the assigned rights at any time during the term of copyright",
          "the assignment extends to all media and formats, whether now known or later devised, and for the full term of copyright including all renewals, revivals, reversions, and extensions",
          "the author waives, to the extent permissible under Section 57 of the Copyright Act, 1957, the right to restrain or claim damages in respect of any modification or adaptation of the work made in the ordinary course of its exploitation, save where the treatment is prejudicial to the author's honour or reputation",
          "the assignor shall execute any further document reasonably required to record or perfect the assignment before the Registrar of Copyrights or any equivalent authority",
        ]),
      ].join("\n"),
    }),

    IP_LICENSE_001: () => ({
      title: "Licence Grant",
      text: [
        "To the extent that any intellectual property is licensed rather than assigned under this Agreement, the licensor grants the licensee a licence on the terms set out below and retains all rights not expressly granted.",
        formatStructuredSubparts([
          "the licence is non-exclusive, non-transferable, and royalty-free unless this Agreement expressly provides otherwise, and extends to the territory of India unless a wider territory is expressly stated",
          "the licence is granted solely for the purpose of receiving and using the deliverables or services under this Agreement, and for no other purpose",
          "the licence continues for the term of this Agreement and, in respect of deliverables paid for in full, on a perpetual basis after termination, save where this Agreement is terminated for the licensee's material breach",
          "the licensor warrants that it is entitled to grant the licence and that use of the licensed material in accordance with this Agreement will not infringe the intellectual property rights of any third party",
          "no licence is granted by implication, estoppel, or otherwise in respect of any intellectual property other than that expressly identified",
        ]),
      ].join("\n"),
    }),

    IP_LICENSE_RESTRICTIONS_001: () => ({
      title: "Licence Restrictions",
      text: [
        "The licensee shall not, and shall not permit any third party to, do any of the following in relation to the licensed material:",
        formatStructuredSubparts([
          "sub-license, assign, rent, lease, lend, distribute, or otherwise make the licensed material available to any third party, except to its own personnel and professional advisers who need access for the permitted purpose and who are bound by equivalent restrictions",
          "reverse engineer, decompile, or disassemble the licensed material, or otherwise attempt to derive its source code, structure, or underlying ideas, except to the limited extent that such an act cannot lawfully be prohibited",
          "remove, obscure, or alter any proprietary notice, trade mark, watermark, or attribution appearing on or in the licensed material",
          "use the licensed material to build, train, or improve a competing product or service, or to benchmark it for publication without the licensor's prior written consent",
          "use the licensed material beyond the scope, territory, user count, or period expressly permitted, and any such use shall be a material breach of this Agreement",
        ]),
      ].join("\n"),
    }),

    IP_FEEDBACK_001: () => ({
      title: "Feedback",
      text: "Either Party may from time to time provide the other with suggestions, comments, error reports, or other feedback relating to the deliverables or services under this Agreement. The receiving Party may use, incorporate, and exploit that feedback freely and without restriction, obligation of confidence, attribution, or payment, and the Party giving the feedback assigns to the receiving Party any intellectual property rights subsisting in it. Nothing in this clause obliges either Party to give feedback, obliges the recipient to act on it, or transfers any right in the Confidential Information or pre-existing materials of the Party giving the feedback.",
    }),

    CORE_CONTRACT_FORMATION_001: () => ({
      title: "Formation and Validity",
      text: [
        "The Parties confirm that this Agreement satisfies the requirements of a valid contract under Section 10 of the Indian Contract Act, 1872, and record the following for the avoidance of doubt:",
        formatStructuredSubparts([
          "each Party is competent to contract within the meaning of Section 11 of that Act, being of the age of majority, of sound mind, and not disqualified from contracting by any law to which it is subject",
          "each Party enters into this Agreement of its own free will within the meaning of Section 14, and not as a result of coercion, undue influence, fraud, misrepresentation, or mistake",
          "the consideration and the object of this Agreement are lawful within the meaning of Section 23, and are not forbidden by law, fraudulent, or opposed to public policy",
          "each Party has had the opportunity to take independent legal advice on this Agreement before executing it, whether or not it has chosen to do so",
          "where a Party is a body corporate, the person executing this Agreement on its behalf is duly authorised to do so and that Party's entry into this Agreement is within its objects and powers",
        ]),
      ].join("\n"),
    }),

    CORE_COMPLIANCE_WITH_LAW_001: () => ({
      title: "Compliance with Law",
      text: [
        "Each Party shall, in performing its obligations under this Agreement, comply with all Applicable Law, and shall obtain and maintain at its own cost every registration, licence, permission, consent, and approval necessary for it to perform those obligations lawfully.",
        formatStructuredSubparts([
          "neither Party shall offer, promise, give, request, or accept any undue advantage, whether directly or through a third party, in order to obtain or retain business or any improper advantage, and each Party shall comply with the Prevention of Corruption Act, 1988 and with any other anti-bribery legislation applicable to it",
          "each Party shall comply with the applicable tax, labour, environmental, and data protection legislation in force from time to time, including the Digital Personal Data Protection Act, 2023 where personal data is processed under this Agreement",
          "each Party shall promptly notify the other if it becomes aware of any circumstance that would make performance of this Agreement unlawful, or that would place the other Party in breach of Applicable Law",
          "a Party shall not be required to do anything under this Agreement that would cause it to breach Applicable Law, and shall consult with the other Party in good faith to agree a lawful alternative before treating performance as excused",
        ]),
      ].join("\n"),
    }),

    NDA_DATA_SECURITY_001: () => ({
      title: "Data Security",
      text: [
        "The Receiving Party shall protect the Confidential Information with reasonable security safeguards appropriate to its sensitivity, and in no event with less care than it applies to its own confidential information of a like kind.",
        formatStructuredSubparts([
          "Confidential Information shall be held in systems that are access-controlled, and access shall be limited to those personnel who need it for the permitted purpose",
          "Confidential Information shall be encrypted in transit and, where stored electronically, at rest, using methods that are generally accepted as adequate at the relevant time",
          "the Receiving Party shall maintain a record sufficient to identify who has accessed the Confidential Information and when, and shall produce that record to the Disclosing Party on reasonable written request",
          "the Receiving Party shall notify the Disclosing Party in writing without undue delay, and in any event within seventy-two (72) hours, of becoming aware of any unauthorised access to, disclosure of, or loss of the Confidential Information, and shall provide reasonable assistance in investigating and mitigating the incident",
          "where the Confidential Information includes personal data, the Receiving Party shall additionally comply with its obligations as a Data Fiduciary or Data Processor under the Digital Personal Data Protection Act, 2023, including the obligation to give notice of a personal data breach",
        ]),
      ].join("\n"),
    }),

    NDA_BREACH_REMEDIES_001: () => ({
      title: "Remedies for Breach",
      text: [
        "The Parties acknowledge that Confidential Information is of a nature such that an award of damages alone would not be an adequate remedy for its unauthorised use or disclosure, and that a breach of the confidentiality provisions of this Agreement may cause harm that cannot be readily quantified.",
        formatStructuredSubparts([
          "the Disclosing Party shall be entitled to seek injunctive relief, specific performance, and any other equitable remedy from a court of competent jurisdiction to restrain a threatened or continuing breach, without being required to prove special damage and without any obligation to furnish security",
          "the Parties record that, following the Specific Relief Act (Amendment) Act, 2018, specific performance is a general remedy rather than a discretionary one, and neither Party shall contend that damages are an adequate remedy for the purposes of resisting such relief",
          "equitable relief under this clause is in addition to, and not in substitution for, any right to damages, an account of profits, or delivery up of materials containing the Confidential Information",
          "the Receiving Party shall, on written demand, provide the Disclosing Party with a full account of the circumstances of any unauthorised use or disclosure, including the persons involved and the information affected",
        ]),
      ].join("\n"),
    }),

    NDA_DURATION_001: () => {
      const period = stripExternalReferencePhrases(variables.confidentiality_period, "");

      return {
        title: "Duration of Confidentiality",
        text: [
          period
            ? `The confidentiality obligations in this Agreement shall take effect on the Effective Date and shall continue for ${period} after the expiry or earlier termination of this Agreement.`
            : "The confidentiality obligations in this Agreement shall take effect on the Effective Date and shall continue for three (3) years after the expiry or earlier termination of this Agreement.",
          formatStructuredSubparts([
            "in respect of any Confidential Information that constitutes a trade secret, the obligations shall continue for so long as that information retains the character of a trade secret, without limit of time",
            "in respect of any Confidential Information that constitutes personal data, the obligations shall continue for so long as the Receiving Party retains that data, and the data shall be erased once the purpose for which it was shared is exhausted",
            "expiry of the confidentiality period shall not operate to permit any use or disclosure that was a breach when it occurred, and shall not affect any liability already accrued",
          ]),
        ].join("\n"),
      };
    },

    CORE_ENTIRE_AGREEMENT_001: () => ({
      title: "Entire Agreement",
      text: [
        "This Agreement, together with its schedules and annexures, constitutes the entire agreement between the Parties in relation to its subject matter and supersedes all prior agreements, arrangements, understandings, term sheets, proposals, quotations, and representations, whether written or oral, relating to that subject matter.",
        formatStructuredSubparts([
          "each Party acknowledges that in entering into this Agreement it does not rely on, and shall have no remedy in respect of, any statement, representation, assurance, or warranty that is not expressly set out in this Agreement",
          "nothing in this clause shall exclude or limit any liability for fraud or fraudulent misrepresentation, or operate to exclude any term implied by Applicable Law which cannot lawfully be excluded",
          "where any purchase order, invoice, acknowledgement, portal terms, or other standard-form document issued by either Party contains terms inconsistent with this Agreement, the terms of this Agreement shall prevail unless the Parties expressly agree otherwise in a written amendment executed in accordance with this Agreement",
        ]),
      ].join("\n"),
    }),

    CORE_RELATIONSHIP_OF_PARTIES_001: () =>
      `The Parties acknowledge and agree that the relationship created by this Agreement is that of independent contracting parties and not of employer and employee, partnership, joint venture, agency, or fiduciary relationship.${normalizeBooleanChoice(
        variables.no_employment_ack,
        false
      ) ? ` The Parties expressly acknowledge that no employment, labour, or service relationship is intended or created by this Agreement, and neither Party shall represent otherwise.` : ""}${hasMeaningfulValue(
        variables.tax_responsibility
      ) ? ` Responsibility for GST, TDS, professional tax, income tax, and other applicable taxes shall be allocated as follows: ${stripExternalReferencePhrases(
        variables.tax_responsibility,
        ""
      )}.` : ""}\n${formatStructuredSubparts([
        "neither Party shall hold itself out as having authority to bind the other, and neither Party shall incur any obligation, liability, or expense on behalf of the other, without that other Party's prior written authority",
        "each Party shall be solely responsible for the wages, statutory benefits, provident fund, gratuity, and social security contributions of its own personnel, and for its own taxes, duties, returns, and statutory filings arising in connection with this Agreement",
        "the personnel deployed by a Party shall at all times remain under that Party's direction, supervision, and control, and shall not be treated as employees or workmen of the other Party for the purposes of any labour, industrial, or social-security legislation",
        "each Party shall indemnify the other against any claim, demand, or proceeding brought by its own personnel, or by any authority on their behalf, which asserts an employment or engagement relationship with that other Party",
      ])}`,

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
      `The ${actor} warrants that the Services and all Deliverables shall be performed with reasonable skill, care, diligence, and professional competence and shall materially conform to the scope of Services and the deliverables described in this Agreement.${hasMeaningfulValue(
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
      return [
        `As security for the due repayment of the Loan and discharge of all obligations under this Agreement, the Borrower shall create and maintain security in favour of the Lender over the collateral described below. The Borrower shall execute all ancillary security documents, complete all filings or registrations required by applicable law, and maintain adequate insurance over any secured assets where commercially appropriate.`,
        "",
        renderSecuritySchedule(collateral),
      ].join("\n");
    },

    LOAN_COVENANTS_001: () =>
      `For so long as any amount remains outstanding under this Agreement, the Borrower undertakes that it shall maintain its legal existence and necessary approvals, promptly notify the Lender of any default or material adverse event, provide financial information reasonably requested by the Lender, not create any encumbrance over its assets except as permitted under this Agreement, not materially alter the nature of its business without prior written consent of the Lender, and comply with all applicable laws and regulatory directions.`,

    // Events of Default used to be one paragraph carrying inline "(a) ... (g)"
    // markers, which read as a wall of text and broke across pages mid-event.
    // Each event is now its own limb, and two of them are conditional: an event
    // predicated on breach of a representation is meaningless in a document that
    // contains no representations, and an event predicated on security failing
    // is meaningless in one that creates no security. A default clause that
    // points at provisions which do not exist is unenforceable on its own terms.
    LOAN_DEFAULT_001: () => {
      const supplied = stripExternalReferencePhrases(variables.events_of_default, "");
      if (supplied) {
        return renderStructuredDetailText(
          "Each of the following shall constitute an Event of Default under this Agreement:",
          supplied
        );
      }

      const events = [
        "failure by the Borrower to pay any principal, interest, or other sum due under this Agreement within five (5) Business Days of the due date",
        present.has("representations")
          ? "material breach by the Borrower of any representation, warranty, or covenant under this Agreement, which, if capable of remedy, remains unremedied for thirty (30) days after written notice"
          : "material breach by the Borrower of any covenant or obligation under this Agreement, which, if capable of remedy, remains unremedied for thirty (30) days after written notice",
        "insolvency of the Borrower, filing of any petition under the Insolvency and Bankruptcy Code, 2016, or appointment of a liquidator, receiver, or administrator",
        "any judgment, attachment, or enforcement action against the Borrower that materially impairs the Borrower's ability to perform its obligations under this Agreement",
        // A bare "material adverse change" is a standing invitation to argue.
        // Tying it to the effect the Lender actually cares about -- ability to
        // pay -- gives the clause a testable meaning without inventing a
        // threshold the Parties never agreed.
        "any change in the financial condition or business of the Borrower which materially impairs the Borrower's ability to perform its payment obligations under this Agreement",
        "cross-default under any other material financing agreement of the Borrower",
      ];

      if (present.has("security")) {
        events.push(
          "any security created under or in connection with this Agreement ceasing to be valid, enforceable, or perfected"
        );
      }

      return [
        "Each of the following shall constitute an Event of Default under this Agreement:",
        formatStructuredSubparts(events),
        "Upon the occurrence of an Event of Default, the Lender may exercise all rights under this Agreement and applicable law.",
      ].join("\n");
    },

    GUARANTEE_OBLIGATION_001: () =>
      `In consideration of the Lender agreeing to extend financial accommodation to the Principal Debtor, the Guarantor hereby unconditionally and irrevocably guarantees to the Lender the due and punctual payment of all amounts payable by the Principal Debtor under the underlying financing arrangements. The aggregate liability of the Guarantor under this Agreement, taken together with any liability under the indemnity given in this Agreement and including principal, interest, default interest, costs, and enforcement expenses, shall not exceed ${formatCurrency(
        variables.guaranteed_amount
      )}. This Guarantee shall be invoked in the circumstances described as follows: ${stripExternalReferencePhrases(
        variables.invocation_conditions,
        "upon any payment default, material breach, insolvency event, or other event of default under the underlying financing arrangements"
      )}.${hasMeaningfulValue(variables.invocation_procedure) ? ` The parties further agree that invocation shall be carried out in accordance with the following procedure: ${stripExternalReferencePhrases(
        variables.invocation_procedure,
        ""
      )}.` : " The Lender may invoke this Guarantee by written demand to the Guarantor specifying the default, the amount due, and the basis of the demand."} The liability of the Guarantor shall be co-extensive with that of the Principal Debtor under Section 128 of the Indian Contract Act, 1872, subject in all cases to the aggregate cap stated in this clause.`,

    // GUARANTEE_CONTINUING_001 and CORE_TERM_001 were both rendered by
    // resolveGuaranteeTermText, so a guarantee carried the same paragraph twice
    // under two headings. The semantic de-duplicator then removed one of them --
    // and the one it removed was CORE_TERM_001, which the guarantee blueprint
    // lists as required, so every GUARANTEE_AGREEMENT failed to generate with
    // "Blueprint requires clause CORE_TERM_001 but it is missing". The two
    // clauses answer different questions and are now drafted separately: this
    // one states the continuing NATURE of the guarantee and how it may be
    // revoked; CORE_TERM_001 states its DURATION.
    GUARANTEE_CONTINUING_001: () => ({
      title: "Continuing Guarantee and Liability",
      text: [
        "This Guarantee is a continuing guarantee within the meaning of Section 129 of the Indian Contract Act, 1872, and extends to the whole of the guaranteed obligations from time to time outstanding, and not merely to any single transaction or advance. The liability of the Guarantor is co-extensive with that of the Principal Debtor under Section 128 of that Act, and the following shall apply:",
        formatStructuredSubparts([
          "the Guarantor may revoke this Guarantee as to future transactions under Section 130 of the Indian Contract Act, 1872 by written notice to the Lender, and such revocation shall take effect only from the date the Lender actually receives the notice",
          "revocation shall not affect the Guarantor's liability for any obligation, transaction, advance, interest, cost, or default existing or accrued before the Lender received that notice, and this Guarantee shall continue in force in respect of those amounts until they are discharged in full",
          "the Lender may proceed against the Guarantor without first proceeding against the Principal Debtor, without enforcing any security held, and without exhausting any other remedy available to it",
          "this Guarantee shall not be discharged or diminished by any variation of the underlying arrangement, any indulgence, time, or composition granted to the Principal Debtor, any release of security, or any act or omission which but for this provision would operate to discharge the Guarantor, save to the extent Section 133 or Section 135 of the Indian Contract Act, 1872 operates notwithstanding an agreement to the contrary",
          "this Guarantee is in addition to, and not in substitution for, any other guarantee or security held by the Lender in respect of the guaranteed obligations",
        ]),
      ].join("\n"),
    }),

    GUARANTEE_INDEMNITY_001: () =>
      // Subject to the same cap, expressly. An uncapped indemnity sitting beside
      // a capped guarantee lets the Creditor recover the whole loss under the
      // indemnity and treat the cap as decorative, which defeats the only
      // commercial term the Guarantor actually negotiated.
      `The Guarantor shall indemnify and hold harmless the Lender against all losses, damages, costs, and expenses suffered or incurred as a result of or in connection with any failure by the Principal Debtor to perform its obligations under the underlying financing arrangements, provided that the Guarantor's liability under this indemnity forms part of, and shall not increase, the aggregate cap on the Guarantor's liability stated in the guarantee obligation clause of this Agreement. Upon the Guarantor making any payment under this Guarantee, the Guarantor shall be subrogated to the rights and remedies of the Lender against the Principal Debtor to the extent of such payment, provided that the Guarantor shall not exercise such subrogation rights until the Lender has been paid in full.`,
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

// Which clause ids each disallowed protection covers. Declared once so the
// injector and the completeness validator cannot drift: previously only the
// injector consulted it, so a Loan or Guarantee that disallows FORCE_MAJEURE
// had the clause correctly withheld and was then penalised 20 points for
// "Required hardening clause CORE_FORCE_MAJEURE_001 is missing" -- the same
// module both forbidding and requiring the clause.
const PROTECTION_CLAUSE_IDS = {
  LIABILITY_CAP: ["AUTO-LIAB-001", "CORE_LIABILITY_CAP_001", "CORE_LIMITATION_LIABILITY_001"],
  INDEMNITY: ["AUTO-INDEM-001", "CORE_INDEMNITY_001"],
  FORCE_MAJEURE: ["AUTO-FM-001", "CORE_FORCE_MAJEURE_001"],
};

function getSuppressedProtectionClauseIds(documentType) {
  const suppressed = new Set();
  for (const protection of getDisallowedProtections(documentType)) {
    for (const clauseId of PROTECTION_CLAUSE_IDS[protection] || []) {
      suppressed.add(clauseId);
    }
  }
  return suppressed;
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
  const genericClausesToRemove = getSuppressedProtectionClauseIds(documentType);

  const baseClauses = draft.clauses.filter(
    (clause) => !genericClausesToRemove.has(String(clause.clause_id || ""))
  );
  const existingClauseIds = new Set(baseClauses.map((clause) => clause.clause_id));

  // Clauses a variant slot deliberately swapped out must not be re-injected as a
  // "missing required" clause (its replacement already covers the role).
  const replacedClauseIds = new Set(draft.metadata?.variant_replaced_clause_ids || []);

  // Honour the clause library's own `conflicts_with` declarations, so a general
  // provision is not injected on top of a document-specific clause covering the
  // same ground -- e.g. CORE_STAMP_AND_COSTS_001 must stand down for the
  // property registration-and-stamp clause rather than duplicate it.
  const conflictsDeclaredByDraft = new Set();
  for (const clause of baseClauses) {
    for (const other of clause?.conflicts_with || []) {
      conflictsDeclaredByDraft.add(other);
    }
  }

  function conflictsWithDraft(clauseId) {
    if (conflictsDeclaredByDraft.has(clauseId)) return true;
    const candidate = getClauseById(clauseId);
    return (candidate?.conflicts_with || []).some((id) => existingClauseIds.has(id));
  }

  // A clause the document type disallows must not be re-introduced through the
  // required/baseline set -- otherwise a Loan or Guarantee that explicitly
  // disallows FORCE_MAJEURE would have it injected right back.
  const extraClauses = requiredClauseIds
    .filter(
      (clauseId) =>
        !existingClauseIds.has(clauseId) &&
        !replacedClauseIds.has(clauseId) &&
        !genericClausesToRemove.has(clauseId) &&
        !conflictsWithDraft(clauseId)
    )
    .map((clauseId) => cloneClauseForDraft(clauseId, variables));

  // What the assembled document actually contains, so a clause that enumerates
  // other provisions can name only the ones that are really there. A survival
  // clause listing confidentiality, intellectual property and a liability cap in
  // an agreement that has none of them is not a harmless flourish: it tells the
  // reader those provisions exist and invites a search for them.
  const assembled = [...baseClauses, ...extraClauses];
  const present = buildClausePresence(assembled);

  const clauses = assembled.map((clause) =>
    renderHardClause(clause, variables, documentType, semanticContext, present)
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
  // A clause a variant slot deliberately swapped out is not "missing" — its
  // replacement is present and covers the role.
  const replacedClauseIds = new Set(draft.metadata?.variant_replaced_clause_ids || []);

  // Nor is a clause that stood down for a conflicting one already in the
  // draft. This mirrors the injection rule in applyDocumentHardening; without
  // it, the validator demands the very clause the injector correctly withheld
  // (e.g. CORE_STAMP_AND_COSTS_001 in a rental that already carries
  // PROP_REGISTRATION_001).
  const conflictsDeclaredByDraft = new Set();
  for (const clause of draft.clauses || []) {
    for (const other of clause?.conflicts_with || []) {
      conflictsDeclaredByDraft.add(other);
    }
  }
  const supersededByPresentClause = (clauseId) => {
    if (conflictsDeclaredByDraft.has(clauseId)) return true;
    const candidate = getClauseById(clauseId);
    return (candidate?.conflicts_with || []).some((id) => existingClauseIds.has(id));
  };

  // A protection the document type disallows cannot also be required of it.
  const suppressed = getSuppressedProtectionClauseIds(documentType);

  return requiredClauseIds
    .filter(
      (clauseId) =>
        !existingClauseIds.has(clauseId) &&
        !replacedClauseIds.has(clauseId) &&
        !suppressed.has(clauseId) &&
        !supersededByPresentClause(clauseId)
    )
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

// Raised, as a notice rather than a defect, when a deal is large enough or long
// enough that leaving every risk term at its default ought to be a deliberate
// choice. The engine will not pick a cap or an indemnity scope on the user's
// behalf -- that is a drafting judgement -- but it should not stay silent about
// having applied defaults to a multi-crore engagement either.
function findRiskProfileNotices(draft, documentType) {
  const variables = draft?.metadata?.source_variables || {};
  const profile = deriveRiskProfile(documentType, variables);
  if (!profile.warrants_risk_review) return [];

  const untouched = [
    !hasMeaningfulValue(variables.liability_cap_basis) && "the limitation of liability",
    !hasMeaningfulValue(variables.indemnity_scope) && "the indemnity scope",
    !hasMeaningfulValue(variables.termination_notice_period) && "the termination notice period",
  ].filter(Boolean);

  if (!untouched.length) return [];

  const scale = [
    profile.contract_value ? `a consideration of ${formatCurrency(profile.contract_value)}` : null,
    profile.term_months ? `a term of ${profile.term_months} months` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const listed =
    untouched.length === 1
      ? untouched[0]
      : `${untouched.slice(0, -1).join(", ")} and ${untouched[untouched.length - 1]}`;

  return [
    {
      rule_id: "RISK_TERMS_AT_DEFAULT",
      severity: "LOW",
      notice_only: true,
      blocks_generation: false,
      message: `This ${documentType.replace(/_/g, " ").toLowerCase()} carries ${scale}, which places it in the "${profile.exposure}" exposure band, but ${listed} ${untouched.length === 1 ? "was" : "were"} left at the standard default rather than negotiated for this deal.`,
      suggestion:
        "Review the risk-allocation terms against the value and duration of this engagement, and record a deliberate position on the liability cap, the indemnity scope, and the notice period.",
      offending_clause_id: null,
    },
  ];
}

// Cross-clause reference integrity.
//
// A clause that points at something — "the address set out in this Agreement",
// "the acceptance criteria described in this Agreement", "the initial term" —
// is only meaningful if that thing is actually in the document. Each clause is
// individually well drafted, so no per-clause check catches this; it only shows
// up when the assembled instrument is read as a whole, which is precisely what
// a reader does. A notices clause pointing at addresses that were never
// collected leaves the parties with no valid way to serve notice at all.
const DANGLING_REFERENCE_CHECKS = [
  {
    rule_id: "DANGLING_NOTICE_ADDRESS",
    references: /address of the recipient Party set out in this Agreement|address(?:es)? set out (?:in|below)/i,
    satisfiedBy: /having (?:its |the )?address at|residing at|registered office at/i,
    message:
      "The notices clause directs notices to an address set out in this Agreement, but no party address appears anywhere in it.",
    suggestion:
      "Collect an address for each party, or redraft the notices clause to work without one.",
  },
  {
    rule_id: "DANGLING_ACCEPTANCE_CRITERIA",
    references: /acceptance criteria/i,
    // Satisfied either by criteria stated outright, or by the term being defined
    // at first use — `... (together, the "Acceptance Criteria")` — which is how
    // a well-drafted clause introduces one.
    // Satisfied three ways: criteria stated outright; the term defined at first
    // use — `... (together, the "Acceptance Criteria")`; or the criteria
    // deliberately delegated to a future instrument, which is exactly how a
    // master services agreement is supposed to work ("each Statement of Work
    // shall specify ... acceptance criteria"). That last case is a reference
    // forward, not a dangling one.
    satisfiedBy:
      /acceptance criteria (?:shall be|are|means|include|comprise)|criteria for acceptance are|acceptance criteria:|the "Acceptance Criteria"|shall specify[^.]{0,160}acceptance criteria|acceptance criteria[^.]{0,80}(?:in|under) (?:each|the relevant|any) (?:Statement of Work|SOW|Order|Schedule)/i,
    message:
      "A clause tests deliverables against acceptance criteria, but no acceptance criteria are stated in the document.",
    suggestion:
      "Capture acceptance criteria at intake, or remove the acceptance mechanism for this document type.",
  },
  {
    rule_id: "DANGLING_INITIAL_TERM",
    references: /initial term/i,
    satisfiedBy:
      /remain in force for|shall continue for|for a (?:period|term) of|until .{0,60}(?:discharged|completed|terminated)/i,
    message:
      'A clause refers to the "initial term", but the document never states what that term is.',
    suggestion: "State the duration in the term clause, or drop the reference to an initial term.",
  },
  {
    rule_id: "DANGLING_SPECIFICATIONS",
    references: /specifications (?:and|,) .{0,40}set out in this Agreement|agreed specifications/i,
    // "The Goods shall conform to the agreed specifications" is not dangling in
    // a supply agreement that describes the Goods — the description IS the
    // specification. The reference is only unmet when nothing in the document
    // describes or defines the subject matter at all. A check that cries wolf
    // on sound drafting gets ignored, which costs more than it catches.
    satisfiedBy:
      /specifications (?:shall be|are|means|include)|specification:|"(?:Goods|Deliverables|Services|Software|Products)" means|shall (?:supply|deliver|provide) the following/i,
    message:
      "A clause refers to agreed specifications, but none are set out in the document.",
    suggestion: "Capture the specifications at intake, or soften the reference.",
  },
];

function findDanglingReferenceIssues(draft) {
  const text = (draft.clauses || []).map((clause) => clause.text || "").join("\n");
  if (!text.trim()) return [];

  return DANGLING_REFERENCE_CHECKS.filter(
    (check) => check.references.test(text) && !check.satisfiedBy.test(text)
  ).map((check) =>
    buildIssue(check.rule_id, "MEDIUM", check.message, check.suggestion)
  );
}

export function validateDocumentHardening(draft, { documentType } = {}) {
  if (!draft?.clauses?.length || !documentType) {
    return [];
  }

  return [
    ...findMissingRequiredClauseIssues(draft, documentType),
    ...findUnresolvedScheduleReferenceIssues(draft),
    ...findDisallowedProtectionIssues(draft, documentType),
    ...findRiskProfileNotices(draft, documentType),
    ...findDanglingReferenceIssues(draft),
  ];
}
