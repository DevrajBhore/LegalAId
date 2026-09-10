/**
 * Does the document respond to what the user said they wanted?
 *
 * The clause baseline (scripts/freezeClauseBaseline.mjs) asks whether a document
 * type still emits the clauses it emitted yesterday. That is continuity. This
 * asks a different question: hold the deal constant, change only the objectives
 * the user ticked on the "What You Want This To Do" step, and see whether the
 * document changes at all.
 *
 * It is the measure behind the complaint that started this work -- that every
 * document came out the same, full of boilerplate and empty of anything the
 * user had actually asked for. A document type that returns the same clause set
 * for every objective set has no intent layer, whatever its intake collects.
 *
 * Run: node scripts/measureIntentResponse.mjs
 */
import { generateDocument } from "../backend/services/documentService.js";

const VENDOR = {
  party_1_name: "Ashwin Traders Private Limited", party_1_type: "Private Limited Company",
  party_2_name: "Kesari Components LLP", party_2_type: "LLP",
  goods_description: "Precision-machined brass fittings, grades BF-12 and BF-18, to drawing rev. 4.",
  delivery_terms: "Delivery ex-works Pune within 21 days of a purchase order.",
  payment_terms: "Net 30 days from invoice.",
  contract_value: "4500000", warranty_period: "12 months",
  quantity: "5000 units per annum", price: "900",
  effective_date: "2026-09-01", operating_state: "Maharashtra", execution_city: "Pune",
  contract_duration: "24 months",
};

const CONSULT = {
  party_1_name: "Devraj Vishal Bhore", party_1_type: "Individual",
  party_2_name: "Varun Raghunath Shastri", party_2_type: "Individual",
  consulting_services: "Strategic advisory covering market entry and regulatory compliance.",
  services_description: "Strategic advisory covering market entry and regulatory compliance.",
  consulting_fee: "30000", effective_date: "2026-08-21",
  operating_state: "Maharashtra", execution_city: "Pune",
  deliverables: "Monthly strategy reports and quarterly workshops.",
  payment_terms: "Rs. 30,000 per month, invoiced monthly in arrears, payable within 30 days.",
  contract_duration: "12 months",
};

// The intake auto-fill below exists so a missing unrelated field cannot be read
// as an intent-layer failure. It fills only what the form refuses to proceed
// without, and never touches protect_against.
async function gen(type, base, picks) {
  const V = { ...base };
  if (picks.length) V.protect_against = picks.join(", ");
  let r;
  for (let i = 0; i < 20; i += 1) {
    r = await generateDocument({ document_type: type, variables: V });
    if (r?.draft) break;
    const m = String(r?.error || "").match(/Missing required field: (\w+)/);
    if (!m) return { err: String(r?.error).slice(0, 200) };
    V[m[1]] = /fee|amount|value|rent|price|quantity/.test(m[1]) ? "30000" : "TO BE SUPPLIED";
  }
  if (!r?.draft) return { err: "no draft produced" };
  return { ids: r.draft.clauses.map((c) => c.clause_id) };
}

const RUNS = [
  ["VENDOR_AGREEMENT", VENDOR, [
    [],
    ["Late or missed delivery", "Defective or poor-quality goods"],
    ["Confidentiality breaches", "Third-party or regulatory claims", "The vendor walking away early"],
    ["Price increases during the term"],
  ]],
  ["CONSULTANCY_AGREEMENT", CONSULT, [
    [],
    ["Losing ownership of what I pay for", "The consultant working for a competitor"],
    ["Missed deadlines or slow delivery", "Costs creeping beyond the quoted fee"],
    ["Work not meeting the agreed standard", "The consultant leaving mid-project"],
  ]],
];

let inert = 0;
for (const [type, base, sets] of RUNS) {
  console.log(`\n━━ ${type}`);
  const results = [];
  for (const picks of sets) results.push(await gen(type, base, picks));
  if (results[0].err) { console.log("  ERR (no-objectives baseline):", results[0].err); inert += 1; continue; }
  const baseline = new Set(results[0].ids);
  let responded = 0;
  sets.forEach((picks, i) => {
    const r = results[i];
    const label = picks.length ? picks.join(" + ") : "nothing ticked";
    if (r.err) return console.log(`  ERR ${label}: ${r.err}`);
    const added = r.ids.filter((x) => !baseline.has(x));
    if (i && added.length) responded += 1;
    console.log(`  ${String(r.ids.length).padStart(3)} clauses  ${label}`);
    if (i) console.log(`       + ${added.join(", ") || "(nothing -- this objective changes no clause)"}`);
  });
  if (!responded) inert += 1;
}

console.log(
  inert
    ? `\n${inert} document type(s) ignore the objectives entirely.`
    : "\nEvery document type measured responds to the objectives."
);
process.exit(inert ? 1 : 0);
