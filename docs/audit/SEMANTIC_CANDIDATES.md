# Semantic candidate discovery — did the pronoun scan under-sample?

Families that admit a third principal: **28**
Distinct clauses they reach: **184**
Clauses with no shipped text captured (not rendered by any fixture): **6**

| measure | clauses |
|---|---|
| flagged by the OLD lexical scan (binary pronoun only) | **49** |
| flagged by semantic mechanisms | **76** |
| **invisible to the old scan** | **27** |
| flagged by nothing at all | 108 |

## Which mechanism finds what

| mechanism | clauses | of which the pronoun scan missed |
|---|---|---|
| BINARY_PRONOUN | 49 | 0 |
| REFERENCE_OR_PROCEEDING | 1 | 0 |
| DIVIDED_QUANTITY | 8 | 4 |
| INSTRUMENT_CONTINUATION | 12 | 6 |
| COLLECTIVE_DECISION | 17 | 8 |
| PAIRWISE_ROLE | 14 | 8 |
| PARTY_SUCCESSION | 2 | 1 |
| UNILATERAL_ACT_BINDING_OTHERS | 2 | 1 |
| PARTY_ENUMERATION | 2 | 2 |
| RESPONDS_TO_ROSTER | 4 | 3 |

## Newly discovered candidates, ranked by exposure

Every row is a clause the old method could not see. `state` is its CURRENT
classification, so NOT_CLASSIFIED here means nobody has ever examined it.

| clause | families | state | mechanisms | evidence |
|---|---|---|---|---|
| `CORE_SIGNATURE_BLOCK_001` | 28 | SAFE | PARTY_ENUMERATION, RESPONDS_TO_ROSTER | …IN WITNESS WHEREOF, the Parties hereto have executed this Agreement on the day… |
| `CORE_IDENTITY_001` | 25 | SAFE | PARTY_ENUMERATION, RESPONDS_TO_ROSTER | …ning thereof, include its successors and permitted assigns) of the First Part; AND Beta Co… |
| `CORE_WAIVER_001` | 25 | NOT_CLASSIFIED | UNILATERAL_ACT_BINDING_OTHERS | …No failure, delay, or indulgence by a Party in exercising any right, power, or remedy unde… |
| `CORE_SURVIVAL_001` | 24 | NOT_CLASSIFIED | INSTRUMENT_CONTINUATION | …Expiry or termination of this Agreement shall not affect any right, remedy, oblig… |
| `CORE_STAMP_AND_COSTS_001` | 22 | NOT_CLASSIFIED | DIVIDED_QUANTITY | …ental charges payable in respect of this Agreement shall be borne equally by the Parties, … |
| `CORP_BOARD_COMPOSITION_001` | 3 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …ming subscriber, and two independent directors appointed by mutual agreement. Voting right… |
| `CORP_DRAG_ALONG_001` | 3 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …If the Majority Shareholders, holding more than 100% of the issued and paid-up share cap… |
| `PROP_REGISTRATION_001` | 3 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …duty and registration charges shall be borne in the manner agreed by the Parties or, in th… |
| `CORP_BOARD_INVESTOR_CONTROL_001` | 2 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …ming subscriber, and two independent directors appointed by mutual agreement. (a) The Boar… |
| `RENT_PROPERTY_USE_001` | 2 | NOT_CLASSIFIED | INSTRUMENT_CONTINUATION | ….m. Any breach of this clause shall entitle the Licensor to terminate this Agreement after… |
| `RENT_SUBLEASE_001` | 2 | NOT_CLASSIFIED | INSTRUMENT_CONTINUATION, PARTY_SUCCESSION | …ten consent shall be void and shall entitle the Landlord to terminate this Agreement forth… |
| `DPA_RETENTION_AND_ERASURE_001` | 1 | NOT_CLASSIFIED | INSTRUMENT_CONTINUATION | …(a) on the Fiduciary's instruction, and in any event on the expiry or termination of this … |
| `FOUNDER_ROLES_AND_COMMITMENT_001` | 1 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …listed in this Agreement as a reserved matter requires the unanimous agreement of the Foun… |
| `GUARANTEE_INDEMNITY_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …The Guarantor shall indemnify and hold harmless the Creditor against all losses, damages,… |
| `GUARANTEE_OBLIGATION_001` | 1 | NOT_CLASSIFIED | DIVIDED_QUANTITY | …pal Debtor under the underlying financing arrangements. The aggregate liability of the Gua… |
| `IPA_ASSIGNOR_WARRANTIES_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …the intellectual property to any other person. The Assignor shall indemnify the Assignee a… |
| `NDA_CONFIDENTIAL_INFORMATION_SCOPE_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …those directors, employees and professional advisers of the Receiving Party who need the i… |
| `NDA_DATA_SECURITY_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …The Receiving Party shall protect the Confidential Information with reasonable… |
| `NDA_DURATION_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …nal data, the obligations shall continue for so long as the Receiving Party retains that d… |
| `NDA_EXCLUSIONS_001` | 1 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …rd exclusions recognised under applicable law, is expressly agreed by the Parties to inclu… |
| `NDA_NON_COMPETE_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …his Agreement and for a period of 24 months thereafter, the Receiving Party shall not, wit… |
| `NDA_RETURN_OF_INFORMATION_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …ermination of this Agreement, or upon written demand by the Disclosing Party, the Receivin… |
| `NDA_THIRD_PARTY_DISCLOSURE_001` | 1 | NOT_CLASSIFIED | PAIRWISE_ROLE | …The Receiving Party shall not disclose any Confidential Information to any thir… |
| `PARTNERSHIP_CAPITAL_001` | 1 | SAFE | DIVIDED_QUANTITY, INSTRUMENT_CONTINUATION, COLLECTIVE_DECISION, RESPONDS_TO_ROSTER | …Each Partner shall contribute capital to the partnership in the following amounts: Partne… |
| `RENT_POSSESSION_001` | 1 | NOT_CLASSIFIED | INSTRUMENT_CONTINUATION | …iver a possession receipt to the Tenant upon handover. Upon expiry or termination of this … |
| `TECH_SOURCE_CODE_001` | 1 | NOT_CLASSIFIED | COLLECTIVE_DECISION | …ablish and maintain a source-code escrow arrangement with a mutually agreed escrow agent, … |
| `TS_LIQUIDATION_PREFERENCE_001` | 1 | NOT_CLASSIFIED | DIVIDED_QUANTITY | …ay instead elect to convert into equity shares and take its pro rata share of the whole, w… |

## The control: what the pronoun scan found that the mechanisms do not

Clauses flagged ONLY by the binary pronoun, with no semantic mechanism firing: **25**

- `CORE_COMPLIANCE_WITH_LAW_001` (1 families) — SAFE
- `CORE_CONFIDENTIALITY_001` (15 families) — SAFE
- `CORE_ENTIRE_AGREEMENT_001` (25 families) — SAFE
- `CORE_GOVERNANCE_PROTECTIONS_001` (8 families) — SAFE
- `CORE_GOVERNING_LAW_001` (28 families) — SAFE
- `CORE_INDEMNITY_PROCEDURE_001` (1 families) — SAFE
- `CORE_REPRESENTATIONS_001` (4 families) — SAFE
- `CORE_TERMINATION_001` (14 families) — AUTHORED_DECISION_PENDING
- `CORP_DEADLOCK_001` (3 families) — NOT_CLASSIFIED
- `DIST_COMPETITION_COMPLIANCE_001` (1 families) — NOT_CLASSIFIED
- `IPA_REGISTRATION_AND_FURTHER_ASSURANCE_001` (1 families) — NOT_CLASSIFIED
- `IP_FEEDBACK_001` (1 families) — NOT_CLASSIFIED
- `IP_INFRINGEMENT_001` (1 families) — NOT_CLASSIFIED
- `MSA_GOVERNANCE_BODY_001` (1 families) — NOT_CLASSIFIED
- `MSA_ORDER_OF_PRECEDENCE_001` (1 families) — NOT_CLASSIFIED

These matter. A binary pronoun with no mechanism behind it is a candidate for
being a FALSE POSITIVE OF THE OLD METHOD — the amicable-discussion sentence
problem, where 'between the Parties' is present and nothing turns on it.
