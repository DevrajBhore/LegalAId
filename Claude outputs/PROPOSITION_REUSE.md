# Phase D4.5-B — do separate clauses implement the same legal proposition?

The falsification that decides whether a TREATMENT layer is earned. A proposition
implemented by exactly one clause is a fragment of that clause; naming it a treatment adds
indirection and no capability. A proposition implemented by clauses written separately is
a thing the knowledge base contains.

**The sample is deliberately biased toward finding reuse** — variant-slot groups, a
suspected overlapping pair, the known composite clause — because twelve random clauses out
of 315 would almost never collide and their not colliding would say nothing. A negative
result from a sample built to find reuse is strong; a positive one tells us the shape
exists but nothing about how often.

## Control set

2 control clauses (`CORE_GOVERNING_LAW_001`, `CORE_NOTICE_001`) share no
proposition with any sampled group, so the vocabulary discriminates and the result below
is about the library rather than about the method.

## Result

12 clauses declare what they implement, across 9 propositions.
**4 propositions are implemented by more than one clause.**

| proposition | clauses | the library already calls these alternatives |
|---|---|---|
| `CONFIDENTIALITY_OBLIGATION` | `CORE_CONFIDENTIALITY_001`, `NDA_CONFIDENTIALITY_HEIGHTENED_001`, `NDA_CONFIDENTIALITY_TRADE_SECRET_001` | yes — variant slot `confidentiality_strength` |
| `REPAYMENT_SCHEDULE_FIXED` | `LOAN_REPAYMENT_001`, `LOAN_REPAYMENT_BULLET_001` | yes — variant slot `repayment_structure` |
| `RENT_PAYABLE_ON_STATED_TERMS` | `RENTAL_RENT_PAYMENT_001`, `RENT_RENT_PAYMENT_001` | **no** |
| `SECURITY_DEPOSIT_CAPPED_AND_RETURNABLE` | `RENTAL_SECURITY_DEPOSIT_001`, `RENT_SECURITY_DEPOSIT_001` | **no** |

### Reuse the library does not account for

These propositions are implemented by several clauses with no variant slot saying so.
That is either an unrecorded alternative — a treatment the system has and cannot name —
or accidental duplication. The two call for opposite repairs, and this probe cannot
tell them apart; an advocate reading the texts can.

- `RENT_PAYABLE_ON_STATED_TERMS` — RENTAL_RENT_PAYMENT_001, RENT_RENT_PAYMENT_001
  - Rent is payable in a stated amount at a stated interval, with the tax treatment of the payment identified.
- `SECURITY_DEPOSIT_CAPPED_AND_RETURNABLE` — RENTAL_SECURITY_DEPOSIT_001, RENT_SECURITY_DEPOSIT_001
  - A security deposit is limited in amount and must be returned on vacancy subject only to stated deductions.

## Composite clauses

**2** of the sampled clauses implement more than one proposition.

- `NDA_CONFIDENTIALITY_TRADE_SECRET_001` implements 2:
  - `CONFIDENTIALITY_OBLIGATION` (also in CORE_CONFIDENTIALITY_001, NDA_CONFIDENTIALITY_HEIGHTENED_001)
    - Indian Contract Act, 1872 s.27
  - `TRADE_SECRET_HEIGHTENED_PROTECTION` — **implemented nowhere else**
    - Indian Contract Act, 1872 s.27
- `SERVICE_KEY_PERSONNEL_001` implements 2:
  - `PERSONAL_PERFORMANCE_INTENDED` — **implemented nowhere else**
    - Indian Contract Act, 1872 s.40
  - `PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED` — **implemented nowhere else**
    - Code on Wages, 2019 s.43; Employees' Provident Funds and Miscellaneous Provisions Act, 1952 s.8A

A proposition implemented nowhere else, inside a clause gated on a different proposition,
is the D4.4-B failure stated precisely: closing the gate removes a rule the document has no
other way to express.
