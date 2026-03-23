import { inferDomainRequirements } from "./domainInference.js";
import { loadStatutesForDomain } from "./statuteLoader.js";
import { loadSectionsForAct } from "./sectionLoader.js";
import { compileRulesFromAct } from "./ruleCompiler.js";
import { compareDraftAgainstRules } from "./ruleComparator.js";

/**
 * Dynamic Statutory KB Validation Engine
 */
export async function runStatutoryValidation(draft) {

  const issues = [];

  try {

    // 1️⃣ Infer legal domains
    const domains = inferDomainRequirements(
      draft.document_type,
      draft
    );

    const compiledRules = [];

    // 2️⃣ Load relevant statutes
    for (const domain of domains) {

      const acts = loadStatutesForDomain(domain);

      for (const act of acts) {

        // 3️⃣ Load sections
        const sections = loadSectionsForAct(act.act_id);

        // 4️⃣ Compile rules
        const rules = compileRulesFromAct(act, sections);

        compiledRules.push(...rules);
      }
    }

    // 5️⃣ Deduplicate rules (same act loaded for multiple domains)
    const uniqueRules = [];
    const seenRuleIds = new Set();
    for (const rule of compiledRules) {
      if (!seenRuleIds.has(rule.rule_id)) {
        seenRuleIds.add(rule.rule_id);
        uniqueRules.push(rule);
      }
    }

    // 6️⃣ Compare draft against unique statutory rules
    const statutoryIssues = compareDraftAgainstRules(draft, uniqueRules);
    issues.push(...statutoryIssues);

  } catch (err) {
    console.error("Statutory engine failed safely:", err);
  }

  return issues;
}