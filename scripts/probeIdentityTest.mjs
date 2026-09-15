/**
 * probeIdentityTest.mjs — PHASE D3.6
 *
 * IS EVERY AUTHORED `identity_test` DOING WHAT IT CLAIMS?
 *
 * The Terms of Service false green turned on an identity test that was simply
 * untrue. "Remove it and nothing records that anyone agreed to be bound" —
 * removing the REQUIREMENT changes nothing about what is recorded. The admission
 * gate checks that the sentence begins "Remove it and"; it cannot check that the
 * sentence is true.
 *
 * The open question is whether a gate that could would reject legitimate
 * requirements or expose only malformed authoring. This probe answers the
 * mechanical half of it.
 *
 * THE TESTABLE FORM. A good identity test says what the DOCUMENT loses when the
 * PROVISION goes. So: take a requirement's own satisfying clauses out of the
 * assessed clause set and ask whether the requirement then reports unsatisfied.
 *
 *   it does      the requirement is load-bearing on the clauses it names
 *   it does not  something else already covers it, and the identity test
 *                describes a loss that does not occur
 *
 * This does not measure truthfulness — no program can. It measures whether the
 * requirement is answerable by the clauses it claims answer it, which is the
 * part a gate could enforce.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentRequirements, assessRequirements, COVERAGE }
  from "../backend/services/documentRequirements.js";
import { resolveCanonicalFacts } from "../backend/services/canonicalFacts.js";
import { sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { buildVariables } from "./freezeClauseBaseline.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselines = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")).types || {};

const SATISFIED = new Set([COVERAGE.RESOLVED, COVERAGE.DEFAULTED, COVERAGE.PROVIDED_FOR]);
const rows = [];
for (const [family, list] of loadDocumentRequirements({ refresh: true })) {
  const clauses = baselines[family]?.full?.clauses || [];
  if (!clauses.length) continue;

  // THE FACTS THE DOCUMENT WAS BUILT ON.
  //
  // The first run passed none, so every fact-conditioned requirement reported
  // APPLICABILITY_UNKNOWN and 18 of 94 went unassessed — the probe recording its
  // own silence as though it were a property of the corpus. Resolved the way
  // generation resolves them, so a requirement gated on is_secured is tested on
  // a loan that is secured.
  let variables = {};
  let facts = {};
  try {
    variables = sanitizeVariablesForDocument(family, buildVariables(family, "full"));
    facts = resolveCanonicalFacts(family, variables, {}).facts;
  } catch { /* families without a fixture stay as they were */ }
  const before = assessRequirements(family, clauses, facts, variables);
  for (const requirement of list) {
    const satisfiers = requirement.satisfied_by?.any_of
      || requirement.satisfied_by?.all_of || [];
    if (!satisfiers.length) { rows.push({ family, id: requirement.id, verdict: "no satisfiers named" }); continue; }

    const baseline = before.results.find((r) => r.id === requirement.id);
    // Only meaningful where the requirement is satisfied to begin with.
    if (!SATISFIED.has(baseline?.coverage)) {
      rows.push({ family, id: requirement.id, verdict: `not satisfied anyway (${baseline?.coverage})` });
      continue;
    }

    const without = clauses.filter((id) => !satisfiers.includes(id));
    const after = assessRequirements(family, without, facts, variables)
      .results.find((r) => r.id === requirement.id);

    rows.push({
      family, id: requirement.id,
      verdict: SATISFIED.has(after?.coverage) ? "HOLLOW" : "load-bearing",
      before: baseline.coverage, after: after?.coverage,
      satisfiers,
    });
  }
}

const hollow = rows.filter((r) => r.verdict === "HOLLOW");
const bearing = rows.filter((r) => r.verdict === "load-bearing");
const skipped = rows.filter((r) => !["HOLLOW", "load-bearing"].includes(r.verdict));

const lines = [];
lines.push("# Phase D3.6 — is every requirement load-bearing on the clauses it names?\n");
lines.push(`${rows.length} requirements across ${new Set(rows.map((r) => r.family)).size} families with a recorded baseline.\n`);
lines.push("| outcome | count | meaning |");
lines.push("|---|---|---|");
lines.push(`| load-bearing | ${bearing.length} | removing the named clauses makes the requirement report unsatisfied |`);
lines.push(`| **HOLLOW** | ${hollow.length} | the requirement stays satisfied with its own satisfiers gone |`);
lines.push(`| not assessed | ${skipped.length} | unsatisfied at baseline, or naming no satisfiers |`);
if (hollow.length) {
  lines.push("\n## Hollow\n");
  lines.push("| family | requirement | before | with its satisfiers removed | named |");
  lines.push("|---|---|---|---|---|");
  for (const r of hollow) {
    lines.push(`| ${r.family} | ${r.id} | ${r.before} | ${r.after} | ${r.satisfiers.join(", ")} |`);
  }
}
if (skipped.length) {
  lines.push("\n## Not assessed\n");
  for (const r of skipped) lines.push(`- ${r.family}/${r.id}: ${r.verdict}`);
}
fs.writeFileSync(path.join(ROOT, "docs/audit/IDENTITY_TEST_PROBE.md"), lines.join("\n") + "\n");

console.log(`${rows.length} requirements: ${bearing.length} load-bearing, ${hollow.length} HOLLOW, ${skipped.length} not assessed`);
for (const r of hollow) console.log(`  HOLLOW  ${r.family}/${r.id}  (${r.before} -> ${r.after})`);
for (const r of skipped.slice(0, 8)) console.log(`  skip    ${r.family}/${r.id}: ${r.verdict}`);
