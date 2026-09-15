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
  // Something was supplied as evidence and it is not about this transaction --
  // the articles of a different company, a board resolution of another board.
  // Emphatically NOT the same as nothing being supplied, and the more dangerous
  // of the two, because a file exists and a careless implementation reads its
  // presence as satisfaction.
  EVIDENCE_MISMATCHED: "EVIDENCE_MISMATCHED",
  // The right instrument, and it does not answer the question. Silence in the
  // articles is not permission.
  AMBIGUOUS_EVIDENCE: "AMBIGUOUS_EVIDENCE",
  // Evidence of a CONTINUING state, as at a date too long ago to speak for now
  // -- or carrying no date at all. A state that held seven years ago may not
  // hold today, and the model had no temporal dimension at all: it reported
  // seven-year-old evidence as success. Which states are continuing, and how
  // long evidence of one speaks for, are authored in the requirement; the rule
  // that undated evidence of a continuing state establishes nothing is not.
  STALE_EVIDENCE: "STALE_EVIDENCE",
  // Matching records that disagree. Taking the first was resolving a legal
  // question by order of arrival, which is the least defensible route to a
  // positive finding this system has yet taken.
  CONFLICTING_EVIDENCE: "CONFLICTING_EVIDENCE",
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
  EVIDENCE_MISMATCHED: FINDING.NOT_ESTABLISHED,
  AMBIGUOUS_EVIDENCE: FINDING.NOT_ESTABLISHED,
  STALE_EVIDENCE: FINDING.NOT_ESTABLISHED,
  CONFLICTING_EVIDENCE: FINDING.NOT_ESTABLISHED,
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
    const KINDS = ["CONTENT", "FORMALITY", "TIMING", "CHARACTER", "EXTERNAL_COHERENCE"];
    if (requirement.kind && !KINDS.includes(requirement.kind)) {
      problems.push(`${id}: kind must be one of ${KINDS.join(", ")}`);
    }
    if (requirement.kind === "EXTERNAL_COHERENCE") {
      for (const field of ["external_instrument", "external_provision", "requires"]) {
        if (!String(requirement[field] || "").trim()) problems.push(`${id}: ${field}`);
      }
      if (!Array.isArray(requirement.subject_binding) || !requirement.subject_binding.length) {
        problems.push(
          `${id}: subject_binding — name the fields that prove the instrument supplied is about ` +
          `THIS transaction. Without it the articles of any company would satisfy the requirement.`
        );
      }
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
  for (const relationship of doc.relationships || []) {
    const id = relationship.id || "?";
    if (!/^[A-Z0-9_]+$/.test(String(id))) problems.push(`${id}: id must be UPPER_SNAKE_CASE`);
    if (!Array.isArray(relationship.between) || relationship.between.length < 2) {
      problems.push(
        `${id}: between — name at least two clauses. A relationship within a single clause is ` +
        `that clause's own drafting, and this mechanism exists for what falls BETWEEN clauses ` +
        `each of which reads correctly on its own.`
      );
    }
    if (String(relationship.must_agree_on || "").trim().length < 25) {
      problems.push(
        `${id}: must_agree_on — say what question the named clauses must give the same answer to`
      );
    }
    if (!/^remove/i.test(String(relationship.identity_test || "").trim())) {
      problems.push(`${id}: identity_test must begin "Remove it and ..."`);
    }
    // The extract is the evidence instrument, and it must CAPTURE, not merely
    // match. A relationship checked by a regex with no capture group asks only
    // whether both clauses mention the subject -- which is presence again, and
    // presence agreeing with presence is the exact false green this mechanism
    // was built to catch.
    const extract = String(relationship.extract || "");
    if (!extract.trim()) {
      problems.push(`${id}: extract — the regex that reads each clause's answer out of its own text`);
    } else {
      try {
        new RegExp(extract, "gi");
        const unescaped = extract.replace(/\\./g, "");
        if (!/\((?!\?)/.test(unescaped)) {
          problems.push(`${id}: extract must contain a capturing group; presence is not agreement`);
        }
      } catch (error) {
        problems.push(`${id}: extract does not compile — ${error.message}`);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(COVERAGE, String(relationship.when_broken))) {
      problems.push(`${id}: when_broken must be one of ${Object.keys(COVERAGE).join(", ")}`);
    }
    if (!relationship.review_status) problems.push(`${id}: review_status`);
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
    // A PROBE MAY NOT SHADOW PRODUCTION KNOWLEDGE.
    //
    // This map is keyed by document_type and the last file read wins, so a
    // temporary fixture written under a real family's type silently REPLACES
    // that family's authored requirements — and the test that wrote it then
    // measures its own fixture and reports the answer as a property of the
    // product. That happened four times here. The worst of them stayed
    // invisible for several turns because the family it shadowed had no
    // requirements yet, and surfaced only when the family acquired some.
    //
    // Enforced at the loader rather than by convention, because "remember to
    // use a probe type" is exactly the kind of rule that holds until someone is
    // in a hurry. A file named __*.json must declare a __* document type.
    if (name.startsWith("__") && !String(doc.document_type).startsWith("__")) {
      throw new Error(
        `Probe artifact ${name} declares document_type "${doc.document_type}", which is a real ` +
        `document family. A probe fixture must use a "__"-prefixed document_type: keyed by ` +
        `document_type, this file would replace that family's authored requirements for as long ` +
        `as it exists, and the probe would then be measuring itself.`
      );
    }
    const requirements = doc.requirements || [];
    // Carried on the array rather than in a parallel map so that no call site can
    // load the requirements of a family and silently miss its relationships.
    Object.defineProperty(requirements, "relationships", {
      value: Object.freeze(doc.relationships || []), enumerable: false,
    });
    byType.set(doc.document_type, requirements);
  }
  cache = byType;
  return cache;
}

export function clearDocumentRequirementsCache() {
  cache = null;
}

// Three answers, not two. Silence about whether a requirement applies is not an
// answer that it does not.
function applicable(requirement, positions, evidenceOutcomes = []) {
  const rule = requirement.applicability || { always: true };
  if (rule.always) return true;
  // THE THIRD SOURCE. A requirement may apply because the user said so
  // (position), because the system derived it (fact), or because something
  // outside the conversation established it (evidence). The third was missing,
  // and its absence is what made "nobody established this" indistinguishable
  // from "this does not apply".
  //
  // Note what is NOT done here: the evidence is not re-judged. establish() has
  // already decided, under the proposition's own admission rules, whether the
  // records reach the bar. This reads its verdict and nothing more, so the
  // admission rules cannot be quietly relaxed by a caller.
  if (rule.evidence) {
    const outcome = (evidenceOutcomes || []).find((o) => o.proposition === rule.evidence);
    if (!outcome || outcome.value === undefined) return null;
    return outcome.value === (rule.value === false ? false : true);
  }
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
// Calendar months, not thirty-day approximations. "Three months" and "ninety
// days" are different periods and a statute that says one does not mean the
// other; a cheque presented on the ninety-second day may be perfectly in time.
// The end-of-month clamp is the usual one: 31 January plus one month is 28 or
// 29 February, not 3 March.
function addMonths(ms, months) {
  const start = new Date(ms);
  const end = new Date(ms);
  end.setUTCMonth(end.getUTCMonth() + months);
  if (end.getUTCDate() !== start.getUTCDate()) end.setUTCDate(0);
  return end.getTime();
}

function assessTiming(requirement, variables) {
  const spec = requirement.computable_from;
  if (!spec) return { coverage: COVERAGE.UNVERIFIABLE };
  const act = Date.parse(variables?.[spec.act]);
  const from = Date.parse(variables?.[spec.event]);

  // THE LEGAL TRIGGER IS NOT THE FIELD THAT STANDS IN FOR IT.
  //
  // Proviso (b) to section 138 runs thirty days from the drawer's RECEIPT of
  // the bank's memo. The intake collects the memo's DATE, which is a different
  // event and usually an earlier one. Computing from the proxy and reporting
  // RESOLVED tells a payee their notice is in time on the strength of an
  // assumption nobody made out loud — and where the notice went out on day
  // twenty-nine, a two-day postal delay is the whole case.
  //
  // So a proxy can never produce a positive finding. It produces UNVERIFIABLE
  // with the assumption named and the answer it WOULD have given, which is the
  // same rule the tenancy established for formal acts: the document provides
  // for the thing, and whether the thing happened is outside it.
  const usingProxy = !Number.isFinite(from) && spec.event_proxy
    && Number.isFinite(Date.parse(variables?.[spec.event_proxy.field]));

  if (!Number.isFinite(act) || (!Number.isFinite(from) && !usingProxy)) {
    return {
      coverage: COVERAGE.UNVERIFIABLE,
      detail: `The window runs from ${spec.event}${spec.event_proxy ? "" : ""} to ${spec.act}, ` +
              `and the system does not hold ${[
                Number.isFinite(from) ? null : spec.event,
                Number.isFinite(act) ? null : spec.act,
              ].filter(Boolean).join(" or ")}.`,
    };
  }

  const base = Number.isFinite(from) ? from : Date.parse(variables[spec.event_proxy.field]);
  const deadline = Number.isFinite(spec.within_months)
    ? addMonths(base, spec.within_months)
    : base + spec.within_days * 86400000;
  const days = Math.round((act - base) / 86400000);
  const window = Number.isFinite(spec.within_months)
    ? `${spec.within_months} calendar month${spec.within_months === 1 ? "" : "s"}`
    : `${spec.within_days} days`;

  // Contradictory, not late. An act dated before the event it answers is not a
  // missed deadline; it is two dates that cannot both be right, and calling it
  // OUT_OF_TIME would report a determinate legal failure on incoherent input.
  if (days < 0) {
    return {
      coverage: COVERAGE.CONTRADICTED, elapsed_days: days, window,
      detail: `${spec.act} (${variables[spec.act]}) precedes ${spec.event} ` +
              `(${variables[spec.event] ?? variables[spec.event_proxy?.field]}). These cannot ` +
              `both be right, and which is wrong is not something to guess.`,
    };
  }

  if (usingProxy) {
    return {
      coverage: COVERAGE.UNVERIFIABLE, elapsed_days: days, window,
      computed_from_proxy: spec.event_proxy.field,
      assumption: spec.event_proxy.assumption,
      detail: `${spec.event} was not supplied. Computed from ${spec.event_proxy.field} it would ` +
              `be ${days <= Math.round((deadline - base) / 86400000) ? "in time" : "out of time"} ` +
              `(${days} days against ${window}) — but that assumes ${spec.event_proxy.assumption}, ` +
              `and the statute runs from ${spec.event}.`,
    };
  }

  return act <= deadline
    ? { coverage: COVERAGE.RESOLVED, elapsed_days: days, window }
    : { coverage: COVERAGE.OUT_OF_TIME, elapsed_days: days, window,
        detail: `${days} days elapsed against a window of ${window}.` };
}

/**
 * Coherence with an instrument the system has not written and may not hold.
 *
 * A shareholders' agreement is unenforceable against the company to the extent
 * it conflicts with the articles of association -- a document LegalAId has never
 * seen. This is not a CHARACTER requirement: internal contradiction is read off
 * the artifact, and this cannot be read off the artifact at all. It is a
 * question about EVIDENCE, and the states below are the honest answers to it.
 *
 * ABSENCE OF THE ARTICLES IS NOT EVIDENCE OF CONSISTENCY. That sentence is the
 * whole point of the pattern, and the reason "no instrument supplied" and
 * "instrument supplied and consistent" must never share an outcome.
 *
 * Deliberately reusable: trust deeds, board resolutions, partnership deeds,
 * constitutional documents and powers of attorney all pose the same question,
 * and none of them should acquire bespoke logic of its own.
 */
function assessExternal(requirement, variables, instruments) {
  const supplied = (instruments || []).filter(
    (record) => record?.instrument === requirement.external_instrument
  );
  if (!supplied.length) {
    return {
      coverage: COVERAGE.UNVERIFIABLE,
      external_instrument: requirement.external_instrument,
      detail: `No ${requirement.external_instrument} was supplied. Its absence says nothing ` +
              `about whether this Agreement is consistent with it.`,
    };
  }

  // Is what was supplied about THIS transaction? A file existing is not evidence.
  const matches = supplied.filter((record) =>
    requirement.subject_binding.every((field) => {
      const theirs = String(record?.subject?.[field] ?? "").trim().toLowerCase();
      const ours = String(variables?.[field] ?? "").trim().toLowerCase();
      return theirs && ours && theirs === ours;
    })
  );
  if (!matches.length) {
    return {
      coverage: COVERAGE.EVIDENCE_MISMATCHED,
      external_instrument: requirement.external_instrument,
      detail: `A ${requirement.external_instrument} was supplied but does not match this ` +
              `transaction on ${requirement.subject_binding.join(", ")}.`,
    };
  }

  // Records that disagree are never resolved by order of arrival.
  const stated = matches
    .map((record) => record.provisions?.[requirement.external_provision])
    .filter(Boolean);
  const distinct = [...new Set(stated)];
  if (distinct.length > 1) {
    return {
      coverage: COVERAGE.CONFLICTING_EVIDENCE,
      external_instrument: requirement.external_instrument,
      detail: `Records of ${requirement.external_instrument} disagree about ` +
              `"${requirement.external_provision}": ${distinct.join(" and ")}. Which is right is ` +
              `a question for a person, not for whichever arrived first.`,
    };
  }

  // A continuing state is only ever evidenced AS AT a date. Where the
  // requirement says how long such evidence speaks for, undated or expired
  // evidence establishes nothing.
  const window = requirement.evidence_valid_for_days;
  if (Number.isFinite(window)) {
    const asOf = Date.parse(matches[0].as_of);
    if (!Number.isFinite(asOf)) {
      return {
        coverage: COVERAGE.STALE_EVIDENCE,
        external_instrument: requirement.external_instrument,
        detail: `The ${requirement.external_instrument} carries no date. A continuing state ` +
                `can only be evidenced as at a moment, and undated evidence cannot speak for now.`,
      };
    }
    const ageDays = Math.round((Date.now() - asOf) / 86400000);
    if (ageDays > window) {
      return {
        coverage: COVERAGE.STALE_EVIDENCE, external_instrument: requirement.external_instrument,
        age_days: ageDays,
        detail: `The ${requirement.external_instrument} speaks as at ${matches[0].as_of}, ` +
                `${ageDays} days ago, against a validity window of ${window} days.`,
      };
    }
  }

  const held = matches[0].provisions?.[requirement.external_provision];
  if (!held || held === "SILENT" || held === "AMBIGUOUS") {
    return {
      coverage: COVERAGE.AMBIGUOUS_EVIDENCE,
      external_instrument: requirement.external_instrument,
      detail: `The ${requirement.external_instrument} does not clearly settle ` +
              `"${requirement.external_provision}" (${held || "provision absent"}). Silence in ` +
              `a constitutional document is not permission.`,
    };
  }
  return held === requirement.requires
    ? { coverage: COVERAGE.RESOLVED, external_instrument: requirement.external_instrument,
        detail: `The ${requirement.external_instrument} records "${held}", which this Agreement requires.` }
    : { coverage: COVERAGE.CONTRADICTED, external_instrument: requirement.external_instrument,
        detail: `This Agreement requires "${requirement.requires}" but the ` +
                `${requirement.external_instrument} records "${held}".` };
}

// ---------------------------------------------------------------------------
// REQUIREMENT RELATIONSHIPS
//
// Every state above answers a question about ONE requirement: is it applicable,
// is it satisfied, by what, and how well is that known. A document can answer
// all of them positively and still be incoherent, because the defect lives
// BETWEEN two provisions each of which reads correctly on its own.
//
// The NDA forced this. Every NDA the system ships carries NDA_DURATION_001
// ("the confidentiality obligations ... shall survive its termination or
// expiration and continue for a period of five (5) years thereafter") beside
// NDA_TERM_SURVIVAL_001 ("the obligations of confidentiality shall survive for
// a further period of three (3) years ... and indefinitely in respect of trade
// secrets"). Two clauses, both well drafted, giving different answers to the
// only question a confidentiality obligation must settle: for how long. The
// requirement model reported 9 of 9 RESOLVED, because both clauses were
// present and each satisfied its own requirement. Presence and superficially
// plausible wording are not a coherent boundary.
//
// Two rules govern this mechanism, and they are what keep it from becoming a
// semantic-similarity guess:
//
//   1. The comparison is EVIDENCE-BASED. The knowledge artifact declares a
//      regex that reads each clause's answer out of that clause's own text.
//      Nothing is inferred from clause names, categories or proximity.
//   2. Failure of the instrument is not agreement. If the regex returns nothing
//      from a clause that is present, the system does not know what that clause
//      says, and the relationship is NOT_ESTABLISHED. A silent regex miss
//      reading as coherence would be the same bug class as a word boundary
//      matching "nda" inside "standards".
//
// The results are reported on their own axis and never counted into the
// requirement summary. Folding one broken relationship into "9 of 10 resolved"
// would restore exactly the arithmetic this exists to defeat.

function normaliseAnswer(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function readAnswers(text, extract) {
  const pattern = new RegExp(extract, "gi");
  const answers = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    // First non-empty capture: an extract may offer alternative phrasings of the
    // same answer, and which branch fired is not itself evidence of anything.
    const captured = match.slice(1).find((group) => group !== undefined && group !== "");
    if (captured !== undefined) answers.push(normaliseAnswer(captured));
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return answers;
}

export function assessRelationships(relationships = [], clauseIds = [], clauseTexts = {}) {
  const present = new Set(clauseIds);
  const textOf = (id) =>
    (clauseTexts instanceof Map ? clauseTexts.get(id) : clauseTexts?.[id]) || "";

  return relationships.map((relationship) => {
    const base = {
      id: relationship.id,
      kind: "RELATIONSHIP",
      between: relationship.between,
      must_agree_on: relationship.must_agree_on,
      identity_test: relationship.identity_test,
    };
    const engaged = relationship.between.filter((id) => present.has(id));

    // Fewer than two participants: there is only one statement in the document,
    // so nothing can disagree with anything. Affirmatively not applicable --
    // and deliberately NOT reported as coherence holding, because no coherence
    // was tested.
    if (engaged.length < 2) {
      return {
        ...base, coverage: COVERAGE.NOT_APPLICABLE, engaged,
        detail: engaged.length
          ? `Only ${engaged[0]} is in this draft, so the instrument states this once.`
          : `None of the participating clauses is in this draft.`,
      };
    }

    const missingText = engaged.filter((id) => !textOf(id).trim());
    if (missingText.length) {
      return {
        ...base, coverage: COVERAGE.UNRESOLVED, engaged, missing_text: missingText,
        detail: `The text of ${missingText.join(", ")} was not supplied to the assessor, so ` +
                `the comparison was not performed. This is unfinished work, not agreement.`,
      };
    }

    const answers = {};
    const silent = [];
    for (const id of engaged) {
      const found = readAnswers(textOf(id), relationship.extract);
      if (!found.length) silent.push(id);
      else answers[id] = found;
    }
    if (silent.length) {
      return {
        ...base, coverage: COVERAGE.AMBIGUOUS_EVIDENCE, engaged, silent,
        read: answers,
        detail: `${silent.join(", ")} is in this draft and the declared extract read no answer ` +
                `out of it. What that clause says about "${relationship.must_agree_on}" is ` +
                `unknown, and unknown is not agreement.`,
      };
    }

    const distinct = [...new Set(Object.values(answers).flat())];
    if (distinct.length > 1) {
      return {
        ...base, coverage: COVERAGE[relationship.when_broken] || COVERAGE.CONTRADICTED,
        engaged, read: answers, distinct,
        detail: `The instrument gives ${distinct.length} different answers to ` +
                `"${relationship.must_agree_on}": ` +
                Object.entries(answers)
                  .map(([id, values]) => `${id} says ${values.join("/")}`)
                  .join("; ") + `. Each clause reads correctly on its own.`,
      };
    }
    return {
      ...base, coverage: COVERAGE.RESOLVED, engaged, read: answers, distinct,
      detail: `All ${engaged.length} participating clauses answer "${relationship.must_agree_on}" ` +
              `the same way (${distinct[0]}).`,
    };
  });
}

export function assessRequirements(
  documentType, clauseIds = [], positions = {}, variables = {}, externalInstruments = [],
  clauseTexts = {}, evidenceOutcomes = []
) {
  const requirements = loadDocumentRequirements().get(documentType);
  if (!requirements) return { documentType, assessed: false, results: [] };

  const present = new Set(clauseIds);
  const results = requirements.map((requirement) => {
    const applies = applicable(requirement, positions, evidenceOutcomes);
    if (applies === null) {
      return {
        id: requirement.id,
        coverage: COVERAGE.APPLICABILITY_UNKNOWN,
        statement: requirement.statement,
        identity_test: requirement.identity_test,
        undetermined_by: requirement.applicability.position || requirement.applicability.evidence,
        undetermined_source: requirement.applicability.evidence ? "evidence" : "position",
        // Why the evidence did not establish it, carried through so that
        // "nobody supplied anything" and "somebody supplied the wrong company's
        // record" are never the same line in a report.
        evidence_outcome: requirement.applicability.evidence
          ? (evidenceOutcomes || []).find((o) => o.proposition === requirement.applicability.evidence)
          : undefined,
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
      if (requirement.kind === "EXTERNAL_COHERENCE") {
        return { id: requirement.id, kind: requirement.kind, statement: requirement.statement,
                 satisfied_by: satisfyingClauses,
                 ...assessExternal(requirement, variables, externalInstruments) };
      }
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

  const relationships = assessRelationships(
    requirements.relationships || [], clauseIds, clauseTexts
  );
  for (const relationship of relationships) relationship.finding = findingFor(relationship.coverage);

  const counted = (kind) => results.filter((r) => r.coverage === kind).length;
  const coherent = (kind) => relationships.filter((r) => r.coverage === kind).length;
  return {
    documentType,
    assessed: true,
    results,
    // A SECOND AXIS, kept out of `summary` on purpose. A document whose every
    // requirement is RESOLVED and whose duration clauses contradict each other
    // must not be able to report a number that sounds like success.
    relationships,
    coherence: {
      assessed: relationships.length,
      tested: relationships.filter((r) => r.coverage !== COVERAGE.NOT_APPLICABLE).length,
      holds: coherent(COVERAGE.RESOLVED),
      // NOT_APPLICABLE is also an ESTABLISHED_NEGATIVE finding -- the system did
      // establish that the relationship does not arise -- so it must be excluded
      // here, or a document containing neither clause would report as broken.
      broken: relationships.filter(
        (r) => r.coverage !== COVERAGE.NOT_APPLICABLE && r.finding === FINDING.ESTABLISHED_NEGATIVE
      ).length,
      not_established: relationships.filter((r) => r.finding === FINDING.NOT_ESTABLISHED).length,
      work_incomplete: relationships.filter((r) => r.finding === FINDING.WORK_INCOMPLETE).length,
      not_applicable: coherent(COVERAGE.NOT_APPLICABLE),
    },
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
      evidence_mismatched: counted(COVERAGE.EVIDENCE_MISMATCHED),
      ambiguous_evidence: counted(COVERAGE.AMBIGUOUS_EVIDENCE),
      stale_evidence: counted(COVERAGE.STALE_EVIDENCE),
      conflicting_evidence: counted(COVERAGE.CONFLICTING_EVIDENCE),
      unresolved: counted(COVERAGE.UNRESOLVED),
      escalated: counted(COVERAGE.ESCALATED),
      not_applicable: counted(COVERAGE.NOT_APPLICABLE),
    },
  };
}
