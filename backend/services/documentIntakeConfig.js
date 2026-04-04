import { DOCUMENT_CONFIG } from "../config/documentConfig.js";
import { getVariables } from "../config/variableConfig.js";

function buildFieldDefinition(name, variable, requiredFields = []) {
  const definition = variable || {};
  return {
    name,
    label: definition.label || name,
    type: definition.type || "text",
    options: definition.options || null,
    required: requiredFields.includes(name),
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

function buildAutoSections(vars, assignedFields = new Set(), requiredFields = []) {
  const groupedFields = new Map();
  const ungroupedFields = [];

  for (const [fieldName, variable] of Object.entries(vars || {})) {
    if (!shouldExposeField(fieldName, vars)) continue;
    if (assignedFields.has(fieldName)) continue;

    const sectionTitle = variable?.group;
    if (!sectionTitle) {
      ungroupedFields.push(
        buildFieldDefinition(fieldName, variable, requiredFields)
      );
      continue;
    }

    if (!groupedFields.has(sectionTitle)) {
      groupedFields.set(sectionTitle, []);
    }

    groupedFields.get(sectionTitle).push(
      buildFieldDefinition(fieldName, variable, requiredFields)
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

  return Object.entries(vars)
    .filter(([name]) => shouldExposeField(name, vars))
    .map(([name, variable]) => buildFieldDefinition(name, variable, requiredFields));
}

export function buildDocumentSections(documentType) {
  const config = DOCUMENT_CONFIG[documentType];
  const vars = getVariables(documentType);
  const requiredFields = config?.requiredFields || [];
  const sections =
    config?.sections?.map((section) => ({
      title: section.title,
      fields: (section.fields || []).map((fieldName) =>
        buildFieldDefinition(fieldName, vars[fieldName], requiredFields)
      ),
    })) || [];
  const assignedFields = new Set(
    sections.flatMap((section) => (section.fields || []).map((field) => field.name))
  );

  return [...sections, ...buildAutoSections(vars, assignedFields, requiredFields)];
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
