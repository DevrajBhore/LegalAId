/**
 * evidencePropositions.js
 *
 * THE THIRD APPLICABILITY SOURCE.
 *
 * A requirement, or a clause gate, can become applicable for three reasons, and
 * until now the system could express only two:
 *
 *   POSITION   the user told us                      (declared transaction fact)
 *   FACT       the system derived it deterministically
 *   EVIDENCE   something outside the conversation establishes it      <- here
 *
 * The audit that produced this file found 29 propositions the knowledge base had
 * already decided were legally consequential enough to gate a clause on, with
 * nothing in the system able to establish any of them. Every one of those gates
 * reads `== true`, so an unestablished proposition omitted the clause SILENTLY.
 * A service that processes personal data and a service that does not received
 * the same document. That is the defect this module exists to make impossible:
 *
 *     evidence absent  !=  evidence false  !=  requirement inapplicable
 *
 * Three distinctions, collapsed into one before this existed.
 *
 * WHAT THIS IS NOT. It is not "accept arbitrary external evidence". The world
 * model stays closed: a proposition must be DECLARED in a knowledge artifact
 * before any record can establish it, and the declaration says who is allowed to
 * establish it. In particular an AI inference may be PROPOSED and is never
 * ADMITTED, because the alternative to "no evidence" must not be "the model
 * guessed". That would move the defect rather than fix it, and it would be
 * harder to see afterwards.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../../knowledge-base/intake/propositions");

/**
 * What the system managed to learn about the proposition. Deliberately NOT a
 * boolean, and deliberately more than three values: each of these was a
 * distinct false positive somewhere in this codebase's history, and collapsing
 * any two of them re-creates the bug that separated them.
 */
export const EVIDENCE = {
  PRESENT: "EVIDENCE_PRESENT",            // admissible, on-subject, current, unambiguous
  ABSENT: "EVIDENCE_ABSENT",              // nothing was supplied. Says nothing either way.
  MISMATCHED: "EVIDENCE_MISMATCHED",      // supplied, and about a different subject
  INADMISSIBLE: "EVIDENCE_INADMISSIBLE",  // supplied by a source this proposition does not accept
  AMBIGUOUS: "EVIDENCE_AMBIGUOUS",        // supplied, and does not settle the question
  STALE: "EVIDENCE_STALE",                // as at a date too long ago, or carrying no date
  CONFLICTING: "EVIDENCE_CONFLICTING",    // matching records that disagree
};

/**
 * What follows for applicability. Four values, because the fourth is the whole
 * point: a proposition nobody established is UNKNOWN, and a requirement resting
 * on an UNKNOWN has not been shown inapplicable -- it has not been assessed.
 */
export const APPLICABILITY = {
  APPLIES: "APPLIES",
  DOES_NOT_APPLY: "DOES_NOT_APPLY",
  UNKNOWN: "UNKNOWN",
  ESCALATED: "ESCALATED",
};

// An AI proposal is a PROPOSAL. It may be shown to a person and it may seed a
// question; it may never be the authority for an affirmative legal conclusion.
export const NEVER_ADMISSIBLE = new Set(["ai_inference", "model_inference", "llm"]);

const PROVENANCE = [
  "system_observation",      // the running product was measured
  "operator_declaration",    // a human operator of the service stated it
  "third_party_attestation", // an auditor, registrar or regulator
  "public_register",         // a register anyone can check
  "ai_inference",            // declarable, never admissible. Present so a record
                             // carrying it is REFUSED loudly rather than unseen.
];

let cache = null;

function admit(doc, source) {
  const problems = [];
  for (const declaration of doc.propositions || []) {
    const id = declaration.id || "?";
    if (!/^[a-z0-9_]+$/.test(String(id))) problems.push(`${id}: id must be lower_snake_case`);
    if (String(declaration.statement || "").trim().length < 25) {
      problems.push(`${id}: statement — say what is being asserted about the world`);
    }
    // The SHA lesson, generalised. A record exists and a careless implementation
    // reads its existence as satisfaction; naming the binding fields is what
    // stops the articles of a different company from establishing anything.
    if (!Array.isArray(declaration.subject_binding) || !declaration.subject_binding.length) {
      problems.push(
        `${id}: subject_binding — name the fields that prove a record is about THIS subject. ` +
        `Without it, evidence about any party would establish the proposition about every party.`
      );
    }
    const admissible = declaration.admissible_provenance;
    if (!Array.isArray(admissible) || !admissible.length) {
      problems.push(`${id}: admissible_provenance — say who may establish this`);
    } else {
      for (const kind of admissible) {
        if (!PROVENANCE.includes(kind)) problems.push(`${id}: unknown provenance "${kind}"`);
        if (NEVER_ADMISSIBLE.has(kind)) {
          problems.push(
            `${id}: "${kind}" can never be admissible provenance. An inference may be proposed ` +
            `to a person; it may not be the authority for an affirmative legal conclusion. ` +
            `Admitting it would replace "no evidence" with "the model guessed", which is the ` +
            `same defect wearing a better report.`
          );
        }
      }
    }
    if (!["ESCALATE", "DISCLOSE"].includes(declaration.when_unknown)) {
      problems.push(
        `${id}: when_unknown must be ESCALATE or DISCLOSE. There is no third option in which ` +
        `nothing happens, and "treat as false" is not an option at all.`
      );
    }
    // A proposition about a state that can change must say how long evidence of
    // it speaks for. The POA lesson: seven-year-old evidence of a continuing
    // state was reported as success.
    if (declaration.continuing && !Number.isFinite(declaration.evidence_valid_for_days)) {
      problems.push(
        `${id}: a continuing proposition must state evidence_valid_for_days. A state that held ` +
        `once is not a state that holds now.`
      );
    }
    if (!declaration.review_status) problems.push(`${id}: review_status`);
  }
  if (problems.length) {
    throw new Error(`Propositions source ${source} is not admissible:\n  - ${problems.join("\n  - ")}`);
  }
  return doc;
}

export function loadPropositions({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const byId = new Map();
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((n) => n.endsWith(".propositions.json"));
  } catch {
    files = [];
  }
  for (const name of files) {
    const doc = admit(JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")), name);
    for (const declaration of doc.propositions || []) byId.set(declaration.id, declaration);
  }
  cache = byId;
  return cache;
}

export function clearPropositionCache() {
  cache = null;
}

const normalise = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Establish one proposition from the records supplied, or say precisely why it
 * could not be established. Never returns false for want of evidence.
 */
export function establish(propositionId, records = [], variables = {}, now = Date.now()) {
  const declaration = loadPropositions().get(propositionId);
  if (!declaration) {
    return {
      proposition: propositionId, evidence: EVIDENCE.ABSENT,
      applicability: APPLICABILITY.UNKNOWN, declared: false,
      detail: `"${propositionId}" is not a declared proposition. Nothing can establish it, and ` +
              `the gate that rests on it can never fire on evidence.`,
    };
  }
  const unknown = (evidence, detail, extra = {}) => ({
    proposition: propositionId, evidence, declared: true,
    applicability: declaration.when_unknown === "ESCALATE"
      ? APPLICABILITY.ESCALATED : APPLICABILITY.UNKNOWN,
    when_unknown: declaration.when_unknown, statement: declaration.statement, detail, ...extra,
  });

  const forThis = (records || []).filter((r) => r?.proposition === propositionId);
  if (!forThis.length) {
    return unknown(
      EVIDENCE.ABSENT,
      `Nothing was supplied about "${declaration.statement}". Its absence is not a finding that ` +
      `the proposition is false.`
    );
  }

  // Subject binding before anything else. A record existing is not evidence.
  const onSubject = forThis.filter((record) =>
    declaration.subject_binding.every((field) => {
      const theirs = normalise(record?.subject?.[field]);
      const ours = normalise(variables?.[field]);
      return theirs && ours && theirs === ours;
    })
  );
  if (!onSubject.length) {
    return unknown(
      EVIDENCE.MISMATCHED,
      `Evidence was supplied but is about a different subject (binding on ` +
      `${declaration.subject_binding.join(", ")}). Evidence about another party establishes ` +
      `nothing about this one.`
    );
  }

  // Provenance, in TWO separate defences, because they fail for different
  // reasons and one of them must not be able to hide behind the other.
  //
  // The first is absolute and belongs to no declaration: an inference is a
  // proposal and can never be the authority for an affirmative legal
  // conclusion, whatever any artifact says. It is checked HERE, at the point of
  // use, and not only at the admission gate -- a gate that refuses to declare it
  // is the right first line, but a record reaching this function is the last
  // one, and the whole layer is worthless if "no evidence" can become "the
  // model guessed" through any route at all.
  const proposed = onSubject.filter((r) => NEVER_ADMISSIBLE.has(r?.provenance));
  if (proposed.length && proposed.length === onSubject.length) {
    return unknown(
      EVIDENCE.INADMISSIBLE,
      `The only evidence supplied is an inference (${[...new Set(proposed.map((r) => r.provenance))]
        .join(", ")}). An inference may be PROPOSED to a person and may seed a question; it can ` +
      `never establish a legal proposition. Replacing "nobody established this" with "a model ` +
      `concluded it" is the same defect wearing a better report.`,
      { offered_provenance: [...new Set(proposed.map((r) => r.provenance))], inference_only: true }
    );
  }

  // The second is the declaration's own: who does THIS proposition accept.
  const admissible = onSubject.filter((r) =>
    declaration.admissible_provenance.includes(r?.provenance) &&
    !NEVER_ADMISSIBLE.has(r?.provenance)
  );
  if (!admissible.length) {
    const offered = [...new Set(onSubject.map((r) => r?.provenance || "unstated"))];
    return unknown(
      EVIDENCE.INADMISSIBLE,
      `Evidence was supplied by ${offered.join(", ")}, and this proposition is established only ` +
      `by ${declaration.admissible_provenance.join(", ")}.`,
      { offered_provenance: offered }
    );
  }

  const states = [...new Set(admissible.map((r) => normalise(r.state)))];
  if (states.length > 1) {
    return unknown(
      EVIDENCE.CONFLICTING,
      `Admissible records disagree (${states.join(" and ")}). Which is right is a question for a ` +
      `person, not for whichever arrived first.`,
      { states }
    );
  }
  const [state] = states;
  if (state !== "true" && state !== "false") {
    return unknown(
      EVIDENCE.AMBIGUOUS,
      `The evidence does not settle the question (state "${state || "unstated"}").`
    );
  }

  // A continuing state is only ever evidenced AS AT a date.
  if (declaration.continuing) {
    const window = declaration.evidence_valid_for_days;
    const asOf = Date.parse(admissible[0].as_of);
    if (!Number.isFinite(asOf)) {
      return unknown(
        EVIDENCE.STALE,
        `The evidence carries no date, and "${declaration.statement}" is a state that can change. ` +
        `Undated evidence of a continuing state cannot speak for now.`
      );
    }
    const ageDays = Math.round((now - asOf) / 86400000);
    if (ageDays > window) {
      return unknown(
        EVIDENCE.STALE,
        `The evidence speaks as at ${admissible[0].as_of}, ${ageDays} days ago, against a ` +
        `validity window of ${window} days.`,
        { age_days: ageDays }
      );
    }
  }

  return {
    proposition: propositionId, declared: true, evidence: EVIDENCE.PRESENT,
    value: state === "true",
    applicability: state === "true" ? APPLICABILITY.APPLIES : APPLICABILITY.DOES_NOT_APPLY,
    statement: declaration.statement,
    provenance: admissible[0].provenance,
    authority: admissible[0].authority,
    as_of: admissible[0].as_of,
    detail: `Established ${state.toUpperCase()} on ${admissible[0].provenance}` +
            `${admissible[0].authority ? ` (${admissible[0].authority})` : ""}.`,
  };
}

/**
 * Every declared proposition a document might rest on, resolved at once, with
 * the conservation rule this codebase applies everywhere else: each one
 * terminates in a stated outcome and there is no fifth result of nothing having
 * happened.
 *
 * Returns { flags, outcomes } -- flags carries ONLY the propositions actually
 * established, so an unestablished proposition leaves its gate UNKNOWN rather
 * than false, and `outcomes` records why for every one that was asked about.
 */
export function resolveEvidence(propositionIds = [], records = [], variables = {}, now = Date.now()) {
  const flags = {};
  const outcomes = [];
  for (const id of [...new Set(propositionIds)]) {
    const result = establish(id, records, variables, now);
    outcomes.push(result);
    if (result.evidence === EVIDENCE.PRESENT) flags[id] = result.value;
  }
  return {
    flags, outcomes,
    summary: {
      asked: outcomes.length,
      established_true: outcomes.filter((o) => o.value === true).length,
      established_false: outcomes.filter((o) => o.value === false).length,
      unknown: outcomes.filter((o) => o.applicability === APPLICABILITY.UNKNOWN).length,
      escalated: outcomes.filter((o) => o.applicability === APPLICABILITY.ESCALATED).length,
      undeclared: outcomes.filter((o) => !o.declared).length,
    },
  };
}
