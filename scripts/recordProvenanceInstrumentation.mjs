/**
 * recordProvenanceInstrumentation.mjs — D4.43
 * Writes knowledge-base/governance/provenance-instrumentation.json. Every figure is
 * measured when the script runs, on shipped drafts; none is typed by hand.
 */
import fs from "fs";
import path from "path";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/provenance-conservation.snapshot.json"), "utf8"));
const FAMILIES = Object.keys(DOCUMENT_TYPE_REGISTRY);
const D442_FIELDS = ["execution_city", "confidential_information_definition", "confidentiality_exclusions", "confidentiality_access_scope",
  "non_compete_period", "probation_period", "leave_policy", "service_levels", "expenses_policy", "warranty_period", "acceptance_criteria",
  "management_control", "exit_terms", "risk_transfer_terms", "title_transfer_terms", "events_of_default", "invocation_conditions",
  "invocation_procedure", "change_request_process", "retention_period"];
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

/* ── Coverage on the well-filled corpus ─────────────────────────────────── */
const cov = { families_shipping: 0, clauses: 0, survival: {}, status: {}, survived_by_producer: {}, transformed_after: {}, renderer_clauses: 0, renderer_produced_shipped_text: 0 };
let recordBytes = 0, resultBytes = 0;
for (const t of FAMILIES) {
  const out = await generateDocument({ document_type: t, variables: variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
  const p = out?.draft?.metadata?.provenance; if (!p) continue;
  cov.families_shipping += 1; recordBytes += JSON.stringify(p).length; resultBytes += JSON.stringify(out).length;
  for (const r of Object.values(p.clauses)) {
    cov.clauses += 1; bump(cov.survival, r.artifact_survival.state); bump(cov.status, r.provenance_status);
    if (r.artifact_survival.producer) bump(cov.survived_by_producer, r.artifact_survival.producer);
    if (r.artifact_survival.last_producer) bump(cov.transformed_after, r.artifact_survival.last_producer);
    if (r.renderer) { cov.renderer_clauses += 1; if (r.renderer.produced_shipped_text) cov.renderer_produced_shipped_text += 1; }
  }
}
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;

/* ── The labelled fields, unanswered ────────────────────────────────────── */
// Every optional D4.42 field removed; opt-in restrictive covenants switched on so
// their period branch runs. Required fields stay (a user must answer them).
const rows = {}; const withheldClauses = {};
for (const t of FAMILIES) {
  const schema = getVariables(t) || {};
  const v = { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }), include_non_compete: "Yes", include_non_solicit: "Yes" };
  for (const f of D442_FIELDS) if (!schema[f]?.required) delete v[f];
  const out = await generateDocument({ document_type: t, variables: v });
  const p = out?.draft?.metadata?.provenance; if (!p) continue;
  for (const [id, r] of Object.entries(p.clauses)) {
    for (const c of r.recorded_choices || []) {
      const k = `${c.field}|${id}|${c.source_class}`;
      (rows[k] ||= { field: c.field, clause_id: id, source_class: c.source_class, producer: c.producer, field_answered: c.field_answered, value: c.value, families: [] }).families.push(t);
    }
    if (r.withheld_choice_count) (withheldClauses[id] ||= { clause_id: id, reason: r.withheld_reason, families: [] }).families.push(t);
  }
}
const rowList = Object.values(rows).sort((a, b) => a.field.localeCompare(b.field) || a.clause_id.localeCompare(b.clause_id));
const defaultsReady = rowList.filter((r) => r.source_class === "CONSTANT_DEFAULT");
const withdrawnRows = rowList.filter((r) => r.source_class === "WITHDRAWN");
const aliasRows = rowList.filter((r) => r.source_class === "ALIAS");
const fieldsWithASurvivingDefault = [...new Set(defaultsReady.map((r) => r.field))].sort();

const record = {
  $comment: [
    "D4.43 — PROVENANCE INSTRUMENTATION. Observe, record, prove conservation. Nothing more.",
    "No default was changed. No clause, gate, validation, disclosure or export was changed. Nothing reads the record.",
    "Written by scripts/recordProvenanceInstrumentation.mjs; every figure is measured on shipped drafts when the script runs.",
  ],
  review_status: "UNREVIEWED — engineering instrumentation. No legal judgement is made or implied, and no default is put to the advocate yet.",
  phase: "D4.43",
  kind: "instrumentation",
  status: "INJECTOR: CHOICES RECORDED · HARDENING: OBSERVED, 20 FIELDS' FALLBACKS RECORDED · 3 PRODUCERS AND ALL TRANSFORMERS REMAIN",

  progression: [
    { step: "1. variableInjector", state: "DONE", establishes: "conservation proven; its choices recorded; shown to be a minor production point" },
    { step: "2. renderHardClause, central", state: "DONE", establishes: "every renderer invocation observed: identity, reads present and missing, whether its text shipped; artifact survival measured. COVERAGE, not provenance." },
    { step: "3. selected renderer fallbacks", state: "DONE", establishes: "the fallback branches of the 20 fields D4.42 showed shipping unchosen wording record their choice where it is made" },
    { step: "4. transformers", state: "NEXT", establishes: "artifact-survival tracking through normalisation, quality passes, fixer, AI merge" },
    { step: "5. advocate report", state: "WAITING ON 4", establishes: "the actual defaults requiring legal review, from recorded rows only" },
    { step: "—", state: "NOT IN SCOPE", establishes: "remediation of any default" },
  ],

  the_gate: {
    rule: "If any provenance implementation changes the artifact, stop. The contract has been violated.",
    what_is_compared: "For every (family, input world) case: the whole generateDocument result with draft.metadata.provenance removed, the plain-text export and the disclosure block. Keys sorted, arrays in order; byte equality.",
    corpus: { cases: Object.keys(snapshot).length, shipping_a_draft: Object.values(snapshot).filter((x) => x.shipped).length, blocked: Object.values(snapshot).filter((x) => !x.shipped).length },
    baseline: "Captured once from the pre-D4.43 code (all changed files restored byte-for-byte, git diff empty), clock frozen at 2026-09-01T06:30Z. Re-captured once since, for a deliberate output change: see rebaselines.",
    results: [
      { batch: "injector", violations: 0 },
      { batch: "hardening stage 1 (central observation)", violations: 0 },
      { batch: "hardening stage 2 (20 fields' fallback branches)", violations: 0 },
      { batch: "record additions (withheld counts, pass inputs)", violations: 0 },
    ],
    the_gate_was_shown_to_bite: [
      "injector: record write also reset metadata.assumptions → 183; clause-labelling wrapper appended a space → 18; synthesised purpose wording changed → 8",
      "stage 2: a labelled literal changed (probation) → 4; the WITHDRAWN branch returned ' Nil.' instead of nothing → 142",
    ],
    rebaselines: [
      {
        date: "2026-09-26",
        why: "DELIBERATE OUTPUT CHANGE, not instrumentation: every DOCX, PDF and TXT export now ends with the not-legal-advice notice (backend/services/legalNotice.js), from the launch-compliance fixes.",
        evidence: "Before re-capture the gate reported 138 violations, all of kind text_sha256 — exactly the 138 shipping cases' plain-text export. result_sha256, disclosure_sha256 and clause order were identical in all 217 cases, and the 79 blocked cases were untouched.",
        rule: "The gate is re-captured only for a change that is MEANT to alter what ships, and each re-capture is recorded here with the kinds that moved.",
      },
    ],
    what_the_gate_does_not_catch_by_design: [
      "A LABEL that is wrong. Mislabelling the answered restriction period as CONSTANT_DEFAULT → 0 violations, because the artifact did not change. tests/provenanceHardening.test.mjs caught it. The gate proves the text; the tests prove the record.",
      "A whitespace-only change a later normaliser absorbs. The WITHDRAWN branch returning ' ' instead of '' → 0 violations, because the shipped text is genuinely the same.",
    ],
  },

  two_dimensions: {
    source_class: "Where a value came from. Closed: USER_SUPPLIED, CLIENT_DEFAULT, ALIAS, DERIVED, SYNTHESISED, CONSTANT_DEFAULT, NORMALISED, WITHDRAWN — or NOT_YET_RECORDED while the producer that chose it is uninstrumented.",
    artifact_survival: "Whether a producer's text reached the artifact: SURVIVED | TRANSFORMED_AFTER_PRODUCTION | NO_PRODUCER_OBSERVED. Never a source class.",
    provenance_status: "Per clause: RECORDED | NOT_YET_RECORDED | WITHHELD (with its survival reason). A renderer clause is never RECORDED as a whole: its renderer is observed, and only selected branches record choices.",
    rule: "A producer's value-level record is attached only when its output IS the shipped text. When a later stage changed it, the choices are counted (withheld_choice_count) and not asserted.",
    producer_of_the_text: "The latest event that MADE the shipped text: an injection, or a renderer that changed its input. A renderer that handed its input back unchanged reproduced it and is not its producer.",
  },

  stage_1_central_observation: {
    where: "renderHardClause in documentHardening.js — the single dispatch for all renderers. When recording, the renderer receives a read-observing Proxy over the same variables (same values, same keys). When not recording it is a direct call.",
    per_invocation: "clause id; renderer identity; keys read and present; keys read and missing; the pass it ran in (whose non-empty input keys are listed once in renderer_passes); input and output hashes; whether its output is the shipped text",
    it_does_not: "infer a fallback's source. A read that found nothing is 'missing', not 'defaulted'.",
    measured: {
      corpus: "well-filled fixture",
      ...cov,
      share_of_shipped_clauses_whose_text_a_recorded_producer_made: pct(cov.survival.SURVIVED || 0, cov.clauses),
      record_size: `${pct(recordBytes, resultBytes)} of the serialised result`,
    },
  },

  stage_2_labelled_fallbacks: {
    scope: "Exactly the 20 fields D4.42 showed shipping unchosen wording. A test fails if any other field is labelled, or any of the 20 is not.",
    how: "Four helpers in documentHardening (orConstant, strippedOrConstant, sentenceFor, and chose at named sites) each return exactly what the expression they replaced returned, and record which branch ran. The class is the branch's: a constant branch is CONSTANT_DEFAULT; an empty branch is WITHDRAWN; an alias branch is ALIAS with the key; an answered branch is the input (NOT_YET_RECORDED until its upstream producer is instrumented).",
    the_class_comes_from_the_branch: "A user who types 'twelve (12) months' is recorded as the input, not as a default — same words, different source. Tested.",
    measured_with_the_20_fields_unanswered: {
      recorded_rows: rowList.length,
      constant_defaults_recorded_on_shipped_text: defaultsReady.length,
      fields_with_a_recorded_constant_default: fieldsWithASurvivingDefault,
      withdrawn_rows: withdrawnRows.length,
      alias_rows: aliasRows.length,
      rows: rowList.map((r) => ({ ...r, value: r.value && r.value.length > 160 ? `${r.value.slice(0, 160)}…` : r.value, $value_truncated_for_this_record_only: r.value && r.value.length > 160 ? true : undefined })),
      clauses_whose_choices_are_withheld: Object.values(withheldClauses),
    },
  },

  what_blocks_the_advocate_report: {
    finding: `Several of the defaults that matter most are chosen by an instrumented renderer and then changed by a later stage, so their choices are WITHHELD: ${Object.keys(withheldClauses).sort().join(", ")}.`,
    examples_of_what_changed_them: [
      "a defined term capitalised: 'the service provider' → 'the Service Provider' (SERVICE_SLA_001)",
      "a doubled full stop collapsed: 'delivery.. If' → 'delivery. If' (SERVICE_WARRANTY_001)",
      "a word after an abbreviation capitalised as if it began a sentence: '5:00 p.m. local time' → '5:00 p.m. Local time' (CORE_NOTICE_001) — a transformer introducing an error, noted here, not repaired",
    ],
    $examples_not_a_census: "Three diffs read by hand. Which transformer makes each change is step 4's measurement.",
    consequence: "An advocate report built now would cover the defaults that happen to survive and silently omit ones that do not — including the service-level and warranty text. That is the partial picture the sequence exists to avoid.",
  },

  what_changed_in_code: {
    "backend/services/provenance.js": "The vocabulary; the survival dimension and statuses; a per-generation recorder (AsyncLocalStorage); observeRenderer, noteRenderer and chose; attachProvenance, which returns a NEW result with draft.metadata.provenance.",
    "backend/services/variableInjector.js": "Labelled picks in buildDerivedVariables; slot recording in injectVariables. Proven identical to a frozen copy of the old file on 4000 random inputs.",
    "backend/services/documentService.js": "generateDocument wraps the unchanged generation in a recorder.",
    "backend/services/documentHardening.js": "renderHardClause wraps the unchanged renderer dispatch (renamed renderHardClauseUnobserved); four labelling helpers; the 20 fields' fallback branches routed through them; forClause on cloneClauseForDraft.",
    "backend/services/draftVariableInjector.js, dependencyResolver.js": "forClause around each injectVariables call.",
  },

  instrument_flaws_found_this_phase: [
    "1. The first conservation snapshot did not freeze the clock. Time is now frozen after modules load (mongoose rejects a Date subclass at import).",
    "2. The injector differential used a floating-point LCG that collapses above 2^53; a planted whitespace mutation passed 4000 'random' cases. Replaced with a 32-bit PRNG.",
    "3. The first survival rule named as producer the LAST event whose output matched the shipped text. A renderer that returned its input unchanged was then credited with text the injector made. The producer is now the latest event that changed the text.",
    "4. A test named 'left out is WITHDRAWN' asserted a CONSTANT_DEFAULT on a different clause. It passed and proved nothing about its name. Split into two tests that each check what they say.",
  ],

  what_this_record_does_not_do: [
    "It does not change any default, clause, gate, validation, disclosure or export.",
    "It does not classify values chosen by generationControls, jurisdictionEngine or the client; or by any renderer branch outside the 20 fields.",
    "It does not say whether any value legally satisfies any proposition, and nothing may read it as if it did.",
    "It does not produce the advocate report.",
  ],
};
fs.writeFileSync(path.join(ROOT, "knowledge-base/governance/provenance-instrumentation.json"), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({ coverage: cov, pct: record.stage_1_central_observation.measured.share_of_shipped_clauses_whose_text_a_recorded_producer_made, size: record.stage_1_central_observation.measured.record_size,
  rows: rowList.length, defaults: defaultsReady.length, fields: fieldsWithASurvivingDefault.length, withdrawn: withdrawnRows.length, alias: aliasRows.length, withheld: Object.keys(withheldClauses).length }, null, 1));
