/**
 * provenanceConservation.mjs — D4.43
 *
 * THE HARD GATE: recording provenance must not change a single byte of what ships.
 *
 *   node scripts/provenanceConservation.mjs capture <file>   snapshot the current code
 *   node scripts/provenanceConservation.mjs compare <file>   compare the current code to it
 *
 * The snapshot is taken from the code BEFORE instrumentation. Everything
 * generateDocument returns is serialised — draft, clause order, rendered text,
 * validation, intelligence, requirements, disclosures — together with the plain-
 * text export and the disclosure block. The only difference permitted afterwards
 * is the added key draft.metadata.provenance. Anything else is a contract violation.
 *
 * The corpus is every family under several input worlds: the well-filled fixture,
 * the declined-protections fixture, the fixture with every optional text field left
 * unanswered (where defaults fire), the essentials-only intake a quick-mode user
 * sends, and the specific worlds D4.42 found defaults in. Worlds that produce no
 * draft are kept — a blocked result must also be conserved.
 */
import fs from "fs";
import crypto from "crypto";

const { DOCUMENT_TYPE_REGISTRY } = await import("../shared/documentRegistry.js");
const { generateDocument } = await import("../backend/services/documentService.js");
const { getVariables } = await import("../backend/config/variableConfig.js");
const { ESSENTIAL_FIELDS } = await import("../backend/config/essentialFields.js");
const { draftToText } = await import("../backend/services/exportService.js");
const { renderDisclosureText } = await import("../backend/services/disclosureRenderer.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

/* Time is frozen, so a snapshot taken one day and compared the next measures the
   code, not the calendar. Swapped in AFTER the modules load: mongoose builds its
   schemas against the real Date at import and rejects a subclass. Generation reads
   the global at call time, so it sees the frozen clock. */
const FROZEN = Date.parse("2026-09-01T06:30:00.000Z");
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FROZEN])); }
  static now() { return FROZEN; }
}
globalThis.Date = FrozenDate;

const [mode, file, ...flags] = process.argv.slice(2);
const HASHES_ONLY = flags.includes("--hashes-only");
if (!["capture", "compare"].includes(mode) || !file) {
  console.error("usage: provenanceConservation.mjs capture|compare <snapshot.json>");
  process.exit(2);
}
const FAMILIES = Object.keys(DOCUMENT_TYPE_REGISTRY);
const PERMITTED = ["draft.metadata.provenance"];

function worlds(t) {
  const schema = getVariables(t) || {};
  const well = { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
  const out = [
    ["WELL_FILLED", well],
    ["MINIMAL_DECLINED", { ...variablesFor(t, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED }) }],
  ];
  const optionalText = Object.entries(schema).filter(([, f]) => ["text", "textarea"].includes(f.type) && !f.required).map(([k]) => k);
  const unanswered = { ...well }; for (const k of optionalText) delete unanswered[k];
  out.push(["OPTIONAL_TEXT_UNANSWERED", unanswered]);
  const ess = ESSENTIAL_FIELDS[t];
  if (Array.isArray(ess) && ess.length) {
    const quick = Object.fromEntries(Object.entries(well).filter(([k]) => ess.includes(k) || k === "effective_date" || k === "operating_state"));
    out.push(["QUICK_ESSENTIALS", quick]);
  }
  if ("execution_city" in schema) { const v = { ...well }; delete v.execution_city; out.push(["EXECUTION_CITY_UNANSWERED", v]); }
  if ("non_compete_period" in schema) {
    const v = { ...well, include_non_compete: "Yes", include_non_solicit: "Yes" }; delete v.non_compete_period; out.push(["RESTRICTION_PERIOD_UNANSWERED", v]);
    out.push(["RESTRICTION_PERIOD_BLANK", { ...v, non_compete_period: "" }]);
  }
  if ("probation_period" in schema) { const v = { ...well }; delete v.probation_period; out.push(["PROBATION_UNANSWERED", v]); }
  if ("binding_nature" in schema) for (const b of schema.binding_nature.options || []) out.push([`BINDING_${b}`, { ...well, binding_nature: b }]);
  if ("ip_ownership" in schema && Array.isArray(schema.ip_ownership.options)) for (const o of schema.ip_ownership.options) out.push([`IP_${o}`, { ...well, ip_ownership: o }]);
  if ("services_description" in schema && "project_description" in schema) out.push(["PURPOSE_TWO_SOURCES", { ...well,
    services_description: "design, development and deployment of a mobile inventory-tracking application for the Client's warehouses",
    project_description: "a cross-platform inventory management app with barcode scanning and offline sync" }]);
  return out;
}

/* Deterministic serialisation: keys sorted, so equality is byte equality of meaning,
   not of insertion order. Clause ORDER is an array order and is preserved. */
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function strip(result) {
  if (!result?.draft?.metadata || !("provenance" in result.draft.metadata)) return result;
  const { provenance, ...metadata } = result.draft.metadata;
  return { ...result, draft: { ...result.draft, metadata } };
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function observe(t, v) {
  const result = await generateDocument({ document_type: t, variables: v });
  const conserved = strip(result);
  const json = JSON.stringify(stable(conserved));
  const text = conserved?.draft ? draftToText(conserved.draft) : null;
  const disclosure = conserved?.draft ? renderDisclosureText(conserved.draft) : null;
  return {
    result_sha256: sha(json), text_sha256: text === null ? null : sha(String(text)), disclosure_sha256: disclosure === null ? null : sha(String(disclosure)),
    clause_order: (conserved?.draft?.clauses || []).map((c) => c.clause_id),
    shipped: Boolean(conserved?.draft?.clauses?.length),
    has_provenance: Boolean(result?.draft?.metadata?.provenance),
    json,
  };
}

const snapshot = {};
for (const t of FAMILIES) for (const [w, v] of worlds(t)) snapshot[`${t}::${w}`] = await observe(t, v);

if (mode === "capture") {
  if (HASHES_ONLY) for (const v of Object.values(snapshot)) delete v.json;
  fs.writeFileSync(file, JSON.stringify(snapshot, null, HASHES_ONLY ? 1 : 0));
  const n = Object.keys(snapshot).length, s = Object.values(snapshot).filter((x) => x.shipped).length;
  console.log(`captured ${n} (family, world) cases; ${s} ship a draft, ${n - s} are blocked — both are conserved.`);
  process.exit(0);
}

const before = JSON.parse(fs.readFileSync(file, "utf8"));
const violations = [];
for (const [k, now] of Object.entries(snapshot)) {
  const was = before[k];
  if (!was) { violations.push({ case: k, what: "case absent from the snapshot" }); continue; }
  for (const f of ["result_sha256", "text_sha256", "disclosure_sha256"]) if (was[f] !== now[f]) violations.push({ case: k, what: f });
  if (JSON.stringify(was.clause_order) !== JSON.stringify(now.clause_order)) violations.push({ case: k, what: "clause order" });
  if (was.json !== undefined && was.json !== now.json) {
    const a = was.json, b = now.json; let i = 0; while (i < a.length && a[i] === b[i]) i++;
    violations.push({ case: k, what: "first differing byte", at: i, before: a.slice(Math.max(0, i - 80), i + 80), after: b.slice(Math.max(0, i - 80), i + 80) });
  }
}
for (const k of Object.keys(before)) if (!snapshot[k]) violations.push({ case: k, what: "case missing now" });
const withProvenance = Object.values(snapshot).filter((x) => x.shipped && x.has_provenance).length;
const shippedNow = Object.values(snapshot).filter((x) => x.shipped).length;
console.log(JSON.stringify({ cases: Object.keys(snapshot).length, shipped: shippedNow, shipped_with_provenance: withProvenance,
  permitted_difference: PERMITTED, violations: violations.length }, null, 2));
const byKind = violations.reduce((acc, v) => ((acc[v.what] = (acc[v.what] || 0) + 1), acc), {});
if (violations.length) { console.log("violations by kind:", JSON.stringify(byKind)); console.log(JSON.stringify(violations.slice(0, 10), null, 2)); process.exit(1); }
console.log("CONSERVED: every case byte-identical apart from draft.metadata.provenance.");
