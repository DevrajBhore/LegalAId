import assert from "node:assert";
import { VARIABLE_CONFIG, getVariables } from "../backend/config/variableConfig.js";
import {
  validateNumericPlausibility,
  listBoundedFields,
  parseNumericInput,
} from "../backend/services/numericPlausibilityValidator.js";

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error.message}`);
  }
}

const ids = (issues) => issues.map((issue) => issue.rule_id);
const run = (documentType, variables) => validateNumericPlausibility({ documentType, variables });

// The coverage guard. A numeric field with no entry in the bounds file is a
// silent gap, and a silent gap is exactly how 500000 delivery attempts reached a
// rendered PDF. Adding a number field to the intake now fails this test until
// somebody decides what the field can plausibly hold.
test("every numeric intake field carries a bound", () => {
  const numericFields = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object" && typeof value.type === "string" && value.label) {
        if (value.type === "number") numericFields.add(key);
      } else {
        walk(value);
      }
    }
  };
  walk(VARIABLE_CONFIG);

  const bounded = new Set(listBoundedFields());
  const missing = [...numericFields].filter((field) => !bounded.has(field)).sort();
  assert.deepStrictEqual(
    missing,
    [],
    `Numeric intake fields with no plausibility bound - decide what each can hold and add it to knowledge-base/rules/numeric_bounds.rules.json: ${missing.join(", ")}`
  );

  const orphaned = [...bounded].filter((field) => !numericFields.has(field)).sort();
  assert.deepStrictEqual(orphaned, [], `Bounds for fields that no longer exist: ${orphaned.join(", ")}`);
});

test("the reviewer's headline value is refused", () => {
  const issues = run("SHIPPING_AND_DELIVERY_POLICY", { delivery_attempts: "500000" });
  assert.ok(ids(issues).includes("IMPLAUSIBLE_DELIVERY_ATTEMPTS_ABOVE_MAXIMUM"));
  assert.strictEqual(issues[0].severity, "CRITICAL");
  assert.strictEqual(issues[0].blocks_generation, true);
});

test("ordinary values pass silently", () => {
  assert.deepStrictEqual(
    run("SHIPPING_AND_DELIVERY_POLICY", { delivery_attempts: "3", dispatch_window_days: "2" }),
    []
  );
  assert.deepStrictEqual(
    run("COMMERCIAL_LEASE_AGREEMENT", {
      lease_term: "36",
      lock_in_period: "12",
      rent_amount: "85000",
      security_deposit: "255000",
    }),
    []
  );
});

test("rupee decoration is parsed, prose is not", () => {
  assert.strictEqual(parseNumericInput("₹ 12,00,000"), 1200000);
  assert.strictEqual(parseNumericInput("Rs. 45,000/-"), 45000);
  assert.strictEqual(parseNumericInput("18%"), 18);
  assert.strictEqual(parseNumericInput("as mutually agreed"), null);
  assert.strictEqual(parseNumericInput("12 to 15"), null);
  assert.strictEqual(parseNumericInput(""), null);
  assert.strictEqual(parseNumericInput(undefined), null);
});

test("a lock-in longer than the term is caught", () => {
  assert.ok(
    ids(run("COMMERCIAL_LEASE_AGREEMENT", { lease_term: "24", lock_in_period: "36" })).includes(
      "LOCK_IN_EXCEEDS_TERM"
    )
  );
  assert.ok(
    ids(run("LEAVE_AND_LICENSE_AGREEMENT", { license_term: "11", lock_in_period: "12" })).includes(
      "LOCK_IN_EXCEEDS_LICENCE_TERM"
    )
  );
});

test("shareholdings cannot exceed the whole", () => {
  const issues = run("SHAREHOLDERS_AGREEMENT", {
    shareholding_percentage_1: "60",
    shareholding_percentage_2: "55",
  });
  const issue = issues.find((entry) => entry.rule_id === "SHAREHOLDING_EXCEEDS_WHOLE");
  assert.ok(issue, "expected the sum check to fire");
  assert.strictEqual(issue.severity, "CRITICAL");
  assert.deepStrictEqual(
    run("SHAREHOLDERS_AGREEMENT", {
      shareholding_percentage_1: "60",
      shareholding_percentage_2: "40",
    }).filter((entry) => entry.rule_id === "SHAREHOLDING_EXCEEDS_WHOLE"),
    []
  );
});

test("a statutory ceiling cites its provision", () => {
  const issue = run("EMPLOYMENT_CONTRACT", { working_hours: "70" }).find(
    (entry) => entry.rule_id === "STATUTORY_LIMIT_WORKING_HOURS"
  );
  assert.ok(issue, "expected the OSH ceiling to fire");
  assert.match(issue.suggestion, /OSH Code 2020 S\.25/);
  assert.strictEqual(issue.severity, "HIGH");
  assert.deepStrictEqual(
    run("EMPLOYMENT_CONTRACT", { working_hours: "40" }).filter(
      (entry) => entry.rule_id === "STATUTORY_LIMIT_WORKING_HOURS"
    ),
    []
  );
});

test("one wrong figure raises one notice, not three", () => {
  const issues = run("SHIPPING_AND_DELIVERY_POLICY", { delivery_attempts: "500000" });
  const perField = issues.filter((entry) => entry.rule_id.includes("DELIVERY_ATTEMPTS"));
  assert.strictEqual(perField.length, 1, `expected a single notice, got ${ids(perField).join(", ")}`);
});

test("a form filled from a fixture is recognised", () => {
  const issues = run("COMMERCIAL_LEASE_AGREEMENT", {
    rent_amount: "500000",
    security_deposit: "500000",
    lease_term: "500000",
  });
  assert.ok(ids(issues).includes("REPEATED_NUMERIC_VALUE"));
});

test("values outside the document's own field set are ignored", () => {
  // delivery_attempts belongs to the shipping policy; carrying it into an NDA
  // must not produce an issue against a field the NDA never asked for.
  assert.deepStrictEqual(run("NDA", { delivery_attempts: "500000" }), []);
});

test("an unknown document type is not guessed at", () => {
  assert.deepStrictEqual(run("", { delivery_attempts: "500000" }), []);
  assert.deepStrictEqual(validateNumericPlausibility({}), []);
});

// Nothing in the live library may trip its own bounds on an ordinary value.
test("every bounded field accepts a mid-range value", () => {
  for (const field of listBoundedFields()) {
    for (const documentType of ["NDA", "EMPLOYMENT_CONTRACT", "COMMERCIAL_LEASE_AGREEMENT"]) {
      const definitions = getVariables(documentType) || {};
      if (definitions[field]?.type !== "number") continue;
      // A value the bounds file must accept: inside every band it declares.
      const issues = run(documentType, { [field]: "12" }).filter((entry) =>
        entry.rule_id.includes(field.toUpperCase())
      );
      assert.ok(
        issues.every((entry) => entry.severity !== "CRITICAL"),
        `${field} rejects a mid-range value: ${ids(issues).join(", ")}`
      );
    }
  }
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
