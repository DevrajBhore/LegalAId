/**
 * conceptLayerGaps.test.mjs — found in D4.41
 *
 * PINS THREE DEFECTS THAT ARE DELIBERATELY NOT REPAIRED.
 *
 * The concept layer declares behaviour its evaluator does not execute. None of
 * the three is fixed here: two change what documents contain, and concept
 * unresolved_behaviour was out of bounds for the phase that found them.
 *
 * Each check asserts the defect is STILL PRESENT. When someone repairs one, this
 * file fails — which is the point: concept-layer-gaps.json, and the D4.39/D4.40
 * corrections that cite it, must be updated in the same change.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConcepts, resolveConcept, conceptAttaches, matches } from "../backend/services/conceptResolver.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const REPAIRED = (id) => `looks REPAIRED. Update concept-layer-gaps.json (${id}) and the D4.39/D4.40 corrections that cite it, in the same change.`;

const R = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/governance/concept-layer-gaps.json"), "utf8"));
const CONCEPTS = loadConcepts();

check("the record still lists exactly the three gaps this file pins", () => {
  assert.deepStrictEqual(R.gaps.map((g) => g.id),
    ["REQUIRES_DIMENSIONS_IS_NEVER_READ", "ASSUME_PRESENT_IS_NOT_IMPLEMENTED", "ARRAY_VAR_IS_READ_AS_ONE_MISSING_KEY"]);
});

check("gap 1 — requires_dimensions is declared and read by no code", () => {
  const declaring = [...CONCEPTS.values()].filter((c) => c.requires_dimensions && Object.keys(c.requires_dimensions).length);
  assert.ok(declaring.length >= 5, "premise changed: few concepts still declare requires_dimensions.");
  const readers = [];
  for (const dir of ["backend", "shared", "IRE", "scripts"]) {
    (function walk(d) {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
        if (/\.m?js$/.test(e.name) && /requires_dimensions/.test(fs.readFileSync(p, "utf8"))) readers.push(path.relative(ROOT, p));
      }
    })(path.join(ROOT, dir));
  }
  assert.deepStrictEqual(readers, [], `requires_dimensions is now read by ${readers.join(", ")} — the gap ${REPAIRED("REQUIRES_DIMENSIONS_IS_NEVER_READ")}`);
});

check("gap 2 — assume:present is declared by three concepts and not executed", () => {
  const presentDeclarers = [...CONCEPTS.values()].filter((c) => c.unresolved_behaviour?.assume === "present");
  assert.deepStrictEqual(presentDeclarers.map((c) => c.concept_id).sort(),
    ["COMPULSORILY_REGISTRABLE", "GST_TAXABLE_SUPPLY", "TDS_DEDUCTIBLE_PAYMENT"],
    "the set of concepts declaring assume:present changed.");
  for (const c of presentDeclarers) {
    const r = resolveConcept(c, {}, {});
    assert.strictEqual(r.state, "UNRESOLVED", `${c.concept_id} resolved ${r.state} with no input — the gap ${REPAIRED("ASSUME_PRESENT_IS_NOT_IMPLEMENTED")}`);
    assert.strictEqual(r.assumed, false, `${c.concept_id} now reports an assumption was made.`);
    assert.strictEqual(conceptAttaches(r), false, `${c.concept_id} now attaches its clauses when unresolved.`);
  }
  /* The contrast that makes it a gap rather than a policy: safe_default DOES execute. */
  const sd = [...CONCEPTS.values()].find((c) => c.unresolved_behaviour?.assume === "safe_default");
  assert.strictEqual(resolveConcept(sd, {}, {}).state, "PRESENT", "safe_default no longer executes; the contrast is gone.");
});

check("gap 3 — an array var is read as one missing key, so supplied evidence records ABSENCE", () => {
  assert.strictEqual(matches({ var: ["party_1_gstin", "party_2_gstin"], op: "present" }, { party_1_gstin: "27AAACA1234A1Z5" }), false,
    `the mechanism now evaluates an array var — the gap ${REPAIRED("ARRAY_VAR_IS_READ_AS_ONE_MISSING_KEY")}`);
  const gst = resolveConcept(CONCEPTS.get("GST_TAXABLE_SUPPLY"), { party_1_gstin: "27AAACA1234A1Z5" }, {});
  assert.strictEqual(gst.state, "ABSENT",
    `supplying a GSTIN now resolves GST_TAXABLE_SUPPLY as ${gst.state} — the gap ${REPAIRED("ARRAY_VAR_IS_READ_AS_ONE_MISSING_KEY")}`);
  const tds = resolveConcept(CONCEPTS.get("TDS_DEDUCTIBLE_PAYMENT"), { party_2_pan: "AAACA1234A" }, {});
  assert.strictEqual(tds.state, "ABSENT", `supplying a PAN now resolves TDS_DEDUCTIBLE_PAYMENT as ${tds.state}.`);
});

check("the record still forbids the two tempting repairs", () => {
  const joined = JSON.stringify(R.$do_not_repair_by || []);
  assert.ok(/advocate/i.test(joined), "the record no longer requires the advocate before assume:present is made to execute.");
  assert.ok(/growing the one evaluator/i.test(joined), "the record no longer warns against special-casing array vars inside matches().");
});

console.log(`\n${checks} checks passed`);
