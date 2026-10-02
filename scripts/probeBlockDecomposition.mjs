/**
 * probeBlockDecomposition.mjs — the 11 non-generating families
 *
 * For each family that produces no draft, decompose the failure down to the
 * exact assertion that blocks, then classify the CAUSAL blocker.
 *
 *     family -> blueprint resolved? -> clauses assembled? -> intake present?
 *            -> constraints evaluated -> which assertion blocks
 *            -> scope | blueprint | intake | reachability | knowledge | engine
 *
 * THE RULE THIS PROBE OBEYS: it never reasons "add a clause, see if it
 * generates, therefore a clause was missing". That confirms a symptom responds
 * to a change; it does not establish what caused the block. Every classification
 * below is derived from declarations that already exist — the rule's satisfier
 * set, the blueprint's own lists, the intake schema, the clause library — and
 * nothing is generated a second time to test a hypothesis.
 *
 * A constraint's `fails_if` is a DISJUNCTION: the rule fails only when NONE of
 * the clauses it names is present. So "which clause is missing" is the wrong
 * question. The right one is "why is the whole satisfier set unavailable".
 *
 * It classifies. It repairs nothing.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getBlueprintForDocumentType, getClauseById } from "../backend/services/clauseAssembler.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import { documentShape } from "../shared/documentShape.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* Every rule by id, so a blocking issue can be resolved to its satisfier set. */
const RULES = new Map();
for (const file of fs.readdirSync(path.join(ROOT, "knowledge-base/constraints"))) {
  if (!file.endsWith(".json")) continue;
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/constraints", file), "utf8"));
  for (const r of (body.rules || body.constraints || [])) {
    if (r?.rule_id) RULES.set(r.rule_id, { ...r, $file: file, $domain: body.domain });
  }
}

/* The 13 whose scope the advocate has not decided. */
const D4_33 = new Set((JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/constraint-scope.json"), "utf8")).rules || []).map((r) => r.rule_id));

/* ── Where a clause id can be declared in a blueprint ───────────────────────
   Kept apart because "named unconditionally" and "named behind a condition"
   have different causes when the clause is absent. */
function blueprintPlacement(bp, clauseId) {
  const required = (bp?.clauses || []).includes(clauseId);
  const conditional = (bp?.conditional_clauses || []).filter((e) => e.clause === clauseId);
  const variant = (bp?.variant_clauses || []).filter(
    (v) => v.replaces === clauseId || (v.options || []).some((o) => (o?.clause || o) === clauseId));
  if (required) return { where: "REQUIRED" };
  if (conditional.length) return { where: "CONDITIONAL", conditions: conditional.map((e) => e.include_if) };
  if (variant.length) return { where: "VARIANT" };
  return { where: "ABSENT" };
}

/* ── Can a condition ever be true, given what the intake can collect? ───────
   Deliberately conservative. It reports UNKNOWN rather than guessing whenever
   the expression is not a simple `field op value`, because a wrong reachability
   verdict would send a real blueprint gap into the wrong bucket. */
function conditionReachable(expression, schema) {
  const text = String(expression || "").trim();
  const m = text.match(/^([A-Za-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return { verdict: "UNKNOWN", why: "expression is not a simple field/operator/value comparison" };
  const [, field, op, rawValue] = m;
  if (!(field in schema)) return { verdict: "UNREACHABLE", why: `the intake has no field "${field}", so the condition can never be satisfied` };
  const def = schema[field] || {};
  const wanted = String(rawValue).replace(/^["']|["']$/g, "").trim();
  if (op !== "==") return { verdict: "REACHABLE", why: `field "${field}" exists and the comparison is not an equality this probe can bound` };
  if (Array.isArray(def.options) && def.options.length) {
    const offerable = def.options.map((o) => String(o?.value ?? o).toLowerCase());
    const hit = offerable.includes(wanted.toLowerCase()) ||
      (/^(true|false)$/i.test(wanted) && offerable.some((o) => /^(yes|no|true|false)$/i.test(o)));
    return hit
      ? { verdict: "REACHABLE", why: `"${wanted}" is among the options the form offers for ${field}` }
      : { verdict: "UNREACHABLE", why: `the form offers ${JSON.stringify(def.options).slice(0, 90)} for ${field}, which cannot equal ${wanted}` };
  }
  return { verdict: "REACHABLE", why: `field "${field}" exists and is free-form, so the value is enterable` };
}

/* ── Does the draft already carry a clause of the same declared CATEGORY? ────
   The trap in this investigation is concluding "the blueprint is missing a
   clause" from "the rule names no clause this blueprint has". That invites
   adding a clause, which is the symptom repair the methodology forbids.

   The alternative it hides: the rule's satisfier list may be UNDER-ENUMERATED.
   A clause doing the same legal work may already be in the draft under an id
   the rule never learned.

   Tested here only by DECLARED CATEGORY, which is a fact already in the clause
   library and not a judgement of mine. Whether a same-category clause actually
   discharges the rule's proposition is a legal question and is left open. */
function sameCategoryCandidates(satisfiers, draftClauses) {
  /*
   * Category alone is too generous. CONTRACT_REQUIRES_CONSIDERATION lists
   * CORE_IDENTITY_001 among its satisfiers, so ANY identity clause matches it
   * by category — and an affidavit naming its deponent would be scored as
   * evidence of consideration, which is nonsense.
   *
   * So each candidate is weighted by how much of the rule's satisfier set
   * actually holds its category. A category held by the modal group of
   * satisfiers is the rule's real subject; one held by a single outlier is that
   * outlier's own category leaking in. Both are computed from declarations, not
   * from any view of mine about what the clauses mean.
   */
  const counts = new Map();
  let withCategory = 0;
  for (const s of satisfiers) {
    if (!s.exists_in_library) continue;
    const cat = String(getClauseById(s.clause_id)?.category || "").toUpperCase();
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
    withCategory += 1;
  }
  const modal = Math.max(0, ...counts.values());
  const named = new Set(satisfiers.map((s) => s.clause_id));

  return (draftClauses || [])
    .filter((c) => !named.has(c.clause_id) && counts.has(String(c.category || "").toUpperCase()))
    .map((c) => {
      const cat = String(c.category).toUpperCase();
      const held = counts.get(cat);
      return {
        clause_id: c.clause_id,
        category: c.category,
        satisfiers_with_this_category: held,
        satisfiers_with_any_category: withCategory,
        strength: held === modal ? "PRIMARY" : "PERIPHERAL",
        $meaning: held === modal
          ? "this category is the one the largest group of the rule's own satisfiers holds — the rule's subject"
          : `only ${held} of ${withCategory} satisfiers hold this category; the match may be an outlier satisfier's category leaking in`,
      };
    });
}

/* ── The classifier ─────────────────────────────────────────────────────────
   Ordered, and the order is the argument: an earlier verdict makes a later one
   unaskable. ENGINE first because if a satisfier IS in the draft, nothing about
   the knowledge explains the block. */
function classify({ satisfiers, shape, categoryCandidates }) {
  if (satisfiers.some((s) => s.in_draft))
    return { blocker: "ENGINE", why: "a clause that satisfies this rule is in the assembled draft, and the rule still reports it unsatisfied. Nothing in the knowledge explains that." };

  const existing = satisfiers.filter((s) => s.exists_in_library);
  if (!existing.length)
    return { blocker: "KNOWLEDGE", why: "the rule names satisfying clauses and NONE of them exists in the clause library. The rule asserts a requirement the knowledge base cannot meet in any document." };

  const placed = existing.filter((s) => s.placement.where !== "ABSENT");
  if (!placed.length) {
    /*
     * Before calling this a blueprint gap: is a clause of the same declared
     * category already in the draft? If so the rule's satisfier list is the
     * thing that is incomplete, and adding another clause would duplicate
     * legal content the document already has.
     */
    const primary = categoryCandidates.filter((c) => c.strength === "PRIMARY");
    if (primary.length)
      return {
        blocker: "SATISFIER_ENUMERATION",
        why: "this blueprint names no clause the rule lists, but the draft already carries " +
             `${primary.length} clause(s) in the rule's OWN PRINCIPAL CATEGORY. The rule's satisfier ` +
             "list may be under-enumerated rather than the blueprint incomplete. Which of the two is " +
             "true is a legal question about whether those clauses discharge the rule's proposition — " +
             "NOT settled here.",
        candidates: categoryCandidates,
      };
    return {
      blocker: "BLUEPRINT",
      why: "satisfying clauses exist in the library, this blueprint names none of them, and the draft " +
           "carries nothing in the rule's principal category either." +
           (categoryCandidates.length
             ? " Peripheral category matches were found and rejected: they match only an outlier satisfier's category, not the rule's subject."
             : ""),
      ...(categoryCandidates.length ? { rejected_peripheral_candidates: categoryCandidates } : {}),
    };
  }

  const conditional = placed.filter((s) => s.placement.where === "CONDITIONAL");
  if (placed.length === conditional.length) {
    const reach = conditional.flatMap((s) => s.reachability || []);
    if (reach.length && reach.every((r) => r.verdict === "UNREACHABLE"))
      return { blocker: "REACHABILITY", why: "every satisfying clause is behind a condition the intake can never make true. The blueprint declares a satisfier that no user answer can reach." };
    if (reach.some((r) => r.verdict === "REACHABLE"))
      return { blocker: "INTAKE", why: "a satisfying clause is available behind a condition the intake CAN make true, and this document's answers did not make it true." };
    return { blocker: "UNDETERMINED", why: "every satisfier is conditional and this probe could not bound the conditions. Not classified rather than guessed." };
  }

  return { blocker: "SCOPE_OR_SELECTION", why: "a satisfying clause is named unconditionally by this blueprint yet is not in the assembled draft. Something removed or suppressed it, or the rule should not be reaching this document at all." };
}

/* ── Walk ───────────────────────────────────────────────────────────────── */

const rows = [];
for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const variables = variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED });
  let out;
  try { out = await generateDocument({ document_type: type, variables }); } catch (e) { out = { $threw: String(e.message).slice(0, 140) }; }
  if (out?.draft?.clauses?.length) continue;   // generates: not our subject

  const row = { document_type: type, shape: (() => { try { return documentShape(type); } catch { return null; } })() };

  /* step 1 — blueprint resolved? */
  let bp = null;
  try { bp = getBlueprintForDocumentType(type); } catch (e) { row.blueprint_error = String(e.message).slice(0, 120); }
  row.blueprint_resolved = Boolean(bp);
  if (!bp) { row.blocker = "ENGINE"; row.why = "no blueprint resolves for this document type"; rows.push(row); continue; }

  /* step 2 — clause set assembled? */
  let draft = null;
  try { draft = assembleDocument(type, variables); } catch (e) { row.assembly_error = String(e.message).slice(0, 140); }
  row.clauses_assembled = draft?.clauses?.length ?? 0;
  const inDraft = new Set((draft?.clauses || []).map((c) => c.clause_id));

  /* step 3 — intake: which declared-required fields did the fixture not fill? */
  const schema = getVariables(type) || {};
  row.intake_fields = Object.keys(schema).length;
  row.required_fields_unfilled = Object.entries(schema)
    .filter(([k, d]) => d?.required && (variables[k] === undefined || variables[k] === ""))
    .map(([k]) => k);

  /* step 4 — the exact assertions that block */
  const blocking = out?.validation?.blockingIssues || [];
  row.blocking_rules = [...new Set(blocking.map((i) => i.rule_id))];

  /* step 5 — decompose each blocker */
  row.decomposition = row.blocking_rules.map((ruleId) => {
    const rule = RULES.get(ruleId);
    if (!rule) return { rule_id: ruleId, blocker: "ENGINE", why: "the validator reported a rule id that exists in no constraints file" };

    const satisfiers = (rule.fails_if || []).map((clauseId) => {
      const exists = Boolean(getClauseById(clauseId));
      const placement = blueprintPlacement(bp, clauseId);
      const s = { clause_id: clauseId, exists_in_library: exists, in_draft: inDraft.has(clauseId), placement };
      if (placement.where === "CONDITIONAL") s.reachability = placement.conditions.map((c) => ({ condition: c, ...conditionReachable(c, schema) }));
      return s;
    });

    const categoryCandidates = sameCategoryCandidates(satisfiers, draft?.clauses);
    const verdict = classify({ satisfiers, shape: row.shape, categoryCandidates });
    return {
      rule_id: ruleId,
      asserts: rule.description || null,
      statutory_reference: rule.statutory_reference || null,
      satisfier_count: satisfiers.length,
      satisfiers_existing_in_library: satisfiers.filter((s) => s.exists_in_library).length,
      satisfiers_named_by_this_blueprint: satisfiers.filter((s) => s.placement.where !== "ABSENT").length,
      declares_scope: Boolean(rule.applies_to_doc_types || rule.excludes_doc_types || rule.excludes_shapes),
      awaiting_D4_33_scope_decision: D4_33.has(ruleId),
      ...verdict,
      /*
       * The whole document, so a reader can check the verdict instead of
       * trusting it. The category test is a PROXY and it has been observed to
       * fail in both directions on real cases: it offered IPA_MORAL_RIGHTS_001
       * as evidence of an ownership clause (moral rights are, under Copyright
       * Act 1957 s.57, precisely the rights that are NOT assigned), while
       * missing IPA_COPYRIGHT_ASSIGNMENT_001 — the actual operative grant —
       * because that clause is declared category PURPOSE rather than IP.
       *
       * So a verdict resting only on the category signal is a lead, not a
       * finding. This field is what lets the difference be seen.
       */
      draft_contents: (draft?.clauses || []).map((c) => ({ clause_id: c.clause_id, category: c.category, title: c.title || null })),
      satisfiers,
    };
  });

  /* The family's blocker is the set of its rules' blockers: a family can be
     held by two different causes at once, and collapsing them to one would
     hide whichever is repaired second. */
  row.blockers = [...new Set(row.decomposition.map((d) => d.blocker))];
  row.all_blocking_rules_awaiting_scope = row.decomposition.length > 0 &&
    row.decomposition.every((d) => d.awaiting_D4_33_scope_decision);
  rows.push(row);
}

const byBlocker = {};
for (const r of rows) for (const b of r.blockers || [r.blocker]) (byBlocker[b] ||= []).push(r.document_type);

const report = {
  $probe: "probeBlockDecomposition.mjs",
  $question: "For each family that produces no draft, which exact assertion blocks, and what CAUSED the block?",
  $method_rule: "No hypothesis is tested by generating again with a change. Every verdict is derived from declarations that already exist: the rule's satisfier set, the blueprint's lists, the intake schema, the clause library.",
  $fails_if_is_a_disjunction: "A rule fails only when NONE of the clauses it names is present. 'Which clause is missing' is the wrong question; 'why is the whole satisfier set unavailable' is the right one.",
  $classifies_does_not_repair: true,
  $the_category_test_is_a_proxy: [
    "SATISFIER_ENUMERATION is reached by comparing declared clause categories. That is a proxy for the",
    "legal question 'does this clause discharge the rule's proposition', and it has been seen to fail in",
    "both directions. Every such verdict carries draft_contents so it can be checked, and none of them",
    "is treated as established without a reading of the actual clauses.",
  ],
  fixture: "WELL_FILLED",
  families_not_generating: rows.length,
  by_blocker: byBlocker,
  group_1_all_blockers_awaiting_D4_33_scope: rows.filter((r) => r.all_blocking_rules_awaiting_scope).map((r) => r.document_type),
  group_2_not_fully_explained_by_D4_33: rows.filter((r) => !r.all_blocking_rules_awaiting_scope).map((r) => r.document_type),
  rows,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/block-decomposition.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(`families not generating: ${rows.length}\n`);
for (const r of rows) {
  console.log(`${r.document_type}  [${r.shape}]  assembled=${r.clauses_assembled}  unfilled_required=${(r.required_fields_unfilled || []).length}`);
  for (const d of r.decomposition || []) {
    console.log(`    ${d.rule_id.padEnd(34)} ${String(d.blocker).padEnd(18)} satisfiers ${d.satisfiers_existing_in_library}/${d.satisfier_count} exist, ${d.satisfiers_named_by_this_blueprint} named here${d.awaiting_D4_33_scope_decision ? "  (D4.33)" : ""}`);
  }
}
console.log("\nby blocker:", JSON.stringify(byBlocker, null, 2));
