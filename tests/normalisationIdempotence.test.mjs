/**
 * normalisationIdempotence.test.mjs — D4.49
 *
 * NORMALISATION_NOT_IDEMPOTENT, recorded in D4.47: the NDA shipped "the
 * Recipient" and the Software Development Agreement "the Licensor" and "the
 * Licensee", none of them defined, and a second normalisation pass turned the
 * loan's "Principal sum" into "Borrower sum".
 *
 * The cause, measured: normalizeClauseBody capitalised role ALIASES as well as
 * canonical roles. A renderer's lower-case "the recipient" or "a principal sum"
 * came out of one pass as a capitalised alias ("the Recipient", "a Principal
 * sum"), which a second pass then replaced. The normaliser manufactured the words
 * it exists to remove. It was not, as D4.47 supposed, text inserted after
 * normalisation: the trace showed every one of these words created by the first
 * pass itself. Across the library the same rule made eight clauses
 * non-idempotent, among them "as if the Intern were an Intern" and "a
 * Distributor-seller basis".
 *
 * Proven here, in order: the frozen defect; regression (each frozen case is now
 * stable and reads correctly); positive (canonical roles are still capitalised
 * and aliases still replaced); negative (a lower-case alias is left as written);
 * boundary (proper names and compound terms are untouched); and idempotence over
 * every library clause and every generated document.
 */
import assert from "node:assert";
import fs from "fs";

const { normalizeClauseBody, normalizeClauseTitle, normalizeClauseText } = await import("../backend/services/clauseQualityNormalizer.js");
const { getAllClauses } = await import("../backend/services/clauseAssembler.js");
const { generateDocument } = await import("../backend/services/documentService.js");
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/normalisation.D4_49.json", import.meta.url), "utf8"));
const TYPES = Object.keys(DOCUMENT_CONFIG);
const body = (text, documentType) => normalizeClauseBody(text, { documentType });

/* ── 1. The frozen defect ─────────────────────────────────────────────────── */
const shippedCases = FROZEN.shipped_clauses_a_second_pass_changes;
ok(shippedCases.length === 8 && FROZEN.library_clauses_not_idempotent.length === 8,
  "frozen: 8 shipped clauses a second pass changed, 8 library clauses not idempotent");
const loanCase = shippedCases.find((c) => c.clause_id === "LOAN_AMOUNT_001");
ok(/a Principal sum of/.test(loanCase.shipped_text) && /a Borrower sum of/.test(loanCase.after_a_second_pass),
  "frozen: the loan shipped 'a Principal sum', and a second pass made it 'a Borrower sum'");
ok(/the Recipient remaining responsible/.test(shippedCases.find((c) => c.clause_id === "NDA_DISCLOSURE_PERMITTED_001").shipped_text),
  "frozen: the NDA shipped 'the Recipient', a term it never defines");
ok(/the Licensor grants the Licensee/.test(shippedCases.find((c) => c.clause_id === "IP_LICENSE_001").shipped_text),
  "frozen: the Software Development Agreement shipped 'the Licensor' and 'the Licensee'");
ok(FROZEN.library_clauses_not_idempotent.some((c) => /as if the Intern were an Intern/.test(c.twice)),
  "frozen: across the library, a second pass wrote 'as if the Intern were an Intern'");

/* ── 2. Regression: the frozen documents, regenerated ─────────────────────── */
const generated = new Map();
const gen = async (type, profile) => {
  const key = `${type}::${profile}`;
  if (!generated.has(key)) generated.set(key, (await generateDocument({ document_type: type, variables: variablesFor(type, { profile }) })).draft);
  return generated.get(key);
};
for (const c of shippedCases) {
  const draft = await gen(c.document_type, c.profile);
  const clause = draft.clauses.find((x) => x.clause_id === c.clause_id);
  const again = normalizeClauseText(draft).clauses.find((x) => x.clause_id === c.clause_id);
  ok(clause && again.text === clause.text, `${c.document_type} (${c.profile}) ${c.clause_id}: a second pass now changes nothing`);
}
const loanText = (await gen("LOAN_AGREEMENT", FIXTURE_PROFILE.WELL_FILLED)).clauses.find((c) => c.clause_id === "LOAN_AMOUNT_001").text;
ok(/a principal sum of/.test(loanText) && !/Borrower sum|Principal sum/.test(loanText) && /\('Principal Amount'\)/.test(loanText),
  "loan: reads 'a principal sum of', and its defined 'Principal Amount' is intact");
const ndaText = (await gen("NDA", FIXTURE_PROFILE.WELL_FILLED)).clauses.map((c) => c.text).join("\n");
ok(!/\bthe Recipient\b/.test(ndaText) && /the recipient remaining responsible/.test(ndaText),
  "NDA: no undefined 'the Recipient'; the generic lower-case word stays as written");
const sdaText = (await gen("SOFTWARE_DEVELOPMENT_AGREEMENT", FIXTURE_PROFILE.WELL_FILLED)).clauses.map((c) => c.text).join("\n");
ok(!/\b(Licensor|Licensee)\b/.test(sdaText) && /the licensor grants the licensee/.test(sdaText),
  "Software Development Agreement: no undefined 'Licensor' or 'Licensee'");
for (const c of FROZEN.library_clauses_not_idempotent) {
  const clause = getAllClauses().find((x) => x.clause_id === c.clause_id);
  const once = body(clause.text, c.document_type);
  ok(body(once, c.document_type) === once, `library ${c.document_type} ${c.clause_id}: idempotent`);
}
ok(!/were an Intern\b/.test(body(getAllClauses().find((c) => c.clause_id === "EMP_INTERNSHIP_ENGAGEMENT_001").text, "INTERNSHIP_AGREEMENT")),
  "the internship clause no longer reads 'as if the Intern were an Intern'");

/* ── 3. Positive: what the normaliser is for still happens ─────────────────── */
ok(body("The receiving party shall keep it secret.", "NDA") === "The Receiving Party shall keep it secret.",
  "a canonical role in lower case is capitalised ('the receiving party' -> 'the Receiving Party')");
ok(body("The Recipient shall keep it secret.", "NDA") === "The Receiving Party shall keep it secret.",
  "a capitalised alias is still replaced by the canonical role");
ok(body("The Licensor warrants title.", "SOFTWARE_DEVELOPMENT_AGREEMENT") === "The Developer warrants title.",
  "a capitalised alias in another family is still replaced");

/* ── 4. Negative: a lower-case alias is ordinary English ──────────────────── */
ok(body("The Borrower agrees to borrow a principal sum of Rs. 10.", "LOAN_AGREEMENT") === "The Borrower agrees to borrow a principal sum of Rs. 10.",
  "'a principal sum' is not the Borrower");
ok(body("The parties act on a buyer-seller basis.", "DISTRIBUTION_AGREEMENT") === body(body("The parties act on a buyer-seller basis.", "DISTRIBUTION_AGREEMENT"), "DISTRIBUTION_AGREEMENT") &&
   !/Distributor-seller|Buyer-seller/.test(body("The parties act on a buyer-seller basis.", "DISTRIBUTION_AGREEMENT")),
  "'a buyer-seller basis' is not rewritten into a role");

/* ── 5. Boundary: names and compound terms ────────────────────────────────── */
ok(body("Northbridge Seed Fund LLP is the Investor.", "TERM_SHEET").includes("Northbridge Seed Fund LLP"), "a party's name containing an alias is untouched");
ok(body("The Principal Amount is payable on demand.", "LOAN_AGREEMENT").includes("Principal Amount"), "the defined 'Principal Amount' is untouched");
ok(body("The Data Principal may withdraw consent.", "DATA_PROCESSING_AGREEMENT").includes("Data Principal"), "the statutory 'Data Principal' is untouched");
ok(body("See https://alpha.example/terms and contact@alpha.example.", "PRIVACY_POLICY").includes("https://alpha.example/terms") &&
   body("See https://alpha.example/terms and contact@alpha.example.", "PRIVACY_POLICY").includes("contact@alpha.example"), "web addresses are untouched");

/* ── 6. Idempotence, everywhere ───────────────────────────────────────────── */
let n = 0;
const notIdempotent = [];
for (const c of getAllClauses()) {
  const forTypes = (c.document_types || []).filter((t) => TYPES.includes(t));
  for (const documentType of (forTypes.length ? forTypes : TYPES)) {
    for (const [f, src] of [[normalizeClauseBody, c.text], [normalizeClauseTitle, c.title]]) {
      if (!src) continue;
      n++;
      const once = f(src, { documentType });
      if (f(once, { documentType }) !== once) notIdempotent.push(`${documentType}/${c.clause_id}`);
    }
  }
}
ok(n > 8000 && notIdempotent.length === 0, `every library clause and title, under every type that uses it, is idempotent (${n} normalisations; ${notIdempotent.slice(0, 5).join(", ") || "none failed"})`);

const unstable = [];
let documents = 0;
for (const type of TYPES) {
  for (const profile of [FIXTURE_PROFILE.WELL_FILLED, FIXTURE_PROFILE.MINIMAL_DECLINED]) {
    const draft = await gen(type, profile);
    if (!draft) continue;
    documents++;
    const again = normalizeClauseText(draft);
    for (const c of draft.clauses) {
      const a = again.clauses.find((x) => x.clause_id === c.clause_id);
      if (!a || a.text !== c.text || a.title !== c.title) unstable.push(`${type}/${profile}/${c.clause_id}`);
    }
  }
}
ok(documents === 58, `58 generated documents (29 types x 2 worlds) (${documents})`);
ok(unstable.length === 0, `a second normalisation pass changes no clause of any generated document (${unstable.slice(0, 5).join(", ") || "none"})`);

console.log(`\nnormalisationIdempotence: ${checks} checks passed`);
process.exit(0);
