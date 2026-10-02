/**
 * probePlaceholderProvenance.mjs — D4.42
 *
 * WHERE DOES A VALUE IN A SHIPPED INSTRUMENT COME FROM?
 *
 * D4.41 stopped case E because a filled placeholder cannot say which source
 * filled it. This measures that gap WITHOUT closing it: no generation code is
 * changed, and no fallback chain is copied. Attribution is by SENTINEL — a unique
 * marker placed in one source field, driven through the real form (so input
 * sanitisation applies exactly as for a user), and looked for in the shipped
 * draft. The production chains do all the choosing.
 *
 * Attribution for the investigation is not provenance for the product. This
 * answers "which source won here"; the artifact still cannot say so itself.
 *
 * Three questions:
 *   A. Which injector placeholders produce a value from NO input at all?
 *      (classified by executing injectVariables, not by reading its source)
 *   B. For each such constant default: does it ship, can the user change it,
 *      and does a blank answer behave like a missing one?
 *   C. The two independent `purpose` chains — derivePurpose (CORE_PURPOSE_001)
 *      and the recital chain in CORE_IDENTITY_001's renderer — do they select
 *      different sources for the same concept in one shipped document?
 */
import fs from "fs";
import path from "path";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { generateDocument } from "../backend/services/documentService.js";
import { injectVariables } from "../backend/services/variableInjector.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FAMILIES = Object.keys(DOCUMENT_TYPE_REGISTRY);
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
/* SEE ALSO probeUnansweredFill.mjs, which supersedes Part B's conclusion.
   FIRST RUN OF THIS PROBE WAS WRONG IN FIVE WAYS — recorded in placeholder-provenance.json.
   Case-sensitive matching missed a recital that lowercases its purpose; a free-text
   sentinel cannot survive a normalised field; the literal "0" matches any date; a value
   whose carrying clause is absent was reported as "never reaches"; families were
   dropped silently. The fixes below are each one of those. */
const has = (text, needle) => String(text || "").toLowerCase().includes(String(needle).toLowerCase());
/* SIXTH AND SEVENTH FLAWS, found on the second run. A junk-looking token is rejected by
   input validation ("must contain a sufficiently specific response"), so the probe blocked
   the generations it meant to observe — an observer effect. And a blocked supplied-world
   was then misread as "value not observed". Sentinels are now plausible words, tried in
   order; a world where every style is rejected is recorded as such, never as absence. */
const NATO = ["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliet","Kilo","Lima","Mike","November"];
let natoIndex = 0; const natoFor = new Map();
const word = (k) => { if (!natoFor.has(k)) natoFor.set(k, NATO[natoIndex++ % NATO.length] + (natoIndex > NATO.length ? String(natoIndex) : "")); return natoFor.get(k); };
const sentinelStyles = (k) => [`Quillfeather Marmalade ${word(k)} arrangement`, `zqx7${k.replace(/[^a-z0-9]/gi, "")}`];
const token = (k) => sentinelStyles(k)[0];
async function shipWithSentinel(t, base, key) {
  for (const s of sentinelStyles(key)) {
    const out = await ship(t, { ...base, [key]: s });
    if (out) return { shipped: out, sentinel: s };
  }
  return { shipped: null, sentinel: null };
}
const DISTINCTIVE = (lit) => typeof lit === "string" && lit.length >= 6 && !/^[\d\s.,]+$/.test(lit);
/* Derived by normalisation from other fields, not substituted: a sentinel cannot survive. */
const NORMALISED = new Set(["party_1_type", "party_2_type", "guarantor_type", "party_1_descriptor", "party_2_descriptor", "guarantor_descriptor"]);
const ship = async (t, v) => {
  try {
    const out = await generateDocument({ document_type: t, variables: v });
    const clauses = out?.draft?.clauses || [];
    return clauses.length ? clauses.map((c) => ({ id: c.clause_id, text: norm(c.text) })) : null;
  } catch { return null; }
};

/* ── A. Classify by EXECUTION ─────────────────────────────────────────────── */
/* Candidate keys are read from the injector's return block, then every claim
   about them is established by running injectVariables. */
const SRC = fs.readFileSync(path.join(ROOT, "backend/services/variableInjector.js"), "utf8");
const block = SRC.slice(SRC.indexOf("function buildDerivedVariables"), SRC.indexOf("function replaceVariableToken"));
const candidateKeys = [...new Set([...block.matchAll(/^\s{4}([a-z_0-9]+):/gm)].map((m) => m[1]))];

const classification = candidateKeys.map((key) => {
  const fromNothing = injectVariables(`{{${key}}}`, {});
  const producesFromNothing = fromNothing !== `{{${key}}}` && fromNothing.trim() !== "";
  const fromOwnField = injectVariables(`{{${key}}}`, { [key]: "SENTINEL_OWN" });
  return {
    key,
    produces_a_value_from_no_input: producesFromNothing,
    value_from_no_input: producesFromNothing ? fromNothing : null,
    own_field_overrides: fromOwnField === "SENTINEL_OWN",
  };
});
const DEFAULTS = classification.filter((c) => c.produces_a_value_from_no_input);

/* Synthesis: a value built from an unrelated field rather than passed through. */
const synthesis = (() => {
  const out = injectVariables("{{purpose}}", { company_name: "SENTINEL_CO" });
  return { key: "purpose", input: "company_name only", rendered: out,
    synthesised: out.includes("SENTINEL_CO") && out !== "SENTINEL_CO" };
})();

/* ── B. Constant defaults, end to end ─────────────────────────────────────── */
const defaultsReport = [];
for (const d of DEFAULTS) {
  const perFamily = [];
  if (NORMALISED.has(d.key)) {
    defaultsReport.push({ key: d.key, default_value: d.value_from_no_input, method: "NOT_ATTRIBUTABLE_BY_SENTINEL",
      why: "normalised from the party's name and declared type, not substituted — a free-text marker cannot survive it", per_family: [] });
    continue;
  }
  const distinctive = DISTINCTIVE(d.value_from_no_input);
  for (const t of FAMILIES) {
    const schema = getVariables(t) || {};
    const askable = d.key in schema;
    const base = { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
    delete base[d.key];
    const absent = await ship(t, base);
    if (!absent) { perFamily.push({ family: t, askable, state: "UNVERIFIABLE", why: "produces no draft" }); continue; }

    if (!askable) {
      if (!distinctive) { perFamily.push({ family: t, askable: false, state: "UNASKABLE_LITERAL_NOT_DISTINCTIVE", why: `the default ${JSON.stringify(d.value_from_no_input)} is too common to attribute by search` }); continue; }
      const hits = absent.filter((c) => has(c.text, d.value_from_no_input)).map((c) => c.id);
      perFamily.push(hits.length
        ? { family: t, askable: false, state: "UNASKABLE_LITERAL_PRESENT", clauses: hits, $attribution: "the form cannot supply this field; the literal is present; which code path placed it is not established" }
        : { family: t, askable: false, state: "UNASKABLE_LITERAL_ABSENT" });
      continue;
    }

    const { shipped: supplied, sentinel: SENT } = await shipWithSentinel(t, base, d.key);
    if (!supplied) { perFamily.push({ family: t, askable: true, state: "SENTINEL_REJECTED", why: "every sentinel style was refused by input validation; the supplied world could not be observed" }); continue; }
    const reached = supplied.filter((c) => has(c.text, SENT)).map((c) => c.id);
    if (!reached.length) {
      perFamily.push({ family: t, askable: true, state: "ASKED_VALUE_NOT_OBSERVED",
        $note: "the answer did not appear in any shipped clause. Either no carrying clause is present in this draft, or the value is transformed beyond recognition — not distinguished here." });
      continue;
    }
    const defaultedHere = distinctive ? reached.filter((id) => has(absent.find((c) => c.id === id)?.text, d.value_from_no_input)) : [];
    const blank = await ship(t, { ...base, [d.key]: "" });
    perFamily.push({
      family: t, askable: true,
      /* EIGHTH FLAW (retracted state name, kept visible): this was "USER_VALUE_ONLY". It
         only ever measured that the INJECTOR's literal does not ship. The second rendering
         path has its own defaults in its own spelling — NDA_NON_COMPETE_001 ships
         "twelve (12) months" when the period is unanswered. What fills an unanswered slot
         is measured without knowing the literal in probeUnansweredFill.mjs. */
      state: defaultedHere.length ? "INJECTOR_DEFAULT_SHIPS_WHEN_UNANSWERED" : (distinctive ? "INJECTOR_LITERAL_NOT_SHIPPED" : "USER_VALUE_REACHES_DEFAULT_NOT_ATTRIBUTABLE"),
      clauses_reached_by_the_user_value: reached,
      clauses_filled_by_the_default_when_unanswered: defaultedHere,
      blank_vs_missing: reached.map((id) => {
        const bt = (blank || []).find((c) => c.id === id)?.text ?? null;
        const at = absent.find((c) => c.id === id)?.text ?? null;
        return { clause_id: id, blank_and_missing_render_identically: bt === at };
      }),
    });
  }
  defaultsReport.push({ key: d.key, default_value: d.value_from_no_input, distinctive_literal: distinctive, per_family: perFamily });
}

/* ── C. The two purpose chains ─────────────────────────────────────────────── */
const PURPOSE_SOURCES = ["purpose", "services_description", "consulting_services", "business_purpose", "jv_purpose",
  "mou_purpose", "project_description", "product_description", "goods_description", "property_description",
  "security_collateral", "permitted_use"];
const purposeReport = [];
for (const t of FAMILIES) {
  const schema = getVariables(t) || {};
  const offered = PURPOSE_SOURCES.filter((f) => f in schema);
  if (offered.length < 2) { purposeReport.push({ family: t, offered, state: "CANNOT_DIVERGE", why: "the form offers fewer than two purpose sources" }); continue; }
  const v = { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
  for (const f of offered) v[f] = token(`purpose${f}`);
  const shipped = await ship(t, v);
  if (!shipped) {
    const baseline = await ship(t, { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) });
    purposeReport.push({ family: t, offered, state: baseline ? "SENTINEL_REJECTED" : "UNVERIFIABLE",
      why: baseline ? "the family generates, but not with sentinels in its purpose fields" : "produces no draft" });
    continue;
  }
  const took = (id) => {
    const text = shipped.find((c) => c.id === id)?.text;
    if (text === undefined) return undefined;
    const hits = offered.filter((f) => has(text, token(`purpose${f}`)));
    return hits.length === 1 ? hits[0] : hits.length ? hits : null;
  };
  const r = took("CORE_IDENTITY_001"), c = took("CORE_PURPOSE_001");
  let state;
  if (r === undefined || c === undefined) state = "NOT_BOTH_PRESENT";
  else if (r === null && c === null) state = "NEITHER_USES_AN_OFFERED_SOURCE";
  else if (r === null) state = "RECITAL_USES_NO_OFFERED_SOURCE";
  else if (c === null) state = "PURPOSE_CLAUSE_USES_NO_OFFERED_SOURCE";
  else if (typeof r !== "string" || typeof c !== "string") state = "INDETERMINATE";
  else state = r === c ? "AGREE" : "DIVERGE";
  purposeReport.push({ family: t, offered, state, recital_took: r ?? null, purpose_clause_took: c ?? null });
}

/* ── Report ──────────────────────────────────────────────────────────────── */
const tally = (rows, k = "state") => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] || 0) + 1), a), {});
const report = {
  $probe: "probePlaceholderProvenance.mjs (D4.42)",
  $method: "Sentinel attribution through the real form and the production chains. No generation code changed; no chain copied.",
  $attribution_is_not_provenance: "This establishes which source filled a value for the investigation. The shipped artifact still records none of it.",
  A_placeholders_classified_by_execution: { candidate_keys: candidateKeys.length, produce_a_value_from_no_input: DEFAULTS.map((d) => ({ key: d.key, value: d.value_from_no_input })), synthesis },
  B_constant_defaults: defaultsReport.map((r) => ({ ...r, tally: tally(r.per_family) })),
  C_purpose_chains: { tally: tally(purposeReport), per_family: purposeReport },
};
fs.writeFileSync(path.join(ROOT, "docs/audit/placeholder-provenance.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log("A. placeholders producing a value from NO input:");
for (const d of DEFAULTS) console.log(`   ${d.key.padEnd(24)} → ${JSON.stringify(d.value_from_no_input)}`);
console.log(`   purpose synthesis from company_name alone: ${synthesis.synthesised} → ${JSON.stringify(synthesis.rendered).slice(0, 110)}`);
console.log("\nB. constant defaults end to end:");
for (const r of report.B_constant_defaults) console.log(`   ${r.key.padEnd(24)} ${JSON.stringify(r.tally)}`);
console.log("\nC. the two purpose chains:", JSON.stringify(report.C_purpose_chains.tally));
for (const r of purposeReport.filter((x) => !["CANNOT_DIVERGE","AGREE"].includes(x.state))) console.log(`   ${r.state.padEnd(34)} ${r.family.padEnd(30)} recital←${JSON.stringify(r.recital_took)}   purpose←${JSON.stringify(r.purpose_clause_took)}`);
