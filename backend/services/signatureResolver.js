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

    // A policy is promulgated by one organisation, not agreed between parties.
    // It has no counterparty and no witnesses, so the bilateral testimonium is
    // simply untrue of it: a privacy policy that ends "the Parties have executed
    // this Agreement" over two witness blocks tells the reader the document is
    // something it is not.
    if (signType === "UNILATERAL") {
      const issuer =
        variables.company_name ||
        variables.employer_name ||
        variables.party_1_name ||
        "the Organisation";
      c.text = `Issued and adopted for and on behalf of ${issuer}:

_____________________________
Name:
Designation:
Date:
Place:`;
      return c;
    }

    // A notice is sent, not executed. There is no counterparty signing opposite,
    // no witnesses and no testimonium: it closes the way a letter closes, over
    // the signature of whoever sends it. Where an advocate sends it, the
    // subscription must say so and name the client, because the notice is the
    // client's act and the advocate signs in a representative capacity.
    if (signType === "NOTICE") {
      const sender =
        variables.sender_name ||
        variables.party_1_name ||
        variables.company_name ||
        "the Sender";
      const advocate = variables.advocate_name;
      const enrolment = variables.advocate_enrolment_number;

      c.text = advocate
        ? `Yours faithfully,

_____________________________
${advocate}
Advocate${enrolment ? `\nEnrolment No.: ${enrolment}` : ""}
Counsel for ${sender}
Date:
Place:

Encl.: Copies of the documents referred to above.

A copy of this notice is retained in my office for record.`
        : `Yours faithfully,

_____________________________
For ${sender}
Name:
Designation:
Date:
Place:

Encl.: Copies of the documents referred to above.`;
      return c;
    }

    // An affidavit is sworn, not signed. It closes with the deponent's
    // signature, the verification that the Civil Procedure Code Order XIX and
    // Order VI Rule 15 require, and the attestation of the officer before whom
    // it was affirmed. Without the verification the affidavit is worthless.
    if (signType === "AFFIDAVIT") {
      const deponent = variables.deponent_name || variables.party_1_name || "the Deponent";
      const place = variables.verification_place || variables.city || "____________";

      c.text = `_____________________________
DEPONENT
${deponent}

VERIFICATION

Verified at ${place} on this ______ day of ______________, 20____ that the contents of the foregoing affidavit are true and correct to my knowledge, that no part of it is false and that nothing material has been concealed therefrom.

_____________________________
DEPONENT
${deponent}

Solemnly affirmed and signed before me by the deponent, who is identified to my satisfaction, on the date and at the place stated above.

_____________________________
Oath Commissioner / Notary Public
Registration No.:`;
      return c;
    }

    // A bond is a unilateral instrument: the obligor binds himself, and the
    // person protected by it does not sign. It is attested, because a bond
    // proved by attesting witnesses is far easier to enforce.
    if (signType === "BOND") {
      const obligor = variables.obligor_name || variables.party_1_name || "the Obligor";

      c.text = `IN WITNESS WHEREOF the Obligor has signed this Bond on the date first written above.

${buildExecutionBlock(obligor, "", variables.party_1_type || "")}

WITNESS 1:
_____________________________
Name:
Address:

WITNESS 2:
_____________________________
Name:
Address:`;
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
      APPOINTMENT_LETTER: ["Authorised Signatory", "Employee"],
      TERM_SHEET: [
        "Authorised Signatory (Company)",
        "Authorised Signatory (Investor)",
      ],
      ESOP_GRANT_LETTER: ["Authorised Signatory", "Optionee"],
      SHARE_SUBSCRIPTION_AGREEMENT: [
        "Authorised Signatory (Company)",
        "Authorised Signatory (Investor)",
      ],
      IP_ASSIGNMENT_AGREEMENT: [
        "Authorised Signatory (Assignor)",
        "Authorised Signatory (Assignee)",
      ],
      DATA_PROCESSING_AGREEMENT: [
        "Authorised Signatory (Data Fiduciary)",
        "Authorised Signatory (Data Processor)",
      ],
      INTERNSHIP_AGREEMENT: ["Authorised Signatory", "Intern"],
      SEPARATION_AGREEMENT: ["Authorised Signatory (Employer)", "Employee"],
      POSH_POLICY: ["Authorised Signatory", "Authorised Signatory"],
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
