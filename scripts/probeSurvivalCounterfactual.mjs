/**
 * probeSurvivalCounterfactual.mjs — D4.23: DOES SURVIVAL DIFFER ACROSS THE TWO WORLDS?
 *
 * CORE_SURVIVAL_001 is in scope because of an authored edge:
 *
 *     CORE_SURVIVAL_001 --depends_on--> CORE_TERMINATION_001
 *
 * THE EDGE ESTABLISHES SCOPE. IT DOES NOT ESTABLISH AMBIGUITY. Classifying the
 * survival clause merely because its parent is AUTHORED_DECISION_PENDING would
 * be inheritance mistaken for analysis — and structural propagation has high
 * precision only because the graph is authored, which makes it exactly the kind
 * of signal one is tempted to over-read.
 *
 * So the question is put counterfactually and answered by enumeration:
 *
 *   WORLD A  ENDS_THE_INSTRUMENT       Party 1 defaults; the whole instrument ends.
 *   WORLD B  ENDS_THAT_RELATIONSHIP    Party 1 defaults; Party 1 ceases to be a
 *                                      party and the instrument continues between
 *                                      the others.
 *
 * For each world the probe enumerates, for every PAIR of principals and every
 * enumerated surviving provision, which REGIME binds them: LIVE (the instrument
 * is on foot between them), SURVIVING (the instrument has ended and the clause
 * preserves the provision), or NEITHER.
 *
 * If the two enumerations agree, the clause is invariant across the parent's
 * treatments and needs no decision of its own. If they disagree, cardinality
 * forces a substantive choice and the disagreement names it.
 *
 * Nothing is modified. The clause text is read from the shipped artifact.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

/* ── 1. THE CLAUSE AS SHIPPED ────────────────────────────────────────────── */

const r = await generateDocument({
  document_type: "MASTER_SERVICE_AGREEMENT",
  variables: variablesFor("MASTER_SERVICE_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }),
});
const text = (r?.draft?.clauses || []).find((c) => c.clause_id === "CORE_SURVIVAL_001")?.text || "";

/*
 * The two operative parts, read off the text rather than assumed. The trigger is
 * what makes this interesting: it is a SINGLE GLOBAL PREDICATE over the whole
 * instrument, in a clause whose parent decision may make termination partial.
 */
const TRIGGER = /(?:Expiry or termination) of this Agreement/i;
const BINDS = /continue to bind the Parties/i;
const enumerated = (text.match(/relating to ([^.]+?) shall survive/i)?.[1] || "")
  .split(/,| and /).map((s) => s.trim()).filter(Boolean);

say("# D4.23 — CORE_SURVIVAL_001 across the two termination worlds\n");
say("## What the clause actually says\n");
say("| element | found | text |");
say("|---|---|---|");
say(`| trigger | ${TRIGGER.test(text) ? "yes" : "**no**"} | "expiry or termination of **this Agreement**" — one global predicate |`);
say(`| who remains bound | ${BINDS.test(text) ? "yes" : "**no**"} | "shall continue to bind **the Parties**" — the collective |`);
say(`| enumerated survivors | ${enumerated.length} | ${enumerated.join("; ")} |`);

/* ── 2. THE ENUMERATION ──────────────────────────────────────────────────── */

const PARTIES = [1, 2, 3];
const PAIRS = [[1, 2], [1, 3], [2, 3]];
const REGIME = { LIVE: "LIVE", SURVIVING: "SURVIVING", NEITHER: "NEITHER — no regime binds this pair" };

/*
 * WORLD A. The instrument terminates as to everybody, so the trigger fires and
 * the enumerated provisions survive between every pair who were parties.
 */
function worldA() {
  const out = {};
  for (const [a, b] of PAIRS) out[`${a}-${b}`] = REGIME.SURVIVING;
  return { triggerFires: true, pairs: out, stillParties: [] };
}

/*
 * WORLD B. Party 1 ceases to be a party; the instrument continues between 2 and
 * 3. Two things follow from the words, and neither is a choice the probe makes:
 *
 *   - the trigger does NOT fire, because "this Agreement" has not expired or
 *     terminated. It is on foot between the remaining parties.
 *   - the survivors "continue to bind THE PARTIES", and Party 1 is no longer
 *     one of them.
 *
 * So pairs involving Party 1 fall outside BOTH regimes. That is not a reading
 * the probe prefers; it is what the sentence does when termination is partial.
 */
function worldB(departing = 1) {
  const remaining = PARTIES.filter((p) => p !== departing);
  const out = {};
  for (const [a, b] of PAIRS) {
    const involvesDeparting = a === departing || b === departing;
    out[`${a}-${b}`] = involvesDeparting ? REGIME.NEITHER : REGIME.LIVE;
  }
  return { triggerFires: false, pairs: out, stillParties: remaining };
}

const A = worldA(), B = worldB(1);

say("\n## The enumeration — which regime binds each pair\n");
say(`Surviving provisions, read from the clause rather than assumed (${enumerated.length}): ${enumerated.join(", ")}.\n`);
say("| pair | World A (instrument ends) | World B (relationship ends) | same? |");
say("|---|---|---|---|");
let divergent = 0;
for (const key of Object.keys(A.pairs)) {
  const same = A.pairs[key] === B.pairs[key];
  if (!same) divergent += 1;
  say(`| ${key} | ${A.pairs[key]} | ${B.pairs[key]} | ${same ? "yes" : "**NO**"} |`);
}
say(`\nTrigger fires: World A **${A.triggerFires}**, World B **${B.triggerFires}**.`);
say(`Pairs whose binding regime differs between the worlds: **${divergent} of ${PAIRS.length}**.`);

/* ── 3. THE FINDING ──────────────────────────────────────────────────────── */

say("\n## Reading\n");
if (divergent === 0) {
  say("INVARIANT. The survival outcome is the same under both treatments, so the");
  say("dependency establishes scope and nothing more. SAFE.");
} else {
  say("**NOT INVARIANT, and the divergence is worse than a difference of degree.**");
  say("");
  say("In World A every pair is bound by the surviving provisions. In World B the pairs");
  say("involving the departing party are bound by **neither regime**:");
  say("");
  say("  - the LIVE regime does not reach them, because Party 1 is no longer a Party;");
  say("  - the SURVIVING regime does not reach them, because \"this Agreement\" has not");
  say("    expired or terminated — it is on foot between Parties 2 and 3.");
  say("");
  say("So under ENDS_THAT_RELATIONSHIP the departing party walks away from");
  say("confidentiality and intellectual-property obligations, not because anyone");
  say("released them but because the survival clause's trigger is a global predicate");
  say("and the termination was partial. **A drafting gap that only opens at three parties.**");
}

/* ── 3b. WHAT IS ACTUALLY IN THE SURVIVING SET ───────────────────────────── */
//
// Reading the enumeration rather than assuming it turned up the part that
// matters most: the clause names INDEMNITY and LIMITATION OF LIABILITY among the
// survivors, and both already carry open N-party decisions of their own.

const OPEN_SURVIVORS = {
  "indemnity": "CORE_INDEMNITY_FULL_001 — INDEMNITY_APPORTIONMENT is UNDECIDED",
  "limitation of liability": "CORE_LIMITATION_LIABILITY_001 — LIABILITY_CAP_APPORTIONMENT is UNDECIDED",
  "dispute resolution": "CORE_DISPUTE_RESOLUTION_001 — ARBITRATION_REFERENCE_SCOPE is UNDECIDED",
};
const compounding = enumerated
  .map((e) => [e, OPEN_SURVIVORS[e.toLowerCase()]])
  .filter(([, v]) => v);

say("\n## The survivors that already carry open decisions\n");
say("| enumerated survivor | its own N-party status |");
say("|---|---|");
for (const [name, status] of compounding) say(`| ${name} | ${status} |`);
say("");
say(`**${compounding.length} of the ${enumerated.length} enumerated survivors are themselves undecided.**`);
say("");
say("This compounds rather than merely coincides. Under World B the departing party");
say("escapes the liability cap and the indemnity regime along with everything else —");
say("which cuts BOTH ways, since the cap that no longer binds them also no longer");
say("protects them. Whether that is a windfall or an exposure depends on the very");
say("apportionment question LIABILITY_CAP_APPORTIONMENT leaves open, so the two");
say("decisions cannot be taken in isolation from each other.");

/* ── 4. IS THIS A NEW DECISION, OR THE PARENT'S CARRIED DOWNSTREAM? ──────── */
//
// The strict test. A dependent question is only worth its own record if the
// parent's answer does not already settle it.

const PARENT_TREATMENTS = [
  { treatment: "ENDS_THE_INSTRUMENT", world: "A", survivalSettled: true,
    why: "The trigger fires, every former party stays bound by the survivors. Nothing further to decide." },
  { treatment: "REQUIRES_ALL_INNOCENT_PARTIES", world: "A", survivalSettled: true,
    why: "Still instrument-level termination when exercised; same as above." },
  { treatment: "ENDS_THAT_RELATIONSHIP", world: "B", survivalSettled: false,
    why: "The trigger does not fire and the departing party is no longer a Party, so whether they remain bound is NOT answered by having chosen this treatment. A second choice is required." },
];

say("\n## Does the parent decision settle it?\n");
say("| TERMINATION_FOR_DEFAULT_SCOPE treatment | world | survival settled by that choice? |");
say("|---|---|---|");
for (const t of PARENT_TREATMENTS) {
  say(`| ${t.treatment} | ${t.world} | ${t.survivalSettled ? "yes — " : "**no** — "}${t.why} |`);
}
const open = PARENT_TREATMENTS.filter((t) => !t.survivalSettled);
say("");
say(`A further decision arises under **${open.length} of ${PARENT_TREATMENTS.length}** parent treatments.`);
say("");
say("That is the precise shape of the finding, and it is neither of the two easy answers:");
say("");
say("  - NOT merely inherited — under two treatments there is nothing left to decide;");
say("  - NOT independent — the question does not exist unless ENDS_THAT_RELATIONSHIP is chosen.");
say("");
say("**A CONDITIONAL DEPENDENT DECISION.** It is recorded against the existing");
say("PAIRWISE_RIGHT shape with `conditional_on` naming the parent treatment that");
say("brings it into being. No survival-specific N-party shape is invented, because the");
say("existing shape already describes the mechanism: a right exercised against one");
say("party, where more than two force a choice between bilateral and multilateral effect.");

fs.writeFileSync(path.join(ROOT, "docs/audit/SURVIVAL_COUNTERFACTUAL.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/SURVIVAL_COUNTERFACTUAL.md");
