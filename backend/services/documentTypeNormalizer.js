/**
 * documentTypeNormalizer.js
 *
 * Bridges the gap between documentConfig.js naming conventions
 * and the IRE / KB naming conventions.
 *
 * documentConfig uses:  EMPLOYMENT_CONTRACT
 * IRE/KB uses:          EMPLOYMENT_AGREEMENT
 *
 * This is the single source of truth for all name mappings.
 */

// Maps documentConfig doc types → IRE doc types
const DOC_TYPE_TO_IRE = {
  EMPLOYMENT_CONTRACT: "EMPLOYMENT_AGREEMENT",
  LEAVE_AND_LICENSE_AGREEMENT: "LEAVE_AND_LICENSE_AGREEMENT",
  COMMERCIAL_LEASE_AGREEMENT: "COMMERCIAL_LEASE_AGREEMENT",
  INDEPENDENT_CONTRACTOR_AGREEMENT: "INDEPENDENT_CONTRACTOR_AGREEMENT",
  NDA: "NDA",
  PARTNERSHIP_DEED: "PARTNERSHIP_DEED",
  SHAREHOLDERS_AGREEMENT: "SHAREHOLDERS_AGREEMENT",
  JOINT_VENTURE_AGREEMENT: "JOINT_VENTURE_AGREEMENT",
  SERVICE_AGREEMENT: "SERVICE_AGREEMENT",
  CONSULTANCY_AGREEMENT: "CONSULTANCY_AGREEMENT",
  SUPPLY_AGREEMENT: "SUPPLY_AGREEMENT",
  DISTRIBUTION_AGREEMENT: "DISTRIBUTION_AGREEMENT",
  SALES_OF_GOODS_AGREEMENT: "SALES_OF_GOODS_AGREEMENT",
  LOAN_AGREEMENT: "LOAN_AGREEMENT",
  GUARANTEE_AGREEMENT: "GUARANTEE_AGREEMENT",
  SOFTWARE_DEVELOPMENT_AGREEMENT: "SOFTWARE_DEVELOPMENT_AGREEMENT",
  MOU: "MOU",
  PRIVACY_POLICY: "PRIVACY_POLICY",
};

// Maps documentConfig doc types → blueprint file names (without .blueprint.json extension)
const DOC_TYPE_TO_BLUEPRINT = {
  EMPLOYMENT_CONTRACT: "employment_contract",
  LEAVE_AND_LICENSE_AGREEMENT: "leave_and_license_agreement", // matches actual file
  COMMERCIAL_LEASE_AGREEMENT: "commercial_lease_agreement",
  INDEPENDENT_CONTRACTOR_AGREEMENT: "independent_contractor_agreement",
  NDA: "nda",
  PARTNERSHIP_DEED: "partnership_deed",
  SHAREHOLDERS_AGREEMENT: "shareholders_agreement",
  JOINT_VENTURE_AGREEMENT: "joint_venture_agreement",
  SERVICE_AGREEMENT: "service",
  CONSULTANCY_AGREEMENT: "consultancy_agreement",
  SUPPLY_AGREEMENT: "supply_agreement",
  DISTRIBUTION_AGREEMENT: "distribution_agreement",
  SALES_OF_GOODS_AGREEMENT: "sales_of_goods_agreement",
  LOAN_AGREEMENT: "loan",
  GUARANTEE_AGREEMENT: "guarantee",
  SOFTWARE_DEVELOPMENT_AGREEMENT: "technology",
  MOU: "mou",
  PRIVACY_POLICY: "privacy",
};

/**
 * Get the IRE-compatible document type for validation.
 */
export function toIREDocType(documentType) {
  return DOC_TYPE_TO_IRE[documentType] || documentType;
}

/**
 * Get the blueprint file name prefix for a document type.
 */
export function toBlueprintName(documentType) {
  return DOC_TYPE_TO_BLUEPRINT[documentType] || documentType.toLowerCase();
}

/**
 * Get the variable file name prefix for a document type.
 */
export function toVariableFileName(documentType) {
  // Always try the exact lowercase doc type name first
  return documentType.toLowerCase();
}
