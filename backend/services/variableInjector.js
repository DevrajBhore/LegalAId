import { SOURCE_CLASS, NOT_YET_RECORDED, isRecording, recordInjection, sha256 } from "./provenance.js";

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

/* ── Provenance (D4.43) ─────────────────────────────────────────────────────
 *
 * Every chain below used to be firstNonEmpty(...values). It is now pick(...)
 * over LABELLED candidates, so the one evaluation that produces a value also says
 * which candidate won. pick has exactly firstNonEmpty's semantics — skip
 * undefined, null and whitespace-only strings; return the winner unchanged — and
 * values, key set and key ORDER of buildDerivedVariables are what they were.
 * scripts/provenanceConservation.mjs holds that to byte identity.
 *
 * Nothing in this block changes a value. It only remembers where one came from.
 */
const fromKey = (variables, key) => ({ kind: "key", key, value: variables[key] });
const constant = (value, site) => ({ kind: "constant", value, site });
const synthesised = (value, from, site) => ({ kind: "synth", value, from, site });
const SITE = "variableInjector.buildDerivedVariables";

function pick(target, ...candidates) {
  for (const c of candidates) {
    if (c.value === undefined || c.value === null) continue;
    if (String(c.value).trim() === "") continue;
    return { value: c.value, source: sourceOf(target, c) };
  }
  return { value: undefined, source: null };
}

function sourceOf(target, c) {
  if (c.kind === "constant") return { source_class: SOURCE_CLASS.CONSTANT_DEFAULT, literal_site: c.site };
  if (c.kind === "synth") return { source_class: SOURCE_CLASS.SYNTHESISED, from: c.from, site: c.site };
  // The target's own key winning means the value was passed in: chosen upstream.
  if (c.key === target) return { source_class: NOT_YET_RECORDED, chosen_by: "input" };
  return { source_class: SOURCE_CLASS.ALIAS, from: [c.key], site: SITE };
}

function pickPartyType(nameSource, name, explicitKey, variables) {
  const value = normalizePartyType(name, variables[explicitKey]);
  if (firstNonEmpty(variables[explicitKey])) return { value, source: { source_class: NOT_YET_RECORDED, chosen_by: "input", from: [explicitKey] } };
  if (value !== "Individual") {
    return { value, source: { source_class: SOURCE_CLASS.DERIVED, from: nameSource?.from || (nameSource?.chosen_by === "input" ? [nameSource.key] : []), site: "variableInjector.normalizePartyType", rule: "inferred from the party's name" } };
  }
  return { value, source: { source_class: SOURCE_CLASS.CONSTANT_DEFAULT, literal_site: "variableInjector.normalizePartyType", $note: "no explicit type and the name matched no entity pattern" } };
}

function purposeCandidates(variables) {
  const k = (key) => fromKey(variables, key);
  const SP = "variableInjector.derivePurpose";
  return [
    k("purpose"), k("services_description"), k("consulting_services"), k("business_purpose"), k("jv_purpose"),
    k("mou_purpose"), k("project_description"), k("product_description"), k("goods_description"),
    k("property_description"), k("security_collateral"),
    synthesised(variables.company_name ? `the governance, shareholding rights, and management framework of ${variables.company_name}` : undefined, ["company_name"], SP),
    synthesised(variables.partnership_name ? `the conduct of the business of ${variables.partnership_name}` : undefined, ["partnership_name"], SP),
    synthesised(variables.jv_name ? `the formation and operation of ${variables.jv_name}` : undefined, ["jv_name"], SP),
    synthesised(variables.loan_amount ? `the financial accommodation of INR ${variables.loan_amount} being extended under this Agreement` : undefined, ["loan_amount"], SP),
    synthesised(variables.guaranteed_amount ? `the guarantee obligations securing financial accommodation up to INR ${variables.guaranteed_amount}` : undefined, ["guaranteed_amount"], SP),
    synthesised(variables.property_address ? `the occupation and lawful use of the premises at ${variables.property_address}` : undefined, ["property_address"], SP),
    constant("the lawful business relationship described in this Agreement", SP),
  ];
}

function derivePurpose(variables = {}) {
  return pick("purpose", ...purposeCandidates(variables)).value;
}

/* A descriptor composes name, type, address and identifiers into one phrase. Its
   class is NORMALISED; the components say where each part came from, including
   any constant ("Party", "Individual") that stood in for a missing answer. */
function descriptorSource(parts) {
  const components = Object.fromEntries(Object.entries(parts).filter(([, v]) => v).map(([k, v]) => [k, v]));
  return { source_class: SOURCE_CLASS.NORMALISED, site: "variableInjector.buildPartyDescriptor", components };
}

function derive(variables = {}) {
  const k = (key) => fromKey(variables, key);
  const p1Name = pick("party_1_name", k("party_1_name"), k("employer_name"), k("shareholder_1_name"), k("partner_1_name"), k("company_name"));
  const p2Name = pick("party_2_name", k("party_2_name"), k("employee_name"), k("shareholder_2_name"), k("partner_2_name"), k("guarantor_name"));
  const p1Addr = pick("party_1_address", k("party_1_address"), k("employer_address"), k("shareholder_1_address"), k("partner_1_address"), k("company_address"));
  const p2Addr = pick("party_2_address", k("party_2_address"), k("employee_address"), k("shareholder_2_address"), k("partner_2_address"), k("guarantor_address"));
  // Identifiers follow the same slot-aliasing as the names above: a document
  // that calls its first party "employer" or "partner_1" keeps its CIN.
  const identifiersFor = (prefixes) => {
    const out = { values: {}, sources: {} };
    for (const id of ["cin", "llpin", "pan", "gstin"]) {
      const r = pick(`${prefixes[0]}_${id}`, ...prefixes.map((prefix) => k(`${prefix}_${id}`)));
      out.values[id] = r.value;
      if (r.source) out.sources[id] = r.source;
    }
    return out;
  };
  const p1Ids = identifiersFor(["party_1", "employer", "shareholder_1", "partner_1", "company"]);
  const p2Ids = identifiersFor(["party_2", "employee", "shareholder_2", "partner_2", "guarantor"]);
  const gIds = identifiersFor(["guarantor"]);

  const withKey = (r, key) => (r.source ? { ...r.source, key } : null);
  const p1Type = pickPartyType(withKey(p1Name, "party_1_name"), p1Name.value, "party_1_type", variables);
  const p2Type = pickPartyType(withKey(p2Name, "party_2_name"), p2Name.value, "party_2_type", variables);
  const gName = pick("guarantor_name", k("guarantor_name"));
  const gAddr = pick("guarantor_address", k("guarantor_address"));
  const gType = pickPartyType(withKey(gName, "guarantor_name"), gName.value, "guarantor_type", variables);

  const nameOrPlaceholder = (r) => (r.source ? r.source : { source_class: SOURCE_CLASS.CONSTANT_DEFAULT, literal_site: "variableInjector.buildPartyDescriptor", literal: "Party" });

  const purpose = pick("purpose", ...purposeCandidates(variables));
  const confidentiality = pick("confidentiality_period", k("confidentiality_period"), constant("3 years", SITE));
  const term = pick("agreement_term", k("agreement_term"), k("contract_duration"), constant("2 years", SITE));
  const nonCompete = pick("non_compete_period", k("non_compete_period"), constant("12 months", SITE));
  const occFee = pick("occupancy_fee", k("license_fee"), k("rent_amount"));
  const occTerm = pick("occupancy_term", k("license_term"), k("lease_term"));
  const permitted = pick("permitted_use", k("permitted_use"), constant("lawful commercial use", SITE));
  // toNumericString(value, "0") is String(firstNonEmpty(value, "0")).
  const premium = pick("prepayment_premium", k("prepayment_premium"), constant("0", SITE));
  const orgAddr = pick("organisation_address", k("organisation_address"), k("company_address"), k("party_1_address"));
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
  const arbCity = pick("arbitration_city", k("arbitration_city"), k("execution_city"));

  const values = {
    party_1_name: p1Name.value,
    party_2_name: p2Name.value,
    party_1_address: p1Addr.value,
    party_2_address: p2Addr.value,
    party_1_type: p1Type.value,
    party_2_type: p2Type.value,
    party_1_descriptor: buildPartyDescriptor(p1Name.value, p1Type.value, p1Addr.value, p1Ids.values),
    party_2_descriptor: buildPartyDescriptor(p2Name.value, p2Type.value, p2Addr.value, p2Ids.values),
    guarantor_name: gName.value,
    guarantor_address: gAddr.value,
    guarantor_type: gType.value,
    guarantor_descriptor: buildPartyDescriptor(gName.value, gType.value, gAddr.value, gIds.values),
    purpose: purpose.value,
    confidentiality_period: confidentiality.value,
    agreement_term: term.value,
    non_compete_period: nonCompete.value,
    occupancy_fee: occFee.value,
    occupancy_term: occTerm.value,
    permitted_use: permitted.value,
    prepayment_premium: String(premium.value),
    organisation_address: orgAddr.value,
    arbitration_city: arbCity.value,
  };
  const sources = {
    party_1_name: p1Name.source, party_2_name: p2Name.source,
    party_1_address: p1Addr.source, party_2_address: p2Addr.source,
    party_1_type: p1Type.source, party_2_type: p2Type.source,
    party_1_descriptor: descriptorSource({ name: nameOrPlaceholder(p1Name), type: p1Type.source, address: p1Addr.source, identifiers: Object.keys(p1Ids.sources).length ? p1Ids.sources : null }),
    party_2_descriptor: descriptorSource({ name: nameOrPlaceholder(p2Name), type: p2Type.source, address: p2Addr.source, identifiers: Object.keys(p2Ids.sources).length ? p2Ids.sources : null }),
    guarantor_name: gName.source, guarantor_address: gAddr.source, guarantor_type: gType.source,
    guarantor_descriptor: descriptorSource({ name: nameOrPlaceholder(gName), type: gType.source, address: gAddr.source, identifiers: Object.keys(gIds.sources).length ? gIds.sources : null }),
    purpose: purpose.source, confidentiality_period: confidentiality.source, agreement_term: term.source,
    non_compete_period: nonCompete.source, occupancy_fee: occFee.source, occupancy_term: occTerm.source,
    permitted_use: permitted.source, prepayment_premium: premium.source, organisation_address: orgAddr.source,
    arbitration_city: arbCity.source,
  };
  return { values, sources };
}

function buildDerivedVariables(variables = {}) {
  return derive(variables).values;
}

function replaceVariableToken(text, key, value) {
  const safeKey = escapeRegex(key);
  const legacyKey = escapeRegex(String(key).toUpperCase());
  const stringValue = String(value);

  let result = text.replace(new RegExp(`{{\\s*${safeKey}\\s*}}`, "g"), stringValue);
  result = result.replace(new RegExp(`\\[\\s*${legacyKey}\\s*\\]`, "g"), stringValue);
  return result;
}

function countToken(text, key) {
  const safeKey = escapeRegex(key);
  const legacyKey = escapeRegex(String(key).toUpperCase());
  return (text.match(new RegExp(`{{\\s*${safeKey}\\s*}}`, "g")) || []).length
    + (text.match(new RegExp(`\\[\\s*${legacyKey}\\s*\\]`, "g")) || []).length;
}

export function injectVariables(text = "", variables = {}) {
  let result = String(text);
  const { values, sources } = derive(variables);
  const resolvedVariables = {
    ...values,
    ...variables,
  };
  // Recording only inside a generation that asked for it; otherwise no extra work.
  const slots = isRecording() ? [] : null;

  for (const [key, value] of Object.entries(resolvedVariables)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (slots) {
      const occurrences = countToken(result, key);
      if (occurrences) {
        // The raw spread wins over every derived value, even an empty string.
        const passedIn = Object.prototype.hasOwnProperty.call(variables, key) && variables[key] !== undefined && variables[key] !== null;
        const source = passedIn
          ? { source_class: NOT_YET_RECORDED, chosen_by: "input" }
          : { chosen_by: "variableInjector", ...(sources[key] || { source_class: NOT_YET_RECORDED, $note: "derived key with no recorded source" }) };
        slots.push({ key, occurrences, value: String(value), ...(String(value).trim() === "" ? { empty: true } : {}), ...source });
      }
    }

    result = replaceVariableToken(result, key, value);
  }

  if (slots) {
    recordInjection({
      site: "variableInjector.injectVariables",
      template_sha256: sha256(String(text)),
      output_sha256: sha256(result),
      slots,
      unresolved_tokens: [...(result.match(/{{(.*?)}}/g) || []), ...(result.match(/\[[A-Z0-9_]+\]/g) || [])],
    });
  }

  return result;
}
