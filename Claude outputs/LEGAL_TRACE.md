# Phase D4.4 — how far a legal fact travels

The chain the architecture requires:

```
FACT -> CONCEPT -> LEGAL AUTHORITY -> APPLICABILITY -> REQUIREMENT -> TREATMENT -> CLAUSE
```

A node counts as reached only when a **runtime observation changes as the fact changes**.
An artifact merely mentioning a fact does not advance it: that conflation was the substance
of seven earlier measurement errors, every one of which inflated a number.

**Two rules this probe had to be corrected to obey.** A perturbation that could not be run
is UNMEASURABLE, never a stop — the first version of this probe read a family that emits no
clauses as a fact that fails to travel. And no concept is scored past LEGAL_AUTHORITY,
because no concept resolver exists: when a concept's field moves a clause, a hand-authored
blueprint gate moved it, not the concept. That is recorded in its own column.

The two planes were built at different times for different consumers. One carries the law
and cannot reach the document; the other reaches the document and carries no law.

| plane | fact / concept | statutory authority | attaches | reaches | field alone moves the document |
|---|---|---|---|---|---|
| concept | `BIS_NOTIFIED_GOODS` | 5 section-deep | 5 | **NOT REACHABLE** | no field |
| concept | `EPR_OBLIGATED_PRODUCT` | 4 section-deep | 0 | **NOT REACHABLE** | no field |
| concept | `HAZARDOUS_MATERIAL` | 6 section-deep | 0 | **NOT REACHABLE** | no field |
| concept | `MSME_SUPPLIER` | 3 section-deep | 4 | **NOT REACHABLE** | no field |
| semantic_fact | `employer_headcount_ge_10` | none | 0 | **INTAKE_FIELD** | — |
| semantic_fact | `establishment_is_covered` | none | 0 | **INTAKE_FIELD** | — |
| semantic_fact | `lender_is_regulated` | none | 0 | **INTAKE_FIELD** | — |
| concept | `AAEC_RISK_ARRANGEMENT` | 3 section-deep | 3 | **LEGAL_AUTHORITY** | no |
| concept | `COMPULSORILY_REGISTRABLE` | 4 section-deep | 4 | **LEGAL_AUTHORITY** | no |
| concept | `EMPLOYMENT_HEADCOUNT_THRESHOLD` | 5 section-deep | 9 | **LEGAL_AUTHORITY** | no |
| concept | `GST_TAXABLE_SUPPLY` | 4 section-deep | 9 | **LEGAL_AUTHORITY** | yes — but via a hand-authored gate, not the concept |
| concept | `TDS_DEDUCTIBLE_PAYMENT` | 6 section-deep | 10 | **LEGAL_AUTHORITY** | no |
| semantic_fact | `key_person_dependency` | none | 0 | **REQUIREMENT_MOVES** | — |
| semantic_fact | `include_sla` | none | 0 | **CLAUSE_MOVES** | — |
| semantic_fact | `is_secured` | none | 0 | **CLAUSE_MOVES** | — |
| concept | `PERSONAL_DATA_PROCESSING` | 5 section-deep | 14 | **CLAUSE_MOVES** | **yes — the concept governs 19 gate(s)** |
| semantic_fact | `processes_personal_data` | none | 0 | **CLAUSE_MOVES** | — |

## The boundary, stated exactly

4 of 17 facts reach the document. 10 carry statutory authority.
**1 do both.**

The first facts to do both:

- `PERSONAL_DATA_PROCESSING` — 5 section-deep citation(s), governs 19 blueprint gate(s), and the clause moves with it.

That is one complete chain: question -> fact -> concept -> authority -> clause. It is one
concept of ten, and the other nine still stop where they stopped.

## Where the chain stops

**NOT REACHABLE — the user cannot state the fact at all** — 4: `BIS_NOTIFIED_GOODS`, `EPR_OBLIGATED_PRODUCT`, `HAZARDOUS_MATERIAL`, `MSME_SUPPLIER`

**INTAKE_FIELD — askable, and nothing observable follows** — 3: `lender_is_regulated`, `employer_headcount_ge_10`, `establishment_is_covered`

**LEGAL_AUTHORITY — authored against statute, and the resolver that would carry it further does not exist** — 5: `AAEC_RISK_ARRANGEMENT`, `COMPULSORILY_REGISTRABLE`, `EMPLOYMENT_HEADCOUNT_THRESHOLD`, `GST_TAXABLE_SUPPLY`, `TDS_DEDUCTIBLE_PAYMENT`

**REQUIREMENT_MOVES — changes a requirement outcome, and no clause** — 1: `key_person_dependency`

**CLAUSE_MOVES — reaches the document** — 4: `is_secured`, `include_sla`, `processes_personal_data`, `PERSONAL_DATA_PROCESSING`

## Concepts with statutory authority that no question can reach

Each names Acts and sections, lists the clauses it should attach to, and carries a
confirmation question already drafted — and no intake field exists to resolve it.

- `BIS_NOTIFIED_GOODS` — 5 authority citation(s), attaches 5 clause(s); detection wants no structured source at all
- `EPR_OBLIGATED_PRODUCT` — 4 authority citation(s), attaches 0 clause(s); detection wants no structured source at all
- `HAZARDOUS_MATERIAL` — 6 authority citation(s), attaches 0 clause(s); detection wants no structured source at all
- `MSME_SUPPLIER` — 3 authority citation(s), attaches 4 clause(s); detection wants `counterparty_msme_class`, `counterparty_udyam_number`

## Concepts whose field is askable and changes nothing

The user can already state these facts. Stating them changes no clause, because only a
resolver would connect the concept's authority and `attaches` list to the document.

- `AAEC_RISK_ARRANGEMENT` — askable in 1 family/families, attaches 3 clause(s), 3 citation(s)
- `COMPULSORILY_REGISTRABLE` — askable in 36 family/families, attaches 4 clause(s), 4 citation(s)
- `EMPLOYMENT_HEADCOUNT_THRESHOLD` — askable in 1 family/families, attaches 9 clause(s), 5 citation(s)
- `TDS_DEDUCTIBLE_PAYMENT` — askable in 31 family/families, attaches 10 clause(s), 6 citation(s)
