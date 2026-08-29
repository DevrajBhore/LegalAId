import assert from "node:assert";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { validateDocumentIntakeConfiguration } from "../backend/services/documentIntakeConfig.js";
import { preloadKnowledgeBase } from "../backend/services/clauseAssembler.js";

// The checks backend/index.js performs before it binds a port. Each of these
// calls process.exit(1) on failure, so getting one wrong does not produce a
// degraded server — it produces no server, and the platform reports only
// "No open ports detected".
//
// This suite exists because that is exactly what happened: three document types
// were withdrawn from the registry but left in documentConfig, the deploy died
// at startup, and every other test still passed. The generation sweep walks the
// REGISTRY, so it never touched the orphaned config entries. Nothing local ran
// the invariant until production did.

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL  ${name}`); console.log(`      ${error.message}`); }
}

test("DOCUMENT_CONFIG is a subset of DOCUMENT_TYPE_REGISTRY", () => {
  const unregistered = Object.keys(DOCUMENT_CONFIG).filter((t) => !DOCUMENT_TYPE_REGISTRY[t]);
  assert.deepStrictEqual(
    unregistered,
    [],
    `backend/index.js exits 1 on these. The registry may run AHEAD of config, never behind it: ` +
    `to withdraw a type remove it from documentConfig first, to add one add the registry entry first. ` +
    `Offending: ${unregistered.join(", ")}`
  );
});

test("every configured type still resolves its intake variables", () => {
  const broken = [];
  for (const type of Object.keys(DOCUMENT_CONFIG)) {
    const fields = getVariables(type);
    if (!fields || Object.keys(fields).length === 0) broken.push(type);
  }
  assert.deepStrictEqual(broken, [], `types with no intake fields: ${broken.join(", ")}`);
});

test("every field named in documentConfig exists in variableConfig", () => {
  // A requiredField or a section field that no longer exists is silently
  // unfillable: the form asks for nothing and generation blocks on a value the
  // user was never offered.
  const problems = [];
  for (const [type, config] of Object.entries(DOCUMENT_CONFIG)) {
    const fields = getVariables(type);
    for (const name of config.requiredFields || []) {
      if (!fields[name]) problems.push(`${type}: requiredFields names "${name}", which this type does not offer`);
    }
    for (const section of config.sections || []) {
      for (const name of section.fields || []) {
        if (!fields[name]) problems.push(`${type}: section "${section.title}" names "${name}", which this type does not offer`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], `\n      ${problems.join("\n      ")}\n`);
});

test("validateDocumentIntakeConfiguration passes", () => {
  validateDocumentIntakeConfiguration();
});

test("the knowledge base preloads for every configured type", () => {
  const stats = preloadKnowledgeBase({ documentTypes: Object.keys(DOCUMENT_CONFIG) });
  assert.ok(stats.clauseCount > 0, "no clauses preloaded");
  assert.ok(stats.blueprintCount > 0, "no blueprints preloaded");
  assert.strictEqual(
    stats.documentTypeCount,
    Object.keys(DOCUMENT_CONFIG).length,
    `preloaded ${stats.documentTypeCount} types but config declares ${Object.keys(DOCUMENT_CONFIG).length}`
  );
  console.log(`      ${stats.clauseCount} clauses, ${stats.blueprintCount} blueprints, ${stats.documentTypeCount} types`);
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
