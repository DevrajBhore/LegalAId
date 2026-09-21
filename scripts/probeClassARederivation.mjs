/**
 * probeClassARederivation.mjs — DO THE D4.26–D4.30 FINDINGS STILL HOLD?
 *
 * The D4.32 closure recorded three evidence classes. Class A is the findings
 * grounded in clause text, knowledge records and schemas rather than in fixture
 * coverage — the nil ceiling, the unaskable characterisation, the empty referent.
 * The rule attached to it was deliberately uncomfortable:
 *
 *     PROBABLY is not CHECKED.
 *
 * So this probe re-derives each headline Class A claim from the engine and the
 * schemas directly, on the adopted 40-family population, and reports whether it
 * holds. It does NOT read the governance records to decide — it recomputes, then
 * compares.
 *
 * That distinction matters more than it sounds. Six test files assert these
 * findings and all six are green, but a test that asserts "the record says X"
 * has not re-derived X. This probe touches the engine for every claim it makes.
 */
import fs from "node:fs";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables, VARIABLE_CONFIG } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const results = [];
const record = (claim, held, detail) => {
  results.push({ claim, held, detail });
  console.log(`${held === true ? "HOLDS     " : held === false ? "CHANGED   " : "UNREACHABLE"} ${claim}`);
  if (detail) console.log(`            ${detail}`);
};

const CAP = new Set(["CORE_LIMITATION_LIABILITY_001", "CORE_LIABILITY_CAP_001",
  "CORE_LIABILITY_LIMIT_FALLBACK_001", "GUARANTEE_OBLIGATION_001"]);
const MEASURE = /aggregate fees paid or payable under this Agreement|total consideration paid under this Agreement/i;
const CURRENCY = /₹|\bRs\.?\b|\bINR\b|\brupees?\b/i;
const EMPTY = ["DATA_PROCESSING_AGREEMENT", "DISTRIBUTION_AGREEMENT", "FOUNDERS_AGREEMENT",
  "NDA", "PRIVACY_POLICY", "SHAREHOLDERS_AGREEMENT", "TERMS_OF_SERVICE"];

const draft = {};
for (const t of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  try {
    const r = await generateDocument({ document_type: t, variables: variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
    draft[t] = r?.draft?.clauses || [];
  } catch { draft[t] = []; }
}
const realized = Object.keys(draft).filter((t) => draft[t].length);
console.log(`\npopulation ${Object.keys(DOCUMENT_TYPE_REGISTRY).length}  realized ${realized.length}\n`);

/* 1 — the seven structurally empty families still measure a payment they never record */
{
  const unreachable = EMPTY.filter((t) => !draft[t].length);
  const wrong = EMPTY.filter((t) => draft[t].length)
    .filter((t) => !MEASURE.test(draft[t].find((c) => CAP.has(c.clause_id))?.text || ""));
  record("the 7 structurally empty families each render a ceiling measured on fees or consideration",
    wrong.length === 0 && unreachable.length === 0 ? true : wrong.length ? false : null,
    unreachable.length ? `unreachable on this population: ${unreachable.join(", ")}` : `checked ${EMPTY.length}, none changed`);
}

/* 2 — and still hold no rupee quantity other than the cap's own input */
{
  const offenders = [];
  for (const t of EMPTY) {
    const schema = getVariables(t) || {};
    const money = Object.entries(schema)
      .filter(([k, d]) => d?.type === "number" && CURRENCY.test(String(d.label || "")) && k !== "liability_cap_amount")
      .map(([k]) => k);
    if (money.length) offenders.push(`${t}: ${money.join(", ")}`);
  }
  record("and none of the 7 collects a rupee quantity other than liability_cap_amount",
    offenders.length === 0, offenders.join(" | ") || "schema-grounded; independent of realization");
}

/* 3 — the unilateral families still collect no counterparty */
{
  const bad = ["TERMS_OF_SERVICE", "PRIVACY_POLICY"]
    .filter((t) => { const s = getVariables(t) || {}; return s.party_2_name || s.party_2_type; });
  record("TERMS_OF_SERVICE and PRIVACY_POLICY collect no party_2", bad.length === 0,
    bad.join(", ") || "schema-grounded");
}

/* 4 — the characterisation is still unaskable */
{
  const PAT = /consumer|bargain|negotiat|standard form|adhesion|non[- ]negotiable|sophisticat/i;
  const found = [];
  for (const t of EMPTY) {
    const s = getVariables(t) || {};
    for (const [k, d] of Object.entries(s)) {
      if (PAT.test(k) || PAT.test(String(d?.label || "")) || PAT.test(String(d?.description || ""))) found.push(`${t}.${k}`);
    }
  }
  record("no family among the 7 collects consumer status or bargaining relationship",
    found.length === 0, found.join(", ") || "schema-grounded; the characterisation remains UNASKABLE");
}

/* 5 — the negotiated-cap option still produces no negotiated cap */
{
  const t = "PARTNERSHIP_DEED";
  if (!draft[t].length) record("the negotiated-cap basis still renders the fees formula", null, `${t} does not realize`);
  else {
    const vars = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
    vars.liability_cap_basis = "Direct damages only subject to a negotiated cap";
    delete vars.liability_cap_amount;
    const out = await generateDocument({ document_type: t, variables: vars });
    const text = (out?.draft?.clauses || []).find((c) => CAP.has(c.clause_id))?.text || "";
    const held = /limited to direct damages only/i.test(text) && /aggregate fees paid or payable/i.test(text) && !/₹[\d,]/.test(text);
    record("the negotiated-cap basis still renders the fees formula and no figure", held,
      held ? "unchanged" : "the option now behaves differently — re-read cap-referent.json");
  }
}

/* 6 — the engine still emits exactly two kinds of open treatment */
{
  const src = fs.readFileSync(new URL("../backend/services/documentService.js", import.meta.url), "utf8");
  const found = [...new Set((src.match(/kind: treatment\.shape \? "([A-Z_]+)" : "([A-Z_]+)"/) || []).slice(1))].sort();
  const held = JSON.stringify(found) === JSON.stringify(["AUTHORED_DECISION_PENDING", "NOT_CLASSIFIED"]);
  record("the engine still emits exactly AUTHORED_DECISION_PENDING and NOT_CLASSIFIED", held, found.join(", "));
}

/* ── what this probe deliberately does not re-derive ─────────────────────── */
console.log(`
CLASS B, NOT RE-DERIVED HERE
  Counts that depend on which families realize — "22 cap instances", "21 stating a
  formula", "4 with an indicative figure". Those are population-dependent and move
  with realization, which is blocked behind CONSTRAINT_SCOPE_DECLARATIONS. Re-pinning
  them now would pin the 29-family realization as though it were the answer.

CLASS C, NEVER PROMOTED
  The D4.27-D4.30 figures whose original population cannot be reconstructed.`);

const held = results.filter((r) => r.held === true).length;
const changed = results.filter((r) => r.held === false).length;
const unreachable = results.filter((r) => r.held === null).length;
console.log(`\n${held} hold · ${changed} changed · ${unreachable} unreachable`);
