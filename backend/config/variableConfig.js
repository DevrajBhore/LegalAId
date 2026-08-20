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
  // `showIf` marks a field that is only meaningful once another answer is given:
  // { field: "party_1_type", equals: ["LLP"] } means "show party_1_llpin only
  // when the first party is an LLP". Backend behaviour does not depend on it --
  // a hidden field is simply left blank, which every clause builder already
  // handles -- so honouring it is purely a form-rendering concern.
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
      description:
        "The Indian state whose law and courts will govern this agreement. Pick the state where the work is mainly done or where the main party is based — it also sets the stamp duty rate and the seat of arbitration.",
    },
    // ─── Authority to execute (optional) ──────────────────────────────────
    // A company or LLP signs through a natural person, and the instrument
    // should show on its face that the signatory was authorised. Excluded from
    // unilateral published instruments, which have no counterparty execution.
    party_1_signatory_name: {
      label: "Party 1 — Authorised Signatory Name",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description:
        "The individual signing for Party 1, where Party 1 is a company, LLP or firm.",
      showIf: { field: "party_1_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    party_1_signatory_designation: {
      label: "Party 1 — Signatory Designation",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description: "For example Director, Managing Partner, Authorised Signatory.",
      showIf: { field: "party_1_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    party_1_authority_reference: {
      label: "Party 1 — Authority (Board Resolution / POA)",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description:
        "For example \"Board Resolution dated 12 August 2026\" or \"Power of Attorney dated 3 March 2026\".",
      showIf: { field: "party_1_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    party_2_signatory_name: {
      label: "Party 2 — Authorised Signatory Name",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description:
        "The individual signing for Party 2, where Party 2 is a company, LLP or firm.",
      showIf: { field: "party_2_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    party_2_signatory_designation: {
      label: "Party 2 — Signatory Designation",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description: "For example Director, Managing Partner, Authorised Signatory.",
      showIf: { field: "party_2_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    party_2_authority_reference: {
      label: "Party 2 — Authority (Board Resolution / POA)",
      type: "text",
      required: false,
      group: "Party Details",
      excludeDocuments: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
      description:
        "For example \"Board Resolution dated 12 August 2026\" or \"Power of Attorney dated 3 March 2026\".",
      showIf: { field: "party_2_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Trust", "Government Body"] },
    },
    effective_date: {
      label: "Effective Date",
      type: "date",
      required: true,
      group: "Agreement Basics",
      description:
        "The date the agreement starts operating. This can differ from the date it is signed; if the parties began earlier, put the earlier date here.",
    },
    involves_personal_data: {
      label: "Will personal data be shared or processed?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      // Not shown for NDA (it defines its own) — NDA's type-specific field wins
      // on merge anyway, but excluding here keeps the form free of duplicates.
      excludeDocuments: ["NDA"],
      description:
        "If yes, LegalAId adds a data-processing clause aligned with the Digital Personal Data Protection Act, 2023.",
      options: ["No", "Yes"],
    },
    include_force_majeure: {
      label: "Add a force majeure clause?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: [
        "SALES_OF_GOODS_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "MOU",
      ],
      description:
        "Excuses performance delayed or prevented by events beyond a party's reasonable control (natural disasters, government action, etc.).",
      options: ["No", "Yes"],
    },
    employee_gender: {
      label: "Employee gender (for statutory benefits)",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["EMPLOYMENT_CONTRACT"],
      description:
        "Used only to include the correct statutory entitlements — maternity benefits under the Maternity Benefit Act, 1961 apply to female employees.",
      options: ["Female", "Male", "Prefer not to say"],
    },
    workplace_headcount: {
      label: "How many employees at the workplace?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["EMPLOYMENT_CONTRACT"],
      description:
        "The POSH Act, 2013 mandates an anti-sexual-harassment policy and Internal Committee for workplaces with 10 or more employees.",
      options: ["Fewer than 10", "10 or more"],
    },
    workplace_type: {
      label: "What type of workplace is this?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["EMPLOYMENT_CONTRACT"],
      description:
        "A factory is governed by the stricter Factories Act, 1948 working-hours/overtime regime; a shop or office follows the applicable State Shops & Establishments Act.",
      options: ["Shop / Office", "Factory"],
    },
    has_esop_or_variable_pay: {
      label: "Does the role include ESOPs or variable/performance pay?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["EMPLOYMENT_CONTRACT"],
      description:
        "If yes, LegalAId adds a tax-aware stock-option / variable-pay clause (vesting, leaver treatment, perquisite tax) under the Companies Act, 2013 and SEBI SBEB Regulations.",
      options: ["No", "Yes"],
    },
    lender_type: {
      label: "Who is the lender?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["LOAN_AGREEMENT"],
      description:
        "The lender type drives regulatory clauses: NBFC → KYC/AML; scheduled bank/NBFC → SARFAESI enforcement; foreign lender → FEMA/ECB compliance.",
      options: ["Scheduled Bank", "NBFC", "Private Individual", "Company", "Foreign"],
    },
    jv_involves_equity: {
      label: "Will the partners contribute equity / share capital?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["JOINT_VENTURE_AGREEMENT"],
      description:
        "If yes, LegalAId adds equity-contribution and shareholding clauses for an equity JV rather than a purely contractual one.",
      options: ["No", "Yes"],
    },
    company_has_ip_assets: {
      label: "Does the company own material IP assets?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SHAREHOLDERS_AGREEMENT"],
      description:
        "If yes, LegalAId adds an IP-ownership/assignment clause ensuring the company holds rights to its intellectual property.",
      options: ["No", "Yes"],
    },
    repayment_structure: {
      label: "How is the loan repaid?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["LOAN_AGREEMENT"],
      description:
        "Amortising repays principal over scheduled instalments/EMIs; Bullet (balloon) repays the entire principal in one lump sum at maturity, with interest serviced periodically.",
      options: ["Amortising / EMI", "Bullet / Balloon"],
    },
    guarantee_extent: {
      label: "Is the guarantor's liability limited or unlimited?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["GUARANTEE_AGREEMENT"],
      description:
        "Unlimited makes the guarantor's liability co-extensive with the debtor; Limited caps the guarantor's aggregate liability at the guaranteed amount (Indian Contract Act, 1872 s.128).",
      options: ["Unlimited", "Limited / Capped"],
    },
    governance_control: {
      label: "What is the governance posture?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SHAREHOLDERS_AGREEMENT"],
      description:
        "Investor-protective adds investor board-nomination rights, quorum requirements, and affirmative-vote reserved matters; Founder-controlled keeps standard board composition.",
      options: ["Founder-controlled", "Investor-protective"],
    },
    title_transfer: {
      label: "When does ownership (title) of the goods pass to the buyer?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SALES_OF_GOODS_AGREEMENT", "SUPPLY_AGREEMENT"],
      description:
        "On delivery is the default. On full payment adds a retention-of-title (Romalpa) clause keeping ownership with the seller until paid — important for sales on credit (Sale of Goods Act, 1930 s.25).",
      options: ["On delivery", "On full payment"],
    },
    include_inspection_rights: {
      label: "Should the buyer have a right to inspect and reject goods?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SALES_OF_GOODS_AGREEMENT", "SUPPLY_AGREEMENT"],
      description:
        "Adds the buyer's right to examine the goods and reject non-conforming deliveries (Sale of Goods Act, 1930 s.41).",
      options: ["No", "Yes"],
    },
    payment_model: {
      label: "How is the Service Provider paid?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SERVICE_AGREEMENT"],
      description:
        "Selects the payment clause: Fixed fee, Milestone-based (pay on accepted deliverables), or Retainer (recurring monthly).",
      options: ["Fixed", "Milestone", "Retainer"],
    },
    termination_style: {
      label: "How should the agreement be terminable?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      applicableDocuments: ["SERVICE_AGREEMENT"],
      description:
        "Selects the termination clause: Cause (breach + cure period), Convenience (either party on notice), or Default (provider non-performance, with cost recovery).",
      options: ["Cause", "Convenience", "Default"],
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "RENTAL_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
      ],
    },
    include_entire_agreement: {
      label: "Add an entire-agreement (no oral terms) clause?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      // Universally applicable optional protection — offered on every type.
      description:
        "Confirms the written agreement is the complete and final understanding, overriding prior oral or written discussions.",
      options: ["No", "Yes"],
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
      description:
        "The state whose law governs the contract, if different from the operating state. Leave blank to use the operating state.",
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
      description:
        "How disputes will be resolved. Arbitration keeps the matter private and is the usual choice for commercial contracts; courts-only means either party may sue directly.",
    },
    renewal_option: {
      label: "Renewal Option",
      type: "select",
      required: false,
      group: "Agreement Basics",
      options: ["No", "Automatic", "By mutual written agreement"],
      description:
        "Whether the agreement can continue past its initial term, and how. \"Automatic\" renews unless someone objects; \"mutual\" requires both sides to agree in writing.",
      excludeDocuments: [
        "GUARANTEE_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "LOAN_AGREEMENT",
        "PARTNERSHIP_DEED",
        "PRIVACY_POLICY",
        "SALES_OF_GOODS_AGREEMENT",
        "SHAREHOLDERS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    renewal_terms: {
      label: "Renewal Terms",
      type: "textarea",
      required: false,
      group: "Agreement Basics",
      description:
        "How renewal actually works. For example: \"renewable for a further 12 months by written agreement given at least 30 days before expiry, on the same terms\".",
      excludeDocuments: [
        "GUARANTEE_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "LOAN_AGREEMENT",
        "PARTNERSHIP_DEED",
        "PRIVACY_POLICY",
        "SALES_OF_GOODS_AGREEMENT",
        "SHAREHOLDERS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
      showIf: { field: "renewal_option", equals: ["Automatic renewal", "Renewable by mutual agreement"] },
    },
    termination_notice_period: {
      label: "Termination Notice Period (days)",
      type: "number",
      required: false,
      group: "Termination & Remedies",
      description:
        "How many days' written notice a party must give to end the agreement without any fault. Leave blank and the system sets it from the value and length of the deal.",
      excludeDocuments: [
        "SALES_OF_GOODS_AGREEMENT",
      ],
    },
    termination_for_convenience: {
      label: "Allow Termination for Convenience?",
      type: "select",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: [
        "NDA",
        "SALES_OF_GOODS_AGREEMENT",
      ],
      options: ["Yes", "No"],
      description:
        "Whether either party may walk away without giving a reason, simply by serving notice. Say No if you want the agreement to end only on breach or expiry.",
    },
    termination_for_cause: {
      label: "Allow Termination for Cause?",
      type: "select",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: [
        "NDA",
        "SALES_OF_GOODS_AGREEMENT",
      ],
      options: ["Yes", "No"],
      description:
        "Whether a party may end the agreement immediately if the other side breaches it. Almost always Yes.",
    },
    cure_period_days: {
      label: "Cure Period for Remediable Breach (days)",
      type: "number",
      required: false,
      group: "Termination & Remedies",
      excludeDocuments: [
        "NDA",
        "SALES_OF_GOODS_AGREEMENT",
      ],
      description:
        "How many days the breaching party gets to fix a fixable breach before the other side can terminate. 15 or 30 days is usual.",
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
      description:
        "The ceiling on what one party can be made to pay the other. \"Total fees paid\" is the common commercial default; a specific amount fixes it in rupees; \"unlimited\" removes the ceiling.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "TERMS_OF_SERVICE",
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
      description:
        "The maximum rupee amount a party can be liable for. Only used if you chose a specific amount as the cap basis.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
      showIf: { field: "liability_cap_basis", equals: ["Specific amount"] },
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
      description:
        "What one party promises to cover the other against. Third-party claims only is narrowest; adding breach and negligence widens it considerably.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "TERMS_OF_SERVICE",
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
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
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
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "MOU",
        "NDA",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
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
    
      description:
        "Whether to restrict the other party from competing with you. Note that under section 27 of the Indian Contract Act, 1872 a restraint of trade operating after the agreement ends is generally void, so this is safest limited to the term itself.",},
    include_non_solicit: {
      label: "Include Non-Solicitation Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
    
      description:
        "Whether to stop the other party poaching your staff or customers. Non-solicitation is more readily enforced in India than a full non-compete.",},
    include_sla: {
      label: "Include SLA / Service Levels Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
      description:
        "Whether to add measurable service levels — uptime, response times, resolution targets — with consequences if they are missed.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "MOU",
        "NDA",
        "PARTNERSHIP_DEED",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "SHAREHOLDERS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    include_reporting: {
      label: "Include Reporting Obligation?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
      description:
        "Whether the service provider must send regular progress or status reports.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "GUARANTEE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "LOAN_AGREEMENT",
        "MOU",
        "NDA",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    audit_rights: {
      label: "Audit Rights",
      type: "textarea",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      description: "State whether one party may inspect records, reports, deliverables, invoices, security controls, stock, or compliance evidence.",
      example: "Client may audit service records and invoice backup once per quarter with five business days' notice.",
      aiGuidance: "Use this for oversight instead of broad non-compete language. Mention frequency, notice, scope, confidentiality, and who bears audit costs.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "MOU",
        "NDA",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    information_rights: {
      label: "Information Rights",
      type: "textarea",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      description: "Describe periodic information, financial, operational, technical, or compliance updates expected from the other party.",
      example: "Monthly MIS, milestone tracker, compliance exception log, and material-risk updates.",
      excludeDocuments: [
        "COMMERCIAL_LEASE_AGREEMENT",
        "LEAVE_AND_LICENSE_AGREEMENT",
        "MOU",
        "NDA",
        "PRIVACY_POLICY",
        "RENTAL_AGREEMENT",
        "SALES_OF_GOODS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    escalation_mechanism: {
      label: "Escalation Mechanism",
      type: "textarea",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      description: "Set out business escalation steps before legal remedies or formal disputes.",
      example: "Project manager escalation within 3 business days, senior management meeting within 7 business days, then formal dispute process.",
      excludeDocuments: [
        "PRIVACY_POLICY",
        "SALES_OF_GOODS_AGREEMENT",
        "TERMS_OF_SERVICE",
      ],
    },
    additional_protection_clauses: {
      label: "Additional Protection Clauses",
      type: "textarea",
      required: false,
      group: "Optional Protections",
      applicableDocuments: [
        "SERVICE_AGREEMENT",
        "CONSULTANCY_AGREEMENT",
        "JOINT_VENTURE_AGREEMENT",
        "SUPPLY_AGREEMENT",
        "DISTRIBUTION_AGREEMENT",
        "INDEPENDENT_CONTRACTOR_AGREEMENT",
        "SOFTWARE_DEVELOPMENT_AGREEMENT",
      ],
      description: "Any extra lawful controls, reporting duties, approvals, safeguards, or operational protections you want added.",
      example: "Quarterly compliance certificate, prior approval for subcontracting, and written breach escalation report.",
    },
    party_1_type: {
      label: "First Party Type",
      type: "select",
      required: true,
      group: "Party Details",
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
      description:
        "The legal form of the first party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    party_2_type: {
      label: "Second Party Type",
      type: "select",
      required: true,
      group: "Party Details",
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
      description:
        "The legal form of the second party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    party_1_pan: {
      label: "First Party PAN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required for individuals, companies, LLPs, partnerships, and proprietorships.",
      example: "ABCDE1234F",
      aiGuidance: "Use the legal PAN printed on the party's tax records. LegalAId will block generation if the selected party type requires PAN and this is blank.",
      showIf: { field: "party_1_type", equals: ["Individual", "Sole Proprietorship", "Partnership Firm", "Trust", "Private Limited Company", "Public Limited Company", "LLP"] },
    },
    party_1_gstin: {
      label: "First Party GSTIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required for company, LLP, partnership, and proprietorship parties where GST details are needed in the agreement.",
      example: "27ABCDE1234F1Z5",
      showIf: { field: "party_1_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Sole Proprietorship"] },
    },
    party_1_cin: {
      label: "First Party CIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required when the first party is a private limited or public limited company.",
      example: "U72900MH2020PTC123456",
      showIf: { field: "party_1_type", equals: ["Private Limited Company", "Public Limited Company"] },
    },
    party_1_llpin: {
      label: "First Party LLPIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required when the first party is an LLP.",
      example: "AAA-1234",
      showIf: { field: "party_1_type", equals: ["LLP"] },
    },
    party_2_pan: {
      label: "Second Party PAN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required for individuals, companies, LLPs, partnerships, and proprietorships.",
      example: "ABCDE1234F",
      showIf: { field: "party_2_type", equals: ["Individual", "Sole Proprietorship", "Partnership Firm", "Trust", "Private Limited Company", "Public Limited Company", "LLP"] },
    },
    party_2_gstin: {
      label: "Second Party GSTIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required for company, LLP, partnership, and proprietorship parties where GST details are needed in the agreement.",
      example: "27ABCDE1234F1Z5",
      showIf: { field: "party_2_type", equals: ["Private Limited Company", "Public Limited Company", "LLP", "Partnership Firm", "Sole Proprietorship"] },
    },
    party_2_cin: {
      label: "Second Party CIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required when the second party is a private limited or public limited company.",
      example: "U72900MH2020PTC123456",
      showIf: { field: "party_2_type", equals: ["Private Limited Company", "Public Limited Company"] },
    },
    party_2_llpin: {
      label: "Second Party LLPIN",
      type: "text",
      required: false,
      group: "Party Details",
      description: "Required when the second party is an LLP.",
      example: "AAA-1234",
      showIf: { field: "party_2_type", equals: ["LLP"] },
    },
  },

  // ─── NDA ──────────────────────────────────────────────────────────────────
  NDA: {
    party_1_name: {
      label: "Disclosing Party Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Disclosing Party Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
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
      description:
        "The legal form of the first party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    party_2_name: {
      label: "Receiving Party Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Receiving Party Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
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
      description:
        "The legal form of the second party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    purpose: {
      label: "Purpose of Disclosure",
      type: "textarea",
      required: true,
      description:
        "Why the parties are entering this agreement, in one or two sentences. Be specific — a vague purpose weakens the contract, because the object of an agreement must be certain.",
    },
    nda_type: {
      label: "NDA Type",
      type: "select",
      required: false,
      group: "Confidentiality & Use",
      options: ["Mutual", "One-Way"],
      description:
        "Whether only one side shares confidential information (one-way) or both sides do (mutual).",
    },
    confidential_information_definition: {
      label: "Custom Definition of Confidential Information",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
      description:
        "Your own definition of what counts as confidential, if the standard one is not enough. Leave blank to use the standard wording covering non-public technical, financial and commercial information.",
    },
    confidentiality_exclusions: {
      label: "Confidentiality Exclusions",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
      description:
        "Information that is deliberately carved out of the confidentiality obligation, beyond the standard exclusions for public knowledge and independently developed material.",
    },
    permitted_use: {
      label: "Permitted Use of Confidential Information",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
      description:
        "The only purpose for which the receiving party may use the confidential information. For example: \"solely to evaluate a possible acquisition of the disclosing party\".",
    },
    confidentiality_access_scope: {
      label: "Who May Access the Confidential Information?",
      type: "textarea",
      required: false,
      group: "Confidentiality & Use",
      description:
        "Who inside the receiving party's organisation may see the information. For example: \"only the deal team, the CFO, and external legal and tax advisers\".",
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
      description:
        "What happens to the confidential material when the agreement ends — return it, destroy it, or either at the discloser's choice.",
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
      description:
        "Whether the receiving party's staff may use what they remember unaided after the engagement. Permitting this weakens protection; refusing it is safer for the discloser.",
    },
      confidentiality_period: {
        label: "Confidentiality Period (e.g. 2 years)",
        type: "text",
        required: true,
        description:
          "How long the confidentiality obligation lasts after the agreement ends. For example: \"3 years\", or \"indefinitely for trade secrets\".",
      },
      agreement_term: {
        label: "Agreement Term (e.g. 2 years)",
        type: "text",
        required: true,
        description:
          "How long the agreement itself runs. For example: \"2 years from the Effective Date\".",
      },
      non_compete_period: {
        label: "Non-Compete Period after Expiry (e.g. 1 year, or NA)",
        type: "text",
      required: false,
    
        description:
          "How long after the engagement ends the restriction applies. Note that under section 27 of the Indian Contract Act, 1872 a restraint of trade after employment ends is generally void, so keep this narrow and short.",},
    counterparty_type: {
      label: "Who is the receiving / counterparty?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "The kind of counterparty shapes the document. An investor or diligence counterparty gets heightened confidentiality; a vendor/supplier gets non-circumvention protection.",
      options: [
        "Investor",
        "Vendor",
        "Customer",
        "Employee",
        "Business Partner",
        "Other",
      ],
    },
    involves_source_code: {
      label: "Will source code or software be shared?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "If yes, LegalAId adds source-code and software protection (no copying, no reverse engineering, no derivative use) under the Copyright Act.",
      options: ["No", "Yes"],
    },
    involves_trade_secrets: {
      label: "Are trade secrets involved?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "If yes, the confidentiality standard is upgraded to trade-secret grade and a dedicated non-use obligation is added.",
      options: ["No", "Yes"],
    },
    involves_personal_data: {
      label: "Will personal data be shared?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "If yes, a data-processing clause aligned with the DPDP Act, 2023 is included.",
      options: ["No", "Yes"],
    },
    include_non_solicit: {
      label: "Add a non-solicitation restriction?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "Restricts the receiving party from soliciting the disclosing party's employees or customers using the confidential information.",
      options: ["No", "Yes"],
    },
  },

  // ─── Employment Contract ──────────────────────────────────────────────────
  EMPLOYMENT_CONTRACT: {
    employer_name: { label: "Company Name", type: "text", required: true, description: "The full legal name of the employing company, exactly as registered with the Registrar of Companies.",},
    employer_address: {
      label: "Registered Office Address",
      type: "textarea",
      required: true,
      description:
        "The full legal name of the employing company, exactly as registered with the Registrar of Companies.",
    },
    // Without this, the engine could not tell whether the employer was a company,
    // an LLP or a natural person. The party descriptor branches entirely on the
    // participant type, so every employer was rendered as a bare name -- no
    // incorporation recital, no CIN, and the natural-person successor wording
    // ("legal heirs, executors, administrators") applied to body corporates.
    employer_type: {
      label: "Employer Type",
      type: "select",
      required: false,
      group: "Party Details",
      options: [
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Sole Proprietorship",
        "Trust",
        "Government Body",
        "Individual",
      ],
      description:
        "The legal form of the employer. This decides the incorporation recital and whether the CIN or LLPIN is recited in the agreement.",
    },

    employer_cin: {
      label: "CIN / Registration Number",
      type: "text",
      required: true,
      description:
        "The 21-character Corporate Identity Number from the certificate of incorporation, for example U74999MH2015PTC123456. For an LLP use the LLPIN instead.",
    },
    employer_pan: {
      label: "Employer PAN",
      type: "text",
      required: true,
      description: "PAN of the employer company or organization.",
      example: "ABCDE1234F",
    },
    employer_gstin: {
      label: "Employer GSTIN",
      type: "text",
      required: true,
      description: "GSTIN of the employer entity where applicable for identity and tax records.",
      example: "27ABCDE1234F1Z5",
    },
    employee_name: {
      label: "Employee Full Name",
      type: "text",
      required: true,
      description:
        "The employee's full name exactly as it appears on their PAN card or Aadhaar.",
    },
    employee_address: {
      label: "Residential Address",
      type: "textarea",
      required: true,
      description:
        "The employee's residential address, including city, state and PIN code.",
    },
    employee_pan: { label: "PAN Number", type: "text", required: true, description: "The employee's 10-character PAN, for example ABCDE1234F. Needed for TDS on salary under the Income Tax Act, 1961.",},
    job_title: {
      label: "Job Title / Designation",
      type: "text",
      required: true,
      description:
        "The employee's 10-character PAN, for example ABCDE1234F. Needed for TDS on salary under the Income Tax Act, 1961.",
    },
    role_responsibilities: {
      label: "Role & Responsibilities",
      type: "textarea",
      required: false,
      group: "Employment Terms",
      description:
        "What the employee will actually do day to day. List the main duties — this is what the employer can later hold them to.",
    },
    department: { label: "Department", type: "text", required: false, description: "The team or function the employee sits in, for example Engineering, Finance, Operations.",},
    work_location: { label: "Work Location", type: "text", required: true, description: "Where the employee is based. Name the city and office, or state \"remote\" or \"hybrid\" if that is the arrangement.",},
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
      description:
        "How the salary splits into basic, HRA, allowances and employer contributions. For example: \"Basic 40%, HRA 20%, special allowance 30%, employer PF 10%\". Keeping basic at around 40 to 50 percent affects PF and gratuity.",
    },
    start_date: { label: "Start Date", type: "date", required: true, description: "The employee's first working day. This is the date from which service, notice and probation are counted.",},
    probation_period: {
      label: "Probation Period (e.g. 6 months)",
      type: "text",
      required: false,
      description:
        "The employee's first working day. This is the date from which service, notice and probation are counted.",
    },
    working_hours: {
      label: "Weekly Working Hours",
      type: "number",
      required: false,
      description:
        "Normal weekly working hours. Most states cap this at 48 hours a week under the Shops and Establishments Act; factories are governed by the Factories Act, 1948.",
    },
    notice_period_days: {
      label: "Notice Period (days)",
      type: "number",
      required: true,
      description:
        "How many days' notice either side must give to end the employment after confirmation. 30, 60 or 90 days are typical by seniority.",
    },
    bonus_terms: {
      label: "Bonus / Incentive Terms",
      type: "textarea",
      required: false,
      group: "Employment Terms",
      description:
        "How any bonus or incentive is calculated and when it is paid. Note that the Payment of Bonus Act, 1965 sets a statutory minimum for employees below a wage threshold, separate from any discretionary bonus.",
    },
    leave_policy: {
      label: "Leave Policy",
      type: "textarea",
      required: false,
      group: "Employment Terms",
      description:
        "The employee's leave entitlement — earned, casual, sick and public holidays — and whether unused leave carries forward or is encashed.",
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
      description:
        "Which statutory schemes apply: Provident Fund, ESIC, gratuity and professional tax. These depend on headcount and salary, not on what the contract says.",
    },
    employee_confidentiality_scope: {
      label: "Employee Confidentiality Obligations",
      type: "textarea",
      required: true,
      group: "Employment Terms",
      description:
        "What specifically the employee must keep confidential, for example \"source code, customer lists, pricing models and unreleased product plans\".",
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: true,
      group: "Employment Terms",
      options: [
        "Employer owns work product IP",
        "Employee retains pre-existing IP only",
        "Custom / shared arrangement",
      ],
      description:
        "Who owns what is created during the engagement. For employees and commissioned work the employer usually owns it; a contractor may retain ownership and grant a licence instead.",
    },
    employment_termination_type: {
      label: "Employment Termination Structure",
      type: "select",
      required: true,
      group: "Employment Terms",
      options: [
        "Notice-based termination",
        "Termination for cause and notice",
        "Fixed-term with early termination rights",
      ],
      description:
        "How the employment can be brought to an end — on notice, for cause, or as a fixed term with early exit rights.",
    },
    seniority_level: {
      label: "Seniority Level",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "Senior / leadership roles add garden-leave rights during the notice period and an exclusivity (anti-moonlighting) obligation.",
      options: ["Junior", "Mid", "Senior / Leadership"],
    },
    involves_source_code: {
      label: "Does the role involve source code or sensitive IP?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "If yes, LegalAId adds an exclusivity / anti-moonlighting obligation to protect the employer's code and know-how.",
      options: ["No", "Yes"],
    },
    involves_trade_secrets: {
      label: "Will the employee handle trade secrets?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "If yes, exclusivity of service is tightened to protect the employer's trade secrets.",
      options: ["No", "Yes"],
    },
    include_non_compete: {
      label: "Add a post-employment non-compete & non-solicitation?",
      type: "select",
      required: false,
      group: "Context & Risk Profile",
      description:
        "Optional. Post-employment non-competes are enforceable in India only when narrowly tied to confidential information (ICA S.27). Added only if you opt in.",
      options: ["No", "Yes"],
    },
  },

  // ─── Service Agreement ────────────────────────────────────────────────────
  SERVICE_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Service Provider Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Service Provider Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: {
      label: "Service Provider GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
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
      required: true,
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
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    service_levels: {
      label: "Service Level / KPIs (or NA)",
      type: "textarea",
      required: false,
      description:
        "The measurable standards the service must meet — uptime, response time, resolution time — and how they are measured. Write NA if none apply.",
    },
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
      description:
        "Which out-of-pocket costs are reimbursed and on what basis. For example: \"pre-approved travel and accommodation at actuals against receipts\". Write NA if the fee is all-inclusive.",
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
      description:
        "Whether GST is chargeable on this supply. If yes, the invoice must carry the GSTIN, HSN or SAC code and the tax amount.",
    },
    delay_remedies: {
      label: "Delay Penalties / Service Credits",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
      description:
        "What happens if delivery or service is late — service credits, fee reductions or a right to terminate. Frame these as a genuine pre-estimate of loss, not a punishment.",
    },
    support_maintenance: {
      label: "Support / Maintenance Obligations",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
      description:
        "What ongoing support is included after delivery — hours of cover, response times, bug fixes, updates — and for how long.",
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
      description:
        "How the client decides whether the work is done properly, and how long they have to say so. Without this, disputes about \"completion\" have nothing to test against.",
    },
    contract_duration: {
      label: "Contract Duration (e.g. 12 months)",
      type: "text",
      required: true,
      description:
        "How long the agreement runs, for example \"12 months\" or \"3 years\". This also drives the notice period and, for leases, whether registration is compulsory.",
    },
  },

  // ─── Consultancy Agreement ────────────────────────────────────────────────
  CONSULTANCY_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Consultant Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Consultant Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: {
      label: "Consultant GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
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
      required: true,
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
      required: true,
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
      description:
        "Which out-of-pocket costs are reimbursed and on what basis. For example: \"pre-approved travel and accommodation at actuals against receipts\". Write NA if the fee is all-inclusive.",
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
      description:
        "Whether GST is chargeable on this supply. If yes, the invoice must carry the GSTIN, HSN or SAC code and the tax amount.",
    },
    engagement_model: {
      label: "Nature of Engagement",
      type: "select",
      required: false,
      group: "Consulting Controls",
      options: ["Retainer", "Project-based", "Advisory / On-call"],
      description:
        "Whether the consultant is engaged for a fixed scope, on a retainer, or on time and materials.",
    },
    consultant_availability: {
      label: "Working Hours / Availability",
      type: "text",
      required: false,
      group: "Consulting Controls",
      description:
        "How much of the consultant's time the client gets. For example: \"up to 20 hours per week, Monday to Friday, Indian business hours\".",
    },
    conflict_of_interest_terms: {
      label: "Conflict of Interest Terms",
      type: "textarea",
      required: false,
      group: "Consulting Controls",
      description:
        "Whether the consultant may work for competitors during the engagement, and what they must disclose before taking on other work.",
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
      description:
        "How the client decides whether the work is done properly, and how long they have to say so. Without this, disputes about \"completion\" have nothing to test against.",
    },
    non_compete_period: {
      label: "Non-Compete / Non-Solicitation Period (e.g. 1 year)",
      type: "text",
      required: false,
      description:
        "How long after the engagement ends the restriction applies. Note that under section 27 of the Indian Contract Act, 1872 a restraint of trade after employment ends is generally void, so keep this narrow and short.",
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: true,
      description:
        "How long the agreement runs, for example \"12 months\" or \"3 years\". This also drives the notice period and, for leases, whether registration is compulsory.",
    },
  },

  // ─── Partnership Deed ─────────────────────────────────────────────────────
  PARTNERSHIP_DEED: {
    partnership_name: {
      label: "Partnership Firm Name",
      type: "text",
      required: true,
      description:
        "The name the firm will trade under. Check it is not already registered and does not use restricted words like \"Crown\" or \"Emperor\" under the Indian Partnership Act, 1932.",
    },
    business_address: {
      label: "Principal Place of Business",
      type: "textarea",
      required: true,
      description:
        "The firm's principal place of business, including city, state and PIN code.",
    },
    business_purpose: {
      label: "Nature of Business",
      type: "textarea",
      required: true,
      description:
        "What business the firm will carry on, described specifically. For example: \"wholesale trading and distribution of industrial pumps and spare parts in Maharashtra\".",
    },
    partner_1_name: {
      label: "Partner 1 Full Name",
      type: "text",
      required: true,
      description:
        "The first partner's full legal name as it appears on their PAN, or the registered name if the partner is a company or LLP.",
    },
    partner_1_address: {
      label: "Partner 1 Residential Address",
      type: "textarea",
      required: true,
      description:
        "The first partner's residential address, or registered office if the partner is an entity. Include city, state and PIN code.",
    },

    // A partner under the Indian Partnership Act, 1932 may be a natural
    // person or a body corporate. With no type field the descriptor fell
    // through to natural-person treatment, so a corporate partner got no
    // incorporation recital and was given "legal heirs, executors and
    // administrators" as its successors.
    partner_1_type: {
      label: "Partner 1 Type",
      type: "select",
      required: true,
      group: "Party Details",
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
      description:
        "Whether the first partner is an individual or a body corporate. This changes how the partner is described and what successor wording applies.",
    },
    capital_contribution_1: {
      label: "Partner 1 Capital Contribution (₹)",
      type: "number",
      required: true,
      description:
        "How much the first partner puts into the firm, in rupees. If the contribution is property or services rather than cash, describe it in the roles field.",
    },
    partner_2_name: {
      label: "Partner 2 Full Name",
      type: "text",
      required: true,
      description:
        "The second partner's full legal name as it appears on their PAN, or the registered name if the partner is a company or LLP.",
    },
    partner_2_address: {
      label: "Partner 2 Residential Address",
      type: "textarea",
      required: true,
      description:
        "The second partner's residential address, or registered office if the partner is an entity. Include city, state and PIN code.",
    },

    // A partner under the Indian Partnership Act, 1932 may be a natural
    // person or a body corporate. With no type field the descriptor fell
    // through to natural-person treatment, so a corporate partner got no
    // incorporation recital and was given "legal heirs, executors and
    // administrators" as its successors.
    partner_2_type: {
      label: "Partner 2 Type",
      type: "select",
      required: true,
      group: "Party Details",
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
      description:
        "Whether the second partner is an individual or a body corporate. This changes how the partner is described and what successor wording applies.",
    },
    capital_contribution_2: {
      label: "Partner 2 Capital Contribution (₹)",
      type: "number",
      required: true,
      description:
        "How much the second partner puts into the firm, in rupees. If the contribution is property or services rather than cash, describe it in the roles field.",
    },
    profit_sharing_ratio: {
      label: "Profit / Loss Sharing Ratio (e.g. 50:50)",
      type: "text",
      required: true,
      description:
        "How profits and losses are divided, for example \"50:50\" or \"60:40\". If nothing is agreed, the Indian Partnership Act, 1932 divides them equally.",
    },
    drawing_limit: {
      label: "Monthly Drawing Limit per Partner (₹)",
      type: "number",
      required: false,
      description:
        "How much each partner may withdraw from the firm each month in rupees, before profits are formally distributed.",
    },
    bank_name: {
      label: "Bank Name for Firm Account",
      type: "text",
      required: false,
      description:
        "The bank where the firm's current account will be held.",
    },
    partner_roles: {
      label: "Roles & Duties of Partners",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "What each partner is responsible for — who manages operations, who handles accounts, who can sign contracts, and how much time each will devote.",
    },
    decision_making_rules: {
      label: "Decision-Making Rules",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "Which decisions need unanimous agreement and which one partner can take alone. Set a rupee threshold above which both partners must sign off.",
    },
    partner_dispute_resolution: {
      label: "Internal Partner Dispute Handling",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "How the partners will settle disagreements between themselves before it becomes a formal dispute.",
    },
    admission_removal_terms: {
      label: "Admission / Removal of Partners",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "How a new partner can be brought in and how an existing partner can be removed, including who must consent.",
    },
    partner_exit_mechanism: {
      label: "Partner Exit Mechanism",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "What happens when a partner wants out — notice required, how their share is valued, and when they are paid.",
    },
    dissolution_terms: {
      label: "Dissolution Terms",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "What triggers the firm winding up, and how assets and liabilities are divided when it does.",
    },
  },

  // ─── Shareholders Agreement ───────────────────────────────────────────────
  SHAREHOLDERS_AGREEMENT: {
    company_name: { label: "Company Name", type: "text", required: true, description: "The company's full registered name, exactly as on the certificate of incorporation.",},
    company_cin: {
      label: "CIN (Corporate Identity Number)",
      type: "text",
      required: true,
      description:
        "The company's full registered name, exactly as on the certificate of incorporation.",
    },
    company_address: {
      label: "Registered Office Address",
      type: "textarea",
      required: true,
      description:
        "The company's registered office address as filed with the Registrar of Companies, including city, state and PIN code.",
    },
    shareholder_1_name: {
      label: "Shareholder 1 Full Name",
      type: "text",
      required: true,
      description:
        "The first shareholder's full legal name, matching the register of members.",
    },
    shareholder_1_address: {
      label: "Shareholder 1 Address",
      type: "textarea",
      required: true,
      description:
        "The first shareholder's address as recorded in the register of members.",
    },
    shareholder_1_type: {
      label: "Shareholder 1 Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
      description:
        "Whether the first shareholder is an individual or a body corporate.",
    },
    shareholding_percentage_1: {
      label: "Shareholder 1 Shareholding (%)",
      type: "number",
      required: true,
      description:
        "The first shareholder's percentage holding. The two shareholdings must add up to exactly 100.",
    },
    shareholder_2_name: {
      label: "Shareholder 2 Full Name",
      type: "text",
      required: true,
      description:
        "The second shareholder's full legal name, matching the register of members.",
    },
    shareholder_2_address: {
      label: "Shareholder 2 Address",
      type: "textarea",
      required: true,
      description:
        "The second shareholder's address as recorded in the register of members.",
    },
    shareholder_2_type: {
      label: "Shareholder 2 Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
      description:
        "Whether the second shareholder is an individual or a body corporate.",
    },
    shareholding_percentage_2: {
      label: "Shareholder 2 Shareholding (%)",
      type: "number",
      required: true,
      description:
        "The second shareholder's percentage holding. The two shareholdings must add up to exactly 100.",
    },
    board_structure: {
      label: "Board Composition (e.g. 2 directors, 1 per shareholder)",
      type: "textarea",
      required: true,
      description:
        "How many directors each shareholder may appoint, and who chairs the board. For example: \"2 directors appointed by the majority holder, 1 by the minority holder, chair rotates annually\".",
    },
    reserved_matters: {
      label: "Reserved Matters (decisions requiring unanimous consent)",
      type: "textarea",
      required: true,
      description:
        "Decisions the company cannot take without the minority shareholder's consent — typically issuing new shares, borrowing above a threshold, selling the business, or changing the constitution.",
    },
    rofr_period: {
      label: "Right of First Refusal Period (days)",
      type: "number",
      required: false,
      description:
        "How many days the other shareholder has to match a third-party offer before shares can be sold outside. 30 days is common.",
    },
    drag_threshold: {
      label: "Drag-Along Threshold % (e.g. 75)",
      type: "number",
      required: false,
      description:
        "The percentage of shareholders who, if they agree to sell, can force the remaining shareholders to sell too. Usually 75 percent or more.",
    },
    voting_rights: {
      label: "Voting Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "How votes attach to shares, and any matters where voting is weighted differently from shareholding.",
    },
    dividend_policy: {
      label: "Dividend Policy",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "When and how profits are distributed to shareholders, and what proportion is retained in the business.",
    },
    tag_along_rights: {
      label: "Tag-Along Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "Whether a minority shareholder can insist on selling alongside a majority shareholder who is exiting, on the same terms.",
    },
    exit_rights: {
      label: "Exit / Liquidity Rights",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "How a shareholder can realise their investment — buy-back, sale to a third party, listing, or a put option — and on what timetable.",
    },
  },

  // ─── Joint Venture Agreement ──────────────────────────────────────────────
  JOINT_VENTURE_AGREEMENT: {
    party_1_name: {
      label: "Party 1 Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Party 1 Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    capital_contribution_1: {
      label: "Party 1 Capital Contribution (₹)",
      type: "number",
      required: true,
      description:
        "How much the first partner puts into the firm, in rupees. If the contribution is property or services rather than cash, describe it in the roles field.",
    },
    party_2_name: {
      label: "Party 2 Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Party 2 Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    capital_contribution_2: {
      label: "Party 2 Capital Contribution (₹)",
      type: "number",
      required: true,
      description:
        "How much the second partner puts into the firm, in rupees. If the contribution is property or services rather than cash, describe it in the roles field.",
    },
    jv_name: {
      label: "Joint Venture Name (or proposed)",
      type: "text",
      required: true,
      description:
        "The name of the joint venture, or the proposed name if the vehicle is not yet formed.",
    },
    jv_purpose: {
      label: "Purpose / Scope of Joint Venture",
      type: "textarea",
      required: true,
      description:
        "What the joint venture is being set up to do, described specifically enough that it is clear what falls inside and outside its scope.",
    },
    profit_sharing_ratio: {
      label: "Profit / Loss Sharing Ratio (e.g. 50:50)",
      type: "text",
      required: true,
      description:
        "How profits and losses are divided, for example \"50:50\" or \"60:40\". If nothing is agreed, the Indian Partnership Act, 1932 divides them equally.",
    },
    jv_duration: {
      label: "JV Duration (e.g. 5 years / perpetual)",
      type: "text",
      required: true,
      description:
        "How long the joint venture runs, for example \"5 years\" or \"until the project completes\".",
    },
    jv_structure: {
      label: "Governing Structure (Partnership / Company / LLP)",
      type: "text",
      required: true,
      description:
        "How the venture is organised — a purely contractual arrangement, a partnership, an LLP, or an incorporated company. This determines liability and tax treatment.",
    },
    ip_ownership: {
      label: "IP Ownership Arrangement",
      type: "text",
      required: true,
      description:
        "Who owns what is created during the engagement. For employees and commissioned work the employer usually owns it; a contractor may retain ownership and grant a licence instead.",
    },
    management_control: {
      label: "Management Control",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "Who runs the venture day to day, who appoints the management, and which decisions need both partners' agreement.",
    },
    exit_terms: {
      label: "Exit / Termination Terms",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "How a party leaves the venture — notice, valuation of their stake, and what happens to jointly owned assets and intellectual property.",
    },
    deadlock_resolution: {
      label: "Deadlock Resolution",
      type: "textarea",
      required: false,
      group: "Governance & Control",
      description:
        "What happens when the parties cannot agree on a decision requiring both — escalation to senior management, an independent expert, a buy-sell mechanism, or winding up.",
    },
  },

  // ─── Supply Agreement ─────────────────────────────────────────────────────
  SUPPLY_AGREEMENT: {
    party_1_name: {
      label: "Supplier Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Supplier Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: { label: "Supplier GSTIN", type: "text", required: true, description: "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Buyer Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Buyer Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: { label: "Buyer GSTIN", type: "text", required: true, description: "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    goods_description: {
      label: "Description of Goods",
      type: "textarea",
      required: true,
      description:
        "What is being sold, described precisely enough to identify it — type, specification, grade, model and packaging.",
    },
    price: {
      label: "Unit Price / Price Schedule (₹)",
      type: "number",
      required: true,
      description:
        "The unit price or total price in rupees, excluding GST unless you state otherwise.",
    },
    payment_terms: {
      label: "Payment Terms (e.g. 30 days from invoice)",
      type: "text",
      required: true,
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    delivery_terms: {
      label: "Delivery Terms (e.g. FOB, Ex-Works)",
      type: "text",
      required: true,
      description:
        "The delivery basis, for example Ex-Works, FOB or CIF. This decides who arranges and pays for transport and insurance, and when risk passes.",
    },
    delivery_location: {
      label: "Delivery Location",
      type: "text",
      required: true,
      description:
        "Exactly where the goods must be delivered, including city, state and PIN code.",
    },
    warranty_period: {
      label: "Warranty Period (e.g. 12 months)",
      type: "text",
      required: true,
    
      description:
        "How long the supplier stands behind the goods or work after delivery, for example \"12 months from acceptance\". This runs alongside the implied conditions in the Sale of Goods Act, 1930.",},
    inspection_acceptance_terms: {
      label: "Inspection & Acceptance Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "How the buyer checks the goods on arrival and what they may do if the goods do not conform. Section 41 of the Sale of Goods Act, 1930 gives the buyer a reasonable opportunity to examine.",
    },
    inspection_timeline_days: {
      label: "Inspection Timeline (days)",
      type: "number",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "How many days the buyer has to inspect and reject non-conforming goods before they are treated as accepted.",
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
      description:
        "The point at which loss or damage becomes the buyer's problem — on dispatch, on delivery, or on acceptance. This is separate from when ownership passes.",
    },
    risk_transfer_terms: {
      label: "Risk Transfer Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "Any specific arrangements about who bears the risk in transit, and what insurance is required.",
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: true,
      description:
        "How long the agreement runs, for example \"12 months\" or \"3 years\". This also drives the notice period and, for leases, whether registration is compulsory.",
    },
  },

  // ─── Distribution Agreement ───────────────────────────────────────────────
  DISTRIBUTION_AGREEMENT: {
    party_1_name: {
      label: "Manufacturer / Principal Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Manufacturer Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_name: {
      label: "Distributor Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Distributor Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    product_description: {
      label: "Product Description",
      type: "textarea",
      required: true,
      description:
        "What products the distributor is appointed to sell, described specifically enough to fix the boundaries of the appointment.",
    },
    territory: {
      label: "Distribution Territory",
      type: "text",
      required: true,
      description:
        "The geographic area the distributor may sell in, for example \"the States of Maharashtra, Gujarat and Goa\".",
    },
    exclusivity: {
      label: "Exclusivity",
      type: "select",
      required: true,
      options: ["Exclusive", "Non-Exclusive", "Semi-Exclusive"],
      description:
        "Whether the distributor is the only one in the territory (exclusive), one of a limited number (semi-exclusive), or one of many (non-exclusive). Exclusive arrangements can raise issues under the Competition Act, 2002.",
    },
    min_purchase: {
      label: "Minimum Purchase Commitment (₹ / units, or NA)",
      type: "text",
      required: true,
      description:
        "The minimum the distributor must buy to keep the appointment, expressed in rupees or units per period.",
    },
    price_terms: {
      label: "Price / Discount Structure",
      type: "textarea",
      required: true,
      description:
        "How the price to the distributor is set — list price less a discount, a fixed schedule, or cost plus a margin — and how and when it can be revised.",
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
      description:
        "The basis on which the price is calculated across the arrangement.",
    },
    payment_terms: { label: "Payment Terms", type: "text", required: true, description: "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",},
    minimum_purchase_quantity: {
      label: "Minimum Purchase Quantity",
      type: "number",
      required: false,
      group: "Commercial & Tax",
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
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
      description:
        "The unit the minimum purchase is measured in — pieces, kilograms, litres, or rupees.",
    },
    branding_rights: {
      label: "Branding / Trademark Rights",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
      description:
        "How the distributor may use the supplier's trade marks and branding, and what they must not do with them.",
    },
    underperformance_termination: {
      label: "Termination for Underperformance",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
      description:
        "What level of underperformance lets the supplier end the appointment, for example \"failure to meet 80 percent of the minimum purchase commitment in two consecutive quarters\".",
    },
    contract_duration: {
      label: "Contract Duration",
      type: "text",
      required: true,
      description:
        "How long the agreement runs, for example \"12 months\" or \"3 years\". This also drives the notice period and, for leases, whether registration is compulsory.",
    },
  },

  // ─── Sales of Goods Agreement ─────────────────────────────────────────────
  SALES_OF_GOODS_AGREEMENT: {
    party_1_name: {
      label: "Seller Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Seller Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: { label: "Seller GSTIN", type: "text", required: true, description: "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Buyer Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Buyer Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: { label: "Buyer GSTIN", type: "text", required: true, description: "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    goods_description: {
      label: "Description of Goods",
      type: "textarea",
      required: true,
      description:
        "What is being sold, described precisely enough to identify it — type, specification, grade, model and packaging.",
    },
    quantity: { label: "Quantity", type: "text", required: true, description: "How much is being bought, with the unit of measurement, for example \"500 units\" or \"12 metric tonnes\".",},
    price: { label: "Total Price (₹)", type: "number", required: true, description: "The unit price or total price in rupees, excluding GST unless you state otherwise.",},
    gst_rate: {
      label: "Applicable GST Rate (%)",
      type: "number",
      required: true,
      description:
        "The unit price or total price in rupees, excluding GST unless you state otherwise.",
    },
    payment_terms: { label: "Payment Terms", type: "text", required: true, description: "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",},
    delivery_date: { label: "Delivery Date", type: "date", required: true, description: "The date by which delivery must be made. If there are several deliveries, use the milestone field to set them out.",},
    delivery_location: {
      label: "Delivery Location",
      type: "text",
      required: true,
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    inspection_acceptance_terms: {
      label: "Inspection & Acceptance Terms",
      type: "textarea",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "How the buyer checks the goods on arrival and what they may do if the goods do not conform. Section 41 of the Sale of Goods Act, 1930 gives the buyer a reasonable opportunity to examine.",
    },
    inspection_timeline_days: {
      label: "Inspection Timeline (days)",
      type: "number",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "How many days the buyer has to inspect and reject non-conforming goods before they are treated as accepted.",
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
      description:
        "The point at which loss or damage becomes the buyer's problem — on dispatch, on delivery, or on acceptance. This is separate from when ownership passes.",
    },
    title_transfer_terms: {
      label: "Title Transfer Terms",
      type: "text",
      required: false,
      group: "Supply & Delivery Controls",
      description:
        "When ownership passes to the buyer. Sellers on credit often retain title until payment is received in full, even though risk passes on delivery.",
    },
  },

  // ─── Independent Contractor Agreement ────────────────────────────────────
  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Contractor Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Contractor Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: {
      label: "Contractor GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    services_description: {
      label: "Scope of Services",
      type: "textarea",
      required: true,
    
      description:
        "What the service provider will actually do, described specifically. \"Consulting services\" is too vague to enforce; name the activities, the standard expected and what is out of scope.",},
    deliverables: { label: "Deliverables", type: "textarea", required: true, description: "The concrete outputs the client receives, listed item by item. For example: \"a deployed application, admin documentation, and two training sessions\".",},
    contract_value: {
      label: "Contract Value / Fee (₹)",
      type: "number",
      required: true,
    
      description:
        "The total value of the contract in rupees, excluding GST unless you state otherwise. This also sets the stamp duty basis and the indicative liability cap.",},
    payment_terms: {
      label: "Payment Terms (e.g. monthly, per milestone)",
      type: "text",
      required: true,
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    expenses_policy: {
      label: "Expense Reimbursement Policy (or NA)",
      type: "text",
      required: false,
      description:
        "Which out-of-pocket costs are reimbursed and on what basis. For example: \"pre-approved travel and accommodation at actuals against receipts\". Write NA if the fee is all-inclusive.",
    },
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
      description:
        "Whether GST is chargeable on this supply. If yes, the invoice must carry the GSTIN, HSN or SAC code and the tax amount.",
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: true,
      options: ["Client owns all IP", "Contractor retains IP", "Shared IP"],
      description:
        "Who owns what is created during the engagement. For employees and commissioned work the employer usually owns it; a contractor may retain ownership and grant a licence instead.",
    },
    non_compete_period: {
      label: "Non-Compete Period after Engagement (or NA)",
      type: "text",
      required: false,
      description:
        "How long after the engagement ends the restriction applies. Note that under section 27 of the Indian Contract Act, 1872 a restraint of trade after employment ends is generally void, so keep this narrow and short.",
    },
    tax_responsibility: {
      label: "Tax Responsibility",
      type: "textarea",
      required: false,
      group: "Commercial & Tax",
      description:
        "Who bears which taxes — GST, TDS, professional tax — and who is responsible for the related filings.",
    },
    no_employment_ack: {
      label: "Explicit No-Employment Clause?",
      type: "select",
      required: false,
      group: "Optional Protections",
      options: ["Yes", "No"],
      description:
        "Whether to state expressly that no employment relationship is created. Worth including where a contractor works closely with your team, to reduce the risk of a later claim of deemed employment.",
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / Completion Standard",
      type: "textarea",
      required: false,
      group: "Delivery & Acceptance",
      description:
        "How the client decides whether the work is done properly, and how long they have to say so. Without this, disputes about \"completion\" have nothing to test against.",
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
      description:
        "How long the agreement runs, for example \"12 months\" or \"3 years\". This also drives the notice period and, for leases, whether registration is compulsory.",
    },
  },

  // ─── Commercial Lease Agreement ───────────────────────────────────────────
  COMMERCIAL_LEASE_AGREEMENT: {
    party_1_name: {
      label: "Landlord Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Landlord Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_name: {
      label: "Tenant Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Tenant Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    property_address: {
      label: "Property Address (full)",
      type: "textarea",
      required: true,
      description:
        "The full postal address of the property, including building, street, locality, city, state and PIN code.",
    },
    property_description: {
      label: "Property Description (area, floor, type)",
      type: "textarea",
      required: true,
      description:
        "What is being let, described precisely — carpet area in square feet, floor, number of rooms, parking, and any fittings or furniture included.",
    },
    permitted_use: {
      label: "Permitted Use (e.g. office, retail, warehouse)",
      type: "text",
      required: true,
      description:
        "The only purpose for which the receiving party may use the confidential information. For example: \"solely to evaluate a possible acquisition of the disclosing party\".",
    },
    rent_amount: {
      label: "Monthly Rent (₹)",
      type: "number",
      required: true,
      description:
        "The monthly rent in rupees, excluding maintenance and utilities unless you state otherwise.",
    },
    security_deposit: {
      label: "Security Deposit (₹)",
      type: "number",
      required: true,
      description:
        "The refundable deposit in rupees, and note that some state rent laws cap this — the Model Tenancy Act, 2021 suggests two months for residential premises.",
    },
    rent_escalation: {
      label: "Annual Rent Escalation (%)",
      type: "number",
      required: false,
      description:
        "The percentage the rent rises by each year, for example 5. Enter 0 if the rent is fixed for the whole term.",
    },
    lease_term: {
      label: "Lease Term (months)",
      type: "number",
      required: true,
      description:
        "How many months the lease runs. A term of 12 months or more makes the lease compulsorily registrable under section 17(1)(d) of the Registration Act, 1908.",
    },
    lock_in_period: {
      label: "Lock-in Period (months)",
      type: "number",
      required: false,
      description:
        "How many months neither party may terminate, regardless of notice. Leave at 0 if either side can exit on notice from the start.",
    },
    maintenance_party: {
      label: "Maintenance Responsibility",
      type: "select",
      required: true,
      options: ["Landlord", "Tenant", "Split equally"],
      description:
        "Who pays for and arranges maintenance and repairs — the landlord, the tenant, or split between structural and day-to-day.",
    },
  },

  // ─── Leave and License Agreement ─────────────────────────────────────────
  LEAVE_AND_LICENSE_AGREEMENT: {
    party_1_name: { label: "Licensor Full Name", type: "text", required: true, description: "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",},
    party_1_address: {
      label: "Licensor Address",
      type: "textarea",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_name: {
      label: "Licensee Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Licensee Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    property_address: {
      label: "Property Address (full)",
      type: "textarea",
      required: true,
      description:
        "The full postal address of the property, including building, street, locality, city, state and PIN code.",
    },
    property_description: {
      label: "Property Description (area, floor, type)",
      type: "textarea",
      required: true,
      description:
        "What is being let, described precisely — carpet area in square feet, floor, number of rooms, parking, and any fittings or furniture included.",
    },
    permitted_use: { label: "Permitted Use", type: "text", required: true, description: "The only purpose for which the receiving party may use the confidential information. For example: \"solely to evaluate a possible acquisition of the disclosing party\".",},
    license_fee: {
      label: "Monthly License Fee (₹)",
      type: "number",
      required: true,
      description:
        "The only purpose for which the receiving party may use the confidential information. For example: \"solely to evaluate a possible acquisition of the disclosing party\".",
    },
    security_deposit: {
      label: "Security Deposit (₹)",
      type: "number",
      required: true,
      description:
        "The refundable deposit in rupees, and note that some state rent laws cap this — the Model Tenancy Act, 2021 suggests two months for residential premises.",
    },
    rent_escalation: {
      label: "Annual Escalation (%)",
      type: "number",
      required: false,
      description:
        "The percentage the rent rises by each year, for example 5. Enter 0 if the rent is fixed for the whole term.",
    },
    license_term: {
      label: "License Term (months)",
      type: "number",
      required: true,
      description:
        "How many months the licence runs. In Maharashtra, a leave and licence agreement must be registered under section 55 of the Maharashtra Rent Control Act, 1999 whatever its length.",
    },
    lock_in_period: {
      label: "Lock-in Period (months)",
      type: "number",
      required: false,
      description:
        "How many months neither party may terminate, regardless of notice. Leave at 0 if either side can exit on notice from the start.",
    },
    maintenance_party: {
      label: "Maintenance Responsibility",
      type: "select",
      required: true,
      options: ["Licensor", "Licensee", "Split equally"],
      description:
        "Who pays for and arranges maintenance and repairs — the landlord, the tenant, or split between structural and day-to-day.",
    },
    police_verification_required: {
      label: "Police Verification Required?",
      type: "select",
      required: false,
      group: "Property Compliance",
      options: ["Yes", "No"],
      description:
        "Whether the occupant's details must be filed with the local police. Several states and most housing societies require this for tenants.",
    },
    society_rules: {
      label: "Society / Building Rules",
      type: "textarea",
      required: false,
      group: "Property Compliance",
      description:
        "Any housing society or building rules the occupant must follow — visitor policy, parking, pets, use of common areas, timings for moving in.",
    },
  },

  // ─── Loan Agreement ───────────────────────────────────────────────────────
  LOAN_AGREEMENT: {
    party_1_name: {
      label: "Lender Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Lender Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_name: {
      label: "Borrower Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Borrower Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    loan_amount: { label: "Loan Amount (₹)", type: "number", required: true, description: "The principal advanced, in rupees. Do not include interest here.",},
    purpose: { label: "Purpose of Loan", type: "textarea", required: true, description: "Why the parties are entering this agreement, in one or two sentences. Be specific — a vague purpose weakens the contract, because the object of an agreement must be certain.",},
    interest_rate: {
      label: "Interest Rate (% per annum)",
      type: "number",
      required: true,
      description:
        "Why the parties are entering this agreement, in one or two sentences. Be specific — a vague purpose weakens the contract, because the object of an agreement must be certain.",
    },
    repayment_schedule: {
      label: "Repayment Schedule (e.g. 12 monthly instalments)",
      type: "textarea",
      required: true,
      description:
        "How the loan is repaid, for example \"24 equal monthly instalments of Rs. 50,000 beginning 1 October 2026\".",
    },
    repayment_frequency: {
      label: "Repayment Frequency",
      type: "select",
      required: false,
      group: "Finance & Security",
      options: ["Monthly", "Quarterly", "Bullet repayment", "Custom schedule"],
      description:
        "How often instalments fall due — monthly, quarterly, or a single bullet payment at the end.",
    },
    repayment_tenure_months: {
      label: "Repayment Tenure (months)",
      type: "number",
      required: false,
      group: "Finance & Security",
      description:
        "The total number of months over which the loan is repaid.",
    },
    instalment_amount: {
      label: "Instalment Amount (₹)",
      type: "number",
      required: false,
      group: "Finance & Security",
      description:
        "The amount of each instalment in rupees, including both principal and interest unless you state otherwise.",
    },
    repayment_start_date: {
      label: "Repayment Start Date",
      type: "date",
      required: true,
      description:
        "The date the first instalment falls due. This is often later than the disbursement date where a moratorium applies.",
    },
    security_collateral: {
      label: "Security / Collateral (or Unsecured)",
      type: "textarea",
      required: true,
      description:
        "What secures the loan — property, shares, a personal guarantee, or a charge over assets. Write \"Unsecured\" if there is no security, and the security clause will be left out.",
    },
    prepayment_terms: {
      label: "Prepayment Permitted? (Yes / No + conditions)",
      type: "text",
      required: true,
      description:
        "Whether the borrower may repay early, and on what terms. For example: \"permitted after 6 months on 30 days' notice, with no prepayment charge\".",
    },
    default_interest_rate: {
      label: "Default Interest Rate (% per annum)",
      type: "number",
      required: true,
      description:
        "The higher rate that applies to overdue amounts, as an annual percentage. Keep the uplift modest — a rate set to punish rather than compensate may not be enforceable under section 74 of the Indian Contract Act, 1872.",
    },
    events_of_default: {
      label: "Events of Default / Invocation Triggers",
      type: "textarea",
      required: false,
      group: "Finance & Security",
      description:
        "What counts as default and lets the lender demand immediate repayment — missed instalments, insolvency, breach of covenant, or a material adverse change.",
    },
  },

  // ─── Guarantee Agreement ──────────────────────────────────────────────────
  GUARANTEE_AGREEMENT: {
    party_1_name: {
      label: "Creditor / Lender Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Creditor Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_name: {
      label: "Principal Debtor Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Principal Debtor Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    guarantor_name: {
      label: "Guarantor Full Name",
      type: "text",
      required: true,
      description:
        "The guarantor's full legal name as it appears on their PAN, or the registered name if the guarantor is a company or LLP.",
    },
    guarantor_address: {
      label: "Guarantor Address",
      type: "textarea",
      required: true,
      description:
        "The guarantor's residential address, or registered office if the guarantor is an entity. Include city, state and PIN code.",
    },
    guarantor_type: {
      label: "Guarantor Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "Public Limited Company",
        "LLP",
        "Partnership Firm",
        "Trust",
      ],
      description:
        "Whether the guarantor is an individual or a body corporate. A company guaranteeing another's debt usually needs a board resolution under section 179 of the Companies Act, 2013.",
    },
    guarantor_pan: {
      label: "Guarantor PAN",
      type: "text",
      required: true,
      group: "Finance & Security",
      description: "Mandatory PAN for the guarantor. This prevents blank PAN placeholders in the final guarantee.",
      example: "ABCDE1234F",
    },
    guarantor_gstin: {
      label: "Guarantor GSTIN",
      type: "text",
      required: false,
      group: "Finance & Security",
      description: "Required when the guarantor is a company, LLP, partnership firm, or proprietorship.",
      example: "27ABCDE1234F1Z5",
    },
    guarantor_cin: {
      label: "Guarantor CIN",
      type: "text",
      required: false,
      group: "Finance & Security",
      description: "Required when the guarantor is a private limited or public limited company.",
      example: "U72900MH2020PTC123456",
    },
    guarantor_llpin: {
      label: "Guarantor LLPIN",
      type: "text",
      required: false,
      group: "Finance & Security",
      description: "Required when the guarantor is an LLP.",
      example: "AAA-1234",
    },
    guaranteed_amount: {
      label: "Guaranteed Amount (₹)",
      type: "number",
      required: true,
      description:
        "The maximum amount in rupees the guarantor is liable for. Leave it open only if the guarantee is genuinely unlimited.",
    },
    purpose: {
      label: "Underlying Obligation / Loan Description",
      type: "textarea",
      required: true,
      description:
        "Why the parties are entering this agreement, in one or two sentences. Be specific — a vague purpose weakens the contract, because the object of an agreement must be certain.",
    },
    guarantee_type: {
      label: "Guarantee Type",
      type: "select",
      required: true,
      options: [
        "Continuing Guarantee",
        "Limited Guarantee",
        "Performance Guarantee",
      ],
      description:
        "A continuing guarantee covers a running series of transactions; a limited guarantee covers a capped amount; a performance guarantee covers doing the work rather than paying the money.",
    },
    guarantee_period: {
      label: "Guarantee Period / Expiry (or Continuing)",
      type: "text",
      required: true,
      description:
        "How long the guarantee lasts, for example \"36 months\", or state that it continues until the underlying obligations are discharged.",
    },
    invocation_conditions: {
      label: "Invocation Conditions",
      type: "textarea",
      required: false,
      group: "Finance & Security",
      description:
        "What must happen before the lender can call on the guarantee — usually a default by the principal debtor and a demand that goes unmet.",
    },
    invocation_procedure: {
      label: "Invocation Procedure",
      type: "textarea",
      required: false,
      group: "Finance & Security",
      description:
        "How the lender makes a claim on the guarantee — the form of demand, where it is sent, and how long the guarantor has to pay.",
    },
  },

  // ─── Software Development Agreement ──────────────────────────────────────
  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    party_1_name: {
      label: "Client Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "Client Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_gstin: {
      label: "Client GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The first party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    party_2_name: {
      label: "Developer / Agency Full Name",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Developer Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_gstin: {
      label: "Developer GSTIN (optional)",
      type: "text",
      required: false,
    
      description:
        "The second party's 15-character GSTIN, for example 27AAACA1234A1Z5. Needed so invoices under this agreement are GST-compliant. Leave blank if the party is not registered.",},
    gst_applicable: {
      label: "GST Applicable?",
      type: "select",
      required: false,
      group: "Commercial & Tax",
      options: ["Yes", "No"],
      description:
        "Whether GST is chargeable on this supply. If yes, the invoice must carry the GSTIN, HSN or SAC code and the tax amount.",
    },
    project_description: {
      label: "Project Name / Description",
      type: "textarea",
      required: true,
      description:
        "What is being built, described specifically — the product, its main features, the platforms it runs on, and who will use it.",
    },
    services_description: {
      label: "Detailed Scope of Work",
      type: "textarea",
      required: true,
    
      description:
        "What the service provider will actually do, described specifically. \"Consulting services\" is too vague to enforce; name the activities, the standard expected and what is out of scope.",},
    tech_stack: {
      label: "Technology Stack (e.g. React, Node.js)",
      type: "text",
      required: false,
      description:
        "The technologies the work will be built with, for example \"React, Node.js, PostgreSQL, hosted on AWS\". This matters for maintainability and for handover.",
    },
    delivery_date: {
      label: "Project Delivery Date",
      type: "date",
      required: true,
      description:
        "The date by which delivery must be made. If there are several deliveries, use the milestone field to set them out.",
    },
    total_fee: { label: "Total Fee (₹)", type: "number", required: true, description: "The total fee for the project in rupees, excluding GST unless you state otherwise.",},
    payment_terms: {
      label: "Payment Milestones (e.g. 30% on start, 40% on UAT)",
      type: "textarea",
      required: true,
      description:
        "When and how payment is made. For example: \"monthly in arrears within 30 days of a valid tax invoice\" or \"50% advance, balance on delivery\". If the supplier is an MSME, the MSMED Act, 2006 requires payment within 45 days.",
    },
    milestone_plan: {
      label: "Milestones / Delivery Plan",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
      description:
        "The stages of delivery, what is handed over at each, when each is due, and how much is payable on each.",
    },
    acceptance_criteria: {
      label: "Acceptance Criteria / UAT Standards",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
      description:
        "How the client decides whether the work is done properly, and how long they have to say so. Without this, disputes about \"completion\" have nothing to test against.",
    },
    ip_ownership: {
      label: "IP Ownership",
      type: "select",
      required: true,
      options: ["Client owns all IP", "Developer retains IP", "Shared IP"],
      description:
        "Who owns what is created during the engagement. For employees and commissioned work the employer usually owns it; a contractor may retain ownership and grant a licence instead.",
    },
    warranty_period: {
      label: "Warranty Period after Delivery (e.g. 90 days)",
      type: "text",
      required: false,
    
      description:
        "How long the supplier stands behind the goods or work after delivery, for example \"12 months from acceptance\". This runs alongside the implied conditions in the Sale of Goods Act, 1930.",},
    escrow_required: {
      label: "Source Code Escrow Required?",
      type: "select",
      required: false,
      options: ["Yes", "No"],
      description:
        "Whether the source code is deposited with a third party, to be released to the client if the developer becomes insolvent or stops supporting the software.",
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
      description:
        "Whether the client receives the source code, and when — on final payment, at each milestone, or not at all if only a licence to the compiled software is granted.",
    },
    change_request_process: {
      label: "Change Request Process",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
      description:
        "How changes to scope are agreed and priced once work has started, and who on each side can approve them.",
    },
    support_maintenance: {
      label: "Support / Maintenance Obligations",
      type: "textarea",
      required: false,
      group: "Technology Delivery",
      description:
        "What ongoing support is included after delivery — hours of cover, response times, bug fixes, updates — and for how long.",
    },
  },

  MOU: {
    party_1_name: {
      label: "First Party Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_1_address: {
      label: "First Party Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_1_type: {
      label: "First Party Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Government Body",
        "Trust",
      ],
      description:
        "The legal form of the first party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    party_2_name: {
      label: "Second Party Full Name / Company",
      type: "text",
      required: true,
      description:
        "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    party_2_address: {
      label: "Second Party Address",
      type: "textarea",
      required: true,
      description:
        "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",
    },
    party_2_type: {
      label: "Second Party Type",
      type: "select",
      required: true,
      options: [
        "Individual",
        "Private Limited Company",
        "LLP",
        "Partnership Firm",
        "Government Body",
        "Trust",
      ],
      description:
        "The legal form of the second party. This decides how the party is described in the deed, which registration numbers are recited, and the correct successor wording.",
    },
    mou_purpose: {
      label: "Purpose / Objective of MOU",
      type: "textarea",
      required: true,
      description:
        "What the parties are recording their intentions about, in one or two specific sentences.",
    },
    mou_scope: {
      label: "Scope of Collaboration",
      type: "textarea",
      required: true,
      description:
        "What each side will actually contribute or do under the collaboration, and what is expressly outside it.",
    },
    mou_duration: {
      label: "Duration of MOU (e.g. 12 months)",
      type: "text",
      required: true,
      description:
        "How long the understanding stands, for example \"12 months\" or \"until a definitive agreement is signed\".",
    },
    binding_nature: {
      label: "Binding Nature of MOU",
      type: "select",
      required: true,
      group: "MOU Positioning",
      options: ["Non-binding", "Binding", "Partly binding"],
      description:
        "Whether the MOU creates enforceable obligations. Non-binding is usual for a statement of intent, but confidentiality and exclusivity are often made binding even in a non-binding MOU.",
    },
    governing_law_state: {
      label: "Governing Law State",
      type: "select",
      required: true,
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
      description:
        "The state whose law governs the contract, if different from the operating state. Leave blank to use the operating state.",
    },
  },

  RENTAL_AGREEMENT: {
    party_1_name: { label: "Owner Name", type: "text", required: true, description: "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",},
    party_1_address: { label: "Owner Address", type: "textarea", required: true, description: "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",},
    party_2_name: { label: "Tenant Name", type: "text", required: true, description: "The full legal name of the second party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",},
    party_2_address: { label: "Tenant Address", type: "textarea", required: true, description: "The registered office address for a company or LLP, or the residential address for an individual. Include the city, state and PIN code.",},
    property_address: {
      label: "Property Address",
      type: "textarea",
      required: true,
      example: "Flat 4B, Sunshine Apartments, MG Road, Pune, Maharashtra 411001",
      description:
        "The full legal name of the first party, exactly as it appears on its incorporation certificate, PAN or Aadhaar. Do not use a trading name or abbreviation.",
    },
    permitted_use: {
      label: "Permitted Use",
      type: "text",
      required: true,
      example: "Residential use by the tenant and immediate family",
      description:
        "The only purpose for which the receiving party may use the confidential information. For example: \"solely to evaluate a possible acquisition of the disclosing party\".",
    },
    occupancy_fee: {
      label: "Monthly Rent (INR)",
      type: "number",
      required: true,
      example: "25000",
      description:
        "The monthly amount payable for occupying the premises, in rupees.",
    },
    security_deposit: {
      label: "Security Deposit (INR)",
      type: "number",
      required: true,
      example: "100000",
      description:
        "The refundable deposit in rupees, and note that some state rent laws cap this — the Model Tenancy Act, 2021 suggests two months for residential premises.",
    },
    occupancy_term: {
      label: "Term of Occupancy",
      type: "text",
      required: true,
      example: "11 months",
      description:
        "How long the occupancy runs, for example \"11 months\". A term of 12 months or more makes the agreement compulsorily registrable.",
    },
  },

  PRIVACY_POLICY: {
    company_name: { label: "Company / Business Name", type: "text", required: true, description: "The company's full registered name, exactly as on the certificate of incorporation.",},
    company_address: {
      label: "Registered Address",
      type: "textarea",
      required: true,
      description:
        "The company's full registered name, exactly as on the certificate of incorporation.",
    },
    website_url: {
      label: "Website / App",
      type: "text",
      required: true,
      example: "https://www.example.in",
      description:
        "The address of the website or app these terms apply to, for example https://example.com.",
    },
    data_categories: {
      label: "Personal Data Collected",
      type: "textarea",
      required: true,
      example: "Name, email, phone number, shipping address, payment details",
      description:
        "What personal data you collect, listed by category — for example name, email, phone number, payment details, location, device identifiers, usage logs.",
    },
    processing_purpose: {
      label: "Why the Data Is Used",
      type: "textarea",
      required: true,
      example: "Order fulfilment, customer support, and service improvement",
      description:
        "Why you collect each category of data and what you do with it. Under the Digital Personal Data Protection Act, 2023 the purpose must be specific, and consent must be sought for it.",
    },
    grievance_officer: {
      label: "Grievance Officer Name",
      type: "text",
      required: true,
      description:
        "The name of the person handling user complaints about data. The IT Rules, 2021 and the DPDP Act, 2023 require this person to be identified in the policy.",
    },
    grievance_officer_email: {
      label: "Grievance Officer Email",
      type: "text",
      required: true,
      example: "grievance@example.in",
      description:
        "The email address users write to with data complaints. It must be monitored — the IT Rules, 2021 set deadlines for acknowledging and resolving complaints.",
    },
  },

  TERMS_OF_SERVICE: {
    company_name: { label: "Company / Business Name", type: "text", required: true, description: "The company's full registered name, exactly as on the certificate of incorporation.",},
    company_address: {
      label: "Registered Address",
      type: "textarea",
      required: true,
      description:
        "The company's full registered name, exactly as on the certificate of incorporation.",
    },
    service_name: {
      label: "Service / Product Name",
      type: "text",
      required: true,
      example: "Bloom Basket, the online grocery marketplace",
      description:
        "The name of the service or product these terms cover, as users see it. This is the product name, not the name of the company behind it.",
    },
    website_url: {
      label: "Website / App URL",
      type: "text",
      required: true,
      example: "https://www.example.in",
      description:
        "The address of the website or app these terms apply to, for example https://example.com.",
    },
    service_description: {
      label: "What the Service Does",
      type: "textarea",
      required: true,
      description: "Describe what users can do with the service. This anchors the acceptance and scope clauses.",
      example: "browse and order groceries for home delivery, manage orders, and rate products",
    },
    grievance_officer: {
      label: "Grievance Officer Name",
      type: "text",
      required: true,
      description:
        "The name of the person handling user complaints about data. The IT Rules, 2021 and the DPDP Act, 2023 require this person to be identified in the policy.",
    },
    grievance_officer_email: {
      label: "Grievance Officer Email",
      type: "text",
      required: true,
      example: "grievance@example.in",
      description:
        "The email address users write to with data complaints. It must be monitored — the IT Rules, 2021 set deadlines for acknowledging and resolving complaints.",
    },
  },
};

// Vendor procurement mirrors the supply intake — the vendor blueprint reuses the
// SUPPLY_* clause set, so the same field names fill the same placeholders.
VARIABLE_CONFIG.VENDOR_AGREEMENT = { ...VARIABLE_CONFIG.SUPPLY_AGREEMENT };

// The MSA reuses the SERVICE_* clause set (payment, termination, SLA), so the
// service intake fields fill the same placeholders. Framework-specific tweaks:
// scope describes the kinds of services SOWs will cover, and the fee fields
// describe default commercial terms that individual SOWs may override.
VARIABLE_CONFIG.MASTER_SERVICE_AGREEMENT = {
  ...VARIABLE_CONFIG.SERVICE_AGREEMENT,
  services_description: {
    ...VARIABLE_CONFIG.SERVICE_AGREEMENT.services_description,
    label: "Types of Services Covered",
    description:
      "Describe the categories of services the master agreement will cover. Specific engagements are detailed in individual Statements of Work.",
    example:
      "IT consulting, software development, system integration, and managed support services, as detailed in individual SOWs.",
  },
  contract_value: {
    ...VARIABLE_CONFIG.SERVICE_AGREEMENT.contract_value,
    label: "Estimated Contract Value (₹)",
    description:
      "Enter the estimated or committed aggregate value across SOWs as a number only. Individual SOWs state their own fees.",
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
