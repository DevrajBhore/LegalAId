/**
 * THE PRIVACY POLICY ADVERSARIAL MATRIX — run BEFORE authoring requirements.
 *
 * Hypothesis: a document can be internally coherent and still make an
 * unverified claim about reality.
 *
 * Method, as with the POA: write the five cases first, run them through the
 * model AS IT EXISTS, and record what it does. If EXTERNAL_COHERENCE already
 * expresses them, no new abstraction is needed and none will be authored.
 *
 * Run: node scripts/probePrivacyMatrix.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  assessRequirements, loadDocumentRequirements, findingFor,
} from "../backend/services/documentRequirements.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBE = path.join(ROOT, "knowledge-base/documents/requirements/__privacyprobe.requirements.json");

// Modelled with the tools that exist today: the actual behaviour of the service
// treated as an "external instrument" whose provisions are facts about the world.
const doc = {
  // Probe-only type. The loader refuses a __*.json file that declares a real
  // family, because keyed by document_type it would replace that family's
  // authored requirements while the probe runs.
  document_type: "__PRIVACY_MATRIX_PROBE",
  requirements: [
    {
      id: "COOKIE_OPT_OUT_IS_REAL",
      kind: "EXTERNAL_COHERENCE",
      statement: "The opt-out the policy promises for non-essential cookies actually exists.",
      identity_test:
        "Remove it and the policy tells every visitor they may opt out of analytics cookies at " +
        "any time, with nothing establishing that they can.",
      applicability: { always: true },
      satisfied_by: { any_of: ["PRIVACY_COOKIES_001"] },
      external_instrument: "service behaviour record",
      external_provision: "non_essential_cookie_opt_out",
      subject_binding: ["website_url"],
      requires: "AVAILABLE",
      when_unsatisfied: "ESCALATE",
      review_status: "probe-only",
    },
    {
      id: "THIRD_PARTY_SHARING_DISCLOSED",
      kind: "EXTERNAL_COHERENCE",
      statement: "Sharing of personal data with third parties is disclosed where it happens.",
      identity_test:
        "Remove it and a service that sends personal data to processors abroad can publish a " +
        "policy that never mentions it.",
      applicability: { always: true },
      satisfied_by: { any_of: ["PRIVACY_THIRD_PARTY_SHARING_001"] },
      external_instrument: "service behaviour record",
      external_provision: "shares_with_third_parties",
      subject_binding: ["website_url"],
      requires: "NO",
      when_unsatisfied: "ESCALATE",
      review_status: "probe-only",
    },
  ],
};
fs.writeFileSync(PROBE, JSON.stringify(doc, null, 1));

const CLAUSES = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types.PRIVACY_POLICY.full.clauses;
const VARIABLES = { website_url: "https://acme.example", company_name: "Acme" };
const behaviour = (provisions, subject = { website_url: "https://acme.example" }, extra = {}) =>
  [{ instrument: "service behaviour record", subject, provisions, ...extra }];

const CASES = [
  ["1  policy says X, service does X",
   "ESTABLISHED_POSITIVE", "COOKIE_OPT_OUT_IS_REAL", CLAUSES,
   behaviour({ non_essential_cookie_opt_out: "AVAILABLE" })],
  ["2  policy says X, service does not X",
   "ESTABLISHED_NEGATIVE (CONTRADICTED)", "COOKIE_OPT_OUT_IS_REAL", CLAUSES,
   behaviour({ non_essential_cookie_opt_out: "NOT_AVAILABLE" })],
  ["3  policy says X, behaviour cannot be established",
   "UNVERIFIABLE", "COOKIE_OPT_OUT_IS_REAL", CLAUSES, []],
  ["4  policy SILENT, service does X",
   "NOT_ESTABLISHED", "THIRD_PARTY_SHARING_DISCLOSED", CLAUSES,
   behaviour({ shares_with_third_parties: "YES" })],
  ["5  policy says X, evidence is a different product",
   "EVIDENCE_MISMATCHED", "COOKIE_OPT_OUT_IS_REAL", CLAUSES,
   behaviour({ non_essential_cookie_opt_out: "AVAILABLE" }, { website_url: "https://other.example" })],
  // 4b is the control for 4. The policy is silent in BOTH; the only thing that
  // differs is what the service actually does. If these two report the same,
  // the world state is invisible to the model.
  ["4b policy SILENT, service does NOT X  (control)",
   "different from case 4", "THIRD_PARTY_SHARING_DISCLOSED", CLAUSES,
   behaviour({ shares_with_third_parties: "NO" })],
];

try {
  loadDocumentRequirements({ refresh: true });
  console.log("case                                              wanted"
    .padEnd(66) + "got");
  console.log("-".repeat(110));
  const seen = new Map();
  for (const [label, wanted, id, clauses, instruments] of CASES) {
    const r = assessRequirements("__PRIVACY_MATRIX_PROBE", clauses, {}, VARIABLES, instruments);
    const hit = r.results.find((x) => x.id === id);
    const got = `${hit.coverage} / ${hit.finding}`;
    const flag = wanted.includes(hit.coverage) || wanted.startsWith(hit.finding) ? "  " : "!!";
    console.log(`${flag} ${label.padEnd(48)}${wanted.padEnd(32)}${got}`);
    if (hit.detail) console.log(`     ${hit.detail}`);
    seen.set(label.slice(0, 2).trim(), JSON.stringify({ ...hit, statement: 0, identity_test: 0 }));
  }
  console.log("\n" + "=".repeat(110));
  console.log(
    seen.get("4") === seen.get("4b")
      ? "CASE 4 AND ITS CONTROL ARE BYTE-IDENTICAL.\n" +
        "A service that ships personal data to third parties without disclosing it, and a service\n" +
        "that shares nothing at all, produce the SAME finding. The evidence was never consulted:\n" +
        "the requirement failed because a clause was absent, not because the world made it due."
      : "case 4 and its control differ — the world state reached the finding"
  );
} finally {
  fs.unlinkSync(PROBE);
  loadDocumentRequirements({ refresh: true });
}
