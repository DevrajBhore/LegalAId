/**
 * probeDriverSemantics.mjs — PHASE D4.9
 *
 * WHAT DOES EACH UNCLASSIFIED BUILDER DECISION ACTUALLY DECIDE?
 *
 * D4.8 found 35 sentence-level changes whose drivers resolve to no layer of the
 * knowledge base: they exist as a question and a derived flag, and nothing says
 * what legal thing they mean. Five distinct drivers account for all 35.
 *
 * `UNCLASSIFIED` was the honest verdict there and it is not a conclusion. It says
 * the behaviour was observed and its legal meaning is undetermined. This probe
 * gathers the evidence needed to determine it — and gathers it from the TEXT
 * DELTA rather than from the driver's name, because a name is a hypothesis.
 * `escrow_required` sounds commercial; whether it is depends on what moves.
 *
 * WHAT IS EXTRACTED, PER DRIVER:
 *
 *   - the exact sentences that appear and disappear, per clause and family
 *   - whether the delta confers a RIGHT ("may terminate"), imposes an OBLIGATION
 *     ("shall provide"), or neither
 *   - the affected clause's own legal_basis, so a delta can be checked against
 *     the authority the clause already claims
 *   - whether any concept, proposition or requirement in the repository already
 *     speaks to the subject
 *
 * WHAT IS NOT DONE. No classification is assigned by this file and nothing is
 * migrated. Deciding whether a termination-for-convenience right is a legal
 * proposition, a commercial term or a drafting default is a legal judgement; the
 * probe's job is to put the sentences in front of whoever makes it. Assigning a
 * category mechanically from a verb would be the same error as reading authority
 * from a citation count.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { optionMeaning } from "./lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { loadConcepts } from "../backend/services/conceptResolver.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const DRIVERS = readJson(path.join(ROOT, "docs/audit/builder-provenance.json"))
  .filter((r) => r.klass === "UNCLASSIFIED")
  .reduce((set, r) => set.add(r.driver), new Set());

function sentences(text) {
  return String(text || "")
    .replace(/\b(s|ss|No|Rs|Sch|Art|cl|para|Ltd|Pvt|Co|Inc|v|vs)\.\s*/gi, "$1<D> ")
    .replace(/\b(\d)\.(\d)/g, "$1<D>$2")
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.replace(/<D>/g, ".").trim())
    .filter((s) => s.length > 20);
}
/* Limb labels renumber when a limb is removed, so compare without them. */
const norm = (s) => s.replace(/^\([a-z]\)\s*/i, "").replace(/\s+/g, " ").trim();

/** Does the sentence confer a right, impose a duty, or neither? */
function force(sentence) {
  const s = sentence.toLowerCase();
  if (/\bmay (be )?(terminate|revoke|require|elect|request|withhold|suspend)/.test(s)) return "RIGHT";
  if (/\bshall not\b/.test(s)) return "PROHIBITION";
  if (/\bshall\b|\bmust\b|\bis required to\b/.test(s)) return "OBLIGATION";
  if (/\backnowledge|\bagree that\b|\bis deemed\b/.test(s)) return "ACKNOWLEDGEMENT";
  return "STATEMENT";
}

const clauseBasis = new Map();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "blueprints") walk(p); continue; }
    if (!e.name.endsWith(".json") || e.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) {
      if (c?.clause_id) clauseBasis.set(c.clause_id,
        (c.legal_basis || []).map((b) => `${b.act}${b.section ? ` s.${b.section}` : ""}`));
    }
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

/** Anything in the repository that already speaks to this subject. */
function repositoryMentions(driver) {
  const word = driver.replace(/_/g, " ");
  const hits = [];
  for (const c of loadConcepts().values()) {
    if (new RegExp(word, "i").test(JSON.stringify(c))) hits.push(`concept:${c.concept_id}`);
  }
  const props = readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json")).propositions;
  for (const p of props) {
    if (new RegExp(word, "i").test(JSON.stringify(p))) hits.push(`proposition:${p.proposition_id}`);
  }
  const REQ = path.join(ROOT, "knowledge-base/documents/requirements");
  for (const f of fs.readdirSync(REQ)) {
    const m = readJson(path.join(REQ, f));
    for (const r of m.requirements || []) {
      if (new RegExp(word, "i").test(JSON.stringify(r))) hits.push(`requirement:${m.document_type}/${r.id}`);
    }
  }
  return [...new Set(hits)];
}

const findings = new Map();
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY).sort()) {
  let base;
  try { base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }); }
  catch { continue; }
  const schema = getVariables(documentType) || {};

  const run = async (v) => {
    try {
      const r = await generateDocument({ document_type: documentType, variables: v });
      const l = r.draft?.clauses || [];
      return l.length ? new Map(l.map((c) => [c.clause_id, c.text || ""])) : null;
    } catch { return null; }
  };
  const baseline = await run(base);
  if (!baseline) continue;

  for (const driver of DRIVERS) {
    const def = schema[driver];
    if (!def || def.type !== "select" || !Array.isArray(def.options)) continue;
    const no = optionMeaning(def, POSITION.FALSE);
    if (no === null || String(base[driver]) === String(no)) continue;
    const world = await run({ ...base, [driver]: no });
    if (!world) continue;

    for (const [clauseId, after] of world) {
      const before = baseline.get(clauseId);
      if (before === undefined || before === after) continue;
      const a = sentences(before).map(norm);
      const b = sentences(after).map(norm);
      const removed = a.filter((s) => !b.includes(s));
      const added = b.filter((s) => !a.includes(s));
      if (!removed.length && !added.length) continue;   // limb relabelling only

      if (!findings.has(driver)) findings.set(driver, []);
      findings.get(driver).push({ documentType, clauseId, removed, added,
        basis: clauseBasis.get(clauseId) || [] });
    }
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

const out = [];
out.push("# Phase D4.9 — what do the unclassified builder decisions decide?\n");
out.push("D4.8 found 35 sentence-level changes driven by inputs that exist as a question and a derived");
out.push("flag and nothing else. Five drivers account for all 35. `UNCLASSIFIED` was the honest verdict");
out.push("and is not a conclusion: it says the behaviour was observed and its legal meaning is");
out.push("undetermined.\n");
out.push("**This probe assigns no classification and migrates nothing.** It extracts the sentences that");
out.push("actually move, so the judgement rests on the text rather than on the driver's name — a name");
out.push("is a hypothesis, and `escrow_required` sounds commercial whatever it turns out to do.\n");

for (const [driver, rows] of findings) {
  const mentions = repositoryMentions(driver);
  out.push(`## \`${driver}\`\n`);
  out.push(`Affects ${rows.length} clause/family pair(s).`);
  out.push(`Repository already speaks to it: ${mentions.length ? mentions.join(", ") : "**nothing**"}\n`);

  const seen = new Set();
  for (const r of rows) {
    const key = r.clauseId + JSON.stringify(r.removed) + JSON.stringify(r.added);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`**${r.documentType} / \`${r.clauseId}\`** — clause cites: ${r.basis.join("; ") || "nothing"}\n`);
    for (const s of r.removed) out.push(`- REMOVED [${force(s)}] ${s}`);
    for (const s of r.added) out.push(`- ADDED [${force(s)}] ${s}`);
    out.push("");
  }
}

fs.writeFileSync(path.join(ROOT, "docs/audit/DRIVER_SEMANTICS.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/driver-semantics.json"),
  JSON.stringify([...findings.entries()].map(([driver, rows]) => ({ driver, rows })), null, 2));
console.log(out.join("\n"));
