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
        // A deprecated clause is not loaded by the engine and can never reach a
        // document, so a stale citation inside one is not a live defect. Mirrors
        // the filter in IRE/bootstrap.js and tests/clauseProvenance.test.mjs.
        if (clause?.clause_id && clause.deprecated !== true) {
          clauses.push({ clause, file: path.join(folder.name, file) });
        }
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
  repealed: [],
  // Recorded as stale by the author, waiting on the supervising advocate to
  // re-map the provision. Not a failure: a known gap with a named owner.
  awaiting_currency_review: [],
};

// An Act that carries `repealed_on` in the registry has ceased to have effect.
// A clause citing one is worse than a clause citing nothing: it carries the
// authority of a checked reference to a provision that no longer exists.
const repealRegistry = new Map(
  Object.entries(versionRegistry.acts || {})
    .filter(([, entry]) => entry?.repealed_on)
    .map(([act, entry]) => [
      act.toLowerCase(),
      { on: entry.repealed_on, by: entry.superseded_by || "its successor" },
    ])
);
const repealOf = (act) => repealRegistry.get(String(act || "").trim().toLowerCase()) || null;

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

  // The citation loop above reads legal_basis. A repealed Act can also sit in
  // `source`, in `statutory_reference` -- which is the field the PDF actually
  // prints in its [Ref: ...] footer -- or in the clause text itself. Scanning
  // the serialised clause catches all of them, including fields added later.
  // authoring_note is excluded: those deliberately name repealed Acts to record
  // what was changed and why.
  // statute_currency is excluded for the same reason: it exists to RECORD that a
  // citation has gone stale, so its naming the repealed Act is the system
  // working, not failing. A clause carrying one is reported separately as
  // awaiting the advocate rather than as an unnoticed defect - those are
  // different states, and conflating them makes the report unreadable.
  const { authoring_note, deprecation_note, statute_currency, ...citable } = clause;
  const haystack = JSON.stringify(citable);
  const acknowledged = String(statute_currency || "");
  const isAcknowledged = (actKey) =>
    acknowledged.toLowerCase().includes(actKey) || /CITATION OUT OF DATE/i.test(acknowledged);

  // A repealed Act named in a sentence that says it was replaced is scholarship,
  // not a stale citation: "Bharatiya Nyaya Sanhita, 2023 S.75, replacing Section
  // 354A of the Indian Penal Code, 1860" is entirely up to date.
  const HISTORICAL_FRAME =
    /(replac(?:ing|ed|es)|formerly|erstwhile|repeal(?:ed|ing|s)|superseded|previously|corresponding to|which was|before its repeal|as it stood)/i;
  const namedOnlyHistorically = (actKey) => {
    const lower = haystack.toLowerCase();
    let from = 0;
    for (;;) {
      const at = lower.indexOf(actKey, from);
      if (at === -1) return true;
      const window = haystack.slice(Math.max(0, at - 160), at + actKey.length + 60);
      if (!HISTORICAL_FRAME.test(window)) return false;
      from = at + actKey.length;
    }
  };

  for (const [actKey, repeal] of repealRegistry) {
    if (!haystack.toLowerCase().includes(actKey)) continue;
    if (report.repealed.some((r) => r.clause_id === clause.clause_id && r.act === actKey)) continue;
    if (namedOnlyHistorically(actKey)) continue;
    if (isAcknowledged(actKey)) {
      report.awaiting_currency_review.push({
        clause_id: clause.clause_id, file, act: actKey,
        repealed_on: repeal.on, cite_instead: repeal.by,
      });
      continue;
    }
    report.repealed.push({
      clause_id: clause.clause_id, file, act: actKey,
      citation: `${actKey} (named in the clause body, not in legal_basis)`,
      repealed_on: repeal.on, cite_instead: repeal.by,
    });
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

    const repeal = repealOf(entry.act);
    if (repeal) {
      const bucket = isAcknowledged(String(entry.act).toLowerCase())
        ? report.awaiting_currency_review
        : report.repealed;
      bucket.push({
        clause_id: clause.clause_id, file,
        citation: `${entry.act} - ${entry.section || entry.article}`,
        repealed_on: repeal.on, cite_instead: repeal.by,
      });
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
  console.log(`  citing a REPEALED Act   ${report.repealed.length}`);
  console.log(`  stale, awaiting review  ${report.awaiting_currency_review.length}`);
  console.log(`  unparseable files       ${report.unparseable.length}`);
  console.log(
    `  Acts corpus             ${actsAvailable ? "available" : "NOT PRESENT — citations could not be resolved"}`
  );
  if (actsAvailable) console.log(`  unresolvable citations  ${report.unresolvable.length}`);
  for (const entry of report.repealed) {
    console.log(
      `    REPEALED   ${entry.clause_id}: ${entry.citation}` +
      ` — repealed ${entry.repealed_on}, cite ${entry.cite_instead}`
    );
  }
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
  report.malformed.length +
  report.unresolvable.length +
  report.unparseable.length +
  report.repealed.length;
process.exit(failures === 0 ? 0 : 1);
