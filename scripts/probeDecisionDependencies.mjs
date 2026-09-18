/**
 * probeDecisionDependencies.mjs — D4.24: ARE THE SIX DECISIONS INDEPENDENT?
 *
 * Six open decisions have been treated as a flat advocate checklist. D4.23 broke
 * that assumption twice over: SURVIVAL_AGAINST_A_DEPARTING_PARTY exists only
 * under one of three treatments of its parent, and the survival clause turned out
 * to enumerate NINE survivors of which three carry decisions of their own.
 *
 * So before anybody authors an answer, this asks of every ordered pair:
 *
 *     DETERMINES   resolving Di fixes Dj's answer outright
 *     GATES        resolving Di can make Dj inapplicable — the question ceases to exist
 *     CONSTRAINS   resolving Di removes candidates from Dj, or makes some pairs of
 *                  answers mutually inconsistent
 *     INDEPENDENT  no relation
 *
 * EVERY NON-INDEPENDENT EDGE IS DEMONSTRATED, NOT ASSERTED. D4.23 earned its
 * finding by enumerating pair-regimes rather than reasoning from wording, and an
 * edge claimed without a worked instance would be exactly the kind of plausible
 * structure this project keeps refusing to build.
 *
 * NOTHING IS IMPLEMENTED HERE. The output decides whether conditionality is worth
 * a general mechanism or should be modelled as a handful of named edges.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

const treatments = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/nparty-treatments.json"), "utf8"));
const D = treatments.decisions.map((d) => d.decision_id);
const byId = Object.fromEntries(treatments.decisions.map((d) => [d.decision_id, d]));

const EDGE = { DETERMINES: "DETERMINES", GATES: "GATES", CONSTRAINS: "CONSTRAINS", INDEPENDENT: "INDEPENDENT" };

/*
 * The claimed edges. Each carries a WORKED INSTANCE — a concrete three-party
 * situation where the interaction is visible — because an edge without one is an
 * opinion about a diagram.
 */
const CLAIMS = [
  {
    from: "TERMINATION_FOR_DEFAULT_SCOPE", to: "SURVIVAL_AGAINST_A_DEPARTING_PARTY",
    edge: EDGE.GATES,
    instance:
      "Choose ENDS_THE_INSTRUMENT: the survival trigger fires, every former party stays bound, and there is " +
      "nothing left to ask. Choose REQUIRES_ALL_INNOCENT_PARTIES: still instrument-level, same result. Only " +
      "ENDS_THAT_RELATIONSHIP leaves a party outside both regimes and needs a second answer.",
    demonstrated_by: "docs/audit/SURVIVAL_COUNTERFACTUAL.md — 3 of 3 pair-regimes differ between the worlds",
  },
  {
    from: "TERMINATION_FOR_DEFAULT_SCOPE", to: "TRANSITION_ASSISTANCE_SCOPE",
    edge: EDGE.CONSTRAINS,
    instance:
      "TRANSITION_ASSISTANCE_SCOPE offers TO_EACH_REMAINING or TO_THE_CONTINUING_ENTITY. Under " +
      "ENDS_THE_INSTRUMENT there IS no continuing entity — the venture has ended for everybody — so the " +
      "second candidate has no referent and the choice collapses to one. Under ENDS_THAT_RELATIONSHIP both " +
      "remain live. Resolving the parent therefore deletes a candidate from the child without answering it.",
  },
  {
    from: "LIABILITY_CAP_APPORTIONMENT", to: "INDEMNITY_APPORTIONMENT",
    edge: EDGE.CONSTRAINS, bidirectional: true,
    arithmetic: () => {
      const cap = 1000000, loss = 2500000, parties = 3;
      const indemnifiers = parties - 1;
      const promisedSeveral = loss * indemnifiers;       // each owes the whole loss
      const permittedShared = cap;                        // one ceiling for everyone
      const permittedPerParty = cap * parties;
      return {
        cap, loss, parties,
        SHARED_vs_SEVERAL: { promised: promisedSeveral, permitted: permittedShared,
          coherent: promisedSeveral <= permittedShared },
        PER_PARTY_vs_SEVERAL: { promised: promisedSeveral, permitted: permittedPerParty,
          coherent: promisedSeveral <= permittedPerParty },
      };
    },
    instance:
      "Three parties, a cap of \u20b910,00,000 and a loss of \u20b925,00,000 indemnifiable by two parties to the " +
      "third. SEVERAL_TO_EACH has each indemnifier owe the whole loss to each indemnitee, so the indemnity " +
      "promises \u20b950,00,000 of cover. The table below computes what each cap treatment permits.\n\n" +
      "THE COMPUTATION CORRECTED THE CLAIM THIS EDGE WAS FIRST WRITTEN WITH. The narrative said SHARED plus " +
      "SEVERAL_TO_EACH conflicts while PER_PARTY plus SEVERAL_TO_EACH is coherent. It is not: at three " +
      "parties PER_PARTY permits \u20b930,00,000 against \u20b950,00,000 promised, so that pairing fails too. The " +
      "tension is not a quirk of one combination — an indemnity in which everyone owes everyone the whole " +
      "loss outruns any finite cap once the parties outnumber two, and which clause yields is a third " +
      "question nobody has asked.",
    risk: "INCONSISTENT_ANSWERS",
  },
  {
    from: "SURVIVAL_AGAINST_A_DEPARTING_PARTY", to: "LIABILITY_CAP_APPORTIONMENT",
    edge: EDGE.CONSTRAINS,
    instance:
      "Limitation of liability is one of the nine enumerated survivors. Choose DEPARTING_PARTY_RELEASED and " +
      "the cap stops binding the departing party — which also stops PROTECTING them, since a party outside " +
      "the cap is exposed without limit. So the apportionment question is being answered for a set of " +
      "parties that the survival answer has already changed the membership of.",
  },
  {
    from: "SURVIVAL_AGAINST_A_DEPARTING_PARTY", to: "ARBITRATION_REFERENCE_SCOPE",
    edge: EDGE.CONSTRAINS,
    instance:
      "Dispute resolution is also an enumerated survivor. Choose DEPARTING_PARTY_RELEASED and the departing " +
      "party is released from the arbitration agreement along with everything else — so there is no forum in " +
      "which to determine whether they were validly released, or to enforce the accrued rights the same " +
      "clause preserves. The candidate is close to self-defeating, which is an argument against it and is " +
      "recorded as an interaction rather than settled here.",
    risk: "SELF_DEFEATING_COMBINATION",
  },
  {
    from: "LIABILITY_CAP_APPORTIONMENT", to: "ARBITRATION_REFERENCE_SCOPE",
    edge: EDGE.CONSTRAINS,
    instance:
      "INTER_SE_ONLY caps claims BETWEEN THE PARTIES and leaves a stranger's claim untouched. Choose it " +
      "together with BILATERAL_REFERENCE and a party to the instrument who was not joined to the reference " +
      "is simultaneously a party (so capped) and a stranger to the award (so unbound). 'Inter se' stops " +
      "having a determinate referent, and the cap's scope turns on a procedural choice made elsewhere.",
  },
];

/* ── build the matrix ────────────────────────────────────────────────────── */

const matrix = {};
for (const a of D) { matrix[a] = {}; for (const b of D) matrix[a][b] = a === b ? null : EDGE.INDEPENDENT; }
for (const c of CLAIMS) {
  matrix[c.from][c.to] = c.edge;
  if (c.bidirectional) matrix[c.to][c.from] = c.edge;
}

const short = (id) => id.split("_").map((w) => w[0]).join("");
say("# D4.24 — are the six open decisions independent?\n");
say(`Decisions: **${D.length}**. Ordered pairs: **${D.length * (D.length - 1)}**.\n`);
say("| | " + D.map(short).join(" | ") + " |");
say("|---|" + D.map(() => "---").join("|") + "|");
for (const a of D) {
  say(`| **${short(a)}** ${a} | ` + D.map((b) => {
    if (a === b) return "·";
    const e = matrix[a][b];
    return e === EDGE.INDEPENDENT ? "—" : `**${e[0]}**`;
  }).join(" | ") + " |");
}
say("");
say("G = GATES, C = CONSTRAINS, D = DETERMINES, — = independent. Row resolves, column is affected.");

/* ── counts ──────────────────────────────────────────────────────────────── */

const counts = { DETERMINES: 0, GATES: 0, CONSTRAINS: 0, INDEPENDENT: 0 };
for (const a of D) for (const b of D) if (a !== b) counts[matrix[a][b]] += 1;

say("\n## Edge census\n");
say("| edge kind | count | meaning |");
say("|---|---|---|");
say(`| DETERMINES | ${counts.DETERMINES} | resolving one fixes another outright |`);
say(`| GATES | ${counts.GATES} | resolving one can delete the other question |`);
say(`| CONSTRAINS | ${counts.CONSTRAINS} | removes candidates, or makes some answer pairs inconsistent |`);
say(`| INDEPENDENT | ${counts.INDEPENDENT} | no relation |`);

/* ── the worked instances ────────────────────────────────────────────────── */

say("\n## The claimed edges, each with a worked instance\n");
for (const c of CLAIMS) {
  say(`### ${c.from} → ${c.to} — **${c.edge}**${c.bidirectional ? " (both directions)" : ""}\n`);
  say(c.instance);
  if (c.arithmetic) {
    const a = c.arithmetic();
    const rs = (n) => "\u20b9" + n.toLocaleString("en-IN");
    say("");
    say(`*Computed, not asserted* — cap ${rs(a.cap)}, loss ${rs(a.loss)}, ${a.parties} parties:`);
    say("");
    say("| cap treatment + indemnity treatment | indemnity promises | cap permits | coherent |");
    say("|---|---|---|---|");
    for (const [k, v] of Object.entries(a)) {
      if (typeof v !== "object") continue;
      say(`| ${k.replace(/_vs_/, " + ")} | ${rs(v.promised)} | ${rs(v.permitted)} | ${v.coherent ? "yes" : "**NO**"} |`);
    }
    say("");
  }
  if (c.demonstrated_by) say(`\n*Demonstrated in:* ${c.demonstrated_by}`);
  if (c.risk) say(`\n*Risk class:* \`${c.risk}\``);
  say("");
}

/* ── what the shape of the matrix implies ───────────────────────────────── */

const affected = new Set(CLAIMS.flatMap((c) => c.bidirectional ? [c.to, c.from] : [c.to]));
const isolated = D.filter((d) => !affected.has(d) && !CLAIMS.some((c) => c.from === d));

say("## Reading\n");
say(`**No DETERMINES edges and exactly ${counts.GATES} GATES edge.** Resolving one decision almost never`);
say("answers another and almost never deletes another. The dependency is real but it is thin.");
say("");
say("So the answer to 'general mechanism or named edges' is **named edges**. A general");
say("treatment-level conditionality engine would be built to carry one live instance, which is");
say("the abstraction-on-spec this method exists to refuse. If a second and third GATES edge");
say("appear in other families, that is the evidence to revisit it.");
say("");
say("**The more important finding is that the risk is not conditionality at all.**");
const risky = CLAIMS.filter((c) => c.risk);
say("");
say(`${risky.length} of the ${CLAIMS.length} edges carry a named risk, and both are about ANSWERS THAT`);
say("CONTRADICT rather than questions that disappear:");
say("");
for (const c of risky) say(`- \`${c.risk}\` — ${c.from} with ${c.to}`);
say("");
say("An advocate working a flat checklist can answer SHARED and SEVERAL_TO_EACH on consecutive");
say("lines and produce an instrument that promises five times the cover its cap permits. Nothing");
say("in the current model would notice. **The engine gap worth building is a consistency check");
say("across resolved treatments, not a conditionality mechanism** — and it is not built here,");
say("because one measurement is not yet a case for either.");
if (isolated.length) {
  say("");
  say(`Genuinely isolated decisions: ${isolated.map((d) => `\`${d}\``).join(", ")} — these can be`);
  say("authored in any order without reference to the others.");
}

/* ── resolution order ────────────────────────────────────────────────────── */

say("\n## Implied order of resolution\n");
/*
 * A BIDIRECTIONAL EDGE IS A CYCLE, AND A CYCLE HAS NO ORDER.
 *
 * The first version of this ordering computed in-degrees while SKIPPING
 * bidirectional edges, which put INDEMNITY_APPORTIONMENT in tier 1 and
 * LIABILITY_CAP_APPORTIONMENT in tier 3 — a sequence between two decisions that
 * each constrain the other. That is not a schedule, it is the cycle being hidden
 * by the thing meant to reveal it. Mutually constraining decisions are collapsed
 * into a single joint node instead, because they have to be answered together.
 */
const cycles = [];
for (const c of CLAIMS.filter((x) => x.bidirectional)) cycles.push([c.from, c.to].sort());
const groupOf = new Map();
for (const [a, b] of cycles) { const g = `${a} + ${b}`; groupOf.set(a, g); groupOf.set(b, g); }
const nodes = [...new Set(D.map((d) => groupOf.get(d) || d))];
const members = (n) => n.includes(" + ") ? n.split(" + ") : [n];
const hardEdges = CLAIMS.filter((c) => !c.bidirectional)
  .map((c) => [groupOf.get(c.from) || c.from, groupOf.get(c.to) || c.to])
  .filter(([a, b]) => a !== b);

const tiers = [];
const placed = new Set();
let guard = 0;
while (placed.size < nodes.length && guard++ < 10) {
  const tier = nodes.filter((n) => !placed.has(n) &&
    hardEdges.filter(([, to]) => to === n).every(([from]) => placed.has(from)));
  if (!tier.length) break;
  tiers.push(tier);
  for (const n of tier) placed.add(n);
}
tiers.forEach((t, i) => say(`${i + 1}. ${t.map((n) => members(n).length > 1
  ? `**${members(n).map((m) => `\`${m}\``).join(" and ")} — jointly**` : `\`${n}\``).join(", ")}`));
say("");
if (cycles.length) {
  say(`**${cycles.length} pair(s) cannot be sequenced at all.** ${cycles.map(([a, b]) => `${a} and ${b}`).join("; ")}`);
  say("constrain each other, so an advocate answering them one after the other can produce a");
  say("coherent answer to each and an incoherent instrument. They are one decision with two parts.");
  say("");
}
say("TERMINATION_FOR_DEFAULT_SCOPE comes first because it gates one question and constrains");
say("another. Answering it is worth more than any other single answer, which is a scheduling");
say("fact a flat list cannot express.");

fs.writeFileSync(path.join(ROOT, "docs/audit/DECISION_DEPENDENCIES.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "docs/audit/decision-dependencies.json"),
  JSON.stringify({ decisions: D, matrix, claims: CLAIMS, counts, tiers }, null, 1));
console.log("\nwritten: docs/audit/DECISION_DEPENDENCIES.md + decision-dependencies.json");
