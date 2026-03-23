import { extractRequirementsFromSection } from "./requirementExtractor.js";

export function buildRulesFromAct(actJSON, sectionsArray) {

  const rules = [];

  for (const section of sectionsArray) {
    const extracted = extractRequirementsFromSection(
      actJSON.title,
      section
    );

    rules.push(...extracted);
  }

  return rules;
}