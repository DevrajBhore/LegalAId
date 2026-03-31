import { getClauseById } from "./clauseAssembler.js";
import { injectVariables } from "./variableInjector.js";
import { normalizeClauseCategory, sortClausesByOrder } from "../config/clauseOrder.js";

const HARDENING_CLAUSE_IDS = {
  NDA: ["CORE_DEFINITIONS_001", "CORE_FORCE_MAJEURE_001", "CORE_NOTICE_001"],
  EMPLOYMENT_CONTRACT: ["CORE_ENTIRE_AGREEMENT_001", "CORE_NOTICE_001"],
  SERVICE_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SERVICE_SCOPE_001",
    "SERVICE_DELIVERABLES_001",
    "SERVICE_TIMELINES_001",
    "SERVICE_EXPENSES_001",
    "IP_OWNERSHIP_001",
    "CORE_CONFIDENTIALITY_001",
    "NDA_NON_SOLICITATION_001",
    "SERVICE_TERMINATION_001",
    "CORE_INDEMNITY_001",
    "CORE_LIABILITY_CAP_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_AMENDMENT_001",
    "CORE_NOTICE_001",
    "CORE_ASSIGNMENT_001",
    "CORE_WAIVER_001",
    "CORE_COUNTERPARTS_001",
  ],
  CONSULTANCY_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SERVICE_DELIVERABLES_001",
    "SERVICE_EXPENSES_001",
    "IP_OWNERSHIP_001",
    "NDA_NON_COMPETE_001",
    "NDA_NON_SOLICITATION_001",
    "CORE_RELATIONSHIP_OF_PARTIES_001",
    "CORE_INDEMNITY_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_AMENDMENT_001",
    "CORE_NOTICE_001",
  ],
  PARTNERSHIP_DEED: [
    "CORE_DEFINITIONS_001",
    "PARTNERSHIP_CAPITAL_001",
    "CORE_CONFIDENTIALITY_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_NOTICE_001",
  ],
  SHAREHOLDERS_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_NOTICE_001",
    "CORE_COUNTERPARTS_001",
  ],
  JOINT_VENTURE_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "JV_CONTRIBUTION_001",
    "JV_GOVERNANCE_001",
    "CORP_BOARD_COMPOSITION_001",
    "CORP_DEADLOCK_001",
    "NDA_NON_COMPETE_001",
    "CORE_LIABILITY_CAP_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_NOTICE_001",
  ],
  SUPPLY_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SUPPLY_PAYMENT_001",
    "SUPPLY_DELIVERY_001",
    "SUPPLY_WARRANTY_001",
    "SUPPLY_RISK_TRANSFER_001",
    "SUPPLY_SHORTAGE_001",
    "SUPPLY_RETURN_POLICY_001",
    "CORE_CONFIDENTIALITY_001",
    "CORE_INDEMNITY_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_NOTICE_001",
  ],
  DISTRIBUTION_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SUPPLY_DELIVERY_001",
    "SUPPLY_WARRANTY_001",
    "NDA_NON_COMPETE_001",
    "CORE_LIABILITY_CAP_001",
    "CORE_NOTICE_001",
    "CORE_ASSIGNMENT_001",
    "CORE_WAIVER_001",
  ],
  SALES_OF_GOODS_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SUPPLY_PAYMENT_001",
    "SUPPLY_INSPECTION_001",
    "SUPPLY_REJECTION_001",
    "SUPPLY_RISK_TRANSFER_001",
    "CORE_INDEMNITY_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_NOTICE_001",
  ],
  INDEPENDENT_CONTRACTOR_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SERVICE_DELIVERABLES_001",
    "IP_OWNERSHIP_001",
    "NDA_NON_COMPETE_001",
    "NDA_NON_SOLICITATION_001",
    "CORE_RELATIONSHIP_OF_PARTIES_001",
    "SERVICE_TERMINATION_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_AMENDMENT_001",
    "CORE_NOTICE_001",
  ],
  COMMERCIAL_LEASE_AGREEMENT: ["RENT_PROPERTY_USE_001", "RENT_UTILITIES_001", "CORE_NOTICE_001"],
  LEAVE_AND_LICENSE_AGREEMENT: [
    "RENT_PROPERTY_USE_001",
    "RENT_UTILITIES_001",
    "CORE_NOTICE_001",
  ],
  LOAN_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_ASSIGNMENT_001",
    "CORE_WAIVER_001",
    "CORE_COUNTERPARTS_001",
    "CORE_AMENDMENT_001",
  ],
  GUARANTEE_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "LOAN_DEFAULT_001",
    "GUARANTEE_INDEMNITY_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_WAIVER_001",
    "CORE_COUNTERPARTS_001",
  ],
  SOFTWARE_DEVELOPMENT_AGREEMENT: [
    "CORE_DEFINITIONS_001",
    "SERVICE_DELIVERABLES_001",
    "SERVICE_TIMELINES_001",
    "TECH_ACCEPTANCE_001",
    "IP_OWNERSHIP_001",
    "CORE_CONFIDENTIALITY_001",
    "CORE_FORCE_MAJEURE_001",
    "CORE_ENTIRE_AGREEMENT_001",
    "CORE_AMENDMENT_001",
    "CORE_WAIVER_001",
    "CORE_COUNTERPARTS_001",
    "CORE_NOTICE_001",
  ],
  MOU: ["CORE_DEFINITIONS_001", "CORE_TERMINATION_001", "CORE_NOTICE_001"],
};

const DISALLOWED_PROTECTIONS = {
  LOAN_AGREEMENT: new Set(["LIABILITY_CAP", "INDEMNITY", "FORCE_MAJEURE"]),
  GUARANTEE_AGREEMENT: new Set(["LIABILITY_CAP", "INDEMNITY", "FORCE_MAJEURE"]),
};

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
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
  return `INR ${numeric.toLocaleString("en-IN")}`;
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "the agreed date";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-GB");
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
      /\b(?:as\s+per|set\s+out\s+in|specified\s+in|described\s+in)\s+(?:the\s+)?(?:annexed\s+|attached\s+)?(?:schedule|annexure|appendix|exhibit)\s*[a-z0-9-]*\b/gi,
      "as expressly stated in this Agreement"
    )
    .replace(
      /\b(?:annexed\s+|attached\s+)?(?:schedule|annexure|appendix|exhibit)\s*[a-z0-9-]*\b/gi,
      "this Agreement"
    )
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .trim();

  return rewritten || fallback;
}

function resolveServicePartyLabels(documentType) {
  switch (documentType) {
    case "CONSULTANCY_AGREEMENT":
      return { payer: "the Client", payee: "the Consultant" };
    case "INDEPENDENT_CONTRACTOR_AGREEMENT":
      return { payer: "the Client", payee: "the Contractor" };
    case "SOFTWARE_DEVELOPMENT_AGREEMENT":
      return { payer: "the Client", payee: "the Developer" };
    case "DISTRIBUTION_AGREEMENT":
      return { payer: "the Distributor", payee: "the Principal" };
    default:
      return { payer: "the Client", payee: "the Service Provider" };
  }
}

function resolveTimelinePartyLabels(documentType) {
  switch (documentType) {
    case "CONSULTANCY_AGREEMENT":
      return { performer: "the Consultant", reviewer: "the Client" };
    case "INDEPENDENT_CONTRACTOR_AGREEMENT":
      return { performer: "the Contractor", reviewer: "the Client" };
    case "SOFTWARE_DEVELOPMENT_AGREEMENT":
      return { performer: "the Developer", reviewer: "the Client" };
    default:
      return { performer: "the Service Provider", reviewer: "the Client" };
  }
}

function resolveServiceActor(documentType) {
  switch (documentType) {
    case "CONSULTANCY_AGREEMENT":
      return "Consultant";
    case "INDEPENDENT_CONTRACTOR_AGREEMENT":
      return "Contractor";
    case "SOFTWARE_DEVELOPMENT_AGREEMENT":
      return "Developer";
    default:
      return "Service Provider";
  }
}

function renderHardClause(clause, variables = {}, documentType = "") {
  const serviceLabels = resolveServicePartyLabels(documentType);
  const timelineLabels = resolveTimelinePartyLabels(documentType);
  const renderers = {
    EMP_WAGES_001: () =>
      `The Employer shall pay the Employee a gross annual cost-to-company of ${formatCurrency(
        variables.salary
      )} ('CTC'), inclusive of all statutory contributions. The salary shall be disbursed monthly on or before the seventh (7th) day of the following month, in accordance with applicable law. The compensation structure shall comprise the salary components communicated in writing by the Employer${
        variables.salary_components
          ? `, including ${normalizeWhitespace(variables.salary_components)}`
          : ""
      }. The Employer shall deduct TDS as required under the Income Tax Act, 1961, and shall issue Form 16 annually. Any revision to the Employee's compensation shall be communicated in writing. The Employer shall ensure that the total compensation is not less than the applicable minimum wage prescribed for the relevant category of employment.`,

    SERVICE_PAYMENT_001: () => {
      if (documentType === "DISTRIBUTION_AGREEMENT") {
        const pricingTerms = stripExternalReferencePhrases(
          variables.price_terms,
          "the commercial pricing terms expressly agreed between the Parties"
        );
        return `The Distributor shall purchase the Products from the Principal in accordance with the following pricing arrangement: ${pricingTerms}. Payment shall be made in accordance with the following payment terms: ${normalizeWhitespace(
          variables.payment_terms || "within thirty (30) days of receipt of a valid tax invoice"
        )}. All invoices shall be raised in Indian Rupees and shall comply with applicable GST requirements. In the event of delayed payment beyond the agreed due date, the Principal shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the outstanding amount from the due date until the date of actual payment. All payments shall be made by electronic transfer to the bank account designated by the Principal in writing.`;
      }

      return `In consideration of the Services rendered under this Agreement, ${serviceLabels.payer} shall pay ${serviceLabels.payee} fees of ${formatCurrency(
        resolveServiceFee(variables)
      )}. Payment shall be made in accordance with the following payment terms: ${normalizeWhitespace(
        variables.payment_terms || "within thirty (30) days of receipt of a valid tax invoice"
      )}. All invoices shall be raised in Indian Rupees and shall comply with applicable GST requirements. In the event of delayed payment beyond the agreed due date, ${serviceLabels.payee} shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the outstanding amount from the due date until the date of actual payment. All payments shall be made by electronic transfer to the bank account designated by ${serviceLabels.payee} in writing.`;
    },

    SERVICE_SCOPE_001: () => {
      const actor = resolveServiceActor(documentType);
      return `The ${actor} shall provide the following services under this Agreement: ${normalizeWhitespace(
        variables.services_description ||
          variables.consulting_services ||
          variables.project_description ||
          "the services expressly described in this Agreement"
      )}. The ${actor} shall perform the services with reasonable skill, care, and diligence, in accordance with the specifications, milestones, and service standards set out in this Agreement.`;
    },

    SERVICE_DELIVERABLES_001: () => {
      const actor = resolveServiceActor(documentType);
      return `The ${actor} shall deliver the following deliverables under this Agreement: ${normalizeWhitespace(
        variables.deliverables ||
          variables.project_description ||
          variables.services_description ||
          "the deliverables expressly described in this Agreement"
      )}. Each deliverable shall be provided in a form reasonably necessary for the receiving party to review, use, and implement it, together with supporting documentation where commercially appropriate.`;
    },

    SUPPLY_PAYMENT_001: () =>
      `The Buyer shall pay the Supplier the purchase price of ${formatCurrency(
        variables.price
      )} in accordance with the following payment terms: ${normalizeWhitespace(
        variables.payment_terms || "within thirty (30) days of receipt of a valid invoice"
      )}. All payments shall be made by electronic transfer to the Supplier's designated bank account. In the event of delayed payment, the Supplier shall be entitled to charge simple interest at the rate of eighteen percent (18%) per annum on the overdue amount from the due date until actual payment. All amounts are exclusive of GST and other applicable taxes which shall be borne by the Buyer. The Buyer shall not withhold payment on account of any disputed claim without the Supplier's written consent.`,

    SUPPLY_QUALITY_001: () =>
      `The Supplier warrants that all Goods supplied under this Agreement, namely ${normalizeWhitespace(
        variables.goods_description || variables.product_description || "the agreed goods"
      )}, shall conform strictly to the specifications, descriptions, and samples described in this Agreement and related purchase documentation; be of merchantable quality and fit for their intended purpose; be free from defects in design, materials, and workmanship; comply with all applicable Indian standards and legal requirements; and be properly labelled and packaged in accordance with applicable law. The Supplier shall maintain a quality management system and shall permit the Buyer to conduct quality audits upon reasonable notice.`,

    SUPPLY_RISK_TRANSFER_001: () =>
      `Risk of loss, damage, or destruction of the Goods shall pass from the Supplier to the Buyer upon delivery of the Goods at ${normalizeWhitespace(
        variables.delivery_location || "the agreed delivery location"
      )}, provided that the Goods conform to the contract description and are accompanied by all required documentation. Where delivery is by carrier, risk shall pass to the Buyer upon delivery to the first carrier unless the Supplier has specifically arranged for transit insurance, in which case risk passes upon delivery at the destination. Title to the Goods shall pass to the Buyer simultaneously with the passing of risk, subject to the Supplier's receipt of full payment of the applicable invoice.`,

    SERVICE_TIMELINES_001: () =>
      `${timelineLabels.performer} shall perform the Services in accordance with the project timeline and milestones expressly agreed in this Agreement${
        variables.delivery_date
          ? `, with the target completion date being ${formatDate(
              variables.delivery_date
            )}`
          : variables.contract_duration
            ? `, over the duration of ${normalizeWhitespace(variables.contract_duration)}`
            : ""
      }. Time is of the essence in respect of any milestone dates expressly agreed between the Parties. In the event that ${timelineLabels.performer} anticipates a delay in meeting any milestone, ${timelineLabels.performer} shall notify ${timelineLabels.reviewer} in writing at least seven (7) days in advance, specifying the cause of the delay and a revised completion date. ${timelineLabels.reviewer} shall not unreasonably withhold approval of a revised timeline where delay has been caused by ${timelineLabels.reviewer}'s failure to provide timely inputs, approvals, or resources. Where delay is attributable to ${timelineLabels.performer}, ${timelineLabels.reviewer} shall be entitled to contractual remedies expressly agreed in this Agreement.`,

    TECH_ACCEPTANCE_001: () =>
      `Upon delivery of the Software or any milestone deliverable, the Client shall have a period of fifteen (15) business days ('Acceptance Testing Period') to test and evaluate the Software against the agreed acceptance criteria described in this Agreement and the project scope${
        variables.project_description
          ? ` for ${normalizeWhitespace(variables.project_description)}`
          : ""
      }. If the Software meets the Acceptance Criteria, the Client shall issue a written acceptance notice. If the Software fails to meet the Acceptance Criteria, the Client shall notify the Developer in writing specifying the defects in reasonable detail, and the Developer shall remedy such defects within fifteen (15) business days of such notice, following which the Acceptance Testing Period shall recommence. If the Client fails to issue an acceptance notice or a defect notice within the Acceptance Testing Period, the Software shall be deemed accepted.`,

    JV_CONTRIBUTION_001: () =>
      `Each Party shall contribute to the Joint Venture the agreed resources, expertise, and capital. Party 1 shall contribute ${formatCurrency(
        variables.capital_contribution_1
      )} and Party 2 shall contribute ${formatCurrency(
        variables.capital_contribution_2
      )}. Profits and losses arising from the Joint Venture shall be shared between the Parties in the ratio of ${normalizeWhitespace(
        variables.profit_sharing_ratio || "the agreed ratio"
      )}. Each Party's contribution shall be made within the timeframes agreed between the Parties in writing, and failure to contribute shall constitute a material breach of this Agreement.`,

    JV_GOVERNANCE_001: () =>
      `The Joint Venture shall be managed by a Management Committee comprising equal representatives from each Party. Decisions of the Management Committee shall require unanimous consent for major decisions and a simple majority for routine operational decisions. Major decisions shall include approval of the annual budget, entry into any third-party contract outside the ordinary course of business, any material change in the scope of the Joint Venture, and admission of any new party to the Joint Venture. Each Party shall designate its representatives to the Management Committee in writing and may replace them at any time on written notice.`,

    CORP_SHARE_SUBSCRIPTION_001: () =>
      `Each Shareholder shall subscribe to and hold shares in the Company in the proportions recorded in this Agreement. Shareholder 1 shall hold ${normalizeWhitespace(
        variables.shareholding_percentage_1 || "the agreed"
      )}% and Shareholder 2 shall hold ${normalizeWhitespace(
        variables.shareholding_percentage_2 || "the agreed"
      )}%. The subscription for shares constitutes lawful consideration for this Agreement. Any further issue of shares shall be subject to the pre-emptive and transfer rights set out in this Agreement and the applicable provisions of the Companies Act, 2013.`,

    PARTNERSHIP_CAPITAL_001: () =>
      `Each Partner shall contribute capital to the partnership in the following amounts: Partner 1 shall contribute ${formatCurrency(
        variables.capital_contribution_1
      )} and Partner 2 shall contribute ${formatCurrency(
        variables.capital_contribution_2
      )}. The capital contributions shall be held in the name of the partnership and shall not be withdrawn except in accordance with this Deed. Profits and losses of the partnership shall be shared among the Partners in the ratio of ${normalizeWhitespace(
        variables.profit_sharing_ratio || "the agreed ratio"
      )}, and each Partner acknowledges that the capital contribution constitutes lawful consideration for this Agreement within the meaning of Section 2(d) of the Indian Contract Act, 1872.`,

    RENT_PROPERTY_USE_001: () =>
      `The Tenant shall use the Premises solely for the purpose of ${normalizeWhitespace(
        variables.permitted_use || "lawful use of the premises"
      )}, and for no other purpose whatsoever without the prior written consent of the Landlord. The Tenant shall not carry out any illegal or immoral activity on the Premises, store hazardous goods without prior consent, use the Premises in a manner constituting a nuisance, or sublet or licence the Premises without prior written consent. Any breach of this clause shall entitle the Landlord to terminate this Agreement after written notice in accordance with applicable law.`,

    RENT_UTILITIES_001: () =>
      `The Tenant shall be responsible for payment of all utility charges in respect of the Premises during the tenancy, including electricity, water, gas, internet, telephone, and cable charges, based on actual consumption. The Tenant shall pay such bills directly to the respective utility providers before the due date and shall ensure no default occurs. ${resolveMaintenanceSentence(
        variables
      )} Upon vacation, the Tenant shall provide the Landlord with final meter readings or no-dues confirmations from the relevant utility providers. Any arrears of utility charges attributable to the Tenant's period of occupation may be deducted from the Security Deposit.`,

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
      `The Borrower shall repay the Principal Amount together with all accrued interest in accordance with the following repayment schedule: ${normalizeWhitespace(
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
      `Each of the following shall constitute an Event of Default under this Agreement: (a) failure by the Borrower to pay any principal, interest, or other sum due under this Agreement within five (5) Business Days of the due date; (b) material breach by the Borrower of any representation, warranty, or covenant under this Agreement, which, if capable of remedy, remains unremedied for thirty (30) days after written notice; (c) insolvency of the Borrower, filing of any petition under the Insolvency and Bankruptcy Code, 2016, or appointment of a liquidator, receiver, or administrator; (d) any judgment, attachment, or enforcement action against the Borrower that materially impairs the Borrower's ability to perform its obligations under this Agreement; (e) any material adverse change in the financial condition or business of the Borrower; (f) cross-default under any other material financing agreement of the Borrower; or (g) if any security created under this Agreement ceases to be valid, enforceable, or perfected. Upon the occurrence of an Event of Default, the Lender may exercise all rights under this Agreement and applicable law.`,
  };

  const render = renderers[clause.clause_id];
  if (!render) {
    return clause;
  }

  const rendered = render();
  if (!rendered || rendered === clause.text) {
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
  return DISALLOWED_PROTECTIONS[documentType] || new Set();
}

export function applyDocumentHardening(draft, input = {}) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const documentType = input.document_type || draft.document_type;
  const variables = input.variables || draft.metadata?.source_variables || {};
  const requiredClauseIds = HARDENING_CLAUSE_IDS[documentType] || [];
  const genericClausesToRemove = new Set();
  const disallowedProtections = getDisallowedProtections(documentType);

  if (disallowedProtections.has("LIABILITY_CAP")) {
    genericClausesToRemove.add("AUTO-LIAB-001");
    genericClausesToRemove.add("CORE_LIABILITY_CAP_001");
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
    renderHardClause(clause, variables, documentType)
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
  const requiredClauseIds = HARDENING_CLAUSE_IDS[documentType] || [];
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
      (clauseId === "AUTO-LIAB-001" || clauseId === "CORE_LIABILITY_CAP_001")
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
