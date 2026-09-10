/**
 * Which open positions are worth raising with the user?
 *
 * Run: node scripts/reportMaterialGaps.mjs
 */
import { analyseOpenPositions } from "../backend/services/materialityAnalysis.js";

const CASES = [
  ["CONSULTANCY_AGREEMENT", "Quick Form", {
    party_1_name: "Devraj Vishal Bhore", party_2_name: "Varun Raghunath Shastri",
    consulting_fee: "30000", contract_duration: "12 months",
    services_description: "Strategic advisory covering market entry.",
  }],
  ["RENTAL_AGREEMENT", "Quick Form", {
    party_1_name: "Ramesh Anant Kulkarni", party_2_name: "Sneha Vikram Deshpande",
    property_address: "Flat 4B, Sunshine Apartments, MG Road, Pune, Maharashtra 411001",
    occupancy_fee: "25000", security_deposit: "100000", occupancy_term: "11 months",
  }],
  ["VENDOR_AGREEMENT", "Quick Form", {
    party_1_name: "Ashwin Traders Private Limited", party_2_name: "Kesari Components LLP",
    goods_description: "Precision-machined brass fittings.", contract_value: "4500000",
  }],
];

const BADGE = {
  ASK: "ASK", DEFECT: "DEFECT ", DEFAULT_AND_DISCLOSE: "DEFAULT",
  ASK_IF_NEEDED: "MAYBE", IGNORE: "ignore",
};

let defects = 0;
for (const [type, mode, variables] of CASES) {
  const { positions, unreachable } = analyseOpenPositions({ documentType: type, variables });
  defects += unreachable.length;
  const asks = positions.filter((p) => p.disposition === "ASK").length;
  console.log(`\n━━ ${type} (${mode}) — ${positions.length} open, ${asks} would be asked`);
  for (const p of positions) {
    console.log(
      `  ${BADGE[p.disposition].padEnd(8)} ${p.flag.padEnd(34)} ` +
      `${p.classification.padEnd(19)} ${p.provenance}`
    );
    console.log(`           gates: ${p.clauseIds.join(", ")}`);
    console.log(`           ${p.reason}`);
  }
}

console.log(
  defects
    ? `\n${defects} flag(s) gate a clause that no intake field can ever reach. Fix those first.`
    : "\nNo unreachable gates."
);
