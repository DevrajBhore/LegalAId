/**
 * statutoryFailureVisible.test.mjs — A STATUTORY LAYER THAT DID NOT RUN MUST SAY SO
 *
 * runStatutoryValidation used to catch every exception, log it, and return
 * whatever issues had accumulated. A failure before the first finding therefore
 * returned an empty list: indistinguishable from "checked against the mapped
 * statutes and found nothing".
 *
 * It now reports context.status ("completed" | "failed") and, on failure, a
 * STATUTORY_CHECK_UNAVAILABLE finding. The engine carries the status into
 * _layers, and the validation coverage lists the layer as run or skipped.
 */
import assert from "node:assert/strict";
import {
  runStatutoryValidation,
  statutoryCheckUnavailableIssue,
} from "../IRE/src/statutes/statutoryEngine.js";
import { runDocumentValidation } from "../backend/services/validationService.js";

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
  console.log(`PASS  ${msg}`);
};

/* ── 1. A throw inside the layer is reported, not swallowed ─────────────── */
const originalError = console.error;
console.error = () => {}; // the engine logs the failure; keep test output clean
let failed;
try {
  failed = await runStatutoryValidation(null);
} finally {
  console.error = originalError;
}
ok(failed.context.status === "failed", "a throwing statutory run reports status=failed");
ok(typeof failed.context.error === "string" && failed.context.error.length > 0,
  "the failure carries its error message");
const unavailable = failed.issues.find((i) => i.rule_id === "STATUTORY_CHECK_UNAVAILABLE");
ok(Boolean(unavailable), "a failed run emits STATUTORY_CHECK_UNAVAILABLE instead of an empty list");
ok(unavailable.severity === "HIGH" && unavailable.blocks_generation === false,
  "the unavailable finding is HIGH but does not block by itself");
ok(unavailable.manual_review_required === true && unavailable.notice_only !== true,
  "the unavailable finding is actionable (counts against 'checks passed'), not a notice");

/* ── 2. The issue factory never throws on odd input ─────────────────────── */
ok(statutoryCheckUnavailableIssue(undefined).rule_id === "STATUTORY_CHECK_UNAVAILABLE",
  "the unavailable finding can be built without an error object");

/* ── 3. A normal run is unchanged ───────────────────────────────────────── */
// Clean output must stay byte-identical (provenanceConservation), so a
// completed run carries no status field and adds nothing to coverage.
const draft = {
  document_type: "NDA",
  clauses: [
    {
      clause_id: "NDA_TEST_CONFIDENTIALITY",
      category: "CONFIDENTIALITY",
      title: "Confidentiality",
      text: "The Receiving Party shall keep the Confidential Information confidential.",
    },
  ],
  metadata: {},
};
const completed = await runStatutoryValidation(draft);
ok(completed.context.status !== "failed" &&
   !completed.issues.some((i) => i.rule_id === "STATUTORY_CHECK_UNAVAILABLE"),
  "a normal statutory run is not reported as failed");

const finalRun = await runDocumentValidation(draft, { mode: "final", documentType: "NDA" });
ok(finalRun.layers?.statutory_status === undefined,
  "a completed run adds no statutory_status to the layers");
ok(!finalRun.coverage?.layers_skipped?.some((s) => s.layer === "statutory_kb"),
  "a completed run is not listed as skipped");

/* ── 4. A failure reaches coverage and the release outcome ─────────────── */
// Drive formatValidationResult the way runDocumentValidation does after the
// engine reports a failed statutory layer.
const { formatValidationResult } = await import("../backend/services/validationService.js");
const formatted = formatValidationResult({
  mode: "final",
  issues: [statutoryCheckUnavailableIssue(new Error("boom"))],
  layers: { statutory_status: "failed", statutory_error: "boom" },
  coverage: { layers_run: ["rule_engine"], layers_skipped: [{ layer: "statutory_kb", reason: "failed to complete: boom", failed: true }] },
});
ok(formatted.checks_passed === false && formatted.certified === false,
  "a failed statutory layer means checks did NOT pass");
ok(formatted.blockingIssues.length === 0 && formatted.advisoryIssues.some((i) => i.rule_id === "STATUTORY_CHECK_UNAVAILABLE"),
  "the failure is advisory, not blocking");

console.log(`\nALL GREEN (${checks} checks)`);
