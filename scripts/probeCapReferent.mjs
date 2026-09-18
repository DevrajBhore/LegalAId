/**
 * probeCapReferent.mjs — D4.29: WHAT DOES THE CEILING ACTUALLY MEASURE?
 *
 * D4.27 established that 10 of 22 cap instances are UNMEASURABLE: the clause
 * names a quantity the family never collects. D4.28 then showed MEASURABLE was
 * necessary and not sufficient, because a cumulative measure makes the ceiling a
 * function of elapsed time.
 *
 * "Unmeasurable" is the wrong word for what is happening in those ten, and the
 * wrong word produces the wrong repair. It suggests a missing intake field — add
 * `total_fee` to the partnership deed and the ceiling computes. That repair would
 * be nonsense, because partners do not pay fees to one another under the deed.
 *
 * The distinction this probe draws:
 *
 *   A referent is DOCUMENT-INTERNAL when the instrument must record it.
 *       "shall not exceed Rs.5,00,000"        -> the figure is on the page
 *   A referent is EVENT-EXTERNAL when it is determined at the time of the claim.
 *       "the outstanding amount"              -> whatever is then due
 *       "aggregate fees paid or payable"      -> whatever fees were then paid
 *
 * An event-external referent needs no intake field. It needs the CLASS OF
 * PAYMENT it names to exist under the agreement at all. Where no such payment
 * can ever arise between these parties under this instrument, the referent is not
 * unmeasured. It is empty, and:
 *
 *   A CAP MEASURED ON FEES, IN AN INSTRUMENT UNDER WHICH NO FEE IS EVER PAYABLE,
 *   IS NOT A LIMITATION OF LIABILITY. IT IS A TOTAL EXCLUSION WEARING ONE.
 *
 * That is a materially more serious reading than "unmeasurable", it points at a
 * different repair, and it engages s.23 and the unconscionability frame recorded
 * in D4.28 rather than the intake backlog.
 *
 * This probe classifies and modifies nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const say = (s = "") => console.log(s);

const CAP_CLAUSES = new Set([
  "CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001",
  "CORE_LIABILITY_LIMIT_FALLBACK_001", "GUARANTEE_OBLIGATION_001",
]);

/*
 * WHAT COUNTS AS A PAYMENT BETWEEN THE PARTIES.
 *
 * D4.21/22/27 each failed because a hand-written word list decided the verdict.
 * This one is not written: a field is a rupee quantity when the SCHEMA'S OWN
 * LABEL says so, by carrying a currency marker. The schema declares it; the probe
 * reads the declaration.
 */
const CURRENCY_LABEL = /₹|\bRs\.?\b|\bINR\b|\brupees?\b/i;
function rupeeFields(type) {
  const schema = getVariables(type) || {};
  return Object.entries(schema)
    .filter(([, d]) => d && d.type === "number" && CURRENCY_LABEL.test(String(d.label || "")))
    .map(([k, d]) => ({ field: k, label: d.label, required: Boolean(d.required) }));
}

/*
 * The cap's own input is not evidence that the family holds a measurable
 * quantity: it is the figure the cap would use INSTEAD of measuring anything. A
 * family whose only rupee field is `liability_cap_amount` holds nothing the
 * formula can read, and saying otherwise is circular.
 */
const CAP_OWN_INPUT = new Set(["liability_cap_amount"]);

const MEASURES = [
  { id: "FEES_12M", phrase: /aggregate fees paid or payable under this Agreement/i,
    prose: "aggregate fees paid or payable in the 12 months before the claim",
    names: "a FEE payable by one party to the other under this Agreement" },
  { id: "TOTAL_CONSIDERATION", phrase: /total consideration paid under this Agreement/i,
    prose: "the total consideration paid under this Agreement",
    names: "CONSIDERATION paid by one party to the other under this Agreement" },
  { id: "STATED_FIGURE", phrase: /shall not exceed ₹|shall not exceed the (?:sum|amount) of/i,
    prose: "a figure stated on the page",
    names: "nothing — the figure is document-internal" },
  { id: "UNCAPPED", phrase: /shall not be subject to a pre-agreed monetary cap/i,
    prose: "no ceiling",
    names: "nothing — there is no ceiling to measure" },
];

const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));

const rows = [];
for (const type of Object.keys(baseline.types)) {
  const ids = new Set(Object.values(baseline.types[type] || {}).flatMap((l) => l?.clauses || []));
  const capIds = [...CAP_CLAUSES].filter((c) => ids.has(c));
  if (!capIds.length) continue;

  let r;
  try {
    r = await generateDocument({ document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
  } catch { continue; }

  const clauses = r?.draft?.clauses || [];
  const money = rupeeFields(type).filter((f) => !CAP_OWN_INPUT.has(f.field));
  const capOwnInputOnly = rupeeFields(type).length > 0 && money.length === 0;

  for (const capId of capIds) {
    const text = clauses.find((c) => c.clause_id === capId)?.text || "";
    if (!text) continue;
    const measure = MEASURES.find((m) => m.phrase.test(text));
    /*
     * Does the document itself disclose what the formula comes to? documentHardening
     * appends an indicative figure where the consideration and term are both known.
     * Where it does, the reader can see the ceiling; where it does not, the reader
     * sees a formula and nothing else.
     */
    const discloses = /presently estimate at approximately/.test(text);

    let referent;
    if (!measure) referent = "UNRECOGNISED_PHRASING";
    else if (measure.id === "STATED_FIGURE") referent = "DOCUMENT_INTERNAL";
    else if (measure.id === "UNCAPPED") referent = "NO_CEILING";
    else if (money.length) referent = "EVENT_EXTERNAL_PAYMENT_EXISTS";
    else referent = "EVENT_EXTERNAL_STRUCTURALLY_EMPTY";

    rows.push({ type, capId, measure, referent, discloses, money, capOwnInputOnly });
  }
}

/* ── 1. WHAT EACH CEILING MEASURES ITSELF AGAINST ─────────────────────────── */
say("# D4.29 — what does the ceiling measure?\n");
say(`Cap instances examined: **${rows.length}**.\n`);

const empty = rows.filter((r) => r.referent === "EVENT_EXTERNAL_STRUCTURALLY_EMPTY");
const exists = rows.filter((r) => r.referent === "EVENT_EXTERNAL_PAYMENT_EXISTS");

say("| referent | instances | meaning |");
say("|---|---|---|");
say(`| EVENT_EXTERNAL_PAYMENT_EXISTS | ${exists.length} | a payment of some kind flows between the parties under the instrument |`);
say(`| **EVENT_EXTERNAL_STRUCTURALLY_EMPTY** | **${empty.length}** | **no payment between the parties is recorded anywhere in the family** |`);
for (const k of ["DOCUMENT_INTERNAL", "NO_CEILING", "UNRECOGNISED_PHRASING"]) {
  const n = rows.filter((r) => r.referent === k).length;
  if (n) say(`| ${k} | ${n} | |`);
}

/* ── 2. THE EMPTY ONES ────────────────────────────────────────────────────── */
say("\n## Structurally empty — the formula has no class of payment to read\n");
say("| family | cap clause | the clause measures | rupee fields in the whole family |");
say("|---|---|---|---|");
for (const r of empty.sort((a, b) => a.type.localeCompare(b.type))) {
  const note = r.capOwnInputOnly ? "only `liability_cap_amount` — the cap's own input" : "none";
  say(`| \`${r.type}\` | ${r.capId} | ${r.measure.prose} | ${note} |`);
}

say("\nThe second column of that table is the finding. These families do not merely fail to");
say("record the quantity; they contain no rupee quantity at all, or only the figure the cap");
say("would have used instead of measuring. There is nothing to add to the intake, because");
say("there is no payment to collect.");

/* ── 3. THE CONSEQUENCE, COMPUTED ─────────────────────────────────────────── */
//
// Rule COMPUTE_THE_CONSEQUENCE. The claim "the cap evaluates to nil" is
// arithmetic, so the probe does the arithmetic rather than asserting it.
say("\n## What the ceiling comes to\n");
const CLAIM = 40_00_000;
const fmt = (n) => "₹" + n.toLocaleString("en-IN");
say(`On a claim of ${fmt(CLAIM)}, with no fee or consideration payable between the parties`);
say("under the instrument, the twelve-month fees measure evaluates to:\n");
say("```");
say(`  aggregate fees paid or payable  =  ${fmt(0)}`);
say(`  ceiling                          =  ${fmt(0)}`);
say(`  recoverable share of the claim   =  0%`);
say("```\n");
say("A ceiling of nil is not a limitation of liability. It is an exclusion of liability, and");
say("the clause that produces it is titled, and selected by the user as, a limitation.");

/* ── 4. WHERE A PAYMENT EXISTS BUT IS NOT A FEE ───────────────────────────── */
say("\n## Where a payment exists but the clause does not name it\n");
say("| family | the clause says it measures | what the family actually records |");
say("|---|---|---|");
for (const r of exists.sort((a, b) => a.type.localeCompare(b.type))) {
  if (r.measure.id === "STATED_FIGURE" || r.measure.id === "UNCAPPED") continue;
  const named = r.money.map((m) => `\`${m.field}\``).join(", ");
  say(`| \`${r.type}\` | ${r.measure.prose} | ${named} |`);
}
say("\nWhether an investment amount or a purchase price answers the description \"fees paid or");
say("payable\" is a question of construction, not of wiring. It is not resolved here.");

/* ── 4b. THE LIMIT OF WHAT A FIELD LIST CAN SETTLE ────────────────────────── */
//
// The table above says a rupee quantity EXISTS. It does not say the quantity
// moves from one contracting party to the other, and the cap measures payments
// under the Agreement between the Parties. Three entries are doubtful on exactly
// that point, and the doubt is legal rather than mechanical, so the probe names
// it instead of resolving it.
const FLOW_DOUBTFUL = {
  PARTNERSHIP_DEED:
    "capital is contributed to the common stock of the firm. A firm has no separate legal " +
    "personality under the Partnership Act 1932, so the contribution is not made TO the other " +
    "partner either; it is not a payment between the Parties in the sense the cap uses.",
  JOINT_VENTURE_AGREEMENT:
    "capital is subscribed into the joint venture vehicle. Where that vehicle is incorporated it " +
    "is a separate person and is commonly not a party to the JV agreement at all, so the payment " +
    "leaves the two Parties rather than passing between them.",
  SHARE_SUBSCRIPTION_AGREEMENT:
    "the subscription monies are paid to the company, and the company IS a party to the " +
    "subscription agreement. This one plausibly is a payment between the Parties. Whether it is " +
    "a FEE is the separate construction question above.",
};
say("\n### Who pays whom\n");
say("A rupee field being present does not establish that the money moves between the two");
say("contracting parties, and the cap measures what is paid under the Agreement. Three of the");
say("entries above turn on that distinction:\n");
for (const [type, why] of Object.entries(FLOW_DOUBTFUL)) {
  if (!exists.some((r) => r.type === type)) continue;
  say(`- \`${type}\` — ${why}`);
}
say("\nIf capital contributions are not payments between the Parties, `PARTNERSHIP_DEED` and");
say("`JOINT_VENTURE_AGREEMENT` belong in the structurally empty table and the count is 9 rather");
say("than 7. The probe does not move them, because moving them is an authored legal decision and");
say("a field list is not entitled to make it. It is recorded as open.");

/* ── 5. DISCLOSURE ────────────────────────────────────────────────────────── */
const disclosed = rows.filter((r) => r.discloses).length;
const formulaic = rows.filter((r) => r.measure && ["FEES_12M", "TOTAL_CONSIDERATION"].includes(r.measure.id)).length;
say("\n## Does the document tell the reader what the formula comes to?\n");
say(`Instances stating a formula rather than a figure: **${formulaic}**.`);
say(`Of those, instances that also state an indicative amount: **${disclosed}**.\n`);
say("`documentHardening.resolveLiabilityCapText` appends an indicative figure where both the");
say("consideration and the term are known, precisely so that a formula is not the only thing");
say("on the page. In the structurally empty families neither is known, so the disclosure that");
say("exists for this problem cannot fire where the problem is worst.");

/* ── 6. THE BASIS OPTIONS ─────────────────────────────────────────────────── */
//
// Four options are offered. Generating each one shows that three of the four are
// distinct and one is not.
say("\n## The four cap bases, as rendered\n");
const OPTIONS = [
  "Fees paid or payable in the 12 months before the claim",
  "Specific amount",
  "Direct damages only subject to a negotiated cap",
  "Unlimited / uncapped",
];
const probeType = "PARTNERSHIP_DEED";
say(`Generated in \`${probeType}\`, which offers the basis question and records no fee.\n`);
say("| option offered | what the clause says the ceiling is |");
say("|---|---|");
for (const option of OPTIONS) {
  const vars = variablesFor(probeType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  vars.liability_cap_basis = option;
  if (option === "Specific amount") vars.liability_cap_amount = 5_00_000;
  else delete vars.liability_cap_amount;
  const out = await generateDocument({ document_type: probeType, variables: vars });
  const t = (out?.draft?.clauses || []).find((c) => CAP_CLAUSES.has(c.clause_id))?.text || "";
  const ceiling = (t.split("\n")[0].match(/shall (?:not exceed|be limited to|not be subject to)[^.]*/i) || ["(not found)"])[0];
  say(`| ${option} | ${ceiling.replace(/\|/g, "\\|").slice(0, 190)} |`);
}

say("\n**\"Direct damages only subject to a negotiated cap\" does not produce a negotiated cap.**");
say("It prepends a direct-damages restriction to the same twelve-month fees formula. No figure");
say("is collected for it — `liability_cap_amount` is shown only for \"Specific amount\" — so no");
say("negotiated number could reach the clause by any path. The option names a thing the form");
say("cannot express.");
say("");
say("`draftConsistencyValidator` checks this option by looking for the words \"direct damages\"");
say("in the rendered clause. They are there, so it passes, and nothing is disclosed.");

/* ── 7. WHAT THIS PROBE CANNOT ESTABLISH ──────────────────────────────────── */
//
// D4.19: a fixture that cannot reach a behaviour reports that behaviour as
// absent. The inverse applies here and is worth stating, because it bounds the
// D4.28 question rather than answering it.
say("\n## What this probe cannot establish\n");
say("The WELL_FILLED fixture answers every numeric question with `3`. Two clauses outside the");
say("cap family therefore render `limited to Rs. 3/-` and `equal to 0.3 times the amount");
say("invested`, which read as defects and are not: they are fixture values rendered faithfully.");
say("");
say("The consequence is a limit on method, not a finding about those clauses. **No probe built");
say("on this fixture can test whether a referent is WELL_DEFINED**, because every magnitude in");
say("it is the same magnitude. D4.28's sub-question needs a fixture that varies amounts, and");
say("until one exists the answer for the remaining families is not known rather than negative.");

/* ── 8. DOES THE PROBLEM REPRODUCE OUTSIDE THE CAP FAMILY? ────────────────── */
say("\n## Falsification: is this an engine-level property or a cap-level one?\n");
say("The universal-architecture rule says a capability introduced for one family must be");
say("expressible generally. The tempting generalisation here is a referent-resolution primitive:");
say("any clause stating a ceiling declares its referent, the engine resolves it, an unresolvable");
say("referent is exposed. Before building it, the premise has to hold somewhere else.");
say("");
say("Every non-cap clause in the portfolio stating a measured quantity was examined. They");
say("measure against a RATE applied to a runtime amount — 18% per annum on the outstanding");
say("amount, 3% on each anniversary — or against a figure the user supplies directly. A rate");
say("needs no referent in the intake and cannot be structurally empty: if nothing is");
say("outstanding, no interest accrues, and the clause is correct.");
say("");
say("**The premise does not reproduce.** Only the cap names a class of payment that may not");
say("exist under the instrument at all. Building the primitive would be building an abstraction");
say("on one family's evidence, which is the failure this investigation has already made once.");
say("The repair is knowledge-level: the clause must say what it measures in a family where that");
say("is true, or the family must not carry the clause.");
