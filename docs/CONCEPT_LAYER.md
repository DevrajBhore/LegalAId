# The Concept Layer

**Status: FROZEN as the architectural specification, 2 September 2026.**
Further work on this is engineering, not ontology. Expanding the conceptual model
rather than implementing it is out of scope; changes from here need a reason
found in implementation.

**Audience:** the advocate who will author and sign concepts, and the engineer who
will wire them.
**Written against:** 297 clauses, 40 constraint rules, 46 blueprints, 40 document
types, 57 derived flags, as measured on 2 September 2026.
**Ships with:** `knowledge-base/concepts/` (10 records, unsigned),
`concept.schema.json`, `tests/conceptRecords.test.mjs`.

---

## 1. What this fixes

LegalAId selects clauses by document *type*. It does not select them by what the
deal is actually about. A distribution agreement for ballpoint pens and a
distribution agreement for industrial solvents receive the same 34 clauses in
the same order, differing only in the words substituted into them.

That is not a gap in the clause library. It is a gap in what the engine is
allowed to know. The library already carries the legal knowledge — 297 clauses
with `legal_basis`, `invalid_if`, `depends_on`, `dispute_hotspots` — but nothing
in the pipeline can say *this deal involves a hazardous chemical, so a different
set of obligations attaches.*

The concept layer is the missing vocabulary between the facts a user supplies
and the clauses the engine selects.

---

## 2. Three corrections to the earlier design discussion

These come from measuring the codebase rather than reasoning about it. Each one
changes what should be built.

### 2.1 `invalid_if` is a validation vocabulary, not an applicability one

The plan said: *make `invalid_if` executable and the clause graph will start
running backwards.* That was wrong, and it was wrong in a way that would have
wasted the first sprint.

232 clauses carry a non-empty `invalid_if`, 423 unique conditions in total. They
were classified by hand. Essentially **two** describe a state of the world:

> "The service involves continuous effort without distinct, identifiable deliverables."
> "The alleged infringing party has a valid license or authorization for the use of the intellectual property."

Every other one describes a **defect in the clause's own drafting** or in the
agreement's content:

> "Seat of arbitration not specified."
> "Confidential Information is not defined."
> "Liability is excluded for fraud or wilful misconduct."
> "The deed is executed before being stamped."
> "No Grievance Officer is designated."

These are not "this clause does not apply here." They are "this clause, as
drafted, is bad law." Making them executable produces **findings**, not
suppressions.

That is good news for sequencing, because it splits one risky change into two
with very different risk profiles:

| Work | Effect | Regression risk |
|---|---|---|
| Make `invalid_if` executable | Adds validation findings | Near zero — purely additive |
| Add `applies_when` | Changes which clauses appear | High — every type can change shape |

They are independent. Do the first whenever; the second needs the baseline in §7.

### 2.2 The predicate language already exists, and it is good

`IRE/src/indian-rule-engine/constraintEngine.js` is a closed, reviewable
predicate evaluator, with a comment that states the design rationale better than
this document could:

> the predicate vocabulary below is deliberately CLOSED: a general expression
> language would stop being reviewable, which is the whole point of keeping
> rules out of code.

It already supports everything the concept layer needs:

```
{ "doc_type_in":     ["RENTAL_AGREEMENT", ...] }
{ "clause_present":  ["ID", ...] }
{ "clause_absent":   ["ID", ...] }
{ "category_present":["IDENTITY"] }
{ "state_in":        ["Maharashtra", ...] }
{ "var": "field" | ["field","alt"], "op": "...", "value": X }
{ "not":    <predicate> }
{ "any_of": [<predicate>, ...] }

ops: present absent eq neq contains not_contains in not_in matches
     gt gte lt lte months_gte months_lt
```

`var` accepts an **array** and falls through to the first field that has a
meaningful value — the alias-chain behaviour the concept layer needs for free.

**So `applies_when` must not invent a grammar. It reuses this one.** The only
code change required is exporting `evaluatePredicate`, which is currently
module-private.

### 2.3 There are already three grammars. Do not add a fourth.

| Where | Grammar | Power | Count |
|---|---|---|---|
| `constraints/*.json` → `when` / `assert` | predicate objects | full closed vocabulary | 40 rules, only **5** use `when` |
| `blueprints/*.json` → `include_if` | string `"flag == value"` | single var, equality only | 122 conditionals |
| `generationControls.js` → `deriveGenerationControls` | imperative JavaScript | unlimited, unreviewable | **57 derived flags** |

`clauseAssembler.js:186` already reads `candidate.when ?? candidate.include_if`,
so the key name `when` is taken on blueprint entries but is parsed by the *weak*
string parser. Naming the new clause field `when` would silently inherit the
wrong evaluator. **Use `applies_when`.**

The third row is the important one. `deriveGenerationControls` is 512 lines that
turn facts into flags: `involves_personal_data`, `is_senior_employee`,
`employer_headcount_ge_10`, `is_registrable`, `include_competition_compliance`.

**The Concept Resolver already exists.** It is just written as code, so no
advocate can read it, review it, or sign it, and nothing it concludes carries a
statutory citation or a confidence. The work is not to build a resolver. It is
to *move* one from JavaScript into reviewable data, and give its outputs
provenance.

---

## 3. The object model

### 3.1 Two kinds of thing, not one

The single most dangerous failure mode for this design is that every noun becomes
a "concept". `PERSON`, `SALE`, `RIGHT`, `OBLIGATION`, `TIME` and `MSME_SUPPLIER`
are then the same kind of object, the vocabulary grows without bound, and the
scalability problem this layer exists to solve is recreated one level up.

So the data model draws a hard line:

**Semantic dimensions** describe the world. They are *typed*, they come from
intake and extraction, they are open-ended, and **no advocate signs them**.

**Legal concepts** are characterisations that attract legal treatment. They are
*enumerated*, few, and **every one is signed by an advocate**.

The two are stored differently, validated differently, and grow at different
rates. A dimension is data about the deal. A concept is a legal opinion about
the deal.

```
─── SEMANTIC DIMENSIONS ──────────────── typed, open, unsigned ───────────────

  ENTITY     the legal persons and things   Rahul · ABC Pvt Ltd · Property X
  ROLE       how an entity participates     principal · agent · seller · buyer
  EVENT      what is being done             transfer · lease · employ ·
                                            process_data
  FACT       measured or stated values      owns 20% · located in Pune ·
                                            payment = INR 10,00,000

─── RESOLUTION ───────────────────────────────────────────────────────────────

           the Concept Resolver — the only layer an advocate authors

─── LEGAL CONCEPTS ───────────────────── enumerated, few, signed ─────────────

  CONCEPT    the legal characterisation     SHARE_TRANSFER ·
                                            AUTHORITY_DELEGATION ·
                                            EMPLOYMENT_RELATIONSHIP ·
                                            PERSONAL_DATA_PROCESSING ·
                                            MSME_SUPPLIER

─── RULES ────────────────────────────────────────────────────────────────────

  RULE       applies_when on a clause · when on a constraint

─── CONSEQUENCES ─────────────────────────────────────────────────────────────

  CONSEQUENCE  clause required · clause suppressed · disclosure required ·
               question required · review required
```

Consequence is not a peer object either. It is what the rule vocabulary
*returns*. This matters for staffing rather than elegance: dimensions come from
intake, consequences come from clauses, and the advocate's entire job is the
resolution arrow in the middle.

### 3.2 The test for which kind something is

> **Does an advocate have to sign it?**

`seller` is a role. Nobody signs "this party is the seller" — it is how the
intake was filled in. `MSME_SUPPLIER` is a concept: asserting it means asserting
that a statutory payment regime attaches, and someone must be accountable for
that.

Two further tests, both of which a candidate must pass to be a concept:

1. **Does it attach a treatment?** If nothing in the document changes when it is
   present, it is a dimension, not a concept.
2. **Is the treatment distinct?** If it attaches the same clauses and rules as an
   existing concept, it *is* that concept. Extend the existing record rather than
   adding a near-duplicate.

`SALE` fails test 1 as stated — it is an EVENT. `GST_TAXABLE_SUPPLY` passes,
because it changes the invoice clause.

### 3.3 Dimension vocabularies

Each dimension has its own vocabulary file with its own growth rules. None of
them requires legal sign-off, which is precisely why they may be open.

| Dimension | Vocabulary | Growth | Where it comes from today |
|---|---|---|---|
| `ENTITY` | open | free | `party_N_name`, `party_N_type` intake fields |
| `ROLE` | closed, small | engineering change | `getPartyNamingLabels`, blueprint party labels |
| `EVENT` | closed, moderate | engineering change | implied by `document_type`; not yet explicit |
| `FACT` | open | free | the 244-field intake catalogue |

`EVENT` is the one that does not exist yet in any form. Today it is implied by
the document type, which is exactly the coupling this layer is trying to break —
a distribution agreement can involve transport, storage, sale and licensing all
at once, and each attracts different concepts.

### 3.4 Thing is not Concept, and the mapping depends on the event

`Polypropylene granules` is a FACT. `HAZARDOUS_MATERIAL` is a CONCEPT. The
mapping between them is not a lookup table, because the same thing attracts
different concepts depending on what is being done with it and by whom:

| Fact | Event | Role | Concept | Why |
|---|---|---|---|---|
| polypropylene granules | transport | carrier | *(none)* | not a listed hazardous substance |
| polypropylene granules | packaging supply | brand owner | `EPR_OBLIGATED_PRODUCT` | Plastic Waste Management Rules — obligation follows the brand owner |
| polypropylene granules | sale as raw material | seller | `PWM_SELLER` | "Seller" of resins and pellets, defined by the 2026 amendment |
| toluene | transport | carrier | `HAZARDOUS_MATERIAL` | MSIHC Rules 1989 Sch. 1; CMVR licensing |
| toluene | storage above threshold | occupier | `MAH_INSTALLATION` | MSIHC Rules — on-site emergency plan |

**Concept attachment is a function of (thing × event × role), never of the thing
alone.** A resolver keyed only on the goods description gets this wrong in both
directions: it will flag inert plastics as hazardous, and miss the EPR obligation
that attaches to the same plastic in a different role.

---

## 4. The concept record

Two things are stored, and confusing them is a design error:

- the **concept definition** — authored once, signed by an advocate, lives in
  `knowledge-base/concepts/*.json`, identical for every user;
- the **concept resolution** — produced per document, carries provenance,
  evidence and state, and is never authored by hand.

The definition below is the first. §4.2 is the second.

### 4.1 The definition (authored, signed, static)

```jsonc
{
  "concept_id": "MSME_SUPPLIER",
  "label": "Counterparty is a micro or small enterprise",

  // Defined by the TREATMENT DEMANDED, never by the thing described.
  // If two candidate concepts demand identical treatment, they are one concept.
  "definition": "A supplier registered under the MSMED Act as a micro or small
                 enterprise, whose invoices attract a statutory payment deadline,
                 statutory compound interest on delay, and a tax disallowance in
                 the buyer's hands.",

  // Where the enumeration comes from. Concepts are IMPORTED, not invented:
  // the legislature has already published the list.
  "authority": [
    { "act": "Micro, Small and Medium Enterprises Development Act, 2006",
      "section": "15", "note": "45 days where agreed; 15 days where not" },
    { "act": "Micro, Small and Medium Enterprises Development Act, 2006",
      "section": "16", "note": "compound interest at three times the RBI bank rate" },
    { "act": "Income-tax Act, 1961",
      "section": "43B(h)", "note": "deduction denied to the buyer until paid" }
  ],

  // Facts the concept carries. A concept is not a flag.
  "attributes": {
    "enterprise_class": { "type": "enum", "values": ["micro", "small"] },
    "udyam_number":     { "type": "string", "optional": true },
    "agreed_payment_days": { "type": "number", "optional": true }
  },

  // Which semantic dimensions must be present for this concept to be
  // considered at all. This is the (thing x event x role) gate from 3.4, and it
  // is what stops a resolver from firing on a noun alone.
  "requires_dimensions": {
    "role":  ["seller", "supplier", "service_provider", "vendor"],
    "event": ["supply", "sale", "provide_services"]
  },

  // What changes when this concept is CONFIRMED. Every id here is checked
  // against the clause library and the constraint files at boot.
  "attaches": {
    "clauses":     ["SUPPLY_PAYMENT_001", "SERVICE_PAYMENT_001"],
    "rules":       [],
    "disclosures": ["MSME_PAYMENT_PERIOD_CAPPED"]
  },

  // Asked only when the resolution is UNRESOLVED. One question, answerable by a
  // non-lawyer, that changes the document.
  "confirmation": {
    "question": "Is the supplier registered on Udyam as a micro or small enterprise?",
    "why": "If so, the law caps your payment period at 45 days and denies you the
            tax deduction until you actually pay.",
    "options": ["Yes", "No", "I don't know"]
  },

  // No concept is live until an advocate has signed it. Mirrors the clause
  // library's review_status, and the same boot flag can refuse unsigned records.
  "review_status": "draft-needs-legal-review",
  "reviewed_by": null,
  "reviewed_on": null
}
```

### 4.2 The resolution (produced per document, never authored)

```jsonc
{
  "concept_id": "MSME_SUPPLIER",
  "state": "CONFIRMED",              // CONFIRMED | UNRESOLVED | OUTSIDE_KNOWN_SET
  "provenance": "declared",          // declared | derived | inferred | asserted
  "confidence": 1.0,

  // The resolved attribute values for THIS document.
  "attributes": { "enterprise_class": "small", "udyam_number": "UDYAM-MH-01-0012345" },

  // Why the resolver concluded this. One entry per determination, each naming
  // the dimension it read and the value it saw. This is what makes 5 auditable.
  "evidence": [
    { "dimension": "role",  "value": "supplier",
      "source": "field:party_2_role" },
    { "dimension": "fact",  "value": "small",
      "source": "field:counterparty_msme_class" },
    { "dimension": "fact",  "value": "UDYAM-MH-01-0012345",
      "source": "field:counterparty_udyam_number" }
  ],

  // Populated only after rules run. Closes the loop from concept to document.
  "applied": {
    "clauses_modified": ["SUPPLY_PAYMENT_001"],
    "rules_fired": [],
    "disclosures_raised": ["MSME_PAYMENT_PERIOD_CAPPED"]
  }
}
```

### 4.3 The traceability invariant

**Mandatory. A concept that cannot answer this chain does not ship.**

```
CONCEPT_ID -> definition -> resolution evidence -> provenance
           -> attributes -> applicable rules -> applicable clauses
```

Concretely: when the document says *"MSME payment protections apply"*, the system
must be able to answer, without a human reading code:

```
Why?                  -> MSME_SUPPLIER

Why MSME_SUPPLIER?    -> role = supplier                (field:party_2_role)
                      -> enterprise_class = small       (field:counterparty_msme_class)
                      -> udyam status = confirmed       (field:counterparty_udyam_number)

Authority?            -> MSMED Act 2006, s.15 and s.16
                      -> Income-tax Act 1961, s.43B(h)

What changed?         -> clause SUPPLY_PAYMENT_001  (payment period clamped to 45 days)
                      -> clause SUPPLY_PAYMENT_001  (interest sentence -> statutory rate)
                      -> disclosure MSME_PAYMENT_PERIOD_CAPPED

Who established it?   -> provenance = declared (the user answered directly)
```

This is not a debugging convenience. It is the precondition for advocate review
at scale: a reviewer who cannot see *why* a concept fired cannot approve the
rule that fired it, and a system whose reasoning is unauditable cannot be signed
off no matter how good its output looks.

The invariant is enforced mechanically, not by convention:

- `tests/conceptRecords.test.mjs` rejects a definition missing `authority`,
  `attaches`, `requires_dimensions` or `definition`;
- it rejects any `attaches.clauses` / `attaches.rules` id that does not exist;
- the resolver must emit at least one `evidence` entry per resolution, and a
  resolution with `provenance: "inferred"` must quote the span it read.

### The `definition` field is load-bearing

A concept is defined by what it *does to the document*. "Chemical" is not a
concept — it is a category of thing that demands a dozen different treatments
depending on context. `HAZARDOUS_MATERIAL` is a concept, because everything it
covers demands the same handful of treatments.

The test: **if two candidates would attach the same clauses and the same rules,
they are one concept.** Facts are infinite. Treatments are not.

---

## 5. Provenance is an input to the engine, not a label on it

This is the single most important design decision here.

| Provenance | Meaning | Engine behaviour |
|---|---|---|
| `declared` | the user answered a question that asks this directly | rules fire silently |
| `derived` | a deterministic rule read structured fields | rules fire silently |
| `inferred` | a model read free text and proposed it | **advisory only, until confirmed** |
| `asserted` | an advocate set it on this matter | rules fire silently; never overwritten |

`involves_personal_data` is `declared` — there is a checkbox. A model concluding
"this looks like a data-processing arrangement" from a services description is
`inferred`. Same concept, different authority, therefore different behaviour.

Without this branch there are only two options, and both are wrong: make the
model authoritative, or turn every inference into a question. The branch is what
makes an LLM safe to use here at all.

### The model may not invent concepts

The classifier is given the concept list and may return only:

- a `concept_id` **from the supplied list**, with evidence quoted from the input;
- `AMBIGUOUS`, with the candidates it could not choose between;
- `OUTSIDE_KNOWN_SET`, with the span of text that prompted it.

A returned id that is not in the list is a bug, not a new concept. New concepts
enter through §8, authored by a person.

### Three states, and the third is the point

| State | Meaning | Document behaviour |
|---|---|---|
| `CONFIRMED` | recognised, provenance permits reliance | clauses and rules attach |
| `UNRESOLVED` | ambiguous, or inferred and unconfirmed | ask; meanwhile advisory only |
| `OUTSIDE_KNOWN_SET` | the engine does not have a concept for this | **say so on the document** |

The third state is the honest answer to "there are infinite concepts." The
system cannot know everything. It can always know *that* it does not know.

The failure mode being designed out is silent defaulting: treating industrial
solvents as ordinary goods because no rule matched. A document that says

> This agreement describes the transport of a substance that may be subject to
> hazardous-goods regulation. LegalAId has not applied any hazardous-goods
> clauses. Have an advocate review before signing.

is more useful, and far safer, than a clean-looking document that quietly
omitted them.

---

## 6. `applies_when` on a clause

```jsonc
{
  "clause_id": "SUPPLY_PAYMENT_001",

  // Suppress the clause entirely unless every predicate holds.
  // Same evaluator as constraints. No new grammar.
  "applies_when": [
    { "var": "counterparty_msme_class", "op": "in", "value": ["micro", "small"] }
  ],

  // Or: keep the clause, change how it is built.
  "variants": [
    {
      "variant_id": "msme_45_day",
      "applies_when": [{ "var": "concept.MSME_SUPPLIER", "op": "present" }],
      "note": "Section 15 caps the period at 45 days; a longer agreed period is
               void to that extent, so the builder must clamp rather than echo."
    }
  ]
}
```

Concepts reach the predicate evaluator as ordinary variables — `concept.<ID>`
for presence, `concept.<ID>.<attribute>` for attributes — because
`evaluateVarPredicate` already reads from a flat bag. No evaluator change beyond
flattening the resolved concepts into `variables` before the rules run.

**Where conditionality lives — decide once:**

- `applies_when` on a **clause** answers *is this clause applicable to this deal?*
- `when` on a **constraint rule** answers *is this document defective without it?*

Different questions. Do not encode the same condition in both. All 17
`applies_to` declarations in the constraint files currently key on
`applies_to_doc_types`; not one keys on a fact. That is where concepts are most
obviously missing and least likely to break anything.

---

## 7. The baseline comes first

`scripts/freezeClauseBaseline.mjs` (shipped alongside this document) records
which clauses each of the 40 document types currently emits, at minimal and full
intake. It is wired into `npm test`.

It is **not** a correctness assertion. The golden corpus asserts that a lawyer
decided a fixture must flag something. The baseline asserts only continuity:
whatever the engine did yesterday, show precisely what it does differently
today.

Current state, recorded 2 September 2026:

- **31 of 40** types emit clauses — 710 clause instances in total
- **9** emit nothing, every one of them failing the same class of check:
  *"the generated clauses do not reflect the supplied &lt;field&gt;"* —
  `APPOINTMENT_LETTER`, `COMMERCIAL_LEASE_AGREEMENT`, `EMPLOYMENT_CONTRACT`,
  `LEAVE_AND_LICENSE_AGREEMENT`, `MASTER_SERVICE_AGREEMENT`, `RENTAL_AGREEMENT`,
  `SALES_OF_GOODS_AGREEMENT`, `SETTLEMENT_AGREEMENT`, `SUPPLY_AGREEMENT`

Why this must exist before `applies_when`: suppression cascades. Removing
`IP_TRADEMARK_USAGE_001` from the distribution blueprint — one clause — raises
`INPUT_MISMATCH_BRANDING_RIGHTS`, which rejects the intake and collapses the
document from 34 clauses to zero. Without a before-picture that reads as "the
document got shorter."

---

## 8. Evidence-driven growth

Concepts do not enter because someone thought of one. Each new concept needs:

1. **A document that came out wrong**, kept as a fixture.
2. **A published enumeration** — a schedule, a notified list, a threshold.
   If nobody has enumerated it, it is not yet a concept.
3. **A treatment that differs** from every existing concept. If it attaches the
   same clauses as one already present, extend that one instead.
4. **A confirmation question** a non-lawyer can answer.
5. **An advocate's signature** on the concept record.

`OUTSIDE_KNOWN_SET` occurrences are the intake queue: they are the system
telling you, in production, exactly which concept to author next.

### Concepts are stable; their rules are not

The Plastic Waste Management (Amendment) Rules, 2026 were notified on
**31 March 2026** (G.S.R. 237(E)). They redefined "end of life disposal",
introduced a "Seller" of plastic raw materials, raised Category I recycled
content to 60% by 2028-29, required conformity to IS 14534:2023, and barred
importers from counting recycled content in imported goods toward their targets.

`EPR_OBLIGATED_PRODUCT` did not change. Its authority list and its clause
attachments did. That is the whole argument for this layer: statutory churn
lands in one reviewable place instead of being distributed through 108 runtime
builders in `documentHardening.js`.

---

## 9. The first ten

Eight attach to clauses and rules that already exist. Two do not — and those two
are the honest answer to *"will this work for plastics and chemicals?"*

| # | Concept | Trigger | Attaches to |
|---|---|---|---|
| 1 | `MSME_SUPPLIER` | counterparty is micro/small, Udyam-registered | `SUPPLY_PAYMENT_001`, `SERVICE_PAYMENT_001`, `MSA_SOW_MECHANISM_001`, `LOAN_AMOUNT_001` |
| 2 | `GST_TAXABLE_SUPPLY` | consideration for goods or services | 14 clauses tagged `gst_applicable`, `ENFC_SERVICE_GST_INVOICE` |
| 3 | `TDS_DEDUCTIBLE_PAYMENT` | payment falls in a deduction head | 28 clauses tagged `tds_applicable`, `ENFC_SERVICE_TDS`, `ENFC_LOAN_TDS_194A`, `ENFC_RENTAL_TDS_194I` |
| 4 | `PERSONAL_DATA_PROCESSING` | personal data is handled | `CORE_DATA_PROCESSING_001`, all `PRIVACY_*` |
| 5 | `COMPULSORILY_REGISTRABLE` | instrument falls in Registration Act s.17 | `PROP_REGISTRATION_MANDATORY_001`, `RENTAL_REGISTRATION_MANDATORY_OVER_12M`, `ENFC_RENTAL_REGISTRATION` |
| 6 | `BIS_NOTIFIED_GOODS` | goods under a Quality Control Order | `SUPPLY_GOODS_DESCRIPTION_001`, `SUPPLY_QUALITY_001` |
| 7 | `AAEC_RISK_ARRANGEMENT` | exclusivity, RPM, tie-in, refusal to deal | `DIST_COMPETITION_COMPLIANCE_001`, `DIST_APPOINTMENT_EXCLUSIVE_001` |
| 8 | `EMPLOYMENT_HEADCOUNT_THRESHOLD` | workforce crosses a statutory floor | `EMP_POSH_POLICY_001`, all `POSH_*`, `ENFC_EMPLOYMENT_EPF`, `ENFC_EMPLOYMENT_MATERNITY` |
| 9 | `HAZARDOUS_MATERIAL` | listed substance, in a regulated event | **nothing — clauses must be authored** |
| 10 | `EPR_OBLIGATED_PRODUCT` | plastic, e-waste, battery packaging | **nothing — clauses must be authored** |

There is not one clause in the library matching `/HAZARD|SAFETY|ENVIRON/`.
Concepts 9 and 10 are exactly the plastic-and-chemicals case, and they cost more
than the other eight combined — not because detection is hard, but because the
clauses they would attach do not exist yet. That is the real price of the
motivating example, and it is worth knowing before starting rather than after.

---

## 10. Worked example: `MSME_SUPPLIER`

Chosen because it looks trivial and is not. Every subtlety below is a place a
flat boolean would produce a wrong document.

**Statutory position**

- MSMED Act s.15: payment within the agreed date or **45 days** from the day of
  acceptance, whichever is earlier; where nothing is agreed, **15 days**. An
  agreement fixing a longer period is void to that extent.
- MSMED Act s.16: compound interest, monthly rests, at **three times** the RBI
  notified bank rate. Not contractible away.
- Income-tax Act s.43B(h): the buyer's deduction is deferred until the sum is
  actually paid.

**Four qualifications a boolean cannot carry**

1. s.43B(h) reaches **micro and small only** — not medium.
2. **Traders are excluded.** Wholesale and retail traders were admitted to MSME
   classification in 2021, but only for priority-sector lending; the
   delayed-payment protections were not extended to them.
3. **Udyam registration must exist on the date of supply**, not merely today.
4. The **day of acceptance** is the delivery date, unless the buyer objects in
   writing within 15 days, in which case it runs from removal of the objection.

**Why this must be asked, not inferred**

The buyer usually does not know the supplier's Udyam status, and nothing in a
free-text description reveals it. This is a `declared` concept or it is nothing.
Inferring it from a company name would be a fabrication with a tax consequence.

**What changes in the document**

- `SUPPLY_PAYMENT_001` and `SERVICE_PAYMENT_001` clamp the payment period to 45
  days rather than echoing a longer agreed figure.
- The interest sentence states the statutory rate instead of a negotiated one.
- A notice fires: a longer period was requested and is void to the excess.

**When the answer is "I don't know"**

State `UNRESOLVED`. Draft the 45-day version — the safe default, since a shorter
period is always lawful — and annotate that it was assumed and why. Do not
silently draft 90 days.

---

## 11. Sequence

### 11.1 The migration rule: adapt first, replace last

**Do not migrate `generationControls.js` wholesale into concepts.**

Those 57 derived flags are working production logic. Every document the system
has ever produced went through them. Replacing them in one commit converts a
conceptual improvement into a large regression surface, and the resulting diff
would be unreadable — the exact failure the clause baseline in §7 exists to
prevent.

Instead the Concept Resolver begins life as an **adapter** that reads what
`generationControls` already computes and re-expresses it as resolutions with
provenance. Nothing is removed. The concept layer runs *alongside* the flags,
producing the same answers by a different route, until the two are shown to
agree.

```
        existing intake
              │
              ▼
     existing generationControls          ← unchanged, still authoritative
              │
              ▼
      Concept Resolver adapter            ← NEW: reads flags, emits resolutions
              │
              ▼
   resolved concepts + provenance         ← evidence names the flag it read
              │
              ▼
        flat variables                    ← concept.<ID>, concept.<ID>.<attr>
              │
              ▼
     existing predicate engine            ← unchanged
              │
              ▼
  existing clause/rule infrastructure     ← unchanged
```

A flag read by the adapter yields `provenance: "derived"` with an evidence entry
naming it, for example `source: "control:involves_personal_data"`. That is
honest: the determination really was made by existing code, and the record says
so rather than implying an advocate authored it.

**Retirement is per-flag and comes last.** A flag may be removed only when:

1. its determination exists as a signed concept record;
2. the adapter and the data-driven resolver have agreed on it across the full
   fixture set;
3. the clause baseline shows no drift after the flag is removed.

Expect several flags never to retire. Some of the 57 are presentation concerns
(`party_1_label`, `party_2_label`) or plumbing (`arbitration_city`), not legal
characterisations at all, and forcing them into the concept vocabulary would be
the every-noun-is-a-concept mistake in a different costume.

### 11.2 Steps

| # | Step | Depends on | Risk |
|---|---|---|---|
| 1 | Land the clause baseline | — | none — **done** |
| 2 | Concept + dimension schemas; `tests/conceptRecords.test.mjs` | — | none — **done** |
| 3 | Author the 10 concept records as data | 2 | none — **done, unsigned** |
| 4 | **Advocate signs the 10 records** | 3 | none — but this is the real gate |
| 5 | Export `evaluatePredicate` from `constraintEngine.js` | — | none |
| 6 | Concept Resolver **adapter** over `generationControls` (§11.1) | 3 | none — output unused |
| 7 | Flatten resolutions into `variables`; assert against fixtures | 6 | none |
| 8 | Point 3 existing constraint rules at concepts instead of doc types | 5, 7 | low — validation only |
| 9 | Make `invalid_if` executable as findings | — | low — additive |
| 10 | **First `applies_when`**, one clause, one type | 1, 7 | **high — read the baseline diff** |
| 11 | Migrate flags to data-driven resolution, one at a time | 7, 10 | low per flag, by construction |
| 12 | Roll out `applies_when`; retire `include_if` | 10 | high, but now visible |
| 13 | Layer D — constrained LLM classification, `inferred` only | 7 | contained by provenance |
| 14 | Author hazardous-goods and EPR clauses | 4 | new legal content — the long pole |

Steps 1–9 add no risk to any existing document. Step 10 is the first that can
change what a user receives, and by then the baseline, the fixtures, the
traceability invariant and the provenance branch are all in place to catch it.

**Prerequisite outside this sequence:** the nine non-generating document types
(§7) should be repaired before any concept-layer rollout. They fail on value
reflection, not clause selection, so they are independent work — but shipping
concept-driven clause selection on top of nine types that produce nothing would
make both problems harder to diagnose.

---

## 12. What this does not solve

- **Nothing here reduces the review debt.** 289 clauses carry zero advocate
  sign-offs (147 awaiting review, 142 unmarked). Concepts add records that need
  signing. Keep the vocabulary at ten to fifteen for that reason alone, not
  because the domain is small — it plainly is not.
- **The nine non-generating types are unrelated** to concepts and should be
  repaired before rollout; they fail on value reflection, not clause selection.
- **The adapter does not make the flags correct.** Wrapping
  `generationControls` in provenance records what existing code decided; it does
  not review it. A flag that was wrong stays wrong, now with an audit trail.
- **`OUTSIDE_KNOWN_SET` is a disclosure, not a safety net.** It tells the user
  the system did not recognise something. It cannot tell them what it missed.
