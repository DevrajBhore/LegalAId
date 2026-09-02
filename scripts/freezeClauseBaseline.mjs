/**
 * freezeClauseBaseline.mjs
 *
 * Snapshots WHICH CLAUSES each document type currently emits, so that the
 * clause-selection layer can be changed safely.
 *
 * Why this exists
 * ---------------
 * Today clause selection is effectively unconditional: 16 of 46 blueprints have
 * no conditionality at all, and the conditional ones gate on single-variable
 * `include_if` equality. The moment `applies_when` predicates start suppressing
 * clauses, every document type can change shape on one commit. Without a
 * before-picture there is no way to tell an intended suppression from a
 * clause silently going missing -- both look like "the document got shorter".
 *
 * This is deliberately NOT the golden corpus. The golden corpus asserts
 * correctness: a lawyer decided a fixture must flag X. This asserts only
 * CONTINUITY: whatever the engine did yesterday, tell me precisely what it does
 * differently today. A baseline entry is not a claim that the output is right.
 *
 * Two intake levels per type, because they fail differently:
 *   minimal  only the fields the type declares required. Catches clauses that
 *            silently vanish when a field is blank.
 *   full     every field the type declares. Catches conditionals that never
 *            fire because nothing ever sets their flag.
 *
 * Usage
 *   node scripts/freezeClauseBaseline.mjs           compare against baseline
 *   node scripts/freezeClauseBaseline.mjs --write   record a new baseline
 *   node scripts/freezeClauseBaseline.mjs --write --only=NDA,VENDOR_AGREEMENT
 *
 * Exit code is non-zero when the emitted clause set drifts from the baseline,
 * so this can sit in `npm test` and in CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(HERE, "..", "tests", "baseline", "clause-baseline.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim().toUpperCase()))
  : null;

// ── Intake synthesis ────────────────────────────────────────────────────────
// The baseline must be reproducible byte-for-byte across machines and dates, so
// every value here is a fixed constant. Nothing derives from Date.now(), no
// random ids, no locale-dependent formatting. A baseline that churns on its own
// is worse than no baseline: people stop reading the diff.

// ── Specimen parties ────────────────────────────────────────────────────────
// The intake validator checks that the two sides of an instrument are actually
// two different legal persons -- by name, PAN, CIN, GSTIN and LLPIN. A single
// specimen identity pasted into every party slot therefore fails on five
// separate checks, and a failed intake emits zero clauses. So each ROLE gets
// its own coherent identity: a name, an address, an entity type, and a matching
// set of statutory identifiers that no other role shares.

const SPECIMEN_ENTITIES = [
  {
    name: "Northline Industries Private Limited",
    type: "Private Limited Company",
    address: "12 Turner Road, Bandra West, Mumbai, Maharashtra 400050",
    signatory: "Anita Rao",
    designation: "Director",
    authority: "Board resolution dated 4 March 2024",
    pan: "AABCN1234A",
    cin: "U74999MH2015PTC123456",
    gstin: "27AABCN1234A1Z5",
    llpin: "AAB-1234",
  },
  {
    name: "Cavalry Logistics LLP",
    type: "LLP",
    address: "88 Residency Road, Bengaluru, Karnataka 560025",
    signatory: "Rajesh Menon",
    designation: "Designated Partner",
    authority: "Partners' resolution dated 11 April 2024",
    pan: "AACCL5678B",
    cin: "U63030KA2016PTC654321",
    gstin: "29AACCL5678B1Z3",
    llpin: "AAC-5678",
  },
  {
    name: "Meridian Ventures Private Limited",
    type: "Private Limited Company",
    address: "5 Barakhamba Road, Connaught Place, New Delhi, Delhi 110001",
    signatory: "Farah Qureshi",
    designation: "Managing Director",
    authority: "Board resolution dated 2 June 2024",
    pan: "AADCM9012C",
    cin: "U65990DL2017PTC987654",
    gstin: "07AADCM9012C1Z1",
    llpin: "AAD-9012",
  },
];

const SPECIMEN_PEOPLE = [
  "Priya Sharma",
  "Vikram Iyer",
  "Sneha Kulkarni",
  "Arjun Nair",
];

// Field names carry their role as a prefix. Mapping the prefix to a slot index
// is what keeps party 1 and party 2 distinct across every naming convention the
// forty types use between them.
const ROLE_SLOTS = [
  [/^(party_1|first_party|disclosing|manufacturer|principal|employer|company|landlord|licensor|lessor|lender|creditor|seller|supplier|vendor|service_provider|consultant_client|franchisor|assignor|obligor|shareholder_1|partner_1|founder_1|promisor)/, 0],
  [/^(party_2|second_party|receiving|distributor|employee|intern|tenant|licensee|lessee|borrower|debtor|buyer|purchaser|customer|contractor|consultant|franchisee|assignee|beneficiary|shareholder_2|partner_2|founder_2|promisee)/, 1],
  [/^(guarantor|surety|third_party|witness|deponent|attorney|trustee|shareholder_3|partner_3)/, 2],
];

function roleSlot(field) {
  for (const [pattern, index] of ROLE_SLOTS) {
    if (pattern.test(field)) return index;
  }
  return null;
}

// Jurisdiction and dates are shared by every role and every type.
const FIXED = {
  operating_state: "Maharashtra",
  governing_law_state: "Maharashtra",
  execution_city: "Mumbai",
  effective_date: "2025-01-01",
};

// A value that is plausible for the FIELD'S OWN MEANING, and that the intake
// validator will actually accept.
//
// The first version of this guessed from the field name and produced
// "Specimen value for exclusivity" for a select whose only legal values are
// Exclusive / Non-Exclusive / Semi-Exclusive. Every document then failed input
// validation, emitted zero clauses, and the baseline dutifully recorded forty
// empty documents as the thing to protect -- a baseline that passes no matter
// what you break. So the synthesiser reads the SAME schema the validator reads
// (VARIABLE_CONFIG, via getVariables) and takes its answers from there.
function syntheticValue(field, definition = {}) {
  if (FIXED[field] !== undefined) return FIXED[field];

  const type = String(definition.type || "text").toLowerCase();
  const name = field.toLowerCase();

  // Cross-field invariants the validator enforces between fields, which a
  // per-field synthesiser cannot see. Each of these was a real blocking error.
  //   - shareholdings must total exactly 100
  //   - a lock-in cannot outlast the term it sits inside
  //   - price/consideration terms are checked for specificity, not just presence
  const PAIRED = {
    shareholding_percentage_1: "50",
    shareholding_percentage_2: "50",
    founder_equity_split: "50:50",
    // Declared as a number of months, so "6 months" fails the type check.
    lock_in_period: "6",
    lockin_period: "6",
    price_terms: "INR 500 per unit, exclusive of GST",
    min_purchase: "1000 units per quarter",
    liquidation_preference_multiple: "1",
    department: "Operations",
    working_hours: "40",
  };
  if (PAIRED[name] !== undefined) return PAIRED[name];

  // A select's options are the only admissible values. Take the first, which is
  // stable across runs; where the first option is a "none / not applicable"
  // answer it would suppress conditional clauses, so prefer the first option
  // that actually asserts something.
  if (Array.isArray(definition.options) && definition.options.length) {
    // An entity-type select must agree with the NAME chosen for the same role.
    // The first option in these lists is "Individual", and pairing that with
    // "Northline Industries Private Limited" trips validateTypeConsistency.
    if (/_type$/.test(name)) {
      const slot = roleSlot(name);
      const wanted = slot === null ? null : SPECIMEN_ENTITIES[slot % SPECIMEN_ENTITIES.length].type;
      const isPerson = /(employee|intern|deponent|witness|founder|partner_|attorney|individual)/.test(name);
      const match = definition.options.find((option) =>
        isPerson
          ? /individual|person|natural/i.test(String(option))
          : wanted && String(option).trim().toLowerCase() === wanted.toLowerCase()
      );
      if (match) return match;
      const entityOption = definition.options.find(
        (option) => !/individual|person|natural|proprietor/i.test(String(option))
      );
      if (!isPerson && entityOption) return entityOption;
    }
    const substantive = definition.options.find(
      (option) => !/^(none|no|n\/a|not applicable|select)/i.test(String(option).trim())
    );
    return substantive || definition.options[0];
  }

  // Identity is resolved BEFORE any name-shape heuristic. It used to run last,
  // and `deponent_parent_name` was answered with "500000" because the money
  // pattern /rent/ matches the substring inside "pa[rent]_name". Every word
  // below is therefore anchored to a token boundary, and identity wins outright.
  // Role-scoped identity. Everything below is answered from the specimen entity
  // that owns this field's role prefix, so no two roles ever collide.
  const slot = roleSlot(name);
  if (slot !== null) {
    const entity = SPECIMEN_ENTITIES[slot % SPECIMEN_ENTITIES.length];
    if (/_gstin$/.test(name)) return entity.gstin;
    if (/_pan$/.test(name)) return entity.pan;
    if (/_cin$/.test(name)) return entity.cin;
    if (/_llpin$/.test(name)) return entity.llpin;
    if (/_din$/.test(name)) return `0012345${slot}`;
    if (/_type$/.test(name)) return entity.type;
    if (/_address$/.test(name)) return entity.address;
    if (/_signatory_name$/.test(name)) return entity.signatory;
    if (/_signatory_designation$/.test(name)) return entity.designation;
    if (/_authority_reference$/.test(name)) return entity.authority;
    if (/(_parent_name|_father_name|_spouse_name)$/.test(name)) {
      return SPECIMEN_PEOPLE[(slot + 2) % SPECIMEN_PEOPLE.length];
    }
    if (/_name$/.test(name)) {
      // An employee, intern or deponent is a natural person; a manufacturer or
      // lender is an entity. Picking the wrong one trips the check that a name
      // must agree with the entity type declared beside it.
      return /(employee|intern|deponent|witness|founder|partner_|attorney|individual)/.test(name)
        ? SPECIMEN_PEOPLE[slot % SPECIMEN_PEOPLE.length]
        : entity.name;
    }
  }


  if (type === "date" || /_date$/.test(name)) return "2025-01-01";
  if (type === "checkbox" || type === "boolean") return true;

  if (type === "number") {
    // Numeric fields are range-checked as well as type-checked, by
    // numericPlausibilityValidator, which knows that Delivery Attempts cannot be
    // 500000. So a number defaults SMALL and only money is allowed to be large:
    // an out-of-range default is rejected, and a rejected intake produces an
    // empty document, which is the failure mode this whole script exists to
    // make visible.
    if (/(^|_)(percent|percentage|pct|escalation|equity|dilution|threshold|preference)(_|$)/.test(name)) {
      return "25";
    }
    if (/(^|_)(amount|fee|fees|rent|salary|value|price|deposit|consideration|investment|valuation|inr|compensation|ctc)(_|$)/.test(name)) {
      return "500000";
    }
    if (/(^|_)(quantity|units)(_|$)/.test(name)) return "1000";
    // Delivery Attempts has a ceiling of 10, so counts stay small; durations are
    // the only numbers here allowed to reach 30.
    if (/(^|_)(attempts|count|installments|instalments)(_|$)/.test(name)) return "3";
    if (/(^|_)(days|months|years|period|tenure|cliff|notice|age)(_|$)/.test(name)) return "30";
    if (/(^|_)(rate|interest)(_|$)/.test(name)) return "12";
    return "10";
  }

  // Durations are parsed, not just stored: "Specimen value" fails
  // parseDurationMonths and the type refuses to generate.
  if (/(^|_)(duration|term|period|tenure|vesting|lockin|exclusivity)(_|$)/.test(name)) {
    return "24 months";
  }
  if (/(^|_)(days)(_|$)/.test(name)) return "30";
  if (/(^|_)(amount|fee|fees|rent|salary|value|price|deposit|consideration|investment|inr)(_|$)/.test(name)) {
    return "500000";
  }
  if (/(^|_)email(_|$)/.test(name)) return "contracts@example.in";
  if (/_gstin$/.test(name)) return SPECIMEN_ENTITIES[0].gstin;
  if (/_pan$/.test(name)) return SPECIMEN_ENTITIES[0].pan;
  if (/_cin$/.test(name)) return SPECIMEN_ENTITIES[0].cin;
  if (/_llpin$/.test(name)) return SPECIMEN_ENTITIES[0].llpin;
  if (/_name$/.test(name)) return SPECIMEN_PEOPLE[0];
  if (/(^|_)city(_|$)/.test(name)) return "Mumbai";
  if (/(^|_)state(_|$)/.test(name)) return "Maharashtra";
  if (/(^|_)(address|premises|property|location|site)(_|$)/.test(name)) {
    return "12 Turner Road, Bandra West, Mumbai, Maharashtra 400050";
  }

  // Free text. Two constraints shape this: the validator rejects text that defers
  // to a schedule or annexure, AND several types check that the supplied value
  // actually appears in the generated clause. A long boilerplate sentence fails
  // the second check because clause composition rewrites it, so the specimen is
  // a short concrete noun phrase that survives being embedded verbatim.
  // TEXT_RULES imposes a floor of up to 12 characters and 4 words on the
  // free-text fields that carry the bargain, so the specimen has to be a real
  // phrase. Stripping it down to two words failed exactly those fields.
  const words = field.replace(/_/g, " ").trim();
  return `Specimen ${words} recorded and agreed between the parties`;
}

/**
 * The intake a type asks for is declared in two places that do not agree, and
 * both matter:
 *   DOCUMENT_CONFIG   requiredFields + the sections the form renders
 *   VARIABLE_CONFIG   the typed schema the validator enforces
 * The union is the honest "full" intake; requiredFields is "minimal".
 */
function fieldsFor(docType) {
  const config = DOCUMENT_CONFIG[docType] || {};
  const schema = getVariables(docType) || {};

  const required = new Set(config.requiredFields || []);
  for (const [field, definition] of Object.entries(schema)) {
    if (definition?.required === true) required.add(field);
  }

  const all = new Set(required);
  for (const section of config.sections || []) {
    for (const field of section.fields || []) all.add(field);
  }
  for (const field of Object.keys(schema)) all.add(field);

  return { required, all, schema };
}

function buildVariables(docType, level) {
  const { required, all, schema } = fieldsFor(docType);
  const wanted = level === "minimal" ? required : all;

  const variables = {};
  for (const field of wanted) {
    variables[field] = syntheticValue(field, schema[field]);
  }
  // Identity and jurisdiction are supplied at both levels: a document that
  // cannot name its parties fails for a reason that has nothing to do with the
  // clause selection this baseline is measuring.
  for (const [field, value] of Object.entries(FIXED)) {
    if (variables[field] === undefined && (level === "full" || all.has(field))) {
      variables[field] = value;
    }
  }
  return variables;
}

// ── Capture ─────────────────────────────────────────────────────────────────

async function capture(docType, level) {
  const variables = buildVariables(docType, level);
  try {
    const result = await generateDocument({ document_type: docType, variables });
    const clauses = result?.draft?.clauses || [];
    const validation = result?.validation || {};
    return {
      generated: true,
      // Order matters: a reordering is a real change to the instrument.
      clauses: clauses.map((c) => c.clause_id),
      // Ids only, never messages. Message wording is edited constantly and would
      // make this file churn for reasons that are not clause-set changes.
      blocking: [...new Set((validation.blockingIssues || []).map((i) => i.rule_id))].sort(),
      advisory: [...new Set((validation.advisoryIssues || []).map((i) => i.rule_id))].sort(),
      notices: [...new Set((validation.notices || []).map((i) => i.rule_id))].sort(),
    };
  } catch (error) {
    // A type that cannot generate is itself a fact worth freezing: when one of
    // the seven currently-failing types starts working, that shows up as drift
    // and gets noticed rather than being discovered by a user.
    return { generated: false, error: String(error?.message || error).slice(0, 200) };
  }
}

// ── Diffing ─────────────────────────────────────────────────────────────────

function diffList(before = [], after = []) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((x) => !beforeSet.has(x)),
    removed: before.filter((x) => !afterSet.has(x)),
    reordered:
      before.length === after.length &&
      before.some((x, i) => x !== after[i]) &&
      before.filter((x) => afterSet.has(x)).length === before.length,
  };
}

function diffEntry(label, before, after) {
  const lines = [];
  if (before.generated !== after.generated) {
    lines.push(
      `  ${after.generated ? "NOW GENERATES" : "NO LONGER GENERATES"}` +
        (after.generated ? "" : ` — ${after.error}`)
    );
    return lines;
  }
  if (!after.generated) {
    if (before.error !== after.error) {
      lines.push(`  failure changed:\n    was: ${before.error}\n    now: ${after.error}`);
    }
    return lines;
  }
  // A document that went from N clauses to none has not "removed N clauses" --
  // it has stopped generating, usually because a new blocking issue rejected the
  // intake. Reporting that as a long removal list buries the one line that
  // explains it. Suppressing a single clause can trigger this: dropping
  // IP_TRADEMARK_USAGE_001 from the distribution blueprint raises
  // INPUT_MISMATCH_BRANDING_RIGHTS, which collapses the whole instrument.
  const beforeCount = (before.clauses || []).length;
  const afterCount = (after.clauses || []).length;
  if (beforeCount > 0 && afterCount === 0) {
    const cause = (after.blocking || []).filter((id) => !(before.blocking || []).includes(id));
    lines.push(
      `  COLLAPSED — emitted ${beforeCount} clauses, now emits none` +
        (cause.length ? `\n    new blocking issue: ${cause.join(", ")}` : "")
    );
    return lines;
  }
  if (beforeCount === 0 && afterCount > 0) {
    lines.push(`  RECOVERED — emitted nothing, now emits ${afterCount} clauses`);
    const fixed = (before.blocking || []).filter((id) => !(after.blocking || []).includes(id));
    if (fixed.length) lines.push(`    resolved: ${fixed.join(", ")}`);
    return lines;
  }

  for (const key of ["clauses", "blocking", "advisory", "notices"]) {
    const d = diffList(before[key], after[key]);
    if (d.added.length) lines.push(`  + ${key}: ${d.added.join(", ")}`);
    if (d.removed.length) lines.push(`  - ${key}: ${d.removed.join(", ")}`);
    if (d.reordered) lines.push(`  ~ ${key}: same members, different order`);
  }
  return lines;
}

// ── Main ────────────────────────────────────────────────────────────────────

const types = Object.keys(DOCUMENT_TYPE_REGISTRY)
  .filter((t) => !ONLY || ONLY.has(t))
  .sort();

const current = {};
for (const docType of types) {
  current[docType] = {
    minimal: await capture(docType, "minimal"),
    full: await capture(docType, "full"),
  };
}

if (WRITE) {
  const existing = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
    : { note: "", types: {} };

  const merged = ONLY ? { ...existing.types, ...current } : current;
  const payload = {
    note:
      "Continuity baseline, not a correctness assertion. Records which clauses each " +
      "document type emits so clause-selection changes are visible as a diff. " +
      "Regenerate deliberately with `node scripts/freezeClauseBaseline.mjs --write` " +
      "and review the diff before committing it.",
    generator: "scripts/freezeClauseBaseline.mjs",
    types: Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]])),
  };
  // A baseline in which most types emit nothing is worse than no baseline: it
  // passes no matter what you break, because there is nothing left to lose. The
  // first working version of this script recorded forty empty documents and
  // reported success. Refuse to write that.
  const entries = Object.values(merged);
  const withClauses = entries.filter((v) => (v.full.clauses || []).length > 0).length;
  if (withClauses < entries.length * 0.75) {
    console.error(
      `Refusing to write: only ${withClauses} of ${entries.length} types produced any ` +
        `clauses. That baseline would assert nothing. Fix the synthetic intake first ` +
        `-- inspect the blocking issues each empty type reports.`
    );
    const empties = Object.entries(merged)
      .filter(([, v]) => !(v.full.clauses || []).length)
      .slice(0, 10);
    for (const [type, v] of empties) {
      console.error(`  ${type}: ${(v.full.blocking || []).slice(0, 3).join(", ") || v.full.error}`);
    }
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const generated = Object.values(merged).filter((v) => (v.full.clauses || []).length > 0).length;
  console.log(`Wrote baseline for ${Object.keys(merged).length} document types.`);
  console.log(`  emit clauses (full intake): ${generated}`);
  console.log(`  emit nothing:               ${Object.keys(merged).length - generated}`);
  console.log(`  -> ${path.relative(process.cwd(), BASELINE_PATH)}`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error("No baseline recorded. Run with --write first.");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).types || {};
const report = [];
let drifted = 0;

for (const docType of types) {
  const before = baseline[docType];
  if (!before) {
    report.push(`${docType}\n  NEW TYPE — not in baseline`);
    drifted += 1;
    continue;
  }
  const lines = [];
  for (const level of ["minimal", "full"]) {
    const entryLines = diffEntry(level, before[level], current[docType][level]);
    if (entryLines.length) lines.push(` [${level}]`, ...entryLines);
  }
  if (lines.length) {
    report.push(`${docType}\n${lines.join("\n")}`);
    drifted += 1;
  }
}

for (const docType of Object.keys(baseline)) {
  if (!types.includes(docType) && !ONLY) {
    report.push(`${docType}\n  REMOVED — in baseline but no longer in the registry`);
    drifted += 1;
  }
}

if (!drifted) {
  console.log(`Clause baseline: no drift across ${types.length} document types.`);
  process.exit(0);
}

console.log(`Clause baseline drift in ${drifted} of ${types.length} document types:\n`);
console.log(report.join("\n\n"));
console.log(
  "\nEvery line above is either an intended change or a regression.\n" +
    "If intended, re-record with: node scripts/freezeClauseBaseline.mjs --write"
);
process.exit(1);
