/**
 * answerStateCorpus.test.mjs
 *
 * The clause baseline watches one dimension: what each DOCUMENT TYPE emits.
 * Phase 5 introduced a second — what each ANSWER STATE does — and nothing was
 * watching it. A change that leaves all forty document types identical can still
 * silently stop honouring what a user answered.
 *
 * tests/baseline/answer-states.json freezes the whole causal chain for every
 * fact in every state it can be in:
 *
 *   answer -> position -> provenance -> treatment -> variable
 *          -> deterministic gate -> clause -> disclosure -> artifact
 *
 * so a break shows up on the link where it happened rather than as a document
 * that is quietly two clauses different from the one a user got last week.
 *
 * Re-record deliberately with: node scripts/freezeAnswerStates.mjs --write
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { buildAnswerStateCorpus } from "../scripts/freezeAnswerStates.mjs";

const FROZEN = JSON.parse(fs.readFileSync(path.resolve("tests/baseline/answer-states.json"), "utf8"));
const current = await buildAnswerStateCorpus();
let checks = 0;

// ── 1. No drift along any link of the chain ─────────────────────────────────
const drift = [];
for (const [factId, states] of Object.entries(FROZEN)) {
  for (const [state, frozen] of Object.entries(states)) {
    const now = current?.[factId]?.[state];
    if (!now) { drift.push(`${factId}/${state}: case has disappeared`); continue; }
    for (const link of ["positions", "outcomes", "clauses", "disclosureKinds", "unmatched", "inArtifact"]) {
      const a = JSON.stringify(frozen[link]);
      const b = JSON.stringify(now[link]);
      if (a !== b) drift.push(`${factId}/${state} — ${link}:\n      was: ${a}\n      now: ${b}`);
    }
    checks += 6;
  }
}
assert.deepStrictEqual(drift, [],
  `The answer-state corpus has drifted:\n\n  ${drift.join("\n  ")}\n\n` +
  `Every line is either an intended change or a regression. If intended, re-record with:\n` +
  `  node scripts/freezeAnswerStates.mjs --write`);
console.log(`PASS  answer-state corpus stable across ${checks / 6} cases`);

// ── 2. An explicit no is not the same as silence ────────────────────────────
// The distinction the whole pipeline rests on. If these ever collapse, a user
// who declined a protection and a user nobody asked become indistinguishable.
for (const [factId, states] of Object.entries(current)) {
  const { unanswered, answered_no: answeredNo } = states;
  if (!unanswered || !answeredNo) continue;
  assert.notDeepStrictEqual(
    { p: answeredNo.positions, o: answeredNo.outcomes },
    { p: unanswered.positions, o: unanswered.outcomes },
    `${factId}: answering "no" produces exactly the same positions and outcomes as never ` +
    `being asked. An explicit refusal has collapsed back into silence.`
  );
  checks += 1;
}
console.log("PASS  an explicit no is distinguishable from never being asked");

// ── 3. Malformed input produces diagnostics, never drafting facts ───────────
for (const [factId, states] of Object.entries(current)) {
  const { unanswered, malformed_answer: malformed } = states;
  if (!unanswered || !malformed) continue;
  assert.ok(malformed.unmatched >= 1,
    `${factId}: an unreadable answer was not reported as unmatched`);
  assert.deepStrictEqual(malformed.clauses, unanswered.clauses,
    `${factId}: an unreadable answer changed which clauses the agreement contains. ` +
    `Input the engine could not read must never become a legal determination.`);
  assert.deepStrictEqual(malformed.disclosureKinds, unanswered.disclosureKinds,
    `${factId}: an unreadable answer produced a different disclosure. A fabricated ` +
    `disclosure is indistinguishable from a real one to the person signing.`);
  checks += 3;
}
console.log("PASS  malformed answers are diagnostics, not drafting facts");

// ── 4. Prose alone never carries authority ──────────────────────────────────
for (const [factId, states] of Object.entries(current)) {
  const inferred = states.inferred_from_prose;
  if (!inferred) continue;
  for (const [flag, record] of Object.entries(inferred.positions)) {
    assert.ok(!String(record).includes("/user_answer"),
      `${factId}: ${flag} was recorded as the user's answer when it came only from their prose. ` +
      `An inference must stay an inference.`);
    checks += 1;
  }
}
console.log("PASS  prose is never recorded as an answer");

// ── 5. Every position names its origin; every disclosure reaches the file ───
for (const [factId, states] of Object.entries(current)) {
  for (const [state, record] of Object.entries(states)) {
    for (const [flag, value] of Object.entries(record.positions)) {
      assert.ok(/\/(user_answer|derived_fact|inferred_fact|drafting_default|assumed_counterparty|advocate_assertion)/.test(value),
        `${factId}/${state}: ${flag} = "${value}" has no recognisable provenance`);
      checks += 1;
    }
    assert.strictEqual(record.inArtifact, record.disclosureKinds.length > 0,
      `${factId}/${state}: ${record.disclosureKinds.length} disclosures but inArtifact=` +
      `${record.inArtifact}. Either something is disclosed to the app and not to the signed ` +
      `document, or an empty section is being printed.`);
    checks += 1;
  }
}
// The assumed-side dependency is visible on every position that inherits it.
const assumed = current.__assumed_side.no_drafting_for;
for (const [flag, value] of Object.entries(assumed.positions)) {
  assert.ok(String(value).includes("/assumed-side"),
    `${flag} rests on an assumed party side but does not say so`);
  checks += 1;
}
assert.ok(assumed.disclosureKinds.includes("ASSUMED"),
  "a draft resting on an assumed side must carry an ASSUMED disclosure");
checks += 1;
console.log("PASS  provenance complete; disclosures reach the artifact; assumed side is visible");

console.log(`\nALL GREEN (${checks} checks)`);
