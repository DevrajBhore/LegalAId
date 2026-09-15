# Phase D4.1 — can the system describe a partnership of three?

## Layer 1 — intake

Partner-indexed fields: partner_1_name, partner_1_address, partner_1_type, capital_contribution_1, partner_2_name, partner_2_address, partner_2_type, capital_contribution_2

**Partner slots: 2** (indices 1, 2). There is no field for a third.

## Layer 2 — clause text

**18 binary-language occurrences across 11 shipped clauses.**
The two-party assumption is not only in the intake — it is written into the prose.

| clause | assumes two, by |  |
|---|---|---|
| CORE_IDENTITY_001 | "BY AND BETWEEN" — the two-party recital formula | ×1 |
| CORE_CONFIDENTIALITY_001 | "the other" — undefined when there are three | ×2 |
| CORE_CONFIDENTIALITY_001 | "Neither Party" | ×1 |
| CORE_INDEMNITY_001 | "the other" — undefined when there are three | ×1 |
| CORE_LIMITATION_LIABILITY_001 | "the other" — undefined when there are three | ×1 |
| CORE_LIMITATION_LIABILITY_001 | "either" — a choice between two | ×1 |
| CORE_LIMITATION_LIABILITY_001 | "Neither Party" | ×1 |
| CORE_FORCE_MAJEURE_001 | "the other" — undefined when there are three | ×3 |
| CORE_FORCE_MAJEURE_001 | "either" — a choice between two | ×1 |
| CORE_FORCE_MAJEURE_001 | "Neither Party" | ×1 |
| CORE_TERMINATION_001 | "the other" — undefined when there are three | ×3 |
| CORE_TERMINATION_001 | "either" — a choice between two | ×3 |
| CORE_NOTICE_001 | "the other" — undefined when there are three | ×1 |
| CORE_ASSIGNMENT_001 | "the other" — undefined when there are three | ×2 |
| CORE_ASSIGNMENT_001 | "Neither Party" | ×1 |
| CORE_AMENDMENT_001 | "either" — a choice between two | ×1 |
| CORE_ENTIRE_AGREEMENT_001 | "either" — a choice between two | ×1 |
| CORE_GOVERNING_LAW_001 | "either" — a choice between two | ×1 |

## Layer 3 — do the answers reach the document?

| required field | answered | reaches the deed |
|---|---|---|
| profit_sharing_ratio | 60:40 | yes |
| capital_contribution_1 | 600000 | yes |

## Layer 4 — requirements

Authored requirements for PARTNERSHIP_DEED: **0**.

## Layer 5 — the three-partner attempt

The deed generates: yes.
The third partner's name appears anywhere: yes, in free text.
The third partner is identified AS a partner: **no**.
Issues raised: **none**


---

## The share counterfactuals

Every case generates identically: 25 clauses, **zero issues**, the answer
rendered verbatim into the deed.

| profit_sharing_ratio | what it means | generated | issues |
|---|---|---|---|
| `60:40` with capital 60/40 | aligned | 25 clauses | 0 |
| `50:50` with capital 60/40 | **lawful** — section 13(b) makes equal sharing the default and unequal capital does not change it | 25 clauses | 0 |
| `60:50` | the partners take **110%** of the profits | 25 clauses | 0 |
| `30:30` | **40% of profits unallocated** | 25 clauses | 0 |
| `equally` | prose, not a ratio | 25 clauses | 0 |
| `as mutually agreed` | no allocation at all | 25 clauses | 0 |
| `50%` | one share for two partners | 25 clauses | 0 |
| `40:35:25` | **three shares in a two-partner firm** | 25 clauses | 0 |

A required field, rendered into a signed instrument, with no scrutiny of any
kind. This is the `security_collateral` shape — free text carrying a legal
position — in the provision that decides who takes what.

**The check that matters is not the one it is tempting to write.** Comparing
shares against capital contributions would be wrong: section 13(b) of the Indian
Partnership Act, 1932 makes equal sharing the default whatever the contributions,
so `50:50` on 60/40 capital is an ordinary, lawful arrangement. The predicate
that means something is whether the shares **account for the whole** — and
`60:50` and `30:30` both fail it while generating cleanly.

## The layers, separated

| layer | state |
|---|---|
| **intake** | 2 partner slots. No third. The defect originates here |
| **clause selection** | no clause turns on how many partners there are |
| **clause text** | **18 binary-language occurrences across 11 clauses** — "the other", "either Party", "Neither Party", "BY AND BETWEEN" |
| **requirements** | 0 authored. Nothing asserts a partner count, a share, or a contribution |
| **assessment** | nothing to assess |
| **validation** | 0 issues on every malformed share above |

**It is not one layer.** The intake cannot hold a third partner; the prose
assumes there are two even where the intake could; and nothing downstream would
notice either.

The clause-text finding is the one that matters most, because it is the one a
bigger intake would not fix. `CORE_TERMINATION_001` says a partner may terminate
"to **the other** Party". With three partners that phrase has no referent — the
sentence is not merely incomplete, it cannot be read. Eleven shipped clauses
carry that assumption, and all of them are CORE clauses shared across the
portfolio, so the fix is not local to this family.

## The three-partner attempt

There is no field, so the only thing a user can do is write the third partner
into free text. Doing that:

- the deed **generates** — 25 clauses, no issues;
- "Kavita Rao" **appears**, inside the roles paragraph;
- she is **not identified as a partner** anywhere;
- the recital still reads "BY AND BETWEEN" two people;
- capital is still divided two ways;
- **no issue is raised.**

The instrument describes a two-partner firm, confidently, for a firm of three.

## What this does NOT yet establish

**That a collection primitive is required.** Two things look expressible with
machinery that already exists, and D4.2 will try rather than assume:

- *do the shares account for the whole* is a predicate over one field, which
  reduces to a **derived boolean fact** of the kind `employer_headcount_ge_10`
  already is — parseable ratios give TRUE or FALSE, and `equally` or `as
  mutually agreed` give UNKNOWN, which is the honest answer;
- *does the number of shares match the number of partners* is the same shape.

If both hold, the arithmetic needs no new abstraction and the real defect is the
intake's fixed arity plus the prose's binary assumption — a schema problem and an
authoring problem, neither of them a gap in the reasoning model.

The pressure would be genuine only if a requirement turns out to need something
the tri-state fact model cannot carry: a value **per partner**, compared across
partners, where the partners are not known in advance. Contributions and shares
per partner are exactly that shape. Whether any authored legal requirement
actually needs it is the D4.2 question, and it is not answered here.
