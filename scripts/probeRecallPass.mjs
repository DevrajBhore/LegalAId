/**
 * probeRecallPass.mjs — D4.22: DOES THE DETECTOR FIND WHAT IT CANNOT READ?
 *
 * D4.21 flagged 108 clauses with no evidence either way, then found two real
 * candidates by sampling four of them. So the 108 is not a clean bill of health,
 * and building a backlog on a detector with demonstrated false negatives would
 * produce a rigorous list of the wrong things.
 *
 * This pass is DISCOVERY VALIDATION, not clause work. It takes those clauses as
 * the population and looks for mechanisms that do not live in the vocabulary.
 *
 * THE MODEL COUNTEREXAMPLE, AND WHY IT IS THE WHOLE DESIGN:
 *
 *     CORE_SURVIVAL_001 --depends_on--> CORE_TERMINATION_001
 *                                              ↓
 *                             TERMINATION_FOR_DEFAULT_SCOPE is UNDECIDED
 *
 * Survival asks what stands after termination. If it is undecided whether
 * termination ends the instrument or one relationship, then it is undecided what
 * survives and between whom. The survival clause never says so — the question is
 * INHERITED FROM A DEPENDENCY, and that edge is declared in the clause library,
 * not inferred by me. No word list can find that; a graph walk finds it exactly.
 *
 * THREE DETECTORS, NONE OF THEM A VOCABULARY:
 *
 *   A  DEPENDENCY_INHERITANCE  transitive `depends_on` reaching a clause whose
 *      N-party treatment is open. Reads the graph, never the text.
 *   B  PARTY_ROLE_VARIANCE     the clause's shipped text differs across families
 *      in the party-label positions — evidence it is written RELATIVE to the
 *      parties rather than about the instrument. Reads rendered output, not words.
 *   C  ROSTER_DIFFERENTIAL     the text changes when a third principal is added.
 *
 * THREE VERDICTS, AND UNDETERMINED IS THE HONEST ONE. Forcing this population
 * into RELEVANT/NOT_RELEVANT would turn a recall pass into a second false-
 * certification mechanism, which is the failure it exists to prevent.
 * NOT_RELEVANT requires POSITIVE evidence that cardinality changes nothing —
 * not merely the absence of a signal, which is what got us here.
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

/* ── the dependency graph, read from the clause library ──────────────────── */

function loadEdges() {
  const out = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith(".json")) continue;
      let j; try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
      for (const c of Array.isArray(j) ? j : (j.clauses || [j])) {
        if (!c?.clause_id) continue;
        for (const t of c.depends_on || []) out.push({ from: c.clause_id, to: t, kind: "depends_on" });
        for (const t of c.required_with || []) out.push({ from: c.clause_id, to: t, kind: "required_with" });
      }
    }
  })(path.join(ROOT, "knowledge-base/clause_library"));
  return out;
}
const edges = loadEdges();

/*
 * ONLY `depends_on` CARRIES INHERITANCE, AND THE CODEBASE ALREADY SAYS WHY.
 * dependencyResolver.js distinguishes them: depends_on is STRUCTURAL — clause A
 * is incomplete without B — while required_with is CONDITIONAL co-presence. A
 * clause that is incomplete without an undecided clause inherits its
 * uncertainty. A clause that merely travels with one does not, and treating them
 * alike would inflate this pass the way `assign\w*` inflated the last one.
 */
const dependsOn = new Map();
for (const e of edges.filter((x) => x.kind === "depends_on")) {
  if (!dependsOn.has(e.from)) dependsOn.set(e.from, new Set());
  dependsOn.get(e.from).add(e.to);
}

function reaches(start, isTarget, seen = new Set()) {
  for (const next of dependsOn.get(start) || []) {
    if (seen.has(next)) continue;
    seen.add(next);
    if (isTarget(next)) return [next];
    const deeper = reaches(next, isTarget, seen);
    if (deeper.length) return [next, ...deeper];
  }
  return [];
}
const isOpen = (id) => {
  const t = treatmentFor(id, 3);
  return t.outcome === TREATMENT.UNRESOLVED && Boolean(t.shape);
};

/* ── the population ──────────────────────────────────────────────────────── */

const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));
const families = Object.keys(baseline.types).filter((type) => {
  const fields = new Set(Object.keys(getVariables(type) || {}));
  return PRINCIPAL_PREFIXES.some((p) => isRosterExtensionField(`${p}_3_name`, fields));
});

const prior = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/audit/semantic-candidates.json"), "utf8"));
const population = prior.filter((r) => !r.candidate).map((r) => r.id);

/* ── per-family rendering, for the role-variance detector ────────────────── */

const renders = new Map();   // clause_id -> Map(documentType -> text)
for (const type of families) {
  try {
    const r = await generateDocument({
      document_type: type,
      variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    });
    for (const c of r?.draft?.clauses || []) {
      if (!renders.has(c.clause_id)) renders.set(c.clause_id, new Map());
      renders.get(c.clause_id).set(type, c.text || "");
    }
  } catch { /* ignore families that cannot generate */ }
}

/*
 * PARTY_ROLE_VARIANCE. The same clause rendered into a lease says "Landlord" and
 * into an MSA says "Client". If its text differs across families ONLY in tokens
 * that are party labels, the clause is written relative to the parties — which
 * is a property of the clause, discovered without reading any N-party
 * vocabulary. A clause whose text is identical everywhere is about the
 * instrument, not about who signed it.
 */
const ROLE_TOKENS = /\b(Landlord|Tenant|Licensor|Licensee|Client|Consultant|Service Provider|Contractor|Developer|Supplier|Buyer|Seller|Principal|Distributor|Lender|Borrower|Creditor|Guarantor|Employer|Employee|Discloser|Recipient|Disclosing Party|Receiving Party|Partner \d|Shareholder \d|Founder \d|Party \d|Assignor|Assignee|Fiduciary|Processor)\b/g;

function roleVariance(id) {
  const m = renders.get(id);
  if (!m || m.size < 2) return null;
  const texts = [...m.values()].filter(Boolean);
  const distinct = new Set(texts);
  if (distinct.size < 2) return null;
  const roleSets = texts.map((t) => new Set((t.match(ROLE_TOKENS) || [])));
  const union = new Set(roleSets.flatMap((s) => [...s]));
  if (union.size < 2) return null;
  const varies = roleSets.some((s) => [...union].some((r) => !s.has(r)));
  if (!varies) return null;
  return `renders with different party roles across families: ${[...union].slice(0, 6).join(", ")}`;
}

/* ── roster differential ─────────────────────────────────────────────────── */

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
const at2 = await deedAt(2), at3 = await deedAt(3);

/*
 * POSITIVE EVIDENCE OF IRRELEVANCE. The only thing that earns NOT_RELEVANT: the
 * clause says in terms that it holds for any number, or it states a fact about
 * the instrument with no party in it at all. Absence of a signal is not this.
 */
const N_AGNOSTIC = /\bany number of counterparts\b|\bgoverned by (?:and construed in accordance with )?the laws of\b|\bheadings\b[^.]{0,80}\bconvenience only\b|\bsingular include the plural\b/i;

/* ── run ─────────────────────────────────────────────────────────────────── */

const results = [];
for (const id of population) {
  const chain = reaches(id, isOpen);
  const variance = roleVariance(id);
  const differs = id in at2 && id in at3 && at2[id] !== at3[id];
  const text = [...(renders.get(id)?.values() || [])].sort((a, b) => b.length - a.length)[0] || "";

  const evidence = [];
  if (chain.length) evidence.push({
    detector: "DEPENDENCY_INHERITANCE",
    detail: `depends_on → ${chain.join(" → ")}, whose N-party treatment is open (${treatmentFor(chain[chain.length - 1], 3).decision_id})`,
  });
  if (differs) evidence.push({ detector: "ROSTER_DIFFERENTIAL", detail: "shipped text changes when a third principal is added" });
  if (variance) evidence.push({ detector: "PARTY_ROLE_VARIANCE", detail: variance });

  /*
   * PARTY_ROLE_VARIANCE CANNOT ESTABLISH RELEVANCE, AND THE FIRST RUN OF THIS
   * PROBE PROVED IT. It fired on 25 of 25 candidates, because EVERY clause that
   * names a party renders differently across families whose parties are named
   * differently — a supply clause says "Seller" here and "Supplier" there. That
   * is detecting "does this clause mention a party", which is the pronoun scan
   * with extra steps and the exact error this phase exists to stop repeating.
   *
   * So it is demoted to an ASYMMETRIC signal, which is what it honestly is:
   *
   *   it cannot show a clause IS cardinality-sensitive;
   *   it can show a clause is party-relative, which BLOCKS a finding of
   *   NOT_RELEVANT — you may not certify a clause as cardinality-neutral when it
   *   is written in terms of who the parties are.
   *
   * Evidence against irrelevance is not evidence for relevance. Only the two
   * structural detectors — a dependency on an undecided clause, and a text that
   * actually changes when a principal is added — can establish RELEVANT.
   */
  const establishing = evidence.filter((e) => e.detector !== "PARTY_ROLE_VARIANCE");
  let verdict, why;
  if (establishing.length) {
    verdict = "RELEVANT";
    why = establishing.map((e) => e.detector).join(" + ");
  } else if (N_AGNOSTIC.test(text) && !ROLE_TOKENS.test(text)) {
    verdict = "NOT_RELEVANT";
    why = "states a rule about the instrument, in terms that hold for any number of parties";
  } else if (variance) {
    verdict = "UNDETERMINED";
    why = "party-relative, so it cannot be certified neutral — but no mechanism was demonstrated either";
  } else {
    verdict = "UNDETERMINED";
    why = "no mechanism demonstrated and no positive evidence of irrelevance";
  }
  results.push({ id, verdict, why, evidence, establishing: establishing.length,
    party_relative: Boolean(variance), families: renders.get(id)?.size || 0 });
}

/* ── VALIDATION: does the structural detector recover the model case? ────── */
//
// CORE_SURVIVAL_001 is NOT in this population — D4.21 already flagged it, which
// is why it was the example. So the detector is validated against the whole
// reachable set: if it cannot recover the one case we KNOW is inherited rather
// than announced, it has not been shown to work at all.

const allReachable = prior.map((r) => r.id);
const inherited = [];
for (const id of allReachable) {
  const chain = reaches(id, isOpen);
  if (chain.length) inherited.push({ id, chain });
}

/* ── report ──────────────────────────────────────────────────────────────── */

const by = (v) => results.filter((r) => r.verdict === v);
say("# D4.22 — recall pass over the clauses D4.21 cleared\n");
say(`Dependency edges in the clause library: **${edges.length}** (${dependsOn.size} clauses declare \`depends_on\`)\n`);
say(`Population — clauses D4.21 flagged with nothing: **${population.length}**\n`);
say("| verdict | clauses | meaning |");
say("|---|---|---|");
say(`| RELEVANT | **${by("RELEVANT").length}** | a mechanism demonstrates an N-party question |`);
say(`| NOT_RELEVANT | ${by("NOT_RELEVANT").length} | positive evidence that cardinality changes nothing |`);
say(`| UNDETERMINED | ${by("UNDETERMINED").length} | insufficient evidence — NOT a clean bill of health |`);

say("\n## Newly RELEVANT — false negatives of the D4.21 detector\n");
say("| clause | families | detectors | evidence |");
say("|---|---|---|---|");
for (const r of by("RELEVANT").sort((a, b) => b.families - a.families)) {
  say(`| \`${r.id}\` | ${r.families} | ${r.why} | ${r.evidence[0].detail.slice(0, 100)} |`);
}

say("\n## Validation — the structural detector against the whole reachable set\n");
say(`Clauses whose \`depends_on\` chain reaches an undecided clause: **${inherited.length}**\n`);
say("| clause | inherits from | in this population? |");
say("|---|---|---|");
for (const i of inherited) {
  say(`| \`${i.id}\` | ${i.chain.join(" → ")} | ${population.includes(i.id) ? "yes" : "no — already a D4.21 candidate"} |`);
}
const recovered = inherited.some((i) => i.id === "CORE_SURVIVAL_001");
say("");
say(recovered
  ? "**CORE_SURVIVAL_001 is recovered by the graph walk.** Its question is inherited from"
  : "**CORE_SURVIVAL_001 was NOT recovered — the detector does not work.**");
if (recovered) {
  say("CORE_TERMINATION_001, whose TERMINATION_FOR_DEFAULT_SCOPE is UNDECIDED, and the edge is");
  say("declared in the clause library. No word in the survival clause announces this.");
}

say("\n## What each detector contributed\n");
say("| detector | clauses found | found ONLY by this one |");
say("|---|---|---|");
for (const d of ["DEPENDENCY_INHERITANCE", "ROSTER_DIFFERENTIAL", "PARTY_ROLE_VARIANCE"]) {
  const hit = results.filter((r) => r.evidence.some((e) => e.detector === d));
  const only = hit.filter((r) => r.evidence.length === 1);
  say(`| ${d} | ${hit.length} | ${only.length} |`);
}

say("\n## NOT_RELEVANT, with the evidence that earned it\n");
for (const r of by("NOT_RELEVANT")) say(`- \`${r.id}\` — ${r.why}`);

say(`\n## UNDETERMINED (${by("UNDETERMINED").length})\n`);
say("These are not cleared. No mechanism was demonstrated AND no positive evidence of");
say("irrelevance was found, which are different states and are kept apart deliberately.\n");
for (const r of by("UNDETERMINED").slice(0, 25)) say(`- \`${r.id}\` (${r.families} families)`);
if (by("UNDETERMINED").length > 25) say(`- …and ${by("UNDETERMINED").length - 25} more`);

fs.writeFileSync(path.join(ROOT, "docs/audit/RECALL_PASS.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "docs/audit/recall-pass.json"), JSON.stringify(results, null, 1));
console.log("\nwritten: docs/audit/RECALL_PASS.md + recall-pass.json");
