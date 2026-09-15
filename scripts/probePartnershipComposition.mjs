/**
 * probePartnershipComposition.mjs — PHASE D4.1
 *
 * CAN THE SYSTEM DESCRIBE A PARTNERSHIP OF THREE?
 *
 * A firm of three is an ordinary thing. Section 464 of the Companies Act, 2013
 * read with Rule 10 caps a partnership at fifty; the Indian Partnership Act,
 * 1932 sets no upper bound of its own and no lower bound above two.
 *
 * The probe does not ask whether a third name can be stored. It asks what the
 * generated deed SAYS, and which layer the failure lives in:
 *
 *     intake            is there a field for a third partner?
 *     clause selection  does any clause turn on how many there are?
 *     clause text       does the prose assume exactly two?
 *     requirements      does anything assert a partner count at all?
 *     assessment        would a two-partner deed for a three-partner firm
 *                       report anything other than clean?
 *
 * A sane fixture is used rather than the sampler's, which produces a person
 * named as a private limited company contributing three rupees. Nonsense inputs
 * make every finding arguable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SANE = {
  partner_1_name: "Meera Iyer", partner_1_type: "Individual",
  partner_1_address: "12 Hill Road, Bandra, Mumbai, Maharashtra 400050",
  partner_2_name: "Arjun Desai", partner_2_type: "Individual",
  partner_2_address: "44 Linking Road, Khar, Mumbai, Maharashtra 400052",
  capital_contribution_1: 600000, capital_contribution_2: 400000,
  profit_sharing_ratio: "60:40",
  partnership_name: "Iyer & Desai Associates",
};

async function deed(overrides = {}) {
  const variables = { ...variablesFor("PARTNERSHIP_DEED", { profile: FIXTURE_PROFILE.WELL_FILLED }), ...SANE, ...overrides };
  const result = await generateDocument({ document_type: "PARTNERSHIP_DEED", variables });
  const clauses = result.draft?.clauses || [];
  return {
    generates: clauses.length > 0,
    clauses,
    text: clauses.map((c) => c.text || "").join("\n"),
    requirements: result.requirements?.results || [],
    issues: (result.validation?.errors || result.validation?.issues || []).map((e) => e.message || String(e)),
  };
}

const base = await deed();

// ── 1. INTAKE: is there anywhere to put a third partner? ────────────────────
const schema = getVariables("PARTNERSHIP_DEED") || {};
const partnerFields = Object.keys(schema).filter((f) => /^partner_\d+_|^capital_contribution_\d+$/.test(f));
const indices = [...new Set(partnerFields.map((f) => (f.match(/(\d+)/) || [])[1]).filter(Boolean))].sort();

// ── 2. CLAUSE TEXT: does the prose assume exactly two? ──────────────────────
const BINARY = [
  [/\bthe other (?:Party|Partner)\b/gi, '"the other" — undefined when there are three'],
  [/\beither (?:Party|Partner)\b/gi, '"either" — a choice between two'],
  [/\bBY AND BETWEEN\b/gi, '"BY AND BETWEEN" — the two-party recital formula'],
  [/\bNeither Party\b/gi, '"Neither Party"'],
  [/\bboth Parties\b/gi, '"both Parties"'],
];
const leaks = [];
for (const clause of base.clauses) {
  for (const [pattern, note] of BINARY) {
    const hits = (clause.text || "").match(pattern);
    if (hits) leaks.push({ clause: clause.clause_id, note, count: hits.length });
  }
}

// ── 3. Does the required profit share reach the document at all? ────────────
const shareReaches = base.text.includes(String(SANE.profit_sharing_ratio));
const capitalReaches = /6,?00,?000|600000|Six Lakh/i.test(base.text);

// ── 4. REQUIREMENTS: does anything assert a partner count? ──────────────────
const declared = loadDocumentRequirements().get("PARTNERSHIP_DEED") || [];

// ── 5. THE THREE-PARTNER ATTEMPT ───────────────────────────────────────────
// There is no field, so the only thing a user can do is write the third partner
// into a free-text field and hope. Both attempts are recorded.
const third = await deed({
  partner_roles: "Meera Iyer — operations. Arjun Desai — finance. Kavita Rao — technology.",
  profit_sharing_ratio: "40:35:25",
});
const thirdNamed = third.text.includes("Kavita Rao");
const thirdIsAParty = /Kavita Rao[^.]{0,80}(?:Partner|Party)/i.test(third.text);

const lines = [];
lines.push("# Phase D4.1 — can the system describe a partnership of three?\n");
lines.push("## Layer 1 — intake\n");
lines.push(`Partner-indexed fields: ${partnerFields.join(", ")}\n`);
lines.push(`**Partner slots: ${indices.length}** (indices ${indices.join(", ")}). There is no field for a third.\n`);
lines.push("## Layer 2 — clause text\n");
lines.push(`**${leaks.length} binary-language occurrences across ${new Set(leaks.map((l) => l.clause)).size} shipped clauses.**`);
lines.push("The two-party assumption is not only in the intake — it is written into the prose.\n");
lines.push("| clause | assumes two, by |  |");
lines.push("|---|---|---|");
for (const l of leaks) lines.push(`| ${l.clause} | ${l.note} | ×${l.count} |`);
lines.push("\n## Layer 3 — do the answers reach the document?\n");
lines.push(`| required field | answered | reaches the deed |`);
lines.push("|---|---|---|");
lines.push(`| profit_sharing_ratio | ${SANE.profit_sharing_ratio} | ${shareReaches ? "yes" : "**NO**"} |`);
lines.push(`| capital_contribution_1 | ${SANE.capital_contribution_1} | ${capitalReaches ? "yes" : "**NO**"} |`);
lines.push("\n## Layer 4 — requirements\n");
lines.push(`Authored requirements for PARTNERSHIP_DEED: **${declared.length}**.\n`);
lines.push("## Layer 5 — the three-partner attempt\n");
lines.push(`The deed generates: ${third.generates ? "yes" : "no"}.`);
lines.push(`The third partner's name appears anywhere: ${thirdNamed ? "yes, in free text" : "no"}.`);
lines.push(`The third partner is identified AS a partner: ${thirdIsAParty ? "yes" : "**no**"}.`);
lines.push(`Issues raised: ${third.issues.length ? third.issues.join("; ") : "**none**"}\n`);
fs.writeFileSync(path.join(ROOT, "docs/audit/PARTNERSHIP_COMPOSITION_PROBE.md"), lines.join("\n") + "\n");

console.log(`partner slots in the intake: ${indices.length} (${indices.join(", ")})`);
console.log(`binary-language occurrences: ${leaks.length} across ${new Set(leaks.map((l) => l.clause)).size} clauses`);
for (const l of leaks) console.log(`   ${l.clause.padEnd(32)} ${l.note} x${l.count}`);
console.log(`profit_sharing_ratio reaches the deed: ${shareReaches}`);
console.log(`capital contribution reaches the deed: ${capitalReaches}`);
console.log(`authored requirements: ${declared.length}`);
console.log(`three-partner deed generates: ${third.generates}, third named: ${thirdNamed}, as a partner: ${thirdIsAParty}, issues: ${third.issues.length}`);
