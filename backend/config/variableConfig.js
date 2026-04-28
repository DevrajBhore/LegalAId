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
    operating_state: {
      label: "Operating State",
      type: "select",
      required: true,
      group: "Jurisdiction & Dispute",
      options: [
        "Andhra Pradesh",
        "Arunachal Pradesh",
        "Assam",
        "Bihar",
        "Chhattisgarh",
        "Delhi",
        "Goa",
        "Gujarat",
        "Haryana",
        "Himachal Pradesh",
        "Jharkhand",
        "Karnataka",
        "Kerala",
        "Madhya Pradesh",
        "Maharashtra",
        "Odisha",
        "Punjab",
        "Rajasthan",
        "Tamil Nadu",
        "Telangana",
        "Uttar Pradesh",
        "Uttarakhand",
        "West Bengal",
      ],
    },
    effective_date: {
      label: "Effective Date",
      type: "date",
      required: true,
      group: "Agreement Basics",
    },
    arbitration_city: {
      label: "Seat of Arbitration",
      type: "text",
      required: false,
      group: "Jurisdiction & Dispute",
    },
    governing_law_state: {
      label: "Governing Law State",
      type: "select",
      required: false,
      group: "Jurisdiction & Dispute",
      options: [
        "Andhra Pradesh",
        "Arunachal Pradesh",
        "Assam",
        "Bihar",
        "Chhattisgarh",
        "Delhi",
        "Goa",
        "Gujarat",
        "Haryana",
        "Himachal Pradesh",
        "Jharkhand",
        "Karnataka",
        "Kerala",
        "Madhya Pradesh",
        "Maharashtra",
        "Odisha",
        "Punjab",
        "Rajasthan",
        "Tamil Nadu",
        "Telangana",
        "Uttar Pradesh",
        "Uttarakhand",
        "West Bengal"
      ],
    },
    dispute_resolution_method: {
      label: "Dispute Resolution Method",
      type: "select",
      required: false,
      group: "Jurisdiction & Dispute",
      options: [
        "Arbitration",
        "Courts",
        "Negotiation, then Arbitration",
        "Mediation, then Arbitration"
      ],
    },
    renewal_option: {
      label: "Renewal Option",
      type: "select",
      required: false,
      group: "Agreement Basics",
      options: ["No", "Automatic", "By mutual written agreement"],
    },
    renewal_terms: {
      label: "Renewal Terms",
      type: "textarea",
      required: false,
      group: "Agreement Basics",
    },
    termination_notice_period: {
      label: "Termination Notice Period (days)",
      type: "number",
      required: false,
      group: "Termination & Remedies",
    },
    termination_for_convenience: {
      label: "Allow Termination for Convenience?",
      type: "select",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: ["NDA"],
      options: ["Yes", "No"],
    },
    termination_for_cause: {
      label: "Allow Termination for Cause?",
      type: "select",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: ["NDA"],
      options: ["Yes", "No"],
    },
    cure_period_days: {
      label: "Cure Period for Remediable Breach (days)",
      type: "number",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: ["NDA"],
    },
    liability_cap_basis: {
      label: "Liability Cap Basis",
      type: "select",
      required: false,
      group: "Risk Allocation",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "PARTNERSHIP_DEED",
        "SHAREHOLDERS_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      options: [
        "Fees paid or payable in the 12 months before the claim",
        "Specific amount",
        "Direct damages only subject to a negotiated cap",
        "Unlimited / uncapped",
      ],
    },
    liability_cap_amount: {
      label: "Specific Liability Cap Amount (₹)",
      type: "number",
      required: false,
      group: "Risk Allocation",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "PARTNERSHIP_DEED",
        "SHAREHOLDERS_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
    },
    indemnity_scope: {
      label: "Indemnity Scope",
      type: "select",
      required: false,
      group: "Risk Allocation",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "PARTNERSHIP_DEED",
        "SHAREHOLDERS_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      options: [
        "Breach of agreement only",
        "Third-party claims only",
        "Breach, negligence, and third-party claims",
        "Breach, confidentiality breach, IP infringement, and third-party claims",
      ],
    },
    include_indemnity_clause: {
      label: "Include Indemnity Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT"
      ],
      options: ["AI Recommended", "Yes", "No"],
      description: "Controls whether the draft should include an indemnity clause.",
      example: "AI Recommended",
      aiGuidance: "Choose Yes when one party is taking operational, confidentiality, data, IP, or third-party claim risk. Leave it on AI Recommended when you want LegalAId to infer the safer default from your deal structure.",
    },
    include_warranty_clause: {
      label: "Include Warranty Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT"
      ],
      options: ["AI Recommended", "Yes", "No"],
      description: "Controls whether the draft should include a service or delivery warranty.",
      example: "AI Recommended",
      aiGuidance: "Use this when you want express promises about quality, conformity to specifications, defect rectification, or support after delivery.",
    },
    include_nomenclature_clause: {
      label: "Include Nomenclature / Definitions Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT"
      ],
      options: ["AI Recommended", "Yes", "No"],
      description: "Adds a definitions clause for key business terms, deliverables, milestones, and commercial references.",
      example: "AI Recommended",
      aiGuidance: "Turn this on when the deal uses project-specific terms like Deliverables, Acceptance Test, Milestone, Change Request, Support Window, or Business Day.",
    },
    nomenclature_terms: {
      label: "Nomenclature / Defined Terms",
      type: "textarea",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT"
      ],
      description: "List any special defined terms, commercial labels, or project vocabulary that should be explained in the document.",
      example: "Services means finance advisory, compliance review, and board support; Deliverables means monthly memo, tracker, and closing report; Business Day excludes bank holidays in Mumbai.",
      aiGuidance: "Give LegalAId 2 to 5 important terms in plain English and it will turn them into a formal definitions / nomenclature clause.",
    },
    include_non_compete: {
      label: "Include Non-Compete Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    },
    include_non_solicit: {
      label: "Include Non-Solicitation Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    },
    include_sla: {
      label: "Include SLA / Service Levels Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    },
    include_reporting: {
      label: "Include Reporting Obligation?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    },
    party_1_type: {
      label: "First Party Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Sole Proprietorship",
        "Trust",
        "Government Body",
      ],
    },
    party_2_type: {
      label: "Second Party Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Sole Proprietorship",
        "Trust",
        "Government Body",
      ],
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
    nda_type: {
      label: "NDA Type",
      type: "select",
      required: false,
      group: "Confidentiality & Use",
      options: ["Mutual", "One-Way"],
    },
    confidential_information_definition: {
      label: "Custom Definition of Confidential Information",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
    },
    confidentiality_exclusions: {
      label: "Confidentiality Exclusions",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
    },
    permitted_use: {
      label: "Permitted Use of Confidential Information",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
    },
    confidentiality_access_scope: {
      label: "Who May Access the Confidential Information?",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
    },
    return_destruction_option: {
      label: "Return / Destruction of Information",
      type: "select",
      required: false,
      group: "Confidentiality & Use",
      options: [
        "Return on request",
        "Destroy on request",
        "Return or destroy with certification"
      ],
    },
    residual_knowledge_treatment: {
      label: "Residual Knowledge Clause",
      type: "select",
      required: false,
      group: "Confidentiality & Use",
      options: [
        "No residual knowledge carve-out",
        "Residual knowledge carve-out permitted",
      ],
    },
      confidentiality_period: {
        label: "Confidentiality Period (e.g. 2 years)",
        type: "text",
        required: true,
      },
      agreement_term: {
        label: "Agreement Term (e.g. 2 years)",
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
    role_responsibilities: {
      label: "Role & Responsibilities",
      type: "textarea",
      required: false,
      group: "Employment Terms",
    },
    department: { label: "Department", type: "text", required: false },
    work_location: { label: "Work Location", type: "text", required: true },
    salary: {
      label: "Gross Annual CTC (₹)",
      type: "number",
      required: true,
      description: "Enter the annual compensation figure as a number only.",
      example: "1200000",
      aiGuidance: "Use the full annual amount without commas. LegalAId will format it as an Indian Rupee amount in the draft.",
    },
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
    bonus_terms: {
      label: "Bonus / Incentive Terms",
      type: "textarea",
      required: false,
      group: "Employment Terms",
    },
    leave_policy: {
      label: "Leave Policy",
      type: "textarea",
      required: false,
      group: "Employment Terms",
    },
    statutory_benefits: {
      label: "Statutory Benefits",
      type: "select",
      required: false,
      group: "Employment Terms",
      options: [
        "PF and ESI applicable",
        "PF applicable",
        "ESI applicable",
        "Not applicable / as per law"
      ],
    },
    employee_confidentiality_scope: {
      label: "Employee Confidentiality Obligations",
      type: "textarea",
      required: false,
      group: "Employment Terms",
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: false,
      group: "Employment Terms",
      options: [
        "Employer owns work product IP",
        "Employee retains pre-existing IP only",
        "Custom / shared arrangement",
      ],
    },
    employment_termination_type: {
      label: "Employment Termination Structure",
      type: "select",
      required: false,
      group: "Employment Terms",
      options: [
        "Notice-based termination",
        "Termination for cause and notice",
        "Fixed-term with early termination rights",
      ],
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
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
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
    party_2_gstin: {
      label: "Service Provider GSTIN (optional)",
      type: "text",
      required: false,
    },
    services_description: {
      label: "Description of Services",
      type: "textarea",
      required: true,
      description: "Describe the actual services in detail, including what will be done, by whom, how often, and to what standard.",
      example: "Monthly bookkeeping, GST return preparation, vendor reconciliation, management reporting, and audit-support responses.",
      aiGuidance: "Mention activities, frequency, service boundaries, exclusions, timelines, and approval touchpoints. The more specific this is, the stronger the scope clause becomes.",
    },
    deliverables: {
      label: "Deliverables",
      type: "textarea",
      required: false,
      description: "List the documents, outputs, reports, code, dashboards, presentations, or other work product to be handed over.",
      example: "Monthly MIS, GST working papers, compliance tracker, executive summary, and final closure memo.",
      aiGuidance: "Use short bullet-style entries. LegalAId will turn them into a more formal deliverables clause where relevant.",
    },
    contract_value: {
      label: "Contract Value / Total Fee (₹)",
      type: "number",
      required: true,
      description: "Enter the agreed total fee as a number only.",
      example: "450000",
      aiGuidance: "Use the total commercial amount without commas or symbols. The final draft will display it as an Indian Rupee figure.",
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
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
    },
    delay_remedies: {
      label: "Delay Penalties / Service Credits",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
    },
    support_maintenance: {
      label: "Support / Maintenance Obligations",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
    },
    warranty_period: {
      label: "Warranty / Re-performance Period",
      type: "text",
      required: false,
      group: "Optional Protections",
      description: "If you want an express warranty, mention the period during which defects, shortfalls, or non-conforming services must be corrected.",
      example: "90 days from delivery or acceptance",
      aiGuidance: "Use this when you want the provider to re-perform defective services, correct mistakes, or fix non-conforming deliverables after handover.",
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / Completion Standard",
      type: "textarea",
      required: false,
      group: "Delivery & Acceptance",
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
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
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
    party_2_gstin: {
      label: "Consultant GSTIN (optional)",
      type: "text",
      required: false,
    },
    consulting_services: {
      label: "Scope of Consulting Services",
      type: "textarea",
      required: true,
      description: "Describe the consulting mandate in a detailed business-operational way, including advisory coverage, expected outputs, review rhythm, and exclusions.",
      example: "Regulatory advisory, transaction structuring support, policy drafting, board-note review, compliance escalation support, and monthly strategy calls.",
      aiGuidance: "Include what the consultant will do, what they will not do, how often they will advise, what outputs they must produce, and whether support is retainer-based or project-based.",
    },
    deliverables: {
      label: "Deliverables / Reporting Requirements",
      type: "textarea",
      required: false,
      description: "Set out the deliverables, reports, decks, notes, trackers, or status updates expected from the consultant.",
      example: "Weekly issue log, monthly strategy note, board deck comments, transaction checklist, and final recommendation memo.",
      aiGuidance: "If reporting matters to you, be specific about report frequency, format, and sign-off expectations.",
    },
    consulting_fee: {
      label: "Consulting Fee (₹)",
      type: "number",
      required: true,
      description: "Enter the agreed consulting fee as a number only.",
      example: "300000",
      aiGuidance: "Use the full consulting fee without commas or symbols. LegalAId will convert it into a properly formatted Rupee amount.",
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
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
    },
    engagement_model: {
      label: "Nature of Engagement",
      type: "select",
      required: false,
      group: "Consulting Controls",
      options: ["Retainer", "Project-based", "Advisory / On-call"],
    },
    consultant_availability: {
      label: "Working Hours / Availability",
      type: "text",
      required: false,
      group: "Consulting Controls",
    },
    conflict_of_interest_terms: {
      label: "Conflict of Interest Terms",
      type: "textarea",
      required: false,
      group: "Consulting Controls",
    },
    warranty_period: {
      label: "Warranty / Re-performance Period",
      type: "text",
      required: false,
      group: "Optional Protections",
      description: "Mention the period during which the consultant must correct defective advice, incomplete work product, or non-conforming deliverables.",
      example: "60 days from delivery of each report",
      aiGuidance: "Useful when the consultant is delivering reports, models, decks, or advisory outputs that may require correction after submission.",
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / Completion Standard",
      type: "textarea",
      required: false,
      group: "Delivery & Acceptance",
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
      label: "Partner 1 Capital Contribution (₹)",
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
      label: "Partner 2 Capital Contribution (₹)",
      type: "number",
      required: true,
    },
    profit_sharing_ratio: {
      label: "Profit / Loss Sharing Ratio (e.g. 50:50)",
      type: "text",
      required: true,
    },
    drawing_limit: {
      label: "Monthly Drawing Limit per Partner (₹)",
      type: "number",
      required: false,
    },
    bank_name: {
      label: "Bank Name for Firm Account",
      type: "text",
      required: false,
    },
    partner_roles: {
      label: "Roles & Duties of Partners",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    decision_making_rules: {
      label: "Decision-Making Rules",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    partner_dispute_resolution: {
      label: "Internal Partner Dispute Handling",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    admission_removal_terms: {
      label: "Admission / Removal of Partners",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    partner_exit_mechanism: {
      label: "Partner Exit Mechanism",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    dissolution_terms: {
      label: "Dissolution Terms",
      type: "textarea",
      required: false,
      group: "Governance & Control",
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
    shareholder_1_type: {
      label: "Shareholder 1 Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
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
    shareholder_2_type: {
      label: "Shareholder 2 Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
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
    voting_rights: {
      label: "Voting Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    dividend_policy: {
      label: "Dividend Policy",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    tag_along_rights: {
      label: "Tag-Along Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    exit_rights: {
      label: "Exit / Liquidity Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
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
      label: "Party 1 Capital Contribution (₹)",
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
      label: "Party 2 Capital Contribution (₹)",
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
    management_control: {
      label: "Management Control",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    exit_terms: {
      label: "Exit / Termination Terms",
      type: "textarea",
      required: false,
      group: "Governance & Control",
    },
    deadlock_resolution: {
      label: "Deadlock Resolution",
      type: "textarea",
      required: false,
      group: "Governance & Control",
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
      label: "Unit Price / Price Schedule (₹)",
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
    inspection_acceptance_terms: {
      label: "Inspection & Acceptance Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
    },
    inspection_timeline_days: {
      label: "Inspection Timeline (days)",
      type: "number",
      required: false,
      group: "Supply & Delivery Controls",
    },
    risk_transfer_stage: {
      label: "Structured Risk Transfer Stage",
      type: "select",
      required: false,
      group: "Supply & Delivery Controls",
      options: [
        "On delivery to the first carrier",
        "On delivery at destination",
        "On inspection and acceptance",
        "On title transfer",
      ],
    },
    risk_transfer_terms: {
      label: "Risk Transfer Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
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
      label: "Minimum Purchase Commitment (₹ / units, or NA)",
      type: "text",
      required: false,
    },
    price_terms: {
      label: "Price / Discount Structure",
      type: "textarea",
      required: false,
    },
    pricing_model: {
      label: "Pricing Model",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: [
        "Fixed transfer price",
        "Margin-based pricing",
        "Discount from list price",
        "Custom written pricing formula",
      ],
    },
    payment_terms: { label: "Payment Terms", type: "text", required: false },
    minimum_purchase_quantity: {
      label: "Minimum Purchase Quantity",
      type: "number",
      required: false,
      group: "Commercial & Tax",
    },
    minimum_purchase_unit: {
      label: "Minimum Purchase Measurement",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: [
        "Units per month",
        "Units per quarter",
        "Units per year",
        "Value per quarter",
        "Value per year",
      ],
    },
    branding_rights: {
      label: "Branding / Trademark Rights",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
    },
    underperformance_termination: {
      label: "Termination for Underperformance",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
    },
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
    price: { label: "Total Price (₹)", type: "number", required: true },
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
    inspection_acceptance_terms: {
      label: "Inspection & Acceptance Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
    },
    inspection_timeline_days: {
      label: "Inspection Timeline (days)",
      type: "number",
      required: false,
      group: "Supply & Delivery Controls",
    },
    risk_transfer_stage: {
      label: "Structured Risk Transfer Stage",
      type: "select",
      required: false,
      group: "Supply & Delivery Controls",
      options: [
        "On delivery to the first carrier",
        "On delivery at destination",
        "On inspection and acceptance",
        "On title transfer",
      ],
    },
    title_transfer_terms: {
      label: "Title Transfer Terms",
      type: "text",
      required: false,
      group: "Supply & Delivery Controls",
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
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
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
    party_2_gstin: {
      label: "Contractor GSTIN (optional)",
      type: "text",
      required: false,
    },
    services_description: {
      label: "Scope of Services",
      type: "textarea",
      required: true,
    },
    deliverables: { label: "Deliverables", type: "textarea", required: false },
    contract_value: {
      label: "Contract Value / Fee (₹)",
      type: "number",
      required: true,
    },
    payment_terms: {
      label: "Payment Terms (e.g. monthly, per milestone)",
      type: "text",
      required: true,
    },
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
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
    tax_responsibility: {
      label: "Tax Responsibility",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
    },
    no_employment_ack: {
      label: "Explicit No-Employment Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / Completion Standard",
      type: "textarea",
      required: false,
      group: "Delivery & Acceptance",
    },
    warranty_period: {
      label: "Warranty / Re-performance Period",
      type: "text",
      required: false,
      group: "Optional Protections",
      description: "Mention how long the contractor must correct defective or incomplete work after submission.",
      example: "45 days after client acceptance",
      aiGuidance: "Useful when the contractor is delivering reports, work product, designs, or implementation support that may need correction after handover.",
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
      label: "Monthly Rent (₹)",
      type: "number",
      required: true,
    },
    security_deposit: {
      label: "Security Deposit (₹)",
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
      label: "Monthly License Fee (₹)",
      type: "number",
      required: true,
    },
    security_deposit: {
      label: "Security Deposit (₹)",
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
    police_verification_required: {
      label: "Police Verification Required?",
      type: "select",
      required: false,
      group: "Property Compliance",
      options: ["Yes", "No"],
    },
    society_rules: {
      label: "Society / Building Rules",
      type: "textarea",
      required: false,
      group: "Property Compliance",
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
    loan_amount: { label: "Loan Amount (₹)", type: "number", required: true },
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
    repayment_frequency: {
      label: "Repayment Frequency",
      type: "select",
      required: false,
      group: "Finance & Security",
      options: ["Monthly", "Quarterly", "Bullet repayment", "Custom schedule"],
    },
    repayment_tenure_months: {
      label: "Repayment Tenure (months)",
      type: "number",
      required: false,
      group: "Finance & Security",
    },
    instalment_amount: {
      label: "Instalment Amount (₹)",
      type: "number",
      required: false,
      group: "Finance & Security",
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
    events_of_default: {
      label: "Events of Default / Invocation Triggers",
      type: "textarea",
      required: false,
      group: "Finance & Security",
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
    guarantor_type: {
      label: "Guarantor Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
    },
    guaranteed_amount: {
      label: "Guaranteed Amount (₹)",
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
    invocation_conditions: {
      label: "Invocation Conditions",
      type: "textarea",
      required: false,
      group: "Finance & Security",
    },
    invocation_procedure: {
      label: "Invocation Procedure",
      type: "textarea",
      required: false,
      group: "Finance & Security",
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
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
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
    party_2_gstin: {
      label: "Developer GSTIN (optional)",
      type: "text",
      required: false,
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
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
    total_fee: { label: "Total Fee (₹)", type: "number", required: true },
    payment_terms: {
      label: "Payment Milestones (e.g. 30% on start, 40% on UAT)",
      type: "textarea",
      required: false,
    },
    milestone_plan: {
      label: "Milestones / Delivery Plan",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / UAT Standards",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
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
    source_code_delivery: {
      label: "Source Code Delivery Terms",
      type: "select",
      required: false,
      group: "Technology Delivery",
      options: [
        "On final payment",
        "At each milestone",
        "Escrow only",
        "No source code delivery"
      ],
    },
    change_request_process: {
      label: "Change Request Process",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
    },
    support_maintenance: {
      label: "Support / Maintenance Obligations",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
    },
  },

  MOU: {
    party_1_name: {
      label: "First Party Full Name / Company",
      type: "text",
      required: true,
    },
    party_1_address: {
      label: "First Party Address",
      type: "textarea",
      required: true,
    },
    party_1_type: {
      label: "First Party Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Government Body",
        "Trust",
      ],
    },
    party_2_name: {
      label: "Second Party Full Name / Company",
      type: "text",
      required: true,
    },
    party_2_address: {
      label: "Second Party Address",
      type: "textarea",
      required: true,
    },
    party_2_type: {
      label: "Second Party Type",
      type: "select",
      required: false,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Government Body",
        "Trust",
      ],
    },
    mou_purpose: {
      label: "Purpose / Objective of MOU",
      type: "textarea",
      required: true,
    },
    mou_scope: {
      label: "Scope of Collaboration",
      type: "textarea",
      required: false,
    },
    mou_duration: {
      label: "Duration of MOU (e.g. 12 months)",
      type: "text",
      required: false,
    },
    binding_nature: {
      label: "Binding Nature of MOU",
      type: "select",
      required: false,
      group: "MOU Positioning",
      options: ["Non-binding", "Binding", "Partly binding"],
    },
    governing_law_state: {
      label: "Governing Law State",
      type: "select",
      required: false,
      group: "Jurisdiction & Dispute",
      options: [
        "Maharashtra",
        "Delhi",
        "Karnataka",
        "Tamil Nadu",
        "Telangana",
        "Gujarat",
        "West Bengal",
        "Rajasthan",
        "Uttar Pradesh",
        "Punjab",
      ],
    },
  },
};

/**
 * Get merged variable definitions for a document type.
 * Returns COMMON vars + doc-type-specific vars, with effective_date and arbitration_city always included.
 */
function isFieldApplicable(documentType, definition = {}) {
  const normalizedDocumentType = String(documentType || "").trim().toUpperCase();
  const applicableDocuments = (definition.applicableDocuments || []).map((value) =>
    String(value || "").trim().toUpperCase()
  );
  const excludedDocuments = (definition.excludeDocuments || []).map((value) =>
    String(value || "").trim().toUpperCase()
  );

  if (applicableDocuments.length > 0 && !applicableDocuments.includes(normalizedDocumentType)) {
    return false;
  }

  if (excludedDocuments.includes(normalizedDocumentType)) {
    return false;
  }

  return true;
}

function filterVariablesForDocument(documentType, variables = {}) {
  return Object.fromEntries(
    Object.entries(variables || {}).filter(([, definition]) =>
      isFieldApplicable(documentType, definition)
    )
  );
}

export function getVariables(documentType) {
  const common = filterVariablesForDocument(documentType, VARIABLE_CONFIG.COMMON || {});
  const specific = filterVariablesForDocument(
    documentType,
    VARIABLE_CONFIG[documentType] || {}
  );
  return { ...common, ...specific };
}

export function sanitizeVariablesForDocument(documentType, variables = {}) {
  const allowedFields = new Set(Object.keys(getVariables(documentType)));
  return Object.fromEntries(
    Object.entries(variables || {}).filter(([fieldName]) => allowedFields.has(fieldName))
  );
}
