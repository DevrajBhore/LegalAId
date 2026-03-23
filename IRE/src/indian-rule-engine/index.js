import { planDocument } from "./planner.js";
import { validateBlueprint } from "./blueprintValidator.js";
import { validateDocument } from "./documentValidator.js";
import { completenessValidate } from "./completenessValidator.js";
import { executionValidate } from "./executionValidator.js";
import { semanticValidate } from "./semanticValidator.js";
import { certify } from "./certifier.js";

// Map document → constraint domains
const DOCUMENT_DOMAINS = {
  NDA: ["contract", "confidentiality"],
  Employment: ["contract", "employment"],
  Rental: ["contract", "rental"],
  PrivacyPolicy: ["privacy"],
};

/**
 * Utility: Safe lowercase text
 */
function normalize(text) {
  return (text || "").toString().toLowerCase();
}

/**
 * NDA-Specific Content Validation
 */
function validateNDAContent(clauseMap) {
  const issues = [];

  const definitionText = clauseMap.get("CORE_DEFINITIONS_001");
  const exclusionsText = clauseMap.get("NDA_EXCLUSIONS_001");
  const survivalText = clauseMap.get("NDA_TERM_SURVIVAL_001");
  const formationText = clauseMap.get("CORE_CONTRACT_FORMATION_001");

  // =========================
  // 1️⃣ Definition Check
  // =========================
  const definitionValid =
    definitionText &&
    /"confidential information"\s+(shall mean|means)/i.test(definitionText);

  if (!definitionValid) {
    issues.push({
      rule_id: "CONFIDENTIALITY_REQUIRES_DEFINITION",
      severity: "CRITICAL",
      message:
        "Confidential Information must be properly defined using definitional language.",
    });
  }

  // =========================
  // 2️⃣ Exclusions Check
  // =========================
  const exclusionsValid =
    exclusionsText &&
    /(public|independent|prior|third party|required by law)/i.test(
      exclusionsText
    );

  if (!exclusionsValid) {
    issues.push({
      rule_id: "CONFIDENTIALITY_REQUIRES_EXCLUSIONS",
      severity: "CRITICAL",
      message:
        "Confidentiality clause must include standard legal exclusions (public domain, prior knowledge, independent development, third-party receipt, or legal disclosure).",
    });
  }

  // =========================
  // 3️⃣ Survival / Perpetual Logic
  // =========================
  const lowerSurvival = normalize(survivalText);

  const hasIndefinite =
    lowerSurvival.includes("indefinite") || lowerSurvival.includes("perpetual");

  const tradeSecretLimited = lowerSurvival.includes("trade secret");

  if (hasIndefinite && !tradeSecretLimited) {
    issues.push({
      rule_id: "CONFIDENTIALITY_NO_PERPETUAL_RESTRAINT",
      severity: "HIGH",
      message:
        "Perpetual confidentiality without trade-secret limitation may be unenforceable under Section 27 of the Indian Contract Act, 1872.",
    });
  }

  // =========================
  // 4️⃣ Contract Formation Check
  // =========================
  const formationValid =
    formationText &&
    /(free consent|lawful consideration|lawful purpose|lawful object)/i.test(
      formationText
    );

  if (!formationValid) {
    issues.push({
      rule_id: "CONTRACT_FORMATION_REQUIRED",
      severity: "CRITICAL",
      message:
        "Contract must reflect lawful object, lawful consideration, and free consent under the Indian Contract Act, 1872.",
    });
  }

  return issues;
}

/**
 * Main IRE Execution Function
 */
export function runIRE(registry, documentType, draftedClauses = []) {

  console.log(">>> IRE validation started");

  const issues = [];

  // 1️⃣ Blueprint clause enforcement
  const requiredClauses = planDocument(registry, documentType);
  issues.push(...validateBlueprint(requiredClauses, draftedClauses));

  // 2️⃣ Structural validation
  const structural = validateDocument(registry, { clauses: draftedClauses });
  issues.push(...(structural.violations || []));

  // 3️⃣ Draft completeness validation
  issues.push(...completenessValidate({ clauses: draftedClauses }));

  // 4️⃣ Execution validation
  issues.push(...executionValidate({ clauses: draftedClauses }));

  // 5️⃣ Semantic validation
  issues.push(...semanticValidate({ clauses: draftedClauses }));

  // remove duplicates
  const unique = [];
  const seen = new Set();

  for (const issue of issues) {
    if (!seen.has(issue.rule_id)) {
      unique.push(issue);
      seen.add(issue.rule_id);
    }
  }

  return certify({ issues: unique });

}

export { IndianRuleRegistry } from "./registry.js";
