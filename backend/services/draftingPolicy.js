import fs from "fs";

import { DOCUMENT_CONFIG } from "../config/documentConfig.js";
import { getVariables } from "../config/variableConfig.js";
import {
  getCanonicalDocumentType,
  getDocumentFamily,
} from "../../shared/documentRegistry.js";
import { resolveRoster } from "./partyRoster.js";

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
  // `service_name` is the name of the product being offered, not a contracting
  // party. Without this, TERMS_OF_SERVICE derived a participant `service`
  // labelled "Business" from the intake section title, and then validated the
  // product name as if it were a party to the instrument.
  "service",
  // An advocate who sends a notice is not a party to it. They act on the
  // client's instructions and in a representative capacity, and treating them
  // as a participant made the addressee the THIRD party on a two-party notice -
  // so the naming overrides for "second" landed on the advocate instead.
  "advocate",
  // The nominated arbitrator, the notary and the witnesses are named in the
  // instrument without being bound by it.
  "arbitrator",
  "notary",
  "witness",
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
  const fields = new Set([
    ...Object.keys(getVariables(normalizeDocumentType(documentType)) || {}),
    ...(config.requiredFields || []),
  ]);

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

// A legal instrument names its parties the way their identification documents
// do. A user typing "rajiv gandhi" into a form gets "Rajiv gandhi" on the face
// of the agreement and in the signature block, which reads as a defect to
// anyone reviewing it -- and it is the first thing on page one.
//
// The rule is deliberately narrow: only a word that is ENTIRELY lowercase is
// touched. Anything the user capitalised on purpose survives untouched, so
// "McDonald", "van der Berg", "ABC PVT LTD", "d/b/a" and every deliberate
// spelling are all safe. That asymmetry is the point -- the cost of wrongly
// rewriting a real name is far higher than the cost of leaving one alone.
const NAME_PARTICLES = new Set([
  "van", "von", "der", "den", "de", "di", "da", "del", "della",
  "la", "le", "bin", "binti", "ibn", "al", "e", "y",
]);

function toProperName(value = "") {
  const text = String(value).trim();
  if (!text) return text;

  return text
    .split(/(\s+)/)
    .map((token, index) => {
      if (!token.trim()) return token;
      // Leave anything the user capitalised, and anything with a digit, alone.
      if (/[A-Z]/.test(token) || /\d/.test(token)) return token;

      const bare = token.toLowerCase();
      // Particles stay lowercase unless they open the name.
      if (index > 0 && NAME_PARTICLES.has(bare.replace(/[^a-z]/g, ""))) return token;

      // "mcdonald" and "o'brien" carry a second capital.
      const mc = bare.match(/^(ma?c)([a-z]{2,})$/);
      if (mc) return cap(mc[1]) + cap(mc[2]);
      const irish = bare.match(/^o'([a-z]+)$/);
      if (irish) return "O'" + cap(irish[1]);

      // Hyphenated and apostrophed surnames capitalise each part.
      return bare.split(/([-'])/).map((part) => (/[-']/.test(part) ? part : cap(part))).join("");
    })
    .join("");
}

function cap(word = "") {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

export function getParticipantExpectations(documentType = "", variables = {}) {
  // A participant's slot id and the form field that collects its identifiers are
  // not always the same word. A partnership deed's participants are `partner_1`
  // and `partner_2`, but the intake form asks for `party_1_pan` and
  // `party_1_gstin` -- so reading only `${id}_pan` dropped every identifier the
  // user had typed, and the reflection check reported it as
  // FORM_VALUE_NOT_REFLECTED_PARTY_1_GSTIN. Fall back to the generic party slot
  // at the same ordinal position, which is where the form actually puts them.
  const detail = (participant, index, suffix) => {
    const own = variables?.[`${participant.id}_${suffix}`];
    if (own !== undefined && String(own).trim() !== "") return own;
    return variables?.[`party_${index + 1}_${suffix}`];
  };

  const declared = getParticipantDefinitions(documentType)
    .map((participant, index) => ({
      id: participant.id,
      label: participant.canonical,
      name: toProperName(variables?.[participant.nameField]),
      address: participant.addressField ? variables?.[participant.addressField] : undefined,
      type: participant.typeField ? variables?.[participant.typeField] : undefined,
      // Optional, and the notices clause simply omits the line when it is
      // absent -- but a notice clause that can only work by post is a notice
      // clause nobody will use.
      email: detail(participant, index, "email"),
      pan: detail(participant, index, "pan"),
      gstin: detail(participant, index, "gstin"),
      cin: detail(participant, index, "cin"),
      llpin: detail(participant, index, "llpin"),
    }))
    .filter((participant) => participant.name || participant.address);

  return withRosterPrincipals(declared, variables);
}

// A label that ends in an ordinal extends by its ordinal: "Partner 1" and
// "Partner 2" make "Partner 3". Anything else falls back to the universal form
// rather than inventing a name for a role nobody defined.
function extendParticipantLabel(sample = "", index = 0) {
  const match = /^(.*?)(\d+)$/.exec(String(sample).trim());
  if (match && match[1].trim()) return `${match[1]}${index}`;
  return `Party ${index}`;
}

/**
 * THE ONE PLACE THAT ANSWERS "WHO ARE THE PRINCIPALS".
 *
 * The identity clause, the signature block, the notices clause, the consistency
 * validator and the quality controls all ask this function, and they are exactly
 * the provisions D4.14 found disagreeing with each other: a third partner in the
 * capital clause, absent from the identity clause, absent from the signature
 * block. Extending HERE is what makes them agree by construction, rather than
 * teaching each one separately about a third person.
 *
 * The extension is bounded in three ways, and each is load-bearing:
 *
 *   - it fires only when the roster carries more principals than the schema
 *     declares, so every two-party document is byte-identical to before;
 *   - it fires only when the roster's prefix is the one the declared
 *     participants are named by, so a roster resolved from `party_N_*` cannot
 *     silently supply the principals of a deed that names `partner_N_*`;
 *   - it preserves each member's own index, so "Party 3" in the deed means the
 *     third slot the user filled and not the third row that survived.
 *
 * It does NOT decide what an N-party clause should SAY. That question belongs to
 * npartyTreatment.js, where six clauses report UNRESOLVED because the answer is
 * a matter of law and nobody has authored it.
 */
function withRosterPrincipals(declared = [], variables = {}) {
  const roster = resolveRoster(variables);
  if (!declared.length) return declared;
  if (roster.count <= declared.length && roster.source !== "parties[]") return declared;

  /*
   * An explicit collection has no prefix of its own, so it borrows the one the
   * schema's principals are already named by. Without this, a caller who passed
   * `parties[]` got a roster of four and a document about two, which is the
   * disappearance this whole change exists to stop, arriving by a different
   * road.
   */
  const prefix = roster.prefix || prefixOf(declared[0]?.id);
  if (!prefix) return declared;
  if (!declared.every((p) => String(p.id).startsWith(`${prefix}_`))) return declared;

  const buildFromMember = (member, fallbackFrom) => {
    const id = `${prefix}_${member.index}`;
    const at = (suffix) =>
      member[suffix] ??
      fallbackFrom?.[suffix] ??
      variables?.[`${id}_${suffix}`] ??
      variables?.[`party_${member.index}_${suffix}`];
    return {
      id,
      label:
        fallbackFrom?.label || extendParticipantLabel(declared[0]?.label, member.index),
      name: toProperName(member.name),
      address: member.address ?? fallbackFrom?.address ?? undefined,
      type: member.type ?? fallbackFrom?.type ?? undefined,
      email: at("email"),
      pan: at("pan"),
      gstin: at("gstin"),
      cin: at("cin"),
      llpin: at("llpin"),
      // Marked, so a consumer that must treat a schema-declared principal
      // differently from a roster-supplied one can tell them apart. Nothing
      // currently does, and that is the point: they are principals either way.
      from_roster: true,
    };
  };

  /*
   * A DECLARED COLLECTION IS AUTHORITATIVE FOR EVERY POSITION, NOT JUST THE NEW
   * ONES. Taking only the extras from it would let `partner_1_name` name
   * somebody the collection does not contain and still put them on the page —
   * precisely the outcome resolveRoster refuses to reach by recording a conflict
   * instead. The two halves have to agree about who the first party is, not only
   * about how many there are.
   */
  if (roster.source === "parties[]") {
    return roster.members
      .map((member, i) => buildFromMember(member, declared[i]))
      .filter((participant) => participant.name || participant.address);
  }

  const known = new Set(declared.map((p) => p.id));
  const extra = roster.members
    .filter((member) => !known.has(`${prefix}_${member.index}`))
    .map((member) => buildFromMember(member, null))
    .filter((participant) => participant.name || participant.address);

  return [...declared, ...extra].sort((a, b) => rosterOrdinal(a) - rosterOrdinal(b));
}

function prefixOf(id = "") {
  const match = /^([a-z]+)_\d+$/.exec(String(id));
  return match ? match[1] : null;
}

function rosterOrdinal(participant = {}) {
  const match = /_(\d+)$/.exec(String(participant.id || ""));
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
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
