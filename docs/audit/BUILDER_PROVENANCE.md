# Phase D4.8 — provenance of the sub-clause builders

D4.7 found the engine composing legal content below the clause boundary, procedurally, in
`documentHardening.js`. This asks what those decisions are actually selecting on, and
whether each driver is already reviewable legal knowledge. **Nothing is migrated.**

Drivers are found by perturbation, not by reading the builders: each world flips exactly one
intake answer, so a rendering that differs names its own driver. Reading the code would find
the variables the builders MENTION, which is a different and larger set.

| class | text changes | distinct clauses | meaning |
|---|---|---|---|
| LEGAL_PROPOSITION_CHANGE | 3 | 1 | driven by a fact that already carries a concept or proposition with authority |
| CROSS_CLAUSE_DEPENDENCY | 6 | 2 | the text depends on which OTHER clauses were selected, not on a new rule |
| OPTIONAL_COMMERCIAL_TERM | 4 | 2 | an include_* drafting choice with no legal knowledge behind it |
| UNCLASSIFIED | 35 | 5 | the driver resolves to no layer of the knowledge base at all |

**3 of 48** sentence-level changes are driven by something carrying
statutory authority.

### LEGAL_PROPOSITION_CHANGE — 3

- `gst_applicable` — 3 change(s); resolves as: intake_field, derived_control, concept
  - INDEPENDENT_CONTRACTOR_AGREEMENT/SERVICE_PAYMENT_001, MASTER_SERVICE_AGREEMENT/SERVICE_PAYMENT_001, SOFTWARE_DEVELOPMENT_AGREEMENT/SERVICE_PAYMENT_001

### CROSS_CLAUSE_DEPENDENCY — 6

- `include_indemnity_clause` — 4 change(s); resolves as: intake_field, derived_control
  - CONSULTANCY_AGREEMENT/CORE_SURVIVAL_001, INDEPENDENT_CONTRACTOR_AGREEMENT/CORE_SURVIVAL_001, SERVICE_AGREEMENT/CORE_SURVIVAL_001, SOFTWARE_DEVELOPMENT_AGREEMENT/CORE_SURVIVAL_001
- `include_force_majeure` — 2 change(s); resolves as: intake_field, derived_control
  - LEAVE_AND_LICENSE_AGREEMENT/CORE_DEFINITIONS_001, SALES_OF_GOODS_AGREEMENT/CORE_DEFINITIONS_001

### OPTIONAL_COMMERCIAL_TERM — 4

- `include_indemnity_clause` — 4 change(s); resolves as: intake_field, derived_control
  - CONSULTANCY_AGREEMENT/SERVICE_TERMINATION_001, INDEPENDENT_CONTRACTOR_AGREEMENT/SERVICE_TERMINATION_001, SERVICE_AGREEMENT/CORE_TERMINATION_001, SOFTWARE_DEVELOPMENT_AGREEMENT/CORE_TERMINATION_001

### UNCLASSIFIED — 35

- `termination_for_convenience` — 16 change(s); resolves as: intake_field, derived_control
  - APPOINTMENT_LETTER/CORE_TERMINATION_001, CONSULTANCY_AGREEMENT/SERVICE_TERMINATION_001, DATA_PROCESSING_AGREEMENT/CORE_TERMINATION_001, DISTRIBUTION_AGREEMENT/SERVICE_TERMINATION_001 …
- `termination_for_cause` — 16 change(s); resolves as: intake_field, derived_control
  - APPOINTMENT_LETTER/CORE_TERMINATION_001, CONSULTANCY_AGREEMENT/SERVICE_TERMINATION_001, DATA_PROCESSING_AGREEMENT/CORE_TERMINATION_001, DISTRIBUTION_AGREEMENT/SERVICE_TERMINATION_001 …
- `no_employment_ack` — 1 change(s); resolves as: intake_field, derived_control
  - INDEPENDENT_CONTRACTOR_AGREEMENT/CORE_RELATIONSHIP_OF_PARTIES_001
- `police_verification_required` — 1 change(s); resolves as: intake_field, derived_control
  - LEAVE_AND_LICENSE_AGREEMENT/PROP_REGISTRATION_001
- `escrow_required` — 1 change(s); resolves as: intake_field, derived_control
  - SOFTWARE_DEVELOPMENT_AGREEMENT/TECH_SOURCE_CODE_001
