/**
 * articlesPrecedence.test.mjs — D4.45 P0
 *
 * The sentence "this Agreement shall prevail" over the Articles ships in the
 * Shareholders' Agreement (investor-protective variant) and the Share
 * Subscription Agreement, through CORP_BOARD_INVESTOR_CONTROL_001. It is frozen
 * as it ships, flagged for an advocate, and deliberately NOT re-worded: the
 * answer depends on the company, the right and the Articles.
 */
import assert from "node:assert";
import fs from "fs";
import crypto from "crypto";

const { validateArticlesPrecedence } = await import("../backend/services/instrumentCoherence.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { generateDocument } = await import("../backend/services/documentService.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; console.log(`PASS  ${msg}`); };
const F = JSON.parse(fs.readFileSync(new URL("./fixtures/articlesPrecedence.D4_45.json", import.meta.url), "utf8"));
const library = JSON.parse(fs.readFileSync(new URL("../knowledge-base/clause_library/commercial/corp_board_investor_control.json", import.meta.url), "utf8"));
const SENTENCE = "in the event of any conflict between this Agreement and the Articles as between the Shareholders, this Agreement shall prevail";

for (const [type, c] of Object.entries(F.cases)) {
  ok(c.present && crypto.createHash("sha256").update(c.rendered_text).digest("hex") === c.rendered_text_sha256,
    `${type}: the frozen clause is the one that shipped (hash-pinned)`);
  ok(c.rendered_text.includes(SENTENCE), `${type}: the frozen text carries the precedence sentence`);
  const live = await generateDocument({ document_type: type, variables: c.variables });
  const clause = live.draft?.clauses.find((x) => x.clause_id === c.clause_id);
  ok(clause && clause.text === c.rendered_text, `${type}: today's output is unchanged; the wording has not been mechanically reversed`);
  const findings = [...live.validation.blockingIssues, ...live.validation.advisoryIssues].filter((i) => i.rule_id === "ARTICLES_PRECEDENCE_UNSUPPORTED");
  ok(findings.length === 1 && findings[0].severity === "HIGH" && findings[0].outcome_class === "LEGAL_REVIEW_REQUIRED" && findings[0].inter_se === true,
    `${type}: the shipped document now carries one legal-review finding (HIGH, not blocking), recognising the 'as between the Shareholders' limit`);
}
ok(library.text.includes(SENTENCE), "the library clause is unchanged pending the advocate's decision");

/* One evaluator, applied to any document, with negative controls */
const flag = (text) => validateArticlesPrecedence({ clauses: [{ clause_id: "X", title: "X", text }] });
ok(flag("If this Agreement conflicts with the Articles, this Agreement shall prevail.")[0]?.inter_se === false,
  "planted: an unqualified precedence statement is caught and recognised as unqualified");
ok(flag("These rights shall, to the extent required, be incorporated into the Articles of Association of the Company.").length === 0,
  "negative control: an obligation to reflect rights in the Articles is not a precedence claim");
ok(flag("The Parties intend these rights to be reflected in the Articles of Association of the Company.").length === 0,
  "negative control: the rebuilt term sheet's wording is not flagged");
const nda = await generateDocument({ document_type: "NDA", variables: (await import("../sweep.mjs")).variablesFor("NDA", { profile: (await import("../sweep.mjs")).FIXTURE_PROFILE.WELL_FILLED }) });
const ndaVal = await runDocumentValidation(nda.draft, { mode: "final", documentType: "NDA" });
ok(![...ndaVal.blockingIssues, ...ndaVal.advisoryIssues].some((i) => i.rule_id === "ARTICLES_PRECEDENCE_UNSUPPORTED"),
  "negative control: a document that never mentions the Articles is untouched");

const record = JSON.parse(fs.readFileSync(new URL("../knowledge-base/governance/articles-precedence-review.json", import.meta.url), "utf8"));
ok(record.decision.status === "AWAITING_ADVOCATE" && record.decision.decided_by === null, "the review is recorded as awaiting an advocate, with no decision taken");

console.log(`\narticlesPrecedence: ${checks} checks passed`);
process.exit(0);
