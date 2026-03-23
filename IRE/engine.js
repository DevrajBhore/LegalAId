import { bootstrapIRE } from "./bootstrap.js";
import { runIRE } from "./src/indian-rule-engine/index.js";
import { runUniversalValidation } from "./src/universal/universalEngine.js";
import { runStatutoryValidation } from "./src/statutes/statutoryEngine.js";
import { illegalClauseValidate } from "./src/indian-rule-engine/illegalClauseValidator.js";
import { stampDutyValidate } from "./src/indian-rule-engine/stampDutyValidator.js";
import { aiLegalSafetyValidate } from "./src/indian-rule-engine/aiLegalSafetyValidator.js";

// Import validators directly so their output isn't lost inside runIRE → certify()
// certify() returns only {certified, risk_level, issue_count} and discards the issues array
import { completenessValidate } from "./src/indian-rule-engine/completenessValidator.js";
import { executionValidate } from "./src/indian-rule-engine/executionValidator.js";
import { semanticValidate } from "./src/indian-rule-engine/semanticValidator.js";
import { validateDocument as structuralValidate } from "./src/indian-rule-engine/documentValidator.js";
import { planDocument } from "./src/indian-rule-engine/planner.js";
import { validateBlueprint } from "./src/indian-rule-engine/blueprintValidator.js";

// Bootstrap once at module load — singleton registry
const registry = bootstrapIRE();

function normalizeDocumentType(type) {
  const map = {
    // Frontend documentConfig name → IRE registry key
    EMPLOYMENT_CONTRACT: "EMPLOYMENT_AGREEMENT",
    EMPLOYMENT_AGREEMENT: "EMPLOYMENT_AGREEMENT",
    NDA: "NDA",
    SERVICE_AGREEMENT: "SERVICE_AGREEMENT",
    SERVICE_PROVIDER_AGREEMENT: "SERVICE_AGREEMENT",
    CONSULTANCY_AGREEMENT: "CONSULTANCY_AGREEMENT",
    INDEPENDENT_CONTRACTOR_AGREEMENT: "INDEPENDENT_CONTRACTOR_AGREEMENT",
    INDEPENDENT_CONTRACTOR: "INDEPENDENT_CONTRACTOR_AGREEMENT",
    SUPPLY_AGREEMENT: "SUPPLY_AGREEMENT",
    DISTRIBUTION_AGREEMENT: "DISTRIBUTION_AGREEMENT",
    SALES_OF_GOODS_AGREEMENT: "SALES_OF_GOODS_AGREEMENT",
    PARTNERSHIP_DEED: "PARTNERSHIP_DEED",
    SHAREHOLDERS_AGREEMENT: "SHAREHOLDERS_AGREEMENT",
    JOINT_VENTURE_AGREEMENT: "JOINT_VENTURE_AGREEMENT",
    COMMERCIAL_LEASE_AGREEMENT: "COMMERCIAL_LEASE_AGREEMENT",
    LEAVE_AND_LICENSE_AGREEMENT: "LEAVE_AND_LICENSE_AGREEMENT",
    LEAVE_AND_LICENSE: "LEAVE_AND_LICENSE_AGREEMENT",
    LOAN_AGREEMENT: "LOAN_AGREEMENT",
    GUARANTEE_AGREEMENT: "GUARANTEE_AGREEMENT",
    SOFTWARE_DEVELOPMENT_AGREEMENT: "SOFTWARE_DEVELOPMENT_AGREEMENT",
    MOU: "MOU",
    PRIVACY_POLICY: "PRIVACY_POLICY",
    ADDENDUM: "SERVICE_AGREEMENT",
    RENTAL_AGREEMENT: "RENTAL_AGREEMENT",
    Rental: "RENTAL_AGREEMENT",
    Employment: "EMPLOYMENT_AGREEMENT",
    Service: "SERVICE_AGREEMENT",
    PrivacyPolicy: "PRIVACY_POLICY",
  };
  return map[type] || type;
}

/**
 * Main validation entry point.
 *
 * @param {string}  documentType   - e.g. "NDA", "EMPLOYMENT_AGREEMENT"
 * @param {Array}   draftedClauses - [{clause_id, category, title, text, ...}]
 * @param {Object}  [meta]         - optional: { state, stampDutyPaid, financials }
 *
 * @returns {{ issues, certified, risk_level, _layers }}
 */
export async function validateDocument(
  documentType,
  draftedClauses,
  meta = {},
  { isUserEdit = false } = {}
) {
  const normalizedType = normalizeDocumentType(documentType);

  const draft = {
    document_type: documentType,
    clauses: draftedClauses,
    metadata: meta,
    financials: meta.financials || {},
  };

  // ── Layer 1a: Blueprint (required clause IDs for this doc type) ──────────
  const requiredClauses = planDocument(registry, normalizedType);
  const blueprintIssues = validateBlueprint(requiredClauses, draftedClauses);

  // ── Layer 1b: Structural (per-doctype required categories + constraints) ─
  const structuralResult = structuralValidate(registry, draft);
  const structuralIssues = structuralResult.violations || [];

  // ── Layer 1c: Completeness, execution, semantic ─────────────────────────
  // These are collected directly — runIRE() wraps them in certify() which
  // strips the issues array, so we run them here to preserve their output.
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

  // ── Layer 2: Universal doctrine (ICA, consent, consideration, etc.) ──────
  const universal = runUniversalValidation(draft);
  const universalIssues = universal.issues || [];

  // ── Layer 3: Statutory KB validation (IndiaCode sections) ───────────────
  const statutory = await runStatutoryValidation(draft);
  // runStatutoryValidation returns array directly
  const statutoryIssues = Array.isArray(statutory)
    ? statutory
    : statutory.issues || [];

  // ── Layer 4: Illegal clause detection ────────────────────────────────────
  const illegalIssues = illegalClauseValidate(draft);

  // ── Layer 5: Stamp duty compliance ───────────────────────────────────────
  const stampIssues = stampDutyValidate(draft, meta);

  // ── Layer 6: AI clause integrity check (only on user-triggered deep validate)
  // Catches anything no regex can: injected nonsense, abusive text, disguised
  // illegal clauses, incoherent language — anything that makes a clause not
  // genuine legal text. Only runs when the user explicitly clicks Validate.
  const aiIntegrityIssues = await aiLegalSafetyValidate(draft, { isUserEdit });

  // ── Merge + deduplicate ──────────────────────────────────────────────────
  const allIssues = [
    ...layer1Issues,
    ...universalIssues,
    ...statutoryIssues,
    ...illegalIssues,
    ...stampIssues,
    ...aiIntegrityIssues,
  ];

  const deduped = deduplicate(allIssues);
  const risk_level = calculateRisk(deduped);

  return {
    issues: deduped,
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
      illegal_issues: illegalIssues.length,
      stamp_issues: stampIssues.length,
      ai_integrity_issues: aiIntegrityIssues.length,
      total_before_dedup: allIssues.length,
      total_after_dedup: deduped.length,
    },
  };
}

function calculateRisk(issues) {
  // Only CRITICAL and HIGH affect risk level
  // MEDIUM = advisory, LOW = informational — never block certification
  const critical = issues.filter((i) => i.severity === "CRITICAL").length;
  const high = issues.filter((i) => i.severity === "HIGH").length;
  const medium = issues.filter((i) => i.severity === "MEDIUM").length;

  if (critical > 0) return "BLOCKED";
  if (high > 1) return "HIGH";
  if (high === 1) return "MEDIUM";
  if (medium > 2) return "MEDIUM";
  return "LOW";
}

function deduplicate(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    if (!issue?.rule_id) return true;
    if (seen.has(issue.rule_id)) return false;
    seen.add(issue.rule_id);
    return true;
  });
}
