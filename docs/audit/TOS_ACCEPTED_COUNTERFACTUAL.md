# Phase D3.2 — does ACCEPTED belong in the Terms of Service matrix?

## The five candidates

| candidate | the question | answered by | in the document? |
|---|---|---|---|
| `TERMS_IDENTIFY_THE_SERVICE` | What instrument is being offered? | the document | yes |
| `TERMS_STATE_THEIR_PROVISIONS` | What does the instrument provide? | the document | yes |
| `ACCEPTANCE_MECHANISM_PROVIDED` | Does the instrument define a route by which assent may occur? | the document | yes |
| `USER_ACCEPTED` | Did THIS user assent to THIS version? | evidence about a person | n/a — not a question about the text |
| `ACCEPTANCE_CREATED_AN_ENFORCEABLE_AGREEMENT` | Did that assent form a binding contract? | a court | n/a — not a question about the text |

## The decisive test: what subject would it bind to?

Every proposition in this system binds to a subject taken from the intake, so that
evidence about one party establishes nothing about another. The binding is not
decoration — it is what stopped a POSH attestation for another employer from counting.

Fields in the Terms of Service intake that could name a user or a version: **none**

`hosts_user_content` is a yes/no about the SERVICE, not a person.

And the machinery already refuses evidence whose subject does not match:

```
evidence about one subject, asked about another  ->  EVIDENCE_MISMATCHED / ESCALATED
```

## The counterfactual

Remove `USER_ACCEPTED` from the matrix. What becomes impossible to describe?

| still fully describable | no longer describable |
|---|---|
| `TERMS_IDENTIFY_THE_SERVICE` | `USER_ACCEPTED` |
| `TERMS_STATE_THEIR_PROVISIONS` | `ACCEPTANCE_CREATED_AN_ENFORCEABLE_AGREEMENT` |
| `ACCEPTANCE_MECHANISM_PROVIDED` |  |

---

## The finding

**`USER_ACCEPTED` does not belong in the Terms of Service requirement matrix**,
and the existing machinery already says so without being extended. The fourth
abstraction in two families argued for and then refused.

### Why subject binding settles it

Every proposition in this system binds to a subject drawn from the intake. That
binding is not bookkeeping — it is what made a POSH attestation for *another
employer* establish nothing, and it is checked before provenance, currency or
agreement between records.

A Terms of Service intake has **no field that could name a user or a version**,
and the reason is structural rather than an omission someone could fix: the
instrument is drafted **once, before any user exists**, and then accepted by many
people, at different times, against different versions. There is no user to bind
to at drafting time and there never can be.

So the machinery's answer is not "I cannot express this". It is "this is not
about anything the document knows" — which is the correct answer, arrived at
through a check that was built for something else entirely.

### The counterfactual

Remove `USER_ACCEPTED` and nothing about the Terms of Service becomes
indescribable. What instrument is offered, what it provides, and by what route
assent may be given are all still fully answerable from the document. What is
lost is a claim about a person, which the document was never in a position to
make.

### The clean boundary

```
the instrument          defines and offers terms
                        defines an acceptance mechanism where appropriate

                        does NOT establish that a particular person accepted
                        does NOT establish that acceptance produced enforceability
```

A per-user acceptance record is a real thing a running product holds — a
timestamp, an IP address, a version hash. It is simply not a property of the
drafted instrument, and a drafting system that claimed it would be asserting
something only the service operator's logs could answer.

**The invariant this suggests is not promoted here.** "An instrument cannot
establish a lifecycle event merely by declaring that the event occurred" is the
right shape, but the probe has shown the existing machinery already enforces it
through subject binding. Writing it into INVARIANTS.md would record an
observation as though it were new architecture.

## What the three defects become

With `USER_ACCEPTED` out of scope, the three findings from D3.1 are not an
assent-modelling problem at all. They are the document claiming what lies outside
it, and each needs its own repair:

| # | defect | kind |
|---|---|---|
| 1 | "These Terms constitute a legally binding electronic agreement … and do not require a physical or digital signature to be enforceable" | **self-certifying enforceability** — a conclusion of law about the instrument, stated by the instrument |
| 2 | "The Parties represent and warrant that … this Agreement is entered into with free consent … Each Party is competent to contract" | **self-certifying formation** — the user warrants the very thing in issue where assent by conduct is disputed |
| 3 | `TOS_ACKNOWLEDGEMENT_001` says no signature is required, and renders a blank signature block | **library → rendering coherence** — not a legal-concept failure at all |

Kept apart deliberately. The third is the most tractable and the least about law:
the same library-versus-rendered split that made the loan's events-of-default
clause assert security it never created. It is pinned separately because a fix to
either legal-concept defect would leave it standing.

## A measurement note

The first run of the D3.1 probe reported two of these claims ABSENT. Both were in
the document. The pattern allowed 60 characters between "you" and "agree to be
bound"; the rendered sentence has 62, because it carries the parenthetical
`('User' or 'you')`.

Sixth error of the family, and the same lesson each time: **compare against the
shipped artifact, not a paraphrase of it.** A hand-counted approximation of what
the text ought to say is a second source of truth, and it drifts from the first
immediately.
