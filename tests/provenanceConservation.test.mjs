/**
 * provenanceConservation.test.mjs — D4.43
 *
 * THE HARD GATE. Every (family, input world) case in the corpus must produce the
 * same result, the same clause order, the same rendered text, the same validation,
 * the same plain-text export and the same disclosure block as the code did BEFORE
 * provenance was recorded. The only permitted difference is draft.metadata.provenance.
 *
 * The snapshot (tests/fixtures/provenance-conservation.snapshot.json) was captured
 * from the pre-D4.43 code with time frozen. If this fails, the contract has been
 * violated: stop, do not re-capture. Re-capturing is legitimate only for a change
 * that is MEANT to alter shipped output, and must be recorded as such.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = spawnSync(process.execPath, ["scripts/provenanceConservation.mjs", "compare", "tests/fixtures/provenance-conservation.snapshot.json"],
  { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = (run.stdout || "").split("\n").filter((l) => !l.startsWith("[")).join("\n");
if (run.status !== 0 || !/CONSERVED/.test(out)) {
  console.error(out.slice(-4000), run.stderr?.slice(-2000));
  console.error("FAIL  provenance conservation — the artifact changed. The contract says: stop.");
  process.exit(1);
}
console.log(out.trim().split("\n").slice(-1)[0]);
console.log("PASS  provenance conservation over the whole corpus\n\n1 checks passed");
