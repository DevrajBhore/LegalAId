/**
 * derivationAdapter.js
 *
 * ONE PLACE KNOWS HOW TO ASK WHAT A DOCUMENT DERIVES.
 *
 * Three audit scripts each reconstructed the same call independently, each got
 * the argument order wrong in the same way, and the result was a portfolio
 * report claiming 29 propositions gated clauses with nothing able to establish
 * them. There are 10. That number justified building an abstraction, migrating a
 * live Master Service Agreement requirement onto a different applicability
 * source, and writing a principle about protecting two positions that were never
 * in difficulty.
 *
 * The application was calling it correctly the whole time, so the normal suite
 * stayed green throughout. A wrong measurement of a right system is invisible to
 * the system's own tests.
 *
 * TWO DEFENCES, because the argument order alone was never the real problem:
 *
 *   1. A GUARD, not a convention. deriveControlsForDocument REFUSES a call whose
 *      first argument is not a document type. The swapped call used to return a
 *      small plausible object; now it throws with the fix in the message. A
 *      failure that looks like a finding is worse than a crash.
 *   2. A CANONICAL FIXTURE. Reachability is probed with the schema's own
 *      synthetic intake -- the same builder the recorded baseline uses -- never
 *      with values that seem plausible. Probing lender_type with "Bank" and
 *      "NBFC" found nothing, because the declared option is "Scheduled Bank".
 *
 * Audit and portfolio code must call THIS and never generationControls directly,
 * so the contract exists once. tests/derivationProbes.test.mjs enforces that.
 */
import { deriveGenerationControls } from "./generationControls.js";

const looksLikeDocumentType = (value) =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]*$/.test(value);

/**
 * The only supported way for measurement code to ask what a document derives.
 *
 * @param {string} documentType  UPPER_SNAKE_CASE document type. FIRST.
 * @param {object} variables     the intake values. SECOND.
 */
export function deriveControlsForDocument(documentType, variables = {}) {
  if (!looksLikeDocumentType(documentType)) {
    throw new TypeError(
      `deriveControlsForDocument(documentType, variables): first argument must be an ` +
      `UPPER_SNAKE_CASE document type, received ${typeof documentType === "object" ? "an object" : JSON.stringify(documentType)}. ` +
      `If you passed the variables first, swap them — that mistake once produced a portfolio ` +
      `report claiming 29 propositions had no source, where there are 10, because the reversed ` +
      `call returns a small plausible object rather than failing.`
    );
  }
  if (variables !== null && typeof variables !== "object") {
    throw new TypeError(
      `deriveControlsForDocument(documentType, variables): second argument must be the intake ` +
      `object, received ${JSON.stringify(variables)}.`
    );
  }
  return deriveGenerationControls(documentType, variables || {}) || {};
}

/**
 * Every control a document type can reach, probed with the schema's OWN
 * fixtures at both intake levels.
 *
 * `buildVariables` belongs to the baseline freezer, so a probe built on it
 * measures what the recorded baseline measures. A probe that invents its own
 * fixture is a second source of truth, and it drifts silently.
 *
 * Imported lazily: the freezer pulls in the whole generation stack, and audit
 * scripts that only want deriveControlsForDocument should not pay for it.
 */
let buildVariables = null;
export async function reachableControlsFor(documentType, levels = ["minimal", "full"]) {
  if (!buildVariables) {
    ({ buildVariables } = await import("../../scripts/freezeClauseBaseline.mjs"));
  }
  const reachable = new Set();
  for (const level of levels) {
    let fixture;
    try {
      fixture = buildVariables(documentType, level);
    } catch {
      continue;
    }
    for (const key of Object.keys(deriveControlsForDocument(documentType, fixture))) {
      reachable.add(key);
    }
  }
  return reachable;
}
