import { inferDomainRequirements } from "./domainInference.js";

// 🔹 Define universal required categories here
const UNIVERSAL_REQUIRED_CATEGORIES = [
  "IDENTITY",
  "PURPOSE",
  "CONSIDERATION",
  "ENFORCEABILITY",
  "TERM",
  "GOVERNING_LAW",
];

export function validateCategories(draft) {
  const clauses = draft?.clauses || [];
  const docType = draft?.document_type || "";

  const categoriesPresent = [...new Set(clauses.map((c) => c.category))];

  const required = [
    ...UNIVERSAL_REQUIRED_CATEGORIES,
    ...inferDomainRequirements(docType),
  ];

  const missing = required.filter((cat) => !categoriesPresent.includes(cat));

  return missing.map((cat) => ({
    rule_id: "MISSING_REQUIRED_CATEGORY",
    severity: "CRITICAL",
    message: `Missing required category: ${cat}`,
  }));
}
