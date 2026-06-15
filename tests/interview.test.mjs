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

// 6. Date fields normalize to YYYY-MM-DD; garbage dates are rejected.
fieldsByName.set("effective_date", { name: "effective_date", label: "Effective Date", type: "date" });
const date = validateInterviewUpdate(
  { field: "effective_date", value: "15 June 2026", confidence: 0.8, reason: "stated" },
  fieldsByName
);
assert.ok(date, "parseable date accepted");
assert.match(date.value, /^\d{4}-\d{2}-\d{2}$/, "date normalized to ISO");
assert.strictEqual(
  validateInterviewUpdate({ field: "effective_date", value: "sometime soon", confidence: 0.8, reason: "x" }, fieldsByName),
  null,
  "unparseable date rejected"
);

// 7. Number fields strip currency symbols; non-numeric rejected.
fieldsByName.set("salary", { name: "salary", label: "Salary", type: "number" });
const num = validateInterviewUpdate(
  { field: "salary", value: "₹12,00,000", confidence: 0.9, reason: "stated" },
  fieldsByName
);
assert.ok(num, "currency-formatted number accepted");
assert.strictEqual(num.value, "1200000", "currency symbols and commas stripped");
assert.strictEqual(
  validateInterviewUpdate({ field: "salary", value: "around twelve lakh", confidence: 0.9, reason: "x" }, fieldsByName),
  null,
  "non-numeric number rejected"
);

// 8. Fuzzy option snapping: common phrasings that don't string-match an option
//    are snapped to the right one, while ambiguous/unknown values are rejected
//    (never guess an out-of-schema value onto the form).
fieldsByName.set("party_1_type", {
  name: "party_1_type",
  label: "Party Type",
  type: "select",
  options: ["Individual", "Private Limited Company", "LLP", "Partnership Firm", "Sole Proprietorship"],
});
const snapCases = [
  ["company", "Private Limited Company"],
  ["pvt ltd", "Private Limited Company"],
  ["llc", "LLP"],
  ["partnership", "Partnership Firm"],
  ["sole proprietor", "Sole Proprietorship"],
  ["banana", null], // no clear match -> rejected
];
for (const [value, want] of snapCases) {
  const r = validateInterviewUpdate(
    { field: "party_1_type", value, confidence: 0.9, reason: "stated" },
    fieldsByName
  );
  assert.strictEqual(r?.value ?? null, want, `snap "${value}" -> ${want}`);
}

console.log("Interview safety test passed.");
