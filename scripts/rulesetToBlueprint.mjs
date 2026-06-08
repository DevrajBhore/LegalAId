/**
 * rulesetToBlueprint.mjs  —  makes rulesets the single source of truth.
 *
 * Generates a clause_library blueprint from a ruleset (the lawyer-reviewed spec),
 * so the two can never drift. Mapping:
 *   baseline_clauses[].clause             -> required_clauses
 *   rules (action=add)                    -> conditional_clauses {clause, include_if=when, note=why}
 *   rules (action=replace, grouped by slot) -> variant_clauses {slot, replaces, select_first_match, default}
 * `proposed_rules_gaps` are ignored (not yet wired / clauses may not exist).
 *
 * Usage:
 *   node scripts/rulesetToBlueprint.mjs <ruleset.json|all>     # generate + drift check (no write)
 *   node scripts/rulesetToBlueprint.mjs <ruleset.json|all> --write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toBlueprintName } from "../shared/documentRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RULESETS_DIR = path.join(ROOT, "knowledge-base", "rulesets");
const BLUEPRINTS_DIR = path.join(ROOT, "knowledge-base", "clause_library", "blueprints");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function rulesetToBlueprint(ruleset, existing) {
  const required = (ruleset.baseline_clauses || []).map((b) => b.clause);

  const addRules = (ruleset.rules || []).filter((r) => r.action === "add" && r.clause);
  const conditional_clauses = addRules.map((r) => ({
    clause: r.clause,
    include_if: r.when,
    ...(r.why ? { note: r.why } : {}),
  }));

  const replaceRules = (ruleset.rules || []).filter(
    (r) => r.action === "replace" && r.clause && r.slot
  );
  const bySlot = new Map();
  for (const rule of replaceRules) {
    if (!bySlot.has(rule.slot)) bySlot.set(rule.slot, []);
    bySlot.get(rule.slot).push(rule);
  }
  const variant_clauses = [...bySlot.entries()].map(([slot, rules]) => {
    rules.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    const replaces = rules[0].replaces || rules[0].target;
    return {
      slot,
      replaces,
      select_first_match: rules.map((r) => ({ clause: r.clause, when: r.when })),
      default: replaces,
    };
  });

  // Preserve documentation fields the engine doesn't use (_notes,
  // mandatory_legal_checks, etc.) from the existing blueprint, but regenerate
  // all structural fields from the ruleset.
  const result = {
    ...(existing || {}),
    document_type: ruleset.document_type,
    family: existing?.family || ruleset.family || String(ruleset.document_type).toLowerCase(),
    clauses: required,
    required_clauses: required,
    version: existing?.version || ruleset.version || "1.0",
    _generated_from: "ruleset (scripts/rulesetToBlueprint.mjs)",
    conditional_clauses,
  };
  if (variant_clauses.length) result.variant_clauses = variant_clauses;
  else delete result.variant_clauses;
  return result;
}

function clauseIdsOf(bp) {
  const required = new Set(bp.required_clauses || bp.clauses || []);
  const conditional = new Map((bp.conditional_clauses || []).map((c) => [c.clause, c.include_if]));
  const variant = new Set();
  for (const v of bp.variant_clauses || []) {
    for (const c of v.select_first_match || []) variant.add(`${v.slot}:${c.clause}`);
    if (v.default) variant.add(`${v.slot}:default:${v.default}`);
  }
  return { required, conditional, variant };
}

function diff(generated, existing) {
  const g = clauseIdsOf(generated);
  const e = clauseIdsOf(existing);
  const out = [];

  for (const id of g.required) if (!e.required.has(id)) out.push(`+ required ${id} (ruleset has, blueprint missing)`);
  for (const id of e.required) if (!g.required.has(id)) out.push(`- required ${id} (blueprint has, ruleset missing)`);

  for (const [id, cond] of g.conditional)
    if (!e.conditional.has(id)) out.push(`+ conditional ${id} [${cond}]`);
    else if (e.conditional.get(id) !== cond) out.push(`~ conditional ${id}: ruleset "${cond}" vs blueprint "${e.conditional.get(id)}"`);
  for (const id of e.conditional.keys()) if (!g.conditional.has(id)) out.push(`- conditional ${id} (blueprint only)`);

  for (const id of g.variant) if (!e.variant.has(id)) out.push(`+ variant ${id}`);
  for (const id of e.variant) if (!g.variant.has(id)) out.push(`- variant ${id} (blueprint only)`);

  return out;
}

function processRuleset(file, write) {
  const ruleset = readJson(file);
  const blueprintFile = path.join(BLUEPRINTS_DIR, `${toBlueprintName(ruleset.document_type)}.blueprint.json`);
  const existing = fs.existsSync(blueprintFile) ? readJson(blueprintFile) : null;
  const generated = rulesetToBlueprint(ruleset, existing);

  console.log(`\n=== ${ruleset.document_type}  (${path.basename(file)}) ===`);
  console.log(`blueprint: ${path.relative(ROOT, blueprintFile)}`);
  console.log(
    `required: ${generated.required_clauses.length}, conditional: ${generated.conditional_clauses.length}, variant slots: ${(generated.variant_clauses || []).length}`
  );

  let drifted = false;
  if (existing) {
    const differences = diff(generated, existing);
    if (differences.length === 0) console.log("drift: NONE ✓ (ruleset and blueprint are consistent)");
    else {
      drifted = true;
      console.log(`drift: ${differences.length} difference(s):`);
      differences.forEach((d) => console.log(`   ${d}`));
    }
  } else {
    console.log("drift: (no existing blueprint to compare)");
  }

  if (write) {
    fs.writeFileSync(blueprintFile, JSON.stringify(generated, null, 2) + "\n");
    console.log("WROTE blueprint from ruleset.");
  }
  return drifted;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const target = args.find((a) => !a.startsWith("--"));

  if (!target) {
    console.error("Usage: node scripts/rulesetToBlueprint.mjs <ruleset.json|all> [--write]");
    process.exit(1);
  }

  const files =
    target === "all"
      ? fs
          .readdirSync(RULESETS_DIR)
          .filter((f) => f.endsWith(".ruleset.json"))
          .map((f) => path.join(RULESETS_DIR, f))
      : [path.isAbsolute(target) ? target : path.join(ROOT, target)];

  let anyDrift = false;
  for (const file of files) {
    if (processRuleset(file, write)) anyDrift = true;
  }
  // In check mode, fail the process if any blueprint has drifted from its
  // ruleset — lets CI block hand-edits that bypass the ruleset source of truth.
  if (!write && anyDrift) {
    console.error(
      "\n❌ Drift detected. A blueprint is out of sync with its ruleset. Run with --write to regenerate."
    );
    process.exit(1);
  }
}

main();
