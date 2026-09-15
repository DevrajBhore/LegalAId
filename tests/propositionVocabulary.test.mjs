/**
 * propositionVocabulary.test.mjs — WHAT A CLAUSE IS FOR, VERSUS WHAT IT CITES
 *
 * D4.5 found that 198 of 315 clauses declare no primary authority, and that
 * citation counts cannot substitute for one: ICA 1872 s.73 appears in 26 clauses
 * as background ("damages for breach"), not because 26 clauses implement one
 * damages treatment. `implements` is the declaration that closes that gap.
 *
 * The vocabulary is only useful if it DISCRIMINATES. A proposition drawn broadly
 * enough to cover everything ("the parties have obligations") would report
 * magnificent reuse while carrying no information, and would then be used to
 * justify a treatment layer on evidence that is an artefact of its own
 * vagueness. So this test holds the line in both directions: every reference
 * must resolve, and the control clauses must stay disjoint from every sampled
 * group.
 *
 * It also locks the D4.4-B finding in the new vocabulary.
 * `PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED` is implemented by exactly one clause,
 * and that clause is gated on a different proposition entirely. While that
 * remains true, closing the gate removes a rule the document has no other way to
 * express — and the test says so at the level of the proposition rather than of
 * the statute, which is the level at which the repair has to be reasoned about.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const vocabulary = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"));
const propositions = new Map(vocabulary.propositions.map((p) => [p.proposition_id, p]));

const clauses = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "blueprints") walk(p); continue; }
    if (!entry.name.endsWith(".json") || entry.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.clause_id) clauses.push(c);
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

const declared = clauses.filter((c) => Array.isArray(c.implements) && c.implements.length);
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

check("every proposition declares how it can be satisfied", () => {
  /*
   * The field that ended a false green. Without it a registration proposition
   * was reported COVERED because a clause requiring registration was present,
   * while the instrument remained unregistered — "a clause is present" standing
   * in for "the legal consequence is achieved". The requirement layer already
   * drew this line with kind: FORMALITY and outside_the_document; the vocabulary
   * is reused rather than reinvented so the two layers cannot disagree.
   */
  const MODES = ["IN_THE_DOCUMENT", "OUTSIDE_THE_DOCUMENT"];
  for (const p of vocabulary.propositions) {
    assert.ok(MODES.includes(p.satisfaction),
      `${p.proposition_id}: satisfaction must be one of ${MODES.join(", ")}, got ${p.satisfaction}`);
    if (p.satisfaction === "OUTSIDE_THE_DOCUMENT") {
      assert.ok(p.outside_the_document && p.outside_the_document.length > 40,
        `${p.proposition_id}: must say what act happens elsewhere and why a clause cannot do it`);
    }
  }
});

check("every proposition record is shaped and cites an authority", () => {
  for (const p of vocabulary.propositions) {
    assert.ok(p.proposition_id && /^[A-Z][A-Z0-9_]+$/.test(p.proposition_id),
      `bad proposition id: ${p.proposition_id}`);
    assert.ok(p.statement && p.statement.length > 30,
      `${p.proposition_id}: a proposition must state the rule, not name it`);
    assert.ok(Array.isArray(p.authority) && p.authority.length,
      `${p.proposition_id}: a proposition must say where the rule comes from`);
    for (const a of p.authority) {
      assert.ok(a.act, `${p.proposition_id}: an authority must name an Act`);
    }
  }
});

check("a proposition is never merely the statute restated", () => {
  /* The failure this guards: `implements: ["ICA_1872_S40"]`, which rebuilds the
   * statute -> clause shortcut under a new key and loses the distinction the
   * layer exists to make. */
  for (const p of vocabulary.propositions) {
    assert.ok(!/^[A-Z_]*\d{4}[_A-Z0-9]*$/.test(p.proposition_id),
      `${p.proposition_id} looks like a statute citation, not a proposition`);
    for (const a of p.authority) {
      assert.ok(!p.statement.trim().startsWith(a.act),
        `${p.proposition_id}: the statement restates the Act rather than the rule`);
    }
  }
});

check("every implements reference resolves", () => {
  for (const c of declared) {
    for (const id of c.implements) {
      assert.ok(propositions.has(id), `${c.clause_id} implements unknown proposition '${id}'`);
    }
  }
});

check("nothing is declared reviewed that has not been", () => {
  for (const p of vocabulary.propositions) {
    assert.match(String(p.review_status), /draft|needs/i,
      `${p.proposition_id} claims review status '${p.review_status}' with no advocate record`);
  }
  for (const c of declared) {
    assert.match(String(c.implements_review_status), /draft|needs/i,
      `${c.clause_id}: implements claims to be reviewed`);
  }
});

/* ── the vocabulary must discriminate ─────────────────────────────────────── */

const byProposition = new Map();
for (const c of declared) {
  for (const id of c.implements) {
    if (!byProposition.has(id)) byProposition.set(id, []);
    byProposition.get(id).push(c.clause_id);
  }
}

check("control clauses share no proposition with any sampled group", () => {
  const controls = declared.filter((c) => c._implements_note);
  assert.ok(controls.length >= 2, "the falsification needs at least two control clauses");
  for (const c of controls) {
    for (const id of c.implements) {
      assert.deepStrictEqual(byProposition.get(id), [c.clause_id],
        `control ${c.clause_id} shares '${id}' with ${byProposition.get(id).join(", ")} — the ` +
        `propositions are drawn too broadly and any reuse result is an artefact of the vocabulary`);
    }
  }
});

/* ── the D4.4-B finding, restated at proposition level ────────────────────── */

check("the principal-employer allocation lives in its own unconditional clause", () => {
  /*
   * Before D4.5-C this asserted SERVICE_KEY_PERSONNEL_001 and warned that a
   * second implementer might unblock the repair. The repair happened: the
   * allocation moved verbatim into its own clause, which the MSA blueprint lists
   * unconditionally. Asserting the new owner keeps the guard meaningful — if the
   * allocation ever migrates back into a conditional clause, this fails.
   */
  const id = "PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED";
  const implementers = byProposition.get(id) || [];
  assert.deepStrictEqual(implementers, ["SERVICE_PERSONNEL_STATUS_001"],
    `'${id}' is implemented by ${implementers.join(", ") || "nothing"}. It must sit in a clause ` +
    `whose selection does not depend on whether particular individuals matter.`);
});

check("a composite clause is visible as composite, and a repaired one is not", () => {
  const composite = declared.filter((c) => c.implements.length > 1).map((c) => c.clause_id).sort();
  assert.ok(!composite.includes("SERVICE_KEY_PERSONNEL_001"),
    "SERVICE_KEY_PERSONNEL_001 declares two propositions again — the D4.5-C split has been undone");
  assert.ok(composite.includes("NDA_CONFIDENTIALITY_TRADE_SECRET_001"),
    "the safe composite is gone; the sample no longer distinguishes harmful from harmless composition");
  console.log(`      composite in the sample: ${composite.join(", ") || "none"}`);
});

console.log(`\nALL GREEN (${checks} checks)`);
