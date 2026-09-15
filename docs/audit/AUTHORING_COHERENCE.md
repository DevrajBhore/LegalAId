# Authoring coherence — five findings, five repairs

**Status: all five repaired. The fact-source repair is no longer blocked on
authoring, and is blocked on nothing.**

Each repair follows what the artifact ITSELF already asserted. A requirement
naming two duties was split into two. A gate contradicting its own statement was
moved to the condition the statement names. A proxy was replaced by the fact it
stood for. A requirement covering one branch of a clause's declared invalidity
was split to cover both.

**None of it settles the statutory questions.** Those are flagged as
`$verification_needed` inside the knowledge artifacts, where an advocate reading
the requirement will see them, rather than only in this file:

| requirement | still unverified |
|---|---|
| `POSH_AWARENESS_REFLECTED` | POSH Act 2013 s.19 — do the duties attach without a headcount threshold? |
| `POSH_INTERNAL_COMMITTEE_REFLECTED` | POSH Act 2013 s.4 — the threshold, and who counts toward the ten |
| `MATERNITY_ENTITLEMENT` | Maternity Benefit Act 1961 — coverage threshold, and whether individual eligibility is a second condition |
| `WORK_PRODUCT_OWNERSHIP` | Copyright Act 1957 s.17(c) — the edges of "in the course of employment" |
| `ENFORCEMENT_MATCHES_LENDER_ELIGIBILITY` | SARFAESI Act 2002 s.2(1)(zd) — which lenders are "secured creditors", and whether `lender_type` distinguishes them |
| `PERSONNEL_CONTINUITY` | *(none — no statutory question involved)* |

---

## What each repair did

**`POSH_DUTY_REFLECTED` → two requirements.** It named a s.19 duty its own
identity_test called unconditional beside the s.4 Internal Committee duty the
headcount governs, and gated both on the headcount. Now
`POSH_AWARENESS_REFLECTED` (unconditional) and
`POSH_INTERNAL_COMMITTEE_REFLECTED` (ten or more, the threshold
`POSH_INTERNAL_COMMITTEE_001` states in its own text).

**A finding the split immediately exposed:** at a workplace under ten, the
generated employment contract carries no POSH clause at all, so
`POSH_AWARENESS_REFLECTED` reports `UNRESOLVED`. Under the requirement's own
reading of s.19 that duty applies there. The blueprint gates every POSH clause on
headcount. Whether that is right is the s.19 question.

**`MATERNITY_ENTITLEMENT` → gated on establishment coverage.** Its statement
already said "where the establishment is covered"; the gate was the employee's
sex. `establishment_is_covered` is derived from the headcount answer the user
already gives, so nobody is asked twice.

**`WORK_PRODUCT_OWNERSHIP` → unconditional.** Its argument is about the gap
s.17(c) leaves, which is widest where nothing has been assigned; the gate fired
only where assignment was present. The three-state `ip_ownership` field is what
*satisfies* it — `assigns_copyright` was a boolean flattening of that field being
used to decide whether the question arose at all.

**`PERSONNEL_CONTINUITY` → a real fact.** `include_sla` was a contractual
mechanism standing in for a commercial fact. A new intake question asks whether
the engagement depends on named individuals:

```
fact      the work depends on named individuals
  -> position    key-person continuity matters here
    -> requirement  continuity needs contractual treatment
      -> treatment    assignment and replacement mechanism
        -> clause       SERVICE_KEY_PERSONNEL_001
```

An SLA is now one treatment available for that position rather than the thing
deciding the position exists.

**`ENFORCEMENT_MATCHES_THE_LOAN` → two requirements, one per branch.** The clause
declares `["Lender is not a SARFAESI-eligible secured creditor", "Loan is
unsecured"]` and the requirement modelled the second. A secured loan from an
ineligible lender was outside any requirement while the clause remained invalid by
its own terms. `lender_is_regulated` is used as the **closest established fact**
and is explicitly not the statutory test.

## The five are not one defect — four shapes

Naming them separately matters, because the repair differs and because a
taxonomy is what lets the next family's requirements be checked at authoring
time rather than after.

**1. The gate names a different legal boundary from the statement.**
`MATERNITY_ENTITLEMENT` — establishment coverage versus the employee's sex. The
most direct form, and the easiest to see once the two are set side by side.

**2. The requirement argues from a gap and the gate selects the opposite
population.** `WORK_PRODUCT_OWNERSHIP` — the argument is that s.17(c) leaves work
at the edges disputed, which is most acute where nothing has been assigned, and
the gate fires only where assignment is present. Particularly dangerous: the
requirement reads as careful legal reasoning while its predicate defeats its own
stated purpose.

**3. A drafting choice stands in for a substantive condition.**
`PERSONNEL_CONTINUITY` — `include_sla` as a proxy for key-person dependence. This
is the document-feature-as-legal-condition shortcut the architecture exists to
remove, surviving inside a requirement.

**4. A requirement covers one branch of a clause's authored invalidity.**
`ENFORCEMENT_MATCHES_THE_LOAN` — the clause declares
`["Lender is not a SARFAESI-eligible secured creditor", "Loan is unsecured"]` and
the requirement models the second. `secured + ineligible lender` therefore falls
outside a requirement written to certify that clause's boundary, while the clause
remains invalid by its own terms.

From the fourth, a principle worth keeping:

> A requirement intended to certify a clause boundary may not represent only one
> branch of that clause's authored invalidity condition unless the omission is
> deliberate and separately covered.

`POSH_DUTY_REFLECTED` is shape 1 with an aggravating feature: the two boundaries
belong to two different duties, so the repair is probably a split rather than a
change of gate.

---

## BLOCKER 1 — `EMPLOYMENT_CONTRACT / POSH_DUTY_REFLECTED`

```
gate       employer_headcount_ge_10 == true
statement  The employer's obligations under the sexual harassment legislation are reflected.
identity   ...a duty section 19 of the POSH Act, 2013 imposes REGARDLESS — leaving the
           employee unaware of the Internal Committee that section 4 requires...
```

The identity test names **two duties with different triggers** and the gate
implements one. s.19 is described by the requirement's own text as applying
regardless; the s.4 Internal Committee obligation is what the headcount governs.

**Transition if repaired as-is:** `APPLICABILITY_UNKNOWN → NOT_APPLICABLE` for a
sub-ten workplace — reporting inapplicable a duty the requirement says is not.

**Question for an advocate:** one requirement or two?

---

## BLOCKER 2 — `EMPLOYMENT_CONTRACT / MATERNITY_ENTITLEMENT`

```
gate       is_female_employee == true
statement  Maternity benefit entitlement is reflected WHERE THE ESTABLISHMENT IS COVERED.
```

The statement's own condition is **establishment coverage**. The gate is the
**employee's sex**. These are different boundaries, and the requirement names the
one it does not implement.

A second question sits behind it: whether a contract term should be gated on an
employee's sex at all, or stated irrespective. That is a drafting judgement and
is not decided here.

**Question for an advocate:** which condition governs — coverage of the
establishment, the employee, or both?

---

## BLOCKER 3 — `EMPLOYMENT_CONTRACT / WORK_PRODUCT_OWNERSHIP`

```
gate       assigns_copyright == true
statement  Who owns what the employee creates is stated.
identity   ...section 17(c) vests first ownership in the employer ONLY for work made under
           a contract of service in the course of employment — which leaves everything at
           the edges disputed.
```

The identity test's argument is about **the gap s.17(c) leaves**. That gap exists
whether or not the contract assigns copyright — and is widest when nothing has
been said. Gating on `assigns_copyright == true` makes the requirement apply only
where the contract already addresses assignment, which is the case in which the
gap is smallest.

**Question for an advocate:** is this requirement about the presence of an
assignment, or about the absence of clarity the assignment would cure?

---

## BLOCKER 4 — `MASTER_SERVICE_AGREEMENT / PERSONNEL_CONTINUITY`

```
gate       include_sla == true
statement  Where the engagement DEPENDS ON PARTICULAR PEOPLE, their assignment and
           replacement is settled.
```

The stated condition is dependence on named individuals. The gate is whether
service levels were included. An engagement can turn entirely on two named
architects and carry no SLA; an SLA-heavy engagement can be wholly fungible.
`include_sla` is standing in for a condition nobody collects.

**Question for an advocate:** what establishes key-person dependence?

---

## MY OWN — `LOAN_AGREEMENT / ENFORCEMENT_MATCHES_THE_LOAN`

```
gate       is_secured == false
statement  The enforcement remedies the instrument asserts are ones this loan can
           actually support.
```

The statement is unconditional; the gate covers one case. The clause it guards
declares **two** conditions of its own:

```
LOAN_SARFAESI_ENFORCEMENT_001.invalid_if = [
  "Lender is not a SARFAESI-eligible secured creditor",
  "Loan is unsecured" ]
```

I authored the requirement against the second and not the first — the same shape
of defect as the blueprint gate it was written to catch, which implements lender
eligibility and not security. A secured loan from an ineligible lender still
ships the clause and this requirement reports `NOT_APPLICABLE`.

**Not repaired here** for the same reason as the others: the boundary is a legal
question about who is a "secured creditor" under the Act, and the system holds no
established fact for it.

---

## Coherent — no mismatch found

| requirement | gate | statement's condition |
|---|---|---|
| `LOAN / SECURITY_POSITION_SETTLED` | `is_secured` | "where the loan is secured" |
| `LOAN / SECURITY_PERFECTION_PROVIDED_FOR` | `is_secured` | "where the loan is secured" |
| `MSA / SERVICE_LEVELS_MEASURED` | `include_sla` | "where performance standards are promised" |
| `MSA / PERSONAL_DATA_HANDLED` | `processes_personal_data` | "where personal data is processed" |

Four of nine state the condition their gate implements.

---

## Consequence for the repair

**The fact-source repair is blocked on five authoring decisions, not one.** Five
of nine requirements would become determinate on a boundary their own text does
not describe. The parity fix is correct and must wait: an assessment that reads
the same facts as generation is only an improvement if what it is assessing means
what it says.

Each case is held in `tests/authoringCoherence.test.mjs` as **retire or replace,
never delete** — carrying its gate, the wording the finding rests on, the
question for an advocate, and a `resolution` that is null until one is taken. An
unresolved case must still exhibit its conflict, so rewriting the prose until the
finding is unquotable fails rather than passes. A resolved one must say what was
decided, what the boundary now is, and who decided, and must show a change in the
knowledge base — a resolution that leaves gate and wording untouched has decided
nothing. Three evasions were tried against it and all three fail.

### The five questions, which are legal and not engineering

| requirement | the question |
|---|---|
| `POSH_DUTY_REFLECTED` | one requirement or two — the unconditional s.19 duty, the s.4 threshold duty, or both authored separately? |
| `MATERNITY_ENTITLEMENT` | which condition governs — coverage of the establishment, eligibility of the employee, or both represented separately? |
| `WORK_PRODUCT_OWNERSHIP` | what population is protected — assignment absent, disputed, or present but incomplete? |
| `PERSONNEL_CONTINUITY` | what fact establishes key-person dependence, given the intake does not collect one? |
| `ENFORCEMENT_MATCHES_THE_LOAN` | unsecured-loan compatibility only, lender eligibility only, or the clause's complete `invalid_if` boundary? |
