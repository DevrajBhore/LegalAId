import { DOCUMENT_CONFIG } from "../config/documentConfig.js";

function looksIndividual(name = "", explicitType = "") {
  const normalizedType = String(explicitType || "").toLowerCase();
  if (normalizedType.includes("individual")) {
    return true;
  }
  if (normalizedType) {
    return false;
  }

  const lower = String(name || "").toLowerCase();
  return !(
    lower.includes("pvt") ||
    lower.includes("private limited") ||
    lower.includes("limited") ||
    lower.includes("llp") ||
    lower.includes("partnership")
  );
}

function buildExecutionBlock(name, designation, explicitType = "") {
  const upperName = String(name || "").toUpperCase();

  if (looksIndividual(name, explicitType)) {
    return `${upperName}

_____________________________
Signature:
Name: ${name}
Date:
Place:`;
  }

  return `FOR AND ON BEHALF OF ${upperName}

_____________________________
Authorised Signatory
Name:
Designation: ${designation}
Date:
Place:`;
}

export function resolveSignatures(draft, input = {}) {
  const documentType = input.document_type || input.documentType;
  const config = DOCUMENT_CONFIG?.[documentType] || {};
  const variables = input.variables || {};
  const signType = config.signatureType || "BILATERAL";

  draft.clauses = draft.clauses.map((c) => {
    if (c.category !== "SIGNATURE_BLOCK") return c;

    if (signType === "STATIC") {
      return c;
    }

    if (signType === "PARTNERSHIP") {
      const p1 =
        variables.partner_1_name || variables.party_1_name || "Partner 1";
      const p2 =
        variables.partner_2_name || variables.party_2_name || "Partner 2";
      c.text = `IN WITNESS WHEREOF, the Partners have executed this Deed on the date first written above.

PARTNER 1 - ${p1.toUpperCase()}

_____________________________
Signature:
Name: ${p1}
Date:
Place:

WITNESS 1:
_____________________________
Name:
Address:

PARTNER 2 - ${p2.toUpperCase()}

_____________________________
Signature:
Name: ${p2}
Date:
Place:

WITNESS 2:
_____________________________
Name:
Address:`;
      return c;
    }

    if (signType === "SHAREHOLDERS") {
      const shareholder1 = variables.shareholder_1_name || "Shareholder 1";
      const shareholder2 = variables.shareholder_2_name || "Shareholder 2";
      c.text = `IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.

${buildExecutionBlock(
  shareholder1,
  "Shareholder",
  variables.shareholder_1_type
)}

${buildExecutionBlock(
  shareholder2,
  "Shareholder",
  variables.shareholder_2_type
)}

WITNESSES:

1. _____________________________
   Name:
   Address:
   Date:

2. _____________________________
   Name:
   Address:
   Date:`;
      return c;
    }

    if (signType === "GUARANTEE") {
      const creditor =
        variables.party_1_name || variables.lender_name || "Creditor";
      const debtor =
        variables.party_2_name || variables.borrower_name || "Principal Debtor";
      const guarantor = variables.guarantor_name || "Guarantor";

      c.text = `IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.

${buildExecutionBlock(
  creditor,
  "Authorised Signatory (Creditor)",
  variables.party_1_type
)}

${buildExecutionBlock(
  debtor,
  "Authorised Signatory (Principal Debtor)",
  variables.party_2_type
)}

${buildExecutionBlock(
  guarantor,
  "Guarantor",
  variables.guarantor_type
)}

WITNESSES:

1. _____________________________
   Name:
   Address:
   Date:

2. _____________________________
   Name:
   Address:
   Date:`;
      return c;
    }

    if (signType === "EMPLOYMENT") {
      const employer = variables.employer_name || "Employer";
      const employee = variables.employee_name || "Employee";
      c.text = `IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.

FOR AND ON BEHALF OF ${employer.toUpperCase()}

_____________________________
Name:
Designation: Authorised Signatory
Date:

FOR AND ON BEHALF OF ${employee.toUpperCase()}

_____________________________
Name:
Designation: Employee
Date:`;
      return c;
    }

    const party1 =
      variables.party_1_name ||
      variables.company_name ||
      variables.employer_name ||
      variables.shareholder_1_name ||
      variables.partner_1_name ||
      variables.lender_name ||
      variables.landlord_name ||
      variables.licensor_name ||
      variables.supplier_name ||
      variables.manufacturer_name ||
      "Party 1";

    const party2 =
      variables.party_2_name ||
      variables.employee_name ||
      variables.shareholder_2_name ||
      variables.partner_2_name ||
      variables.borrower_name ||
      variables.tenant_name ||
      variables.licensee_name ||
      variables.buyer_name ||
      variables.distributor_name ||
      variables.developer_name ||
      "Party 2";

    const designations = {
      EMPLOYMENT_CONTRACT: ["Authorised Signatory", "Employee"],
      LOAN_AGREEMENT: [
        "Authorised Signatory (Lender)",
        "Authorised Signatory (Borrower)",
      ],
      COMMERCIAL_LEASE_AGREEMENT: [
        "Authorised Signatory (Landlord)",
        "Authorised Signatory (Tenant)",
      ],
      LEAVE_AND_LICENSE_AGREEMENT: [
        "Authorised Signatory (Licensor)",
        "Authorised Signatory (Licensee)",
      ],
    };

    const [d1, d2] = designations[documentType] || [
      "Authorised Signatory",
      "Authorised Signatory",
    ];

    c.text = `IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.

${buildExecutionBlock(party1, d1, variables.party_1_type)}

${buildExecutionBlock(party2, d2, variables.party_2_type)}

WITNESSES:

1. _____________________________
   Name:
   Address:
   Date:

2. _____________________________
   Name:
   Address:
   Date:`;

    return c;
  });

  return draft;
}
