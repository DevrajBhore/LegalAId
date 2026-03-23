// backend/commercial/injector.js

import { PROTECTION_LIBRARY } from "./protectionLibrary.js";

export function injectProtection(draft, type) {

  const protection = PROTECTION_LIBRARY[type];

  if (!protection) {
    console.warn(`⚠ Protection type "${type}" not found in library.`);
    return draft;
  }

  const clause = protection.build();

  // Check if a similar clause already exists
  const exists = draft.clauses.some(c =>
    (c.text || "").toLowerCase().includes(clause.title.toLowerCase())
  );

  if (!exists) {
    draft.clauses.push(clause);
  }

  return draft;

}