/**
 * probeRenderedAssertion.mjs — PHASE D4.7
 *
 * WHAT UNIT OWNS THE PROPOSITION ASSERTION?
 *
 * D4.6 found that `implements` is annotated on a CLAUSE ID while the emitted text
 * is conditionally rendered. `PROP_REGISTRATION_001` renders as "the term of this
 * Agreement of 24 months being such as to attract Section 17(1)(d)" in one family
 * and "the term of this Agreement of 3 months being within the threshold ...
 * registration of this Agreement is not compulsory" in another. The same id
 * asserts a proposition in one document and negates it in another.
 *
 * The candidate repairs have materially different architectural costs — annotate
 * rendering variants, or split into separate clauses — so the instruction is to
 * MEASURE THE LIBRARY BEFORE DESIGNING ANYTHING. That is all this does.
 *
 * THE MEASUREMENT. Generate every family across many worlds, collect each clause
 * id's distinct rendered texts, and classify how they differ:
 *
 *   VALUE_ONLY        the same sentences with different values substituted —
 *                     names, amounts, dates. Benign: the proposition asserted is
 *                     unchanged, which is the whole point of interpolation.
 *
 *   SENTENCE_SET      whole sentences appear or disappear between worlds. This is
 *                     SUB-CLAUSE CONDITIONALITY, and its existence is the finding
 *                     that matters: the engine is already selecting legal content
 *                     BELOW clause granularity, and the proposition layer cannot
 *                     see it. D4.5 concluded the model could not express
 *                     concurrent sub-clause propositions; if this class is
 *                     populated, the model expresses them and does not know it.
 *
 *   POLARITY          a rendering contains a negation of what another rendering
 *                     asserts. The registration case. This is the class that can
 *                     make an `implements` annotation actively false.
 *
 * WHY THE CLASSES ARE REPORTED SEPARATELY AND NOT SCORED. A clause in
 * SENTENCE_SET is not thereby defective — a payment clause that adds a GST
 * sentence when GST applies is correct, and correct in a way that a split into
 * two clauses would make worse. What the count establishes is which unit the
 * library actually uses to carry a legal assertion, which is the question asked.
 *
 * POLARITY DETECTION IS A HEURISTIC AND IS LABELLED AS ONE. It looks for negation
 * near a legal-obligation verb. It will over-report ("shall not disclose" is a
 * negation and an assertion), so every hit is listed with its text for reading
 * rather than counted into a total that would look authoritative.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Sentence split that does not break on "s.43" or "1952." */
function sentences(text) {
  return String(text || "")
    .replace(/\b(s|ss|No|Rs|Sch|Art|cl|para|Ltd|Pvt|Co|Inc|v|vs)\.\s*/gi, "$1<D> ")
    .replace(/\b(\d)\.(\d)/g, "$1<D>$2")
    .split(/(?<=[.;])\s+(?=[A-Z(])/)
    .map((s) => s.replace(/<D>/g, ".").trim())
    .filter((s) => s.length > 20);
}

/**
 * Strip interpolated values so two renderings compare structurally.
 *
 * Spelled-out numerals are stripped as well as digits. Without that, "three (3)
 * years" and "five (5) years" look like different sentences and every value
 * change is misread as a structural one — which is exactly how the first run of
 * this probe reported VALUE_ONLY as zero and put all 28 pairs in the alarming
 * class.
 */
const WORD_NUMBER = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred|thousand|lakh|crore)\b/gi;
const skeleton = (s) => s
  .replace(/\b\d[\d,]*(\.\d+)?\b/g, "#")
  .replace(WORD_NUMBER, "#")
  .replace(/\b(?:INR|Rs\.?|₹)\s*#/gi, "#")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

/** A sentence that enumerates — the shape a cross-reference list takes. */
const isList = (s) => (s.match(/,/g) || []).length >= 3;

const NEGATION = /\b(not compulsor|not required|is not|shall not be required|no .{0,20}(is|shall be) required|does not apply|not applicable|without the need)/i;

async function render(documentType, variables) {
  try {
    const r = await generateDocument({ document_type: documentType, variables });
    const list = r.draft?.clauses || [];
    return list.length ? list : null;
  } catch { return null; }
}

const rows = [];
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY).sort()) {
  let base;
  try { base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }); }
  catch { continue; }

  const schema = getVariables(documentType) || {};
  const worlds = [base];
  for (const [field, def] of Object.entries(schema)) {
    if (def.type !== "select" || !Array.isArray(def.options)) continue;
    const no = optionMeaning(def, POSITION.FALSE);
    if (no !== null) worlds.push({ ...base, [field]: no });
  }

  /** clause id -> set of rendered texts seen */
  const seen = new Map();
  for (const variables of worlds) {
    const clauses = await render(documentType, variables);
    if (!clauses) continue;
    for (const c of clauses) {
      if (!seen.has(c.clause_id)) seen.set(c.clause_id, new Set());
      seen.get(c.clause_id).add(c.text || "");
    }
  }

  for (const [clauseId, texts] of seen) {
    if (texts.size < 2) continue;
    const list = [...texts];
    /*
     * Compare SETS of sentence skeletons, not a joined string. Two renderings
     * that contain the same sentences in the same shape differ only inside
     * sentences; one whose sentence set strictly contains another's has gained a
     * sentence, which is the sub-clause conditionality being hunted.
     */
    const sets = list.map((t) => new Set(sentences(t).map(skeleton)));
    const union = new Set(sets.flatMap((x) => [...x]));
    const intersection = [...union].filter((x) => sets.every((s) => s.has(x)));

    /*
     * The first version asked whether each set contained SOME other set, which
     * every set satisfies by containing itself — so `nested` was vacuously true
     * and everything landed in SENTENCE_ADDED, including a clause whose two
     * renderings both have exactly two sentences. A predicate that cannot return
     * false is not a classifier.
     *
     * The honest test: one rendering is a strict superset of all the others, so
     * the union is exactly the largest set.
     */
    const allEqual = sets.every((a) => a.size === union.size);
    const largest = Math.max(...sets.map((a) => a.size));
    const nested = !allEqual && union.size === largest
      && sets.every((a) => [...a].every((x) => union.has(x)));

    const differing = [...union].filter((x) => !intersection.includes(x));
    let klass;
    if (allEqual) klass = "VALUE_ONLY";
    else if (nested) klass = "SENTENCE_ADDED";
    else if (differing.length && differing.every(isList)) klass = "LIST_MEMBERSHIP";
    else klass = "SENTENCE_REPLACED";

    const polarity = list.some((t) => NEGATION.test(t)) && list.some((t) => !NEGATION.test(t));
    rows.push({
      documentType, clauseId, renderings: texts.size, klass, polarity,
      sentenceCounts: [...new Set(list.map((t) => String(sentences(t).length)))].sort(),
      samples: polarity ? list.slice(0, 2).map((t) => t.slice(0, 200)) : [],
    });
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

const out = [];
const KLASSES = ["VALUE_ONLY", "LIST_MEMBERSHIP", "PHRASE_CHANGE", "SENTENCE_ADDED", "SENTENCE_REPLACED"];
const MEANING = {
  VALUE_ONLY: "identical sentences, different interpolated values — interpolation working as intended",
  LIST_MEMBERSHIP: "a cross-reference list tracking which other clauses are in the document",
  PHRASE_CHANGE: "wording inside a sentence changes, and it is not a list",
  SENTENCE_ADDED: "one rendering contains every sentence of another plus more — sub-clause conditionality",
  SENTENCE_REPLACED: "sentences are exchanged rather than added",
};
const polar = rows.filter((r) => r.polarity);

out.push("# Phase D4.7 — which unit owns the proposition assertion?\n");
out.push("`implements` is annotated on a clause id; the emitted text is conditionally rendered. Before");
out.push("choosing between annotating rendering variants and splitting clauses, this measures what the");
out.push("library actually does. No design decision is taken here.\n");
out.push("**The first run of this probe was wrong and the correction is instructive.** It stripped");
out.push("digits but not spelled-out numerals, so \"three (3) years\" and \"five (5) years\" read as");
out.push("structurally different sentences. VALUE_ONLY came back as zero and all 28 pairs landed in the");
out.push("alarming class — a filter matching more than it meant, inflating exactly the number that");
out.push("would have justified a new architectural layer.\n");

out.push("## How clause text varies across worlds\n");
out.push("| class | pairs | distinct clauses | what it means |");
out.push("|---|---|---|---|");
for (const k of KLASSES) {
  const set = rows.filter((r) => r.klass === k);
  if (!set.length) continue;
  const bold = (k === "SENTENCE_ADDED" || k === "SENTENCE_REPLACED") ? "**" : "";
  out.push(`| ${bold}${k}${bold} | ${bold}${set.length}${bold} | ${new Set(set.map((r) => r.clauseId)).size} | ${MEANING[k]} |`);
}
out.push("");

const structural = rows.filter((r) => r.klass === "SENTENCE_ADDED" || r.klass === "SENTENCE_REPLACED");
const listy = rows.filter((r) => r.klass === "LIST_MEMBERSHIP");
if (listy.length) {
  out.push("**LIST_MEMBERSHIP is the engine maintaining coherence below clause granularity, and it is");
  out.push("correct.** `CORE_SURVIVAL_001` drops \"indemnity\" from its survival list when the indemnity");
  out.push("clause is declined. Nothing is wrong there — but it does mean a clause's rendered text");
  out.push("already depends on which OTHER clauses were selected, which no annotation records.\n");
}
if (structural.length) {
  out.push("### Clauses whose sentence set changes with the facts\n");
  out.push("| family | clause | class | renderings | sentence counts |");
  out.push("|---|---|---|---|---|");
  for (const r of structural) {
    out.push(`| ${r.documentType} | \`${r.clauseId}\` | ${r.klass} | ${r.renderings} | ${r.sentenceCounts.join(" / ")} |`);
  }
  out.push("");
  out.push("These are the clauses where a legal assertion genuinely enters or leaves the text without");
  out.push("the clause id changing — the unit that owns the assertion is smaller than the clause.\n");
} else {
  out.push("**No clause gains or loses a sentence across any world.** On this evidence the clause id");
  out.push("remains the unit that owns the proposition assertion, and the registration case is a");
  out.push("different phenomenon from sub-clause conditionality.\n");
}

out.push("## Polarity candidates — heuristic, listed not scored\n");
out.push("Renderings where one form contains a negation the other does not. The detector looks for");
out.push("negation near an obligation verb and WILL over-report: \"shall not disclose\" is a negation");
out.push("and also an assertion. So each is printed for reading rather than counted into a total that");
out.push("would look more authoritative than it is.\n");
if (!polar.length) out.push("None found.\n");
for (const r of polar) {
  out.push(`- **${r.documentType} / \`${r.clauseId}\`**`);
  for (const s of r.samples) out.push(`  - "${s.replace(/\s+/g, " ")}…"`);
}
out.push("");

fs.writeFileSync(path.join(ROOT, "docs/audit/RENDERED_ASSERTION.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/rendered-assertion.json"), JSON.stringify(rows, null, 2));
console.log(out.join("\n"));
