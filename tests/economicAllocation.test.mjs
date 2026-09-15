/**
 * economicAllocation.test.mjs — WHOSE 40 IS THIS?
 *
 * D4.18 made the roster authoritative for WHO the parties are, and proved that
 * position is identity when a document says "Party 1". This file exists because
 * that result DOES NOT CARRY OVER, and the first check below is the one that
 * says so:
 *
 *     "position is identity"  ≠  "position is economic-allocation identity"
 *
 * Three partners and the ratio "40:40:20" is agreement in COUNT. Reading the
 * numbers in order would be an inference from arity dressed up as a rendering,
 * and it would turn a deed that is merely AMBIGUOUS into one that is CONFIDENTLY
 * WRONG — worse, because an ambiguous sentence gets read twice and a confident
 * one does not.
 *
 * So the property under test is:
 *
 *     Every allocation that distributes a quantity among N parties is either
 *     mechanically attributable to the authoritative roster, or explicitly
 *     unresolved. There is no third state and no silent third behaviour.
 *
 * TWO CHECKS AT THE END ARE THE ONES THAT WOULD CATCH ME CHEATING: that nothing
 * in the resolver can rescale an allocation, asserted by scanning the source, and
 * that the two-party case reports the same defect the three-party case does. The
 * second matters because "60:40" between two partners never said whose 60 it was
 * either. The roster work made this visible; it did not create it, and a test
 * suite that only fired above two would be quietly asserting the old documents
 * are fine.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { sanitizeVariablesForDocument, getVariables } from "../backend/config/variableConfig.js";
import {
  resolveAllocation, resolveAllocations, parseAllocation,
  ATTRIBUTION, ARITY, BASIS,
} from "../backend/services/economicAllocation.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const PEOPLE = [
  { name: "Meera Iyer", address: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", pan: "AAAPI1234C" },
  { name: "Arjun Desai", address: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", pan: "AABPD2345F" },
  { name: "Sunita Rao", address: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", pan: "AACPR3456G" },
  { name: "Imran Qureshi", address: "77 Turner Road, Bandra, Mumbai, Maharashtra 400050", pan: "AADPQ4567H" },
];

const slots = (n) => Object.fromEntries(PEOPLE.slice(0, n).flatMap((p, i) => [
  [`partner_${i + 1}_name`, p.name], [`partner_${i + 1}_address`, p.address],
  [`partner_${i + 1}_type`, "Individual"], [`partner_${i + 1}_pan`, p.pan],
]));

const allocationOf = (n, ratio, extra = {}) =>
  resolveAllocation("profit_sharing_ratio", { ...slots(n), profit_sharing_ratio: ratio, ...extra });

async function deed(overrides = {}) {
  const variables = {
    ...variablesFor("PARTNERSHIP_DEED", { profile: FIXTURE_PROFILE.WELL_FILLED }),
    partnership_name: "Bandra Associates",
    party_1_pan: "", party_2_pan: "", party_1_gstin: "", party_2_gstin: "",
    partner_1_name: "", partner_2_name: "", partner_1_address: "", partner_2_address: "",
    capital_contribution_1: 600000, capital_contribution_2: 300000,
    ...overrides,
  };
  const result = await generateDocument({ document_type: "PARTNERSHIP_DEED", variables });
  const clauses = result?.draft?.clauses || [];
  return {
    result,
    capital: (clauses.find((c) => c.clause_id === "PARTNERSHIP_CAPITAL_001") || {}).text || "",
    blocking: (result?.validation?.blockingIssues || []).map((i) => i.rule_id),
    notices: [
      ...(result?.validation?.notices || []),
      ...(result?.validation?.advisoryIssues || []),
    ].map((i) => i.rule_id).filter((id) => /ALLOCATION/.test(id)),
    allocation: (result?.allocations || []).find((a) => a.field === "profit_sharing_ratio"),
  };
}

/* ── The claim that must NOT be inherited ─────────────────────────────────── */

await check("arity agreement is not a mapping — the whole point", async () => {
  /*
   * Three parties, three numbers, and the answer is still that nobody has said
   * whose share is whose. If this check ever goes green on ROSTER_ADDRESSED
   * without the knowledge artifact changing, somebody has taught the resolver to
   * count instead of to read.
   */
  const a = allocationOf(3, "40:40:20");
  assert.strictEqual(a.arity, ARITY.MATCHES, "the fixture is meant to agree in count");
  assert.strictEqual(a.attribution, ATTRIBUTION.UNATTRIBUTED,
    "equal counts were treated as a positional mapping");
  assert.strictEqual(a.resolved, false);
  assert.ok(/nothing in the repository says which share/i.test(a.why));
  assert.ok(a.open_question && /which principal takes which part/i.test(a.open_question),
    "an unresolved allocation must state the question, not merely decline");
});

await check("the knowledge artifact is what decides, and it says NOT_ESTABLISHED", () => {
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/allocation-semantics.json"), "utf8"));
  const ratio = doc.allocations.find((a) => a.field === "profit_sharing_ratio");
  assert.strictEqual(ratio.positional_mapping, "NOT_ESTABLISHED");
  assert.ok(ratio.evidence_considered.length >= 3,
    "a negative finding has to say what was looked at, or it is just an opinion");
  /* And the evidence has to still be true of the schema it describes. */
  const field = getVariables("PARTNERSHIP_DEED").profit_sharing_ratio;
  assert.ok(!/part(?:y|ner)\s*\d/i.test(`${field.label} ${field.description}`),
    "the label now names a party — the NOT_ESTABLISHED finding is stale");
});

/* ── The seven cases ──────────────────────────────────────────────────────── */

await check("3 parties + 40:40:20 — parts match, attribution does not follow", () => {
  const a = allocationOf(3, "40:40:20");
  assert.strictEqual(a.basis, BASIS.COLON_SERIES);
  assert.strictEqual(a.part_count, 3);
  assert.strictEqual(a.sum, 100);
  assert.strictEqual(a.resolved, false);
});

await check("3 parties + 40:40 — a share short, and it says so", () => {
  const a = allocationOf(3, "40:40");
  assert.strictEqual(a.arity, ARITY.FEWER_PARTS_THAN_PRINCIPALS);
  assert.strictEqual(a.resolved, false);
});

await check("3 parties + 40:40:30 — reported, never normalised", () => {
  const a = allocationOf(3, "40:40:30");
  assert.strictEqual(a.sum, 110, "the total was altered");
  assert.strictEqual(a.totals_100, false);
  assert.deepStrictEqual(a.parts.map((p) => p.value), [40, 40, 30],
    "the parts were rescaled — which chooses the percentage reading and moves money");
  assert.strictEqual(a.resolved, false);
});

await check("3 parties + 1/3,1/3,1/3 — parsed as fractions, not as 1 and 3", () => {
  /*
   * Representation-dependent, so the parser must not impose colon-series
   * semantics on a fraction. "1/3, 1/3, 1/3" read as a colon series would be six
   * parts of value 1 and 3.
   */
  const a = allocationOf(3, "1/3, 1/3, 1/3");
  assert.strictEqual(a.basis, BASIS.FRACTIONS);
  assert.strictEqual(a.part_count, 3, "a fraction was split into a numerator and a denominator");
  assert.ok(Math.abs(a.sum - 1) < 1e-6, `three thirds summed to ${a.sum}`);
  assert.strictEqual(a.attribution, ATTRIBUTION.UNATTRIBUTED,
    "a coherent division is still not an attributed one");
});

await check("4 parties + 40:40:20 — unresolved, and for the arity reason too", () => {
  const a = allocationOf(4, "40:40:20");
  assert.strictEqual(a.principal_count, 4);
  assert.strictEqual(a.arity, ARITY.FEWER_PARTS_THAN_PRINCIPALS);
  assert.strictEqual(a.resolved, false);
});

await check("a named allocation matching the roster is RESOLVED — the one path that works", () => {
  /*
   * There has to be a way to get a resolved allocation, or the model is just a
   * refusal with extra steps. Naming the parties is that way, because the value
   * itself then says whose share is whose.
   */
  const a = allocationOf(3, "Meera Iyer 40, Arjun Desai 40, Sunita Rao 20");
  assert.strictEqual(a.basis, BASIS.NAMED);
  assert.strictEqual(a.attribution, ATTRIBUTION.ROSTER_ADDRESSED);
  assert.strictEqual(a.established_by, "NAMED_IN_VALUE");
  assert.strictEqual(a.resolved, true);
  assert.deepStrictEqual(a.parts.map((p) => p.index), [1, 2, 3]);
});

await check("a named allocation that does not match the roster is a CONFLICT", () => {
  const a = allocationOf(3, "Meera Iyer 40, Arjun Desai 40, Priya Nair 20");
  assert.strictEqual(a.attribution, ATTRIBUTION.CONFLICT);
  assert.deepStrictEqual(a.unmatched_names, ["Priya Nair"]);
  assert.strictEqual(a.resolved, false);
  /* Sunita is in the roster and has no share: the other half of the same defect. */
  assert.deepStrictEqual(a.unallocated_principals.map((p) => p.name), ["Sunita Rao"]);
});

await check("no allocation — the statutory default is named, not silently applied", () => {
  const a = allocationOf(3, "");
  assert.strictEqual(a.basis, BASIS.ABSENT);
  assert.strictEqual(a.resolved, false);
  assert.ok(/13\(b\)/.test(a.open_question),
    "a blank division must say which rule then governs");
});

await check("'equally' is carried as written and not parsed into shares", () => {
  const a = allocationOf(3, "equally");
  assert.strictEqual(a.basis, BASIS.NARRATIVE);
  assert.strictEqual(a.part_count, 0, "a word was turned into numbers");
  assert.strictEqual(a.resolved, false);
});

/* ── The defect is not an N-party defect ──────────────────────────────────── */

await check("two parties report the same gap — this was never about cardinality", () => {
  const a = allocationOf(2, "60:40");
  assert.strictEqual(a.attribution, ATTRIBUTION.UNATTRIBUTED,
    "the two-party deed was declared fine while having the same defect");
  assert.strictEqual(a.resolved, false);
});

/* ── The series allocation, which IS attributable ─────────────────────────── */

await check("capital_contribution_N is attributable, because the field name says whose", () => {
  const a = resolveAllocation("capital_contribution_N", {
    ...slots(3), capital_contribution_1: 600000, capital_contribution_2: 300000,
    capital_contribution_3: 100000,
  });
  assert.strictEqual(a.attribution, ATTRIBUTION.ROSTER_ADDRESSED);
  assert.strictEqual(a.established_by, "SCHEMA_INDEXED_SERIES");
  assert.strictEqual(a.resolved, true);
  assert.deepStrictEqual(a.parts.map((p) => p.value), [600000, 300000, 100000]);
});

await check("a principal with no recorded amount is named, not given one", () => {
  const a = resolveAllocation("capital_contribution_N", {
    ...slots(3), capital_contribution_1: 600000, capital_contribution_2: 300000,
  });
  assert.strictEqual(a.resolved, false);
  assert.deepStrictEqual(a.unallocated_principals.map((p) => p.name), ["Sunita Rao"]);
  assert.strictEqual(a.parts.filter((p) => p.recorded).length, 2);
  assert.strictEqual(a.parts.find((p) => p.index === 3).value, null,
    "an unrecorded contribution was given a number");
});

await check("capital_contribution_3 survives admission; a lookalike does not", () => {
  const admitted = sanitizeVariablesForDocument("PARTNERSHIP_DEED", {
    capital_contribution_1: 1, capital_contribution_2: 2, capital_contribution_3: 3,
    shareholding_percentage_3: 9, invented_total_3: 4,
  });
  assert.strictEqual(admitted.capital_contribution_3, 3);
  assert.ok(!("invented_total_3" in admitted), "any trailing digit now opens the gate");
  assert.ok(!("shareholding_percentage_3" in admitted),
    "a series this document does not declare was admitted anyway");
  assert.strictEqual(
    sanitizeVariablesForDocument("SHAREHOLDERS_AGREEMENT", { shareholding_percentage_3: 9 })
      .shareholding_percentage_3, 9,
    "the series is not admitted on the document that does declare it");
});

/* ── The artifact ─────────────────────────────────────────────────────────── */

await check("the deed states every partner's contribution, or says it has none", async () => {
  const three = await deed({ ...slots(3), profit_sharing_ratio: "40:40:20" });
  assert.deepStrictEqual(three.blocking, []);
  assert.ok(/No capital contribution is recorded in this Deed for Partner 3/.test(three.capital),
    "a deed for three partners recited two contributions and said nothing about the third");

  const all = await deed({ ...slots(3), capital_contribution_3: 100000, profit_sharing_ratio: "40:40:20" });
  assert.ok(/Partner 3 shall contribute/.test(all.capital));
  assert.ok(!/No capital contribution is recorded/.test(all.capital));
});

await check("the ratio reaches the page exactly as written", async () => {
  const d = await deed({ ...slots(3), capital_contribution_3: 100000, profit_sharing_ratio: "40:40:30" });
  assert.ok(d.capital.includes("40:40:30"),
    "the allocation was rewritten on the way to the page");
  assert.ok(!/36\.3|27\.2|33\.3/.test(d.capital), "the parts were normalised into the document");
});

await check("the unresolved allocation is disclosed, and the resolved one is not", async () => {
  const open = await deed({ ...slots(3), capital_contribution_3: 100000, profit_sharing_ratio: "40:40:20" });
  assert.ok(open.notices.includes("ALLOCATION_NOT_ATTRIBUTABLE_TO_A_PARTY"),
    "a deed dividing money among people it cannot name reports nothing");
  assert.strictEqual(open.allocation.attribution, ATTRIBUTION.UNATTRIBUTED);

  const named = await deed({
    ...slots(3), capital_contribution_3: 100000,
    profit_sharing_ratio: "Meera Iyer 40, Arjun Desai 40, Sunita Rao 20",
  });
  assert.deepStrictEqual(named.notices, [],
    "a correctly attributed allocation was still reported as a problem");
  assert.strictEqual(named.allocation.attribution, ATTRIBUTION.ROSTER_ADDRESSED);
});

await check("a stranger's share is reported as a stranger's share", async () => {
  const d = await deed({
    ...slots(3), capital_contribution_3: 100000,
    profit_sharing_ratio: "Meera Iyer 40, Arjun Desai 40, Priya Nair 20",
  });
  assert.ok(d.notices.includes("ALLOCATION_NAMES_A_PERSON_WHO_IS_NOT_A_PARTY"));
  assert.ok(!d.capital.includes("Priya Nair") || d.allocation.attribution === ATTRIBUTION.CONFLICT);
});

/* ── The check that would catch me cheating ───────────────────────────────── */

await check("nothing in the resolver can rescale an allocation", () => {
  /*
   * A resolver that can normalise an allocation can silently move money between
   * people. The property is about arithmetic in code, so the scan strips comments
   * first — D4.17 shipped a guard that fired on its own docstring.
   */
  const src = fs.readFileSync(path.join(ROOT, "backend/services/economicAllocation.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  for (const forbidden of [/\/\s*total/, /\*\s*100/, /100\s*\//, /normalis|normaliz/i, /rescale/i]) {
    assert.ok(!forbidden.test(src),
      `economicAllocation.js contains ${forbidden} — a resolver that can rescale an allocation can move money between parties`);
  }
});

await check("every allocation the document carries lands in exactly one state", async () => {
  /*
   * No fourth implicit state. Every allocation is ROSTER_ADDRESSED, UNATTRIBUTED,
   * CONFLICT or NOT_APPLICABLE, and `resolved` agrees with the state it is in.
   */
  const STATES = new Set(Object.values(ATTRIBUTION));
  for (const ratio of ["40:40:20", "40:40", "Meera Iyer 40, Arjun Desai 40, Sunita Rao 20", "", "equally"]) {
    const all = resolveAllocations("PARTNERSHIP_DEED", { ...slots(3), profit_sharing_ratio: ratio });
    assert.ok(all.length >= 1, "the deed reports no allocations at all");
    for (const a of all) {
      assert.ok(STATES.has(a.attribution), `${a.field}: unknown state ${a.attribution}`);
      assert.strictEqual(typeof a.resolved, "boolean");
      if (a.resolved) {
        assert.strictEqual(a.attribution, ATTRIBUTION.ROSTER_ADDRESSED,
          `${a.field} is resolved without being attributed to anybody`);
        assert.strictEqual(a.arity, ARITY.MATCHES);
      }
      if (!a.resolved && a.attribution !== ATTRIBUTION.ROSTER_ADDRESSED) {
        assert.ok(a.why, `${a.field}: an unresolved allocation must say why`);
      }
    }
  }
});

console.log(`\nALL GREEN (${checks} checks)`);
