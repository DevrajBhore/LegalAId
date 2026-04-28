import { buildDocumentFields } from "./documentIntakeConfig.js";
import { buildDocumentTypeMeta } from "./documentTypeNormalizer.js";
import { callAISafetyRaw } from "../ai/aiClient.js";

const INTAKE_ASSISTANT_SCHEMA = {
  type: "object",
  required: ["reply", "suggested_updates"],
  properties: {
    reply: { type: "string" },
    suggested_updates: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "value", "reason"],
        properties: {
          field: { type: "string" },
          value: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

function stringifyFieldSummary(field) {
  const parts = [
    `name=${field.name}`,
    `label=${field.label}`,
    `type=${field.type}`,
    field.required ? "required=yes" : "required=no",
  ];

  if (field.description) parts.push(`description=${field.description}`);
  if (field.example) parts.push(`example=${field.example}`);
  if (field.aiGuidance) parts.push(`aiGuidance=${field.aiGuidance}`);
  if (field.options?.length) parts.push(`options=${field.options.join(" | ")}`);

  return `- ${parts.join(" ; ")}`;
}

function sanitizeSuggestedUpdates(suggestedUpdates, allowedFields) {
  return (Array.isArray(suggestedUpdates) ? suggestedUpdates : [])
    .map((item) => ({
      field: String(item?.field || "").trim(),
      value: String(item?.value || "").trim(),
      reason: String(item?.reason || "").trim(),
    }))
    .filter(
      (item) =>
        item.field &&
        allowedFields.has(item.field) &&
        item.value &&
        item.reason
    )
    .slice(0, 4);
}

function formatCurrentValues(fields, variables = {}) {
  return fields
    .filter((field) => {
      const value = variables[field.name];
      return value != null && String(value).trim();
    })
    .map((field) => `- ${field.label}: ${String(variables[field.name]).trim()}`)
    .join("\n");
}

export async function getIntakeAssistantResponse({
  documentType,
  variables = {},
  message,
}) {
  const trimmedMessage = String(message || "").trim();
  if (!documentType || !trimmedMessage) {
    throw new Error("documentType and message are required");
  }

  const fields = buildDocumentFields(documentType);
  const allowedFields = new Set(fields.map((field) => field.name));
  const meta = buildDocumentTypeMeta(documentType);

  const prompt = `You are the LegalAId intake assistant for Indian legal drafting.
Help the user fill a contract intake form accurately and practically.

Rules:
- Answer in plain English.
- Be commercially helpful, but do not invent facts the user has not given.
- If a field value is unclear, suggest a sensible draftable placeholder only when safe.
- Only suggest updates for fields from the allowed list below.
- Keep suggestions short and directly usable in the form.
- Do not discuss internal AI systems or providers.

DOCUMENT TYPE: ${meta.displayName || documentType}
DOCUMENT FAMILY: ${meta.family || "Legal"}

AVAILABLE FIELDS:
${fields.map(stringifyFieldSummary).join("\n")}

CURRENT FORM VALUES:
${formatCurrentValues(fields, variables) || "- none filled yet"}

USER MESSAGE:
${trimmedMessage}

Return strict JSON only:
{
  "reply": "short helpful guidance for the user",
  "suggested_updates": [
    {
      "field": "exact_field_name",
      "value": "suggested form value",
      "reason": "why this helps"
    }
  ]
}`;

  const response = await callAISafetyRaw(prompt, {
    schemaName: "intake_assistant_response",
    schema: INTAKE_ASSISTANT_SCHEMA,
  });

  if (!response?.success) {
    return {
      reply:
        response?.error === "RATE_LIMITED"
          ? "The intake assistant is temporarily busy. Please try again in a moment."
          : "The intake assistant is temporarily unavailable. Please try again.",
      suggested_updates: [],
    };
  }

  const data = response.data || {};
  return {
    reply: String(data.reply || "").trim() || "I can help you tighten the inputs for this draft.",
    suggested_updates: sanitizeSuggestedUpdates(
      data.suggested_updates,
      allowedFields
    ),
  };
}
