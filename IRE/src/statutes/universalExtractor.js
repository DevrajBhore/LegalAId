import { RULE_TYPES } from "./ruleTypes.js";

export function extractUniversalRules(actTitle, section) {
  const text = typeof section?.text === "string" ? section.text : "";
  if (!text) return [];
  const rules = [];

  // 1️⃣ Prohibition
  if (/no\s+\w+\s+shall/i.test(text)) {
    rules.push({
      act: actTitle,
      section: section.section_number,
      type: RULE_TYPES.PROHIBITION,
      raw: text,
    });
  }

  // 2️⃣ Mandatory obligation
  if (/\bshall\b|\bmust\b/i.test(text)) {
    rules.push({
      act: actTitle,
      section: section.section_number,
      type: RULE_TYPES.MANDATORY,
      raw: text,
    });
  }

  // 3️⃣ Numeric threshold
  const numericMatch = text.match(/(\d+)\s*(day|month|year|rupee|₹)/i);
  if (numericMatch) {
    rules.push({
      act: actTitle,
      section: section.section_number,
      type: RULE_TYPES.NUMERIC_THRESHOLD,
      value: numericMatch[1],
      unit: numericMatch[2],
      raw: text,
    });
  }

  // 4️⃣ Registration requirement
  if (/shall\s+be\s+registered/i.test(text)) {
    rules.push({
      act: actTitle,
      section: section.section_number,
      type: RULE_TYPES.REGISTRATION_REQUIRED,
      raw: text,
    });
  }

  // 5️⃣ Conditional trigger
  if (/\bif\b|\bwhere\b/i.test(text)) {
    rules.push({
      act: actTitle,
      section: section.section_number,
      type: RULE_TYPES.CONDITIONAL,
      raw: text,
    });
  }

  return rules;
}
