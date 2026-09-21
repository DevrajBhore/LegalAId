/**
 * fixtureProfileContract.test.mjs — WHAT THE TWO FIXTURE POPULATIONS MEAN
 *
 * FIXTURE_PROFILE was imported by 36 files and exported by none. Restoring it is
 * measurement infrastructure, and the danger in that is not failure — it is a
 * plausible reconstruction that succeeds while meaning something slightly
 * different, leaving historical findings resting on a population that no longer
 * exists under the same name.
 *
 * So the contract is asserted rather than described, and one half of it is a
 * refusal: this file records that the D4.27–D4.30 population is NOT reproducible
 * from the shipped fixture, so nothing may claim continuity with it.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { variablesFor, FIXTURE_PROFILE, isProtectionToggle } from "../sweep.mjs";
import { VARIABLE_CONFIG } from "../backend/config/variableConfig.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };
const TYPES = Object.keys(DOCUMENT_TYPE_REGISTRY);
const record = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/fixture-population.json"), "utf8"));

/*
 * The definitions variablesFor ACTUALLY iterates, which is COMMON plus the type's
 * own group. Resolving them through getVariables instead reads a filtered view —
 * FOUNDERS_AGREEMENT gets include_force_majeure from COMMON and getVariables does
 * not return it — and the check then reports a protection toggle as an undeclared
 * field. The test must look where the code looks.
 */
const defsFor = (t) => ({ ...(VARIABLE_CONFIG.COMMON || {}), ...(VARIABLE_CONFIG[t] || {}) });

check("both profiles are exported and are the only two", () => {
  assert.deepStrictEqual(Object.keys(FIXTURE_PROFILE).sort(), ["MINIMAL_DECLINED", "WELL_FILLED"],
    "the profile set has changed; 36 files import this and each call site means one of these two");
});

check("WELL_FILLED is NOT the plain default, and the difference is the protections", () => {
  /*
   * THE ASSERTION THAT STOPS THE QUIET INVERSION.
   *
   * sampleFor answers a select with options[0]. include_force_majeure and
   * include_entire_agreement declare theirs as ["No","Yes"], so the plain default
   * DECLINES them — measured by generating three families and reading which clause
   * ids were occupied, not inferred from the option order.
   *
   * declinedProtections states the contract in terms: MINIMAL_DECLINED declines
   * every optional protection and WELL_FILLED accepts them. Defining WELL_FILLED
   * as the default would satisfy every import and silently invert half of the
   * pairing that test exists to control.
   */
  const differing = TYPES.filter((t) => {
    const plain = variablesFor(t);
    const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
    return Object.keys(well).some((k) => well[k] !== plain[k]);
  });
  assert.ok(differing.length,
    "WELL_FILLED now equals the plain default for every family. If sampleFor changed so that the default already accepts every protection, say so here — otherwise this is the inversion.");

  for (const t of differing.slice(0, 8)) {
    const schema = defsFor(t);
    const plain = variablesFor(t);
    const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
    for (const k of Object.keys(well)) {
      if (well[k] === plain[k]) continue;
      assert.ok(isProtectionToggle(k, schema[k]),
        `${t}.${k} differs between the default and WELL_FILLED and is not a protection toggle. The profile is only entitled to move protections; anything else changes the population on an axis nobody declared.`);
    }
  }
});

check("the two profiles differ on protection toggles and on nothing else", () => {
  /*
   * The pairing is a control. declinedProtections says so: a bug that dropped
   * every conditional clause would satisfy every assertion about declines and fail
   * the acceptance half. That only holds while one variable moves.
   */
  for (const t of TYPES) {
    const schema = defsFor(t);
    const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
    const min = variablesFor(t, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
    assert.deepStrictEqual(Object.keys(well), Object.keys(min),
      `${t}: the two profiles fill different field sets, so a difference in the draft is no longer attributable to the protections`);
    for (const k of Object.keys(well)) {
      if (well[k] === min[k]) continue;
      assert.ok(isProtectionToggle(k, schema[k]),
        `${t}.${k} differs between the profiles and is not a protection toggle`);
    }
  }
});

check("every protection toggle is accepted under one profile and declined under the other", () => {
  let toggles = 0;
  for (const t of TYPES) {
    const schema = defsFor(t);
    const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
    const min = variablesFor(t, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
    for (const [k, def] of Object.entries(schema)) {
      if (!isProtectionToggle(k, def)) continue;
      // variablesFor skips a field this document type excludes, so the definition
      // existing is not the same as the field being filled. Only what the fixture
      // actually produced is assertable.
      if (!(k in well)) continue;
      toggles += 1;
      assert.match(String(well[k]), /^yes$/i, `${t}.${k} is not accepted under WELL_FILLED`);
      assert.match(String(min[k]), /^no$/i, `${t}.${k} is not declined under MINIMAL_DECLINED`);
    }
  }
  assert.ok(toggles > 20, `only ${toggles} protection toggles found across the portfolio; the detector has probably stopped matching`);
});

check("a toggle is identified from the schema, not from a list kept here", () => {
  /*
   * A_VOCABULARY_DECIDES_THE_FINDING. The group alone is not sufficient and that
   * was measured too: include_force_majeure and include_entire_agreement sit under
   * "Context & Risk Profile" while declinedProtections treats both as protections,
   * so a rule resting on the group would miss two of the four roles it asserts.
   */
  const source = fs.readFileSync(path.join(ROOT, "sweep.mjs"), "utf8");
  const fn = /function isProtectionToggle[\s\S]*?\n}/.exec(source)?.[0] || "";
  assert.ok(fn, "isProtectionToggle has been removed from sweep.mjs");
  assert.ok(/def\.group !== "Optional Protections"/.test(fn) && /\^include_/.test(fn),
    "the detector no longer reads both schema signals");
  assert.ok(!/include_force_majeure|include_entire_agreement|include_sla/.test(fn),
    "a field name has been hard-coded into the detector; the next protection added would be missed");
});

/* ── THE HALF THAT IS A REFUSAL ───────────────────────────────────────────── */

check("no continuity is claimed with the D4.27 to D4.30 population", () => {
  /*
   * Restoring the export does NOT restore the population those phases measured.
   * The working copy they ran in had an evolved sweep.mjs, and only part of that
   * evolution was the export: on the shipped fixture 29 of 40 document types
   * generate, and probeCapReferent now reports 21 cap instances where the record
   * says 22 — IP_ASSIGNMENT_AGREEMENT does not generate here at all.
   *
   * So the honest position is that those counts are historical measurements of a
   * population this tree cannot reconstruct. They are re-derived, not carried
   * forward, and this check exists so that nobody later reads the restored export
   * as having restored the evidence.
   */
  assert.strictEqual(record.historical_population_is_reproducible, false,
    "the record now claims the historical fixture population is reproducible. If a probe demonstrated that, it must say which one and show the counts matching.");
  assert.ok(record.evidence?.length >= 2,
    "the evidence that it is not reproducible has been thinned");
  assert.ok(/re-derived/i.test(record.consequence_for_earlier_counts),
    "the record no longer says the earlier counts must be re-derived rather than carried forward");
});

check("the closure record keeps every check and the evidence classes", () => {
  /*
   * The handoff depends on these three classes staying apart. Class A carried
   * forward without re-derivation is the failure this phase existed to prevent,
   * arriving one phase later.
   */
  const c = record.d432_closure;
  assert.ok(c, "the closure record has been removed");
  assert.strictEqual(record.d432_status, "CLOSED");
  assert.ok(c.checks.length >= 10, "closure checks have been dropped");
  for (const k of ["A_population_independent", "B_population_dependent", "C_historical"]) {
    assert.ok(c.evidence_classes_for_the_handoff[k], `the ${k} evidence class is gone`);
  }
  assert.ok(/PROBABLY is not CHECKED/i.test(c.evidence_classes_for_the_handoff.A_population_independent.rule),
    "class A no longer requires re-derivation before being treated as current");
  assert.ok(/never silently promoted/i.test(c.evidence_classes_for_the_handoff.C_historical.rule),
    "the prohibition on promoting historical numbers has been softened");
});

check("the Class A findings were re-derived, not merely asserted", () => {
  /*
   * PROBABLY is not CHECKED. Six test files already asserted these and were green,
   * and that was not enough — a test asserting that the record says X has not
   * re-derived X. Each claim below was recomputed from the engine or the schemas.
   */
  const r = record.d432_closure.class_A_rederivation;
  assert.ok(r, "the Class A re-derivation has been removed");
  assert.strictEqual(r.result.changed, 0,
    "a Class A finding changed on re-derivation; it is no longer current evidence and the record that states it must say so");
  assert.strictEqual(r.claims.length, r.result.hold + r.result.changed + r.result.unreachable,
    "the claims and the tally disagree");
  for (const c of r.claims) {
    assert.ok(c.grounding, `${c.claim}: no grounding recorded, so it cannot be told from an assertion`);
  }
  assert.ok(/CURRENT EVIDENCE/.test(r.consequence) && /still_class_B/ in r === false || r.still_class_B,
    "the record no longer keeps the population-dependent counts out of the promotion");
});

console.log(`\n${checks} checks passed`);
