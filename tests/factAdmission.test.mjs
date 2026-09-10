/**
 * factAdmission.test.mjs
 *
 * "A fact exists" and "a fact has legal significance" are separate claims, and
 * the registry must not let the first pass for the second.
 *
 * A checkbox reading `is_female_employee` is not legal knowledge. The legally
 * meaningful proposition is whatever statutory rule makes that fact relevant,
 * with its scope and its conditions. So the three stay apart:
 *
 *   FACT       what is true of the engagement
 *   TREATMENT  what legal consequence follows, and on whose authority
 *   CLAUSE     what the deterministic engine then selects
 *
 * These tests prove the gate refuses knowledge that has not been through the
 * chain — legal proposition, authority, scope, applicability, treatment,
 * confirmation question, behaviour when unanswered, review status — rather than
 * trusting whoever writes the next artifact to remember all eight.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadFactRegistry, clearFactRegistryCache } from "../backend/services/factRegistry.js";

let checks = 0;
const CONTRIBUTED = path.resolve("knowledge-base/intake/facts");

// ── 1. Everything already in the registry clears the gate ───────────────────
const registry = loadFactRegistry({ refresh: true });
assert.ok(registry.facts.length >= 7, "the registry must load");
for (const fact of registry.facts) {
  for (const field of ["legal_proposition", "scope", "jurisdiction", "unknown_behaviour", "review_status"]) {
    assert.ok(String(fact[field] || "").trim(),
      `fact ${fact.id} is in production without ${field}`);
    checks += 1;
  }
}
for (const treatment of registry.treatments) {
  const authority = treatment.authority;
  assert.ok(
    (Array.isArray(authority) && authority.every((a) => a.act && a.section)) || authority === "commercial",
    `treatment ${treatment.fact}=${treatment.value} has no usable authority`
  );
  checks += 1;
}
console.log(
  `PASS  ${registry.facts.length} facts and ${registry.treatments.length} treatments clear the admission gate`
);

// ── 2. The gate actually refuses ────────────────────────────────────────────
// Written as real files in the contributed directory, because a gate that only
// works on hand-built objects is not the gate the loader uses.
const REFUSALS = [
  ["a fact with no legal proposition", {
    facts: [{
      id: "PROBE_NO_PROPOSITION", question: "Is the widget a blue one, or is it not?",
      type: "select", scope: "Everywhere.", jurisdiction: "India",
      unknown_behaviour: "Nothing happens, which is the problem.",
      review_status: "draft",
      options: [
        { label: "Yes", establishes: { PROBE_NO_PROPOSITION: true } },
        { label: "No", establishes: { PROBE_NO_PROPOSITION: false } },
      ],
    }],
    treatments: [
      { fact: "PROBE_NO_PROPOSITION", value: true, positions: { probe_flag: true },
        basis: "Because the widget is blue and that is that.", authority: "commercial", review_status: "draft" },
      { fact: "PROBE_NO_PROPOSITION", value: false, positions: { probe_flag: false },
        basis: "Because the widget is not blue and that is that.", authority: "commercial", review_status: "draft" },
    ],
  }, "legal_proposition"],
  ["a treatment inventing a statute it cannot name", {
    facts: [{
      id: "PROBE_BAD_AUTHORITY", question: "Does the arrangement involve a widget of any colour?",
      type: "select",
      legal_proposition: "Whether widgets are involved, which is said to matter.",
      scope: "Widget arrangements.", jurisdiction: "India",
      unknown_behaviour: "The position stays open and is disclosed.",
      review_status: "draft",
      options: [
        { label: "Yes", establishes: { PROBE_BAD_AUTHORITY: true } },
        { label: "No", establishes: { PROBE_BAD_AUTHORITY: false } },
      ],
    }],
    treatments: [
      { fact: "PROBE_BAD_AUTHORITY", value: true, positions: { probe_flag: true },
        basis: "Some statute somewhere is generally understood to require this.",
        authority: "the law", review_status: "draft" },
      { fact: "PROBE_BAD_AUTHORITY", value: false, positions: { probe_flag: false },
        basis: "And where it does not apply, it does not apply at all.",
        authority: "commercial", review_status: "draft" },
    ],
  }, "authority"],
  ["a fact that cannot express a negative", {
    facts: [{
      id: "PROBE_ONE_SIDED", question: "Will the counterparty handle anything of value at all?",
      type: "select",
      legal_proposition: "Whether anything of value is handled, which is said to matter here.",
      scope: "Any arrangement.", jurisdiction: "India",
      unknown_behaviour: "The position stays open and is disclosed.",
      review_status: "draft",
      options: [
        { label: "Yes", establishes: { PROBE_ONE_SIDED: true } },
        { label: "No", establishes: { PROBE_ONE_SIDED: false } },
      ],
    }],
    treatments: [
      { fact: "PROBE_ONE_SIDED", value: true, positions: { probe_flag: true },
        basis: "Only the affirmative case was ever written down for this one.",
        authority: "commercial", review_status: "draft" },
    ],
  }, "only 1 value"],
];

for (const [label, body, expected] of REFUSALS) {
  const file = path.join(CONTRIBUTED, "__probe.json");
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  let message = "";
  try {
    loadFactRegistry({ refresh: true });
    message = "";
  } catch (error) {
    message = String(error.message);
  } finally {
    fs.unlinkSync(file);
    clearFactRegistryCache();
  }
  assert.ok(message, `the gate admitted ${label}`);
  assert.ok(message.includes(expected),
    `${label} was refused, but not for the right reason. Expected the message to mention ` +
    `"${expected}":\n${message}`);
  checks += 2;
}
console.log(`PASS  the gate refuses ${REFUSALS.length} kinds of unadmissible knowledge, each for its own reason`);

// The registry is intact after the probes.
assert.strictEqual(loadFactRegistry({ refresh: true }).facts.length, registry.facts.length,
  "the refusal probes left the registry changed");
checks += 1;

console.log(`\nALL GREEN (${checks} checks)`);
