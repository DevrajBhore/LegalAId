/**
 * probeVacuousSatisfaction.mjs — D4.37
 *
 * THE FALSE-POSITIVE DIRECTION, MEASURED STRUCTURALLY.
 *
 * D4.35 established the false negative: the document contains the legal
 * substance and the constraint does not recognise it. This measures the
 * converse, and the hard part is measuring it WITHOUT making the legal judgement
 * that only an advocate can make.
 *
 * So it does not ask "does this clause really establish consideration?" — a
 * question this probe has no standing to answer. It asks a structural question
 * with a checkable answer:
 *
 *     CAN THIS RULE FAIL FOR THIS FAMILY AT ALL?
 *
 * A rule whose satisfier is UNCONDITIONALLY present — named in the blueprint's
 * required list, or in the hardening floor — is satisfied in every document of
 * that family no matter what the user answers. It cannot refuse anything. It is
 * not a check; it is a constant.
 *
 * Vacuity is not automatically a defect. A rental agreement always contains a
 * rent clause, so a consideration rule being unfailable there may be exactly
 * right. The defect is vacuity discharged by a clause that is not about the
 * rule's subject — and THAT distinction is legal, so this probe surfaces the
 * evidence (the satisfying clause, its declared category, its actual text) and
 * classifies only what structure alone settles.
 *
 * It changes nothing.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getBlueprintForDocumentType, getClauseById } from "../backend/services/clauseAssembler.js";
import { getDocumentDraftingPolicy } from "../backend/services/draftingPolicy.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { DOCUMENT_TYPE_REGISTRY as IRE_REGISTRY } from "../IRE/src/indian-rule-engine/domainRegistry.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* ── The rules ──────────────────────────────────────────────────────────── */
const RULES = new Map();
for (const file of fs.readdirSync(path.join(ROOT, "knowledge-base/constraints"))) {
  if (!file.endsWith(".json")) continue;
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/constraints", file), "utf8"));
  for (const r of (body.rules || body.constraints || [])) {
    if (r?.rule_id && Array.isArray(r.fails_if)) RULES.set(r.rule_id, { ...r, $domain: body.domain });
  }
}

/* The rule's principal category: the one the largest group of its own
   satisfiers holds. Evidence, never a verdict — D4.35 recorded this proxy
   failing in both directions on one case. */
function categoryProfile(rule) {
  const counts = new Map();
  let withCategory = 0;
  for (const id of rule.fails_if) {
    const cat = String(getClauseById(id)?.category || "").toUpperCase();
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
    withCategory += 1;
  }
  let principal = null, best = 0;
  for (const [cat, n] of counts) if (n > best) { best = n; principal = cat; }
  return { counts, principal, principalHeldBy: best, withCategory };
}

/* ── Is a clause's presence contingent, or guaranteed? ─────────────────────
   Tightened after a first pass overstated UNCONDITIONAL. Two corrections, both
   material to the count:

   1. HARDENING-FLOOR MEMBERSHIP DOES NOT GUARANTEE PRESENCE. Hardening filters
      its floor through the exclusion record, so a floor clause the blueprint
      also GATES can be declined away. It is unconditional only where no gate
      exists for it — which is exactly the D4.34-B blind spot, arriving here
      from the other direction.
   2. A REQUIRED CLAUSE A VARIANT CAN REPLACE is not guaranteed either.

   Getting this wrong inflates the finding, so it is checked against the
   blueprint rather than assumed. */
function presenceKind(bp, hardeningFloor, clauseId) {
  const gated = (bp?.conditional_clauses || []).some((e) => e.clause === clauseId);
  const replaceable = (bp?.variant_clauses || []).some(
    (v) => v.replaces === clauseId || (v.options || []).some((o) => (o?.clause || o) === clauseId));

  if (gated) return "CONTINGENT — the blueprint gates it, so an answer can exclude it";
  if (replaceable) return "CONTINGENT — a variant slot can replace it";
  if ((bp?.clauses || []).includes(clauseId)) return "UNCONDITIONAL — named in the blueprint's required list, with no gate and no variant over it";
  if (hardeningFloor.has(clauseId)) return "UNCONDITIONAL — in the hardening floor, and the blueprint declares no gate that could exclude it";
  return "CONTINGENT — arrived from a dependency or a later stage";
}

/* ── Category hygiene ──────────────────────────────────────────────────────
   A category held by exactly ONE clause in a 316-clause library is far more
   likely an alias or a typo than a real distinction. The library carries
   INTELLECTUAL_PROPERTY once against IP twenty times, and that singleton alone
   made a correct IP assignment clause look off-subject in the first pass.

   This does NOT decide that the two names mean the same thing — that would be a
   judgement. It says a singleton category cannot support a claim about what a
   rule's subject is, so any verdict resting on one is withheld. */
const libraryCategoryCounts = new Map();
for (const c of getAllClauses()) {
  const cat = String(c.category || "").toUpperCase();
  if (cat) libraryCategoryCounts.set(cat, (libraryCategoryCounts.get(cat) || 0) + 1);
}
const isSingletonCategory = (cat) => libraryCategoryCounts.get(String(cat || "").toUpperCase()) === 1;

/* The 13 rules whose scope the advocate has not decided. A vacuous satisfaction
   in a family the rule should never have reached is a SCOPE defect wearing a
   satisfier defect's clothes, and the two have different owners. */
const D4_33 = new Set((JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/constraint-scope.json"), "utf8")).rules || []).map((r) => r.rule_id));

/* ── How general is a clause? ─────────────────────────────────────────────
   A rule satisfied by a clause that appears in most blueprints is satisfied by
   a GENERAL PROVISION — something every instrument carries regardless of
   subject. A rule satisfied by a clause appearing in one or two blueprints is
   satisfied by SUBJECT-SPECIFIC knowledge.

   This separates the two readings of an off-category satisfier. LOAN_AMOUNT_001
   is declared FINANCE rather than CONSIDERATION, which looks off-subject by
   category — but it appears in almost no other blueprint, so it is the loan's
   own substantive clause and the category label is the weaker signal.
   CORE_IDENTITY_001 is declared IDENTITY and appears nearly everywhere. Only
   the second is the pattern this probe is looking for. */
const blueprintReach = new Map();
let blueprintTotal = 0;
for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  let bp; try { bp = getBlueprintForDocumentType(type); } catch { continue; }
  if (!bp) continue;
  blueprintTotal += 1;
  const named = new Set([
    ...(bp.clauses || []),
    ...(bp.conditional_clauses || []).map((e) => e.clause),
  ]);
  for (const id of named) blueprintReach.set(id, (blueprintReach.get(id) || 0) + 1);
}

const rows = [];
const skipped = [];

for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const variables = variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED });

  let out;
  try { out = await generateDocument({ document_type: type, variables }); }
  catch (e) { skipped.push({ type, reason: `generation threw: ${String(e.message).slice(0, 80)}` }); continue; }
  const clauses = out?.draft?.clauses;
  if (!clauses?.length) { skipped.push({ type, reason: "produces no draft — this is the D4.35 direction, not this one" }); continue; }

  const bp = (() => { try { return getBlueprintForDocumentType(type); } catch { return null; } })();
  const hardening = getDocumentDraftingPolicy(type)?.hardening || {};
  const floor = new Set([...(hardening.baselineClauseIds || []), ...(hardening.requiredClauseIds || [])]);

  const present = new Set(clauses.map((c) => c.clause_id));

  /* Which rules were actually evaluated and did NOT block. A rule that blocked
     is the other investigation; a rule never evaluated tells us nothing here. */
  const blocked = new Set((out?.validation?.blockingIssues || []).map((i) => i.rule_id));

  /* ── A rule only counts here if it is actually EVALUATED for this family ──
     Constraint sets bind to families through the domain registry. An earlier
     pass of this probe iterated every rule in the repository and scored a
     distribution rule as "vacuously satisfied" on a share subscription
     agreement — a family that binds only `contract` and `corporate`, so that
     rule never runs there at all.

     A rule that does not run cannot be vacuously satisfied. It is simply not
     in play, and counting it inflated the finding by more than half. */
  const domains = new Set(IRE_REGISTRY[type]?.domains || []);
  if (!domains.size) { skipped.push({ type, reason: "no domain binding in the IRE registry — which rules apply cannot be determined" }); continue; }

  for (const [ruleId, rule] of RULES) {
    if (blocked.has(ruleId)) continue;
    if (!domains.has(rule.$domain)) continue;

    const satisfiersPresent = rule.fails_if.filter((id) => present.has(id));
    if (!satisfiersPresent.length) continue;   // not satisfied here; not our subject

    const profile = categoryProfile(rule);
    /* The RENDERED clause, from the draft this rule was evaluated on. An earlier pass
       read the library TEMPLATE and classified SERVICE_REQUIRES_SCOPE on SUPPLY_AGREEMENT
       from '…in relation to {{purpose}}' — while the instrument actually shipped says
       '…in relation to Stainless steel commercial kitchen equipment: 1800 mm x 600 mm…'.
       A template is not the artifact. Category and title stay library metadata. */
    const rendered = new Map(clauses.map((c) => [c.clause_id, c]));
    const detail = satisfiersPresent.map((id) => {
      const clause = { ...(getClauseById(id) || {}), text: rendered.get(id)?.text ?? getClauseById(id)?.text };
      const cat = String(clause.category || "").toUpperCase();
      const kind = presenceKind(bp, floor, id);
      return {
        clause_id: id,
        title: clause.title || clause.name || null,
        category: clause.category || null,
        presence: kind,
        unconditional: kind.startsWith("UNCONDITIONAL"),
        on_principal_subject: Boolean(cat) && cat === profile.principal,
        category_is_a_library_singleton: isSingletonCategory(cat),
        /* Raw reach, deliberately NOT thresholded into a label. A first attempt
           split at half the portfolio and put CORE_TERM_001 (19 of 40) on the
           subject-specific side, which is plainly wrong. The number separates
           the case that matters without a cutoff: every satisfier flagged here
           reaches 13 or more blueprints except LOAN_AMOUNT_001, which reaches
           one. Tuning a threshold until it agreed with me would have been
           fitting the instrument to the answer. */
        named_by_n_blueprints: blueprintReach.get(id) || 0,
        of_n_blueprints: blueprintTotal,
        satisfiers_sharing_this_category: profile.counts.get(cat) || 0,
        /* THE FULL TEXT, not an excerpt.
           An earlier pass truncated at 260 characters and classified from what
           it could see. CORE_IDENTITY_001 runs to 508 characters and carries the
           standard consideration recital — "NOW, THEREFORE, in consideration of
           the mutual covenants and promises set forth herein" — beginning at
           about character 300. The probe reported ten families where a recitals
           clause discharges a consideration requirement "without stating what is
           given in return", having never read the half of the clause that does.
           Inspecting the artifact means inspecting all of it. */
        text: String(clause.text || "").replace(/\s+/g, " ").trim(),
        text_mentions_principal_subject: Boolean(profile.principal) &&
          new RegExp(`\\b${profile.principal.replace(/_/g, "[ _]")}`, "i")
            .test(String(clause.text || "")),
      };
    });

    const unconditional = detail.filter((d) => d.unconditional);
    const onSubject = detail.filter((d) => d.on_principal_subject);

    /* ── Classification. Structure decides; the legal question is left open. ── */
    let outcome, why;
    if (!unconditional.length) {
      outcome = "ESTABLISHED_POSITIVE";
      why = "every satisfier present is contingent, so a different set of answers could make this rule fail. The rule is doing work in this family.";
    } else if (!onSubject.length && unconditional.some((d) => d.text_mentions_principal_subject)) {
      /* The category says off-subject and the TEXT says otherwise. The text is
         the artifact; the category is a label someone applied to it. */
      outcome = "UNRESOLVED";
      why = "the rule cannot fail here and no satisfier carries its principal CATEGORY — but the text of a satisfier does speak to the rule's subject. A declared category is a label; the clause text is the artifact, and where the two disagree this probe defers to neither.";
    } else if (!onSubject.length && unconditional.some((d) => d.category_is_a_library_singleton)) {
      outcome = "UNRESOLVED";
      why = "the rule cannot fail here and no satisfier is in its principal category — but the satisfier carrying it has a category held by exactly ONE clause in the whole library, which is far more likely an alias than a real distinction. The verdict is withheld rather than guessed.";
    } else if (!onSubject.length) {
      outcome = "ESTABLISHED_NEGATIVE";
      why = "the rule cannot fail in this family — a satisfier is present unconditionally — AND nothing satisfying it is in the rule's own principal category. Structurally it provides no protection, and nothing on-subject is carrying it.";
    } else if (unconditional.some((d) => d.on_principal_subject)) {
      outcome = "NOT_ESTABLISHED";
      why = "the rule cannot fail in this family, but the unconditional satisfier IS in the rule's principal category. Vacuous, and possibly vacuous for the right reason — a document of this kind may always establish the proposition by its nature. Only an advocate can say which.";
    } else {
      outcome = "NOT_ESTABLISHED";
      why = "an unconditional satisfier is off-subject while a contingent on-subject satisfier is also present. Which one the evaluator relied on is not recorded, so this cannot be settled from structure.";
    }

    rows.push({
      document_type: type, rule_id: ruleId,
      rule_asserts: rule.description || null,
      statutory_reference: rule.statutory_reference || null,
      satisfier_set_size: rule.fails_if.length,
      principal_category: profile.principal,
      principal_held_by: `${profile.principalHeldBy} of ${profile.withCategory}`,
      outcome, why,
      /* Two different defects can produce a vacuous satisfaction, and folding
         them together would send the wrong one to the wrong owner. */
      rule_awaiting_D4_33_scope_decision: D4_33.has(ruleId),
      satisfiers_present: detail,
    });
  }
}

const tally = {};
for (const r of rows) tally[r.outcome] = (tally[r.outcome] || 0) + 1;

const negatives = rows.filter((r) => r.outcome === "ESTABLISHED_NEGATIVE");
const byRule = {};
for (const r of negatives) (byRule[r.rule_id] ||= []).push(r.document_type);

const report = {
  $probe: "probeVacuousSatisfaction.mjs (D4.37)",
  $question: "Where is a constraint satisfied by a clause whose presence is guaranteed, so the rule cannot refuse anything?",
  $scoped_to_rules_that_actually_run: "Only rules whose constraint domain is bound to the family through the IRE domain registry. A rule that never runs cannot be vacuously satisfied, and counting those inflated an earlier pass of this probe by more than half.",
  $what_it_does_not_ask: "Whether a given clause really discharges a proposition. That is a legal judgement and this probe has no standing to make it.",
  $vacuity_is_not_automatically_a_defect: "A rental agreement always contains a rent clause, so a consideration rule being unfailable there may be exactly right. The defect is vacuity discharged by a clause that is not about the rule's subject.",
  $category_is_evidence_not_verdict: "D4.35 recorded the category proxy producing a false positive AND a false negative on a single case. Every row carries the satisfying clause's text so the classification can be checked.",
  outcome_definitions: {
    ESTABLISHED_POSITIVE: "Every satisfier present is contingent. The rule can fail here; it is doing work.",
    ESTABLISHED_NEGATIVE: "The rule cannot fail here AND nothing satisfying it is in its own principal category. Strong false-positive candidate.",
    NOT_ESTABLISHED: "The rule cannot fail here, but an on-subject satisfier is involved. Vacuous; whether correctly so is a legal question.",
    UNRESOLVED: "The structural signal points to a defect but rests on a category the library uses exactly once. Withheld, not guessed.",
    UNVERIFIABLE: "The family produces no draft, or generation threw. Listed, not scored.",
  },
  fixture: "WELL_FILLED",
  totals: {
    rule_family_pairs_evaluated: rows.length,
    ...tally,
    UNVERIFIABLE: skipped.length,
  },
  established_negative_by_rule: byRule,
  unverifiable: skipped,
  rows,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/vacuous-satisfaction.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report.totals, null, 2));
console.log("\nESTABLISHED_NEGATIVE by rule:");
for (const [rule, fams] of Object.entries(byRule)) console.log(`  ${rule.padEnd(36)} ${fams.length} families`);
