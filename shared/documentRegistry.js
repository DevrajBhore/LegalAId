export const DOCUMENT_TYPE_REGISTRY = {
  NDA: {
    displayName: "Non-Disclosure Agreement",
    family: "Contracts & Commercial",
    ireType: "NDA",
    blueprintName: "nda",
  },
  EMPLOYMENT_CONTRACT: {
    displayName: "Employment Contract",
    family: "Employment",
    ireType: "EMPLOYMENT_AGREEMENT",
    blueprintName: "employment_contract",
  },
  SERVICE_AGREEMENT: {
    displayName: "Service Agreement",
    family: "Contracts & Commercial",
    ireType: "SERVICE_AGREEMENT",
    blueprintName: "service",
  },
  CONSULTANCY_AGREEMENT: {
    displayName: "Consultancy Agreement",
    family: "Contracts & Commercial",
    ireType: "CONSULTANCY_AGREEMENT",
    blueprintName: "consultancy_agreement",
  },
  PARTNERSHIP_DEED: {
    displayName: "Partnership Deed",
    family: "Corporate",
    ireType: "PARTNERSHIP_DEED",
    blueprintName: "partnership_deed",
  },
  SHAREHOLDERS_AGREEMENT: {
    displayName: "Shareholders Agreement",
    family: "Corporate",
    ireType: "SHAREHOLDERS_AGREEMENT",
    blueprintName: "shareholders_agreement",
  },
  JOINT_VENTURE_AGREEMENT: {
    displayName: "Joint Venture Agreement",
    family: "Corporate",
    ireType: "JOINT_VENTURE_AGREEMENT",
    blueprintName: "joint_venture_agreement",
  },
  SUPPLY_AGREEMENT: {
    displayName: "Supply Agreement",
    family: "Contracts & Commercial",
    ireType: "SUPPLY_AGREEMENT",
    blueprintName: "supply_agreement",
  },
  DISTRIBUTION_AGREEMENT: {
    displayName: "Distribution Agreement",
    family: "Contracts & Commercial",
    ireType: "DISTRIBUTION_AGREEMENT",
    blueprintName: "distribution_agreement",
  },
  SALES_OF_GOODS_AGREEMENT: {
    displayName: "Sale of Goods Agreement",
    family: "Contracts & Commercial",
    ireType: "SALES_OF_GOODS_AGREEMENT",
    blueprintName: "sales_of_goods_agreement",
  },
  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    displayName: "Independent Contractor Agreement",
    family: "Contracts & Commercial",
    ireType: "INDEPENDENT_CONTRACTOR_AGREEMENT",
    blueprintName: "independent_contractor_agreement",
  },
  COMMERCIAL_LEASE_AGREEMENT: {
    displayName: "Commercial Lease Agreement",
    family: "Property",
    ireType: "COMMERCIAL_LEASE_AGREEMENT",
    blueprintName: "commercial_lease_agreement",
  },
  LEAVE_AND_LICENSE_AGREEMENT: {
    displayName: "Leave and License Agreement",
    family: "Property",
    ireType: "LEAVE_AND_LICENSE_AGREEMENT",
    blueprintName: "leave_and_license_agreement",
  },
  LOAN_AGREEMENT: {
    displayName: "Loan Agreement",
    family: "Finance",
    ireType: "LOAN_AGREEMENT",
    blueprintName: "loan",
  },
  GUARANTEE_AGREEMENT: {
    displayName: "Guarantee Agreement",
    family: "Finance",
    ireType: "GUARANTEE_AGREEMENT",
    blueprintName: "guarantee",
  },
  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    displayName: "Software Development Agreement",
    family: "Contracts & Commercial",
    ireType: "SOFTWARE_DEVELOPMENT_AGREEMENT",
    blueprintName: "technology",
  },
  MOU: {
    displayName: "Memorandum of Understanding",
    family: "Corporate",
    ireType: "MOU",
    blueprintName: "mou",
  },
  PRIVACY_POLICY: {
    displayName: "Privacy Policy",
    family: "Contracts & Commercial",
    ireType: "PRIVACY_POLICY",
    blueprintName: "privacy",
  },
  RENTAL_AGREEMENT: {
    displayName: "Rental Agreement",
    family: "Property",
    ireType: "RENTAL_AGREEMENT",
    blueprintName: "rental",
  },
};

export const DOCUMENT_TYPE_ALIASES = {
  EMPLOYMENT_AGREEMENT: "EMPLOYMENT_CONTRACT",
  SERVICE_PROVIDER_AGREEMENT: "SERVICE_AGREEMENT",
  INDEPENDENT_CONTRACTOR: "INDEPENDENT_CONTRACTOR_AGREEMENT",
  LEAVE_AND_LICENSE: "LEAVE_AND_LICENSE_AGREEMENT",
  ADDENDUM: "SERVICE_AGREEMENT",
  Rental: "RENTAL_AGREEMENT",
  Employment: "EMPLOYMENT_CONTRACT",
  Service: "SERVICE_AGREEMENT",
  PrivacyPolicy: "PRIVACY_POLICY",
};

function prettifyDocumentType(type) {
  return (type || "LEGAL DOCUMENT")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getCanonicalDocumentType(type) {
  if (typeof type !== "string") return type;
  return DOCUMENT_TYPE_ALIASES[type] || type;
}

export function getDocumentTypeMeta(type) {
  const canonicalType = getCanonicalDocumentType(type);
  return DOCUMENT_TYPE_REGISTRY[canonicalType] || null;
}

export function getDocumentDisplayName(type) {
  return getDocumentTypeMeta(type)?.displayName || prettifyDocumentType(type);
}

export function getDocumentFamily(type) {
  return getDocumentTypeMeta(type)?.family || "Other";
}

export function toIREDocType(type) {
  const canonicalType = getCanonicalDocumentType(type);
  return getDocumentTypeMeta(canonicalType)?.ireType || canonicalType;
}

export function toBlueprintName(type) {
  const canonicalType = getCanonicalDocumentType(type);
  return (
    getDocumentTypeMeta(canonicalType)?.blueprintName ||
    (typeof canonicalType === "string" ? canonicalType.toLowerCase() : "")
  );
}

export function buildDocumentTypeMeta(type) {
  const canonicalType = getCanonicalDocumentType(type);
  return {
    type: canonicalType,
    displayName: getDocumentDisplayName(canonicalType),
    family: getDocumentFamily(canonicalType),
    ireType: toIREDocType(canonicalType),
    blueprintName: toBlueprintName(canonicalType),
  };
}
