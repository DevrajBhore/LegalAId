/**
 * npartyRepresentation.test.mjs — N PRINCIPALS, AND SIX OPEN QUESTIONS
 *
 * D4.14 measured the failure this exists to close. A partnership with three
 * partners had two routes and both failed: `partner_3_name` was dropped by
 * sanitisation and disappeared silently, and a third partner described in free
 * text reached the CAPITAL AND PROFIT clause while reaching neither the identity
 * clause nor the signature block — a person recited as sharing profits without
 * being made a party. Indian Partnership Act 1932 s.4 and s.25: a person who
 * signs nothing is bound by nothing, whatever the deed says about their share.
 *
 * THE TWO HALVES MUST BOTH HOLD, and testing either alone would be misleading.
 *
 *   Representation — a roster of any size, resolved from what the intake
 *   actually supplied, with nobody silently added and nobody silently dropped.
 *
 *   Restraint — the six clauses whose N-party meaning is a legal question must
 *   report UNRESOLVED rather than adopt a reading. An engine that pluralised
 *   "the aggregate liability of either Party" would be choosing between three
 *   caps, one shared cap, and a cap that binds only inter se — a choice worth
 *   different amounts of money, presented as a rendering detail.
 *
 * The last two checks are the ones that would catch me building this
 * dishonestly: a default hidden anywhere in the treatment path, and a roster
 * that invents a member from prose. Both are the shortcut that makes a demo work
 * and a document wrong.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveRoster, isMultiParty, nameList, othersOf,
} from "../backend/services/partyRoster.js";
import {
  treatmentFor, unresolvedTreatments, TREATMENT,
} from "../backend/services/npartyTreatment.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const roster = (n, prefix = "partner") => {
  const v = {};
  for (let i = 1; i <= n; i += 1) {
    v[`${prefix}_${i}_name`] = `Principal ${i}`;
    v[`${prefix}_${i}_type`] = "Individual";
  }
  return v;
};

/* ── representation ───────────────────────────────────────────────────────── */

check("a roster resolves 2, 3 and 4 principals", () => {
  for (const n of [2, 3, 4]) {
    const r = resolveRoster(roster(n));
    assert.strictEqual(r.count, n, `${n} supplied, ${r.count} resolved`);
    assert.strictEqual(r.members.length, n);
    for (let i = 1; i <= n; i += 1) {
      assert.ok(r.members.some((m) => m.index === i && m.name === `Principal ${i}`),
        `principal ${i} missing from the roster`);
    }
  }
});

check("no principal disappears — the D4.14 failure, directly", () => {
  /* The measured defect was a THIRD partner vanishing. Assert the general form:
   * every supplied principal is present, at every size. */
  for (const n of [2, 3, 4, 7]) {
    const supplied = roster(n);
    const names = Object.entries(supplied).filter(([k]) => k.endsWith("_name")).map(([, v]) => v);
    const r = resolveRoster(supplied);
    for (const name of names) {
      assert.ok(r.members.some((m) => m.name === name), `${name} was dropped at n=${n}`);
    }
  }
});

check("a gap is recorded, not treated as the end of the list", () => {
  /* Supplying 1 and 3 must not silently discard the third. A loop that stopped
   * at the first empty slot would lose a principal and report success. */
  const r = resolveRoster({ partner_1_name: "A", partner_3_name: "C" });
  assert.strictEqual(r.count, 2);
  assert.deepStrictEqual(r.gaps, [2], "the empty slot was not recorded");
  assert.ok(r.members.some((m) => m.name === "C"), "the principal after the gap was dropped");
});

check("free text does not create a party", () => {
  /*
   * The inverse failure, and the more dangerous one. If the roster believed
   * prose, it would agree that someone is a partner while the signature block
   * still did not bind them — the D4.14 defect with a confident roster on top.
   */
  const r = resolveRoster({
    partner_1_name: "A", partner_2_name: "B",
    partner_roles: "Sunita Rao - third partner, operations, equal share.",
    partner_exit_mechanism: "On exit of any of the three partners…",
  });
  assert.strictEqual(r.count, 2, "a party was invented from prose");
  assert.ok(!nameList(r).includes("Sunita"), "a name in prose reached the roster");
});

check("position is preserved, never resequenced", () => {
  const r = resolveRoster({ partner_1_name: "A", partner_2_name: "B", partner_3_name: "C" });
  assert.deepStrictEqual(r.members.map((m) => m.index), [1, 2, 3],
    "indices were rewritten; 'Party 1' in clause text would no longer mean what it says");
});

check("'the other Party' has a plural denotation once there is more than one", () => {
  const r = resolveRoster(roster(3));
  assert.strictEqual(othersOf(r, 1).length, 2);
  assert.deepStrictEqual(othersOf(r, 1).map((m) => m.index), [2, 3]);
  assert.strictEqual(nameList(r), "Principal 1, Principal 2 and Principal 3");
});

check("an explicit collection is accepted without a lossy round trip", () => {
  const r = resolveRoster({ parties: [{ name: "X", role: "seller" }, { name: "Y" }, { name: "Z" }] });
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.source, "parties[]");
  assert.strictEqual(r.members[0].role, "seller");
});

/* ── restraint ────────────────────────────────────────────────────────────── */

check("two principals: the binary wording is left exactly alone", () => {
  for (const id of ["CORE_ASSIGNMENT_001", "CORE_LIMITATION_LIABILITY_001", "CORE_TERMINATION_001"]) {
    assert.strictEqual(treatmentFor(id, 2).outcome, TREATMENT.NOT_APPLICABLE,
      `${id} proposed to change a two-party document, which must not happen`);
  }
});

check("the four determined shapes generalise without a decision", () => {
  for (const id of ["CORE_ASSIGNMENT_001", "CORE_CONFIDENTIALITY_001",
    "CORE_NOTICE_001", "CORE_DATA_PROCESSING_001"]) {
    const t = treatmentFor(id, 3);
    assert.strictEqual(t.outcome, TREATMENT.DETERMINED, `${id}: ${t.why}`);
  }
});

check("the six ambiguous clauses report UNRESOLVED and name the question", () => {
  const AMBIGUOUS = ["CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001",
    "CORE_LIABILITY_LIMIT_FALLBACK_001", "CORE_INDEMNITY_FULL_001",
    "CORE_TERMINATION_001", "CORE_TRANSITION_ASSISTANCE_001"];
  for (const id of AMBIGUOUS) {
    const t = treatmentFor(id, 3);
    assert.strictEqual(t.outcome, TREATMENT.UNRESOLVED, `${id} acquired a reading`);
    assert.strictEqual(t.decision, "UNDECIDED", `${id} claims a decision nobody made`);
    assert.ok(t.legal_question && t.legal_question.length > 40,
      `${id}: an unresolved point must state the question`);
    assert.ok((t.candidates || []).length >= 2,
      `${id}: candidates exist so an advocate can choose, and there must be a choice`);
  }
});

check("no default is reachable anywhere in the treatment path", () => {
  /*
   * The check that would catch me cheating. A candidate treatment must never
   * appear as an outcome, and the source must contain no fallback to one.
   */
  /*
   * Comments stripped first. The first version of this check scanned the raw
   * file and fired on the docstring sentence promising there is no
   * `|| "PER_PARTY"` fallback — a guard tripping over its own explanation of
   * itself. The property is about VALUES IN CODE, so the scan has to be too.
   */
  const src = fs.readFileSync(path.join(ROOT, "backend/services/npartyTreatment.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  for (const candidate of ["PER_PARTY", "SHARED", "INTER_SE_ONLY", "SEVERAL_TO_EACH",
    "ENDS_THE_INSTRUMENT", "ENDS_THAT_RELATIONSHIP"]) {
    assert.ok(!new RegExp(`["'\`]${candidate}["'\`]`).test(src),
      `npartyTreatment.js names ${candidate} as a value; a resolver that can spell a ` +
      `treatment can choose one`);
  }
  for (const id of ["CORE_LIMITATION_LIABILITY_001", "CORE_TERMINATION_001"]) {
    const t = treatmentFor(id, 4);
    assert.ok(!["PER_PARTY", "SHARED", "ENDS_THE_INSTRUMENT"].includes(t.decision),
      `${id} resolved to a treatment at 4 parties`);
  }
});

check("unresolved points are collectable for disclosure", () => {
  const open = unresolvedTreatments(
    ["CORE_ASSIGNMENT_001", "CORE_LIMITATION_LIABILITY_001", "CORE_TERMINATION_001"], 3);
  assert.strictEqual(open.length, 2, "a determined clause was reported as open, or an open one hidden");
  assert.deepStrictEqual(open.map((o) => o.decision_id).sort(),
    ["LIABILITY_CAP_APPORTIONMENT", "TERMINATION_FOR_DEFAULT_SCOPE"]);
  assert.strictEqual(unresolvedTreatments(["CORE_LIMITATION_LIABILITY_001"], 2).length, 0,
    "a two-party document reported an N-party open point");
});

check("every recorded decision is UNDECIDED and carries its counterfactuals", () => {
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, "knowledge-base/governance/nparty-treatments.json"), "utf8"));
  for (const d of doc.decisions) {
    assert.strictEqual(d.decision, "UNDECIDED", `${d.decision_id} has been decided in a data file`);
    assert.match(String(d.review_status), /draft|needs/i);
    assert.ok(d.authority_basis?.length, `${d.decision_id}: a legal question needs its authority`);
    for (const c of d.candidate_treatments) {
      for (const k of ["consequence_2", "consequence_3", "consequence_4"]) {
        assert.ok(c[k], `${d.decision_id}/${c.treatment}: missing ${k} — the counterfactual is ` +
          `what makes the ambiguity visible, since at two parties the readings coincide`);
      }
    }
  }
});

console.log(`\nALL GREEN (${checks} checks)`);
