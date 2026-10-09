/**
 * freezeDefectiveTermSheet.mjs — D4.44
 *
 * Captures, once, the term sheet the engine shipped on 9 Oct 2026 and scored
 * 100 / "No issues detected". The capture is the permanent falsification
 * fixture: whatever replaces the term sheet, and whatever checks are added,
 * must FAIL this text for its named defects. It is never regenerated, because
 * a regenerated sample would be produced by the corrected engine.
 *
 *   node scripts/freezeDefectiveTermSheet.mjs <out.json>
 *
 * It must be run against the engine as it shipped (it was run in a worktree of
 * the pre-withdrawal commit): once the type is withdrawn, validation no longer
 * awards a score, and the script refuses rather than record a withdrawn one.
 *
 * Refuses to overwrite an existing fixture.
 */
import fs from "fs";
import crypto from "crypto";

const out = process.argv[2];
if (!out) { console.error("usage: freezeDefectiveTermSheet.mjs <out.json>"); process.exit(2); }
if (fs.existsSync(out)) { console.error(`refusing to overwrite ${out}: the fixture is frozen`); process.exit(1); }

const { generateDocument } = await import("../backend/services/documentService.js");
const { draftToText } = await import("../backend/services/exportService.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

const FROZEN = Date.parse("2026-09-01T06:30:00.000Z");
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [FROZEN])); }
  static now() { return FROZEN; }
}
globalThis.Date = FrozenDate;

const variables = { ...variablesFor("TERM_SHEET", { profile: FIXTURE_PROFILE.WELL_FILLED }) };
const result = await generateDocument({ document_type: "TERM_SHEET", variables });
if (!result.draft) { console.error("no draft produced", result.error); process.exit(1); }
const text = draftToText(result.draft);
const v = result.validation;
if (v.assurance_withdrawn) {
  console.error("this engine already withdraws the term sheet's assurance; capture from the pre-withdrawal commit");
  process.exit(1);
}

const fixture = {
  $comment: [
    "Frozen 9 Oct 2026 (D4.44). The term sheet the engine shipped, captured with the generation clock at 2026-09-01T06:30Z.",
    "The engine scored it 100 / 'No issues detected'. It contradicts itself on whether it binds, binds non-parties, cross-refers to approvals that do not exist, states that a shareholders' agreement prevails over the Articles, and omits core deal terms.",
    "Do not regenerate. The point of the fixture is that it is the OLD output: tests/termSheetFalsification.test.mjs requires the coherence checks to fail it for each defect listed in expected_failures.",
  ],
  captured_at: "2026-10-09",
  document_type: "TERM_SHEET",
  input_profile: "WELL_FILLED",
  variables,
  clause_ids: result.draft.clauses.map((c) => c.clause_id),
  clauses: result.draft.clauses.map((c) => ({ clause_id: c.clause_id, title: c.title, text: c.text })),
  rendered_text: text,
  rendered_text_sha256: crypto.createHash("sha256").update(text).digest("hex"),
  validation_awarded: {
    score: v.score,
    certification: v.certification,
    blocking: v.blockingIssues?.length ?? 0,
    advisory: v.advisoryIssues?.length ?? 0,
    notices: v.notices?.length ?? 0,
  },
};
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(`frozen ${fixture.clause_ids.length} clauses, score ${v.score} (${v.certification}), sha ${fixture.rendered_text_sha256.slice(0, 12)}`);
process.exit(0);
