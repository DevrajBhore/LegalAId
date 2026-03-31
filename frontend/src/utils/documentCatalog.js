import { Icons } from "./icons";

export const FAMILY_ORDER = [
  "Contracts & Commercial",
  "Employment",
  "Property",
  "Corporate",
  "Finance",
];

export const FAMILY_ICONS = {
  "Contracts & Commercial": Icons.fileText,
  Employment: Icons.briefcase,
  Property: Icons.building,
  Corporate: Icons.scale,
  Finance: Icons.dollarSign,
};

const FEATURED_DOCUMENT_TYPES = [
  "NDA",
  "SERVICE_AGREEMENT",
  "EMPLOYMENT_CONTRACT",
  "SHAREHOLDERS_AGREEMENT",
  "LOAN_AGREEMENT",
  "LEAVE_AND_LICENSE_AGREEMENT",
];

function getFamily(type) {
  return type.family || "Other";
}

function sortByDisplayName(types = []) {
  return [...types].sort((left, right) =>
    (left.displayName || left.type || "").localeCompare(
      right.displayName || right.type || "",
      "en",
      { sensitivity: "base" }
    )
  );
}

export function getSortedFamilies(docTypes = []) {
  const allFamilies = [...new Set(docTypes.map((type) => getFamily(type)))];

  return [
    ...FAMILY_ORDER.filter((family) => allFamilies.includes(family)),
    ...allFamilies.filter((family) => !FAMILY_ORDER.includes(family)),
  ];
}

export function getGroupedCatalog(docTypes = [], activeFamily = null, query = "") {
  const normalized = query.trim().toLowerCase();

  const filtered = sortByDisplayName(
    docTypes.filter((type) => {
      const familyMatches = !activeFamily || getFamily(type) === activeFamily;
      const queryMatches =
        !normalized ||
        type.displayName?.toLowerCase().includes(normalized) ||
        type.type?.toLowerCase().replace(/_/g, " ").includes(normalized);

      return familyMatches && queryMatches;
    })
  );

  const grouped = filtered.reduce((accumulator, type) => {
    const family = getFamily(type);
    if (!accumulator[family]) accumulator[family] = [];
    accumulator[family].push(type);
    return accumulator;
  }, {});

  const families = getSortedFamilies(docTypes);
  const shownFamilies = activeFamily
    ? grouped[activeFamily]
      ? [activeFamily]
      : []
    : families.filter((family) => grouped[family]?.length);

  return {
    filtered,
    grouped,
    families,
    normalized,
    shownFamilies,
  };
}

export function getFeaturedDocumentTypes(docTypes = [], limit = 6) {
  const byType = new Map(docTypes.map((type) => [type.type, type]));
  const selected = [];

  FEATURED_DOCUMENT_TYPES.forEach((typeKey) => {
    const match = byType.get(typeKey);
    if (match) selected.push(match);
  });

  sortByDisplayName(docTypes).forEach((type) => {
    if (selected.length >= limit) return;
    if (!selected.find((existing) => existing.type === type.type)) {
      selected.push(type);
    }
  });

  return selected.slice(0, limit);
}
