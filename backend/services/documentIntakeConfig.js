import { DOCUMENT_CONFIG } from "../config/documentConfig.js";
import { getVariables } from "../config/variableConfig.js";
import { ESSENTIAL_FIELDS } from "../config/essentialFields.js";

function buildFieldDefinition(name, variable, requiredFields = [], essentialFields = []) {
  const definition = variable || {};
  return {
    name,
    label: definition.label || name,
    type: definition.type || "text",
    options: definition.options || null,
    // "Required" had two sources that disagreed: DOCUMENT_CONFIG.requiredFields
    // (what the form starred) and variableConfig's own `required` flag (what
    // generation actually demands). 70 fields across the 22 types were in the
    // second but not the first, so the form let a user submit and only then
    // reported "Missing required field". Take either as authoritative.
    required: requiredFields.includes(name) || definition.required === true,
    // Marks fields shown in Quick mode (the minimal set for a usable draft).
    essential: essentialFields.includes(name),
    placeholder: definition.placeholder || "",
    description: definition.description || "",
    example: definition.example || "",
    aiGuidance: definition.aiGuidance || "",
    // Conditional display: { field, equals: [...] }. The form hides this field
    // until the referenced answer is one of the listed values. Serialised here
    // because the response is an explicit whitelist -- without this line the
    // rule exists in variableConfig.js but never reaches the form.
    showIf: definition.showIf || null,
  };
}

function shouldExposeField(name, vars = {}) {
  if (name === "party_1_type") {
    return Object.prototype.hasOwnProperty.call(vars, "party_1_name");
  }

  if (name === "party_2_type") {
    return Object.prototype.hasOwnProperty.call(vars, "party_2_name");
  }

  return true;
}

const AUTO_SECTION_ORDER = [
  "Agreement Basics",
  "Context & Risk Profile",
  "Termination & Remedies",
  "Jurisdiction & Dispute",
  "Commercial & Tax",
  "Risk Allocation",
  "Delivery & Acceptance",
  "Optional Protections",
  "Confidentiality & Use",
  "Employment Terms",
  "Consulting Controls",
  "Governance & Control",
  "Supply & Delivery Controls",
  "Property Compliance",
  "Finance & Security",
  "Technology Delivery",
  "MOU Positioning",
];

const FALLBACK_SECTION_TITLE = "Additional Details";

function buildAutoSections(vars, assignedFields = new Set(), requiredFields = [], essentialFields = []) {
  const groupedFields = new Map();
  const ungroupedFields = [];

  for (const [fieldName, variable] of Object.entries(vars || {})) {
    if (!shouldExposeField(fieldName, vars)) continue;
    if (assignedFields.has(fieldName)) continue;

    const sectionTitle = variable?.group;
    if (!sectionTitle) {
      ungroupedFields.push(
        buildFieldDefinition(fieldName, variable, requiredFields, essentialFields)
      );
      continue;
    }

    if (!groupedFields.has(sectionTitle)) {
      groupedFields.set(sectionTitle, []);
    }

    groupedFields.get(sectionTitle).push(
      buildFieldDefinition(fieldName, variable, requiredFields, essentialFields)
    );
  }

  const autoSections = [...groupedFields.entries()]
    .sort(([left], [right]) => {
      const leftIndex = AUTO_SECTION_ORDER.indexOf(left);
      const rightIndex = AUTO_SECTION_ORDER.indexOf(right);
      const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return safeLeft - safeRight || left.localeCompare(right);
    })
    .map(([title, fields]) => ({ title, fields }));

  if (ungroupedFields.length) {
    autoSections.push({
      title: FALLBACK_SECTION_TITLE,
      fields: ungroupedFields,
    });
  }

  return autoSections;
}

export function buildDocumentFields(documentType) {
  const config = DOCUMENT_CONFIG[documentType];
  const vars = getVariables(documentType);
  const requiredFields = config?.requiredFields || [];
  const essentialFields = ESSENTIAL_FIELDS[documentType] || [];

  return Object.entries(vars)
    .filter(([name]) => shouldExposeField(name, vars))
    .map(([name, variable]) =>
      buildFieldDefinition(name, variable, requiredFields, essentialFields)
    );
}

export function buildDocumentSections(documentType) {
  const config = DOCUMENT_CONFIG[documentType];
  const vars = getVariables(documentType);
  const requiredFields = config?.requiredFields || [];
  const essentialFields = ESSENTIAL_FIELDS[documentType] || [];
  const sections =
    config?.sections?.map((section) => ({
      title: section.title,
      fields: (section.fields || []).map((fieldName) =>
        buildFieldDefinition(fieldName, vars[fieldName], requiredFields, essentialFields)
      ),
    })) || [];
  const assignedFields = new Set(
    sections.flatMap((section) => (section.fields || []).map((field) => field.name))
  );

  return [
    ...sections,
    ...buildAutoSections(vars, assignedFields, requiredFields, essentialFields),
  ];
}

export function validateDocumentIntakeConfiguration() {
  const issues = [];

  for (const [documentType, config] of Object.entries(DOCUMENT_CONFIG)) {
    const vars = getVariables(documentType);
    const availableFields = new Set(Object.keys(vars));
    const sectionFields = new Set(
      buildDocumentSections(documentType)
        .flatMap((section) => section.fields || [])
        .map((field) => field.name)
    );

    for (const requiredField of config.requiredFields || []) {
      if (!availableFields.has(requiredField)) {
        issues.push(
          `${documentType}: required field "${requiredField}" is missing from variableConfig`
        );
      }

      if (!sectionFields.has(requiredField)) {
        issues.push(
          `${documentType}: required field "${requiredField}" is not exposed in the form sections`
        );
      }
    }

    for (const section of config.sections || []) {
      for (const fieldName of section.fields || []) {
        if (!availableFields.has(fieldName)) {
          issues.push(
            `${documentType}: section field "${fieldName}" is missing from variableConfig`
          );
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(
      "Document intake configuration is invalid:\n" +
        issues.map((issue) => `- ${issue}`).join("\n")
    );
  }
}
