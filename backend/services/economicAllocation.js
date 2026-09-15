/**
 * economicAllocation.js — WHICH PARTY GETS WHICH SHARE?
 *
 * D4.18 made the roster authoritative for who the parties are. This answers a
 * different question about the same document, and the difference is the whole
 * point of the module:
 *
 *     Party cardinality is a fact about the intake.
 *     Economic attribution is a fact about MEANING, and it has to be established.
 *
 * A deed with three partners and the ratio "40:40:20" has three parties and
 * three numbers. Nothing follows. Mapping the first number to the first partner
 * is an inference from ARITY, and acting on it would convert a document that is
 * merely ambiguous into one that is confidently wrong — which is worse, because
 * an ambiguous sentence gets read twice and a confident one does not.
 *
 * So this module NEVER attributes a share by position. It attributes only where
 * knowledge-base/governance/allocation-semantics.json records that the mapping is
 * established, and there are exactly two ways it can be:
 *
 *   SCHEMA_INDEXED_SERIES  the field name carries the principal's ordinal and the
 *                          label names that principal — `capital_contribution_1`
 *                          is labelled "Partner 1 Capital Contribution", so the
 *                          person typing the number was told whose it was.
 *   NAMED_IN_VALUE         the value names the party: "Meera Iyer 40, Arjun Desai
 *                          40, Sunita Rao 20". Every name is then checked against
 *                          the roster, and a name that matches nobody is a
 *                          CONFLICT rather than a fourth partner.
 *
 * DELIBERATELY ABSENT: normalisation. Nothing here rescales, re-bases, rounds or
 * "fixes" an allocation. 40:40:30 is reported as totalling 110 under a percentage
 * reading and as a valid ratio under a ratio reading; it is not quietly rewritten
 * to 36.36:36.36:27.27, because that would choose one reading and change what
 * each partner receives. A resolver that can rescale an allocation can silently
 * move money between people.
 *
 * UNRESOLVED is a first-class outcome here for the same reason it is in
 * npartyTreatment.js: the honest answer to "whose 40 is this?" is often that
 * nobody has said.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRoster, sameMember } from "./partyRoster.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEMANTICS_FILE = path.resolve(
  HERE, "../../knowledge-base/governance/allocation-semantics.json"
);

/** How the value expresses the division. */
export const BASIS = {
  COLON_SERIES: "COLON_SERIES",       // 40:40:20 — ratio or percentage, the field does not say
  PERCENTAGES: "PERCENTAGES",         // 40%, 40%, 20%
  FRACTIONS: "FRACTIONS",             // 1/3, 1/3, 1/3
  NAMED: "NAMED",                     // Meera Iyer 40, Arjun Desai 40, ...
  NARRATIVE: "NARRATIVE",             // "equally", "in proportion to capital"
  ABSENT: "ABSENT",
};

/** Whether the parts can be attached to people. */
export const ATTRIBUTION = {
  ROSTER_ADDRESSED: "ROSTER_ADDRESSED", // every part carries a roster member
  UNATTRIBUTED: "UNATTRIBUTED",         // parts exist; nothing says whose they are
  CONFLICT: "CONFLICT",                 // a named part matches no member of the roster
  NOT_APPLICABLE: "NOT_APPLICABLE",     // nothing to attribute
};

/** Whether the number of parts agrees with the number of principals. */
export const ARITY = {
  MATCHES: "MATCHES",
  FEWER_PARTS_THAN_PRINCIPALS: "FEWER_PARTS_THAN_PRINCIPALS",
  MORE_PARTS_THAN_PRINCIPALS: "MORE_PARTS_THAN_PRINCIPALS",
  NOT_COUNTABLE: "NOT_COUNTABLE",
};

let cache = null;

function semantics() {
  if (cache) return cache;
  let doc = { allocations: [] };
  try { doc = JSON.parse(fs.readFileSync(SEMANTICS_FILE, "utf8")); } catch { /* unauthored */ }
  const byField = new Map();
  for (const entry of doc.allocations || []) byField.set(entry.field, entry);
  cache = { doc, byField };
  return cache;
}

/** Exposed for tests that edit the governance file on disk. */
export function clearAllocationCache() { cache = null; }

const text = (value) => String(value ?? "").trim();

/**
 * Split a written allocation into parts, WITHOUT deciding whose they are.
 *
 * Parsing and attributing are separate acts and the separation is deliberate:
 * "40:40:20" parses perfectly and attributes to nobody, and running the two
 * together is exactly how a parser comes to be treated as evidence of meaning.
 */
export function parseAllocation(raw) {
  const value = text(raw);
  if (!value) return { basis: BASIS.ABSENT, parts: [], raw: value };

  // Named: "Meera Iyer 40, Arjun Desai 40, Sunita Rao 20" or "Meera Iyer - 40%".
  const named = [...value.matchAll(
    /([A-Za-z][A-Za-z.'\- ]{2,60}?)\s*[-–:=]?\s*(\d+(?:\.\d+)?)\s*(%|per cent)?(?=\s*(?:,|;|\band\b|$))/g
  )]
    .map((m) => ({ label: m[1].trim().replace(/[,;]$/, ""), value: Number(m[2]) }))
    .filter((p) => p.label && Number.isFinite(p.value) && !/^(?:and|the|of|ratio|share)$/i.test(p.label));
  if (named.length >= 2) {
    return { basis: BASIS.NAMED, parts: named, raw: value };
  }

  // Fractions: 1/3, 1/3, 1/3
  const fractions = [...value.matchAll(/(\d+)\s*\/\s*(\d+)/g)]
    .map((m) => ({ value: Number(m[1]) / Number(m[2]), numerator: Number(m[1]), denominator: Number(m[2]) }))
    .filter((p) => Number.isFinite(p.value));
  if (fractions.length >= 2) {
    return { basis: BASIS.FRACTIONS, parts: fractions, raw: value };
  }

  // Explicit percentages: 40%, 40%, 20%
  const percents = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|per cent)/g)]
    .map((m) => ({ value: Number(m[1]) }));
  if (percents.length >= 2) {
    return { basis: BASIS.PERCENTAGES, parts: percents, raw: value };
  }

  // Colon series: 40:40:20. The field calls this a ratio and gives only examples
  // that total 100, so which reading applies is genuinely undetermined here and
  // is reported rather than picked.
  const colon = value.match(/^\s*\d+(?:\.\d+)?(?:\s*[:：]\s*\d+(?:\.\d+)?)+\s*$/);
  if (colon) {
    return {
      basis: BASIS.COLON_SERIES,
      parts: value.split(/[:：]/).map((p) => ({ value: Number(p.trim()) })),
      raw: value,
    };
  }

  return { basis: BASIS.NARRATIVE, parts: [], raw: value };
}

/** The parts a SCHEMA_INDEXED_SERIES contributes, read straight off the roster. */
export function seriesParts(base, roster, variables = {}) {
  return (roster.members || []).map((member) => {
    const raw = variables[`${base}_${member.index}`];
    const value = Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
    return {
      index: member.index,
      member,
      label: member.name,
      value: Number.isFinite(value) && text(raw) !== "" ? value : null,
      recorded: text(raw) !== "",
    };
  });
}

function sum(parts) {
  const values = parts.map((p) => p.value).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
}

function arityOf(partCount, principalCount) {
  if (!Number.isFinite(partCount) || partCount === 0) return ARITY.NOT_COUNTABLE;
  if (partCount === principalCount) return ARITY.MATCHES;
  return partCount < principalCount
    ? ARITY.FEWER_PARTS_THAN_PRINCIPALS
    : ARITY.MORE_PARTS_THAN_PRINCIPALS;
}

/**
 * Resolve one allocation against the authoritative roster.
 *
 * @returns {{field, basis, parts, part_count, principal_count, arity,
 *            attribution, sum, totals_100, resolved, why, open_question,
 *            unmatched_names, unallocated_principals}}
 */
export function resolveAllocation(field, variables = {}, options = {}) {
  const { byField } = semantics();
  const entry = byField.get(field) || null;
  const roster = options.roster || resolveRoster(variables);
  const principals = roster.count;

  /* ── A schema-indexed series: attribution is established by the field name ── */
  if (entry?.shape === "SCHEMA_INDEXED_SERIES") {
    const base = field.replace(/_N$/, "");
    const parts = seriesParts(base, roster, variables);
    const recorded = parts.filter((p) => p.recorded);
    const missing = parts.filter((p) => !p.recorded);
    const total = sum(recorded);
    return {
      field, basis: BASIS.PERCENTAGES, established_by: entry.established_by,
      parts, part_count: recorded.length, principal_count: principals,
      arity: arityOf(recorded.length, principals),
      attribution: recorded.length ? ATTRIBUTION.ROSTER_ADDRESSED : ATTRIBUTION.NOT_APPLICABLE,
      sum: total,
      totals_100: total === null ? null : Math.abs(total - 100) < 1e-6,
      unmatched_names: [],
      unallocated_principals: missing.map((p) => ({ index: p.index, name: p.label })),
      resolved: recorded.length === principals && principals > 0,
      why: recorded.length === principals
        ? `Every principal has a recorded ${field.replace(/_N$/, "").replace(/_/g, " ")}, attributed by the field's own ordinal.`
        : `${missing.length} of ${principals} principals have no recorded value. The deed states what was supplied and says so for the rest; it does not supply a number nobody gave.`,
      open_question: null,
    };
  }

  /* ── A single free-text field ─────────────────────────────────────────────── */
  const parsed = parseAllocation(variables[field]);
  const base = {
    field, basis: parsed.basis, parts: parsed.parts,
    part_count: parsed.parts.length, principal_count: principals,
    arity: arityOf(parsed.parts.length, principals),
    sum: sum(parsed.parts),
    unmatched_names: [], unallocated_principals: [],
  };
  base.totals_100 = base.sum === null ? null : Math.abs(base.sum - 100) < 1e-6;

  if (parsed.basis === BASIS.ABSENT) {
    return {
      ...base, attribution: ATTRIBUTION.NOT_APPLICABLE, resolved: false,
      why: "No allocation was recorded.",
      open_question: entry?.authority?.length
        ? `Nothing is recorded, so the statutory default governs. ${entry.authority[0].act} s.${entry.authority[0].section}: ${entry.authority[0].note}`
        : "Nothing is recorded and no default is authored for this field.",
    };
  }

  if (parsed.basis === BASIS.NARRATIVE) {
    return {
      ...base, attribution: ATTRIBUTION.NOT_APPLICABLE, resolved: false,
      why: `"${parsed.raw}" is a description of a division rather than a division. It is carried to the page as the parties wrote it and is not parsed into shares.`,
      open_question: `Whether "${parsed.raw}" distributes to each principal in the roster cannot be determined from the words alone.`,
    };
  }

  /* NAMED is the one free-text form that attributes, because the value says so. */
  if (parsed.basis === BASIS.NAMED) {
    const matched = [];
    const unmatched = [];
    for (const part of parsed.parts) {
      const member = (roster.members || []).find(
        (m) => sameMember(m, { name: part.label }).same
      );
      if (member) matched.push({ ...part, index: member.index, member });
      else unmatched.push(part.label);
    }
    const unallocated = (roster.members || [])
      .filter((m) => !matched.some((p) => p.index === m.index))
      .map((m) => ({ index: m.index, name: m.name }));

    if (unmatched.length) {
      return {
        ...base, parts: parsed.parts, attribution: ATTRIBUTION.CONFLICT,
        unmatched_names: unmatched, unallocated_principals: unallocated, resolved: false,
        why: `The allocation names ${unmatched.join(", ")}, who ${
          unmatched.length === 1 ? "is" : "are"
        } not in the roster. A share written against a person the instrument does not bind is not a share; the roster decides who the parties are, and an allocation cannot add one.`,
        open_question: `Is ${unmatched.join(", ")} a party who was omitted from the roster, or a misspelling of a party who is in it?`,
      };
    }

    return {
      ...base, parts: matched, attribution: ATTRIBUTION.ROSTER_ADDRESSED,
      established_by: "NAMED_IN_VALUE",
      unallocated_principals: unallocated,
      resolved: unallocated.length === 0 && matched.length === principals,
      why: unallocated.length
        ? `${unallocated.map((p) => p.name).join(", ")} ${unallocated.length === 1 ? "has" : "have"} no share in an allocation that names everybody else, so the division does not cover the firm.`
        : "Every share is written against a named party and every named party is in the roster.",
      open_question: null,
    };
  }

  /* COLON_SERIES, PERCENTAGES, FRACTIONS — parts exist, and nothing says whose. */
  const mappingEstablished = entry?.positional_mapping === "ESTABLISHED";
  if (!mappingEstablished) {
    return {
      ...base, attribution: ATTRIBUTION.UNATTRIBUTED, resolved: false,
      why: `${parsed.parts.length} shares were written and the roster has ${principals} principals, but nothing in the repository says which share belongs to which principal. ` +
        `Equal counts are not a mapping: reading them in order would be a guess presented as a rendering.`,
      open_question: `Which principal takes which part of "${parsed.raw}"? Writing the allocation with the partners named — "Name 40, Name 40, Name 20" — settles it; the order they appear in does not.`,
    };
  }

  return {
    ...base, attribution: ATTRIBUTION.ROSTER_ADDRESSED,
    established_by: entry.established_by, resolved: base.arity === ARITY.MATCHES,
    why: `Positional mapping for ${field} is recorded as established by ${entry.established_by}.`,
    open_question: null,
  };
}

/**
 * Every allocation this document carries, resolved.
 *
 * A caller that ignores the unresolved ones ships an instrument that divides
 * money among people it cannot name.
 */
export function resolveAllocations(documentType, variables = {}) {
  const { doc } = semantics();
  const roster = resolveRoster(variables);
  return (doc.allocations || [])
    .filter((entry) => (entry.documents || []).includes(documentType))
    .map((entry) => resolveAllocation(entry.field, variables, { roster }))
    .filter((allocation) =>
      allocation.basis !== BASIS.ABSENT || allocation.attribution !== ATTRIBUTION.NOT_APPLICABLE
        ? true
        : allocation.principal_count > 0);
}

/**
 * Does this field name extend a per-principal quantity series the schema already
 * declares — `capital_contribution_3` where it declares 1 and 2?
 *
 * Same structural admission rule as isRosterExtensionField, and the same bound:
 * index 3 and above only, so slots 1 and 2 stay governed by the schema and no
 * two-party document can change behaviour. The difference is the evidence. A
 * roster field is admitted because the family names its principals that way; a
 * series field is admitted because allocation-semantics.json records that the
 * series is per-principal AND that its ordinal means the principal's ordinal.
 * The engine does not read that meaning off the label at runtime — an advocate
 * read it off the label once and wrote it down.
 */
export function isAllocationSeriesField(fieldName = "", declaredFields = new Set()) {
  const has = typeof declaredFields?.has === "function" ? (f) => declaredFields.has(f) : () => false;
  const match = /^(.*)_(\d+)$/.exec(String(fieldName));
  if (!match) return false;
  const [, base, index] = match;
  if (!(Number(index) >= 3)) return false;

  const entry = semantics().byField.get(`${base}_N`);
  if (!entry) return false;
  if (entry.shape !== "SCHEMA_INDEXED_SERIES") return false;
  if (entry.positional_mapping !== "ESTABLISHED") return false;
  if (entry.extends_beyond_declared !== true) return false;

  return has(`${base}_1`) && has(`${base}_2`);
}
