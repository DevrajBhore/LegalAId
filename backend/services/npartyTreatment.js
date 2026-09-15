/**
 * npartyTreatment.js — WHAT DOES THIS CLAUSE MEAN WITH THREE PARTIES?
 *
 * Invariant 60 reduced 23 binary-party clauses to six shapes. Four generalise
 * without anybody choosing anything: a prohibition binding each party equally
 * still binds each of three, and an obligation owed severally to "the other
 * Party" is owed to each other party. Two do not, and they are carried by six
 * clauses whose legal treatment is recorded as UNDECIDED in
 * knowledge-base/governance/nparty-treatments.json.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE:
 *
 *     An engine may generalise language. It may not choose a legal position.
 *
 * "The aggregate liability of either Party shall not exceed X" has three
 * readings at three parties — a ceiling each, one ceiling shared, or a ceiling
 * that binds only between the parties and leaves a stranger's claim untouched.
 * They are identical at two parties and they differ in money at three. Any
 * automatic pluralisation picks one of them, and picking one is deciding a
 * question of law on the user's behalf while presenting it as a rendering
 * detail.
 *
 * So `UNRESOLVED` is a first-class outcome here, exactly as PROVIDED_FOR is in
 * the requirement layer and UNKNOWN is in the position model. A document with
 * three parties and an unauthored apportionment must be able to say the point is
 * open. That is worse for a demo and better for a user.
 *
 * DELIBERATELY ABSENT: any default. There is no `|| "PER_PARTY"` anywhere in
 * this file, and a missing decision does not fall back to the two-party reading
 * — the two-party reading is precisely what cannot be carried forward.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHAPES_FILE = path.resolve(HERE, "../../knowledge-base/governance/nparty-shapes.json");
const TREATMENTS_FILE = path.resolve(HERE, "../../knowledge-base/governance/nparty-treatments.json");

/** Outcomes. UNRESOLVED is a finding, not an error. */
export const TREATMENT = {
  DETERMINED: "DETERMINED",   // the shape generalises without a choice
  UNRESOLVED: "UNRESOLVED",   // a legal decision is required and has not been made
  NOT_APPLICABLE: "NOT_APPLICABLE", // two parties: the binary text is correct as written
};

let cache = null;

function load() {
  if (cache) return cache;
  const shapeOf = new Map();
  const decisionOf = new Map();
  try {
    const shapes = JSON.parse(fs.readFileSync(SHAPES_FILE, "utf8"));
    for (const s of shapes.shapes || []) {
      for (const id of s.clauses || []) shapeOf.set(id, s);
    }
  } catch { /* no shapes authored: everything is unresolved, loudly */ }
  try {
    const treatments = JSON.parse(fs.readFileSync(TREATMENTS_FILE, "utf8"));
    for (const d of treatments.decisions || []) {
      for (const id of d.clauses || []) decisionOf.set(id, d);
    }
  } catch { /* no decisions authored */ }
  cache = { shapeOf, decisionOf };
  return cache;
}

/** Exposed for tests that edit the governance files on disk. */
export function clearTreatmentCache() { cache = null; }

/**
 * How should this clause be treated for a roster of `partyCount` principals?
 *
 * @returns {{outcome: string, clause_id: string, shape: string|null,
 *            decision_id?: string, decision?: string, candidates?: string[],
 *            why: string}}
 */
export function treatmentFor(clauseId, partyCount) {
  const { shapeOf, decisionOf } = load();
  const shape = shapeOf.get(clauseId) || null;

  if (!(partyCount > 2)) {
    return {
      outcome: TREATMENT.NOT_APPLICABLE, clause_id: clauseId,
      shape: shape?.shape || null,
      why: "Two principals. The binary wording says what it has always said, and the " +
           "distinctions that need deciding do not arise.",
    };
  }

  if (!shape) {
    return {
      outcome: TREATMENT.UNRESOLVED, clause_id: clauseId, shape: null,
      why: `${clauseId} carries more than two principals and has not been classified into an ` +
           `N-party shape. An unclassified clause is not thereby safe to pluralise.`,
    };
  }

  if (!shape.decision_required) {
    return {
      outcome: TREATMENT.DETERMINED, clause_id: clauseId, shape: shape.shape,
      generalises: shape.generalises,
      why: `${shape.shape}: ${shape.note}`,
    };
  }

  const decision = decisionOf.get(clauseId);
  /*
   * A shape that requires a decision, with no decision recorded, is UNRESOLVED.
   * There is deliberately no branch that reaches for a candidate treatment —
   * candidates exist so an advocate has something to choose between, not so this
   * function can choose for them.
   */
  return {
    outcome: TREATMENT.UNRESOLVED, clause_id: clauseId, shape: shape.shape,
    decision_id: decision?.decision_id || null,
    decision: decision?.decision || "UNDECIDED",
    candidates: (decision?.candidate_treatments || []).map((c) => c.treatment),
    legal_question: decision?.legal_question || null,
    why: decision
      ? `${shape.shape} requires a legal decision and ${decision.decision_id} is ` +
        `${decision.decision}. ${decision.legal_question}`
      : `${shape.shape} requires a legal decision and none is recorded for ${clauseId}.`,
  };
}

/**
 * Every unresolved treatment in a document, for disclosure to the user.
 *
 * A caller that ignores this is shipping an instrument whose meaning is open on
 * a point the system knows is open, which is the failure mode the whole module
 * exists to prevent.
 */
export function unresolvedTreatments(clauseIds = [], partyCount = 2) {
  return clauseIds
    .map((id) => treatmentFor(id, partyCount))
    .filter((t) => t.outcome === TREATMENT.UNRESOLVED);
}
