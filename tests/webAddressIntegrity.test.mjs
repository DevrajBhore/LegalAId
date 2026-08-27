/**
 * A URL or an email address must survive clause normalisation intact.
 *
 * The punctuation-spacing and sentence-capitalisation rules used to treat the
 * dots in a domain as sentence endings. Every privacy policy, terms of service,
 * refund policy and data processing agreement shipped a broken website address
 * and a broken grievance-officer email -- "https: //alpha. Example",
 * "contact@alpha. Example" -- which is the one contact route a consumer is
 * entitled to use.
 */
import assert from "node:assert/strict";
import { normalizeClauseBody, normalizeClauseTitle } from "../backend/services/clauseQualityNormalizer.js";

const INTACT = [
  ["scheme URL", "Personal data collected through https://alpha.example and related services."],
  ["http URL", "See http://legal-aid.xyz/privacy for the current version."],
  ["bare www host", "Visit www.legal-aid.xyz for the current policy."],
  ["email", "Write to the officer at contact@alpha.example for any grievance."],
  ["email with dashes", "Notices go to no-reply@legal-aid.xyz and are deemed served on despatch."],
  ["email with plus", "Send to grievance+posh@alpha.co.in within three months of the incident."],
  ["URL and email together", "Published at https://alpha.example; queries to ic@alpha.example."],
  ["deep path", "The schedule is at https://alpha.example/docs/schedule-1.pdf as amended."],
];

for (const [label, text] of INTACT) {
  const out = normalizeClauseBody(text, { documentType: "PRIVACY_POLICY" });
  assert.strictEqual(out, text, `${label} was altered:\n  in:  ${text}\n  out: ${out}`);
}
console.log(`PASS  ${INTACT.length} URLs and email addresses survive normalisation unchanged`);

{
  // The address must not disable the rules around it.
  const out = normalizeClauseBody(
    "the policy is published at https://alpha.example. the officer is reachable at ic@alpha.example.",
    { documentType: "PRIVACY_POLICY" }
  );
  assert.ok(out.startsWith("The policy"), "sentence capitalisation must still run");
  assert.ok(out.includes(". The officer"), `sentence after a URL must still capitalise: ${out}`);
  assert.ok(out.includes("https://alpha.example"), "URL must survive");
  assert.ok(out.includes("ic@alpha.example"), "email must survive");
  console.log("PASS  normalisation still runs on the prose around an address");
}

{
  // The guards that were already there must not have been traded away.
  const out = normalizeClauseBody(
    "the sum of Rs. 30,000 is payable under s.74 of the Act on 21.08.2026 at 5:00 p.m.",
    { documentType: "NDA" }
  );
  for (const keep of ["Rs. 30,000", "s.74", "21.08.2026", "5:00 p.m."]) {
    assert.ok(out.includes(keep), `${keep} was mangled: ${out}`);
  }
  console.log("PASS  amounts, citations, dates and times are still protected");
}

{
  const t = normalizeClauseTitle("grievance officer at ic@alpha.example", { documentType: "PRIVACY_POLICY" });
  assert.ok(t.includes("ic@alpha.example"), `title path mangled the address: ${t}`);
  console.log("PASS  clause titles preserve addresses too");
}

console.log("\nALL GREEN");
