/**
 * probeContract.test.mjs
 *
 * A PROBE MUST REACH THE ANSWER IT MEANS TO REACH.
 *
 * Five measurement errors, all the same shape: the probe answered a different
 * question from the one it was asked, and every time the wrong number was
 * LARGER than the right one. An inflated finding is not a safe error — it gets
 * acted on. One of them justified building an abstraction, migrating a live
 * requirement, and writing a principle about two positions that were never in
 * difficulty.
 *
 * scripts/lib/semanticMutation.mjs is the one place that knows how to choose an
 * answer. This file keeps it that way — the same discipline derivationAdapter.js
 * has for the derivation call, and for the same reason: a convention that lives
 * only in a comment is re-derived wrongly by the next script.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optionMeaning, canDecline, mutateTo, fieldsBehindGate }
  from "../scripts/lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";
import { loadSemanticFacts } from "../backend/services/canonicalFacts.js";
import { getVariables } from "../backend/config/variableConfig.js";

let checks = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── The contract itself ──────────────────────────────────────────────────────

// The exact select that produced error #5.
const threeWay = { type: "select", options: ["AI Recommended", "Yes", "No"] };
assert.equal(
  optionMeaning(threeWay, POSITION.FALSE), "No",
  "the option meaning NO is not being found on a three-way select — the case that read a " +
  "working gate as dead"
);
assert.notEqual(
  optionMeaning(threeWay, POSITION.FALSE), "AI Recommended",
  "'AI Recommended' is being treated as a decline. It normalises the way 'Yes' does."
);
checks += 2;

// A field with no "no" has no decline to test, and must say so rather than
// offer something else.
const noDecline = { type: "select", options: ["Monthly", "Quarterly"] };
assert.equal(optionMeaning(noDecline, POSITION.FALSE), null);
assert.equal(canDecline(noDecline), false);
assert.equal(
  mutateTo({ cadence: "Monthly" }, "cadence", noDecline, POSITION.FALSE), null,
  "mutateTo invented an answer for a field that cannot express one. Returning null is what " +
  "makes a caller skip the case instead of measuring a different one."
);
checks += 3;

// Mutating to the position the field already holds is not a mutation.
assert.equal(mutateTo({ x: "No" }, "x", threeWay, POSITION.FALSE), null);
assert.deepEqual(mutateTo({ x: "Yes" }, "x", threeWay, POSITION.FALSE), { x: "No" });
checks += 2;

// ── The gate-name / field-name gap, which produced error #3 ──────────────────
const facts = loadSemanticFacts();
const loanSchema = getVariables("LOAN_AGREEMENT") || {};
const secured = fieldsBehindGate("is_secured", facts, loanSchema);
assert.deepEqual(
  secured.fields, ["loan_is_secured"],
  "the gate flag `is_secured` no longer resolves to the question that answers it. Writing into " +
  "`is_secured` writes a key the schema does not have: sanitisation drops it, the gate stays " +
  "open, and every gated clause reads as overridden."
);
assert.equal(secured.measurable, true);

const unmappable = fieldsBehindGate("some_control_nobody_asks", facts, loanSchema);
assert.equal(
  unmappable.measurable, false,
  "an unmappable gate is being reported as measurable. It must be NOT MEASURABLE — counting it " +
  "as respected understates, counting it as overridden inflates, and both are claims the probe " +
  "cannot support."
);
assert.ok(unmappable.why && unmappable.why.length > 40, "not-measurable must say why");
assert.deepEqual(unmappable.fields, []);
checks += 4;

// ── Nothing re-derives it ────────────────────────────────────────────────────
// The convention has to live in one place or it gets reinvented. These are the
// two spellings that actually caused errors: positional choice, and
// choice-by-difference.
const HAND_ROLLED = [
  { pattern: /\.options\s*\[\s*0\s*\]/, name: "options[0] — positional choice (error #4)" },
  {
    pattern: /options\s*\.\s*find\s*\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*String\(\s*\1\s*\)\s*!==/,
    name: "options.find(o => String(o) !== …) — choice by difference (error #5)",
  },
];
const offenders = [];
for (const file of fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs"))) {
  const source = fs.readFileSync(path.join(ROOT, "scripts", file), "utf8");
  // The sampler is allowed options[0]: it is choosing a specimen VALUE, not an
  // answer with a position, and sweep.mjs states which profile it represents.
  if (file === "freezeClauseBaseline.mjs") continue;
  for (const { pattern, name } of HAND_ROLLED) {
    if (pattern.test(source)) offenders.push(`scripts/${file}: ${name}`);
  }
}
assert.deepEqual(
  offenders, [],
  `a probe chooses an answer without the contract:\n  - ${offenders.join("\n  - ")}\n` +
  `Import scripts/lib/semanticMutation.mjs instead. Every one of the five measurement errors ` +
  `was a probe that picked an answer its own way.`
);
checks += 1;

console.log(
  "PASS  the mutation contract holds: a probe reaches the option that MEANS the position,\n" +
  "      refuses where the field cannot express one, and resolves a gate flag to the question\n" +
  "      that answers it or reports the gate not measurable"
);
console.log(`\nALL GREEN (${checks} checks)`);
