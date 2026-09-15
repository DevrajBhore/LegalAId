# Phase D4.7 — which unit owns the proposition assertion?

`implements` is annotated on a clause id; the emitted text is conditionally rendered. Before
choosing between annotating rendering variants and splitting clauses, this measures what the
library actually does. No design decision is taken here.

**The first run of this probe was wrong and the correction is instructive.** It stripped
digits but not spelled-out numerals, so "three (3) years" and "five (5) years" read as
structurally different sentences. VALUE_ONLY came back as zero and all 28 pairs landed in the
alarming class — a filter matching more than it meant, inflating exactly the number that
would have justified a new architectural layer.

## How clause text varies across worlds

| class | pairs | distinct clauses | what it means |
|---|---|---|---|
| LIST_MEMBERSHIP | 4 | 1 | a cross-reference list tracking which other clauses are in the document |
| **SENTENCE_ADDED** | **2** | 2 | one rendering contains every sentence of another plus more — sub-clause conditionality |
| **SENTENCE_REPLACED** | **22** | 5 | sentences are exchanged rather than added |

**LIST_MEMBERSHIP is the engine maintaining coherence below clause granularity, and it is
correct.** `CORE_SURVIVAL_001` drops "indemnity" from its survival list when the indemnity
clause is declined. Nothing is wrong there — but it does mean a clause's rendered text
already depends on which OTHER clauses were selected, which no annotation records.

### Clauses whose sentence set changes with the facts

| family | clause | class | renderings | sentence counts |
|---|---|---|---|---|
| APPOINTMENT_LETTER | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| CONSULTANCY_AGREEMENT | `SERVICE_TERMINATION_001` | SENTENCE_REPLACED | 4 | 5 / 6 |
| DATA_PROCESSING_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| DISTRIBUTION_AGREEMENT | `SERVICE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 6 / 7 |
| FOUNDERS_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| INDEPENDENT_CONTRACTOR_AGREEMENT | `CORE_RELATIONSHIP_OF_PARTIES_001` | SENTENCE_ADDED | 2 | 4 / 5 |
| INDEPENDENT_CONTRACTOR_AGREEMENT | `SERVICE_PAYMENT_001` | SENTENCE_REPLACED | 2 | 7 / 8 |
| INDEPENDENT_CONTRACTOR_AGREEMENT | `SERVICE_TERMINATION_001` | SENTENCE_REPLACED | 4 | 5 / 6 |
| INTERNSHIP_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| LEAVE_AND_LICENSE_AGREEMENT | `CORE_DEFINITIONS_001` | SENTENCE_REPLACED | 2 | 8 / 9 |
| LEAVE_AND_LICENSE_AGREEMENT | `PROP_REGISTRATION_001` | SENTENCE_ADDED | 2 | 5 / 6 |
| LOAN_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| MASTER_SERVICE_AGREEMENT | `SERVICE_PAYMENT_001` | SENTENCE_REPLACED | 2 | 5 / 6 |
| MASTER_SERVICE_AGREEMENT | `SERVICE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 5 / 6 |
| MOU | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| PARTNERSHIP_DEED | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| SALES_OF_GOODS_AGREEMENT | `CORE_DEFINITIONS_001` | SENTENCE_REPLACED | 2 | 8 / 9 |
| SERVICE_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 4 | 3 / 4 |
| SHAREHOLDERS_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| SOFTWARE_DEVELOPMENT_AGREEMENT | `SERVICE_PAYMENT_001` | SENTENCE_REPLACED | 2 | 5 / 6 |
| SOFTWARE_DEVELOPMENT_AGREEMENT | `TECH_SOURCE_CODE_001` | SENTENCE_REPLACED | 2 | 2 |
| SOFTWARE_DEVELOPMENT_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 4 | 3 / 4 |
| SUPPLY_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |
| VENDOR_AGREEMENT | `CORE_TERMINATION_001` | SENTENCE_REPLACED | 3 | 3 / 4 |

These are the clauses where a legal assertion genuinely enters or leaves the text without
the clause id changing — the unit that owns the assertion is smaller than the clause.

## Polarity candidates — heuristic, listed not scored

Renderings where one form contains a negation the other does not. The detector looks for
negation near an obligation verb and WILL over-report: "shall not disclose" is a negation
and also an assertion. So each is printed for reading rather than counted into a total that
would look more authoritative than it is.

None found.

