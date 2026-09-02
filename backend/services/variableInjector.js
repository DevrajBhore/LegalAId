function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (String(value).trim() === "") continue;
    return value;
  }
  return undefined;
}

function toNumericString(value, fallback = "0") {
  const resolved = firstNonEmpty(value, fallback);
  return String(resolved);
}

function normalizePartyType(name = "", explicitType) {
  const resolvedType = firstNonEmpty(explicitType);
  if (resolvedType) {
    return String(resolvedType);
  }

  const lower = String(name).toLowerCase();
  if (/\bprivate limited\b|\bpvt\.?\s*ltd\b|\blimited\b/.test(lower)) {
    return "Private Limited Company";
  }
  if (/\bllp\b/.test(lower)) {
    return "LLP";
  }
  if (/\bpartnership\b/.test(lower)) {
    return "Partnership Firm";
  }
  return "Individual";
}

// A party's statutory identifiers, as one phrase. The form collects CIN, LLPIN,
// PAN and GSTIN and partyIdentityValidator checks their checksums -- but this
// descriptor, the one clause templates interpolate as {{party_1_descriptor}},
// took only name, type and address. Every identifier a user typed was validated
// and then dropped before it reached the page, which is what the
// FORM_VALUE_NOT_REFLECTED_PARTY_N_GSTIN findings were reporting.
function identifierPhrase({ cin, llpin, pan, gstin } = {}) {
  const parts = [];
  if (firstNonEmpty(cin)) parts.push(`CIN ${cin}`);
  if (firstNonEmpty(llpin)) parts.push(`LLPIN ${llpin}`);
  if (firstNonEmpty(pan)) parts.push(`PAN ${pan}`);
  if (firstNonEmpty(gstin)) parts.push(`GSTIN ${gstin}`);
  if (!parts.length) return "";

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return ` bearing ${list}`;
}

// "a LLP" reads wrong: the article follows the sound, and an acronym read letter
// by letter starts with a vowel sound whenever its first letter does.
const VOWEL_SOUNDING_INITIALS = new Set(["A", "E", "F", "H", "I", "L", "M", "N", "O", "R", "S", "X"]);

function indefiniteArticle(word = "") {
  const text = String(word).trim();
  if (!text) return "a";
  if (/^[A-Z]{2,}\b/.test(text)) {
    return VOWEL_SOUNDING_INITIALS.has(text[0]) ? "an" : "a";
  }
  return /^[aeiou]/i.test(text) ? "an" : "a";
}

function buildPartyDescriptor(name, type, address, identifiers = {}) {
  const resolvedName = firstNonEmpty(name, "Party");
  const resolvedType = normalizePartyType(resolvedName, type);
  const resolvedAddress = firstNonEmpty(address);
  const ids = identifierPhrase(identifiers);

  const article = indefiniteArticle(resolvedType);

  if (!resolvedAddress) {
    return `${resolvedName}, ${article} ${resolvedType}${ids}`;
  }

  // The comma before "residing"/"having" appears only when identifiers sit in
  // between, so a descriptor with no identifiers reads exactly as it did.
  if (resolvedType.toLowerCase() === "individual") {
    return `${resolvedName}, an Individual${ids ? `${ids},` : ""} residing at ${resolvedAddress}`;
  }

  return `${resolvedName}, ${article} ${resolvedType}${ids ? `${ids},` : ""} having its address at ${resolvedAddress}`;
}

function derivePurpose(variables = {}) {
  return firstNonEmpty(
    variables.purpose,
    variables.services_description,
    variables.consulting_services,
    variables.business_purpose,
    variables.jv_purpose,
    variables.mou_purpose,
    variables.project_description,
    variables.product_description,
    variables.goods_description,
    variables.property_description,
    variables.security_collateral,
    variables.company_name
      ? `the governance, shareholding rights, and management framework of ${variables.company_name}`
      : undefined,
    variables.partnership_name
      ? `the conduct of the business of ${variables.partnership_name}`
      : undefined,
    variables.jv_name
      ? `the formation and operation of ${variables.jv_name}`
      : undefined,
    variables.loan_amount
      ? `the financial accommodation of INR ${variables.loan_amount} being extended under this Agreement`
      : undefined,
    variables.guaranteed_amount
      ? `the guarantee obligations securing financial accommodation up to INR ${variables.guaranteed_amount}`
      : undefined,
    variables.property_address
      ? `the occupation and lawful use of the premises at ${variables.property_address}`
      : undefined,
    "the lawful business relationship described in this Agreement"
  );
}

function buildDerivedVariables(variables = {}) {
  const party1Name = firstNonEmpty(
    variables.party_1_name,
    variables.employer_name,
    variables.shareholder_1_name,
    variables.partner_1_name,
    variables.company_name
  );
  const party2Name = firstNonEmpty(
    variables.party_2_name,
    variables.employee_name,
    variables.shareholder_2_name,
    variables.partner_2_name,
    variables.guarantor_name
  );
  const party1Address = firstNonEmpty(
    variables.party_1_address,
    variables.employer_address,
    variables.shareholder_1_address,
    variables.partner_1_address,
    variables.company_address
  );
  const party2Address = firstNonEmpty(
    variables.party_2_address,
    variables.employee_address,
    variables.shareholder_2_address,
    variables.partner_2_address,
    variables.guarantor_address
  );
  // Identifiers follow the same slot-aliasing as the names above: a document
  // that calls its first party "employer" or "partner_1" keeps its CIN.
  const identifiersFor = (prefixes) => ({
    cin: firstNonEmpty(...prefixes.map((prefix) => variables[`${prefix}_cin`])),
    llpin: firstNonEmpty(...prefixes.map((prefix) => variables[`${prefix}_llpin`])),
    pan: firstNonEmpty(...prefixes.map((prefix) => variables[`${prefix}_pan`])),
    gstin: firstNonEmpty(...prefixes.map((prefix) => variables[`${prefix}_gstin`])),
  });
  const party1Identifiers = identifiersFor([
    "party_1",
    "employer",
    "shareholder_1",
    "partner_1",
    "company",
  ]);
  const party2Identifiers = identifiersFor([
    "party_2",
    "employee",
    "shareholder_2",
    "partner_2",
    "guarantor",
  ]);
  const guarantorIdentifiers = identifiersFor(["guarantor"]);

  const party1Type = normalizePartyType(party1Name, variables.party_1_type);
  const party2Type = normalizePartyType(party2Name, variables.party_2_type);
  const guarantorName = firstNonEmpty(variables.guarantor_name);
  const guarantorAddress = firstNonEmpty(variables.guarantor_address);
  const guarantorType = normalizePartyType(
    guarantorName,
    variables.guarantor_type
  );

  return {
    party_1_name: party1Name,
    party_2_name: party2Name,
    party_1_address: party1Address,
    party_2_address: party2Address,
    party_1_type: party1Type,
    party_2_type: party2Type,
    party_1_descriptor: buildPartyDescriptor(
      party1Name,
      party1Type,
      party1Address,
      party1Identifiers
    ),
    party_2_descriptor: buildPartyDescriptor(
      party2Name,
      party2Type,
      party2Address,
      party2Identifiers
    ),
    guarantor_name: guarantorName,
    guarantor_address: guarantorAddress,
    guarantor_type: guarantorType,
    guarantor_descriptor: buildPartyDescriptor(
      guarantorName,
      guarantorType,
      guarantorAddress,
      guarantorIdentifiers
    ),
    purpose: derivePurpose(variables),
    confidentiality_period: firstNonEmpty(
      variables.confidentiality_period,
      "3 years"
    ),
    agreement_term: firstNonEmpty(
      variables.agreement_term,
      variables.contract_duration,
      "2 years"
    ),
    non_compete_period: firstNonEmpty(
      variables.non_compete_period,
      "12 months"
    ),
    occupancy_fee: firstNonEmpty(variables.license_fee, variables.rent_amount),
    occupancy_term: firstNonEmpty(variables.license_term, variables.lease_term),
    permitted_use: firstNonEmpty(
      variables.permitted_use,
      "lawful commercial use"
    ),
    prepayment_premium: toNumericString(variables.prepayment_premium, "0"),
    organisation_address: firstNonEmpty(
      variables.organisation_address,
      variables.company_address,
      variables.party_1_address
    ),
    // Previously defaulted to a hardcoded "Mumbai", which silently seated every
    // arbitration there regardless of where the parties actually were.
    // A field named `_city` must hold a city. Falling back to the governing-law
    // state filled it with "Maharashtra", and every consumer downstream then
    // treated that as a place: the arbitration clause seated the reference at a
    // State, and the governing-law clause named "the competent courts at
    // Maharashtra" -- neither of which is a forum anyone can file in. That was
    // an over-correction of an earlier bug where this hardcoded "Mumbai" and
    // silently seated every arbitration there.
    //
    // Empty is the honest value. Each consumer already has a correct no-city
    // branch; leaving this blank is what lets those branches run.
    arbitration_city: firstNonEmpty(
      variables.arbitration_city,
      variables.execution_city
    ),
  };
}

function replaceVariableToken(text, key, value) {
  const safeKey = escapeRegex(key);
  const legacyKey = escapeRegex(String(key).toUpperCase());
  const stringValue = String(value);

  let result = text.replace(new RegExp(`{{\\s*${safeKey}\\s*}}`, "g"), stringValue);
  result = result.replace(new RegExp(`\\[\\s*${legacyKey}\\s*\\]`, "g"), stringValue);
  return result;
}

export function injectVariables(text = "", variables = {}) {
  let result = String(text);
  const resolvedVariables = {
    ...buildDerivedVariables(variables),
    ...variables,
  };

  for (const [key, value] of Object.entries(resolvedVariables)) {
    if (value === undefined || value === null) {
      continue;
    }

    result = replaceVariableToken(result, key, value);
  }

  return result;
}
