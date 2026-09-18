/**
 * probeCapMeasurement.mjs — D4.27: CAN THE CAP BE COMPUTED AT ALL?
 *
 * D4.26 refused to port the guarantee's interaction sentence because NDA and
 * FOUNDERS_AGREEMENT collect no consideration field, so a cap measured on "the
 * total consideration paid under this Agreement" has nothing to measure. The
 * finding is deeper than "do not copy the sentence":
 *
 *     BYTE-IDENTICAL CLAUSE TEXT IS NOT EVIDENCE OF SEMANTIC INTERCHANGEABILITY.
 *     The underlying measurement variable decides what the words do.
 *
 * That puts a question BEFORE the interaction question:
 *
 *     CAP_MEASUREMENT
 *         ├── measurable        → the interaction decision may be meaningful
 *         └── unmeasurable      → the interaction decision is BLOCKED
 *
 * Asking whether the indemnity consumes a ceiling that cannot be computed is
 * asking an advocate to order a clause against a quantity that does not exist.
 *
 * This probe establishes whether that is a two-family defect or a portfolio one,
 * by extracting what each cap SAYS it measures and checking the intake for a
 * quantity that could supply it. It classifies and modifies nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
const say = (s = "") => { lines.push(s); console.log(s); };

const CAP_CLAUSES = [
  "CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001",
  "CORE_LIABILITY_LIMIT_FALLBACK_001", "GUARANTEE_OBLIGATION_001",
];

/*
 * What a cap says it measures, and what in the intake could supply it. The
 * mapping is deliberately explicit rather than a fuzzy keyword match: a measure
 * is satisfied by a NAMED field, so a family either collects the quantity or it
 * does not, and the answer does not depend on how generously a regex is written.
 */
const MEASURES = [
  /*
   * THE FIRST RUN OF THIS LIST WAS TOO NARROW AND PRODUCED FALSE POSITIVES.
   * SOFTWARE_DEVELOPMENT_AGREEMENT collects `total_fee` and SUPPLY_AGREEMENT
   * collects `price`; both were reported UNMEASURABLE because the list did not
   * name them. A detector whose vocabulary decides the finding is the D4.22
   * failure again, so the list is now derived from what the schemas actually
   * hold rather than from what seemed likely.
   */
  { phrase: /total consideration paid under this Agreement/i, name: "total consideration paid",
    satisfied_by: ["contract_value", "total_consideration", "consideration", "fees", "fee_amount",
      "service_fee", "rent_amount", "license_fee", "salary", "loan_amount", "purchase_price",
      "monthly_fee", "project_cost", "annual_value", "total_fee", "price", "total_value"] },
  { phrase: /aggregate fees paid or payable under this Agreement/i, name: "aggregate fees paid or payable",
    satisfied_by: ["fees", "fee_amount", "service_fee", "monthly_fee", "contract_value",
      "project_cost", "consulting_fee", "retainer_amount", "total_fee", "price", "total_value"] },
  { phrase: /shall not exceed ₹|shall not exceed the (?:sum|amount) of/i, name: "a stated rupee figure",
    satisfied_by: ["liability_cap_amount", "guaranteed_amount", "guarantee_amount"] },
];

const baseline = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8"));

const results = [];
for (const type of Object.keys(baseline.types)) {
  const ids = new Set(Object.values(baseline.types[type] || {}).flatMap((l) => l?.clauses || []));
  const capIds = CAP_CLAUSES.filter((c) => ids.has(c));
  if (!capIds.length) continue;

  let r;
  try {
    r = await generateDocument({
      document_type: type, variables: variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED }),
    });
  } catch { continue; }
  const clauses = r?.draft?.clauses || [];
  const fields = new Set(Object.keys(getVariables(type) || {}));

  for (const capId of capIds) {
    const text = clauses.find((c) => c.clause_id === capId)?.text || "";
    if (!text) continue;
    const measure = MEASURES.find((m) => m.phrase.test(text));
    const supplying = measure ? measure.satisfied_by.filter((f) => fields.has(f)) : [];
    let verdict;
    if (!measure) verdict = "NO_STATED_MEASURE";
    else if (supplying.length) verdict = "MEASURABLE";
    else verdict = "UNMEASURABLE";
    results.push({ type, capId, measure: measure?.name || "(none recognised)", supplying, verdict });
  }
}

/* ── A FINDING I RETRACTED BEFORE RECORDING IT ───────────────────────────── */
//
// Correcting the field list turned up what looked like a worse defect: ten
// families collect `liability_cap_amount` — a rupee figure the user types — while
// the shipped clause states a formula instead, so the number never reaches the
// page. That is the D4.14 class of failure, and it would have been a serious
// find.
//
// IT IS NOT A DEFECT. draftConsistencyValidator.js already reports it as
// LIABILITY_CAP_ANSWERS_CONFLICT: the user also chose a BASIS, the clause follows
// the basis, and the validator says in terms that the figure has not been used.
// Verified by generating three of the ten and reading the validation output.
//
// Recorded here because the retraction is the useful part. The probe was one step
// from reporting correct behaviour as a bug, and the thing that stopped it was
// checking whether the system already said so rather than assuming silence.

/* ── IS THE OFFERED CAP BASIS ONE THE FAMILY CAN SUPPLY? ─────────────────── */
//
// The real question underneath. A family may offer "Fees paid or payable in the
// 12 months before the claim" as a cap basis while collecting no fee of any kind,
// because partners and shareholders do not pay fees to one another under the
// deed. Then the user selects a basis the instrument cannot compute, and the
// system faithfully renders a ceiling measured on nothing.

/*
 * THE THIRD VOCABULARY DEFECT IN THIS PROBE, AND THE LAST.
 *
 * This audit first asked "does the family collect a FEE?" using a fee-specific
 * regex, and classified COMMERCIAL_LEASE_AGREEMENT, EMPLOYMENT_CONTRACT,
 * LEAVE_AND_LICENSE_AGREEMENT and GUARANTEE_AGREEMENT as having nothing to
 * measure — when their caps measure "total consideration paid" and the intake
 * supplies rent, salary, licence fee and the guaranteed amount respectively.
 *
 * Every time this phase has written a word list, the word list has been wrong.
 * So the measurability question is no longer asked twice: it is taken from the
 * per-instance verdict already computed above, against the measure the clause
 * itself names. The only new question here is whether the family OFFERS a basis
 * it cannot supply, which is a different failure and needs the options list.
 */
const measurableTypes = new Set(results.filter((r) => r.verdict === "MEASURABLE").map((r) => r.type));
const basisAudit = [];
for (const type of [...new Set(results.map((r) => r.type))]) {
  const schema = getVariables(type) || {};
  const basis = schema.liability_cap_basis;
  const measurable = measurableTypes.has(type);
  const offersFeeBasis = Boolean(basis) && (basis.options || []).some((o) => /fee/i.test(o));
  basisAudit.push({
    type, hasBasisQuestion: Boolean(basis), offersFeeBasis, measurable,
    state: !basis ? (measurable ? "FIXED_PROSE_MEASURABLE" : "FIXED_PROSE_UNMEASURABLE")
      : offersFeeBasis && !measurable ? "OFFERS_A_BASIS_IT_CANNOT_SUPPLY"
      : "CONFIGURABLE_AND_SUPPLIED",
  });
}

say("");
say("## Can the family supply the cap basis it offers?\n");
say("Two different failures live here and they need different repairs.\n");
say("| state | families | meaning |");
say("|---|---|---|");
for (const st of ["CONFIGURABLE_AND_SUPPLIED", "OFFERS_A_BASIS_IT_CANNOT_SUPPLY",
  "FIXED_PROSE_MEASURABLE", "FIXED_PROSE_UNMEASURABLE"]) {
  const hit = basisAudit.filter((b) => b.state === st);
  const meaning = {
    CONFIGURABLE_AND_SUPPLIED: "the user picks a basis and the intake holds the quantity",
    OFFERS_A_BASIS_IT_CANNOT_SUPPLY: "**the form offers a fees basis and collects no fee**",
    FIXED_PROSE_MEASURABLE: "no basis question, but the clause's measure is collected anyway",
    FIXED_PROSE_UNMEASURABLE: "**no basis question and nothing to measure** — the D4.26 case",
  }[st];
  say(`| ${st} | ${hit.length} | ${meaning} |`);
}
say("");
for (const st of ["OFFERS_A_BASIS_IT_CANNOT_SUPPLY", "FIXED_PROSE_UNMEASURABLE"]) {
  const hit = basisAudit.filter((b) => b.state === st);
  if (!hit.length) continue;
  say(`**${st}**: ${hit.map((h) => `\`${h.type}\``).join(", ")}`);
  say("");
}

/* ── report ──────────────────────────────────────────────────────────────── */

const by = (v) => results.filter((r) => r.verdict === v);
say("# D4.27 — can the liability cap be computed?\n");
say(`Cap instances across the portfolio: **${results.length}** in ${new Set(results.map((r) => r.type)).size} document types.\n`);
say("| verdict | instances | meaning |");
say("|---|---|---|");
say(`| MEASURABLE | ${by("MEASURABLE").length} | the intake collects a quantity the cap's own words can read |`);
say(`| **UNMEASURABLE** | **${by("UNMEASURABLE").length}** | the cap names a measure the family never collects |`);
say(`| NO_STATED_MEASURE | ${by("NO_STATED_MEASURE").length} | the cap's phrasing was not recognised — reported, not assumed safe |`);

say("\n## UNMEASURABLE — a ceiling with nothing to compute it from\n");
say("| document type | cap clause | says it measures |");
say("|---|---|---|");
for (const r of by("UNMEASURABLE").sort((a, b) => a.type.localeCompare(b.type))) {
  say(`| \`${r.type}\` | ${r.capId} | "${r.measure}" |`);
}

say("\n## MEASURABLE — the interaction question can sensibly be asked here\n");
say("| document type | cap clause | measured by |");
say("|---|---|---|");
for (const r of by("MEASURABLE").sort((a, b) => a.type.localeCompare(b.type))) {
  say(`| \`${r.type}\` | ${r.capId} | \`${r.supplying.join("`, `")}\` |`);
}

if (by("NO_STATED_MEASURE").length) {
  say("\n## NO_STATED_MEASURE — reported rather than cleared\n");
  say("The probe did not recognise the measure phrase. That is a fact about this probe as much as");
  say("about the clause, and it is shown rather than folded into MEASURABLE — the D4.22 rule that");
  say("absence of a signal is not evidence of absence applies to this probe too.\n");
  for (const r of by("NO_STATED_MEASURE")) say(`- \`${r.type}\` / ${r.capId}`);
}

/* ── the hierarchy ───────────────────────────────────────────────────────── */

const blocked = [...new Set(by("UNMEASURABLE").map((r) => r.type))];
say("\n## Reading\n");
say(`**${by("UNMEASURABLE").length} of ${results.length} cap instances cannot be computed**, across`);
say(`${blocked.length} document types. This is not confined to the two families D4.26 happened to`);
say("examine, and it is not caused by the N-party work or by the indemnity interaction — it is a");
say("defect in the cap standing alone.");
say("");
say("So the order of questions is forced, and it is not a preference:");
say("");
say("```");
say("CAP_MEASUREMENT");
say("    ├── measurable   → the interaction decision may be meaningful");
say("    └── unmeasurable → the interaction decision is BLOCKED");
say("```");
say("");
say("Asking an advocate whether the indemnity consumes a ceiling that cannot be computed is asking");
say("them to order a clause against a quantity that does not exist. The answer would be recorded,");
say("would look like progress, and would mean nothing.");
say("");
say("**A ceiling that cannot be computed is not a limitation of liability.** It is an unresolved");
say("reference, and on an ordinary reading a court would have to supply the missing term or treat");
say("the limitation as ineffective — which is the opposite of what the party relying on it expects.");

fs.writeFileSync(path.join(ROOT, "docs/audit/CAP_MEASUREMENT.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "docs/audit/cap-measurement.json"), JSON.stringify(results, null, 1));
console.log("\nwritten: docs/audit/CAP_MEASUREMENT.md + cap-measurement.json");
