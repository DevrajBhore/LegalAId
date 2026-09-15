# Phase D4.4-B — statutory coverage under a proposed gate

Before moving a clause behind a legal fact, what law does the document stop citing when
that fact is false? A clause may leave freely where another covers the same Act. A clause
that takes the last citation of a statute with it is a different event.

Losing an Act is not automatically wrong — an agreement with no personal data should stop
citing the DPDP Act. The probe names the loss; whether it is correct is a legal question
and this layer is not permitted to answer it.

## MASTER_SERVICE_AGREEMENT / `SERVICE_KEY_PERSONNEL_001`

Proposed driver: `key_person_dependency` (requirement PERSONNEL_CONTINUITY)
> D4.3 GATE_FACT_MISMATCH: gated on include_sla, requirement applicable on key_person_dependency.

The clause cites 3 authorities. Of those, **2 appear
nowhere else in the document**:

- `Indian Contract Act, 1872 s.40` — also in MSA_SUBCONTRACTING_001
- `Code on Wages, 2019 s.43` — **sole custodian**
  - Responsibility for payment of wages rests with the employer, which is why the clause states plainly whose employees these are.
- `Employees' Provident Funds and Miscellaneous Provisions Act, 1952 s.8A` — **sole custodian**
  - Recovery from a principal employer in respect of contract labour, which is the exposure the last sentence is drafted to keep with the Service Provider.

**Gating this clause on `key_person_dependency` would remove these authorities from the document
entirely whenever the fact is false:**

- Code on Wages, 2019 s.43
- Employees' Provident Funds and Miscellaneous Provisions Act, 1952 s.8A
