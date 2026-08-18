/**
 * documentValidator.js
 *
 * Structural validation uses domainRegistry for all document types.
 * Any registered (or fuzzy-matched) document type gets the right required
 * categories and domain constraints automatically.
 */

import { runConstraints } from "./constraintEngine.js";
import { getDocumentTypeInfo } from "./domainRegistry.js";

function normalizeCategory(category = "") {
  return String(category || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

const CATEGORY_EQUIVALENTS = {
  FINANCE: ["FINANCE", "CONSIDERATION"],
  DISPUTE_RESOLUTION: ["DISPUTE_RESOLUTION", "ARBITRATION"],
  SIGNATURE_BLOCK: ["SIGNATURE_BLOCK", "SIGNATURES", "EXECUTION"],
};

function hasRequiredCategory(presentCategories, category) {
  const normalizedCategory = normalizeCategory(category);
  const acceptableCategories =
    CATEGORY_EQUIVALENTS[normalizedCategory] || [normalizedCategory];

  return acceptableCategories.some((candidate) =>
    presentCategories.has(candidate)
  );
}

export function validateDocument(
  registry,
  draft,
  {
    enforceClauseOrdering = true,
    enforceExactConstraintRules = true,
  } = {}
) {
  if (!draft?.clauses || !Array.isArray(draft.clauses)) {
    return {
      pass: false,
      violations: [
        {
          rule_id: "INVALID_DRAFT_STRUCTURE",
          severity: "CRITICAL",
          message: "Draft has no clauses array.",
        },
      ],
    };
  }

  const issues = [];
  const clauseIds = draft.clauses.map((clause) => clause.clause_id).filter(Boolean);
  const normalizedCategories = draft.clauses
    .map((clause) => normalizeCategory(clause.category))
    .filter(Boolean);
  const presentCategories = new Set(normalizedCategories);
  const docType = draft.document_type || "UNKNOWN";
  const typeInfo = getDocumentTypeInfo(docType);

  const requiredCategories =
    typeInfo.categories || ["IDENTITY", "GOVERNING_LAW", "SIGNATURE_BLOCK"];

  for (const category of requiredCategories) {
    if (!hasRequiredCategory(presentCategories, category)) {
      issues.push({
        rule_id: `MISSING_CATEGORY_${category}`,
        severity:
          category === "SIGNATURE_BLOCK" || category === "IDENTITY"
            ? "CRITICAL"
            : "HIGH",
        message: `Required clause category "${category}" is missing from this ${typeInfo.displayName || docType} document.`,
        suggestion: `Add a clause covering: ${category}.`,
      });
    }
  }

  const signatureIndex = normalizedCategories.findIndex((category) =>
    hasRequiredCategory(new Set([category]), "SIGNATURE_BLOCK")
  );
  if (enforceClauseOrdering && signatureIndex !== -1) {
    const trailingOperativeCategory = normalizedCategories
      .slice(signatureIndex + 1)
      .find(
        (category) =>
          !hasRequiredCategory(new Set([category]), "SIGNATURE_BLOCK")
      );

    if (trailingOperativeCategory) {
      issues.push({
        rule_id: "CLAUSES_AFTER_SIGNATURE_BLOCK",
        severity: "CRITICAL",
        message:
          "Operative clauses appear after the signature block. The signature block must be the final section of the document.",
        suggestion:
          "Move all substantive clauses before the signature block and keep execution language at the end.",
      });
    }
  }

  if (typeInfo.notarisation) {
    const fullText = draft.clauses.map((clause) => clause.text || "").join(" ");
    const hasNotary = /notaris|notary public|before me|sworn/i.test(fullText);

    if (!hasNotary) {
      issues.push({
        rule_id: "NOTARISATION_REQUIRED",
        severity: "HIGH",
        message: `${typeInfo.displayName || docType} requires notarisation but no notary clause found.`,
        suggestion:
          "Add a notarisation clause or have the document notarised by a Notary Public under the Notaries Act, 1952.",
      });
    }
  }

  if (typeInfo.minWitnesses) {
    const fullText = draft.clauses.map((clause) => clause.text || "").join(" ");
    const witnessCount = (fullText.match(/witness/gi) || []).length;

    if (witnessCount < typeInfo.minWitnesses) {
      issues.push({
        rule_id: "INSUFFICIENT_WITNESSES",
        severity: "HIGH",
        message: `${typeInfo.displayName || docType} requires at least ${typeInfo.minWitnesses} witness(es).`,
        suggestion: `Add at least ${typeInfo.minWitnesses} witness signature blocks.`,
      });
    }
  }

  if (typeInfo.registrationMandatory) {
    // Whether registration is REQUIRED is decided by registrationValidator.js
    // against the Registration Act rules data. This check is narrower: given
    // that it is required, does the instrument actually address it? A dedicated
    // registration clause satisfies that; the keyword scan is kept only as a
    // fallback for drafts assembled outside the clause library.
    const fullText = draft.clauses.map((clause) => clause.text || "").join(" ");
    const REGISTRATION_CLAUSE_IDS = [
      "PROP_REGISTRATION_001",
      "PROP_REGISTRATION_MANDATORY_001",
      "CORE_STAMP_AND_COSTS_001",
    ];
    const hasRegistration =
      REGISTRATION_CLAUSE_IDS.some((id) => clauseIds.includes(id)) ||
      /sub-registrar|registered under|registration act|registration no/i.test(
        fullText
      );

    if (!hasRegistration) {
      issues.push({
        rule_id: "MANDATORY_REGISTRATION_MISSING",
        severity: "CRITICAL",
        message: `${typeInfo.displayName || docType} is compulsorily registrable under Registration Act 1908 - S.17. No registration reference found.`,
        statutory_reference: "Registration Act 1908 - S.17",
        suggestion:
          "This document must be registered with the Sub-Registrar. Add a registration clause.",
      });
    }
  }

  const domains = typeInfo.domains || ["contract"];
  const constraintRules =
    enforceExactConstraintRules && registry.getConstraintsForDomains
    ? registry.getConstraintsForDomains(domains)
    : [];
  // Rules can now test their own conditions (lease term, state, intake answers),
  // so the draft's source variables are passed through as evaluation context.
  const { violations, evaluated } = runConstraints(clauseIds, constraintRules, docType, {
    variables: draft?.metadata?.source_variables || draft?.source_variables || {},
    clauses: draft.clauses,
  });

  return {
    pass: issues.length === 0 && violations.length === 0,
    violations: [...issues, ...violations],
    // Per-rule outcomes (pass / fail / not_applicable) so the validation result
    // can report what was actually checked instead of only what failed.
    constraint_outcomes: evaluated,
  };
}
