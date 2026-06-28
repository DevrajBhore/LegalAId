import test from "node:test";
import assert from "node:assert/strict";

import { validateVariables } from "../backend/services/variableValidator.js";
import { getVariables } from "../backend/config/variableConfig.js";
import {
  getRequiredFieldsForMode,
  ESSENTIAL_FIELDS,
} from "../backend/config/essentialFields.js";
import { getConversationalStep } from "../backend/services/interviewService.js";

test("quick mode relaxes required validation to essentials", () => {
  const schema = getVariables("NDA");
  // Minimal NDA: only the essentials, none of the secondary required fields.
  const minimal = {
    operating_state: "Maharashtra",
    party_1_name: "TechCorp Pvt Ltd",
    party_1_type: "Private Limited Company",
    party_2_name: "Rahul Sharma",
    party_2_type: "Individual",
    purpose: "Sharing confidential pricing data for a supplier negotiation",
    effective_date: "2026-07-01",
  };

  const detailed = validateVariables(schema, minimal, { documentType: "NDA", mode: "detailed" });
  const quick = validateVariables(schema, minimal, { documentType: "NDA", mode: "quick" });

  assert.ok(detailed.length > 0, "detailed mode should still demand the full required set");
  assert.equal(quick.length, 0, "quick mode should accept the essentials alone");
});

test("essentials are always a subset of the document's required fields", async () => {
  const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");
  for (const [type, essentials] of Object.entries(ESSENTIAL_FIELDS)) {
    const required = new Set(DOCUMENT_CONFIG[type]?.requiredFields || []);
    for (const field of essentials) {
      assert.ok(
        required.has(field),
        `${type}: essential "${field}" must also be a required field`
      );
    }
  }
});

test("unknown type falls back to required fields in quick mode", () => {
  const required = ["a", "b"];
  assert.deepEqual(getRequiredFieldsForMode("NOT_A_TYPE", required, "quick"), required);
});

test("conversational step walks essentials and signals ready when filled", async () => {
  const first = await getConversationalStep({ documentType: "NDA", filled: {} });
  assert.equal(first.ready, false);
  assert.ok(first.next_field, "should ask for a field first");
  assert.ok(first.next_question, "should produce a natural question");

  const allFilled = {
    operating_state: "Maharashtra",
    party_1_name: "TechCorp",
    party_1_type: "Private Limited Company",
    party_2_name: "Rahul",
    party_2_type: "Individual",
    purpose: "share pricing data for negotiations",
    effective_date: "2026-07-01",
  };
  const done = await getConversationalStep({ documentType: "NDA", filled: allFilled });
  assert.equal(done.ready, true, "all essentials filled -> ready");
  assert.equal(done.next_question, null);
});

console.log("# Intake modes (quick + conversational) test passed.");
