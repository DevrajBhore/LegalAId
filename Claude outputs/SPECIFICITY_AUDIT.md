# Phase D4.2 — differential specificity audit

Two deliberately opposite worlds per family: every material yes/no answered TRUE in one
and FALSE in the other, everything else held identical.

| family | answers changed | controls moved | facts moved | requirements moved | clauses A / B | only in A | only in B | shared clauses whose TEXT differs |
|---|---|---|---|---|---|---|---|---|
| NDA | 6 | 11 | 1 | 0 | 35 / 30 | **7** | **2** | 3 |
| DISTRIBUTION_AGREEMENT | 8 | 13 | 2 | 0 | 35 / 32 | **3** | **0** | 2 |
| MASTER_SERVICE_AGREEMENT | 10 | 15 | 3 | 3 | 44 / 38 | **6** | **0** | 3 |

## NDA

Answers changed: **6** material yes/no fields flipped.

Derived controls that moved (11): include_entire_agreement, include_non_compete, include_non_solicit, involves_source_code, involves_trade_secrets, involves_personal_data, processes_personal_data, firm_processes_personal_data, company_processes_personal_data, jv_processes_personal_data, restrict_moonlighting

Canonical facts that moved (1): processes_personal_data

Requirement outcomes that moved (0): **none**

Clauses only in the TRUE world (7): NDA_CONFIDENTIALITY_TRADE_SECRET_001, NDA_TRADE_SECRET_PROTECTION_001, NDA_NON_SOLICITATION_001, CORE_DATA_PROCESSING_001, NDA_SOURCE_CODE_PROTECTION_001, NDA_NON_COMPETE_001, CORE_ENTIRE_AGREEMENT_001

Clauses only in the FALSE world (2): NDA_CONFIDENTIALITY_HEIGHTENED_001, CORE_INDEMNITY_FULL_001

Shared clauses whose text differs (3): CORE_DEFINITIONS_001, CORE_SURVIVAL_001, CORE_TERMINATION_001

## DISTRIBUTION_AGREEMENT

Answers changed: **8** material yes/no fields flipped.

Derived controls that moved (13): involves_personal_data, include_entire_agreement, termination_for_convenience, termination_for_cause, include_non_compete, include_non_solicit, include_sla, include_reporting, reporting_required, processes_personal_data, firm_processes_personal_data, company_processes_personal_data, jv_processes_personal_data

Canonical facts that moved (2): include_sla, processes_personal_data

Requirement outcomes that moved (0): **none**

Clauses only in the TRUE world (3): SERVICE_REPORTING_001, CORE_DATA_PROCESSING_001, CORE_ENTIRE_AGREEMENT_001

Clauses only in the FALSE world (0): **none**

Shared clauses whose text differs (2): CORE_DEFINITIONS_001, SERVICE_TERMINATION_001

## MASTER_SERVICE_AGREEMENT

Answers changed: **10** material yes/no fields flipped.

Derived controls that moved (15): involves_personal_data, include_entire_agreement, termination_for_convenience, termination_for_cause, include_non_compete, include_non_solicit, key_person_dependency, include_sla, include_reporting, gst_applicable, reporting_required, processes_personal_data, firm_processes_personal_data, company_processes_personal_data, jv_processes_personal_data

Canonical facts that moved (3): key_person_dependency, include_sla, processes_personal_data

Requirement outcomes that moved (3): SERVICE_LEVELS_MEASURED, PERSONNEL_CONTINUITY, PERSONAL_DATA_HANDLED

Clauses only in the TRUE world (6): EMP_NON_SOLICITATION_001, SERVICE_SLA_001, SERVICE_KEY_PERSONNEL_001, CORE_DATA_PROCESSING_001, SERVICE_TERMINATION_CONVENIENCE_001, CORE_ENTIRE_AGREEMENT_001

Clauses only in the FALSE world (0): **none**

Shared clauses whose text differs (3): CORE_DEFINITIONS_001, SERVICE_PAYMENT_001, SERVICE_TERMINATION_001


---

# The measurement that matters: per-answer sensitivity

Flipping every material answer at once is the wrong test, because a real user
changes a few facts, not all of them. Flipping **one at a time** from a baseline
where everything is YES gives the honest number.

| family | clauses | clauses that CAN move | **unconditional** | answers that change nothing |
|---|---|---|---|---|
| NDA | 35 | 9 | **28 (80%)** | 0 of 6 |
| DISTRIBUTION_AGREEMENT | 35 | 3 | **32 (91%)** | 5 of 8 |
| MASTER_SERVICE_AGREEMENT | 44 | 6 | **38 (86%)** | 5 of 10 |

**80–91% of every document does not move for any material answer the family
asks.** That is the observation about "the same document with the variables
replaced", measured.

## Which answers do nothing

| family | answer | effect on the clause set |
|---|---|---|
| DISTRIBUTION | `termination_for_convenience` | **none** |
| DISTRIBUTION | `termination_for_cause` | **none** |
| DISTRIBUTION | `include_non_compete` | **none** |
| DISTRIBUTION | `include_non_solicit` | **none** |
| DISTRIBUTION | `include_sla` | **none** |
| MSA | `termination_for_cause` | **none** |
| MSA | `include_non_compete` | **none** |
| MSA | `key_person_dependency` | **none** |
| MSA | `include_reporting` | **none** |
| MSA | `gst_applicable` | **none** |

`key_person_dependency` is the sharpest of these. It is a **declared semantic
fact** — authored in Phase B, resolved canonically, consumed by
`PERSONNEL_CONTINUITY`, and it moves the requirement's applicability. It changes
no clause. The fact plane and the document plane are wired to different things.

## And where answers DO work, they move one clause each

NDA is the responsive family — all six answers move something — and even there
the responsive surface is 9 clauses out of 35. `involves_trade_secrets` is the
only answer in the whole audit that performs a **substitution**: it swaps
`NDA_CONFIDENTIALITY_TRADE_SECRET_001` + `NDA_TRADE_SECRET_PROTECTION_001` for
`NDA_CONFIDENTIALITY_HEIGHTENED_001`. Everything else only adds or removes.

## What certification did not catch, and could not

Requirement outcomes moved **0 of N** for NDA and Distribution between the two
opposite worlds. The assessment reports the same findings for both, because the
requirements ask whether the document addresses a topic — and it does, in both.

This is the gap in the ladder, stated precisely:

```
COVERAGE      does this document do what this KIND of document must do?
              answered. 10 families.

SPECIFICITY   is this the right document for THIS transaction?
              not asked anywhere.
```

A family can report every requirement resolved, survive adversarial
falsification, and emit 91% the same document for two deals that are not alike.
**FALSIFICATION_PASSED is not evidence of specificity and was never measuring
it.**

## What this does not say

It does not say 80% of a contract should change between deals. Governing law,
definitions, notices, severability, signature blocks and interpretation
legitimately do not move — a boilerplate core is correct. The finding is not the
percentage on its own; it is that **nobody has said which clauses belong in that
core**, so the number is an accident rather than a decision, and there is no way
to tell a legitimately fixed clause from one that should have been conditional
and never was.

The next measurement is therefore not "make more clauses move". It is: for each
unconditional clause, is it unconditional **because someone decided it is
common to every deal of this kind**, or because no one ever gated it?
