# TERMS_OF_SERVICE — Phase D3 certification record

**Status: FALSIFICATION_PASSED.** Derived, not declared. The portfolio goes
9 → 10.

**Approval is barred**, and the report says why on its own line: the document
this family generates breaks a coherence relationship. A rung is not a clean bill
of health.

---

## The false green, measured before anything changed

Author the three propositions the document already asserts — that the user
accepted, that the instrument is enforceable, that the parties had capacity and
gave free consent — as ordinary CONTENT satisfied by the clause that asserts
them. Which is the natural authoring, because the sentences are right there in
the text.

**9 of 9 RESOLVED / ESTABLISHED_POSITIVE.**

The system reported that a particular user had accepted, on the strength of a
clause describing a mechanism, for a document drafted before any user exists. It
reported the instrument enforceable because the instrument says so. It reported
free consent and capacity — the very matters in issue where assent by conduct is
disputed — because the document warrants them on the user's behalf.

A service operator would have been told their published terms were enforceable
and accepted.

This is the sharpest false green in this work, and **nothing structural prevents
it.** The defence is that those requirements are not authored, and the reason
they are not authored is D3.2: none of them has a subject in this artifact to
bind to. The requirement model has no subject-binding check of its own, because a
requirement's subject is always the document — the error is authoring a
requirement whose statement is not about the document at all, and the mechanism
that should catch that is an honest `identity_test`. In the naive authoring above
the identity test read "Remove it and nothing records that anyone agreed to be
bound", which is simply false: removing the requirement changes nothing about
what is recorded.

**Recorded as a finding, not repaired.** Whether the admission gate should refuse
a requirement whose identity test is false is a real question, and building it to
make this fixture pass would change the system under test to accommodate the
test.

## Nothing was changed to make the fixture pass

The shipped Terms of Service still asserts its own enforceability, still warrants
the user's free consent and competence, and still ends in a signature block it
says is unnecessary. No `invalid_if` was made executable. No mechanism was added.
`tests/tosFalsification.test.mjs` asserts the document still makes each claim, so
that the evidence cannot quietly start passing against an easier fixture.

## What the system does refuse

| attack | result |
|---|---|
| the three out-of-scope propositions authored as CONTENT | **9/9 green** — the false green, recorded |
| those propositions left unauthored | the six authored requirements resolve and nothing claims acceptance or enforceability |
| a user or version to bind acceptance to | no such field exists in the intake |
| evidence about one subject offered for another | MISMATCHED, never APPLIES |
| amendment folded into the acceptance route | refused: no shared satisfier, so a document with no amendment route cannot report one |
| a requirement resolving without naming its clause | refused: satisfaction is traceable to text in the instrument |

## A discrepancy worth recording

The falsification test reads **CONTRADICTED**; the certification report reads
**AMBIGUOUS_EVIDENCE** for the same relationship. Both bar approval, and both are
correct — they are assessing different texts.

`TOS_ACKNOWLEDGEMENT_001`'s **library** text contains neither the underscores nor
the signature-negation phrase, so the declared extract reads no answer out of it
and the machinery says so: *unknown is not agreement*. Its **rendered** text is a
blank signature block, and against the artifact the reader receives the
relationship contradicts.

This is the library-versus-rendered split arriving in the measurement rather than
in the document, and it is the fragility flagged when the relationship was
authored: the extract alternates between a sentence fragment and a run of
underscores, and the underscores exist only after rendering. The conservative
outcome — AMBIGUOUS where nothing can be read — is the machinery behaving
correctly.

It also exposes a **third** self-certifying assertion: the acknowledgement
clause's library text says the Terms "constitute a valid electronic agreement
under Section 10A", so that clause carries a self-certification in the library
and a signature block in the document, and neither matches the other.

## Open, and classified

**Knowledge — generation defect.** Two self-certifying assertions in the shipped
document (enforceability; free consent and capacity), plus a third in the
acknowledgement clause's library text. Caught by nothing. The tractable form is
an `invalid_if` of the kind that is about the document's own text — *detecting an
assertion is not adjudicating it* — deliberately not built: see
`docs/audit/INVALID_IF_PROBE.md`.

**Knowledge — legal.** Whether "constitute a legally binding electronic agreement
under the Information Technology Act, 2000 … do not require a physical or digital
signature to be enforceable" overstates section 10A. That section provides a
contract is not unenforceable *merely because* it was formed electronically;
whether these terms bind this user still turns on the Contract Act essentials.

**Clause — rendering.** `TOS_ACKNOWLEDGEMENT_001` is categorised
`SIGNATURE_BLOCK` and renders as one, in a family whose whole mechanism is
acceptance by conduct.

**Architecture — open question.** Should the requirement admission gate refuse a
requirement whose `identity_test` is false? It is the only thing standing between
the naive authoring and the 9/9 green.

**Advocate review.** 0 of 6 requirements reviewed, 0 of 22 emitted clauses signed
off. The ladder stops here.
