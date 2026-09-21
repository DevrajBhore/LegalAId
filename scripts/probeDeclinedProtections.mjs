/**
 * probeDeclinedProtections.mjs — DOES A DECLINED PROTECTION STILL REACH THE PAGE?
 *
 * declinedProtections.test.mjs asserts a role-level invariant: a user who declines
 * a protection must not find it in the draft under ANY clause id. Its own comment
 * records that six stages could reintroduce an excluded clause and that each was
 * found only after the previous repair failed to hold.
 *
 * It fails today. This probe establishes WHERE — which role, which family, which
 * clause id — before anything is concluded about why.
 */
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { getVariables } from "../backend/config/variableConfig.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { PROTECTION_ROLE_CLAUSE_IDS } from "../backend/commercial/protectionLibrary.js";

const ROLES = {
  FORCE_MAJEURE: { field: "include_force_majeure", ids: PROTECTION_ROLE_CLAUSE_IDS.FORCE_MAJEURE },
  INDEMNITY: { field: "include_indemnity_clause", ids: PROTECTION_ROLE_CLAUSE_IDS.INDEMNITY },
  ENTIRE_AGREEMENT: { field: "include_entire_agreement", ids: ["CORE_ENTIRE_AGREEMENT_001"] },
  NOMENCLATURE: { field: "include_nomenclature_clause", ids: ["CORE_DEFINITIONS_001"] },
};

const rows = [];
for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const schema = getVariables(type) || {};
  const roles = Object.entries(ROLES).filter(([, s]) => s.field in schema);
  if (!roles.length) continue;

  const vars = variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
  let out;
  try { out = await generateDocument({ document_type: type, variables: vars }); } catch { continue; }
  const ids = new Set((out?.draft?.clauses || []).map((c) => c.clause_id));
  if (!ids.size) continue;

  for (const [role, spec] of roles) {
    const present = spec.ids.filter((id) => ids.has(id));
    if (present.length) {
      // The clause object records who put it there — where anything does. That
      // stamp is the difference between a mechanism established and one inferred.
      const injectors = present.map((id) =>
        (out.draft.clauses.find((c) => c.clause_id === id) || {}).injected_by || "(none recorded)");
      rows.push({ type, role, answered: vars[spec.field], present, injectors });
    }
  }
}

console.log(`declined-yet-present occurrences: ${rows.length}\n`);
const byRole = {};
for (const r of rows) (byRole[r.role] ||= []).push(r);
for (const [role, list] of Object.entries(byRole)) {
  const ids = [...new Set(list.flatMap((r) => r.present))];
  console.log(`${role}  — ${list.length} families, answered "${list[0].answered}"`);
  console.log(`   clause ids appearing: ${ids.join(", ")}`);
  console.log(`   families: ${list.map((r) => r.type).slice(0, 6).join(", ")}${list.length > 6 ? ` …+${list.length - 6}` : ""}`);
  const stamps = [...new Set(list.flatMap((r) => r.injectors))];
  console.log(`   injected_by: ${stamps.join(", ")}`);
}
if (!rows.length) console.log("none — the invariant holds on this population");

/* ── WHAT THE STAMPS DO AND DO NOT ESTABLISH ─────────────────────────────── */
const stamped = rows.filter((r) => r.injectors.some((i) => i !== "(none recorded)"));
console.log(`
${stamped.length} of ${rows.length} occurrences name the stage that injected them.

Where injected_by is recorded, the mechanism is STATED by the artifact. Where it is
not, the clause arrived by a path that stamps nothing, and this probe cannot say
which — the blueprint's required list and the hardening baseline both reach these
families and neither leaves a mark. That is a provenance gap in the draft itself,
and it is the reason two of the three classes below are described rather than
established.`);
