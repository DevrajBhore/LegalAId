/**
 * universality.test.mjs
 *
 * The claim: adding legal knowledge changes what the system does; it does not
 * require changing the system that does it.
 *
 * An artificial family -- a Zorvic Custody Arrangement, a name that appears
 * nowhere in the JavaScript -- is installed as knowledge-base artifacts only,
 * walked end to end, and removed. What it crosses without a code change is the
 * measure of how universal the engine really is, and this test stops that
 * number going down.
 *
 * It is a RATCHET, not a target. Raising the pinned count is progress; lowering
 * it means a generic layer has learned something specific about a document type
 * it should not know.
 */
import assert from "node:assert";
import { proveUniversality } from "../scripts/proveUniversality.mjs";

const { crossed, blocked, residue } = await proveUniversality();
let checks = 0;

// The eight links that are knowledge-driven today. Named individually so a
// regression says which one broke rather than only that the count fell.
const MUST_CROSS = [
  "clauses load from the knowledge base",
  "blueprint resolves for an unknown document type",
  "document type is discovered",
  "the family's own intake schema resolves",
  "intake sections resolve",
  "materiality analysis reads the new blueprint's gates",
  "gap check produced",
  "an answer resolved a position on the new family",
  "conservation holds on a family the engine has never seen",
  "the deterministic engine selected the new clauses",
  "a conditional gate on the new blueprint fired from a resolved position",
];
for (const step of MUST_CROSS) {
  assert.ok(crossed.some((c) => c.startsWith(step.slice(0, 40))),
    `"${step}" no longer works from knowledge alone. A generic layer has learned ` +
    `something document-specific.\n  crossed: ${crossed.join("\n           ")}` +
    `\n  blocked: ${blocked.join("\n           ")}`);
  checks += 1;
}
assert.ok(crossed.length >= 11 && blocked.length === 0,
  `${crossed.length} of ${crossed.length + blocked.length} links are knowledge-driven; the ` +
  `pinned floor is all of them. Still blocked: ${blocked.join(", ") || "none"}.\n\n` +
  `A new legal family must be introducible entirely through validated knowledge artifacts. ` +
  `If this fails, something in the engine has started needing to know a document type by name.`);
checks += 1;

// The negative requirement. Removing the family's knowledge must leave nothing.
assert.deepStrictEqual(residue, [],
  `the synthetic family left artifacts behind: ${residue.join(", ")}`);
checks += 1;

console.log(
  `PASS  ${crossed.length} of ${crossed.length + blocked.length} links knowledge-driven; ` +
  `still blocked: ${blocked.length}`
);
console.log(`\nALL GREEN (${checks} checks)`);
