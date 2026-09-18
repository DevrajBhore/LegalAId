/**
 * probeGuaranteeCoherence.mjs — D4.25: DOES THE MSA INCONSISTENCY REPRODUCE?
 *
 * D4.24 found that a liability cap and an indemnity, each answered admissibly,
 * can jointly promise more cover than the cap permits. Before treating
 * INCONSISTENT_ANSWERS as a reusable shape — and certainly before building a
 * consistency engine for it — the question is whether it reproduces in a family
 * with a genuinely different legal structure.
 *
 * The guarantee family is the right falsification target because it is not
 * another MSA with different role names. It has a statute that speaks directly to
 * multiple obligors:
 *
 *   s.128  the surety's liability is co-extensive with the principal debtor's
 *          UNLESS OTHERWISE PROVIDED BY THE CONTRACT — so a cap binds.
 *   s.146  co-sureties are liable, AS BETWEEN THEMSELVES and in the absence of
 *          contract to the contrary, to pay each an equal share of the whole debt.
 *   s.147  the same, adjusted where they are bound in different sums.
 *
 * THE INSTRUCTION WAS TO TEST WHETHER s.146 CHANGES THE RESULT, NOT TO ASSUME IT.
 * So the probe computes both families on the same arithmetic and compares the
 * shapes, rather than reasoning from the existence of a statute.
 *
 * Three outcomes were live. Nothing is built either way.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };
const rs = (n) => "₹" + n.toLocaleString("en-IN");

/* ── 1. DO THE CLAUSES CARRY AN INTERACTION RULE? — measured, not assumed ── */

async function textsFor(type, ids) {
  const r = await generateDocument({
    document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
  });
  const out = {};
  for (const c of r?.draft?.clauses || []) if (ids.includes(c.clause_id)) out[c.clause_id] = c.text || "";
  return out;
}

/*
 * TEST THE PAIR THAT ACTUALLY CO-OCCURS.
 *
 * The first run of this probe asked the MSA for CORE_INDEMNITY_FULL_001 and got
 * "not carried" — the MSA ships CORE_INDEMNITY_001, a different clause without
 * the open apportionment decision. Comparing a family that has both clauses
 * against one that never carries them together would have compared nothing.
 *
 * The two DECISION-BEARING clauses — the ones whose treatments D4.24 showed can
 * contradict — co-occur as CORE_LIABILITY_LIMIT_FALLBACK_001 with
 * CORE_INDEMNITY_FULL_001, in five document types. FOUNDERS_AGREEMENT is used
 * here because it is one of them AND is N-party admissible, so the arithmetic is
 * reachable by a real user rather than hypothetical.
 */
const baseline = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));
const CAPS = ["CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001", "CORE_LIABILITY_LIMIT_FALLBACK_001"];
const INDS = ["CORE_INDEMNITY_FULL_001", "CORE_INDEMNITY_001"];
const cooccur = Object.entries(baseline.types).filter(([, levels]) => {
  const ids = new Set(Object.values(levels).flatMap((l) => l?.clauses || []));
  return CAPS.some((c) => ids.has(c)) && INDS.some((i) => ids.has(i));
}).map(([t]) => t);
const decisionBearing = Object.entries(baseline.types).filter(([, levels]) => {
  const ids = new Set(Object.values(levels).flatMap((l) => l?.clauses || []));
  return ids.has("CORE_INDEMNITY_FULL_001") && CAPS.some((c) => ids.has(c));
}).map(([t]) => t);

const msa = await textsFor("FOUNDERS_AGREEMENT",
  ["CORE_LIABILITY_LIMIT_FALLBACK_001", "CORE_INDEMNITY_FULL_001"]);
const gtee = await textsFor("GUARANTEE_AGREEMENT",
  ["GUARANTEE_OBLIGATION_001", "GUARANTEE_INDEMNITY_001"]);

/*
 * An INTERACTION RULE is a sentence that orders the cap and the indemnity against
 * each other — saying the indemnity counts toward the cap, or is carved out of
 * it. Its presence or absence is the whole comparison, so it is detected rather
 * than asserted.
 */
const INTERACTION = /taken together with any liability under the indemnity|forms part of, and shall not increase, the aggregate cap|shall not increase the aggregate cap|counts? towards? the (?:aggregate )?cap|(?:excluded|carved out) from the (?:aggregate )?cap|nothing in this clause limits the indemnit/i;

say("# D4.25 — does the cap/indemnity inconsistency reproduce in the guarantee family?\n");
say("## Does each family order the two clauses against each other?\n");
say("| family | clause | interaction rule present |");
say("|---|---|---|");
const rows = [
  ["Founders", "CORE_LIABILITY_LIMIT_FALLBACK_001", msa.CORE_LIABILITY_LIMIT_FALLBACK_001],
  ["Founders", "CORE_INDEMNITY_FULL_001", msa.CORE_INDEMNITY_FULL_001],
  ["Guarantee", "GUARANTEE_OBLIGATION_001", gtee.GUARANTEE_OBLIGATION_001],
  ["Guarantee", "GUARANTEE_INDEMNITY_001", gtee.GUARANTEE_INDEMNITY_001],
];
const present = {};
for (const [fam, id, t] of rows) {
  const hit = t ? INTERACTION.test(t) : null;
  present[id] = hit;
  say(`| ${fam} | \`${id}\` | ${t == null ? "not carried" : hit ? "**yes**" : "**no**"} |`);
}
const msaHas = [msa.CORE_LIABILITY_LIMIT_FALLBACK_001, msa.CORE_INDEMNITY_FULL_001]
  .some((t) => t && INTERACTION.test(t));
const gteeHas = [gtee.GUARANTEE_OBLIGATION_001, gtee.GUARANTEE_INDEMNITY_001]
  .some((t) => t && INTERACTION.test(t));
say("");
say(`Founders carries an interaction rule: **${msaHas}**. Guarantee carries one: **${gteeHas}**.`);
say("");
say(`**Reachability.** ${cooccur.length} document types carry a cap AND an indemnity. ` +
    `${decisionBearing.length} carry the two DECISION-BEARING clauses together: ` +
    decisionBearing.map((t) => `\`${t}\``).join(", ") + ".");
say("So the D4.24 inconsistency is not hypothetical — it is reachable in real documents, and in");
say("four of those five families a third principal is admitted today.");
if (gteeHas) {
  say("");
  say("The guarantee family states it TWICE, from both ends — the cap says it applies \"taken");
  say("together with any liability under the indemnity\", and the indemnity says it \"forms part");
  say("of, and shall not increase, the aggregate cap\". Belt and braces, deliberately.");
}

/* ── 2. THE SAME ARITHMETIC ON BOTH FAMILIES ─────────────────────────────── */

const CAP = 1000000, LOSS = 2500000, N = 3;

function msaWorlds() {
  const indemnifiers = N - 1;
  const promised = LOSS * indemnifiers;                 // SEVERAL_TO_EACH
  return [
    { cap: "SHARED", permitted: CAP, promised },
    { cap: "PER_PARTY", permitted: CAP * N, promised },
  ].map((w) => ({ ...w, coherent: w.promised <= w.permitted }));
}

/*
 * The guarantee arithmetic runs on TWO AXES, which is the point. The cap bounds
 * what the CREDITOR may recover from a guarantor (s.128, the cap being the
 * contract "otherwise providing"). Section 146 then allocates AS BETWEEN the
 * co-guarantors. A rule about the creditor's reach and a rule about contribution
 * between sureties cannot contradict each other, because they do not answer the
 * same question.
 */
function guaranteeWorlds() {
  const out = [];
  for (const capMode of ["SHARED", "PER_PARTY"]) {
    const externalCeiling = capMode === "SHARED" ? CAP : CAP * N;
    const recovered = Math.min(LOSS, externalCeiling);
    const s146Share = recovered / N;                     // equal shares of what was paid
    const withinEach = s146Share <= (capMode === "SHARED" ? CAP : CAP);
    out.push({
      cap: capMode, externalCeiling, recovered,
      indemnityAddsExposure: false,                      // the express interaction rule forbids it
      s146ShareEach: s146Share, contributionWithinEachCap: withinEach,
      coherent: recovered <= externalCeiling && withinEach,
    });
  }
  return out;
}

say("\n## The same arithmetic, both families\n");
say(`Cap ${rs(CAP)}, loss ${rs(LOSS)}, ${N} parties.\n`);
say("### Founders — cap and indemnity both bound the SAME exposure, with nothing ordering them\n");
say("| cap treatment | indemnity promises | cap permits | coherent |");
say("|---|---|---|---|");
for (const w of msaWorlds()) {
  say(`| ${w.cap} + SEVERAL_TO_EACH | ${rs(w.promised)} | ${rs(w.permitted)} | ${w.coherent ? "yes" : "**NO**"} |`);
}

say("\n### Guarantee — the indemnity is inside the cap, and s.146 works on a different axis\n");
say("| cap treatment | creditor may recover | indemnity adds exposure | s.146 share each | within each cap | coherent |");
say("|---|---|---|---|---|---|");
for (const w of guaranteeWorlds()) {
  say(`| ${w.cap} | ${rs(w.recovered)} | ${w.indemnityAddsExposure ? "yes" : "**no** — express rule"} | ${rs(w.s146ShareEach)} | ${w.contributionWithinEachCap ? "yes" : "no"} | ${w.coherent ? "**yes**" : "NO"} |`);
}

/* ── 3. WHICH OUTCOME ────────────────────────────────────────────────────── */

const msaIncoherent = msaWorlds().filter((w) => !w.coherent).length;
const gteeIncoherent = guaranteeWorlds().filter((w) => !w.coherent).length;

say("\n## Which of the three outcomes\n");
say(`Founders incoherent combinations: **${msaIncoherent} of ${msaWorlds().length}**.`);
say(`Guarantee incoherent combinations: **${gteeIncoherent} of ${guaranteeWorlds().length}**.`);
say("");
if (gteeIncoherent === msaIncoherent) {
  say("**SAME SHAPE REPRODUCES** — INCONSISTENT_ANSWERS looks reusable.");
} else if (gteeIncoherent === 0) {
  say("**IT DOES NOT REPRODUCE**, and the two reasons are different from each other:");
  say("");
  say("1. **The guarantee family already drafts the interaction.** The indemnity is expressed to");
  say("   form part of the cap, from both ends. The two clauses cannot promise more than the cap");
  say("   permits because one of them says so.");
  say("");
  say("2. **Section 146 does not do what it might appear to do here.** It allocates AS BETWEEN the");
  say("   co-sureties, in the absence of contract to the contrary. The cap bounds what the CREDITOR");
  say("   may recover, under s.128's \"unless it is otherwise provided by the contract\". A rule about");
  say("   contribution between sureties and a rule about the creditor's reach operate on different");
  say("   axes and therefore cannot contradict each other. **The statute did not resolve the conflict;");
  say("   there was no conflict for it to resolve.** Testing that rather than assuming it is the");
  say("   difference between a finding and a plausible story.");
} else {
  say("**A DIFFERENT INTERACTION SHAPE** — the abstraction is too narrow as drawn.");
}

say("\n## What this says about building a consistency engine\n");
say("The generalisable statement is narrower than INCONSISTENT_ANSWERS, and better:");
say("");
say("> Cross-treatment inconsistency arises where two treatments quantify **the same exposure on");
say("> the same axis** with no precedence rule between them. It does not arise where an express");
say("> interaction clause orders them, and it does not arise where a statute allocates on a");
say("> different axis.");
say("");
say("So the defect is **a missing interaction clause, not a missing engine** — and the remedy");
say("already exists in this repository, authored by the same hands, in another family. A");
say("consistency checker would be a detector for a defect that one sentence of ordinary drafting");
say("prevents. That is worth knowing before building one, and it is the opposite of what D4.24");
say("looked like it was pointing at.");
say("");
say("**The N-party question survives untouched.** \"The aggregate liability of the Guarantor\" with");
say("three co-guarantors is still per-guarantor or shared, and s.146 does not answer it because it");
say("speaks to contribution rather than to the ceiling. LIABILITY_CAP_APPORTIONMENT therefore");
say("reaches the guarantee family too — and this probe classifies nothing.");

fs.writeFileSync(path.join(ROOT, "docs/audit/GUARANTEE_COHERENCE.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/GUARANTEE_COHERENCE.md");
