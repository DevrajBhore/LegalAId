/**
 * documentValidator.js
 *
 * Structural validation — uses domainRegistry for all document types.
 * Any document type registered (or fuzzy-matched) gets correct required
 * categories and constraint domains automatically.
 */

import { evaluateConstraints } from "./constraintEngine.js";
import { getDocumentTypeInfo, getRequiredCategories } from "./domainRegistry.js";

export function validateDocument(registry, draft) {

  if (!draft?.clauses || !Array.isArray(draft.clauses)) {
    return {
      pass: false,
      violations: [{
        rule_id  : "INVALID_DRAFT_STRUCTURE",
        severity : "CRITICAL",
        message  : "Draft has no clauses array.",
      }],
    };
  }

  const issues           = [];
  const clauseIds        = draft.clauses.map(c => c.clause_id).filter(Boolean);
  const presentCategories = new Set(draft.clauses.map(c => c.category).filter(Boolean));
  const docType          = draft.document_type || "UNKNOWN";
  const typeInfo         = getDocumentTypeInfo(docType);

  // ── 1. Required category check (from domain registry) ─────────────────
  const requiredCategories = typeInfo.categories || ["IDENTITY", "GOVERNING_LAW", "SIGNATURE_BLOCK"];

  for (const cat of requiredCategories) {
    if (!presentCategories.has(cat)) {
      issues.push({
        rule_id   : `MISSING_CATEGORY_${cat}`,
        severity  : ["SIGNATURE_BLOCK", "IDENTITY"].includes(cat) ? "CRITICAL" : "HIGH",
        message   : `Required clause category "${cat}" is missing from this ${typeInfo.displayName || docType} document.`,
        suggestion: `Add a clause covering: ${cat}.`,
      });
    }
  }

  // ── 2. Notarisation check (for docs that require it) ──────────────────
  if (typeInfo.notarisation) {
    const fullText = draft.clauses.map(c => c.text || "").join(" ").toLowerCase();
    const hasNotary = /notaris|notary public|before me|sworn/i.test(fullText);
    if (!hasNotary) {
      issues.push({
        rule_id   : "NOTARISATION_REQUIRED",
        severity  : "HIGH",
        message   : `${typeInfo.displayName || docType} requires notarisation but no notary clause found.`,
        suggestion: "Add a notarisation clause or have the document notarised by a Notary Public under the Notaries Act, 1952.",
      });
    }
  }

  // ── 3. Witness count check ────────────────────────────────────────────
  if (typeInfo.minWitnesses) {
    const fullText = draft.clauses.map(c => c.text || "").join(" ").toLowerCase();
    const witnessCount = (fullText.match(/witness/gi) || []).length;
    if (witnessCount < typeInfo.minWitnesses) {
      issues.push({
        rule_id   : "INSUFFICIENT_WITNESSES",
        severity  : "HIGH",
        message   : `${typeInfo.displayName || docType} requires at least ${typeInfo.minWitnesses} witness(es).`,
        suggestion: `Add at least ${typeInfo.minWitnesses} witness signature blocks.`,
      });
    }
  }

  // ── 4. Mandatory registration flag ───────────────────────────────────
  if (typeInfo.registrationMandatory) {
    const fullText = draft.clauses.map(c => c.text || "").join(" ").toLowerCase();
    const hasRegistration = /sub-registrar|registered under|registration act|registration no/i.test(fullText);
    if (!hasRegistration) {
      issues.push({
        rule_id           : "MANDATORY_REGISTRATION_MISSING",
        severity          : "CRITICAL",
        message           : `${typeInfo.displayName || docType} is compulsorily registrable under Registration Act 1908 – S.17. No registration reference found.`,
        statutory_reference: "Registration Act 1908 – S.17",
        suggestion        : "This document must be registered with the Sub-Registrar. Add a registration clause.",
      });
    }
  }

  // ── 5. Constraint check (domain-based) ───────────────────────────────
  const domains          = typeInfo.domains || ["contract"];
  const constraintRules  = registry.getConstraintsForDomains
    ? registry.getConstraintsForDomains(domains)
    : [];
  const violations = evaluateConstraints(clauseIds, constraintRules, docType);

  return {
    pass      : issues.length === 0 && violations.length === 0,
    violations: [...issues, ...violations],
  };
}
