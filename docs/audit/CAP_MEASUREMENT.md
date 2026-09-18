
## Can the family supply the cap basis it offers?

Two different failures live here and they need different repairs.

| state | families | meaning |
|---|---|---|
| CONFIGURABLE_AND_SUPPLIED | 6 | the user picks a basis and the intake holds the quantity |
| OFFERS_A_BASIS_IT_CANNOT_SUPPLY | 4 | **the form offers a fees basis and collects no fee** |
| FIXED_PROSE_MEASURABLE | 6 | no basis question, but the clause's measure is collected anyway |
| FIXED_PROSE_UNMEASURABLE | 6 | **no basis question and nothing to measure** — the D4.26 case |

**OFFERS_A_BASIS_IT_CANNOT_SUPPLY**: `DISTRIBUTION_AGREEMENT`, `JOINT_VENTURE_AGREEMENT`, `PARTNERSHIP_DEED`, `SHAREHOLDERS_AGREEMENT`

**FIXED_PROSE_UNMEASURABLE**: `DATA_PROCESSING_AGREEMENT`, `FOUNDERS_AGREEMENT`, `NDA`, `PRIVACY_POLICY`, `SHARE_SUBSCRIPTION_AGREEMENT`, `TERMS_OF_SERVICE`

# D4.27 — can the liability cap be computed?

Cap instances across the portfolio: **22** in 22 document types.

| verdict | instances | meaning |
|---|---|---|
| MEASURABLE | 12 | the intake collects a quantity the cap's own words can read |
| **UNMEASURABLE** | **10** | the cap names a measure the family never collects |
| NO_STATED_MEASURE | 0 | the cap's phrasing was not recognised — reported, not assumed safe |

## UNMEASURABLE — a ceiling with nothing to compute it from

| document type | cap clause | says it measures |
|---|---|---|
| `DATA_PROCESSING_AGREEMENT` | CORE_LIABILITY_CAP_001 | "aggregate fees paid or payable" |
| `DISTRIBUTION_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `FOUNDERS_AGREEMENT` | CORE_LIABILITY_LIMIT_FALLBACK_001 | "total consideration paid" |
| `JOINT_VENTURE_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `NDA` | CORE_LIABILITY_LIMIT_FALLBACK_001 | "total consideration paid" |
| `PARTNERSHIP_DEED` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `PRIVACY_POLICY` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `SHARE_SUBSCRIPTION_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `SHAREHOLDERS_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |
| `TERMS_OF_SERVICE` | CORE_LIMITATION_LIABILITY_001 | "aggregate fees paid or payable" |

## MEASURABLE — the interaction question can sensibly be asked here

| document type | cap clause | measured by |
|---|---|---|
| `COMMERCIAL_LEASE_AGREEMENT` | CORE_LIABILITY_LIMIT_FALLBACK_001 | `rent_amount` |
| `CONSULTANCY_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `consulting_fee` |
| `EMPLOYMENT_CONTRACT` | CORE_LIABILITY_LIMIT_FALLBACK_001 | `salary` |
| `GUARANTEE_AGREEMENT` | GUARANTEE_OBLIGATION_001 | `guaranteed_amount` |
| `INDEPENDENT_CONTRACTOR_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `contract_value` |
| `IP_ASSIGNMENT_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `contract_value` |
| `LEAVE_AND_LICENSE_AGREEMENT` | CORE_LIABILITY_LIMIT_FALLBACK_001 | `license_fee` |
| `MASTER_SERVICE_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `contract_value` |
| `SALES_OF_GOODS_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `price` |
| `SERVICE_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `contract_value` |
| `SOFTWARE_DEVELOPMENT_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `total_fee` |
| `SUPPLY_AGREEMENT` | CORE_LIMITATION_LIABILITY_001 | `price` |

## Reading

**10 of 22 cap instances cannot be computed**, across
10 document types. This is not confined to the two families D4.26 happened to
examine, and it is not caused by the N-party work or by the indemnity interaction — it is a
defect in the cap standing alone.

So the order of questions is forced, and it is not a preference:

```
CAP_MEASUREMENT
    ├── measurable   → the interaction decision may be meaningful
    └── unmeasurable → the interaction decision is BLOCKED
```

Asking an advocate whether the indemnity consumes a ceiling that cannot be computed is asking
them to order a clause against a quantity that does not exist. The answer would be recorded,
would look like progress, and would mean nothing.

**A ceiling that cannot be computed is not a limitation of liability.** It is an unresolved
reference, and on an ordinary reading a court would have to supply the missing term or treat
the limitation as ineffective — which is the opposite of what the party relying on it expects.
