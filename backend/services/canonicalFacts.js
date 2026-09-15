/**
 * canonicalFacts.js
 *
 * ONE FACT, ONE RESOLUTION, TWO CONSUMERS.
 *
 * Generation read facts from deriveGenerationControls. Assessment read them from
 * resolution.positions. They are different surfaces, so a requirement
 * conditioned on a derived fact could report APPLICABILITY_UNKNOWN while the
 * same document shipped the clause that fact had gated — nine of nine
 * conditional requirements, across three families. A reader of the assessment
 * saw uncertainty; the generator had already committed to a position.
 *
 *     LEGAL / WORLD UNKNOWN   !=   THE ASSESSOR WAS NOT GIVEN THE FACT
 *
 * This resolves once and hands the same answer to both.
 *
 * WHAT IT IS NOT. It is not a second derivation. There is exactly one
 * implementation of each derived fact and it lives in generationControls; this
 * module CALLS it through the canonical adapter and never reimplements it. A
 * resolver that recomputed `is_secured` its own way would replace one divergence
 * with another and be harder to see.
 *
 * WHAT IT DELIBERATELY DOES NOT EXPOSE. deriveGenerationControls produces 87
 * controls for a Master Service Agreement, most of them plumbing. Exposing all
 * of them would make that function the system's universal semantic model by
 * accident. The semantic surface is declared in
 * knowledge-base/intake/semantic_facts.json and nothing outside it is offered.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deriveControlsForDocument } from "./derivationAdapter.js";
import { getVariables } from "../config/variableConfig.js";
import { positionOf, POSITION } from "./generationControls.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, "../../knowledge-base/intake/semantic_facts.json");

/**
 * Where a value came from. Two facts can hold the same value and mean different
 * things: a user answering "fewer than ten" and a derivation computing it from
 * an answer to another question are not the same evidence, and an assessment
 * that cannot tell them apart cannot explain itself to a lawyer.
 */
export const FACT_PROVENANCE = {
  DECLARED: "declared",     // the user answered this question
  DERIVED: "derived",       // computed from other answers
  UNKNOWN: "unknown",       // nobody established it
};

let cache = null;

function admit(doc) {
  const problems = [];
  for (const fact of doc.facts || []) {
    const id = fact.id || "?";
    if (!/^[a-z0-9_]+$/.test(String(id))) problems.push(`${id}: id must be lower_snake_case`);
    if (String(fact.statement || "").trim().length < 20) {
      problems.push(`${id}: statement — say what this fact is about`);
    }
    if (!["DECLARED", "DERIVED"].includes(fact.kind)) {
      problems.push(`${id}: kind must be DECLARED or DERIVED`);
    }
    if (!Array.isArray(fact.established_by) || !fact.established_by.length) {
      problems.push(
        `${id}: established_by — name the intake field or fields this rests on. Without it the ` +
        `fact's provenance cannot be reported, and a derivation becomes indistinguishable from ` +
        `an answer.`
      );
    }
    // Silence must have a stated consequence, and it may not be "treat as false".
    if (String(fact.when_unknown || "").trim().length < 20) {
      problems.push(`${id}: when_unknown — say what happens when nobody establishes it`);
    }
    if (/\btreat(ed)? as false\b|\bdefault(s)? to false\b/i.test(fact.when_unknown || "")) {
      problems.push(
        `${id}: when_unknown says the fact is treated as false. Absence of information may not ` +
        `become an affirmative position, and that includes a negative one.`
      );
    }
    if (!fact.review_status) problems.push(`${id}: review_status`);
  }
  if (problems.length) {
    throw new Error(`semantic_facts.json is not admissible:\n  - ${problems.join("\n  - ")}`);
  }
  return doc;
}

export function loadSemanticFacts({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  let doc = { facts: [] };
  try {
    doc = admit(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  cache = new Map((doc.facts || []).map((fact) => [fact.id, fact]));
  return cache;
}

export function clearSemanticFactCache() {
  cache = null;
}

/**
 * Resolve every declared semantic fact for one document, once.
 *
 * @param {string} documentType
 * @param {object} variables   the sanitised intake
 * @param {object} positions   resolved positions from the fact-question layer,
 *                             which outrank a derivation where both speak
 * @returns {{facts: object, outcomes: Array}}
 */
export function resolveCanonicalFacts(documentType, variables = {}, positions = {}) {
  const declarations = loadSemanticFacts();
  const schema = getVariables(documentType) || {};

  // ONE derivation, called not copied — and consulted ONLY for DERIVED facts.
  // A DECLARED fact must never reach its value through here: see resolveDeclared.
  let derived = null;
  const derivation = () => {
    if (derived === null) derived = deriveControlsForDocument(documentType, variables || {});
    return derived;
  };

  const facts = {};
  const outcomes = [];
  for (const [id, declaration] of declarations) {
    const resolved = declaration.kind === "DECLARED"
      ? resolveDeclared(id, declaration, variables, schema, positions)
      : resolveDerived(id, declaration, derivation, schema, variables, positions);

    const record = {
      fact: id,
      value: resolved.provenance === FACT_PROVENANCE.UNKNOWN ? undefined : resolved.value,
      provenance: resolved.provenance,
      evidence: resolved.evidence,
      kind: declaration.kind,
      statement: declaration.statement,
      when_unknown: resolved.provenance === FACT_PROVENANCE.UNKNOWN
        ? declaration.when_unknown : undefined,
    };
    outcomes.push(record);
    // Only established facts enter the surface consumers read. An unknown fact
    // is ABSENT, so a predicate over it returns UNKNOWN rather than false.
    if (resolved.provenance !== FACT_PROVENANCE.UNKNOWN) facts[id] = record;
  }

  return {
    facts, outcomes,
    // The canonical value of every established fact, for overlaying onto the
    // variables generation reads. This is what makes "one value before any
    // consumer sees it" true by construction rather than by coincidence.
    values: Object.fromEntries(outcomes
      .filter((o) => o.provenance !== FACT_PROVENANCE.UNKNOWN)
      .map((o) => [o.fact, o.value])),
    summary: {
      declared: declarations.size,
      established: outcomes.filter((o) => o.provenance !== FACT_PROVENANCE.UNKNOWN).length,
      from_an_answer: outcomes.filter((o) => o.provenance === FACT_PROVENANCE.DECLARED).length,
      from_a_derivation: outcomes.filter((o) => o.provenance === FACT_PROVENANCE.DERIVED).length,
      unknown: outcomes.filter((o) => o.provenance === FACT_PROVENANCE.UNKNOWN).length,
    },
  };
}

/**
 * An answer the fact-question layer settled. Outranks everything: that layer
 * exists precisely to let a user settle what a derivation could only guess at.
 */
function answeredPosition(id, positions) {
  const answered = positions?.[id];
  const value = answered && typeof answered === "object" ? answered.value : answered;
  return positionOf(value);
}

/**
 * A DECLARED fact: the user answered the question this fact IS.
 *
 *     raw intake answer -> normalisation -> the fact
 *
 * It does NOT pass through deriveGenerationControls, and that is the whole
 * point of separating the two kinds. Reading a declared fact out of the
 * generation controls made its classification depend on what that pipeline
 * happened to produce, which is the two-fact-plane problem wearing a new coat:
 * the declaration would say DECLARED and the runtime would decide otherwise.
 * The declaration is authoritative; if it is wrong, the declaration is what
 * gets corrected.
 */
function resolveDeclared(id, declaration, variables, schema, positions) {
  const answered = answeredPosition(id, positions);
  if (answered !== POSITION.UNKNOWN) {
    return { value: answered === POSITION.TRUE, provenance: FACT_PROVENANCE.DECLARED, evidence: [id] };
  }

  // The fields the declaration names, and only those. is_secured is answered
  // through a field called loan_is_secured; the fact's own id is not an intake
  // field and reading it would let an undeclared alias in through the back door.
  const answers = declaration.established_by
    .filter((field) => field in schema)
    .map((field) => ({ field, position: positionOf(variables?.[field]) }))
    .filter((entry) => entry.position !== POSITION.UNKNOWN);

  if (!answers.length) return unknownFact();

  // Two fields answering one question differently is not a fact. Reported
  // unknown rather than resolved by precedence: picking the first would make
  // the answer depend on declaration order, which nobody chose as a rule.
  const distinct = new Set(answers.map((a) => a.position));
  if (distinct.size > 1) return unknownFact();

  return {
    value: answers[0].position === POSITION.TRUE,
    provenance: FACT_PROVENANCE.DECLARED,
    evidence: answers.map((a) => a.field),
  };
}

/**
 * A DERIVED fact: computed from answers to other questions.
 *
 *     raw intake answer -> generation-control derivation -> the fact
 *
 * Reported DERIVED even where the value is identical to a declared one and even
 * where the field behind it was answered directly, because an inference
 * reported as the user's own answer puts our reasoning behind their signature.
 */
function resolveDerived(id, declaration, derivation, schema, variables, positions) {
  const answered = answeredPosition(id, positions);
  if (answered !== POSITION.UNKNOWN) {
    return { value: answered === POSITION.TRUE, provenance: FACT_PROVENANCE.DECLARED, evidence: [id] };
  }

  const position = positionOf(derivation()[id]);
  // A value the tri-state cannot express is not a fact. Reported unknown rather
  // than coerced: guessing which way it leans is how "Unsecured" once became a
  // secured loan.
  if (position === POSITION.UNKNOWN) return unknownFact();

  return {
    value: position === POSITION.TRUE,
    provenance: FACT_PROVENANCE.DERIVED,
    evidence: declaration.established_by.filter(
      (field) => field in schema
        && variables?.[field] !== undefined && String(variables[field]).trim() !== ""
    ),
  };
}

function unknownFact() {
  return { value: undefined, provenance: FACT_PROVENANCE.UNKNOWN, evidence: [] };
}

/** The facts a requirement is permitted to rest on. */
export function isSemanticFact(id) {
  return loadSemanticFacts().has(id);
}
