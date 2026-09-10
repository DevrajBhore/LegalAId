/**
 * positionResolution.js
 *
 * Phase 5. The integration point: answers in, positions out, and a disclosure
 * for everything that stayed open.
 *
 * TWO INVARIANTS, both enforced by tests/positionConservation.test.mjs.
 *
 * 1. CONSERVATION. Every open position leaves this function with exactly one of
 *    four outcomes -- RESOLVED, DEFAULTED, UNRESOLVED or ESCALATED. There is no
 *    fifth outcome of "nothing happened". A position that silently disappears is
 *    the original defect wearing a new coat: the document takes a position and
 *    nobody can say who took it.
 *
 * 2. PROVENANCE SURVIVES. A resolved position carries how it was reached, and
 *    the distinctions Phase 4 worked to preserve must not be flattened here.
 *    Knowing that a protection was selected is not the same as knowing whether
 *    the user asked for it, whether it followed from a fact they stated, or
 *    whether it rests on an assumption about which side of the table they are on.
 *    A planner that gets cleverer while the document loses that information has
 *    made things worse.
 */
import { loadFactRegistry } from "./factRegistry.js";
import { planGapQuestions } from "./factQuestionPlanner.js";

const registry = loadFactRegistry;

export const OUTCOME = {
  RESOLVED: "RESOLVED",       // an answer or a stated fact settled it
  DEFAULTED: "DEFAULTED",     // no answer; a conservative position adopted and disclosed
  UNRESOLVED: "UNRESOLVED",   // no answer, no safe default; the question stands
  ESCALATED: "ESCALATED",     // outside the known set; needs a human
};

// What kind of thing a disclosure is. Typed in the model rather than worked out
// while rendering, because the three call for different actions from the reader
// and that is a legal distinction, not a presentation one:
//
//   ASSUMED           the draft adopted an assumption   -> verify or correct
//   OPEN_POINT        a material issue is unsettled     -> answer or resolve
//   DRAFTING_DEFAULT  a choice made in the absence of instruction -> accept or override
export const DISCLOSURE_KIND = {
  ASSUMED: "ASSUMED",
  OPEN_POINT: "OPEN_POINT",
  DRAFTING_DEFAULT: "DRAFTING_DEFAULT",
};

export const PROVENANCE = {
  USER_ANSWER: "user_answer",                 // the user answered the question
  DERIVED_FACT: "derived_fact",               // a structured field they filled in settles it
  INFERRED_FACT: "inferred_fact",             // read out of their prose -- advisory
  ASSUMED_COUNTERPARTY: "assumed_counterparty", // rests on which side we took them to be
  DRAFTING_DEFAULT: "drafting_default",       // nobody chose; the draft adopted a position
  ADVOCATE_ASSERTION: "advocate_assertion",   // set by a reviewing advocate
};

/**
 * @param {object}  input
 * @param {string}  input.documentType
 * @param {object}  input.variables  the intake
 * @param {object}  input.answers    factId -> answer label, or [labels] for a multiselect
 */
export function resolvePositions({ documentType, variables = {}, answers = {} }) {
  const { facts, treatments, defaults } = registry();
  const plan = planGapQuestions({ documentType, variables });
  const factsById = new Map(facts.map((f) => [f.id, f]));

  // ── answers -> facts ──────────────────────────────────────────────────────
  const established = new Map(); // factName -> { value, provenance, via }
  const unmatched = [];
  for (const [factId, answer] of Object.entries(answers)) {
    const fact = factsById.get(factId);
    if (!fact) {
      unmatched.push({ answer: factId, why: "no fact question with this id" });
      continue;
    }
    const chosen = (Array.isArray(answer) ? answer : [answer]).map(String);

    // An unticked box on a question the user ANSWERED is a no, not a silence.
    // This is the Phase 1 distinction one level up: a question never put to
    // someone leaves the position open, but a checklist they read and did not
    // tick is an answer. Without this, a user who says the consultant sees
    // commercially sensitive information but not their staff gets told that the
    // question about their staff is still unsettled -- when they just answered
    // it. Only two-valued facts are negated; a fact whose options carry distinct
    // values (ownership: owns / licensed) has no negation to infer.
    // ...but only where at least one selection was READABLE. An answer of
    // "Probably, I think" to a checklist matches no option, and treating it as
    // "read the list and ticked nothing" would negate every fact on it -- five
    // legal facts manufactured out of input the engine could not parse, which is
    // exactly what invariant 4 forbids. The answer-state corpus caught this: the
    // malformed case was recording positions the unanswered case did not.
    const valid = chosen.filter((label) => (fact.options || []).some((o) => o.label === label));
    if (fact.type === "multiselect" && valid.length) {
      const ticked = new Set(valid);
      for (const option of fact.options || []) {
        if (ticked.has(option.label) || option.exclusive) continue;
        for (const [name, value] of Object.entries(option.establishes || {})) {
          if (typeof value !== "boolean") continue;
          established.set(name, { value: !value, provenance: PROVENANCE.USER_ANSWER, via: `${factId} (not selected)` });
        }
      }
    }

    for (const label of chosen) {
      const option = (fact.options || []).find((o) => o.label === label);
      if (!option) {
        unmatched.push({ answer: `${factId}: ${label}`, why: "not one of this question's options" });
        continue;
      }
      for (const [name, value] of Object.entries(option.establishes || {})) {
        established.set(name, { value, provenance: PROVENANCE.USER_ANSWER, via: factId });
      }
    }
  }
  // Facts the intake already settled, which the planner has worked out.
  for (const s of plan.settled) {
    if (established.has(s.factName)) continue;
    established.set(s.factName, {
      value: true,
      provenance: s.provenance === "derived" ? PROVENANCE.DERIVED_FACT : PROVENANCE.INFERRED_FACT,
      via: s.evidence,
    });
  }

  // ── facts -> positions ────────────────────────────────────────────────────
  const positions = {};
  for (const t of treatments) {
    const fact = established.get(t.fact);
    if (!fact || fact.value !== t.value) continue;
    for (const [mechanism, value] of Object.entries(t.positions || {})) {
      positions[mechanism] = {
        value,
        provenance: fact.provenance,
        // Where the answer is party-relative and we guessed which side the user
        // is on, that guess is part of this position's provenance and travels
        // with it. Losing it here would be losing the point of Phase 4.
        restsOnAssumedSide: plan.counterpartyAssumed,
        fact: t.fact,
        via: fact.via,
        basis: t.basis,
      };
    }
  }

  // ── conservation: every open position gets exactly one outcome ────────────
  const outcomes = [];
  const assumptions = [];

  // Conservation runs over BOTH dispositions Phase 3 produces, not just the
  // questions. An earlier version accounted only for the ASK set, so every
  // mechanism the analyser had marked DEFAULT_AND_DISCLOSE fell outside the
  // count -- the draft adopted a position for each of them and disclosed none,
  // which is precisely the outcome this phase exists to prevent. The test
  // caught it: with no answers at all, not one position was recorded as a
  // drafting default.
  const seen = new Set();
  const accountable = [
    ...plan.openMechanisms,
    ...plan.disclosures.map((d) => d.mechanism),
    // Drafting-material positions nobody was asked about. They are dispositioned
    // and therefore accountable: where the knowledge base declares a default for
    // one it is adopted and disclosed, and where it does not the position simply
    // stays open and says so. Either way it no longer vanishes.
    ...plan.advisoryMechanisms.filter((m) => defaults?.[m]),
  ].filter((m) => m && !seen.has(m) && seen.add(m));
  const stillOpen = new Set(accountable);

  for (const mechanism of accountable) {
    const resolved = positions[mechanism];
    if (resolved) {
      outcomes.push({ mechanism, outcome: OUTCOME.RESOLVED, ...resolved });
      stillOpen.delete(mechanism);
      continue;
    }
    const fallback = defaults?.[mechanism];
    if (fallback) {
      positions[mechanism] = {
        value: fallback.position,
        provenance: PROVENANCE.DRAFTING_DEFAULT,
        restsOnAssumedSide: plan.counterpartyAssumed,
        basis: "No position was taken; the draft adopts the conservative one and says so.",
      };
      outcomes.push({ mechanism, outcome: OUTCOME.DEFAULTED, disclosure: fallback.disclosure });
      assumptions.push({
        mechanism,
        text: fallback.disclosure,
        kind: DISCLOSURE_KIND.DRAFTING_DEFAULT,
        provenance: PROVENANCE.DRAFTING_DEFAULT,
      });
      stillOpen.delete(mechanism);
      continue;
    }
    // No answer and no safe default: the question stands, and the document has
    // to say that it does rather than quietly picking a side.
    const question = plan.questions.find((q) => q.resolves.includes(mechanism));
    outcomes.push({
      mechanism,
      outcome: OUTCOME.UNRESOLVED,
      question: question?.question || null,
      stage: question?.stage || null,
    });
    assumptions.push({
      mechanism,
      text: question
        ? `Still to settle — "${question.question}" No provision has been drafted either way, ` +
          `so this agreement is silent on it.`
        : `A point affecting your protection is unsettled and no question exists to resolve it. ` +
          `Have this reviewed before signing.`,
      kind: DISCLOSURE_KIND.OPEN_POINT,
      provenance: null,
      unresolved: true,
      needsQuestion: !question,
    });
    stillOpen.delete(mechanism);
  }

  // The mechanisms the planner could not serve at all -- no fact behind them.
  for (const flag of plan.unserved) {
    outcomes.push({ mechanism: flag, outcome: OUTCOME.ESCALATED, reason: "no fact question can resolve this" });
  }

  // One question that settles three mechanisms is still one question, and a
  // reader must not be shown it three times. Merge on the sentence, keep the
  // list of what each one decides.
  const merged = [];
  const byText = new Map();
  for (const assumption of assumptions) {
    const existing = byText.get(assumption.text);
    if (existing) {
      if (assumption.mechanism) existing.mechanisms.push(assumption.mechanism);
      continue;
    }
    const entry = { ...assumption, mechanisms: assumption.mechanism ? [assumption.mechanism] : [] };
    delete entry.mechanism;
    byText.set(assumption.text, entry);
    merged.push(entry);
  }

  // The assumed side is disclosed whenever the draft rests on one, not only
  // where something was resolved. A document built entirely on defaults is the
  // case where the reader most needs to know which way round it was drafted.
  if (plan.counterpartyAssumed && merged.length) {
    merged.unshift({
      mechanisms: [],
      text:
        `These terms were drafted on the assumption that you are not the ${plan.counterparty} ` +
        `but the other party to this agreement. Nobody was asked, and if it is the wrong way ` +
        `round the protections point at the wrong side of the table.`,
      kind: DISCLOSURE_KIND.ASSUMED,
      provenance: PROVENANCE.ASSUMED_COUNTERPARTY,
    });
  }

  return {
    documentType,
    accountable,
    positions,
    outcomes,
    assumptions: merged,
    unmatched,
    // Cheap to check, and the test that matters.
    conservation: {
      open: accountable.length,
      accounted: outcomes.filter((o) => accountable.includes(o.mechanism)).length,
      leaked: [...stillOpen],
    },
  };
}
