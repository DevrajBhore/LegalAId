// backend/commercial/injector.js

import { PROTECTION_CLAUSE_IDS, LEGACY_AUTO_IDS } from "./protectionLibrary.js";
import { getClauseById } from "../services/clauseAssembler.js";

/**
 * Add a protection the completeness validator found missing.
 *
 * The clause comes from the governed knowledge base. It used to be built here
 * from a second library with AUTO-* ids, which meant a clause could reach a
 * signed document without a review status, a legal basis, an invalid_if, or any
 * possibility of an advocate ever signing it off.
 */
export function injectProtection(draft, type) {
  const clauseId = PROTECTION_CLAUSE_IDS[type];
  if (!clauseId) {
    console.warn(`Protection type "${type}" has no clause mapped to it.`);
    return draft;
  }

  const clause = getClauseById(clauseId);
  if (!clause) {
    // Refusing is the right failure. Falling back to a hand-built clause is how
    // ungoverned text reached shipped documents in the first place.
    console.warn(
      `Protection "${type}" maps to ${clauseId}, which is not in the knowledge base. ` +
      `No clause injected.`
    );
    return draft;
  }

  const legacyId = LEGACY_AUTO_IDS[type];
  const leadingText = String(clause.text || "").toLowerCase().slice(0, 60);
  const title = String(clause.title || clause.name || "").toLowerCase();

  const exists = draft.clauses.some((existing) => {
    const existingTitle = String(existing.title || existing.name || "").toLowerCase();
    return (
      existing.clause_id === clauseId ||
      existing.clause_id === legacyId ||
      (title && existingTitle === title) ||
      String(existing.text || "").toLowerCase().includes(leadingText)
    );
  });

  if (!exists) draft.clauses.push({ ...clause });
  return draft;
}
