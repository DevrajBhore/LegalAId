/**
 * probePropositionReuse.mjs — PHASE D4.5-B
 *
 * DO MULTIPLE INDEPENDENTLY AUTHORED CLAUSES IMPLEMENT THE SAME LEGAL PROPOSITION?
 *
 * This is the falsification that decides whether a TREATMENT layer is justified.
 *
 *   NO  -> proposition A in clause A, proposition B in clause B. The clause
 *          remains the smallest independently selectable legal unit, and a
 *          treatment object would be one-to-one with clauses: indirection
 *          without capability.
 *
 *   YES -> the same proposition is implemented by clauses that were written
 *          separately. Then `proposition -> treatment -> several clause
 *          implementations` describes something the knowledge base actually
 *          contains, and the abstraction is empirically earned rather than
 *          assumed from a diagram.
 *
 * WHY A BIASED SAMPLE, AND WHY THAT IS THE RIGHT CHOICE. Twelve clauses out of
 * 315 chosen at random would almost never collide, and the absence of collisions
 * would say nothing about the library — only about the sampling. So the sample
 * is deliberately loaded toward reuse: variant-slot groups the library already
 * calls alternatives, a pair suspected of overlapping, and the known composite
 * clause. A negative result from a sample built to find reuse is strong. A
 * positive result from it is weak on frequency and still tells us the shape
 * exists, which is the question being asked.
 *
 * THE CONTROL SET IS LOAD-BEARING. `CORE_GOVERNING_LAW_001` and
 * `CORE_NOTICE_001` must share no proposition with anything else. A method that
 * assigned the same proposition to everything would report magnificent reuse
 * while measuring nothing at all; if the controls collide, the propositions are
 * drawn too broadly and the reuse result must be discarded rather than believed.
 *
 * WHAT REUSE DOES NOT SETTLE. Two clauses implementing one proposition can mean
 * two things, and this probe cannot separate them: DELIBERATE ALTERNATIVES (a
 * confidentiality obligation at ordinary and heightened strength, selected by
 * context) or ACCIDENTAL DUPLICATION (two rental clauses written at different
 * times for the same duty). The first argues for a treatment layer. The second
 * argues for deduplication. The probe reports which groups are backed by an
 * authored variant slot and which are not, and leaves the reading to an
 * advocate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const propositions = new Map(
  readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"))
    .propositions.map((p) => [p.proposition_id, p]));

/* every clause that declares what it implements */
const clauses = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "blueprints") walk(p); continue; }
    if (!entry.name.endsWith(".json") || entry.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) if (c?.clause_id) clauses.push(c);
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

const declared = clauses.filter((c) => Array.isArray(c.implements) && c.implements.length);

/* variant slots: where the library itself calls clauses alternatives */
const BP = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const alternativeGroups = [];
for (const file of fs.readdirSync(BP).filter((f) => f.endsWith(".json"))) {
  const bp = readJson(path.join(BP, file));
  for (const slot of bp.variant_clauses || []) {
    const ids = [...new Set([slot.default, slot.replaces,
      ...(slot.select_first_match || []).map((o) => o.clause)].filter(Boolean))];
    if (ids.length > 1) alternativeGroups.push({ documentType: bp.document_type, slot: slot.slot, ids });
  }
}
const isAuthoredAlternative = (ids) =>
  alternativeGroups.find((g) => ids.every((id) => g.ids.includes(id)));

/* ── the measurement ──────────────────────────────────────────────────────── */

const byProposition = new Map();
for (const c of declared) {
  for (const id of c.implements) {
    if (!byProposition.has(id)) byProposition.set(id, []);
    byProposition.get(id).push(c.clause_id);
  }
}

const reused = [...byProposition.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([id, ids]) => ({
    proposition_id: id,
    clauses: ids.sort(),
    authored_alternative: Boolean(isAuthoredAlternative(ids)),
    slot: isAuthoredAlternative(ids)?.slot || null,
  }));

const composite = declared.filter((c) => c.implements.length > 1);

/* controls */
const CONTROLS = declared.filter((c) => c._implements_note);
const controlCollisions = CONTROLS.filter((c) =>
  c.implements.some((id) => (byProposition.get(id) || []).length > 1));

/* ── report ───────────────────────────────────────────────────────────────── */

const out = [];
out.push("# Phase D4.5-B — do separate clauses implement the same legal proposition?\n");
out.push("The falsification that decides whether a TREATMENT layer is earned. A proposition");
out.push("implemented by exactly one clause is a fragment of that clause; naming it a treatment adds");
out.push("indirection and no capability. A proposition implemented by clauses written separately is");
out.push("a thing the knowledge base contains.\n");
out.push("**The sample is deliberately biased toward finding reuse** — variant-slot groups, a");
out.push("suspected overlapping pair, the known composite clause — because twelve random clauses out");
out.push("of 315 would almost never collide and their not colliding would say nothing. A negative");
out.push("result from a sample built to find reuse is strong; a positive one tells us the shape");
out.push("exists but nothing about how often.\n");

out.push("## Control set\n");
if (controlCollisions.length) {
  out.push("**THE MEASUREMENT IS INVALID.** Control clauses collided with the sampled groups:\n");
  for (const c of controlCollisions) out.push(`- \`${c.clause_id}\` shares ${c.implements.join(", ")}`);
  out.push("\nThe propositions are drawn too broadly. The reuse result below must be discarded, not");
  out.push("believed: a vocabulary that assigns one proposition to everything reports perfect reuse");
  out.push("while measuring nothing.\n");
} else {
  out.push(`${CONTROLS.length} control clauses (${CONTROLS.map((c) => `\`${c.clause_id}\``).join(", ")}) share no`);
  out.push("proposition with any sampled group, so the vocabulary discriminates and the result below");
  out.push("is about the library rather than about the method.\n");
}

out.push("## Result\n");
out.push(`${declared.length} clauses declare what they implement, across ${byProposition.size} propositions.`);
out.push(`**${reused.length} propositions are implemented by more than one clause.**\n`);

if (reused.length) {
  out.push("| proposition | clauses | the library already calls these alternatives |");
  out.push("|---|---|---|");
  for (const r of reused) {
    out.push(`| \`${r.proposition_id}\` | ${r.clauses.map((c) => `\`${c}\``).join(", ")} | ` +
      `${r.authored_alternative ? `yes — variant slot \`${r.slot}\`` : "**no**"} |`);
  }
  out.push("");
  const unbacked = reused.filter((r) => !r.authored_alternative);
  if (unbacked.length) {
    out.push("### Reuse the library does not account for\n");
    out.push("These propositions are implemented by several clauses with no variant slot saying so.");
    out.push("That is either an unrecorded alternative — a treatment the system has and cannot name —");
    out.push("or accidental duplication. The two call for opposite repairs, and this probe cannot");
    out.push("tell them apart; an advocate reading the texts can.\n");
    for (const r of unbacked) {
      out.push(`- \`${r.proposition_id}\` — ${r.clauses.join(", ")}`);
      const p = propositions.get(r.proposition_id);
      if (p) out.push(`  - ${p.statement}`);
    }
    out.push("");
  }
}

out.push("## Composite clauses\n");
out.push(`**${composite.length}** of the sampled clauses implement more than one proposition.\n`);
for (const c of composite) {
  out.push(`- \`${c.clause_id}\` implements ${c.implements.length}:`);
  for (const id of c.implements) {
    const p = propositions.get(id);
    const others = (byProposition.get(id) || []).filter((x) => x !== c.clause_id);
    out.push(`  - \`${id}\`${others.length ? ` (also in ${others.join(", ")})` : " — **implemented nowhere else**"}`);
    if (p) out.push(`    - ${p.authority.map((a) => `${a.act} s.${a.section}`).join("; ")}`);
  }
}
out.push("");
out.push("A proposition implemented nowhere else, inside a clause gated on a different proposition,");
out.push("is the D4.4-B failure stated precisely: closing the gate removes a rule the document has no");
out.push("other way to express.\n");

fs.writeFileSync(path.join(ROOT, "docs/audit/PROPOSITION_REUSE.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/proposition-reuse.json"),
  JSON.stringify({ declared: declared.length, reused, composite: composite.map((c) => c.clause_id),
    control_collisions: controlCollisions.map((c) => c.clause_id) }, null, 2));
console.log(out.join("\n"));
