# Phase D2.3 — the Internal Committee composition probe

## The statutory tests, as the clause itself states them

- invalid if: The Presiding Officer is not a woman employed at a senior level
- invalid if: Fewer than one half of the members are women
- invalid if: There is no external member from a non-governmental organisation or a person familiar with the issues
- invalid if: A term exceeding three years is fixed

## What the shipped policy ASSERTS

| assertion | present in the shipped clause |
|---|---|
| Presiding Officer is a woman at a senior level | **yes — the document says so** |
| not fewer than half the members are women | **yes — the document says so** |
| an external member from an NGO or familiar with the issues | **yes — the document says so** |
| the committee has been constituted | **yes — the document says so** |

## What the intake COLLECTS about the committee

| field | type | what it establishes |
|---|---|---|
| posh_presiding_officer | text, required | a NAME, and nothing about that person's attributes |
| posh_external_member | text, required | a NAME, and nothing about that person's attributes |
| posh_committee_contact | text, required | a NAME, and nothing about that person's attributes |
| posh_district | text, required | a NAME, and nothing about that person's attributes |

## What could establish the statutory tests

Declared semantic facts (7): is_secured, lender_is_regulated, employer_headcount_ge_10, establishment_is_covered, key_person_dependency, include_sla, processes_personal_data

Evidence propositions (6): processes_personal_data, company_processes_personal_data, firm_processes_personal_data, jv_processes_personal_data, lender_is_nbfc, lender_is_regulated

**Establishing the composition: NOTHING.**

---

## The finding

The clause authors four statutory tests as `invalid_if`. The shipped policy
**asserts all four as satisfied**. The intake collects four fields, all free
text. **Nothing establishes any of the four.**

Read as the document reads:

> "The Organisation **has constituted** an Internal Committee under Section 4…
> (a) The Presiding Officer is *{{posh_presiding_officer}}*, **a woman employed
> at a senior level** at the workplace… (c) The external member is
> *{{posh_external_member}}*, **drawn from a non-governmental organisation**…
> (d) **Not fewer than one half** of the total members of the Committee are
> women. (e) Members hold office for a term **not exceeding three years**."

Every emphasised phrase is a statutory qualification the document asserts on the
strength of a typed name. The system does not know the Presiding Officer's
gender, seniority, the total number of members, how many are women, where the
external member is drawn from, or when anyone was nominated.

This is the shape of the `is_secured` defect — an affirmative legal position with
nothing behind it — with a sharper consequence. A loan that misstates its
security misstates a bargain between two parties. A POSH policy that misstates
the Committee's constitution is a statement to every employee about the mechanism
the Act gives them, and constitution under s.4 is the first thing examined when a
complaint is contested.

Recorded as a defect, not repaired here: the repair is a drafting decision.

## Does this require a list-of-people primitive?

**No — not to make the document honest.** That was the question the probe existed
to answer, and the answer kills the abstraction before it is built.

The defect is not that the system cannot COMPUTE lawful composition. It is that
the document ASSERTS lawful composition. Those need different things:

| to do this | you need |
|---|---|
| stop asserting what nothing establishes | nothing new — draft the clause to state the appointment and leave the qualification to be established |
| report honestly whether it is established | one admitted proposition, `internal_committee_lawfully_constituted`, with its own `admissible_provenance`. The evidence layer already has seven states and a provenance gate, and PRESENT / ABSENT / UNVERIFIABLE over a single proposition is exactly the reporting this needs |
| have the system DERIVE lawfulness from the members | a collection primitive — members, attributes, an aggregate predicate — **and an intake that collects member data, which nobody has decided to build** |

Only the third needs the new primitive, and the third is a product decision about
what to ask the user, not a gap in the engine. The existing FACT → POSITION →
REQUIREMENT model plus the evidence-proposition layer can carry rows one and two
without any new semantics.

**So the composition requirement is not yet abstraction pressure.** If the
product later decides to collect the Committee's membership, the pressure becomes
real and the primitive generalises at once to partner counts, board composition
and quorum. Until then, building it would be authoring architecture for a
requirement nobody has asked the system to evaluate — the thing the standing rule
exists to prevent, and the thing the 29-orphan-propositions measurement error
once nearly caused.

## A second defect, found in passing

The POSH intake asks `include_non_compete`, `include_non_solicit`, `include_sla`,
`include_reporting`, `termination_for_cause`, `termination_for_convenience` and
`cure_period_days` — commercial-contract questions inherited from COMMON and put
to someone drafting a statutory workplace policy. None of them can affect a POSH
policy: the blueprint has no conditional clauses at all, and the family's
hardening baseline is empty.

Invariant 34's shape — a question the knowledge cannot honour — on seven fields
at once. Not repaired here; recorded for D2.2, where the requirement matrix will
say which questions this family actually needs.
