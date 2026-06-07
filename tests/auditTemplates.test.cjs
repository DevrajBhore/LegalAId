const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const auditScript = path.join(root, "scripts", "auditTemplates.cjs");
const reportPath = path.join(
  root,
  "knowledge-base",
  "diagnostics",
  "template_audit.json"
);
const intelligencePath = path.join(
  root,
  "knowledge-base",
  "diagnostics",
  "template_intelligence_report.json"
);
const qualityPath = path.join(
  root,
  "knowledge-base",
  "diagnostics",
  "template_quality_report.json"
);

execFileSync(process.execPath, [auditScript], {
  cwd: root,
  stdio: "pipe",
});

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const intelligence = JSON.parse(fs.readFileSync(intelligencePath, "utf8"));
const quality = JSON.parse(fs.readFileSync(qualityPath, "utf8"));
const summary = report.report || {};

assert.strictEqual(
  summary.total_templates,
  224,
  "template audit should cover the current 224 JSON template files"
);
assert.ok(Array.isArray(report.templates), "report.templates must be an array");
assert.strictEqual(
  report.templates.length,
  summary.total_templates,
  "template detail count must match summary total"
);

for (const key of [
  "valid_templates",
  "duplicates",
  "broken",
  "empty",
  "incomplete",
  "misclassified",
  "unresolved_placeholders",
]) {
  assert.strictEqual(
    typeof summary[key],
    "number",
    `summary.${key} must be a number`
  );
}

assert.ok(
  report.roadmap?.some((phase) => phase.phase === 6 && phase.status === "complete"),
  "roadmap should show all requested phases through approval pipeline"
);
assert.strictEqual(
  report.policy?.approved_templates_not_connected_to_generation,
  true,
  "approved templates must remain disconnected from generation"
);
assert.ok(
  Array.isArray(intelligence.templates),
  "intelligence report must include template intelligence details"
);
assert.strictEqual(
  quality.summary.normalized_templates,
  intelligence.total_valid_templates,
  "quality and intelligence reports should cover the same normalized template set"
);
assert.ok(
  fs.existsSync(path.join(root, "knowledge-base", "templates", "review", "index.json")),
  "review index should be generated"
);
assert.ok(
  fs.existsSync(path.join(root, "knowledge-base", "templates", "approved", "index.json")),
  "approved index should be generated"
);
assert.ok(
  fs.existsSync(path.join(root, "knowledge-base", "clauses", "index.json")),
  "extracted clause index should be generated"
);

console.log("Template audit diagnostics test passed.");
