/**
 * dependencyResolver.js
 *
 * Ensures logical consistency across assembled clauses by injecting explicit
 * KB dependencies and a small number of deterministic fallback clauses.
 */

import { getClauseById } from "./clauseAssembler.js";
import { injectVariables } from "./variableInjector.js";
import { normalizeClauseCategory } from "../config/clauseOrder.js";
import { toBlueprintName } from "./documentTypeNormalizer.js";

const DEPENDENCY_RULES = [
  {
    trigger_category: "INDEMNIFICATION",
    required_clause_id: "LIABILITY_LIMITATION_01",
    fallback_text:
      "The aggregate liability of either Party under this Agreement shall not exceed the total fees paid by the respective Party under this Agreement during the twelve (12) months immediately preceding the event giving rise to such liability.",
    title: "Limitation of Liability",
    category: "LIABILITY_CAP",
  },
  {
    trigger_category: "TERMINATION",
    trigger_condition: (draft) => {
      const hasTermination = draft.clauses.some((clause) =>
        String(clause.category || "").toUpperCase().includes("TERMINATION")
      );

      if (!hasTermination) {
        return false;
      }

      const hasNoticeCoverage = draft.clauses.some((clause) => {
        const text = String(clause.text || "");
        const title = String(clause.title || clause.name || "");
        const category = String(clause.category || "").toUpperCase();

        return (
          category === "TERMINATION_NOTICE" ||
          /termination notice/i.test(title) ||
          /written\s+notice|prior\s+written\s+notice|notice\s+period|\b\d+\s*\(?[a-z]*\)?\s*days?\b.*notice/i.test(
            text
          )
        );
      });

      return !hasNoticeCoverage;
    },
    required_clause_id: "NOTICE_PERIOD_DEFAULT",
    fallback_text:
      "Either party may terminate this Agreement without cause by providing a prior written notice of thirty (30) days to the other party.",
    title: "Termination Notice",
    category: "TERMINATION_NOTICE",
  },
];

function buildInjectedClauseFromKB(clauseId, variables = {}) {
  const clause = getClauseById(clauseId);
  if (!clause) {
    return null;
  }

  return {
    ...clause,
    category: normalizeClauseCategory(clause.category),
    title: clause.title || clause.name || null,
    text: injectVariables(clause.text || "", variables),
    injected_by: "dependencyResolver",
  };
}

function isClauseCompatibleWithDocument(clause, documentType = "") {
  const supportedTypes = Array.isArray(clause?.document_types)
    ? clause.document_types.map((value) => String(value || "").toUpperCase())
    : [];

  if (!supportedTypes.length || supportedTypes.includes("ALL")) {
    return true;
  }

  const normalizedDocumentType = String(documentType || "").toUpperCase();
  const blueprintAlias = toBlueprintName(documentType).toUpperCase();

  if (
    supportedTypes.includes(normalizedDocumentType) ||
    supportedTypes.includes(blueprintAlias)
  ) {
    return true;
  }

  if (
    ["SERVICE_AGREEMENT", "SERVICE"].some((type) => supportedTypes.includes(type)) &&
    [
      "SERVICE_AGREEMENT",
      "CONSULTANCY_AGREEMENT",
      "INDEPENDENT_CONTRACTOR_AGREEMENT",
      "SOFTWARE_DEVELOPMENT_AGREEMENT",
    ].includes(normalizedDocumentType)
  ) {
    return true;
  }

  if (
    supportedTypes.some((type) => type.startsWith("EMPLOYMENT")) &&
    normalizedDocumentType.startsWith("EMPLOYMENT")
  ) {
    return true;
  }

  return false;
}

function resolveExplicitKbDependencies(clauses = [], variables = {}, documentType = "") {
  const resolvedClauses = [...clauses];
  const existingClauseIds = new Set(
    resolvedClauses.map((clause) => String(clause.clause_id || ""))
  );

  let changed = true;
  while (changed) {
    changed = false;

    for (const clause of [...resolvedClauses]) {
      const requiredClauseIds = [
        ...(Array.isArray(clause?.depends_on) ? clause.depends_on : []),
        ...(Array.isArray(clause?.required_with) ? clause.required_with : []),
      ];

      for (const requiredClauseId of requiredClauseIds) {
        if (!requiredClauseId || existingClauseIds.has(requiredClauseId)) {
          continue;
        }

        const referencedClause = getClauseById(requiredClauseId);
        if (!referencedClause || !isClauseCompatibleWithDocument(referencedClause, documentType)) {
          continue;
        }

        const injectedClause = buildInjectedClauseFromKB(requiredClauseId, variables);
        if (!injectedClause) {
          continue;
        }

        resolvedClauses.push(injectedClause);
        existingClauseIds.add(requiredClauseId);
        changed = true;
      }
    }
  }

  return resolvedClauses;
}

function resolveFallbackDependencies(draft, variables = {}) {
  const existingCategories = new Set(draft.clauses.map((clause) => clause.category));
  const existingClauseIds = new Set(draft.clauses.map((clause) => clause.clause_id));
  const resolvedClauses = [...draft.clauses];

  for (const rule of DEPENDENCY_RULES) {
    const triggerActivated = rule.trigger_condition
      ? rule.trigger_condition({ ...draft, clauses: resolvedClauses })
      : existingCategories.has(rule.trigger_category);

    if (
      triggerActivated &&
      !existingClauseIds.has(rule.required_clause_id) &&
      !existingCategories.has(rule.category)
    ) {
      const injectedFromKb = buildInjectedClauseFromKB(rule.required_clause_id, variables);
      const injectedClause =
        injectedFromKb ||
        {
          clause_id: rule.required_clause_id,
          category: rule.category,
          title: rule.title,
          text: injectVariables(rule.fallback_text, variables),
          injected_by: "dependencyResolver",
        };

      resolvedClauses.push(injectedClause);
      existingCategories.add(injectedClause.category);
      existingClauseIds.add(injectedClause.clause_id);
    }
  }

  return resolvedClauses;
}

export function resolveDependencies(draft, input = {}) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const variables = input.variables || draft.metadata?.source_variables || {};
  const documentType = input.document_type || draft.document_type;
  const clausesWithKbDependencies = resolveExplicitKbDependencies(
    draft.clauses,
    variables,
    documentType
  );
  const clausesWithFallbacks = resolveFallbackDependencies(
    { ...draft, clauses: clausesWithKbDependencies },
    variables
  );

  return {
    ...draft,
    clauses: clausesWithFallbacks,
  };
}
