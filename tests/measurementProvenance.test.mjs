/**
 * measurementProvenance.test.mjs — WHICH TREE DID YOU MEASURE?
 *
 * On 15 and 17 September this investigation reported "314 checks green, no
 * baseline drift" three times. Every one of those runs was made in a working
 * copy whose knowledge-base differed from the product's. The product could not
 * generate a single document. Every document type failed in production while
 * the suite reported green.
 *
 * The coverage was never missing. documentRequirements.test.mjs calls
 * loadDocumentRequirements({refresh:true}) at module scope, and on the product
 * tree it dies on import with the identical error the users were seeing.
 * Restoring the pre-fix files and running that one file reproduces it exactly.
 *
 * So the suite was right and the measurement was wrong, and the thing that made
 * it wrong is invisible in the output: nothing a suite run prints says WHAT it
 * ran against. A copy with no provenance produces a number that looks the same
 * as one from the shipped tree.
 *
 * This file makes the answer part of the result. It does not check correctness
 * of anything; it establishes that the run can be attributed at all.
 */
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return null; }
};

check("the tree being measured has a provenance", () => {
  /*
   * THE CHECK THAT WOULD HAVE CAUGHT IT.
   *
   * The copy those three green runs came from was not a git working tree at
   * all — `git status` in it answered "fatal: not a git repository". It had no
   * commit, no branch and no way to say which version of the knowledge base it
   * held, and it still produced a number that read exactly like a number from
   * the shipped tree.
   *
   * A green suite from a tree that cannot say what it is is not evidence.
   */
  const head = git("rev-parse", "HEAD");
  assert.ok(head, [
    "this is not a git working tree, so nothing here can be attributed to a version.",
    "Run the suite in the repository, not in a derived copy. A copy that cannot name",
    "its commit produces a result indistinguishable from one that can, which is how",
    "three green runs coexisted with a product that generated nothing.",
  ].join(" "));
});

check("the run states what it measured", () => {
  /*
   * A digest over the two trees that decide what a document becomes. It is not
   * compared against anything — there is no pinned value to drift from, and
   * inventing one would only pin whatever happened to be here today. It is
   * PRINTED, so that two runs reporting different numbers can be told apart
   * afterwards by something other than memory.
   */
  const digest = (dir, exts) => {
    const hash = crypto.createHash("sha256");
    const walk = (d) => {
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!exts.some((x) => e.name.endsWith(x))) continue;
        hash.update(path.relative(ROOT, full));
        hash.update(fs.readFileSync(full));
      }
    };
    walk(path.join(ROOT, dir));
    return hash.digest("hex").slice(0, 12);
  };

  const head = git("rev-parse", "--short", "HEAD");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const dirty = (git("status", "--porcelain") || "").split("\n").filter(Boolean).length;

  console.log(`      commit ${head} on ${branch}${dirty ? `, ${dirty} uncommitted path(s)` : ", clean"}`);
  console.log(`      knowledge-base ${digest("knowledge-base", [".json"])}` +
              `  backend/services ${digest("backend/services", [".js"])}`);

  assert.ok(head && branch, "the run could not name its own commit");
});

check("the knowledge the product loads is loadable here", () => {
  /*
   * NOT a new guard. documentRequirements and canonicalFacts already refuse
   * inadmissible knowledge, and documentRequirements.test.mjs already loads every
   * source. Duplicating that check would add nothing.
   *
   * What this asserts is narrower and was the actual gap: that the two loaders
   * run AT ALL in this tree, so a copy missing a file the product has cannot
   * report green by never reaching it. semantic_facts.json did not exist, and
   * because loadSemanticFacts tolerates ENOENT, its absence was silent until a
   * requirement rested on a fact it should have declared.
   */
  const facts = path.join(ROOT, "knowledge-base/intake/semantic_facts.json");
  assert.ok(fs.existsSync(facts), [
    "knowledge-base/intake/semantic_facts.json is absent. loadSemanticFacts treats",
    "ENOENT as an empty set, so this does not throw — it silently narrows the surface",
    "a requirement may rest on, and the failure surfaces later as an inadmissible",
    "requirement source. That is how every document type stopped generating.",
  ].join(" "));
  const doc = JSON.parse(fs.readFileSync(facts, "utf8"));
  assert.ok(Array.isArray(doc.facts) && doc.facts.length,
    "semantic_facts.json declares no facts; every requirement resting on one will be refused");
});

console.log(`\n${checks} checks passed`);
