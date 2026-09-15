# Phase D4.3 — unconditional clause classification

**The classifying question, applied to every clause that ships regardless of any
material answer: what would have to be true for this clause NOT to belong in the
document?** That is a stronger question than "does this clause have a gate", and
it is the one that separates a legitimately fixed core from an unauthored one.

**What the number is not.** D4.2 measured 28 / 32 / 38 unconditional clauses
(80 / 91 / 86%). That is not a defect count. Governing law, definitions, notices
and severability should not move because a deal involves personal data. The
defect D4.2 could name was narrower: nobody has written down which clauses belong
in the fixed core, so there is no way to tell the two apart.

**What this audit did and did not decide.** It assembles the evidence the
repository already carries and assigns a disposition only where that evidence
determines one for THIS family. 83 of 98 come back UNRESOLVED. That is the
honest state, not a shortfall in the probe: pushing them into UNIVERSAL_BY_DESIGN
or CONDITIONAL_MISSING_GATE to finish the table would have manufactured 83
authoring decisions nobody made.

One inference was deliberately downgraded mid-audit. A first pass read "this
clause is gated in another family" as a missing gate here, which produced 20
CONDITIONAL_MISSING_GATE rows. It is the same error as invariant 34 in reverse:
a gate correct for a vendor agreement is not thereby correct for a distribution
agreement, and acting on it would add or remove clauses in families whose own
knowledge was never consulted. Such a clause is now UNRESOLVED **with a named
candidate defeating fact** — a concrete question waiting for an answer, which is
what the evidence actually supports.

CONDITIONAL_TEXT_ONLY is never assigned mechanically. It asserts a clause always
belongs but should SAY something different in different deals, and no artifact in
the repository records what a clause's text ought to depend on. 0 assigned is a
statement about the repository, not about the clauses.

| family | unconditional | universal by design | conditional missing gate | conditional text only | replacement group | unresolved |
|---|---|---|---|---|---|---|
| NDA | 28 | 6 | 0 | 0 | 0 | 22 |
| DISTRIBUTION_AGREEMENT | 32 | 0 | 1 | 0 | 1 | 30 |
| MASTER_SERVICE_AGREEMENT | 38 | 4 | 3 | 0 | 0 | 31 |


> DISTRIBUTION_AGREEMENT has no requirement matrix. The zero in
> *universal by design* follows from that alone — the column measures authored identity
> tests, and there are none to measure. It is one finding, not a row of them.

The unresolved column is the finding, not a gap in the measurement. It is split below,
because the two halves need different work: one half has a concrete question waiting for
an answer, the other has nobody having asked anything at all.

| family | unresolved | with a named candidate defeating fact | with nothing in the repository |
|---|---|---|---|
| NDA | 22 | 3 | 19 |
| DISTRIBUTION_AGREEMENT | 30 | 6 | 24 |
| MASTER_SERVICE_AGREEMENT | 31 | 8 | 23 |

## Contradicted evidence — 1

Clauses the repository describes as optional in one artifact and indispensable in another.

- **MASTER_SERVICE_AGREEMENT / SERVICE_CUSTOMER_DEPENDENCIES_001** — gate `include_deliverables == true`, but sole satisfier of always-requirement CLIENT_SIDE_OBLIGATIONS.

## Adjacent findings — not unconditional clauses

Surfaced by the same perturbation and kept separate: these clauses ARE gated, so they
fall outside the classification above, but the gate does not do what it appears to do.

**DISTRIBUTION_AGREEMENT**

- UNREACHABLE `CORE_INSURANCE_001` — gate `include_insurance == true`; `include_insurance` is null and no intake answer moves it. The clause cannot be generated in this family.

**MASTER_SERVICE_AGREEMENT**

- UNREACHABLE `CORE_INSURANCE_001` — gate `include_insurance == true`; `include_insurance` is null and no intake answer moves it. The clause cannot be generated in this family.
- UNREACHABLE `CORE_RESIDUAL_KNOWLEDGE_001` — gate `include_confidentiality == true`; `include_confidentiality` is undefined and no intake answer moves it. The clause cannot be generated in this family.
- GATE_FACT_MISMATCH `SERVICE_KEY_PERSONNEL_001` — requirement PERSONNEL_CONTINUITY is applicable on `key_person_dependency`, the clause is gated on `include_sla == true`. Two questions, one answer.

## NDA

### UNIVERSAL_BY_DESIGN — 6

- **NDA_CONFIDENTIAL_INFORMATION_SCOPE_001** (CONFIDENTIALITY) — Sole satisfier of always-requirement SUBJECT_MATTER_BOUNDED, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Information already lawfully in the public domain"
  - invalid_if: "Information legally required to be disclosed by a court or regulatory body"
- **NDA_THIRD_PARTY_DISCLOSURE_001** (CONFIDENTIALITY) — Sole satisfier of always-requirement ONWARD_DISCLOSURE_CONTROLLED, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Disclosure to third parties without any confidentiality obligation on recipient"
  - invalid_if: "No restriction on further disclosure by Permitted Recipients"
- **NDA_RETURN_OF_INFORMATION_001** (CONFIDENTIALITY) — Sole satisfier of always-requirement RETURN_OR_DESTRUCTION, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 2 satisfiers of CONTINUING_OBLIGATION_AFTER_RETURN: NDA_RETURN_OF_INFORMATION_001, CORE_RESIDUAL_KNOWLEDGE_001
  - invalid_if: "Return obligation does not cover electronically stored information"
  - invalid_if: "No obligation to certify destruction of Confidential Information"
- **NDA_EXCLUSIONS_001** (EXCLUSIONS) — Sole satisfier of always-requirement CESSATION_CIRCUMSTANCES_IDENTIFIED, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "The exclusion definition inadvertently covers information intended to be highly confidential or a trade secret."
  - invalid_if: "The exclusions are so broad as to negate the primary purpose of the Non-Disclosure Agreement."
  - invalid_if: "Contradicts specific statutory or regulatory requirements regarding information secrecy."
- **NDA_DISCLOSURE_PERMITTED_001** (EXCLUSIONS) — Sole satisfier of always-requirement COMPELLED_DISCLOSURE_ADDRESSED, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Absolute Prohibition on Disclosure"
- **NDA_BREACH_REMEDIES_001** (REMEDIES) — Sole satisfier of always-requirement BREACH_HAS_A_REMEDY, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "If the contract contains an exclusive remedies clause."
  - invalid_if: "If specific performance or injunctive relief is explicitly waived for certain breaches."
  - invalid_if: "If the contract provides for liquidated damages as the sole remedy for breach."

### UNRESOLVED — 22

- **CORE_IDENTITY_001** (IDENTITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT
- **CORE_DEFINITIONS_001** (DEFINITIONS) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SERVICE_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SOFTWARE_DEVELOPMENT_AGREEMENT defeats this clause on `include_nomenclature_clause != false`. Whether that fact defeats it in NDA has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_nomenclature_clause != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_nomenclature_clause != false`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SERVICE_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_nomenclature_clause != false`
  - invalid_if: "Key terms are undefined or ambiguous"
- **CORE_INTERPRETATION_001** (INTERPRETATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INJECTED; text has no interpolation
- **NDA_DATA_SECURITY_001** (CONFIDENTIALITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 2 satisfiers of OBLIGATIONS_OF_RECIPIENT: CORE_CONFIDENTIALITY_001, NDA_DATA_SECURITY_001
  - invalid_if: "The agreement does not involve the transfer or access to data that requires security measures."
  - invalid_if: "Specific data security measures are exhaustively defined in another part of the agreement, rendering this general clause redundant or conflicting."
- **CORE_LIABILITY_LIMIT_FALLBACK_001** (RISK) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The cap purports to exclude liability for death or personal injury caused by negligence, or for fraud, which cannot be limited by contract."
  - invalid_if: "The cap is expressed per claim where the parties intended an aggregate ceiling, so the stated limit is not the real exposure."
- **NDA_DURATION_001** (TERM) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 2 satisfiers of CONFIDENTIALITY_PERIOD_STATED: NDA_DURATION_001, NDA_TERM_SURVIVAL_001
  - invalid_if: "The stipulated duration is deemed an unreasonable restraint of trade under Section 27 of the Indian Contract Act, 1872."
- **NDA_TERM_SURVIVAL_001** (TERM) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER; text has no interpolation
  - one of 2 satisfiers of CONFIDENTIALITY_PERIOD_STATED: NDA_DURATION_001, NDA_TERM_SURVIVAL_001
- **CORE_TERM_001** (TERM) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Agreement duration is undefined"
  - invalid_if: "Termination mechanism absent"
- **CORE_FORCE_MAJEURE_001** (FORCE_MAJEURE) — Unresolved, but the question is concrete: COMMERCIAL_LEASE_AGREEMENT defeats this clause on `long_term_lease != false`; LEAVE_AND_LICENSE_AGREEMENT defeats this clause on `include_force_majeure != false`; SALES_OF_GOODS_AGREEMENT defeats this clause on `include_force_majeure != false`. Whether that fact defeats it in NDA has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `long_term_lease != false | include_force_majeure != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in COMMERCIAL_LEASE_AGREEMENT: `long_term_lease != false`
  - gate in LEAVE_AND_LICENSE_AGREEMENT: `include_force_majeure != false`
  - gate in SALES_OF_GOODS_AGREEMENT: `include_force_majeure != false`
  - invalid_if: "Force majeure events defined too broadly"
  - invalid_if: "Clause used to excuse negligence"
- **CORE_SURVIVAL_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Critical clauses terminate automatically after contract termination"
- **CORE_TERMINATION_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Termination rights granted to only one party without justification"
  - invalid_if: "No cure period provided"
- **CORE_NOTICE_001** (NOTICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Method of communication unclear"
- **CORE_ASSIGNMENT_001** (ASSIGNMENT) — Unresolved, but the question is concrete: SUPPLY_AGREEMENT defeats this clause on `assignment_addressed != false`. Whether that fact defeats it in NDA has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `assignment_addressed != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in SUPPLY_AGREEMENT: `assignment_addressed != false`
  - invalid_if: "Assignment allowed in contracts where personal obligations exist"
- **CORE_AMENDMENT_001** (AMENDMENT) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Amendments allowed without written consent"
- **CORE_WAIVER_001** (WAIVER) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Waiver implied without clear intent"
- **CORE_SEVERABILITY_001** (SEVERABILITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Entire contract becomes void if a single clause fails"
- **CORE_FURTHER_ASSURANCE_001** (FURTHER_ASSURANCE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The further acts sought are outside the scope of the obligations expressly created by this Agreement"
  - invalid_if: "Performance of the further act would be unlawful or require a consent that has been refused by a competent authority"
- **CORE_DISPUTE_RESOLUTION_001** (DISPUTE_RESOLUTION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED
  - invalid_if: "Dispute resolution mechanism is entirely absent"
  - invalid_if: "Clause omits the seat of arbitration"
  - invalid_if: "Clause omits any arbitrator appointment mechanism"
  - invalid_if: "Clause restricts access to courts absolutely"
- **CORE_GOVERNING_LAW_001** (GOVERNING_LAW) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT; text has no interpolation
- **CORE_COUNTERPARTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INJECTED; text has no interpolation
- **CORE_STAMP_AND_COSTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The document is executed in a State whose stamp legislation prescribes a different incidence of duty than allocated here"
  - invalid_if: "The parties have separately agreed in writing that one party bears the entire stamp duty and registration cost"
- **CORE_SIGNATURE_BLOCK_001** (SIGNATURE_BLOCK) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement not signed by authorized representatives"

## DISTRIBUTION_AGREEMENT

> No requirement matrix authored for this family. Every NO_REQUIREMENT below follows from that, not from an omission per clause.

### CONDITIONAL_MISSING_GATE — 1

- **CORE_GOVERNANCE_PROTECTIONS_001** (GOVERNANCE) — The clause IS gated (`include_governance_protections == true`), but `include_governance_protections` is true whatever the user answers and is not an intake field at all. The gate is live and the answer is fixed.
  - evidence: FROZEN_GATE, GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - repair: Make the existing control answerable. Do NOT add a second gate — the gate is not missing.
  - gate in CONSULTANCY_AGREEMENT: `include_governance_protections == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_governance_protections == true`
  - gate in JOINT_VENTURE_AGREEMENT: `include_governance_protections == true`
  - gate in MASTER_SERVICE_AGREEMENT: `include_governance_protections == true`
  - gate in SERVICE_AGREEMENT: `include_governance_protections == true`
  - gate in SUPPLY_AGREEMENT: `include_governance_protections == true`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_governance_protections == true`
  - invalid_if: "An audit right is drafted so broadly that it permits access to the other Party's records unrelated to this Agreement."
  - invalid_if: "An escalation mechanism is drafted as a condition precedent to approaching a court or tribunal in a way that ousts jurisdiction."
  - invalid_if: "The clause requires disclosure of information the disclosing Party is barred by law or by a third-party obligation from disclosing."

### REPLACEMENT_GROUP — 1

- **DIST_APPOINTMENT_EXCLUSIVE_001** (SUPPLY) — The clause fills variant slot 'distribution_exclusivity' (variant); which clause fills the slot is already conditional.
  - evidence: VARIANT_MEMBER, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Exclusivity drafted as absolute territorial protection / resale price maintenance causing AAEC under Competition Act 2002 s.3(4)"
  - invalid_if: "Post-term restraint on the distributor (void under ICA s.27)"

### UNRESOLVED — 30

- **CORE_IDENTITY_001** (IDENTITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT
- **CORE_PURPOSE_001** (PURPOSE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED
  - invalid_if: "Purpose of agreement not specified"
- **CORE_DEFINITIONS_001** (DEFINITIONS) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SERVICE_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SOFTWARE_DEVELOPMENT_AGREEMENT defeats this clause on `include_nomenclature_clause != false`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `include_nomenclature_clause != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_nomenclature_clause != false`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SERVICE_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_nomenclature_clause != false`
  - invalid_if: "Key terms are undefined or ambiguous"
- **CORE_INTERPRETATION_001** (INTERPRETATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INJECTED; text has no interpolation
- **CORE_RELATIONSHIP_OF_PARTIES_001** (RELATIONSHIP) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The actual conduct of the parties, notwithstanding the contractual terms, establishes a different legal relationship in substance."
- **SERVICE_PAYMENT_001** (CONSIDERATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Payment terms exceed 45 days for MSME vendors contrary to MSMED Act 2006"
  - invalid_if: "Interest rate exceeds 24% per annum raising usury concerns"
  - invalid_if: "Invoice requirements do not comply with GST Act 2017"
- **SUPPLY_DELIVERY_001** (DELIVERY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Incoterms clause"
  - invalid_if: "Risk of Loss clause"
  - invalid_if: "Acceptance of Goods clause"
- **SERVICE_SCOPE_001** (SERVICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Services are not clearly defined"
- **SUPPLY_GOODS_DESCRIPTION_001** (SUPPLY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "The description of goods is vague, uncertain, or incomplete."
- **DIST_COMPETITION_COMPLIANCE_001** (SUPPLY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: OWN_GATE_LIVE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Used as cover while operative clauses still impose RPM or absolute territorial protection"
- **CORE_CONFIDENTIALITY_001** (CONFIDENTIALITY) — Unresolved, but the question is concrete: VENDOR_AGREEMENT defeats this clause on `include_confidentiality == true`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_confidentiality == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in VENDOR_AGREEMENT: `include_confidentiality == true`
  - invalid_if: "Confidential Information is not defined"
  - invalid_if: "No exclusions exist"
- **IP_TRADEMARK_USAGE_001** (IP) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Trademark licence not registered with Trade Marks Registry where required"
  - invalid_if: "Licensee permitted to sublicense Licensed Marks without Licensor approval"
  - invalid_if: "No quality control provisions over use of Licensed Marks"
- **SUPPLY_WARRANTY_001** (WARRANTY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Warranty period less than statutory minimum for consumer goods"
  - invalid_if: "Warranty excludes implied conditions of merchantability under Sale of Goods Act 1930"
  - invalid_if: "Warranty restricted to repair only without refund or replacement option"
- **CORE_INDEMNITY_001** (RISK) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_indemnity_clause == true`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SERVICE_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SOFTWARE_DEVELOPMENT_AGREEMENT defeats this clause on `include_indemnity_clause == true`; VENDOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_indemnity_clause == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_indemnity_clause == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_indemnity_clause == true`
  - gate in SERVICE_AGREEMENT: `include_indemnity_clause == true`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_indemnity_clause == true`
  - gate in VENDOR_AGREEMENT: `include_indemnity_clause == true`
  - invalid_if: "Indemnity is unlimited or vague"
- **CORE_LIMITATION_LIABILITY_001** (RISK) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_indemnity_clause == true`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SERVICE_AGREEMENT defeats this clause on `include_indemnity_clause == true`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `include_indemnity_clause == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_indemnity_clause == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_indemnity_clause == true`
  - gate in SERVICE_AGREEMENT: `include_indemnity_clause == true`
  - invalid_if: "Liability is excluded for fraud or wilful misconduct"
- **CORE_TERM_001** (TERM) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement duration is undefined"
  - invalid_if: "Termination mechanism absent"
- **CORE_FORCE_MAJEURE_001** (FORCE_MAJEURE) — Unresolved, but the question is concrete: COMMERCIAL_LEASE_AGREEMENT defeats this clause on `long_term_lease != false`; LEAVE_AND_LICENSE_AGREEMENT defeats this clause on `include_force_majeure != false`; SALES_OF_GOODS_AGREEMENT defeats this clause on `include_force_majeure != false`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `long_term_lease != false | include_force_majeure != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in COMMERCIAL_LEASE_AGREEMENT: `long_term_lease != false`
  - gate in LEAVE_AND_LICENSE_AGREEMENT: `include_force_majeure != false`
  - gate in SALES_OF_GOODS_AGREEMENT: `include_force_majeure != false`
  - invalid_if: "Force majeure events defined too broadly"
  - invalid_if: "Clause used to excuse negligence"
- **SERVICE_TERMINATION_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Termination for convenience with less than 15 days notice without compensation"
  - invalid_if: "No payment obligation for work completed before termination"
- **CORE_SURVIVAL_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Critical clauses terminate automatically after contract termination"
- **CORE_NOTICE_001** (NOTICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Method of communication unclear"
- **CORE_ASSIGNMENT_001** (ASSIGNMENT) — Unresolved, but the question is concrete: SUPPLY_AGREEMENT defeats this clause on `assignment_addressed != false`. Whether that fact defeats it in DISTRIBUTION_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `assignment_addressed != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in SUPPLY_AGREEMENT: `assignment_addressed != false`
  - invalid_if: "Assignment allowed in contracts where personal obligations exist"
- **CORE_AMENDMENT_001** (AMENDMENT) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Amendments allowed without written consent"
- **CORE_WAIVER_001** (WAIVER) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Waiver implied without clear intent"
- **CORE_SEVERABILITY_001** (SEVERABILITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Entire contract becomes void if a single clause fails"
- **CORE_FURTHER_ASSURANCE_001** (FURTHER_ASSURANCE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The further acts sought are outside the scope of the obligations expressly created by this Agreement"
  - invalid_if: "Performance of the further act would be unlawful or require a consent that has been refused by a competent authority"
- **CORE_DISPUTE_RESOLUTION_001** (DISPUTE_RESOLUTION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED
  - invalid_if: "Dispute resolution mechanism is entirely absent"
  - invalid_if: "Clause omits the seat of arbitration"
  - invalid_if: "Clause omits any arbitrator appointment mechanism"
  - invalid_if: "Clause restricts access to courts absolutely"
- **CORE_GOVERNING_LAW_001** (GOVERNING_LAW) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT; text has no interpolation
- **CORE_COUNTERPARTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT; text has no interpolation
- **CORE_STAMP_AND_COSTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The document is executed in a State whose stamp legislation prescribes a different incidence of duty than allocated here"
  - invalid_if: "The parties have separately agreed in writing that one party bears the entire stamp duty and registration cost"
- **CORE_SIGNATURE_BLOCK_001** (SIGNATURE_BLOCK) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement not signed by authorized representatives"

## MASTER_SERVICE_AGREEMENT

### UNIVERSAL_BY_DESIGN — 4

- **MSA_SOW_MECHANISM_001** (SUPPLY) — Sole satisfier of always-requirement SOW_GOVERNED_ORDERING, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED
  - invalid_if: "No mechanism for executing or incorporating SOWs is stated"
- **MSA_ORDER_OF_PRECEDENCE_001** (SUPPLY) — Sole satisfier of always-requirement PRECEDENCE_OF_DOCUMENTS, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "No rule for resolving conflicts between master terms and SOW terms"
- **MSA_SUBCONTRACTING_001** (OBLIGATIONS) — Sole satisfier of always-requirement DELEGATION_CONTROLLED, which carries an authored identity test.
  - evidence: SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "The clause permits subcontracting of the whole of the Services, which may amount to an assignment of the contract and requires the Client's consent as such."
  - invalid_if: "Consent is drafted as absolute where the engagement is one the law treats as delegable, so that the restriction operates as a penalty rather than a protection."
  - invalid_if: "The Service Provider is released from liability for a subcontractor's acts, which defeats the purpose of the clause and leaves the Client without a counterparty"
  - invalid_if: "The clause omits back-to-back confidentiality or data-protection obligations where the subcontractor will handle the Client's confidential information or person"
- **CORE_CONFIDENTIALITY_001** (CONFIDENTIALITY) — Sole satisfier of always-requirement CONFIDENTIALITY_BOUNDED, which carries an authored identity test.
  - evidence: GATED_ELSEWHERE, SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED; text has no interpolation
  - gate in VENDOR_AGREEMENT: `include_confidentiality == true`
  - invalid_if: "Confidential Information is not defined"
  - invalid_if: "No exclusions exist"

### CONDITIONAL_MISSING_GATE — 3

- **SERVICE_CUSTOMER_DEPENDENCIES_001** (OBLIGATIONS) — The clause IS gated (`include_deliverables == true`), but `include_deliverables` is true whatever the user answers and is not an intake field at all. The gate is live and the answer is fixed.
  - evidence: FROZEN_GATE, SOLE_SATISFIER_ALWAYS, INVALID_IF_AUTHORED, CONTRADICTED_EVIDENCE; text has no interpolation
  - **contradicted evidence**: gate `include_deliverables == true` vs always-requirement CLIENT_SIDE_OBLIGATIONS. The gate says the clause is optional; the requirement says it is the only way to satisfy a duty the family always has. Unfreezing or answering the gate would make that requirement unsatisfiable.
  - repair: Make the existing control answerable. Do NOT add a second gate — the gate is not missing.
  - invalid_if: "Relief is claimed for a failure the Service Provider never notified, so the Client had no opportunity to cure it."
  - invalid_if: "The clause relieves the Service Provider of obligations the Client's failure did not actually affect."
  - invalid_if: "The Client's dependencies are left unlisted, which makes the relief trigger unascertainable and the clause a general excuse."
  - invalid_if: "It is drafted so that the Client's failure is itself a breach entitling the Service Provider to terminate, which converts a relief mechanism into a termination "
- **CORE_GOVERNANCE_PROTECTIONS_001** (GOVERNANCE) — The clause IS gated (`include_governance_protections == true`), but `include_governance_protections` is true whatever the user answers and is not an intake field at all. The gate is live and the answer is fixed.
  - evidence: FROZEN_GATE, GATED_ELSEWHERE, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - repair: Make the existing control answerable. Do NOT add a second gate — the gate is not missing.
  - gate in CONSULTANCY_AGREEMENT: `include_governance_protections == true`
  - gate in DISTRIBUTION_AGREEMENT: `include_governance_protections == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_governance_protections == true`
  - gate in JOINT_VENTURE_AGREEMENT: `include_governance_protections == true`
  - gate in SERVICE_AGREEMENT: `include_governance_protections == true`
  - gate in SUPPLY_AGREEMENT: `include_governance_protections == true`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_governance_protections == true`
  - one of 2 satisfiers of RELATIONSHIP_IS_GOVERNED: MSA_GOVERNANCE_BODY_001, CORE_GOVERNANCE_PROTECTIONS_001
  - invalid_if: "An audit right is drafted so broadly that it permits access to the other Party's records unrelated to this Agreement."
  - invalid_if: "An escalation mechanism is drafted as a condition precedent to approaching a court or tribunal in a way that ousts jurisdiction."
  - invalid_if: "The clause requires disclosure of information the disclosing Party is barred by law or by a third-party obligation from disclosing."
- **MSA_GOVERNANCE_BODY_001** (GOVERNANCE) — The clause IS gated (`include_governance_protections == true`), but `include_governance_protections` is true whatever the user answers and is not an intake field at all. The gate is live and the answer is fixed.
  - evidence: FROZEN_GATE, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - repair: Make the existing control answerable. Do NOT add a second gate — the gate is not missing.
  - one of 2 satisfiers of RELATIONSHIP_IS_GOVERNED: MSA_GOVERNANCE_BODY_001, CORE_GOVERNANCE_PROTECTIONS_001
  - invalid_if: "Escalation is drafted as an absolute condition precedent to any remedy, so that a Party in breach can delay relief by declining to meet."
  - invalid_if: "The clause purports to let a governance body amend the Agreement without the formalities the amendment clause requires."
  - invalid_if: "Time limits are left unstated, which makes the escalation tier incapable of being exhausted and therefore incapable of being a condition precedent at all."

### UNRESOLVED — 31

- **CORE_IDENTITY_001** (IDENTITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT
- **CORE_PURPOSE_001** (PURPOSE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED
  - invalid_if: "Purpose of agreement not specified"
- **CORE_DEFINITIONS_001** (DEFINITIONS) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SERVICE_AGREEMENT defeats this clause on `include_nomenclature_clause != false`; SOFTWARE_DEVELOPMENT_AGREEMENT defeats this clause on `include_nomenclature_clause != false`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_nomenclature_clause != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_nomenclature_clause != false`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SERVICE_AGREEMENT: `include_nomenclature_clause != false`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_nomenclature_clause != false`
  - invalid_if: "Key terms are undefined or ambiguous"
- **CORE_INTERPRETATION_001** (INTERPRETATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INJECTED; text has no interpolation
- **CORE_RELATIONSHIP_OF_PARTIES_001** (RELATIONSHIP) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "The actual conduct of the parties, notwithstanding the contractual terms, establishes a different legal relationship in substance."
- **SERVICE_PAYMENT_001** (CONSIDERATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 4 satisfiers of CONSIDERATION_SETTLED: SERVICE_PAYMENT_001, SERVICE_PAYMENT_FIXED_FEE_001, SERVICE_PAYMENT_MILESTONE_001, SERVICE_PAYMENT_RETAINER_001
  - invalid_if: "Payment terms exceed 45 days for MSME vendors contrary to MSMED Act 2006"
  - invalid_if: "Interest rate exceeds 24% per annum raising usury concerns"
  - invalid_if: "Invoice requirements do not comply with GST Act 2017"
- **SERVICE_IMPLIED_SERVICES_001** (SERVICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 2 satisfiers of SCOPE_CAN_CHANGE: SERVICE_CHANGE_REQUEST_001, SERVICE_IMPLIED_SERVICES_001
  - invalid_if: "The clause is drafted so that anything the Client later asks for becomes part of the Services regardless of cost, which makes the consideration uncertain."
  - invalid_if: "The notice requirement is drafted so that the Service Provider forfeits payment for work the Client instructed it to perform urgently and in writing."
  - invalid_if: "It is used in place of a scope description, leaving the Services themselves undefined."
- **SERVICE_SCOPE_001** (SERVICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - one of 2 satisfiers of SERVICE_SCOPE_DEFINED: SERVICE_SCOPE_001, SERVICE_DELIVERABLES_001
  - invalid_if: "Services are not clearly defined"
- **IP_OWNERSHIP_001** (IP) — Unresolved, but the question is concrete: SHAREHOLDERS_AGREEMENT defeats this clause on `company_has_ip_assets == true`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `company_has_ip_assets == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in SHAREHOLDERS_AGREEMENT: `company_has_ip_assets == true`
  - one of 3 satisfiers of OWNERSHIP_OF_WORK_PRODUCT: IP_OWNERSHIP_001, IP_ASSIGNMENT_001, IP_CONTRACTOR_RETAINS_001
  - invalid_if: "Assignment is conditional or revocable"
  - invalid_if: "Rights limited to licence rather than full assignment where assignment is intended"
  - invalid_if: "Future works not covered by present assignment"
- **SERVICE_WARRANTY_001** (WARRANTY) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_warranty_clause == true`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_warranty_clause == true`; SERVICE_AGREEMENT defeats this clause on `include_warranty_clause == true`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `include_warranty_clause == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_warranty_clause == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_warranty_clause == true`
  - gate in SERVICE_AGREEMENT: `include_warranty_clause == true`
  - invalid_if: "Warranty obligation is too vague to identify the corrective obligation"
  - invalid_if: "Warranty period is inconsistent with the agreed commercial acceptance structure"
- **CORE_REPRESENTATIONS_001** (REPRESENTATIONS) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "A representation is given by a party that is not in fact incorporated or registered as described"
  - invalid_if: "The clause is used to warrant a state of affairs the party has no means of knowing, without an awareness qualifier"
- **CORE_COMPLIANCE_WITH_LAW_001** (REGULATORY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement requires violation of law"
- **CORE_INDEMNITY_001** (RISK) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_indemnity_clause == true`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SERVICE_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SOFTWARE_DEVELOPMENT_AGREEMENT defeats this clause on `include_indemnity_clause == true`; VENDOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_indemnity_clause == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_indemnity_clause == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_indemnity_clause == true`
  - gate in SERVICE_AGREEMENT: `include_indemnity_clause == true`
  - gate in SOFTWARE_DEVELOPMENT_AGREEMENT: `include_indemnity_clause == true`
  - gate in VENDOR_AGREEMENT: `include_indemnity_clause == true`
  - one of 2 satisfiers of RISK_IS_ALLOCATED: CORE_INDEMNITY_001, CORE_INDEMNITY_PROCEDURE_001
  - invalid_if: "Indemnity is unlimited or vague"
- **CORE_LIMITATION_LIABILITY_001** (RISK) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_indemnity_clause == true`; INDEPENDENT_CONTRACTOR_AGREEMENT defeats this clause on `include_indemnity_clause == true`; SERVICE_AGREEMENT defeats this clause on `include_indemnity_clause == true`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - candidate defeating fact: `include_indemnity_clause == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_indemnity_clause == true`
  - gate in INDEPENDENT_CONTRACTOR_AGREEMENT: `include_indemnity_clause == true`
  - gate in SERVICE_AGREEMENT: `include_indemnity_clause == true`
  - one of 2 satisfiers of LIABILITY_IS_BOUNDED: CORE_LIMITATION_LIABILITY_001, CORE_LIABILITY_CAP_001
  - invalid_if: "Liability is excluded for fraud or wilful misconduct"
- **CORE_INDEMNITY_PROCEDURE_001** (INDEMNITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 2 satisfiers of RISK_IS_ALLOCATED: CORE_INDEMNITY_001, CORE_INDEMNITY_PROCEDURE_001
  - invalid_if: "Notification is drafted as a condition precedent so that any delay, however harmless, extinguishes the indemnity."
  - invalid_if: "The indemnifying Party may settle on terms that leave the indemnified Party exposed to the same claimant."
  - invalid_if: "The indemnified Party may settle without consent and still recover, which removes the protection section 125 makes conditional on prudence and authority."
  - invalid_if: "Conduct of the defence is given to the indemnifying Party without any obligation to conduct it diligently or to keep the indemnified Party informed."
- **SERVICE_EXPENSES_001** (EXPENSES) — Unresolved, but the question is concrete: CONSULTANCY_AGREEMENT defeats this clause on `include_expenses == true`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `include_expenses == true`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in CONSULTANCY_AGREEMENT: `include_expenses == true`
  - invalid_if: "The clause is vague or ambiguous, making it unenforceable."
  - invalid_if: "It contravenes specific statutory provisions applicable to the nature of services rendered."
  - invalid_if: "It is established that the clause was entered into under coercion, undue influence, or fraud."
- **CORE_TERM_001** (TERM) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement duration is undefined"
  - invalid_if: "Termination mechanism absent"
- **CORE_FORCE_MAJEURE_001** (FORCE_MAJEURE) — Unresolved, but the question is concrete: COMMERCIAL_LEASE_AGREEMENT defeats this clause on `long_term_lease != false`; LEAVE_AND_LICENSE_AGREEMENT defeats this clause on `include_force_majeure != false`; SALES_OF_GOODS_AGREEMENT defeats this clause on `include_force_majeure != false`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `long_term_lease != false | include_force_majeure != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in COMMERCIAL_LEASE_AGREEMENT: `long_term_lease != false`
  - gate in LEAVE_AND_LICENSE_AGREEMENT: `include_force_majeure != false`
  - gate in SALES_OF_GOODS_AGREEMENT: `include_force_majeure != false`
  - invalid_if: "Force majeure events defined too broadly"
  - invalid_if: "Clause used to excuse negligence"
- **SERVICE_TERMINATION_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: ALTERNATIVE_SATISFIER, INVALID_IF_AUTHORED; text has no interpolation
  - one of 3 satisfiers of EXIT_IS_POSSIBLE: SERVICE_TERMINATION_001, CORE_TERMINATION_001, SERVICE_TERMINATION_CONVENIENCE_001
  - invalid_if: "Termination for convenience with less than 15 days notice without compensation"
  - invalid_if: "No payment obligation for work completed before termination"
- **CORE_SURVIVAL_001** (TERMINATION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Critical clauses terminate automatically after contract termination"
- **CORE_NOTICE_001** (NOTICE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Method of communication unclear"
- **CORE_ASSIGNMENT_001** (ASSIGNMENT) — Unresolved, but the question is concrete: SUPPLY_AGREEMENT defeats this clause on `assignment_addressed != false`. Whether that fact defeats it in MASTER_SERVICE_AGREEMENT has not been decided by anyone.
  - evidence: GATED_ELSEWHERE, NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - candidate defeating fact: `assignment_addressed != false`
  - repair: Answer the question for this family. Copying the other family's gate is the CORE_ENTIRE_AGREEMENT_001 error.
  - gate in SUPPLY_AGREEMENT: `assignment_addressed != false`
  - invalid_if: "Assignment allowed in contracts where personal obligations exist"
- **CORE_AMENDMENT_001** (AMENDMENT) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Amendments allowed without written consent"
- **CORE_WAIVER_001** (WAIVER) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Waiver implied without clear intent"
- **CORE_SEVERABILITY_001** (SEVERABILITY) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "Entire contract becomes void if a single clause fails"
- **CORE_FURTHER_ASSURANCE_001** (FURTHER_ASSURANCE) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The further acts sought are outside the scope of the obligations expressly created by this Agreement"
  - invalid_if: "Performance of the further act would be unlawful or require a consent that has been refused by a competent authority"
- **CORE_DISPUTE_RESOLUTION_001** (DISPUTE_RESOLUTION) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED
  - invalid_if: "Dispute resolution mechanism is entirely absent"
  - invalid_if: "Clause omits the seat of arbitration"
  - invalid_if: "Clause omits any arbitrator appointment mechanism"
  - invalid_if: "Clause restricts access to courts absolutely"
- **CORE_GOVERNING_LAW_001** (GOVERNING_LAW) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT; text has no interpolation
- **CORE_COUNTERPARTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INJECTED; text has no interpolation
- **CORE_STAMP_AND_COSTS_001** (EXECUTION_FORMALITIES) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED, INJECTED; text has no interpolation
  - invalid_if: "The document is executed in a State whose stamp legislation prescribes a different incidence of duty than allocated here"
  - invalid_if: "The parties have separately agreed in writing that one party bears the entire stamp duty and registration cost"
- **CORE_SIGNATURE_BLOCK_001** (SIGNATURE_BLOCK) — No artifact in the repository names a fact that would defeat this clause, and none states why it always belongs.
  - evidence: NO_REQUIREMENT, INVALID_IF_AUTHORED; text has no interpolation
  - invalid_if: "Agreement not signed by authorized representatives"
