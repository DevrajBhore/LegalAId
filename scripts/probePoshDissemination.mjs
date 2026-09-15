/**
 * probePoshDissemination.mjs — PHASE D2.4
 *
 *     "The policy says it was disseminated"  !=  "the system has evidence it was"
 *
 * Section 19(a) of the Sexual Harassment of Women at Workplace (Prevention,
 * Prohibition and Redressal) Act, 2013 makes the employer's duty to formulate
 * AND widely disseminate; 19(b) requires display at a conspicuous place.
 *
 * Every external act the system has modelled so far is performed BEFORE AN
 * AUTHORITY and leaves a record an authority keeps — registration under the
 * Registration Act, stamping under the Stamp Act, a company's articles. There is
 * no registrar of dissemination. So the question this probe answers is whether
 * the existing evidence machinery generalises to an act whose subject is a
 * workforce, or whether that is the first genuine pressure in this family.
 *
 * PROBED UNCHANGED. Nothing here extends the mechanism; it records exactly where
 * it succeeds and where it bottoms out.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVIDENCE, APPLICABILITY, establish, resolveEvidence, NEVER_ADMISSIBLE }
  from "../backend/services/evidencePropositions.js";
import { getClauseById } from "../backend/services/clauseAssembler.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1. THE PROPOSITION, taken from the authored requirement rather than restated.
const requirements = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/documents/requirements/posh_policy.requirements.json"), "utf8"));
const requirement = requirements.requirements.find((r) => r.id === "POLICY_DISSEMINATED");

// 2. WHAT THE SYSTEM OBSERVES. The policy is generated; nothing observes a
//    workplace noticeboard.
const variables = variablesFor("POSH_POLICY", { profile: FIXTURE_PROFILE.WELL_FILLED });
const result = await generateDocument({ document_type: "POSH_POLICY", variables });
const shipped = (result.draft?.clauses || []).map((c) => c.text || "").join("\n");
const SAYS_DISPLAYED = /display(ed)? at a conspicuous place|widely disseminat/i.test(shipped);

// 3. PROVENANCE CLASSES, probed against the machinery as it stands.
const CANDIDATES = [
  { source: "ai_inference", note: "a model reading the policy text and concluding it was displayed" },
  { source: "clause_text", note: "the policy's own sentence saying the notice is displayed" },
  { source: "operator_declaration", note: "the employer ticking a box to say they displayed it" },
  { source: "third_party_attestation", note: "a signed confirmation from someone who saw it" },
  { source: "public_register", note: "a registry of disseminated policies — no such registry exists" },
  { source: "system_observation", note: "the system itself observing the workplace" },
];

// The proposition, DECLARED in the knowledge base and loaded by the machinery —
// not a literal passed in here, because a probe that hands the resolver its own
// declaration is testing a fixture rather than the system.
const PROPOSITION = "posh_policy_disseminated";
const SUBJECT = { company_name: variables.company_name };
const record = (source, value, extra = {}) => ({
  proposition: PROPOSITION, provenance: source, state: String(value), subject: SUBJECT,
  as_of: new Date().toISOString().slice(0, 10), ...extra,
});

const rows = [];
for (const candidate of CANDIDATES) {
  const outcome = establish(PROPOSITION, [record(candidate.source, true)], SUBJECT);
  rows.push({ ...candidate, state: outcome.evidence, applicability: outcome.applicability,
              detail: (outcome.detail || "").slice(0, 120) });
}

// 4. THE STATES THE REQUIREMENT MUST DISTINGUISH.
const OLD = "2023-09-01";
const STATES = [
  ["nothing supplied", []],
  ["the employer says they displayed it", [record("operator_declaration", true)]],
  ["the employer says they did NOT", [record("operator_declaration", false)]],
  ["attested by a third party", [record("third_party_attestation", true)]],
  ["attested two years ago", [record("third_party_attestation", true, { as_of: OLD })]],
  ["two records that disagree", [record("operator_declaration", true), record("third_party_attestation", false)]],
  ["inferred by a model from the policy text", [record("ai_inference", true)]],
  ["about a different company", [record("operator_declaration", true, { subject: { company_name: "Someone Else Pvt Ltd" } })]],
];
const stateRows = [];
for (const [label, records] of STATES) {
  const outcome = establish(PROPOSITION, records, SUBJECT);
  stateRows.push({ label, state: outcome.evidence, applicability: outcome.applicability,
                   value: outcome.value, detail: (outcome.detail || "").slice(0, 150) });
}

const lines = [];
lines.push("# Phase D2.4 — the dissemination probe\n");
lines.push("## 1. The proposition, as the requirement states it\n");
lines.push(`> ${requirement.statement}\n`);
lines.push(`**Outside the document:** ${requirement.outside_the_document}\n`);
lines.push("## 2. What the system observes\n");
lines.push(`The generated policy ${SAYS_DISPLAYED ? "**does**" : "does not"} contain words asserting display or dissemination.`);
lines.push("Nothing observes a workplace noticeboard, an email to staff, or an intranet page.");
lines.push("There is no registrar of dissemination, so unlike registration and stamping there is");
lines.push("no authority whose record could be fetched.\n");
lines.push("## 3. Provenance, run through the existing admission gate\n");
lines.push("| candidate source | what it would be | outcome |");
lines.push("|---|---|---|");
for (const r of rows) lines.push(`| \`${r.source}\` | ${r.note} | ${r.state} → ${r.applicability} |`);
lines.push(`\nAbsolutely inadmissible, whatever a declaration says: ${[...NEVER_ADMISSIBLE].map((s) => `\`${s}\``).join(", ")}\n`);
lines.push("## 4. The states the requirement must tell apart\n");
lines.push("| situation | evidence state | applicability | value |");
lines.push("|---|---|---|---|");
for (const r of stateRows) lines.push(`| ${r.label} | ${r.state} | ${r.applicability} | ${r.value === undefined ? "—" : r.value} |`);
fs.writeFileSync(path.join(ROOT, "docs/audit/POSH_DISSEMINATION_PROBE.md"), lines.join("\n") + "\n");

console.log(`policy asserts display in its own text: ${SAYS_DISPLAYED}`);
console.log("provenance outcomes:");
for (const r of rows) console.log(`   ${r.source.padEnd(26)} ${String(r.state).padEnd(24)} ${r.applicability}`);
console.log("states:");
for (const r of stateRows) console.log(`   ${r.label.padEnd(42)} ${String(r.state).padEnd(24)} ${String(r.applicability).padEnd(12)} ${r.value === undefined ? "" : r.value}`);
