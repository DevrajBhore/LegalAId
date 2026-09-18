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

> **REPAIRED in Phase B.** Resolution now happens once, in
> `prepareGenerationInput`, upstream of the derivation and of clause selection,
> and is carried to assessment rather than recomputed. Guarded by
> `tests/factSourceParity.test.mjs` (four axes, seven mutations) and
> `tests/applicabilityFactSource.test.mjs` (the original nine, now determinate).
> See `docs/audit/PHASE_B_CANONICAL_FACTS.md`. The record of the defect below is
> kept because the repair is only legible against it.


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


## 29. A fact has one canonical value before any consumer sees it

Normalising in each consumer is not one value. It is several values that are
currently equal.

`key_person_dependency` is a select whose options are "Yes" and "No". Clause
selection received `"Yes"`; assessment received `true`. **Both were right**,
because `evaluateConditionalExpression` and `canonicalFacts` each call
`positionOf`. Two call sites of the same function is not one value — it is an
agreement that survives only as long as nobody writes a third consumer, a gate
against the raw cell, or a normaliser that handles `"Y"` differently. The defect
this whole phase exists to remove is exactly that kind of agreement, one
refactor later.

So the canonical value is resolved **before** the derivation runs and overlaid
onto the variables everything downstream reads. Generation now carries
`key_person_dependency: true`, a boolean, and there is nothing left to normalise
downstream of the resolver.

The same rule decides classification, not only value. **A fact's `kind` is
declared, and the declaration is authoritative.** A `DECLARED` fact reads the
intake field named in `established_by` and never passes through
`deriveGenerationControls`; a `DERIVED` fact does, and stays derived after it
crosses into assessment even where the value is identical to a declared one and
the field behind it was answered directly. Letting the runtime decide which it
was — by observing what the generation pipeline happened to produce — moves the
two-fact-plane problem into the resolver meant to end it.

## 30. Every answer a question offers must have a document behind it

`loan_is_secured` offers "Yes" and "No". `security_collateral` was declared
`required: false` in `variableConfig` and listed in
`DOCUMENT_CONFIG.requiredFields`, and `buildFieldDefinition` resolves that
disagreement as `inRequiredFields || definition.required` — either source makes a
field required. So the state

```
loan_is_secured = No,  security_collateral = (blank)
```

was **rejected**. The product asked a question, offered an answer, and refused to
produce the document that answer describes. The only route to an unsecured loan
was to write collateral text into a field whose own description says nothing
written there can make a loan secured — the intake asserting security while the
agreement denied it.

This is not a validation annoyance. It is a **state-space contradiction**: a
declared fact claimed to represent a state the application could not represent.
Three test fixtures had independently baked the contradictory state in as their
only way to express an unsecured loan, which is how load-bearing it had become.

`required` is a boolean and cannot say *when*, and that absence is what let the
two declarations disagree. The schema now says it: `requiredWhenShown`, paired
with the `showIf` that already names the condition, enforced in
`variableValidator` the way `liability_cap_amount` is.

**The check to run on any conditional field: for each answer the question
offers, does a valid document exist?** Not "is the validation rule reasonable" —
a rule can be individually reasonable and still make a declared state
unreachable.

## 31. Static reachability predicts; runtime decides

A static inventory of clause dependencies found **12** edges where an
unconditionally-included clause names a gated clause in `required_with` or
`depends_on` — 46 across the portfolio before filtering to same-blueprint
same-document pairs. Three looked substantively serious.

At runtime, **one** fires. `EMP_CONFIDENTIALITY_001 -> EMP_NON_COMPETE_001` never
fires because that confidentiality clause is not in the employment document at
all; `CORP_TAG_ALONG_001 -> CORP_DRAG_ALONG_001` never fires because the target is
suppressed elsewhere. Repairing all three "confirmed" defects would have changed
two things that were not happening, and the commit would have claimed three fixes.

The inventory is still worth having — it is the architectural shape, and it says
where the next such defect can appear. It is not a finding. **A parity or
correctness claim is made against runtime behaviour; a static sweep proposes
candidates for it.**

An earlier version of the same sweep matched `invalid_if` truthiness and reported
192 edges. `invalid_if` is prose carried on 250 of 315 clauses for advocate
review. The filter matched almost everything, which is the same shape as the
`legal_basis` deadline classifier that called all 15 windows statutory, and the
boilerplate stamp clause that made "formal act" read as 24 families.


## 32. A declined protection ROLE must stay empty, whatever the clause is called

The obvious invariant — *a declined clause id must not appear* — is too weak, and
the loophole was live in production. A user declining `CORE_FORCE_MAJEURE_001`
received `CORE_FORCE_MAJEURE_FALLBACK_001`: a different identifier, the same
substantive protection, every id-for-id assertion satisfied, the decline
defeated.

> A declined protection role must not be satisfied by ANY clause unless an
> authored substitution explicitly permits it.

Six independent stages could reintroduce an excluded clause, and each was found
only when the previous repair failed to hold:

1. the dependency resolver, via `required_with`
2. `documentHardening`'s own baseline clause set
3. that module's missing-clause reporting, which then charged the document for
   the absence it had just stopped curing
4. the general-provisions constraints, reporting a declined default as missing
5. the protection injector, substituting a role-equivalent under another id
6. blueprint gating — four floor clauses gated `== true` in 33 places, so silence
   removed them, invisible while stage 2 put them back

A role-level assertion would have caught all six at once. An id-level one caught
them one at a time, over four rounds. Pinned by
`tests/declinedProtections.test.mjs`, which asserts both directions: declined
roles empty AND accepted roles occupied, because a bug dropping every conditional
clause would satisfy the first half perfectly.

## 33. A fixture must say which situation it represents

`variablesFor` answered every select with `options[0]`. For the optional
protections `options[0]` is `"No"`, so one fixture played two incompatible roles:
the health tests asked whether **a well-filled document** carries its general
provisions while the fixture was quietly declining every one of them.

Invisible until applicability became load-bearing. Before that the hardening
baseline reinstated whatever the fixture declined, so the answer changed nothing
and the premise could not be caught being wrong.

Two profiles now, named: `MINIMAL_DECLINED` and `WELL_FILLED`. They differ in
exactly one dimension — optional `include_*` drafting choices — and nothing else.
A first attempt keyed on shape alone (any optional yes/no select) also flipped
`addressee_is_government`, `involves_source_code` and `company_has_ip_assets`.
Those are facts about the world: answering them "Yes" does not make a document
better filled in, it makes it **a different document**, and the health tests would
then have been comparing two unlike things and calling the difference
completeness.

**`options[0]` must never carry meaning.** A fixture's intent is declared, not
inferred from option order.

## 34. Offering a question the knowledge cannot honour is a defect in the question

`include_entire_agreement` was asked on ESOP grant letters and promissory notes.
Both are named in the general-provisions constraint's `excludes_doc_types` and
both carry their own hardening baseline that omits the clause — two authored
artifacts agreeing the clause does not belong. Answering "Yes" changed nothing.

The repair is to withdraw the question, not to honour it: honouring it would put
a clause into two families whose own knowledge says it does not belong, on the
strength of an intake field nobody scoped to them.

This is the mirror of invariant 30. There, a question offered an answer the
product could not produce a document for. Here, a question offered an answer the
knowledge would not act on. Both are the same failure — **the intake and the
knowledge disagreeing about what is decidable** — and both are invisible while
some later stage quietly overrides the answer either way.


## 35. A gate must read a control some answer can move

`CORE_INSURANCE_001` is offered in Distribution and MSA behind
`include_insurance == true`. `include_insurance` is `null` for both families and
no intake answer moves it. The clause is authored, cited, reviewed, dependency-
clean and **unreachable**: no user can obtain it.

The mirror is commoner and worse. `include_governance_protections` is `true` for
MSA and Distribution whatever the user answers, so `CORE_GOVERNANCE_PROTECTIONS_001`
and `MSA_GOVERNANCE_BODY_001` always ship. The blueprint reads as a choice, the
document is a constant, and **no artifact is wrong** — the clause is fine, the
gate is fine, the matrix is consistent, the baseline is stable. Seven such gates
exist across three families.

This is invisible to every earlier check by construction. The clause baseline
sees no drift because nothing drifts. Falsification sees no false green because
the requirement really is satisfied. The differential (D4.2) counts the clause as
unconditional but cannot say whether that is by design. Only perturbing every
intake answer and watching the control reveals it.

**A gate on a constant is not a gate; it is decoration with the shape of a
choice.** The repair is never "add another gate": either wire the control to a
question, or delete the gate because the family always needs the clause. Which
one is an authoring decision, and `tests/gateReachability.test.mjs` refuses to
let it go unmade rather than pretending to make it.

## 36. "Unconditional" is not a defect count until someone says what the core is

80/91/86% of NDA, Distribution and MSA clauses ship regardless of any material
answer. That number is not 80% defective. Governing law, definitions, notices and
severability legitimately do not move because a deal involves personal data.

The defect is that **nobody has written down which clauses belong in the fixed
core**, so there is no way to tell a legitimately universal clause from one whose
gate was never authored. Classifying the 98 against the evidence the repository
already holds, 83 are UNRESOLVED — not because the measurement is weak but
because the repository is silent about them.

The two halves of that silence need different work and must not be summed: 17
have a concrete candidate defeating fact named somewhere in the portfolio and
await a decision for this family; 66 have nothing at all.

**A gate authored in another family is a question, not an answer.** That
`VENDOR_AGREEMENT` makes confidentiality optional does not mean a distribution
agreement should. Copying it across would repeat the invariant-34 error in the
opposite direction, adding clauses to families whose own knowledge excludes them.

## 37. Nothing that carries the law reaches the document

Seventeen facts exist across two planes. Three reach the document. Ten carry
statutory authority. **Zero do both.**

`semantic_facts.json` holds 7 facts with declared/derived provenance, canonical
resolution and requirement applicability — and no statute, no section, no
`attaches` list. `knowledge-base/concepts` holds 10 concepts with 45 section-deep
citations, role/event dimensions, detection with provenance, drafted confirmation
questions and open-world `unresolved_behaviour` — and no resolver, so nothing
reads them at runtime.

Neither plane is wrong. Both are sound. They are not connected to each other, and
that disconnection is the exact line where the system stops reasoning legally and
starts selecting from a template. `key_person_dependency` stopping at
REQUIREMENT_MOVES is one symptom; the general case is that legal authority and
document effect live in different places and have never been joined.

**A concept cannot be credited with an effect it did not cause.** Perturb
`involves_personal_data` and a clause appears — because a human wrote
`include_if: involves_personal_data == true` into a blueprint, not because
`PERSONAL_DATA_PROCESSING` resolved, and not through its `attaches` list. Scoring
that as the concept reaching the document would make the concept layer look
connected on the one axis where it is severed. The field's independent effect is
recorded in its own column, and it is the useful one: where a field already moves
the document a resolver adds traceable REASONS, and where it does not a resolver
adds reach the system has never had.

## 38. A blocked generation is not a measurement

The first run of the D4.4 trace reported `is_secured` — the whole subject of Phase
B — as reaching nothing. It reaches the document.

The WELL_FILLED loan fixture describes collateral. Answering `loan_is_secured`
"No" makes the pair impossible, and the system correctly BLOCKED rather than
drafting an unsecured loan that recites security. The probe read the block as a
fact that fails to travel. **The system was right and the perturbation was
invalid** — a single-field flip built a world that cannot exist.

The repair is not to suppress the guard or to hand-maintain a dependency map. The
validator's own message names the offending field; clear what the system
identified, retry once, and report the reason if it is still blocked. Clearing
what the system named is not guessing. Inventing the map would be.

This is the eighth occurrence of one failure shape — **a filter matching more than
it meant** — and the first committed twice in a single session, in a probe whose
own docstring warned against it. Every occurrence produced a number that was
larger, or a verdict that was worse, than the truth.

## 39. Certification axes must not be allowed to stand in for each other

Ten families earned FALSIFICATION_PASSED under a claim that was true when made:
*this family survived the falsification corpus applicable to the current
implementation*. Folding legal-knowledge validation into that rung would have
converted it into a claim nobody has evidence for — *the legal reasoning
underneath this family is validated* — without anyone editing a single
falsification record. Retroactive redefinition is the quietest way to
manufacture an assurance.

So the ladder is split into three independent axes:
`LEGAL_KNOWLEDGE_STATUS`, `GENERATION_STATUS`, `HUMAN_STATUS`. Full certification
requires all three plus specificity evidence; no one of them implies another.

**Specificity is tracked beside the generation ladder, not inside it.** The
obvious placement is a rung between coverage and falsification, and D4.2 is the
proof it is wrong: requirement outcomes moved ZERO between opposite worlds for
NDA and Distribution, so those families pass falsification and fail specificity.
Ordering one beneath the other asserts a prerequisite that does not exist — and
would demote the ten families the split exists to protect.

## 40. A concept must cause the clause, not merely coincide with it

`PERSONAL_DATA_PROCESSING` is the first fact in the system to carry statutory
authority AND reach the document. Nineteen blueprints asked one legal question
under five different gate names — `involves_personal_data`,
`processes_personal_data`, and the `company_`/`firm_`/`jv_` variants. All
nineteen now read `concept:PERSONAL_DATA_PROCESSING`, and the clause states why
it is there: *Personal data is processed under this arrangement. Established
declared from field:involves_personal_data. Authority: DPDP Act 2023 ss.8(2),
8(5), 8(6), 8(7).*

**Zero baseline drift across 40 document types is the proof, not a
disappointment.** Had one document changed, either the concept or one of the
nineteen gates was wrong and we could not say which. Identical output is what
establishes that the concept faithfully reproduces every decision it replaced.

Three rules the wiring must keep:

- **Provenance is load-bearing.** An INFERRED resolution never attaches clauses;
  it raises the concept's confirmation question. Attaching ten data-processing
  obligations because a classifier read "customer records" in a free-text field
  would fabricate a legal duty.
- **The absent resolution is recorded.** "Why isn't this clause here?" needs the
  negative as much as the positive; an absent concept that went unrecorded is
  indistinguishable from one nobody considered.
- **Concept authority is kept separate from clause `legal_basis`.** They answer
  different questions — what this clause is drafted under, versus why this
  transaction needed a clause of this kind. Merging them lets a clause that cites
  a statute look as though its APPLICABILITY had been established.

**Measuring this required deleting an assumption from the measurement.** The
trace probe hardcoded "no concept resolver exists" as a ceiling. The moment the
resolver landed, the probe was asserting a false statement about the system it
was measuring. A probe may cap what the evidence supports; it may not cap what it
last believed.

## 41. A specificity repair can be a legal regression

D4.3 found `SERVICE_KEY_PERSONNEL_001` gated on `include_sla` while the
requirement it satisfies, PERSONNEL_CONTINUITY, is applicable on
`key_person_dependency`. The obvious repair is to move the gate onto the legal
fact. It would have deleted principal-employer exposure from every MSA that does
not depend on named individuals.

The clause does two jobs under one id:

- its first limb records that the parties intended performance by particular
  individuals — **Indian Contract Act 1872 s.40**, whose default is that a
  promisor *may employ a competent person to perform*. The clause displaces a
  statutory default; it does not invent a restriction. This limb is properly
  conditional on `key_person_dependency`.
- its last sentence allocates principal-employer exposure under **Code on Wages
  2019 s.43** and **EPF Act 1952 s.8A**. That is true of any services engagement
  whatever, and no other clause in a generated MSA states it —
  `CORE_RELATIONSHIP_OF_PARTIES_001` addresses the relationship between the
  PARTIES, not who employs the deployed personnel.

**Every existing check would have stayed green.** The clause baseline would
record an intended diff. The requirement would correctly report NOT_APPLICABLE.
Coherence would hold; falsification would pass. The document would simply stop
allocating a statutory liability, and nothing would say so.

So: **before a clause moves behind a legal fact, ask what law the document stops
citing when that fact is false.** Sixty-one conditional clauses across
twenty-eight document types are the sole citation of some statute. Most are
correct — `EMP_MATERNITY_BENEFITS_001` gated on `is_female_employee` SHOULD be
the only source of maternity provisions, and a male employee's contract should
stop citing them. The defect is narrower: when the Act that leaves is about a
subject the gate does not ask about. That distinction is a legal judgement, so
the inventory is recorded with an authored disposition and `NOT_REVIEWED` is the
honest default for the other sixty.

**Treatment granularity is not clause granularity.** A requirement binds to
clause ids, so a requirement that should move one proposition can only move a
whole clause — and a clause may carry several propositions under different
statutes. That is the layer the chain FACT → CONCEPT → AUTHORITY → APPLICABILITY
→ REQUIREMENT → TREATMENT → CLAUSE breaks at, and it is why the key-person slice
stops here rather than shipping a gate change. The repair is to split the clause
so the continuity limb can move and the employment-status limb cannot; ICA s.40
is also cited by `MSA_SUBCONTRACTING_001`, so the continuity limb can move
without losing that authority. Splitting is new legal text and needs advocate
review before it ships.

## 42. Citing the same section is not implementing the same proposition

D4.4-B showed `requirement -> clause` is too coarse, which argues for a TREATMENT
layer between them. Before building one, the question was measured: **is a
treatment a reusable unit, or just a name for part of a clause?**

The obvious measurement says reusable. 146 of 370 authorities are cited by more
than one clause, 114 across more than one category. **It says nothing of the
kind.** Indian Contract Act 1872 s.73 is cited by 26 clauses in 13 categories,
and the authoring notes say what it is doing there — *"Compensation for loss
caused by breach"*, *"Damages for breach"*, *"Damages for breach of employment
obligation"*. Those 26 clauses are not implementing one damages treatment; each
imposes its own obligation and cites the general law of damages as BACKGROUND.
The same holds for s.37 (obligation to perform) and s.10 (formation).

Reporting those counts as reusable treatments would have argued for a whole
architectural layer on evidence that does not exist — the eighth instance of a
filter matching more than it meant, and by far the most expensive.

**On current evidence the smallest independently selectable legal unit is still
the clause**, and the repair for a composite clause is to split it, not to
introduce treatment objects that would be one-to-one with clauses nearly
everywhere. The known failure population is ONE clause, not the 182 that cite
multiple Acts.

## 43. A clause that does not say what it is for cannot be decomposed by anyone

What is missing is not a treatment layer. It is a declaration of which authority
each clause EXISTS TO IMPLEMENT, as distinct from the background law it cites.

198 of 315 clauses carry no `statutory_reference` at all, and 47 of the 117 that
do name more than one. So for most of the library there is no way to separate a
clause's own proposition from its supporting citations — which is precisely how a
principal-employer liability allocation under EPF s.8A came to live inside a
clause about key personnel with nothing marking it as a separate thing.

That declaration is far cheaper than a treatment layer and is the prerequisite
for one: a clause whose own proposition is unstated cannot be decomposed into
treatments by anybody, machine or advocate. It is also the missing input to the
60 `NOT_REVIEWED` statutory-custody pairings, where the question an advocate must
answer is exactly *is this authority what the clause is for, or background it
happens to cite?*

## 44. The reuse that exists is already modelled; the gap is concurrency, not alternatives

The falsification for a treatment layer: **do independently authored clauses
implement the same legal proposition?** Twelve clauses were given an explicit
`implements` — variant-slot groups, a suspected overlapping pair, the known
composite, and two controls. The sample was deliberately loaded toward finding
reuse, because twelve random clauses out of 315 would almost never collide and
their not colliding would say nothing about the library.

**Four propositions are implemented by more than one clause — and two of the four
are already modelled.** `CONFIDENTIALITY_OBLIGATION` across three clauses is the
`confidentiality_strength` variant slot. `REPAYMENT_SCHEDULE_FIXED` across two is
`repayment_structure`. A variant slot IS the treatment abstraction for
alternative implementations: a named position with several clause
implementations selected by condition. It exists, it is used eighteen times, and
nothing needs building.

The other two — `RENT_PAYABLE_ON_STATED_TERMS` and
`SECURITY_DEPOSIT_CAPPED_AND_RETURNABLE`, each across a `RENT_*`/`RENTAL_*` pair
with 6% and 37% text similarity — have no slot saying so. That is either an
unrecorded alternative or accidental duplication, and the two call for opposite
repairs. The probe cannot tell them apart; an advocate reading the texts can.

**So the unmet need is not alternative selection.** A variant slot chooses ONE of
N. `SERVICE_KEY_PERSONNEL_001` needs BOTH of its propositions, with only one of
them conditional: `PERSONAL_PERFORMANCE_INTENDED` (ICA s.40) moves with
key-person dependency, `PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED` (Code on Wages
s.43, EPF s.8A) does not. What the model cannot express is **concurrent
propositions within one clause carrying independent applicability** — a far
narrower gap than "there is no treatment layer", and one that clause splitting
resolves without any new abstraction.

**The control set is what makes this result mean anything.**
`CORE_GOVERNING_LAW_001` and `CORE_NOTICE_001` share no proposition with any
sampled group. A vocabulary drawn broadly enough to cover everything would have
reported perfect reuse while measuring nothing, and would then have been used to
justify the very layer it could not evidence. The test asserts the controls stay
disjoint, so the vocabulary cannot drift into vagueness unnoticed.

## 45. Composite is not the defect; divergent applicability with no other implementer is

D4.5-B left an open question: which composite clauses must be split? The
criterion is not "implements more than one proposition" — a clause may carry
three safely if they are applicable exactly when the clause is selected. It is:

> **A proposition is LOST when there is a world in which it is applicable and no
> clause in the emitted document implements it.**

That is a runtime question and is asked by generating the worlds and reading the
documents. Static reasoning over gates gets it wrong, because a proposition
carried by an unselected clause can still be safe when a variant default or
another clause implements it instead — which is exactly why
`NDA_CONFIDENTIALITY_TRADE_SECRET_001`, equally composite, passes. Its broad
proposition is picked up by `CORE_CONFIDENTIALITY_001` when the variant is not
chosen. Nothing is lost, so nothing needs splitting.

**Applying it turned one abstract wiring observation into two live legal losses
with two different repairs**, both in `MASTER_SERVICE_AGREEMENT` and both caused
by `SERVICE_KEY_PERSONNEL_001` being gated on `include_sla`:

- `PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED` (Code on Wages s.43, EPF s.8A) is
  applicable to every services engagement. An MSA with no agreed service levels
  **ships today** with nothing allocating principal-employer exposure. Repair:
  split the clause so this limb is unconditional.
- `PERSONAL_PERFORMANCE_INTENDED` (ICA s.40) is applicable on
  `key_person_dependency`. A client who answers YES to depending on particular
  individuals and NO to service levels receives **no key-person protection at
  all**, silently. Repair: move the gate onto the fact its own proposition names.

Neither was hypothetical, and the D4.3 finding had described only the wiring. The
proposition layer is what converted "the gate reads the wrong fact" into "this
document is missing this rule, under these sections, in this world."

**The two repairs must land together.** Moving the gate while the clause is still
composite would take the principal-employer allocation with it — the regression
`statutory-custody.json` records as BLOCKED. That coupling is invisible at clause
level and obvious at proposition level, which is the argument for the layer.

## 46. A guard scoped to the families that revealed the defect is not a guard

`tests/gateReachability.test.mjs` was written while investigating NDA,
Distribution and MSA, and was scoped to those three. It reported **7 frozen
gates**. Run over all forty families it reports **50, of 156 gates checked.**

The other forty-three were never absent — only unexamined. `include_insurance`
is frozen in **ten** families, so `CORE_INSURANCE_001` is unreachable in ten
document types at once; `include_governance_protections` in nine.

Gate reachability is an ENGINE property: a gate on a control no answer can move
is a defect wherever it occurs. Scoping the check to the knowledge that revealed
it leaves every other family unguarded while the suite reports green. The test
for any future change is the same one: **am I fixing the engine, or teaching one
document about its particular problem?** If a capability is engine-shaped, its
guard must run wherever the engine runs, and the per-family findings belong in
the knowledge layer — `knowledge-base/governance/frozen-gates.json` now holds all
fifty with an authored disposition each, defaulting to `NOT_REVIEWED`.

Two other artifacts carried the same flaw and were corrected: the proposition
conservation test now derives its families from which blueprints can emit an
annotated clause (11 pairs examined became 90), and the unconditional-clause
audit states its three-family scope as a deliberate choice with an override,
because it produces an authoring queue rather than a guard.

## 47. Proposition conservation, and the first repair proved by it

The universal property the proposition layer buys:

> **If proposition P is applicable in a given world, some clause in the emitted
> document must implement it.**

Two live losses in `MASTER_SERVICE_AGREEMENT` were repaired against it, and the
count went 2 → 0.

`SERVICE_KEY_PERSONNEL_001` carried two propositions of different applicability
behind one `include_sla` gate. The clause was severed at **existing sentence
boundaries** — the employment-status sentences moved verbatim into
`SERVICE_PERSONNEL_STATUS_001`, which the blueprint lists unconditionally, and
the continuity limb was re-gated on `key_person_dependency`, the fact its own
proposition names. **No new legal wording was authored**, which is what makes a
split safe to perform before advocate review; the boundary between the two
clauses is itself a legal judgement and still needs signing off.

The verification that matters is the shape of the diff: **one clause added to one
document type, nothing removed, no other family touched**, and the four-world
table behaving as the propositions predict — continuity follows
`key_person_dependency`, `include_sla` no longer touches it, and the
employment-status allocation is present in all four worlds including the one
where it used to vanish.

Three of the project's own ratchets fired during this repair and each was right:
the review-debt ceiling (a split raises the debt by one and an advocate must now
sign two clauses where one stood), the custody record, and the vocabulary guard
that had been written to say *re-examine before changing the gate*.

## 48. A clause being present is not the legal consequence being achieved

The conservation invariant of 47 — an applicable proposition must have an emitted
implementation — is **false as stated** for any proposition the document cannot
itself satisfy.

Annotating `INSTRUMENT_REGISTERED` (Registration Act 1908 s.17(1)(d) and s.49,
Transfer of Property Act 1882 s.107: a lease over a year takes effect only if
made by a registered instrument) produced a clean green. The document had
registered nothing. A clause can require registration, allocate its cost and
state the consequence of failing to do it; nothing a document says can accomplish
it.

**The requirement layer already knew this.** `kind: FORMALITY` with
`outside_the_document` caps such a requirement at PROVIDED_FOR, and six
requirements already use it. The proposition layer was new and bypassed it,
re-introducing one layer down a conflation the system had solved one layer up.
**A new layer inherits the old layer's distinctions or it re-earns its old bugs.**

So the vocabulary is reused, not reinvented. Every proposition declares
`satisfaction`, and conservation reports three outcomes:

- **IMPLEMENTED** — the document does the thing.
- **PROVIDED_FOR** — the document provides for an act performed elsewhere. The
  ceiling for a formality, and reported *as* a ceiling rather than flattened
  into a pass.
- **LOST** — applicable, and nothing even provides for it.

The field is load-bearing: flipping `INSTRUMENT_REGISTERED` to
`IN_THE_DOCUMENT` reproduces the false green on demand.

**Two authoring errors were caught by the repair, and both are the point.**
`always: true` made a three-month commercial lease report the proposition
satisfied by a clause whose rendered text says registration is *not* compulsory.
A guessed control name then made the annotation inert, which the ceiling
assertion caught by name — an annotation that never fires is not a safe
annotation, it is an absent one. The correct fact, `is_registrable`, was already
derived from the actual term and already right: true at 24 months, false at 3.
The knowledge existed; only the wiring was missing.

## 49. NEXT FAILURE, EVIDENCED NOT YET REPAIRED: rendered text can contradict the proposition it claims to implement

`implements` is annotated on a clause id, but the emitted text is conditionally
rendered. `PROP_REGISTRATION_001` renders as *"the term of this Agreement of 24
months being such as to attract Section 17(1)(d)…"* in one family and *"the term
of this Agreement of 3 months being within the threshold… registration of this
Agreement is not compulsory"* in another — **the same clause id, asserting the
proposition in one document and negating it in the other.**

Correct applicability hides this, because the proposition is not applicable where
the text negates it. That is exactly what makes it dangerous: it is invisible
while the annotation happens to be right, and produces a confident false green
the moment it is not. It is the composite-clause problem one level down — from
*which propositions does this clause carry* to *which propositions does this
rendering assert* — and it is a genuinely different failure from the MSA case,
which was structural rather than textual.

Recorded, not repaired. It needs its own falsification cycle, and the repair is
not obvious: it may be a rendering-level annotation, or it may be that a clause
whose text can negate its own proposition should be two clauses.

## 50. The unit that owns a legal assertion is already smaller than the clause

D4.6 asked which unit owns the proposition assertion when a clause id can render
materially different text. Measured across all 40 families, every world:

| class | pairs | clauses | meaning |
|---|---|---|---|
| LIST_MEMBERSHIP | 4 | 1 | a cross-reference list tracking which other clauses are present |
| SENTENCE_ADDED | 2 | 2 | one rendering contains another's sentences plus more |
| SENTENCE_REPLACED | 22 | 5 | sentences exchanged as the facts change |

**24 of 28 pairs, across 7 clauses and 18 families, genuinely change which
sentences are in the text as facts change.** The mechanism is not incidental
formatting: `documentHardening.js` holds per-clause builders —
`CORE_TERMINATION_001` composes different text for a guarantee, a joint venture
and the generic case; `SERVICE_TERMINATION_001` likewise. **The engine has been
selecting legal content below clause granularity all along, in code, with no
representation of what it is selecting.**

That answers the question as asked. The variant-slot machinery does NOT cover
this: a slot swaps whole clauses, and this is composition *within* one. And D4.5
concluded the model could not express concurrent sub-clause propositions — it
expresses them routinely and cannot see them.

**LIST_MEMBERSHIP is correct and worth naming separately.** `CORE_SURVIVAL_001`
drops "indemnity" from its survival list when the indemnity clause is declined.
Nothing is wrong there, but a clause's rendered text already depends on which
OTHER clauses were selected, and no annotation records that dependency either.

**Still no design decision.** Whether the assertion should be owned by a
rendering variant or by separate clauses is not settled by this count, and the
builders are code rather than knowledge — which is itself the deeper issue, since
an engine capability expressed as a per-clause switch statement cannot be
authored by an advocate.

## 51. A predicate that cannot return false is not a classifier

This measurement was wrong twice, in the same direction, and both errors inflated
the class that would have justified a new architectural layer.

First it stripped digits but not spelled-out numerals, so "three (3) years" and
"five (5) years" read as structurally different sentences: VALUE_ONLY came back
as **zero** and all 28 pairs landed in SENTENCE_SET.

Then the nesting test asked whether each rendering's sentence set contained SOME
other rendering's — which every set satisfies by containing itself. `nested` was
vacuously true, so everything was still reported as sub-clause conditionality,
including a clause whose two renderings both have exactly two sentences. **The
tell was there and I nearly missed it**: a classifier reporting 100% of cases in
one class is not measuring, and the sentence counts printed beside it contradicted
the label.

Corrected, the same data splits 4 / 2 / 22 across three classes and discriminates.
Ninth and tenth occurrences of one shape — *a filter matching more than it meant*
— and the first where a predicate was not merely too broad but incapable of
returning false at all.

## 52. documentHardening.js is hiding legal reasoning, and the measurement says how much

D4.7 asked what unit owns a legal assertion and found the engine composing text
below the clause boundary, procedurally. D4.8 asks what those builders select
ON. Drivers were found by perturbation — each world flips one intake answer, so a
changed rendering names its own driver — because reading the builders finds the
variables they MENTION, a different and larger set.

| class | changes | clauses | |
|---|---|---|---|
| LEGAL_PROPOSITION_CHANGE | 3 | 1 | driver carries a concept with authority |
| CROSS_CLAUSE_DEPENDENCY | 6 | 2 | text depends on which other clauses were selected |
| OPTIONAL_COMMERCIAL_TERM | 4 | 2 | an `include_*` drafting choice |
| **UNCLASSIFIED** | **35** | **5** | **the driver resolves to no layer of the knowledge base** |

**3 of 48 sentence-level changes are driven by something carrying statutory
authority.** The other 45 are driven by inputs that exist as a question and a
derived flag and nothing else — no semantic fact, no concept, no proposition, no
requirement applicability. The knowledge base knows how to ASK them and has no
representation of what they MEAN.

**The UNCLASSIFIED class contains substantive legal content, which is what makes
the finding serious.** `termination_for_convenience` and `termination_for_cause`
drive 32 of the 35. Perturbing the first moves limb (a) of
`SERVICE_TERMINATION_001` in and out — *"by either Client or Service Provider for
convenience upon N days' prior written notice"* — and renumbers the rest. **A
right of termination enters or leaves the instrument, decided inside a builder,
with no proposition, concept, requirement or authority behind it.**

So of the five possibilities the audit was set up to distinguish,
`documentHardening.js` is not merely a renderer. It is **predominantly hiding
legal reasoning** (35), with a minority of genuine cross-clause dependency (6)
and drafting choice (4). An advocate cannot review a switch statement as a
reusable legal proposition, and here the switch statement decides a termination
right.

**Nothing is migrated.** UNCLASSIFIED is not a claim that all 35 are legal
propositions — some may be legitimate commercial options. It is the claim that
nobody has said which, and that a class containing a termination right cannot be
assumed to be presentational.

**CROSS_CLAUSE_DEPENDENCY is a distinct kind and should not be migrated with the
rest.** `CORE_SURVIVAL_001` dropping "indemnity" from its survival list when the
indemnity clause departs is not a new rule; it is one clause's text depending on
another clause's presence. That dependency is real, unrepresented, and belongs in
the dependency graph rather than the proposition vocabulary — the clause
selection graph is not the only dependency graph the system has.

## 53. The five hidden drivers, classified — and one classification does not fit all families

D4.8 left 35 sentence-level changes with drivers that resolve to no layer of the
knowledge base. Five drivers account for all 35. D4.9 extracted what each one
actually moves, and the classification rests on the text rather than the name —
`escrow_required` sounds commercial whatever it turns out to do.

| driver | changes | what moves | reading |
|---|---|---|---|
| `termination_for_convenience` | 16 | the RIGHT to terminate without cause | PARTY_AGREEMENT commercially, **UNKNOWN in employment** |
| `termination_for_cause` | 16 | the ARTICULATION of a right that exists at law | DRAFTING_DEFAULT |
| `police_verification_required` | 1 | an obligation to file tenant verification | **LEGAL_PROPOSITION, jurisdictional** |
| `escrow_required` | 1 | a source-code escrow obligation | PARTY_AGREEMENT |
| `no_employment_ack` | 1 | an acknowledgement of non-employment | DRAFTING_DEFAULT |

**So the problem is smaller than D4.8's headline suggested, and differently
shaped.** Most of the 35 are not trapped legal propositions. But three findings
matter more than the counts:

**One driver has different legal character in different families.**
`termination_for_convenience` removes the same sentence in all 16, differing only
in party labels. In an MSA the parties may freely create or withhold that right.
In an appointment letter or internship agreement the same words operate against a
statutory backdrop that constrains termination of employment. **A single global
classification would be wrong in at least one direction, and the uniformity of the
text delta actively conceals that.** Any migration keyed on the driver alone would
inherit the error.

**Two adjacent drivers the builder treats identically are not the same kind of
thing.** A convenience right exists only because the contract creates it. A right
to terminate for repudiatory breach arises under ICA 1872 s.39 whether the clause
says so or not — and `CORE_TERMINATION_001` already cites s.39. Removing the
for-cause limb removes an articulation, not a right. The builder cannot tell these
apart because nothing tells it.

**The first driver needing a jurisdictional answer.**
`police_verification_required` turns on state police legislation and local orders
— on where the premises are. It also sits inside a clause citing registration and
stamp authorities that have nothing to do with police verification, which suggests
it was attached where it fitted rather than where it belonged.

> **CORRECTION (D4.10).** This section originally said the repository has "no
> jurisdiction dimension". That was wrong and was asserted without checking. The
> constraint engine has carried a `state_in` predicate all along. What is missing
> is not the reasoning primitive but any knowledge that uses it — see invariant 54.

And the polarity phenomenon of invariant 49 recurs unprompted: `escrow_required`
does not merely remove the escrow obligation, it ADDS *"No source-code escrow
arrangement shall apply unless the Parties separately agree otherwise"*. An
`implements` annotation on that clause would be false in one of the two worlds.

**Nothing is migrated, and every classification is a reading that needs an
advocate.** `no_employment_ack` is flagged as the one most likely to be wrong:
whether a relationship is employment turns on substance rather than the parties'
label, so the acknowledgement reads as evidential — but if it is materially
probative in practice it behaves closer to a party agreement than a recital.

## 54. Jurisdiction is a value in this system, not a fact — and the primitive it needs already exists

Tested as instructed: identical tenancy facts, identical family, identical
parties, identical commercial choices, identical driver — only the state changed,
across Maharashtra, Karnataka, Delhi and Tamil Nadu.

**The clause set was identical in all four. One distinct clause set, four
distinct texts, and the only differences were the state's own name interpolated
into governing-law and forum wording.** No clause enters or leaves. Tenancy is a
State subject and the state Rent Acts, the state Stamp Acts and state police
verification requirements differ materially between those four — and the system
emits the same instrument for all of them.

**So jurisdiction is currently a VALUE that gets printed, not a FACT that is
reasoned from.**

**The primitive is not what is missing.** `IRE/src/indian-rule-engine/constraintEngine.js`
has carried a `state_in` predicate all along. **Zero knowledge records use it** —
the one apparent hit is a substring of
`the_employees_state_insurance_act_1948`. No concept, proposition or requirement
carries a jurisdiction field that could reach it. This is a knowledge and schema
gap, and the distinction matters: **a missing data dimension is not a missing
reasoning primitive**, and the second would have been far more expensive to
conclude wrongly.

**One finding beyond that, and it is a defect in the primitive's contract.**
`state_in` resolves its state by reading `governing_law_state`, then
`operating_state`, then `state`. `governing_law_state` is a PARTY CHOICE. For
immovable property the applicable tenancy, stamp and registration law follows the
SITUS, which the parties cannot choose. Generating with situs Karnataka and
chosen law Maharashtra produces a byte-identical document, and the predicate
would answer "Maharashtra" — the wrong state for any stamp-duty or rent-control
question.

The priority order is correct for contract questions and wrong for property
questions, and the predicate cannot tell which it is being asked. **Jurisdiction
is not one dimension.** At minimum the chosen law and the situs are different
facts, and which one governs depends on the subject matter of the rule asking.

No new primitive is justified by this. A correction to the existing one's
contract may be, and nothing is changed here: the measurement is recorded and the
repair is an authoring decision that needs an advocate's view on which rules
follow situs and which follow choice of law.

## 55. Four resolution orders are four authors reaching for a subject they cannot name

D4.10 found `state_in` reading `governing_law_state` first. The contract audit
found that the same conceptual question is answered four ways across the codebase,
two of them opposite:

| module | order |
|---|---|
| `constraintEngine.js:193` | `governing_law_state` → `operating_state` |
| `agreementGraphValidator.js:248` | `governing_law_state` → `operating_state` → `jurisdiction_state` |
| `documentHardening.js:2608` (stamp) | **`operating_state` → `governing_law_state`** |
| `documentHardening.js:3190` (governing law) | `governing_law_state` → `operating_state` |

**Reading that as sloppiness would produce the wrong repair.** The stamp author
put `operating_state` first because stamp duty follows where the instrument is
executed and the property sits, not the law the parties chose. The governing-law
author put `governing_law_state` first for the opposite and equally correct
reason. Four authors each reached for the right jurisdictional subject, had no
vocabulary to name it, and encoded their intent as a fallback order. That is the
strongest available evidence that the missing thing is **a typed subject, not a
new evaluator**.

`agreementGraphValidator.js` reads `jurisdiction_state` as a third fallback. It
appears in **zero of the 40 intake schemas**.

**One of six jurisdictional subjects is carried as a typed fact.** Contractual
governing law is a `select` in 36 families. Immovable-property situs, place of
performance, party establishment and workplace location exist only inside
free-text address blobs; forum survives as `execution_city`, free text.
`operating_state` is typed in all 40 and **nothing says which subject it means**,
which is precisely why four modules could each read it with a different subject in
mind and none of them was obviously wrong.

So the answer to "can the fact model carry these as distinct facts while
`state_in` stays a closed predicate over an explicitly selected variable" is **not
today**. The evaluator half of that repair is small and backward-compatible. The
fact half is not: five of six subjects are not collected as states at all.

**The architectural pressure is real and it lands on the intake and fact layer,
not the evaluator** — a different conclusion from both "just wire `state_in`" and
"build a jurisdiction engine", and the reason the contract was worth auditing
before either.

**What is not concluded: that the five missing facts should be collected.** A
lease whose premises and governing law are both in Maharashtra needs one answer,
not six, and asking six questions to serve a rule nobody has authored would be the
intake equivalent of a premature abstraction. The finding is that the facts are
not *representable*, not that they must all be represented.

## 56. A rule must say which state it means — the smallest justified repair

D4.11 established that four modules answer the same jurisdictional question with
four different fallback orders, two of them opposite, because each author was
reaching for a different subject through a variable that has a value domain and
no contract. `operating_state` is **syntactically typed and semantically
untyped**. This is the repair, and it is deliberately small.

**Knowledge, not code.** `knowledge-base/jurisdiction/subjects.json` names six
subjects and says which fact carries each. A rule writes
`{ "state_in": ["Maharashtra"], "of": "PROPERTY_SITUS" }`. The evaluator resolves
the subject through the map; an advocate can correct which fact carries a subject
without touching the engine.

**Two subjects are representable. Four are not, and say so.** `CHOSEN_GOVERNING_LAW`
reads `governing_law_state`; `PROPERTY_SITUS` reads `operating_state`, which is
already what that field means in the property families — **no intake question was
added**. `WORKPLACE_LOCATION`, `PLACE_OF_PERFORMANCE`, `PARTY_ESTABLISHMENT` and
`FORUM` are declared with `fact: null` and a record of what is missing. A rule
naming them **fails rather than falling back**, because falling back would answer
a workplace question with the parties' choice of law — the exact defect the
vocabulary exists to end.

**The growth rule: a subject becomes representable when an authored rule needs
it, never before.** This repository already carries 148 dead intake questions
from the last time facts were collected ahead of rules.

**The demonstration is a PAIR, and it has to be.** Any single rule can be made to
pass by picking the fallback that happens to suit it. Two rules reading the same
two variables and required to move in opposite directions cannot:

| world | situs rule | chosen-law rule |
|---|---|---|
| situs MH / law MH | FIRED | FIRED |
| situs KA / law MH | — | FIRED |
| situs MH / law KA | FIRED | — |
| situs KA / law KA | — | — |

Measured through the real generation path, not the resolver alone. The bare
`state_in` chain is untouched and asserted untouched, because it is correct for
some existing rules and nothing yet says which. Baseline drift was exactly the
two new notices in three property families — no clause, no text, no other family.

**A constraint file whose domain nobody subscribes to is silently inert.** The
first draft of the rule file used `jurisdiction_subject` as its domain. It
loaded, was counted among the constraint sets at bootstrap, and never executed,
because `documentValidator.js` runs only the domains a document type declares.
The resolver test passed the whole time. **Same failure shape as a gate on a
frozen control**, and it was caught only by insisting on an end-to-end run after
a green unit test.

**One false alarm, corrected before it was reported.** Seeing `domains` undefined
on every type in `shared/documentRegistry.js`, I nearly recorded that nine
authored `rental` and `property` rules were dead. They are not: `getDocumentTypeInfo`
reads IRE's own `domainRegistry.js`, where all 74 types declare domains. Two
registries, one name.

## 57. Polarity needs no new abstraction — the model already expresses it, escrow is mis-shaped

Two independent sightings had suggested a gap: `PROP_REGISTRATION_001` asserts
compulsory registration in one family and denies it in another, and
`TECH_SOURCE_CODE_001` states an escrow obligation when escrow is elected and
states its ABSENCE when it is not. A driver does not merely suppress a positive
clause; it can make the document assert the opposite position.

**The false green is real.** Annotating `TECH_SOURCE_CODE_001` with
`implements: [SOURCE_CODE_ESCROW_ESTABLISHED]` and asking the question a consumer
asks — *does this document implement it?* — returns IMPLEMENTED in **both**
worlds, while the document asserts it in only one. `implements` is attached to a
clause id and a clause id is world-independent.

**But the model can already express it, and the library already does.** `MOU`
carries a `mou_binding_nature` variant slot selecting between `MOU_BINDING_001`
(*"intend this Memorandum to be a legally binding and enforceable agreement"*) and
`MOU_NON_BINDING_001` (*"not intended to create legally binding obligations"*) —
opposite legal positions, two clause ids, one slot. Driven through its real
question:

| `binding_nature` | clause shipped | model says |
|---|---|---|
| Non-binding | `MOU_NON_BINDING_001` | not implemented |
| Binding | `MOU_BINDING_001` | IMPLEMENTED |
| Partly binding | `MOU_BINDING_001` | IMPLEMENTED |

World-correct in both directions with no new mechanism, because different clause
ids ship. **So polarity is a knowledge-shape problem, not a model gap** — the
third time a suspected abstraction has turned out to be something variant slots
already do (D4.5-B was the first, D4.7 the second).

**The escrow annotation was withdrawn rather than shipped.** An annotation that is
false in one of two worlds is worse than no annotation, and
`TECH_SOURCE_CODE_001` now records why it has none: the repair is to author the
two positions as two clauses behind a slot, which is new legal text and needs an
advocate.

**One observation, not a defect claim:** `binding_nature` offers three positions
and the slot collapses them to two — "Partly binding" selects the binding clause.
That may be right, since a partly-binding MOU does intend legal relations for the
binding parts, but nothing records the judgement.

**And the first run of this control failed for an instructive reason.** I drove
`is_binding_mou` — the gate's name — and the slot never moved, because the
question is called `binding_nature` and `is_binding_mou` is derived from it. Gate
name is not field name: Phase C measurement error 3, recurring in the probe rather
than the product, and caught only because a control that cannot distinguish its
two cases is not a control.

## 58. The instrument binds two people and nothing in the model can represent a third

The 2→3 counterfactual on `PARTNERSHIP_DEED`. A user with three partners has two
routes and both fail, differently:

1. **Supply `partner_3_name`.** Sanitisation drops unknown keys. The third
   partner vanishes from the document entirely, silently.
2. **Describe them in `partner_roles` free text.** The name then appears in the
   **capital and profit clause** and in **neither the identity clause nor the
   signature block**.

The second is the dangerous one. The deed recites a person as sharing capital and
profits while not making them a party, and the capital clause still states a
two-way 60:40 split. Under the Indian Partnership Act 1932 that misstates the
firm: s.4 defines partnership as the relation between persons who have agreed to
share profits, and s.25 makes every partner liable jointly and severally — **a
person who signs nothing is bound by nothing, whatever the deed recites about
their share.**

**This is architecture, and the check that says so is the one the previous
thirteen-plus candidates failed.** Across all 40 families: no party index above
**2**, and **zero collection-typed fields** — the type vocabulary is date,
multiselect, number, select, text, textarea. `multiselect` picks from a fixed
option list and cannot carry correlated per-entity attributes. Free text carries
a name and no fact. **There is no existing mechanism to express a repeating
entity**, and five families where more than two principals are legally ordinary
are all capped at two.

The binary assumption sits in three places, and fields alone would not fix it:
the intake (no index, no collection), the shared clause language (**15 of 43
CORE clauses** say "the other Party"), and the builders (`PARTNERSHIP_CAPITAL_001`
hardcodes "Partner 1 … and Partner 2"). **Fields without language reproduce
exactly the failure measured above — a name recited, a person not bound.**

**What was built is a guard, not the repair.** A constraint rule fires when the
intake describes more principals than the instrument can bind, and says plainly
that a mention in free text does not make someone a party. It is written entirely
in the existing closed predicate vocabulary — **no engine change** — and it is a
notice rather than a block because extracting a partner count from prose is
unreliable and a false block on a correct two-partner deed would be worse than
the defect. It fires on an explicit ordinal, which is what the counterfactual
produced and what a user who writes "third partner" means.

**The repair is scoped, not started.** A repeating-entity type in the intake
model plus N-party language in 15 shared CORE clauses is new legal text across
every family that uses them, and it needs an advocate before it needs an engineer.
Turning a silently wrong instrument into a visible warning is the part that could
be done today without guessing.

## 59. N-party language cannot be a mechanical pluralisation

The hardest shared clause, taken as instructed. `CORE_LIMITATION_LIABILITY_001`
is emitted in 15 families, exposed in four where more than two principals are
ordinary, and it is quantitative:

> "the aggregate liability of **either Party** … shall not exceed the aggregate
> fees paid or payable under this Agreement"

**1. What relationship does it describe?** A bargain about quantum — a cap on what
one contracting party can recover from another. It cites ICA s.73 (compensatory
damages) and s.74 (penalty).

**2. What does "either Party" mean with three?** Three readings, and they differ in
money. **Per-party**: each partner separately capped, total exposure N × cap.
**Shared**: one pot across all, total exposure = cap. **Inter se only**: in a
partnership s.25 makes partners jointly and severally liable to third parties,
and no cap between them touches that. Under two parties all three readings
produce identical words and cannot be told apart.

**3. Can the existing model express the distinction?** No. There is no
apportionment concept, no role model separating "party as obligor" from "party as
member of the firm", and parties are not a collection.

**4. Which reading does each family intend?** Nobody has decided. Fifteen families
emit it; four are exposed; nothing records an intention anywhere.

**5. Can one formulation serve all without changing meaning? NO — and that is the
finding.** *"Each Party's aggregate liability shall not exceed X"* and *"The
Parties' aggregate liability shall not exceed X"* are both grammatically N-safe
and legally different. A single rewrite would silently pick one.

**So the clause problem is not a general N-party language abstraction.** It is a
set of per-clause legal decisions, and a collection schema must be able to carry
their outcome. `parties[]` as a list would be insufficient: what the clauses need
is **apportionment and role**, not membership. Designing the schema first would
have produced a list that cannot express the only thing the hard clauses turn on.

**Two measurement errors in one probe, both under-reporting — the first time that
direction has appeared.**

A `/g` regex is stateful under `.test()`: `lastIndex` advances between calls, so
alternating calls return false and roughly half the matches vanish. Then, more
seriously, the probe read LIBRARY text while `documentHardening` builds several
CORE clauses at generation time — so it measured what is stored rather than what
ships. Corrected, the count went **17 clauses / 10 exposed → 23 / 14**, and both
errors had hidden `CORE_LIMITATION_LIABILITY_001`: the single clause the whole
question turns on. Ten previous errors inflated; **a measurement can be wrong in
the reassuring direction too, and that is harder to notice.**

## 60. The 23 clauses collapse into six shapes, and only two of them need a decision

The question left open by invariant 59: is "N-party support" one abstraction or
several independently governed relationship semantics? Classifying every binary
construction in all 23 shared CORE clauses:

| shape | form | generalises to | decision |
|---|---|---|---|
| ALREADY_N_SAFE | *where either Party does X, that Party shall Y* | no change needed | — |
| UNIFORM_PROHIBITION | *neither Party shall X* | *no Party shall X* | — |
| RECIPROCAL_SEVERAL | *each Party … to the other Party* | *to each other Party* | — |
| CONSENT_OR_NOTICE_TO_OTHERS | *consent of / notice to the other* | *all other Parties* | — |
| **APPORTIONED_QUANTITY** | *aggregate liability of either Party* | **undetermined** | **required** |
| **PAIRWISE_RIGHT** | *by either Party if the other breaches* | **undetermined** | **required** |

**It collapses. Six shapes, and only two require a per-clause legal decision — so
the decision burden is six clauses, not twenty-three.** The other seventeen have
an N-party form determined by their binary form: nobody has to choose anything,
because nothing about the obligation turns on how many parties there are.

The two that do:

- **APPORTIONED_QUANTITY** — per-party caps, one shared cap, or inter se only
  (Partnership Act s.25 makes partners jointly and severally liable to third
  parties whatever they agree between themselves). Identical words at two parties,
  different amounts of money at three.
- **PAIRWISE_RIGHT** — with three parties, does the innocent party end the whole
  instrument or only its relationship with the defaulter? For a partnership that
  is the difference between dissolving the firm and expelling a partner, which the
  Partnership Act 1932 treats quite differently. The two-party text cannot
  distinguish them because ending the relationship and ending the instrument are
  the same act.

**ALREADY_N_SAFE is worth naming precisely because it is the class that must not
be touched.** *"Where either Party processes personal data, that Party shall …"*
is distributive and correct for any number. Rewriting it would be churn with
drafting risk and no gain, and a bulk pluralisation would have caught it.

**So the schema now has a shape.** Not `parties[]`, and not one apportionment
field either: a collection whose members carry a role, a per-clause shape drawn
from this vocabulary, and an authored decision attached only to the two ambiguous
shapes. That is what the evidence supports, and it is the first point in this
investigation where designing the schema would not be guessing.

## 61. N-party representation, built with the six questions left open

Invariant 58 proved the representation gap; 59 proved it cannot be repaired by
pluralisation; 60 reduced 23 clauses to six shapes of which two carry legal
decisions. This is the build, under one rule:

> **An engine may generalise language. It may not choose a legal position.**

**`partyRoster.js`** resolves an ordered collection of principals from whatever
the intake supplied — indexed slots to any depth, family prefixes
(`partner_N_*`, `shareholder_N_*`, `founder_N_*`), or an explicit `parties`
array. It refuses three things on purpose:

- **It does not invent members from prose.** A name in `partner_roles` is not a
  party. Believing it would reproduce the D4.14 defect with a confident roster on
  top: the system would agree someone is a partner while the signature block
  still did not bind them.
- **It does not resequence.** Position is identity in a document that says "Party
  1", and silent renumbering would rewrite cross-references nothing else knows
  about.
- **It does not stop at the first empty slot.** Supplying 1 and 3 records a gap
  and keeps the third; a loop that stopped would lose a principal and report
  success.

**`npartyTreatment.js`** returns DETERMINED for the four shapes that generalise,
NOT_APPLICABLE at two principals, and **UNRESOLVED for the six clauses whose
meaning is a legal question** — naming the question and the candidate readings
without selecting one. `nparty-treatments.json` records four decisions covering
those six clauses, every one `UNDECIDED`, each with its consequence at two, three
and four parties. **At two parties the candidates produce identical words, which
is exactly why the ambiguity survived unnoticed; at three the liability cap
differs in money.**

**The design choice that kept the corpus intact: the N-party form is conditional
on party count.** A two-party document gets the wording it has always had —
`treatmentFor(id, 2)` is NOT_APPLICABLE for every clause. Rewriting 17 CORE
clauses portfolio-wide would have churned 38 families that never had the problem,
with drafting risk and no gain. Zero baseline drift across 40 document types.

**The test that would catch me building this dishonestly** asserts no candidate
treatment is even spellable in the resolver, by scanning the source. It fired on
the first run — against the docstring sentence promising there is no
`|| "PER_PARTY"` fallback. **A guard tripping over its own explanation of
itself**: the eleventh instance of a filter matching more than it meant, this
time in the guard rather than the product. Fixed by stripping comments, because
the property is about values in code and the scan has to be too.

---

## 62. An admitted principal reaches the page, and nobody else does

D4.17 built the representation. This is the wiring, and the property it exists to
establish is a **conservation law** with two directions that have to hold
together:

```
ADMITTED PARTY → partyRoster → generation input
               → IDENTITY BINDING → SIGNATURE BINDING → ARTIFACT
```

and its converse, which is the half that actually protects anyone:

> **No signature block may exist for a person who is not in the authoritative
> roster.**

Losing a partner and inventing one are the same defect seen from two sides.
Indian Partnership Act 1932 s.4 and s.25 are why: a person who signs nothing is
bound by nothing whatever the deed recites about their share, and a person made
to sign who never agreed is bound to strangers jointly and severally. A test
asserting only the first direction would pass while the engine quietly
duplicated somebody — and a duplicated partner is *more* dangerous than a missing
one, because every line of them is plausible.

### The four links, and where each was broken

| Link | Before | Repair |
|---|---|---|
| intake → variables | `partner_3_name` dropped by `sanitizeVariablesForDocument`, silently | structural admission rule: index ≥ 3, in a prefix the schema already uses for its first two principals |
| variables → roster | resolved, but nothing consumed it | — |
| roster → generation input | `getParticipantExpectations` derived participants from the schema, which declares two | extends from the roster when it carries more |
| participants → artifact | `CORE_IDENTITY_001` hardcoded first/second, First/Second Part, "BY AND BETWEEN" | built by rule over N, two-party wording preserved exactly |

**The signature block needed no change at all.** It already looped over
`getParticipantExpectations`. That is the measurement that says the repair landed
in the right place: one function answers "who are the principals", and the
identity clause, the signature block, the notices clause, the consistency
validator and the quality controls all ask it. D4.14's defect was those
provisions *disagreeing* — a third partner in the capital clause, absent from the
identity clause, absent from the signature block. Extending the single funnel
makes them agree **by construction** rather than by five separate repairs that
happen to match.

### The two-party corpus did not move, and this was proved rather than argued

The D4.17 tarball is the exact pre-change state. Both trees generated **every
clause of every document, in full text, for all 40 document types at two intake
levels — 80 documents, byte-for-byte identical.** Not clause ids: the words. The
mechanism is structural, not incidental: the admission rule starts at index 3, and
every extension is gated on `roster.count > declared.length`.

### Precedence and deduplication, because two sources can describe one person

A caller may supply `parties[]` **and** indexed slots. Without a stated rule the
same woman arrives twice and becomes two partners.

1. `parties[]` is **authoritative for membership** when present — and for every
   position, not only the new ones. Taking only the extras from it would let
   `partner_1_name` name somebody the collection does not contain and still put
   them on the page.
2. An indexed slot describing someone already in the collection is the **same
   person**. Merged; the declared representation wins on any attribute both
   supply; the disagreement is recorded.
3. An indexed slot describing someone **not** in the collection is neither
   admitted nor discarded. Both are silent decisions — admitting binds a person
   the caller never listed, discarding repeats D4.14 — so it is recorded as a
   conflict and the roster reports `reconciled: false`.

**Identity is PAN where both representations carry one**, because a statutory
identifier settles the question in *both* directions: same PAN is the same person
whatever the names say, and different PAN is two people whatever the names say.
Collapsing a woman and her namesake would be the duplication defect with its sign
reversed, so that case is tested too.

### A sparse roster meets a required field, and the refusal is the right answer

Slots 1 and 3 filled, slot 2 empty: the deed does not generate, because
`partner_2_name` is required. **That is the system being right.** The D4.14 defect
was a principal disappearing in silence; a refusal naming the empty field is its
opposite. The roster still keeps the third at index 3 — the user may go on to fill
slot 2 and must not find their third partner renamed. The artifact-level version
of the same property uses slots 1, 2 and 4, where the gap sits above the required
pair and generation is reachable: the deed says **"Partner 4" of the Third Part**,
which is the honest reading. The *label* is the slot the user filled; the *Part*
is the position in the testatum. They are different questions and a resequencing
would have hidden the difference.

### The notice changed from a fact about the system to a fact about the document

`MORE_PRINCIPALS_THAN_THE_INSTRUMENT_BINDS` asserted `__party_3_unrepresentable`,
a variable nothing ever set — so it fired whenever the prose matched. Half its
premise is now false: an indexed third principal *is* representable. The other
half never will be, because a name in free text is not a party and inferring one
from prose is the failure the rule exists to report. So the assertion became
`__roster_count >= 3`. **The notice now fires exactly when the deed describes a
principal it does not bind, and stays silent when the third partner is a party** —
both directions asserted, because a guard that cannot stay silent is not a guard.

### Cardinality and interpretation are independent dimensions — demonstrated

A three-party deed generates. Every principal is named, bound and signed for. And
it arrives carrying **`open_treatments`**: `LIABILITY_CAP_APPORTIONMENT` and
`TERMINATION_FOR_DEFAULT_SCOPE`, both `UNDECIDED`, each with its legal question
and its candidate readings, neither chosen. The binary wording is still on the
page: `either Party` was not pluralised, because pluralising it *is* choosing
between three caps, one shared cap, and a cap that binds only inter se.

**Two kinds of not-knowing, reported side by side and labelled, because merging
them hides the smaller one.** `AUTHORED_DECISION_PENDING` is a clause classified
into a decision-requiring shape with candidates authored and nobody having
chosen — 2 in this deed, and they are what an advocate reviews.
`NOT_CLASSIFIED` is a clause never examined for N-party behaviour at all — 15,
including `PARTNERSHIP_CAPITAL_001`, the very clause D4.14 caught reciting a
third partner's profit share. Both are unresolved and deliberately so; only one
is an open question of law. Twenty of the second kind would have buried two of
the first.

---

## 63. Position is identity. Position is not economic-allocation identity.

Invariant 62 proved that a principal admitted at the intake reaches the page, and
that position is identity when the document says "Party 1". The obvious next step
is the wrong one:

> Three partners, three numbers in `40:40:20`, so the first number is the first
> partner's.

**That is an inference from ARITY, not from meaning**, and acting on it converts a
deed that is merely AMBIGUOUS into one that is CONFIDENTLY WRONG. The second is
strictly worse: an ambiguous sentence gets read twice and a confident one does
not. So economic attribution is proved per field rather than inherited from the
party-labelling result.

### What the repository actually established — measured before building

| | `capital_contribution_1` | `profit_sharing_ratio` |
|---|---|---|
| field name carries the ordinal | yes | no |
| label names the party | "Partner 1 Capital Contribution (₹)" | "Profit / Loss Sharing Ratio (e.g. 50:50)" |
| rendered sentence attributes it | "Partner 1 shall contribute X" | "shared among the Partners in the ratio of X" |
| every example it offers | — | has exactly two elements |

**One deed carries one of each.** Nothing anywhere — no blueprint, constraint,
requirement or annotation — relates a position in the ratio to a position in the
roster. So the three-partner deed was never wrong; it was unattributed, and had
been since long before anyone could type a third partner.

### The states, and the one path that reaches RESOLVED

`ROSTER_ADDRESSED` / `UNATTRIBUTED` / `CONFLICT` / `NOT_APPLICABLE`, with
`resolved` true only under the first. Attribution is established two ways and
only two:

- **`SCHEMA_INDEXED_SERIES`** — the field name carries the ordinal *and* the
  label names that principal. The person typing the number was told whose it was.
- **`NAMED_IN_VALUE`** — the value names the party: "Meera Iyer 40, Arjun Desai
  40, Sunita Rao 20". Every name is then checked against the roster, and a name
  matching nobody is a `CONFLICT` rather than a fourth partner.

**There has to be a path to a resolved allocation or the model is a refusal with
extra steps.** Naming the parties is that path, which is why the remedy asks for
names instead of offering to rearrange numbers.

### The seven cases

| case | result |
|---|---|
| 3 + `40:40:20` | arity MATCHES, attribution **UNATTRIBUTED** |
| 3 + `40:40` | FEWER_PARTS_THAN_PRINCIPALS, unattributed |
| 3 + `40:40:30` | sum reported as 110, **parts never rescaled** |
| 3 + `1/3, 1/3, 1/3` | parsed as FRACTIONS summing to 1, still unattributed |
| 4 + `40:40:20` | FEWER_PARTS_THAN_PRINCIPALS |
| 3 + named, all in roster | **ROSTER_ADDRESSED, resolved** |
| 3 + named, one stranger | **CONFLICT**, naming the stranger *and* the partner left without a share |

`40:40:30` is the interesting one. Read as percentages it leaves 10 unallocated;
read as a ratio it is perfectly good and means 40/110, 40/110, 30/110. **The field
is named for the second reading and every example it gives follows the first**, so
the instrument cannot tell which was meant. That is reported as the ambiguity it
is. Rewriting it to 36.36:36.36:27.27 would choose the reading and move money
between partners, so a test scans the resolver's source and fails on any division
by a total, any multiplication by 100, and the words "normalise" and "rescale".
**A resolver that can rescale an allocation can silently move money between
people.**

### This was never an N-party defect

`60:40` between two partners never said whose 60 it was either. The notice fires
at **every** party count, and suppressing it below three would assert that the
existing two-party corpus is fine when it has the identical gap. The roster work
made this visible; it did not cause it. Measured drift: three document types
gain one notice at both intake levels. **No clause added, removed or reordered;
80 documents across 40 types still byte-for-byte identical in text.**

A fixture weakness surfaced on the way: the baseline gave `profit_sharing_ratio`
the generic specimen string, which parses as narrative prose, so only
FOUNDERS_AGREEMENT — whose fixture already held "50:50" — exercised the new rules
at all. **A fixture that cannot reach a behaviour reports that behaviour as
absent.** Corrected to a real ratio, and the drift went from one family to the
three that actually collect one.

### The clause that was settled on one axis and open on another

`PARTNERSHIP_CAPITAL_001` now states every principal's contribution, because
`capital_contribution_N` *is* attributable — and says, in the deed, *"No capital
contribution is recorded in this Deed for Partner 3"* when one is missing. That is
a statement about the Deed, verifiable, and not a number somebody invented. Its
profit ratio remains unattributed and is governed by `allocation-semantics.json`,
not by the N-party shapes. **A clause can be N-safe as to cardinality and open as
to economics, and collapsing the two axes would report it safe while the money is
still unassigned.**

---

## 64. The portfolio ceiling: 12% classified, and the backlog now has two owners

Invariant 60's twenty-three clauses were the ones **one MSA fixture reached** —
never the portfolio. Swept across every family that can admit a third principal:

| | |
|---|---|
| document types in the corpus | 40 |
| types that can admit a third principal | **28** |
| distinct clauses those families reach | **184** |
| SAFE | 17 (9.2%) |
| AUTHORED_DECISION_PENDING | 5 (2.7%) |
| NOT_CLASSIFIED | **162 (88.0%)** |

**The number that matters is not how many are unresolved.** It is that 5 are
unresolved because a legal question was identified and deliberately left open,
and 162 are unresolved because nobody has looked. Those are different states with
different owners — an advocate, and whoever runs this sweep next — and before
this the repository could not tell them apart at portfolio scale. A single
"unresolved" bucket would be, in practice, a report that says nothing, because
the second is 32 times the first.

The family set is **derived from the admission rule, not from a list**: a family
counts as N-party capable exactly when `isRosterExtensionField` would admit its
third principal. A test asserts the derivation both ways — every included family
would admit one, every excluded family would not — so the sweep can never measure
a different portfolio than the engine admits.

**A seventh shape, and the only one established by evidence rather than by
reading a sentence.** `ROSTER_DRIVEN` covers clauses assembled *from* the roster
rather than written *about* two parties: `CORE_IDENTITY_001`,
`CORE_SIGNATURE_BLOCK_001`, `PARTNERSHIP_CAPITAL_001` — which were, before this,
the first, second and most-exposed unclassified clauses in the portfolio (28 and
25 families). There is no legal choice in listing the people who signed, so the
shape needs no decision; it needed a generation test, and cites the checks that
prove it at two, three and four principals. A test verifies each cited file
exists and contains the named check, because **evidence that cannot be located is
an assertion**.

**The classified set only grows.** A floor is recorded and enforced: a clause
falling silently back to NOT_CLASSIFIED — a renamed shape, a changed id, a
dropped entry — would return it to the invisible backlog with nobody told.

### What 28 N-party-capable families actually means

The admission rule made `party_3_name` acceptable on 28 document types, including
some where a third principal is doubtful — a promissory note, a power of attorney.
**No form exposes it**: `/document-config/:type` builds fields from the schema,
which still declares two, so the capability is reachable only by an API caller.
Whether each of those 28 *should* carry a third principal is family knowledge and
an advocate's question, recorded here as open rather than answered by me.

---

## 65. The next clause by exposure, and the method that would have missed it

`CORE_DISPUTE_RESOLUTION_001` — 36 document types, one rendered structure, the
highest-exposure unclassified clause in the portfolio. Probed, classified
**AUTHORED_DECISION_PENDING**, with a new decision and **no new shape**.

### What is settled, and what is not

| component | verdict |
|---|---|
| amicable resolution step | determined — a good-faith discussion among three is the same obligation as between two |
| appointment of the sole arbitrator | determined — CONSENT_OR_NOTICE_TO_OTHERS |
| interim measures under s.9 | determined — ALREADY_N_SAFE |
| **scope of the reference** | **UNDECIDED** |

The appointment sentence is worth stating precisely, because it *looks* like the
classic multi-party problem and is not. Where each side nominates its own
arbitrator, three parties cannot each have a nominee without unequal treatment
under **s.18**. This clause specifies a **sole** arbitrator jointly appointed, so
nobody has a nominee, and the fallback is count-independent: on failure to agree,
**s.11(5)** sends the appointment to the institution designated under **s.11(3A)**,
which works identically for two parties or four.

The open question is the reference scope: *may one party refer a dispute against
one other party alone, or must every party be joined?* At two parties, "refer the
dispute" and "refer it against the other party" are the same act. At three they
diverge, and an award between Party 1 and Party 2 binds neither Party 3 nor anyone
claiming under them (**s.35**), leaving Party 3 free to litigate the same facts on
the same instrument to a different result.

**No statutory default fills the gap.** The Act as amended through 2021 has no
provision for joinder or consolidation. The Supreme Court permitted consolidation
in *PR Shah v B.H.H. Securities* and the Delhi High Court in *Gammon India v NHAI*,
but as judicial practice rather than an entitlement, and an ad hoc reference has no
institutional rules to fall back on. The draft Amendment Bill, 2024 does not
address it and is not law. **The instrument is the only place this could have been
settled, and it does not settle it** — which is what makes the point UNDECIDED
rather than merely unstated.

### No new shape, and the test applied

`PAIRWISE_RIGHT` is recorded as a right arising from one party's default. The
default framing is **the instance it was drawn from, not its essence**. Stripped to
semantics: *a right exercised with respect to one other party, where more than two
parties force a choice between bilateral and multilateral effect.* That is the
reference-scope question exactly. A new shape would have read more neatly and
would have been an abstraction built because the architecture seemed to want one.
**Shapes are reusable; a decision is one question about one clause.**

### The result that matters more than the classification

The scan that found invariant 60's twenty-three clauses looks for "either Party"
and "the other Party". Run over this clause it flags **sentence 1** — the harmless
amicable-discussion step — and passes straight over **sentence 2**, which carries
the decision, because *"it shall be referred to arbitration"* names no party at
all.

> **Lexical party-reference scanning does not find N-party questions. It finds the
> subset visible in the pronouns.**

So the classified set is biased toward lexically-visible problems, and the 161
unclassified clauses may hold more of this kind: a question about *structure*
hiding in a sentence that mentions nobody. **12.5% is a ceiling on what has been
examined, not a floor on what is wrong.**

### A latent defect the clause exposed

This clause has two N-party components with different verdicts. The shape index is
`shapeOf.set(clauseId, shape)` — listing a clause under two shapes silently keeps
whichever entry is read last, no error, and the classification would depend on JSON
key order. It is listed once under the demanding component (any open decision makes
a clause PENDING however many of its sentences are settled), the settled components
are recorded in the decision's own `components` field, and **a test now fails if any
clause appears under two shapes**.

---

## 66. ROSTER_DRIVEN is proved by generation, or it is not ROSTER_DRIVEN

A shape asserted by citation decays into a shape asserted by appearance. So
membership is now checked by **differential generation**, every run: a
ROSTER_DRIVEN clause's shipped text must differ between a two-principal and a
three-principal deed, must name the third principal at three, and must not name
one at two. All three current members are proved this way, not merely cited.

**With a control, because a test that cannot fail proves nothing.**
`CORE_DISPUTE_RESOLUTION_001` is run through the same assertion and must *not*
satisfy it — its text is byte-identical at two and three principals, because it is
written *about* the parties rather than assembled *from* them. If that control ever
starts passing, the test has stopped discriminating and says so.

ROSTER_DRIVEN means: *N-party correctness established by tracing the authoritative
roster through generation and verifying the artifact.* It does not mean: *this
clause looks like it uses the roster.*

---

## 67. Admitted ≠ exposed ≠ legally supported

One commit made `party_3_name` acceptable on **28 document types**. That is a fact
about the engine. It is not a claim that a promissory note may have three makers,
and it is not permission for a form to start asking for one.

| level | what it is | count |
|---|---|---|
| `ADMITTED_BY_ENGINE` | structural — a third principal survives admission and reaches the artifact | **28** |
| `EXPOSED_BY_INTAKE` | product — the form offers a box for a third principal | **0** |
| `LEGALLY_SUPPORTED` | legal — an advocate established this family operates correctly above two | **0** |

**The gap between 28 and 0 is the containment, not an oversight.** An API caller
can build a three-party deed today and get a correct one. No user is *invited* to
by a form until somebody says the family is ready, because a form field is an
invitation and inviting a third principal into an unreviewed document is the
product asserting readiness it does not have.

The failure prevented is a quiet ratchet: somebody notices the backend accepts a
third principal, concludes the form should offer the field, and a structural
capability becomes an implied legal claim with no advocate having looked.
**Exposure follows legal support; it is never derived from admission.** The rule is
written as an implication — *exposed ⟹ reviewed, with a named reviewer* — so it
passes vacuously today and stops being vacuous the instant anyone adds a field.

Both levels are **measured, not declared**: admission from the same predicate
sanitisation uses, exposure from the same builder that serves
`/document-config/:type`. A record that can drift from the behaviour it describes
is worse than no record, because it is believed.

### Statutory permissibility is not instrument readiness

The same conflation one level down. The Partnership Act plainly contemplates more
than two partners; that says nothing about whether this deed's clauses have been
classified for three. Four families carry a statutory note and **none of them is
thereby supported**.

### The doubtful families are recorded, not excluded by intuition

`PROMISSORY_NOTE` and `POWER_OF_ATTORNEY` are admitted, and a third principal in
either is doubtful. The temptation is an exclusion list — which would be guessing
at the Negotiable Instruments Act, 1881 and the Powers-of-Attorney Act, 1882 in a
JSON file. Neither has been researched, so both are recorded `NOT_REVIEWED` with
`statute_permits_more_than_two: NOT_ASSESSED`, and a test fails if a statutory
position is ever asserted for them without the research behind it. An unreviewed
family is not exposed, so the containment holds without anybody having to guess.

---

## 68. The discovery method was systemically biased, and its replacement is too — measured, not assumed

D4.20 showed the pronoun scan missed `CORE_DISPUTE_RESOLUTION_001`. This asks
whether that was one blind spot or a defect in the method, and the answer is the
second — **with the important qualification that the replacement inherits a
weaker form of the same disease.**

### The pipeline, replacing "pronoun ⇒ N-party issue"

```
all clauses reachable by an N-party-admissible family
        ↓   mechanism detectors, each grounded in a demonstrated instance
semantic candidate + evidence
        ↓   adjudication, with verdicts recorded as data
TRUE_CANDIDATE / ALREADY_CLASSIFIED / FALSE_POSITIVE
```

Eight of the ten detectors are still lexical, and saying so matters — replacing
one word list with a longer word list would be theatre. Three things make it
different: every detector names a **mechanism this project has already
demonstrated on a real clause**; one detector (`RESPONDS_TO_ROSTER`) is not
lexical at all but renders the clause at two and three principals and compares
the shipped text; and the output is **evidence per candidate**, so verdicts can
be adjudicated and the errors counted.

### The result

| | |
|---|---|
| clauses reachable | 184 |
| flagged by the OLD pronoun scan | 49 |
| flagged by semantic mechanisms | 76 |
| **invisible to the old scan** | **27** |
| of those: true candidates / already classified / false positives | **16 / 3 / 3** (+5 folded) |

**`CORE_SURVIVAL_001` is the find.** 24 families, never examined, and it sits
*downstream of an already-open decision*: `TERMINATION_FOR_DEFAULT_SCOPE` asks
whether one party's default ends the instrument or one relationship, and survival
then asks what is left standing — a different answer under every candidate
treatment. Next to it, `CORE_WAIVER_001` (25 families): does one party's waiver
extinguish the right for the others, or only against the party it indulged?

### Precision: 42% raw, 89% repaired

The first run produced **59** new candidates. **34 were artefacts of four
detector defects** — `majority` matching *"the age of majority"*, `Recipient`
matching *"recipient GSTIN"*, `assign\w*` matching every copyright assignment in
the corpus, and `proportion` matching vesting over **time** rather than division
among **people**. Each is the same error as reading the generic plural "the
Partners" as an attribution: **a word that appears is not a mechanism that
operates.**

### Recall: the cleared clauses are not clean, and this is demonstrated

I sampled four of the clauses the repaired probe flagged with **nothing**, and
two of them were real:

- `CORE_STAMP_AND_COSTS_001` (22 families) — costs *"shall be **borne** equally
  by the Parties"*. The pattern knew "shared equally" and not "borne equally".
- `CORE_WAIVER_001` (25 families) — no mechanism for one party's unilateral act
  existed at all until this sample produced one.

A 50% hit rate on a sample of four is not a recall estimate. It is proof that
**the 108 clauses this probe flags with nothing are not a clean bill of health.**
Absence of a marker is not absence of a mechanism — exactly what D4.20
established about pronouns, now demonstrated about the richer vocabulary too.

### What replaces 184 / 17 / 6 / 161

The classification states are unchanged, because **nothing was classified here**
— this phase discovers and adjudicates, it does not decide. What changed is that
the 161 `NOT_CLASSIFIED` clauses are no longer undifferentiated:

| within NOT_CLASSIFIED | clauses | meaning |
|---|---|---|
| a binary pronoun the old scan saw and never classified | 30 | visible for phases, never acted on |
| newly found by a semantic mechanism | 22 | **prioritised work, each with a stated question** |
| no mechanism fires | 108 | no evidence either way — **and provably incomplete** |

"161 unclassified" was a number with no action attached. **21 clauses with a
stated legal question and an exposure rank** is a backlog somebody can work.

### The rule that survives all of this

> Generation can discover and generalise structural consequences of party count.
> It cannot resolve an unrecorded legal choice merely because N increased.

Every one of the 16 true candidates is recorded as a **question**, not an answer.
Not one clause was modified in this phase.

---

## 69. Marker-based discovery does not work on this corpus, and the burden of proof was backwards

D4.21 asked whether the pronoun scan had one blind spot or a systemic defect, and
answered "systemic" while leaving its own recall unmeasured. D4.22 measured it,
three ways, and all three agree: **the detector programme is falsified.**

### Experiment 1 — structural detection

A dependency graph already exists in the clause library: **306 edges, 168 clauses
declaring `depends_on`**, and `dependencyResolver.js` already distinguishes
`depends_on` (structural — A is incomplete without B) from `required_with`
(conditional co-presence). Only the first can transmit uncertainty, so only the
first is walked.

It recovers the model case exactly:

```
CORE_SURVIVAL_001 --depends_on--> CORE_TERMINATION_001
                                          ↓
                         TERMINATION_FOR_DEFAULT_SCOPE is UNDECIDED
```

without reading a word of the survival clause. **It finds two clauses in the
whole corpus.** Inheritance reaches only as far as the six open decisions extend,
so this detector is high-precision and **near-zero-recall by construction** — a
property of the method, not of the corpus.

### Experiment 2 — reading twelve

Twelve UNDETERMINED clauses, chosen deterministically so the sample is
reproducible rather than favourable. **Seven carry a real N-party question** —
a false-negative rate around **58%** in the population the detector had cleared.

`CORE_FURTHER_ASSURANCE_001` is the sharpest: *"Each Party shall, at the
reasonable request and cost of the requesting Party…"* — it contains the word
"Party" twice, never "the other Party", and was invisible to the pronoun scan
**and** to every semantic mechanism. `CORE_TERM_001` was missed on an inflection:
the pattern wanted "agreed by the Parties" and the text says "agree".

### Experiment 3 — vocabulary ablation

Strip the characteristic words from six clauses known to be cardinality-sensitive.

| clause | lexical before | after ablation | structural | survives |
|---|---|---|---|---|
| `CORE_SURVIVAL_001` | — | lost | **found** | **yes** |
| `CORE_TERMINATION_001` | found | lost | — | no |
| `CORE_DISPUTE_RESOLUTION_001` | found | lost | — | no |
| `CORE_LIMITATION_LIABILITY_001` | found | lost | — | no |
| `CORE_STAMP_AND_COSTS_001` | — | lost | — | no |
| `CORE_WAIVER_001` | — | lost | — | no |

**Five of six lost.** The detectors have not solved the problem; they recognise
the words. The one survivor survives structurally, which is the whole argument
for the graph and also the measure of how little the graph reaches.

### The cause is architectural, not lexical

> This corpus is drafted in **named roles** — Client and Consultant, Borrower and
> Lender, Assignor and Assignee, Fiduciary and Processor. A role-named clause is
> implicitly bilateral and never says so. *"The Client shall notify the
> Consultant"* carries exactly the same N-party question as *"either Party shall
> notify the other"*, and announces none of it.

No amount of vocabulary tuning fixes that. It is why `PARTY_ROLE_VARIANCE` fired
on **25 of 25** candidates in this probe's first run: it was detecting "does this
clause name a party", which is the pronoun scan with extra steps. It is demoted
to an asymmetric signal — **evidence against irrelevance is not evidence for
relevance** — and can now block a finding of NOT_RELEVANT while never
establishing RELEVANT.

### The inversion

**Stop discovering the relevant clauses. Discharge the irrelevant ones.**

The relevant set is large, has a high base rate and emits no signal. The
irrelevant set is small, closed and characterisable: rules about the *instrument*
rather than about *who signed it* — definitions, interpretation, severability,
counterparts, governing law. Only **two** of 108 could be positively discharged.

So the default flips. Every clause in an N-party-admissible family is
**presumed relevant until positively discharged**, and the work is discharge, not
search. That changes what the backlog means: 161 unclassified clauses are not
161 unknowns, they are **161 presumptively-relevant clauses of which 23 have been
resolved**.

### Reported separately, never blended

| measure | value |
|---|---|
| precision of the D4.21 detector | 89% after repair (3 false positives in 27) |
| recall of the D4.21 detector | unmeasurable by detection; **≈42%** by reading sample |
| ablation survival | **1 of 6** |

One coverage figure would have hidden that the detector is accurate about what it
finds and blind to most of what exists. A test now fails if a single blended
coverage number appears in the record.

### What stands

`CORE_SURVIVAL_001` is confirmed as the correct next clause — it is the one case
recoverable by mechanism rather than vocabulary, its question is framed by a
dependency that is already authored, and at 24 families it is the most exposed
unresolved clause in the portfolio. **No clause was modified in this phase.**

---

## 70. Presumption of relevance: detection may discharge, detection may not certify

D4.22's result, promoted from a probe finding to a methodological rule, because
continuing to tune detectors would be answering a question that has been settled:

> **N-party relevance is presumed for every clause reachable by an
> N-party-admissible family, unless evidence establishes irrelevance. Detection
> may DISCHARGE a clause; detection may not CERTIFY relevance.**

The asymmetry is the whole content. A detector that fires is weak evidence of
relevance — `PARTY_ROLE_VARIANCE` fired on 25 of 25. A detector that stays silent
is **no** evidence of irrelevance, because this corpus is drafted in named roles
and a role-named bilateral clause announces nothing. So detection is used only in
the direction where a wrong answer is cheap: proposing candidates, never closing
them.

**`NOT_CLASSIFIED` therefore means *not yet semantically discharged*.** It does
not mean "probably irrelevant", and a report that treats it as a clean bill of
health is misreporting the system. The accounting follows:

```
N-party-admissible clauses (184)
        ↓  presumptively in scope
  established treatment (24)  │  not yet discharged (160)
                              │    AUTHORED_DECISION_PENDING and NOT_CLASSIFIED
                              │    keep their existing, distinct meanings
```

The denominator did not change and neither did the states. **The default
changed.** A worse-sounding ceiling, which is the usual sign of the true one.

Precision, recall and ablation survival stay reported separately and never
blended — a detector can be 89% precise while being structurally incapable of
measuring its own recall here, and one combined figure would hide exactly that.
A test fails if a blended number appears.

---

## 71. The survival gap: a hole that only opens at three parties

`CORE_SURVIVAL_001` — 24 families — is in scope because of an authored edge to
`CORE_TERMINATION_001`. **The edge establishes scope, not ambiguity**, and
classifying on inheritance alone would be propagation mistaken for analysis. So
the counterfactual was enumerated rather than argued.

For three principals, after Party 1's default, which regime binds each pair:

| pair | World A — instrument ends | World B — relationship ends |
|---|---|---|
| 1–2 | SURVIVING | **NEITHER** |
| 1–3 | SURVIVING | **NEITHER** |
| 2–3 | SURVIVING | LIVE |

**Three of three pairs differ, and the trigger fires in A and not in B.** The
clause's trigger is *"expiry or termination of **this Agreement**"* — a single
global predicate — and its survivors *"continue to bind **the Parties**"*.

So under relationship-level termination the departing party falls outside **both**
regimes: the LIVE regime does not reach them because they are no longer a Party,
and the SURVIVING regime does not reach them because the Agreement has not
terminated — it is on foot between the others. **They walk away from
confidentiality and IP obligations, not because anyone released them, but because
the trigger is global and the termination was partial.** At two parties this
cannot happen: departure and termination are the same act.

### A conditional dependent decision — neither inherited nor independent

| parent treatment | world | does choosing it settle survival? |
|---|---|---|
| `ENDS_THE_INSTRUMENT` | A | **yes** — trigger fires, everyone stays bound |
| `REQUIRES_ALL_INNOCENT_PARTIES` | A | **yes** — still instrument-level |
| `ENDS_THAT_RELATIONSHIP` | B | **no** — a second choice is required |

The question arises under **one of three** parent treatments. Recording it as
inherited would assert a question where none exists; recording it as independent
would hide that one choice disposes of it entirely. So it is
`SURVIVAL_AGAINST_A_DEPARTING_PARTY`, carrying `conditional_on`, under the
**existing** `PAIRWISE_RIGHT` shape — no survival-specific shape invented,
because the mechanism is the one that shape already names.

This matters for how the backlog is counted: an advocate choosing
`ENDS_THE_INSTRUMENT` closes two questions at once; choosing
`ENDS_THAT_RELATIONSHIP` opens a second. A flat list of open decisions shows
neither.

### What reading the clause turned up that assuming it would not

I had hardcoded the surviving set as five provisions. The clause enumerates
**nine**, and three of them carry open decisions of their own — indemnity,
limitation of liability, dispute resolution. **The gap compounds.** Under World B
the departing party escapes the liability cap too, which cuts both ways: the cap
that no longer binds them no longer protects them. Whether that is a windfall or
an exposure depends on `LIABILITY_CAP_APPORTIONMENT`, which is itself open — so
these decisions cannot sensibly be taken in isolation.

Ceiling now **24 established / 160 not yet discharged**. No clause was modified.

---

## 72. The six decisions are not a flat list, and the danger is contradiction rather than conditionality

D4.23 left two hypotheses: that `conditional_on` needs engine enforcement, and
that the decisions may not be independent. Both were measured before either was
built. Six decisions, thirty ordered pairs:

| edge | count |
|---|---|
| `DETERMINES` | **0** |
| `GATES` | **1** |
| `CONSTRAINS` | **6** |
| `INDEPENDENT` | 23 |

**No decision's answer fixes another's, and exactly one can delete another
question.** The structure is real and thin.

### So: named edges, not a mechanism

A general treatment-level conditionality engine would be built to carry **one
live instance**. That is abstraction-on-spec, and the answer is to model the edge
explicitly and wait. A test now fails if a second `GATES` edge or any `DETERMINES`
edge appears, with a message saying that is the evidence which would justify
revisiting — so the conclusion can be overturned by measurement rather than
inherited by default.

### The finding that outranks the one we went looking for

Two of the six edges carry a named risk, and **both are about answers that
contradict, not questions that disappear**:

- `INCONSISTENT_ANSWERS` — the liability cap with the indemnity
- `SELF_DEFEATING_COMBINATION` — survival with arbitration reference scope

The second is the sharper one. Dispute resolution is an enumerated survivor, so
`DEPARTING_PARTY_RELEASED` releases the departing party from the **arbitration
agreement too** — leaving no forum in which to determine whether they were validly
released, or to enforce the accrued rights the same clause preserves.

An advocate working a flat checklist can answer two consecutive lines coherently
and produce an incoherent instrument. Nothing in the current model would notice.
**The engine gap worth building is a consistency check across resolved treatments
— not conditionality.** It is not built here, because one measurement is not yet a
case for either.

### Computing the conflict corrected my account of it

I wrote that `SHARED + SEVERAL_TO_EACH` conflicts while `PER_PARTY +
SEVERAL_TO_EACH` is coherent. The arithmetic disagreed:

| cap + indemnity | indemnity promises | cap permits | coherent |
|---|---|---|---|
| SHARED + SEVERAL_TO_EACH | ₹50,00,000 | ₹10,00,000 | **no** |
| PER_PARTY + SEVERAL_TO_EACH | ₹50,00,000 | ₹30,00,000 | **no** |

The tension is not a quirk of one pairing. **An indemnity in which everyone owes
everyone the whole loss outruns any finite cap once the parties outnumber two**,
and which clause yields is a third question nobody has asked. The figures are
computed in the probe, so the claim cannot drift away from the numbers again.

### A cycle has no order, and the ordering hid one

The resolution order is now:

1. `TERMINATION_FOR_DEFAULT_SCOPE`
2. `TRANSITION_ASSISTANCE_SCOPE`, `SURVIVAL_AGAINST_A_DEPARTING_PARTY`
3. **`INDEMNITY_APPORTIONMENT` and `LIABILITY_CAP_APPORTIONMENT` — jointly**
4. `ARBITRATION_REFERENCE_SCOPE`

The first version computed in-degrees while **skipping bidirectional edges**,
which placed the indemnity in tier 1 and the cap in tier 3 — a sequence between
two decisions that each constrain the other. The cycle was being hidden inside
the artifact built to expose it. Mutually constraining decisions are now collapsed
into a joint node: **they are one decision with two parts**, and a test fails if
they are ever given a sequence again.

`TERMINATION_FOR_DEFAULT_SCOPE` leads because it gates one question and
constrains another — a scheduling fact a flat list cannot express, and the reason
this matrix was worth building before any answer was authored.

---

## 73. The cross-treatment inconsistency is a drafting gap, and the repository already contains the fix

D4.24 found that a liability cap and an indemnity, each answered admissibly, can
jointly promise more cover than the cap permits, and that looked like the case for
a cross-treatment consistency engine. The guarantee family was chosen to falsify
it because it is not another MSA with different role names — it has a statute that
speaks directly to multiple obligors.

**It does not reproduce.** Founders: 2 of 2 combinations incoherent. Guarantee:
**0 of 2**. And the two reasons are different from each other.

### One — the guarantee family already drafts the interaction, from both ends

> `GUARANTEE_OBLIGATION_001`: the cap applies *"taken together with any liability
> under the indemnity given in this Agreement"*
>
> `GUARANTEE_INDEMNITY_001`: the indemnity *"forms part of, and shall not
> increase, the aggregate cap"*

Belt and braces, deliberately. The two clauses **cannot** promise more than the cap
permits, because each says so about the other. The families that carry the two
decision-bearing clauses together — lease, employment, founders, leave-and-licence,
NDA — say nothing of the kind.

### Two — s.146 does not resolve the conflict, because there is none for it to resolve

This is the part I was told to test rather than assume, and testing changed the
answer. **s.146 allocates as between the co-sureties**, in the absence of contract
to the contrary. **The cap bounds what the creditor may recover**, under s.128's
*"unless it is otherwise provided by the contract"*. A rule about contribution
between sureties and a rule about the creditor's reach operate on **different
axes** and therefore cannot contradict each other.

Had I assumed the statute resolves the conflict, I would have recorded a plausible
story with the right conclusion and the wrong mechanism — and the generalisation
drawn from it would have been wrong wherever no statute exists.

### The generalisation, narrower than `INCONSISTENT_ANSWERS` and better

> Cross-treatment inconsistency arises where two treatments quantify **the same
> exposure on the same axis** with no precedence rule between them. It does not
> arise where an express interaction clause orders them, and it does not arise
> where a statute allocates on a different axis.

So **the defect is a missing interaction clause, not a missing engine** — and the
remedy already exists in this repository, authored by the same hands, in another
family. A consistency checker would be a detector for a defect that one sentence
of ordinary drafting prevents. That is the opposite of what D4.24 appeared to
point at, and it is why the engine was not built.

A test now fails if a cross-treatment consistency engine appears, naming the
conclusion it would be overturning so the assertion is replaced deliberately
rather than deleted.

### The reachability correction

My first run asked the MSA for `CORE_INDEMNITY_FULL_001`. **The MSA does not ship
it** — it carries `CORE_INDEMNITY_001`, a different clause with no open
apportionment decision. I had nearly drawn a comparative conclusion from a pairing
that does not co-occur in the document I tested.

Measured instead: **21 document types carry a cap and an indemnity; 5 carry the
two decision-bearing clauses together**, and four of those five admit a third
principal today. The D4.24 arithmetic is reachable by a real user, not
hypothetical — which is what makes the drafting gap worth closing.

### What is untouched

**The N-party question survives.** *"The aggregate liability of the Guarantor"*
with three co-guarantors is still per-guarantor or shared, and s.146 does not
answer it because it speaks to contribution rather than to the ceiling.
`LIABILITY_CAP_APPORTIONMENT` therefore reaches the guarantee family too. Nothing
was classified, no clause was modified, and no engine was built.

---

## 74. The port was refused, and refused on measurable grounds

D4.25 left an obvious next move: the guarantee family orders its cap against its
indemnity, five families do not, so port the sentence. The instruction was to
extract the **semantic contract** rather than copy the wording, and to build one
reusable treatment **only if the semantics are genuinely identical**.

**They are not**, and the evidence is mechanical rather than a matter of taste.

The shipped cap in all five families reads *"shall not exceed the total
consideration paid under this Agreement"*. **`NDA` and `FOUNDERS_AGREEMENT`
collect no consideration field of any kind** — no fee, amount, price or value the
phrase can measure, and in an NDA the consideration is frequently nil by design.

So folding a mutual confidentiality indemnity into that cap would not *limit* the
indemnity. It would **erase** it. The same sentence that is a real ceiling in a
guarantee, where the cap is a stated rupee figure, is an extinguishment in an NDA.
That is precisely the failure "extract the contract, don't copy the wording" was
guarding against, and it would have been invisible to anyone who ported on the
strength of the clause text — which is **byte-identical across all five families**.

### What the guarantee sentence actually asserts

> Two provisions quantify the same exposure, and one is declared to be consumed by
> the other's ceiling.

The guarantee picks one of **three** available directions:

| direction | appropriate where | destroys the indemnity where |
|---|---|---|
| `INDEMNITY_INSIDE_CAP` | the cap is a stated figure | the cap has no referent or is nil |
| `INDEMNITY_OUTSIDE_CAP` | the harm is unquantifiable or falls on third parties | — |
| `PARTIALLY_CARVED_OUT` | some heads inside, some outside | — |

The third is the most interesting, because **the instrument is already doing it**.
The cap carves out *"fraud, wilful misconduct, or liabilities that cannot be
limited under applicable law"*; the indemnity triggers on *"breach of this
Agreement, negligence, or wilful misconduct"*. Wilful misconduct is therefore
already outside the cap **and** already an indemnity trigger — the two clauses
already interact coherently on one of three heads. **Breach and negligence are
where nothing has been said.**

### Recorded, not resolved

An `UNDECIDED` decision with three candidate directions, per-family analysis, and
the authority for each. No clause text changed, nothing attached, no engine built.
Three engine hypotheses are now recorded as **falsified rather than deferred** —
conditionality (D4.24), cross-treatment consistency (D4.25), and the single
portable treatment (D4.26).

### The adversarial fixture asserts the defect, not the fix

Cap, indemnity, three principals, both clauses decision-bearing, in one generated
`FOUNDERS_AGREEMENT`. The test asserts that the document **does not** order the two
clauses — the defect stated as a fact about the artifact — with a failure message
saying that if it ever flips, that may be the fix landing and the governance record
should be updated rather than the assertion allowed to change silently. The
guarantee family is the permanent regression case for the resolved pattern.

**A test that passes by describing a hoped-for state is how a suite starts lying.**

### The boundary that was protected

`LIABILITY_CAP_APPORTIONMENT` remains open and untouched. Ordering the indemnity
against the cap says nothing about whether the cap is per-party, shared, or inter
se at three principals. A test fails if any candidate direction names an
apportionment treatment, because **a drafting fix must not answer an open legal
question as a side effect**.

### Incidental, and independent of everything above

A ceiling measured on *"the total consideration paid"* in two families that
collect no consideration is not a limitation of liability — it is an unresolved
reference a court would have to fill. Worth repairing on its own terms, and
unrelated to both the interaction question and the N-party question.

---

## 75. Measurement precedes interaction, and the cap cannot be computed in ten families

D4.26 refused to port the guarantee's interaction sentence because two families
collect no consideration for the cap to measure. The finding is deeper than "do
not copy the sentence":

> **Byte-identical clause text is not evidence of semantic interchangeability.
> The underlying measurement variable decides what the words do.**

That puts a question *before* the interaction question:

```
CAP_MEASUREMENT
    ├── measurable   → the interaction decision may be meaningful
    └── unmeasurable → the interaction decision is BLOCKED
```

Asking an advocate whether the indemnity consumes a ceiling that cannot be
computed is asking them to order a clause against a quantity that does not exist.
The answer would be recorded, would look like progress, and would mean nothing.

### Measured across 22 cap instances — two failures, not one

| state | families | |
|---|---|---|
| `CONFIGURABLE_AND_SUPPLIED` | 6 | the user picks a basis and the intake holds the quantity |
| `FIXED_PROSE_MEASURABLE` | 6 | no basis question, but the measure happens to be collected |
| **`OFFERS_A_BASIS_IT_CANNOT_SUPPLY`** | **4** | distribution, JV, partnership, shareholders |
| **`FIXED_PROSE_UNMEASURABLE`** | **6** | DPA, founders, NDA, privacy policy, share subscription, ToS |

They are kept apart because they need different repairs. The first is an
**intake** defect: the form offers *"Fees paid or payable in the 12 months before
the claim"* to a partnership deed, where partners pay each other no fees — the
option is category-wrong for the family, not merely unsupported. The second is a
**drafting** defect: no basis question at all, and fixed prose measuring something
the family never collects. D4.26 found two of these by hand; there are six.

### The interaction question is two heads wide, not one clause wide

The cap already carves out three heads; the indemnity triggers on three; they
overlap on exactly one.

| head | cap | indemnity trigger | state |
|---|---|---|---|
| fraud | carved out | no | settled |
| wilful misconduct | carved out | **yes** | settled — the one head where the clauses already interact coherently |
| unlimitable by law | carved out | no | settled |
| **breach of agreement** | not addressed | yes | **unresolved** |
| **negligence** | not addressed | yes | **unresolved** |

A Boolean *"is the indemnity capped?"* would overwrite three settled heads to
answer two open ones. This is visible only because the clause text was read rather
than summarised.

### Three layers that must not contaminate each other

**MEASUREMENT** — what does the ceiling measure? Blocks everything below.
**INTERACTION** — per head, does the indemnity consume it, sit outside it, or is
it carved? Blocked wherever measurement is unresolved.
**APPORTIONMENT** — with N principals, per-party, shared, or inter se? Open,
untouched, and asserted untouched.

### A finding I retracted before recording it

Correcting the field list turned up what looked like something worse: ten families
collect `liability_cap_amount` — a figure the user types — while the clause states
a formula, so the number never reaches the page. The D4.14 class of failure, and it
would have been a serious find.

**It is not a defect.** `draftConsistencyValidator.js` already reports
`LIABILITY_CAP_ANSWERS_CONFLICT`: the user also chose a *basis*, the clause follows
the basis, and the validator says in terms that the figure has not been used.
Verified by generating three of the ten and reading the output.

The retraction is kept in the record because it is the useful part. The probe was
one step from reporting correct, already-disclosed behaviour as a bug, and what
stopped it was **checking whether the system already said so rather than treating
silence as confirmation**.

### Three vocabulary defects in one probe

This probe's word lists were wrong three times: `total_fee` and `price` were
missing, so four families were called unmeasurable when they are not; and a
fee-specific regex misclassified lease, employment and guarantee, whose caps read
rent, salary and the guaranteed amount. Each was caught by checking the schema
rather than trusting the list.

**Every time this phase has written a vocabulary, the vocabulary has been wrong.**
The measurability question is now asked once, against the measure the clause itself
names, and reused — not re-derived from a second word list.

---

## 76. The methodology is now data, and the cap has five layers

Two things promoted from conclusions to artifacts, because both bind the next
probe rather than describing the last one.

### Five rules, each learned by breaking it

| rule | learned in | what it would have caught |
|---|---|---|
| `CHECK_WHETHER_THE_SYSTEM_ALREADY_SAYS_SO` | D4.27 | reporting `LIABILITY_CAP_ANSWERS_CONFLICT` as an undiscovered defect |
| `A_VOCABULARY_DECIDES_THE_FINDING` | D4.21, D4.22, D4.27 | 34 false candidates; five of six clauses lost to ablation; three word-list defects in one probe |
| `READ_THE_SOURCE_DO_NOT_SUMMARISE_IT` | D4.25, D4.28 | s.146 credited with resolving a conflict it never touched; a UK statutory bar imported into Indian law |
| `COMPUTE_THE_CONSEQUENCE` | D4.24 | prose calling `PER_PARTY + SEVERAL_TO_EACH` coherent when the arithmetic says otherwise |
| `ASSERT_THE_STATE_NOT_THE_HOPE` | D4.26 | a fixture asserting a fix that had not landed |

The first is the load-bearing one:

> **A probe must establish whether the production system already recognises and
> discloses the alleged condition before classifying it as a defect.**

Without it the measurement probes become a source of false legal conclusions —
the exact failure they exist to prevent, arriving through the instrument meant to
prevent it.

A test asserts each rule cites its phase and its failure, and that none has been
softened into a suggestion. **That test failed on my own authoring**: one rule was
phrased in the imperative while the other four said "must", and the check was
looking for a word rather than the property. Both were repaired — the rule states
its obligation explicitly, and the check now recognises imperative mood.

### The cap has five layers, in order

```
MEASURE ─── computable?    10 of 22 instances are not          (D4.27)
        └── well-defined?  a cumulative measure is not a figure (D4.28)
SCOPE       which heads does the ceiling reach?
EXCLUSIONS  fraud, wilful misconduct, unlimitable by law — settled
INTERACTION per head: breach and negligence — open, blocked where measurement is
APPORTIONMENT per-party, shared, or inter se — LIABILITY_CAP_APPORTIONMENT, open
```

**None may resolve another as a side effect**, and the test asserts the ordering
and the block.

---

## 77. MEASURABLE was necessary and not sufficient: the cap is a function of time

D4.27 asked whether the ceiling can be computed and answered it. D4.28 took the
two families where the answer was yes — commercial lease and leave-and-licence,
where the cap reads rent or licence fee — and asked what it computes.

A lease at ₹2,50,000/month, against a ₹40,00,000 third-party claim:

| month of term | cap = rent paid to date | share of the claim recoverable |
|---|---|---|
| 1 | ₹2,50,000 | **6%** |
| 6 | ₹15,00,000 | 38% |
| 12 | ₹30,00,000 | 75% |
| 16+ | ₹40,00,000+ | **100%** |

**The same clause recovers 6% in month one and everything from month sixteen.**
Nobody chose that. It is an artefact of measuring a ceiling on a **cumulative**
quantity: protection depends on when the harm happens rather than on what the
parties agreed, and a tenancy is most exposed in its first months — precisely when
this cap is smallest.

So the measurement layer has two questions and D4.27 asked only the first.
**Computable is not well-defined.**

### The two heads, stated as narrowly as the evidence allows

> For a commercial lease and a leave-and-licence agreement, where the ceiling is
> measured on rent or licence fee paid to date: do the **breach** and
> **negligence** heads of the mutual indemnity sit inside that ceiling, outside
> it, or inside it subject to a floor?

Deliberately not bundled in: the three settled heads; whether the cumulative
measure is the right measure at all; and how the ceiling applies across more than
two principals.

### The authority, and the thing it is easy to get wrong

Contract Act **s.23** (public policy), *Simplex Concrete Piles* (a clause barring
s.73 claims is void under s.23), *Central Inland Water Transport* (an unreasonable
clause between parties of unequal bargaining power is void under s.23).

**Secondary sources state that excluding liability for death or personal injury
caused by negligence is "automatically void" — and attribute it to common law
principles. India has no Unfair Contract Terms Act.** The constraint runs through
s.23 and unconscionability, which are fact-sensitive and turn on bargaining power,
not through a bright-line statutory bar.

What follows for the negligence head is therefore narrower than "it cannot be
capped": such a cap is **arguable rather than void**, and its vulnerability rises
as the ceiling falls — which, on the arithmetic above, is exactly when the tenancy
is newest.
