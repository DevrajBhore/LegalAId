const TITLE_CATEGORY_MAP = [
  { keywords: ["definition"], category: "IDENTITY" },
  { keywords: ["purpose"], category: "PURPOSE" },
  { keywords: ["confidential"], category: "CONFIDENTIALITY" },
  { keywords: ["exclusion"], category: "EXCLUSIONS" },
  { keywords: ["term and termination"], category: ["TERM", "TERMINATION"] },
  { keywords: ["term"], category: "TERM" },
  { keywords: ["termination"], category: "TERMINATION" },
  { keywords: ["governing law", "jurisdiction"], category: "GOVERNING_LAW" },
  { keywords: ["dispute", "arbitration"], category: "DISPUTE_RESOLUTION" },
  { keywords: ["severability", "entire agreement", "waiver"], category: "ENFORCEABILITY" }
];

function detectCategoryFromTitle(title = "") {
  const lower = title.toLowerCase();

  for (const rule of TITLE_CATEGORY_MAP) {
    if (rule.keywords.some(keyword => lower.includes(keyword))) {
      return rule.category;
    }
  }

  return null;
}

function normalizeDocument(draft) {

  const normalizedClauses = [];
  const detectedCategories = new Set();

  for (const clause of draft.clauses || []) {

    const category =
      clause.category ||
      detectCategoryFromTitle(clause.title) ||
      "UNCATEGORIZED";

    normalizedClauses.push({
      ...clause,
      category
    });

    detectedCategories.add(category);
  }

  return {
    clauses: normalizedClauses,
    detectedCategories: Array.from(detectedCategories)
  };
}

export function mapAndNormalize(draft) {
  return normalizeDocument(draft);
}