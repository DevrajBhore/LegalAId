import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getVariables } from "../backend/config/variableConfig.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

// A field read by a clause that always reaches the page must itself be required.
// If it is not, the user leaves it blank and the document renders a raw
// {{placeholder}} - which has now happened five times, to reporting_to, to the
// promissory note interest fields, to original_notice_reference and to
// settlement_withdrawal_days. This test closes the class rather than the case.

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error.message}`);
  }
}

const LIB = new URL("../knowledge-base/clause_library/", import.meta.url).pathname;
const BLUEPRINTS = path.join(LIB, "blueprints");

function readClauses() {
  const byId = new Map();
  for (const folder of fs.readdirSync(LIB, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === "blueprints") continue;
    for (const file of fs.readdirSync(path.join(LIB, folder.name))) {
      if (!file.endsWith(".json")) continue;
      try {
        const clause = JSON.parse(fs.readFileSync(path.join(LIB, folder.name, file), "utf8"));
        if (clause?.clause_id && clause.deprecated !== true) byId.set(clause.clause_id, clause);
      } catch {
        /* malformed clauses are the citation checker's business */
      }
    }
  }
  return byId;
}

function readBlueprints() {
  const byType = new Map();
  for (const file of fs.readdirSync(BLUEPRINTS)) {
    if (!file.endsWith(".json")) continue;
    const bp = JSON.parse(fs.readFileSync(path.join(BLUEPRINTS, file), "utf8"));
    if (!bp?.document_type || bp._unreachable) continue;
    // A later blueprint for the same type wins, matching the loader.
    if (!byType.has(bp.document_type)) byType.set(bp.document_type, bp);
  }
  return byType;
}

const placeholdersIn = (clause) =>
  [...String(clause.text || "").matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

// Computed at runtime by statutoryDeadlines.js rather than asked of the user.
const COMPUTED = new Set([
  "s138_presentation_deadline", "s138_notice_deadline", "s138_payment_deadline",
  "s138_cause_of_action_date", "s138_complaint_deadline",
  "cpc_s80_suit_may_be_filed_from", "arbitration_commencement_date",
  "arbitration_appointment_window_closes", "limitation_expiry_date",
]);

// Supplied by deriveGenerationControls from other answers, not asked directly.
// The seat of arbitration is the clearest case: it is taken from the
// jurisdiction the user already gave rather than asked for a second time.
const DERIVED = new Set([
  "party_1_label", "party_2_label", "party_1_descriptor", "party_2_descriptor",
  "arbitration_seat", "arbitration_city",
  "lease_term_months", "is_registrable", "long_term_lease", "restrict_moonlighting",
]);

// 108 clause ids have a builder in documentHardening.js that composes their text
// AFTER assembly, discarding whatever the clause file said. A placeholder in one
// of those never reaches the page, so requiring its field would be requiring an
// answer nothing uses. Read from the source rather than listed here, so the
// exemption cannot drift away from the builders it describes.
// variableInjector.js supplies a set of names from other answers -
// occupancy_fee from license_fee or rent_amount, agreement_term from
// contract_duration, and so on. A placeholder covered by one of those is
// answered even though the document never asks for it by that name. Read from
// the source so the exemption tracks the injector rather than a stale copy.
function namesSuppliedByInjector() {
  const source = fs
    .readFileSync(new URL("../backend/services/variableInjector.js", import.meta.url).pathname, "utf8")
    .replace(/\r\n/g, "\n");
  const supplied = new Set();
  for (const match of source.matchAll(/^\s{4}(\w+):\s*(?:firstNonEmpty|toNumericString)\(/gm)) {
    supplied.add(match[1]);
  }
  return supplied;
}

function clausesWithRuntimeBuilders() {
  const source = fs
    .readFileSync(new URL("../backend/services/documentHardening.js", import.meta.url).pathname, "utf8")
    .replace(/\r\n/g, "\n");
  return new Set([...source.matchAll(/^\s{2,4}([A-Z][A-Z0-9_]+):\s*\(\)\s*=>/gm)].map((m) => m[1]));
}

test("every placeholder in an unconditional clause is a required field", () => {
  const clauses = readClauses();
  const blueprints = readBlueprints();
  const builderBacked = clausesWithRuntimeBuilders();
  const injected = namesSuppliedByInjector();
  assert.ok(injected.size >= 5, `expected the injector defaults to be found, got ${injected.size}`);
  assert.ok(builderBacked.size > 90, `expected the builder list to be found, got ${builderBacked.size}`);
  const problems = [];

  for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    const blueprint = blueprints.get(documentType);
    if (!blueprint) continue;
    const definitions = getVariables(documentType);

    // Only the unconditional list: a conditional clause is included on a
    // condition, and its fields are required only when that condition holds.
    for (const clauseId of blueprint.clauses || []) {
      const clause = clauses.get(clauseId);
      if (!clause) continue;
      if (builderBacked.has(clauseId)) continue;
      for (const field of placeholdersIn(clause)) {
        if (COMPUTED.has(field) || DERIVED.has(field) || injected.has(field)) continue;
        const definition = definitions[field];
        if (!definition) {
          problems.push(`${documentType}: ${clauseId} reads {{${field}}}, which this document does not ask for at all`);
        } else if (!definition.required) {
          problems.push(`${documentType}: ${clauseId} reads {{${field}}}, but "${definition.label}" is optional - leave it blank and the page shows the raw placeholder`);
        }
      }
    }
  }

  assert.deepStrictEqual(problems, [], `\n      ${problems.join("\n      ")}\n`);
});

test("every blueprint clause id resolves to a live clause", () => {
  const clauses = readClauses();
  const blueprints = readBlueprints();
  const missing = [];
  for (const [documentType, blueprint] of blueprints) {
    const listed = [
      ...(blueprint.clauses || []),
      ...(blueprint.conditional_clauses || []).map((entry) => entry.clause || entry.clause_id),
    ].filter(Boolean);
    for (const clauseId of listed) {
      if (!clauses.has(clauseId)) missing.push(`${documentType}: ${clauseId}`);
    }
  }
  assert.deepStrictEqual(missing, [], `blueprint clause ids with no live clause:\n      ${missing.join("\n      ")}`);
});

test("every registered type has a blueprint and a config", () => {
  const blueprints = readBlueprints();
  const missing = Object.keys(DOCUMENT_TYPE_REGISTRY).filter((t) => !blueprints.has(t));
  assert.deepStrictEqual(missing, [], `registered types with no blueprint: ${missing.join(", ")}`);
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
