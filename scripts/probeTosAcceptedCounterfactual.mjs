/**
 * probeTosAcceptedCounterfactual.mjs — PHASE D3.2
 *
 * IS "THIS USER ACCEPTED" A REQUIREMENT OF THE INSTRUMENT AT ALL?
 *
 * The counterfactual that has worked throughout D2: take the candidate
 * requirement away and ask what becomes impossible to describe. If nothing about
 * the Terms of Service does, the requirement was never the instrument's.
 *
 * No machinery is designed here. The existing evidence layer is asked whether it
 * can carry the proposition, and its answer is taken as the finding.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { establish, EVIDENCE, APPLICABILITY } from "../backend/services/evidencePropositions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = getVariables("TERMS_OF_SERVICE") || {};
const variables = variablesFor("TERMS_OF_SERVICE", { profile: FIXTURE_PROFILE.WELL_FILLED });
const result = await generateDocument({ document_type: "TERMS_OF_SERVICE", variables });
const text = (result.draft?.clauses || []).map((c) => c.text || "").join("\n");

// ── 1. The five candidates, and where each one's answer would come from ──────
const CANDIDATES = [
  { id: "TERMS_IDENTIFY_THE_SERVICE", question: "What instrument is being offered?",
    answeredBy: "the document", evidence: false,
    test: /govern your access to and use of/i },
  { id: "TERMS_STATE_THEIR_PROVISIONS", question: "What does the instrument provide?",
    answeredBy: "the document", evidence: false,
    test: /Acceptable Use|Limitation of Liability|these Terms/i },
  { id: "ACCEPTANCE_MECHANISM_PROVIDED", question: "Does the instrument define a route by which assent may occur?",
    answeredBy: "the document", evidence: false,
    test: /By accessing, registering for, or using the Services/i },
  { id: "USER_ACCEPTED", question: "Did THIS user assent to THIS version?",
    answeredBy: "evidence about a person", evidence: true, test: null },
  { id: "ACCEPTANCE_CREATED_AN_ENFORCEABLE_AGREEMENT", question: "Did that assent form a binding contract?",
    answeredBy: "a court", evidence: true, test: null },
];

// ── 2. SUBJECT BINDING — the decisive structural test ────────────────────────
// Every proposition in this system binds to a subject drawn from the intake, so
// that evidence about one party establishes nothing about another. What subject
// would "this user accepted" bind to?
const SUBJECT_FIELDS = Object.keys(schema).filter((f) => /user|customer|subscriber|member|version/i.test(f));
const bindable = SUBJECT_FIELDS.filter((f) => !/hosts_user_content/.test(f));

// Probed with the closest available proposition machinery, using the only
// subject the intake offers — the company. Which is the wrong subject, and the
// machinery says so.
const PROPOSITION = "posh_policy_disseminated";   // borrowed only to exercise binding
const wrongSubject = establish(
  PROPOSITION,
  [{ proposition: PROPOSITION, provenance: "operator_declaration", state: "true",
     subject: { company_name: variables.company_name }, as_of: new Date().toISOString().slice(0, 10) }],
  { company_name: "A DIFFERENT USER" }
);

// ── 3. The counterfactual ───────────────────────────────────────────────────
// Remove USER_ACCEPTED. What can no longer be said about the DOCUMENT?
const stillDescribable = CANDIDATES.filter((c) => !c.evidence);
const undescribable = CANDIDATES.filter((c) => c.evidence);

const lines = [];
lines.push("# Phase D3.2 — does ACCEPTED belong in the Terms of Service matrix?\n");
lines.push("## The five candidates\n");
lines.push("| candidate | the question | answered by | in the document? |");
lines.push("|---|---|---|---|");
for (const c of CANDIDATES) {
  const present = c.test ? (c.test.test(text) ? "yes" : "**no**") : "n/a — not a question about the text";
  lines.push(`| \`${c.id}\` | ${c.question} | ${c.answeredBy} | ${present} |`);
}
lines.push("\n## The decisive test: what subject would it bind to?\n");
lines.push("Every proposition in this system binds to a subject taken from the intake, so that");
lines.push("evidence about one party establishes nothing about another. The binding is not");
lines.push("decoration — it is what stopped a POSH attestation for another employer from counting.\n");
lines.push(`Fields in the Terms of Service intake that could name a user or a version: **${bindable.length ? bindable.join(", ") : "none"}**\n`);
lines.push("`hosts_user_content` is a yes/no about the SERVICE, not a person.\n");
lines.push("And the machinery already refuses evidence whose subject does not match:\n");
lines.push("```");
lines.push(`evidence about one subject, asked about another  ->  ${wrongSubject.evidence} / ${wrongSubject.applicability}`);
lines.push("```\n");
lines.push("## The counterfactual\n");
lines.push("Remove `USER_ACCEPTED` from the matrix. What becomes impossible to describe?\n");
lines.push("| still fully describable | no longer describable |");
lines.push("|---|---|");
const rows = Math.max(stillDescribable.length, undescribable.length);
for (let i = 0; i < rows; i += 1) {
  lines.push(`| ${stillDescribable[i] ? `\`${stillDescribable[i].id}\`` : ""} | ${undescribable[i] ? `\`${undescribable[i].id}\`` : ""} |`);
}
fs.writeFileSync(path.join(ROOT, "docs/audit/TOS_ACCEPTED_COUNTERFACTUAL.md"), lines.join("\n") + "\n");

console.log("candidates answered by the document:", stillDescribable.map((c) => c.id).join(", "));
console.log("candidates answered elsewhere:      ", undescribable.map((c) => c.id).join(", "));
console.log("intake fields that could name a user or version:", bindable.length ? bindable.join(", ") : "NONE");
console.log(`wrong-subject evidence: ${wrongSubject.evidence} / ${wrongSubject.applicability}`);
for (const c of CANDIDATES.filter((x) => x.test)) {
  console.log(`  ${c.test.test(text) ? "in the document" : "NOT in the document"}  ${c.id}`);
}
