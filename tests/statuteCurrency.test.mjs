/**
 * A clause may not cite a repealed statute.
 *
 * On 21 November 2025 the four labour Codes commenced and repealed 29 central
 * labour statutes. Nineteen clauses in this library cited them, thirteen of
 * those in the text the parties actually sign. The citations have been
 * repointed; this test is what stops them drifting back.
 *
 * The mechanism is deliberately data-driven rather than a hardcoded list: any
 * Act given a `repealed_on` date in knowledge-base/metadata/statute_versions.json
 * becomes uncitable, so retiring a statute in future is a one-line edit there.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "knowledge-base", "metadata", "statute_versions.json");

const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
const acts = registry.acts || {};
const repealed = Object.entries(acts).filter(([, row]) => row?.repealed_on);

{
  assert.ok(repealed.length > 0, "the registry records no repealed Act at all");
  console.log(`PASS  ${repealed.length} Act(s) carry a repeal date`);
}

{
  // A tombstone with no successor sends the author nowhere.
  const orphans = repealed.filter(([, row]) => !row.superseded_by);
  assert.deepStrictEqual(orphans.map(([act]) => act), []);
  console.log("PASS  every repealed Act names what to cite instead");
}

{
  const codes = [
    "Code on Wages, 2019",
    "Industrial Relations Code, 2020",
    "Code on Social Security, 2020",
    "Occupational Safety, Health and Working Conditions Code, 2020",
  ];
  for (const code of codes) {
    assert.ok(acts[code], `${code} is not in the statute registry`);
    assert.strictEqual(acts[code].in_force_from, "2025-11-21", `${code} commencement date`);
  }
  console.log("PASS  all four labour Codes are registered, in force 21 November 2025");
}

{
  // The real check: the audit script exits non-zero if any live clause cites a
  // repealed Act. Running it here means the whole suite fails on a regression.
  const result = execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "checkStatuteCitations.mjs"), "--json"],
    { encoding: "utf8", cwd: ROOT }
  );
  const report = JSON.parse(result);
  assert.deepStrictEqual(
    report.repealed,
    [],
    `clause(s) cite a repealed statute:\n` +
      report.repealed.map((r) => `  ${r.clause_id}: ${r.citation}`).join("\n")
  );
  console.log(`PASS  ${report.total_clauses} live clauses, 0 citing a repealed statute`);
}

console.log("\nALL GREEN");
