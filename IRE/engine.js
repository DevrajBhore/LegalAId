import { bootstrapIRE } from "./bootstrap.js";
import { runIRE } from "./src/indian-rule-engine/index.js";
import { runUniversalValidation } from "./src/universal/universalEngine.js";
import { runStatutoryValidation } from "./src/statutes/statutoryEngine.js";
import { illegalClauseValidate } from "./src/indian-rule-engine/illegalClauseValidator.js";
import { stampDutyValidate } from "./src/indian-rule-engine/stampDutyValidator.js";
import { aiLegalSafetyValidate } from "./src/indian-rule-engine/aiLegalSafetyValidator.js";
import { toIREDocType } from "../shared/documentRegistry.js";

import { completenessValidate } from "./src/indian-rule-engine/completenessValidator.js";
import { executionValidate } from "./src/indian-rule-engine/executionValidator.js";
import { semanticValidate } from "./src/indian-rule-engine/semanticValidator.js";
import { validateDocument as structuralValidate } from "./src/indian-rule-engine/documentValidator.js";
import { planDocument } from "./src/indian-rule-engine/planner.js";
import { validateBlueprint } from "./src/indian-rule-engine/blueprintValidator.js";

const registry = bootstrapIRE();
const VALIDATION_MODES = new Set(["background", "generation", "final"]);

function isStructuredDraft(meta = {}) {
  return Boolean(
    meta?.blueprint_clause_count ||
      meta?.loaded_clause_count ||
      meta?.baseline_clause_map ||
      meta?.source_variables
  );
}

/**
 * Main validation entry point.
 *
 * @param {string}  documentType   
 * @param {Array}   draftedClauses 
 * @param {Object}  [meta]         
 *
 * @returns {{ mode, issues, certified, risk_level, _layers }}
 */
export async function validateDocument(
  documentType,
  draftedClauses,
  meta = {},
  { mode = "final", isUserEdit = false } = {}
) {
  const validationMode = normalizeValidationMode(mode, isUserEdit);
  const normalizedType = toIREDocType(documentType);
  const structuredDraft = isStructuredDraft(meta);

  const draft = {
    document_type: documentType,
    clauses: draftedClauses,
    metadata: meta,
    financials: meta.financials || {},
  };

  // ── Layer 1a: Blueprint (required clause IDs for this doc type)
  const requiredClauses = planDocument(registry, normalizedType);
  const blueprintIssues = structuredDraft
    ? validateBlueprint(requiredClauses, draftedClauses)
    : [];

  // ── Layer 1b: Structural (per-doctype required categories + constraints)
  const structuralResult = structuralValidate(registry, draft, {
    enforceClauseOrdering: structuredDraft,
    enforceExactConstraintRules: structuredDraft,
  });
  const structuralIssues = structuralResult.violations || [];

  // ── Layer 1c: Completeness, execution, semantic 
  const completenessIssues = completenessValidate({ clauses: draftedClauses });
  const executionIssues = executionValidate({ clauses: draftedClauses });
  const semanticIssues = semanticValidate({ clauses: draftedClauses });

  const layer1Issues = [
    ...blueprintIssues,
    ...structuralIssues,
    ...completenessIssues,
    ...executionIssues,
    ...semanticIssues,
  ];

  // ── Layer 2: Universal doctrine (ICA, consent, consideration, etc.)
  const universalIssues = shouldRunUniversal(validationMode)
    ? runUniversalValidation(draft).issues || []
    : [];

  // ── Layer 3: Statutory KB validation (IndiaCode sections)
  let statutoryIssues = [];
  let statutoryContext = null;
  if (shouldRunStatutory(validationMode)) {
    const statutory = await runStatutoryValidation(draft);
    if (Array.isArray(statutory)) {
      statutoryIssues = statutory;
    } else {
      statutoryIssues = statutory.issues || [];
      statutoryContext = statutory.context || null;
    }
  }

  // ── Layer 4: Illegal clause detection 
  const illegalIssues = illegalClauseValidate(draft);

  // ── Layer 5: Stamp duty compliance
  const stampIssues = shouldRunStamp(validationMode)
    ? stampDutyValidate(draft, meta)
    : [];

  // ── Layer 6: AI clause integrity check (only on user-triggered deep validate)
  const aiIntegrityIssues = shouldRunAISafety(validationMode)
    ? await aiLegalSafetyValidate(draft, {
        isUserEdit:
          isUserEdit === true ||
          meta?.ai_touched === true ||
          meta?.user_edited === true,
      })
    : [];
              
  const nonStampIssues = [
    ...layer1Issues,
    ...universalIssues,
    ...statutoryIssues,
    ...illegalIssues,
    ...aiIntegrityIssues,
  ];

  const deduped = deduplicate(nonStampIssues);
  const dedupedStamp = deduplicate(stampIssues);  
  const allDeduped = [...deduped, ...dedupedStamp];

  const risk_level = calculateRisk(deduped);                      

  return {
    mode: validationMode,
    issues: allDeduped,
    certified: risk_level !== "BLOCKED",
    risk_level,
    _layers: {
      blueprint_issues: blueprintIssues.length,
      structural_issues: structuralIssues.length,
      completeness_issues: completenessIssues.length,
      execution_issues: executionIssues.length,
      semantic_issues: semanticIssues.length,
      universal_issues: universalIssues.length,
      statutory_issues: statutoryIssues.length,
      subordinate_notice_issues: statutoryIssues.filter(
        (issue) => issue?.rule_id === "SUBORDINATE_LEGISLATION_REVIEW"
      ).length,
      subordinate_profile_notice_issues:
        statutoryContext?.subordinate?.profile_notice_count || 0,
      subordinate_scanned_acts: statutoryContext?.subordinate?.scanned_acts || 0,
      subordinate_acts_with_law:
        statutoryContext?.subordinate?.acts_with_subordinate || 0,
      subordinate_total_entries:
        statutoryContext?.subordinate?.total_subordinate_entries || 0,
      illegal_issues: illegalIssues.length,
      stamp_issues: stampIssues.length,
      ai_integrity_issues: aiIntegrityIssues.length,
      total_before_dedup: nonStampIssues.length + stampIssues.length,
      total_after_dedup: allDeduped.length,
    },
  };
}

function normalizeValidationMode(mode, _isUserEdit) {
  if (VALIDATION_MODES.has(mode)) return mode;
  return "final";
}

function shouldRunUniversal(mode) {
  return mode === "generation" || mode === "final";
}

function shouldRunStatutory(mode) {
  return mode === "final";
}

function shouldRunStamp(mode) {
  return mode === "final";
}

function shouldRunAISafety(mode) {
  return mode === "final";
}

function calculateRisk(issues) {
  // Single-pass severity counting — faster than triple .filter()
  let critical = 0, high = 0, medium = 0;
  for (const issue of issues) {
    switch (issue.severity) {
      case "CRITICAL": critical++; break;
      case "HIGH":     high++;     break;
      case "MEDIUM":   medium++;   break;
    }
  }

  if (critical > 0) return "BLOCKED";
  if (high > 1) return "HIGH";
  if (high === 1) return "MEDIUM";
  if (medium > 2) return "MEDIUM";
  return "LOW";
}

function deduplicate(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = [
      issue?.rule_id || "UNKNOWN_RULE",
      issue?.offending_clause_id || "",
      issue?.message || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
