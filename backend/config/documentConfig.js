/**
 * documentConfig.js
 *
 * Defines document structure: required fields, signature type, and
 * the sectioned form layout (which variables appear in which section).
 *
 * Variable definitions (labels, types, options) live in variableConfig.js.
 */

export const DOCUMENT_CONFIG = {
  NDA: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
        "purpose",
        "effective_date",
        "confidentiality_period",
        "agreement_term",
      ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Disclosing Party",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Receiving Party",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Agreement Terms",
          fields: [
            "purpose",
            "confidentiality_period",
            "agreement_term",
            "non_compete_period",
            "effective_date",
        ],
      },
    ],
  },

  EMPLOYMENT_CONTRACT: {
    requiredFields: [
      "operating_state",
      "employer_name",
      "employer_address",
      "employer_cin",
      "employer_pan",
      "employer_gstin",
      "employee_name",
      "employee_address",
      "employee_pan",
      "job_title",
      "work_location",
      "salary",
      "effective_date",
      "start_date",
      "notice_period_days",
      "employee_confidentiality_scope",
      "ip_ownership",
      "employment_termination_type",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Employer Details",
        fields: ["employer_name", "employer_address", "employer_cin", "employer_pan", "employer_gstin"],
      },
      {
        title: "Employee Details",
        fields: ["employee_name", "employee_address", "employee_pan"],
      },
      {
        title: "Role & Compensation",
        fields: [
          "job_title",
          "department",
          "work_location",
          "salary",
          "salary_components",
        ],
      },
      {
        title: "Terms of Employment",
        fields: [
          "effective_date",
          "start_date",
          "probation_period",
          "working_hours",
          "notice_period_days",
          "employee_confidentiality_scope",
          "ip_ownership",
          "employment_termination_type",
        ],
      },
    ],
  },

  SERVICE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "services_description",
      "deliverables",
      "contract_value",
      "payment_terms",
      "contract_duration",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Client",
        fields: ["party_1_name", "party_1_address", "party_1_type", "party_1_gstin"],
      },
      {
        title: "Service Provider",
        fields: ["party_2_name", "party_2_address", "party_2_type", "party_2_gstin"],
      },
      {
        title: "Scope & Payment",
        fields: [
          "services_description",
          "deliverables",
          "acceptance_criteria",
          "contract_value",
          "payment_terms",
          "service_levels",
          "expenses_policy",
        ],
      },
      {
        title: "Duration & Jurisdiction",
        fields: ["contract_duration", "effective_date"],
      },
    ],
  },

  CONSULTANCY_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "consulting_services",
      "deliverables",
      "consulting_fee",
      "payment_terms",
      "contract_duration",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Client",
        fields: ["party_1_name", "party_1_address", "party_1_type", "party_1_gstin"],
      },
      {
        title: "Consultant",
        fields: ["party_2_name", "party_2_address", "party_2_type", "party_2_gstin"],
      },
      {
        title: "Engagement Terms",
        fields: [
          "consulting_services",
          "deliverables",
          "acceptance_criteria",
          "consulting_fee",
          "payment_terms",
          "expenses_policy",
          "non_compete_period",
          "contract_duration",
          "effective_date",
        ],
      },
    ],
  },

  PARTNERSHIP_DEED: {
    requiredFields: [
      "operating_state",
      "partnership_name",
      "business_address",
      "partner_1_name",
      "partner_1_address",
      "partner_2_name",
      "partner_2_address",
      "capital_contribution_1",
      "capital_contribution_2",
      "profit_sharing_ratio",
      "business_purpose",
      "effective_date",
    ],
    signatureType: "PARTNERSHIP",
    sections: [
      {
        title: "Firm Details",
        fields: ["partnership_name", "business_address", "business_purpose"],
      },
      {
        title: "Partner 1",
        fields: [
          "partner_1_name",
          "partner_1_address",
          "capital_contribution_1",
        ],
      },
      {
        title: "Partner 2",
        fields: [
          "partner_2_name",
          "partner_2_address",
          "capital_contribution_2",
        ],
      },
      {
        title: "Financial Terms",
        fields: [
          "profit_sharing_ratio",
          "drawing_limit",
          "bank_name",
          "effective_date",
        ],
      },
      {
        title: "Governance & Control",
        fields: [
          "partner_roles",
          "decision_making_rules",
          "partner_dispute_resolution",
          "admission_removal_terms",
          "partner_exit_mechanism",
          "dissolution_terms",
        ],
      },
    ],
  },

  SHAREHOLDERS_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "company_name",
      "company_cin",
      "company_address",
      "shareholder_1_name",
      "shareholder_1_address",
      "shareholder_1_type",
      "shareholding_percentage_1",
      "shareholder_2_name",
      "shareholder_2_address",
      "shareholder_2_type",
      "shareholding_percentage_2",
      "board_structure",
      "reserved_matters",
      "effective_date",
    ],
    signatureType: "SHAREHOLDERS",
    sections: [
      {
        title: "Company Details",
        fields: ["company_name", "company_cin", "company_address"],
      },
      {
        title: "Shareholder 1",
        fields: [
          "shareholder_1_name",
          "shareholder_1_address",
          "shareholder_1_type",
          "shareholding_percentage_1",
        ],
      },
      {
        title: "Shareholder 2",
        fields: [
          "shareholder_2_name",
          "shareholder_2_address",
          "shareholder_2_type",
          "shareholding_percentage_2",
        ],
      },
      {
        title: "Governance & Protections",
        fields: [
          "board_structure",
          "reserved_matters",
          "rofr_period",
          "drag_threshold",
          "voting_rights",
          "dividend_policy",
          "tag_along_rights",
          "exit_rights",
          "effective_date",
        ],
      },
    ],
  },

  JOINT_VENTURE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "jv_name",
      "jv_purpose",
      "capital_contribution_1",
      "capital_contribution_2",
      "profit_sharing_ratio",
      "jv_duration",
      "jv_structure",
      "ip_ownership",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Party 1",
        fields: [
          "party_1_name",
          "party_1_address",
          "party_1_type",
          "capital_contribution_1",
        ],
      },
      {
        title: "Party 2",
        fields: [
          "party_2_name",
          "party_2_address",
          "party_2_type",
          "capital_contribution_2",
        ],
      },
      {
        title: "Joint Venture Terms",
        fields: [
          "jv_name",
          "jv_purpose",
          "profit_sharing_ratio",
          "jv_duration",
          "jv_structure",
          "ip_ownership",
          "management_control",
          "deadlock_resolution",
          "exit_terms",
          "effective_date",
        ],
      },
    ],
  },

  SUPPLY_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_1_gstin",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "party_2_gstin",
      "goods_description",
      "price",
      "payment_terms",
      "delivery_terms",
      "delivery_location",
      "contract_duration",
      "warranty_period",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Supplier",
        fields: [
          "party_1_name",
          "party_1_address",
          "party_1_type",
          "party_1_gstin",
        ],
      },
      {
        title: "Buyer",
        fields: [
          "party_2_name",
          "party_2_address",
          "party_2_type",
          "party_2_gstin",
        ],
      },
      {
        title: "Goods & Commercial Terms",
        fields: [
          "goods_description",
          "price",
          "payment_terms",
          "delivery_terms",
          "delivery_location",
          "inspection_acceptance_terms",
          "inspection_timeline_days",
          "risk_transfer_stage",
          "risk_transfer_terms",
          "warranty_period",
          "contract_duration",
          "effective_date",
        ],
      },
    ],
  },

  DISTRIBUTION_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "product_description",
      "territory",
      "exclusivity",
      "min_purchase",
      "price_terms",
      "payment_terms",
      "contract_duration",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Manufacturer / Principal",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Distributor",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Distribution Terms",
        fields: [
          "product_description",
          "territory",
          "exclusivity",
          "min_purchase",
          "minimum_purchase_quantity",
          "minimum_purchase_unit",
          "price_terms",
          "pricing_model",
          "payment_terms",
          "branding_rights",
          "underperformance_termination",
          "contract_duration",
          "effective_date",
        ],
      },
    ],
  },

  SALES_OF_GOODS_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_1_gstin",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "party_2_gstin",
      "goods_description",
      "quantity",
      "price",
      "gst_rate",
      "payment_terms",
      "delivery_date",
      "delivery_location",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Seller",
        fields: [
          "party_1_name",
          "party_1_address",
          "party_1_type",
          "party_1_gstin",
        ],
      },
      {
        title: "Buyer",
        fields: [
          "party_2_name",
          "party_2_address",
          "party_2_type",
          "party_2_gstin",
        ],
      },
      {
        title: "Transaction Details",
        fields: [
          "goods_description",
          "quantity",
          "price",
          "gst_rate",
          "payment_terms",
          "delivery_date",
          "delivery_location",
          "inspection_acceptance_terms",
          "inspection_timeline_days",
          "risk_transfer_stage",
          "title_transfer_terms",
          "effective_date",
        ],
      },
    ],
  },

  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "services_description",
      "deliverables",
      "contract_value",
      "payment_terms",
      "ip_ownership",
      "contract_duration",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Client",
        fields: ["party_1_name", "party_1_address", "party_1_type", "party_1_gstin"],
      },
      {
        title: "Contractor",
        fields: ["party_2_name", "party_2_address", "party_2_type", "party_2_gstin"],
      },
      {
        title: "Engagement Terms",
        fields: [
          "services_description",
          "deliverables",
          "acceptance_criteria",
          "contract_value",
          "payment_terms",
          "expenses_policy",
          "ip_ownership",
          "non_compete_period",
          "contract_duration",
          "effective_date",
        ],
      },
    ],
  },

  COMMERCIAL_LEASE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "property_address",
      "property_description",
      "permitted_use",
      "rent_amount",
      "security_deposit",
      "lease_term",
      "maintenance_party",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Landlord",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Tenant",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Property Details",
        fields: ["property_address", "property_description", "permitted_use"],
      },
      {
        title: "Financial Terms",
        fields: [
          "rent_amount",
          "security_deposit",
          "rent_escalation",
          "lease_term",
          "lock_in_period",
          "maintenance_party",
          "effective_date",
        ],
      },
    ],
  },

  LEAVE_AND_LICENSE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "property_address",
      "property_description",
      "permitted_use",
      "license_fee",
      "security_deposit",
      "license_term",
      "maintenance_party",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Licensor",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Licensee",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Property Details",
        fields: ["property_address", "property_description", "permitted_use"],
      },
      {
        title: "Financial Terms",
        fields: [
          "license_fee",
          "security_deposit",
          "rent_escalation",
          "license_term",
          "lock_in_period",
          "maintenance_party",
          "effective_date",
        ],
      },
    ],
  },

  LOAN_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "loan_amount",
      "purpose",
      "interest_rate",
      "repayment_schedule",
      "repayment_start_date",
      "security_collateral",
      "prepayment_terms",
      "default_interest_rate",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Lender",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Borrower",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Loan Terms",
        fields: [
          "loan_amount",
          "purpose",
          "interest_rate",
          "repayment_schedule",
          "repayment_frequency",
          "repayment_tenure_months",
          "instalment_amount",
          "repayment_start_date",
          "security_collateral",
          "prepayment_terms",
          "default_interest_rate",
          "events_of_default",
          "effective_date",
        ],
      },
    ],
  },

  GUARANTEE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "guarantor_name",
      "guarantor_address",
      "guarantor_type",
      "guarantor_pan",
      "guaranteed_amount",
      "purpose",
      "guarantee_type",
      "guarantee_period",
      "effective_date",
    ],
    signatureType: "GUARANTEE",
    sections: [
      {
        title: "Creditor / Lender",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Principal Debtor",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Guarantor",
        fields: ["guarantor_name", "guarantor_address", "guarantor_type", "guarantor_pan", "guarantor_gstin", "guarantor_cin", "guarantor_llpin"],
      },
      {
        title: "Guarantee Terms",
        fields: [
          "guaranteed_amount",
          "purpose",
          "guarantee_type",
          "guarantee_period",
          "invocation_conditions",
          "invocation_procedure",
          "effective_date",
        ],
      },
    ],
  },

  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "project_description",
      "services_description",
      "total_fee",
      "delivery_date",
      "payment_terms",
      "ip_ownership",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Client",
        fields: ["party_1_name", "party_1_address", "party_1_type", "party_1_gstin"],
      },
      {
        title: "Developer / Agency",
        fields: ["party_2_name", "party_2_address", "party_2_type", "party_2_gstin"],
      },
      {
        title: "Project Details",
        fields: [
          "project_description",
          "services_description",
          "tech_stack",
          "delivery_date",
          "milestone_plan",
          "acceptance_criteria",
          "change_request_process",
        ],
      },
      {
        title: "Commercial Terms",
        fields: [
          "total_fee",
          "payment_terms",
          "ip_ownership",
          "warranty_period",
          "escrow_required",
          "source_code_delivery",
          "support_maintenance",
          "effective_date",
        ],
      },
    ],
  },

  MOU: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "mou_purpose",
      "mou_scope",
      "mou_duration",
      "binding_nature",
      "effective_date",
      "governing_law_state",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "First Party",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Second Party",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "MOU Details",
        fields: [
          "mou_purpose",
          "mou_scope",
          "mou_duration",
          "binding_nature",
          "effective_date",
          "governing_law_state",
        ],
      },
    ],
  },

  RENTAL_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "property_address",
      "permitted_use",
      "occupancy_fee",
      "security_deposit",
      "occupancy_term",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      // Section titles double as the canonical party labels the quality
      // controls enforce — the rental clause texts speak of Landlord/Tenant.
      {
        title: "Landlord",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Tenant",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Property & Terms",
        fields: [
          "property_address",
          "permitted_use",
          "occupancy_fee",
          "security_deposit",
          "occupancy_term",
          "effective_date",
        ],
      },
    ],
  },

  VENDOR_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_type",
      "party_2_name",
      "party_2_type",
      "goods_description",
      "price",
      "payment_terms",
      "delivery_terms",
      "delivery_location",
      "contract_duration",
      "warranty_period",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      // Party 1 = the vendor/supplier: the SUPPLY_* clause texts this type
      // reuses are written with the supplier as the first party.
      {
        title: "Supplier",
        fields: ["party_1_name", "party_1_address", "party_1_type"],
      },
      {
        title: "Buyer",
        fields: ["party_2_name", "party_2_address", "party_2_type"],
      },
      {
        title: "Procurement Terms",
        fields: [
          "goods_description",
          "price",
          "payment_terms",
          "delivery_terms",
          "delivery_location",
          "contract_duration",
          "warranty_period",
          "effective_date",
        ],
      },
    ],
  },

  MASTER_SERVICE_AGREEMENT: {
    requiredFields: [
      "operating_state",
      "party_1_name",
      "party_1_type",
      "party_2_name",
      "party_2_type",
      "services_description",
      "contract_value",
      "payment_terms",
      "contract_duration",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Client",
        fields: ["party_1_name", "party_1_address", "party_1_type", "party_1_gstin"],
      },
      {
        title: "Service Provider",
        fields: ["party_2_name", "party_2_address", "party_2_type", "party_2_gstin"],
      },
      {
        title: "Framework Terms",
        fields: [
          "services_description",
          "contract_value",
          "payment_terms",
          "service_levels",
          "contract_duration",
          "effective_date",
        ],
      },
    ],
  },

  TERMS_OF_SERVICE: {
    requiredFields: [
      "operating_state",
      "company_name",
      "company_address",
      "service_name",
      "website_url",
      "service_description",
      "grievance_officer",
      "grievance_officer_email",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Business",
        fields: ["company_name", "company_address", "service_name", "website_url"],
      },
      {
        title: "The Service",
        fields: ["service_description"],
      },
      {
        title: "Compliance",
        fields: [
          "grievance_officer",
          "grievance_officer_email",
          "effective_date",
        ],
      },
    ],
  },

  PRIVACY_POLICY: {
    requiredFields: [
      "operating_state",
      "company_name",
      "company_address",
      "website_url",
      "data_categories",
      "processing_purpose",
      "grievance_officer",
      "grievance_officer_email",
      "effective_date",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Business",
        fields: ["company_name", "company_address", "website_url"],
      },
      {
        title: "Data Practices",
        fields: ["data_categories", "processing_purpose"],
      },
      {
        title: "Compliance",
        fields: [
          "grievance_officer",
          "grievance_officer_email",
          "effective_date",
        ],
      },
    ],
  },
};

// ── Deferred identity fields ──────────────────────────────────────────────────
// Addresses and statutory identifiers (PAN/CIN/GSTIN/LLPIN) are NOT needed to
// produce a valid first draft: party descriptors omit them gracefully when
// absent ("Acme, a Private Limited Company"), and users complete them in the
// editor. Requiring them up-front was the single biggest cause of form fatigue
// (Employment demanded 19 fields incl. 4 tax IDs). They stay on the form as
// OPTIONAL fields — this filter only removes them from the generation gate.
// Exception: property_address is the SUBJECT MATTER of lease/license documents.
const DEFERRED_IDENTITY_PATTERN = /(_address|_pan|_cin|_gstin|_llpin)$/;
const DEFERRED_EXCEPTIONS = new Set(["property_address"]);

for (const config of Object.values(DOCUMENT_CONFIG)) {
  config.requiredFields = (config.requiredFields || []).filter(
    (field) =>
      !DEFERRED_IDENTITY_PATTERN.test(field) || DEFERRED_EXCEPTIONS.has(field)
  );
}
