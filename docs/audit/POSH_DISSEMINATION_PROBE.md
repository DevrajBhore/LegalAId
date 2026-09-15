# Phase D2.4 — the dissemination probe

## 1. The proposition, as the requirement states it

> The policy is notified and displayed at a conspicuous place at the workplace.

**Outside the document:** Display and communication are acts performed on the workplace, not statements made in the policy. POSH_POLICY_ADOPTION_001 already carries 'The policy is adopted but not disseminated to employees' as its own invalid_if, so the artifact states the gap; nothing establishes whether the act occurred.

## 2. What the system observes

The generated policy **does** contain words asserting display or dissemination.
Nothing observes a workplace noticeboard, an email to staff, or an intranet page.
There is no registrar of dissemination, so unlike registration and stamping there is
no authority whose record could be fetched.

## 3. Provenance, run through the existing admission gate

| candidate source | what it would be | outcome |
|---|---|---|
| `ai_inference` | a model reading the policy text and concluding it was displayed | EVIDENCE_INADMISSIBLE → ESCALATED |
| `clause_text` | the policy's own sentence saying the notice is displayed | EVIDENCE_INADMISSIBLE → ESCALATED |
| `operator_declaration` | the employer ticking a box to say they displayed it | EVIDENCE_PRESENT → APPLIES |
| `third_party_attestation` | a signed confirmation from someone who saw it | EVIDENCE_PRESENT → APPLIES |
| `public_register` | a registry of disseminated policies — no such registry exists | EVIDENCE_INADMISSIBLE → ESCALATED |
| `system_observation` | the system itself observing the workplace | EVIDENCE_INADMISSIBLE → ESCALATED |

Absolutely inadmissible, whatever a declaration says: `ai_inference`, `model_inference`, `llm`

## 4. The states the requirement must tell apart

| situation | evidence state | applicability | value |
|---|---|---|---|
| nothing supplied | EVIDENCE_ABSENT | ESCALATED | — |
| the employer says they displayed it | EVIDENCE_PRESENT | APPLIES | true |
| the employer says they did NOT | EVIDENCE_PRESENT | DOES_NOT_APPLY | false |
| attested by a third party | EVIDENCE_PRESENT | APPLIES | true |
| attested two years ago | EVIDENCE_STALE | ESCALATED | — |
| two records that disagree | EVIDENCE_CONFLICTING | ESCALATED | — |
| inferred by a model from the policy text | EVIDENCE_INADMISSIBLE | ESCALATED | — |
| about a different company | EVIDENCE_MISMATCHED | ESCALATED | — |

---

## 5. Does this need a new primitive?

**No.** The existing evidence machinery carries it unchanged — the third
abstraction this family made a case for and then failed to justify, after the
list-of-people composition model and a new requirement kind.

Seven states are told apart, which is what a dissemination requirement has to be
able to say:

| the world | the system |
|---|---|
| nobody has said anything | ABSENT → ESCALATED |
| the employer says they displayed it | PRESENT → APPLIES |
| the employer says they did **not** | PRESENT → **DOES_NOT_APPLY** |
| a third party attests to it | PRESENT → APPLIES |
| the attestation is two years old | STALE → ESCALATED |
| two records disagree | CONFLICTING → ESCALATED |
| the evidence is about another company | MISMATCHED → ESCALATED |

The third row is the loan family's rule holding on a different layer: a stated
negative is a POSITION, not silence. The employer saying they did not display the
policy is an answer, and the system records it as one rather than folding it back
into "unknown".

Dissemination differs from registration in the world — no registrar, no
certificate, no authority to ask — but not in what the machinery must do with it:
bind evidence to a subject, check who supplied it, check whether it is current,
notice when records disagree. Those are the same four operations, and the fact
that the subject is a workforce rather than a registry changes none of them.

## 6. The path that would have made every policy self-certifying

The generated policy **does** contain sentences asserting display —
`POSH_POLICY_ADOPTION_001` and `POSH_CONSEQUENCES_REPORTING_001` both say so. So
the dangerous route is not that the system fails to find evidence; it is that the
document's own words become the evidence.

`admissible_provenance` on the declaration is `["operator_declaration",
"third_party_attestation"]`, and `clause_text`, `ai_inference`, `document_text`
and `llm` are all refused — the first by the declaration's own list, the rest by
the absolute rule that an inference can never be the authority for an affirmative
legal conclusion. Pinned by `tests/poshDissemination.test.mjs`.

The two paths stay apart by construction:

```
clause path      POLICY_DISSEMINATED is a FORMALITY satisfied_by clause ids
                 → PROVIDED_FOR / CEILING_FOR_KIND
                 the policy provides for the act. Never that it happened.

evidence path    posh_policy_disseminated, established only by an employer
                 declaration or a third-party attestation
                 → whether it happened
```

## 7. What is left open, and left open deliberately

`evidence_valid_for_days: 365` is a placeholder and says so in the declaration's
own `$caution`. Section 19 imposes a continuing duty and sets no re-display
interval, so what makes an attestation stale is a legal question. A number
invented here would become the answer by default, which is how a proxy becomes a
statutory test.

## A note on how this probe was run

The first three runs of this script were wrong, and all three were the same
mistake: calling the evidence API the way it seemed to work rather than the way
it does. `establish(declaration, record)` instead of
`establish(propositionId, records, variables)`; `source` where the gate reads
`provenance`; `value` where it reads `state`; `as_at` where it reads `as_of`.
Every one produced a plausible, wrong table — six sources uniformly
INADMISSIBLE, which would have read as "the machinery cannot express this" and
argued for the new primitive.

The subject-binding case is what exposed it: MISMATCHED came back correctly while
everything else was INADMISSIBLE, which meant the declaration was loading and
only the record shape was wrong. A probe whose every row fails identically is
reporting on itself.
