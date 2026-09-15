/**
 * conceptResolver.js — THE MISSING LINK BETWEEN THE LAW AND THE DOCUMENT
 *
 * The D4.3 trace measured the defect this module exists to close. Seventeen
 * facts, across two planes that were never joined:
 *
 *   semantic_facts.json   provenance, canonical resolution, requirement
 *                         applicability — and no statute, no section, no clause.
 *   knowledge-base/concepts  45 section-deep citations, role/event dimensions,
 *                         detection with provenance, confirmation questions,
 *                         `attaches` lists — and no resolver, so nothing read
 *                         them at runtime.
 *
 * Three facts reached the document. Ten carried statutory authority. NONE did
 * both. Everything that reached a clause was a drafting choice or a derived
 * flag; everything that carried law reached nothing.
 *
 * WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT. A blueprint gate may now
 * read `concept:PERSONAL_DATA_PROCESSING` instead of a raw boolean. The clause
 * that ships is the same clause; what changes is that its presence now has a
 * reason that can be stated in full:
 *
 *     the user answered involves_personal_data
 *       -> PERSONAL_DATA_PROCESSING resolved PRESENT, provenance DECLARED
 *       -> under DPDP Act 2023 ss.8(2), 8(5), 8(6), 8(7)
 *       -> CORE_DATA_PROCESSING_001 is attached by that concept
 *
 * and, just as importantly, its ABSENCE has one too.
 *
 * THE FRAGMENTATION THIS REPLACES. One legal question — is personal data
 * processed under this arrangement — is asked by five different gate names
 * across nineteen blueprints: `involves_personal_data`, `processes_personal_data`,
 * `company_processes_personal_data`, `firm_processes_personal_data`,
 * `jv_processes_personal_data`. Each was locally reasonable and none knows about
 * the others, so DPDP applicability is nineteen separate decisions that happen
 * to agree. The concept makes it one decision with one authority.
 *
 * PROVENANCE IS LOAD-BEARING, NOT DECORATIVE. A resolution carries how it was
 * reached, and DECLARED is not INFERRED. The classifier branch is advisory by
 * construction: an inferred resolution never attaches clauses on its own, it
 * raises the concept's confirmation question. Attaching ten data-processing
 * clauses because a services description mentioned "customer records" would be
 * fabricating an obligation, which is the failure this whole architecture is
 * built to refuse.
 *
 * SILENCE IS NOT A NO. An unresolved concept takes the record's own
 * `unresolved_behaviour`, which for personal data is `assume: absent` with
 * `disclose: true` — because attaching a DPA to an arrangement that handles no
 * personal data produces an obviously wrong document, while staying silent about
 * having assumed so would hide the assumption. The opposite direction is correct
 * for other concepts (MSME's cap is safe to assume and unsafe to omit), which is
 * exactly why the behaviour is authored per concept rather than hardcoded here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONCEPT_DIR = path.resolve(HERE, "../../knowledge-base/concepts");

/** Resolution states. PRESENT/ABSENT are findings; UNRESOLVED is the honest gap. */
export const CONCEPT_STATE = { PRESENT: "PRESENT", ABSENT: "ABSENT", UNRESOLVED: "UNRESOLVED" };

/** How a resolution was reached. Only DECLARED and DERIVED may attach clauses. */
export const CONCEPT_PROVENANCE = { DECLARED: "declared", DERIVED: "derived", INFERRED: "inferred" };

let cache = null;

export function loadConcepts() {
  if (cache) return cache;
  cache = new Map();
  if (!fs.existsSync(CONCEPT_DIR)) return cache;
  for (const file of fs.readdirSync(CONCEPT_DIR)) {
    if (!file.endsWith(".json") || file.includes("schema") || file === "dimensions.json") continue;
    const record = JSON.parse(fs.readFileSync(path.join(CONCEPT_DIR, file), "utf8"));
    if (record?.concept_id) cache.set(record.concept_id, record);
  }
  return cache;
}

/** Exposed for tests that need a clean load after editing records on disk. */
export function clearConceptCache() { cache = null; }

/**
 * Evaluate one `when` clause of a detection source.
 *
 * Deliberately small. A general expression language here would be a second
 * evaluator competing with the blueprint one, and the concept records were
 * authored against these operators only.
 */
function matches(condition, values) {
  const actual = values?.[condition.var];
  switch (condition.op) {
    case "present":
      return actual !== undefined && actual !== null && String(actual).trim() !== "";
    case "eq":
      return normaliseBoolean(actual) === normaliseBoolean(condition.value);
    case "in":
      return (condition.value || []).some((v) => normaliseBoolean(actual) === normaliseBoolean(v));
    default:
      return false;
  }
}

/**
 * "Yes"/"true"/true are the same answer wearing three costumes.
 *
 * The intake stores "Yes"; generationControls derives `true`; the concept record
 * was authored with the string "true". A resolver that compared these literally
 * would report ABSENT for a user who plainly said yes — the shape of the Phase B
 * raw-"Yes" leak, which cost a whole repair cycle.
 */
function normaliseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().toLowerCase();
  if (["yes", "true", "y"].includes(text)) return true;
  if (["no", "false", "n"].includes(text)) return false;
  return text;
}

/**
 * Resolve one concept against the intake answers and derived controls.
 *
 * @param {object} record     the concept record
 * @param {object} variables  intake answers
 * @param {object} controls   derived generation controls
 */
export function resolveConcept(record, variables = {}, controls = {}) {
  const values = { ...variables, ...controls };
  const evidence = [];

  for (const source of record.detection?.a_structured || []) {
    const raw = String(source.source || "");
    const name = raw.replace(/^(field|control):/, "");
    const provenance = source.provenance === "derived"
      ? CONCEPT_PROVENANCE.DERIVED : CONCEPT_PROVENANCE.DECLARED;

    /*
     * A source with no `when` sets attributes but does not by itself establish
     * the concept. `data_categories` being present says what kind of data, not
     * that any is processed.
     */
    const conditions = source.when || [];
    const seen = values[name] !== undefined && values[name] !== null && String(values[name]).trim() !== "";

    if (!conditions.length) {
      if (seen) evidence.push({ source: raw, provenance, state: "ATTRIBUTE", value: values[name] });
      continue;
    }
    if (!seen) continue;

    const held = conditions.every((c) => matches(c, values));
    evidence.push({
      source: raw, provenance,
      state: held ? CONCEPT_STATE.PRESENT : CONCEPT_STATE.ABSENT,
      value: values[name],
    });
  }

  const positive = evidence.find((e) => e.state === CONCEPT_STATE.PRESENT);
  const negative = evidence.find((e) => e.state === CONCEPT_STATE.ABSENT);

  let state = CONCEPT_STATE.UNRESOLVED;
  let provenance = null;
  if (positive) { state = CONCEPT_STATE.PRESENT; provenance = positive.provenance; }
  else if (negative) { state = CONCEPT_STATE.ABSENT; provenance = negative.provenance; }

  /*
   * The unresolved branch. The record decides, not this module — and whichever
   * way it decides, `disclose` means the assumption is stated rather than made
   * silently. An assumption the user never sees is indistinguishable from a
   * fabrication.
   */
  let assumed = false;
  if (state === CONCEPT_STATE.UNRESOLVED) {
    const behaviour = record.unresolved_behaviour || {};
    if (behaviour.assume === "absent") { state = CONCEPT_STATE.ABSENT; assumed = true; }
    else if (behaviour.assume === "safe_default") { state = CONCEPT_STATE.PRESENT; assumed = true; }
  }

  return {
    concept_id: record.concept_id,
    label: record.label,
    state,
    provenance,
    assumed,
    disclose: assumed ? Boolean(record.unresolved_behaviour?.disclose) : false,
    confirmation: state === CONCEPT_STATE.UNRESOLVED || assumed ? record.confirmation || null : null,
    authority: (record.authority || []).map((a) => ({
      act: a.act, section: a.section, note: a.note, verified: Boolean(a.verified),
    })),
    attaches: record.attaches?.clauses || [],
    disclosures: record.attaches?.disclosures || [],
    evidence,
    review_status: record.review_status || null,
  };
}

/** Resolve every concept the repository holds. */
export function resolveConcepts(variables = {}, controls = {}) {
  const out = new Map();
  for (const record of loadConcepts().values()) {
    out.set(record.concept_id, resolveConcept(record, variables, controls));
  }
  return out;
}

/**
 * Does this concept attach clauses in this document?
 *
 * PRESENT is necessary and not sufficient. An INFERRED resolution is advisory:
 * it asks the confirmation question rather than attaching obligations on the
 * strength of a classifier reading a free-text field.
 */
export function conceptAttaches(resolution) {
  if (!resolution) return false;
  if (resolution.state !== CONCEPT_STATE.PRESENT) return false;
  return resolution.provenance !== CONCEPT_PROVENANCE.INFERRED;
}

/**
 * Why is this clause here — or why is it not?
 *
 * The north-star question, answerable for any clause a concept governs. Returns
 * null for a clause no concept claims, which is the honest answer for most of
 * the library today rather than a manufactured rationale.
 */
export function explainClause(clauseId, resolutions) {
  for (const resolution of resolutions.values()) {
    if (!resolution.attaches.includes(clauseId)) continue;
    const cites = resolution.authority
      .map((a) => `${a.act}${a.section ? ` s.${a.section}` : ""}`).join(", ");
    if (conceptAttaches(resolution)) {
      return {
        clause_id: clauseId, included: true, concept: resolution.concept_id,
        because: `${resolution.label}. Established ${resolution.provenance} from ` +
          `${resolution.evidence.filter((e) => e.state === "PRESENT").map((e) => e.source).join(", ") || "the intake"}` +
          `${resolution.assumed ? " (assumed, not answered)" : ""}. Authority: ${cites || "none cited"}.`,
        authority: resolution.authority,
        provenance: resolution.provenance,
        assumed: resolution.assumed,
      };
    }
    return {
      clause_id: clauseId, included: false, concept: resolution.concept_id,
      because: resolution.state === CONCEPT_STATE.UNRESOLVED
        ? `${resolution.label} has not been established, and the concept declines to assume it.`
        : resolution.assumed
          ? `${resolution.label} was not answered; the concept assumes it absent and says so.`
          : `${resolution.label} was answered in the negative.`,
      authority: resolution.authority,
      provenance: resolution.provenance,
      assumed: resolution.assumed,
    };
  }
  return null;
}
