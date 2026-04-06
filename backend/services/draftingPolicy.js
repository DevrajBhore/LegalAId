import fs from "fs";

import { DOCUMENT_CONFIG } from "../config/documentConfig.js";
import {
  getCanonicalDocumentType,
  getDocumentFamily,
} from "../../shared/documentRegistry.js";

const POLICY_FILE = new URL(
  "../../knowledge-base/metadata/drafting_policies.json",
  import.meta.url
);

const UNIVERSAL_PARTY_TERMS = [
  "Party 1",
  "Party 2",
  "Disclosing Party",
  "Receiving Party",
  "Discloser",
  "Recipient",
  "Employer",
  "Employee",
  "Client",
  "Consultant",
  "Service Provider",
  "Contractor",
  "Developer",
  "Supplier",
  "Buyer",
  "Seller",
  "Principal",
  "Distributor",
  "Landlord",
  "Tenant",
  "Licensor",
  "Licensee",
  "Lender",
  "Borrower",
  "Creditor",
  "Principal Debtor",
  "Guarantor",
  "Partner 1",
  "Partner 2",
  "Shareholder 1",
  "Shareholder 2",
];

const PREFERRED_CANONICAL_LABELS = [
  "Disclosing Party",
  "Receiving Party",
  "Employer",
  "Employee",
  "Client",
  "Consultant",
  "Service Provider",
  "Contractor",
  "Developer",
  "Supplier",
  "Buyer",
  "Seller",
  "Principal",
  "Distributor",
  "Landlord",
  "Tenant",
  "Licensor",
  "Licensee",
  "Creditor",
  "Lender",
  "Borrower",
  "Principal Debtor",
  "Guarantor",
  "Partner 1",
  "Partner 2",
  "Shareholder 1",
  "Shareholder 2",
  "Party 1",
  "Party 2",
];

const PRIORITY_PARTICIPANT_GROUPS = [
  ["party_1", "party_2", "guarantor"],
  ["employer", "employee"],
  ["partner_1", "partner_2"],
  ["shareholder_1", "shareholder_2"],
];

const EXCLUDED_FALLBACK_BASES = new Set([
  "company",
  "partnership",
  "business",
  "project",
  "product",
  "goods",
  "board",
  "bank",
]);

let draftingPolicyCache = null;

function loadDraftingPolicySource() {
  if (!draftingPolicyCache) {
    draftingPolicyCache = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8"));
  }

  return draftingPolicyCache;
}

function mergePolicy(base = {}, overlay = {}) {
  const result = { ...(base || {}) };

  for (const [key, value] of Object.entries(overlay || {})) {
    if (Array.isArray(value)) {
      result[key] = [...value];
      continue;
    }

    if (value && typeof value === "object") {
      result[key] = mergePolicy(result[key] || {}, value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function normalizeDocumentType(documentType = "") {
  return String(getCanonicalDocumentType(documentType) || documentType || "")
    .trim()
    .toUpperCase();
}

function getDocumentConfig(documentType = "") {
  return DOCUMENT_CONFIG?.[normalizeDocumentType(documentType)] || {};
}

function getConfiguredFields(documentType = "") {
  const config = getDocumentConfig(documentType);
  const fields = new Set(config.requiredFields || []);

  for (const section of config.sections || []) {
    for (const field of section.fields || []) {
      fields.add(field);
    }
  }

  return fields;
}

function humanizeToken(token = "") {
  return String(token || "")
    .split("_")
    .filter(Boolean)
    .map((part) =>
      /^\d+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join(" ");
}

function cleanSectionTitle(title = "") {
  const cleaned = String(title || "")
    .replace(/\bdetails\b/gi, "")
    .replace(/\binformation\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned.includes("/")) {
    return cleaned;
  }

  const options = cleaned
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const preferred of PREFERRED_CANONICAL_LABELS) {
    const match = options.find(
      (option) => option.toLowerCase() === preferred.toLowerCase()
    );
    if (match) {
      return match;
    }
  }

  return options[0] || cleaned;
}

function findSectionForField(documentType, fieldName) {
  const config = getDocumentConfig(documentType);
  return (config.sections || []).find((section) =>
    (section.fields || []).includes(fieldName)
  );
}

function buildParticipantDefinition(base, documentType) {
  const configuredFields = getConfiguredFields(documentType);
  const nameField = `${base}_name`;

  if (!configuredFields.has(nameField)) {
    return null;
  }

  const section = findSectionForField(documentType, nameField);
  const humanizedBase = humanizeToken(base);
  const canonical =
    cleanSectionTitle(section?.title || "") || humanizedBase || "Party";

  const aliases = [];

  if (base === "party_1") aliases.push("Party 1");
  if (base === "party_2") aliases.push("Party 2");
  if (humanizedBase && humanizedBase.toLowerCase() !== canonical.toLowerCase()) {
    aliases.push(humanizedBase);
  }

  return {
    id: base,
    canonical,
    aliases: [...new Set(aliases.filter(Boolean))],
    nameField,
    addressField: configuredFields.has(`${base}_address`)
      ? `${base}_address`
      : null,
    typeField: configuredFields.has(`${base}_type`) ? `${base}_type` : null,
  };
}

function deriveParticipantBases(documentType = "") {
  const configuredFields = getConfiguredFields(documentType);

  for (const group of PRIORITY_PARTICIPANT_GROUPS) {
    const present = group.filter((base) => configuredFields.has(`${base}_name`));
    if (present.length >= 2) {
      return present;
    }
  }

  const discovered = [];
  const config = getDocumentConfig(documentType);

  for (const section of config.sections || []) {
    for (const field of section.fields || []) {
      if (!field.endsWith("_name")) continue;
      const base = field.slice(0, -5);
      if (EXCLUDED_FALLBACK_BASES.has(base)) continue;
      if (!discovered.includes(base)) {
        discovered.push(base);
      }
    }
  }

  return discovered;
}

function getParticipantDefinitions(documentType = "") {
  const participants = deriveParticipantBases(documentType)
    .map((base) => buildParticipantDefinition(base, documentType))
    .filter(Boolean);
  const namingParticipants =
    getDocumentDraftingPolicy(documentType)?.naming?.participants || {};
  const positions = ["first", "second", "third", "fourth"];

  return participants.map((participant, index) => {
    const position = positions[index];
    const overrides = namingParticipants[position] || {};
    const aliases = new Set(participant.aliases || []);

    if (index === 0 && participant.canonical.toLowerCase() !== "party 1") {
      aliases.add("Party 1");
    }
    if (index === 1 && participant.canonical.toLowerCase() !== "party 2") {
      aliases.add("Party 2");
    }
    for (const alias of overrides.aliases || []) {
      aliases.add(alias);
    }

    return {
      ...participant,
      canonical: overrides.canonical || participant.canonical,
      aliases: [...aliases].filter(Boolean),
    };
  });
}

function withArticle(label = "") {
  if (!label) return "";
  return /^the\s+/i.test(label) ? label : `the ${label}`;
}

function formatLabelList(labels = []) {
  const values = labels.filter(Boolean).map((label) => `"${label}"`);

  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function resolveRoleTargetLabel(target, namedParties = {}) {
  if (!target) return "";
  if (target === "first") return namedParties.first || "";
  if (target === "second") return namedParties.second || "";
  if (target === "third") return namedParties.third || "";
  return String(target || "").trim();
}

function buildRoleReference(target, namedParties = {}, fallback = "") {
  const label = resolveRoleTargetLabel(target, namedParties) || fallback;
  return {
    label,
    ref: withArticle(label),
  };
}

export function getDocumentDraftingPolicy(documentType = "") {
  const canonicalType = normalizeDocumentType(documentType);
  const source = loadDraftingPolicySource();
  const family = getDocumentFamily(canonicalType);

  return [source.defaults || {}, source.families?.[family] || {}, source.documents?.[canonicalType] || {}]
    .reduce((merged, entry) => mergePolicy(merged, entry), {});
}

export function getDocumentStyleProfile(documentType = "") {
  return getDocumentDraftingPolicy(documentType)?.style || {};
}

export function getParticipantExpectations(documentType = "", variables = {}) {
  return getParticipantDefinitions(documentType)
    .map((participant) => ({
      id: participant.id,
      label: participant.canonical,
      name: variables?.[participant.nameField],
      address: participant.addressField ? variables?.[participant.addressField] : undefined,
      type: participant.typeField ? variables?.[participant.typeField] : undefined,
    }))
    .filter((participant) => participant.name || participant.address);
}

export function getPartyNamingRule(documentType = "") {
  const participants = getParticipantDefinitions(documentType);
  if (!participants.length) {
    return null;
  }

  const allowedTerms = new Set();
  for (const participant of participants) {
    allowedTerms.add(participant.canonical.toLowerCase());
    for (const alias of participant.aliases || []) {
      allowedTerms.add(alias.toLowerCase());
    }
  }

  return {
    participants,
    first: participants[0] || null,
    second: participants[1] || null,
    forbiddenTerms: [
      ...UNIVERSAL_PARTY_TERMS.filter((term) => !allowedTerms.has(term.toLowerCase())),
      ...(getDocumentDraftingPolicy(documentType)?.naming?.extraForbiddenTerms || []),
    ].filter((term, index, list) => list.indexOf(term) === index),
  };
}

export function getPartyNamingLabels(documentType = "") {
  const rule = getPartyNamingRule(documentType);
  if (!rule) return null;

  return {
    first: rule.first?.canonical || "Party 1",
    second: rule.second?.canonical || "Party 2",
  };
}

export function getForbiddenPartyTerms(documentType = "") {
  return getPartyNamingRule(documentType)?.forbiddenTerms || [];
}

export function getPartyNamingPrompt(documentType = "") {
  const rule = getPartyNamingRule(documentType);
  if (!rule) {
    return "";
  }

  const labels = formatLabelList(
    rule.participants.map((participant) => participant.canonical)
  );
  const forbiddenTerms = formatLabelList(rule.forbiddenTerms);

  return [
    labels
      ? `For this document, define the parties once and then refer to them consistently as ${labels}.`
      : "",
    forbiddenTerms
      ? `Do not switch later to generic or conflicting labels such as ${forbiddenTerms}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getDocumentRoleContext(documentType = "") {
  const policy = getDocumentDraftingPolicy(documentType);
  const rule = getPartyNamingRule(documentType);
  const participants = rule?.participants || [];
  const namedParties = {
    first: participants[0]?.canonical || "Party 1",
    second: participants[1]?.canonical || "Party 2",
    third: participants[2]?.canonical || "",
    participants,
  };

  return {
    namedParties,
    payer: buildRoleReference(policy.roles?.payer || "first", namedParties, namedParties.first),
    payee: buildRoleReference(policy.roles?.payee || "second", namedParties, namedParties.second),
    performer: buildRoleReference(
      policy.roles?.performer || "second",
      namedParties,
      namedParties.second
    ),
    reviewer: buildRoleReference(
      policy.roles?.reviewer || "first",
      namedParties,
      namedParties.first
    ),
  };
}
