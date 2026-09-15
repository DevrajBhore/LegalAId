/**
 * probeEconomicAllocation.mjs — IS AN ECONOMIC ALLOCATION ADDRESSABLE?
 *
 * D4.18 made the roster authoritative for WHO the parties are. This asks a
 * different question about the same document:
 *
 *     When a clause distributes a quantity among the parties, can the system say
 *     WHICH PARTY GETS WHICH SHARE — mechanically, from something the repository
 *     actually establishes?
 *
 * THE TRAP THIS PROBE EXISTS TO AVOID. D4.18 proved that position is identity
 * when the document says "Party 1". It is tempting to carry that forward: three
 * parties, three numbers, so the first number is the first party's. That is an
 * inference from ARITY, not from meaning, and it would convert a document that
 * is merely ambiguous into one that is confidently wrong — which is strictly
 * worse, because nobody reviews a confident answer.
 *
 * So the probe asks for EVIDENCE of positional mapping rather than assuming it:
 * does the field label name a party? Does the description? Does the rendered
 * sentence attribute any share to any person? An allocation is addressable only
 * if some artifact in the repository says so.
 *
 * Nothing is repaired here. The probe reports what the repository establishes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { resolveRoster } from "../backend/services/partyRoster.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

/* ── 1. WHICH FIELDS CLAIM TO DISTRIBUTE A QUANTITY ──────────────────────── */

/*
 * DISTRIBUTION, NOT RATE. The first version of this hint matched "% per annum"
 * and swept in interest rates, GST and rent escalation — quantities APPLIED to a
 * sum, which divide nothing between anybody. A rate has one payer; an allocation
 * has N recipients and that is the whole difficulty. The narrower hint below
 * looks for language that divides a whole among people.
 */
const ALLOCATION_HINT =
  /\bratio\b|\bsplit\b|\bshareholding\b|\bequity\b|\bprofit[\s/]|\bproportion\b|\ballocat|\bdivid(?:ed|ing)\b/i;
const RATE_NOT_ALLOCATION =
  /per annum|\bgst\b|escalation|\bvaluation\b|\bexercise price\b|\bcliff\b|\bperiod\b|\bthreshold\b/i;

const DOC_TYPES = Object.keys(
  JSON.parse(fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"))
    .types || {}
);

const allocationFields = new Map(); // field -> { types, label, description }
for (const type of DOC_TYPES) {
  const schema = getVariables(type) || {};
  for (const [field, def] of Object.entries(schema)) {
    const text = `${def?.label || ""} ${def?.description || ""}`;
    if (!ALLOCATION_HINT.test(text)) continue;
    if (RATE_NOT_ALLOCATION.test(text)) continue;
    if (def?.type === "select") continue;
    if (!allocationFields.has(field)) {
      allocationFields.set(field, { types: [], label: def?.label || "", description: def?.description || "", type: def?.type });
    }
    allocationFields.get(field).types.push(type);
  }
}

say("# Economic allocation — what the repository establishes\n");
say(`Fields whose label or description claims to distribute a quantity: **${allocationFields.size}**\n`);
say("| field | type | collected on | label |");
say("|---|---|---|---|");
for (const [field, info] of [...allocationFields].sort()) {
  say(`| \`${field}\` | ${info.type} | ${info.types.length} | ${info.label} |`);
}

/* ── 2. DOES ANYTHING ESTABLISH WHICH SHARE BELONGS TO WHICH PARTY? ──────── */
//
// Three places the repository could say so, in descending order of authority:
//   SCHEMA_INDEX       the field name carries an ordinal (capital_contribution_1)
//   LABEL_NAMES_PARTY  the label or description names a party ("Partner 1 ...")
//   NOTHING            neither; the value is a string the document repeats

const PARTY_IN_TEXT = /\b(?:part(?:y|ner)|shareholder|founder|member)\s*\d\b/i;

say("\n## Is the allocation attributable to a party?\n");
say("| field | schema index | label names a party | verdict |");
say("|---|---|---|---|");

const verdicts = new Map();
for (const [field, info] of [...allocationFields].sort()) {
  const indexed = /_(\d+)$/.test(field);
  const named = PARTY_IN_TEXT.test(`${info.label} ${info.description}`);
  const verdict = indexed ? "SCHEMA_INDEX" : named ? "LABEL_NAMES_PARTY" : "NOTHING";
  verdicts.set(field, verdict);
  say(`| \`${field}\` | ${indexed ? "yes" : "no"} | ${named ? "yes" : "**no**"} | ${verdict === "NOTHING" ? "**NOTHING**" : verdict} |`);
}

/* ── 3. THE CONTRAST WITHIN ONE DOCUMENT ─────────────────────────────────── */

say("\n## The same deed carries one of each\n");
const capital = getVariables("PARTNERSHIP_DEED")?.capital_contribution_1;
const ratio = getVariables("PARTNERSHIP_DEED")?.profit_sharing_ratio;
say(`- \`capital_contribution_1\` — label: "${capital?.label}"`);
say(`- \`profit_sharing_ratio\`  — label: "${ratio?.label}"`);
say("");
say("The first names the partner it belongs to, in the field name AND in the label.");
say("The second names nobody, and every example it offers has exactly two elements.");

/* ── 4. WHAT REACHES THE PAGE ────────────────────────────────────────────── */

const PEOPLE = [
  { n: "Meera Iyer", a: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", p: "AAAPI1234C" },
  { n: "Arjun Desai", a: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", p: "AABPD2345F" },
  { n: "Sunita Rao", a: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", p: "AACPR3456G" },
];
const slots = (k) => Object.fromEntries(PEOPLE.slice(0, k).flatMap((x, i) => [
  [`partner_${i + 1}_name`, x.n], [`partner_${i + 1}_address`, x.a],
  [`partner_${i + 1}_type`, "Individual"], [`partner_${i + 1}_pan`, x.p],
]));

async function deed(overrides) {
  const variables = {
    ...variablesFor("PARTNERSHIP_DEED", { profile: FIXTURE_PROFILE.WELL_FILLED }),
    partnership_name: "Bandra Associates",
    party_1_pan: "", party_2_pan: "", party_1_gstin: "", party_2_gstin: "",
    partner_1_name: "", partner_2_name: "", partner_1_address: "", partner_2_address: "",
    ...overrides,
  };
  const r = await generateDocument({ document_type: "PARTNERSHIP_DEED", variables });
  const clauses = r?.draft?.clauses || [];
  return {
    r, variables,
    capital: (clauses.find((c) => c.clause_id === "PARTNERSHIP_CAPITAL_001") || {}).text || "",
    blocking: (r?.validation?.blockingIssues || []).map((i) => i.rule_id),
  };
}

say("\n## What a three-partner deed actually says\n");
const three = await deed({ ...slots(3), profit_sharing_ratio: "40:40:20",
  capital_contribution_1: 600000, capital_contribution_2: 300000 });

say("```");
say(three.capital.split(". ").slice(0, 3).join(".\n") + ".");
say("```\n");

const mentionsThird = /Sunita/.test(three.capital);
const namesThirdCapital = /Partner 3 shall contribute/i.test(three.capital);
/*
 * A SPECIFIC party next to a share value. The first version of this check
 * matched the word "Partner" and reported the allocation as attributed — it was
 * matching "shared among the PartnerS in the ratio of 40:40:20", which is the
 * generic plural and attributes nothing to anybody. A sentence that names no
 * person cannot be evidence that a person was named.
 */
const SPECIFIC_PARTY = `(?:Partner\\s+\\d|${PEOPLE.map((p) => p.n).join("|")})`;
const ratioAttributed =
  new RegExp(`${SPECIFIC_PARTY}[^.]{0,60}?\\b\\d{1,3}\\s*(?:%|per cent)`, "i").test(three.capital) ||
  new RegExp(`\\b\\d{1,3}\\s*(?:%|per cent)[^.]{0,60}?${SPECIFIC_PARTY}`, "i").test(three.capital) ||
  new RegExp(`${SPECIFIC_PARTY}[^.]{0,40}?\\bshare\\b[^.]{0,20}?\\d`, "i").test(three.capital);

say("| question | answer |");
say("|---|---|");
say(`| generation blocked | ${three.blocking.length ? three.blocking.join(", ") : "no"} |`);
say(`| roster count | ${resolveRoster(three.variables).count} |`);
say(`| the ratio string reaches the deed | ${three.capital.includes("40:40:20") ? "yes" : "**no**"} |`);
say(`| any share attributed to any person | ${ratioAttributed ? "yes" : "**NO**"} |`);
say(`| third partner's capital contribution stated | ${namesThirdCapital ? "yes" : "**NO**"} |`);
say(`| third partner named anywhere in the clause | ${mentionsThird ? "yes" : "**NO**"} |`);

/* ── 5. THE COUNTERFACTUALS THAT SHOW IT IS NOT VALIDATED ────────────────── */

say("\n## Counterfactuals: does anything check the allocation against the roster?\n");
say("| parties | ratio | blocked | notice | ratio on the page |");
say("|---|---|---|---|---|");

const CASES = [
  [3, "40:40:20"], [3, "40:40"], [3, "40:40:30"], [3, "1/3, 1/3, 1/3"],
  [3, "equally"], [2, "40:40:20"], [3, ""],
];
for (const [n, r] of CASES) {
  const d = await deed({ ...slots(n), profit_sharing_ratio: r,
    capital_contribution_1: 600000, capital_contribution_2: 300000 });
  const notices = [
    ...(d.r?.validation?.notices || []), ...(d.r?.validation?.advisoryIssues || []),
  ].map((i) => i.rule_id).filter((id) => /RATIO|SHARE|ALLOCAT|PROFIT/i.test(id));
  say(`| ${n} | \`${r || "(blank)"}\` | ${d.blocking.length ? d.blocking.join(",") : "no"} | ${notices.length ? notices.join(",") : "**none**"} | ${
    d.capital.includes(r) && r ? "verbatim" : r ? "—" : "fallback"} |`);
}

say("\n## Reading\n");
say("An economic allocation is currently a STRING THE DOCUMENT REPEATS. Nothing");
say("parses it, nothing counts its parts, nothing compares it to the roster, and");
say("nothing in the repository says which part belongs to which partner.");
say("");
say("That makes the three-partner deed AMBIGUOUS rather than wrong — and the");
say("repair must not make it confidently wrong instead. `capital_contribution_1`");
say("shows what an addressable allocation looks like: the ordinal is in the field");
say("name and the party is in the label. `profit_sharing_ratio` has neither, and");
say("no amount of arithmetic on '40:40:20' can supply what was never established.");

fs.writeFileSync(path.join(ROOT, "docs/audit/ECONOMIC_ALLOCATION.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/ECONOMIC_ALLOCATION.md");
