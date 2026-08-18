# LegalAId — Document Form Audit

Why generated documents don't read like properly drafted Indian instruments.

Findings verified against the actual code path (`draftingPolicy.getDocumentDraftingPolicy`),
the 25 blueprints, and a real rendered output (`tmp/export-style/sample-consultancy.docx`).
Legal conventions noted here are for your advocate to confirm.

---

## Summary

There are **two separate problems**, and they need different fixes:

| | Status |
|---|---|
| **Deed anatomy** — title, testatum, parties, recitals, testimonium, execution | Mostly correct: 22/25 document types |
| **Body scaffolding** — definitions, interpretation, general provisions | **Badly uneven. This is the actual complaint.** |

The opening of your documents is well drafted. What's missing is the legal scaffolding
around the commercial clauses — which is exactly what makes a document read as
"a few paragraphs about the deal" rather than as an instrument.

---

## 1. What is already right

Credit where it's due — `documentHardening.js::renderHardClause` builds a genuinely
correct Indian deed opening for `CORE_IDENTITY_001` and `GUARANTEE_IDENTITY_001`:

- **Place and date of execution** — `"THIS AGREEMENT ("Agreement") is made and executed at Pune on this 31st day of July, 2026."` Correct ordinal-suffix formatting, and place of execution is captured (matters for stamp jurisdiction).
- **`BY AND BETWEEN` / `AND`** as separate centred blocks
- **"of the First Part" / "of the Second Part"**
- **The successors phrase, entity-aware** — companies/LLPs get *"which expression shall, unless repugnant to the context or meaning thereof, include its successors and permitted assigns"*; individuals get *"…his, her, or their legal heirs, representatives, executors, administrators, and permitted assigns"*
- **Collective definition** — *'hereinafter collectively referred to as the "Parties" and individually as a "Party"'*
- **Three recitals + a proper testatum** — `NOW, THEREFORE, in consideration of the mutual covenants and undertakings contained herein, and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged…` (consideration recited — matters under ICA s.25)
- **Execution block** with `IN WITNESS WHEREOF`, `FOR AND ON BEHALF OF`, authorised-signatory lines, and witness blocks

This is better than most generated-contract products. Don't rebuild it.

---

## 2. The real gap — general provisions

Effective coverage = blueprint `clauses` ∪ `drafting_policies.json` → `hardening.requiredClauseIds`.

```
DOCUMENT TYPE                     Defs Intp Notc Sevr Waiv Entr Amnd Asgn Cntp ForM Surv Reln Stmp Furt
COMMERCIAL_LEASE_AGREEMENT         ·    ·    Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
CONSULTANCY_AGREEMENT              Y    Y    Y    ·    ·    Y    Y    ·    ·    Y    ·    Y    ·    ·
CONTRACTOR_AGREEMENT               Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    Y    ·    ·
DISTRIBUTION_AGREEMENT             Y    Y    Y    Y    Y    ·    ·    Y    Y    Y    ·    ·    ·    ·
EMPLOYMENT_AGREEMENT               ·    ·    Y    ·    ·    Y    ·    Y    ·    ·    ·    ·    ·    ·
EMPLOYMENT_CONTRACT                ·    ·    Y    Y    ·    Y    ·    Y    ·    ·    ·    ·    ·    ·
GUARANTEE_AGREEMENT                Y    Y    Y    Y    Y    Y    ·    ·    Y    ·    ·    ·    ·    ·
INDEPENDENT_CONTRACTOR_AGREEMENT   Y    Y    Y    Y    ·    Y    Y    Y    ·    Y    ·    Y    ·    ·
IP_ASSIGNMENT_AGREEMENT            ·    ·    ·    ·    ·    ·    ·    Y    ·    ·    ·    ·    ·    ·
JOINT_VENTURE_AGREEMENT            Y    Y    Y    Y    Y    Y    Y    ·    Y    Y    ·    ·    ·    ·
LEAVE_AND_LICENSE_AGREEMENT        ·    ·    Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
LOAN_AGREEMENT                     Y    Y    Y    Y    Y    Y    Y    Y    Y    ·    ·    ·    ·    ·
MASTER_SERVICE_AGREEMENT           Y    Y    Y    ·    Y    Y    Y    Y    Y    Y    ·    Y    ·    ·
MOU                                Y    ·    Y    Y    ·    ·    Y    ·    ·    Y    ·    ·    ·    ·
NDA                                Y    Y    Y    ·    ·    ·    ·    ·    ·    Y    Y    ·    ·    ·
PARTNERSHIP_DEED                   Y    Y    Y    Y    ·    Y    Y    ·    ·    ·    ·    ·    ·    ·
PRIVACY_POLICY                     Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
RENTAL_AGREEMENT                   ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
SALES_OF_GOODS_AGREEMENT           Y    Y    Y    ·    ·    ·    ·    ·    ·    Y    ·    ·    ·    ·
SERVICE_AGREEMENT                  Y    Y    Y    ·    Y    Y    Y    Y    Y    Y    ·    ·    ·    ·
SHAREHOLDERS_AGREEMENT             Y    Y    Y    Y    Y    Y    Y    ·    Y    Y    ·    ·    ·    ·
SOFTWARE_DEVELOPMENT_AGREEMENT     Y    Y    Y    Y    Y    Y    Y    ·    Y    Y    ·    ·    ·    ·
SUPPLY_AGREEMENT                   Y    Y    Y    ·    ·    ·    ·    ·    ·    Y    ·    ·    ·    ·
TERMS_OF_SERVICE                   Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
VENDOR_AGREEMENT                   Y    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·
------------------------------------------------------------------------------------------------------
COVERAGE /25                      19   14   19   10    8   12   10    8    8   12    1    4    0    0
```

**Universal gaps:**

- **Stamp duty / costs clause — 0/25.** No document says who bears stamp duty and
  registration charges. This is standard in every Indian instrument and is the single
  most conspicuously "missing" clause to an Indian reader. It also connects to the
  stamp-duty findings in the compliance roadmap.
- **Further assurance — 0/25.**
- **Survival — 1/25.** Only the NDA. Confidentiality, indemnity and limitation-of-liability
  clauses elsewhere have nothing keeping them alive past termination.
- **Relationship of parties — 4/25.** Absent from most service/contractor documents,
  where the independent-contractor characterisation actually matters.

**Worst-affected document types:**

| Document type | General provisions missing (of 14) |
|---|---|
| `RENTAL_AGREEMENT` | **14 — all of them** |
| `COMMERCIAL_LEASE_AGREEMENT` | 13 |
| `LEAVE_AND_LICENSE_AGREEMENT` | 13 |
| `IP_ASSIGNMENT_AGREEMENT` | 13 |
| `VENDOR_AGREEMENT` | 13 |
| `CONTRACTOR_AGREEMENT` | 12 |
| `EMPLOYMENT_AGREEMENT` | 11 |

A rental agreement with no notices clause has no valid mechanism for serving a
termination notice. An IP assignment with no further-assurance clause cannot compel
the assignor to execute the forms that actually perfect the assignment.

### Why it's uneven

Clause coverage is decided by **two hand-maintained lists that nobody reconciles**:

1. `blueprints/*.blueprint.json` → `clauses`
2. `metadata/drafting_policies.json` → `documents.<TYPE>.hardening.requiredClauseIds`

Seven document types have no `hardening` entry at all (`RENTAL_AGREEMENT`,
`EMPLOYMENT_AGREEMENT`, `CONTRACTOR_AGREEMENT`, `IP_ASSIGNMENT_AGREEMENT`,
`VENDOR_AGREEMENT`, `TERMS_OF_SERVICE`, `PRIVACY_POLICY`) — which is exactly the
worst-affected list above. Nothing declares "every commercial instrument carries these
general provisions", so coverage is whatever someone remembered to type.

The clauses themselves already exist — `clause_library/core/` holds 37 files including
`severability.json`, `waiver.json`, `entire_agreement.json`, `counterparts.json`,
`amendment.json`, `assignment.json`, `survival.json`, `interpretation.json`. **They are
written and simply not referenced.**

---

## 3. Drafting-convention defects

Verified against the rendered sample and the clause sources.

### 3.1 `CORE_DEFINITIONS_001` is an anti-definition

```
"Capitalized terms used in this Agreement shall have the meanings assigned to them
 herein or as commonly understood in law."
```

This defines nothing, and "as commonly understood in law" actively undermines the
defined terms it purports to cover. `documentHardening::buildDefinitionsClauseText`
builds a real enumerated definitions clause — but only fires where a definitions clause
is already in the set (19/25), and only enumerates `Agreement` and `Effective Date` plus
any custom `nomenclature_terms`. Defined terms used throughout the documents —
`Services`, `Confidential Information`, `Territory`, `Business Day`, `Premises` — are
capitalised but never defined.

### 3.2 Recitals are not lettered, and repeat `WHEREAS`

Current output:

```
WHEREAS, the Parties intend to enter into a legally binding arrangement …
WHEREAS, the Parties desire to record the terms and conditions …
WHEREAS, the transaction contemplated herein is intended for a lawful object …
```

Indian convention letters the recitals and uses `AND WHEREAS` for subsequent ones:

```
A.  WHEREAS the Client is engaged in the business of …
B.  AND WHEREAS the Consultant represents that it possesses the requisite expertise …
C.  AND WHEREAS the Parties are desirous of recording the terms …
```

Separately, the recitals are **generic** — they recite that a contract is being made
rather than the factual background (what each party does, prior dealings, why they are
contracting). Recitals are the interpretive context a court reads first; boilerplate
recitals waste that.

### 3.3 No authority / representation line for corporate parties

`grep "represented by"` and `grep "board resolution"` in `documentHardening.js` both
return **0**. A company party should be introduced as:

> …having its registered office at ___, CIN ___, **represented by its authorised
> signatory Mr/Ms ___, duly authorised vide Board Resolution dated ___** (hereinafter
> referred to as the "Client", which expression shall…)

Without this the instrument does not on its face show that the signatory had authority —
which is precisely what gets challenged. `guarantee.blueprint.json` already flags "Board
resolution required if guarantor is a company" in its (inert) `mandatory_legal_checks`.

### 3.4 Schedules render before the execution block

From the rendered sample, in order: `SCHEDULES AND SPECIFICATIONS` → `SCHEDULE 1` →
`EXECUTION` → `IN WITNESS WHEREOF`. Schedules must **follow** the testimonium and
signatures, conventionally headed *"THE FIRST SCHEDULE ABOVE REFERRED TO"*. As rendered,
the parties appear to sign after the schedule, which inverts the instrument.

Also: no clause in the body cross-refers to the schedule ("…as more particularly
described in Schedule I hereto"), so the schedule is orphaned.

### 3.5 Banner headings are not deed convention

`TERMS AND CONDITIONS`, `SCHEDULES AND SPECIFICATIONS`, `EXECUTION` are rendered as
centred bold section banners. Indian deeds run continuous numbered clauses from the
testatum to the testimonium without interior banners. This is the single most visible
"not a real legal document" signal.

### 3.6 Smaller items

- No `In the presence of:` line preceding the witness blocks
- Signature blocks are asymmetric — party 1 gets `Authorised Signatory / Name / Designation / Date / Place`, party 2 gets `Signature / Name / Date / Place`
- Recitals and party descriptions are rendered **bold** (paragraphs 5, 9, 11, 13, 15 of the sample); only the defined labels should be emphasised
- No page-initialling space; parties conventionally initial each page
- `CONTRACTOR_AGREEMENT` has **no identity clause at all** in its blueprint — unlike TOS/Privacy where that is by design. This looks like an outright bug.

### 3.7 Structure is inferred by regex over prose

`exportService.js::renderIdentityClause` reconstructs the deed layout by testing each
line: `/^BY AND BETWEEN$/i`, `/^WHEREAS[,:\s]/i`, `/^NOW, THEREFORE/`. The anatomy is not
modelled — it is pattern-matched out of a string that a different module happened to
build. If `documentHardening` does not fire for a document type, export silently emits
one justified paragraph with no visual structure and no error.

---

## 4. Fix plan

Ordered by visible improvement per unit of work.

**A. Declare a general-provisions baseline (largest win, ~2 days engineering + advocate review)**

Add to `drafting_policies.json` a family-level `hardening.requiredClauseIds` so every
instrument inherits a floor, instead of relying on 25 hand-written lists. Proposed
baseline for all bilateral commercial instruments — for your advocate to approve:

```
CORE_DEFINITIONS_001      CORE_INTERPRETATION_001   CORE_NOTICE_001
CORE_SEVERABILITY_001     CORE_WAIVER_001           CORE_ENTIRE_AGREEMENT_001
CORE_AMENDMENT_001        CORE_ASSIGNMENT_001       CORE_COUNTERPARTS_001
CORE_FORCE_MAJEURE_001    CORE_SURVIVAL_001         CORE_RELATIONSHIP_OF_PARTIES_001
```

Because `mergePolicy` already merges `defaults` → `families` → `documents`, a family
entry needs no code change. Per-document `documents.<TYPE>` entries continue to add
instrument-specific clauses on top.

**B. Author the two missing core clauses (~1 day + advocate drafting)**

- `CORE_STAMP_AND_COSTS_001` — who bears stamp duty, registration charges and
  incidental costs. Missing from all 25.
- `CORE_FURTHER_ASSURANCE_001` — missing from all 25; essential for IP assignment,
  share transfer, and property instruments.

**C. Enforce the baseline as a rule, not a list (~1 day)**

Add a constraint rule per family asserting the general-provisions floor is present, so
a new document type cannot ship without it. This is the `assert`/`clause_present`
predicate from the compliance roadmap — a good first real use of it.

**D. Fix the rendered form (~2–3 days)**

1. Letter the recitals `A. / B. / C.` and use `AND WHEREAS` from the second onward
2. Move schedules after the execution block; head them `THE FIRST SCHEDULE ABOVE REFERRED TO`
3. Drop the `TERMS AND CONDITIONS` / `EXECUTION` banner headings
4. Un-bold recitals and party descriptions
5. Add `In the presence of:` before witnesses; make both signature blocks symmetric
6. Add page-initialling space in the footer

**E. Add the authority line for corporate parties (~1 day + intake change)**

Collect signatory name, designation and board-resolution date for company/LLP parties;
render into `buildFormalPartyIntroduction`. Also surface CIN/PAN in the descriptor.

**F. Make definitions real (~2 days)**

Extend `buildDefinitionsClauseText` to enumerate every capitalised term the assembled
document actually uses, sourcing meanings from the clause library rather than leaving
them to be "commonly understood in law".

**G. Model the anatomy instead of regex-matching it (larger)**

Give the draft an explicit structure — `{ title, testatum, parties[], recitals[],
operative[], testimonium, execution, schedules[] }` — and let export render from that.
Removes the silent-failure mode in 3.7 and is the same structured-model move recommended
in the compliance roadmap.

---

## 5. Suggested first step

**A + B + C together.** They are mostly data, they are reviewable by your advocate
without reading code, and they close the gap that most makes documents look incomplete —
a rental agreement going from 0/14 general provisions to 12/14.

**D** is what makes them *look* like Indian instruments, and is pure presentation work
with no legal risk.
