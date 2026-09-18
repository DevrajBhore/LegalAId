/**
 * crossTreatmentCoherence.test.mjs — THE INCONSISTENCY IS A DRAFTING GAP, NOT AN ENGINE GAP
 *
 * D4.24 found that a liability cap and an indemnity, each answered admissibly,
 * can jointly promise more cover than the cap permits, and that looked like a
 * case for a cross-treatment consistency engine. D4.25 falsified that reading by
 * testing a family with a different legal structure.
 *
 * The guarantee family has no such inconsistency, for two reasons that are
 * different from each other and must not be collapsed:
 *
 *   1. It DRAFTS the interaction, from both ends — the cap applies "taken
 *      together with any liability under the indemnity", and the indemnity
 *      "forms part of, and shall not increase, the aggregate cap".
 *
 *   2. Contract Act s.146 does NOT resolve the conflict, because there is none
 *      for it to resolve. It allocates as between co-sureties; the cap bounds
 *      what the creditor may recover under s.128's "unless otherwise provided".
 *      Different axes cannot contradict.
 *
 * The test guards the comparison itself, because the comparison is the finding.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

const INTERACTION = /taken together with any liability under the indemnity|forms part of, and shall not increase, the aggregate cap/i;

async function clauses(type, ids) {
  const r = await generateDocument({
    document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
  });
  return Object.fromEntries((r?.draft?.clauses || [])
    .filter((c) => ids.includes(c.clause_id)).map((c) => [c.clause_id, c.text || ""]));
}

await check("the guarantee family orders cap against indemnity, from both ends", async () => {
  const g = await clauses("GUARANTEE_AGREEMENT", ["GUARANTEE_OBLIGATION_001", "GUARANTEE_INDEMNITY_001"]);
  assert.ok(INTERACTION.test(g.GUARANTEE_OBLIGATION_001 || ""),
    "the guarantee cap no longer says it applies taken together with the indemnity");
  assert.ok(INTERACTION.test(g.GUARANTEE_INDEMNITY_001 || ""),
    "the guarantee indemnity no longer says it forms part of the cap");
});

await check("the families that carry both decision-bearing clauses do not order them", async () => {
  /*
   * The control for the finding above. If this ever starts passing an interaction
   * rule, the drafting gap has been closed and the D4.24 inconsistency is no
   * longer reachable — which would be good news that must not go unnoticed.
   */
  const f = await clauses("FOUNDERS_AGREEMENT",
    ["CORE_LIABILITY_LIMIT_FALLBACK_001", "CORE_INDEMNITY_FULL_001"]);
  assert.ok(Object.keys(f).length >= 1, "FOUNDERS_AGREEMENT no longer carries either clause");
  const ordered = Object.values(f).some((t) => INTERACTION.test(t));
  assert.strictEqual(ordered, false,
    "a family that previously lacked the interaction rule now has one — the gap may be closed; " +
    "re-run probeGuaranteeCoherence.mjs and update the finding rather than inheriting it");
});

await check("the inconsistency is reachable in real documents, not hypothetical", () => {
  /*
   * D4.24's arithmetic would be an academic exercise if no document carried both
   * clauses. It is measured rather than assumed, because the first run of the
   * D4.25 probe asked the MSA for a clause the MSA does not ship.
   */
  const baseline = JSON.parse(fs.readFileSync(
    path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));
  const CAPS = ["CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001", "CORE_LIABILITY_LIMIT_FALLBACK_001"];
  const bearing = Object.entries(baseline.types).filter(([, levels]) => {
    const ids = new Set(Object.values(levels).flatMap((l) => l?.clauses || []));
    return ids.has("CORE_INDEMNITY_FULL_001") && CAPS.some((c) => ids.has(c));
  }).map(([t]) => t);
  assert.ok(bearing.length >= 3,
    `only ${bearing.length} document types carry a cap together with CORE_INDEMNITY_FULL_001; ` +
    `if this falls to zero the D4.24 finding is unreachable and should be re-scoped`);
});

await check("no consistency engine was built on one family's evidence", () => {
  /*
   * The restraint. D4.24 looked like a case for a cross-treatment consistency
   * checker; D4.25 showed the defect is prevented by one sentence of ordinary
   * drafting that this repository already contains elsewhere. A detector for a
   * defect that drafting prevents is the wrong artifact.
   */
  const built = ["backend/services/treatmentCoherence.js", "backend/services/consistencyEngine.js",
    "backend/services/crossTreatmentValidator.js"]
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
  assert.deepStrictEqual(built, [],
    `a cross-treatment consistency engine exists (${built.join(", ")}). D4.25 concluded the defect ` +
    `is a missing interaction clause, not a missing engine. If that conclusion has been overturned ` +
    `by later evidence, replace this assertion deliberately rather than deleting it`);
});

console.log(`\nALL GREEN (${checks} checks)`);
