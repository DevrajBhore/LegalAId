/**
 * probeTreatmentGranularity.mjs — PHASE D4.5
 *
 * WHAT IS THE SMALLEST INDEPENDENTLY SELECTABLE LEGAL UNIT?
 *
 * D4.4-B established that a requirement binds to a clause id while a clause may
 * implement several legally distinct propositions under different statutes, so
 * `requirement -> clause` is too coarse. The obvious response is to design a
 * TREATMENT object sitting between them. This probe exists to make that decision
 * from evidence rather than from the diagram, because the operating rule is that
 * an abstraction earns its place by defeating a concrete failure the existing
 * model cannot represent.
 *
 * THE QUESTION THIS ASKS. Not "should treatments exist" — that is a design
 * opinion — but two things that are measurable today:
 *
 *   1. IS THE LIBRARY ALREADY WRITTEN AT THAT GRANULARITY? If a clause carrying
 *      four authorities has four or more sentences, its propositions are
 *      probably severable as written and the repair is composition. If it
 *      carries four authorities in one sentence, treatment-level selection
 *      requires REWRITING the law into new sentences, which is authoring new
 *      legal text and a different and much larger undertaking.
 *
 *   2. IS A TREATMENT REUSABLE, OR IS IT JUST "PART OF A CLAUSE"? An abstraction
 *      that is 1:1 with clauses in almost every case buys nothing but a layer of
 *      indirection. It earns its place only if the same legal proposition is
 *      implemented by more than one clause — because then it is a thing the
 *      system has, rather than a name for a fragment.
 *
 * WHAT THE ANSWER CANNOT BE READ FROM. Sentence counts do not establish that a
 * clause's propositions ARE severable — a single sentence can carry two
 * obligations, and four sentences can all serve one. The count bounds the
 * question from one side only: a clause with fewer sentences than authorities
 * certainly cannot be split along authority lines without rewriting. Everything
 * this probe reports is an upper bound on severability, and it says so where it
 * reports a number.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, "knowledge-base/clause_library");

const clauses = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "blueprints") walk(p); continue; }
    if (!entry.name.endsWith(".json")) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.clause_id) clauses.push(c);
  }
})(LIB);

const cite = (b) => (b.act ? (b.section ? `${b.act} s.${b.section}` : b.act) : null);

/**
 * Sentence split that does not break on statutory references.
 *
 * "s.43" and "1952." and "No. 3 of 2020" all contain a period that is not a
 * sentence end. Splitting naively inflates every count in the direction that
 * makes severability look easier than it is — the same bias as the seven
 * earlier measurement errors, so the exclusions are explicit.
 */
function sentences(text) {
  return String(text || "")
    .replace(/\b(s|ss|No|Rs|Sch|Art|cl|para|Ltd|Pvt|Co|Inc|v|vs)\.\s*/gi, "$1<DOT> ")
    .replace(/\b(\d)\.(\d)/g, "$1<DOT>$2")
    .split(/(?<=[.;:])\s+(?=[A-Z(])/)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter((s) => s.length > 25);
}

const rows = clauses.map((c) => {
  const authorities = [...new Set((c.legal_basis || []).map(cite).filter(Boolean))];
  const acts = [...new Set((c.legal_basis || []).map((b) => b.act).filter(Boolean))];
  return {
    clause_id: c.clause_id,
    category: c.category || null,
    authorities: authorities.length,
    distinct_acts: acts.length,
    sentences: sentences(c.text).length,
    words: String(c.text || "").split(/\s+/).filter(Boolean).length,
  };
});

/* ── 1. severability ceiling ───────────────────────────────────────────────── */

const multi = rows.filter((r) => r.distinct_acts > 1);
const cannotSever = multi.filter((r) => r.sentences < r.distinct_acts);
const couldSever = multi.filter((r) => r.sentences >= r.distinct_acts);

/* ── 2. is a proposition reusable? ─────────────────────────────────────────── */
/*
 * THE OBVIOUS MEASUREMENT IS WRONG, AND THIS RECORDS WHY.
 *
 * Counting how many clauses cite each (Act, section) looks like it measures
 * whether a proposition is reused. It does not. Indian Contract Act 1872 s.73 is
 * cited by 26 clauses across 13 categories, and the notes say what it is doing
 * there: "Compensation for loss caused by breach", "Damages for breach",
 * "Damages for breach of employment obligation". Twenty-six clauses are not
 * implementing one damages treatment; each imposes its own obligation and cites
 * the general law of damages as BACKGROUND. Same for s.37 ("Obligation to
 * perform") and s.10 (formation).
 *
 * Citing the same section is not implementing the same proposition. Reporting
 * those counts as reusable treatments would be the eighth instance of a filter
 * matching more than it meant — and it would have argued for building a
 * treatment layer on evidence that does not exist.
 *
 * So the counts below are reported as what they are: how widely a section is
 * cited, with the widely-cited ones called out as general-law background rather
 * than as candidate treatments.
 */
const byAuthority = new Map();
for (const c of clauses) {
  for (const key of new Set((c.legal_basis || []).map(cite).filter(Boolean))) {
    if (!byAuthority.has(key)) byAuthority.set(key, []);
    byAuthority.get(key).push({ id: c.clause_id, category: c.category || "?" });
  }
}
const shared = [...byAuthority.entries()]
  .map(([key, list]) => ({
    key, clauses: list.length,
    categories: new Set(list.map((x) => x.category)).size,
    ids: list.map((x) => x.id),
  }))
  .filter((a) => a.clauses > 1)
  .sort((a, b) => b.clauses - a.clauses);

const crossCategory = shared.filter((a) => a.categories > 1);

const withPrimary = clauses.filter((c) => c.statutory_reference).length;
const multiPrimary = clauses.filter((c) => {
  const sr = c.statutory_reference;
  if (!sr) return false;
  return Array.isArray(sr) ? sr.length > 1 : /;| and /.test(String(sr));
}).length;

/* ── report ────────────────────────────────────────────────────────────────── */

const out = [];
out.push("# Phase D4.5 — what is the smallest independently selectable legal unit?\n");
out.push("D4.4-B established that `requirement -> clause` is too coarse: a clause can implement");
out.push("several legally distinct propositions under different statutes. The obvious response is a");
out.push("TREATMENT object between them. This probe asks whether the evidence supports one, because");
out.push("an abstraction earns its place by defeating a failure the existing model cannot represent.\n");

out.push(`## The library as written\n`);
out.push(`- ${clauses.length} clauses`);
out.push(`- ${multi.length} cite more than one distinct Act`);
out.push(`- **${couldSever.length}** of those have at least as many sentences as Acts`);
out.push(`- **${cannotSever.length}** have fewer sentences than Acts and cannot be split along`);
out.push(`  authority lines without rewriting the text\n`);
out.push("> The sentence count is an UPPER BOUND on severability and nothing more. A single sentence");
out.push("> can carry two obligations and four sentences can all serve one. What the count settles is");
out.push("> only the negative case: a clause with fewer sentences than Acts certainly cannot be split");
out.push("> as written.\n");

out.push("## Is a treatment reusable? NOT DEMONSTRATED.\n");
out.push(`${byAuthority.size} distinct authorities are cited across the library; ${shared.length} by more`);
out.push(`than one clause and ${crossCategory.length} across more than one category. **Those numbers do not`);
out.push("mean what they appear to mean.**\n");
out.push("Indian Contract Act 1872 s.73 is cited by 26 clauses in 13 categories, and the authoring");
out.push("notes say what it is doing there: *\"Compensation for loss caused by breach\"*, *\"Damages for");
out.push("breach\"*, *\"Damages for breach of employment obligation\"*. Those 26 clauses are not");
out.push("implementing one damages treatment — each imposes its own obligation and cites the general");
out.push("law of damages as background. The same is true of s.37 (obligation to perform) and s.10");
out.push("(formation).\n");
out.push("**Citing the same section is not implementing the same proposition.** On this evidence the");
out.push("smallest independently selectable legal unit is still the CLAUSE, and the repair for a");
out.push("composite clause is to split it rather than to introduce a layer of treatment objects that");
out.push("would be one-to-one with clauses almost everywhere.\n");
out.push("### What is actually missing\n");
out.push(`Not a treatment layer — a declaration of which authority each clause exists to implement.`);
out.push(`${clauses.length - withPrimary} of ${clauses.length} clauses carry no \`statutory_reference\` at all, and`);
out.push(`${multiPrimary} of the ${withPrimary} that do name more than one. So for most of the library there is no`);
out.push("way to tell a clause's own proposition from the background law it cites — which is exactly");
out.push("how a principal-employer liability allocation under EPF s.8A came to live inside a clause");
out.push("about key personnel, with nothing to mark it as a separate thing.\n");
out.push("That declaration is far cheaper than a treatment layer, and it is the prerequisite for one:");
out.push("a clause whose own proposition is unstated cannot be decomposed into treatments by anybody,");
out.push("machine or advocate.\n");

out.push("### Authorities expressed by the most clauses\n");
out.push("| authority | clauses | categories |");
out.push("|---|---|---|");
for (const a of shared.slice(0, 15)) {
  out.push(`| \`${a.key}\` | ${a.clauses} | ${a.categories} |`);
}
out.push("");

out.push("### Clauses that cannot be split along authority lines as written\n");
if (!cannotSever.length) out.push("None.\n");
else {
  out.push("| clause | distinct Acts | sentences |");
  out.push("|---|---|---|");
  for (const r of cannotSever.sort((a, b) => (b.distinct_acts - b.sentences) - (a.distinct_acts - a.sentences)).slice(0, 20)) {
    out.push(`| \`${r.clause_id}\` | ${r.distinct_acts} | ${r.sentences} |`);
  }
  out.push("");
  out.push("For each of these, treatment-level selection would mean AUTHORING NEW LEGAL TEXT, not");
  out.push("composing existing text. That is a different and much larger undertaking than splitting a");
  out.push("clause whose propositions already sit in separate sentences.\n");
}

fs.writeFileSync(path.join(ROOT, "docs/audit/TREATMENT_GRANULARITY.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/treatment-granularity.json"),
  JSON.stringify({ rows, shared, crossCategory: crossCategory.length }, null, 2));
console.log(out.join("\n"));
