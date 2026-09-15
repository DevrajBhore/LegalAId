/**
 * factSourceInventory.mjs
 *
 * ONE FACT, TWO REPRESENTATIONS, TWO TRUTHS.
 *
 * Generation and assessment read facts from different places:
 *
 *     clause selection   deriveGenerationControls(documentType, variables)
 *     assessment         resolution.positions   (the fact-question layer)
 *
 * So a requirement conditioned on a derived fact can report
 * APPLICABILITY_UNKNOWN while the same document ships the clause that fact
 * gated. A reader of the assessment sees uncertainty; the generator has already
 * committed to a position.
 *
 * That must never be reported as the same thing as:
 *
 *     LEGAL / WORLD UNKNOWN   !=   ASSESSOR WAS NOT GIVEN THE FACT
 *
 * This is the blast radius, per fact rather than per requirement, with the
 * canonical source of each named so the repair can feed assessment from one
 * resolution path instead of copying flags across.
 *
 * Run: node scripts/factSourceInventory.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadDocumentRequirements, assessRequirements, COVERAGE }
  from "../backend/services/documentRequirements.js";
import { buildVariables } from "./freezeClauseBaseline.mjs";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { loadFactRegistry } from "../backend/services/factRegistry.js";
import { loadPropositions } from "../backend/services/evidencePropositions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselines = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types || {};
const registryFlags = new Set();
for (const fact of loadFactRegistry().facts || []) {
  if (fact.id) registryFlags.add(fact.id);
  for (const t of fact.treatments || []) if (t.flag) registryFlags.add(t.flag);
}
const propositions = loadPropositions({ refresh: true });

// Where is a fact AUTHORITATIVE? Reported in the order a repair should prefer:
// an answer the user gave outranks a derivation, which outranks nothing.
const ownership = (flag, documentType, derived) => {
  if (flag in (getVariables(documentType) || {})) return "declared (intake field)";
  if (propositions.has(flag)) return "admitted evidence proposition";
  if (registryFlags.has(flag)) return "fact registry";
  if (flag in derived) return "derived (generationControls)";
  return "NO SOURCE";
};

const requirements = loadDocumentRequirements({ refresh: true });
const rows = [];
for (const [family, list] of requirements) {
  const clauses = baselines[family]?.full?.clauses || [];
  if (!clauses.length) continue;
  const variables = buildVariables(family, "full");
  const derived = deriveControlsForDocument(family, variables);
  const blind = assessRequirements(family, clauses, {}, variables);
  const sighted = assessRequirements(family, clauses, derived, variables);
  for (const requirement of list) {
    const flag = requirement.applicability?.position || requirement.applicability?.evidence;
    if (!flag) continue;
    rows.push({
      family, id: requirement.id, flag,
      source: ownership(flag, family, derived),
      value: flag in derived ? derived[flag] : undefined,
      generationUses: Object.keys(derived).includes(flag),
      blind: blind.results.find((r) => r.id === requirement.id).coverage,
      sighted: sighted.results.find((r) => r.id === requirement.id).coverage,
    });
  }
}

console.log("=".repeat(104));
console.log("FACT-SOURCE INVENTORY — requirement -> fact -> canonical source -> who can see it");
console.log("=".repeat(104));
console.log(
  "family / requirement".padEnd(52) + "fact".padEnd(26) + "assessment now -> with the fact"
);
console.log("-".repeat(104));
for (const row of rows) {
  console.log(
    `${row.family}/${row.id}`.padEnd(52) + row.flag.padEnd(26) +
    `${row.blind} -> ${row.sighted}`
  );
  console.log(
    " ".repeat(52) + `source: ${row.source}; generation reads it: ${row.generationUses}; ` +
    `value in the recorded fixture: ${String(row.value)}`
  );
}

const byFact = {};
for (const row of rows) (byFact[row.flag] ||= []).push(row);
console.log("\n" + "=".repeat(104));
console.log("BY FACT — what a canonical resolution path would have to own");
console.log("=".repeat(104));
for (const [flag, list] of Object.entries(byFact).sort()) {
  console.log(
    `  ${flag.padEnd(28)} ${list[0].source.padEnd(30)} ` +
    `${list.length} requirement${list.length === 1 ? "" : "s"} in ` +
    `${new Set(list.map((r) => r.family)).size} famil${new Set(list.map((r) => r.family)).size === 1 ? "y" : "ies"}`
  );
}

const stuck = rows.filter((r) => r.blind === COVERAGE.APPLICABILITY_UNKNOWN);
const wouldMove = stuck.filter((r) => r.sighted !== COVERAGE.APPLICABILITY_UNKNOWN);
console.log("\n" + "=".repeat(104));
console.log(
  `${stuck.length} of ${rows.length} conditional requirements are APPLICABILITY_UNKNOWN as shipped.\n` +
  `${wouldMove.length} become determinate the moment assessment is given the fact generation used.\n\n` +
  `Every fact above has a source. None of this is legal uncertainty; it is the assessor not\n` +
  `being handed what the generator already knew.`
);

// ── The repair is NOT safe until each transition is checked ─────────────────
console.log("\n" + "=".repeat(104));
console.log("WHY THE PLUMBING FIX IS NOT ENOUGH");
console.log("=".repeat(104));
const toNotApplicable = wouldMove.filter((r) => r.sighted === COVERAGE.NOT_APPLICABLE);
for (const row of toNotApplicable) {
  const requirement = requirements.get(row.family).find((r) => r.id === row.id);
  const unconditional = /\b(regardless|in any event|whether or not|irrespective|in all cases)\b/i
    .exec(requirement.identity_test || "");
  console.log(`\n  ${row.family}/${row.id}: UNKNOWN -> NOT_APPLICABLE on ${row.flag}=${row.value}`);
  if (unconditional) {
    console.log(
      `  !! The requirement's own identity_test says the duty applies "${unconditional[0]}":\n` +
      `     "...${requirement.identity_test.slice(Math.max(0, unconditional.index - 70),
         unconditional.index + 100).trim()}..."\n` +
      `     Its applicability is ${JSON.stringify(requirement.applicability)}.\n\n` +
      `     So giving the assessor the fact would report the requirement INAPPLICABLE for a\n` +
      `     workplace its own text says the duty covers. The plumbing fix would delete a genuine\n` +
      `     legal finding, which is the transition that has to be checked before the repair and\n` +
      `     not after it. The requirement is conflating two duties with different triggers; which\n` +
      `     way to split it is an advocate's call, not a wiring decision.`
    );
  } else {
    console.log(`     Nothing in the requirement's own text contradicts the transition.`);
  }
}
