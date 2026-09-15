# Phase B — canonical fact resolution

**Objective (narrow, as set):** generation and assessment must consume the same
resolved facts, without duplicating derivation logic.

**Success criterion, restated so it cannot drift:** every requirement evaluates
against the same semantic facts generation used, with no assessment-only
reconstruction. *Not* "make 9/9 green." Nine of nine are now determinate, but
that is a consequence, and four of them are determinate as `NOT_APPLICABLE` —
findings of fact resting on derivations that still carry open legal questions.

---

## What the defect was

Two fact planes.

```
clause selection   deriveGenerationControls(documentType, variables)
assessment         resolution.positions        (the fact-question layer)
```

A requirement conditioned on a derived fact could never become applicable,
because derived facts never appear in `resolution.positions`. The document
shipped the clause the fact had gated while the report said nobody knew whether
it applied. Nine of nine conditional requirements, across three families.

## What replaced it

```
raw intake
    |
 sanitise
    |
 resolveCanonicalFacts        <-- ONE normalisation, ONE classification
    |          |
generation  assessment
```

Resolved in `prepareGenerationInput`, **upstream of the derivation and upstream
of clause selection**, then overlaid onto the variables everything downstream
reads and carried to `buildSuccess` rather than recomputed there.

Three properties, each load-bearing:

- **One derivation.** `canonicalFacts` calls `deriveControlsForDocument`; it
  never reimplements a derived fact. A resolver that recomputed `is_secured` its
  own way would replace one divergence with another and be harder to see.
- **A declared surface.** `deriveGenerationControls` produces 87 controls for an
  MSA. Seven facts are declared in `knowledge-base/intake/semantic_facts.json`
  and nothing else is exposed, so that function does not become the system's
  semantic model by accident.
- **`kind` is authoritative.** A `DECLARED` fact reads the intake field named in
  `established_by` and is normalised — it does **not** pass through the
  generation-control derivation. A `DERIVED` fact does, and is reported derived
  even where the value is identical to a declared one.

---

## The four-axis parity invariant

`tests/factSourceParity.test.mjs`. Equal booleans would be satisfied by two
independent derivations that agree on today's fixtures and diverge on tomorrow's
— the exact failure this phase exists to remove. So:

| Axis | What it asserts |
|---|---|
| VALUE | the tri-state position, compared through `positionOf`, not the raw cell |
| PROVENANCE | an answer and a derivation are different evidence at the same value |
| EVIDENCE | which intake field established it, named, and present on this schema |
| SOURCE | assessment holds no fact generation lacks, and none undeclared |

12 established facts across 5 families, plus seven mutations.

| # | Mutation | Required behaviour |
|---|---|---|
| M1 | change a declared input | both halves change; provenance stays `declared` |
| M2 | change a derived input | both change identically; provenance stays `derived` |
| M3 | silence on an optional question | both go unknown; no requirement makes a finding |
| M4 | move a generation-only control | canonical facts byte-identical |
| M5 | swap the derivation arguments | adapter **and** resolver refuse, observably |
| M6 | provenance across the boundary | a derived fact is still derived in assessment |
| M7 | the state space | every answer has a document behind it |

---

## Defects found along the way, by layer

The chain mattered more than any single link: each repair exposed the next.

| # | Layer | Defect | Status |
|---|---|---|---|
| 1 | **FACT PARITY** | assessment never saw derived facts; 9/9 conditional requirements permanently undetermined | repaired |
| 2 | **DERIVATION** | `is_secured` classified by what the generation pipeline happened to produce, not by its declaration — the two-fact-plane problem moving into the new resolver | repaired: `kind` is authoritative, declared facts leave the derivation path |
| 3 | **NORMALIZATION** | a select's own word reached clause selection as `"Yes"` and assessment as `true`. Both were right, because both called `positionOf` — two call sites of one function is not one value | repaired: canonical values overlaid upstream; generation now carries booleans |
| 4 | **VALIDATION / STATE SPACE** | `security_collateral` declared `required: false` in the schema and listed in `DOCUMENT_CONFIG.requiredFields`; the resolution rule takes either as authoritative, so the Phase A repair could never take effect | repaired: conditional requirement |
| 5 | **VALIDATION** | the old rule told the user to write `"Unsecured"` — one of the phrasings that used to produce a **secured** loan. The product instructed the user into the trap, then validated that they had taken it | repaired: the answer is the authority, the text only describes it |
| 6 | **TEST DEFECT** | M3 deleted a required field; generation refused; the assertion "the fact is unknown" passed for a reason unrelated to the semantic layer | repaired: silence tested where silence is reachable; `bothHalves` now throws on a blocked generation |
| 7 | **TEST DEFECT** | M4 mutated `special_terms`, which is not a field on the MSA schema; sanitisation stripped it and the control never moved | caught by M4's own guard; now uses `contract_value` |
| 8 | **TEST DEFECT** | M3 filtered assessed results by `applicability.position`, a field the result object does not carry. Matched nothing and reported "0 requirements undetermined" as a pass | repaired: requirements looked up from the declarations |
| 9 | **TEST DEFECT** | three fixtures expressed an unsecured loan by answering "No" while keeping collateral text — the only way to express it before repair #4 | repaired in all three |
| 10 | **CLAUSE DEFECT** | `LOAN_DEFAULT_001.required_with` names `LOAN_SECURITY_001`; the dependency resolver injects a referenced clause without consulting the gate that excluded it, so an unsecured loan ships a security clause | **open**, frozen in `tests/positionOverride.test.mjs` |
| 11 | **MEASUREMENT** | the static edge inventory predicted 12 gate-defeating dependencies; runtime confirms 1 | inventory kept as architecture, runtime is authoritative for the parity claim |

### The state space, measured

`is_secured = false` claimed to represent an unsecured loan and the product could
not produce one.

| `loan_is_secured` | `security_collateral` | before | after |
|---|---|---|---|
| Yes | supplied | generates | generates |
| Yes | absent | refused ("Missing required field") | refused, naming the actual reason |
| **No** | **absent** | **refused — state unreachable** | **generates** |
| No | supplied | generates, contradiction discarded in silence | refused, contradiction stated |

Row 3 is the finding. A question was asked, "No" was offered as an answer, and
the document that answer describes could not be produced. The only route to an
unsecured loan was to write collateral into a field whose own description says
nothing written there can make a loan secured — so the intake asserted security
while the agreement denied it.

`requiredWhenShown` was added to the schema because `required` is a boolean and
cannot say *when*. That absence is what let the two declarations disagree.

---

## What Phase B does not claim

- **Determinate is not correct.** Four of the nine now report `NOT_APPLICABLE`,
  including the POSH Internal Committee and maternity requirements on a fixture
  answering "fewer than 10". Those rest on derivations whose legal correctness is
  an open question carried on the requirements themselves. Parity made the
  question visible; it did not answer it.
- **Defect #10 is untouched.** An unsecured loan still ships a security clause.
  Both halves agree the loan is unsecured and the document is wrong anyway — which
  is the cleanest available demonstration that clause correctness is a different
  axis from fact parity.
- **The 12-edge dependency inventory is architecture, not a finding.** One edge
  fires at runtime. Two of the three that looked substantive (`EMP_CONFIDENTIALITY_001
  -> EMP_NON_COMPETE_001`, `CORP_TAG_ALONG_001 -> CORP_DRAG_ALONG_001`) do not
  fire, because the source clause is absent or the target is suppressed elsewhere.
