/**
 * freezeSurvivalStale.mjs — D4.47. Run once, on a full conservation capture of
 * the D4.46 engine (commit 39422d779):
 *   node scripts/freezeSurvivalStale.mjs <full-capture.json> <out.json>
 * Keeps every shipped draft whose survival clause omits indemnity or limitation
 * of liability although the draft contains them.
 */
const [capture, out] = process.argv.slice(2);
const fs = await import("fs");
const full = JSON.parse(fs.readFileSync(capture, "utf8"));
const cases = [];
for (const [key, entry] of Object.entries(full)) {
  const result = typeof entry.json === "string" ? JSON.parse(entry.json) : entry.json;
  const draft = result?.draft;
  const survival = draft?.clauses?.find((c) => c.clause_id === "CORE_SURVIVAL_001");
  if (!survival) continue;
  const ids = draft.clauses.map((c) => c.clause_id);
  const missing = [];
  if (ids.some((id) => /INDEMNIT/.test(id)) && !/indemnity/.test(survival.text)) missing.push("indemnity");
  if (ids.some((id) => /LIABILITY/.test(id)) && !/limitation of liability/.test(survival.text)) missing.push("limitation of liability");
  if (!missing.length) continue;
  cases.push({ case: key, missing, survival_text: survival.text, clause_ids: ids, shown: { certification: result.validation?.certification, score: result.validation?.score },
    document_type: draft.document_type,
    referencing_clauses: draft.clauses.filter((c) => ["CORE_SURVIVAL_001", "CORE_TERMINATION_001", "SERVICE_TERMINATION_001"].includes(c.clause_id))
      .map((c) => ({ clause_id: c.clause_id, title: c.title, text: c.text })) });
}
fs.writeFileSync(out, JSON.stringify({
  $comment: [
    "Frozen 16 Oct 2026 (D4.47) from the D4.46 engine (commit 39422d779), conservation capture. Never regenerate.",
    "Each shipped draft contains an indemnity and a limitation-of-liability clause, injected by enhanceCommercially after the survival list was drawn, and its Survival clause does not name them.",
    "tests/survivalReferences.test.mjs requires validation to flag each of these and the current engine to draw the list from the final clause set.",
    "Compacted: each case keeps its clause ids and the full text of the clauses that enumerate surviving provisions, which is everything the survival check reads.",
  ],
  captured_from_commit: "39422d779",
  cases,
}, null, 1) + "\n");
console.log(cases.length, cases.map((c) => `${c.case}: ${c.missing.join("+")}`).join("\n"));
