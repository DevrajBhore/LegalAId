/**
 * statutoryCustody.test.mjs — WHAT LAW LEAVES WHEN A USER ANSWERS "NO"
 *
 * A conditional clause that is the ONLY clause citing a given Act takes that
 * Act's coverage with it when its gate closes. Sixty-one such pairings exist
 * across twenty-eight document types.
 *
 * MOST OF THEM ARE CORRECT, AND THAT IS WHY THIS IS A RATCHET AND NOT A
 * PASS/FAIL. `EMP_MATERNITY_BENEFITS_001` is gated on `is_female_employee` and
 * is the sole source of Code on Social Security Chapter VI — a male employee's
 * contract SHOULD stop citing maternity provisions.
 * `IPA_COPYRIGHT_ASSIGNMENT_001` is the sole source of Copyright Act s.19 and
 * should leave when no copyright is assigned. Asserting zero here would demand
 * that every document cite every statute, which is nonsense.
 *
 * THE DEFECT IS NARROWER: when the Act that leaves is about a subject the gate
 * does not ask about. `SERVICE_KEY_PERSONNEL_001` is the worked example. Its
 * gate concerns whether particular individuals matter (Indian Contract Act 1872
 * s.40). Its last sentence allocates principal-employer exposure under Code on
 * Wages 2019 s.43 and EPF Act 1952 s.8A, which is true of any services
 * engagement whatever. Moving that clause behind `key_person_dependency` — the
 * obvious reading of the D4.3 GATE_FACT_MISMATCH finding — would delete the only
 * sentence allocating that exposure from every MSA that does not depend on named
 * people.
 *
 * Whether a loss is intended is a legal question and this layer may not answer
 * it. So the inventory is recorded, each entry carries a disposition an advocate
 * can set, and the test fails on any pairing that appears or disappears without
 * the record being updated. Undecided entries stay undecided rather than being
 * counted as either safe or broken.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const RECORD = path.join(ROOT, "knowledge-base/governance/statutory-custody.json");

const BLUEPRINT_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const gatesByType = new Map();
for (const file of fs.readdirSync(BLUEPRINT_DIR).filter((f) => f.endsWith(".json"))) {
  const bp = JSON.parse(fs.readFileSync(path.join(BLUEPRINT_DIR, file), "utf8"));
  const map = new Map();
  for (const entry of bp.conditional_clauses || []) {
    if (entry.clause && entry.include_if) map.set(entry.clause, entry.include_if);
  }
  if (map.size) gatesByType.set(bp.document_type, map);
}

const cite = (b) => (b.act ? (b.section ? `${b.act} s.${b.section}` : b.act) : null);

const found = new Map();
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const gates = gatesByType.get(documentType);
  if (!gates) continue;
  let clauses;
  try {
    const result = await generateDocument({
      document_type: documentType,
      variables: variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    });
    clauses = result.draft?.clauses || [];
  } catch { continue; }
  if (!clauses.length) continue;

  const custodians = new Map();
  for (const clause of clauses) {
    for (const basis of clause.legal_basis || []) {
      const key = cite(basis);
      if (!key) continue;
      if (!custodians.has(key)) custodians.set(key, new Set());
      custodians.get(key).add(clause.clause_id);
    }
  }

  for (const clause of clauses) {
    if (!gates.has(clause.clause_id)) continue;
    const sole = [...new Set((clause.legal_basis || []).map(cite).filter(Boolean))]
      .filter((act) => custodians.get(act).size === 1).sort();
    if (sole.length) found.set(`${documentType}/${clause.clause_id}`, sole);
  }
}

/* ── the record ─────────────────────────────────────────────────────────── */

if (!fs.existsSync(RECORD)) {
  fs.mkdirSync(path.dirname(RECORD), { recursive: true });
  fs.writeFileSync(RECORD, JSON.stringify({
    $comment: [
      "Conditional clauses that are the sole citation of a statute in the documents they appear in.",
      "Answering the gate 'no' removes that statute from the document entirely.",
      "",
      "disposition is an AUTHORING decision, never derived:",
      "  INTENDED      the loss is correct — the statute does not apply when the gate is closed",
      "  BLOCKED       the loss is NOT correct; the clause carries an obligation unrelated to its gate",
      "  NOT_REVIEWED  nobody has decided yet. The honest default.",
      "",
      "Regenerate the inventory with: node tests/statutoryCustody.test.mjs --write",
    ],
    entries: Object.fromEntries([...found.entries()].sort()
      .map(([k, acts]) => [k, { acts, disposition: "NOT_REVIEWED", note: null }])),
  }, null, 2));
  console.log(`statutoryCustody: recorded ${found.size} pairings for review`);
}

const record = JSON.parse(fs.readFileSync(RECORD, "utf8"));

if (process.argv.includes("--write")) {
  const entries = {};
  for (const [key, acts] of [...found.entries()].sort()) {
    entries[key] = record.entries[key]
      ? { ...record.entries[key], acts }
      : { acts, disposition: "NOT_REVIEWED", note: null };
  }
  fs.writeFileSync(RECORD, JSON.stringify({ ...record, entries }, null, 2));
  console.log(`statutoryCustody: rewrote ${Object.keys(entries).length} pairings`);
  process.exit(0);
}

let checks = 0;

const appeared = [...found.keys()].filter((k) => !record.entries[k]);
assert.deepStrictEqual(appeared, [],
  "A conditional clause has become the sole citation of a statute, with no decision recorded:\n" +
  appeared.map((k) => `  ${k} -> ${found.get(k).join("; ")}`).join("\n") +
  "\nDecide whether that loss is intended, then re-record with --write.");
checks += 1;

const vanished = Object.keys(record.entries).filter((k) => !found.has(k));
assert.deepStrictEqual(vanished, [],
  "Recorded pairings no longer occur. If repaired, re-record with --write:\n" +
  vanished.map((k) => `  ${k}`).join("\n"));
checks += 1;

/*
 * A BLOCKED pairing is a live defect with a known cause. It may not be quietly
 * resolved by moving the clause behind the gate that would cause the loss — the
 * whole point of the disposition is that somebody decided the loss is wrong.
 */
for (const [key, entry] of Object.entries(record.entries)) {
  if (entry.disposition !== "BLOCKED") continue;
  const [documentType, clauseId] = key.split("/");
  const gate = gatesByType.get(documentType)?.get(clauseId);
  assert.ok(entry.note, `${key}: a BLOCKED pairing must say why`);
  assert.ok(!entry.blocked_gate || gate !== entry.blocked_gate,
    `${key} has been moved behind '${entry.blocked_gate}', the exact change recorded as a ` +
    `legal regression:\n  ${entry.note}`);
  checks += 1;
}

const undecided = Object.values(record.entries).filter((e) => e.disposition === "NOT_REVIEWED").length;
const blocked = Object.values(record.entries).filter((e) => e.disposition === "BLOCKED").length;
console.log(`PASS  statutory custody: ${found.size} pairings, ${blocked} blocked, ${undecided} awaiting a legal decision`);
console.log(`\nALL GREEN (${checks} checks)`);
