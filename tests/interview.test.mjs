// Tests the interview safety guarantee: only valid, in-schema fields/options can
// reach the form. The AI call itself is not exercised (needs a provider key).
// Run: node tests/interview.test.mjs
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");
const toUrl = (p) => "file://" + (p.startsWith("/") ? p : "/" + p.replace(/\\/g, "/"));
const { validateInterviewUpdate } = await import(
  toUrl(path.join(backend, "services/interviewService.js"))
);

// Synthetic field schema (mirrors variableConfig shape).
const fieldsByName = new Map([
  ["counterparty_type", { name: "counterparty_type", label: "Counterparty", type: "select", options: ["Investor", "Vendor", "Customer", "Employee", "Other"] }],
  ["involves_source_code", { name: "involves_source_code", label: "Source code?", type: "select", options: ["No", "Yes"] }],
  ["purpose", { name: "purpose", label: "Purpose", type: "textarea" }],
]);

// 1. Valid select value passes and is snapped to the exact option (case-insensitive).
const ok = validateInterviewUpdate(
  { field: "counterparty_type", value: "investor", confidence: 0.9, reason: "stated" },
  fieldsByName
);
assert.ok(ok, "valid update accepted");
assert.strictEqual(ok.value, "Investor", "value snapped to exact option");
assert.strictEqual(ok.confidence, 0.9);

// 2. Invalid option for a select is rejected (cannot inject an out-of-schema value).
assert.strictEqual(
  validateInterviewUpdate(
    { field: "counterparty_type", value: "Spaceship", confidence: 1, reason: "x" },
    fieldsByName
  ),
  null,
  "invalid select option rejected"
);

// 3. Unknown field is rejected (cannot invent fields).
assert.strictEqual(
  validateInterviewUpdate(
    { field: "totally_made_up", value: "x", confidence: 1, reason: "x" },
    fieldsByName
  ),
  null,
  "unknown field rejected"
);

// 4. Free-text field accepts any non-empty value.
const text = validateInterviewUpdate(
  { field: "purpose", value: "evaluate an acquisition", confidence: 2, reason: "" },
  fieldsByName
);
assert.ok(text, "free-text update accepted");
assert.strictEqual(text.confidence, 1, "confidence clamped to <= 1");
assert.ok(text.reason.length > 0, "reason defaulted when empty");

// 5. Empty value rejected.
assert.strictEqual(
  validateInterviewUpdate({ field: "purpose", value: "  ", confidence: 0.5, reason: "x" }, fieldsByName),
  null,
  "empty value rejected"
);

console.log("Interview safety test passed.");
