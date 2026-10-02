/**
 * provenance.js — D4.43
 *
 * WHERE A VALUE IN A SHIPPED INSTRUMENT CAME FROM. INSTRUMENTATION ONLY.
 *
 * Implements the minimum provenance contract specified in D4.42
 * (knowledge-base/governance/placeholder-provenance.json) for the FIRST of the five
 * producers that choose values: the variable injector. The other four
 * (generationControls, the per-clause renderers in documentHardening,
 * jurisdictionEngine, and the browser form) are not instrumented yet, and the
 * record says so rather than guessing on their behalf.
 *
 * Three rules this module exists to keep:
 *
 *   1. Recording changes nothing that ships. Nothing here is read by clause
 *      selection, rendering, validation, disclosure or export. The only thing it
 *      adds is draft.metadata.provenance, attached after the result is complete.
 *      scripts/provenanceConservation.mjs proves this byte for byte.
 *
 *   2. A producer records only what IT chose. A value the injector merely passed
 *      through was chosen upstream; until that producer is instrumented its class
 *      is NOT_YET_RECORDED — an honest gap, never a guess such as "user supplied".
 *
 *   3. Provenance says where a value came from. It does not say whether that value
 *      legally establishes anything. Nothing in this module may be consumed as a
 *      satisfaction verdict (the D4.40/D4.41 boundary).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

/* The closed vocabulary from the D4.42 contract. Exactly one per filled slot. */
export const SOURCE_CLASS = Object.freeze({
  USER_SUPPLIED: "USER_SUPPLIED",
  CLIENT_DEFAULT: "CLIENT_DEFAULT",
  ALIAS: "ALIAS",
  DERIVED: "DERIVED",
  SYNTHESISED: "SYNTHESISED",
  CONSTANT_DEFAULT: "CONSTANT_DEFAULT",
  NORMALISED: "NORMALISED",
  WITHDRAWN: "WITHDRAWN",
});
/* Not a source class: the statement that the producer which chose this value has
   not been instrumented yet. Its count is the rollout's remaining work. */
export const NOT_YET_RECORDED = "NOT_YET_RECORDED";

export const PRODUCERS = Object.freeze([
  "variableInjector", "generationControls", "documentHardening", "jurisdictionEngine", "client",
]);
/* How far each producer is instrumented. Coverage is not provenance: a producer
   that is OBSERVED is known to have run and what it read, not what it chose. */
export const INSTRUMENTATION = Object.freeze({
  variableInjector: "CHOICES_RECORDED",
  documentHardening: "OBSERVED_WITH_SELECTED_CHOICES_RECORDED",
  generationControls: "NONE",
  jurisdictionEngine: "NONE",
  client: "NONE",
});
export const INSTRUMENTED = Object.freeze(Object.keys(INSTRUMENTATION).filter((k) => INSTRUMENTATION[k] !== "NONE"));

/* The ARTIFACT-SURVIVAL dimension. Deliberately NOT source classes: they say
   whether a producer's record can be asserted against the shipped text, not
   where a value came from. */
export const SURVIVAL = Object.freeze({
  SURVIVED: "SURVIVED",
  TRANSFORMED_AFTER_PRODUCTION: "TRANSFORMED_AFTER_PRODUCTION",
  NO_PRODUCER_OBSERVED: "NO_PRODUCER_OBSERVED",
});
export const STATUS = Object.freeze({ RECORDED: "RECORDED", NOT_YET_RECORDED, WITHHELD: "WITHHELD" });

const store = new AsyncLocalStorage();
export const sha256 = (text) => crypto.createHash("sha256").update(String(text)).digest("hex");

/** Run `fn` with a fresh recorder; returns fn's result and the recorder. */
export async function withProvenanceRecording(fn) {
  const recorder = { seq: 0, injections: [], invocations: [], passes: new WeakMap(), passCount: 0, unscopedChoices: [] };
  const result = await store.run(recorder, fn);
  return { result, recorder };
}

/** True only inside withProvenanceRecording. Producers must not do extra work otherwise. */
export function isRecording() {
  return store.getStore() !== undefined;
}

export function recordInjection(entry) {
  const recorder = store.getStore();
  if (!recorder) return;
  recorder.injections.push({ seq: ++recorder.seq, ...(recorder.clauseId ? { clause_id: recorder.clauseId } : {}), ...entry });
}

/** Label injections made inside fn with the clause they are for. Returns fn's value unchanged. */
export function forClause(clauseId, fn) {
  const recorder = store.getStore();
  if (!recorder) return fn();
  const previous = recorder.clauseId;
  recorder.clauseId = clauseId;
  try { return fn(); } finally { recorder.clauseId = previous; }
}

/* ── Renderer observation (D4.43 stage 1) ─────────────────────────────────── */

const meaningful = (v) => v !== undefined && v !== null && String(v).trim() !== "";

/**
 * Observe one renderer invocation. `fn` receives a read-observing view of the
 * variables — identical values, identical keys — and must return the clause the
 * renderer produced. Returns exactly what fn returns.
 */
export function observeRenderer(clause, variables, fn) {
  const recorder = store.getStore();
  if (!recorder) return fn(variables);
  let pass = recorder.passes.get(variables);
  if (pass === undefined) {
    pass = { index: recorder.passCount++, available: Object.keys(variables || {}).filter((k) => meaningful(variables[k])).sort() };
    recorder.passes.set(variables, pass);
    (recorder.passList ||= []).push(pass);
  }
  const inv = { seq: ++recorder.seq, clause_id: clause?.clause_id, pass: pass.index, input_sha256: sha256(clause?.text || ""),
    has_renderer: false, read: new Map(), choices: [] };
  const view = new Proxy(variables || {}, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && recorder.current === inv && !(prop in Object.prototype)) {
        if (!inv.read.has(prop)) inv.read.set(prop, meaningful(value));
      }
      return value;
    },
  });
  const previous = recorder.current;
  recorder.current = inv;
  let out;
  try { out = fn(view); } finally { recorder.current = previous; }
  inv.output_sha256 = sha256(out?.text || "");
  inv.changed_text = inv.output_sha256 !== inv.input_sha256;
  recorder.invocations.push(inv);
  return out;
}

/** Called by renderHardClause once it knows whether this clause has a renderer. */
export function noteRenderer(exists) {
  const recorder = store.getStore();
  if (recorder?.current) recorder.current.has_renderer = Boolean(exists);
}

/* ── Choice recording (D4.43 stage 2) ────────────────────────────────────── */

/**
 * Record that a producer CHOSE `value` for `field`, at the moment it chose it,
 * and return `value` unchanged. `source` carries the class and whatever the
 * branch knows (the literal's site, the key it aliased). A producer calls this
 * only on a branch it can name; it never infers a class from how text looks.
 */
export function chose(field, producer, value, source) {
  const recorder = store.getStore();
  if (!recorder) return value;
  const entry = { field, producer, value: value === undefined || value === null ? value : String(value), ...source };
  if (recorder.current) recorder.current.choices.push(entry);
  else recorder.unscopedChoices.push(entry);
  return value;
}

/**
 * Attach the record to a finished generation result. Returns a NEW result
 * object; nothing already computed is mutated. A result without a draft is
 * returned as is.
 *
 * Two dimensions per clause, kept apart:
 *   artifact_survival  — did the text a producer made reach the artifact?
 *   provenance_status  — RECORDED | NOT_YET_RECORDED | WITHHELD (with reason)
 * A producer's value-level record is attached only when its output IS the
 * shipped text. Observation (which renderer ran, what it read, what it found
 * missing) is attached always, with whether it produced the shipped text.
 */
export function attachProvenance(result, recorder) {
  const draft = result?.draft;
  if (!draft || !Array.isArray(draft.clauses)) return result;

  const events = new Map();
  const push = (id, e) => { if (!id) return; if (!events.has(id)) events.set(id, []); events.get(id).push(e); };
  for (const i of recorder?.injections || []) push(i.clause_id, { kind: "injection", producer: "variableInjector", seq: i.seq, output_sha256: i.output_sha256, rec: i });
  for (const v of recorder?.invocations || []) if (v.has_renderer) push(v.clause_id, { kind: "renderer", producer: "documentHardening", seq: v.seq, output_sha256: v.output_sha256, rec: v });

  const tally = { clauses: draft.clauses.length, survival: {}, status: {}, withheld_reason: {}, renderer_invocations_observed: 0,
    clauses_with_a_renderer: 0, recorded_choices_by_class: {}, choices_withheld: 0, injector_slots_by_class: {} };
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const clauses = {};

  for (const clause of draft.clauses) {
    const id = clause.clause_id;
    const text_sha256 = sha256(clause.text || "");
    const evs = (events.get(id) || []).sort((a, b) => a.seq - b.seq);
    // The producer of the shipped text is the latest event that MADE it: an
    // injection, or a renderer that changed its input. A renderer that ran and
    // handed back its input unchanged reproduced the text; it did not produce it.
    const matching = [...evs].reverse().filter((e) => e.output_sha256 === text_sha256);
    const producing = matching.find((e) => e.kind === "injection" || e.rec.changed_text) || matching[0];
    const latest = evs[evs.length - 1];
    const invs = evs.filter((e) => e.kind === "renderer").map((e) => e.rec);
    const lastInv = invs[invs.length - 1];

    const entry = { text_sha256 };
    if (lastInv) {
      tally.clauses_with_a_renderer += 1;
      tally.renderer_invocations_observed += invs.length;
      entry.renderer = {
        renderer: `documentHardening.renderHardClause[${id}]`,
        invocations: invs.length,
        read_and_present: [...lastInv.read].filter(([, p]) => p).map(([k]) => k).sort(),
        read_and_missing: [...lastInv.read].filter(([, p]) => !p).map(([k]) => k).sort(),
        pass: lastInv.pass,
        available_in_pass: (recorder.passList || [])[lastInv.pass]?.available.length ?? null,
        produced_shipped_text: invs.some((v) => v.output_sha256 === text_sha256),
      };
    }

    if (producing) {
      entry.artifact_survival = { state: SURVIVAL.SURVIVED, producer: producing.producer };
      if (producing.kind === "injection") {
        const slots = producing.rec.slots;
        for (const s of slots) bump(tally.injector_slots_by_class, s.source_class);
        entry.provenance_status = slots.every((s) => s.source_class !== NOT_YET_RECORDED) ? STATUS.RECORDED : STATUS.NOT_YET_RECORDED;
        entry.injector = { template_sha256: producing.rec.template_sha256, slots, unresolved_tokens: producing.rec.unresolved_tokens };
      } else {
        const choices = producing.rec.choices;
        for (const c of choices) bump(tally.recorded_choices_by_class, c.source_class);
        // A renderer is observed, not fully labelled: only selected branches record
        // choices. Its clause is therefore never RECORDED as a whole.
        entry.provenance_status = STATUS.NOT_YET_RECORDED;
        entry.recorded_choices = choices;
      }
    } else {
      entry.artifact_survival = latest
        ? { state: SURVIVAL.TRANSFORMED_AFTER_PRODUCTION, last_producer: latest.producer }
        : { state: SURVIVAL.NO_PRODUCER_OBSERVED };
      entry.provenance_status = STATUS.WITHHELD;
      entry.withheld_reason = entry.artifact_survival.state;
      // The producer's choices exist but describe text that did not ship. Their
      // number is reported; their content is not asserted against this clause.
      const withheldChoices = lastInv?.choices?.length || 0;
      if (withheldChoices) { entry.withheld_choice_count = withheldChoices; tally.choices_withheld += withheldChoices; }
      bump(tally.withheld_reason, entry.withheld_reason);
    }
    bump(tally.survival, entry.artifact_survival.state);
    bump(tally.status, entry.provenance_status);
    clauses[id] = entry;
  }

  const provenance = {
    contract: "D4.42 minimum_provenance_contract, with the D4.43 survival dimension",
    phase: "D4.43",
    instrumentation: { ...INSTRUMENTATION },
    producers_instrumented: [...INSTRUMENTED],
    producers_not_yet_instrumented: PRODUCERS.filter((p) => !INSTRUMENTED.includes(p)),
    $boundary: "Records where a value came from. It does not decide whether any value legally satisfies any proposition, and nothing may read it as if it did.",
    $two_dimensions: "artifact_survival says whether a producer's text reached the artifact; provenance_status says whether where its values came from is recorded. TRANSFORMED_AFTER_PRODUCTION is a survival state, never a source class.",
    $coverage_is_not_provenance: "A renderer block says the renderer ran and what it read. Only recorded_choices say what it chose, and only for the branches instrumented so far.",
    $staleness: "Each clause carries the sha256 of the text this record describes. If the clause is edited or repaired later, the hash no longer matches.",
    summary: tally,
    // What every renderer in a hardening pass could see: the non-empty keys of the
    // variables it was handed. Per clause, renderer.available_in_pass counts them.
    renderer_passes: (recorder?.passList || []).map((p) => ({ pass: p.index, available_keys: p.available })),
    clauses,
  };
  return { ...result, draft: { ...draft, metadata: { ...(draft.metadata || {}), provenance } } };
}
