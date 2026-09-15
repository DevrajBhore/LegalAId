# Phase D3.3 — a different false green

## What the naive authoring produced

Six requirements, authored as ordinary CONTENT with clause presence treated as
satisfaction. **6 of 6 RESOLVED / ESTABLISHED_POSITIVE.**

And every one of them is **correctly** resolved. The document does identify the
service. It does state substantive terms. It does provide an acceptance route, an
amendment route, a basis for withdrawal of access, and a grievance route. There
is no requirement here reporting something it should not.

The document nevertheless contains:

1. **"These Terms constitute a legally binding electronic agreement under the
   Information Technology Act, 2000 and do not require a physical or digital
   signature to be enforceable."** — the instrument grading its own
   enforceability.
2. **"The Parties represent and warrant that … this Agreement is entered into
   with free consent under Sections 13–19 … Each Party is competent to
   contract."** — the user warranting the very thing in issue where assent by
   conduct is disputed.
3. **`TOS_ACKNOWLEDGEMENT_001` renders a blank signature block** while saying no
   signature is required.

## This is not POSH's false green

They are different failures and it matters which one you are looking at.

| | POSH | Terms of Service |
|---|---|---|
| what went wrong | a requirement reported satisfied when it was not | every requirement is rightly satisfied |
| the false green | 11/11 RESOLVED, two of them wrongly | 6/6 RESOLVED, none of them wrongly |
| the cause | an external act authored as ordinary content | the matrix says what must be PRESENT and never what must be ABSENT |
| the repair | author the two as FORMALITY | not a matrix repair at all |

A requirement matrix is a statement about presence. It has no vocabulary for *the
document must not assert this*, and no amount of correct authoring gives it one.
So a complete, correct matrix can return a clean sheet over a document that says
things it has no business saying.

That is the MSA finding — boilerplate coverage is not identity — turned around.
There the matrix was too small to see a defect. Here the matrix is right, and the
defect is of a kind matrices do not see.

## What the existing machinery does catch

Defect 3 **is** machine-checkable, and by machinery that already exists. It is a
disagreement between two clauses about one question, which is exactly what a
coherence relationship is for:

```
SIGNATURE_REQUIREMENT_COHERENT   CONTRADICTED
  The instrument gives 2 different answers to "whether a signature is required
  for these Terms to bind": TOS_ACCEPTANCE_001 says do not require a physical or
  digital signature; TOS_ACKNOWLEDGEMENT_001 says ______________
```

**The fifth candidate abstraction refused across these two families.** No new
mechanism: the NDA's relationship model carries it.

One caution, recorded rather than glossed. This extract alternates between a
sentence fragment and a run of underscores — two surface forms of opposite
answers, not two instances of one pattern. That is more fragile than the NDA
case, where both clauses state a period the same way, and the NDA relationship's
own comment warns that comparing the wrong quantities is worse than not
comparing. It is contained because `between` scopes the extract to two named
clauses, but a blank line appearing in `TOS_ACCEPTANCE_001` would match the wrong
alternative.

## What nothing catches

Defects 1 and 2 are single-clause assertions with no counterpart to contradict.
No requirement asks about them, because requirements are satisfied by presence.
No relationship catches them, because nothing disagrees with them.

The artifact designed for exactly this is `invalid_if` — and
`TOS_ACCEPTANCE_001` already carries two entries, both about the document ("No
mechanism of acceptance is described", "Services are not identified") and neither
about self-certification. `invalid_if` is prose for advocate review on 250 of 315
clauses and is not machine-evaluated.

**Whether it should be is a decision, and it is not taken here.** The system's
existing design routes negative legal conditions to a human deliberately — the
same boundary that stops it authoring law it cannot verify. Making `invalid_if`
executable would mean deciding that a machine can determine when a clause is
legally invalid, which is a much larger claim than anything the system currently
makes. Recorded as the open architectural question this family raises, with no
implementation attached.

## A note on the matrix that had to be widened

The first version of this matrix had three requirements and was refused by the
portfolio floor — every family must declare at least five.

The floor was right. Having established in D3.2 that a particular user's
acceptance is out of scope, I narrowed too far and left out things that genuinely
are the instrument's identity: how the terms change and what binds a user to a
version they have not seen, on what basis access may be withdrawn, and who hears
a grievance. `TOS_CHANGES_TO_TERMS_001` had also been folded into
ACCEPTANCE_ROUTE_PROVIDED as an alternative satisfier, which would have let a
document with no amendment route report a route provided — accepting terms and
becoming bound by a later revision are different events with different
mechanisms.

A rule that exists to catch under-authoring caught under-authoring.
