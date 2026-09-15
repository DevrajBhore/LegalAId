# POSH_POLICY — Phase D2 certification record

**Status: FALSIFICATION_PASSED.** Derived by `familyCertification` from the
evidence below, not declared. The portfolio goes 8 → 9.

**What that does NOT mean.** No requirement here has been reviewed by an
advocate, no clause carries sign-off, and five statutory questions are recorded
unanswered. FALSIFICATION_PASSED says a deliberate attempt to make the family
report green was made and failed. It says nothing about whether the law is right.

---

## Why this family was chosen

The eight anchors are bilateral or unilateral **instruments**, and every
requirement in that corpus asks one of two questions: *does a clause say X*, or
*did an external act happen*. POSH adds two shapes the corpus had no example of —
a requirement about the composition of a body the document constitutes, and an
external act performed toward a workforce rather than before an authority.

## Three abstractions argued for, and none built

| candidate | why it looked necessary | why it was not |
|---|---|---|
| a collection primitive — members, attributes, an aggregate predicate | section 4 fixes the Committee's membership, which is a predicate over a list of people | the system is not being asked to COMPUTE lawful composition; it is being asked to stop asserting it. Deriving it would also need an intake that collects member data, which nobody has decided to build |
| a new requirement kind for body composition | it is neither clause content nor a formal act before an authority | FORMALITY already means *the document provides for an act it cannot perform*, and its ceiling — PROVIDED_FOR — is exactly what a policy can honestly say about a committee it did not constitute |
| a dissemination mechanism | there is no registrar of dissemination, no certificate, no authority to ask | the machinery does four things — bind evidence to a subject, check who supplied it, check currency, notice disagreement — and the subject being a workforce changes none of them |

The family strengthened the existing abstractions rather than growing the
architecture around one document type. That is what D.5 selection is for.

## The requirement matrix

11 requirements: 9 CONTENT, 2 FORMALITY.

`LOCAL_COMMITTEE_ROUTE_STATED` is authored `always`, not gated on headcount.
Section 6 read with section 9(1) gives the Local Committee route both where the
workplace employs fewer than ten AND where the complaint is against the employer,
and the second limb applies at any size. Gating it on the threshold would remove
the route in exactly the case the threshold has nothing to do with — the defect
the employment family's POSH requirement already carries.

## The falsification

**The attack:** author the two formalities the natural way, as ordinary CONTENT
satisfied by their clause being present, and generate a policy with every
question answered.

**The false green:** **11 of 11 RESOLVED / ESTABLISHED_POSITIVE.**

The policy states that the Organisation has constituted an Internal Committee
under section 4, that the Presiding Officer is a woman employed at a senior
level, that the external member comes from a non-governmental organisation, that
not fewer than half the members are women, and that no term exceeds three years.
The assessment agreed with all five. The system holds two typed names.

A green report on a policy whose statutory body may be unlawfully constituted is
worse than no report: constitution under section 4 is the first thing challenged
when a finding is contested.

**Held, as authored:** both formalities stop at PROVIDED_FOR /
`CEILING_FOR_KIND`, and the finding axis is what keeps that from reading as
success.

## Attacks run, and what each establishes

| attack | result |
|---|---|
| the perfect-looking policy — every statutory claim in the text, nothing established | 5 claims made, 0 agreed with |
| Presiding Officer's name only | identity present, qualification unestablished |
| statutory qualifications written **into** the free-text name field | reaches the document, moves nothing. A description is not a position — the loan family's rule, against a statutory qualification this time |
| Local Committee route vs the ten-employee threshold | `always`; POSH collects no headcount field, so nothing can gate it even by accident |
| no dissemination evidence | ABSENT → ESCALATED |
| stale attestation (two years) | STALE → not established |
| two records disagreeing | CONFLICTING → visible, not collapsed to positive |
| evidence about another employer | MISMATCHED → establishes nothing here |
| the policy's own words as evidence | INADMISSIBLE |
| a model's reading of the policy | INADMISSIBLE — the absolute rule, checked at the point of use |
| a current, admissible, on-subject declaration | PRESENT → APPLIES. Without this the proposition would be unusable rather than strict, and every refusal above would pass for the wrong reason |

Pinned by `tests/poshFalsification.test.mjs` and `tests/poshDissemination.test.mjs`.

## Open, and classified

**Knowledge — generation defect.** `POSH_INTERNAL_COMMITTEE_001` asserts five
elements of section 4 on the strength of two names. Whether the repair is to drop
the qualifying phrases, render them conditionally, or carry an open point is a
drafting decision for the advocate. The assessment now refuses to agree with the
assertions; the assertions are still in the document.

**Knowledge — legal.** What makes a dissemination attestation stale. Section 19
imposes a continuing duty and sets no re-display interval;
`evidence_valid_for_days: 365` is a placeholder that says so in its own
`$caution`. A number invented here would become the statutory test by default.

**Intake.** POSH asks `include_non_compete`, `include_non_solicit`, `include_sla`,
`include_reporting`, `termination_for_cause`, `termination_for_convenience` and
`cure_period_days` — commercial-contract questions inherited from COMMON, none of
which can change a statutory workplace policy. Six of them are confirmed dead at
runtime. Part of the 148-instance population in `DEAD_QUESTIONS.md`.

**Advocate review.** 0 of 11 requirements reviewed, 0 of 7 emitted clauses signed
off, no family-level review on record. The ladder stops here until that changes.
