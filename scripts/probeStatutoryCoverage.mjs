/**
 * probeStatutoryCoverage.mjs — PHASE D4.4-B
 *
 * WHAT LAW DOES A DOCUMENT STOP CITING WHEN A GATE CLOSES?
 *
 * D4.3 found `SERVICE_KEY_PERSONNEL_001` gated on `include_sla` while the
 * requirement it satisfies, PERSONNEL_CONTINUITY, is applicable on
 * `key_person_dependency`. The obvious repair is to move the gate onto the legal
 * fact. It is wrong, and this probe exists because the argument for why it is
 * wrong should be a measurement rather than an opinion.
 *
 * THE CLAUSE DOES TWO JOBS. Its first limb records that the parties intended
 * performance by particular individuals — Indian Contract Act 1872 s.40, which
 * is exactly the law of key-person dependency, and whose DEFAULT is that a
 * promisor "may employ a competent person to perform it". The clause displaces
 * that default; it does not invent a restriction.
 *
 * Its last sentence does something else entirely: it states that the deployed
 * personnel remain the Service Provider's employees and that it alone bears
 * their wages and statutory contributions. That is Code on Wages 2019 s.43 and
 * EPF Act 1952 s.8A — the Client's exposure as principal employer — and it is
 * true of ANY services engagement, whether or not particular individuals matter.
 *
 * So gating the whole clause on `key_person_dependency` would delete the only
 * sentence in a Master Service Agreement that allocates principal-employer
 * exposure, for every engagement that does not depend on named people. A
 * specificity repair would have produced a legal regression, and every existing
 * check would have stayed green: the clause baseline would record an intended
 * diff, the requirement would report correctly NOT_APPLICABLE, coherence would
 * hold, and falsification would pass.
 *
 * WHAT THIS PROBE MEASURES. For a proposed gate, generate with it open and with
 * it closed, and report the Acts that disappear from the document's cited
 * authority ENTIRELY — not the clause that went, but the law that stopped being
 * addressed. A clause may leave freely when another clause covers the same Act.
 * A clause that takes the last citation of a statute with it is a different
 * event and needs an authored decision.
 *
 * WHY THIS IS NOT AN ARGUMENT FOR KEEPING EVERY CLAUSE. Losing an Act is not
 * automatically wrong: an agreement with no personal data should stop citing the
 * DPDP Act. The probe reports the loss and names the Act; whether the loss is
 * correct is a legal question, and this layer is not permitted to answer it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Proposed gate changes to evaluate. Each says: if this clause were driven by
 * this fact, what would a document look like when the fact is false?
 */
const PROPOSALS = [
  {
    documentType: "MASTER_SERVICE_AGREEMENT",
    clause: "SERVICE_KEY_PERSONNEL_001",
    fact: "key_person_dependency",
    requirement: "PERSONNEL_CONTINUITY",
    note: "D4.3 GATE_FACT_MISMATCH: gated on include_sla, requirement applicable on key_person_dependency.",
  },
];

/** Every Act a document cites, across every clause it emits. */
function citedActs(clauses) {
  const acts = new Map();
  for (const clause of clauses) {
    for (const basis of clause.legal_basis || []) {
      if (!basis.act) continue;
      const key = basis.section ? `${basis.act} s.${basis.section}` : basis.act;
      if (!acts.has(key)) acts.set(key, []);
      acts.get(key).push(clause.clause_id);
    }
  }
  return acts;
}

async function draft(documentType, overrides) {
  const variables = { ...variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }), ...overrides };
  const result = await generateDocument({ document_type: documentType, variables });
  return result.draft?.clauses || [];
}

const rows = [];
for (const proposal of PROPOSALS) {
  const full = await draft(proposal.documentType, {});
  if (!full.length) { rows.push({ ...proposal, error: "does not generate" }); continue; }

  /*
   * The counterfactual is built by REMOVING the clause from the emitted set
   * rather than by answering the fact "no". Answering no would also move every
   * other gate that reads the same controls, and the loss could not be
   * attributed to this clause. The question here is narrow: what does THIS
   * clause carry that nothing else does?
   */
  const without = full.filter((c) => c.clause_id !== proposal.clause);
  if (without.length === full.length) {
    rows.push({ ...proposal, error: "clause not present in the baseline document" });
    continue;
  }

  const before = citedActs(full);
  const after = citedActs(without);
  const lostEntirely = [...before.keys()].filter((act) => !after.has(act));

  /* Which of the clause's own citations survive elsewhere, and which do not. */
  const clause = full.find((c) => c.clause_id === proposal.clause);
  const carried = (clause.legal_basis || []).map((b) => {
    const key = b.section ? `${b.act} s.${b.section}` : b.act;
    return { key, note: b.note, alsoIn: (before.get(key) || []).filter((id) => id !== proposal.clause) };
  });

  rows.push({
    ...proposal,
    clauses_before: full.length,
    lost_entirely: lostEntirely,
    carried,
    sole_custodian: carried.filter((c) => !c.alsoIn.length).map((c) => c.key),
  });
}

const out = [];
out.push("# Phase D4.4-B — statutory coverage under a proposed gate\n");
out.push("Before moving a clause behind a legal fact, what law does the document stop citing when");
out.push("that fact is false? A clause may leave freely where another covers the same Act. A clause");
out.push("that takes the last citation of a statute with it is a different event.\n");
out.push("Losing an Act is not automatically wrong — an agreement with no personal data should stop");
out.push("citing the DPDP Act. The probe names the loss; whether it is correct is a legal question");
out.push("and this layer is not permitted to answer it.\n");

for (const row of rows) {
  out.push(`## ${row.documentType} / \`${row.clause}\`\n`);
  out.push(`Proposed driver: \`${row.fact}\` (requirement ${row.requirement})`);
  out.push(`> ${row.note}\n`);
  if (row.error) { out.push(`**Not evaluated:** ${row.error}\n`); continue; }

  out.push(`The clause cites ${row.carried.length} authorities. Of those, **${row.sole_custodian.length} appear`);
  out.push(`nowhere else in the document**:\n`);
  for (const c of row.carried) {
    const where = c.alsoIn.length ? `also in ${c.alsoIn.join(", ")}` : "**sole custodian**";
    out.push(`- \`${c.key}\` — ${where}`);
    if (!c.alsoIn.length && c.note) out.push(`  - ${c.note}`);
  }
  out.push("");
  if (row.lost_entirely.length) {
    out.push(`**Gating this clause on \`${row.fact}\` would remove these authorities from the document`);
    out.push(`entirely whenever the fact is false:**\n`);
    for (const act of row.lost_entirely) out.push(`- ${act}`);
    out.push("");
  } else {
    out.push("No authority is lost: every Act this clause cites is addressed by another clause too.\n");
  }
}

fs.writeFileSync(path.join(ROOT, "docs/audit/STATUTORY_COVERAGE.md"), out.join("\n"));
fs.writeFileSync(path.join(ROOT, "docs/audit/statutory-coverage.json"), JSON.stringify(rows, null, 2));
console.log(out.join("\n"));
