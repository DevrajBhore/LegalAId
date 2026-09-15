/**
 * probeDeadQuestions.mjs — PHASE D2.2
 *
 * A QUESTION WITH NOWHERE TO GO.
 *
 *     question -> no gate -> no requirement -> no treatment -> no output
 *
 * Invariant 34's shape, measured portfolio-wide rather than noticed on one
 * family. A field survives in an intake because VARIABLE_CONFIG.COMMON exposes
 * it, not because the family it lands on can act on it.
 *
 * MEASURED AT RUNTIME. A field is DEAD here only if changing it changes nothing
 * about the document — not if a static reading fails to find a consumer. Static
 * readings of this codebase have been wrong four times running, in the same
 * direction each time: they over-report.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { documentShape } from "../shared/documentShape.js";
import { positionOf, POSITION } from "../backend/services/generationControls.js";
import { canDecline, mutateTo } from "./lib/semanticMutation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fingerprint = (result) => JSON.stringify({
  ids: (result.draft?.clauses || []).map((c) => c.clause_id),
  text: (result.draft?.clauses || []).map((c) => (c.text || "").length),
  requirements: (result.requirements?.results || []).map((r) => `${r.id}:${r.coverage}`),
});

const rows = [];
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const schema = getVariables(documentType) || {};
  // Only optional yes/no drafting choices — a required field cannot be dead, and
  // a free-text field changes the text by construction.
  const candidates = Object.entries(schema).filter(([key, def]) =>
    /^include_|^termination_for_/.test(key)
      && def.type === "select" && def.required !== true && Array.isArray(def.options)
      // Must have an answer meaning NO, or there is no decline to test.
      && canDecline(def));
  if (!candidates.length) continue;

  const base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  let reference;
  try { reference = await generateDocument({ document_type: documentType, variables: base }); }
  catch { continue; }
  if (!(reference.draft?.clauses || []).length) continue;
  const before = fingerprint(reference);

  const dead = [];
  for (const [field, def] of candidates) {
    // THE MUTATION CONTRACT. scripts/lib/semanticMutation.mjs chooses the option
    // that MEANS no, and returns null where the field cannot express one — so a
    // field with no decline is skipped rather than tested with something else.
    //
    // The first run of this probe chose "any option different from the current
    // one". For a select offering ["AI Recommended", "Yes", "No"] answered
    // "Yes", that picked "AI Recommended", which normalises the same way. The
    // gate never closed and a working field read as dead:
    // include_indemnity_clause on SOFTWARE_DEVELOPMENT_AGREEMENT, a gate
    // repaired in Phase C3 and guarded by tests/positionOverride.test.mjs.
    const declined = mutateTo(base, field, def, POSITION.FALSE);
    if (!declined) continue;
    let mutated;
    try { mutated = await generateDocument({ document_type: documentType, variables: declined }); }
    catch { continue; }
    if (!(mutated.draft?.clauses || []).length) continue;   // refused is not dead
    if (fingerprint(mutated) === before) dead.push(field);
  }
  if (dead.length) rows.push({ documentType, shape: documentShape(documentType), dead, asked: candidates.length });
}

rows.sort((a, b) => b.dead.length - a.dead.length);
const total = rows.reduce((n, r) => n + r.dead.length, 0);
const lines = [];
lines.push("# Phase D2.2 — intake questions with no destination\n");
lines.push(`**${total} dead question-instances across ${rows.length} families.** A question is dead`);
lines.push("here only when changing the answer leaves the clause set, every clause's length and");
lines.push("every requirement outcome identical — measured by generating twice, not by failing to");
lines.push("find a consumer in the source.\n");
lines.push("| family | shape | asked | dead | fields |");
lines.push("|---|---|---|---|---|");
for (const r of rows) {
  lines.push(`| ${r.documentType} | ${r.shape || "—"} | ${r.asked} | **${r.dead.length}** | ${r.dead.join(", ")} |`);
}
fs.writeFileSync(path.join(ROOT, "docs/audit/DEAD_QUESTIONS.md"), lines.join("\n") + "\n");
console.log(`${total} dead question-instances across ${rows.length} families`);
for (const r of rows.slice(0, 10)) {
  console.log(`  ${String(r.dead.length).padStart(2)}/${r.asked}  ${r.documentType.padEnd(34)} ${r.dead.join(", ")}`);
}
