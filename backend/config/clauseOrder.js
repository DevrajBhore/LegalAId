const CANONICAL_ORDER = [
  "IDENTITY",
  "RECITALS",
  "DEFINITIONS",
  "INTERPRETATION",
  "PURPOSE",
  "RELATIONSHIP",
  "FORMATION",
  "CONSIDERATION",
  "PAYMENT",
  "FINANCE",
  "DELIVERY",
  "SERVICE",
  "SUPPLY",
  "TIMELINE",
  "SLA",
  "ACCEPTANCE",
  "INSPECTION",
  "QUALITY",
  "REJECTION",
  "SHORTAGE",
  "CHANGE",
  "OBLIGATIONS",
  "CONFIDENTIALITY",
  "EXCLUSIONS",
  "PRIVACY",
  "DATA_PROCESSING",
  "IP",
  "INTELLECTUAL_PROPERTY",
  "WARRANTY",
  "REPRESENTATIONS",
  "REGULATORY",
  "COMPLIANCE",
  "CORPORATE",
  "PROPERTY",
  "PROCEDURAL",
  "RESTRAINT",
  "REMEDIES",
  "RISK",
  "LIABILITY",
  "INDEMNITY",
  "ENFORCEABILITY",
  "EXPENSES",
  "TERM",
  "FORCE_MAJEURE",
  "SURVIVAL",
  "TERMINATION",
  "TERMINATION_NOTICE",
  "NOTICE",
  "ASSIGNMENT",
  "AMENDMENT",
  "WAIVER",
  "SEVERABILITY",
  "ENTIRE_AGREEMENT",
  "COUNTERPARTS",
  "ARBITRATION",
  "DISPUTE",
  "DISPUTE_RESOLUTION",
  "JURISDICTION",
  "GOVERNING_LAW",
  "SCHEDULE",
  "ANNEXURE",
  "SPECIFICATIONS",
  "EXECUTION_FORMALITIES",
  "EXECUTION",
  "SIGNATURE_BLOCK",
];

const CATEGORY_ALIASES = {
  NDA: "CONFIDENTIALITY",
  NOTICES: "NOTICE",
  TERMINATION_NOTICE: "TERMINATION_NOTICE",
  INDEMNIFICATION: "INDEMNITY",
  LIABILITY_CAP: "RISK",
  LIABILITY_LIMITATION: "RISK",
  ANNEX: "ANNEXURE",
  APPENDIX: "ANNEXURE",
  SPECIFICATION: "SPECIFICATIONS",
  MATERIALS: "SPECIFICATIONS",
  SCHEDULES: "SCHEDULE",
};

export const CLAUSE_ORDER = [...CANONICAL_ORDER];

const ORDER_MAP = new Map(CANONICAL_ORDER.map((category, index) => [category, index]));

export function normalizeClauseCategory(category = "") {
  const normalized = String(category || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return CATEGORY_ALIASES[normalized] || normalized;
}

function getClauseOrderIndex(category) {
  const normalized = normalizeClauseCategory(category);
  const signatureIndex = ORDER_MAP.get("SIGNATURE_BLOCK") ?? 999;
  return ORDER_MAP.get(normalized) ?? signatureIndex - 1;
}

export function sortClausesByOrder(clauses = []) {
  return [...clauses].sort((left, right) => {
    const leftIndex = getClauseOrderIndex(left?.category);
    const rightIndex = getClauseOrderIndex(right?.category);

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const leftBlueprintPosition = Number(left?.blueprint_position);
    const rightBlueprintPosition = Number(right?.blueprint_position);
    const leftHasBlueprintPosition = Number.isFinite(leftBlueprintPosition);
    const rightHasBlueprintPosition = Number.isFinite(rightBlueprintPosition);

    if (
      leftHasBlueprintPosition &&
      rightHasBlueprintPosition &&
      leftBlueprintPosition !== rightBlueprintPosition
    ) {
      return leftBlueprintPosition - rightBlueprintPosition;
    }

    if (leftHasBlueprintPosition !== rightHasBlueprintPosition) {
      return leftHasBlueprintPosition ? -1 : 1;
    }

    const leftTitle = String(left?.title || left?.clause_id || "");
    const rightTitle = String(right?.title || right?.clause_id || "");
    return leftTitle.localeCompare(rightTitle);
  });
}
