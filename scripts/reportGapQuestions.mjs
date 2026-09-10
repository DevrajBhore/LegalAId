/**
 * What would LegalAId actually ask, and what does each answer settle?
 * Run: node scripts/reportGapQuestions.mjs
 */
import { planGapQuestions } from "../backend/services/factQuestionPlanner.js";

const CASES = [
  ["CONSULTANCY_AGREEMENT", "Quick Form — bare facts", {
    party_1_name: "Devraj Vishal Bhore", party_2_name: "Varun Raghunath Shastri",
    consulting_fee: "30000", contract_duration: "12 months",
    services_description: "Strategic advisory covering market entry.",
  }],
  ["CONSULTANCY_AGREEMENT", "Full Form — scope names its outputs", {
    party_1_name: "Devraj Vishal Bhore", party_2_name: "Varun Raghunath Shastri",
    consulting_fee: "30000", contract_duration: "12 months",
    services_description: "Strategic advisory covering market entry and regulatory compliance.",
    deliverables: "Monthly strategy reports, quarterly workshops, and ad-hoc policy drafting.",
    acceptance_criteria: "Reports to follow the agreed template and cite sources.",
  }],
  ["VENDOR_AGREEMENT", "Quick Form — user is the buyer", {
    drafting_for: "Buyer",
    party_1_name: "Ashwin Traders Private Limited", party_2_name: "Kesari Components LLP",
    goods_description: "Precision-machined brass fittings.", contract_value: "4500000",
  }],
];

for (const [documentType, label, variables] of CASES) {
  const plan = planGapQuestions({ documentType, variables });
  const resolved = new Set([...plan.questions.flatMap((q) => q.resolves), ...plan.settled.map((s) => s.mechanism)]);
  const opening = plan.questions.filter((q) => q.stage === "opening");
  console.log(`\n━━ ${documentType} — ${label}`);
  console.log(`   questions address: the ${plan.counterparty}${plan.counterpartyAssumed ? "  (assumed — the user did not say which side they are on)" : ""}`);
  console.log(
    `   ${plan.openMechanisms.length} mechanisms open  →  ${opening.length} asked up front` +
    `${plan.questions.length > opening.length ? ` (+${plan.questions.length - opening.length} conditional)` : ""}` +
    `  →  ${resolved.size} resolved`
  );
  for (const q of plan.questions) {
    console.log(`\n   Q${q.stage === "follow-up" ? " (follow-up)" : ""}. ${q.question}`);
    console.log(`      settles: ${q.resolves.join(", ")}`);
    if (q.requires) console.log(`      only if: ${q.requires}`);
    if (q.confirming) console.log(`      pre-answered from ${q.confirming.evidence} — ${q.confirming.provenance}, so confirm before it counts`);
  }
  for (const s of plan.settled) {
    console.log(`   · ${s.factName} established from the intake — ${s.evidence} (${s.provenance}), so not asked`);
  }
  for (const d of plan.disclosures) {
    console.log(`   · disclosed: ${d.disclosure}`);
  }
  if (plan.unserved.length) console.log(`   ! no fact behind: ${plan.unserved.join(", ")}`);
}
