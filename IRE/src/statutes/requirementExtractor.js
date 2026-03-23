import { createRequirement } from "./requirementSchema.js";
import {
  extractNoticePeriod,
  extractMandatoryLanguage,
  detectCondition
} from "./patternExtractors.js";

export function extractRequirementsFromSection(actTitle, section) {

  const text = section.text;
  const requirements = [];

  const notice = extractNoticePeriod(text);
  const mandatory = extractMandatoryLanguage(text);
  const condition = detectCondition(text);

  if (notice && mandatory && condition) {
    requirements.push(
      createRequirement({
        act: actTitle,
        section: section.section_number,
        rule_type: "MINIMUM_NOTICE",
        threshold: notice.value,
        unit: notice.unit,
        condition,
        severity: "CRITICAL"
      })
    );
  }

  return requirements;
}