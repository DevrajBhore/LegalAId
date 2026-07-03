/**
 * essentialFields.js
 *
 * Quick-mode "essentials" — the minimal field set a user must provide to get a
 * usable first draft. Detailed mode keeps using DOCUMENT_CONFIG.requiredFields;
 * quick mode requires only the curated subset below, leaving everything else
 * optional so the user can refine in the editor afterwards.
 *
 * IMPORTANT: this only relaxes the PRE-generation input validation. The full
 * pipeline, post-generation validation, and the strict export gate are
 * unchanged — a quick draft still cannot be EXPORTED until it is complete and
 * certified. Speed-first never means ship-broken.
 *
 * Each list is a subset of that type's requiredFields: parties/identity, the
 * single most-core subject field, the headline commercial term, and the
 * effective date. Secondary commercial terms, durations, statutory identifiers,
 * and optional protections are deferred to detailed mode / the editor.
 */

export const ESSENTIAL_FIELDS = {
  NDA: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "purpose", "effective_date",
  ],
  EMPLOYMENT_CONTRACT: [
    "operating_state",
    "employer_name", "employee_name",
    "job_title", "salary",
    "effective_date", "start_date",
  ],
  SERVICE_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "services_description", "contract_value", "effective_date",
  ],
  CONSULTANCY_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "consulting_services", "consulting_fee", "effective_date",
  ],
  PARTNERSHIP_DEED: [
    "operating_state",
    "partnership_name",
    "partner_1_name", "partner_2_name",
    "business_purpose", "profit_sharing_ratio", "effective_date",
  ],
  SHAREHOLDERS_AGREEMENT: [
    "operating_state",
    "company_name",
    "shareholder_1_name", "shareholder_1_type", "shareholding_percentage_1",
    "shareholder_2_name", "shareholder_2_type", "shareholding_percentage_2",
    "effective_date",
  ],
  JOINT_VENTURE_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "jv_name", "jv_purpose", "effective_date",
  ],
  SUPPLY_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "goods_description", "price", "effective_date",
  ],
  DISTRIBUTION_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "product_description", "territory", "effective_date",
  ],
  SALES_OF_GOODS_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "goods_description", "price", "effective_date",
  ],
  INDEPENDENT_CONTRACTOR_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "services_description", "contract_value", "effective_date",
  ],
  COMMERCIAL_LEASE_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "property_address", "rent_amount", "lease_term", "effective_date",
  ],
  LEAVE_AND_LICENSE_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "property_address", "license_fee", "license_term", "effective_date",
  ],
  LOAN_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "loan_amount", "interest_rate", "purpose", "effective_date",
  ],
  GUARANTEE_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "guarantor_name", "guarantor_type", "guaranteed_amount", "effective_date",
  ],
  SOFTWARE_DEVELOPMENT_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "project_description", "total_fee", "effective_date",
  ],
  MOU: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "mou_purpose", "effective_date",
  ],
  RENTAL_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "property_address", "occupancy_fee", "occupancy_term", "effective_date",
  ],
  VENDOR_AGREEMENT: [
    "operating_state",
    "party_1_name", "party_1_type",
    "party_2_name", "party_2_type",
    "goods_description", "price", "effective_date",
  ],
  PRIVACY_POLICY: [
    "operating_state",
    "company_name", "company_address", "website_url",
    "data_categories", "processing_purpose",
    // Grievance officer details are statutorily required (IT Rules 2011 /
    // DPDP Act), so even quick mode must collect them.
    "grievance_officer", "grievance_officer_email",
    "effective_date",
  ],
};

/**
 * Returns the required-field set for the given generation mode.
 * - detailed (default): the full requiredFields list (unchanged behaviour).
 * - quick: the curated essentials, falling back to requiredFields if a type has
 *   no curated list (so an unknown type is never silently under-validated).
 */
export function getRequiredFieldsForMode(documentType, requiredFields = [], mode = "detailed") {
  if (String(mode).toLowerCase() !== "quick") return requiredFields;
  const essentials = ESSENTIAL_FIELDS[documentType];
  return Array.isArray(essentials) && essentials.length ? essentials : requiredFields;
}
