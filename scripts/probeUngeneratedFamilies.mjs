/**
 * probeUngeneratedFamilies.mjs
 *
 * 29 of 40 families produce a draft. This asks ONE question about the other 11:
 * which constraint refused, and is that constraint one of the 13 whose scope the
 * D4.33 review has not yet decided?
 *
 * It does NOT decide any scope, and it does not treat a blocked family as
 * evidence that a constraint is wrong. A constraint may be refusing correctly.
 * The measurement is the correspondence, nothing more.
 */
import { DOCUMENT_TYPE_REGISTRY, getDocumentFamily } from "../shared/documentRegistry.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { generateDocument } from "../backend/services/documentService.js";
import { documentShape } from "../shared/documentShape.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SCOPE = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/constraint-scope.json"), "utf8"));
const UNDECIDED = new Set((SCOPE.rules || []).map((r) => r.rule_id));

const generated = [];
const blocked = [];

for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  let out;
  try { out = await generateDocument({ document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }) }); }
  catch (e) { blocked.push({ type, threw: String(e.message).slice(0, 120) }); continue; }

  if (out?.draft?.clauses?.length) { generated.push(type); continue; }

  const rules = [...new Set((out?.validation?.blockingIssues || []).map((i) => i.rule_id))];
  let shape = null;
  try { shape = documentShape(type); } catch { /* shape is not always derivable */ }
  blocked.push({
    type,
    shape,
    blocking_rules: rules,
    rules_awaiting_D4_33_scope: rules.filter((r) => UNDECIDED.has(r)),
    rules_outside_D4_33: rules.filter((r) => !UNDECIDED.has(r)),
  });
}

const allBlockingRules = [...new Set(blocked.flatMap((b) => b.blocking_rules || []))];

/*
 * Two different situations, kept apart because they have different repairs and
 * different owners.
 *
 *   shape mismatch     the family is not an AGREEMENT at all, and a constraint
 *                      written for contracts is refusing it. Whether it should
 *                      is the D4.33 scope question.
 *
 *   agreement, missing the family IS an agreement, so the constraint may apply
 *                      correctly and the blueprint simply lacks the clause it
 *                      requires. That is knowledge completeness, not scope.
 *
 * Folding these together would let "unencoded constraint scope" take credit for
 * blueprint gaps it had nothing to do with.
 */
for (const b of blocked) {
  if (!b.blocking_rules) continue;
  b.$kind = b.shape && b.shape !== "AGREEMENT"
    ? "SHAPE MISMATCH CANDIDATE — a contract constraint refusing a non-contract"
    : "AGREEMENT FAMILY — the constraint may apply correctly and the blueprint may simply lack the clause";
  b.$kind_is_a_classification_not_a_decision = true;
}
const report = {
  $probe: "probeUngeneratedFamilies.mjs",
  $question: "Of the families that produce no draft, which constraint refused, and is its scope one of the 13 still awaiting advocate decision?",
  $not_a_claim: [
    "NOT a claim that any of these constraints is wrong. A constraint that refuses an affidavit may be refusing correctly; whether it should apply to that shape at all is precisely the undecided question.",
    "NOT 11 new legal questions. These are consequences of the 13 already queued, and adding them as questions would inflate the queue with duplicates.",
  ],
  fixture: "WELL_FILLED",
  totals: {
    families: generated.length + blocked.length,
    produce_a_draft: generated.length,
    produce_no_draft: blocked.length,
    distinct_blocking_rules: allBlockingRules.length,
    blocking_rules_awaiting_D4_33_scope: allBlockingRules.filter((r) => UNDECIDED.has(r)).length,
    blocking_rules_outside_D4_33: allBlockingRules.filter((r) => !UNDECIDED.has(r)),
    shape_mismatch_candidates: blocked.filter((b) => b.shape && b.shape !== "AGREEMENT").length,
    agreement_families_blocked: blocked.filter((b) => b.shape === "AGREEMENT").length,
  },
  blocked,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/ungenerated-families.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 2));
for (const b of blocked) console.log(`  ${b.type} [${b.shape || "?"}]  <- ${(b.blocking_rules || []).join(", ") || b.threw}`);
