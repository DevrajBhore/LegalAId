/**
 * probeBuilderProvenance.mjs — PHASE D4.8
 *
 * WHAT ARE THE SUB-CLAUSE BUILDERS ACTUALLY SELECTING ON?
 *
 * D4.7 established that the engine composes legal content below the clause
 * boundary — 24 of 28 varying pairs change which sentences are present, across 7
 * clauses and 18 families — and that the mechanism is procedural:
 * `documentHardening.js` holds per-clause builders that compose different text
 * for a guarantee, a joint venture, or the generic case.
 *
 * That raised the question this probe answers, and ONLY this question: for each
 * sentence-level decision, what input drives it, and is that input already
 * represented as reviewable legal knowledge?
 *
 * NOTHING IS MIGRATED. The purpose is to find out whether
 * `documentHardening.js` is
 *
 *   1. merely a renderer,
 *   2. hiding legal reasoning,
 *   3. hiding drafting logic,
 *   4. implementing cross-clause dependencies,
 *   5. or some combination —
 *
 * because the answer decides whether anything needs extracting at all, and a
 * migration begun before that is a migration in the dark.
 *
 * HOW THE DRIVER IS IDENTIFIED. Not by reading the code: by perturbation. Each
 * world flips exactly one intake answer, so a rendering that differs from the
 * baseline names its own driver. Reading the builders would find the variables
 * they MENTION; perturbation finds the ones that actually move the text, which
 * are not the same set and the difference has cost this project ten measurement
 * errors.
 *
 * THE CLASSIFICATION IS EVIDENCE-BOUND. A driver is resolved against every layer
 * the knowledge base already has — intake schema, derived controls, semantic
 * facts, concept detection sources, proposition applicability — and a driver that
 * resolves nowhere is reported UNREPRESENTED rather than guessed at. Where the
 * clause SET also changed in the same world, the text change is attributed to
 * CROSS_CLAUSE_DEPENDENCY, because a survival list losing "indemnity" when the
 * indemnity clause departs is not a new legal proposition; it is one clause's
 * text depending on another clause's presence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { optionMeaning } from "./lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { loadConcepts } from "../backend/services/conceptResolver.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/* ── what the knowledge base already represents ──────────────────────────── */

const semanticFacts = new Map(
  readJson(path.join(ROOT, "knowledge-base/intake/semantic_facts.json")).facts
    .flatMap((f) => (f.established_by || []).map((field) => [field, f])));

const conceptSources = new Map();
for (const c of loadConcepts().values()) {
  for (const s of c.detection?.a_structured || []) {
    const name = String(s.source || "").replace(/^(field|control):/, "");
    if (name) conceptSources.set(name, c);
  }
}

const propositionDrivers = new Map();
for (const p of readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json")).propositions) {
  if (p.applicability?.position) propositionDrivers.set(p.applicability.position, p);
}

const requirementDrivers = new Map();
const REQ = path.join(ROOT, "knowledge-base/documents/requirements");
for (const f of fs.readdirSync(REQ)) {
  const m = readJson(path.join(REQ, f));
  for (const r of m.requirements || []) {
    if (r.applicability?.position) requirementDrivers.set(r.applicability.position, { documentType: m.document_type, id: r.id });
  }
}

/* ── measurement ─────────────────────────────────────────────────────────── */

const rows = [];
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY).sort()) {
  let base;
  try { base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }); }
  catch { continue; }
  const schema = getVariables(documentType) || {};

  const run = async (variables) => {
    try {
      const r = await generateDocument({ document_type: documentType, variables });
      const list = r.draft?.clauses || [];
      return list.length ? list : null;
    } catch { return null; }
  };

  const baseline = await run(base);
  if (!baseline) continue;
  const baseText = new Map(baseline.map((c) => [c.clause_id, c.text || ""]));
  const baseIds = new Set(baseline.map((c) => c.clause_id));

  for (const [field, def] of Object.entries(schema)) {
    if (def.type !== "select" || !Array.isArray(def.options)) continue;
    const no = optionMeaning(def, POSITION.FALSE);
    if (no === null) continue;
    if (String(base[field]) === String(no)) continue;  // already false: no perturbation

    const world = await run({ ...base, [field]: no });
    if (!world) continue;
    const worldIds = new Set(world.map((c) => c.clause_id));
    const clauseSetMoved = baseIds.size !== worldIds.size
      || [...baseIds].some((id) => !worldIds.has(id));

    for (const c of world) {
      const before = baseText.get(c.clause_id);
      if (before === undefined || before === (c.text || "")) continue;

      /* Classify the driver against every layer that already exists. */
      const controls = deriveControlsForDocument(documentType,
        sanitizeVariablesForDocument(documentType, base)) || {};
      const evidence = [];
      if (field in schema) evidence.push("intake_field");
      if (field in controls) evidence.push("derived_control");
      if (semanticFacts.has(field)) evidence.push("semantic_fact");
      if (conceptSources.has(field)) evidence.push("concept");
      if (propositionDrivers.has(field)) evidence.push("proposition");
      if (requirementDrivers.has(field)) evidence.push("requirement");

      const concept = conceptSources.get(field);
      const proposition = propositionDrivers.get(field);

      let klass;
      if (clauseSetMoved && /^(CORE_SURVIVAL|CORE_DEFINITIONS)/.test(c.clause_id)) {
        klass = "CROSS_CLAUSE_DEPENDENCY";
      } else if (proposition) klass = "LEGAL_PROPOSITION_CHANGE";
      else if (concept) klass = "LEGAL_PROPOSITION_CHANGE";
      else if (requirementDrivers.has(field)) klass = "REQUIREMENT_CHANGE";
      else if (semanticFacts.has(field)) klass = "FACT_DRIVEN_UNATTRIBUTED";
      else if (/^include_/.test(field)) klass = "OPTIONAL_COMMERCIAL_TERM";
      else klass = "UNCLASSIFIED";

      rows.push({
        documentType, clauseId: c.clause_id, driver: field, klass,
        evidence,
        hasAuthority: Boolean(concept?.authority?.length || proposition?.authority?.length),
        clauseSetMoved,
      });
    }
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

const out = [];
const KLASSES = ["LEGAL_PROPOSITION_CHANGE", "REQUIREMENT_CHANGE", "CROSS_CLAUSE_DEPENDENCY",
  "OPTIONAL_COMMERCIAL_TERM", "FACT_DRIVEN_UNATTRIBUTED", "UNCLASSIFIED"];
const MEANING = {
  LEGAL_PROPOSITION_CHANGE: "driven by a fact that already carries a concept or proposition with authority",
  REQUIREMENT_CHANGE: "driven by a fact a requirement's applicability already reads",
  CROSS_CLAUSE_DEPENDENCY: "the text depends on which OTHER clauses were selected, not on a new rule",
  OPTIONAL_COMMERCIAL_TERM: "an include_* drafting choice with no legal knowledge behind it",
  FACT_DRIVEN_UNATTRIBUTED: "a declared semantic fact drives it, but no proposition or concept claims the effect",
  UNCLASSIFIED: "the driver resolves to no layer of the knowledge base at all",
};

out.push("# Phase D4.8 — provenance of the sub-clause builders\n");
out.push("D4.7 found the engine composing legal content below the clause boundary, procedurally, in");
out.push("`documentHardening.js`. This asks what those decisions are actually selecting on, and");
out.push("whether each driver is already reviewable legal knowledge. **Nothing is migrated.**\n");
out.push("Drivers are found by perturbation, not by reading the builders: each world flips exactly one");
out.push("intake answer, so a rendering that differs names its own driver. Reading the code would find");
out.push("the variables the builders MENTION, which is a different and larger set.\n");

out.push("| class | text changes | distinct clauses | meaning |");
out.push("|---|---|---|---|");
for (const k of KLASSES) {
  const set = rows.filter((r) => r.klass === k);
  if (!set.length) continue;
  out.push(`| ${k} | ${set.length} | ${new Set(set.map((r) => r.clauseId)).size} | ${MEANING[k]} |`);
}
out.push("");

const withAuthority = rows.filter((r) => r.hasAuthority).length;
out.push(`**${withAuthority} of ${rows.length}** sentence-level changes are driven by something carrying`);
out.push(`statutory authority.\n`);

for (const k of KLASSES) {
  const set = rows.filter((r) => r.klass === k);
  if (!set.length) continue;
  out.push(`### ${k} — ${set.length}\n`);
  const byDriver = new Map();
  for (const r of set) {
    const key = `${r.driver}`;
    if (!byDriver.has(key)) byDriver.set(key, []);
    byDriver.get(key).push(`${r.documentType}/${r.clauseId}`);
  }
  for (const [driver, where] of [...byDriver.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = set.find((r) => r.driver === driver);
    out.push(`- \`${driver}\` — ${where.length} change(s); resolves as: ${sample.evidence.join(", ") || "**nothing**"}`);
    out.push(`  - ${[...new Set(where)].slice(0, 4).join(", ")}${where.length > 4 ? " …" : ""}`);
  }
  out.push("");
}

fs.writeFileSync(path.join(ROOT, "docs/audit/BUILDER_PROVENANCE.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/builder-provenance.json"), JSON.stringify(rows, null, 2));
console.log(out.join("\n"));
