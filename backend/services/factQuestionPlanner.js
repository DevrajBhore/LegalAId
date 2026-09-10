/**
 * factQuestionPlanner.js
 *
 * Phase 4. Turns open mechanisms into the smallest set of factual questions
 * capable of resolving them -- or into no questions at all.
 *
 * An open mechanism is EVIDENCE THAT SOME FACT IS UNRESOLVED. It is not itself
 * an interview topic, and it never becomes one directly. The sequence, in order,
 * and a mechanism that stops at any stage never reaches the user:
 *
 *   open mechanism
 *      -> which fact would determine its treatment?
 *      -> is that fact ALREADY ESTABLISHED by the intake?   -> derive, don't ask
 *      -> is the mechanism material?                        -> no: leave open
 *      -> is there a conservative default?                  -> yes: default + disclose
 *      -> ask the fact question
 *
 * The third stage is the one that keeps this honest. An engagement described as
 * "monthly strategy reports and quarterly workshops" has already answered the
 * reporting question in prose; putting it to the user again is the clause
 * checklist returning in better clothes.
 *
 * PROVENANCE. A fact established from a structured field the user filled in is
 * DERIVED and authoritative. A fact read out of free text is INFERRED and, per
 * the frozen concept layer, advisory. The line drawn here: an inferred fact is
 * acted on where the mechanism is only drafting-material, and is put to the user
 * for confirmation where it is legally material. Prose is good enough to decide
 * a reporting rhythm; it is not good enough to decide that the DPDP Act applies.
 */
import { loadFactRegistry } from "./factRegistry.js";
import { analyseOpenPositions, CLASSIFICATION } from "./materialityAnalysis.js";
import { getPartyNamingLabels } from "./draftingPolicy.js";

const registry = loadFactRegistry;

export const PROVENANCE = {
  DECLARED: "declared",   // the user answered this question
  DERIVED: "derived",     // a structured field the user filled in settles it
  INFERRED: "inferred",   // read out of free text -- advisory, not authoritative
};

// Which facts bear on a mechanism, read off the treatments table so a new
// treatment is planned for without anyone registering it here.
function factsForMechanism() {
  const index = new Map();
  for (const t of registry().treatments) {
    for (const mechanism of Object.keys(t.positions || {})) {
      if (!index.has(mechanism)) index.set(mechanism, new Set());
      index.get(mechanism).add(t.fact);
    }
  }
  return index;
}

// Which QUESTION establishes a given fact. A question and a fact are not the
// same thing and must not be indexed as if they were: one multiselect -- what
// will the consultant have access to -- establishes four separate facts, and
// keying the plan by fact name loses exactly the collapse the question exists
// for. An earlier version looked facts up in the question list by id, found
// nothing for PERSONAL_DATA_ACCESS or RELATIONSHIP_ACCESS, and silently dropped
// both mechanisms from the plan.
function questionEstablishingFact() {
  const index = new Map();
  for (const fact of registry().facts) {
    for (const option of fact.options || []) {
      for (const name of Object.keys(option.establishes || {})) {
        if (!index.has(name)) index.set(name, fact.id);
      }
    }
  }
  return index;
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

/**
 * Is this fact already settled by what the user has given us?
 * Returns null when it is not, or { provenance, evidence } when it is.
 */
function alreadyEstablished(fact, variables) {
  const spec = fact.established_by;
  if (!spec) return null;

  for (const field of spec.fields || []) {
    if (hasText(variables?.[field])) {
      return { provenance: PROVENANCE.DERIVED, evidence: `the "${field}" field was filled in` };
    }
  }
  if (spec.text_pattern) {
    const pattern = new RegExp(spec.text_pattern, "i");
    for (const field of spec.text_fields || []) {
      const value = String(variables?.[field] ?? "");
      const hit = value.match(pattern);
      if (hit) {
        return {
          provenance: PROVENANCE.INFERRED,
          evidence: `"${field}" says "${hit[0]}"`,
        };
      }
    }
  }
  return null;
}

// Questions are authored with a {counterparty} token so one fact record serves
// every document type, and the token resolves against the side the user says
// they are on.
//
// Getting this wrong is not cosmetic. The planner used to assume the user was
// the first party named, so a vendor agreement asked what "the Buyer" would
// have access to -- when the user is nearly always the buyer, asking about the
// vendor. Every protection the answer selects would have been drafted for the
// wrong side of the table. Where the user has not said, the first party is
// still the assumption, but it is now a stated one that a question can correct.
function counterpartyOf(documentType, variables) {
  const labels = getPartyNamingLabels(documentType);
  if (!labels) return { name: "the other party", assumed: true };
  const side = String(variables?.drafting_for || "").trim().toLowerCase();
  if (side && side === String(labels.second).toLowerCase()) {
    return { name: labels.first, assumed: false };
  }
  return { name: labels.second, assumed: !side };
}

function phrase(text, counterparty) {
  const name = counterparty.name;
  const withArticle = name.toLowerCase().startsWith("the ") ? name : `the ${name}`;
  return String(text || "").replace(/\{counterparty\}/g, withArticle);
}

export function planGapQuestions({ documentType, variables = {} }) {
  const { facts } = registry();
  const analysis = analyseOpenPositions({ documentType, variables });
  const counterparty = counterpartyOf(documentType, variables);
  const factIndex = factsForMechanism();
  const establishedBy = questionEstablishingFact();
  const factsById = new Map(facts.map((f) => [f.id, f]));

  // Only mechanisms Phase 3 says are worth resolving reach this stage at all.
  const open = analysis.positions.filter((p) => p.disposition === "ASK");
  const defaulted = analysis.positions.filter((p) => p.disposition === "DEFAULT_AND_DISCLOSE");

  const askedFacts = new Map();   // factId -> mechanisms it would resolve
  const settled = [];             // facts the intake already answers
  const unserved = [];            // open mechanisms with no fact behind them

  for (const position of open) {
    const candidates = [...(factIndex.get(position.flag) || [])];
    if (!candidates.length) {
      unserved.push(position.flag);
      continue;
    }
    for (const factName of candidates) {
      const factId = establishedBy.get(factName) || factName;
      const fact = factsById.get(factId);
      if (!fact) {
        unserved.push(`${position.flag} (needs ${factName}, which no question establishes)`);
        continue;
      }
      const established = alreadyEstablished(fact, variables);
      // An inferred fact is acted on where only the mechanics turn on it, and
      // confirmed where the law does.
      const actOnInference = position.classification !== CLASSIFICATION.LEGALLY_MATERIAL;
      if (established && (established.provenance === PROVENANCE.DERIVED || actOnInference)) {
        settled.push({ fact: factId, factName, mechanism: position.flag, ...established });
        continue;
      }
      if (!askedFacts.has(factId)) askedFacts.set(factId, { fact, resolves: new Set(), confirms: null });
      askedFacts.get(factId).resolves.add(position.flag);
      if (established) askedFacts.get(factId).confirms = established;
    }
  }

  // A follow-up is only reachable once the fact it depends on is established,
  // so it is planned but not counted among the questions asked now.
  const questions = [...askedFacts.values()]
    .map(({ fact, resolves, confirms }) => ({
      id: fact.id,
      question: phrase(fact.question, counterparty),
      why: fact.why,
      type: fact.type,
      options: (fact.options || []).map((o) => o.label),
      resolves: [...resolves].sort(),
      // A question shown pre-answered because the prose suggested it, awaiting
      // confirmation before the treatment attaches.
      confirming: confirms ? { provenance: confirms.provenance, evidence: confirms.evidence } : null,
      requires: fact.requires || null,
      // Shown immediately, or only after its precondition is answered.
      stage: fact.requires ? "follow-up" : "opening",
    }))
    // Ask the question that settles the most first, and keep follow-ups after
    // the fact they depend on.
    .sort((a, b) => (a.requires ? 1 : 0) - (b.requires ? 1 : 0) || b.resolves.length - a.resolves.length);

  // A drafting-material position that nobody asked about is still a position
  // the document takes. `ASK_IF_NEEDED` was a third disposition that reached
  // neither the questions nor the disclosures: include_entire_agreement sits in
  // this state across twenty-two families, silently excluded because nothing
  // set it. Surfacing them here lets resolution account for them against the
  // declared defaults instead of leaving them to fall off the edge.
  const advisory = analysis.positions.filter((p) => p.disposition === "ASK_IF_NEEDED");

  const disclosures = defaulted
    .map((p) => {
      const spec = registry().defaults?.[p.flag];
      return spec ? { mechanism: p.flag, position: spec.position, disclosure: spec.disclosure } : null;
    })
    .filter(Boolean);

  return {
    documentType,
    // Named so a caller can show the user which side these questions assume,
    // and so an assumed side never passes silently for a stated one.
    counterparty: counterparty.name,
    counterpartyAssumed: counterparty.assumed,
    openMechanisms: open.map((p) => p.flag),
    advisoryMechanisms: advisory.map((p) => p.flag),
    questions,
    settled,
    disclosures,
    unserved,
  };
}

export { CLASSIFICATION };
