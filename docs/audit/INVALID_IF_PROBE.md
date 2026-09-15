# Phase D3.4 — what kind of thing is an `invalid_if`?

482 entries across 250 clauses.

## What it already does

`documentIntelligence` surfaces every entry verbatim as `watch_for`, so a reader of the
report already sees them. It is descriptive metadata that reaches a human. What it does
not do is evaluate them, and the question is whether it could without the engine
deciding a question of law.

## By what would have to be true to decide the entry

| kind | decided by | count |
|---|---|---|
| ABOUT THE TEXT | reading the clause that carries it | 52 |
| ABOUT THE WORLD | evidence about a person, a body, or an event | 59 |
| A QUESTION OF LAW | a lawyer, on the facts of a dispute | 31 |
| AMBIGUOUS | matched more than one test — the classifier does not know | 10 |
| UNCLASSIFIED | matched none | 330 |

**340 of 482 are not classified**, and that is reported rather than
resolved. A keyword classifier over legal prose is the same instrument that has produced
six inflated findings in this work; forcing the residue into buckets would produce a
seventh.

### ABOUT THE TEXT — first 6

- `CORP_ANTI_DILUTION_001`: Adjustment formula is not clearly specified
- `CORP_BOARD_COMPOSITION_001`: Board nomination rights are not specified
- `CORP_DEADLOCK_001`: No escalation timeline is specified
- `CORP_DRAG_ALONG_001`: Notice period is not specified
- `CORP_SHARE_SUBSCRIPTION_001`: Subscription price is not specified
- `CORP_SHARE_TRANSFER_001`: Right of first refusal period is not specified

### ABOUT THE WORLD — first 6

- `SERVICE_CHANGE_REQUEST_001`: Changes can be made unilaterally by one party without the consent of the other.
- `IP_FEEDBACK_001`: The feedback constitutes pre-existing Intellectual Property of the Party providing it.
- `IP_FEEDBACK_001`: The feedback is unrelated to the other Party's Intellectual Property.
- `IP_INFRINGEMENT_001`: The intellectual property rights claimed are not validly owned or licensed by the claiming party.
- `IP_INFRINGEMENT_001`: The alleged infringing party has a valid license or authorization for the use of the intellectual property.
- `IPA_ASSIGNOR_WARRANTIES_001`: Warranty (e) is given where no written assignment from the contributor exists, since copyright in a contractor's work does not vest in the commissioning party by default

### A QUESTION OF LAW — first 6

- `DIST_APPOINTMENT_EXCLUSIVE_001`: Post-term restraint on the distributor (void under ICA s.27)
- `NDA_DURATION_001`: The stipulated duration is deemed an unreasonable restraint of trade under Section 27 of the Indian Contract Act, 1872.
- `SERVICE_EXPENSES_001`: The clause is vague or ambiguous, making it unenforceable.
- `SUPPLY_INSPECTION_001`: Imposition of an unreasonably short period for inspection
- `IPA_COPYRIGHT_ASSIGNMENT_001`: The assignment is not in writing signed by the assignor, in which case it is invalid under Section 19(1)
- `IP_LICENSE_001`: If the Licensed IP is found to be invalid, unenforceable, or non-existent.

### AMBIGUOUS — first 6

- `SERVICE_EXCLUSIVITY_001`: The restraint is drafted to continue after the term of this Agreement, in which case it is void under section 27 of the Indian Contract Act, 1872, no matter how narrow it is.
- `SUPPLY_PRICE_REVISION_001`: The clause permits one Party to revise the price at its sole discretion without any ascertainable standard, which risks the price term being void for uncertainty.
- `POSH_SCOPE_DEFINITIONS_001`: The policy narrows the definition of employee, workplace, or sexual harassment below the statutory definition
- `POA_POWERS_GRANTED_001`: The powers granted are not stated with sufficient certainty for a third party to know their limits
- `CORE_REPRESENTATIONS_001`: A representation is given by a party that is not in fact incorporated or registered as described
- `EMP_DUTIES_001`: Duties so broadly defined as to constitute unreasonable restriction on Employee's personal time

### UNCLASSIFIED — first 6

- `SERVICE_ACCEPTANCE_001`: Material breach of service specifications by the Service Provider
- `SERVICE_ACCEPTANCE_001`: Fraud or misrepresentation by the Service Provider
- `SERVICE_ACCEPTANCE_001`: Client was prevented from reasonably inspecting the services
- `IP_ASSIGNMENT_001`: The Intellectual Property sought to be assigned is not assignable under applicable law.
- `IP_ASSIGNMENT_001`: The Assignor does not possess the full right, title, and interest in the Intellectual Property to be assigned.
- `IP_ASSIGNMENT_001`: The term 'Intellectual Property' is not adequately defined within the contract.


---

## Why 330 are unclassified: the population has no form

**379 distinct opening two-word phrases across 482 entries.** The classifier is
not the problem — the corpus is free prose, written one entry at a time by
whoever authored each clause.

And it carries at least three different KINDS of content under one name:

| a sample entry | what it actually is |
|---|---|
| "The clause permits one Party to revise the price at its sole discretion without any ascertainable standard, which risks the price term being void for uncertainty." | an invalidity condition — what the field's name promises |
| "Material breach of service specifications by the Service Provider" | a breach scenario. An event, not a property of the document |
| "Basic salary below 50% of gross salary attracting higher PF liability risk" | a tax-exposure note. Not about validity at all |

So `invalid_if` is not one thing being under-used. It is a field whose name
promises invalidity conditions and which in practice holds invalidity conditions,
breach scenarios and risk notes together.

## The answer to D3.4

**Executable legal-validity assessment stays outside the engine.**

Making `invalid_if` executable is not a wiring task. It would mean re-authoring
482 free-prose entries into structured predicates, and each re-authoring is a
legal judgement about what would make a clause invalid — in a field that is not
consistently about invalidity in the first place. Two Terms of Service defects
exposed a boundary; they are not a reason to turn 482 pieces of prose into
executable law.

The field's present role is real and was understated earlier in this work: every
entry is surfaced verbatim to the reader as `watch_for` in the intelligence
report. It is descriptive metadata that reaches a human, which is the correct
destination for a condition only a human can decide.

## What this does NOT close

The two Terms of Service defects remain uncaught by anything:

- the instrument asserting its own enforceability;
- the instrument warranting the counterparty's free consent and competence.

They would be **new** `invalid_if` entries, and they are of the tractable kind —
conditions about the document's own text. The distinction that makes them
tractable is worth stating precisely:

> **Detecting an assertion is not adjudicating it.**

An engine can determine that a clause asserts its own enforceability. It cannot
determine whether that assertion is wrong — that turns on section 10A, the
Contract Act essentials, and the facts of a dispute. A finding of the first kind
is useful and honest; a finding of the second kind is the system authoring law it
cannot verify.

Whether to build a narrow check of that first kind — for these two clauses, not
for 482 — is a decision this probe deliberately leaves open. It is a small, real
option, and it is a different proposition from making the field executable.
