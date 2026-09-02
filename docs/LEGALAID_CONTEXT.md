# LegalAId — full system context

A briefing for an AI assistant with no prior knowledge of this project. Everything
below was measured from the codebase on **2 September 2026**, not recalled. Where
something is uncertain it is marked as such.

---

## 1. What it is

**LegalAId** generates Indian legal documents — contracts, policies, notices,
affidavits — from a structured intake form. It is not a template-filler with a
thin AI wrapper, and it is not an AI that writes contracts. It is a
**rule engine that selects and assembles clauses**, with an optional LLM pass
that may only rewrite the wording of clauses the engine already chose.

- **Live at:** legal-aid.xyz
- **Repo:** GitHub `DevrajBhore/LegalAId`
- **Hosting:** Render
- **Local dev path:** `D:\dev\LegalAId` (Windows)
- **Jurisdiction:** India only. Every clause carries `"jurisdiction": "India"`.

### The central design commitment

> The AI can never add, remove, or reorder a clause.

The rule engine decides the clause set deterministically. The LLM receives that
set and may return rewritten text per clause. `mergeAIDraftWithSeed` keeps the
seed's exact clause list and substitutes AI text only where the model returned
something usable. After the merge, ~108 runtime builders re-compose clause text
from variables, then `lockCriticalClauses` marks identity, governing law,
dispute resolution, signature blocks and liability caps as untouchable.

This is deliberate and load-bearing. Any proposal that lets a model decide
*which* clauses appear contradicts the product's core safety claim.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, ESM (`"type": "module"`), Express 4 |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, email verification |
| Email | Resend (primary), nodemailer/SMTP/Mailtrap fallbacks |
| Export | `docx` 8.5 and `pdfkit` 0.18 — **both write-only** |
| AI | Gemini (`@google/generative-ai`), Groq, OpenAI-compatible |
| Frontend | React 19, Vite 5, React Router 7, Axios |
| Rate limiting | `express-rate-limit` |

**Three separate `package.json` files** — root (tests/scripts only), `backend/`,
`frontend/`. The root one carries an explicit warning comment: declaring server
packages at both levels previously installed two different Mongoose instances,
so `connect()` succeeded while every query buffered and timed out.

### There is no ingestion path

`docx` and `pdfkit` both only write. There is no `multer`, no `mammoth`, no
`pdf-parse`. **The system cannot read an uploaded document.** This surprises
people, so state it plainly when scoping features.

---

## 3. Repository layout

```
LegalAId/
├── backend/
│   ├── index.js              Express app, all routes, boot invariants
│   ├── ai/                   7 files: provider abstraction + prompt building
│   ├── auth/                 authRoutes, authMiddleware, emailService
│   ├── config/               documentConfig, variableConfig, essentialFields, clauseOrder
│   ├── models/               5 Mongoose models
│   ├── routes/               clauseReview, documentHistory, libraryReview
│   ├── services/             50 files, ~18,800 LOC — the bulk of the system
│   ├── commercial/           commercialEngine, protectionDetector, signalDetector
│   ├── ire/                  runner.js, commercialValidator.js (bridge to IRE)
│   └── utils/                riskAggregator.js
├── IRE/                      "Indian Rule Engine" — 49 JS files
│   ├── engine.js             6-layer validation orchestrator
│   ├── bootstrap.js          loads the knowledge base at boot
│   └── src/
│       ├── indian-rule-engine/   constraintEngine, validators, planner, certifier
│       ├── universal/            contract-law primitives (consent, consideration…)
│       └── statutes/             statute loading and rule compilation
├── knowledge-base/           ALL legal content, as JSON data (not code)
│   ├── clause_library/       297 clauses across 11 category folders
│   │   └── blueprints/       46 document blueprints
│   ├── constraints/          5 files, 40 constraint rules
│   ├── rules/                7 rule files (stamp duty, registration, illegal clauses…)
│   └── metadata/             statute_versions, verification_coverage, drafting_policies
├── shared/                   documentRegistry, documentShape, clauseProvenance
├── frontend/src/             React app
├── tests/                    21 test files + golden corpus + clause baseline
├── scripts/                  freezeClauseBaseline, checkStatuteCitations, review pack
└── docs/                     CONCEPT_LAYER.md, this file
```

**Guiding principle:** legal knowledge lives in `knowledge-base/*.json` as data an
advocate can read and approve; code lives in `backend/` and `IRE/`. The
constraint engine's own comment states the rationale:

> the predicate vocabulary below is deliberately CLOSED: a general expression
> language would stop being reviewable, which is the whole point of keeping
> rules out of code.

---

## 4. The generation pipeline

Entry point: `generateDocument(input, options)` in
`backend/services/documentService.js` (656 lines).

```
1.  validateInputByDocumentType(input)
      └─ fails → INVALID_INPUT_n, severity CRITICAL, nothing is generated

2.  prepareGenerationInput(input)
      └─ deriveGenerationControls() turns facts into ~57 derived flags

3.  Blueprint → clause set        clauseAssembler.assembleDocument
      ├─ required_clauses         always included
      ├─ conditional_clauses      include_if: "flag == value"
      └─ variant_clauses          slot replaces one clause with another

4.  applyGenerationStages(draft, input)   ← the deterministic core, in order:
      resolveDependencies          depends_on / required_with graph
      injectJurisdictionRules      seat, venue, governing law
      injectDoctrine               universal contract-law doctrine
      enforceScopeGuard
      resolveSignatures
      applyDocumentHardening       108 runtime builders, 352 `variables.` reads
      applyDocumentQualityControls
      enhanceCommercially
      lockCriticalClauses
      CategoryMapper.mapAndNormalize
      normalizeClauseText
      applyDocumentQualityControls (again)

5.  IF semantic generation enabled AND a provider is configured:
      attemptSemanticDraft()  → callAI() → mergeAIDraftWithSeed()
      → applyFinalDraftGuardrails()  (hardening + locking + normalising again)
      Falls back to the deterministic draft if the merge fails validation.

6.  runGenerationStageValidation()   → IRE 6-layer validation

7.  If not clean: applyDeterministicRepairRound(), then re-validate once.
    Only a BLOCKING issue withholds the draft; advisory issues ship with it.
```

### Why documents of the same type look similar

Measured empirically. Two NDAs with entirely different variables: **32/32 clauses
identical set, 25 identical text**. Two vendor agreements: 30/30 same set, 17
identical text. Two distribution agreements diverged more — 33 vs 32 clauses,
because `DIST_APPOINTMENT_EXCLUSIVE_001` + `DIST_COMPETITION_COMPLIANCE_001`
replaced `DIST_APPOINTMENT_001`.

The cause: **579 always-on clauses vs 122 conditional and 18 variant across 46
blueprints, and 16 of 46 blueprints have no conditionality at all.** Variation
comes almost entirely from variable substitution, not clause selection.

---

## 5. Validation

`runDocumentValidation` in `backend/services/validationService.js` aggregates
13 validators, plus the IRE's own six layers:

| IRE layer | What it checks |
|---|---|
| 1a Blueprint | required clause IDs present for this doc type |
| 1b Structural | per-doctype required categories and constraints |
| 1c | completeness, execution, semantic |
| 2 Universal | contract-law doctrine — consent, consideration, capacity |
| 3 Statutory | IndiaCode section validation |
| 4 | illegal clause detection |
| 5 / 5b | stamp duty; registration under the Registration Act 1908 |
| 6 | AI clause integrity (deep validate only) |

Backend validators layered on top: agreement graph, draft consistency, numeric
plausibility, party identity, statutory citations, statutory deadlines, document
hardening, clause quality, document quality, commercial.

### Scoring

```js
SEVERITY_WEIGHTS = { CRITICAL: 40, HIGH: 20, MEDIUM: 10, LOW: 2 }
score = max(0, 100 - sum(weights of actionable issues))
```

Three output classes:

- **blockingIssues** — withhold the document
- **advisoryIssues** — cost points, document still ships
- **notices** — `notice_only: true`, cost **zero** points (stamp duty, registration,
  statutory checklist). Information, not defects.

`certification` is `"Blocked"` / `"Review Required"` / `"No issues detected"`.
The word "certified" is deliberately avoided in user-facing text; the internal
`certified` boolean means "every check that ran passed", not "legally compliant".

---

## 6. The knowledge base

### Clauses — 297 total (289 loaded, 8 deprecated)

| Folder | Count |
|---|---|
| commercial | 83 |
| core | 46 |
| employment | 39 |
| notices | 39 |
| finance | 24 |
| property | 17 |
| corporate | 16 |
| ecommerce | 10 |
| tos | 9 |
| data | 8 |
| compliance | 6 |

**Every clause has:** `clause_id`, `name`, `title`, `category`, `document_types`,
`jurisdiction`, `text`, `legal_basis`, `mandatory`, `enforceability`,
`risk_level`, `invalid_if`, `source`, `version`.

**Distributions:**
- `risk_level`: HIGH 111, LOW 102, MEDIUM 84
- `enforceability`: HIGH 268, MEDIUM 27, LOW 2
- `mandatory: true` on 152; `blocks_generation_if_absent` on 30
- `legal_basis` on all 297, citing **75 distinct Acts**

**Relationship metadata (non-empty counts):** `depends_on` 156,
`suggested_with` 137, `required_with` 83, `conflicts_with` 15.

**`invalid_if`** is on 232 clauses (423 unique conditions) but is only ever
*displayed*, as `watch_for` in `documentIntelligence.js:113`. It is never
evaluated. Critically — see §9 — these are **drafting-defect conditions, not
applicability conditions**.

### Blueprints — 46

Shape: `document_type`, `family`, `clauses[]`, `required_clauses[]`,
`conditional_clauses[{clause, include_if, note}]`,
`variant_clauses[{slot, replaces, options}]`.

Totals: 579 always-on, 122 conditional, 18 variant, **16 with no conditionality**.

### Constraint rules — 40, in 5 files

```jsonc
{
  "rule_id": "RENTAL_REGISTRATION_MANDATORY_OVER_12M",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "notice_only": true,
  "description": "...",
  "statutory_reference": "Registration Act 1908 - S.17(1)(d)",
  "applies_to_doc_types": [...],   // allow-list
  "excludes_doc_types": [...],     // deny-list, wins
  "excludes_shapes": [...],        // AGREEMENT | POLICY | NOTICE | SWORN
  "when":   [ ...predicates ],     // all must hold, else rule does not apply
  "assert": [ ...predicates ],     // all must hold, else rule FIRES
  "remedy": "..."
}
```

**The predicate language** (`IRE/src/indian-rule-engine/constraintEngine.js`) is
closed and reviewable:

```
{ "doc_type_in": [...] }  { "clause_present": [...] }  { "clause_absent": [...] }
{ "category_present": [...] }  { "state_in": [...] }
{ "var": "field" | ["field","alt"], "op": "...", "value": X }
{ "not": <pred> }  { "any_of": [<pred>, ...] }

ops: present absent eq neq contains not_contains in not_in matches
     gt gte lt lte months_gte months_lt
```

`var` accepts an array and falls through to the first field with a meaningful
value. `months_gte` parses `"24 months"`, `"2 years"`, `"eleven months"`, `"18"`.

**Only 5 of 40 rules use `when`.** All 17 `applies_to` declarations key on
`applies_to_doc_types` — not one keys on a fact about the deal.

### Statute metadata

`knowledge-base/metadata/statute_versions.json` tracks **85 Acts**, of which
**17 are verified** and 68 are not (`verified: false`, `amended_upto: null`).

---

## 7. Document types — 40 registered

Defined in `shared/documentRegistry.js`; intake in `backend/config/documentConfig.js`
(requiredFields + form sections) and `backend/config/variableConfig.js` (typed
schema with options, per type plus COMMON).

| Family | Types |
|---|---|
| Contracts & Commercial (12) | NDA, SERVICE_AGREEMENT, CONSULTANCY_AGREEMENT, SUPPLY_AGREEMENT, DISTRIBUTION_AGREEMENT, SALES_OF_GOODS_AGREEMENT, INDEPENDENT_CONTRACTOR_AGREEMENT, SOFTWARE_DEVELOPMENT_AGREEMENT, VENDOR_AGREEMENT, MASTER_SERVICE_AGREEMENT, TERMS_OF_SERVICE, PRIVACY_POLICY |
| Employment (5) | APPOINTMENT_LETTER, INTERNSHIP_AGREEMENT, SEPARATION_AGREEMENT, POSH_POLICY, EMPLOYMENT_CONTRACT |
| Startup & Fundraising (4) | FOUNDERS_AGREEMENT, TERM_SHEET, ESOP_GRANT_LETTER, SHARE_SUBSCRIPTION_AGREEMENT |
| Corporate (4) | PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, MOU |
| Notices & Disputes (4) | ARBITRATION_NOTICE, SETTLEMENT_AGREEMENT, AFFIDAVIT, INDEMNITY_BOND |
| Finance (3) | PROMISSORY_NOTE, LOAN_AGREEMENT, GUARANTEE_AGREEMENT |
| Data & Compliance (3) | DATA_PROCESSING_AGREEMENT, REFUND_AND_CANCELLATION_POLICY, SHIPPING_AND_DELIVERY_POLICY |
| Property (3) | COMMERCIAL_LEASE_AGREEMENT, LEAVE_AND_LICENSE_AGREEMENT, RENTAL_AGREEMENT |
| Intellectual Property (1) | IP_ASSIGNMENT_AGREEMENT |
| Instruments (1) | POWER_OF_ATTORNEY |

**Document shapes** (`shared/documentShape.js`): AGREEMENT (default), POLICY,
NOTICE, SWORN. Shape drives which constraint rules apply — a notice, an affidavit
and a published policy each fail the bilateral general-provisions floor for
reasons unrelated to drafting quality.

**Boot invariant:** `backend/index.js` enforces
`DOCUMENT_CONFIG ⊆ DOCUMENT_TYPE_REGISTRY` and calls `process.exit(1)` on
violation. It also refuses to start without `JWT_SECRET`, and if the knowledge
base fails to preload.

---

## 8. Data model — 5 Mongoose models

| Model | Purpose |
|---|---|
| **User** | name, email, phone (Indian 10-digit), password (bcrypt, cost 12), `isVerified`, `isAdmin`, verification + reset tokens |
| **DocumentDraft** | `userId`, `documentType`, `title`, `currentDraft`, `currentValidation`, `sourceVariables`, `currentVersionNumber`, `versionCount` |
| **DocumentVersion** | `draftId`, `userId`, `versionNumber`, `changeType` (generated / autosave / manual_edit / ai_edit / validated / exported / restored), `contentHash`, `draftSnapshot`, `validationSnapshot` |
| **ClauseReview** | mined or AI-proposed clauses awaiting advocate approval; status pending/approved/rejected/promoted |
| **GapSignal** | counts advisory findings and missing protections per document type — the signal for what to author next |

**Known limitations of this model:**
- `DocumentDraft` hangs off a single `userId`. There is **no Matter, no
  membership, no ACL, no sharing.** One owner per document.
- `isAdmin` boolean is the **entire** role model.
- There is **no event log**. `DocumentVersion.changeType` is the closest thing.
- `mongoose.set("sanitizeFilter", true)` is set globally against operator injection.

---

## 9. Architecture work in progress — the concept layer

The active design thread. Full spec is in `docs/CONCEPT_LAYER.md`.

### The problem

LegalAId selects clauses by document **type**, never by what the deal is about.
A distribution agreement for ballpoint pens and one for industrial solvents get
the same 34 clauses in the same order. Nothing lets the engine say *this deal
involves a hazardous chemical, so different obligations attach*.

### Three findings that shape the fix

**(a) `invalid_if` is a validation vocabulary, not an applicability one.** All
423 unique conditions were classified. Essentially **two** describe a state of
the world. The rest describe drafting defects — "Seat of arbitration not
specified", "Liability is excluded for fraud or wilful misconduct", "The deed is
executed before being stamped". Making them executable yields *findings*, not
clause suppression. This splits the work into a near-zero-risk change
(validation) and a high-risk one (`applies_when`), which are independent.

**(b) The predicate language already exists and is good.** `applies_when` on a
clause should reuse `constraintEngine`'s evaluator verbatim. The only code change
needed is exporting `evaluatePredicate`, currently module-private.

**(c) The Concept Resolver already exists — as imperative JavaScript.**
`generationControls.js` (512 lines) produces **57 derived flags**:
`involves_personal_data`, `employer_headcount_ge_10`, `is_registrable`,
`is_senior_employee`, `include_competition_compliance`, and so on. The work is
not to build a resolver but to move one out of code into reviewable data and give
its outputs provenance.

### Careful: there are already three conditionality grammars

| Where | Grammar | Power |
|---|---|---|
| `constraints/*.json` `when`/`assert` | predicate objects | full closed vocabulary |
| `blueprints/*.json` `include_if` | string `"flag == value"` | single var, equality only |
| `generationControls.js` | JavaScript | unlimited, unreviewable |

`clauseAssembler.js:186` reads `candidate.when ?? candidate.include_if`, so the
key `when` on a blueprint entry is parsed by the **weak** string parser. A new
clause field must therefore be named `applies_when`, not `when`.

### Proposed design, in brief

```
FACT / ENTITY / EVENT   what the user said, who, what is being done
        │  ← Concept Resolver: the only layer an advocate authors
        ▼
LEGAL CONCEPT           MSME_SUPPLIER, HAZARDOUS_MATERIAL, EPR_OBLIGATED_PRODUCT
        │  ← rule vocabulary: applies_when on clauses, when on constraints
        ▼
CONSEQUENCE             what changes in the document
```

- Concepts are defined by **the treatment they demand**, never by the thing
  described. If two candidates attach the same clauses and rules, they are one
  concept. Facts are infinite; treatments are not.
- Concept attachment is a function of **(thing × event × role)**. Polypropylene
  granules attract no concept in transport, but `EPR_OBLIGATED_PRODUCT` in
  packaging supply.
- **Provenance is an input to the engine, not a label on it:**
  `declared` / `derived` / `asserted` fire silently; `inferred` (LLM-proposed) is
  advisory until confirmed. This is what makes an LLM safe to use here.
- The model may return only a `concept_id` **from the supplied list**, or
  `AMBIGUOUS`, or `OUTSIDE_KNOWN_SET`. It may not invent concepts.
- **Three states:** `CONFIRMED`, `UNRESOLVED`, `OUTSIDE_KNOWN_SET`. The third is
  the honest answer to "there are infinite concepts" — the system can always know
  *that* it does not know, and say so on the document rather than silently
  defaulting to "ordinary goods".
- Keep the vocabulary to **10–15 concepts**. Not because the domain is small — it
  spans rights, obligations, employment, property, IP, corporate, disputes — but
  because every concept is a record an advocate must sign, and there are already
  289 unsigned clauses.

### The first ten concepts

Eight attach to clauses and rules that already exist. Two do not:
`HAZARDOUS_MATERIAL` and `EPR_OBLIGATED_PRODUCT` — **there is not one clause in
the library matching `/HAZARD|SAFETY|ENVIRON/`.** Those two are exactly the
plastics-and-chemicals motivating case, and they cost more than the other eight
combined, because the clauses they would attach must be authored from scratch.

---

## 10. Test suite and the clause baseline

21 test files in `tests/`. `npm test` runs 12 of them in sequence, ending with
the clause baseline. All currently pass.

**`tests/golden/corpus.json`** — the correctness harness. Scores false negatives
(a defect the fixture says must be caught, and was not) and false positives (a
correct document blocked) **separately**, because a validator that blocks correct
documents trains users to ignore it. Currently only **6 fixtures across 4 of 40
document types**.

**`scripts/freezeClauseBaseline.mjs` + `tests/baseline/clause-baseline.json`** —
a continuity harness, not a correctness one. Records which clauses each of the 40
types emits at minimal and full intake, so clause-selection changes show up as a
diff. Run `npm run baseline` to check, `npm run baseline:write` to re-record.

Current state: **31 of 40 types emit clauses (710 clause instances); 9 emit
nothing.**

It refuses to write a baseline where fewer than 75% of types produce clauses — a
baseline of empty documents passes no matter what you break.

**Why it exists:** suppression cascades. Removing `IP_TRADEMARK_USAGE_001` from
the distribution blueprint — one clause — raises `INPUT_MISMATCH_BRANDING_RIGHTS`,
which rejects the intake and collapses the document from 34 clauses to **zero**.
Without a before-picture, that reads as "the document got shorter".

---

## 11. Known open problems

**Nine document types generate nothing** under synthetic full intake, all failing
the same class of check — *"the generated clauses do not clearly reflect the
supplied &lt;field&gt;"*: `APPOINTMENT_LETTER`, `COMMERCIAL_LEASE_AGREEMENT`,
`EMPLOYMENT_CONTRACT`, `LEAVE_AND_LICENSE_AGREEMENT`, `MASTER_SERVICE_AGREEMENT`,
`RENTAL_AGREEMENT`, `SALES_OF_GOODS_AGREEMENT`, `SETTLEMENT_AGREEMENT`,
`SUPPLY_AGREEMENT`. A supplied value reaches the intake but does not survive into
the clause text. This is unrelated to clause selection and should be fixed first.

**Legal review debt.** 289 loaded clauses, **zero advocate sign-offs** — 147
marked `draft-needs-legal-review`, 150 unmarked. 68 of 85 tracked Acts
unverified. Six Indian Evidence Act citations await section-mapping to the
Bharatiya Sakshya Adhiniyam. Setting `LEGALAID_REQUIRE_REVIEWED_CLAUSES=1` makes
the boot refuse unsigned clauses — which today would refuse all 289.

**Golden corpus is thin** — 6 fixtures, 4 of 40 types.

**No ingestion, no sharing, no audit log** — see §2 and §8.

**Regulatory currency risk.** The Plastic Waste Management (Amendment) Rules,
2026 were notified 31 March 2026 (G.S.R. 237(E)) — redefining "end of life
disposal", adding a "Seller" of plastic raw materials, raising Category I
recycled content to 60% by 2028-29, requiring IS 14534:2023 conformity. Nothing
in the KB reflects this. It is a good illustration of why statutory churn should
land in one reviewable place.

---

## 12. Product and regulatory constraints (India-specific)

These are settled research from earlier work and materially constrain the roadmap.

**Bar Council of India Rules, Part VI, Chapter II, Rule 36** prohibits advocate
advertising and solicitation. A 2008 proviso permits only a BCI-approved schedule
of website particulars. A separate rule bars an advocate from sharing remuneration
with a non-advocate (numbering differs between published compilations).

***P.N. Vignesh v. Chairman, Bar Council*, 2024 MHC 2515** (Madras HC, 4 July
2024) held that ratings and rankings of lawyers demean the profession's ethos,
and ordered Quikr, Sulekha and Justdial to remove Rule 36-violating content
within four weeks. JustDial and Sulekha challenged it in the Supreme Court;
notice issued; no final ruling found. BCI issued a warning circular 17–18 March
2025 (a warning, not a new rule).

**Practical effect:** a lawyer marketplace, lawyer ratings, or revenue-sharing
with advocates is legally hazardous. Advocate *review* of the clause library is
fine; advocate *listings* are not.

**IT Act 2000, First Schedule (as amended October 2022):** immovable-property
sale contracts were removed from the exclusion list entirely; POAs and negotiable
instruments were removed only for RBI/NHB/SEBI/IRDAI/PFRDA-regulated
counterparties. So **general POAs, general promissory notes, wills and trusts
remain excluded from e-signature.** Section 3A plus the Second Schedule permit
Aadhaar eKYC eSign via a licensed ESP, or a DSC.

**Indian Stamp Act s.35:** an insufficiently stamped instrument is inadmissible
in evidence.

**DPDP Act and Rules:** commenced 14 November 2025. Consent Manager registration
obligations 14 November 2026; core obligations 14 May 2027.

---

## 13. Frontend

React 19 + Vite 5. Routes in `src/App.jsx`.

**Pages:** Home, Library, DocumentInfo, About, Contact, Help, PrivacyPolicy,
TermsOfService, Form (`/form/:type`), Editor, Documents, Profile, AdminClauses,
plus `src/pages/auth/` (Login, Register, VerifyEmail, ResendVerification,
ForgotPassword, ResetPassword).

**Components:** RiskPanel, DocumentIntelligence, ClauseEditor, InterviewPanel,
ConversationalIntake, ErrorExplainer, LibraryReviewPanel, MobileActionBar,
Header, Footer, ProtectedRoute.

### Design system — "warm & premium"

Chosen by the user after an earlier redesign was rejected. **Palette is
byte-identical to the original**; only surfaces, depth and motion changed.

```css
--ink #0c0d0f   --ink-2 #1a1c20   --ink-3 #252830
--paper #faf9f6 --paper-2 #f2f0eb --paper-3 #e8e4db
--gold #b8933a  --gold-light #d4aa55
--slate #64687a --slate-light #9397a8
--green #22c55e --red #ef4444 --amber #f59e0b --white #ffffff

/* warm surface ladder */
--surface-0 #0b0907  --surface-1 #100d0a
--surface-2 #17130f  --surface-3 #221c16
--line rgba(212,170,85,0.14)
--text-primary #f5f0e6
--lip: inset 0 1px 0 rgba(255,241,214,0.055)
radii 4 / 8 / 12 / 16 / 18 / 22px
```

Fonts: **DM Serif Display**, **DM Sans**, **DM Mono**.

**Lesson from the rejected pass, worth carrying:** a "denser, more technical"
redesign kept every hex identical but set shadows to `none`, deleted the body's
radial gold bloom, flattened gradients, removed hover lifts and collapsed radii.
Gold survived only as thin text and 1px borders, never as a *surface*. The user's
verdict: *"the whole website is so ugly now."* The mistake was not the density —
it was treating "technical" as licence to remove things.

**Loading states:** the generation overlay is a drafting-sheet animation whose
five stages mirror the real pipeline. Spinners use a `reduced-pulse` animation;
`.btn-spinner` is three dots. `prefers-reduced-motion` must **exempt loading
indicators** — an earlier blanket rule froze every loader and rendered the
generation overlay as a blank page, because each line's resting width is 0.

### Frontend gotcha: CRLF

Line endings are mixed across the repo. Verified CRLF: `frontend/src/pages/Form.css`,
`frontend/src/pages/auth/Auth.css`, `backend/services/documentQualityControl.js`.
Verified LF: `frontend/src/pages/Form.jsx`. **Check each file before editing** —
decode bytes, normalise to `\n`, edit, re-encode. A naive text edit rewrites
every line ending and produces a diff touching the whole file.

---

## 14. API surface

All document endpoints are `protect`-guarded (JWT). AI endpoints additionally
pass through `aiLimiter`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | public |
| GET | `/document-types` | public |
| GET | `/document-config/:type` | public, memoized |
| — | `/auth/*` | register, login, verify, reset |
| GET | `/variables/:documentType` | |
| GET | `/search/clauses` | |
| POST | `/generate` | AI-limited |
| POST | `/interview`, `/interview/extract`, `/interview/step` | AI-limited |
| POST | `/intake-assistant` | AI-limited |
| POST | `/validate` | |
| POST | `/export` | docx / pdf / txt |
| POST | `/chat` | AI-limited |
| POST | `/fix-issue` | AI-limited; refuses locked clauses |
| — | `/history/*` | draft and version history |
| — | `/admin/clause-reviews/*` | admin only |
| — | `/admin/library-review/*` | admin only |
| POST | `/admin/clause-authoring/propose` | admin only |
| GET | `/admin/models` | admin only |

**Export note:** `exportService.js` has
`const PRINT_STATUTORY_ANNOTATIONS = false;` — statutory `[Ref: ...]` provenance
is computed but never printed into the signed document.

---

## 15. Environment variables

```
MONGODB_URI  JWT_SECRET  JWT_EXPIRES_IN  PORT  NODE_ENV  CLIENT_URL
REQUEST_BODY_LIMIT
AI_PROVIDER  AI_FALLBACK_PROVIDER
GEMINI_API_KEY  GEMINI_MODEL  GEMINI_WARMUP_ON_STARTUP
GROQ_API_KEY  GROQ_MODEL  GROQ_BASE_URL
OPENAI_API_KEY  OPENAI_MODEL  OPENAI_BASE_URL
RESEND_API_KEY  EMAIL_FROM
SMTP_HOST  SMTP_PORT  SMTP_USER  SMTP_PASS
MAILTRAP_HOST  MAILTRAP_PORT  MAILTRAP_USER  MAILTRAP_PASS
LEGALAID_REQUIRE_REVIEWED_CLAUSES   # =1 refuses unsigned clauses at boot
LEGALAID_GRAPH_BLOCKS
```

> **Security note for anyone picking this up:** production secrets were at one
> point pasted in plaintext during development. `MONGODB_URI` (a live Atlas user
> with full read/write), `JWT_SECRET` (can mint a session for any account
> including admin — rotating it logs everyone out) and `RESEND_API_KEY` (can send
> mail as no-reply@legal-aid.xyz) **should be rotated in that priority order** if
> that has not already happened. Never commit `.env`.

---

## 16. Working conventions

- **The user runs all git commits and pushes manually.** Do not commit or push.
- Legal content goes in `knowledge-base/*.json` as data, never hardcoded in JS.
- Verify advocate review findings against **actual generated output** before
  fixing — many reported "defects" are blank-field artefacts or reviewer
  preference, not generator bugs.
- Build and render the real frontend before shipping design changes.
- Measure claims about the system rather than asserting them.
- Watch for substring regexes. Two real bugs of this class: a unit-spacing rule
  that would have rewritten `"Section 143A"` as `"Section 143 A"` (s.143A of the
  Arbitration Act is a provision this product cites), and a money-field pattern
  matching `parent_name` because "pa**rent**_name" contains "rent". Anchor
  patterns to token boundaries.
- Commercial decisions — liability caps, risk/title models, warranty timings,
  arbitration seat city — are the user's to make, not something to invent.

---

## 17. If you are being asked to help with this project

Highest-leverage work, in order:

1. **Fix the nine non-generating document types.** All fail the same value-reflection
   check. Biggest correctness win available, and independent of everything else.
2. **Expand the golden corpus** beyond 6 fixtures / 4 types.
3. **Get advocate sign-off moving** — 289 clauses at zero is the real ceiling on
   this product, not any technical limitation.
4. **Then** the concept layer, following the sequence in `docs/CONCEPT_LAYER.md`:
   steps 1–7 add no risk to any existing document; step 8 (the first
   `applies_when`) is the first change that can alter what a user receives.

Things to avoid proposing:

- Anything that lets the LLM choose the clause set. That contradicts §1.
- A new expression grammar. There are three already; reuse the constraint engine's.
- Document *ingestion* features without noting there is no ingestion path at all.
- A lawyer marketplace, lawyer ratings, or advocate revenue-sharing — see §12.
