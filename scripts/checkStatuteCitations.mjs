#!/usr/bin/env node
/**
 * checkStatuteCitations.mjs
 *
 * Audits the statutory basis of every clause in the library.
 *
 * Clauses cite provisions -- "Indian Contract Act, 1872 - S.126" -- but nothing
 * records WHICH VERSION of that provision was relied on, and nothing notices
 * when the provision changes. A clause can therefore go stale silently: the
 * citation still looks right long after the section it points at was amended.
 *
 * This script reports three things:
 *   1. clauses whose legal_basis is missing or malformed
 *   2. clauses with no pinned version (`version` or `as_at` on the basis entry)
 *   3. where the Acts corpus is available, citations that cannot be resolved
 *
 * Run:  node scripts/checkStatuteCitations.mjs [--json]
 * Exit: 1 if any citation is malformed or unresolvable, else 0.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUSE_LIB = path.join(ROOT, "knowledge-base", "clause_library");
const ACTS_DIR = path.join(ROOT, "knowledge-base", "acts");
const VERSION_REGISTRY = path.join(
  ROOT, "knowledge-base", "metadata", "statute_versions.json"
);
const asJson = process.argv.includes("--json");

function readClauses() {
  const clauses = [];
  if (!fs.existsSync(CLAUSE_LIB)) return clauses;
  for (const folder of fs.readdirSync(CLAUSE_LIB, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === "blueprints") continue;
    const dir = path.join(CLAUSE_LIB, folder.name);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const clause = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        if (clause?.clause_id) clauses.push({ clause, file: path.join(folder.name, file) });
      } catch {
        clauses.push({ clause: null, file: path.join(folder.name, file), unparseable: true });
      }
    }
  }
  return clauses;
}

const actsAvailable = fs.existsSync(ACTS_DIR);
let actIndex = null;
function actExists(actName) {
  if (!actsAvailable) return null; // unknown, not absent
  if (actIndex === null) {
    actIndex = new Set(
      fs.readdirSync(ACTS_DIR).map((f) => f.replace(/\.json$/i, "").toLowerCase())
    );
  }
  const needle = String(actName || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  for (const known of actIndex) {
    if (known.includes(needle.slice(0, 24)) || needle.includes(known.slice(0, 24))) return true;
  }
  return false;
}

// A citation is pinned either on the entry itself or, far more usefully, through
// the per-Act registry: 458 citations name only 73 Acts, so pinning is 73
// decisions rather than 458, and one verified row pins every clause citing it.
function loadVersionRegistry() {
  if (!fs.existsSync(VERSION_REGISTRY)) return { acts: {} };
  try {
    return JSON.parse(fs.readFileSync(VERSION_REGISTRY, "utf8"));
  } catch {
    return { acts: {} };
  }
}

const versionRegistry = loadVersionRegistry();

function registryPin(actName) {
  const entry = versionRegistry.acts?.[String(actName || "").trim()];
  if (!entry) return null;
  return entry.verified === true && entry.amended_upto ? entry : null;
}

const report = {
  acts_corpus_available: actsAvailable,
  total_clauses: 0,
  citations: 0,
  pinned: 0,
  unpinned: 0,
  pinned_via_registry: 0,
  acts_cited: 0,
  acts_verified: 0,
  acts_unverified: [],
  malformed: [],
  unresolvable: [],
  unparseable: [],
};

for (const [act, entry] of Object.entries(versionRegistry.acts || {})) {
  report.acts_cited += 1;
  if (entry.verified === true && entry.amended_upto) report.acts_verified += 1;
  else report.acts_unverified.push({ act, citations: entry.citations ?? null });
}
report.acts_unverified.sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0));

for (const { clause, file, unparseable } of readClauses()) {
  if (unparseable) {
    report.unparseable.push(file);
    continue;
  }
  report.total_clauses += 1;
  const basis = clause.legal_basis;

  if (!Array.isArray(basis) || basis.length === 0) {
    report.malformed.push({ clause_id: clause.clause_id, file, reason: "no legal_basis" });
    continue;
  }

  for (const entry of basis) {
    report.citations += 1;
    if (!entry || typeof entry !== "object" || !entry.act) {
      report.malformed.push({
        clause_id: clause.clause_id, file, reason: "basis entry has no act",
      });
      continue;
    }
    if (!entry.section && !entry.article) {
      report.malformed.push({
        clause_id: clause.clause_id, file,
        reason: `"${entry.act}" cites neither a section nor an article`,
      });
      continue;
    }

    // A pinned citation records which text was relied on, so an amendment can
    // be detected later rather than silently invalidating the clause.
    if (entry.version || entry.as_at) {
      report.pinned += 1;
    } else if (registryPin(entry.act)) {
      report.pinned += 1;
      report.pinned_via_registry += 1;
    } else {
      report.unpinned += 1;
    }

    if (actExists(entry.act) === false) {
      report.unresolvable.push({
        clause_id: clause.clause_id, file,
        citation: `${entry.act} - ${entry.section || entry.article}`,
      });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("STATUTE CITATION AUDIT");
  console.log("-".repeat(58));
  console.log(`  clauses examined        ${report.total_clauses}`);
  console.log(`  citations               ${report.citations}`);
  console.log(`  version pinned          ${report.pinned}${report.pinned_via_registry ? ` (${report.pinned_via_registry} via the Act registry)` : ""}`);
  console.log(`  NOT pinned              ${report.unpinned}`);
  console.log(`  Acts cited              ${report.acts_cited}`);
  console.log(`  Acts version-verified   ${report.acts_verified} of ${report.acts_cited}`);
  console.log(`  malformed               ${report.malformed.length}`);
  console.log(`  unparseable files       ${report.unparseable.length}`);
  console.log(
    `  Acts corpus             ${actsAvailable ? "available" : "NOT PRESENT — citations could not be resolved"}`
  );
  if (actsAvailable) console.log(`  unresolvable citations  ${report.unresolvable.length}`);
  for (const entry of report.malformed.slice(0, 15)) {
    console.log(`    MALFORMED  ${entry.clause_id}: ${entry.reason}`);
  }
  for (const entry of report.unresolvable.slice(0, 15)) {
    console.log(`    UNRESOLVED ${entry.clause_id}: ${entry.citation}`);
  }
  if (report.unpinned > 0) {
    console.log(
      `\n  ${report.unpinned} citation(s) have no version pin, across ` +
      `${report.acts_unverified.length} unverified Act(s).\n` +
      `  Pinning is done per Act, not per citation: set amended_upto, source and\n` +
      `  verified in knowledge-base/metadata/statute_versions.json and every clause\n` +
      `  citing that Act is pinned at once. Highest-leverage rows first:`
    );
    for (const entry of report.acts_unverified.slice(0, 10)) {
      console.log(`    ${String(entry.citations ?? "?").padStart(4)} citation(s)  ${entry.act}`);
    }
  }
}

const failures =
  report.malformed.length + report.unresolvable.length + report.unparseable.length;
process.exit(failures === 0 ? 0 : 1);
