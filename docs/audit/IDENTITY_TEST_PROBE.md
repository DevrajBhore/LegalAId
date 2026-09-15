# Phase D3.6 — is every requirement load-bearing on the clauses it names?

94 requirements across 10 families with a recorded baseline.

| outcome | count | meaning |
|---|---|---|
| load-bearing | 81 | removing the named clauses makes the requirement report unsatisfied |
| **HOLLOW** | 0 | the requirement stays satisfied with its own satisfiers gone |
| not assessed | 13 | unsatisfied at baseline, or naming no satisfiers |

## Not assessed

- EMPLOYMENT_CONTRACT/POSH_AWARENESS_REFLECTED: not satisfied anyway (UNRESOLVED)
- EMPLOYMENT_CONTRACT/POSH_INTERNAL_COMMITTEE_REFLECTED: not satisfied anyway (NOT_APPLICABLE)
- EMPLOYMENT_CONTRACT/MATERNITY_ENTITLEMENT: not satisfied anyway (NOT_APPLICABLE)
- LOAN_AGREEMENT/ENFORCEMENT_MATCHES_SECURITY_POSITION: not satisfied anyway (NOT_APPLICABLE)
- LOAN_AGREEMENT/ENFORCEMENT_MATCHES_LENDER_ELIGIBILITY: not satisfied anyway (NOT_APPLICABLE)
- MOU/NON_BINDING_CHARACTER: not satisfied anyway (ESCALATED)
- POWER_OF_ATTORNEY/POWERS_ENUMERATED: not satisfied anyway (ESCALATED)
- POWER_OF_ATTORNEY/EXECUTION_FORMALITY: not satisfied anyway (ESCALATED)
- POWER_OF_ATTORNEY/DONOR_CAPACITY_SUBSISTS: not satisfied anyway (UNVERIFIABLE)
- RENTAL_AGREEMENT/POSSESSION_DELT_WITH: not satisfied anyway (UNRESOLVED)
- RENTAL_AGREEMENT/OUTGOINGS_ALLOCATED: not satisfied anyway (UNRESOLVED)
- RENTAL_AGREEMENT/REPAIR_OBLIGATIONS: not satisfied anyway (UNRESOLVED)
- SHAREHOLDERS_AGREEMENT/TRANSFER_RESTRICTIONS_IN_ARTICLES: not satisfied anyway (UNVERIFIABLE)

---

# D3.8 — the claim-target experiment, and the smallest repair it justified

## Can claim target be derived mechanically?

**It is already declared — and was optional.** The `kind` vocabulary carries
exactly this distinction, and the phrasing across 102 authored requirements is
consistent:

| kind | what settles it | how the statements read |
|---|---|---|
| CONTENT | the document's own words | "…is stated", "…is identified", "The notice demands…" |
| FORMALITY | an act performed outside it | "An Internal Committee exists…", "The instrument bears the stamp duty…" |
| TIMING | a window | "The notice is given within thirty days…" |
| EXTERNAL_COHERENCE | a record elsewhere | "The donor is alive and of sound mind…" |
| CHARACTER | what the instrument must NOT assert | "An unsecured loan does not assert enforcement remedies…" |

**31 of 94 declared no kind at all**, and an undeclared kind silently became
CONTENT at assessment time. That is the assumption *a requirement's subject is
the document*, applied by default to a third of the corpus without anyone
deciding it — the permissive assumption the Terms of Service failure exposed,
sitting unstated in the schema.

## The rules that were measured and rejected

**Require the `identity_test` to name the instrument.** 56 of 102 do. The 46 that
do not are entirely legitimate — *"Remove it and there is no ascertainable
subject matter"*, *"Remove it and section 142(1)(b) bars the court from taking
cognizance"*. **46 false negatives.** Not viable.

**Require load-bearingness.** Measured in D3.6: 81 of 81 pass, and the naive
Terms of Service requirement passes too. Catches nothing.

## The repair: `kind` is mandatory

The smallest change the evidence justifies. An author must now state what settles
the requirement before it is admitted, and the four non-CONTENT kinds each carry
their own consequence — FORMALITY must name the act in `outside_the_document` and
is capped at PROVIDED_FOR.

| acceptance criterion | result |
|---|---|
| legitimate document requirements preserved | **yes** — 102 admitted, 0 refused |
| the 81 load-bearing requirements replay | **yes** — 81 load-bearing, 0 hollow, unchanged |
| POSH external-world assertions still capped | **yes** — both FORMALITY, still PROVIDED_FOR / CEILING_FOR_KIND |
| no new false negatives | **yes** |
| full corpus green, no baseline drift | **yes** |
| **the Terms of Service false green rejected** | **NO** |

## The criterion it does not meet, stated plainly

`USER_ACCEPTED_THE_TERMS`, authored with `kind: "CONTENT"` and satisfied by
`TOS_ACCEPTANCE_001`, **is still admitted.** Tested, not assumed.

The gate cannot tell that the *statement* is about a person while the *kind* says
the document settles it. Doing so means reading "The user has accepted these
Terms" and knowing that its subject is a party rather than an instrument — and
the two structural proxies for that were measured and both failed, one by
refusing 46 legitimate requirements and the other by admitting the bad one.

So the residue is an authoring error that admission cannot catch. What the gate
does is put the author at the decision point: they must now write
`kind: "CONTENT"` deliberately, asserting that the document's own words settle
whether a user accepted. That is a claim a human reviewer can see and reject. It
is not a claim a machine can refute without understanding the sentence, and
pretending otherwise would be the `invalid_if` boundary again — the system
appearing to understand legal propositions more deeply than it does.

**The demonstrated false-green path is therefore narrowed, not closed**, and it
is recorded as narrowed rather than reported as fixed. The honest statement is
that a third of the corpus was relying on an unstated default, that default is
gone, and one specific authoring error remains reachable by an author who states
the wrong kind on purpose.
