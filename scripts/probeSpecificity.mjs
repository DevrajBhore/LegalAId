/**
 * probeSpecificity.mjs — PHASE D4.2
 *
 * DOES A MATERIALLY DIFFERENT TRANSACTION PRODUCE A MATERIALLY DIFFERENT
 * DOCUMENT?
 *
 * The certification ladder answers "does this document do what this KIND of
 * document must do". The clause baseline answers "did today's selection change
 * from yesterday's". Neither answers the question a user actually has:
 *
 *     is THIS the right document for THIS transaction?
 *
 * A family can report every requirement resolved, survive adversarial
 * falsification, and still emit the same clause set for two deals that are not
 * alike — the same instrument with different names typed into it. That is a
 * template engine, and it is not what this system claims to be.
 *
 * THE MEASUREMENT. Two deliberately opposite worlds per family: every material
 * yes/no answered TRUE in one and FALSE in the other, through the mutation
 * contract so that each answer reaches the option that MEANS the position.
 * Everything else held identical, so any difference downstream is attributable.
 *
 * Then the chain is compared at every layer:
 *
 *     intake answers -> derived controls -> canonical facts
 *       -> requirement outcomes -> clause ids -> clause text
 *
 * FALSE SAMENESS is the defect being hunted: a layer where the input differed
 * and the output did not. Some sameness is correct — governing law, notices,
 * signatures and definitions should not move because a deal involves personal
 * data — so the count is reported per layer rather than as a single score, and
 * the clauses that legitimately stay are listed alongside those that should not.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAMILIES = ["NDA", "DISTRIBUTION_AGREEMENT", "MASTER_SERVICE_AGREEMENT"];

/** Every material yes/no the family asks. */
function materialFields(documentType) {
  const schema = getVariables(documentType) || {};
  return Object.entries(schema).filter(([, def]) =>
    def.type === "select" && Array.isArray(def.options)
    && optionMeaning(def, POSITION.TRUE) !== null
    && optionMeaning(def, POSITION.FALSE) !== null);
}

async function world(documentType, position) {
  const base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const variables = { ...base };
  const answered = {};
  for (const [field, def] of materialFields(documentType)) {
    const option = optionMeaning(def, position);
    if (option === null) continue;
    variables[field] = option;
    answered[field] = option;
  }
  const result = await generateDocument({ document_type: documentType, variables });
  const clauses = result.draft?.clauses || [];
  return {
    answered,
    controls: deriveControlsForDocument(documentType, sanitizeVariablesForDocument(documentType, variables)),
    facts: Object.fromEntries((result.canonical_facts || [])
      .filter((o) => o.provenance !== "unknown").map((o) => [o.fact, o.value])),
    requirements: Object.fromEntries((result.requirements?.results || []).map((r) => [r.id, r.coverage])),
    ids: clauses.map((c) => c.clause_id),
    texts: Object.fromEntries(clauses.map((c) => [c.clause_id, c.text || ""])),
    generates: clauses.length > 0,
  };
}

const rows = [];
for (const family of FAMILIES) {
  const A = await world(family, POSITION.TRUE);
  const B = await world(family, POSITION.FALSE);
  if (!A.generates || !B.generates) { rows.push({ family, error: "a world did not generate" }); continue; }

  const movedControls = Object.keys(A.controls)
    .filter((k) => JSON.stringify(A.controls[k]) !== JSON.stringify(B.controls[k]));
  const movedFacts = [...new Set([...Object.keys(A.facts), ...Object.keys(B.facts)])]
    .filter((k) => A.facts[k] !== B.facts[k]);
  const movedRequirements = [...new Set([...Object.keys(A.requirements), ...Object.keys(B.requirements)])]
    .filter((k) => A.requirements[k] !== B.requirements[k]);

  const setA = new Set(A.ids); const setB = new Set(B.ids);
  const onlyA = A.ids.filter((id) => !setB.has(id));
  const onlyB = B.ids.filter((id) => !setA.has(id));
  const shared = A.ids.filter((id) => setB.has(id));
  const sharedButDifferentText = shared.filter((id) => A.texts[id] !== B.texts[id]);

  rows.push({
    family,
    answersChanged: Object.keys(A.answered).length,
    movedControls, movedFacts, movedRequirements,
    clausesA: A.ids.length, clausesB: B.ids.length,
    onlyA, onlyB, shared: shared.length, sharedButDifferentText,
    identicalClauseSet: onlyA.length === 0 && onlyB.length === 0,
    identicalDocument: onlyA.length === 0 && onlyB.length === 0 && sharedButDifferentText.length === 0,
  });
}

const lines = [];
lines.push("# Phase D4.2 — differential specificity audit\n");
lines.push("Two deliberately opposite worlds per family: every material yes/no answered TRUE in one");
lines.push("and FALSE in the other, everything else held identical.\n");
lines.push("| family | answers changed | controls moved | facts moved | requirements moved | clauses A / B | only in A | only in B | shared clauses whose TEXT differs |");
lines.push("|---|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  if (r.error) { lines.push(`| ${r.family} | — | — | — | — | ${r.error} | | | |`); continue; }
  lines.push(`| ${r.family} | ${r.answersChanged} | ${r.movedControls.length} | ${r.movedFacts.length} | ${r.movedRequirements.length} | ${r.clausesA} / ${r.clausesB} | **${r.onlyA.length}** | **${r.onlyB.length}** | ${r.sharedButDifferentText.length} |`);
}
lines.push("");
for (const r of rows) {
  if (r.error) continue;
  lines.push(`## ${r.family}\n`);
  lines.push(`Answers changed: ${Object.keys(r.movedControls).length ? "" : ""}**${r.answersChanged}** material yes/no fields flipped.\n`);
  lines.push(`Derived controls that moved (${r.movedControls.length}): ${r.movedControls.join(", ") || "**none**"}\n`);
  lines.push(`Canonical facts that moved (${r.movedFacts.length}): ${r.movedFacts.join(", ") || "**none**"}\n`);
  lines.push(`Requirement outcomes that moved (${r.movedRequirements.length}): ${r.movedRequirements.join(", ") || "**none**"}\n`);
  lines.push(`Clauses only in the TRUE world (${r.onlyA.length}): ${r.onlyA.join(", ") || "**none**"}\n`);
  lines.push(`Clauses only in the FALSE world (${r.onlyB.length}): ${r.onlyB.join(", ") || "**none**"}\n`);
  lines.push(`Shared clauses whose text differs (${r.sharedButDifferentText.length}): ${r.sharedButDifferentText.join(", ") || "none"}\n`);
  if (r.identicalDocument) {
    lines.push("> **IDENTICAL DOCUMENT.** Same clause set, same clause text, for two transactions");
    lines.push("> that differ in every material answer the family asks.\n");
  } else if (r.identicalClauseSet) {
    lines.push("> **IDENTICAL CLAUSE SET.** The same provisions, with different words inside them.\n");
  }
}
fs.writeFileSync(path.join(ROOT, "docs/audit/SPECIFICITY_AUDIT.md"), lines.join("\n") + "\n");

console.log("family                        answers  controls  facts  reqs   A/B clauses   onlyA  onlyB  text-differs");
for (const r of rows) {
  if (r.error) { console.log(`${r.family.padEnd(30)} ${r.error}`); continue; }
  console.log(
    `${r.family.padEnd(30)} ${String(r.answersChanged).padEnd(8)} ${String(r.movedControls.length).padEnd(9)} ` +
    `${String(r.movedFacts.length).padEnd(6)} ${String(r.movedRequirements.length).padEnd(6)} ` +
    `${String(r.clausesA + "/" + r.clausesB).padEnd(13)} ${String(r.onlyA.length).padEnd(6)} ` +
    `${String(r.onlyB.length).padEnd(6)} ${r.sharedButDifferentText.length}`);
}
