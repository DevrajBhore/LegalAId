import { getVariables } from "../config/variableConfig.js";

// Who the parties are, checked as identities rather than as strings.
//
// Three questions this layer asks, none of which the prose checks can answer:
//   1. Is each statutory identifier well formed - PAN, GSTIN, CIN, LLPIN?
//   2. Do two different parties carry the same identifier, which would mean
//      they are the same person and there is no contract to speak of?
//   3. Does the declared entity type agree with the name, the PAN holder code
//      and the identifiers supplied?
//
// It runs off the intake values, before assembly, for the same reason the
// numeric layer does: an identity error is cheap to fix at the form and
// expensive once it is in the recitals, the execution block and the schedule.

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// The parties this system knows how to describe. Each is a prefix over the
// intake fields plus the label an advocate would use for it.
const PARTY_GROUPS = [
  { id: "party_1", label: "First Party", name: "party_1_name", type: "party_1_type", pan: "party_1_pan", gstin: "party_1_gstin", cin: "party_1_cin", llpin: "party_1_llpin" },
  { id: "party_2", label: "Second Party", name: "party_2_name", type: "party_2_type", pan: "party_2_pan", gstin: "party_2_gstin", cin: "party_2_cin", llpin: "party_2_llpin" },
  { id: "employer", label: "Employer", name: "employer_name", type: "employer_type", pan: "employer_pan", gstin: "employer_gstin", cin: "employer_cin" },
  { id: "employee", label: "Employee", name: "employee_name", pan: "employee_pan", impliedType: "Individual" },
  { id: "guarantor", label: "Guarantor", name: "guarantor_name", type: "guarantor_type", pan: "guarantor_pan", gstin: "guarantor_gstin", cin: "guarantor_cin", llpin: "guarantor_llpin" },
  { id: "company", label: "Company", name: "company_name", cin: "company_cin" },
];

// PAN encodes the holder's status in its fourth character. This is the cheapest
// entity-type check available and it comes free with a PAN that is present.
const PAN_HOLDER_CODES = {
  P: "an individual",
  C: "a company",
  H: "a Hindu Undivided Family",
  F: "a firm or LLP",
  A: "an association of persons",
  T: "a trust",
  B: "a body of individuals",
  L: "a local authority",
  J: "an artificial juridical person",
  G: "a government body",
};

// Which PAN holder codes are consistent with each declared type. A type absent
// from this map is not checked - silence is better than a wrong assertion.
const TYPE_TO_PAN_CODES = {
  INDIVIDUAL: ["P"],
  "PRIVATE LIMITED COMPANY": ["C"],
  "PUBLIC LIMITED COMPANY": ["C"],
  LLP: ["F", "E"],
  "PARTNERSHIP FIRM": ["F"],
  // A proprietorship has no separate legal personality; the PAN is the
  // proprietor's own, so it carries the individual code.
  "SOLE PROPRIETORSHIP": ["P"],
  TRUST: ["T"],
  "GOVERNMENT BODY": ["G", "L"],
};

const INCORPORATED_TYPES = new Set([
  "PRIVATE LIMITED COMPANY",
  "PUBLIC LIMITED COMPANY",
]);

const NON_NATURAL_TYPES = new Set([
  "PRIVATE LIMITED COMPANY",
  "PUBLIC LIMITED COMPANY",
  "LLP",
  "PARTNERSHIP FIRM",
  "TRUST",
  "GOVERNMENT BODY",
]);

// Markers that put a name beyond doubt as an entity rather than a person.
const ENTITY_NAME_MARKERS = [
  "private limited", "pvt ltd", "pvt. ltd", "pvt limited", "public limited",
  "limited", "ltd", "llp", "llc", "inc", "incorporated", "corporation", "corp",
  "company", "& co", "and co", "& sons", "and sons", "& associates", "and associates",
  "associates", "enterprises", "enterprise", "industries", "traders", "trading",
  "agencies", "exports", "imports", "ventures", "holdings", "group", "partners",
  "technologies", "solutions", "systems", "services", "consultancy", "consultants",
  "labs", "laboratories", "foundation", "trust", "society", "sangh", "samiti",
  "udyog", "bhandar", "stores", "firm", "m/s", "authority", "corporation of india",
  "department of", "ministry of", "board", "council",
];

// Honorifics only a natural person carries.
const PERSON_HONORIFICS = [
  "mr.", "mr ", "mrs.", "mrs ", "ms.", "ms ", "miss ", "shri ", "sri ",
  "smt.", "smt ", "kum.", "dr.", "dr ", "prof.", "prof ", "shrimati ",
];

function buildIssue(ruleId, severity, message, suggestion) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    blocks_generation: severity === "CRITICAL",
    auto_fixable: false,
  };
}

// Identifiers are quoted back to the drafter in the form they typed, but
// compared in a canonical one: no spaces, no hyphens, upper case.
function canonical(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw).toUpperCase().replace(/[\s\-.]/g, "").trim();
}

function present(raw) {
  return typeof raw === "string" ? raw.trim().length > 0 : Boolean(raw);
}

export function isValidPan(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(canonical(value));
}

export function panHolderCode(value) {
  const pan = canonical(value);
  return isValidPan(pan) ? pan[3] : null;
}

// The GSTIN check digit: each of the first fourteen characters is taken as a
// base-36 value, multiplied by an alternating factor of one and two, and the
// quotient and remainder of that product against thirty-six are summed. The
// fifteenth character completes the sum to a multiple of thirty-six.
export function gstinChecksum(value) {
  const gstin = canonical(value);
  if (gstin.length < 14) return null;
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const digit = BASE36.indexOf(gstin[index]);
    if (digit < 0) return null;
    const product = digit * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return BASE36[(36 - (sum % 36)) % 36];
}

export function isValidGstin(value) {
  const gstin = canonical(value);
  // State code, then the holder's PAN, then an entity number, then Z, then the
  // check digit. The Z is fixed by the notified format.
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  const stateCode = Number(gstin.slice(0, 2));
  const stateIsKnown = (stateCode >= 1 && stateCode <= 38) || stateCode === 97 || stateCode === 99;
  if (!stateIsKnown) return false;
  return gstinChecksum(gstin) === gstin[14];
}

export function isValidCin(value) {
  // Listing status, industry code, state, year of incorporation, ownership
  // class, then the registrar's running number.
  return /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(canonical(value));
}

export function isValidLlpin(value) {
  // Both the historic three-letter form and the current seven-character one.
  const llpin = canonical(value);
  return /^[A-Z]{3}[0-9]{4}$/.test(llpin) || /^[A-Z]{3}[0-9]{4}[A-Z]?$/.test(llpin);
}

function normalizeType(raw) {
  return String(raw || "").trim().toUpperCase();
}

function looksLikeEntityName(name) {
  const text = ` ${String(name || "").toLowerCase().replace(/\s+/g, " ").trim()} `;
  return ENTITY_NAME_MARKERS.some((marker) => text.includes(` ${marker}`) || text.includes(`${marker} `));
}

function looksLikePersonName(name) {
  const text = String(name || "").trim();
  const lower = ` ${text.toLowerCase()} `;
  if (PERSON_HONORIFICS.some((honorific) => lower.includes(` ${honorific}`))) return true;
  // Two or three plain words, no digits, no punctuation beyond a full stop for
  // an initial. That is the shape of a name on a PAN card.
  return /^[A-Za-z]+(\.?\s+[A-Za-z]+){1,2}\.?$/.test(text) && !looksLikeEntityName(text);
}

function collectParties(definitions, variables) {
  const parties = [];
  for (const group of PARTY_GROUPS) {
    // Only groups this document actually asks about.
    const fields = ["name", "type", "pan", "gstin", "cin", "llpin"]
      .filter((slot) => group[slot] && definitions[group[slot]]);
    if (!fields.length) continue;

    // A group the document gives no NAME field to is not a party in its own
    // right: it is a second set of fields describing a party named elsewhere.
    // Employment documents do exactly this - party_1_* carries the PAN, GSTIN
    // and CIN while employer_* carries the name, and the two are one employer.
    // Treating them as two parties made the uniqueness check compare a party
    // with itself and block generation on every employment document.
    const isNamedParty = Boolean(definitions[group.name]);

    const party = {
      id: group.id,
      label: group.label,
      isNamedParty,
      name: present(variables[group.name]) ? String(variables[group.name]).trim() : "",
      type: group.type && present(variables[group.type])
        ? String(variables[group.type]).trim()
        : group.impliedType || "",
      typeWasDeclared: Boolean(group.type && present(variables[group.type])),
      identifiers: {},
      // Which identifier fields this document actually put in front of the user.
      // Nothing is ever reported as missing unless it was asked for.
      offered: new Set(
        ["pan", "gstin", "cin", "llpin"].filter((kind) => group[kind] && definitions[group[kind]])
      ),
      fieldNames: group,
    };

    for (const kind of ["pan", "gstin", "cin", "llpin"]) {
      const field = group[kind];
      if (!field || !definitions[field] || !present(variables[field])) continue;
      party.identifiers[kind] = String(variables[field]).trim();
    }

    if (!party.name && !Object.keys(party.identifiers).length) continue;
    parties.push(party);
  }
  return parties;
}

const IDENTIFIER_LABELS = { pan: "PAN", gstin: "GSTIN", cin: "CIN", llpin: "LLPIN" };
const IDENTIFIER_VALIDATORS = {
  pan: isValidPan,
  gstin: isValidGstin,
  cin: isValidCin,
  llpin: isValidLlpin,
};
const IDENTIFIER_SHAPES = {
  pan: "ten characters - five letters, four digits, one letter",
  gstin: "fifteen characters - a two-digit state code, the holder's ten-character PAN, an entity number, the letter Z and a check digit",
  cin: "twenty-one characters - L or U, a five-digit industry code, a two-letter state, a four-digit year, a three-letter ownership class and a six-digit registration number",
  llpin: "seven characters - three letters and four digits",
};

function checkFormats(party) {
  const issues = [];
  for (const [kind, raw] of Object.entries(party.identifiers)) {
    if (IDENTIFIER_VALIDATORS[kind](raw)) continue;

    // A GSTIN that is shaped correctly but fails the check digit is a different
    // finding from one that is the wrong length, and deserves saying so.
    const isGstinChecksumOnly =
      kind === "gstin" &&
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(canonical(raw));

    issues.push(
      buildIssue(
        `INVALID_${party.id.toUpperCase()}_${kind.toUpperCase()}`,
        "HIGH",
        isGstinChecksumOnly
          ? `${party.label} GSTIN "${raw}" is the right shape but fails its check digit, so it is not a number the GST portal issued.`
          : `${party.label} ${IDENTIFIER_LABELS[kind]} "${raw}" is not a valid ${IDENTIFIER_LABELS[kind]}.`,
        `A ${IDENTIFIER_LABELS[kind]} is ${IDENTIFIER_SHAPES[kind]}. Verify it against the certificate before the document is executed.`
      )
    );
  }

  // A GSTIN carries its holder's PAN in characters three to twelve. Where both
  // are given for the same party they must agree, or one of them belongs to
  // somebody else.
  const pan = canonical(party.identifiers.pan);
  const gstin = canonical(party.identifiers.gstin);
  if (isValidPan(pan) && isValidGstin(gstin) && gstin.slice(2, 12) !== pan) {
    issues.push(
      buildIssue(
        `MISMATCHED_${party.id.toUpperCase()}_PAN_IN_GSTIN`,
        "HIGH",
        `${party.label} GSTIN embeds the PAN ${gstin.slice(2, 12)}, but the PAN given is ${pan}.`,
        `A GSTIN is issued against a single PAN and carries it in characters three to twelve. One of the two belongs to a different entity - check both against the certificates.`
      )
    );
  }

  return issues;
}

function checkEntityType(party) {
  const issues = [];
  const type = normalizeType(party.type);
  if (!type) return issues;

  const id = party.id.toUpperCase();
  const isNonNatural = NON_NATURAL_TYPES.has(type);
  const isIndividual = type === "INDIVIDUAL";

  // The PAN holder code. Free, definitive, and the strongest of these checks.
  const code = panHolderCode(party.identifiers.pan);
  const expected = TYPE_TO_PAN_CODES[type];
  if (code && expected && !expected.includes(code)) {
    const describes = PAN_HOLDER_CODES[code];
    issues.push(
      buildIssue(
        `ENTITY_TYPE_CONTRADICTS_PAN_${id}`,
        "HIGH",
        `${party.label} is declared as ${party.type}, but the PAN given belongs to ${
          describes || `a holder class this system does not recognise ("${code}")`
        }.`,
        `The fourth character of a PAN records the holder's status. Either the type or the PAN is wrong - correct it before execution.`
      )
    );
  }

  // Identifiers only a body corporate has.
  if (isIndividual || type === "SOLE PROPRIETORSHIP") {
    for (const kind of ["cin", "llpin"]) {
      if (!party.identifiers[kind]) continue;
      issues.push(
        buildIssue(
          `${kind.toUpperCase()}_ON_UNINCORPORATED_${id}`,
          "HIGH",
          `${party.label} is declared as ${party.type}, but carries ${
            kind === "cin" ? "a Corporate Identity Number" : "an LLP Identification Number"
          }. ${
            isIndividual
              ? "A natural person is not incorporated and has no such number."
              : "A sole proprietorship has no separate legal personality and is not registered with the Registrar of Companies."
          }`,
          `Remove the ${IDENTIFIER_LABELS[kind]}, or change the party type to the entity that actually holds it.`
        )
      );
    }
  }

  // An LLP is a body corporate, but the Registrar allots it an LLPIN, not a CIN.
  // A partnership firm is registered with the Registrar of Firms and has neither.
  if (type === "LLP" && party.identifiers.cin) {
    issues.push(
      buildIssue(
        `CIN_ON_LLP_${id}`,
        "HIGH",
        `${party.label} is declared as an LLP, but carries a Corporate Identity Number.`,
        `An LLP is allotted an LLP Identification Number under the Limited Liability Partnership Act 2008, not a CIN. Move the number to the LLPIN field or correct the party type.`
      )
    );
  }

  if (type === "PARTNERSHIP FIRM") {
    for (const kind of ["cin", "llpin"]) {
      if (!party.identifiers[kind]) continue;
      issues.push(
        buildIssue(
          `${kind.toUpperCase()}_ON_PARTNERSHIP_${id}`,
          "HIGH",
          `${party.label} is declared as a Partnership Firm, but carries ${
            kind === "cin" ? "a Corporate Identity Number" : "an LLP Identification Number"
          }.`,
          `A firm under the Partnership Act 1932 is registered with the Registrar of Firms and is allotted neither. If the party is an LLP or a company, change the party type.`
        )
      );
    }
  }

  if (
    INCORPORATED_TYPES.has(type) &&
    party.offered.has("cin") &&
    !party.identifiers.cin &&
    party.typeWasDeclared
  ) {
    issues.push(
      buildIssue(
        `MISSING_CIN_${id}`,
        // A notice, not a defect: the CIN is optional on the form and its
        // absence does not make the document wrong, only harder to verify.
        "LOW",
        `${party.label} is declared as ${party.type} but no Corporate Identity Number is given.`,
        `A company incorporated in India has a CIN on its certificate of incorporation. Recording it lets the counterparty verify the company on the MCA register.`
      )
    );
  }

  // The name, read as a name.
  if (party.name) {
    if (isNonNatural && !looksLikeEntityName(party.name) && looksLikePersonName(party.name)) {
      issues.push(
        buildIssue(
          `ENTITY_TYPE_CONTRADICTS_NAME_${id}`,
          "HIGH",
          `${party.label} is declared as ${party.type}, but the name "${party.name}" reads as a natural person.`,
          `Use the registered name exactly as it appears on the certificate of incorporation or registration. If the individual is signing on the entity's behalf, their name belongs in the authorised signatory field, not the party name.`
        )
      );
    } else if (isNonNatural && !looksLikeEntityName(party.name)) {
      issues.push(
        buildIssue(
          `ENTITY_NAME_LACKS_STATUS_${id}`,
          "MEDIUM",
          `${party.label} is declared as ${party.type}, but the name "${party.name}" carries nothing identifying it as such.`,
          `A registered name ordinarily ends in its status - "Private Limited", "LLP", and so on. Confirm the name matches the certificate.`
        )
      );
    }

    if (isIndividual && looksLikeEntityName(party.name)) {
      issues.push(
        buildIssue(
          `INDIVIDUAL_NAME_READS_AS_ENTITY_${id}`,
          "HIGH",
          `${party.label} is declared as an Individual, but the name "${party.name}" reads as a registered entity.`,
          `A natural person contracts in their own name. If the contracting party is the business, change the party type and give the entity's identifiers.`
        )
      );
    }

    if (isNonNatural && PERSON_HONORIFICS.some((h) => ` ${party.name.toLowerCase()} `.includes(` ${h}`))) {
      issues.push(
        buildIssue(
          `HONORIFIC_ON_ENTITY_${id}`,
          "MEDIUM",
          `${party.label} is declared as ${party.type}, but the name carries a personal honorific.`,
          `Drop the honorific from the entity name; it belongs with the authorised signatory.`
        )
      );
    }
  }

  return issues;
}

// Contract Act 1872 S.10 needs two parties. Two entries carrying the same
// statutory identifier are one party wearing two labels.
function checkUniqueness(parties) {
  const issues = [];
  // Only groups the document names separately can be separate people.
  const namedParties = parties.filter((party) => party.isNamedParty);

  for (const kind of ["pan", "gstin", "cin", "llpin"]) {
    const byValue = new Map();
    for (const party of namedParties) {
      const value = canonical(party.identifiers[kind]);
      if (!value) continue;
      if (!byValue.has(value)) byValue.set(value, []);
      byValue.get(value).push(party);
    }
    for (const [value, holders] of byValue) {
      if (holders.length < 2) continue;
      const labels = holders.map((party) => party.label);
      const involvesGuarantor = holders.some((party) => party.id === "guarantor");
      issues.push(
        buildIssue(
          `DUPLICATE_${kind.toUpperCase()}_ACROSS_PARTIES`,
          "CRITICAL",
          `${labels.join(" and ")} carry the same ${IDENTIFIER_LABELS[kind]} (${value}), which means they are the same person.`,
          involvesGuarantor
            ? `A guarantee needs a third person: Contract Act 1872 S.126 defines it as a promise to perform the default of a third party. A person cannot guarantee their own debt. Give the guarantor's own ${IDENTIFIER_LABELS[kind]}.`
            : `An agreement requires two parties - Contract Act 1872 S.10 read with S.2(e). Correct the ${IDENTIFIER_LABELS[kind]} for whichever party it does not belong to.`
        )
      );
    }
  }

  // Different identifiers but the same name is the same problem seen from the
  // other side, and it is the one that survives a form filled from a fixture.
  const byName = new Map();
  for (const party of namedParties) {
    const key = party.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(party);
  }
  for (const [, holders] of byName) {
    if (holders.length < 2) continue;
    // The company group often restates the employer; that is not a defect.
    const ids = new Set(holders.map((party) => party.id));
    if (ids.has("company") && ids.size === 2) continue;
    issues.push(
      buildIssue(
        "DUPLICATE_PARTY_NAME",
        "CRITICAL",
        `${holders.map((party) => party.label).join(" and ")} are given the same name, "${holders[0].name}".`,
        `An agreement requires two parties - Contract Act 1872 S.10 read with S.2(e). Give each party its own name.`
      )
    );
  }

  return issues;
}

export function validatePartyIdentity({ documentType, variables = {} } = {}) {
  if (!documentType || !variables || typeof variables !== "object") return [];

  const definitions = getVariables(documentType) || {};
  const parties = collectParties(definitions, variables);
  if (!parties.length) return [];

  const issues = [];
  for (const party of parties) {
    issues.push(...checkFormats(party));
    issues.push(...checkEntityType(party));
  }
  issues.push(...checkUniqueness(parties));
  return issues;
}
