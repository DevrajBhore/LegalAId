# D4.23 — CORE_SURVIVAL_001 across the two termination worlds

## What the clause actually says

| element | found | text |
|---|---|---|
| trigger | yes | "expiry or termination of **this Agreement**" — one global predicate |
| who remains bound | yes | "shall continue to bind **the Parties**" — the collective |
| enumerated survivors | 9 | confidentiality; ownership of intellectual property; indemnity; limitation of liability; dispute resolution; governing law; jurisdiction; notices; this clause |

## The enumeration — which regime binds each pair

Surviving provisions, read from the clause rather than assumed (9): confidentiality, ownership of intellectual property, indemnity, limitation of liability, dispute resolution, governing law, jurisdiction, notices, this clause.

| pair | World A (instrument ends) | World B (relationship ends) | same? |
|---|---|---|---|
| 1-2 | SURVIVING | NEITHER — no regime binds this pair | **NO** |
| 1-3 | SURVIVING | NEITHER — no regime binds this pair | **NO** |
| 2-3 | SURVIVING | LIVE | **NO** |

Trigger fires: World A **true**, World B **false**.
Pairs whose binding regime differs between the worlds: **3 of 3**.

## Reading

**NOT INVARIANT, and the divergence is worse than a difference of degree.**

In World A every pair is bound by the surviving provisions. In World B the pairs
involving the departing party are bound by **neither regime**:

  - the LIVE regime does not reach them, because Party 1 is no longer a Party;
  - the SURVIVING regime does not reach them, because "this Agreement" has not
    expired or terminated — it is on foot between Parties 2 and 3.

So under ENDS_THAT_RELATIONSHIP the departing party walks away from
confidentiality and intellectual-property obligations, not because anyone
released them but because the survival clause's trigger is a global predicate
and the termination was partial. **A drafting gap that only opens at three parties.**

## The survivors that already carry open decisions

| enumerated survivor | its own N-party status |
|---|---|
| indemnity | CORE_INDEMNITY_FULL_001 — INDEMNITY_APPORTIONMENT is UNDECIDED |
| limitation of liability | CORE_LIMITATION_LIABILITY_001 — LIABILITY_CAP_APPORTIONMENT is UNDECIDED |
| dispute resolution | CORE_DISPUTE_RESOLUTION_001 — ARBITRATION_REFERENCE_SCOPE is UNDECIDED |

**3 of the 9 enumerated survivors are themselves undecided.**

This compounds rather than merely coincides. Under World B the departing party
escapes the liability cap and the indemnity regime along with everything else —
which cuts BOTH ways, since the cap that no longer binds them also no longer
protects them. Whether that is a windfall or an exposure depends on the very
apportionment question LIABILITY_CAP_APPORTIONMENT leaves open, so the two
decisions cannot be taken in isolation from each other.

## Does the parent decision settle it?

| TERMINATION_FOR_DEFAULT_SCOPE treatment | world | survival settled by that choice? |
|---|---|---|
| ENDS_THE_INSTRUMENT | A | yes — The trigger fires, every former party stays bound by the survivors. Nothing further to decide. |
| REQUIRES_ALL_INNOCENT_PARTIES | A | yes — Still instrument-level termination when exercised; same as above. |
| ENDS_THAT_RELATIONSHIP | B | **no** — The trigger does not fire and the departing party is no longer a Party, so whether they remain bound is NOT answered by having chosen this treatment. A second choice is required. |

A further decision arises under **1 of 3** parent treatments.

That is the precise shape of the finding, and it is neither of the two easy answers:

  - NOT merely inherited — under two treatments there is nothing left to decide;
  - NOT independent — the question does not exist unless ENDS_THAT_RELATIONSHIP is chosen.

**A CONDITIONAL DEPENDENT DECISION.** It is recorded against the existing
PAIRWISE_RIGHT shape with `conditional_on` naming the parent treatment that
brings it into being. No survival-specific N-party shape is invented, because the
existing shape already describes the mechanism: a right exercised against one
party, where more than two force a choice between bilateral and multilateral effect.
