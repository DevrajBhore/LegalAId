/**
 * cardinalitySupport.test.mjs — THREE LEVELS THAT MUST NOT COLLAPSE
 *
 *     ADMITTED_BY_ENGINE  ≠  EXPOSED_BY_INTAKE  ≠  LEGALLY_SUPPORTED
 *
 * D4.18's admission rule made `party_3_name` acceptable on 28 document types in
 * one commit. That is a fact about the engine. It is not a claim that a
 * promissory note may have three makers, and it is not permission for a form to
 * start asking for one.
 *
 * The failure this file prevents is a quiet ratchet: somebody notices that the
 * backend accepts a third principal, concludes the form should offer the field,
 * and a structural capability becomes a product assertion that the family has
 * been reviewed — with no advocate ever having looked. The direction of travel
 * has to be the other way. **Exposure follows legal support; it is never derived
 * from admission.**
 *
 * So the levels are measured rather than declared. Admission is computed from
 * the same predicate sanitisation uses, and exposure from the same builder that
 * serves /document-config/:type, so neither can drift away from what the system
 * actually does while this file goes on passing.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getVariables } from "../backend/config/variableConfig.js";
import { buildDocumentFields } from "../backend/services/documentIntakeConfig.js";
import { isRosterExtensionField } from "../backend/services/partyRoster.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const doc = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/cardinality-support.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));

const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];
const formFieldNames = (type) => {
  const built = buildDocumentFields(type) || [];
  const list = Array.isArray(built) ? built : Object.keys(built);
  return new Set(list.map((f) => f?.name || f));
};

const measured = [];
for (const type of Object.keys(baseline.types)) {
  const fields = new Set(Object.keys(getVariables(type) || {}));
  const prefix = PRINCIPAL_PREFIXES.find(
    (p) => fields.has(`${p}_1_name`) && fields.has(`${p}_2_name`));
  if (!prefix) continue;
  measured.push({
    type, prefix,
    admitted: isRosterExtensionField(`${prefix}_3_name`, fields),
    exposed: formFieldNames(type).has(`${prefix}_3_name`),
  });
}

check("the record matches what the engine actually admits", () => {
  /*
   * Measured from the predicate sanitisation uses, not copied into JSON by hand.
   * A record that can drift from the behaviour it describes is worse than none,
   * because it is believed.
   */
  const recorded = new Map(doc.families.map((f) => [f.document_type, f]));
  assert.strictEqual(recorded.size, measured.length,
    `${measured.length} families admit a third principal; ${recorded.size} are recorded`);
  for (const m of measured) {
    const r = recorded.get(m.type);
    assert.ok(r, `${m.type} admits a third principal and is not recorded`);
    assert.strictEqual(r.admitted_by_engine, m.admitted,
      `${m.type}: recorded admission disagrees with the admission rule`);
    assert.strictEqual(r.principal_series, `${m.prefix}_N_*`);
  }
});

check("no form offers a third principal, and the record says so", () => {
  /*
   * The containment. An API caller can build a three-party deed today and get a
   * correct one; no user is invited to by a form until a family is reviewed.
   */
  for (const m of measured) {
    assert.strictEqual(m.exposed, false,
      `${m.type} now offers ${m.prefix}_3_name on its form — a family nobody has reviewed for ` +
      `three principals is inviting users to make one`);
  }
  for (const f of doc.families) {
    assert.strictEqual(f.exposed_by_intake, false,
      `${f.document_type} is recorded as exposed; update the record only after review`);
  }
  assert.strictEqual(doc.summary.families_exposed_by_intake, 0);
});

check("admission does not imply exposure, and the gap is the point", () => {
  const admitted = measured.filter((m) => m.admitted).length;
  const exposed = measured.filter((m) => m.exposed).length;
  assert.ok(admitted > 0, "nothing is admitted; the rule has stopped working");
  assert.ok(admitted > exposed,
    "every admitted family is now exposed — the two levels have collapsed into one");
});

check("exposure never runs ahead of legal support", () => {
  /*
   * The ordering rule, stated as an implication rather than as two counts: a
   * family may be exposed ONLY if it has been reviewed. Today the antecedent is
   * empty, so this passes vacuously — and it is written now precisely so that it
   * stops being vacuous the moment somebody adds a form field.
   */
  for (const f of doc.families) {
    if (!f.exposed_by_intake) continue;
    assert.strictEqual(f.legally_supported, "REVIEWED_SUPPORTED",
      `${f.document_type} is exposed to users without an advocate having established ` +
      `that the family operates correctly above two principals`);
    assert.ok(f.reviewed_by, `${f.document_type} claims review with no reviewer named`);
  }
});

check("legal support is never claimed without a named reviewer", () => {
  for (const f of doc.families) {
    if (f.legally_supported === "REVIEWED_SUPPORTED") {
      assert.ok(f.reviewed_by && f.reviewed_on,
        `${f.document_type} claims legal support with no reviewer and no date`);
    } else {
      assert.strictEqual(f.legally_supported, "NOT_REVIEWED",
        `${f.document_type}: unknown support state ${f.legally_supported}`);
    }
  }
  assert.strictEqual(doc.summary.families_legally_supported, 0,
    "a family claims N-party legal support; that is an advocate's signature, not a build step");
});

check("statutory permissibility is not recorded as legal support", () => {
  /*
   * The same conflation one level down. The Partnership Act plainly contemplates
   * more than two partners; that says nothing about whether this deed's clauses
   * have been classified for three. Four families carry a statutory note and
   * none of them is thereby supported.
   */
  const withStatute = doc.families.filter((f) => f.statute_permits_more_than_two === "YES");
  assert.ok(withStatute.length >= 3, "the statutory notes have been dropped");
  for (const f of withStatute) {
    assert.strictEqual(f.legally_supported, "NOT_REVIEWED",
      `${f.document_type}: the statute permitting three principals was read as the family being ready`);
    assert.ok(f.statutory_note, `${f.document_type}: a statutory claim with no authority behind it`);
  }
  const partnership = doc.families.find((f) => f.document_type === "PARTNERSHIP_DEED");
  assert.ok(/Partnership Act/.test(partnership.statutory_note));
});

check("doubtful families are recorded, not excluded by intuition", () => {
  /*
   * PROMISSORY_NOTE and POWER_OF_ATTORNEY are admitted and a third principal in
   * either is doubtful. The temptation is an exclusion list; that would be
   * guessing at the Negotiable Instruments Act and the Powers-of-Attorney Act in
   * a JSON file. They are recorded NOT_REVIEWED like everything else, and an
   * unreviewed family is not exposed — which is the containment doing its job
   * without anybody having to guess.
   */
  for (const type of ["PROMISSORY_NOTE", "POWER_OF_ATTORNEY"]) {
    const f = doc.families.find((x) => x.document_type === type);
    if (!f) continue;
    assert.strictEqual(f.legally_supported, "NOT_REVIEWED");
    assert.strictEqual(f.exposed_by_intake, false);
    assert.strictEqual(f.statute_permits_more_than_two, "NOT_ASSESSED",
      `${type}: a statutory position was asserted without the research to back it`);
  }
});

console.log(`\nALL GREEN (${checks} checks)`);
