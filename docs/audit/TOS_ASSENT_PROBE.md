# Phase D3.1 — what a Terms of Service claims about assent

## Three propositions the document runs together

| | proposition | what could settle it |
|---|---|---|
| PUBLISHED | the terms exist and are reachable | trivially true — the system just generated them |
| MECHANISM | an acceptance mechanism is provided for | the clause text. A CONTENT question, and the one the document can answer |
| ACCEPTED | a particular user assented to THIS version | evidence about a person the system never meets |

## What the generated document actually claims

| kind of claim | present | what it says |
|---|---|---|
| **MECHANISM** | yes | states how assent is given — a contractual mechanism, and a legitimate one. NOTE: this is the SAME SENTENCE as the claim below, so the document cannot state the mechanism without also asserting that the reader read and understood. |
| **MECHANISM** | yes | states that continued use after a change is acceptance of the change |
| **ABOUT THE USER** | yes | asserts the reader HAS read and understood — a fact about a person the system never meets |
| **CONCLUSION OF LAW** | yes | asserts the instrument's own enforceability |
| **CONCLUSION OF LAW** | yes | asserts it binds without signature |
| **WARRANTY BY A PARTY WHO NEVER SPOKE** | yes | has 'the Parties' warrant FREE CONSENT — the very thing in issue where assent is disputed |
| **WARRANTY BY A PARTY WHO NEVER SPOKE** | yes | has the user warrant their own capacity |

## The clause's own invalidity conditions

- invalid if: No mechanism of acceptance is described
- invalid if: Services are not identified

Both are about the DOCUMENT — whether it describes a mechanism, whether it identifies
the services. Neither is about whether anybody accepted.

## TOS_ACKNOWLEDGEMENT_001 contradicts itself

| | says |
|---|---|
| library text | **no signature is required for these Terms to be binding** |
| as rendered | **a blank signature block** — Name, Designation, Date, Place |
| category | `SIGNATURE_BLOCK` |

A published Terms of Service is not countersigned — acceptance by conduct is the whole
mechanism. A blank signature line at the foot invites the reader to think the instrument
is not yet effective, and it contradicts the acceptance clause three paragraphs above.


---

## The finding

A Terms of Service can do something a POSH policy cannot. POSH asserted a **fact
about the world** — that a committee was lawfully constituted — which better
evidence would settle. These Terms assert a **conclusion of law about
themselves**:

> "These Terms constitute a legally binding electronic agreement under the
> Information Technology Act, 2000 and do not require a physical or digital
> signature to be enforceable."

No evidence settles that. It is the instrument grading its own enforceability,
published by the party who benefits from the answer, in a document the other
party may never have opened.

Section 10A of the Information Technology Act, 2000 provides that a contract is
not unenforceable **merely because** it was formed electronically. Whether *these*
terms bind *this* user still turns on the Contract Act essentials — offer,
acceptance, consideration, capacity, free consent. **Whether the sentence
overstates section 10A is a question for the advocate**, and it is recorded as
one rather than answered here.

### And the user warrants things the user never said

The rendered document continues:

> "The Parties represent and warrant that: … (b) This Agreement is entered into
> with free consent under Sections 13–19 of the Indian Contract Act, 1872;
> (c) Each Party is competent to contract under applicable law."

A published Terms of Service has no "Parties" who have represented anything. The
user is not in the room. **Free consent is precisely what is in issue** where
assent by conduct is disputed, so a document warranting it on the user's behalf
is circular: the instrument supplies the evidence for its own formation.

### The mechanism and the assertion are one sentence

"By accessing, registering for, or using the Services, you acknowledge that you
have read, understood, and agree to be bound" does two different things at once.
Stating the mechanism is legitimate and necessary. Asserting that the reader HAS
read and understood is a claim about a person the system never meets. They cannot
be separated as drafted, which is why the distinction has to be carried by the
requirement rather than by the prose.

## Three propositions, and only one of them is the document's to answer

```
PUBLISHED   the terms exist and are reachable
            trivially true — the system just generated them

MECHANISM   an acceptance mechanism is provided for
            a CONTENT question, and the one the document CAN answer

ACCEPTED    a particular user assented to THIS version
            evidence about a person the system never meets, and a
            different question for every user and every version
```

`TOS_ACCEPTANCE_001`'s own `invalid_if` entries — "No mechanism of acceptance is
described", "Services are not identified" — are both about the DOCUMENT. Nothing
in the family is about whether anybody accepted.

## What D3.2 has to decide

Whether ACCEPTED is a requirement this family should carry at all.

It is not obvious that it should. A Terms of Service is an instrument *offered*;
acceptance happens later, per user, per version, outside the document, and a
drafting system has no view of it. The honest answer may be that MECHANISM is the
requirement and ACCEPTED is not in scope — in which case the defect is the three
sentences above claiming otherwise, and no new machinery is needed at all.

That is the same shape POSH resolved three times: the pressure was not for a new
primitive but for the document to stop asserting what nothing establishes.
