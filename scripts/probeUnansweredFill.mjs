/**
 * probeUnansweredFill.mjs — D4.42, part D
 *
 * WHAT FILLS A SLOT THE USER LEFT UNANSWERED — measured without knowing the default.
 *
 * Part B of probePlaceholderProvenance.mjs searched shipped text for the INJECTOR's
 * default literal ("12 months"). The document's second rendering path
 * (renderHardClause in documentHardening.js) carries its own defaults in its own
 * spelling ("twelve (12) months"), so Part B reported "the default never ships" for
 * a covenant that ships a twelve-month restriction nobody chose. EIGHTH INSTRUMENT
 * FLAW: an instrument that searches for a known literal can only find the defaults
 * it already knows about.
 *
 * This part needs no literal. For every text field the form offers:
 *   supplied world — the field carries a sentinel, driven through the real form;
 *   missing world  — the field is absent; everything else identical.
 * In each clause the sentinel reached, the supplied text is split around the
 * sentinel into prefix and suffix. If the missing-world clause keeps both, whatever
 * sits between them is what filled the slot when the user said nothing. That value
 * is then attributed by execution: found in another answer → ALIAS; otherwise it
 * came from no input at all.
 *
 * Scope: text and textarea fields only (a sentinel cannot be placed in a select,
 * number or date). No generation code is changed.
 */
import fs from "fs";
import path from "path";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "docs/audit/unanswered-fill.json");
const ONLY = process.argv[2] ? process.argv[2].split(",") : null;
const FAMILIES = Object.keys(DOCUMENT_TYPE_REGISTRY).filter((t) => !ONLY || ONLY.includes(t));
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
const lc = (s) => String(s || "").toLowerCase();

const sentinelStyles = (k, i) => [`Quillfeather Marmalade Sentinel${i} arrangement`, `zqx7${k.replace(/[^a-z0-9]/gi, "")}`];
const ship = async (t, v) => {
  try {
    const out = await generateDocument({ document_type: t, variables: v });
    const clauses = out?.draft?.clauses || [];
    return clauses.length ? clauses.map((c) => ({ id: c.clause_id, text: norm(c.text) })) : null;
  } catch { return null; }
};

/* Where did an unanswered slot's fill come from? Candidates are found by searching the
   inputs actually sent (case-insensitively), then CONFIRMED by execution: the candidate
   answer is altered and the unanswered world is rendered again. Only a fill that follows
   the alteration is attributed to that answer. A search hit that does not follow is a
   coincidence (e.g. a renderer constant that happens to equal the fixture's city). */
const FOLLOW = "Zanzibarton";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function candidates(fill, inputs, key) {
  const f = lc(norm(fill)).replace(/[.;,]+$/, "");
  if (!f) return [];
  return Object.entries(inputs)
    .filter(([k, v]) => k !== key && typeof v === "string" && norm(v).length >= 3)
    .filter(([, v]) => { const w = lc(norm(v)).replace(/[.;,]+$/, ""); return w === f || f.includes(w) || w.includes(f); })
    .map(([k]) => k);
}
async function attribute(t, fill, inputs, key, clauseId, SENT, schema) {
  const f = norm(fill).replace(/[.;,]+$/, "");
  if (!f) return { source: "EMPTY_SLOT" };
  const cands = candidates(fill, inputs, key);
  if (!cands.length) return { source: "FROM_NO_INPUT" };
  /* The follow test re-runs BOTH worlds with the candidate altered and re-aligns, so an
     altered answer that merely appears elsewhere in the same clause (a party address in
     the recital) is not mistaken for the slot's source. A free-text candidate gets a
     marker appended and must carry it into the fill; a select candidate is switched to
     another of its own options and the fill must change. */
  const followed = [], notFollowed = [];
  for (const k of cands) {
    const v = norm(inputs[k]);
    const options = Array.isArray(schema?.[k]?.options) ? schema[k].options : null;
    let altered, how;
    if (options) {
      const other = options.find((o) => lc(o) !== lc(v));
      if (!other) { notFollowed.push({ field: k, why: "select with no other option", untestable: true }); continue; }
      altered = { ...inputs, [k]: other }; how = `switched to option ${JSON.stringify(other)}`;
    } else {
      const re = new RegExp(esc(f.length <= v.length ? f : v), "i");
      altered = { ...inputs, [k]: re.test(v) ? v.replace(re, (m) => `${m} ${FOLLOW}`) : `${v} ${FOLLOW}` }; how = "marker appended";
    }
    const sup2 = (await ship(t, { ...altered, [key]: SENT }))?.find((c) => c.id === clauseId)?.text;
    const mis2 = (await ship(t, altered))?.find((c) => c.id === clauseId)?.text;
    if (sup2 === undefined || mis2 === undefined) { notFollowed.push({ field: k, why: "altered world produced no draft or no such clause", untestable: true }); continue; }
    const a2 = align(sup2, mis2, SENT);
    if (!a2) { notFollowed.push({ field: k, why: "altered worlds not alignable", untestable: true }); continue; }
    const moved = options ? norm(a2.fill) !== norm(fill) : lc(a2.fill).includes(lc(FOLLOW));
    if (moved) followed.push({ field: k, how, fill_after: options ? a2.fill : undefined });
    else notFollowed.push({ field: k, why: `fill unchanged when ${how}` });
  }
  if (followed.length) return { source: "ANOTHER_ANSWER", from: followed.map((x) => x.field), follow_test: followed };
  if (notFollowed.some((x) => x.untestable)) return { source: "ATTRIBUTION_UNTESTABLE", candidates: notFollowed,
    $why: "the value also occurs in another answer, and the follow test could not be run for at least one candidate" };
  return { source: "FROM_NO_INPUT", coincident_search_hits: notFollowed,
    $why: "the value also occurs in another answer, but altering that answer did not change the fill" };
}

/* Align the unanswered clause with the answered one. Every occurrence of the sentinel
   is a slot; first try "same text, each slot refilled with one value", then fall back to
   the smallest differing middle (a renderer that drops ", Director," along with the name). */
function align(suppliedRaw, missingRaw, SENT) {
  /* List markers are renumbered when an item is withdrawn — "(e) Affiliate" becomes
     "(d) Affiliate" — which made a withdrawn definition look like a replaced one. */
  const relabel = (t) => t.replace(/\((?:[a-z]|[ivx]{1,4})\)/g, "(#)");
  const suppliedText = relabel(suppliedRaw), missingText = relabel(missingRaw);
  const parts = suppliedText.split(new RegExp(esc(SENT), "i"));
  const re = new RegExp(`^${parts.map(esc).join("(.*?)")}$`, "s");
  const m = missingText.match(re);
  if (m && m.slice(1).every((x) => x === m[1])) return { how: "EXACT_SLOT", fill: m[1] };
  let p = 0; while (p < suppliedText.length && p < missingText.length && suppliedText[p] === missingText[p]) p++;
  let s = 0; while (s < suppliedText.length - p && s < missingText.length - p && suppliedText[suppliedText.length - 1 - s] === missingText[missingText.length - 1 - s]) s++;
  const supMid = suppliedText.slice(p, suppliedText.length - s), misMid = missingText.slice(p, missingText.length - s);
  const count = (lc(supMid).match(new RegExp(esc(lc(SENT)), "g")) || []).length;
  const residue = norm(supMid.replace(new RegExp(esc(SENT), "ig"), ""));
  if (count === 1) {
    /* ≤40 characters of connective text around the sentinel: the renderer withdrew or
       replaced the PHRASE. More: it withdrew or replaced the whole SENTENCE. */
    return { how: residue.length <= 40 ? "REWORDED_SLOT" : "SENTENCE_REPLACED", fill: misMid, answered_middle: supMid };
  }
  return null;
}

const rows = [];
let n = 0;
for (const t of FAMILIES) {
  const schema = getVariables(t) || {};
  const fixture = { ...variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
  const baseline = await ship(t, fixture);
  if (!baseline) { rows.push({ family: t, state: "FAMILY_UNVERIFIABLE", why: "the well-filled fixture produces no draft" }); continue; }
  const fields = Object.entries(schema).filter(([, f]) => ["text", "textarea"].includes(f.type));
  for (const [key, f] of fields) {
    n++;
    const base = { ...fixture };
    let supplied = null, SENT = null;
    for (const s of sentinelStyles(key, n)) { supplied = await ship(t, { ...base, [key]: s }); if (supplied) { SENT = s; break; } }
    const row = { family: t, field: key, required: !!f.required, label: f.label || null };
    if (!supplied) { rows.push({ ...row, state: "SENTINEL_REJECTED" }); continue; }
    const reached = supplied.filter((c) => lc(c.text).includes(lc(SENT)));
    if (!reached.length) { rows.push({ ...row, state: "ANSWER_NOT_OBSERVED" }); continue; }
    const missingVars = { ...base }; delete missingVars[key];
    const missing = key in fixture ? await ship(t, missingVars) : baseline;
    if (!missing) { rows.push({ ...row, state: "BLOCKED_WHEN_UNANSWERED", clauses: reached.map((c) => c.id) }); continue; }
    const slots = [];
    for (const c of reached) {
      const m = missing.find((x) => x.id === c.id);
      if (!m) { slots.push({ clause_id: c.id, slot: "CLAUSE_WITHDRAWN_WHEN_UNANSWERED" }); continue; }
      const a = align(c.text, m.text, SENT);
      if (!a) {
        const i = lc(c.text).indexOf(lc(SENT));
        slots.push({ clause_id: c.id, slot: "NOT_ALIGNABLE", $why: "the unanswered clause differs beyond the slot; inspect by hand",
          supplied_excerpt: c.text.slice(Math.max(0, i - 80), i + SENT.length + 80), missing_excerpt: m.text.slice(Math.max(0, i - 80), i + 160) });
        continue;
      }
      const att = !norm(a.fill)
        ? { source: a.how === "EXACT_SLOT" ? "HOLE" : "WITHDRAWN" }
        : await attribute(t, a.fill, missingVars, key, c.id, SENT, schema);
      const selfRef = /\b(expressly (stated|recorded|set out|agreed)|described|specified) in this Agreement\b/i.test(a.fill);
      slots.push({ clause_id: c.id, slot: a.how, fill: a.fill, ...(selfRef ? { self_referential: true } : {}), ...(a.answered_middle ? { answered_middle: a.answered_middle } : {}), ...att });
    }
    const kinds = new Set(slots.map((s) => s.source || s.slot));
    const state = kinds.has("FROM_NO_INPUT") ? "FILLED_FROM_NO_INPUT"
      : kinds.has("HOLE") ? "HOLE_SHIPS"
      : kinds.has("ATTRIBUTION_UNTESTABLE") ? "FILLED_ATTRIBUTION_UNTESTABLE"
      : kinds.has("NOT_ALIGNABLE") ? "NOT_ALIGNABLE"
      : kinds.has("ANOTHER_ANSWER") ? "FILLED_FROM_ANOTHER_ANSWER"
      : kinds.has("WITHDRAWN") ? "PHRASE_OR_SENTENCE_WITHDRAWN"
      : "CLAUSE_WITHDRAWN_WHEN_UNANSWERED";
    rows.push({ ...row, state, slots });
  }
  process.stderr.write(`.${t}`);
}

const tally = (rs, pick = (r) => r.state) => rs.reduce((a, r) => ((a[pick(r)] = (a[pick(r)] || 0) + 1), a), {});
const fromNoInput = rows.filter((r) => r.state === "FILLED_FROM_NO_INPUT");
const report = {
  $probe: "probeUnansweredFill.mjs (D4.42 part D)",
  $method: "Supplied-vs-missing differential per text field, through the real form. The default is discovered, not assumed. No generation code changed.",
  $attribution_is_not_provenance: "FROM_NO_INPUT means no input string contains the fill. It does not say which rendering path chose it; the artifact records nothing either way.",
  scope: { families: FAMILIES.length, text_fields_examined: rows.filter((r) => r.field).length },
  tally: tally(rows),
  tally_required_vs_optional: { required: tally(rows.filter((r) => r.required)), optional: tally(rows.filter((r) => r.field && !r.required)) },
  self_referential_fills: rows.flatMap((r) => (r.slots || []).filter((x) => x.self_referential).map((x) => ({ family: r.family, field: r.field, clause_id: x.clause_id, fill: norm(x.fill) }))),
  distinct_fills_from_no_input: Object.entries(fromNoInput.flatMap((r) => r.slots.filter((s) => s.source === "FROM_NO_INPUT").map((s) => norm(s.fill))).reduce((a, f) => ((a[f] = (a[f] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([fill, count]) => ({ fill, count })),
  rows,
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log("\nfields:", report.scope.text_fields_examined, "tally:", JSON.stringify(report.tally));
console.log("required:", JSON.stringify(report.tally_required_vs_optional.required));
console.log("optional:", JSON.stringify(report.tally_required_vs_optional.optional));
for (const r of fromNoInput) for (const s of r.slots.filter((x) => x.source === "FROM_NO_INPUT"))
  console.log(`  ${r.family.padEnd(34)} ${r.field.padEnd(28)} ${r.required ? "REQ" : "opt"} ${s.clause_id.padEnd(30)} ${s.slot.padEnd(17)} ← ${JSON.stringify(s.fill).slice(0, 90)}`);
