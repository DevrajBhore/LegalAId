import { hasMeaningfulValue } from "./generationControls.js";
import { getParticipantExpectations } from "./draftingPolicy.js";
import { getVariables } from "../config/variableConfig.js";

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(haystack = "", needle = "") {
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedNeedle) return true;
  return normalizeText(haystack).includes(normalizedNeedle);
}

function includesFieldValue(haystack = "", value = "") {
  if (includesNormalized(haystack, value)) {
    return true;
  }

  const needleDigits = String(value || "").replace(/\D+/g, "");
  if (!needleDigits) {
    return false;
  }

  const haystackDigits = String(haystack || "").replace(/\D+/g, "");
  return haystackDigits.includes(needleDigits);
}

function matchesStructuredField(fieldName, value, haystack = "") {
  const normalizedValue = normalizeText(value);
  const normalizedHaystack = normalizeText(haystack);

  if (!normalizedValue) {
    return true;
  }

  switch (fieldName) {
    case "nda_type":
      if (normalizedValue.includes("mutual")) {
        return normalizedHaystack.includes("mutual");
      }
      if (normalizedValue.includes("one way") || normalizedValue.includes("oneway")) {
        return (
          normalizedHaystack.includes("one way") ||
          normalizedHaystack.includes("one-way")
        );
      }
      return includesFieldValue(haystack, value);

    case "return_destruction_option":
      if (normalizedValue.includes("return") && normalizedValue.includes("destroy")) {
        return normalizedHaystack.includes("return") && normalizedHaystack.includes("destroy");
      }
      if (normalizedValue.includes("return")) {
        return normalizedHaystack.includes("return");
      }
      if (normalizedValue.includes("destroy")) {
        return normalizedHaystack.includes("destroy");
      }
      return includesFieldValue(haystack, value);

    case "no_employment_ack":
      return (
        normalizedHaystack.includes("independent contracting") ||
        normalizedHaystack.includes("not of employer and employee") ||
        normalizedHaystack.includes("no employment")
      );

    case "police_verification_required":
      return normalizedHaystack.includes("police verification");

    case "escrow_required":
      return normalizedHaystack.includes("escrow");

    case "liability_cap_basis":
      if (normalizedValue.includes("specific amount")) {
        return normalizedHaystack.includes("aggregate liability");
      }
      if (normalizedValue.includes("direct damages")) {
        return normalizedHaystack.includes("direct damages");
      }
      if (normalizedValue.includes("unlimited") || normalizedValue.includes("uncapped")) {
        return (
          normalizedHaystack.includes("uncapped") ||
          normalizedHaystack.includes("not be subject to a pre agreed monetary cap")
        );
      }
      return (
        normalizedHaystack.includes("fees paid or payable") ||
        normalizedHaystack.includes("12 months preceding")
      );

    case "indemnity_scope":
      if (normalizedValue.includes("third party claims only")) {
        return normalizedHaystack.includes("third party");
      }
      if (normalizedValue.includes("breach of agreement only")) {
        return normalizedHaystack.includes("breach of this agreement");
      }
      if (normalizedValue.includes("breach negligence")) {
        return (
          normalizedHaystack.includes("breach of this agreement") &&
          normalizedHaystack.includes("negligence") &&
          normalizedHaystack.includes("third party")
        );
      }
      return (
        normalizedHaystack.includes("confidentiality") &&
        normalizedHaystack.includes("intellectual property") &&
        normalizedHaystack.includes("third party")
      );

    case "risk_transfer_stage":
      if (normalizedValue.includes("first carrier")) {
        return normalizedHaystack.includes("first carrier");
      }
      if (normalizedValue.includes("destination")) {
        return (
          normalizedHaystack.includes("destination") ||
          normalizedHaystack.includes("delivery location")
        );
      }
      if (normalizedValue.includes("inspection")) {
        return (
          normalizedHaystack.includes("inspection") &&
          normalizedHaystack.includes("acceptance")
        );
      }
      if (normalizedValue.includes("title")) {
        return normalizedHaystack.includes("title");
      }
      return includesFieldValue(haystack, value);

    case "pricing_model":
      return (
        normalizedHaystack.includes("pricing arrangement") ||
        includesFieldValue(haystack, value)
      );

    default:
      return includesFieldValue(haystack, value);
  }
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDateVariants(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return [String(value || "")].filter(Boolean);

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  const monthName = parsed.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
  });

  return [
    `${year}-${month}-${day}`,
    `${day}/${month}/${year}`,
    `${day}-${month}-${year}`,
    `${day} ${monthName} ${year}`,
    `${parsed.getUTCDate()} ${monthName} ${year}`,
  ];
}

function includesDateVariant(haystack = "", rawDate = "") {
  return buildDateVariants(rawDate).some((variant) =>
    includesNormalized(haystack, variant)
  );
}

function inferPartyType(name = "", explicitType = "") {
  const normalizedType = String(explicitType || "").trim();
  if (normalizedType) {
    return normalizedType;
  }

  const lower = String(name || "").toLowerCase();
  if (
    lower.includes("private limited") ||
    lower.includes("pvt") ||
    lower.includes("limited")
  ) {
    return "Private Limited Company";
  }
  if (lower.includes("llp")) {
    return "LLP";
  }
  if (lower.includes("partnership")) {
    return "Partnership Firm";
  }
  return "Individual";
}

function expectsRepresentativeExecution(type = "", name = "") {
  return !inferPartyType(name, type).toLowerCase().includes("individual");
}

function buildIssue(ruleId, severity, message, suggestion) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    blocks_generation: true,
    auto_fixable: false,
  };
}

export function validateDraftConsistency(
  draft,
  { documentType, variables = {} } = {}
) {
  if (!draft?.clauses?.length || !documentType || !variables) {
    return [];
  }

  const supportedFields = new Set(Object.keys(getVariables(documentType)));
  const clauses = draft.clauses;
  const identityText =
    clauses.find((clause) => clause.category === "IDENTITY")?.text || "";
  const disputeText =
    clauses.find(
      (clause) =>
        clause.category === "DISPUTE_RESOLUTION" ||
        clause.clause_id === "CORE_DISPUTE_RESOLUTION_001"
    )?.text || "";
  const governingLawText =
    clauses.find((clause) => clause.category === "GOVERNING_LAW")?.text || "";
  const signatureText =
    clauses.find((clause) => clause.category === "SIGNATURE_BLOCK")?.text || "";
  const termText =
    clauses.find((clause) => clause.clause_id === "CORE_TERM_001")?.text ||
    clauses.find((clause) => clause.category === "TERM")?.text ||
    "";
  const terminationText =
    clauses.find((clause) => clause.clause_id === "SERVICE_TERMINATION_001")?.text || "";
  const confidentialityText = clauses
    .filter((clause) =>
      [
        "CORE_CONFIDENTIALITY_001",
        "NDA_CONFIDENTIAL_INFORMATION_SCOPE_001",
        "EMP_CONFIDENTIALITY_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const ndaText = clauses
    .filter((clause) =>
      [
        "CORE_PURPOSE_001",
        "NDA_CONFIDENTIAL_INFORMATION_SCOPE_001",
        "NDA_EXCLUSIONS_001",
        "NDA_DISCLOSURE_PERMITTED_001",
        "NDA_RETURN_OF_INFORMATION_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const expensesText =
    clauses.find(
      (clause) => clause.category === "EXPENSES" || clause.clause_id === "SERVICE_EXPENSES_001"
    )?.text || "";
  const paymentText =
    clauses.find(
      (clause) =>
        clause.category === "PAYMENT" ||
        clause.clause_id === "SERVICE_PAYMENT_001" ||
        clause.clause_id === "SUPPLY_PAYMENT_001"
    )?.text || "";
  const timelineText =
    clauses.find(
      (clause) =>
        clause.clause_id === "SERVICE_TIMELINES_001" || clause.category === "TIMELINES"
    )?.text || "";
  const deliveryText = [
    clauses.find((clause) => clause.clause_id === "SERVICE_SCOPE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "SERVICE_DELIVERABLES_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "SERVICE_ACCEPTANCE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "SERVICE_CHANGE_REQUEST_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "TECH_ACCEPTANCE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "SERVICE_SLA_001")?.text || "",
    timelineText,
  ].join("\n");
  const employmentText = clauses
    .filter((clause) =>
      [
        "CORE_IDENTITY_001",
        "CORE_PURPOSE_001",
        "EMPLOYMENT_ROLE_001",
        "EMPLOYMENT_COMPENSATION_001",
        "EMP_WAGES_001",
        "EMP_PROBATION_001",
        "EMP_DUTIES_001",
        "EMP_WORKING_HOURS_001",
        "EMP_LEAVE_POLICY_001",
        "EMP_BENEFITS_001",
        "EMP_NOTICE_PERIOD_001",
        "EMPLOYMENT_TERMINATION_001",
        "EMP_TERMINATION_001",
        "EMP_IP_ASSIGNMENT_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const relationshipText = [
    clauses.find((clause) => clause.clause_id === "CORE_RELATIONSHIP_OF_PARTIES_001")?.text || "",
    paymentText,
  ].join("\n");
  const riskAllocationText = clauses
    .filter((clause) =>
      [
        "CORE_LIABILITY_CAP_001",
        "CORE_INDEMNITY_001",
        "GUARANTEE_INDEMNITY_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const governanceText = clauses
    .filter((clause) =>
      [
        "CORE_PURPOSE_001",
        "PARTNERSHIP_CAPITAL_001",
        "CORP_SHARE_SUBSCRIPTION_001",
        "CORP_BOARD_COMPOSITION_001",
        "CORP_SHARE_TRANSFER_001",
        "CORP_TAG_ALONG_001",
        "CORP_DRAG_ALONG_001",
        "CORP_DEADLOCK_001",
        "JV_GOVERNANCE_001",
        "JV_EXIT_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const supplyControlText = clauses
    .filter((clause) =>
      [
        "SUPPLY_DELIVERY_001",
        "SUPPLY_PAYMENT_001",
        "SUPPLY_WARRANTY_001",
        "SUPPLY_INSPECTION_001",
        "SUPPLY_RISK_TRANSFER_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const distributionText = [
    clauses.find((clause) => clause.clause_id === "CORE_PURPOSE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "IP_TRADEMARK_USAGE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "SERVICE_TERMINATION_001")?.text || "",
    paymentText,
  ].join("\n");
  const propertyText = clauses
    .filter((clause) =>
      [
        "RENT_PROPERTY_USE_001",
        "RENT_UTILITIES_001",
        "RENT_SECURITY_DEPOSIT_001",
        "RENTAL_SECURITY_DEPOSIT_001",
        "RENT_RENT_INCREASE_001",
        "RENT_LOCKIN_PERIOD_001",
        "RENT_TERMINATION_001",
        "RENTAL_TERMINATION_001",
        "PROP_REGISTRATION_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const techText = [
    deliveryText,
    clauses.find((clause) => clause.clause_id === "TECH_SOURCE_CODE_001")?.text || "",
    clauses.find((clause) => clause.clause_id === "TECH_WARRANTY_001")?.text || "",
  ].join("\n");
  const serviceControlText = clauses
    .filter((clause) =>
      [
        "SERVICE_SCOPE_001",
        "SERVICE_DELIVERABLES_001",
        "SERVICE_WARRANTY_001",
        "SERVICE_SLA_001",
        "SERVICE_REPORTING_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const loanRepaymentText =
    clauses.find((clause) => clause.clause_id === "LOAN_REPAYMENT_001")?.text || "";
  const guaranteeText = clauses
    .filter((clause) =>
      [
        "GUARANTEE_OBLIGATION_001",
        "GUARANTEE_CONTINUING_001",
        "GUARANTEE_INDEMNITY_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");
  const fullText = clauses.map((clause) => clause.text || "").join("\n");
  const restrictiveText = clauses
    .filter((clause) =>
      [
        "NDA_NON_COMPETE_001",
        "NDA_NON_SOLICITATION_001",
        "EMP_NON_COMPETE_001",
        "EMP_NON_SOLICITATION_001",
      ].includes(clause.clause_id)
    )
    .map((clause) => clause.text || "")
    .join("\n");

  const issues = [];
  const participants = getParticipantExpectations(documentType, variables);

  for (const participant of participants) {
    const inferredType = inferPartyType(participant.name, participant.type);

    if (participant.name && !includesNormalized(identityText, participant.name)) {
      issues.push(
        buildIssue(
          `INPUT_MISMATCH_${participant.id.toUpperCase()}_NAME`,
          "CRITICAL",
          `${participant.label} name does not appear correctly in the generated identity clause.`,
          `Ensure the document uses the provided ${participant.label.toLowerCase()} name "${participant.name}" in the opening clause.`
        )
      );
    }

    if (
      participant.address &&
      !includesNormalized(identityText, participant.address)
    ) {
      issues.push(
        buildIssue(
          `INPUT_MISMATCH_${participant.id.toUpperCase()}_ADDRESS`,
          "CRITICAL",
          `${participant.label} address does not appear correctly in the generated identity clause.`,
          `Ensure the document uses the provided ${participant.label.toLowerCase()} address in the opening clause.`
        )
      );
    }

    if (
      participant.type &&
      !includesNormalized(identityText, inferredType)
    ) {
      issues.push(
        buildIssue(
          `INPUT_MISMATCH_${participant.id.toUpperCase()}_TYPE`,
          "HIGH",
          `${participant.label} type is not reflected correctly in the generated identity clause.`,
          `Ensure the identity clause reflects the selected ${participant.label.toLowerCase()} type "${participant.type}".`
        )
      );
    }

    if (participant.name && !includesNormalized(signatureText, participant.name)) {
      issues.push(
        buildIssue(
          `INPUT_MISMATCH_${participant.id.toUpperCase()}_SIGNATURE_NAME`,
          "HIGH",
          `${participant.label} name does not appear correctly in the execution block.`,
          `Ensure the signature block reflects the provided ${participant.label.toLowerCase()} name "${participant.name}".`
        )
      );
    }

    const representativePattern = `for and on behalf of ${participant.name || ""}`;
    if (
      participant.name &&
      expectsRepresentativeExecution(participant.type, participant.name) &&
      !includesNormalized(signatureText, representativePattern)
    ) {
      issues.push(
        buildIssue(
          `INPUT_MISMATCH_${participant.id.toUpperCase()}_EXECUTION_STYLE`,
          "HIGH",
          `${participant.label} should use a representative execution block, but the generated signature block does not reflect that.`,
          `Render ${participant.label.toLowerCase()} as a company-style signatory block for "${participant.name}".`
        )
      );
    }
  }

  if (
    variables.arbitration_city &&
    !includesNormalized(disputeText, variables.arbitration_city)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_ARBITRATION_CITY",
        "CRITICAL",
        `The generated dispute resolution clause does not use the requested arbitration city "${variables.arbitration_city}".`,
        "Ensure the arbitration clause reflects the seat and venue selected in the form."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.governing_law_state) &&
    !includesNormalized(governingLawText, variables.governing_law_state)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_GOVERNING_LAW_STATE",
        "HIGH",
        `The generated governing law clause does not reflect the requested governing law state "${variables.governing_law_state}".`,
        "Ensure the governing law clause refers to the selected state context."
      )
    );
  }

  const disputeMethod = normalizeText(variables.dispute_resolution_method || "");
  if (disputeMethod) {
    const methodExpectationMap = [
      { match: "courts", expected: "court" },
      { match: "negotiation", expected: "negotiat" },
      { match: "mediation", expected: "mediat" },
      { match: "arbitration", expected: "arbitrat" },
    ];

    for (const { match, expected } of methodExpectationMap) {
      if (disputeMethod.includes(match) && !normalizeText(disputeText).includes(expected)) {
        issues.push(
          buildIssue(
            `INPUT_MISMATCH_DISPUTE_METHOD_${match.toUpperCase()}`,
            "HIGH",
            `The generated dispute clause does not reflect the selected dispute resolution method "${variables.dispute_resolution_method}".`,
            "Ensure the dispute clause uses the selected escalation and forum mechanism."
          )
        );
      }
    }
  }

  if (variables.effective_date && !includesDateVariant(termText, variables.effective_date)) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_EFFECTIVE_DATE_TERM",
        "CRITICAL",
        "The generated term clause does not clearly reflect the requested effective date.",
        "Ensure the term clause expressly states the effective date supplied in the form."
      )
    );
  }

  const renewalOption = normalizeText(variables.renewal_option || "");
  if (renewalOption && renewalOption !== "no" && !normalizeText(termText).includes("renew")) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_RENEWAL_OPTION",
        "HIGH",
        "The generated term clause does not reflect the requested renewal mechanics.",
        "Ensure the term clause includes the requested renewal arrangement."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.renewal_terms) &&
    !includesNormalized(termText, variables.renewal_terms)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_RENEWAL_TERMS",
        "HIGH",
        "The generated term clause does not reflect the supplied renewal terms.",
        "Rewrite the term clause so it incorporates the stated renewal arrangement."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.termination_notice_period) &&
    terminationText &&
    !includesNormalized(terminationText, variables.termination_notice_period)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_TERMINATION_NOTICE",
        "HIGH",
        "The generated termination clause does not reflect the supplied termination notice period.",
        "Ensure the termination clause uses the requested notice period."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.contract_duration) &&
    !includesNormalized(`${termText} ${timelineText}`, variables.contract_duration)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_CONTRACT_DURATION",
        "CRITICAL",
        "The generated draft does not clearly reflect the contract duration supplied in the form.",
        "Use the supplied contract duration in the term clause and any timeline logic."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.expenses_policy) &&
    !includesNormalized(expensesText, variables.expenses_policy)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_EXPENSES_POLICY",
        "HIGH",
        "The generated expenses clause does not reflect the expense reimbursement policy supplied in the form.",
        "Rewrite the expenses clause so it accurately reflects the user's reimbursement policy."
      )
    );
  }

  if (
    hasMeaningfulValue(variables.non_compete_period) &&
    restrictiveText &&
    !includesNormalized(restrictiveText, variables.non_compete_period)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_RESTRICTIVE_COVENANT_PERIOD",
        "HIGH",
        "The restrictive covenant clause does not use the period supplied in the form.",
        "Use the specified non-compete or non-solicitation period consistently in the restrictive covenant clause."
      )
    );
  }

  if (hasMeaningfulValue(variables.party_2_gstin) && !includesNormalized(paymentText, variables.party_2_gstin)) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_SUPPLIER_GSTIN",
        "HIGH",
        "The payment clause does not reflect the supplier or service-provider GSTIN supplied in the form.",
        "Ensure the payment clause or invoice language includes the supplied GSTIN."
      )
    );
  }

  if (hasMeaningfulValue(variables.party_1_gstin) && !includesNormalized(paymentText, variables.party_1_gstin)) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_RECIPIENT_GSTIN",
        "MEDIUM",
        "The payment clause does not reflect the recipient GSTIN supplied in the form.",
        "Ensure the invoice wording reflects the supplied recipient GSTIN where applicable."
      )
    );
  }

  const confidentialityMappedFields = [
    [
      "confidentiality_access_scope",
      "INPUT_MISMATCH_CONFIDENTIALITY_ACCESS_SCOPE",
      "confidentiality access restrictions",
    ],
    [
      "employee_confidentiality_scope",
      "INPUT_MISMATCH_EMPLOYEE_CONFIDENTIALITY_SCOPE",
      "employee confidentiality obligations",
    ],
  ];

  for (const [fieldName, ruleId, label] of confidentialityMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], confidentialityText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated confidentiality clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the confidentiality clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const ndaMappedFields = [
    ["nda_type", "INPUT_MISMATCH_NDA_TYPE", "NDA type"],
    ["confidentiality_exclusions", "INPUT_MISMATCH_CONFIDENTIALITY_EXCLUSIONS", "confidentiality exclusions"],
    ["permitted_use", "INPUT_MISMATCH_PERMITTED_USE", "permitted use"],
    ["return_destruction_option", "INPUT_MISMATCH_RETURN_DESTRUCTION_OPTION", "return or destruction option"],
  ];

  if (documentType === "NDA") {
    for (const [fieldName, ruleId, label] of ndaMappedFields) {
      if (
        supportedFields.has(fieldName) &&
        hasMeaningfulValue(variables[fieldName]) &&
        !matchesStructuredField(fieldName, variables[fieldName], ndaText)
      ) {
        issues.push(
          buildIssue(
            ruleId,
            "HIGH",
            `The generated NDA clauses do not clearly reflect the supplied ${label}.`,
            `Ensure the NDA-specific clauses incorporate the provided ${label}.`
          )
        );
      }
    }
  }

  const riskMappedFields = [
    ["liability_cap_basis", "INPUT_MISMATCH_LIABILITY_CAP_BASIS", "liability cap structure"],
    ["liability_cap_amount", "INPUT_MISMATCH_LIABILITY_CAP_AMOUNT", "specific liability cap amount"],
    ["indemnity_scope", "INPUT_MISMATCH_INDEMNITY_SCOPE", "indemnity scope"],
  ];

  for (const [fieldName, ruleId, label] of riskMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], riskAllocationText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated risk-allocation clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the liability or indemnity clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const employmentMappedFields = [
    ["employer_cin", "INPUT_MISMATCH_EMPLOYER_CIN", "employer CIN"],
    ["employee_pan", "INPUT_MISMATCH_EMPLOYEE_PAN", "employee PAN"],
    ["job_title", "INPUT_MISMATCH_JOB_TITLE", "job title"],
    ["department", "INPUT_MISMATCH_DEPARTMENT", "department"],
    ["work_location", "INPUT_MISMATCH_WORK_LOCATION", "work location"],
    ["probation_period", "INPUT_MISMATCH_PROBATION_PERIOD", "probation period"],
    ["working_hours", "INPUT_MISMATCH_WORKING_HOURS", "working hours"],
    ["role_responsibilities", "INPUT_MISMATCH_ROLE_RESPONSIBILITIES", "role responsibilities"],
    ["bonus_terms", "INPUT_MISMATCH_BONUS_TERMS", "bonus terms"],
    ["leave_policy", "INPUT_MISMATCH_LEAVE_POLICY", "leave policy"],
    ["statutory_benefits", "INPUT_MISMATCH_STATUTORY_BENEFITS", "statutory benefits"],
  ];

  for (const [fieldName, ruleId, label] of employmentMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], employmentText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated employment clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the employment clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const deliveryMappedFields = [
    ["support_maintenance", "INPUT_MISMATCH_SUPPORT_MAINTENANCE", "support or maintenance obligations"],
    ["delay_remedies", "INPUT_MISMATCH_DELAY_REMEDIES", "delay remedies or service credits"],
    ["milestone_plan", "INPUT_MISMATCH_MILESTONE_PLAN", "milestone or delivery plan"],
    ["acceptance_criteria", "INPUT_MISMATCH_ACCEPTANCE_CRITERIA", "acceptance criteria"],
    ["source_code_delivery", "INPUT_MISMATCH_SOURCE_CODE_DELIVERY", "source-code delivery terms"],
    ["change_request_process", "INPUT_MISMATCH_CHANGE_REQUEST_PROCESS", "change-request process"],
  ];

  for (const [fieldName, ruleId, label] of deliveryMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], deliveryText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated draft does not clearly reflect the supplied ${label}.`,
          `Ensure the delivery, scope, or technology clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const governanceMappedFields = [
    ["decision_making_rules", "INPUT_MISMATCH_DECISION_MAKING_RULES", "decision-making rules"],
    ["partner_dispute_resolution", "INPUT_MISMATCH_PARTNER_DISPUTE_RESOLUTION", "partner dispute procedure"],
    ["partner_exit_mechanism", "INPUT_MISMATCH_PARTNER_EXIT_MECHANISM", "partner exit mechanism"],
    ["exit_rights", "INPUT_MISMATCH_EXIT_RIGHTS", "shareholder exit rights"],
    ["deadlock_resolution", "INPUT_MISMATCH_DEADLOCK_RESOLUTION", "deadlock resolution"],
    ["exit_terms", "INPUT_MISMATCH_EXIT_TERMS", "exit terms"],
  ];

  for (const [fieldName, ruleId, label] of governanceMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], governanceText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated governance clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the governance, transfer, or exit clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const supplyMappedFields = [
    ["delivery_terms", "INPUT_MISMATCH_DELIVERY_TERMS", "delivery terms"],
    ["warranty_period", "INPUT_MISMATCH_WARRANTY_PERIOD", "warranty period"],
    ["gst_rate", "INPUT_MISMATCH_GST_RATE", "GST rate"],
    ["inspection_timeline_days", "INPUT_MISMATCH_INSPECTION_TIMELINE", "inspection timeline"],
    ["risk_transfer_stage", "INPUT_MISMATCH_RISK_TRANSFER_STAGE", "risk-transfer stage"],
    ["inspection_acceptance_terms", "INPUT_MISMATCH_INSPECTION_TERMS", "inspection and acceptance terms"],
    ["risk_transfer_terms", "INPUT_MISMATCH_RISK_TRANSFER_TERMS", "risk-transfer terms"],
  ];

  for (const [fieldName, ruleId, label] of supplyMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(
        fieldName,
        variables[fieldName],
        `${supplyControlText}\n${paymentText}\n${techText}\n${serviceControlText}`
      )
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated delivery, warranty, or supply-control clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the relevant delivery, service-warranty, inspection, or risk-transfer clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const relationshipMappedFields = [
    ["tax_responsibility", "INPUT_MISMATCH_TAX_RESPONSIBILITY", "tax responsibility"],
    ["no_employment_ack", "INPUT_MISMATCH_NO_EMPLOYMENT_ACK", "no-employment acknowledgement"],
  ];

  for (const [fieldName, ruleId, label] of relationshipMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], relationshipText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated relationship or payment clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the relationship or payment clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const propertyMappedFields = [
    ["security_deposit", "INPUT_MISMATCH_SECURITY_DEPOSIT", "security deposit"],
    ["rent_escalation", "INPUT_MISMATCH_RENT_ESCALATION", "rent escalation"],
    ["lock_in_period", "INPUT_MISMATCH_LOCK_IN_PERIOD", "lock-in period"],
    ["society_rules", "INPUT_MISMATCH_SOCIETY_RULES", "society rules"],
    ["police_verification_required", "INPUT_MISMATCH_POLICE_VERIFICATION", "police verification requirement"],
  ];

  for (const [fieldName, ruleId, label] of propertyMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], propertyText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated property clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the property clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const commercialMappedFields = [
    ["pricing_model", "INPUT_MISMATCH_PRICING_MODEL", "pricing model"],
    ["minimum_purchase_quantity", "INPUT_MISMATCH_MINIMUM_PURCHASE_QUANTITY", "minimum purchase quantity"],
    ["minimum_purchase_unit", "INPUT_MISMATCH_MINIMUM_PURCHASE_UNIT", "minimum purchase measurement"],
  ];

  for (const [fieldName, ruleId, label] of commercialMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], paymentText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated commercial clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the pricing or payment clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const distributionMappedFields = [
    ["exclusivity", "INPUT_MISMATCH_EXCLUSIVITY", "exclusivity arrangement"],
    ["branding_rights", "INPUT_MISMATCH_BRANDING_RIGHTS", "branding rights"],
    ["underperformance_termination", "INPUT_MISMATCH_UNDERPERFORMANCE_TERMINATION", "underperformance termination rights"],
  ];

  for (const [fieldName, ruleId, label] of distributionMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], distributionText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated distribution clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the distribution clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const loanMappedFields = [
    ["repayment_frequency", "INPUT_MISMATCH_REPAYMENT_FREQUENCY", "repayment frequency"],
    ["repayment_tenure_months", "INPUT_MISMATCH_REPAYMENT_TENURE", "repayment tenure"],
    ["instalment_amount", "INPUT_MISMATCH_INSTALMENT_AMOUNT", "instalment amount"],
  ];

  for (const [fieldName, ruleId, label] of loanMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], loanRepaymentText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated loan repayment clause does not clearly reflect the supplied ${label}.`,
          `Ensure the repayment clause incorporates the provided ${label}.`
        )
      );
    }
  }

  const guaranteeMappedFields = [
    ["invocation_conditions", "INPUT_MISMATCH_INVOCATION_CONDITIONS", "invocation conditions"],
    ["invocation_procedure", "INPUT_MISMATCH_INVOCATION_PROCEDURE", "invocation procedure"],
  ];

  for (const [fieldName, ruleId, label] of guaranteeMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], guaranteeText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated guarantee clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the guarantee clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const governanceDetailMappedFields = [
    ["company_cin", "INPUT_MISMATCH_COMPANY_CIN", "company CIN"],
    ["board_structure", "INPUT_MISMATCH_BOARD_STRUCTURE", "board structure"],
    ["reserved_matters", "INPUT_MISMATCH_RESERVED_MATTERS", "reserved matters"],
    ["voting_rights", "INPUT_MISMATCH_VOTING_RIGHTS", "voting rights"],
    ["dividend_policy", "INPUT_MISMATCH_DIVIDEND_POLICY", "dividend policy"],
    ["business_address", "INPUT_MISMATCH_BUSINESS_ADDRESS", "business address"],
    ["bank_name", "INPUT_MISMATCH_BANK_NAME", "bank name"],
    ["drawing_limit", "INPUT_MISMATCH_DRAWING_LIMIT", "drawing limit"],
    ["admission_removal_terms", "INPUT_MISMATCH_ADMISSION_REMOVAL_TERMS", "admission and removal terms"],
    ["jv_structure", "INPUT_MISMATCH_JV_STRUCTURE", "joint venture structure"],
    ["mou_scope", "INPUT_MISMATCH_MOU_SCOPE", "MOU scope"],
  ];

  for (const [fieldName, ruleId, label] of governanceDetailMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], `${governanceText}\n${fullText}`)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated governance or purpose clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the relevant governance or purpose clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  const techMappedFields = [
    ["tech_stack", "INPUT_MISMATCH_TECH_STACK", "technical stack"],
    ["escrow_required", "INPUT_MISMATCH_ESCROW_REQUIREMENT", "escrow requirement"],
  ];

  for (const [fieldName, ruleId, label] of techMappedFields) {
    if (
      supportedFields.has(fieldName) &&
      hasMeaningfulValue(variables[fieldName]) &&
      !matchesStructuredField(fieldName, variables[fieldName], techText)
    ) {
      issues.push(
        buildIssue(
          ruleId,
          "HIGH",
          `The generated technology clauses do not clearly reflect the supplied ${label}.`,
          `Ensure the technology clauses incorporate the provided ${label}.`
        )
      );
    }
  }

  if (
    documentType === "MOU" &&
    hasMeaningfulValue(variables.binding_nature) &&
    !includesNormalized(fullText, variables.binding_nature)
  ) {
    issues.push(
      buildIssue(
        "INPUT_MISMATCH_BINDING_NATURE",
        "HIGH",
        "The generated MOU does not clearly reflect whether it is binding or non-binding.",
        "State the intended binding nature of the MOU explicitly in the operative clauses."
      )
    );
  }

  return issues;
}
