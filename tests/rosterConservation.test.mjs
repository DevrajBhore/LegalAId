/**
 * rosterConservation.test.mjs — DOES AN ADMITTED PRINCIPAL REACH THE PAGE?
 *
 * D4.14 measured a partner typed into a form and gone by the time the deed was
 * written, with nothing said. D4.17 built the representation. This asserts the
 * property that makes the representation worth having, end to end:
 *
 *     ADMITTED PARTY -> partyRoster -> generation input
 *                    -> IDENTITY BINDING -> SIGNATURE BINDING -> ARTIFACT
 *
 * and the converse, which is the half that actually protects anyone:
 *
 *     NO SIGNATURE BLOCK MAY EXIST FOR A PERSON WHO IS NOT IN THE ROSTER.
 *
 * Indian Partnership Act 1932 s.4 and s.25 are why both directions matter. A
 * person who signs nothing is bound by nothing whatever the deed recites about
 * their share; a person made to sign who never agreed is bound to strangers
 * jointly and severally. Losing a partner and inventing one are the same defect
 * viewed from two sides, and a test that checked only the first would pass while
 * the engine quietly duplicated somebody.
 *
 * THE ARTIFACT IS THE SUBJECT. Every assertion below reads the generated clause
 * text, not the roster model. The model agreeing with itself proves nothing --
 * D4.15 established that the shipped document and the clause library disagree,
 * because builders write several CORE clauses at generation time.
 *
 * WHAT THIS DELIBERATELY DOES NOT TEST: what an N-party clause should SAY. Six
 * clauses carry legal decisions nobody has made, and the last check here asserts
 * they are still open. A three-party deed that had quietly acquired PER_PARTY,
 * SHARED or INTER_SE_ONLY would pass every conservation check above and be
 * wrong in a way worth money.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { getParticipantExpectations } from "../backend/services/draftingPolicy.js";
import { resolveRoster } from "../backend/services/partyRoster.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

let checks = 0;
const check = async (label, fn) => {
  await fn();
  checks += 1;
  console.log(`PASS  ${label}`);
};

const DOC = "PARTNERSHIP_DEED";

/* Four coherent identities. Distinct names, addresses and PANs, because the
 * intake validator refuses two parties who look like the same legal person and
 * a blocked generation would make every assertion below vacuous. */
const PEOPLE = [
  { name: "Meera Iyer", address: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050", pan: "AAAPI1234C" },
  { name: "Arjun Desai", address: "44 Linking Road, Khar, Mumbai, Maharashtra 400052", pan: "AABPD2345F" },
  { name: "Sunita Rao", address: "9 Carter Road, Bandra, Mumbai, Maharashtra 400050", pan: "AACPR3456G" },
  { name: "Imran Qureshi", address: "77 Turner Road, Bandra, Mumbai, Maharashtra 400050", pan: "AADPQ4567H" },
];

const slots = (indices) => {
  const out = {};
  for (const i of indices) {
    const p = PEOPLE[i - 1];
    out[`partner_${i}_name`] = p.name;
    out[`partner_${i}_address`] = p.address;
    out[`partner_${i}_type`] = "Individual";
    out[`partner_${i}_pan`] = p.pan;
  }
  return out;
};

async function deed(overrides = {}) {
  const variables = {
    ...variablesFor(DOC, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    partnership_name: "Bandra Associates",
    // The sampler fills party_1_pan / party_2_pan, which getParticipantExpectations
    // reads as the positional fallback. Cleared so each principal's identifiers
    // are unambiguously their own.
    party_1_pan: "", party_2_pan: "", party_1_gstin: "", party_2_gstin: "",
    partner_1_name: "", partner_2_name: "", partner_1_address: "", partner_2_address: "",
    ...overrides,
  };
  const result = await generateDocument({ document_type: DOC, variables });
  const clauses = result?.draft?.clauses || [];
  const byId = Object.fromEntries(clauses.map((c) => [c.clause_id, c.text || ""]));
  return {
    result,
    variables,
    clauses,
    text: clauses.map((c) => c.text || "").join("\n"),
    identity: byId.CORE_IDENTITY_001 || "",
    signature: byId.CORE_SIGNATURE_BLOCK_001 || "",
    blocking: (result?.validation?.blockingIssues || []).map((i) => i.rule_id),
    notices: [
      ...(result?.validation?.notices || []),
      ...(result?.validation?.advisoryIssues || []),
    ].map((i) => i.rule_id),
  };
}

/* A signature block is one entry per party. Counting "Name:" lines counts
 * bindings, which is the thing s.25 turns on, rather than counting mentions. */
const signatureNames = (block) =>
  [...block.matchAll(/^Name:\s*(.+)$/gm)].map((m) => m[1].trim()).filter((n) => !/^_+$/.test(n));

/* ── A. CONTIGUOUS: three supplied, three bound ───────────────────────────── */

await check("A — three principals travel from intake to signature", async () => {
  const supplied = slots([1, 2, 3]);

  // 1. Admission. The link that was broken: sanitisation dropped the key.
  const sanitised = sanitizeVariablesForDocument(DOC, supplied);
  assert.strictEqual(sanitised.partner_3_name, "Sunita Rao",
    "the third principal did not survive admission");

  // 2. Roster.
  const roster = resolveRoster(sanitised);
  assert.strictEqual(roster.count, 3);

  // 3. Generation input — the one list identity and signature both read.
  const participants = getParticipantExpectations(DOC, sanitised);
  assert.strictEqual(participants.length, 3,
    "the participant list the builders consume still stops at two");

  // 4/5/6. Artifact.
  const d = await deed(supplied);
  assert.deepStrictEqual(d.blocking, [], `generation blocked: ${d.blocking.join(", ")}`);
  for (const person of PEOPLE.slice(0, 3)) {
    assert.ok(d.identity.includes(person.name), `${person.name} is not named as a party`);
    assert.ok(d.signature.includes(person.name), `${person.name} signs nothing`);
  }
  assert.strictEqual(signatureNames(d.signature).length, 3,
    "the signature block does not bind exactly three people");
  assert.ok(/BY AND AMONG/.test(d.identity),
    "a deed among three still recites BY AND BETWEEN");
  assert.ok(/of the Third Part/.test(d.identity),
    "the third principal has no Part in the testatum");
});

await check("A — every named party is bound, and nobody else is", async () => {
  /*
   * THE CONVERSE, stated as a closed set rather than a spot check. The signature
   * block and the roster must name the same people: a name in one and not the
   * other is either a party who signs nothing or a signature from a stranger.
   */
  const d = await deed(slots([1, 2, 3]));
  const signed = new Set(signatureNames(d.signature));
  const rostered = new Set(resolveRoster(d.variables).members.map((m) => m.name));
  assert.deepStrictEqual([...signed].sort(), [...rostered].sort(),
    "the signature block and the authoritative roster name different sets of people");
});

/* ── B. SPARSE: a gap is not the end of the list ──────────────────────────── */

await check("B — slot 2 empty: the intake refuses, and says which field", async () => {
  /*
   * `partner_2_name` is a required field, so a deed with slots 1 and 3 filled
   * does not generate at all. That is the system being right, and the assertion
   * records it as such: the D4.14 defect was a principal disappearing in
   * SILENCE, and a refusal naming the empty field is the opposite of that.
   * The roster still has to keep the third where the user put them, because the
   * user may go on to fill slot 2 and must not find their third partner renamed.
   */
  const supplied = slots([1, 3]);
  const roster = resolveRoster(sanitizeVariablesForDocument(DOC, supplied));
  assert.strictEqual(roster.count, 2);
  assert.deepStrictEqual(roster.gaps, [2], "the empty slot was not recorded");
  assert.deepStrictEqual(roster.members.map((m) => m.index), [1, 3],
    "the principal after the gap was resequenced; 'Partner 3' would silently change referent");

  const d = await deed(supplied);
  assert.deepStrictEqual(d.blocking, ["INVALID_INPUT_1"],
    "a deed with an empty required principal slot generated anyway");
});

await check("B — a gap ABOVE the required pair keeps its position in the deed", async () => {
  /*
   * The same property where generation can actually be reached: slots 1, 2 and
   * 4, with 3 left empty. A loop that stopped at the first empty slot would lose
   * the fourth principal and report success.
   */
  const supplied = slots([1, 2, 4]);
  const d = await deed(supplied);
  assert.deepStrictEqual(d.blocking, []);
  assert.deepStrictEqual(d.result.party_roster.gaps, [3],
    "the gap is not disclosed to the reader");
  assert.strictEqual(d.result.party_roster.count, 3);
  assert.ok(d.identity.includes("Imran Qureshi"), "the principal after the gap never reached the deed");
  assert.ok(d.signature.includes("Imran Qureshi"), "the principal after the gap signs nothing");
  assert.ok(!d.identity.includes("Sunita Rao"), "an unfilled slot produced a party");
  assert.strictEqual(signatureNames(d.signature).length, 3);
  assert.ok(/"Partner 4"/.test(d.identity),
    "the fourth slot was renamed to Partner 3 — a silent resequencing");
  assert.ok(/of the Third Part/.test(d.identity),
    "the Part ordinal follows the party's slot rather than its position in the deed");
});

/* ── C. PROSE ONLY: a name in free text is not a party ────────────────────── */

await check("C — a third partner described in prose creates no party, and is reported", async () => {
  const d = await deed({
    ...slots([1, 2]),
    partner_roles: "Sunita Rao is the third partner, running operations for an equal share.",
  });
  assert.strictEqual(d.result.party_roster.count, 2, "prose manufactured a party");
  assert.ok(!d.identity.includes("Sunita"), "a name in prose was named as a party");
  assert.ok(!d.signature.includes("Sunita"), "a name in prose acquired a signature block");
  assert.strictEqual(signatureNames(d.signature).length, 2);

  /*
   * The dangerous half. The deed recites a person sharing profits and does not
   * bind her, so it must SAY so. Silence here is the D4.14 defect exactly.
   */
  assert.ok(d.notices.includes("MORE_PRINCIPALS_THAN_THE_INSTRUMENT_BINDS"),
    "the deed describes a principal it does not bind and reports nothing");
});

await check("C — the notice is about THIS deed, not about the system", async () => {
  /*
   * The same prose with the third partner actually supplied. The notice used to
   * assert an unsatisfiable variable — it fired whenever the words appeared,
   * which after the roster landed would be a false alarm on a correct deed.
   */
  const d = await deed({
    ...slots([1, 2, 3]),
    partner_roles: "Sunita Rao is the third partner, running operations for an equal share.",
  });
  assert.ok(!d.notices.includes("MORE_PRINCIPALS_THAN_THE_INSTRUMENT_BINDS"),
    "a deed that does bind all three principals is told it does not");
});

/* ── D. MIXED SOURCE: two descriptions of one person are one party ────────── */

await check("D — the same person supplied twice is one party, not two", async () => {
  /*
   * The failure this guards is quieter than a missing partner and worse: a firm
   * of three reported as a firm of four, with two signature blocks for one
   * woman, every one of them plausible on the page.
   */
  const variables = {
    parties: PEOPLE.slice(0, 3).map((p) => ({ ...p, type: "Individual" })),
    ...slots([1, 2]),
  };
  const roster = resolveRoster(variables);
  assert.strictEqual(roster.count, 3, `two sources produced ${roster.count} parties`);
  assert.strictEqual(roster.source, "parties[]");
  assert.strictEqual(roster.merged.length, 2, "the duplicate representations were not reconciled");
  assert.ok(roster.merged.every((m) => m.basis === "pan"),
    "a merge rested on a name where a PAN was available to settle it");
  assert.strictEqual(roster.conflicts.length, 0);
  assert.ok(roster.reconciled);

  const d = await deed(variables);
  assert.deepStrictEqual(d.blocking, []);
  assert.strictEqual(signatureNames(d.signature).length, 3,
    "one person acquired two signature blocks");
  assert.strictEqual((d.identity.match(/Meera Iyer/g) || []).length, 1,
    "the duplicated principal is introduced twice");
});

await check("D — precedence is stated: the declared collection decides membership", async () => {
  /*
   * An indexed slot naming somebody the collection does not contain. Admitting
   * them binds a person the caller never listed; dropping them is D4.14. The
   * roster does neither and says so.
   */
  const variables = {
    parties: PEOPLE.slice(0, 2).map((p) => ({ ...p, type: "Individual" })),
    ...slots([1, 2, 3]),
  };
  const roster = resolveRoster(variables);
  assert.strictEqual(roster.count, 2, "an unlisted principal was admitted as a party");
  assert.strictEqual(roster.conflicts.length, 1, "an unlisted principal was discarded silently");
  assert.strictEqual(roster.conflicts[0].name, "Sunita Rao");
  assert.strictEqual(roster.conflicts[0].reason, "NOT_IN_DECLARED_COLLECTION");
  assert.strictEqual(roster.reconciled, false,
    "a roster with an unreconciled person reported itself as settled");

  const d = await deed(variables);
  assert.strictEqual(d.result.party_roster.reconciled, false,
    "the conflict is not disclosed to the reader");
  assert.ok(!d.signature.includes("Sunita Rao"),
    "a person absent from the authoritative roster has a signature block");
});

await check("D — one person in two slots collapses onto the first", async () => {
  const roster = resolveRoster({
    partner_1_name: "Meera Iyer", partner_1_pan: "AAAPI1234C",
    partner_2_name: "Arjun Desai", partner_2_pan: "AABPD2345F",
    partner_3_name: "Meera Iyer", partner_3_pan: "AAAPI1234C",
  });
  assert.strictEqual(roster.count, 2, "the same PAN appeared as two partners");
  assert.deepStrictEqual(roster.duplicates.map((d) => d.dropped_index), [3]);
  assert.strictEqual(roster.duplicates[0].kept_index, 1,
    "the repeat was kept at its later position, which moves the party's number");
});

await check("D — the same name with different PANs is two people", async () => {
  /*
   * The over-correction. A statutory identifier settles identity in both
   * directions, and collapsing a woman and her namesake into one party would be
   * the duplication defect with the sign reversed.
   */
  const roster = resolveRoster({
    partner_1_name: "Meera Iyer", partner_1_pan: "AAAPI1234C",
    partner_2_name: "Meera Iyer", partner_2_pan: "AAZPI9999Z",
  });
  assert.strictEqual(roster.count, 2, "two people with one name were merged into one party");
});

/* ── E. FOUR: the implementation is not secretly 1..3 ─────────────────────── */

await check("E — four principals, all four bound", async () => {
  const d = await deed(slots([1, 2, 3, 4]));
  assert.deepStrictEqual(d.blocking, []);
  assert.strictEqual(d.result.party_roster.count, 4);
  for (const person of PEOPLE) {
    assert.ok(d.identity.includes(person.name), `${person.name} is not named as a party`);
    assert.ok(d.signature.includes(person.name), `${person.name} signs nothing`);
  }
  assert.strictEqual(signatureNames(d.signature).length, 4);
  assert.ok(/of the Fourth Part/.test(d.identity), "the fourth principal has no Part");
  assert.ok(
    /The Partner 1, the Partner 2, the Partner 3 and the Partner 4 are hereinafter collectively/
      .test(d.identity),
    "the collective definition of 'Parties' does not cover all four"
  );
});

/* ── RESTRAINT: cardinality is not interpretation ─────────────────────────── */

await check("a three-party deed reaches the page with its legal questions still open", async () => {
  /*
   * THE POINT OF THE WHOLE EXERCISE. The document generates, every principal is
   * bound, and the clauses whose N-party meaning is a question of law say so
   * rather than acquiring an answer. Party cardinality and legal interpretation
   * are independent dimensions, and this is where that shows.
   */
  const d = await deed(slots([1, 2, 3]));
  const open = d.result.open_treatments || [];
  const decisions = open.filter((t) => t.kind === "AUTHORED_DECISION_PENDING");
  assert.ok(decisions.length >= 2,
    "a three-party deed carrying a liability cap and a termination right reports no open point");
  assert.ok(decisions.some((t) => t.decision_id === "LIABILITY_CAP_APPORTIONMENT"));
  assert.ok(decisions.some((t) => t.decision_id === "TERMINATION_FOR_DEFAULT_SCOPE"));
  for (const t of decisions) {
    assert.strictEqual(t.decision, "UNDECIDED", `${t.clause_id} acquired a decision`);
    assert.ok(t.legal_question, `${t.clause_id} reports an open point without stating it`);
    assert.ok(t.candidate_treatments.length >= 2);
    assert.strictEqual(t.party_count, 3);
  }
  /* And the words themselves were not quietly pluralised into a reading. */
  assert.ok(/either Party/.test(d.text),
    "the binary wording was rewritten, which is choosing one of the three readings");
});

await check("two principals report no open N-party point at all", async () => {
  const d = await deed(slots([1, 2]));
  assert.deepStrictEqual(d.result.open_treatments, [],
    "a two-party deed was told it has an unresolved N-party question");
  assert.strictEqual(d.result.party_roster.multi_party, false);
});

console.log(`\nALL GREEN (${checks} checks)`);
