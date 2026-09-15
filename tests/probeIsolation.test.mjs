/**
 * probeIsolation.test.mjs
 *
 * A TEST MUST NOT BE ABLE TO MODIFY THE SYSTEM IT IS MEASURING.
 *
 * Three times in this codebase a probe wrote a temporary requirements file under
 * a REAL document_type. The loader keys by document_type and the last file read
 * wins, so the probe silently REPLACED that family's authored requirements for
 * the duration of the run — and then the test measured its own fixture and
 * reported the result as a property of the product.
 *
 * The third occurrence stayed invisible for several turns because LOAN_AGREEMENT
 * had no authored requirements to replace. It surfaced the moment the family
 * acquired some, as a TypeError rather than as a wrong answer, which was luck.
 *
 * The repair is not "remember to use a probe type". It is that a probe document
 * type must be recognisable, and a probe must never be able to shadow production
 * knowledge merely by sharing a name with it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";

let checks = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIREMENTS_DIR = path.join(ROOT, "knowledge-base/documents/requirements");

// ── 1. No probe artifact is left behind ────────────────────────────────────
//
// Every probe writes in a try/finally and deletes on the way out. A file
// starting "__" surviving a run means a probe crashed between write and unlink,
// and production knowledge is being shadowed right now.
const stray = fs.readdirSync(REQUIREMENTS_DIR).filter((name) => name.startsWith("__"));
assert.deepEqual(
  stray, [],
  `probe artifacts left in the requirements directory: ${stray.join(", ")}. These are loaded as ` +
  `production knowledge and silently replace any family sharing their document_type.`
);
checks += 1;

// ── 2. Probe types are recognisable, and never a real family ───────────────
const families = [...loadDocumentRequirements({ refresh: true }).keys()];
const probeShaped = families.filter((type) => type.startsWith("__"));
assert.deepEqual(
  probeShaped, [],
  `probe-shaped document types are loaded: ${probeShaped.join(", ")}`
);
checks += 1;

// ── 3. The LOADER refuses a shadowing probe ───────────────────────────────
//
// Enforced where it cannot be forgotten rather than by scanning sources for a
// convention. A first version of this test did scan, and produced two false
// positives of its own: it matched a `document_type:` two hundred lines from
// any probe, and it could not see a payload built in a variable before being
// written. A screen over source text was the wrong instrument for a rule about
// what the loader accepts.
const shadow = path.join(REQUIREMENTS_DIR, "__shadowprobe.requirements.json");
const REAL = families[0];
assert.ok(REAL, "no families are authored, so shadowing cannot be tested");
const payload = (documentType) => JSON.stringify({
  document_type: documentType,
  requirements: [{
    id: "PROBE", kind: "CONTENT",
    statement: "A probe requirement that should never reach production knowledge.",
    identity_test: "Remove it and nothing changes; it exists to test the loader.",
    applicability: { always: true }, satisfied_by: { any_of: ["CORE_IDENTITY_001"] },
    when_unsatisfied: "DISCLOSE", review_status: "probe-only",
  }],
});

// Under a real family's type: refused.
fs.writeFileSync(shadow, payload(REAL));
try {
  assert.throws(
    () => loadDocumentRequirements({ refresh: true }),
    /must use a "__"-prefixed document_type/,
    `a probe artifact declaring "${REAL}" was accepted. It would replace that family's authored ` +
    `requirements for as long as it exists, and any test writing it would then be measuring ` +
    `itself rather than the product.`
  );
  checks += 1;
} finally {
  fs.unlinkSync(shadow);
}

// Under a probe type: accepted, and does not disturb the real families.
fs.writeFileSync(shadow, payload("__SHADOW_PROBE"));
try {
  const withProbe = loadDocumentRequirements({ refresh: true });
  assert.ok(withProbe.has("__SHADOW_PROBE"), "a properly named probe type was not loaded");
  for (const family of families) {
    assert.ok(withProbe.has(family), `${family} disappeared while a probe was present`);
    checks += 1;
  }
  checks += 1;
} finally {
  fs.unlinkSync(shadow);
  loadDocumentRequirements({ refresh: true });
}
const writers = families.length;

console.log(
  `PASS  the loader refuses a probe that shadows any of the ${writers} authored families`
);
console.log(`\nALL GREEN (${checks} checks)`);
