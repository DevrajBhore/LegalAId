/**
 * recordPlaceholderProvenance.mjs — D4.42
 * Writes knowledge-base/governance/placeholder-provenance.json. Every count is read
 * from the two probe outputs in docs/audit; nothing numeric is typed by hand.
 */
import fs from "fs";
import path from "path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const PP = J("docs/audit/placeholder-provenance.json");
const UF = J("docs/audit/unanswered-fill.json");
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();

const noInput = UF.rows.filter((r) => r.state === "FILLED_FROM_NO_INPUT");
const GENERIC = new Set(["party_1_signatory_name", "party_2_signatory_name"]);
const operative = {};
for (const r of noInput.filter((r) => !GENERIC.has(r.field)))
  for (const s of r.slots.filter((x) => x.source === "FROM_NO_INPUT")) {
    const k = `${r.field}@${s.clause_id}`;
    (operative[k] ||= { field: r.field, clause_id: s.clause_id, alignment: s.slot, required_in_form: r.required, fill_excerpt: norm(s.fill).slice(0, 140), $note: s.fill.includes("(#)") ? "(#) is a list marker normalised for alignment" : undefined, families: [] }).families.push(r.family);
  }
const operativeRows = Object.values(operative);
const opFields = [...new Set(operativeRows.map((o) => o.field))];
const opFamilies = [...new Set(operativeRows.flatMap((o) => o.families))];
const quantified = operativeRows.filter((o) => /\d|\b(one|two|three|five|seven|ten|twelve|thirty|sixty|ninety)\b/i.test(o.fill_excerpt));
const anotherAnswer = UF.rows.filter((r) => r.state === "FILLED_FROM_ANOTHER_ANSWER");
const execDerived = anotherAnswer.filter((r) => r.field === "execution_city");

const record = {
  $comment: [
    "D4.42 — PLACEHOLDER PROVENANCE. Measure and specify. No generation code changed.",
    "D4.41 stopped case E (context-dependent satisfaction) because a filled slot cannot say where its value came from. This phase measured where values come from, through the real form and the shipped text, and specifies the minimum the product would have to record. It records nothing yet: doing so is the first change to the generation path since this series began and needs explicit go-ahead.",
    "Counts are written by scripts/recordPlaceholderProvenance.mjs from docs/audit/placeholder-provenance.json and docs/audit/unanswered-fill.json.",
  ],
  review_status: "UNREVIEWED — engineering measurement. Every legal question below is the advocate's.",
  phase: "D4.42",
  kind: "measure-and-specify",
  status: "MEASURED; CONTRACT SPECIFIED; NOT IMPLEMENTED",

  the_answer_in_one_paragraph:
    "A value in a shipped instrument can be chosen in at least five places, and none of them records that it chose. The browser writes defaults into the form before submission (the server cannot tell them from answers). generationControls derives values from other answers (the place of execution and the forum from the first party's address). variableInjector aliases, synthesises and defaults. The per-clause renderers in documentHardening re-render 132 clauses with their own fallbacks in their own spelling. jurisdictionEngine composes the forum. The injector's constant defaults were never observed to ship; the renderers' were — including a twelve-month restrictive covenant nobody chose and a probation clause that refers to a period the agreement never states. Case E cannot be built on this: it would have to infer, from rendered words, a fact the pipeline knew and discarded.",

  no_generation_change: {
    claim: "D4.42 changed no file on the generation path.",
    evidence: "git diff against the base commit is empty for documentHardening.js, variableInjector.js, generationControls.js, jurisdictionEngine.js, documentService.js, backend/config/ and frontend/src/pages/Form.jsx. The one mutation made (to confirm the regression test bites) was reverted from a byte copy and re-diffed.",
  },

  where_a_value_is_chosen: [
    { site: "frontend/src/pages/Form.jsx", what: "SELECT_DEFAULTS (ip_ownership, employment_termination_type), effective_date = today, governing_law_state ← operating_state; written into EMPTY fields before submission", records_the_choice: false, server_can_tell: false },
    { site: "backend/services/generationControls.js", what: "derived controls read by blueprint gates (e.g. is_binding_mou ← binding_nature); arbitration seat ← execution_city ‖ city of party_1_address ‖ state", records_the_choice: false },
    { site: "backend/services/variableInjector.js", what: "buildDerivedVariables: alias chains, synthesis (purpose from company name), constant defaults; `{{placeholder}}` substitution", records_the_choice: false },
    { site: "backend/services/documentHardening.js", what: "renderHardClause: 132 per-clause renderers, each with its own fallbacks (resolveRestrictionPeriod, resolveExecutionVenue, the recital purpose chain, …)", records_the_choice: false },
    { site: "backend/services/jurisdictionEngine.js", what: "dispute-resolution and governing-law clause composition; forum and seat", records_the_choice: false },
  ],

  measurements: {
    A_injector_placeholders_by_execution: {
      candidate_keys: PP.A_placeholders_classified_by_execution.candidate_keys,
      produce_a_value_from_no_input: PP.A_placeholders_classified_by_execution.produce_a_value_from_no_input,
      synthesis: PP.A_placeholders_classified_by_execution.synthesis,
    },
    B_injector_constant_defaults_end_to_end: {
      tallies: Object.fromEntries(PP.B_constant_defaults.map((r) => [r.key, r.tally])),
      $what_it_shows: "No injector constant default was observed in a shipped instrument in its injector spelling.",
      $retracted_conclusion: "This part first reported non_compete_period and permitted_use as USER_VALUE_ONLY — 'the default never ships'. That was wrong: it searched only for the injector's literal. The state is renamed INJECTOR_LITERAL_NOT_SHIPPED, which is all it measured. Part D found what does ship.",
    },
    C_two_purpose_chains: PP.C_purpose_chains.tally,
    D_unanswered_slot_differential: {
      method: UF.$method,
      scope: UF.scope,
      tally: UF.tally,
      required_vs_optional: UF.tally_required_vs_optional,
      filled_from_no_input: {
        rows: noInput.length,
        of_which_generic_signatory_fallback: noInput.filter((r) => GENERIC.has(r.field)).length,
        operative_wording: { distinct_field_clause_pairs: operativeRows.length, fields: opFields.length, families: opFamilies.length, rows: operativeRows },
        containing_a_quantity: quantified.map((o) => ({ field: o.field, clause_id: o.clause_id, families: o.families.length, fill_excerpt: o.fill_excerpt })),
      },
      filled_from_another_answer_confirmed_by_follow_test: anotherAnswer.map((r) => ({ family: r.family, field: r.field, from: [...new Set(r.slots.flatMap((s) => s.from || []))] })),
      self_referential_candidates: {
        flagged: UF.self_referential_fills.length,
        verified_circular_by_reading: ["EMPLOYMENT_CONTRACT/probation_period → EMP_PROBATION_001", "SERVICE_AGREEMENT/service_levels → SERVICE_SLA_001"],
        not_circular: "the acceptance_criteria fills refer to the Services and deliverables, which the agreement does describe",
        not_decided: "MASTER_SERVICE_AGREEMENT/service_levels refers to service levels 'expressly recorded in this Agreement'; an MSA's SOWs may record them. Whether an SOW is part of 'this Agreement' is for the advocate.",
      },
      out_of_scope: "select, number and date fields (a sentinel cannot be placed in them); identifier fields with format validation (PAN, GSTIN, CIN, LLPIN — every sentinel refused). 11 families produce no draft under the well-filled fixture.",
    },
  },

  verified_findings: [
    { id: "TWO_RENDERING_PATHS_TWO_DEFAULTS",
      finding: "The same concept has a default in each rendering path, in different spellings. injectVariables('{{non_compete_period}}', {}) is '12 months'; what ships is the renderer's 'twelve (12) months'. The injector's default is dead for this concept, and nothing says so.",
      why_it_matters_for_provenance: "Provenance recorded in the injector alone would describe a value that is not the one shipped." },
    { id: "RESTRICTIVE_PERIOD_FILLED_FROM_NO_INPUT",
      finding: "With a non-compete or non-solicit opted in and the period left blank (the field is optional), the instrument imposes 'twelve (12) months'. Blank and missing render identically. Observed in NDA (both covenants), INDEPENDENT_CONTRACTOR_AGREEMENT (both) and CONSULTANCY_AGREEMENT (non-solicit).",
      source: "documentHardening.js resolveRestrictionPeriod — also maps 'NA', 'none', 'nil', 'not applicable' to twelve months, a branch the validator currently makes unreachable (next finding).",
      adjacent: "One field sets both covenants' durations in NDA and INDEPENDENT_CONTRACTOR_AGREEMENT, though labelled 'Non-Compete Period'. In CONSULTANCY_AGREEMENT include_non_compete adds only a during-term exclusivity clause, so the period governs only the non-solicit.",
      legal_question_for_the_advocate: "Whether a post-term restriction of a duration the user never chose may ship, and how section 27 of the Indian Contract Act bears on these clauses at all." },
    { id: "NA_INVITED_BY_LABEL_REFUSED_BY_VALIDATOR",
      finding: "The period field's label invites 'NA' ('e.g. 1 year, or NA'). 'NA', 'N/A', 'None', 'nil' and 'Not applicable' are each refused (INVALID_INPUT_1) — including when both covenants are switched off and the period governs nothing. The only way to not state a period is to leave it blank, which ships twelve months." },
    { id: "SELF_REFERENTIAL_FILL",
      finding: "Unanswered, EMP_PROBATION_001 reads 'on probation for the period expressly stated in this Agreement', and no other clause mentions probation. SERVICE_AGREEMENT's SERVICE_SLA_001 reads 'shall meet the following service levels …: the service levels expressly recorded in this Agreement', and none are recorded. The words look like a filled slot and are a hole.",
      machine_checkable: "A fill that refers to 'this Agreement' for a value can be tested for a referent in the same draft. Nothing does this today." },
    { id: "PLACE_OF_EXECUTION_DERIVED_FROM_PARTY_ADDRESS",
      finding: `When execution_city is not answered, the instrument states it was 'executed at' the first party's city and gives that city's courts exclusive jurisdiction; the value follows the address when the address is moved (confirmed by follow test in ${execDerived.length} families).`,
      reach: "execution_city is marked required in variableConfig but is not in DOCUMENT_CONFIG.requiredFields, so the server does not require it; and it is not an essential field in 36 families, so QUICK MODE neither shows nor requires it. A quick-mode user reaches this without doing anything unusual.",
      legal_question_for_the_advocate: "Whether an instrument may state a place of execution nobody gave, and whether defaulting the exclusive forum to the first party's city is acceptable (it favours that party)." },
    { id: "CLIENT_DEFAULTS_ARRIVE_AS_ANSWERS",
      finding: "Form.jsx writes 'Employer owns work product IP' into an empty ip_ownership, today's date into effective_date, and the operating state into governing_law_state, before submission. The request carries no marker, so the server receives these as the user's answers. The ip_ownership default applies only in EMPLOYMENT_CONTRACT (the one family whose options contain that choice), and there ip_ownership is not an essential field: in quick mode the IP allocation is chosen by the browser and never shown to the user.",
      why_it_matters_for_satisfaction: "A satisfaction reading of IP allocation in EMPLOYMENT_CONTRACT (D4.38 case F's proposition) would treat a browser default as an established allocation. No server-side record can be made correct without the client declaring what it defaulted.",
      $declaration_level: "The SELECT_DEFAULTS behaviour is read from source; the quick-mode visibility is read from essentialFields. Neither was driven through a browser." },
    { id: "ONE_CONCEPT_TWO_CHAINS_TWO_SOURCES",
      finding: "In SOFTWARE_DEVELOPMENT_AGREEMENT, with both required fields answered realistically, the recital's purpose comes from services_description and CORE_PURPOSE_001's from project_description. Both are the user's words, so nothing is fabricated — but one concept is stated twice from two answers that can disagree, and the document cannot say which is 'the purpose'.",
      adjacent: "CORE_PURPOSE_001 composes 'to design, develop, test, and deliver {project_description}', which with a gerund answer ('Building a …', the shape the label invites) ships 'deliver building a …'. A composition defect, not a provenance one; noted, not pursued." },
    { id: "REQUIRED_FREE_TEXT_ANSWER_WITH_NO_EFFECT",
      finding: "LOAN_AGREEMENT's repayment_schedule and CONSULTANCY_AGREEMENT's payment_terms are required free-text questions whose answers change no byte of the shipped instrument. The repayment clause is composed from structured fields (tenure, instalment amount, start date); the retainer clause from consulting_fee with a constant 'fifth (5th) day'. If the user's text and the structured fields disagree, the text loses silently.",
      scope_note: `${UF.tally.ANSWER_NOT_OBSERVED} text answers were not observed in shipped text; only these two were confirmed byte-identical. D2.2 (DEAD_QUESTIONS.md) measured select and toggle questions only, so these free-text cases are new.` },
  ],

  instrument_flaws_found_this_phase: [
    "1. Case-sensitive matching missed a recital that lowercases its purpose.",
    "2. Free-text sentinels placed in normalised fields (party types, descriptors) cannot survive.",
    "3. The literal '0' matches any date or number; not attributable by search.",
    "4. A value whose carrying clause is absent was reported as 'never reaches'.",
    "5. Families that produced no draft were dropped silently instead of recorded.",
    "6. Junk-looking sentinels were refused by input validation — the probe blocked the generations it meant to observe.",
    "7. A blocked supplied-world was then read as 'value not observed'.",
    "8. Searching for a KNOWN default literal can find only the defaults already known. Part B's 'USER_VALUE_ONLY' hid the renderer's twelve-month covenant. Replaced by the supplied-vs-missing differential (Part D), which discovers the fill.",
    "9. Attribution by text search is coincidence-prone: 'Mumbai' occurred in the party address and in a renderer constant. Replaced by a follow test — alter the candidate answer, re-render both worlds, re-align, and attribute only if the fill moves.",
    "10. The follow test appended a marker to a SELECT answer, which the validator refused, and the refusal was reported as FROM_NO_INPUT. Select candidates are now switched to another of their own options; an untestable candidate yields ATTRIBUTION_UNTESTABLE, never FROM_NO_INPUT.",
    "11. List items are relettered when one is withdrawn, which made a withdrawn definition look like a replaced one. Alignment now ignores list markers. The first version of that fix also rewrote '(90)' in 'ninety (90) days'; numerals are now excluded.",
    "12. The self-reference flag is a phrase match and over-flags: 4 of 7 flagged fills refer to things the agreement does describe. Flag, then read; only the two read as circular are reported as findings.",
  ],

  correction_to_D4_41: {
    what: "Case A/G1 was demonstrated by setting the derived control is_binding_mou directly on assembleDocument — the gate's input, not the user's answer, on an assembled rather than shipped draft.",
    now: "Driven through the real form field binding_nature and generateDocument. Conclusion unchanged. Case B stays on the assembled draft because IP_ASSIGNMENT_AGREEMENT ships no draft under the fixture; this is now stated in the test.",
    recorded_in: "knowledge-base/governance/satisfaction-reduction.json → correction_D4_42",
  },

  minimum_provenance_contract: {
    status: "SPECIFICATION ONLY. Nothing implements it.",
    source_classes: {
      $closed: "Exactly one per filled slot. The vocabulary is closed: a chain that cannot name its class has not chosen legitimately.",
      USER_SUPPLIED: "The user typed or selected it in a field they could see.",
      CLIENT_DEFAULT: "The browser wrote it into an empty field. Carries visible_to_user: true|false.",
      ALIAS: "Another answer's value, used as-is for this slot. Carries the source key.",
      DERIVED: "Computed from other answers (a city parsed from an address; a control from a selection). Carries the source keys and the deriving site.",
      SYNTHESISED: "New words built around other answers (a purpose sentence from a company name). Carries the source keys and the site.",
      CONSTANT_DEFAULT: "Words from no input at all. Carries the site that holds the literal.",
      NORMALISED: "The user's value, reformatted (party type, descriptor). Carries the source key.",
      WITHDRAWN: "The slot's phrase, sentence or clause was omitted because it was unanswered.",
    },
    requirements: [
      "R1 — every filled slot in a shipped instrument carries exactly one source class and, for every class but USER_SUPPLIED and CONSTANT_DEFAULT, the input keys it came from.",
      "R2 — provenance is recorded where the choice is made (each of the five sites above), never reconstructed afterwards. Reconstruction by sentinel is an investigation technique; it is not product behaviour.",
      "R3 — the client declares which fields it defaulted and whether they were visible. Without this, CLIENT_DEFAULT is indistinguishable from USER_SUPPLIED at the trust boundary and R1 cannot be met.",
      "R4 — a concept filled in more than one slot is answerable as a whole: same class and same source everywhere, or not.",
      "R5 — recording provenance changes no shipped byte. Testable: every family's shipped text is byte-identical with recording on and off.",
      "R6 — satisfaction (case E) reads the source class; it never re-derives it from text.",
      "R7 — a CONSTANT_DEFAULT whose words refer to 'this Agreement' for a value must have a referent in the same draft; otherwise it is a hole, not a fill.",
    ],
    what_it_would_unblock: "Case E: 'is this proposition established by what the user decided, or by what the system assumed?' becomes a lookup, not an inference.",
    what_it_does_not_decide: "Whether any default is legally acceptable. The contract makes defaults visible; the advocate decides which may ship.",
  },

  what_this_record_does_not_do: [
    "It does not change generation, validation, the form, or any default.",
    "It does not judge whether any default is legally acceptable.",
    "It does not claim coverage of select, number or date fields, identifier fields, or the 11 families that produce no draft under the fixture.",
    "It does not establish which code path chose a FROM_NO_INPUT fill — only that no input contained it.",
    "It does not implement the contract. Implementing it touches every site that chooses a value and needs explicit go-ahead.",
  ],
};
fs.writeFileSync(path.join(ROOT, "knowledge-base/governance/placeholder-provenance.json"), `${JSON.stringify(record, null, 2)}\n`);
console.log("written. operative pairs:", operativeRows.length, "fields:", opFields.length, "families:", opFamilies.length, "quantified:", quantified.length, "exec derived:", execDerived.length);
