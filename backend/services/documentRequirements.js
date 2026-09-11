/**
 * documentRequirements.js
 *
 * WHAT MAKES THIS DOCUMENT WHAT IT IS, as distinct from what makes it look like
 * a contract.
 *
 * A generated document can carry definitions, interpretation, notices,
 * confidentiality, representations, a generic indemnity, governing law, dispute
 * resolution, boilerplate and signatures -- and still be a bad document, because
 * the provisions that define the transaction are missing or weak. Boilerplate
 * coverage must never be allowed to create the illusion that document identity
 * or user intent has been satisfied. They are three separate questions:
 *
 *   1. Does it carry the normal legal infrastructure?      (boilerplate)
 *   2. Does it do what this KIND of document must do?      (identity)      <- here
 *   3. Does it address what THIS user needs?               (intent)
 *
 * A REQUIREMENT IS NOT A CLAUSE. It is something the document has to accomplish,
 * and may be met by one clause, by a choice among several, or by a combination.
 * Modelling it as "required_clauses" freezes the answer into the question and
 * ends at "every MSA has exactly these 45 clauses", which is false.
 *
 *   Requirement -> Treatment -> Clause(s)
 *
 * The outcomes mirror the position conservation in positionResolution.js,
 * because the principle is the same: every applicable requirement terminates in
 * a stated outcome, and there is no fifth outcome of "nothing happened".
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { positionOf, POSITION } from "./generationControls.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../../knowledge-base/documents/requirements");

export const COVERAGE = {
  RESOLVED: "RESOLVED",             // a clause satisfies it
  DEFAULTED: "DEFAULTED",           // satisfied by a clause included under a documented default
  UNRESOLVED: "UNRESOLVED",         // applicable, unsatisfied, disclosed
  ESCALATED: "ESCALATED",           // applicable, unsatisfied, and material enough to need a lawyer
  NOT_APPLICABLE: "NOT_APPLICABLE", // its applicability condition is affirmatively not met
  // Nobody knows whether it applies, because the fact its applicability rests on
  // was never established. NOT the same as not applicable, and the distinction
  // is the whole point: a POSH requirement that disappears because nobody was
  // asked the headcount has not been assessed -- it has been skipped, silently,
  // on exactly the reasoning invariant 3 forbids.
  APPLICABILITY_UNKNOWN: "APPLICABILITY_UNKNOWN",
  // The best a FORMALITY requirement can reach. The document provides for the
  // act; whether the act was done is outside it.
  //
  // A tenancy exposed this. A clause reading "the parties shall register this
  // Agreement" does not make the instrument registered, and reporting the
  // requirement RESOLVED because the clause is present would tell a user their
  // lease is complete when section 49 of the Registration Act, 1908 bars it
  // from being received in evidence at all. For content requirements
  // "addressed" and "done" coincide; for formalities they do not, and the
  // assessment must not conflate them.
  PROVIDED_FOR: "PROVIDED_FOR",
  // A TIMING requirement whose window cannot be computed from what the system
  // holds. Not a failure and emphatically not a pass: the system does not know.
  //
  // A section 138 notice forced this. Its legal effect turns almost entirely on
  // WHEN: within thirty days of receipt of the bank's memo, then fifteen days
  // for the drawer to pay, then a month to complain. A flawlessly drafted notice
  // served on day thirty-one is worth nothing. Authored as CONTENT requirements
  // these reported 7 of 7 RESOLVED -- green, for a notice the system had no idea
  // when was sent.
  UNVERIFIABLE: "UNVERIFIABLE",
  // The window was computed and missed. This is a real failure, not a gap.
  OUT_OF_TIME: "OUT_OF_TIME",
  // The document asserts a legal character its own content defeats.
  //
  // An MOU forced this, and it is unlike the first four findings: every one of
  // those concerned the world OUTSIDE the document. This one is internal. A
  // memorandum declaring itself non-binding while carrying confidentiality,
  // dispute resolution, survival and termination is not incomplete, it is
  // incoherent, and under Indian law intention is gathered from the whole
  // instrument rather than from the label on it.
  //
  // It also breaks an assumption the model had held silently until now:
  // satisfaction was MONOTONE in clause presence -- adding a clause could only
  // ever help. Here adding one defeats the requirement.
  CONTRADICTED: "CONTRADICTED",
};

// The second dimension, kept apart from the first on purpose.
//
//   KIND    what sort of thing is being evaluated   (CONTENT/FORMALITY/TIMING/CHARACTER)
//   FINDING what the system managed to establish about it
//
// Without the separation the coverage vocabulary silts up with special cases and
// nobody can say whether a new state is a new kind of legal thing or a new kind
// of knowledge. OUT_OF_TIME is not a weaker UNRESOLVED -- it is a DETERMINED
// NEGATIVE. PROVIDED_FOR is not a weaker RESOLVED -- it is the ceiling for a
// formality. Only ESTABLISHED_POSITIVE is success.
export const FINDING = {
  ESTABLISHED_POSITIVE: "ESTABLISHED_POSITIVE",
  ESTABLISHED_NEGATIVE: "ESTABLISHED_NEGATIVE",
  CEILING_FOR_KIND: "CEILING_FOR_KIND",
  NOT_ESTABLISHED: "NOT_ESTABLISHED",
  WORK_INCOMPLETE: "WORK_INCOMPLETE",
};

const FINDING_OF = {
  RESOLVED: FINDING.ESTABLISHED_POSITIVE,
  DEFAULTED: FINDING.ESTABLISHED_POSITIVE,
  NOT_APPLICABLE: FINDING.ESTABLISHED_NEGATIVE,
  OUT_OF_TIME: FINDING.ESTABLISHED_NEGATIVE,
  CONTRADICTED: FINDING.ESTABLISHED_NEGATIVE,
  PROVIDED_FOR: FINDING.CEILING_FOR_KIND,
  UNVERIFIABLE: FINDING.NOT_ESTABLISHED,
  APPLICABILITY_UNKNOWN: FINDING.NOT_ESTABLISHED,
  UNRESOLVED: FINDING.WORK_INCOMPLETE,
  ESCALATED: FINDING.WORK_INCOMPLETE,
};

export function findingFor(coverage) {
  return FINDING_OF[coverage] || null;
}

let cache = null;

// Every requirement must say what is lost without it. If nobody can complete
// "remove it and ...", the provision is supporting infrastructure rather than
// identity, and it does not belong here. Definitions, notices, severability and
// waiver are all good clauses and none of them is a document requirement.
function admit(doc, source) {
  const problems = [];
  for (const requirement of doc.requirements || []) {
    const id = requirement.id || "?";
    if (!/^[A-Z0-9_]+$/.test(String(id))) problems.push(`${id}: id must be UPPER_SNAKE_CASE`);
    if (String(requirement.statement || "").trim().length < 25) {
      problems.push(`${id}: statement — say what the document must accomplish`);
    }
    if (!/^remove/i.test(String(requirement.identity_test || "").trim())) {
      problems.push(
        `${id}: identity_test must begin "Remove it and ..." and say what legal function is ` +
        `lost. A provision whose absence changes nothing is infrastructure, not identity.`
      );
    }
    const by = requirement.satisfied_by || {};
    if (!(Array.isArray(by.any_of) && by.any_of.length) && !(Array.isArray(by.all_of) && by.all_of.length)) {
      problems.push(`${id}: satisfied_by needs any_of or all_of`);
    }
    if (requirement.kind && !["CONTENT", "FORMALITY", "TIMING", "CHARACTER"].includes(requirement.kind)) {
      problems.push(`${id}: kind must be CONTENT, FORMALITY, TIMING or CHARACTER`);
    }
    if (requirement.kind === "CHARACTER") {
      if (!Array.isArray(requirement.contradicted_by) || !requirement.contradicted_by.length) {
        problems.push(
          `${id}: a CHARACTER requirement must list what defeats it. A declaration about the ` +
          `instrument's own legal character is worth nothing if the content beside it says ` +
          `otherwise, and listing nothing makes it an ordinary content requirement wearing a ` +
          `stronger name.`
        );
      }
      if (!String(requirement.coherence_note || "").trim()) {
        problems.push(`${id}: coherence_note — say why the listed clauses defeat the declaration`);
      }
    }
    if (requirement.kind === "TIMING") {
      if (!String(requirement.window || "").trim()) {
        problems.push(`${id}: a TIMING requirement must state the window in words`);
      }
      if (!String(requirement.depends_on_event || "").trim()) {
        problems.push(
          `${id}: a TIMING requirement must name the external event the clock runs from. ` +
          `Without it the requirement cannot be distinguished from a clause that merely ` +
          `mentions a period.`
        );
      }
    }
    if (requirement.kind === "FORMALITY" && !String(requirement.outside_the_document || "").trim()) {
      problems.push(
        `${id}: a FORMALITY requirement must say what act lies outside the document, so nobody ` +
        `later reads its coverage as proof the act was performed`
      );
    }
    if (!["DISCLOSE", "BLOCK", "ESCALATE"].includes(requirement.when_unsatisfied)) {
      problems.push(`${id}: when_unsatisfied must be DISCLOSE, BLOCK or ESCALATE`);
    }
    if (!requirement.review_status) problems.push(`${id}: review_status`);
  }
  if (problems.length) {
    throw new Error(`Requirements source ${source} is not admissible:\n  - ${problems.join("\n  - ")}`);
  }
  return doc;
}

export function loadDocumentRequirements({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const byType = new Map();
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((n) => n.endsWith(".requirements.json"));
  } catch {
    files = [];
  }
  for (const name of files) {
    const file = path.join(DIR, name);
    const doc = admit(JSON.parse(fs.readFileSync(file, "utf8")), name);
    byType.set(doc.document_type, doc.requirements || []);
  }
  cache = byType;
  return cache;
}

export function clearDocumentRequirementsCache() {
  cache = null;
}

// Three answers, not two. Silence about whether a requirement applies is not an
// answer that it does not.
function applicable(requirement, positions) {
  const rule = requirement.applicability || { always: true };
  if (rule.always) return true;
  if (rule.position) {
    const held = positions?.[rule.position];
    const value = held && typeof held === "object" ? held.value : held;
    const position = positionOf(value);
    if (position === POSITION.UNKNOWN) return null;
    return position === (rule.value === false ? POSITION.FALSE : POSITION.TRUE);
  }
  return true;
}

/**
 * Does this draft do what this kind of document has to do?
 *
 * @param {string} documentType
 * @param {string[]} clauseIds     what the draft actually emitted
 * @param {object} positions       resolved positions, for applicability and provenance
 */
// Can the window be computed from what the system actually holds? Two dates and
// a number of days, or nothing. Deliberately narrow: a timing requirement the
// system cannot check must say so rather than guess.
function assessTiming(requirement, variables) {
  const spec = requirement.computable_from;
  if (!spec) return { coverage: COVERAGE.UNVERIFIABLE };
  const from = Date.parse(variables?.[spec.event]);
  const act = Date.parse(variables?.[spec.act]);
  if (!Number.isFinite(from) || !Number.isFinite(act)) return { coverage: COVERAGE.UNVERIFIABLE };
  const days = Math.round((act - from) / 86400000);
  if (days < 0) {
    return { coverage: COVERAGE.OUT_OF_TIME, elapsed_days: days,
             detail: `${spec.act} precedes ${spec.event}, which cannot be right.` };
  }
  return days <= spec.within_days
    ? { coverage: COVERAGE.RESOLVED, elapsed_days: days }
    : { coverage: COVERAGE.OUT_OF_TIME, elapsed_days: days,
        detail: `${days} days elapsed against a window of ${spec.within_days}.` };
}

export function assessRequirements(documentType, clauseIds = [], positions = {}, variables = {}) {
  const requirements = loadDocumentRequirements().get(documentType);
  if (!requirements) return { documentType, assessed: false, results: [] };

  const present = new Set(clauseIds);
  const results = requirements.map((requirement) => {
    const applies = applicable(requirement, positions);
    if (applies === null) {
      return {
        id: requirement.id,
        coverage: COVERAGE.APPLICABILITY_UNKNOWN,
        statement: requirement.statement,
        identity_test: requirement.identity_test,
        undetermined_by: requirement.applicability.position,
        blocking: requirement.when_unsatisfied === "BLOCK",
      };
    }
    if (!applies) {
      return { id: requirement.id, coverage: COVERAGE.NOT_APPLICABLE, statement: requirement.statement };
    }
    const by = requirement.satisfied_by;
    const needed = by.all_of || by.any_of;
    const met = by.all_of
      ? by.all_of.every((id) => present.has(id))
      : by.any_of.some((id) => present.has(id));
    const satisfyingClauses = needed.filter((id) => present.has(id));

    if (met) {
      // A requirement met only by a clause the draft adopted without being asked
      // is satisfied, but not by anything the user decided.
      const byDefault = satisfyingClauses.some((id) =>
        Object.values(positions).some(
          (p) => p?.provenance === "drafting_default" && p?.clause === id
        )
      );
      if (requirement.kind === "CHARACTER") {
        const defeating = (requirement.contradicted_by || []).filter((id) => present.has(id));
        return defeating.length
          ? { id: requirement.id, kind: requirement.kind, coverage: COVERAGE.CONTRADICTED,
              statement: requirement.statement, satisfied_by: satisfyingClauses,
              contradicted_by: defeating, coherence_note: requirement.coherence_note }
          : { id: requirement.id, kind: requirement.kind, coverage: COVERAGE.RESOLVED,
              statement: requirement.statement, satisfied_by: satisfyingClauses };
      }
      if (requirement.kind === "TIMING") {
        const timing = assessTiming(requirement, variables);
        return {
          id: requirement.id, statement: requirement.statement,
          window: requirement.window, depends_on_event: requirement.depends_on_event,
          satisfied_by: satisfyingClauses, ...timing,
        };
      }
      if (requirement.kind === "FORMALITY") {
        return {
          id: requirement.id,
          coverage: COVERAGE.PROVIDED_FOR,
          statement: requirement.statement,
          satisfied_by: satisfyingClauses,
          outside_the_document: requirement.outside_the_document,
        };
      }
      return {
        id: requirement.id,
        coverage: byDefault ? COVERAGE.DEFAULTED : COVERAGE.RESOLVED,
        statement: requirement.statement,
        satisfied_by: satisfyingClauses,
      };
    }
    return {
      id: requirement.id,
      coverage: requirement.when_unsatisfied === "DISCLOSE" ? COVERAGE.UNRESOLVED : COVERAGE.ESCALATED,
      statement: requirement.statement,
      identity_test: requirement.identity_test,
      would_be_satisfied_by: needed,
      blocking: requirement.when_unsatisfied === "BLOCK",
    };
  });

  // Both dimensions on every result, always.
  for (const result of results) {
    const requirement = requirements.find((r) => r.id === result.id);
    result.kind = result.kind || requirement?.kind || "CONTENT";
    result.finding = findingFor(result.coverage);
  }

  const counted = (kind) => results.filter((r) => r.coverage === kind).length;
  return {
    documentType,
    assessed: true,
    results,
    summary: {
      applicable: results.filter(
        (r) => r.coverage !== COVERAGE.NOT_APPLICABLE && r.coverage !== COVERAGE.APPLICABILITY_UNKNOWN
      ).length,
      undetermined: counted(COVERAGE.APPLICABILITY_UNKNOWN),
      resolved: counted(COVERAGE.RESOLVED) + counted(COVERAGE.DEFAULTED),
      // Counted apart from resolved, always. Folding it in would restore the
      // very conflation this state exists to prevent.
      provided_for: counted(COVERAGE.PROVIDED_FOR),
      unverifiable: counted(COVERAGE.UNVERIFIABLE),
      out_of_time: counted(COVERAGE.OUT_OF_TIME),
      contradicted: counted(COVERAGE.CONTRADICTED),
      unresolved: counted(COVERAGE.UNRESOLVED),
      escalated: counted(COVERAGE.ESCALATED),
      not_applicable: counted(COVERAGE.NOT_APPLICABLE),
    },
  };
}
