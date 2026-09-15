/**
 * probeDependencyOverride.mjs — PHASE C1
 *
 * WHERE DOES A CLAUSE DEPENDENCY OUTRANK AN APPLICABILITY GATE?
 *
 * Measured at RUNTIME across every family, not by reading the dependency graph.
 * A static reading of required_with has twice produced an inflated count: eight
 * once, twelve on a later sweep, against a runtime population of two. A static
 * edge is a potential override; only generation says whether it fires.
 *
 * METHOD. For every blueprint gate of the form `flag == true`, generate the
 * family's own baseline fixture with that flag answered "No", and ask whether
 * the gated clause ships anyway — and by which route.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVariables } from "./freezeClauseBaseline.mjs";
import { generateDocument } from "../backend/services/documentService.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { positionOf, POSITION } from "../backend/services/generationControls.js";
import { mutateTo, fieldsBehindGate } from "./lib/semanticMutation.mjs";
import { loadSemanticFacts } from "../backend/services/canonicalFacts.js";
import { getVariables } from "../backend/config/variableConfig.js";

const SEMANTIC_FACTS = loadSemanticFacts();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLUEPRINTS = path.join(ROOT, "knowledge-base/clause_library/blueprints");

// Every gate a blueprint states, as (documentType, clause, flag).
const gates = [];
for (const file of fs.readdirSync(BLUEPRINTS).filter((f) => f.endsWith(".json"))) {
  const blueprint = JSON.parse(fs.readFileSync(path.join(BLUEPRINTS, file), "utf8"));
  const documentType = blueprint.document_type;
  if (!documentType) continue;
  for (const key of ["clauses", "conditional_clauses", "variant_clauses", "required_clauses"]) {
    for (const entry of blueprint[key] || []) {
      if (typeof entry !== "object" || !entry?.include_if || !entry?.clause) continue;
      const match = String(entry.include_if).match(/^([A-Za-z0-9_]+)\s*==\s*true$/);
      if (match) gates.push({ documentType, clause: entry.clause, flag: match[1] });
    }
  }
}

const known = new Set(Object.keys(DOCUMENT_TYPE_REGISTRY || {}));
const rows = [];
for (const gate of gates) {
  if (known.size && !known.has(gate.documentType)) continue;
  let variables;
  try { variables = buildVariables(gate.documentType, "full"); } catch { continue; }

  // THE MUTATION CONTRACT — scripts/lib/semanticMutation.mjs.
  //
  // The gate's name is not the field's name: a blueprint gates
  // LOAN_SECURITY_001 on `is_secured` while the question is called
  // `loan_is_secured`. Writing into the gate's name writes a key the schema does
  // not have, sanitisation drops it, and the gate stays open — which reported 74
  // overridden gates where 7 were. The mapping is stated in the declared fact
  // surface and NOWHERE else, so a gate with no mapping is reported NOT
  // MEASURABLE rather than counted either way.
  const behind = fieldsBehindGate(gate.flag, SEMANTIC_FACTS, getVariables(gate.documentType) || {});
  if (!behind.measurable) {
    rows.push({ ...gate, outcome: "not-closed", detail: behind.why });
    continue;
  }
  const fields = behind.fields;
  let answered = { ...variables };
  for (const field of fields) {
    const next = mutateTo(answered, field, (getVariables(gate.documentType) || {})[field], POSITION.FALSE);
    // A field with no option meaning "no" cannot be declined. Falling back to
    // the string "No" would write an answer the select does not offer.
    answered = next || { ...answered, [field]: "No" };
  }
  if (fields.includes("loan_is_secured")) delete answered.security_collateral;

  // DID THE FLAG ACTUALLY MOVE?
  //
  // `flag` is the name of a DERIVED CONTROL, which is not always an intake
  // field. Writing "No" into a key the schema does not have means sanitisation
  // strips it before generation and the gate never closes — so the clause ships
  // for the ordinary reason that the user wants it, and a probe that did not
  // check would report an override. The first run of this probe reported 74;
  // 69 of those were this mistake. It is the same error as probing lender_type
  // with "Bank" when the declared option is "Scheduled Bank", and the reason
  // the derivation adapter exists.
  const closed = positionOf(
    deriveControlsForDocument(gate.documentType,
      sanitizeVariablesForDocument(gate.documentType, answered))[gate.flag]
  ) === POSITION.FALSE;
  if (!closed) {
    rows.push({ ...gate, outcome: "not-closed",
      detail: `"${gate.flag}" is not an intake field on this family, or the derivation ` +
              `overrode the answer — the gate never closed, so nothing was tested` });
    continue;
  }

  let result;
  try { result = await generateDocument({ document_type: gate.documentType, variables: answered }); }
  catch (error) { rows.push({ ...gate, outcome: "ERROR", detail: String(error.message).slice(0, 80) }); continue; }

  const clauses = result?.draft?.clauses || [];
  if (!clauses.length) {
    rows.push({ ...gate, outcome: "BLOCKED", detail: (result?.validation?.errors || [])
      .map((e) => e.message).join("; ").slice(0, 90) });
    continue;
  }
  const shipped = clauses.find((c) => c.clause_id === gate.clause);
  rows.push({
    ...gate,
    outcome: shipped ? "OVERRIDDEN" : "respected",
    detail: shipped ? (shipped.injected_by || "the gate itself") : "",
  });
}

const overridden = rows.filter((r) => r.outcome === "OVERRIDDEN");
const blocked = rows.filter((r) => r.outcome === "BLOCKED");
const notClosed = rows.filter((r) => r.outcome === "not-closed");
const respected = rows.filter((r) => r.outcome === "respected");
const byRoute = overridden.reduce((a, r) => ({ ...a, [r.detail]: (a[r.detail] || 0) + 1 }), {});

const lines = [];
lines.push("# Phase C1 — where a dependency outranks an applicability gate\n");
lines.push(`Gates stated across all blueprints: **${gates.length}**  `);
lines.push(`Gates actually CLOSED by declining the flag: **${overridden.length + respected.length}**  `);
lines.push(`Gates that could not be closed — the flag is not an answerable intake field on that `);
lines.push(`family, or the derivation overrides the answer: ${notClosed.length}  `);
lines.push(`Gates OVERRIDDEN — the clause ships although the user declined it: **${overridden.length}**  `);
lines.push(`Gates whose fixture could not generate with the flag declined: ${blocked.length}\n`);
lines.push(`Route taken by each override: ${JSON.stringify(byRoute)}\n`);
lines.push("## Overridden\n");
lines.push("| document type | clause | declined flag | injected by |");
lines.push("|---|---|---|---|");
for (const r of overridden) lines.push(`| ${r.documentType} | ${r.clause} | ${r.flag} | ${r.detail} |`);
if (notClosed.length) {
  lines.push("\n## Gates this probe could not close\n");
  lines.push("**A LIMIT OF THE MEASUREMENT, NOT A LIST OF DEFECTS.** To close a gate the probe must");
  lines.push("know which intake question backs it, and the gate's name is not always the field's");
  lines.push("name — LOAN_SECURITY_001 is gated on `is_secured` while the question is called");
  lines.push("`loan_is_secured`. That mapping is stated for the seven declared semantic facts and");
  lines.push("nowhere else, so for the rest the probe writes into a key the schema does not have,");
  lines.push("sanitisation drops it, and the gate stays open.");
  lines.push("");
  lines.push("Some of these are probably gates written against a control no user can answer, which");
  lines.push("would be a real defect. Others are simply names this probe cannot resolve. Until the");
  lines.push("mapping exists they cannot be told apart, so the number is reported and not read.\n");
  lines.push("| document type | clause | flag |");
  lines.push("|---|---|---|");
  for (const r of notClosed) lines.push(`| ${r.documentType} | ${r.clause} | ${r.flag} |`);
}
if (blocked.length) {
  lines.push("\n## Not exercised — the fixture does not generate with the flag declined\n");
  lines.push("These are NOT clean gates. Each is a state the family may not be able to represent,");
  lines.push("the shape Phase B found on the loan, and each needs its own look.\n");
  lines.push("| document type | clause | declined flag | refused with |");
  lines.push("|---|---|---|---|");
  for (const r of blocked) lines.push(`| ${r.documentType} | ${r.clause} | ${r.flag} | ${r.detail} |`);
}
fs.mkdirSync(path.join(ROOT, "docs/audit"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs/audit/DEPENDENCY_OVERRIDE_PROBE.md"), lines.join("\n") + "\n");

console.log(`gates stated: ${gates.length}   closed: ${overridden.length + respected.length}   ` +
            `OVERRIDDEN: ${overridden.length}   respected: ${respected.length}   ` +
            `could not close: ${notClosed.length}   blocked: ${blocked.length}`);
for (const r of overridden) console.log(`  OVERRIDDEN  ${r.documentType} / ${r.clause}  (declined ${r.flag}, injected by ${r.detail})`);
for (const r of blocked) console.log(`  blocked     ${r.documentType} / ${r.clause}  (declined ${r.flag}) ${r.detail}`);
