// backend/config/clauseOrder.js

export const CLAUSE_ORDER = [
    "IDENTITY",
    "PURPOSE",
    "CONSIDERATION",
    "CONFIDENTIALITY",
    "EXCLUSIONS",
    "TERM",
    "TERMINATION",
    "DISPUTE_RESOLUTION",
    "GOVERNING_LAW",
    "ENFORCEABILITY",
    "SIGNATURE_BLOCK"
  ];
  
  /**
   * Sort clauses according to canonical order.
   */
  export function sortClausesByOrder(clauses = []) {
    return clauses.sort((a, b) => {
      const indexA = CLAUSE_ORDER.indexOf(a.category);
      const indexB = CLAUSE_ORDER.indexOf(b.category);
  
      const safeA = indexA === -1 ? 999 : indexA;
      const safeB = indexB === -1 ? 999 : indexB;
  
      return safeA - safeB;
    });
  }