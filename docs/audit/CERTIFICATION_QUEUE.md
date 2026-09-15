# Phase D.1 — the certification queue

Falsification-passed anchors (10): EMPLOYMENT_CONTRACT, LOAN_AGREEMENT, MASTER_SERVICE_AGREEMENT, MOU, NDA, POSH_POLICY, POWER_OF_ATTORNEY, RENTAL_AGREEMENT, SHAREHOLDERS_AGREEMENT, TERMS_OF_SERVICE

Also authored, and therefore also already teaching the system: CHEQUE_BOUNCE_NOTICE

Ranked by STRUCTURAL DISTANCE from those eight. A high score means the existing
corpus is least able to break this family, so certifying it is most likely to
expose a failure mode we have not already seen. It is not a defect score.

| rank | family | score | clauses | acts | why it is unlike the anchors |
|---|---|---|---|---|---|
| 1 | PRIVACY_POLICY | 4 | 13 | 16 | 1 statute(s) no anchor touches; content prescribed by statute rather than negotiated |
| 2 | PARTNERSHIP_DEED | 4 | 15 | 15 | signature model "PARTNERSHIP" unseen; 1 statute(s) no anchor touches |
| 3 | AFFIDAVIT | 4 | 5 | 7 | signature model "AFFIDAVIT" unseen; 1 statute(s) no anchor touches |
| 4 | GUARANTEE_AGREEMENT | 3 | 14 | 12 | signature model "GUARANTEE" unseen |
| 5 | ARBITRATION_NOTICE | 3 | 10 | 9 | signature model "NOTICE" unseen |
| 6 | SHIPPING_AND_DELIVERY_POLICY | 3 | 7 | 7 | content prescribed by statute rather than negotiated |
| 7 | REFUND_AND_CANCELLATION_POLICY | 3 | 7 | 6 | content prescribed by statute rather than negotiated |
| 8 | INDEMNITY_BOND | 3 | 5 | 5 | signature model "BOND" unseen |
| 9 | JOINT_VENTURE_AGREEMENT | 1 | 28 | 25 | 2 statute(s) no anchor touches |
| 10 | SUPPLY_AGREEMENT | 1 | 22 | 25 | 2 statute(s) no anchor touches |
| 11 | DISTRIBUTION_AGREEMENT | 1 | 27 | 25 | 2 statute(s) no anchor touches |
| 12 | VENDOR_AGREEMENT | 1 | 24 | 23 | 2 statute(s) no anchor touches |
| 13 | IP_ASSIGNMENT_AGREEMENT | 1 | 16 | 18 | 1 statute(s) no anchor touches |
| 14 | SALES_OF_GOODS_AGREEMENT | 1 | 18 | 18 | 2 statute(s) no anchor touches |
| 15 | SHARE_SUBSCRIPTION_AGREEMENT | 1 | 17 | 16 | 1 statute(s) no anchor touches |
| 16 | INTERNSHIP_AGREEMENT | 1 | 13 | 16 | 1 statute(s) no anchor touches |
| 17 | DATA_PROCESSING_AGREEMENT | 1 | 18 | 13 | 1 statute(s) no anchor touches |
| 18 | SOFTWARE_DEVELOPMENT_AGREEMENT | 0 | 33 | 26 | — |
| 19 | INDEPENDENT_CONTRACTOR_AGREEMENT | 0 | 26 | 25 | — |
| 20 | CONSULTANCY_AGREEMENT | 0 | 32 | 24 | — |
| 21 | APPOINTMENT_LETTER | 0 | 19 | 22 | — |
| 22 | SERVICE_AGREEMENT | 0 | 27 | 21 | — |
| 23 | COMMERCIAL_LEASE_AGREEMENT | 0 | 22 | 19 | — |
| 24 | FOUNDERS_AGREEMENT | 0 | 19 | 18 | — |
| 25 | LEAVE_AND_LICENSE_AGREEMENT | 0 | 14 | 16 | — |
| 26 | TERM_SHEET | 0 | 13 | 13 | — |
| 27 | SEPARATION_AGREEMENT | 0 | 10 | 13 | — |
| 28 | ESOP_GRANT_LETTER | 0 | 8 | 9 | — |
| 29 | PROMISSORY_NOTE | 0 | 8 | 9 | — |
| 30 | SETTLEMENT_AGREEMENT | 0 | 11 | 9 | — |

---

# Re-ranked after POSH and Terms of Service (D3.7)

## A correction to how this ranks

The first version measured distance from the FALSIFICATION_PASSED families only,
and put **ARBITRATION_NOTICE top at 7** on "document shape NOTICE unseen".

`CHEQUE_BOUNCE_NOTICE` is a NOTICE. It carries eight authored requirements
including three TIMING, and the **entire timing model** — UNVERIFIABLE,
OUT_OF_TIME, calendar-month arithmetic, the legal trigger versus the proxy field
— was built for it. It is simply not certified, having been withheld
deliberately.

A family teaches less if the system has already authored its shape, whatever rung
it sits on. Measuring against certification status rather than against authored
knowledge inflated a score by precisely the thing the ranking exists to find.
**ARBITRATION_NOTICE: 7 → 3.**

Seventh measurement correction in this work, same shape as the other six: the
population measured against was the wrong one. The anchors are also now read from
the certification report rather than listed in the script, because a hardcoded
list goes stale the moment a family advances.

The POLICY shape has likewise dropped out as a novelty dimension — POSH_POLICY
and TERMS_OF_SERVICE now cover it, which is the queue correctly reflecting what
the corpus learned.

## The selection: PARTNERSHIP_DEED

A three-way tie at 4 with PRIVACY_POLICY and AFFIDAVIT. The score does not
decide; three concrete pressures, visible in the intake before any authoring,
do.

**1. The deferred composition question reopens — with data this time.**

D2.3 refused a collection primitive for the POSH Internal Committee on a stated
condition: *"If the product later decides to collect the Committee's membership,
the pressure becomes real."* A partnership deed collects
`capital_contribution_1` and `capital_contribution_2` as **required numbers**,
and `profit_sharing_ratio` as **required text**. Contributions and shares are
exactly the aggregate-predicate shape — do the shares sum to the whole, does a
partner's share match their contribution — and unlike the Committee, the numbers
are there.

This is the reopening condition, met on its own terms rather than by argument.

**2. A free-text field carrying what is arguably a position.**

`profit_sharing_ratio` is free text and required. "50:50", "equally", "60% to
Partner 1", "as mutually agreed" are all valid entries, none machine-readable,
and the deed will state whatever is typed. That is the `security_collateral`
shape — the field whose free text once made "None — this is an unsecured loan"
into a secured loan — in a provision that decides who takes what.

**3. The intake represents two partners. The Act permits up to fifty.**

`partner_1_*` and `partner_2_*`, and nothing else. A firm of three cannot be
described. Section 464 of the Companies Act, 2013 read with Rule 10 caps a
partnership at fifty; the Indian Partnership Act, 1932 sets no lower bar than
two. A three-partner firm is an ordinary thing the product cannot represent —
the unsecured-loan state-space defect, in a family where the state is not a
yes/no but a count.

**And a fourth, structural, which is why this is not merely another agreement:**
section 18 of the Indian Partnership Act, 1932 makes every partner an agent of
the firm. Obligations run between N parties with mutual agency, not between two
sides of a bargain. Nothing in the eleven authored families has that shape.
Section 69 adds a consequence the RENTAL anchor's registration requirement does
not reach: an unregistered firm **cannot sue** to enforce a contractual right.
Registration there affects admissibility of the instrument; here it bars the
forum.

## Why not the other two at 4

**PRIVACY_POLICY** — the POLICY shape is now covered twice over. Its novelty is
one statute, and whatever POSH and Terms of Service established about
statutory-content families should transfer. Cheap, and therefore not where the
learning is.

**AFFIDAVIT** — genuinely novel in shape (SWORN), and the failure mode it would
expose is a document asserting facts on a deponent's oath. But assertion without
establishment is the mode POSH and Terms of Service have now covered from two
directions. Worth doing; unlikely to teach a third thing.
