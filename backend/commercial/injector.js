// backend/commercial/injector.js

import { PROTECTION_LIBRARY } from "./protectionLibrary.js";

export function injectProtection(draft, type) {
  const protection = PROTECTION_LIBRARY[type];

  if (!protection) {
    console.warn(`Protection type "${type}" not found in library.`);
    return draft;
  }

  const clause = protection.build();

  const exists = draft.clauses.some((existingClause) => {
    const existingText = (existingClause.text || "").toLowerCase();
    const existingTitle = (
      existingClause.title ||
      existingClause.name ||
      ""
    ).toLowerCase();
    const clauseTextLead = clause.text.toLowerCase().slice(0, 60);

    return (
      existingClause.clause_id === clause.clause_id ||
      existingTitle === clause.title.toLowerCase() ||
      existingText.includes(clauseTextLead)
    );
  });

  if (!exists) {
    draft.clauses.push(clause);
  }

  return draft;
}
