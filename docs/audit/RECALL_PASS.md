# D4.22 — recall pass over the clauses D4.21 cleared

Dependency edges in the clause library: **306** (168 clauses declare `depends_on`)

Population — clauses D4.21 flagged with nothing: **108**

| verdict | clauses | meaning |
|---|---|---|
| RELEVANT | **0** | a mechanism demonstrates an N-party question |
| NOT_RELEVANT | 2 | positive evidence that cardinality changes nothing |
| UNDETERMINED | 106 | insufficient evidence — NOT a clean bill of health |

## Newly RELEVANT — false negatives of the D4.21 detector

| clause | families | detectors | evidence |
|---|---|---|---|

## Validation — the structural detector against the whole reachable set

Clauses whose `depends_on` chain reaches an undecided clause: **2**

| clause | inherits from | in this population? |
|---|---|---|
| `CORE_SURVIVAL_001` | CORE_TERMINATION_001 | no — already a D4.21 candidate |
| `MSA_GOVERNANCE_BODY_001` | CORE_DISPUTE_RESOLUTION_001 | no — already a D4.21 candidate |

**CORE_SURVIVAL_001 is recovered by the graph walk.** Its question is inherited from
CORE_TERMINATION_001, whose TERMINATION_FOR_DEFAULT_SCOPE is UNDECIDED, and the edge is
declared in the clause library. No word in the survival clause announces this.

## What each detector contributed

| detector | clauses found | found ONLY by this one |
|---|---|---|
| DEPENDENCY_INHERITANCE | 0 | 0 |
| ROSTER_DIFFERENTIAL | 0 | 0 |
| PARTY_ROLE_VARIANCE | 25 | 25 |

## NOT_RELEVANT, with the evidence that earned it

- `CORE_COUNTERPARTS_001` — states a rule about the instrument, in terms that hold for any number of parties
- `CORE_INTERPRETATION_001` — states a rule about the instrument, in terms that hold for any number of parties

## UNDETERMINED (106)

These are not cleared. No mechanism was demonstrated AND no positive evidence of
irrelevance was found, which are different states and are kept apart deliberately.

- `CORE_CONTRACT_FORMATION_001` (4 families)
- `CORE_DATA_PROCESSING_001` (0 families)
- `CORE_DEFINITIONS_001` (25 families)
- `CORE_FURTHER_ASSURANCE_001` (25 families)
- `CORE_LATE_PAYMENT_INTEREST_001` (2 families)
- `CORE_PURPOSE_001` (16 families)
- `CORE_SEVERABILITY_001` (25 families)
- `CORE_TERM_001` (18 families)
- `CORP_ANTI_DILUTION_001` (3 families)
- `CORP_SHARE_SUBSCRIPTION_001` (1 families)
- `CORP_SHARE_TRANSFER_001` (4 families)
- `DIST_APPOINTMENT_EXCLUSIVE_001` (1 families)
- `DPA_AUDIT_AND_TRANSFER_001` (1 families)
- `DPA_BREACH_NOTIFICATION_001` (1 families)
- `DPA_DATA_PRINCIPAL_RIGHTS_001` (1 families)
- `DPA_PERSONNEL_AND_CONFIDENTIALITY_001` (1 families)
- `DPA_ROLES_AND_SCOPE_001` (1 families)
- `DPA_SECURITY_SAFEGUARDS_001` (1 families)
- `DPA_SUBPROCESSING_001` (1 families)
- `EMP_NON_COMPETE_001` (2 families)
- `ESOP_EXERCISE_001` (1 families)
- `ESOP_GRANT_001` (1 families)
- `ESOP_LEAVER_AND_LAPSE_001` (1 families)
- `ESOP_TAXATION_001` (1 families)
- `ESOP_VESTING_001` (1 families)
- …and 81 more
