/**
 * gateReachability.test.mjs — A GATE MUST BE ANSWERABLE
 *
 * D4.3 found a failure shape that every earlier probe was blind to. The
 * blueprint offers a clause behind `include_if: include_insurance == true`. The
 * clause is authored, cited and reviewed. The requirement matrix is consistent.
 * The clause baseline is stable. And no user can ever obtain the clause, because
 * `include_insurance` is a derived control that is null for this family and no
 * intake answer moves it.
 *
 * Its mirror is worse and commoner: a control frozen TRUE. The blueprint reads
 * as though the user chooses, the document ships the clause either way, and
 * nothing in any artifact is wrong — which is exactly the complaint that opened
 * Phase D. A gate on a constant is not a gate; it is decoration with the shape
 * of a choice.
 *
 * WHY THIS IS A RATCHET AND NOT A GREEN ASSERTION. Three unreachable clauses and
 * six frozen gates are live right now. Asserting zero would fail the suite and
 * teach nothing, and asserting nothing would let the next one in unnoticed. So
 * the known set is recorded here and the test fails on ANY departure from it —
 * a new frozen gate fails, and so does a repair that is not recorded. Repairing
 * one means deleting its line, which is the point: the record shrinks, never
 * silently.
 *
 * WHAT THIS TEST DOES NOT CLAIM. That a frozen gate is always a defect. A
 * control may be constant for a family because the family genuinely always needs
 * the clause — in which case the repair is to delete the gate, not to wire a
 * question to it. The test does not decide which; it refuses to let the
 * situation go unrecorded.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { loadConcepts } from "../backend/services/conceptResolver.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
const LITERALS = new Set(["true", "false", "null", "undefined", "and", "or", "not"]);

/**
 * The inventory lives in knowledge-base/governance/frozen-gates.json, not here.
 *
 * It began as seven entries inline, which was viable only because the guard was
 * scoped to three families. Run over all forty it is fifty — the other
 * forty-three were never absent, only unexamined. An inventory that size is
 * knowledge and belongs in the knowledge layer, where an advocate can set a
 * disposition per entry without editing a test.
 */
const RECORD = path.join(ROOT, "knowledge-base/governance/frozen-gates.json");
const record = JSON.parse(fs.readFileSync(RECORD, "utf8"));
const KNOWN_FROZEN = new Map(Object.entries(record.entries).map(([k, v]) => [k, v.control]));

const FAMILIES = Object.keys(DOCUMENT_TYPE_REGISTRY).sort();
const BLUEPRINT_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const blueprints = fs.readdirSync(BLUEPRINT_DIR).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(BLUEPRINT_DIR, f), "utf8")));

let checks = 0;
const found = new Map();
const detail = new Map();

for (const documentType of FAMILIES) {
  const bp = blueprints.find((b) => b.document_type === documentType);
  if (!bp) continue;  // a registered type with no blueprint has no gates to check

  const schema = getVariables(documentType) || {};
  const base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const baseline = deriveControlsForDocument(documentType,
    sanitizeVariablesForDocument(documentType, base)) || {};

  /** Perturbation, not inspection: the only way to know a control is reachable. */
  const answerable = new Map();
  const movable = (control) => {
    if (answerable.has(control)) return answerable.get(control);
    let result = false;
    for (const [field, def] of Object.entries(schema)) {
      const options = def.type === "select" && Array.isArray(def.options) ? def.options
        : def.type === "boolean" ? [true, false] : null;
      if (!options) continue;
      for (const option of options) {
        const controls = deriveControlsForDocument(documentType,
          sanitizeVariablesForDocument(documentType, { ...base, [field]: option })) || {};
        if (JSON.stringify(controls[control]) !== JSON.stringify(baseline[control])) { result = true; break; }
      }
      if (result) break;
    }
    answerable.set(control, result);
    return result;
  };

  for (const entry of bp.conditional_clauses || []) {
    if (!entry.clause || !entry.include_if) continue;
    checks += 1;
    /*
     * A concept gate reads the concept's own establishing detection sources, not
     * the literal words of the expression. Without this the identifier scan
     * pulls out `concept` and the concept id and calls both unmovable controls —
     * the test would report every concept-governed clause as frozen, which is
     * the reachability question asked of the wrong names.
     */
    const reads = entry.include_if.startsWith("concept:")
      ? (loadConcepts().get(entry.include_if.slice("concept:".length).trim())
          ?.detection?.a_structured || [])
          .filter((src) => Array.isArray(src.when) && src.when.length
            && !(src.sets && Object.keys(src.sets).length))
          .map((src) => String(src.source || "").replace(/^(field|control):/, ""))
      : [...new Set((entry.include_if.match(IDENT) || []).filter((t) => !LITERALS.has(t)))];
    for (const control of reads) {
      if (movable(control)) continue;
      const key = `${documentType}/${entry.clause}`;
      found.set(key, control);
      detail.set(key, { control, include_if: entry.include_if,
        value: baseline[control] === undefined ? null : baseline[control] });
    }
  }
}

if (process.argv.includes("--write")) {
  const entries = {};
  for (const [key, d] of [...detail.entries()].sort()) {
    entries[key] = record.entries[key] ? { ...record.entries[key], ...d } : { ...d, disposition: "NOT_REVIEWED", note: null };
  }
  fs.writeFileSync(RECORD, JSON.stringify({ ...record, entries }, null, 2));
  console.log(`gateReachability: rewrote ${Object.keys(entries).length} frozen gates`);
  process.exit(0);
}

const appeared = [...found.keys()].filter((k) => !KNOWN_FROZEN.has(k));
assert.deepStrictEqual(appeared, [],
  `New frozen gate(s). A clause is offered behind a control no intake answer can move:\n` +
  appeared.map((k) => `  ${k} reads '${found.get(k)}'`).join("\n") +
  `\nEither wire the control to a question, or delete the gate because the family always needs the clause.`);

const repaired = [...KNOWN_FROZEN.keys()].filter((k) => !found.has(k));
assert.deepStrictEqual(repaired, [],
  `Frozen gate(s) repaired but still recorded as known. Delete these lines from KNOWN_FROZEN:\n` +
  repaired.map((k) => `  ${k}`).join("\n"));

for (const [key, control] of found) {
  assert.strictEqual(found.get(key), KNOWN_FROZEN.get(key),
    `${key} is now frozen on '${control}', was recorded as '${KNOWN_FROZEN.get(key)}'`);
}

const undecided = Object.values(record.entries).filter((e) => e.disposition === "NOT_REVIEWED").length;
console.log(`gateReachability: ${checks} gates across ${FAMILIES.length} families; ` +
  `${found.size} frozen, ${undecided} awaiting an authoring decision`);
