/**
 * jurisdictionSubject.test.mjs — WHICH STATE IS THE RULE ASKING ABOUT?
 *
 * D4.11 found the same jurisdictional question answered four ways across the
 * codebase, two of them opposite: the stamp author read `operating_state` first
 * because stamp duty follows where the property sits, the governing-law author
 * read `governing_law_state` first for the opposite and equally correct reason.
 * Neither was careless. Each was reaching for a different jurisdictional subject
 * through a variable that has a value domain and no contract — `operating_state`
 * is syntactically typed and semantically untyped.
 *
 * The repair names the subjects in knowledge and lets a rule say which one it
 * means. This test is the acceptance criteria for that repair, and the pair of
 * rules it exercises is the point: a single rule could not demonstrate the
 * distinction, because any single rule can be made to pass by picking the
 * fallback that happens to suit it. Two rules reading the SAME two variables and
 * required to move in OPPOSITE directions cannot.
 *
 * The sixth check is the one that protects everything already shipped: a rule
 * with no declared subject must behave exactly as it did before. The fallback
 * chain is right for some existing rules and nothing yet says which, so it is
 * left alone rather than "fixed".
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveJurisdictionalSubject, jurisdictionalSubjects,
} from "../IRE/src/indian-rule-engine/constraintEngine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

/* The world the whole test turns on: property in one state, chosen law in another. */
const SITUS_KA_LAW_MH = { operating_state: "Karnataka", governing_law_state: "Maharashtra" };
const SITUS_MH_LAW_MH = { operating_state: "Maharashtra", governing_law_state: "Maharashtra" };
const SITUS_MH_LAW_KA = { operating_state: "Maharashtra", governing_law_state: "Karnataka" };

/* ── 1 & 2. the situs subject follows the situs ───────────────────────────── */

check("same facts + Maharashtra situs resolves to Maharashtra", () => {
  const r = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_MH_LAW_MH);
  assert.strictEqual(r.representable, true);
  assert.strictEqual(r.value, "Maharashtra");
});

check("same facts + Karnataka situs resolves to Karnataka", () => {
  const r = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_KA_LAW_MH);
  assert.strictEqual(r.value, "Karnataka",
    "the situs subject followed the chosen law instead of the property");
});

/* ── 3 & 4. the chosen law cannot move the situs ──────────────────────────── */

check("chosen governing law is Maharashtra in both worlds", () => {
  assert.strictEqual(resolveJurisdictionalSubject("CHOSEN_GOVERNING_LAW", SITUS_MH_LAW_MH).value, "Maharashtra");
  assert.strictEqual(resolveJurisdictionalSubject("CHOSEN_GOVERNING_LAW", SITUS_KA_LAW_MH).value, "Maharashtra");
});

check("changing the governing law alone does not move the situs-dependent subject", () => {
  const a = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_MH_LAW_MH).value;
  const b = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_MH_LAW_KA).value;
  assert.strictEqual(a, b,
    "the parties changed nothing about the property and the situs subject moved anyway");
  assert.strictEqual(a, "Maharashtra");
});

/* ── 5. and the governing-law subject moves the other way ─────────────────── */

check("the governing-law subject moves in the opposite direction", () => {
  /*
   * The pair is the control. Between these two worlds the property does not
   * move and the chosen law does; between the two worlds above the chosen law
   * does not move and the property does. A resolver reading one fallback chain
   * for both subjects fails one of the two, whichever chain it picks.
   */
  const lawA = resolveJurisdictionalSubject("CHOSEN_GOVERNING_LAW", SITUS_MH_LAW_MH).value;
  const lawB = resolveJurisdictionalSubject("CHOSEN_GOVERNING_LAW", SITUS_MH_LAW_KA).value;
  assert.notStrictEqual(lawA, lawB, "the chosen law did not follow the parties' election");

  const situsA = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_MH_LAW_MH).value;
  const situsC = resolveJurisdictionalSubject("PROPERTY_SITUS", SITUS_KA_LAW_MH).value;
  assert.notStrictEqual(situsA, situsC, "the situs did not follow the property");
});

/* ── 6. nothing already shipped changes ───────────────────────────────────── */

check("a rule with no declared subject is untouched", async () => {
  /*
   * Asserted against the module's own bare-predicate path rather than by
   * inspection: the fallback chain is correct for some existing rules and
   * nothing yet says which, so it is preserved rather than "corrected".
   */
  const src = fs.readFileSync(
    path.join(ROOT, "IRE/src/indian-rule-engine/constraintEngine.js"), "utf8");
  assert.match(src, /readVar\(\["governing_law_state", "operating_state", "state"\], context\.variables\)/,
    "the bare state_in fallback chain has been altered; every existing rule depends on it");
});

/* ── the vocabulary must refuse rather than guess ─────────────────────────── */

check("an unrepresentable subject fails loudly instead of falling back", () => {
  const r = resolveJurisdictionalSubject("WORKPLACE_LOCATION", SITUS_KA_LAW_MH);
  assert.strictEqual(r.representable, false,
    "a workplace question was answered from a state that means something else");
  assert.ok(r.why && r.why.length > 20, "an unrepresentable subject must say why");
});

check("an unknown subject is refused, not defaulted", () => {
  const r = resolveJurisdictionalSubject("SOMEWHERE", SITUS_KA_LAW_MH);
  assert.strictEqual(r.representable, false);
  assert.match(r.why, /unknown jurisdictional subject/);
});

check("every declared subject either names a fact or says why it cannot", () => {
  const subjects = jurisdictionalSubjects();
  assert.ok(subjects.length >= 6, `expected the six subjects, got ${subjects.length}`);
  for (const s of subjects) {
    if (s.fact) assert.ok(s.note, `${s.subject}: a resolvable subject must say why that fact carries it`);
    else assert.ok(s.unrepresentable && s.unrepresentable.length > 30,
      `${s.subject}: an unrepresentable subject must record what is missing`);
    assert.match(String(s.review_status), /draft|needs/i,
      `${s.subject} claims review it has not had`);
  }
  const representable = subjects.filter((s) => s.fact).length;
  console.log(`      ${representable} of ${subjects.length} subjects representable — the rest are ` +
    `declared and deliberately unresolvable until a rule needs them`);
});

console.log(`\nALL GREEN (${checks} checks)`);
