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
    // A unilateral published instrument suspends or terminates accounts under
    // its own terms; it has no counterparty to give mutual notice to.
    excluded_document_types: ["TERMS_OF_SERVICE", "PRIVACY_POLICY"],
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

// Categories a document must have exactly ONE of. A dependency on (say) the
// generic CORE_IDENTITY_001 is satisfied by a document-specific identity clause
// (e.g. GUARANTEE_IDENTITY_001) that already occupies that role — injecting a
// second one creates a duplicate that later dedup may resolve in favour of the
// wrong (generic) clause, dropping the blueprint-required one.
const SINGLETON_ROLE_CATEGORIES = new Set(["IDENTITY", "SIGNATURE_BLOCK"]);

/**
 * A dependency a document type must NOT have, whatever the clause metadata says.
 *
 * CORE_GOVERNING_LAW_001 declares required_with: CORE_DISPUTE_RESOLUTION_001,
 * which is right for a commercial contract and wrong for a statutory policy. It
 * put a commercial arbitration clause into the PoSH policy, alongside the
 * Internal Committee procedure the Act lays down. A policy that appears to route
 * a sexual harassment complaint into contractual arbitration is not merely
 * untidy: the statutory mechanism under Sections 9 to 13 of the Sexual
 * Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act,
 * 2013, and the appeal under Section 18, cannot be displaced by contract.
 */
const SUPPRESSED_DEPENDENCIES = {
  POSH_POLICY: new Set(["CORE_DISPUTE_RESOLUTION_001", "CORE_ARBITRATION_001"]),
};

function isSuppressedDependency(documentType, clauseId) {
  return Boolean(SUPPRESSED_DEPENDENCIES[String(documentType || "").toUpperCase()]?.has(clauseId));
}

/**
 * TWO RELATIONSHIPS, NOT ONE.
 *
 * `depends_on` and `required_with` were concatenated on one line and were
 * therefore synonyms in effect — despite 24 edges being declared under both keys
 * at once, which says an author believed they differed. They do:
 *
 *   depends_on     STRUCTURAL. Clause A is incomplete without B. An indemnity
 *                  procedure with no indemnity to follow refers to nothing.
 *                  Injected whatever the gate decided.
 *
 *   required_with  CONDITIONAL. B is required WHEN B is itself applicable to
 *                  this document. LOAN_DEFAULT_001 naming LOAN_SECURITY_001
 *                  asserted that a default provision presupposes collateral. It
 *                  does not, and the edge put a security clause into every loan
 *                  the borrower had answered as unsecured.
 *
 * `applicabilityExcludedClauseIds` is how the gate's decision reaches here.
 * `null` means NO GATE WAS EVALUATED — a different fact from an empty set, and
 * it must never be read as "the target applies". See the diagnostic below.
 */
function resolveExplicitKbDependencies(
  clauses = [],
  variables = {},
  documentType = "",
  replacedClauseIds = new Set(),
  applicabilityExcludedClauseIds = null,
  diagnostics = []
) {
  const applicabilityKnown = applicabilityExcludedClauseIds instanceof Set;
  const resolvedClauses = [...clauses];
  const existingClauseIds = new Set(
    resolvedClauses.map((clause) => String(clause.clause_id || ""))
  );
  const existingSingletonRoles = new Set(
    resolvedClauses
      .map((clause) => normalizeClauseCategory(clause.category))
      .filter((category) => SINGLETON_ROLE_CATEGORIES.has(category))
  );

  let changed = true;
  while (changed) {
    changed = false;

    for (const clause of [...resolvedClauses]) {
      const requiredClauseIds = [
        ...(Array.isArray(clause?.depends_on) ? clause.depends_on : [])
          .map((id) => ({ id, relationship: "depends_on" })),
        ...(Array.isArray(clause?.required_with) ? clause.required_with : [])
          .map((id) => ({ id, relationship: "required_with" })),
      ];

      for (const { id: requiredClauseId, relationship } of requiredClauseIds) {
        if (!requiredClauseId || existingClauseIds.has(requiredClauseId)) {
          continue;
        }

        // A CONDITIONAL dependency may not obtain its applicability from the
        // absence of an exclusion record.
        if (relationship === "required_with") {
          if (!applicabilityKnown) {
            // Not thrown: generation must not die because a repair or revision
            // path handed us a draft without selection metadata. Refused and
            // recorded, because the alternative — injecting anyway — is exactly
            // the original defect wearing a new API.
            diagnostics.push({
              clause_id: clause.clause_id,
              required_clause_id: requiredClauseId,
              relationship,
              reason:
                "required_with could not be honoured: no applicability decision reached the " +
                "dependency resolver, so whether the target applies to this document is " +
                "unknown. The clause was NOT injected. If this draft did not come from clause " +
                "selection, that is the gap to close.",
            });
            continue;
          }
          if (applicabilityExcludedClauseIds.has(requiredClauseId)) {
            diagnostics.push({
              clause_id: clause.clause_id,
              required_clause_id: requiredClauseId,
              relationship,
              reason:
                "required_with not honoured because the target's own applicability gate " +
                "excluded it from this document. A conditional dependency does not outrank " +
                "the condition.",
            });
            continue;
          }
        }

        // Don't re-inject a clause that a variant slot deliberately swapped out
        // (its replacement is already present and covers the role).
        if (replacedClauseIds.has(requiredClauseId)) {
          continue;
        }

        if (isSuppressedDependency(documentType, requiredClauseId)) {
          continue;
        }

        const referencedClause = getClauseById(requiredClauseId);
        if (!referencedClause || !isClauseCompatibleWithDocument(referencedClause, documentType)) {
          continue;
        }

        // Don't inject a generic singleton-role clause when the draft already
        // has one (e.g. a document-specific identity clause).
        const referencedRole = normalizeClauseCategory(referencedClause.category);
        if (
          SINGLETON_ROLE_CATEGORIES.has(referencedRole) &&
          existingSingletonRoles.has(referencedRole)
        ) {
          continue;
        }

        const injectedClause = buildInjectedClauseFromKB(requiredClauseId, variables);
        if (!injectedClause) {
          continue;
        }

        resolvedClauses.push(injectedClause);
        existingClauseIds.add(requiredClauseId);
        if (SINGLETON_ROLE_CATEGORIES.has(referencedRole)) {
          existingSingletonRoles.add(referencedRole);
        }
        changed = true;
      }
    }
  }

  return resolvedClauses;
}

function resolveFallbackDependencies(draft, variables = {}, documentType = "") {
  const existingCategories = new Set(draft.clauses.map((clause) => clause.category));
  const existingClauseIds = new Set(draft.clauses.map((clause) => clause.clause_id));
  const resolvedClauses = [...draft.clauses];

  const normalizedDocumentType = String(documentType || draft.document_type || "").toUpperCase();

  for (const rule of DEPENDENCY_RULES) {
    if (
      Array.isArray(rule.excluded_document_types) &&
      rule.excluded_document_types.includes(normalizedDocumentType)
    ) {
      continue;
    }

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
  const replacedClauseIds = new Set(draft.metadata?.variant_replaced_clause_ids || []);
  // ABSENT and EMPTY are different facts. An empty array means the gates ran and
  // excluded nothing; a missing key means no gate was evaluated at all, and a
  // conditional dependency must refuse rather than assume.
  const excluded = Array.isArray(draft.metadata?.applicability_excluded_clause_ids)
    ? new Set(draft.metadata.applicability_excluded_clause_ids)
    : null;
  const diagnostics = [];
  const clausesWithKbDependencies = resolveExplicitKbDependencies(
    draft.clauses,
    variables,
    documentType,
    replacedClauseIds,
    excluded,
    diagnostics
  );
  const clausesWithFallbacks = resolveFallbackDependencies(
    { ...draft, clauses: clausesWithKbDependencies },
    variables,
    documentType
  );

  return {
    ...draft,
    clauses: clausesWithFallbacks,
    metadata: {
      ...(draft.metadata || {}),
      // Every dependency the resolver declined to honour, and why. A clause that
      // is silently NOT added is as invisible as one silently added.
      dependency_diagnostics: diagnostics,
    },
  };
}
