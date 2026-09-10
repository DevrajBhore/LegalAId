/**
 * freezeAnswerStates.mjs
 *
 * The clause baseline records what each DOCUMENT TYPE emits. This records what
 * each ANSWER STATE does — which is the dimension Phase 5 introduced and which
 * nothing was watching.
 *
 * For every fact in the registry, in every state a fact can be in, it captures
 * the whole causal chain:
 *
 *   answer -> position -> provenance -> treatment -> variable
 *          -> deterministic gate -> clause -> disclosure -> artifact
 *
 * and freezes it. A change anywhere along that chain then shows up as a diff on
 * the link where it happened, rather than as a document that is quietly two
 * clauses different from the one a user got last week.
 *
 * The states are the ones a fact can actually be in, not a convenient subset:
 * answered yes, answered no, never asked, settled by a structured field,
 * suggested by prose only, answered with something unreadable, and drafted
 * against a side nobody stated.
 *
 * Run:  node scripts/freezeAnswerStates.mjs [--write]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePositions } from "../backend/services/positionResolution.js";
import { generateDocument } from "../backend/services/documentService.js";
import { draftToText } from "../backend/services/exportService.js";
import { DISCLOSURE_HEADING } from "../backend/services/disclosureRenderer.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(
  fs.readFileSync(path.resolve(HERE, "../knowledge-base/intake/legal_facts.json"), "utf8")
);
const OUT = path.resolve(HERE, "../tests/baseline/answer-states.json");

const CONSULTANCY = {
  party_1_name: "Devraj Vishal Bhore", party_1_type: "Individual",
  party_2_name: "Varun Raghunath Shastri", party_2_type: "Individual",
  consulting_fee: "30000", contract_duration: "12 months",
  services_description: "Strategic advisory covering market entry.",
  consulting_services: "Strategic advisory covering market entry.",
  payment_terms: "Rs. 30,000 per month.", effective_date: "2026-08-21",
  operating_state: "Maharashtra", execution_city: "Pune",
  drafting_for: "Client",
};

// A fact's states. `variables` overlays the base intake; `answers` the answers.
function statesFor(fact) {
  const options = fact.options || [];
  const affirmative = options[0];
  const negative = options[1];
  const states = [
    { state: "unanswered", answers: {} },
    ...(affirmative ? [{
      state: "answered_yes",
      answers: { [fact.id]: fact.type === "multiselect" ? [affirmative.label] : affirmative.label },
    }] : []),
    ...(negative ? [{
      state: "answered_no",
      answers: { [fact.id]: fact.type === "multiselect" ? [negative.label] : negative.label },
    }] : []),
    { state: "malformed_answer", answers: { [fact.id]: "Probably, I think" } },
  ];
  // A structured field the user filled in settles it without a question.
  const derivedField = (fact.established_by?.fields || [])[0];
  if (derivedField) {
    states.push({ state: "derived_from_field", variables: { [derivedField]: "Monthly strategy reports." } });
  }
  // Prose that only suggests it: advisory, and must not attach a legally
  // material treatment on its own.
  const textField = (fact.established_by?.text_fields || [])[0];
  if (textField) {
    states.push({
      state: "inferred_from_prose",
      variables: { [textField]: "Advisory work producing a written report each month." },
    });
  }
  return states;
}

async function chainFor({ variables, answers }) {
  const resolution = resolvePositions({
    documentType: "CONSULTANCY_AGREEMENT", variables, answers,
  });
  // Fill whatever the form refuses to proceed without, so a missing unrelated
  // field cannot be mistaken for an answer state that produces no document.
  // Without this the last three links of the chain -- clause, disclosure,
  // artifact -- were recorded empty for every case, and the corpus would have
  // frozen a pipeline that stops halfway.
  let draft = null;
  let filled = { ...variables };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const generated = await generateDocument({
      document_type: "CONSULTANCY_AGREEMENT", variables: filled, answers,
    });
    if (generated?.draft) { draft = generated.draft; break; }
    const missing = String(generated?.error || "").match(/Missing required field: (\w+)/);
    if (!missing) break;
    filled[missing[1]] = /fee|amount|value|price/.test(missing[1]) ? "30000" : "Stated in this Agreement.";
  }
  const text = draft ? draftToText(draft) : "";
  return {
    // answer -> position -> provenance
    positions: Object.fromEntries(
      Object.entries(resolution.positions)
        .map(([flag, p]) => [flag, `${p.value}/${p.provenance}${p.restsOnAssumedSide ? "/assumed-side" : ""}`])
        .sort(([a], [b]) => a.localeCompare(b))
    ),
    outcomes: Object.fromEntries(
      resolution.outcomes.map((o) => [o.mechanism, o.outcome]).sort(([a], [b]) => a.localeCompare(b))
    ),
    unmatched: resolution.unmatched.length,
    // ... -> clause
    clauses: draft ? draft.clauses.map((c) => c.clause_id).sort() : null,
    // ... -> disclosure -> artifact
    disclosureKinds: (draft?.metadata?.assumptions || []).map((a) => a.kind).sort(),
    inArtifact: text.includes(DISCLOSURE_HEADING),
  };
}

export async function buildAnswerStateCorpus() {
const corpus = {};
for (const fact of FACTS.facts) {
  corpus[fact.id] = {};
  for (const { state, variables = {}, answers = {} } of statesFor(fact)) {
    corpus[fact.id][state] = await chainFor({
      variables: { ...CONSULTANCY, ...variables },
      answers,
    });
  }
}
// One case with no stated side, so the assumed-side dependency is frozen too.
corpus.__assumed_side = {
  no_drafting_for: await chainFor({
    variables: Object.fromEntries(Object.entries(CONSULTANCY).filter(([k]) => k !== "drafting_for")),
    answers: { THIRD_PARTY_EXPOSURE: "Yes, that is a real possibility" },
  }),
};

  return corpus;
}

// Imported by tests/answerStateCorpus.test.mjs rather than shelled out to and
// parsed off stdout: the dotenv banner and the IRE bootstrap lines share that
// stream, and an earlier version tried to find the JSON inside them.
const corpus = await buildAnswerStateCorpus();
const cases = Object.values(corpus).reduce((n, states) => n + Object.keys(states).length, 0);
if (process.argv.includes("--write")) {
  fs.writeFileSync(OUT, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`Wrote ${cases} answer-state cases across ${Object.keys(corpus).length} facts.`);
  console.log(`  -> tests/baseline/answer-states.json`);
} else if (process.argv[1] && process.argv[1].endsWith("freezeAnswerStates.mjs")) {
  console.log(`${cases} answer-state cases; pass --write to record them.`);
}
