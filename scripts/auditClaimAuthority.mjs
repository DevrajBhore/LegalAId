/**
 * auditClaimAuthority.mjs
 *
 * WHICH SHIPPED CLAIMS CAN BECOME AFFIRMATIVE OUTPUT WITHOUT AN AUTHORITATIVE
 * FACT ESTABLISHING THE PROPOSITION?
 *
 * Not "which families have ungated clauses". Plenty of ungated clauses are
 * perfectly proper: a governing-law clause asserts nothing about the world, it
 * constitutes something between the parties, and it needs no fact behind it.
 * The question is narrower and it is the one that matters:
 *
 *     the document tells the reader something IS THE CASE,
 *     and nothing in the system established that it is.
 *
 * Two populations, measured separately, because they fail differently:
 *
 *   CLAUSES (40 families, every clause that can reach signed output)
 *     Does the clause assert a fact, and if so does anything gate or fill it?
 *
 *   REQUIREMENTS (the families with authored identity requirements)
 *     What is each requirement's applicability SOURCE, and can that source
 *     ever be the world rather than the user?
 *
 * On the instrument: claim type is read from grammatical MOOD, which is a
 * screen and is reported as one. "The Parties shall maintain confidentiality"
 * is deontic — it creates an obligation and asserts nothing. "The platform uses
 * analytics cookies" is present indicative with a real-world subject — it tells
 * the reader a fact. The screen is deliberately narrow and its misses are
 * counted rather than hidden: every sentence it fires on is printable with
 * --show so the classification can be checked by a person rather than trusted.
 *
 * Run: node scripts/auditClaimAuthority.mjs [--show] [--family TYPE]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { loadFactRegistry } from "../backend/services/factRegistry.js";
import { reachableControlsFor } from "../backend/services/derivationAdapter.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHOW = process.argv.includes("--show");
const ONLY = process.argv.includes("--family")
  ? process.argv[process.argv.indexOf("--family") + 1] : null;

// ── Axis 2: claim type ──────────────────────────────────────────────────────
//
// Ordered most specific first; a sentence is classified once.
const CLAIM_TYPES = [
  ["regulatory status",
   /\b(is|are|has been|have been)\s+(a\s+|an\s+|duly\s+)?(registered|incorporated|licensed|certified|recognised|recognized|empanelled)\b/i],
  ["service practice",
   /\b(the platform|the service|the website|the app|the application|the portal)\s+(uses?|collects?|stores?|shares?|processes?|retains?|employs?|deploys?|offers?|provides?|maintains?)\b/i],
  ["service practice",
   /\b(we|us)\s+(use|collect|store|share|process|retain|offer|provide|maintain)\b/i],
  ["party fact",
   /\b(the company|the employer|the data fiduciary|the landlord|the lessor|the donor|the discloser|the disclosing party)\s+(is|are|has|have|maintains?|holds?|owns?|operates?|employs?|has designated)\b/i],
  ["external-world condition",
   /\b(the premises|the goods|the property|the shares|the equipment)\s+(is|are|has|have)\b/i],
  ["user-facing capability",
   /\busers?\s+(may|can)\s+(opt out|control|submit|request|access|withdraw)\b/i],
  ["user-facing capability",
   /\b(may be submitted|can be submitted|may be exercised)\b/i],
];

// Deontic mood constitutes rather than asserts, and never needs a fact behind it.
const DEONTIC = /\b(shall|must|agrees? to|undertakes? to|covenants?|will not|may not|shall not)\b/i;
// Self-referential: about this instrument, not about the world.
const SELF = /\b(this agreement|this policy|this deed|this notice|these terms|the parties hereto|hereof|herein)\b/i;

const classify = (sentence) => {
  if (DEONTIC.test(sentence)) return null;
  for (const [type, pattern] of CLAIM_TYPES) if (pattern.test(sentence)) return type;
  return null;
};

// ── Load the world ──────────────────────────────────────────────────────────
const clauses = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c]));
const blueprints = {};
const BP_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
for (const name of fs.readdirSync(BP_DIR).filter((n) => n.endsWith(".blueprint.json"))) {
  const bp = JSON.parse(fs.readFileSync(path.join(BP_DIR, name), "utf8"));
  if (bp.document_type) blueprints[bp.document_type] = bp;
}
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types || {};

// ── Axis 1 + 3: where could a gate's fact come from? ────────────────────────
// PER DOCUMENT, not globally. sanitizeVariablesForDocument filters intake to the
// document's OWN schema, so a field that exists in some other family's config is
// not a source for this one -- it is dropped before clause selection ever sees
// it. Asking the global set said five gates rested on a user answer that cannot
// reach them, and made this script disagree with measurementIntegrity by three.
const askableIn = (documentType) => new Set(Object.keys(getVariables(documentType) || {}));
const registry = loadFactRegistry();
const derivable = new Set();
for (const fact of registry.facts || []) {
  if (fact.id) derivable.add(fact.id);
  for (const treatment of fact.treatments || []) if (treatment.flag) derivable.add(treatment.flag);
}
// Derivability is PROBED, per document type and with variables both empty and
// filled -- never read off a hand-written list. A hand-written alias table is
// what once reported sixteen unreachable gates, all sixteen of them false.
// DERIVABILITY IS PROBED WITH THE SCHEMA'S OWN FIXTURES, AND THE ARGUMENTS ARE
// IN THE RIGHT ORDER. Both halves of that sentence were wrong here once, and
// each produced a confident false measurement:
//
//   1. deriveGenerationControls(documentType, variables) -- documentType FIRST.
//      Called the other way round it silently returns almost nothing, and every
//      gate reads as resting on no source. That error reported 29 orphan
//      propositions where there are 14, and drove a whole abstraction.
//   2. The fixture must be the schema's own synthetic intake, not values I
//      invent. Probing lender_type with "Bank" and "NBFC" found nothing because
//      the declared option is "Scheduled Bank".
//
// buildVariables is the baseline's own fixture builder, so the probe measures
// what the recorded baseline measures rather than a second fixture that drifts.
const derivedCache = new Map();
// Populated eagerly for every type the script will ask about, so the lookup
// below stays synchronous and no call site has to remember to await it.
for (const documentType of Object.keys(blueprints)) {
  derivedCache.set(documentType, await reachableControlsFor(documentType));
}
const derivedFor = (documentType) => derivedCache.get(documentType) || new Set();
const sourceOf = (flag, documentType) => {
  const name = String(flag || "").replace(/^!/, "").split(/[\s=!<>]/)[0].trim();
  if (!name) return "unconditional";
  if (askableIn(documentType).has(name)) return "position (user answer)";
  if (derivable.has(name) || derivedFor(documentType).has(name)) return "deterministic fact";
  return "no source at all";
};

// ── The clause population ───────────────────────────────────────────────────
const rows = [];
const types = Object.keys(blueprints).filter((t) => !ONLY || t === ONLY).sort();
for (const documentType of types) {
  const bp = blueprints[documentType];
  const gated = new Map();
  for (const entry of bp.conditional_clauses || []) {
    if (entry.clause) gated.set(entry.clause, entry.include_if || entry.when || "");
  }
  const emitted = baseline[documentType]?.full?.clauses
    || [...new Set([...(bp.clauses || []), ...(bp.required_clauses || [])])];

  for (const id of emitted) {
    const text = clauses[id]?.text || "";
    if (!text) continue;
    const sentences = text.split(/(?<=[.;])\s+/);
    for (const sentence of sentences) {
      const type = classify(sentence);
      if (!type) continue;
      const filled = /\{\{\s*[\w.]+\s*\}\}/.test(sentence);
      const gate = gated.has(id) ? gated.get(id) : null;
      rows.push({
        documentType, id, type, sentence: sentence.trim(),
        // The three ways a proposition could have been established.
        gate, gateSource: gate === null ? "unconditional" : sourceOf(gate, documentType),
        filled,
      });
    }
  }
}

// A claim is AUTHORITATIVE if something established the proposition: either the
// clause only reaches output when a governed fact says so, or the assertion is
// filled from a field the user supplied. Otherwise it is published on nobody's
// authority.
const authoritative = (row) =>
  (row.gate !== null && row.gateSource !== "no source at all") || row.filled;
const unfounded = rows.filter((r) => !authoritative(r));

console.log("=".repeat(100));
console.log("SHIPPED CLAIMS WITH NO AUTHORITATIVE FACT BEHIND THEM");
console.log("=".repeat(100));
const byType = {};
for (const row of unfounded) (byType[row.type] ||= []).push(row);
for (const [type, list] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  const families = new Set(list.map((r) => r.documentType));
  const clauseIds = new Set(list.map((r) => r.id));
  console.log(
    `${type.padEnd(30)} ${String(list.length).padStart(4)} assertions  ` +
    `${String(clauseIds.size).padStart(3)} clauses  ${String(families.size).padStart(3)} families`
  );
}
console.log("-".repeat(100));
console.log(
  `${String(unfounded.length).padStart(4)} assertions total, in ` +
  `${new Set(unfounded.map((r) => r.id)).size} clauses, reaching ` +
  `${new Set(unfounded.map((r) => r.documentType)).size} of ${types.length} families.`
);
console.log(
  `${String(rows.length - unfounded.length).padStart(4)} assertions DO rest on something: a ` +
  `governed gate or a field the user supplied.`
);

console.log(
  "\nThe screen is a FLOOR. It fires only on an enumerated list of real-world subjects and\n" +
  "vetoes every sentence in deontic mood, so a claim phrased with a subject it does not know\n" +
  "is invisible to it. Treat these as the assertions found, never as the assertions present."
);
console.log("\nBy family (families shipping the most unfounded assertions first):");
const perFamily = {};
for (const row of unfounded) (perFamily[row.documentType] ||= new Set()).add(row.id);
for (const [documentType, ids] of Object.entries(perFamily).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${documentType.padEnd(38)} ${String(ids.size).padStart(3)} clauses`);
}

if (SHOW) {
  console.log("\n" + "=".repeat(100));
  console.log("EVERY ASSERTION THE SCREEN FIRED ON — check the classification, do not trust it");
  console.log("=".repeat(100));
  const seen = new Set();
  for (const row of unfounded) {
    if (seen.has(row.id + row.sentence)) continue;
    seen.add(row.id + row.sentence);
    console.log(`\n[${row.type}] ${row.id}`);
    console.log(`  ${row.sentence.slice(0, 230)}`);
  }
}

// ── The gating census: no language model in it at all ───────────────────────
//
// The screen above is NARROW BY CONSTRUCTION -- it fires only on an enumerated
// list of real-world subjects and vetoes anything in deontic mood -- so its
// count is a floor, not a measurement, and it is reported as one. This census
// is not a screen. It reads the blueprints and counts, and it is the number
// that actually decides whether applicability needs a world source: how much of
// what every family ships is conditional on ANYTHING, and where those
// conditions get their facts.
console.log("\n" + "=".repeat(100));
console.log("THE GATING CENSUS — deterministic, no screen involved");
console.log("=".repeat(100));
let slots = 0, conditional = 0;
const gateSources = {};
const ungatedFamilies = [];
for (const documentType of types) {
  const bp = blueprints[documentType];
  const emitted = baseline[documentType]?.full?.clauses
    || [...new Set([...(bp.clauses || []), ...(bp.required_clauses || [])])];
  const gated = new Set((bp.conditional_clauses || []).map((e) => e.clause).filter(Boolean));
  const here = emitted.filter((id) => gated.has(id)).length;
  slots += emitted.length;
  conditional += here;
  if (emitted.length && !here) ungatedFamilies.push(documentType);
  for (const entry of bp.conditional_clauses || []) {
    if (!entry.clause || !emitted.includes(entry.clause)) continue;
    const source = sourceOf(entry.include_if || entry.when || "", documentType);
    gateSources[source] = (gateSources[source] || 0) + 1;
  }
}
console.log(
  `${slots} clause slots ship across ${types.length} families. ` +
  `${conditional} (${Math.round((conditional / slots) * 100)}%) are conditional on anything at all.`
);
console.log(
  `${ungatedFamilies.length} of ${types.length} families ship a document in which NO clause is ` +
  `conditional: every user receives byte-identical text but for field substitution.`
);
for (const [source, n] of Object.entries(gateSources).sort((a, b) => b[1] - a[1])) {
  console.log(`  gate rests on ${source.padEnd(28)} ${String(n).padStart(3)}`);
}

// The orphans, named. These are not missing features: they are propositions the
// knowledge base has already decided matter enough to gate a clause on, with
// nothing in the system able to establish them. Every one fails CLOSED -- the
// expression is `== true`, so an unestablished flag omits the clause silently.
// A service that does process personal data and a service that does not receive
// the same document, which is Privacy Policy case 4 wearing a different hat.
const orphans = {};
for (const documentType of types) {
  const bp = blueprints[documentType];
  for (const entry of bp.conditional_clauses || []) {
    const expr = String(entry.include_if || entry.when || "");
    const flag = expr.replace(/^!/, "").split(/[\s=!<>]/)[0].trim();
    if (!flag || sourceOf(flag, documentType) !== "no source at all") continue;
    (orphans[flag] ||= new Set()).add(documentType);
  }
}
console.log(
  `\n${Object.keys(orphans).length} distinct propositions gate a clause and have no source:`
);
for (const [flag, family] of Object.entries(orphans).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${flag.padEnd(34)} ${String(family.size).padStart(2)} families`);
}

// ── The requirement population ──────────────────────────────────────────────
console.log("\n" + "=".repeat(100));
console.log("APPLICABILITY SOURCES ACROSS EVERY AUTHORED REQUIREMENT");
console.log("=".repeat(100));
const requirements = loadDocumentRequirements({ refresh: true });
const sources = {};
const evidence = {};
const behaviour = {};
let total = 0;
for (const [documentType, list] of requirements) {
  for (const r of list) {
    total += 1;
    let source;
    if (r.kind === "EXTERNAL_COHERENCE") source = "external evidence (an instrument)";
    else if (r.applicability?.always) source = "unconditional";
    else if (r.applicability?.position) {
      const s = sourceOf(r.applicability.position, documentType);
      source = s === "no source at all" ? "position with no source" : s;
    } else source = "other";
    sources[source] = (sources[source] || 0) + 1;
    behaviour[r.when_unsatisfied] = (behaviour[r.when_unsatisfied] || 0) + 1;
    const kind = r.applicability?.position
      ? (askableIn(documentType).has(r.applicability.position) ? "explicitly collected"
        : derivable.has(r.applicability.position) || derivedFor(documentType).has(r.applicability.position)
          ? "deterministically derived" : "unavailable")
      : r.kind === "EXTERNAL_COHERENCE" ? "supplied as an instrument" : "not required";
    evidence[kind] = (evidence[kind] || 0) + 1;
  }
}
const show = (label, map) => {
  console.log(`\n${label}`);
  for (const [k, n] of Object.entries(map).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${String(n).padStart(3)}`);
  }
};
show(`Applicability source (${total} requirements, ${requirements.size} families)`, sources);
show("Evidence availability", evidence);
show("Failure behaviour when unsatisfied", behaviour);
console.log(
  `\nworld-sourced applicability${" ".repeat(15)}  0   <- cannot be expressed today`
);
