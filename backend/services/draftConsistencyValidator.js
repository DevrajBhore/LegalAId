import { DOCUMENT_CONFIG } from "../config/documentConfig.js";

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

function getExpectedParticipants(documentType, variables = {}) {
  const signatureType =
    DOCUMENT_CONFIG?.[documentType]?.signatureType || "BILATERAL";

  if (signatureType === "EMPLOYMENT") {
    return [
      {
        id: "employer",
        label: "Employer",
        name: variables.employer_name,
        address: variables.employer_address,
        type: "Private Limited Company",
      },
      {
        id: "employee",
        label: "Employee",
        name: variables.employee_name,
        address: variables.employee_address,
        type: "Individual",
      },
    ];
  }

  if (signatureType === "PARTNERSHIP") {
    return [
      {
        id: "partner_1",
        label: "Partner 1",
        name: variables.partner_1_name,
        address: variables.partner_1_address,
        type: "Individual",
      },
      {
        id: "partner_2",
        label: "Partner 2",
        name: variables.partner_2_name,
        address: variables.partner_2_address,
        type: "Individual",
      },
    ];
  }

  if (signatureType === "SHAREHOLDERS") {
    return [
      {
        id: "shareholder_1",
        label: "Shareholder 1",
        name: variables.shareholder_1_name,
        address: variables.shareholder_1_address,
        type: variables.shareholder_1_type,
      },
      {
        id: "shareholder_2",
        label: "Shareholder 2",
        name: variables.shareholder_2_name,
        address: variables.shareholder_2_address,
        type: variables.shareholder_2_type,
      },
    ];
  }

  if (signatureType === "GUARANTEE") {
    return [
      {
        id: "creditor",
        label: "Creditor",
        name: variables.party_1_name,
        address: variables.party_1_address,
        type: variables.party_1_type,
      },
      {
        id: "principal_debtor",
        label: "Principal Debtor",
        name: variables.party_2_name,
        address: variables.party_2_address,
        type: variables.party_2_type,
      },
      {
        id: "guarantor",
        label: "Guarantor",
        name: variables.guarantor_name,
        address: variables.guarantor_address,
        type: variables.guarantor_type || "Individual",
      },
    ];
  }

  return [
    {
      id: "party_1",
      label: "Party 1",
      name: variables.party_1_name,
      address: variables.party_1_address,
      type: variables.party_1_type,
    },
    {
      id: "party_2",
      label: "Party 2",
      name: variables.party_2_name,
      address: variables.party_2_address,
      type: variables.party_2_type,
    },
  ].filter((participant) => participant.name || participant.address);
}

export function validateDraftConsistency(
  draft,
  { documentType, variables = {} } = {}
) {
  if (!draft?.clauses?.length || !documentType || !variables) {
    return [];
  }

  const clauses = draft.clauses;
  const identityText =
    clauses.find((clause) => clause.category === "IDENTITY")?.text || "";
  const disputeText =
    clauses.find(
      (clause) =>
        clause.category === "DISPUTE_RESOLUTION" ||
        clause.clause_id === "CORE_DISPUTE_RESOLUTION_001"
    )?.text || "";
  const signatureText =
    clauses.find((clause) => clause.category === "SIGNATURE_BLOCK")?.text || "";

  const issues = [];
  const participants = getExpectedParticipants(documentType, variables);

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

  return issues;
}
