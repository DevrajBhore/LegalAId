/**
 * semanticMutation.mjs — THE ONE PLACE THAT KNOWS HOW TO CHOOSE AN ANSWER.
 *
 * Five measurement errors shared one shape: the probe answered a different
 * question from the one it was asked, and every time the wrong number was LARGER
 * than the right one. probeContract.test.mjs records them and the rules that
 * prevent them, and the two spellings that actually caused them are banned there
 * by pattern — positional choice, `options[0]`, and choice by difference,
 * `options.find(o => String(o) !== …)`.
 *
 * PROVENANCE OF THIS FILE. The module was imported by ten shipped files and
 * existed in none of them: scripts/lib/ was absent from the repository, the same
 * class of failure as the missing FIXTURE_PROFILE export. It is reconstructed
 * here, and the reconstruction is not a guess — probeContract.test.mjs shipped
 * and specifies all four exports across twelve assertions, including the exact
 * three-way select that produced error #5 and the gate that produced error #3.
 * That test passing is the evidence for this file, and it is the only evidence
 * claimed: nothing here asserts continuity with measurements taken before the
 * module was lost.
 */
import { POSITION } from "../../backend/services/generationControls.js";

/*
 * What an option MEANS, as opposed to where it sits.
 *
 * "AI Recommended" normalises the way "Yes" does — it is the system being left to
 * decide, not the user declining — so on ["AI Recommended", "Yes", "No"] the
 * decline is "No" and nothing else. Reading position by ORDER put "AI
 * Recommended" in the decline slot and reported a working gate as dead.
 */
const MEANS_TRUE = /^(yes|true|include|required|applicable|enabled?|opt[- ]?in|ai recommended|recommended)$/i;
const MEANS_FALSE = /^(no|false|exclude|not required|not applicable|n\/?a|disabled?|opt[- ]?out|none)$/i;

/**
 * The option on `def` that expresses `position`, or null where the field cannot
 * express it.
 *
 * Null is the important return. A field with no option meaning NO has no decline
 * to test, and saying so is what makes a caller skip the case rather than measure
 * a different one.
 */
export function optionMeaning(def, position) {
  if (!def || def.type !== "select" || !Array.isArray(def.options)) return null;
  const wanted = position === POSITION.TRUE ? MEANS_TRUE
    : position === POSITION.FALSE ? MEANS_FALSE
      : null;
  if (!wanted) return null;
  /*
   * "AI Recommended" means TRUE but is not the plainest spelling of it. Where a
   * field offers both, the caller asking for TRUE wants the unambiguous answer,
   * so an exact yes-family match is preferred and the recommendation is the
   * fallback. For FALSE the question does not arise.
   */
  const matches = def.options.filter((o) => wanted.test(String(o).trim()));
  if (!matches.length) return null;
  if (position === POSITION.TRUE) {
    const plain = matches.find((o) => /^(yes|true)$/i.test(String(o).trim()));
    if (plain) return plain;
  }
  return matches[0];
}

/** Whether the field can express a decline at all. */
export function canDecline(def) {
  return optionMeaning(def, POSITION.FALSE) !== null;
}

/**
 * The variables with `key` moved to `position`, or null where that is not a
 * mutation.
 *
 * Two cases return null and both matter. A field that cannot express the position
 * must not be given an invented answer — that measures a different question. A
 * field ALREADY holding the position has not been mutated, and treating it as
 * though it had is how a probe counts a case it never exercised.
 */
export function mutateTo(variables, key, def, position) {
  const option = optionMeaning(def, position);
  if (option === null) return null;
  const current = variables?.[key];
  if (current !== undefined && String(current).trim() === String(option).trim()) return null;
  return { ...(variables || {}), [key]: option };
}

/**
 * The intake question or questions that answer a gate flag.
 *
 * The gate's own name is usually NOT a field. `is_secured` is answered through a
 * question called `loan_is_secured`; writing into `is_secured` writes a key the
 * schema does not have, sanitisation drops it, the gate stays open, and every
 * gated clause reads as overridden. That was error #3.
 *
 * The mapping is not guessed. It is read from the declared semantic facts, whose
 * `established_by` names the fields the fact rests on — the same declaration
 * canonicalFacts resolves against, so the probe and the engine cannot disagree.
 *
 * Returns { fields, measurable, why }. An unmappable gate is NOT MEASURABLE, not
 * respected and not overridden: counting it as respected understates and counting
 * it as overridden inflates, and the probe can support neither.
 */
export function fieldsBehindGate(gateId, facts, schema = {}) {
  const declaration = facts && typeof facts.get === "function"
    ? facts.get(gateId)
    : (facts || {})[gateId];

  if (!declaration) {
    return {
      fields: [],
      measurable: false,
      why: `${gateId} is not a declared semantic fact, so there is no recorded question behind it. ` +
        `Declare it in knowledge-base/intake/semantic_facts.json, or measure a gate that is declared.`,
    };
  }

  const fields = (declaration.established_by || []).filter((field) => field in schema);
  if (!fields.length) {
    return {
      fields: [],
      measurable: false,
      why: `${gateId} is declared, but none of the fields it rests on ` +
        `(${(declaration.established_by || []).join(", ") || "none recorded"}) exist in this ` +
        `document's schema, so the gate cannot be moved by answering anything this form asks.`,
    };
  }
  return { fields, measurable: true };
}
