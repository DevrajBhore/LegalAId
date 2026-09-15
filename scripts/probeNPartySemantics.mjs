/**
 * probeNPartySemantics.mjs — PHASE D4.15
 *
 * WHAT DOES "THE OTHER PARTY" ACTUALLY MEAN?
 *
 * D4.14 confirmed the representation gap: no party index above 2 anywhere, no
 * collection type, and five families where more than two principals are legally
 * ordinary. The repair has two halves that must agree — a repeating-entity
 * representation, and N-party language in the 15 of 43 shared CORE clauses that
 * say "the other Party". A collection feeding binary language would produce a
 * document that names four principals and speaks to two.
 *
 * So the clause language is taken first, because it decides the shape of the
 * schema rather than the other way round. Designing a generic `parties[]` and
 * discovering afterwards that it cannot express the relationships is the failure
 * this ordering exists to avoid.
 *
 * THE QUESTION, PER OCCURRENCE: when a clause says "the other Party", does it
 * mean
 *
 *   EACH_OTHER      severally, to each other party taken one at a time —
 *                   a confidentiality obligation owed to each discloser
 *   ALL_OTHERS      collectively, to every other party at once —
 *                   a notice that must reach everyone
 *   ANY_ONE         it is enough that one other party does it —
 *                   a right exercisable against whoever is in default
 *   THE_FIRM        the counterparty is the entity, not the other members —
 *                   a partner's obligation runs to the firm
 *   RECIPROCAL_CAP  a quantity shared between two that must be re-apportioned —
 *                   an aggregate liability cap, where N parties changes the sum
 *
 * Those are not stylistic variants. Under a two-party instrument they collapse
 * into the same words and cannot be told apart; under three they are different
 * obligations and some of them are different amounts of money.
 *
 * WHAT THIS PROBE DOES AND DOES NOT DO. It extracts every binary-party
 * construction from the shared CORE clauses, records which families rely on each
 * clause, and reports the distribution. **It assigns no interpretation
 * mechanically.** Which reading a sentence bears is a legal judgement, and a
 * regex that guessed would manufacture exactly the evidence a schema design
 * would then be built on.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/*
 * TWO regexes, deliberately. A /g regex is STATEFUL under .test(): lastIndex
 * advances between calls, so alternating calls return false and roughly half the
 * matches vanish. The first run of this probe used one global regex for both
 * testing and counting and silently dropped CORE_LIMITATION_LIABILITY_001 and
 * CORE_CONFIDENTIALITY_001 — including the aggregate liability cap, which is the
 * single most important sentence in the measurement.
 *
 * This error under-reports, unlike the previous ten, which all inflated. A
 * measurement can be wrong in the reassuring direction too.
 */
const BINARY_TEST = /\b(the other Party|either Party|neither Party|both Parties|one Party)\b/i;
const BINARY_COUNT = /\b(the other Party|either Party|neither Party|both Parties|one Party)\b/gi;

/* ── the clauses ─────────────────────────────────────────────────────────── */

const clauses = new Map();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "blueprints") walk(p); continue; }
    if (!e.name.endsWith(".json") || e.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.clause_id) clauses.set(c.clause_id, c);
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

function sentences(text) {
  return String(text || "")
    .replace(/\b(s|ss|No|Rs|Sch|Art|cl|para|Ltd|Pvt|Co|Inc|v|vs)\.\s*/gi, "$1<D> ")
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.replace(/<D>/g, ".").trim())
    .filter((s) => s.length > 20);
}

/* ── which families actually emit each clause ────────────────────────────── */

/*
 * RENDERED text, not library text. `documentHardening` builds several CORE
 * clauses at generation time, so the words that ship are not the words on disk.
 * The first run of this probe read the library and missed
 * CORE_LIMITATION_LIABILITY_001 and CORE_CONFIDENTIALITY_001 entirely — the
 * aggregate liability cap among them, which is the single sentence the whole
 * measurement turns on. Read what ships.
 */
const reliance = new Map();
const rendered = new Map();
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY).sort()) {
  let result;
  try {
    result = await generateDocument({
      document_type: documentType,
      variables: variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    });
  } catch { continue; }
  for (const c of result.draft?.clauses || []) {
    if (!reliance.has(c.clause_id)) reliance.set(c.clause_id, new Set());
    reliance.get(c.clause_id).add(documentType);
    if (!rendered.has(c.clause_id)) rendered.set(c.clause_id, new Set());
    rendered.get(c.clause_id).add(c.text || "");
  }
}

/* ── the occurrences ─────────────────────────────────────────────────────── */

/** Families where more than two principals are legally ordinary. */
const MULTI = new Set(["PARTNERSHIP_DEED", "SHAREHOLDERS_AGREEMENT", "FOUNDERS_AGREEMENT",
  "JOINT_VENTURE_AGREEMENT", "SHARE_SUBSCRIPTION_AGREEMENT"]);

const rows = [];
for (const clauseId of new Set([...clauses.keys(), ...rendered.keys()])) {
  if (!clauseId.startsWith("CORE_")) continue;
  const clause = clauses.get(clauseId) || {};
  /* Every rendering that shipped, plus the library text for clauses never emitted. */
  const texts = rendered.has(clauseId) ? [...rendered.get(clauseId)] : [clause.text || ""];
  const hits = [...new Set(texts.flatMap(sentences).filter((s) => BINARY_TEST.test(s)))];
  if (!hits.length) continue;
  const families = reliance.get(clauseId) || new Set();
  const exposed = [...families].filter((f) => MULTI.has(f));
  rows.push({
    clause_id: clauseId,
    category: clause.category || null,
    occurrences: hits.reduce((n, s) => n + (s.match(BINARY_COUNT) || []).length, 0),
    sentences: hits,
    families: families.size,
    exposed_families: exposed,
    legal_basis: (clause.legal_basis || []).map((b) => `${b.act}${b.section ? ` s.${b.section}` : ""}`),
    /* A money quantity in the sentence: with N parties an aggregate changes value. */
    quantitative: hits.some((s) => /aggregate|cap|limit|total|exceed|amount|liability of/i.test(s)),
  });
}
rows.sort((a, b) => b.exposed_families.length - a.exposed_families.length || b.occurrences - a.occurrences);

/* ── report ──────────────────────────────────────────────────────────────── */

const out = [];
out.push("# Phase D4.15 — what does \"the other Party\" mean?\n");
out.push("The N-party repair has two halves that must agree: a repeating-entity representation and");
out.push("N-party clause language. The language is taken first, because it decides the shape of the");
out.push("schema. Designing a generic `parties[]` and discovering afterwards that it cannot express");
out.push("the relationships is the failure this ordering exists to avoid.\n");
out.push("**No interpretation is assigned mechanically.** Which reading a sentence bears is a legal");
out.push("judgement, and a regex that guessed would manufacture the very evidence a schema would");
out.push("then be built on.\n");

const exposed = rows.filter((r) => r.exposed_families.length);
out.push(`${rows.length} shared CORE clauses carry binary-party language, `);
out.push(`${exposed.length} of them in at least one family where more than two principals are ordinary.\n`);

out.push("| clause | occurrences | families | exposed families | quantitative |");
out.push("|---|---|---|---|---|");
for (const r of rows) {
  out.push(`| \`${r.clause_id}\` | ${r.occurrences} | ${r.families} | ${r.exposed_families.length} | ${r.quantitative ? "**yes**" : "no"} |`);
}
out.push("");
out.push("**Quantitative matters more than the counts.** A confidentiality obligation read as");
out.push("severally-owed means the same thing whether there are two parties or five. An aggregate");
out.push("liability cap does not: with three parties, \"the aggregate liability of either Party\" is");
out.push("either three caps or one shared cap, and those are different amounts of money.\n");

out.push("## The sentences, for reading\n");
for (const r of exposed) {
  out.push(`### \`${r.clause_id}\`${r.category ? ` — ${r.category}` : ""}\n`);
  out.push(`Emitted in ${r.families} families; exposed in ${r.exposed_families.join(", ")}.`);
  if (r.legal_basis.length) out.push(`Cites: ${r.legal_basis.join("; ")}`);
  out.push("");
  for (const s of r.sentences) out.push(`- ${s.replace(/\s+/g, " ").slice(0, 300)}`);
  out.push("");
}

fs.writeFileSync(path.join(ROOT, "docs/audit/NPARTY_SEMANTICS.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/nparty-semantics.json"), JSON.stringify(rows, null, 2));
console.log(out.join("\n").slice(0, 3000));
console.error(`\nwrote docs/audit/NPARTY_SEMANTICS.md — ${rows.length} clauses, ${exposed.length} exposed`);
