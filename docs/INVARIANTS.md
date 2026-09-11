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

**Today: 0 approved, 4 falsification-passed, 36 not assessed.** The only number
that may ever be put in front of a user as *supported* is the first one.

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
