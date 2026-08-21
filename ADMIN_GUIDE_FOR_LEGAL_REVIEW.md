# LegalAId — Admin Guide for Legal Review

*Written for the reviewing advocate. No engineering knowledge assumed.*

---

## 1. What you are being asked to do, and why

LegalAId generates 22 types of Indian commercial document. It does not write them
from scratch each time — it assembles them from a **library of 191 clauses**,
selecting and adapting clauses based on what the user typed into the form.

Those 191 clauses are the product. Every document a user receives is built out of
them.

**None of them has been reviewed by a lawyer.** They were drafted by engineers and
by AI, against Indian statutory references, but nobody qualified has signed off on
the wording. The admin system exists so you can work through them and record what
you have approved.

Until you do, the system tells users honestly that coverage is incomplete. It does
not claim documents are lawyer-approved when they are not.

---

## 2. Getting in

Sign in with an administrator account and go to:

```
/admin/clauses
```

Everything below lives on that one page. The page has three panels, top to bottom.

---

## 3. The three panels, in order of importance to you

### Panel 1 — **Clause library review**  ← this is your job

The 191 clauses that are already going out in real documents. This is where you
spend your time.

### Panel 2 — **AI gap analysis**

You pick a document type, the AI reads it and suggests protections it thinks are
missing. Nothing it says takes effect. It is a prompt for discussion, not a
change. Ignore it until Panel 1 is well underway.

### Panel 3 — **Review queue (mined candidates)**

46 clause variants scraped out of old templates back in June. These have **never
been used in any document**. They are candidates waiting to be either brought into
the library or discarded. Lower priority than Panel 1, because nothing here is
currently reaching a user.

**The distinction that matters:** Panel 1 is *what is going out today*. Panel 3 is
*what might go out one day*. Fix what is shipping first.

---

## 4. Panel 1 in detail

### What each row shows you before you open it

| Badge | Meaning |
|---|---|
| `22 docs` | **Reach** — how many of the 22 document types use this clause. A clause with reach 25 appears in nearly everything. |
| `HIGH` / `MEDIUM` / `LOW` | The risk level recorded against the clause. |
| `mandatory` | The document blueprint requires this clause; it cannot be omitted. |
| `unmarked` / `signed <name>` | Whether it has been reviewed yet. |

### When you open a row

- **Appears in** — the exact document types affected by your decision
- **Statutory basis** — the Acts and sections the clause was drafted against
- **The clause text** — exactly as it renders in a real document
- **Revised text** box — for amendments
- **Note** box — optional, for anything the engineers need to act on

### The four decisions

| Button | What it means | What it does |
|---|---|---|
| **Approve** | The wording is sound as it stands | Marks reviewed, records your name and today's date |
| **Approve with amendment** | Sound *after* your changes | **Replaces the live clause text with yours**, then marks reviewed |
| **Reject** | This is wrong and needs rewriting | Records the outcome and your note. **Does not** mark it reviewed — it stays outstanding |
| **Needs discussion** | You want to talk it through first | Same as Reject: recorded, still outstanding |

**Approve with amendment edits the live product immediately.** The text you paste
is what the next user's contract will say. There is no staging step. If you want
to think about it, use *Needs discussion* instead.

There is also **Withdraw sign-off** on an already-approved clause, if you change
your mind later.

### Formatting amendments

Write sub-clauses on separate lines. The system numbers them automatically as
5.1, 5.2, 5.2.1 — do not number them yourself. Indent a line by two spaces to make
it a sub-sub-clause.

---

## 5. Where to start

The list is **not alphabetical**. It is ordered by how much of the product each
clause touches, so that a partial review still covers most of what users receive.

Actual figures for the current library:

```
first  10 clauses  →  38% of all clause usage
first  20 clauses  →  51%
first  50 clauses  →  66%
first 100 clauses  →  77%
```

**Stopping after 20 is a legitimate first pass.** Half of everything the product
emits would then be lawyer-approved, and the system would say so accurately.

The first eight rows are the ones in nearly every document:

1. `CORE_IDENTITY_001` — Parties and Recitals *(22 docs, mandatory)*
2. `CORE_SIGNATURE_BLOCK_001` — Execution and Signatures *(23 docs, mandatory)*
3. `CORE_ENTIRE_AGREEMENT_001` — Entire Agreement *(25 docs)*
4. `CORE_GOVERNING_LAW_001` — Governing Law *(25 docs)*
5. `CORE_DATA_PROCESSING_001` — Data Processing *(19 docs, mandatory)*
6. `CORE_DISPUTE_RESOLUTION_001` — Dispute Resolution *(24 docs)*
7. `CORE_PURPOSE_001` — Purpose *(18 docs, mandatory)*
8. `CORE_TERM_001` — Term *(16 docs, mandatory)*

Separately, **28 clauses are marked HIGH risk** — IP ownership, property
registration, guarantee obligations, board composition, share transfer, employee
confidentiality, disciplinary action. Use the search box to find them if you would
rather work by risk than by reach.

**17 clauses appear in no document at all.** They need a keep-or-delete decision,
not a legal review. Leave them till last.

---

## 6. How progress is measured

The bar at the top shows **percentage of clause usage reviewed**, not percentage
of files ticked.

Approving `CORE_GOVERNING_LAW_001` (25 documents) moves the bar far more than
approving something used once. Two well-chosen clauses can register 7%. This is
deliberate: it measures how much of what users actually receive has been seen by a
lawyer.

---

## 7. What "reviewed" means in the system

A clause counts as reviewed only when **both** are true:

1. It carries a real reviewer name
2. Its status is no longer "draft-needs-legal-review"

Your name is captured automatically from your signed-in account — you do not type
it. It is written onto the clause file along with the date.

This is why *Reject* deliberately does not mark a clause reviewed. "I looked at
this and it is wrong" must never read in the record as "a lawyer approved this."

Once every clause is signed off, the engineers can switch on a setting
(`LEGALAID_REQUIRE_REVIEWED_CLAUSES=1`) that makes the system **refuse to load an
unreviewed clause at all**. Until then it loads everything and reports the gap.

---

## 8. What this system does not do

Worth being clear, so nobody over-relies on it:

- It does **not** version your amendments. Editing a clause overwrites the
  previous text. History lives in the code repository, not in this UI.
- It does **not** re-run the document tests after an amendment. If your revised
  wording removes something the validation engine expects, that surfaces on the
  next generation, not at the moment you save.
- It does **not** check your amendment against the statutory references. The
  citations shown are what the clause was originally drafted against.
- **455 statutory citations across the library carry no version pin**, so if a
  cited section is amended, nothing currently detects it. That is a separate piece
  of work.

---

## 9. Open questions that need your ruling

These came up while building and are genuinely legal calls, not engineering ones.
They are not in the review panel — they need a decision from you directly.

**1. Maharashtra leave-and-licence registration.**
Does section 55 of the Maharashtra Rent Control Act, 1999 make a tenancy or
leave-and-licence agreement compulsorily registrable in Maharashtra *regardless of
term*? The system currently applies only the general 12-month threshold, so an
11-month Maharashtra rental is told registration is not compulsory. If s.55
applies, that is wrong today.

**2. The 12-month threshold itself.**
Section 17(1)(d) of the Registration Act, 1908 speaks of a term "exceeding one
year". The system currently treats a lease of *exactly* 12 months as registrable.
Arguably it is outside the section. Which way?

**3. Late-payment interest on salary.**
A rule applies 18% per annum interest to late payments. It is currently reaching
**employment contracts**, meaning late-paid salary. Should it?

**4. Deal-size bands.**
The system now scales protections by contract value and term:
small (< ₹10 lakh) / mid (< ₹1 crore) / large (< ₹10 crore) / major (above).
Termination notice defaults to 30 / 30 / 60 / 90 days on that scale. Are those the
right cut-offs?

**5. The insurance clause.**
`CORE_INSURANCE_001` is newly written and appears once a deal reaches "elevated"
exposure. There was previously no insurance covenant anywhere in the library at
any deal size. It needs reviewing like any other clause — and a decision on
whether minimum sums insured should be stated per document type.

---

## 10. The short version

1. Go to `/admin/clauses`
2. Work down Panel 1 from the top — it is already in priority order
3. Approve / Amend / Reject / Discuss on each
4. Twenty clauses gets you past half the product
5. Ignore Panels 2 and 3 for now
6. Come back to Section 9 above with rulings on the five open questions
