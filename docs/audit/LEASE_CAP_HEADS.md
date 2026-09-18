# D4.28 — the breach and negligence heads, where the cap can be computed

Commercial lease, rent ₹2,50,000/month over 60 months.
A visitor is injured through the lessee's negligence and sues the lessor for ₹40,00,000.
The lessor claims on the lessee's indemnity. The cap reads "the total consideration paid
under this Agreement" — which for a lease is rent paid TO DATE.

## The cap is a function of elapsed time, not a figure

| month of the term | rent paid to date = the cap | share of a ₹40,00,000 claim recoverable |
|---|---|---|
| 1 | ₹2,50,000 | 6% |
| 3 | ₹7,50,000 | 19% |
| 6 | ₹15,00,000 | 38% |
| 12 | ₹30,00,000 | 75% |
| 24 | ₹60,00,000 | 100% |
| 60 | ₹1,50,00,000 | 100% |

**The same clause recovers 6% of the claim in month 1 and 100% from month 16.**

Nobody chose that. It is an artefact of measuring a ceiling on a CUMULATIVE quantity, and it
means the protection a party has under this clause depends on when the harm happens rather
than on what the parties agreed. A tenancy is at its most exposed in its first months, which
is precisely when this cap is at its smallest.

**So D4.27's MEASURABLE verdict was necessary and not sufficient.** The measurement layer has
two questions, and only the first was asked:

```
MEASUREMENT
    ├── computable?    — is there a quantity the formula can read?      (D4.27 asked this)
    └── well-defined?  — is what it computes stable and intended?       (this is new)
```

## The two open heads

### BREACH_OF_AGREEMENT

- **inside the cap** — Recovery for breach of covenant is capped at rent paid to date, so an early-term breach is barely compensable.
- **outside the cap** — Breach is fully compensable under Section 73, and the cap governs nothing much — most lease disputes are breaches of covenant.

This is the head where INSIDE and OUTSIDE differ most in ordinary practice, because breach is the common case rather than the exceptional one.

### NEGLIGENCE

- **inside the cap** — A third-party injury claim is recoverable only to the extent of rent paid, and the balance sits with whichever party the claimant chose to sue.
- **outside the cap** — The indemnity answers the claim in full, which is what an indemnity for third-party claims is ordinarily for.

The head with the statutory exposure. See the authority below — this is not a free choice between two commercially equivalent readings.

## The statutory frame, and one thing it is easy to get wrong

| source | effect |
|---|---|
| Contract Act **s.23** | an agreement whose object is opposed to public policy is void |
| **Simplex Concrete Piles v Union of India** | a clause barring claims under s.73 is void under s.23 as contrary to public policy |
| **Central Inland Water Transport v Brojo Nath Ganguly** | an unreasonable clause between parties of unequal bargaining power is void under s.23 |
| Contract Act **s.73** | compensation for loss naturally arising — what a cap displaces |

**THE THING TO GET WRONG.** Secondary sources state that excluding liability for death or
personal injury caused by negligence is "automatically void" — and attribute it to COMMON LAW
PRINCIPLES. India has no Unfair Contract Terms Act and no statutory provision to that effect.
The constraint here runs through s.23 public policy and Central Inland Water Transport
unconscionability, which are FACT-SENSITIVE and turn on bargaining power, not through a
bright-line statutory bar.

Recording it as a bright line would have produced a confident answer resting on the wrong
jurisdiction's statute — which is the same failure as reading a plausible mechanism into
s.146 in D4.25, and it is why the source was read rather than summarised.

What follows for the NEGLIGENCE head is therefore narrower than "it cannot be capped": a cap
on a negligence indemnity is **arguable rather than void**, and its vulnerability rises with
the inequality of the parties and the smallness of the ceiling — which, on the arithmetic
above, is smallest exactly when the tenancy is newest.

## The advocate question, stated as narrowly as the evidence allows

> For a commercial lease and a leave-and-licence agreement, where the liability ceiling is
> measured on rent or licence fee paid to date: do the BREACH and NEGLIGENCE heads of the
> mutual indemnity sit inside that ceiling, outside it, or inside it subject to a floor?

Three things are deliberately NOT bundled into that question:

- the other three heads, which the cap already carves out and which are settled;
- whether the cumulative measure is the right measure at all, which is the measurement
  question this probe has just reopened and which may change the answer;
- how the ceiling applies across more than two principals, which is
  LIABILITY_CAP_APPORTIONMENT and stays open.
