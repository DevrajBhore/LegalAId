/**
 * probeNPartyClassification.mjs — THE CEILING, MEASURED
 *
 * Invariant 60 classified 23 clauses into six N-party shapes. That number was
 * never claimed to be the portfolio; it was the clauses one MSA fixture reached.
 * This sweep asks the portfolio-wide question:
 *
 *     Of every clause that can appear in a document capable of carrying more
 *     than two principals, how many have been classified for N-party behaviour
 *     at all?
 *
 * THREE STATES, AND NO FOURTH:
 *
 *   SAFE                       classified into a shape that generalises with
 *                              nobody choosing anything. The N-party wording
 *                              follows from the two-party wording.
 *   AUTHORED_DECISION_PENDING  classified into a shape that requires a legal
 *                              decision, and the decision is recorded UNDECIDED.
 *                              We know a question exists and what it is.
 *   NOT_CLASSIFIED             nobody has looked. We do not know whether this
 *                              clause has an N-party problem.
 *
 * THE DISTINCTION IS OPERATIONAL, NOT COSMETIC. Both of the last two prevent
 * certification, and they mean opposite things to whoever has to act:
 * AUTHORED_DECISION_PENDING is work for an advocate, with the question already
 * framed and the candidate readings already written down. NOT_CLASSIFIED is work
 * for whoever does this sweep next. Letting both fall into one "unresolved"
 * bucket hides which of the two you have, and there are far more of the second.
 *
 * Nothing is classified here. The probe reports what the repository establishes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVariables } from "../backend/config/variableConfig.js";
import { treatmentFor, TREATMENT } from "../backend/services/npartyTreatment.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

/* ── 1. WHICH FAMILIES CAN CARRY MORE THAN TWO PRINCIPALS ────────────────── */
//
// Not a judgement about which SHOULD. The test is structural and matches the
// admission rule exactly: a family is N-party capable when its schema declares a
// principal series at 1 and 2, because that is precisely when index 3 is
// admitted. A family that cannot admit a third principal cannot have an N-party
// problem in its own documents.

const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
);
const DOC_TYPES = Object.keys(baseline.types);

const nPartyFamilies = [];
for (const type of DOC_TYPES) {
  const fields = new Set(Object.keys(getVariables(type) || {}));
  const prefix = PRINCIPAL_PREFIXES.find(
    (p) => fields.has(`${p}_1_name`) && fields.has(`${p}_2_name`)
  );
  if (prefix) nPartyFamilies.push({ type, prefix });
}

say("# N-party classification — the portfolio ceiling\n");
say(`Document types in the corpus: **${DOC_TYPES.length}**`);
say(`Types that can admit a third principal: **${nPartyFamilies.length}**\n`);
say("| document type | principal series |");
say("|---|---|");
for (const f of nPartyFamilies) say(`| ${f.type} | \`${f.prefix}_N_*\` |`);

/* ── 2. EVERY CLAUSE THOSE FAMILIES REACH ────────────────────────────────── */

const reachable = new Map(); // clause_id -> Set(document types)
for (const { type } of nPartyFamilies) {
  const entry = baseline.types[type] || {};
  for (const level of Object.keys(entry)) {
    for (const id of entry[level]?.clauses || []) {
      if (!reachable.has(id)) reachable.set(id, new Set());
      reachable.get(id).add(type);
    }
  }
}

/* ── 3. CLASSIFY ─────────────────────────────────────────────────────────── */

const STATE = {
  SAFE: "SAFE",
  PENDING: "AUTHORED_DECISION_PENDING",
  UNSEEN: "NOT_CLASSIFIED",
};

function classify(clauseId) {
  // Asked at three principals, because at two every clause is NOT_APPLICABLE by
  // construction and the sweep would report a clean portfolio.
  const t = treatmentFor(clauseId, 3);
  if (t.outcome === TREATMENT.DETERMINED) return STATE.SAFE;
  if (t.outcome === TREATMENT.UNRESOLVED && t.shape) return STATE.PENDING;
  if (t.outcome === TREATMENT.UNRESOLVED && !t.shape) return STATE.UNSEEN;
  // NOT_APPLICABLE can only come back at two principals, so reaching here would
  // mean the question was asked wrongly rather than that a fourth state exists.
  throw new Error(`${clauseId}: unclassifiable outcome ${t.outcome} at three principals`);
}

const byState = { [STATE.SAFE]: [], [STATE.PENDING]: [], [STATE.UNSEEN]: [] };
for (const id of [...reachable.keys()].sort()) byState[classify(id)].push(id);

const total = reachable.size;
say(`\n## The ceiling\n`);
say(`Distinct clauses reachable by an N-party-capable family: **${total}**\n`);
say("| state | clauses | share |");
say("|---|---|---|");
for (const state of [STATE.SAFE, STATE.PENDING, STATE.UNSEEN]) {
  const n = byState[state].length;
  say(`| ${state} | ${n} | ${((n / total) * 100).toFixed(1)}% |`);
}

say(`\n## AUTHORED_DECISION_PENDING (${byState[STATE.PENDING].length})\n`);
say("Work for an advocate. The question is framed and the candidate readings are written down.\n");
say("| clause | shape | decision |");
say("|---|---|---|");
for (const id of byState[STATE.PENDING]) {
  const t = treatmentFor(id, 3);
  say(`| \`${id}\` | ${t.shape} | ${t.decision_id || "—"} |`);
}

say(`\n## SAFE (${byState[STATE.SAFE].length})\n`);
say("| clause | shape |");
say("|---|---|");
for (const id of byState[STATE.SAFE]) {
  say(`| \`${id}\` | ${treatmentFor(id, 3).shape} |`);
}

say(`\n## NOT_CLASSIFIED (${byState[STATE.UNSEEN].length})\n`);
say("Work for whoever runs this sweep next. Nobody has established whether these");
say("clauses have an N-party semantic problem.\n");
say("| clause | reached by |");
say("|---|---|");
for (const id of byState[STATE.UNSEEN]) {
  say(`| \`${id}\` | ${reachable.get(id).size} |`);
}

/* ── 4. THE CLAUSES MOST EXPOSED ─────────────────────────────────────────── */
//
// An unclassified clause that appears in one rarely-used family is a smaller
// problem than one that appears in every N-party family. Ranking by reach turns
// the backlog into an order of work rather than a list.

say("\n## Unclassified clauses ranked by exposure\n");
const ranked = byState[STATE.UNSEEN]
  .map((id) => ({ id, reach: reachable.get(id).size }))
  .sort((a, b) => b.reach - a.reach)
  .slice(0, 20);
say("| clause | families reached |");
say("|---|---|");
for (const r of ranked) say(`| \`${r.id}\` | ${r.reach} |`);

say("\n## Reading\n");
say(`Invariant 60's twenty-three clauses were the ones one MSA fixture reached,`);
say(`not the portfolio. Measured across every family that can admit a third`);
say(`principal, the classified fraction is **${(((byState[STATE.SAFE].length + byState[STATE.PENDING].length) / total) * 100).toFixed(1)}%**.`);
say("");
say("The number that matters is not how many clauses are unresolved. It is that");
say(`**${byState[STATE.PENDING].length}** of them are unresolved because a legal question was identified`);
say(`and deliberately left open, and **${byState[STATE.UNSEEN].length}** are unresolved because nobody has looked.`);
say("Those are different states with different owners, and before this sweep the");
say("repository could not tell them apart at portfolio scale.");

fs.writeFileSync(path.join(ROOT, "docs/audit/NPARTY_CLASSIFICATION.md"), lines.join("\n") + "\n");
console.log("\nwritten: docs/audit/NPARTY_CLASSIFICATION.md");
