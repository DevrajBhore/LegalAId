# CORE_DISPUTE_RESOLUTION_001 — cardinality probe

Carried by **36** document types. Distinct shipped structures: **1**.

One structure means one classification decision covers every family that carries it.

## Sentence by sentence — and why this table is not the answer

| # | binary party language | sentence |
|---|---|---|
| 1 | **binary** | Any dispute, controversy, or claim arising out of or in connection with this Agreement shall first be attempte… |
| 2 | — | If the dispute remains unresolved within fifteen (15) days of written notice, it shall be referred to arbitrat… |
| 3 | collective | The arbitration shall be conducted by a sole arbitrator jointly appointed by the Parties and, failing agreemen… |
| 4 | — | The arbitration shall be conducted on the following terms:
(a) The seat of arbitration shall be Pune, Maharash… |
| 5 | collective | (b) Hearings may be held at <SEAT> or, where the arbitrator so directs or the Parties agree, by video conferen… |
| 6 | — | (c) The arbitral tribunal shall consist of a sole arbitrator, and the proceedings and the award shall be in th… |
| 7 | collective | (d) The award shall be in writing, shall state the reasons on which it is based, and shall be final and bindin… |
| 8 | collective | (e) The arbitrator shall determine the costs of the arbitration, including the fees and expenses of the arbitr… |
| 9 | — | (f) Nothing in this clause prevents a Party from applying to a competent court for interim measures of protect… |

**The scan flags sentence 1. The open question is in sentence 2.**

Sentence 1 contains "between the Parties" and is harmless: a good-faith
discussion among three is the same obligation as between two. Sentence 2 contains no
party reference whatsoever — "it shall be referred to arbitration" — and carries the
decision that is worth money.

So LEXICAL PARTY-REFERENCE SCANNING DOES NOT FIND N-PARTY QUESTIONS. It finds a
subset: the ones visible in the pronouns. Invariant 60's twenty-three clauses were
found that way, which means the classified set is biased toward lexically-visible
problems and the 162 unclassified clauses may hold more of this kind — a question
about STRUCTURE hiding in a sentence that names nobody. The 12% figure is a ceiling on
what has been examined, not a floor on what is wrong.

## What actually changes at three parties

### Amicable resolution — DETERMINED

> shall first be attempted to be resolved amicably between the Parties

**Question.** Is the pre-arbitral step attempted between the two in dispute, or among all of them?

"between the Parties" is the collective, and a good-faith discussion among three is the same obligation as between two. Nothing turns on the count: no right is gained or lost by either reading, and the step is a precondition to referral rather than a source of substantive rights.

### Appointment of the sole arbitrator — DETERMINED

> a sole arbitrator jointly appointed by the Parties and, failing agreement … appointed in accordance with the Act

**Question.** Does "jointly appointed" require the agreement of all principals, or of the two in dispute?

All of them, and this is the CONSENT_OR_NOTICE_TO_OTHERS shape already recorded in invariant 60: reading it as 'any two' would let two parties in a firm of three impose an arbitrator on the third, which no ordinary construction supports and which Section 18 of the Arbitration and Conciliation Act, 1996 (equal treatment) does not permit. Crucially the clause specifies a SOLE arbitrator, so the classic multi-party appointment problem does not arise here: where each side nominates its own arbitrator, three parties cannot each have a nominee without unequal treatment. This clause never gives anyone a nominee. And the fallback is count-independent — on failure to agree, Section 11(5) sends the appointment to the arbitral institution designated under Section 11(3A), which works identically for two parties or four.

### Scope of the reference — **DECISION REQUIRED**

> it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996

**Question.** Where there are more than two parties, may one party refer a dispute against one other party alone, leaving the rest out — or must every party be joined to a single arbitration?

At two parties, 'refer the dispute to arbitration' and 'refer it against the other party' are the same act, and the clause could never have distinguished them. At three they diverge, and the difference is substantive: an award between Party 1 and Party 2 does not bind Party 3, who may then litigate the same facts and obtain an inconsistent result on the same instrument. NOTHING IN THE STATUTE FILLS THE GAP. The Arbitration and Conciliation Act, 1996 as amended through 2021 contains no provision for joinder of parties or consolidation of proceedings; the Supreme Court has permitted consolidation in PR Shah v B.H.H. Securities and the Delhi High Court in Gammon India v NHAI, but as a matter of judicial practice rather than entitlement, and ad hoc references have no institutional rules to fall back on. The draft Arbitration and Conciliation (Amendment) Bill, 2024 does not address it and is not law. So the instrument is the only place this could have been settled, and it does not settle it.

### Binding effect of the award — FOLLOWS THE SCOPE DECISION

> the award … shall be final and binding on the Parties

**Question.** Binding on all principals, or only on those who took part?

Not an independent question. A party who was not joined cannot be bound by an award made without them, whatever the clause recites — so this sentence means whatever the scope decision above makes it mean, and recording it separately would double-count one question.

## Does an existing shape represent this?

| shape | fits? | why |
|---|---|---|
| ALREADY_N_SAFE | no | the scope question is not distributive; it is a choice between two structures |
| UNIFORM_PROHIBITION | no | nothing here is a prohibition binding each party equally |
| RECIPROCAL_SEVERAL | no | arbitration is not an obligation owed party-to-party in parallel |
| CONSENT_OR_NOTICE_TO_OTHERS | partly | carries the APPOINTMENT sentence exactly, and carries nothing else in the clause |
| APPORTIONED_QUANTITY | no | no quantity is divided |
| PAIRWISE_RIGHT | **yes** | a right one party exercises with respect to another, where N>2 forces a choice between bilateral and multilateral effect — structurally the same question as terminating for one party's default |
| ROSTER_DRIVEN | no | the clause is written about the parties, not assembled from them; its text does not change with the roster |

### The conservative reading

PAIRWISE_RIGHT is recorded as "a right arising from one party's default. With three,
does the innocent party end the whole instrument, or only its relationship with the
defaulter?" The default framing is the INSTANCE it was drawn from, not the essence.
Stripped to its semantics the shape is: **a right exercised with respect to one other
party, where more than two parties force a choice between bilateral and multilateral
effect.** That is exactly the reference-scope question.

So NO NEW SHAPE. A new one would read more neatly and would be an abstraction built
because the architecture seemed to want one — the thing the method exists to refuse.

What IS new is the decision. Shapes are reusable; a decision is one question about one
clause, and `ARBITRATION_REFERENCE_SCOPE` is not `TERMINATION_FOR_DEFAULT_SCOPE`.

## One thing this clause breaks

This clause carries TWO N-party components with DIFFERENT verdicts: the appointment
sentence is CONSENT_OR_NOTICE_TO_OTHERS and determined; the reference scope is
PAIRWISE_RIGHT and undecided. The shape index maps one clause to one shape, so listing
it under both would silently overwrite — `shapeOf.set(id, s)`, last file entry wins,
no error.

That does not need a multi-shape mechanism. For CLASSIFICATION the demanding component
governs: a clause with any open decision is AUTHORED_DECISION_PENDING however many of
its sentences are settled. The settled component is recorded in the decision's own
`components` field, which is documentation and costs no engine mechanics.

The silent overwrite is a real latent defect and is now asserted against separately.
