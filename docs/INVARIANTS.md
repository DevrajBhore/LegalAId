# LegalAId invariants

These are not implementation details. Each one is a property the system must
hold whatever else changes, each was established because its absence produced a
real defect, and each is pinned by a named test. Breaking one should fail the
build, not surprise a user.

They fall into three groups, and **the groups must not be read as one list**:

| Part | What it contains | How to read it |
| --- | --- | --- |
| **I. Architecture** | properties that hold regardless of legal content | requirements — never relax one |
| **II. Knowledge admission** | what every new legal artifact must satisfy | a gate — enforced by the loader, not by memory |
| **III. Current-state limitations** | what is deliberately unfinished | **debt, not design** — never mistake an entry here for a requirement |

The third part exists because six months from now someone will read "forty
families are defined in JavaScript" and conclude that is how it is meant to work.
It is not. It is what has not been migrated yet.

---

## The distinction that governs everything in Part II

```
STRUCTURALLY ADMISSIBLE   ≠   LEGALLY REVIEWED
```

The admission gate proves that a knowledge artifact has a legal proposition, a
scope, a jurisdiction, a stated authority, a behaviour when unanswered, and
treatments in both directions. **It proves none of them are correct.**

A fact can clear every check in Part II and still be wrong about Indian law.
Admission is a structural test performed by a program; review is a legal
judgment performed by an advocate. Nothing in this system may present the first
as though it were the second, and `review_status` exists precisely so the
difference stays visible on every artifact.

---

# Part I — Architecture invariants

*True regardless of what legal content the system carries. No document-specific
branches, knowledge discovered rather than registered, and the properties below.*


## 1. Authority

```
explicit answer  >  derived fact  >  inference  >  drafting default
```

A position the user was asked about directly outranks anything derived from
something else they wrote. An inference drawn from prose can establish a
position where none existed; it can never overturn one the user stated.

*Pinned by* `tests/positionConservation.test.mjs` — tested against the generated
document, not the variable state, so the authority is proved to survive all the
way to legal output.

*Why it exists.* Resolved positions are applied at the end of
`deriveGenerationControls`. Implementation order stops being obvious the moment
someone adds a block below it, and the failure is silent: the document quietly
stops honouring what the user said.

---

## 2. Answer semantics

```
not answered      = unknown
answered + yes    = true
answered + no     = false
invalid answer    = unmatched
```

Silence is not rejection. An unticked box on a question the user **answered** is
a no; a question never put to them leaves the position open. These are different
legal states and must never collapse into one another.

*Pinned by* `tests/positionSemantics.test.mjs`, `tests/answerStateCorpus.test.mjs`.

*Why it exists.* A Quick Form consultancy once reached the generator with
thirteen of thirteen shape-determining flags set to hard `false` and not one set
to unknown — thirteen deliberate refusals by a user who had never been asked a
single one of the questions. Every `include_if` gate read them as refusals, and
what survived was the boilerplate. That was the whole generic-document problem,
and it was a representation bug.

---

## 3. Never convert absence of information into an affirmative contractual position

The general form of §2, and the one to reach for when the others do not obviously
apply.

*Why it exists.* `utilities_included` was read by two blueprints and collected by
no form, so it was permanently unknown. The gate `utilities_included == false`
fired on that silence, and every tenancy the system ever produced asserted that
the tenant pays every utility bill and that arrears come out of the deposit. An
allocation of cost and a remedy, agreed by nobody.

**Corollary, pinned by `tests/materialityAnalysis.test.mjs`:** no blueprint may
gate a clause on a flag no intake field can reach. Such a gate is decided by
silence forever.

---

## 4. Invalid input may create a diagnostic; it may not create a legal fact

```
unmatched
  -> reported to the caller
  -> no fabricated position
  -> no fabricated disclosure
  -> no fabricated clause
```

*Pinned by* `tests/positionConservation.test.mjs`, `tests/disclosureArtifact.test.mjs`,
`tests/answerStateCorpus.test.mjs`.

*Why it exists.* A fabricated disclosure is indistinguishable from a real one to
the person signing. Manufacturing an explanation for input the engine could not
read converts a validation failure into what looks like a deliberate legal
determination.

---

## 5. Semantic conservation

```
every dispositioned position -> exactly one accounted outcome
      RESOLVED | DEFAULTED | UNRESOLVED | ESCALATED
```

There is no fifth outcome of "nothing happened", and conservation covers **both**
dispositions the materiality analysis produces — `ASK` and `DEFAULT_AND_DISCLOSE`
— not only the questions.

*Pinned by* `tests/positionConservation.test.mjs`.

*Why it exists.* The first implementation accounted only for the `ASK` set, so
every mechanism marked `DEFAULT_AND_DISCLOSE` fell outside the count: the draft
adopted a position for each and disclosed none. A position that silently
disappears is the §3 defect in new clothing — the document takes a stance and
nobody can say who took it.

---

## 6. Disclosure ownership

```
position model  =  determines the kind
renderer        =  renders the kind
exporter        =  lays out the rendered block
```

The renderer is deliberately dumb. It must never ask "is this unresolved with
drafting-default provenance, therefore I suppose it is a drafting default?" — it
receives `kind = ASSUMED` and renders `[ASSUMED]`.

The three kinds are a legal characterisation, not presentation, because each
calls for a different action:

| Kind               | Meaning                                   | Reader action    |
| ------------------ | ----------------------------------------- | ---------------- |
| `ASSUMED`          | the draft adopted an assumption           | verify or correct |
| `OPEN_POINT`       | a material issue is unsettled             | answer or resolve |
| `DRAFTING_DEFAULT` | a choice made in the absence of instruction | accept or override |

*Why it exists.* Three exporters each working out what to disclose is how a
system ends up with the DOCX saying one thing, the PDF another and the API a
third — and of those three, the one that governs is whichever the parties signed.

---

## 7. Artifact conservation

```
disclosureKinds.length > 0   <->   the disclosure exists in the final artifact
```

Both directions. A disclosure that reaches the app but not the signed document is
worth less than none, because it creates the belief that the reader was told. An
empty disclosure section printed with nothing to say is the same failure inverted.

*Pinned by* `tests/disclosureArtifact.test.mjs` — which reads the text, DOCX and
PDF **artifacts**, not the call sites. Asserting that a renderer was called would
pass while the signed document stayed silent.

---

## 8. Disclosure is non-substantive

The disclosure layer must never alter clause selection, clause wording, clause
ordering, the numbering of substantive provisions, or legal effect.

*Pinned by* `tests/disclosureArtifact.test.mjs` — clause ids are compared with
and without the block, and no clause may absorb the heading into its own text.

---

## 9. The interview never selects a clause

```
question -> fact -> position -> treatment -> deterministic gate -> clause
```

never

```
question -> "add clause X"
```

A fact record may only establish a fact. Only the `treatments` table may take a
position on a mechanism, and only the deterministic engine selects clauses. This
is the same boundary that keeps the LLM from adding, removing or reordering
clauses, applied to the interview.

*Pinned by* `tests/factQuestions.test.mjs`.

---

## 10. A question never names a mechanism

A user should not have to know that the protection they want is called an
indemnity in order to ask for it. Questions ask about circumstances; the
knowledge base derives the machinery.

*Pinned by* `tests/factQuestions.test.mjs`, against a lexicon of 30 terms of art,
matched on word boundaries.

---

## 11. A document must never look fully fact-specific while resting on an assumed party side

Every party-relative position records `restsOnAssumedSide`, and a draft that
rests on one discloses it — including when nothing else resolved, which is the
case where the assumption is most consequential.

*Pinned by* `tests/disclosureArtifact.test.mjs`, `tests/answerStateCorpus.test.mjs`.

*Why it exists.* The gap check assumed the user was the first party named. On a
vendor agreement, where the naming policy makes party 1 the Supplier, it asked
what "the Buyer" would have access to — when the user is nearly always the buyer,
asking about the vendor. Every protection selected from the answer would have
been drafted for the wrong side of the table.

---

## 12. Universality

> **Adding legal knowledge changes the system's behaviour.
> Adding legal knowledge does not require changing the system that executes it.**

The acceptance criterion, and a ratchet rather than a target.
`scripts/proveUniversality.mjs` installs an artificial document family — a
*Zorvic Custody Arrangement* between a Bailor and a Keeper, names that appear
nowhere in the JavaScript — as knowledge-base artifacts only, walks the whole
chain, then removes every artifact and confirms the engine is unchanged.

**8 of 11 links are knowledge-driven today.** What crosses without a code change:

- clauses load and blueprints resolve for a document type nothing has heard of
- materiality analysis reads the new blueprint's gates
- the gap check resolves a position from an answer on the new family
- conservation holds on a family the engine has never seen
- the deterministic engine selects the new clauses, including a conditional gate
  firing from a resolved position

What still requires code:

| Blocked link | Why |
| --- | --- |
| `shared/documentRegistry.js` | the list of document types is JavaScript |
| `backend/config/documentConfig.js` | form sections are JavaScript |
| gap-check planning | *consequence of the above*, not an independent gap — with no form sections the planner sees no collectable fields, so every position reads as unreachable |

`backend/config/variableConfig.js` is a partial pass: COMMON variables resolve for
an unknown type, so an intake exists, but nothing type-specific does.

The durable contract is the **schemas and relationships, not the filenames**. The
engine should consume validated registries whether they live in `facts/*.json`,
one file, or a database. Directory layout is not architecture.

*Pinned by* `tests/universality.test.mjs`, which names each of the eight
individually — a regression says which link broke, not merely that a count fell.
Raising the number is progress; lowering it means a generic layer has learned
something document-specific it should not know.

### Universality reached 11/11 — 10 September 2026

The migration that closed it was one architectural change, not a set of patches:
**document families are discovered, never registered.**

- `shared/knowledgeDocuments.js` loads and validates `knowledge-base/documents/*.document.json`.
  There is deliberately no `registerDocument({…})` for application code to call —
  a function that takes a document's knowledge as arguments is still hardcoding
  with better manners.
- `backend/services/factRegistry.js` assembles the fact registry from
  `legal_facts.json` **plus** any `knowledge-base/intake/facts/*.json`. A new
  family contributes its own questions and treatments instead of editing a shared
  file that forty other families depend on.
- The registry, `DOCUMENT_CONFIG` and `getVariables` all merge what they discover
  with what is still defined in JavaScript. The forty code-defined families are
  **debt, not design**.

Two defects the hardened canary found on the way, both of which would have made
the claim false while the number looked fine:

1. **Reachability was measured against `deriveGenerationControls` alone.** That
   measures only what JavaScript can decide. A family whose positions come from
   the fact registry had every one of them read as unreachable, so the gap check
   had nothing to ask about. Treatment-reachable positions now count.
2. **The intake probe flattered itself.** COMMON variables resolve for any string,
   so "an intake exists" was passing for a family that had no intake of its own.
   The probe now requires a **type-specific** field. *Some generic variables
   resolve* is not *this document has a knowledge-defined intake*.

The canary is permanent, not a migration fixture. Its identifiers —
`ZORVIC_CUSTODY_ARRANGEMENT`, `QUORRAL_EXPOSURE`, `quorral_cover_required`,
`ZORVIC_LOSS_COVER_001`, family `Quorral Holdings` — occur nowhere in application
JavaScript by construction. It is the standing proof that future work is not
quietly turning the universal engine back into a catalogue of special cases.

**What 11/11 means, precisely:** a genuinely new document family can be
introduced entirely through validated knowledge artifacts, with no engine and no
document-specific application-code modification. What it does not mean: that the
forty existing families have been migrated. They have not.

---


---

## 14. Document-specific substance cannot be satisfied by generic nomenclature

Three separate quality dimensions, and the first must never be allowed to create
the illusion that the other two are satisfied:

| Dimension | The question |
| --- | --- |
| **Boilerplate** | does it carry the normal legal infrastructure? |
| **Identity** | does it do what this KIND of document must do? |
| **Intent** | does it address what THIS user needs? |

LegalAId historically overperformed on the first and underperformed on the other
two. A draft can carry definitions, interpretation, notices, confidentiality,
representations, a generic indemnity, governing law, dispute resolution,
boilerplate and signatures — and still be a bad document, because the provisions
that define the transaction are missing or weak.

**A requirement is not a clause.** It is something the document has to
accomplish, and may be met by one clause, by a choice among several, or by a
combination:

```
Requirement  ->  Treatment  ->  Clause(s)
```

Modelling it as `required_clauses` freezes the answer into the question and ends
at "every MSA has exactly these 45 clauses", which is false.

**The admission test for a requirement** is the counterfactual, and it is
enforced: every entry must complete the sentence *"Remove it and …"* with the
legal function that is lost. If nobody can complete it, the provision is
supporting infrastructure rather than identity. Definitions, notices,
severability and waiver are all good clauses and none of them is a document
requirement.

Every requirement terminates in a stated coverage — `RESOLVED`, `DEFAULTED`,
`UNRESOLVED`, `ESCALATED`, `NOT_APPLICABLE` or `APPLICABILITY_UNKNOWN` —
mirroring position conservation, because the principle is identical: nothing
silently disappears.

**`APPLICABILITY_UNKNOWN` is not `NOT_APPLICABLE`,** and conflating them is
invariant 3 in a sixth disguise. A requirement whose applicability rests on a
fact nobody established has not been assessed; it has been skipped. Authoring the
employment registry exposed this: `POSH_DUTY_REFLECTED` applies where the
employer has ten or more employees, nobody had been asked the headcount, and the
requirement was quietly reported as inapplicable. The same defect was then found
in the MSA, where the DPDP requirement disappeared because nobody had said
whether personal data is processed. Both now report as undetermined and keep the
escalation they were authored with.

*Pinned by* `tests/documentRequirements.test.mjs`. Its central check is a façade:
**twenty well-drafted general provisions satisfy 1 of the 13 applicable MSA
identity requirements, and 7 of the failures are blocking.** Twenty general
provisions are not a Master Service Agreement, and the assessment has to say so.

**The registry must never become a second clause-selection engine.** It answers
*what must this document accomplish*; the deterministic machinery answers *given
the facts, concepts, authority and applicable treatment, what mechanism
accomplishes it*. The assessment reads the emitted clause set and never
contributes to it.

### A formality is never reported as done

A **CONTENT** requirement is satisfied when the document says the thing. A
**FORMALITY** requirement can only ever be *provided for*: stamping and
registration are acts performed on the instrument, not statements made in it.

A tenancy exposed the conflation. `INSTRUMENT_IS_REGISTERED` was reporting
`RESOLVED` because a registration clause was present — which would tell a user
their lease is complete when section 49 of the Registration Act, 1908 bars it
from being received in evidence, and section 107 of the Transfer of Property Act,
1882 makes a lease exceeding one year void without it. For content requirements
"addressed" and "done" coincide; for formalities they do not.

`PROVIDED_FOR` is the ceiling for a formality, counted **apart** from resolved —
folding it in restores the conflation the state exists to prevent — and a
FORMALITY requirement is refused admission unless it says what act lies outside
the document.

### Falsification: timing, and the most dangerous green

The fourth family was chosen to **break** the model rather than confirm it, and
it did. A notice under section 138 of the Negotiable Instruments Act, 1881 has
almost none of its legal effect in the words: thirty days from the bank's return
memo to give it, fifteen for the drawer to pay, a month to complain. Authored as
CONTENT requirements, the assessment reported **7 of 7 RESOLVED for a notice the
system had no idea when was sent.** A flawlessly drafted notice served on day
thirty-one is worth nothing, and the report said it was complete.

`TIMING` is the fourth kind. Where the window is computable from the intake it is
computed — a notice on day 31 reports `OUT_OF_TIME` with the arithmetic shown —
and where it is not, it reports `UNVERIFIABLE`. The complaint has not been filed
and cannot be observed; **unverifiable is the honest answer and must never drift
to resolved.** A TIMING requirement is refused admission unless it names the
external event the clock runs from, because without that it cannot be
distinguished from a clause that merely mentions a period.

### Falsification: a document cannot assert a character its content defeats

The fifth family was aimed at a boundary the first four never touched. All of
those concerned the world **outside** the document — substance behind
boilerplate, an unasked fact, an unperformed act, an unmet deadline. This one is
**internal**.

An MOU that declares itself non-binding while carrying dispute resolution,
survival, governing law and termination is not incomplete; it is **incoherent**,
and Indian courts gather intention from the whole instrument rather than from the
label on it. Authored as a CONTENT requirement it reported **6 of 6 RESOLVED** —
for the MOU the system generates today.

`CHARACTER` is the fourth kind, and it broke an assumption the model had held
silently since the beginning: **satisfaction was monotone in clause presence.**
Adding a clause could only ever help. Here adding one defeats the requirement. A
CHARACTER requirement is refused admission unless it lists what defeats it and
says why — without that it is an ordinary content requirement wearing a stronger
name. Confidentiality is deliberately **not** listed as defeating: it is an
obligation parties may intend to bind even where the commercial understanding
does not, and treating it as a contradiction would make every workable MOU
incoherent.

### Two dimensions, kept apart

```
KIND     what sort of thing is evaluated     CONTENT | FORMALITY | TIMING | CHARACTER
FINDING  what the system established          ESTABLISHED_POSITIVE
                                              ESTABLISHED_NEGATIVE
                                              CEILING_FOR_KIND
                                              NOT_ESTABLISHED
                                              WORK_INCOMPLETE
```

Collapsing them is how a status vocabulary silts up with special cases and nobody
can say whether a new state is a new kind of legal thing or a new kind of
knowledge. `OUT_OF_TIME` is **not** a weaker `UNRESOLVED` — it is a determined
negative. `PROVIDED_FOR` is **not** a weaker `RESOLVED` — it is the ceiling for a
formality. `CONTRADICTED` is a determined negative too, not incomplete work.

Only `ESTABLISHED_POSITIVE` is success, and the test asserts that the coverage
state and its finding never disagree about that.

### Satisfaction is not monotone in clause presence

The MOU broke an assumption the model had held silently from the beginning:
**more applicable clauses meant at least as much satisfaction.** A clause can be
positive evidence for one requirement and negative evidence for another, which
means `satisfied_by` alone was never sufficient for every kind of requirement.

Contradiction must be **evidence-based, never similarity-based**. The registry
must not become "an LLM thought these clauses looked inconsistent, therefore
CONTRADICTED". A CHARACTER requirement names what defeats it and why, the
assessment is deterministic, and the same boundary holds as everywhere else:
knowledge authors the legal proposition, deterministic machinery evaluates it,
the model does not invent the legal relationship.

---

## 15. Certification: what a family has actually been through

The dangerous claim:

```
40 document types  ·  40 generators that run  ·  40 documents called "supported"
```

when five have been substantively tested. *It generates* and *it has been shown
to do the legal work it claims* are different sentences.

```
NOT_ASSESSED  ->  IDENTITY_AUTHORED  ->  REQUIREMENTS_ADMITTED
   ->  GENERATION_COVERAGE_TESTED  ->  FALSIFICATION_PASSED
   ->  ADVOCATE_REVIEW  ->  APPROVED
```

**Status is derived, never declared.** No family is promoted by writing a better
word in a file; every rung is computed from evidence that exists independently of
the claim, and the test proves the ladder *falls* when evidence is withheld. The
one rung with an authored component — falsification — requires naming the
specific attack and the false green it produced, because "we tested it" is not
evidence and *"we fed it a boilerplate façade and it reported 1 of 13"* is.

### Five kinds of review evidence, none implying the next

```
all requirements reviewed
    != all emitted clauses reviewed
    != the family reviewed
    != a generated artifact reviewed
    != the family approved
```

An earlier version derived the top two rungs from requirement-level
`review_status` alone. That is too permissive: enough lower-level flags would
eventually **accumulate into an approval nobody gave**. `ADVOCATE_REVIEW` and
`APPROVED` now require evidence of their own kind, from four independent sources
— the requirements registry, the clause library, a family review record, and a
signature.

The test attacks it directly. Mark every requirement reviewed: still
`FALSIFICATION_PASSED`. Mark every clause reviewed as well: still
`FALSIFICATION_PASSED`, because two kinds of evidence are not five. Supply all
five and the family is approved — the ladder has to be *reachable*, or it is
theatre rather than a measurement — and withholding any one of them takes it
straight back down.

**Today: 0 approved, 4 falsification-passed, 36 not assessed.** The only number
that may ever be put in front of a user as *supported* is the first one.

### Three different truths, never one word

The product must never say *"document complete"*. There are at least three
separate claims and the system can make only the first:

| | |
| --- | --- |
| **Document coverage** | did we address the legal work we know this document requires? |
| **Legal validation** | has an advocate reviewed the legal content? |
| **World state** | have the external acts, events and formalities actually occurred? |

`PROVIDED_FOR`, `UNVERIFIABLE`, `OUT_OF_TIME` and `APPLICABILITY_UNKNOWN` exist
precisely because the third is outside the system's knowledge, and the
certification ladder exists because the second is outside its authority.

The goal is not 40/40. Twelve families fully assessed, falsification-tested and
advocate-reviewed is worth more than forty with requirements superficially
authored and nothing reviewed.

### The working method, for every family

```
01 select family              09 map requirements -> treatments
02 gather authoritative source 10 map treatments -> clauses
03 define legal identity      11 verify every clause is reachable
04 apply the counterfactual   12 generate adversarial fixtures
05 separate identity from     13 falsify the assessment
   boilerplate                14 fix the ABSTRACTION, not the fixture
06 author requirements        15 re-run the whole corpus
07 identify applicability     16 advocate review
08 identify external acts     17 only then mark the family assessed
```

Step 14 and step 15 are the ones that matter. A defect found while working on a
sale agreement is not fixed in the sale agreement — it is fixed at the level it
belongs to, and then every earlier family has to survive the change.

The question to ask of each family is not *does this generate?* but **how can
this document falsely appear complete?** Five ways are known. For every new
family, actively hunt a sixth.

### Falsification: truth that is not in the document at all

The sixth family is the first whose legal effect turns on an instrument
LegalAId has never seen. A shareholders' agreement is unenforceable against the
company to the extent it conflicts with the articles of association. Every
earlier falsification could in principle be settled by reading the artifact, the
intake or a date; **this one cannot be settled from the document at all.**

`EXTERNAL_COHERENCE` is the fifth kind, and deliberately **not** a `CHARACTER`
variant. Internal contradiction is read off the artifact; this is a question
about **evidence**, and the pattern is reusable by construction — trust deeds,
board resolutions, partnership deeds, constitutional documents and powers of
attorney all pose it. The test asserts the assessor mentions no document family,
no instrument and no statute.

**Absence of the instrument is not evidence of consistency with it.** Six
evidence states, five distinct outcomes, one success:

| Evidence | Outcome |
| --- | --- |
| nothing supplied | `UNVERIFIABLE` |
| supplied, but another company's | `EVIDENCE_MISMATCHED` |
| supplied, matching, consistent | `RESOLVED` |
| supplied, matching, conflicting | `CONTRADICTED` |
| supplied, matching, ambiguous or silent | `AMBIGUOUS_EVIDENCE` |

`EVIDENCE_MISMATCHED` is the more dangerous of the two negatives and exists
separately for that reason: a file is present, and a careless implementation
reads its presence as satisfaction. Silence in a constitutional document is not
permission, which is why ambiguous and silent share an outcome and neither is
success.

### Falsification: a state that must hold *now*

The seventh family, and the matrix was written **before** the requirements so the
architecture could not be quietly designed around whatever happened to pass.

A power of attorney depends on a state of the world holding *at the moment the
attorney acts*. Section 201 of the Indian Contract Act, 1872 ends the agency on
the donor's death or unsoundness of mind, so a flawless instrument becomes a dead
letter without a word of it changing — and no reading of the document can reveal
it. Two of the five predicted cases reported **success**:

- evidence from 2019 that the condition held;
- two records flatly disagreeing, resolved by **whichever arrived first**.

The second is the least defensible route to a positive finding this system has
taken. It forced exactly two additions, neither speculative:

| | |
| --- | --- |
| `STALE_EVIDENCE` | a continuing state is only ever evidenced *as at* a date; undated or expired evidence establishes nothing |
| `CONFLICTING_EVIDENCE` | records that disagree are never resolved by order — the test reverses the array and requires the same finding |

Seven evidence states, six distinct outcomes, one success. **How long evidence of
a continuing state speaks for is authored in the requirement** — ninety days for
this one — not an architectural constant.

The reusability test caught the first attempt: an explanatory comment in the
assessor named the donor and the Contract Act. The doctrine belongs in the
knowledge artifact; the assessor stays generic enough to serve licence validity,
corporate status, insurance cover and board authority alike.

### The semantic regression corpus

Five families, each of which once produced a **green report for a legally
unfinished document**. Every future change to this layer must survive all five,
and the test names the false green each one exists to prevent:

| Family | Identity from | False green |
| --- | --- | --- |
| Master Service Agreement | commercial architecture | boilerplate as substance |
| Employment contract | statute | unknown applicability as inapplicability |
| Tenancy | formality | a clause about an act as the act |
| Cheque-bounce notice | timing | a stated period as a met deadline |
| Memorandum of understanding | self-declared character | a declaration its own content defeats |
| Shareholders' agreement | an instrument outside the artifact | absence of that instrument as evidence of consistency |
| Power of attorney | a state that must hold now | stale and order-resolved evidence as proof it still holds |

### No state but RESOLVED and DEFAULTED counts as success

`PROVIDED_FOR`, `UNVERIFIABLE`, `APPLICABILITY_UNKNOWN` and `OUT_OF_TIME` must
never be folded into an "n of n satisfied" summary. That number is what a user
reads, and a summary that counts *"the document contains a registration clause"*
as *"registration: complete"* is the most dangerous output this system can
produce. Pinned across every family's assessment.

### The model holds outside the family it was designed for

The MSA's identity comes from commercial architecture — how work is ordered,
priced, governed and exited. The **employment contract's comes from statute**:
the Code on Wages fixes when and how much is paid, the POSH Act imposes a duty
that does not depend on the contract at all, provident fund and gratuity attach
on thresholds nobody negotiates. Fourteen requirements, eight of them naming the
statute whose operation makes them identity-defining, and the test refuses a
statute-driven registry whose requirements read like commercial preferences.

The **tenancy** is a third source again — partly formality, where the document's
legal effect depends on acts performed outside it. Three families, three
different places identity comes from, one model:

| Family | Identity comes from | What it exposed |
| --- | --- | --- |
| Master Service Agreement | commercial architecture | boilerplate masquerading as substance |
| Employment contract | statute | unknown applicability masquerading as inapplicability |
| Tenancy | formality | a clause about an act masquerading as the act |
| Cheque-bounce notice | timing | a stated period masquerading as a met deadline |

Each defect was corrected at the level it belonged to, not patched per family.

Four kinds of legal completion have been **discovered by failure**, never designed
speculatively: `CONTENT` (the document says it), `FORMALITY` (the document
provides for an act performed on it), `TIMING` (an act within a window measured
from an external event), and applicability that is *unknown* rather than absent.
Further kinds — consent or approval by a third party, evidence of service,
performance after execution — are **not** to be created until a family forces
them. The ontology is strongest when a real failure discovers it.
That is the difference between an architecture and three good implementations.

A statutory entitlement is **not** a requirement merely because it exists. It is
a requirement where the contract's silence causes a legal defect — which is what
the counterfactual test is for. An employee's right to gratuity does not depend
on the contract mentioning it; a contract that misstates the wage structure does
cause harm, because section 2(y) of the Code on Wages, 2019 decides gratuity,
provident fund and retrenchment compensation off that split for the whole of the
employment.

### The methodology this came from

For each important document family, take authoritative source material and ask,
in order: what are the identity-defining provisions — *not* "what clauses are
common" but "if I remove this, does the document cease to perform its legal
function"? Which already exist, and are they actually **reachable**? Which exist
but are unwired — an engineering defect. Which do not exist — a knowledge defect.
Which are conditional, and therefore need facts and treatments? Which are
user-specific, and must come from the interview rather than the template?

**The standing test:** could a lawyer receive the generated document and
immediately identify what transaction it governs, what the parties agreed, what
material risks and obligations were addressed, and which material questions
remain open? If not, fifty beautifully written boilerplate clauses do not matter.

---

## 16. Every clause that can reach a signed document comes from the governed library

```
runtime_shipped_clause_ids  ⊆  getAllClauses().ids
```

Zero exceptions. Not a ceiling — an invariant.

`backend/commercial/protectionLibrary.js` was a second clause library that built
clauses with `AUTO-*` ids and injected them after hardening had run. Three of them
reached shipped documents across seven document types, carrying no `review_status`
an advocate could sign, no structured `legal_basis`, no `invalid_if`, absent from
`getAllClauses()` and therefore from the library counts and the unreviewed-clause
ceiling, and unreachable by a knowledge-defined family — which made invariant 12
quietly false.

All six are now governed clauses. **The text is unchanged**, so the entire
baseline diff was a 1:1 id substitution across seven types with nothing gained or
lost. Whether they should instead be deduplicated against their near-equivalents
already in the library — `CORE_LIMITATION_LIABILITY_001`, `CORE_INDEMNITY_001`,
`CORE_FORCE_MAJEURE_001` — is a drafting decision for an advocate, deliberately
left open. `protectionLibrary.js` now holds only the mapping from a requested
protection to a clause id, which is routing rather than legal knowledge, and the
injector **refuses** rather than falling back to hand-built text.

*Pinned by* `tests/clauseProvenanceReach.test.mjs`, which walks every clause in
every document type's baseline and requires `getClauseById` to return it.

Found by a client review noticing two odd ids in an NDA, not by any test here —
every invariant in this system was about clauses the knowledge base knows about.

## 17. Citation identity is not substring matching

A review asked one line about *"the Section 43A IT Act reference"*. Scanning for
the string returned twelve clauses; **eleven** cite it in `legal_basis.section`
and the twelfth mentions section **143A** of the Negotiable Instruments Act in
prose. The same token-boundary class as the money regex that once read
`parent_name` as a rent field.

A legal proposition propagating through many clauses is exactly when a miscount
matters, so the population is defined by the structured field and never by a
substring of the record. Two quantities, always reported apart: *clauses citing
the provision* and *records containing the string*.

*Pinned by* `tests/clauseProvenance.test.mjs`, using `S138_CONSEQUENCE_001` as
the standing counter-example.

## 18. Presence plus plausible wording is not a coherent boundary

Every state in invariant 14 answers a question about **one** requirement: does it
apply, is it satisfied, by what, and how well is that known. A document can
answer all of them positively and still be incoherent, because the defect lives
**between** two provisions each of which reads correctly on its own.

The NDA is the proof, and it is not synthetic. Every NDA the product generates —
both recorded baselines — carries:

| clause | what it says about the confidentiality period |
|---|---|
| `NDA_DURATION_001` | obligations *"survive its termination or expiration and continue for a period of **five (5) years** thereafter"* |
| `NDA_TERM_SURVIVAL_001` | obligations *"survive for a further period of **three (3) years** ... and indefinitely in respect of trade secrets"* |

Two clauses, each individually well drafted, giving different answers to the only
question a confidentiality obligation must settle. The library does not merely
permit the pairing: `NDA_DURATION_001` lists `NDA_TERM_SURVIVAL_001` in
`required_with`, so it **forces** the contradiction into every NDA. The
requirement model reported **9 of 9 RESOLVED**, because both clauses were present
and each satisfied its own requirement.

The mechanism is a `relationships` block in the family's knowledge artifact,
naming the participating clauses, the question they must agree on, and a regex
that reads each clause's answer **out of that clause's own text**. Four rules:

1. **Evidence-based, never semantic similarity.** Nothing is inferred from clause
   names, categories or proximity. This is the same rule that governs
   `CONTRADICTED` in invariant 14.
2. **Failure of the instrument is not agreement.** If the extract reads nothing
   from a clause that is present, the relationship is `NOT_ESTABLISHED`, never a
   pass. A silent regex miss reading as coherence is the invariant-17 bug class.
   Unsupplied clause text is `WORK_INCOMPLETE` for the same reason.
3. **Every answer the clause gives is evidence, not the first one.** Taking the
   first match would make the finding depend on drafting order.
4. **Reported on its own axis.** `coherence` is never counted into `summary`.
   Folding one broken relationship into *"9 of 10 resolved"* restores the exact
   arithmetic this exists to defeat. `summary` is byte-identical for the coherent
   and the self-contradicting NDA — that equality *is* the abstraction gap.

A relationship that names fewer than two clauses, or whose extract has no
capturing group, is refused at the gate: presence agreeing with presence is the
false green itself.

What this layer does **not** decide: whether five years or three is reasonable
under section 27 of the Contract Act, or which ought to govern. Both are legal
conclusions. It establishes only that the instrument states two and does not say
which.

**A rung is not a clean bill of health.** The certification ladder measures what a
family has been *put through*; coherence measures what it *ships*. The NDA reaches
`FALSIFICATION_PASSED` precisely *because* this defect was found, and the defect
is still in the product — so `reportFamilyCertification` prints it beside the rung
and never inside it.

*Pinned by* `tests/requirementCoherence.test.mjs` (77 checks, six mutations
verified to fail it).

## 19. Evidence absent ≠ evidence false ≠ requirement inapplicable

Three distinctions that were one thing. A requirement, or a clause gate, can
become applicable for three reasons, and the system could express only two:

```
POSITION   the user told us                    (declared transaction fact)
FACT       the system derived it deterministically
EVIDENCE   something outside the conversation established it     <- was missing
```

A portfolio audit across all 45 families measured the blast radius. Of 1054
clause slots, 114 are conditional on anything at all, and **20 of 45 families
ship a document in which no clause is conditional**. Of the gates that exist:

| gate rests on | |
|---|---|
| a user answer | 77 |
| a deterministic fact | 17 |
| **nothing the system can produce** | **20** |

Those 20 uses come from **29 distinct propositions the knowledge base already
treats as legally consequential enough to gate a clause, with nothing able to
establish any of them** — `processes_personal_data` in five families,
`employer_headcount_ge_10`, `is_female_employee`, `lender_is_nbfc`,
`is_commercial_lease` and the rest. **Every one of those gates reads `== true`,
so an unestablished proposition omitted its clause silently.** A service that
processes personal data and a service that does not received the same document.

Derivability is **probed** per document type with variables empty and filled,
never read off a list — a hand-written alias table is what once reported sixteen
unreachable gates, all sixteen false. The first pass here said 37 ungoverned;
the probe corrected it to 20.

### The 29 are three populations, not one

Collapsing them would repeat the mistake the layer exists to correct:

- **POSITION** — the drafting party knows it and was never asked
  (`is_female_employee`, `is_senior_employee`, `is_fixed_term`,
  `employer_headcount_ge_10`, `is_commercial_lease`). The fix is a question.
- **FACT** — derivable from fields already collected (`long_term_lease` from the
  lease term, `is_cross_border` from the parties' countries). The fix is a
  derivation.
- **EVIDENCE** — the drafting party's say-so is not the natural authority, or the
  proposition is about a running system rather than about the deal. Only these
  are declared as propositions.

### Evidence is not a boolean

Seven states, each of which was a distinct false positive somewhere in this
codebase's history: `EVIDENCE_PRESENT`, `ABSENT`, `MISMATCHED`, `INADMISSIBLE`,
`AMBIGUOUS`, `STALE`, `CONFLICTING`. Applicability then yields `APPLIES`,
`DOES_NOT_APPLY`, `UNKNOWN` or `ESCALATED` — four values, because the third and
fourth are the point.

### An inference is a proposal and never an authority

`ai_inference` is declarable so that a record carrying it is refused *loudly*
rather than unseen, and it is refused twice: the admission gate will not let a
declaration list it, and `establish()` refuses it again at the point of use.
**Two defences, pinned separately** — a test that cannot tell them apart passes
with either one deleted. Without this the layer would move the defect rather than
fix it: *"no evidence"* would become *"the model guessed"*, which reports better
and is worse.

A proposition's own list is narrower still. `lender_is_nbfc` excludes
`operator_declaration`: whether a lender is an RBI-registered NBFC decides which
rules bind it, and a party's own statement about its regulatory status is exactly
the assertion that most needs a register behind it.

### The permanent regression

Not a privacy test. The proposition is `processes_personal_data`, one of the 29:

```
policy silent + service DOES process      -> ESCALATED
policy silent + service does NOT process  -> NOT_APPLICABLE
policy silent + nobody established it     -> APPLICABILITY_UNKNOWN
evidence about a different company        -> APPLICABILITY_UNKNOWN, EVIDENCE_MISMATCHED
```

Before this layer the first two were byte-identical. All four must stay distinct.

*Pinned by* `tests/evidencePropositions.test.mjs` (153 checks; the acceptance
corpus is the declared propositions themselves × four evidence cases, so a
proposition added tomorrow is tested tomorrow; six mutations verified to fail it).

**The corpus that justified this layer was miscounted.** Invariant 19 was written
on a measurement of 29 orphan propositions. There are 10, and the difference was
a swapped argument — see invariant 20. The MECHANISM stands: its states, its two
provenance defences and its acceptance corpus are self-contained and were never
computed from the audit. What does not stand is the empirical claim that 29
legally consequential propositions had no source. **No authored requirement
currently uses the EVIDENCE source**, and that ceiling is pinned rather than
closed by authoring one to make the number move.

## 20. A probe that measures the wrong thing is worse than no probe

Three times in one stretch of work a reachability probe reported that a clause
gate rested on nothing, and three times the probe was what was broken:

1. A hand-written alias table reported **sixteen** unreachable gates. All sixteen
   were reachable.
2. A probe invented `lender_type` values — `"Bank"`, `"NBFC"` — and found nothing,
   because the schema's declared option is `"Scheduled Bank"`.
3. `deriveGenerationControls(documentType, variables)` takes the **document type
   first**. Three audit scripts called it `(variables, documentType)`. Handed a
   string where it expects an object it returns almost nothing, so every gate
   resting on a derived flag read as resting on nothing.

The third produced this:

| | reported | actual |
|---|---|---|
| propositions gating a clause with no source | 29 | **10** |
| gates resting on a deterministic fact | 17 | **35** |
| gate uses that can never fire | 20 | **2** |
| requirements resting on nothing establishable | 2 | **0** |

`processes_personal_data`, `is_female_employee`, `employer_headcount_ge_10`,
`lender_is_regulated`, `lender_is_nbfc`, `is_cross_border`, `is_commercial_lease`
and `long_term_lease` are all derived, and every one was reported as an orphan.

**None of these failures was loud.** Each returned a plausible *smaller* number,
and a smaller number reads as a finding. The 29 was enough to justify building an
abstraction, migrating a live Master Service Agreement requirement onto a
different applicability source — which made every MSA report it permanently
undetermined — and writing a principle about protecting two "intake debt"
positions that were never in debt.

So the false measurement did not only cause wrong work. It caused
**correct-sounding principles about wrong work**, which are harder to retract
than code.

Three rules follow, and they are pinned separately from anything that uses them:

- **Probe fixtures come from the schema's own declared options**, never from
  values that seem plausible. `buildVariables` is the baseline's fixture builder;
  a probe that builds its own drifts from what the baseline measures.
- **The swapped call must stay visibly useless.** The test asserts the reversed
  call returns strictly less than the correct one, so the failure mode cannot
  become silent.
- **Flags once miscounted are named individually, not counted.** An aggregate is
  what made the error persuasive, and an aggregate cannot be checked by reading.

### The meta-invariant

**Measurement code is part of the evidence system.** An audit result is not
admissible because the application suite is green — the application was calling
the derivation correctly the whole time, and only the audit scripts were not, so
the suite could never have caught it. Audit functions are tested against
canonical application fixtures, and their invocation contracts are tested too.

The failure was not really an argument order. It was that **three scripts each
knew the contract independently**, so getting it wrong was something each could
do alone. Four structural consequences:

- **One adapter owns the contract.** `derivationAdapter.deriveControlsForDocument`
  is the only supported way for measurement code to ask what a document derives,
  and `reachableControlsFor` the only way to probe reachability. No audit script
  may import `deriveGenerationControls`; the test checks the **import**, not the
  text of a call — screening the source fired on these files' own prose
  explaining the bug, and then on a string literal quoting it.
- **The adapter refuses rather than answers.** A swapped call throws with the fix
  in the message. It used to return a small plausible object, and *a wrong
  measurement that looks like a finding is worse than a crash*.
- **Fixtures come from the schema's own declared options.** `buildVariables` is
  the baseline's builder; a probe that invents its own is a second source of
  truth that drifts silently.
- **The scripts must agree with each other.** They answer different questions
  over different populations and must still agree about the underlying facts.
  Two disagreed by three gates because one asked "is this field askable
  *anywhere*" while sanitisation filters to the document's **own** schema. Three
  gates reads as rounding, which is exactly how the previous wrong numbers
  survived being looked at.

Corrected populations, re-derived and listed **by name** — a count cannot be
checked by reading, and it was the count that made the error persuasive:

| | reported | actual |
|---|---|---|
| propositions gating a clause with no source | 29 | **14** (17 gate uses; 5 on clauses that ship) |
| gates resting on a deterministic fact | 17 | **58** |
| gates on a clause not in the library | — | **0** |
| requirements resting on nothing establishable | 2 | **0** |
| requirements using the EVIDENCE source | 1 | **0** |

That last row stays at zero on purpose. The mechanism is built and independently
tested and **nothing consumes it** — which is more honest than authoring a
contrived consumer to make the architecture look mature, and authoring one to
move a number is how the first error became load-bearing.

*Pinned by* `tests/derivationProbes.test.mjs` (23 checks, three mutations
verified to fail it) and `scripts/measurementIntegrity.mjs`, which carries every
superseded claim beside its correction, reason and action rather than letting it
quietly stop being mentioned.

## 21. A drafted obligation is not a discharged one

**Hypothesis rejected.** The Loan family was selected because "third-party
consent" appeared to be a dependency class no certified family exercised. The
matrix — seven cases, no implementation, nothing authored — rejected it:
`EXTERNAL_COHERENCE` already separates *an approval is required* from *the
approval was obtained*, and handles all six evidence states.

| | CONTENT | EXTERNAL_COHERENCE |
|---|---|---|
| obtained UNKNOWN | RESOLVED | UNVERIFIABLE |
| obtained YES | RESOLVED | RESOLVED |
| obtained NO (refused) | RESOLVED | CONTRADICTED |
| evidence silent | RESOLVED | AMBIGUOUS_EVIDENCE |
| evidence about another deal | RESOLVED | EVIDENCE_MISMATCHED |
| records disagree | RESOLVED | CONFLICTING_EVIDENCE |

**Six identical CONTENT findings are correct, not a defect.**
`LOAN_FEMA_ECB_001` says *"Drawdown shall not occur until all applicable
approvals and registrations are in place."* The instrument contains that promise
whether or not the Loan Registration Number was ever issued, and the content axis
answers *"does this document address it?"*, which has one answer. The danger is a
later change that makes the assessor cleverer and collapses the two truths, so a
document **promising to wait** for an approval reads as one whose approval **came
through**. Same shape as the tenancy: a clause providing for an act is not the
act.

*Pinned by* `tests/documentRequirements.test.mjs` — CONTENT `RESOLVED` beside
EXTERNAL `UNVERIFIABLE` on one document, and supplying the evidence moves only
the external axis. Two mutations verified to fail it.

### The boundary the probe did expose: authority of evidence

A record naming the right transaction, the right provision and the right value is
accepted **whoever produced it**, and this is uniform across every
external-coherence user in the product:

```
POA  donor capacity, from a registered medical practitioner  -> RESOLVED
POA  donor capacity, from the donee who benefits from it     -> RESOLVED
SHA  articles, from the Registrar's filed copy               -> RESOLVED
SHA  articles, from the company's own unfiled draft          -> RESOLVED
```

**Not a missing capability — a capability in one mechanism and absent from the
other.** `admissible_provenance` on an evidence proposition is exactly this
constraint, and `lender_is_nbfc` already refuses the lender's own say-so.

**Neither mechanism is a superset, so they must not be merged:**

```
external coherence   value comparison, no source constraint
propositions         source constraint, boolean state only
```

Both external requirements in the product compare a **named value**, not a
boolean. Routing them through propositions would turn *"the articles record
PERMITTED where this Agreement requires RESTRICTED"* into *"the proposition is
false"* — losing the sentence an advocate needs, and the reason
`AMBIGUOUS_EVIDENCE` and `CONTRADICTED` are different states at all. The smallest
reusable thing is the **source-admissibility check**, shared by both, not a
merged mechanism.

**And it is not obvious one declaration serves all three uses**, which is why no
field was added:

- **SHA / articles** — the concern is *identity and provenance of a copy*. The
  articles are what they are; nobody grants them.
- **POA / donor capacity** — the concern is *competence and interest*. Capacity
  attested by the donee is worth nothing whoever holds the paper.
- **Loan / LRN** — the concern is *power to grant*. Only the Reserve Bank,
  through an authorised dealer bank, can issue one at all.

Three different reasons a source might not count. A flag meaning three things is
how `risk_level` stopped meaning anything.

*Probed by* `scripts/probeLoanApproval.mjs` and
`scripts/probeEvidenceAuthority.mjs`. **No production implementation, no Loan
requirements authored, and the EVIDENCE consumer count is still zero.**

### Can today's representation say why a source counts? No — and the missing property is narrow

Nine fixtures across three families, only the SOURCE varying — same subject, same
provision, same value. Two encodings attempted with the existing mechanism:

**A. Put the source in `subject_binding`.** Works only where the expected source
is a field of *this transaction*. `company_cin` is one, and it already catches
another company's articles (`EVIDENCE_MISMATCHED`, with no change needed). "The
Registrar of Companies", "a registered medical practitioner" and "an authorised
dealer bank" are not transaction fields and never will be.

**B. Assess the source as a second requirement.** Expressible today, no mechanism
change — and it does not fix the defect:

```
                                        SUBSTANCE            SOURCE
the Registrar's filed copy              RESOLVED             RESOLVED
the company's own unfiled draft         RESOLVED             CONTRADICTED
another company's filed articles        EVIDENCE_MISMATCHED  EVIDENCE_MISMATCHED
the donee, who benefits                 RESOLVED             CONTRADICTED
the borrower                            RESOLVED             CONTRADICTED
an unrelated consultancy                RESOLVED             CONTRADICTED
```

7 of 7 bad sources are caught on the SOURCE axis; **6 of 7 remain RESOLVED on the
SUBSTANCE axis.** The substantive requirement goes on reporting
ESTABLISHED_POSITIVE about a record produced by the donee, or the borrower, or a
consultancy. Two findings side by side are not the same as one record being
refused, and a summary count reads the substance line.

So the missing property, stated precisely:

> **A source constraint must decide whether THAT RECORD counts at all, rather
> than standing beside it as an independent finding.**

Which is a statement about *where the check belongs*, not about adding a field —
and it does not license `admissible_provenance: true` on external coherence.

### What this probe did NOT establish, and why no field was added

All three constraints were expressed here as *"the record's own stated source
must equal a declared value"*. That is suspiciously easy, and it is probably the
probe flattening three different questions into one shape:

| dependency | why the source matters | what is being tested |
|---|---|---|
| SHA / articles | provenance + identity | is this the relevant constitutional instrument? |
| POA / capacity | competence + interest | can this source speak to the proposition, and does it benefit? |
| Loan / LRN | power to grant | is this body legally capable of issuing the thing? |

**And the record asserts its own source.** Nothing checks that assertion. A
mechanism that trusts evidence about where evidence came from has moved the
problem rather than solved it — so whether these three share one executable shape
must be settled before any field exists, and the reusable form, if there is one,
is likelier to be *typed predicates over the evidence source* than one boolean.

*Probed by* `scripts/probeSourceConstraint.mjs`. **Nothing authored, nothing
implemented.**

## 22. A claim of provenance is not provenance

The source-constraint probe stopped at the harder question and this one answers
it. Six records, same true proposition, same subject — only how provenance is
established varies:

```
                                              EXTERNAL_COHERENCE   EVIDENCE_PROPOSITION
A  the record merely claims its source        RESOLVED             EVIDENCE_PRESENT
B  claim + system metadata                    RESOLVED             EVIDENCE_PRESENT
C  independently retrieved from the authority RESOLVED             EVIDENCE_PRESENT
D  retrieved + bound to the transaction       RESOLVED             EVIDENCE_PRESENT
E  claims the register, arrived by email
   from the party whose status is in question RESOLVED             EVIDENCE_PRESENT
F  no provenance stated at all                RESOLVED             EVIDENCE_INADMISSIBLE
```

**`EXTERNAL_COHERENCE` reads `provisions` and nothing else.** How a record
arrived, whether anyone verified it, who handed it over — all invisible. It
cannot be fooled about provenance because it never asks.

**`EVIDENCE_PROPOSITIONS` asks, and believes the answer.** This is a finding
about a mechanism authored in this codebase and defended in its own comments:
`admissible_provenance` checks a **claim about provenance**, not provenance. A
record that arrived as an email attachment from the very party whose status is in
question is accepted on identical terms to one retrieved from the register,
because the only thing separating them is a field the mechanism does not read.

So the two defences are not what they appeared:

- **The absolute rule** — an inference is never an authority — *holds*. It
  concerns a provenance value the system itself would have to assert.
- **The declaration's own list** — `lender_is_nbfc` excluding
  `operator_declaration` — is only as good as the record's honesty about which of
  those it is.

`tests/evidencePropositions.test.mjs` asserts that a record labelled
`ai_inference` is refused. It does not assert — and cannot — that a record
labelled `public_register` came from one. **The test was true and the security
property claimed around it was broader than the test.** The limit is now itself a
test, so it travels with the mechanism.

### The missing primitive is not a source predicate

Adding a source constraint to `EXTERNAL_COHERENCE` would give it the same
property: a check on what a record says about itself. That is worth having — it
stops honest mislabelling and makes a requirement state who *ought* to have
produced the evidence — but it must never be described as establishing authority,
and no certification state may read as though it does.

What the evidence model does not distinguish at all:

```
SELF-ASSERTED     the record says where it came from
SYSTEM-OBSERVED   the system recorded where it got it
```

Only the second can support a claim about authority. Both mechanisms take the
record's word — one by reading a content field, the other a metadata field,
neither by knowing anything. **That distinction, not a predicate, is the
primitive that is missing**, and it is not added here.

*Probed by* `scripts/probeProvenanceClaim.mjs`; the limit pinned by
`tests/evidencePropositions.test.mjs`. **Nothing implemented.**

## 23. A question that changes nothing must not be asked as if it did

Intake asks *"Which side are you on?"* and tells the user the answer means the
questions and protections *"point at the right side of the table"*. Four
families, each probed with its own declared role pair:

| family | sides | result |
|---|---|---|
| MASTER_SERVICE_AGREEMENT | Client / Service Provider | `PERSPECTIVE_DECORATIVE` |
| NDA | Disclosing / Receiving Party | `PERSPECTIVE_DECORATIVE` |
| LOAN_AGREEMENT | Lender / Borrower | `PERSPECTIVE_DECORATIVE` |
| EMPLOYMENT_CONTRACT | Employer / Employee | `PERSPECTIVE_DECORATIVE` |

The field survives sanitisation and reaches generation — it is ignored, not
dropped, and those need different fixes. No position, treatment, clause or word
moves. Each draft is also **identical to one where no side was given at all**.

The MSA first read as `PERSPECTIVE_EFFECTIVE` and was not. The only difference
was a `{counterparty}` token inside one unanswered question's wording — *"What
will the Service Provider have access to"* versus *"What will the Client have
access to"*. The counterparty's **name** flipped; the position did not. A
comparison that cannot tell a label from a drafting position would certify the
rename as perspective working, so positions are compared semantically: flag,
outcome, provenance, disclosure kind.

**The document is not wrong. The product claim is.** This is the assumed-side
invariant in a new place: an instrument must never look fully fact-specific while
resting on a side nobody acted on — and here nobody acted on it although the user
did confirm it.

**What this does NOT say:** that opposing sides ought to produce different
documents. Many provisions should be identical whoever asked, and forcing
divergence would invent a legal notion of "correct perspective" this layer is not
entitled to. The property is:

> If `drafting_for` is presented as a meaningful drafting input, its effect must
> be traceable to an explicit position or treatment — or the system must not
> present it as having affected the draft.

Two honest fixes, and the choice is a product decision rather than an
architectural one: route the side into authored positions, or stop presenting it
as a drafting input.

**No perspective architecture was built.** Review viewpoints (lawyer, compliance,
business) are projections over findings that already exist and are already
separated by axis; building them as schema would make "viewpoint" mean both
*whose interests* and *who is reading*, which is how `risk_level` stopped meaning
anything. Third parties are an actor/relationship dimension, not a way of looking
at a document — the Loan probe established that.

*Pinned by* `tests/draftingSide.test.mjs`, which records the four families as a
ceiling by name: making the side effective fails there and says to update it, and
making it effective through hidden logic rather than a position fails
differently.

## 24. No free-text field may be the authoritative source of a legal position

The rule was *absence of information must never become an affirmative
contractual position*. This is the stronger violation: an explicit **negative**
becoming one.

Found certifying the Loan family, before a single requirement was authored.
`security_collateral` was a **required** free-text box and `is_secured` was
inferred from whether it held a "meaningful value" — not empty, and not one of
six bare tokens. So:

```
security_collateral: "None — this is an unsecured loan"
    -> is_secured = true
    -> LOAN_SECURITY_001 ships, describing collateral that does not exist
    -> lender_type "Scheduled Bank" -> LOAN_SARFAESI_ENFORCEMENT_001 ships,
       asserting the lender may take possession of the secured assets
       without the intervention of any court
```

**The field's own help text said: write "Unsecured" if there is no security.**
`"Unsecured"` was one of the nine phrasings that produced a *secured* loan. The
product instructed the user into the trap.

It is not a Loan defect. **Twelve free-text fields across the portfolio were read
as booleans**, four of them required somewhere.

### The repair is to ask, not to widen

A wider negative-detection pattern has a narrower gap, not no gap. The chain was:

```
free text -> meaningful-value heuristic -> hidden boolean -> clause
```

and it is now:

```
declared answer -> position -> treatment -> clause
```

`loan_is_secured` is a Yes/No question. Its options are exactly `"Yes"` and
`"No"` because `normalizeBooleanLike` matches a closed token list and a prettier
`"Yes — secured"` normalises to `null` — which would have left every loan UNKNOWN
and silently dropped the security clause from secured ones, the opposite defect,
just as quietly. `security_collateral` now describes and establishes nothing;
unanswered stays UNKNOWN and selects neither position.

**Scoped to one field on purpose.** The other eleven look alike and may not mean
alike — `deliverables` may be presence of a substantive description,
`ip_ownership` may encode a commercial position, `warranty_period` is a value
whose absence means something different again. The common invariant does not
imply a common replacement. They stay a named ceiling.

*Pinned by* `tests/negativeAsPosition.test.mjs` — a guarantee for the repaired
field, a ceiling for the eleven, with the surviving phrasings named rather than
counted.

## 25. A clause dependency must not reinstate what a position excluded

Immediately after the repair above, the assembler did the right thing — answer
"No" and the security clause is not selected — and the document still shipped
one:

```
LOAN_DEFAULT_001.required_with = [..., "LOAN_SECURITY_001"]
    -> dependencyResolver re-injects it after the gate excluded it
```

Two paths reach a clause and the user's position governs only one. A clause-level
assertion that a default provision "needs" a security provision silently outranks
a borrower saying the loan is unsecured:

```
position -> treatment -> clause     what the architecture promises
clause   -> clause                  what happens here
```

**A static reading of `required_with` found eight. Runtime found two** —
`LOAN_AGREEMENT / LOAN_SECURITY_001` and
`SOFTWARE_DEVELOPMENT_AGREEMENT / CORE_INDEMNITY_001`. The other six were clauses
listed as conditional *and* unconditional in the same blueprint, so the gate
never mattered, or dependencies that do not fire. Static edges are potential
overrides, not actual ones, and reporting eight would have been the same
overcount as one boilerplate clause read as twenty-four families.

**Not repaired, because the right repair is a real question.**
`LOAN_DEFAULT_001` may refer to security in its own text, in which case forcing
the security clause in is the wrong fix and the right one is an unsecured variant
of the default clause. Whether a dependency or a position wins is a decision to
take deliberately.

*Pinned by* `tests/positionOverride.test.mjs`, which records the two overridden
gates and two respected ones as a control — without the control, a bug omitting
every conditional clause would satisfy the first assertions.

## 26. One fact, one resolution — generation and assessment must read the same one

The system has two fact planes:

```
clause selection   deriveGenerationControls(documentType, variables)
assessment         resolution.positions   (the fact-question layer)
```

`is_secured` is a derived control. It never appears in `resolution.positions`,
so a requirement conditioned on it can never become applicable. The document
ships `LOAN_SECURITY_001` because selection read the flag as true, and the report
says nobody knows whether security applies.

**Nine of nine position-conditioned requirements in the product are affected**,
across Loan, Employment and the MSA, and all nine become determinate the moment
assessment is handed the fact generation already used. Every one of those facts
has a source — declared intake field, derivation, or admitted proposition. None
of it is legal uncertainty.

So these two must never be reported as the same thing:

```
LEGAL / WORLD UNKNOWN   !=   THE ASSESSOR WAS NOT GIVEN THE FACT
```

A reader of an assessment takes `APPLICABILITY_UNKNOWN` for genuine uncertainty
while the generator has already committed to a position. That is split-brain
reasoning, and it has been quietly reinterpreting earlier findings: the
employment family's POSH and maternity requirements have read as honest
uncertainty for some time and are this.

### The plumbing fix is not safe on its own

Handing the assessor the derived controls moves
`EMPLOYMENT_CONTRACT/POSH_DUTY_REFLECTED` from `APPLICABILITY_UNKNOWN` to
`NOT_APPLICABLE` on `employer_headcount_ge_10 = false`. And the requirement's own
identity_test says:

> *"...silent on a duty section 19 of the POSH Act, 2013 imposes **regardless** —
> leaving the employee unaware of the Internal Committee that section 4 requires
> the employer to have constituted."*

while its applicability is `{ position: "employer_headcount_ge_10", value: true }`.

**The requirement contradicts itself**, conflating two duties with different
triggers, and the fact-source blindness has been masking it. The wiring fix would
report the requirement inapplicable for a workplace its own text says the duty
covers — a plumbing change deleting a legal finding. Which way to split it is an
advocate's call.

*Measured by* `scripts/factSourceInventory.mjs`; *pinned by*
`tests/applicabilityFactSource.test.mjs`. **Not repaired.** The repair must feed
assessment from one resolution path rather than copying flags, and every
transition must be checked the way the POSH one was.

## 27. A probe must not be able to shadow production knowledge

Requirements are keyed by `document_type` and the last file read wins. **Five
times** a probe wrote a temporary fixture under a real family's type, silently
replacing that family's authored requirements for the duration of the run — so
the test then measured its own fixture and reported the result as a property of
the product. The worst stayed invisible for several turns because the family it
shadowed had no requirements yet, and surfaced only when the family acquired
some, as a `TypeError` rather than a wrong answer. That was luck.

**Enforced at the loader, not by convention.** A `__*.json` requirements file
must declare a `__*` document type, or loading throws. "Remember to use a probe
type" is the kind of rule that holds until someone is in a hurry.

A first version of the guard scanned source text for the convention and produced
two false positives of its own — matching a `document_type:` two hundred lines
from any probe, and unable to see a payload built in a variable before being
written. A screen over source was the wrong instrument for a rule about what the
loader accepts.

The guard also blocked one **legitimate** use: a probe that needed
`certify()` to iterate its type, which only walks the registry. `certify()` now
takes an optional `families` list, so a probe can name what it authored instead
of borrowing a real family's identity to be seen.

*Pinned by* `tests/probeIsolation.test.mjs`, which writes a shadowing fixture and
asserts the loader refuses it, then writes a properly named one and asserts every
real family survives.

## 28. Authoring coherence precedes fact parity

Invariant 26 established that assessment cannot see facts generation already has,
and that nine conditional requirements are permanently `APPLICABILITY_UNKNOWN`
because of it. The repair is obvious and **must not be applied yet**.

Read against their gates, **five of the nine are gated on a boundary their own
text does not describe.** Feeding them the missing facts would turn an honest
`APPLICABILITY_UNKNOWN` into a confident wrong answer — the plumbing laundering
an authoring defect into a green result.

```
conditional requirement
        ↓
authoring coherence      ← this first
        ↓
fact applicability
        ↓
assessment
```

**A keyword screen found one; reading them found five.** Four of the five use no
"regardless"-type language at all. Another undercount by an unscoped screen, and
the reason the cases are held by name rather than by pattern.

### Four shapes, not one defect

1. **The gate names a different boundary from the statement** —
   `MATERNITY_ENTITLEMENT`: the statement's condition is establishment coverage,
   the gate is the employee's sex.
2. **The requirement argues from a gap; the gate selects the opposite
   population** — `WORK_PRODUCT_OWNERSHIP`: the s.17(c) gap is widest where
   nothing has been assigned, and the gate fires only where assignment exists.
   Dangerous because it reads as careful reasoning while its predicate defeats
   its purpose.
3. **A drafting choice stands in for a substantive condition** —
   `PERSONNEL_CONTINUITY`: `include_sla` as a proxy for key-person dependence.
   The document-feature-as-legal-condition shortcut, surviving inside a
   requirement.
4. **A requirement covers one branch of a clause's authored invalidity** —
   `ENFORCEMENT_MATCHES_THE_LOAN`, authored here, models one of the two
   conditions its guarded clause declares. The same shape of defect as the
   blueprint gate it was written to catch.

From the fourth:

> **A requirement intended to certify a clause boundary may not represent only
> one branch of that clause's authored invalidity condition unless the omission
> is deliberate and separately covered.**

### Retire or replace, never delete

Each case carries its gate, the wording the finding rests on, the question for an
advocate, and a `resolution` that is null until one is taken. An unresolved case
must **still exhibit its conflict**, so rewriting prose until the finding is
unquotable fails rather than passes. A resolved one must say what was decided,
what the boundary now is and who decided — and must show a change in the
knowledge base, because a resolution leaving gate and wording untouched has
decided nothing.

**The conditional population is closed.** A new conditional requirement with no
verdict fails the suite: an unread gate is precisely how a wrong boundary becomes
a confident answer.

*Pinned by* `tests/authoringCoherence.test.mjs` (20 checks; three evasions —
rewriting the prose, claiming a resolution that changed nothing, and adding an
unclassified conditional — all verified to fail it). **Five advocate decisions,
not five engineering fixes.**
---

# Part II — Knowledge admission invariants

*What every new legal artifact must satisfy before the loader will admit it.
Structural validity only — see the distinction above.*


## 13. Fact admission

**"A fact exists" and "a fact has legal significance" are separate claims,** and
the registry must not let the first pass for the second.

A checkbox reading `is_female_employee` is not legal knowledge. The legally
meaningful proposition is whatever statutory rule makes that fact relevant,
together with its scope and its conditions. Three things stay apart:

```
FACT       what is true of the engagement
TREATMENT  what legal consequence follows, and on whose authority
CLAUSE     what the deterministic engine then selects
```

Keeping them apart is what stops the fact registry becoming another place legal
reasoning gets hardcoded.

**The gate.** `backend/services/factRegistry.js` refuses any source whose facts
or treatments have not been through the chain. A fact must carry a
`legal_proposition` (what turns on it, not merely what it asks), `scope`,
`jurisdiction`, `unknown_behaviour` — *what happens when nobody answers, which is
the state most engagements are actually in* — a `review_status`, and at least two
options that establish something. A treatment must take a position, state a
`basis` an advocate can read, carry a `review_status`, and name an `authority`:
either a list of `{act, section}` or the literal string `"commercial"` where the
consequence is a drafting choice rather than a statutory one. **Inventing a
statute for a commercial preference is worse than admitting it is one.**

One further refusal, and the one most easily overlooked: a fact whose treatments
respond to only a single value is rejected. Answering it the other way would
change nothing, which makes an explicit answer indistinguishable from silence and
quietly breaks invariant 2.

*Pinned by* `tests/factAdmission.test.mjs`, which asserts the production registry
clears the gate **and** that the gate genuinely refuses — three unadmissible
artifacts written as real files into the contributed directory, each rejected for
its own stated reason. A gate that only works on hand-built objects is not the
gate the loader uses.

### Growing the registry

The clustering evidence drives it, not the family count. For each unresolved
position the question is: **what legal position cannot be represented by the
existing semantic vocabulary?**

| If the answer is | Then |
| --- | --- |
| genuinely new | add a knowledge artifact, through the gate |
| another spelling of an existing fact | add an alias to the treatment |
| a drafting choice | model it as a treatment or a declared default |
| outside the reviewed vocabulary | surface it — `ESCALATED`, not a guess |

That is how 11/11 stays 11/11 rather than becoming 11/11 plus a thousand special
cases.

## Adding to the fact registry

Do not add a fact because it is common. Add it when its presence or absence
creates a materially different treatment that **no existing fact can carry**.
Otherwise the registry becomes a second `generationControls.js` with better
manners.

`scripts/clusterOpenMechanisms.mjs` supplies the evidence: it reports, across all
document families, which mechanisms are open, which are asked about, and which no
fact can resolve. Leverage is the number of families a missing circumstance
blocks — not the number of mechanisms it touches in one.

Its first run found five variable names for one legal question —
`involves_personal_data`, `processes_personal_data`, and three family-specific
spellings — nineteen families asking whether the DPDP Act, 2023 applies through
variables that could not reach one another. The right answer was one fact with
five aliases, not five facts. Registry coverage went from 29% to 40% of open
positions with no new question authored and no new concept invented.

---


---

# Part III — Current-state limitations

**Everything in this part is debt, not design.** None of it is an architectural
requirement, and none of it should be preserved for its own sake. Each entry says
what is unfinished and what finishing it would mean.

## L1. Forty families are still defined in JavaScript

The architecture is proven — a genuinely new family needs no code (Part I, §12).
The existing forty have not been migrated and still live in
`shared/documentRegistry.js`, `backend/config/documentConfig.js` and
`backend/config/variableConfig.js`.

Migration is mechanical and the baseline is the safety net, one family at a time:

```
existing JS family -> extract definition -> validate -> move to registry
                   -> prove identical baseline -> delete legacy definition
                   -> canary still green
```

## L2. No clause in the library has advocate sign-off

294 clauses: 152 marked awaiting review, 142 unmarked, **0 reviewed**. The
ceiling is pinned in `tests/clauseProvenance.test.mjs` and raising it requires
writing down the reason.

`LEGALAID_REQUIRE_REVIEWED_CLAUSES=1` makes the bootstrap refuse them, which is
the setting a production deployment should eventually run with.

## L3. 68 of 85 Acts are unverified

The statutory citations throughout the clause library and the treatments table
were authored against sources that have not been checked against the current text
of the Act. Structural admission (Part II) does not check them either — it checks
that an authority is *stated*, not that it is *right*.

## L4. Every draft is the deterministic floor

Both the Gemini and Groq keys return 403, so the AI wording layer has never run
against any of this. That is currently a healthy state: **the deterministic floor
is the controlled reference implementation.**

When a key works, the wording layer changes expression and nothing else. The test
is already implied by the existing guardrails:

```
deterministic seed -> AI wording -> merge
    -> same clause identity
    -> same applicability
    -> same ordering
    -> same legal coverage
```

The AI improves expression. It does not decide law. Until then, do not weaken any
Part I invariant to accommodate a wording layer that has not run.

## L5. Materiality is declared on four clauses and inferred for ~290

The rest inherit materiality from their ordering category, which was assigned to
sequence a document rather than to describe what a provision does. The `materiality`
field exists on the clause record; it has been authored four times.

## L6. The MSA carries 45 clauses and none of them is reviewed

A client-supplied Master Service Agreement checklist of seventeen headings was
measured against what `msa.blueprint.json` actually emitted. Four were already
served, three existed in the library but were wired to no blueprint, and seven
were absent entirely. All seventeen are now served: **31 clauses → 45**.

**"100% heading coverage" is not "the MSA is legally complete."** It means the
mechanisms identified in that source are represented. It says nothing about
whether the 45 clauses are sufficient, correctly drafted, commercially
appropriate, or applicable to any particular engagement — the same
structural/legal boundary this document draws for fact admission.

Every extracted clause carries `source_provenance` naming the heading it came
from and recording that the source was **not** copied. That source mixed three
kinds of material a reviewer needs to know about:

- **US regulatory provisions** — HIPAA, the False Claims Act, 42 U.S.C. § 1320a-7a,
  the Red Flag Rules. These cannot apply to an Indian agreement and none of them
  entered the library.
- **India Post Payments Bank provisions** under the RBI outsourcing regime — real
  Indian law, but a much heavier regime than a generic MSA should carry. Held back
  as a variant rather than made generic.
- **Unresolved `*` placeholders in economically material terms**, notably the
  termination-for-convenience fee formula. Those were left visibly incomplete.
  `SERVICE_TERMINATION_CONVENIENCE_001` pays for work satisfactorily rendered plus
  non-cancellable costs — it does not invent the source's missing numbers, and a
  reviewer should confirm that is the right commercial position rather than assume
  a formula was considered and rejected.

Two clauses warrant reading first. `CORE_INDEMNITY_PROCEDURE_001` exists because
`CORE_INDEMNITY_001` grants an indemnity and says nothing about how a claim is
run; section 125 of the Indian Contract Act, 1872 makes recovery conditional on
the indemnity-holder's prudence and on not contravening the indemnifier's orders,
so the machinery is what lets those conditions be satisfied. The two are kept as
separate clauses because they are separate machinery that happens to operate
together. `CORE_RESIDUAL_KNOWLEDGE_001` is the provision most commonly
over-drafted in a services agreement: too wide and it hollows out the
confidentiality obligation beside it, too narrow and section 27 makes that
obligation itself a restraint.

## L7. Eleven clauses rest on a statutory citation nobody has verified

A client review asked one line — *"Review the Section 43A IT Act reference"* — and
it turned out to reach **eleven clauses** across the NDA, employment, IP, privacy
and core confidentiality families. Section 44(3) of the DPDP Act, 2023 omits
section 43A of the IT Act, 2000, but the omission depends on commencement and the
status of the SPDI Rules, 2011 alongside it is not settled between the sources
consulted. Two further clauses cite the IT (Intermediary Guidelines) Rules, 2021,
which may not apply to the party adopting them at all.

Thirteen clauses carry a `verification_flags` entry: **eleven** for the section
43A question and **two** for the Intermediary Rules. Those are different
populations and are counted apart — see invariant 17. Both are recorded on every
affected clause rather than resolved by editing the citations. **Changing a statutory reference without an
advocate would be the system asserting law it cannot verify** — the same boundary
as structural admission never standing for legal review.

A twelfth apparent hit was a false positive: `143A` of the Negotiable Instruments
Act matching as `43A`. The same token-boundary class as the money regex that once
read `parent_name` as a rent field. The count reported is 11, not 12.
