/**
 * variableConfig.js
 *
 * Single source of truth for all document variable definitions.
 * Used by:
 *   - frontend form builder  (via /document-config/:type endpoint)
 *   - backend variable validator (variableLoader.js → variableValidator.js)
 *
 * Each variable entry:
 *   label    — human-readable field label shown on the form
 *   type     — "text" | "textarea" | "number" | "date" | "select"
 *   options  — array of strings (only for type="select")
 *   required — whether the field must be filled before generation
 */

export const VARIABLE_CONFIG = {
  // ─── Common fields shared by all document types ───────────────────────────
  COMMON: {
    effective_date: { label: "Effective Date", type: "date", required: true },
    arbitration_city: {
      label: "Seat of Arbitration",
      type: "text",
      required: false,
    },
  },

  // ─── NDA ──────────────────────────────────────────────────────────────────
  NDA: {
    party_1_name: {
      label: "Disclosing Party Full Name",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Disclosing Party Address",
      type: "textarea",
      required: true,
    },
    party_1_type: {
      label: "Disclosing Party Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Public Limited Company",
      ],
    },
    party_2_name: {
      label: "Receiving Party Full Name",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Receiving Party Address",
      type: "textarea",
      required: true,
    },
    party_2_type: {
      label: "Receiving Party Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Public Limited Company",
      ],
    },
    purpose: {
      label: "Purpose of Disclosure",
      type: "textarea",
      required: true,
    },
    confidentiality_period: {
      label: "Confidentiality Period (e.g. 2 years)",
      type: "text",
      required: true,
    },
    non_compete_period: {
      label: "Non-Compete Period after Expiry (e.g. 1 year, or NA)",
      type: "text",
      required: false,
    },
  },

  // ─── Employment Contract ──────────────────────────────────────────────────
  EMPLOYMENT_CONTRACT: {
    employer_name: { label: "Company Name", type: "text", required: true },
    employer_address: {
      label: "Registered Office Address",
      type: "textarea",
      required: true,
    },
    employer_cin: {
      label: "CIN / Registration Number",
      type: "text",
      required: true,
    },
    employee_name: {
      label: "Employee Full Name",
      type: "text",
      required: true,
    },
    employee_address: {
      label: "Residential Address",
      type: "textarea",
      required: true,
    },
    employee_pan: { label: "PAN Number", type: "text", required: false },
    job_title: {
      label: "Job Title / Designation",
      type: "text",
      required: true,
    },
    department: { label: "Department", type: "text", required: false },
    work_location: { label: "Work Location", type: "text", required: true },
    salary: { label: "Gross Annual CTC (INR)", type: "number", required: true },
    salary_components: {
      label: "Salary Breakdown (e.g. Basic 40%, HRA 20%)",
      type: "textarea",
      required: false,
    },
    start_date: { label: "Start Date", type: "date", required: true },
    probation_period: {
      label: "Probation Period (e.g. 6 months)",
      type: "text",
      required: false,
    },
    working_hours: {
      label: "Weekly Working Hours",
      type: "number",
      required: false,
    },
    notice_period_days: {
      label: "Notice Period (days)",
      type: "number",
      required: true,
    },
  },

  // ─── Service Agreement ────────────────────────────────────────────────────
  SERVICE_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Service Provider Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Service Provider Address",
      type: "textarea",
      required: true,
    },
    services_description: {
      label: "Description of Services",
      type: "textarea",
      required: true,
    },
    deliverables: { label: "Deliverables", type: "textarea", required: false },
    contract_value: {
      label: "Contract Value / Total Fee (INR)",
      type: "number",
      required: true,
    },
    payment_terms: {
      label: "Payment Terms (e.g. monthly, on milestone)",
      type: "text",
      required: true,
    },
    service_levels: {
      label: "Service Level / KPIs (or NA)",
      type: "textarea",
      required: false,
    },
    contract_duration: {
      label: "Contract Duration (e.g. 12 months)",
      type: "text",
      required: true,
    },
  },

  // ─── Consultancy Agreement ────────────────────────────────────────────────
  CONSULTANCY_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Consultant Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Consultant Address",
      type: "textarea",
      required: true,
    },
    consulting_services: {
      label: "Scope of Consulting Services",
      type: "textarea",
      required: true,
    },
    deliverables: {
      label: "Deliverables / Reporting Requirements",
      type: "textarea",
      required: false,
    },
    consulting_fee: {
      label: "Consulting Fee (INR)",
      type: "number",
      required: true,
    },
    payment_terms: {
      label: "Payment Schedule (e.g. monthly retainer)",
      type: "text",
      required: false,
    },
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
    },
    non_compete_period: {
      label: "Non-Compete / Non-Solicitation Period (e.g. 1 year)",
      type: "text",
      required: false,
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: true,
    },
  },

  // ─── Partnership Deed ─────────────────────────────────────────────────────
  PARTNERSHIP_DEED: {
    partnership_name: {
      label: "Partnership Firm Name",
      type: "text",
      required: true,
    },
    business_address: {
      label: "Principal Place of Business",
      type: "textarea",
      required: true,
    },
    business_purpose: {
      label: "Nature of Business",
      type: "textarea",
      required: true,
    },
    partner_1_name: {
      label: "Partner 1 Full Name",
      type: "text",
      required: true,
    },
    partner_1_address: {
      label: "Partner 1 Residential Address",
      type: "textarea",
      required: true,
    },
    capital_contribution_1: {
      label: "Partner 1 Capital Contribution (INR)",
      type: "number",
      required: true,
    },
    partner_2_name: {
      label: "Partner 2 Full Name",
      type: "text",
      required: true,
    },
    partner_2_address: {
      label: "Partner 2 Residential Address",
      type: "textarea",
      required: true,
    },
    capital_contribution_2: {
      label: "Partner 2 Capital Contribution (INR)",
      type: "number",
      required: true,
    },
    profit_sharing_ratio: {
      label: "Profit / Loss Sharing Ratio (e.g. 50:50)",
      type: "text",
      required: true,
    },
    drawing_limit: {
      label: "Monthly Drawing Limit per Partner (INR)",
      type: "number",
      required: false,
    },
    bank_name: {
      label: "Bank Name for Firm Account",
      type: "text",
      required: false,
    },
  },

  // ─── Shareholders Agreement ───────────────────────────────────────────────
  SHAREHOLDERS_AGREEMENT: {
    company_name: { label: "Company Name", type: "text", required: true },
    company_cin: {
      label: "CIN (Corporate Identity Number)",
      type: "text",
      required: true,
    },
    company_address: {
      label: "Registered Office Address",
      type: "textarea",
      required: true,
    },
    shareholder_1_name: {
      label: "Shareholder 1 Full Name",
      type: "text",
      required: true,
    },
    shareholder_1_address: {
      label: "Shareholder 1 Address",
      type: "textarea",
      required: true,
    },
    shareholding_percentage_1: {
      label: "Shareholder 1 Shareholding (%)",
      type: "number",
      required: true,
    },
    shareholder_2_name: {
      label: "Shareholder 2 Full Name",
      type: "text",
      required: true,
    },
    shareholder_2_address: {
      label: "Shareholder 2 Address",
      type: "textarea",
      required: true,
    },
    shareholding_percentage_2: {
      label: "Shareholder 2 Shareholding (%)",
      type: "number",
      required: true,
    },
    board_structure: {
      label: "Board Composition (e.g. 2 directors, 1 per shareholder)",
      type: "textarea",
      required: false,
    },
    reserved_matters: {
      label: "Reserved Matters (decisions requiring unanimous consent)",
      type: "textarea",
      required: false,
    },
    rofr_period: {
      label: "Right of First Refusal Period (days)",
      type: "number",
      required: false,
    },
    drag_threshold: {
      label: "Drag-Along Threshold % (e.g. 75)",
      type: "number",
      required: false,
    },
  },

  // ─── Joint Venture Agreement ──────────────────────────────────────────────
  JOINT_VENTURE_AGREEMENT: {
    party_1_name: {
      label: "Party 1 Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Party 1 Address",
      type: "textarea",
      required: true,
    },
    capital_contribution_1: {
      label: "Party 1 Capital Contribution (INR)",
      type: "number",
      required: true,
    },
    party_2_name: {
      label: "Party 2 Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Party 2 Address",
      type: "textarea",
      required: true,
    },
    capital_contribution_2: {
      label: "Party 2 Capital Contribution (INR)",
      type: "number",
      required: true,
    },
    jv_name: {
      label: "Joint Venture Name (or proposed)",
      type: "text",
      required: true,
    },
    jv_purpose: {
      label: "Purpose / Scope of Joint Venture",
      type: "textarea",
      required: true,
    },
    profit_sharing_ratio: {
      label: "Profit / Loss Sharing Ratio (e.g. 50:50)",
      type: "text",
      required: true,
    },
    jv_duration: {
      label: "JV Duration (e.g. 5 years / perpetual)",
      type: "text",
      required: false,
    },
    jv_structure: {
      label: "Governing Structure (Partnership / Company / LLP)",
      type: "text",
      required: false,
    },
    ip_ownership: {
      label: "IP Ownership Arrangement",
      type: "text",
      required: false,
    },
  },

  // ─── Supply Agreement ─────────────────────────────────────────────────────
  SUPPLY_AGREEMENT: {
    party_1_name: {
      label: "Supplier Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Supplier Address",
      type: "textarea",
      required: true,
    },
    party_1_gstin: { label: "Supplier GSTIN", type: "text", required: true },
    party_2_name: {
      label: "Buyer Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Buyer Address",
      type: "textarea",
      required: true,
    },
    party_2_gstin: { label: "Buyer GSTIN", type: "text", required: true },
    goods_description: {
      label: "Description of Goods",
      type: "textarea",
      required: true,
    },
    price: {
      label: "Unit Price / Price Schedule (INR)",
      type: "number",
      required: true,
    },
    payment_terms: {
      label: "Payment Terms (e.g. 30 days from invoice)",
      type: "text",
      required: true,
    },
    delivery_terms: {
      label: "Delivery Terms (e.g. FOB, Ex-Works)",
      type: "text",
      required: true,
    },
    delivery_location: {
      label: "Delivery Location",
      type: "text",
      required: false,
    },
    warranty_period: {
      label: "Warranty Period (e.g. 12 months)",
      type: "text",
      required: false,
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: false,
    },
  },

  // ─── Distribution Agreement ───────────────────────────────────────────────
  DISTRIBUTION_AGREEMENT: {
    party_1_name: {
      label: "Manufacturer / Principal Full Name",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Manufacturer Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Distributor Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Distributor Address",
      type: "textarea",
      required: true,
    },
    product_description: {
      label: "Product Description",
      type: "textarea",
      required: true,
    },
    territory: {
      label: "Distribution Territory",
      type: "text",
      required: true,
    },
    exclusivity: {
      label: "Exclusivity",
      type: "select",
      required: false,
      options: ["Exclusive", "Non-Exclusive", "Semi-Exclusive"],
    },
    min_purchase: {
      label: "Minimum Purchase Commitment (INR / units, or NA)",
      type: "text",
      required: false,
    },
    price_terms: {
      label: "Price / Discount Structure",
      type: "textarea",
      required: false,
    },
    payment_terms: { label: "Payment Terms", type: "text", required: false },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: false,
    },
  },

  // ─── Sales of Goods Agreement ─────────────────────────────────────────────
  SALES_OF_GOODS_AGREEMENT: {
    party_1_name: {
      label: "Seller Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Seller Address",
      type: "textarea",
      required: true,
    },
    party_1_gstin: { label: "Seller GSTIN", type: "text", required: true },
    party_2_name: {
      label: "Buyer Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Buyer Address",
      type: "textarea",
      required: true,
    },
    party_2_gstin: { label: "Buyer GSTIN", type: "text", required: true },
    goods_description: {
      label: "Description of Goods",
      type: "textarea",
      required: true,
    },
    quantity: { label: "Quantity", type: "text", required: false },
    price: { label: "Total Price (INR)", type: "number", required: true },
    gst_rate: {
      label: "Applicable GST Rate (%)",
      type: "number",
      required: false,
    },
    payment_terms: { label: "Payment Terms", type: "text", required: false },
    delivery_date: { label: "Delivery Date", type: "date", required: true },
    delivery_location: {
      label: "Delivery Location",
      type: "text",
      required: false,
    },
  },

  // ─── Independent Contractor Agreement ────────────────────────────────────
  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Contractor Full Name",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Contractor Address",
      type: "textarea",
      required: true,
    },
    services_description: {
      label: "Scope of Services",
      type: "textarea",
      required: true,
    },
    deliverables: { label: "Deliverables", type: "textarea", required: false },
    contract_value: {
      label: "Contract Value / Fee (INR)",
      type: "number",
      required: true,
    },
    payment_terms: {
      label: "Payment Terms (e.g. monthly, per milestone)",
      type: "text",
      required: true,
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: false,
      options: ["Client owns all IP", "Contractor retains IP", "Shared IP"],
    },
    non_compete_period: {
      label: "Non-Compete Period after Engagement (or NA)",
      type: "text",
      required: false,
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: true,
    },
  },

  // ─── Commercial Lease Agreement ───────────────────────────────────────────
  COMMERCIAL_LEASE_AGREEMENT: {
    party_1_name: {
      label: "Landlord Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Landlord Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Tenant Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Tenant Address",
      type: "textarea",
      required: true,
    },
    property_address: {
      label: "Property Address (full)",
      type: "textarea",
      required: true,
    },
    property_description: {
      label: "Property Description (area, floor, type)",
      type: "textarea",
      required: true,
    },
    permitted_use: {
      label: "Permitted Use (e.g. office, retail, warehouse)",
      type: "text",
      required: false,
    },
    rent_amount: {
      label: "Monthly Rent (INR)",
      type: "number",
      required: true,
    },
    security_deposit: {
      label: "Security Deposit (INR)",
      type: "number",
      required: true,
    },
    rent_escalation: {
      label: "Annual Rent Escalation (%)",
      type: "number",
      required: false,
    },
    lease_term: {
      label: "Lease Term (months)",
      type: "number",
      required: true,
    },
    lock_in_period: {
      label: "Lock-in Period (months)",
      type: "number",
      required: false,
    },
    maintenance_party: {
      label: "Maintenance Responsibility",
      type: "select",
      required: false,
      options: ["Landlord", "Tenant", "Split equally"],
    },
  },

  // ─── Leave and License Agreement ─────────────────────────────────────────
  LEAVE_AND_LICENSE_AGREEMENT: {
    party_1_name: { label: "Licensor Full Name", type: "text", required: true },
    party_1_address: {
      label: "Licensor Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Licensee Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Licensee Address",
      type: "textarea",
      required: true,
    },
    property_address: {
      label: "Property Address (full)",
      type: "textarea",
      required: true,
    },
    property_description: {
      label: "Property Description (area, floor, type)",
      type: "textarea",
      required: false,
    },
    permitted_use: { label: "Permitted Use", type: "text", required: false },
    license_fee: {
      label: "Monthly License Fee (INR)",
      type: "number",
      required: true,
    },
    security_deposit: {
      label: "Security Deposit (INR)",
      type: "number",
      required: true,
    },
    rent_escalation: {
      label: "Annual Escalation (%)",
      type: "number",
      required: false,
    },
    license_term: {
      label: "License Term (months)",
      type: "number",
      required: true,
    },
    lock_in_period: {
      label: "Lock-in Period (months)",
      type: "number",
      required: false,
    },
    maintenance_party: {
      label: "Maintenance Responsibility",
      type: "select",
      required: false,
      options: ["Licensor", "Licensee", "Split equally"],
    },
  },

  // ─── Loan Agreement ───────────────────────────────────────────────────────
  LOAN_AGREEMENT: {
    party_1_name: {
      label: "Lender Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Lender Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Borrower Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Borrower Address",
      type: "textarea",
      required: true,
    },
    loan_amount: { label: "Loan Amount (INR)", type: "number", required: true },
    purpose: { label: "Purpose of Loan", type: "textarea", required: false },
    interest_rate: {
      label: "Interest Rate (% per annum)",
      type: "number",
      required: true,
    },
    repayment_schedule: {
      label: "Repayment Schedule (e.g. 12 monthly instalments)",
      type: "textarea",
      required: true,
    },
    repayment_start_date: {
      label: "Repayment Start Date",
      type: "date",
      required: false,
    },
    security_collateral: {
      label: "Security / Collateral (or Unsecured)",
      type: "textarea",
      required: false,
    },
    prepayment_terms: {
      label: "Prepayment Permitted? (Yes / No + conditions)",
      type: "text",
      required: false,
    },
    default_interest_rate: {
      label: "Default Interest Rate (% per annum)",
      type: "number",
      required: false,
    },
  },

  // ─── Guarantee Agreement ──────────────────────────────────────────────────
  GUARANTEE_AGREEMENT: {
    party_1_name: {
      label: "Creditor / Lender Full Name",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Creditor Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Principal Debtor Full Name",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Principal Debtor Address",
      type: "textarea",
      required: true,
    },
    guarantor_name: {
      label: "Guarantor Full Name",
      type: "text",
      required: true,
    },
    guarantor_address: {
      label: "Guarantor Address",
      type: "textarea",
      required: true,
    },
    guaranteed_amount: {
      label: "Guaranteed Amount (INR)",
      type: "number",
      required: true,
    },
    purpose: {
      label: "Underlying Obligation / Loan Description",
      type: "textarea",
      required: false,
    },
    guarantee_type: {
      label: "Guarantee Type",
      type: "select",
      required: false,
      options: [
        "Continuing Guarantee",
        "Limited Guarantee",
        "Performance Guarantee",
      ],
    },
    guarantee_period: {
      label: "Guarantee Period / Expiry (or Continuing)",
      type: "text",
      required: false,
    },
  },

  // ─── Software Development Agreement ──────────────────────────────────────
  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
    },
    party_2_name: {
      label: "Developer / Agency Full Name",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Developer Address",
      type: "textarea",
      required: true,
    },
    project_description: {
      label: "Project Name / Description",
      type: "textarea",
      required: true,
    },
    services_description: {
      label: "Detailed Scope of Work",
      type: "textarea",
      required: false,
    },
    tech_stack: {
      label: "Technology Stack (e.g. React, Node.js)",
      type: "text",
      required: false,
    },
    delivery_date: {
      label: "Project Delivery Date",
      type: "date",
      required: false,
    },
    total_fee: { label: "Total Fee (INR)", type: "number", required: true },
    payment_terms: {
      label: "Payment Milestones (e.g. 30% on start, 40% on UAT)",
      type: "textarea",
      required: false,
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: false,
      options: ["Client owns all IP", "Developer retains IP", "Shared IP"],
    },
    warranty_period: {
      label: "Warranty Period after Delivery (e.g. 90 days)",
      type: "text",
      required: false,
    },
    escrow_required: {
      label: "Source Code Escrow Required?",
      type: "select",
      required: false,
      options: ["Yes", "No"],
    },
  },
};

/**
 * Get merged variable definitions for a document type.
 * Returns COMMON vars + doc-type-specific vars, with effective_date and arbitration_city always included.
 */
export function getVariables(documentType) {
  const common = VARIABLE_CONFIG.COMMON || {};
  const specific = VARIABLE_CONFIG[documentType] || {};
  return { ...common, ...specific };
}
