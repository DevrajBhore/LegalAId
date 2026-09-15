/**
 * probeTosAssent.mjs — PHASE D3.1 (TERMS_OF_SERVICE)
 *
 * WHAT DOES A TERMS OF SERVICE CLAIM ABOUT ASSENT, AND WHAT CAN BE ESTABLISHED?
 *
 * The first question is deliberately not "how do we model clickwrap and
 * browsewrap". It is what propositions the generated document actually asserts,
 * and which of them anything could establish.
 *
 * POSH asserted a fact about a body — that a committee was lawfully constituted.
 * A Terms of Service can do something stronger: assert a CONCLUSION OF LAW about
 * itself. "These Terms constitute a valid electronic agreement" is not a fact
 * about the world that better evidence would settle; it is the instrument
 * grading its own enforceability, published by the party who benefits from the
 * answer.
 *
 * Three propositions have to stay apart, and the document runs them together:
 *
 *   PUBLISHED    the terms exist and are reachable          trivially true
 *   MECHANISM    an acceptance mechanism is provided for    a CONTENT question
 *   ACCEPTED     a particular user actually assented        evidence, about a
 *                                                           person the system
 *                                                           never meets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getClauseById } from "../backend/services/clauseAssembler.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const variables = variablesFor("TERMS_OF_SERVICE", { profile: FIXTURE_PROFILE.WELL_FILLED });
const result = await generateDocument({ document_type: "TERMS_OF_SERVICE", variables });
const clauses = result.draft?.clauses || [];
const text = clauses.map((c) => c.text || "").join("\n");

// What the document says, sorted by WHAT KIND OF THING it is claiming.
// Measured against the RENDERED text, not the library text. The two differ here,
// and the difference is itself one of the findings: TOS_ACKNOWLEDGEMENT_001's
// library text says no signature is required, and it renders as a signature block.
const CLAIMS = [
  ["MECHANISM", /By accessing, registering for, or using the Services, you[^.]{0,90}agree to be bound/i,
   "states how assent is given — a contractual mechanism, and a legitimate one. NOTE: this is the SAME SENTENCE as the claim below, so the document cannot state the mechanism without also asserting that the reader read and understood."],
  ["MECHANISM", /continued use of the Services after the effective date[^.]{0,60}constitutes your acceptance/i,
   "states that continued use after a change is acceptance of the change"],
  ["ABOUT THE USER", /you[^.]{0,40}acknowledge that you have read, understood, and agree/i,
   "asserts the reader HAS read and understood — a fact about a person the system never meets"],
  ["CONCLUSION OF LAW", /constitute a legally binding electronic agreement under the Information Technology Act/i,
   "asserts the instrument's own enforceability"],
  ["CONCLUSION OF LAW", /do not require a physical or digital signature to be enforceable/i,
   "asserts it binds without signature"],
  ["WARRANTY BY A PARTY WHO NEVER SPOKE", /entered into with free consent under Sections 13[^.]{0,20}19/i,
   "has 'the Parties' warrant FREE CONSENT — the very thing in issue where assent is disputed"],
  ["WARRANTY BY A PARTY WHO NEVER SPOKE", /Each Party is competent to contract/i,
   "has the user warrant their own capacity"],
];

const found = CLAIMS.map(([kind, pattern, note]) => ({ kind, note, present: pattern.test(text) }));

// What the intake collects that could bear on whether anyone accepted.
const acceptance = getClauseById("TOS_ACCEPTANCE_001");
const lines = [];
lines.push("# Phase D3.1 — what a Terms of Service claims about assent\n");
lines.push("## Three propositions the document runs together\n");
lines.push("| | proposition | what could settle it |");
lines.push("|---|---|---|");
lines.push("| PUBLISHED | the terms exist and are reachable | trivially true — the system just generated them |");
lines.push("| MECHANISM | an acceptance mechanism is provided for | the clause text. A CONTENT question, and the one the document can answer |");
lines.push("| ACCEPTED | a particular user assented to THIS version | evidence about a person the system never meets |\n");
lines.push("## What the generated document actually claims\n");
lines.push("| kind of claim | present | what it says |");
lines.push("|---|---|---|");
for (const c of found) lines.push(`| **${c.kind}** | ${c.present ? "yes" : "no"} | ${c.note} |`);
lines.push("\n## The clause's own invalidity conditions\n");
for (const entry of acceptance.invalid_if || []) lines.push(`- invalid if: ${entry}`);
lines.push("\nBoth are about the DOCUMENT — whether it describes a mechanism, whether it identifies");
lines.push("the services. Neither is about whether anybody accepted.\n");

// The library/rendered split, which is a finding in its own right.
const ack = clauses.find((c) => c.clause_id === "TOS_ACKNOWLEDGEMENT_001");
const ackLibrary = getClauseById("TOS_ACKNOWLEDGEMENT_001")?.text || "";
lines.push("## TOS_ACKNOWLEDGEMENT_001 contradicts itself\n");
lines.push("| | says |");
lines.push("|---|---|");
lines.push(`| library text | ${/No physical or electronic signature is required/.test(ackLibrary) ? "**no signature is required for these Terms to be binding**" : "—"} |`);
lines.push(`| as rendered | ${/_____/.test(ack?.text || "") ? "**a blank signature block** — Name, Designation, Date, Place" : "—"} |`);
lines.push(`| category | \`${ack?.category}\` |`);
lines.push("");
lines.push("A published Terms of Service is not countersigned — acceptance by conduct is the whole");
lines.push("mechanism. A blank signature line at the foot invites the reader to think the instrument");
lines.push("is not yet effective, and it contradicts the acceptance clause three paragraphs above.\n");

fs.writeFileSync(path.join(ROOT, "docs/audit/TOS_ASSENT_PROBE.md"), lines.join("\n") + "\n");

console.log(`clauses: ${clauses.length}`);
for (const c of found) console.log(`  ${c.present ? "PRESENT" : "absent "}  ${c.kind.padEnd(18)} ${c.note}`);
