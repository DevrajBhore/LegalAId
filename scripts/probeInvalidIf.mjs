/**
 * probeInvalidIf.mjs — PHASE D3.4
 *
 * CAN `invalid_if` PRODUCE A FINDING WITHOUT THE ENGINE MAKING A LEGAL
 * CONCLUSION?
 *
 * Two Terms of Service defects have no counterpart to contradict, so no
 * relationship catches them and no requirement asks about them: the instrument
 * asserting its own enforceability, and the instrument warranting the user's
 * free consent. `invalid_if` is the artifact designed for this shape.
 *
 * WHAT IT ALREADY DOES, and this was understated earlier. It is not dead prose.
 * documentIntelligence surfaces every entry verbatim as `watch_for`, so a reader
 * of the report already sees them. What it does not do is EVALUATE them.
 *
 * THE QUESTION IS NOT "should all 250 become executable". It is whether the
 * entries divide into kinds, and whether the kind that covers these two defects
 * can be checked without the engine deciding a question of law.
 *
 * CLASSIFICATION IS CONSERVATIVE AND LEAVES A RESIDUE. Entries that do not
 * clearly fall in a bucket are reported UNCLASSIFIED rather than forced into
 * one. Six measurement errors in this work have all been a filter matching more
 * than it meant, every one of them producing a number larger than the truth.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllClauses } from "../backend/services/clauseAssembler.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── The three kinds, by what would have to be TRUE to decide the entry ───────
const KINDS = [
  {
    kind: "ABOUT THE TEXT",
    decidedBy: "reading the clause that carries it",
    // Says the document omits, states, narrows or permits something. Decidable
    // by looking at the words, without knowing anything about the world.
    test: /\b(no |not |never |fails to |omits|absent|missing|silent)\b.{0,60}\b(clause|provision|mechanism|described|identified|stated|specified|provided)\b|\bis imposed\b|\ballow(s|ed)?\b|\bnarrow(s|ed)?\b|\bexceed(s|ing)?\b.{0,30}\b(days?|months?|years?)\b/i,
  },
  {
    kind: "ABOUT THE WORLD",
    decidedBy: "evidence about a person, a body, or an event",
    // Turns on a fact outside the document: who someone is, what happened.
    test: /\b(employ(ed|s|ee)|woman|women|member|officer|party|lender|borrower|registered|stamped|constituted|disseminated|occurred|paid|filed|served)\b/i,
  },
  {
    kind: "A QUESTION OF LAW",
    decidedBy: "a lawyer, on the facts of a dispute",
    // Turns on a judgement — reasonableness, excess, validity, enforceability.
    test: /\b(unreasonabl|excessive|too broad|broadly drafted|usurious|void|unenforceable|invalid|against public policy|disproportionate|penalty)\w*/i,
  },
];

const rows = [];
for (const clause of getAllClauses()) {
  for (const entry of clause.invalid_if || []) {
    const matched = KINDS.filter((k) => k.test.test(entry));
    rows.push({
      clause: clause.clause_id,
      entry,
      // An entry matching more than one test is NOT assigned. Two kinds is the
      // same failure as none: the classifier does not know.
      kind: matched.length === 1 ? matched[0].kind : (matched.length ? "AMBIGUOUS" : "UNCLASSIFIED"),
    });
  }
}

const count = (kind) => rows.filter((r) => r.kind === kind).length;
const lines = [];
lines.push("# Phase D3.4 — what kind of thing is an `invalid_if`?\n");
lines.push(`${rows.length} entries across ${new Set(rows.map((r) => r.clause)).size} clauses.\n`);
lines.push("## What it already does\n");
lines.push("`documentIntelligence` surfaces every entry verbatim as `watch_for`, so a reader of the");
lines.push("report already sees them. It is descriptive metadata that reaches a human. What it does");
lines.push("not do is evaluate them, and the question is whether it could without the engine");
lines.push("deciding a question of law.\n");
lines.push("## By what would have to be true to decide the entry\n");
lines.push("| kind | decided by | count |");
lines.push("|---|---|---|");
for (const k of KINDS) lines.push(`| ${k.kind} | ${k.decidedBy} | ${count(k.kind)} |`);
lines.push(`| AMBIGUOUS | matched more than one test — the classifier does not know | ${count("AMBIGUOUS")} |`);
lines.push(`| UNCLASSIFIED | matched none | ${count("UNCLASSIFIED")} |`);
lines.push("");
lines.push(`**${count("AMBIGUOUS") + count("UNCLASSIFIED")} of ${rows.length} are not classified**, and that is reported rather than`);
lines.push("resolved. A keyword classifier over legal prose is the same instrument that has produced");
lines.push("six inflated findings in this work; forcing the residue into buckets would produce a");
lines.push("seventh.\n");
for (const k of [...KINDS.map((x) => x.kind), "AMBIGUOUS", "UNCLASSIFIED"]) {
  const sample = rows.filter((r) => r.kind === k).slice(0, 6);
  if (!sample.length) continue;
  lines.push(`### ${k} — first ${sample.length}\n`);
  for (const r of sample) lines.push(`- \`${r.clause}\`: ${r.entry}`);
  lines.push("");
}
fs.writeFileSync(path.join(ROOT, "docs/audit/INVALID_IF_PROBE.md"), lines.join("\n") + "\n");

console.log(`${rows.length} invalid_if entries across ${new Set(rows.map((r) => r.clause)).size} clauses`);
for (const k of KINDS) console.log(`  ${String(count(k.kind)).padStart(4)}  ${k.kind.padEnd(18)} decided by ${k.decidedBy}`);
console.log(`  ${String(count("AMBIGUOUS")).padStart(4)}  AMBIGUOUS`);
console.log(`  ${String(count("UNCLASSIFIED")).padStart(4)}  UNCLASSIFIED`);
