# LegalAId invariants

These are not implementation details. Each one is a property the system must
hold whatever else changes, each was established because its absence produced a
real defect, and each is pinned by a named test. Breaking one should fail the
build, not surprise a user.

---

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
