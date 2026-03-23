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
      "party_1_name",
      "party_1_address",
      "party_1_type",
      "party_2_name",
      "party_2_address",
      "party_2_type",
      "purpose",
      "effective_date",
      "confidentiality_period",
      "arbitration_city",
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
          "non_compete_period",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  EMPLOYMENT_CONTRACT: {
    requiredFields: [
      "employer_name",
      "employer_address",
      "employer_cin",
      "employee_name",
      "employee_address",
      "job_title",
      "work_location",
      "salary",
      "start_date",
      "notice_period_days",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Employer Details",
        fields: ["employer_name", "employer_address", "employer_cin"],
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
          "start_date",
          "probation_period",
          "working_hours",
          "notice_period_days",
          "arbitration_city",
        ],
      },
    ],
  },

  SERVICE_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "services_description",
      "contract_value",
      "payment_terms",
      "contract_duration",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Client", fields: ["party_1_name", "party_1_address"] },
      {
        title: "Service Provider",
        fields: ["party_2_name", "party_2_address"],
      },
      {
        title: "Scope & Payment",
        fields: [
          "services_description",
          "deliverables",
          "contract_value",
          "payment_terms",
          "service_levels",
        ],
      },
      {
        title: "Duration & Jurisdiction",
        fields: ["contract_duration", "effective_date", "arbitration_city"],
      },
    ],
  },

  CONSULTANCY_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "consulting_services",
      "consulting_fee",
      "contract_duration",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Client", fields: ["party_1_name", "party_1_address"] },
      { title: "Consultant", fields: ["party_2_name", "party_2_address"] },
      {
        title: "Engagement Terms",
        fields: [
          "consulting_services",
          "deliverables",
          "consulting_fee",
          "payment_terms",
          "expenses_policy",
          "non_compete_period",
          "contract_duration",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  PARTNERSHIP_DEED: {
    requiredFields: [
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
      "arbitration_city",
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
          "arbitration_city",
        ],
      },
    ],
  },

  SHAREHOLDERS_AGREEMENT: {
    requiredFields: [
      "company_name",
      "company_cin",
      "company_address",
      "shareholder_1_name",
      "shareholder_1_address",
      "shareholding_percentage_1",
      "shareholder_2_name",
      "shareholder_2_address",
      "shareholding_percentage_2",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
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
          "shareholding_percentage_1",
        ],
      },
      {
        title: "Shareholder 2",
        fields: [
          "shareholder_2_name",
          "shareholder_2_address",
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
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  JOINT_VENTURE_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "jv_name",
      "jv_purpose",
      "capital_contribution_1",
      "capital_contribution_2",
      "profit_sharing_ratio",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Party 1",
        fields: ["party_1_name", "party_1_address", "capital_contribution_1"],
      },
      {
        title: "Party 2",
        fields: ["party_2_name", "party_2_address", "capital_contribution_2"],
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
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  SUPPLY_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_1_gstin",
      "party_2_name",
      "party_2_address",
      "party_2_gstin",
      "goods_description",
      "price",
      "payment_terms",
      "delivery_terms",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Supplier",
        fields: ["party_1_name", "party_1_address", "party_1_gstin"],
      },
      {
        title: "Buyer",
        fields: ["party_2_name", "party_2_address", "party_2_gstin"],
      },
      {
        title: "Goods & Commercial Terms",
        fields: [
          "goods_description",
          "price",
          "payment_terms",
          "delivery_terms",
          "delivery_location",
          "warranty_period",
          "contract_duration",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  DISTRIBUTION_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "product_description",
      "territory",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Manufacturer / Principal",
        fields: ["party_1_name", "party_1_address"],
      },
      { title: "Distributor", fields: ["party_2_name", "party_2_address"] },
      {
        title: "Distribution Terms",
        fields: [
          "product_description",
          "territory",
          "exclusivity",
          "min_purchase",
          "price_terms",
          "payment_terms",
          "contract_duration",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  SALES_OF_GOODS_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_1_gstin",
      "party_2_name",
      "party_2_address",
      "party_2_gstin",
      "goods_description",
      "price",
      "delivery_date",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Seller",
        fields: ["party_1_name", "party_1_address", "party_1_gstin"],
      },
      {
        title: "Buyer",
        fields: ["party_2_name", "party_2_address", "party_2_gstin"],
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
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "services_description",
      "contract_value",
      "payment_terms",
      "contract_duration",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Client", fields: ["party_1_name", "party_1_address"] },
      { title: "Contractor", fields: ["party_2_name", "party_2_address"] },
      {
        title: "Engagement Terms",
        fields: [
          "services_description",
          "deliverables",
          "contract_value",
          "payment_terms",
          "ip_ownership",
          "non_compete_period",
          "contract_duration",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  COMMERCIAL_LEASE_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "property_address",
      "property_description",
      "rent_amount",
      "security_deposit",
      "lease_term",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Landlord", fields: ["party_1_name", "party_1_address"] },
      { title: "Tenant", fields: ["party_2_name", "party_2_address"] },
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
          "arbitration_city",
        ],
      },
    ],
  },

  LEAVE_AND_LICENSE_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "property_address",
      "license_fee",
      "security_deposit",
      "license_term",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Licensor", fields: ["party_1_name", "party_1_address"] },
      { title: "Licensee", fields: ["party_2_name", "party_2_address"] },
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
          "arbitration_city",
        ],
      },
    ],
  },

  LOAN_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "loan_amount",
      "interest_rate",
      "repayment_schedule",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Lender", fields: ["party_1_name", "party_1_address"] },
      { title: "Borrower", fields: ["party_2_name", "party_2_address"] },
      {
        title: "Loan Terms",
        fields: [
          "loan_amount",
          "purpose",
          "interest_rate",
          "repayment_schedule",
          "repayment_start_date",
          "security_collateral",
          "prepayment_terms",
          "default_interest_rate",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  GUARANTEE_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "guarantor_name",
      "guarantor_address",
      "guaranteed_amount",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      {
        title: "Creditor / Lender",
        fields: ["party_1_name", "party_1_address"],
      },
      {
        title: "Principal Debtor",
        fields: ["party_2_name", "party_2_address"],
      },
      { title: "Guarantor", fields: ["guarantor_name", "guarantor_address"] },
      {
        title: "Guarantee Terms",
        fields: [
          "guaranteed_amount",
          "purpose",
          "guarantee_type",
          "guarantee_period",
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },

  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    requiredFields: [
      "party_1_name",
      "party_1_address",
      "party_2_name",
      "party_2_address",
      "project_description",
      "total_fee",
      "effective_date",
      "arbitration_city",
    ],
    signatureType: "BILATERAL",
    sections: [
      { title: "Client", fields: ["party_1_name", "party_1_address"] },
      {
        title: "Developer / Agency",
        fields: ["party_2_name", "party_2_address"],
      },
      {
        title: "Project Details",
        fields: [
          "project_description",
          "services_description",
          "tech_stack",
          "delivery_date",
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
          "effective_date",
          "arbitration_city",
        ],
      },
    ],
  },
};
