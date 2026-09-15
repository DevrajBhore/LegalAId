/**
 * probePoshComposition.mjs — PHASE D2.3
 *
 * WHAT DOES THE POLICY ASSERT ABOUT THE INTERNAL COMMITTEE, AND ON WHAT?
 *
 * The question this probe exists to answer is NOT "should we build a
 * list-of-people abstraction". It is the one the standing rule requires first:
 * does the concrete POSH requirement need one, or can the existing
 * FACT -> POSITION -> REQUIREMENT model carry it?
 *
 * Section 4 of the Sexual Harassment of Women at Workplace (Prevention,
 * Prohibition and Redressal) Act, 2013 fixes the Internal Committee's
 * composition: a Presiding Officer who is a woman employed at a senior level,
 * not fewer than half the members women, and one member from a non-governmental
 * organisation or familiar with the issues. POSH_INTERNAL_COMMITTEE_001 already
 * states each of those as an `invalid_if`, so the TEST is authored. The question
 * is what establishes it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getClauseById } from "../backend/services/clauseAssembler.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { loadSemanticFacts } from "../backend/services/canonicalFacts.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The statutory tests, taken verbatim from the clause's own invalid_if — not
// restated, so the probe cannot drift from the knowledge it is checking.
const clause = getClauseById("POSH_INTERNAL_COMMITTEE_001");
const TESTS = clause.invalid_if;

// What the SHIPPED policy says about each of them.
const variables = variablesFor("POSH_POLICY", { profile: FIXTURE_PROFILE.WELL_FILLED });
const result = await generateDocument({ document_type: "POSH_POLICY", variables });
const shipped = (result.draft?.clauses || []).find((c) => c.clause_id === "POSH_INTERNAL_COMMITTEE_001");
const text = shipped?.text || "";

const ASSERTIONS = [
  ["Presiding Officer is a woman at a senior level", /a woman employed at a senior level/i],
  ["not fewer than half the members are women", /not fewer than one[- ]half|at least one[- ]half|half .{0,20}members .{0,20}women/i],
  ["an external member from an NGO or familiar with the issues", /non-governmental organisation|familiar with the issues/i],
  ["the committee has been constituted", /has constituted an Internal Committee/i],
];

// What the intake COLLECTS about the committee.
const schema = getVariables("POSH_POLICY") || {};
const collected = Object.keys(schema).filter((f) => /posh_|committee/i.test(f));

// What could ESTABLISH any of it: declared semantic facts, and the evidence
// propositions layer.
const facts = [...loadSemanticFacts().keys()];
const propositionFiles = fs.existsSync(path.join(ROOT, "knowledge-base/intake/propositions"))
  ? fs.readdirSync(path.join(ROOT, "knowledge-base/intake/propositions"))
  : [];
const propositions = propositionFiles.flatMap((f) =>
  (JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/intake/propositions", f), "utf8"))
    .propositions || []).map((p) => p.id));

const lines = [];
lines.push("# Phase D2.3 — the Internal Committee composition probe\n");
lines.push("## The statutory tests, as the clause itself states them\n");
TESTS.forEach((t) => lines.push(`- invalid if: ${t}`));
lines.push("\n## What the shipped policy ASSERTS\n");
lines.push("| assertion | present in the shipped clause |");
lines.push("|---|---|");
for (const [label, pattern] of ASSERTIONS) {
  lines.push(`| ${label} | ${pattern.test(text) ? "**yes — the document says so**" : "no"} |`);
}
lines.push("\n## What the intake COLLECTS about the committee\n");
lines.push("| field | type | what it establishes |");
lines.push("|---|---|---|");
for (const field of collected) {
  lines.push(`| ${field} | ${schema[field].type}${schema[field].required ? ", required" : ""} | a ${schema[field].type === "text" ? "NAME, and nothing about that person's attributes" : "value"} |`);
}
lines.push("\n## What could establish the statutory tests\n");
lines.push(`Declared semantic facts (${facts.length}): ${facts.join(", ")}`);
lines.push(`\nEvidence propositions (${propositions.length}): ${propositions.join(", ") || "none for this family"}`);
const establishing = [...facts, ...propositions].filter((id) => /committee|posh|composition|women|presiding/i.test(id));
lines.push(`\n**Establishing the composition: ${establishing.length ? establishing.join(", ") : "NOTHING."}**`);

fs.writeFileSync(path.join(ROOT, "docs/audit/POSH_COMPOSITION_PROBE.md"), lines.join("\n") + "\n");
console.log(`statutory tests authored on the clause: ${TESTS.length}`);
console.log(`assertions the shipped policy makes:    ${ASSERTIONS.filter(([, p]) => p.test(text)).length} of ${ASSERTIONS.length}`);
console.log(`committee fields collected:             ${collected.join(", ") || "none"}`);
console.log(`facts/propositions that establish them: ${establishing.length ? establishing.join(", ") : "NONE"}`);
