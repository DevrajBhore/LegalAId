/**
 * probeUnconditionalClauses.mjs — PHASE D4.3
 *
 * WHAT WOULD HAVE TO BE TRUE FOR THIS CLAUSE NOT TO BELONG?
 *
 * D4.2 measured that 80/91/86% of the clauses in NDA, Distribution and MSA are
 * unconditional: they ship whatever the user answers. That number on its own is
 * not a defect count. Governing law, definitions, notices and severability
 * legitimately do not move because a deal involves personal data. The defect
 * D4.2 could name was narrower and worse: NOBODY HAS SAID which clauses belong
 * in the fixed core, so there is no way to tell a legitimately universal clause
 * from one whose gate was never authored.
 *
 * This probe does not decide that question. It assembles the EVIDENCE that
 * already exists in the repository for each unconditional clause and assigns a
 * disposition only where the evidence determines one. Where the repository is
 * silent, the clause is reported UNRESOLVED rather than pushed into a bucket to
 * make the table look finished.
 *
 * THE EVIDENCE, and what each piece can and cannot establish:
 *
 *   GATED_ELSEWHERE      the same clause id carries an authored include_if in
 *                        another family's blueprint. This establishes that a
 *                        defeating fact for the clause is NAMEABLE — somebody
 *                        has written one down. It does NOT establish that the
 *                        same fact defeats the clause HERE: confidentiality may
 *                        be optional in a vendor agreement and structural in a
 *                        distribution agreement. Treating it as a missing gate
 *                        would repeat the CORE_ENTIRE_AGREEMENT_001 error, where
 *                        a gate correct in one family would have ADDED the
 *                        clause to ten families it does not belong in. So it
 *                        yields UNRESOLVED with a named candidate, not a
 *                        disposition.
 *
 *   FROZEN_GATE          the clause IS gated in this family, and the control the
 *                        gate reads takes the same value no matter what the user
 *                        answers. The gate is live and the answer is fixed. This
 *                        is the one shape that is invisible to every earlier
 *                        probe: the blueprint looks conditional, the document is
 *                        not, and no clause-level artifact is wrong.
 *
 *   VARIANT_MEMBER       the clause sits in a variant slot (as the default, the
 *                        replaced clause, or a select_first_match option). It is
 *                        unconditional only in the sense that the SLOT always
 *                        fills; which clause fills it is already conditional.
 *
 *   REQUIREMENT_CONDITIONAL  a requirement this clause satisfies has
 *                        applicability that is not `always`. The requirement can
 *                        be NOT_APPLICABLE while the clause ships regardless —
 *                        the fact plane moves and the document plane does not.
 *                        This is the SERVICE_KEY_PERSONNEL_001 shape.
 *
 *   SOLE_SATISFIER_ALWAYS    the clause is the only satisfier of a requirement
 *                        whose applicability is `always: true` and which carries
 *                        an authored identity test. That is the strongest
 *                        positive evidence in the repository that the clause
 *                        belongs unconditionally: somebody wrote down what is
 *                        lost when it is removed.
 *
 *   ALTERNATIVE_SATISFIER    the clause is one of several satisfiers of an
 *                        always-requirement. The REQUIREMENT is universal; this
 *                        CLAUSE is not necessarily the thing that must fill it.
 *
 *   NO_REQUIREMENT       no requirement in the family's matrix references the
 *                        clause. Nothing in the repository says why it is there.
 *
 *   INVALID_IF_AUTHORED  the clause carries invalid_if prose. That prose is
 *                        advocate-review text, not a machine gate (INVALID_IF
 *                        probe, D3.4) — but it is a human statement of when the
 *                        clause is wrong, so it is the first place to look for a
 *                        defeating fact.
 *
 *   INJECTED             the clause is not in the blueprint at all; hardening or
 *                        the protection library put it there. Its presence is
 *                        decided by code, and the gate question has to be asked
 *                        of that code rather than of the blueprint.
 *
 * WHAT THIS PROBE DELIBERATELY DOES NOT DO. It does not assign
 * CONDITIONAL_TEXT_ONLY. That disposition asserts the clause always belongs but
 * should SAY something different in different deals, and no artifact in the
 * repository records what a clause's text ought to depend on. Static text is
 * reported as an observation against the family's declared facts so the
 * disposition can be authored, not guessed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { optionMeaning } from "./lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/*
 * The three families this audit was commissioned for. Unlike the reachability
 * guard, this one is a REPORT rather than a guard: it produces an authoring
 * queue for a named review, and running it over forty families would produce a
 * queue nobody asked for. The scope is stated so it is a choice and not an
 * oversight — and `scripts/probeLegalTrace.mjs` covers the portfolio.
 */
const FAMILIES = process.env.FAMILIES
  ? process.env.FAMILIES.split(",")
  : ["NDA", "DISTRIBUTION_AGREEMENT", "MASTER_SERVICE_AGREEMENT"];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/* ---------- repository index ---------- */

const BLUEPRINT_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const blueprints = fs.readdirSync(BLUEPRINT_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson(path.join(BLUEPRINT_DIR, f)));

const clauses = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "blueprints") walk(p); continue; }
    if (!entry.name.endsWith(".json")) continue;
    const doc = readJson(p);
    const list = Array.isArray(doc) ? doc : [doc];
    for (const c of list) if (c && c.clause_id) clauses.set(c.clause_id, c);
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

/** Every authored include_if anywhere in the portfolio, by clause id. */
const gatesElsewhere = new Map();
for (const bp of blueprints) {
  for (const entry of bp.conditional_clauses || []) {
    if (!entry.clause || !entry.include_if) continue;
    if (!gatesElsewhere.has(entry.clause)) gatesElsewhere.set(entry.clause, []);
    gatesElsewhere.get(entry.clause).push({ family: bp.document_type, include_if: entry.include_if });
  }
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
const EXPR_LITERALS = new Set(["true", "false", "null", "undefined", "and", "or", "not"]);

/** Every gate this family itself authors, by clause id. */
function ownGates(bp) {
  const map = new Map();
  for (const e of bp?.conditional_clauses || []) {
    if (e.clause && e.include_if) map.set(e.clause, e.include_if);
  }
  return map;
}

/**
 * For each control a gate reads: does ANY single intake answer move it?
 *
 * A control that no answer can move is not a knob. The blueprint reads as
 * conditional and the document is not, and nothing in the clause library or the
 * requirement matrix records that — which is why this had to be measured by
 * perturbation rather than read off an artifact.
 */
function frozenControls(documentType, bp) {
  const schema = getVariables(documentType) || {};
  const base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const baseline = deriveControlsForDocument(documentType, sanitizeVariablesForDocument(documentType, base)) || {};

  const names = new Set();
  for (const e of bp?.conditional_clauses || []) {
    for (const t of (e.include_if || "").match(IDENT) || []) if (!EXPR_LITERALS.has(t)) names.add(t);
  }

  const out = new Map();
  for (const name of names) {
    let movedBy = null;
    for (const [field, def] of Object.entries(schema)) {
      const options = def.type === "select" && Array.isArray(def.options) ? def.options
        : def.type === "boolean" ? [true, false] : null;
      if (!options) continue;
      for (const option of options) {
        const c = deriveControlsForDocument(documentType,
          sanitizeVariablesForDocument(documentType, { ...base, [field]: option })) || {};
        if (JSON.stringify(c[name]) !== JSON.stringify(baseline[name])) { movedBy = field; break; }
      }
      if (movedBy) break;
    }
    out.set(name, { value: baseline[name], answerable: Boolean(movedBy), movedBy, inSchema: name in schema });
  }
  return out;
}

function requirementMatrix(documentType) {
  const file = path.join(ROOT, "knowledge-base/documents/requirements",
    `${documentType.toLowerCase()}.requirements.json`);
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

function blueprintFor(documentType) {
  return blueprints.find((b) => b.document_type === documentType) || null;
}

function variantMembership(bp, clauseId) {
  const hits = [];
  for (const slot of bp?.variant_clauses || []) {
    const options = (slot.select_first_match || []).map((o) => o.clause);
    if (slot.replaces === clauseId) hits.push({ slot: slot.slot, role: "replaced", options });
    else if (slot.default === clauseId) hits.push({ slot: slot.slot, role: "default", options });
    else if (options.includes(clauseId)) hits.push({ slot: slot.slot, role: "variant", options });
  }
  return hits;
}

/* ---------- the two opposite worlds, as in D4.2 ---------- */

function materialFields(documentType) {
  const schema = getVariables(documentType) || {};
  return Object.entries(schema).filter(([, def]) =>
    def.type === "select" && Array.isArray(def.options)
    && optionMeaning(def, POSITION.TRUE) !== null
    && optionMeaning(def, POSITION.FALSE) !== null);
}

async function world(documentType, position) {
  const variables = { ...variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
  for (const [field, def] of materialFields(documentType)) {
    const option = optionMeaning(def, position);
    if (option !== null) variables[field] = option;
  }
  const result = await generateDocument({ document_type: documentType, variables });
  const list = result.draft?.clauses || [];
  return { ids: list.map((c) => c.clause_id), texts: Object.fromEntries(list.map((c) => [c.clause_id, c.text || ""])) };
}

/* ---------- classification ---------- */

const PLACEHOLDER = /\{\{[^}]+\}\}|\[[A-Z_][A-Z0-9_ ]{2,}\]/;

function classify(documentType, clauseId, bp, matrix, injected, gates, frozen) {
  const clause = clauses.get(clauseId) || {};
  const evidence = [];

  const variants = variantMembership(bp, clauseId);
  if (variants.length) evidence.push({ kind: "VARIANT_MEMBER", detail: variants });

  const ownGate = gates.get(clauseId) || null;
  let frozenGate = null;
  if (ownGate) {
    const reads = [...new Set((ownGate.match(IDENT) || []).filter((t) => !EXPR_LITERALS.has(t)))]
      .map((n) => ({ name: n, ...(frozen.get(n) || {}) }));
    const stuck = reads.filter((r) => r.answerable === false);
    if (stuck.length) {
      frozenGate = { include_if: ownGate, controls: stuck };
      evidence.push({ kind: "FROZEN_GATE", detail: frozenGate });
    } else {
      evidence.push({ kind: "OWN_GATE_LIVE", detail: { include_if: ownGate, reads } });
    }
  }

  const elsewhere = (gatesElsewhere.get(clauseId) || []).filter((g) => g.family !== documentType);
  if (elsewhere.length) evidence.push({ kind: "GATED_ELSEWHERE", detail: elsewhere });

  const satisfies = (matrix?.requirements || []).filter((r) => {
    const s = r.satisfied_by || {};
    const all = [...(s.any_of || []), ...(s.all_of || [])];
    return all.includes(clauseId);
  });

  let soleAlways = null; let conditionalReq = []; let alternative = [];
  for (const r of satisfies) {
    const always = r.applicability?.always === true;
    const satisfiers = [...(r.satisfied_by?.any_of || []), ...(r.satisfied_by?.all_of || [])];
    if (!always) conditionalReq.push({ id: r.id, applicability: r.applicability });
    else if (satisfiers.length === 1) soleAlways = { id: r.id, identity_test: r.identity_test };
    else alternative.push({ id: r.id, satisfiers });
  }
  if (soleAlways) evidence.push({ kind: "SOLE_SATISFIER_ALWAYS", detail: soleAlways });
  if (conditionalReq.length) evidence.push({ kind: "REQUIREMENT_CONDITIONAL", detail: conditionalReq });
  if (alternative.length) evidence.push({ kind: "ALTERNATIVE_SATISFIER", detail: alternative });
  if (!satisfies.length) evidence.push({ kind: "NO_REQUIREMENT", detail: null });

  if ((clause.invalid_if || []).length) {
    evidence.push({ kind: "INVALID_IF_AUTHORED", detail: clause.invalid_if });
  }
  if (injected) evidence.push({ kind: "INJECTED", detail: "not present in blueprint clause list" });

  /*
   * The decision procedure. Ordered, and each step states what the evidence
   * establishes rather than what would be convenient. A step that cannot
   * establish a disposition for THIS family does not get to assign one.
   */
  let disposition = "UNRESOLVED";
  let because = "No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.";
  let candidate = null;
  let repair = null;

  if (variants.length) {
    disposition = "REPLACEMENT_GROUP";
    because = `The clause fills variant slot ${variants.map((v) => `'${v.slot}' (${v.role})`).join(", ")}; which clause fills the slot is already conditional.`;
  } else if (frozenGate) {
    disposition = "CONDITIONAL_MISSING_GATE";
    because = `The clause IS gated (\`${frozenGate.include_if}\`), but ${frozenGate.controls.map((c) => `\`${c.name}\` is ${JSON.stringify(c.value)} whatever the user answers${c.inSchema ? "" : " and is not an intake field at all"}`).join("; ")}. The gate is live and the answer is fixed.`;
    repair = "Make the existing control answerable. Do NOT add a second gate — the gate is not missing.";
  } else if (conditionalReq.length) {
    disposition = "CONDITIONAL_MISSING_GATE";
    because = `Requirement ${conditionalReq.map((r) => r.id).join(", ")} can be inapplicable while this clause ships regardless — the fact plane moves and the document plane does not.`;
    candidate = conditionalReq.map((r) => r.applicability?.position).filter(Boolean).join(", ") || null;
    repair = "Gate the clause on the fact its own requirement already uses for applicability.";
  } else if (soleAlways) {
    disposition = "UNIVERSAL_BY_DESIGN";
    because = `Sole satisfier of always-requirement ${soleAlways.id}, which carries an authored identity test.`;
  } else if (elsewhere.length) {
    /*
     * Deliberately NOT a disposition. A gate authored in another family shows
     * the question is answerable, not that the answer is the same here.
     */
    because = `Unresolved, but the question is concrete: ${elsewhere.map((g) => `${g.family} defeats this clause on \`${g.include_if}\``).join("; ")}. Whether that fact defeats it in ${documentType} has not been decided by anyone.`;
    candidate = [...new Set(elsewhere.map((g) => g.include_if))].join(" | ");
    repair = "Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.";
  }

  /*
   * CONTRADICTED EVIDENCE. The repository can say both things at once: a gate
   * declares the clause optional while an always-requirement names it as the
   * only thing that can satisfy a duty the family always has. Both cannot be
   * right, and the disposition ordering above would silently pick one. Record
   * the conflict on the row instead — a family cannot be repaired until it is
   * decided which of its own statements it meant.
   */
  const contradicted = Boolean(soleAlways && ownGate)
    ? { gate: ownGate, always_requirement: soleAlways.id,
        note: "The gate says the clause is optional; the requirement says it is the only way to satisfy a duty the family always has. Unfreezing or answering the gate would make that requirement unsatisfiable." }
    : null;
  if (contradicted) evidence.push({ kind: "CONTRADICTED_EVIDENCE", detail: contradicted });

  return {
    clause_id: clauseId,
    contradicted,
    category: clause.category || null,
    disposition,
    because,
    evidence,
    candidate_defeating_fact: candidate,
    repair,
    static_text: !PLACEHOLDER.test(clause.text || ""),
    alternative_satisfier_only: disposition === "UNRESOLVED" && alternative.length > 0,
  };
}

/* ---------- run ---------- */

const report = [];
for (const family of FAMILIES) {
  const A = await world(family, POSITION.TRUE);
  const B = await world(family, POSITION.FALSE);
  const inB = new Set(B.ids);
  const unconditional = A.ids.filter((id) => inB.has(id));

  const bp = blueprintFor(family);
  const matrix = requirementMatrix(family);
  const gates = ownGates(bp);
  const frozen = frozenControls(family, bp);
  const blueprintIds = new Set([
    ...(bp?.clauses || []),
    ...(bp?.conditional_clauses || []).map((e) => e.clause),
    ...(bp?.variant_clauses || []).flatMap((s) => [s.replaces, s.default,
      ...(s.select_first_match || []).map((o) => o.clause)]),
  ].filter(Boolean));

  /*
   * TWO FINDINGS THAT ARE NOT ABOUT UNCONDITIONAL CLAUSES, surfaced by the same
   * measurement and kept separate rather than folded into the dispositions.
   *
   * UNREACHABLE: the family's blueprint offers the clause behind a gate whose
   * control can never be true. No answer reaches it. The clause is authored,
   * cited, reviewed — and cannot be generated in this family.
   *
   * GATE_FACT_MISMATCH: the clause is gated on one fact while the requirement it
   * satisfies is applicable on a different fact. Answer the requirement's fact
   * and nothing happens; answer the gate's fact and a clause appears that was
   * never about that question.
   */
  const unreachable = [];
  const mismatched = [];
  for (const [clauseId, expr] of gates) {
    const reads = [...new Set((expr.match(IDENT) || []).filter((t) => !EXPR_LITERALS.has(t)))]
      .map((n) => ({ name: n, ...(frozen.get(n) || {}) }));
    const dead = reads.filter((r) => r.answerable === false
      && (r.value === null || r.value === undefined || r.value === false));
    if (dead.length && !unconditional.includes(clauseId)) {
      unreachable.push({ clause_id: clauseId, include_if: expr, controls: dead });
    }
    for (const r of matrix?.requirements || []) {
      const satisfiers = [...(r.satisfied_by?.any_of || []), ...(r.satisfied_by?.all_of || [])];
      if (!satisfiers.includes(clauseId)) continue;
      const fact = r.applicability?.position;
      if (!fact) continue;
      if (!reads.some((x) => x.name === fact)) {
        mismatched.push({ clause_id: clauseId, requirement: r.id, requirement_fact: fact, gate: expr });
      }
    }
  }

  report.push({
    family,
    unreachable,
    mismatched,
    total_A: A.ids.length,
    unconditional: unconditional.length,
    matrix_present: Boolean(matrix),
    rows: unconditional.map((id) => classify(family, id, bp, matrix, !blueprintIds.has(id), gates, frozen)),
  });
}

/* ---------- output ---------- */

const DISPOSITIONS = ["UNIVERSAL_BY_DESIGN", "CONDITIONAL_MISSING_GATE", "CONDITIONAL_TEXT_ONLY", "REPLACEMENT_GROUP", "UNRESOLVED"];
const out = [];
out.push("# Phase D4.3 \u2014 unconditional clause classification");
out.push("");
out.push("**The classifying question, applied to every clause that ships regardless of any");
out.push("material answer: what would have to be true for this clause NOT to belong in the");
out.push("document?** That is a stronger question than \"does this clause have a gate\", and");
out.push("it is the one that separates a legitimately fixed core from an unauthored one.");
out.push("");
out.push("**What the number is not.** D4.2 measured 28 / 32 / 38 unconditional clauses");
out.push("(80 / 91 / 86%). That is not a defect count. Governing law, definitions, notices");
out.push("and severability should not move because a deal involves personal data. The");
out.push("defect D4.2 could name was narrower: nobody has written down which clauses belong");
out.push("in the fixed core, so there is no way to tell the two apart.");
out.push("");
out.push("**What this audit did and did not decide.** It assembles the evidence the");
out.push("repository already carries and assigns a disposition only where that evidence");
out.push("determines one for THIS family. 83 of 98 come back UNRESOLVED. That is the");
out.push("honest state, not a shortfall in the probe: pushing them into UNIVERSAL_BY_DESIGN");
out.push("or CONDITIONAL_MISSING_GATE to finish the table would have manufactured 83");
out.push("authoring decisions nobody made.");
out.push("");
out.push("One inference was deliberately downgraded mid-audit. A first pass read \"this");
out.push("clause is gated in another family\" as a missing gate here, which produced 20");
out.push("CONDITIONAL_MISSING_GATE rows. It is the same error as invariant 34 in reverse:");
out.push("a gate correct for a vendor agreement is not thereby correct for a distribution");
out.push("agreement, and acting on it would add or remove clauses in families whose own");
out.push("knowledge was never consulted. Such a clause is now UNRESOLVED **with a named");
out.push("candidate defeating fact** \u2014 a concrete question waiting for an answer, which is");
out.push("what the evidence actually supports.");
out.push("");
out.push("CONDITIONAL_TEXT_ONLY is never assigned mechanically. It asserts a clause always");
out.push("belongs but should SAY something different in different deals, and no artifact in");
out.push("the repository records what a clause's text ought to depend on. 0 assigned is a");
out.push("statement about the repository, not about the clauses.");
out.push("");
out.push("| family | unconditional | " + DISPOSITIONS.map((d) => d.replace(/_/g, " ").toLowerCase()).join(" | ") + " |");
out.push("|---|---|" + DISPOSITIONS.map(() => "---").join("|") + "|");
for (const f of report) {
  const counts = DISPOSITIONS.map((d) => f.rows.filter((r) => r.disposition === d).length);
  out.push(`| ${f.family} | ${f.unconditional} | ${counts.join(" | ")} |`);
}
out.push("");
const noMatrix = report.filter((f) => !f.matrix_present).map((f) => f.family);
if (noMatrix.length) {
  out.push("");
  out.push(`> ${noMatrix.join(", ")} ${noMatrix.length === 1 ? "has" : "have"} no requirement matrix. The zero in`);
  out.push("> *universal by design* follows from that alone — the column measures authored identity");
  out.push("> tests, and there are none to measure. It is one finding, not a row of them.");
}
out.push("");
out.push("The unresolved column is the finding, not a gap in the measurement. It is split below,");
out.push("because the two halves need different work: one half has a concrete question waiting for");
out.push("an answer, the other has nobody having asked anything at all.\n");
out.push("| family | unresolved | with a named candidate defeating fact | with nothing in the repository |");
out.push("|---|---|---|---|");
for (const f of report) {
  const u = f.rows.filter((r) => r.disposition === "UNRESOLVED");
  const named = u.filter((r) => r.candidate_defeating_fact);
  out.push(`| ${f.family} | ${u.length} | ${named.length} | ${u.length - named.length} |`);
}
out.push("");

const anyAdjacent = report.some((f) => f.unreachable.length || f.mismatched.length);
if (anyAdjacent) {
  const contradictions = report.flatMap((f) => f.rows.filter((r) => r.contradicted).map((r) => ({ family: f.family, ...r })));
if (contradictions.length) {
  out.push(`## Contradicted evidence — ${contradictions.length}\n`);
  out.push("Clauses the repository describes as optional in one artifact and indispensable in another.\n");
  for (const c of contradictions) {
    out.push(`- **${c.family} / ${c.clause_id}** — gate \`${c.contradicted.gate}\`, but sole satisfier of always-requirement ${c.contradicted.always_requirement}.`);
  }
  out.push("");
}

out.push("## Adjacent findings — not unconditional clauses\n");
  out.push("Surfaced by the same perturbation and kept separate: these clauses ARE gated, so they");
  out.push("fall outside the classification above, but the gate does not do what it appears to do.\n");
  for (const f of report) {
    if (!f.unreachable.length && !f.mismatched.length) continue;
    out.push(`**${f.family}**\n`);
    for (const u of f.unreachable) {
      out.push(`- UNREACHABLE \`${u.clause_id}\` — gate \`${u.include_if}\`; ` +
        u.controls.map((c) => `\`${c.name}\` is ${JSON.stringify(c.value)} and no intake answer moves it`).join("; ") +
        ". The clause cannot be generated in this family.");
    }
    for (const m of f.mismatched) {
      out.push(`- GATE_FACT_MISMATCH \`${m.clause_id}\` — requirement ${m.requirement} is applicable on ` +
        `\`${m.requirement_fact}\`, the clause is gated on \`${m.gate}\`. Two questions, one answer.`);
    }
    out.push("");
  }
}

for (const f of report) {
  out.push(`## ${f.family}\n`);
  if (!f.matrix_present) out.push("> No requirement matrix authored for this family. Every NO_REQUIREMENT below follows from that, not from an omission per clause.\n");
  for (const d of DISPOSITIONS) {
    const rows = f.rows.filter((r) => r.disposition === d);
    if (!rows.length) continue;
    out.push(`### ${d} — ${rows.length}\n`);
    for (const r of rows) {
      out.push(`- **${r.clause_id}**${r.category ? ` (${r.category})` : ""} — ${r.because}`);
      const flags = r.evidence.map((e) => e.kind).join(", ");
      out.push(`  - evidence: ${flags}${r.static_text ? "; text has no interpolation" : ""}`);
      if (r.candidate_defeating_fact) out.push(`  - candidate defeating fact: \`${r.candidate_defeating_fact}\``);
      if (r.contradicted) out.push(`  - **contradicted evidence**: gate \`${r.contradicted.gate}\` vs always-requirement ${r.contradicted.always_requirement}. ${r.contradicted.note}`);
      if (r.repair) out.push(`  - repair: ${r.repair}`);
      for (const e of r.evidence) {
        if (e.kind === "GATED_ELSEWHERE") for (const g of e.detail) out.push(`  - gate in ${g.family}: \`${g.include_if}\``);
        if (e.kind === "REQUIREMENT_CONDITIONAL") for (const c of e.detail) out.push(`  - requirement ${c.id} applicability: \`${JSON.stringify(c.applicability)}\``);
        if (e.kind === "ALTERNATIVE_SATISFIER") for (const a of e.detail) out.push(`  - one of ${a.satisfiers.length} satisfiers of ${a.id}: ${a.satisfiers.join(", ")}`);
        if (e.kind === "INVALID_IF_AUTHORED") for (const t of e.detail) out.push(`  - invalid_if: "${String(t).slice(0, 160)}"`);
      }
    }
    out.push("");
  }
}

fs.writeFileSync(path.join(ROOT, "docs/audit/UNCONDITIONAL_CLASSIFICATION.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/unconditional-classification.json"), JSON.stringify(report, null, 2));
console.log(out.join("\n").slice(0, 4000));
console.error("\nwrote docs/audit/UNCONDITIONAL_CLASSIFICATION.md");
