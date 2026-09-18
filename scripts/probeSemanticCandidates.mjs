/**
 * probeSemanticCandidates.mjs — FINDING THE QUESTIONS THAT DO NOT ANNOUNCE THEMSELVES
 *
 * D4.20 falsified the method that produced every N-party finding before it.
 * `CORE_DISPUTE_RESOLUTION_001` carries a decision worth money — bilateral or
 * multilateral reference — in the sentence "it shall be referred to arbitration",
 * which names no party at all. The scan that found invariant 60's twenty-three
 * clauses looks for "either Party" and "the other Party". It flagged the harmless
 * amicable-discussion sentence in the same clause and passed straight over the
 * one that matters.
 *
 * So 184/17/5/162 is not a coverage measurement. It is a measurement of
 * LEXICALLY EXPOSED CANDIDATES, and this probe exists to find out whether that
 * was one blind spot or a systemic under-sampling.
 *
 * THE HONEST LIMIT OF WHAT FOLLOWS. Most of the detectors below are still
 * lexical. Replacing one word list with a longer word list would be theatre, so
 * three things make this different and they should be judged on those alone:
 *
 *   1. Each detector names a MECHANISM by which party count changes meaning, and
 *      every mechanism is one this project has already DEMONSTRATED on a real
 *      clause. Nothing here is a category somebody imagined might exist.
 *   2. One detector is not lexical at all: RESPONDS_TO_ROSTER renders the clause
 *      at two and at three principals and compares the shipped text. That is a
 *      fact about behaviour, not about vocabulary.
 *   3. The output is EVIDENCE PER CANDIDATE — the matching sentence — so each
 *      can be adjudicated and the false positives counted rather than assumed
 *      away. A detector that cannot be wrong has not been tested.
 *
 * There is no mechanical oracle for "should this clause change with N?". That is
 * a question of law. This probe ranks candidates and shows its working; it does
 * not classify, and it modifies nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";
import { isRosterExtensionField } from "../backend/services/partyRoster.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

/* ── 1. THE POPULATION ───────────────────────────────────────────────────── */

const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));

const families = [];
for (const type of Object.keys(baseline.types)) {
  const fields = new Set(Object.keys(getVariables(type) || {}));
  const prefix = PRINCIPAL_PREFIXES.find((p) => isRosterExtensionField(`${p}_3_name`, fields));
  if (prefix) families.push({ type, prefix });
}

const reach = new Map();
for (const { type } of families) {
  for (const level of Object.values(baseline.types[type] || {})) {
    for (const id of level?.clauses || []) {
      if (!reach.has(id)) reach.set(id, new Set());
      reach.get(id).add(type);
    }
  }
}

/* ── 2. THE SHIPPED TEXT ─────────────────────────────────────────────────── */
// The artifact is authoritative. D4.15 established that several CORE clauses are
// built at generation time and differ from their library entries, so scanning
// the library would scan a document nobody received.

const shipped = new Map();   // clause_id -> longest rendered text seen
for (const { type } of families) {
  try {
    const r = await generateDocument({
      document_type: type,
      variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    });
    for (const c of r?.draft?.clauses || []) {
      const t = c.text || "";
      if (!shipped.has(c.clause_id) || t.length > shipped.get(c.clause_id).length) {
        shipped.set(c.clause_id, t);
      }
    }
  } catch { /* a family that cannot generate contributes no text */ }
}

/* ── 3. THE NON-LEXICAL DETECTOR ─────────────────────────────────────────── */
// Does the clause's shipped text actually change when a third principal is
// added? This is a fact about behaviour and no word list can fake it.

const PEOPLE = [
  { n: "Meera Iyer", a: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", p: "AAAPI1234C" },
  { n: "Arjun Desai", a: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", p: "AABPD2345F" },
  { n: "Sunita Rao", a: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", p: "AACPR3456G" },
];
async function deedAt(n) {
  const v = {
    ...variablesFor("PARTNERSHIP_DEED", { profile: FIXTURE_PROFILE.WELL_FILLED }),
    partnership_name: "Bandra Associates",
    party_1_pan: "", party_2_pan: "", party_1_gstin: "", party_2_gstin: "",
    partner_1_name: "", partner_2_name: "", partner_1_address: "", partner_2_address: "",
    capital_contribution_1: 600000, capital_contribution_2: 300000,
    ...Object.fromEntries(PEOPLE.slice(0, n).flatMap((x, i) => [
      [`partner_${i + 1}_name`, x.n], [`partner_${i + 1}_address`, x.a],
      [`partner_${i + 1}_type`, "Individual"], [`partner_${i + 1}_pan`, x.p]])),
  };
  const r = await generateDocument({ document_type: "PARTNERSHIP_DEED", variables: v });
  return Object.fromEntries((r?.draft?.clauses || []).map((c) => [c.clause_id, c.text || ""]));
}
const at2 = await deedAt(2);
const at3 = await deedAt(3);
const responds = new Set(
  Object.keys(at3).filter((id) => id in at2 && at3[id] !== at2[id]));

/* ── 4. THE MECHANISMS ───────────────────────────────────────────────────── */
//
// Every entry cites the clause that demonstrated it. A mechanism with no
// demonstrated instance is a guess, and guesses are how the pronoun scan got its
// authority in the first place.

const MECHANISMS = [
  {
    key: "BINARY_PRONOUN",
    what: "Binary party reference in the text",
    demonstrated_by: "the 23 clauses of invariant 60",
    baseline: true,           // this IS the old method; kept to measure against
    test: (t) => match(t, /\beither Party\b|\bthe other Party\b|\bneither Party\b|\bboth Parties\b|\bbetween the Parties\b|\bthe other Party's\b/i),
  },
  {
    key: "REFERENCE_OR_PROCEEDING",
    what: "A dispute, claim or proceeding is commenced, referred or brought",
    demonstrated_by: "CORE_DISPUTE_RESOLUTION_001 — bilateral or multilateral reference, and the sentence names no party",
    test: (t) => match(t, /\breferred to arbitration\b|\brefer(?:red|ral)? (?:the |any )?(?:dispute|claim|matter)\b|\bcommence(?:d|ment of)? (?:arbitration|proceedings|any action)\b|\bbring(?:ing)? (?:any )?(?:claim|action|proceedings)\b|\bfinal and binding on\b/i),
  },
  {
    key: "DIVIDED_QUANTITY",
    what: "A sum, cap, share or contribution divided among the parties",
    demonstrated_by: "CORE_LIMITATION_LIABILITY_001 (three readings differing in money); PARTNERSHIP_CAPITAL_001",
    /*
     * `proportion` matched ESOP and founder vesting — "the proportion of the
     * options attributable to the period served". That divides a quantity over
     * TIME, not among people, and party count changes nothing about it. The test
     * now requires the division to be among parties or a cap on liability.
     */
    /*
     * FALSE NEGATIVE, FOUND BY SAMPLING THE CLAUSES THIS PROBE CLEARED.
     * CORE_STAMP_AND_COSTS_001 — 22 families — says costs "shall be BORNE
     * equally by the Parties". The pattern knew "shared equally" and not "borne
     * equally", so a divided quantity in twenty-two documents was reported as
     * carrying no mechanism at all. Absence of a marker was never evidence of
     * absence of a mechanism; that is the lesson D4.20 taught about pronouns and
     * it applies to this vocabulary too.
     */
    test: (t) => match(t, /\baggregate liability\b|\b(?:liability|the cap)[^.]{0,40}shall not exceed\b|\bin the ratio of\b|\bin the proportion\b|\bproportionate (?:share|liability)\b|\b(?:share[sd]?|borne|payable|divided) (?:equally|rateably)\b|\bborne (?:by the Parties|in equal)\b|\bshall contribute\b|\bapportion\w*\b|\bpro rata\b|\bjointly and severally\b/i),
  },
  {
    key: "INSTRUMENT_CONTINUATION",
    what: "The instrument as a whole ends, survives or continues when one party's position changes",
    demonstrated_by: "CORE_TERMINATION_001 — dissolution under Partnership Act s.39 versus expulsion under s.33",
    test: (t) => match(t, /\bterminate this Agreement\b|\bthis Agreement shall (?:terminate|continue|remain in|come to an end)\b|\bexpiry or termination\b|\bcease to be a (?:Party|Partner)\b|\bwithdraw(?:al)? from\b|\bdissolution\b/i),
  },
  {
    key: "COLLECTIVE_DECISION",
    what: "Something requires consent, agreement or a decision of the parties as a body",
    demonstrated_by: "CORE_AMENDMENT_001 and CORE_GOVERNANCE_PROTECTIONS_001 — 'all others' is the only reading consistent with the two-party text",
    /*
     * `\bmajority\b` alone matched "being of the age of majority" in
     * CORE_CONTRACT_FORMATION_001 — a capacity recital under Section 11 of the
     * Contract Act, where nothing whatever turns on how many parties there are.
     * The same error as reading the generic plural "the Partners" as an
     * attribution: a word that appears is not a mechanism that operates.
     */
    test: (t) => match(t, /\bconsent of (?:the other|all|each of the other|both) (?:Party|Parties)\b|\bmutual(?:ly)? (?:agreed|agreement|written consent)\b|\bunanimous\w*\b|\b(?:simple |special |requisite )?majority (?:of the|vote|consent|approval|decision|resolution)\b|\bMajority (?:Shareholders|Partners|Members)\b|\bjointly appointed\b|\bsigned by (?:both|all) (?:Parties|the Parties)\b|\bagreed (?:in writing )?(?:between|among|by) the Parties\b/i),
  },
  {
    key: "PAIRWISE_ROLE",
    what: "A role-pair that has to be instantiated for each pair of parties",
    demonstrated_by: "CORE_CONFIDENTIALITY_001 and CORE_INDEMNITY_001 — RECIPROCAL_SEVERAL",
    /*
     * Bare `Recipient` matched "recipient GSTIN" in two payment clauses — a GST
     * invoicing field, not a party role. A role-pair only exists where the text
     * uses the DEFINED TERM, so the test requires the capitalised pair form.
     */
    test: (t) => match(t, /\b(?:Disclosing|Receiving|Indemnifying|Indemnified) Party\b|\bshall indemnif\w+\b|\bhold harmless\b|\bthe Discloser\b|\bthe Recipient\b/),
  },
  {
    key: "PARTY_SUCCESSION",
    what: "A party's position is transferred, assigned or assumed by somebody else",
    demonstrated_by: "CORE_ASSIGNMENT_001 — UNIFORM_PROHIBITION; and the roster work, where who is a party is constitutive",
    /*
     * THE WORST OF THE THREE. `assign\w*` matched every intellectual-property
     * assignment in the corpus — the Assignor assigning COPYRIGHT, a contractor
     * assigning WORK PRODUCT. Assigning an asset is not succession to a party's
     * position in the instrument, and conflating them turned sixteen IP clauses
     * into N-party candidates. "successors and permitted assigns" went the same
     * way: it is testatum boilerplate attached to every party in every deed.
     * The mechanism is a PARTY's contractual position moving, so the test now
     * requires the Agreement itself to be the object.
     */
    test: (t) => match(t, /\bassign (?:or transfer )?(?:this Agreement|its rights (?:and obligations )?under this Agreement|any of its rights or obligations under this Agreement)\b|\bnovat\w+\b|\btransfer (?:its|their) rights and obligations\b|\bcease to be a (?:Party|Partner|Shareholder|Founder)\b/i),
  },
  {
    key: "UNILATERAL_ACT_BINDING_OTHERS",
    what: "One party's act — a waiver, an election, an indulgence — that may or may not bind the rest",
    demonstrated_by: "CORE_WAIVER_001, found by sampling the clauses this probe had CLEARED: a waiver effective only if 'signed by or on behalf of' the party granting it, where at three parties whether the others lose the right too is an open question",
    test: (t) => match(t, /\boperate as a waiver\b|\bwaiver of any right\b|\bsigned by or on behalf of\b|\bno failure, delay,? or indulgence\b/i),
  },
  {
    key: "PARTY_ENUMERATION",
    what: "The clause lists or binds the parties individually",
    demonstrated_by: "CORE_IDENTITY_001, CORE_SIGNATURE_BLOCK_001 — ROSTER_DRIVEN",
    test: (t) => match(t, /\bof the (?:First|Second|Third) Part\b|\bIN WITNESS WHEREOF\b|\bcollectively referred to as the "Parties"\b|\bFor and on behalf of\b/i),
  },
];

function match(text, re) {
  const m = re.exec(text || "");
  if (!m) return null;
  const i = Math.max(0, m.index - 60);
  return (text.slice(i, m.index + m[0].length + 60) || "").replace(/\s+/g, " ").trim();
}

/* ── 5. RUN ──────────────────────────────────────────────────────────────── */

const rows = [];
for (const id of [...reach.keys()].sort()) {
  const text = shipped.get(id) || "";
  const hits = [];
  for (const mech of MECHANISMS) {
    const ev = mech.test(text);
    if (ev) hits.push({ key: mech.key, baseline: !!mech.baseline, evidence: ev });
  }
  if (responds.has(id)) {
    hits.push({ key: "RESPONDS_TO_ROSTER", baseline: false,
      evidence: "shipped text differs between a two-principal and a three-principal deed" });
  }
  const t = treatmentFor(id, 3);
  rows.push({
    id, families: reach.get(id).size, hits,
    lexical: hits.some((h) => h.baseline),
    candidate: hits.length > 0,
    state: t.outcome === TREATMENT.DETERMINED ? "SAFE"
      : t.shape ? "AUTHORED_DECISION_PENDING" : "NOT_CLASSIFIED",
    shape: t.shape || null,
    has_text: text.length > 0,
  });
}

/* ── 6. REPORT ───────────────────────────────────────────────────────────── */

const candidates = rows.filter((r) => r.candidate);
const lexical = rows.filter((r) => r.lexical);
const newly = candidates.filter((r) => !r.lexical);
const noText = rows.filter((r) => !r.has_text);

say("# Semantic candidate discovery — did the pronoun scan under-sample?\n");
say(`Families that admit a third principal: **${families.length}**`);
say(`Distinct clauses they reach: **${rows.length}**`);
say(`Clauses with no shipped text captured (not rendered by any fixture): **${noText.length}**\n`);
say("| measure | clauses |");
say("|---|---|");
say(`| flagged by the OLD lexical scan (binary pronoun only) | **${lexical.length}** |`);
say(`| flagged by semantic mechanisms | **${candidates.length}** |`);
say(`| **invisible to the old scan** | **${newly.length}** |`);
say(`| flagged by nothing at all | ${rows.length - candidates.length} |`);

say("\n## Which mechanism finds what\n");
say("| mechanism | clauses | of which the pronoun scan missed |");
say("|---|---|---|");
for (const mech of [...MECHANISMS.map((m) => m.key), "RESPONDS_TO_ROSTER"]) {
  const hit = rows.filter((r) => r.hits.some((h) => h.key === mech));
  const missed = hit.filter((r) => !r.lexical);
  say(`| ${mech} | ${hit.length} | ${missed.length} |`);
}

say("\n## Newly discovered candidates, ranked by exposure\n");
say("Every row is a clause the old method could not see. `state` is its CURRENT");
say("classification, so NOT_CLASSIFIED here means nobody has ever examined it.\n");
say("| clause | families | state | mechanisms | evidence |");
say("|---|---|---|---|---|");
for (const r of newly.sort((a, b) => b.families - a.families).slice(0, 40)) {
  const mechs = r.hits.map((h) => h.key).join(", ");
  const ev = (r.hits[0]?.evidence || "").slice(0, 90).replace(/\|/g, "\\|");
  say(`| \`${r.id}\` | ${r.families} | ${r.state} | ${mechs} | …${ev}… |`);
}

say("\n## The control: what the pronoun scan found that the mechanisms do not\n");
const lexOnly = lexical.filter((r) => r.hits.filter((h) => !h.baseline).length === 0);
say(`Clauses flagged ONLY by the binary pronoun, with no semantic mechanism firing: **${lexOnly.length}**`);
if (lexOnly.length) {
  say("");
  for (const r of lexOnly.slice(0, 15)) say(`- \`${r.id}\` (${r.families} families) — ${r.state}`);
  say("");
  say("These matter. A binary pronoun with no mechanism behind it is a candidate for");
  say("being a FALSE POSITIVE OF THE OLD METHOD — the amicable-discussion sentence");
  say("problem, where 'between the Parties' is present and nothing turns on it.");
}

fs.writeFileSync(path.join(ROOT, "docs/audit/SEMANTIC_CANDIDATES.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "docs/audit/semantic-candidates.json"), JSON.stringify(rows, null, 1));
console.log("\nwritten: docs/audit/SEMANTIC_CANDIDATES.md + docs/audit/semantic-candidates.json");
