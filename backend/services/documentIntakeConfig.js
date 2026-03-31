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

export function buildDocumentFields(documentType) {
  const config = DOCUMENT_CONFIG[documentType];
  const vars = getVariables(documentType);
  const requiredFields = config?.requiredFields || [];

  return Object.entries(vars).map(([name, variable]) =>
    buildFieldDefinition(name, variable, requiredFields)
  );
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

  if (
    vars.operating_state &&
    !sections.some((section) =>
      (section.fields || []).some((field) => field.name === "operating_state")
    )
  ) {
    sections.unshift({
      title: "Jurisdiction Details",
      fields: [
        buildFieldDefinition(
          "operating_state",
          vars.operating_state,
          requiredFields
        ),
      ],
    });
  }

  return sections;
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
