/**
 * ciSuite.mjs — the single authoritative test runner.
 *
 * Why this exists:
 *   - `npm test` chains 107 of the 128 test files with `&&`, so it stops at the
 *     first failure and never reports the rest.
 *   - The previous CI workflow ran 4 files, none of which `npm test` runs.
 *   - 17 files were run by nothing at all.
 *
 * Every file in tests/ is discovered and executed. Nothing is skipped,
 * excluded, or marked continue-on-error.
 *
 * A baseline entry is NOT a permanent exception. It must match the recorded
 * failure signature, so a test that starts failing for a NEW reason is a
 * regression even though its filename is listed. A listed test that starts
 * passing is also a build failure, so the list cannot rot.
 *
 * Outcomes:
 *   PASS              exited 0, not in the baseline
 *   EXPECTED_FAIL     in the baseline; exit code AND signature both match
 *   SIGNATURE_CHANGED in the baseline, but it failed differently  -> build fails
 *   REGRESSION        not in the baseline, and it failed          -> build fails
 *   UNEXPECTED_PASS   in the baseline, but it passed              -> build fails
 *   TIMEOUT           killed at the time limit                    -> build fails
 *   CRASH             could not be executed to completion         -> build fails
 *
 * The build also fails if discovered !== completed, so a file the runner
 * silently fails to execute can never be mistaken for a clean suite.
 *
 * For every REGRESSION the runner prints a ready-to-paste baseline entry with
 * the signature it extracted, so establishing or repairing the baseline never
 * requires guessing at a failure message.
 *
 * Env:
 *   CI_TEST_TIMEOUT_MS  per-file timeout (default 600000)
 *   CI_SUITE_JSON       path to write machine-readable results
 *   CI_SUITE_LOG_DIR    directory to write per-file full output
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(ROOT, "tests");
const BASELINE_FILE = path.join(TESTS_DIR, "known-failures.json");
const TIMEOUT_MS = Number(process.env.CI_TEST_TIMEOUT_MS || 600000);
const JSON_OUT = process.env.CI_SUITE_JSON || "";
const LOG_DIR = process.env.CI_SUITE_LOG_DIR || "";

const baselineDoc = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : {};
const baseline = baselineDoc.expected_failures || {};

if (LOG_DIR) fs.mkdirSync(LOG_DIR, { recursive: true });

// Normalise away everything that legitimately varies between runs, so a
// signature compares the failure itself and not the machine it ran on.
function normalise(text) {
  return String(text || "")
    .replace(/\x1B\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("[IRE"))
    .join("\n")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<TIMESTAMP>")
    .replace(/[A-Za-z]:[\/\\][^\s:]*/g, "<PATH>")
    .replace(/\/(?:[\w.-]+\/)+[\w.-]+/g, "<PATH>")
    .replace(/\b\d+(\.\d+)?\s?ms\b/g, "<MS>")
    .trim();
}

// Pull the most distinctive failure lines out of a run's output, so a
// regression can be turned into a baseline entry without hand-transcribing a
// message. Derived from the normalised output, so it is a substring by
// construction.
function suggestSignature(output) {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  const patterns = [
    /^AssertionError[^:]*:\s*(.+)$/,
    /^(?:✗|not ok \d+ -)\s*(.+)$/,
    /^FAIL\s+(.+)$/,
    /^[A-Za-z]*Error:\s*(.+)$/,
    /^\s*message:\s*["'](.+?)["'],?$/,
  ];
  const picks = [];
  for (const p of patterns) {
    for (const l of lines) {
      const m = l.match(p);
      if (!m) continue;
      const s = m[1].slice(0, 90).trim();
      if (s && !picks.includes(s) && output.includes(s)) picks.push(s);
      if (picks.length >= 2) return picks;
    }
  }
  return picks;
}

const discovered = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => /\.test\.(mjs|cjs|js)$/.test(f))
  .sort();

let executed = 0;
let completed = 0;
const results = [];

for (const [i, file] of discovered.entries()) {
  const started = Date.now();
  let run;
  executed += 1;
  try {
    run = spawnSync(process.execPath, [path.join("tests", file)], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    });
  } catch (err) {
    results.push({ file, outcome: "CRASH", detail: String(err?.message || err), ms: Date.now() - started });
    console.log(`[${String(i + 1).padStart(3)}/${discovered.length}] CRASH             ${file}`);
    continue;
  }

  const ms = Date.now() - started;
  const timedOut = run.error?.code === "ETIMEDOUT" || run.signal === "SIGTERM";
  const output = normalise((run.stdout || "") + (run.stderr || ""));
  const entry = baseline[file];

  if (LOG_DIR) fs.writeFileSync(path.join(LOG_DIR, file + ".log"), output);

  let outcome;
  let detail = "";
  if (timedOut) {
    outcome = "TIMEOUT";
    detail = `exceeded ${TIMEOUT_MS}ms`;
  } else if (run.status === null) {
    outcome = "CRASH";
    detail = `no exit code (signal ${run.signal || "unknown"})`;
  } else {
    completed += 1;
    if (run.status === 0) {
      outcome = entry ? "UNEXPECTED_PASS" : "PASS";
      if (entry) detail = "listed as an expected failure but passed — remove it from tests/known-failures.json";
    } else if (!entry) {
      outcome = "REGRESSION";
    } else {
      const codeOk = entry.exit_code === undefined || entry.exit_code === run.status;
      const missing = (entry.signature_contains || []).filter((s) => !output.includes(s));
      if (codeOk && missing.length === 0) {
        outcome = "EXPECTED_FAIL";
      } else {
        outcome = "SIGNATURE_CHANGED";
        detail = !codeOk
          ? `expected exit ${entry.exit_code}, got ${run.status}`
          : `signature no longer present: ${missing.map((m) => JSON.stringify(m)).join(", ")}`;
      }
    }
  }

  results.push({
    file,
    outcome,
    detail,
    ms,
    exit_code: run.status,
    suggested: outcome === "REGRESSION" || outcome === "SIGNATURE_CHANGED" ? suggestSignature(output) : undefined,
    tail: output.split("\n").slice(-25).join("\n"),
  });
  console.log(
    `[${String(i + 1).padStart(3)}/${discovered.length}] ${outcome.padEnd(17)} ${String(ms).padStart(7)}ms  ${file}`
  );
}

const count = (o) => results.filter((r) => r.outcome === o).length;
const BAD = ["REGRESSION", "SIGNATURE_CHANGED", "UNEXPECTED_PASS", "TIMEOUT", "CRASH"];

console.log("\n======================= SUMMARY =======================");
console.log(`discovered        : ${discovered.length}`);
console.log(`executed          : ${executed}`);
console.log(`completed         : ${completed}   (ran to an exit code)`);
console.log("-------------------------------------------------------");
console.log(`PASS              : ${count("PASS")}`);
console.log(`EXPECTED_FAIL     : ${count("EXPECTED_FAIL")}  of ${Object.keys(baseline).length} declared`);
console.log(`REGRESSION        : ${count("REGRESSION")}`);
console.log(`SIGNATURE_CHANGED : ${count("SIGNATURE_CHANGED")}`);
console.log(`UNEXPECTED_PASS   : ${count("UNEXPECTED_PASS")}`);
console.log(`TIMEOUT           : ${count("TIMEOUT")}`);
console.log(`CRASH             : ${count("CRASH")}`);

for (const o of BAD) {
  const rows = results.filter((r) => r.outcome === o);
  if (!rows.length) continue;
  console.log(`\n---- ${o} ----`);
  for (const r of rows) {
    console.log(`  ${r.file}${r.detail ? `  — ${r.detail}` : ""}`);
    if (r.tail) console.log(r.tail.split("\n").map((l) => "      " + l).join("\n"));
  }
}

// Hand back exactly what a correct baseline would contain for the outcomes
// that need one, so nobody has to invent a signature by hand.
const needsEntry = results.filter((r) => r.outcome === "REGRESSION" || r.outcome === "SIGNATURE_CHANGED");
if (needsEntry.length) {
  const suggestion = {};
  for (const r of needsEntry) {
    suggestion[r.file] = {
      reason: "TODO: say why this is accepted, and what would let it be removed",
      exit_code: r.exit_code,
      signature_contains: r.suggested && r.suggested.length ? r.suggested : ["TODO: no message could be extracted"],
    };
  }
  console.log("\n---- suggested tests/known-failures.json entries ----");
  console.log("Review each one before accepting it. A signature is evidence of a");
  console.log("specific known defect, not permission for the file to fail.");
  console.log(JSON.stringify(suggestion, null, 2));
}

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ discovered: discovered.length, executed, completed, results }, null, 1));
  console.log(`\nmachine-readable results: ${JSON_OUT}`);
}

const incomplete = discovered.length !== completed;
const bad = BAD.reduce((n, o) => n + count(o), 0);
if (bad || incomplete) {
  console.error(
    `\nFAIL: ${bad} unacceptable outcome(s)` +
      (incomplete ? `; ${discovered.length - completed} file(s) did not run to completion` : "")
  );
  process.exit(1);
}
console.log("\nOK: every file ran to completion; every failure matched a declared signature.");
