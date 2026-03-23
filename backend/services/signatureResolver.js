import { DOCUMENT_CONFIG } from "../config/documentConfig.js";

export function resolveSignatures(draft, input = {}) {
  const documentType = input.document_type || input.documentType;
  const config = DOCUMENT_CONFIG?.[documentType] || {};
  const variables = input.variables || {};
  const signType = config.signatureType || "BILATERAL";

  draft.clauses = draft.clauses.map((c) => {
    if (c.category !== "SIGNATURE_BLOCK") return c;

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
    } else if (signType === "PARTNERSHIP") {
      const p1 =
        variables.partner_1_name || variables.party_1_name || "Partner 1";
      const p2 =
        variables.partner_2_name || variables.party_2_name || "Partner 2";
      c.text = `IN WITNESS WHEREOF, the Partners have executed this Deed on the date first written above.

PARTNER 1 — ${p1.toUpperCase()}

_____________________________
Signature:
Name: ${p1}
Date:

WITNESS 1:
_____________________________
Name:
Address:

PARTNER 2 — ${p2.toUpperCase()}

_____________________________
Signature:
Name: ${p2}
Date:

WITNESS 2:
_____________________________
Name:
Address:`;
    } else {
      // BILATERAL — default for all commercial agreements
      const party1 =
        variables.party_1_name ||
        variables.company_name ||
        variables.employer_name ||
        variables.lender_name ||
        variables.landlord_name ||
        variables.licensor_name ||
        variables.supplier_name ||
        variables.manufacturer_name ||
        variables.guarantor_name ||
        "Party 1";

      const party2 =
        variables.party_2_name ||
        variables.employee_name ||
        variables.borrower_name ||
        variables.tenant_name ||
        variables.licensee_name ||
        variables.buyer_name ||
        variables.distributor_name ||
        variables.developer_name ||
        "Party 2";

      // Infer designation based on document type
      const designations = {
        EMPLOYMENT_CONTRACT: ["Authorised Signatory", "Employee"],
        LOAN_AGREEMENT: [
          "Authorised Signatory (Lender)",
          "Authorised Signatory (Borrower)",
        ],
        GUARANTEE_AGREEMENT: ["Authorised Signatory (Creditor)", "Guarantor"],
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

      // Determine party type for signature format
      const p1Type = (variables.party_1_type || "").toLowerCase();
      const p2Type = (variables.party_2_type || "").toLowerCase();
      const isP1Individual =
        p1Type.includes("individual") ||
        (!p1Type &&
          !party1.toLowerCase().includes("pvt") &&
          !party1.toLowerCase().includes("llp") &&
          !party1.toLowerCase().includes("limited"));
      const isP2Individual =
        p2Type.includes("individual") ||
        (!p2Type &&
          !party2.toLowerCase().includes("pvt") &&
          !party2.toLowerCase().includes("llp") &&
          !party2.toLowerCase().includes("limited"));

      const sig1 = isP1Individual
        ? `${party1.toUpperCase()}\n\n_____________________________\nSignature:\nName: ${party1}\nDate:\nPlace:`
        : `FOR AND ON BEHALF OF ${party1.toUpperCase()}\n\n_____________________________\nAuthorised Signatory\nName:\nDesignation: ${d1}\nDate:\nPlace:`;

      const sig2 = isP2Individual
        ? `${party2.toUpperCase()}\n\n_____________________________\nSignature:\nName: ${party2}\nDate:\nPlace:`
        : `FOR AND ON BEHALF OF ${party2.toUpperCase()}\n\n_____________________________\nAuthorised Signatory\nName:\nDesignation: ${d2}\nDate:\nPlace:`;

      c.text = `IN WITNESS WHEREOF, the Parties have executed this Agreement on the date first written above.

${sig1}

${sig2}

WITNESSES:

1. _____________________________
   Name:
   Address:
   Date:

2. _____________________________
   Name:
   Address:
   Date:`;
    }

    return c;
  });

  return draft;
}
