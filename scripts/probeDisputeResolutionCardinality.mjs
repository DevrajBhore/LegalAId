/**
 * probeDisputeResolutionCardinality.mjs — THE NEXT CLAUSE, BY EXPOSURE
 *
 * D4.19 measured the portfolio ceiling: 184 clauses reachable by a family that
 * can admit a third principal, 162 of them never examined. The exposure ranking
 * put CORE_DISPUTE_RESOLUTION_001 at the top — 28 of 28 families, more than any
 * other unclassified clause. This probe takes that one clause and asks the four
 * questions the classification needs, in order:
 *
 *   1. What does the SHIPPED clause actually say? (not the library text —
 *      D4.15 established the two differ)
 *   2. Which of its sentences change meaning when the party count changes?
 *   3. For each such sentence, is the change DETERMINED by the two-party wording,
 *      or does it require somebody to choose?
 *   4. Does the existing shape vocabulary represent what this clause needs, or
 *      does the evidence demand a new one?
 *
 * Question 4 is asked LAST and answered conservatively. A new shape is a new
 * abstraction, and the rule is that the evidence has to demonstrate the existing
 * ones cannot carry the clause — not that a new one would read more neatly.
 *
 * Nothing is classified here. The probe reports; the governance files record.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

const CLAUSE = "CORE_DISPUTE_RESOLUTION_001";

/* ── 1. THE SHIPPED TEXT ─────────────────────────────────────────────────── */

const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));
const carriers = Object.keys(baseline.types).filter((type) =>
  Object.values(baseline.types[type] || {}).some((level) =>
    (level?.clauses || []).includes(CLAUSE)));

const shipped = {};
for (const type of carriers) {
  const r = await generateDocument({
    document_type: type,
    variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
  });
  const clause = (r?.draft?.clauses || []).find((c) => c.clause_id === CLAUSE);
  if (clause?.text) shipped[type] = clause.text;
}

// Variants differ only by the seat city the fixture supplies, which is not a
// cardinality question. Normalise it away so the comparison is about structure.
const skeleton = (t) => t.replace(/\b[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)?\b(?=\s+(?:and the courts|or, where))/g, "<SEAT>");
const variants = new Map();
for (const [type, t] of Object.entries(shipped)) {
  const k = skeleton(t);
  if (!variants.has(k)) variants.set(k, []);
  variants.get(k).push(type);
}

say(`# ${CLAUSE} — cardinality probe\n`);
say(`Carried by **${carriers.length}** document types. Distinct shipped structures: **${variants.size}**.\n`);
say("One structure means one classification decision covers every family that carries it.\n");

/* ── 2. THE SENTENCES, AND WHETHER PARTY COUNT TOUCHES THEM ──────────────── */

const body = [...variants.keys()][0] || "";
const sentences = body
  .split(/(?<=\.)\s+(?=[A-Z(])/)
  .map((s) => s.trim())
  .filter(Boolean);

/*
 * A sentence is cardinality-sensitive if it refers to the parties in a way whose
 * DENOTATION changes with N. "the Parties" collectively does not — it means all
 * of them at any count. "either Party" / "the other Party" does, because at two
 * the two readings coincide and at three they do not.
 */
const COLLECTIVE = /\bthe Parties\b/;
const BINARY = /\beither Party\b|\bthe other Party\b|\bbetween the Parties\b|\bboth Parties\b/;

say("## Sentence by sentence — and why this table is not the answer\n");
say("| # | binary party language | sentence |");
say("|---|---|---|");
const flagged = [];
sentences.forEach((s, i) => {
  const binary = BINARY.test(s);
  const collective = COLLECTIVE.test(s);
  if (binary) flagged.push(i + 1);
  const how = binary ? "**binary**" : collective ? "collective" : "—";
  say(`| ${i + 1} | ${how} | ${s.slice(0, 110)}${s.length > 110 ? "…" : ""} |`);
});

/*
 * THE SCAN FINDS THE WRONG SENTENCE, AND THAT IS THE MOST IMPORTANT RESULT HERE.
 *
 * D4.15 found its 23 clauses by looking for "either Party" and "the other
 * Party". Run over this clause, that method flags sentence 1 — the amicable-
 * discussion step, which is DETERMINED and harmless — and passes over the
 * sentence carrying the open question, because "it shall be referred to
 * arbitration" mentions no party at all.
 */
const REFERRAL = sentences.findIndex((s) => /referred to arbitration/.test(s)) + 1;
say("");
say(`**The scan flags sentence ${flagged.join(", ")}. The open question is in sentence ${REFERRAL}.**`);
say("");
say("Sentence " + flagged[0] + " contains \"between the Parties\" and is harmless: a good-faith");
say("discussion among three is the same obligation as between two. Sentence " + REFERRAL + " contains no");
say("party reference whatsoever — \"it shall be referred to arbitration\" — and carries the");
say("decision that is worth money.");
say("");
say("So LEXICAL PARTY-REFERENCE SCANNING DOES NOT FIND N-PARTY QUESTIONS. It finds a");
say("subset: the ones visible in the pronouns. Invariant 60's twenty-three clauses were");
say("found that way, which means the classified set is biased toward lexically-visible");
say("problems and the 162 unclassified clauses may hold more of this kind — a question");
say("about STRUCTURE hiding in a sentence that names nobody. The 12% figure is a ceiling on");
say("what has been examined, not a floor on what is wrong.");

/* ── 3. THE QUESTIONS THE BINARY SENTENCES RAISE ─────────────────────────── */

say("\n## What actually changes at three parties\n");

const findings = [
  {
    component: "Amicable resolution",
    text: "shall first be attempted to be resolved amicably between the Parties",
    question: "Is the pre-arbitral step attempted between the two in dispute, or among all of them?",
    verdict: "DETERMINED",
    reasoning:
      "\"between the Parties\" is the collective, and a good-faith discussion among three is the same obligation as between two. " +
      "Nothing turns on the count: no right is gained or lost by either reading, and the step is a precondition to referral rather than " +
      "a source of substantive rights.",
  },
  {
    component: "Appointment of the sole arbitrator",
    text: "a sole arbitrator jointly appointed by the Parties and, failing agreement … appointed in accordance with the Act",
    question: "Does \"jointly appointed\" require the agreement of all principals, or of the two in dispute?",
    verdict: "DETERMINED",
    reasoning:
      "All of them, and this is the CONSENT_OR_NOTICE_TO_OTHERS shape already recorded in invariant 60: reading it as 'any two' would " +
      "let two parties in a firm of three impose an arbitrator on the third, which no ordinary construction supports and which Section 18 " +
      "of the Arbitration and Conciliation Act, 1996 (equal treatment) does not permit. " +
      "Crucially the clause specifies a SOLE arbitrator, so the classic multi-party appointment problem does not arise here: where each side " +
      "nominates its own arbitrator, three parties cannot each have a nominee without unequal treatment. This clause never gives anyone a nominee. " +
      "And the fallback is count-independent — on failure to agree, Section 11(5) sends the appointment to the arbitral institution designated " +
      "under Section 11(3A), which works identically for two parties or four.",
  },
  {
    component: "Scope of the reference",
    text: "it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996",
    question:
      "Where there are more than two parties, may one party refer a dispute against one other party alone, leaving the rest out — " +
      "or must every party be joined to a single arbitration?",
    verdict: "**DECISION REQUIRED**",
    reasoning:
      "At two parties, 'refer the dispute to arbitration' and 'refer it against the other party' are the same act, and the clause could never " +
      "have distinguished them. At three they diverge, and the difference is substantive: an award between Party 1 and Party 2 does not bind " +
      "Party 3, who may then litigate the same facts and obtain an inconsistent result on the same instrument. " +
      "NOTHING IN THE STATUTE FILLS THE GAP. The Arbitration and Conciliation Act, 1996 as amended through 2021 contains no provision for " +
      "joinder of parties or consolidation of proceedings; the Supreme Court has permitted consolidation in PR Shah v B.H.H. Securities and the " +
      "Delhi High Court in Gammon India v NHAI, but as a matter of judicial practice rather than entitlement, and ad hoc references have no " +
      "institutional rules to fall back on. The draft Arbitration and Conciliation (Amendment) Bill, 2024 does not address it and is not law. " +
      "So the instrument is the only place this could have been settled, and it does not settle it.",
  },
  {
    component: "Binding effect of the award",
    text: "the award … shall be final and binding on the Parties",
    question: "Binding on all principals, or only on those who took part?",
    verdict: "FOLLOWS THE SCOPE DECISION",
    reasoning:
      "Not an independent question. A party who was not joined cannot be bound by an award made without them, whatever the clause recites — " +
      "so this sentence means whatever the scope decision above makes it mean, and recording it separately would double-count one question.",
  },
];

for (const f of findings) {
  say(`### ${f.component} — ${f.verdict}\n`);
  say(`> ${f.text}\n`);
  say(`**Question.** ${f.question}\n`);
  say(`${f.reasoning}\n`);
}

/* ── 4. DOES THE EXISTING VOCABULARY CARRY IT? ───────────────────────────── */

const shapes = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/nparty-shapes.json"), "utf8"));

say("## Does an existing shape represent this?\n");
say("| shape | fits? | why |");
say("|---|---|---|");
const fit = {
  ALREADY_N_SAFE: ["no", "the scope question is not distributive; it is a choice between two structures"],
  UNIFORM_PROHIBITION: ["no", "nothing here is a prohibition binding each party equally"],
  RECIPROCAL_SEVERAL: ["no", "arbitration is not an obligation owed party-to-party in parallel"],
  CONSENT_OR_NOTICE_TO_OTHERS: ["partly", "carries the APPOINTMENT sentence exactly, and carries nothing else in the clause"],
  APPORTIONED_QUANTITY: ["no", "no quantity is divided"],
  PAIRWISE_RIGHT: ["**yes**", "a right one party exercises with respect to another, where N>2 forces a choice between bilateral and multilateral effect — structurally the same question as terminating for one party's default"],
  ROSTER_DRIVEN: ["no", "the clause is written about the parties, not assembled from them; its text does not change with the roster"],
};
for (const s of shapes.shapes) {
  const [verdict, why] = fit[s.shape] || ["no", "—"];
  say(`| ${s.shape} | ${verdict} | ${why} |`);
}

say("\n### The conservative reading\n");
say("PAIRWISE_RIGHT is recorded as \"a right arising from one party's default. With three,");
say("does the innocent party end the whole instrument, or only its relationship with the");
say("defaulter?\" The default framing is the INSTANCE it was drawn from, not the essence.");
say("Stripped to its semantics the shape is: **a right exercised with respect to one other");
say("party, where more than two parties force a choice between bilateral and multilateral");
say("effect.** That is exactly the reference-scope question.");
say("");
say("So NO NEW SHAPE. A new one would read more neatly and would be an abstraction built");
say("because the architecture seemed to want one — the thing the method exists to refuse.");
say("");
say("What IS new is the decision. Shapes are reusable; a decision is one question about one");
say("clause, and `ARBITRATION_REFERENCE_SCOPE` is not `TERMINATION_FOR_DEFAULT_SCOPE`.");

/* ── 5. A MODELLING LIMIT THE EVIDENCE EXPOSED ───────────────────────────── */

say("\n## One thing this clause breaks\n");
say("This clause carries TWO N-party components with DIFFERENT verdicts: the appointment");
say("sentence is CONSENT_OR_NOTICE_TO_OTHERS and determined; the reference scope is");
say("PAIRWISE_RIGHT and undecided. The shape index maps one clause to one shape, so listing");
say("it under both would silently overwrite — `shapeOf.set(id, s)`, last file entry wins,");
say("no error.");
say("");
say("That does not need a multi-shape mechanism. For CLASSIFICATION the demanding component");
say("governs: a clause with any open decision is AUTHORED_DECISION_PENDING however many of");
say("its sentences are settled. The settled component is recorded in the decision's own");
say("`components` field, which is documentation and costs no engine mechanics.");
say("");
say("The silent overwrite is a real latent defect and is now asserted against separately.");

fs.writeFileSync(path.join(ROOT, "docs/audit/DISPUTE_RESOLUTION_CARDINALITY.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/DISPUTE_RESOLUTION_CARDINALITY.md");
