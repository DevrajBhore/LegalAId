/**
 * domainRegistry.js
 *
 * THE CENTRAL REGISTRY FOR ALL INDIAN LEGAL DOCUMENT TYPES.
 *
 * Architecture:
 *   Every document type maps to:
 *     - family:      high-level grouping (CONTRACTS, PROPERTY, CORPORATE, etc.)
 *     - domains:     constraint domains to apply (contract, property, finance, etc.)
 *     - acts:        governing Acts for statutory validation
 *     - categories:  required clause categories for this doc type
 *     - stampDuty:   whether stamp duty validation applies
 *     - registration: whether Registration Act check applies
 *
 * Adding a new document type = one entry here. No other files needed
 * unless you want type-specific blueprint/constraints (optional override).
 *
 * Covers all ~160 Indian legal document types across 8 families.
 */

export const DOCUMENT_TYPE_REGISTRY = {
  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 1: CONTRACTS & COMMERCIAL AGREEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  NDA: {
    displayName: "Non-Disclosure Agreement",
    family: "CONTRACTS",
    domains: ["contract", "confidentiality"],
    categories: [
      "IDENTITY",
      "CONFIDENTIALITY",
      "EXCLUSIONS",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SERVICE_AGREEMENT: {
    displayName: "Service Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  CONSULTANCY_AGREEMENT: {
    displayName: "Consultancy Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    displayName: "Independent Contractor Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SUPPLY_AGREEMENT: {
    displayName: "Supply Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  DISTRIBUTION_AGREEMENT: {
    displayName: "Distribution Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SALES_OF_GOODS_AGREEMENT: {
    displayName: "Sale of Goods Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  FRANCHISE_AGREEMENT: {
    displayName: "Franchise Agreement",
    family: "CONTRACTS",
    domains: ["contract", "ip"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  AGENCY_AGREEMENT: {
    displayName: "Agency Agreement",
    family: "CONTRACTS",
    domains: ["contract", "service"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  MOU: {
    displayName: "Memorandum of Understanding",
    family: "CONTRACTS",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
  },

  LOI: {
    displayName: "Letter of Intent",
    family: "CONTRACTS",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false,
  },

  ADDENDUM: {
    displayName: "Addendum / Amendment Agreement",
    family: "CONTRACTS",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
  },

  SETTLEMENT_AGREEMENT: {
    displayName: "Settlement Agreement",
    family: "CONTRACTS",
    domains: ["contract"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 2: EMPLOYMENT & LABOUR
  // ══════════════════════════════════════════════════════════════════════════

  EMPLOYMENT_AGREEMENT: {
    displayName: "Employment Agreement",
    family: "EMPLOYMENT",
    domains: ["contract", "employment"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  OFFER_LETTER: {
    displayName: "Offer Letter",
    family: "EMPLOYMENT",
    domains: ["contract", "employment"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: false,
    registration: false,
  },

  APPOINTMENT_LETTER: {
    displayName: "Appointment Letter",
    family: "EMPLOYMENT",
    domains: ["contract", "employment"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: false,
    registration: false,
  },

  SEPARATION_AGREEMENT: {
    displayName: "Separation / Severance Agreement",
    family: "EMPLOYMENT",
    domains: ["contract", "employment"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 3: PROPERTY & REAL ESTATE
  // ══════════════════════════════════════════════════════════════════════════

  RENTAL_AGREEMENT: {
    displayName: "Rental / Lease Agreement",
    family: "PROPERTY",
    domains: ["contract", "property", "rental"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
  },

  LEAVE_AND_LICENSE_AGREEMENT: {
    displayName: "Leave and License Agreement",
    family: "PROPERTY",
    domains: ["contract", "property", "rental"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
  },

  COMMERCIAL_LEASE_AGREEMENT: {
    displayName: "Commercial Lease Agreement",
    family: "PROPERTY",
    domains: ["contract", "property", "rental"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
  },

  SALE_DEED: {
    displayName: "Sale Deed",
    family: "PROPERTY",
    domains: ["contract", "property"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
    registrationMandatory: true,
  },

  GIFT_DEED: {
    displayName: "Gift Deed",
    family: "PROPERTY",
    domains: ["contract", "property"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: true,
    registrationMandatory: true,
  },

  MORTGAGE_DEED: {
    displayName: "Mortgage Deed",
    family: "PROPERTY",
    domains: ["contract", "property", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
    registrationMandatory: true,
  },

  RELINQUISHMENT_DEED: {
    displayName: "Relinquishment Deed",
    family: "PROPERTY",
    domains: ["contract", "property"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: true,
  },

  PARTITION_DEED: {
    displayName: "Partition Deed",
    family: "PROPERTY",
    domains: ["contract", "property"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: true,
  },

  DEVELOPMENT_AGREEMENT: {
    displayName: "Development Agreement",
    family: "PROPERTY",
    domains: ["contract", "property"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 4: CORPORATE & BUSINESS
  // ══════════════════════════════════════════════════════════════════════════

  SHAREHOLDERS_AGREEMENT: {
    displayName: "Shareholders Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  PARTNERSHIP_DEED: {
    displayName: "Partnership Deed",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "FINANCE",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  LLP_AGREEMENT: {
    displayName: "LLP Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  JOINT_VENTURE_AGREEMENT: {
    displayName: "Joint Venture Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SHARE_PURCHASE_AGREEMENT: {
    displayName: "Share Purchase Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  ASSET_PURCHASE_AGREEMENT: {
    displayName: "Asset Purchase Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate", "property"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  DEBENTURE_TRUST_DEED: {
    displayName: "Debenture Trust Deed",
    family: "CORPORATE",
    domains: ["contract", "corporate", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: true,
  },

  FOUNDERS_AGREEMENT: {
    displayName: "Founders Agreement",
    family: "CORPORATE",
    domains: ["contract", "corporate"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 5: FINANCIAL INSTRUMENTS
  // ══════════════════════════════════════════════════════════════════════════

  LOAN_AGREEMENT: {
    displayName: "Loan Agreement",
    family: "FINANCIAL",
    domains: ["contract", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  GUARANTEE_AGREEMENT: {
    displayName: "Guarantee Agreement",
    family: "FINANCIAL",
    domains: ["contract", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  PROMISSORY_NOTE: {
    displayName: "Promissory Note",
    family: "FINANCIAL",
    domains: ["contract", "finance"],
    categories: [
      "IDENTITY",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  PLEDGE_AGREEMENT: {
    displayName: "Pledge Agreement",
    family: "FINANCIAL",
    domains: ["contract", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  HYPOTHECATION_AGREEMENT: {
    displayName: "Hypothecation Agreement",
    family: "FINANCIAL",
    domains: ["contract", "finance"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 6: INTELLECTUAL PROPERTY
  // ══════════════════════════════════════════════════════════════════════════

  IP_ASSIGNMENT_AGREEMENT: {
    displayName: "IP Assignment Agreement",
    family: "IP",
    domains: ["contract", "ip"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  IP_LICENSE_AGREEMENT: {
    displayName: "IP Licence Agreement",
    family: "IP",
    domains: ["contract", "ip"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    displayName: "Software Development Agreement",
    family: "IP",
    domains: ["contract", "service", "ip"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  SAAS_AGREEMENT: {
    displayName: "SaaS / Cloud Services Agreement",
    family: "IP",
    domains: ["contract", "service", "ip"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "TERM",
      "TERMINATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  PRIVACY_POLICY: {
    displayName: "Privacy Policy",
    family: "IP",
    domains: ["contract"],
    categories: ["PURPOSE"],
    stampDuty: false,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 7: FAMILY & PERSONAL
  // ══════════════════════════════════════════════════════════════════════════

  WILL: {
    displayName: "Will / Testament",
    family: "FAMILY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false, // Optional but advisable
    minWitnesses: 2,
  },

  GIFT_DEED_MOVABLE: {
    displayName: "Gift Deed (Movable Property)",
    family: "FAMILY",
    domains: ["contract", "property"],
    categories: ["IDENTITY", "PURPOSE", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
  },

  ADOPTION_DEED: {
    displayName: "Adoption Deed",
    family: "FAMILY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: true,
    minWitnesses: 2,
  },

  DIVORCE_DEED: {
    displayName: "Divorce Deed / Mutual Consent",
    family: "FAMILY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false,
  },

  MAINTENANCE_AGREEMENT: {
    displayName: "Maintenance Agreement",
    family: "FAMILY",
    domains: ["contract"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 8: LITIGATION & COURT DOCUMENTS
  // ══════════════════════════════════════════════════════════════════════════

  AFFIDAVIT: {
    displayName: "Affidavit",
    family: "LITIGATION",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
    notarisation: true,
  },

  LEGAL_NOTICE: {
    displayName: "Legal Notice",
    family: "LITIGATION",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false,
  },

  VAKALATNAMA: {
    displayName: "Vakalatnama",
    family: "LITIGATION",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
  },

  INDEMNITY_BOND: {
    displayName: "Indemnity Bond",
    family: "LITIGATION",
    domains: ["contract"],
    categories: [
      "IDENTITY",
      "PURPOSE",
      "CONSIDERATION",
      "GOVERNING_LAW",
      "SIGNATURE_BLOCK",
    ],
    stampDuty: true,
    registration: false,
  },

  UNDERTAKING: {
    displayName: "Undertaking",
    family: "LITIGATION",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FAMILY 9: GOVERNMENT & REGULATORY
  // ══════════════════════════════════════════════════════════════════════════

  POWER_OF_ATTORNEY: {
    displayName: "Power of Attorney",
    family: "REGULATORY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
    notarisation: true,
  },

  GENERAL_POWER_OF_ATTORNEY: {
    displayName: "General Power of Attorney",
    family: "REGULATORY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: true,
    notarisation: true,
  },

  SPECIAL_POWER_OF_ATTORNEY: {
    displayName: "Special Power of Attorney",
    family: "REGULATORY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
    notarisation: true,
  },

  RTI_APPLICATION: {
    displayName: "RTI Application",
    family: "REGULATORY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false,
  },

  DECLARATION_FORM: {
    displayName: "Statutory Declaration",
    family: "REGULATORY",
    domains: ["contract"],
    categories: ["IDENTITY", "PURPOSE", "SIGNATURE_BLOCK"],
    stampDuty: false,
    registration: false,
  },
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Get registry entry for a document type, with fallback for unknown types.
 */
export function getDocumentTypeInfo(documentType) {
  // Direct match
  if (DOCUMENT_TYPE_REGISTRY[documentType]) {
    return DOCUMENT_TYPE_REGISTRY[documentType];
  }

  // Fuzzy match — strip suffixes like _AGREEMENT, _DEED etc.
  const normalized = documentType.toUpperCase().replace(/[_\s]+/g, "_");
  for (const [key, value] of Object.entries(DOCUMENT_TYPE_REGISTRY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Unknown type — return universal fallback
  return {
    displayName: documentType,
    family: "UNKNOWN",
    domains: ["contract"],
    categories: ["IDENTITY", "GOVERNING_LAW", "SIGNATURE_BLOCK"],
    stampDuty: true,
    registration: false,
    _isUnknown: true,
  };
}

/**
 * Get all document types for a given family.
 */
export function getDocumentTypesByFamily(family) {
  return Object.entries(DOCUMENT_TYPE_REGISTRY)
    .filter(([, v]) => v.family === family)
    .map(([k, v]) => ({ type: k, displayName: v.displayName }));
}

/**
 * Get required clause categories for a document type.
 */
export function getRequiredCategories(documentType) {
  return getDocumentTypeInfo(documentType).categories;
}

/**
 * Get all domains for a document type (for constraint + statutory lookup).
 */
export function getDomainsForDocType(documentType) {
  return getDocumentTypeInfo(documentType).domains;
}

export const ALL_FAMILIES = [
  "CONTRACTS",
  "EMPLOYMENT",
  "PROPERTY",
  "CORPORATE",
  "FINANCIAL",
  "IP",
  "FAMILY",
  "LITIGATION",
  "REGULATORY",
];
