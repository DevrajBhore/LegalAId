# LegalAId — Project Context (read this first)

A briefing for any AI assistant (especially Claude) working on this codebase. It
explains *what we are building, why, how it is put together, and the invariants
you must not break.* Read it before proposing changes.

---

## 1. What LegalAId is

LegalAId is a full-stack SaaS that drafts **Indian legal documents** from a few
plain-language inputs and produces a **validated, India-law-correct first draft**
of 17 document types (NDA, Employment, Service, Consultancy, Independent
Contractor, Software Development, Partnership Deed, Shareholders' Agreement, Joint
Venture, Loan, Guarantee, Supply, Distribution, Sale of Goods, Commercial Lease,
Leave & License, MOU).

The product's wedge: it is **more trustworthy than raw ChatGPT/Gemini** because
the AI never decides the legal content — reviewed rules do, and an engine proves
the result against Indian law before anything can be exported.

## 2. The core philosophy (the one idea everything follows from)

> **AI reads → reviewed rules reason → the engine proves → humans govern.**

- **AI reads** — interprets messy human input into structured legal facts and
  *tailors clause wording* to the user's situation. It does **not** choose clauses.
- **Reviewed rules reason** — pre-defined, lawyer-reviewable rules/blueprints
  decide *which* clauses belong in a document.
- **The engine proves** — the Indian Rule Engine (IRE) validates the assembled
  draft against Indian law and **blocks** anything non-compliant.
- **Humans govern** — admins/lawyers approve every clause before it can enter the
  live clause library.

**Hard rule: the AI must never decide, select, name, or author clauses at runtime,
and never set generation flags.** It only (a) translates input → variables and
(b) rewrites clause *text*. The engine can always veto it. If a change would let
the AI pick clauses or bypass validation, it is wrong by definition.

## 3. Tech shape (high level)

- **Frontend:** React + Vite SPA (intake form, editor, admin). Dark/gold theme;
  design tokens in `frontend/src/index.css` (`--gold`, `--gold-pale`, `--ink`,
  `--font-display` = "DM Serif Display", `--font-body` = "DM Sans", radii `--r-*`).
- **Backend:** Express + MongoDB (ES modules).
- **IRE:** a separate engine package under `IRE/` with its own `bootstrap.js`
  and `engine.js`.
- **Knowledge base:** file-based, under `knowledge-base/` — clause library,
  blueprints, mappings, constraints, statutes, and `rules/illegal_clauses.rules.json`.
- **AI layer:** provider-agnostic (`backend/ai/`). Primary Gemini, fallback Groq,
  optional OpenAI — selected purely by env keys (`GEMINI_API_KEY`, `GROQ_API_KEY`,
  `OPENAI_API_KEY`). Without a key, generation falls back to deterministic boilerplate.

## 4. The generation pipeline (form/chat → document)

Entry: `POST /generate` → `generateDocument(input)` in
`backend/services/documentService.js`. Order:

1. **Validate inputs** — `validateInputByDocumentType` → `validateVariables`
   (`backend/services/variableValidator.js`) over `sanitizeVariablesForDocument`.
   Mode-aware: `quick` requires only essentials, `detailed` requires the full
   `requiredFields` + conditional cross-field rules.
2. **Prepare** — `prepareGenerationInput` runs `deriveGenerationControls`
   (`backend/services/generationControls.js`) to compute **flags** from variables,
   and builds `semanticContext`.
3. **Assemble** — `assembleDocument` selects required + conditional (`include_if`)
   + variant clauses from the blueprint/clause library.
4. **Inject variables** into clause text.
5. **Apply stages** — dependencies → jurisdiction → doctrine → scope guard →
   signatures → hardening → quality controls → commercial → lock → category
   normalize → normalize text (quality controls run twice; intentional).
6. **AI tailoring (optional)** — `attemptSemanticDraft` → `mergeAIDraftWithSeed`.
   The rule engine has **already decided the clause set** (the seed); the AI only
   rewrites each clause's text. The merge is **resilient per-clause**: keep the
   seed's exact clause set, use the AI's text where usable, else keep the
   deterministic version. Rejected only if the AI returns the wrong document type.
7. **Validate** — the IRE (see §5).
8. **buildSuccess** — returns `{ draft, validation, intelligence, obligations }`.

**Export gate:** a document can be generated and edited freely, but the `/export`
route only succeeds when the draft is **certified with zero issues**. Speed never
means shipping something broken.

## 5. The Indian Rule Engine (IRE) — the "proves" stage

Active path: `backend/ire/runner.js` → `IRE/engine.js` `validateDocument(...)`.
(There is an older `IRE/src/indian-rule-engine/index.js runIRE` that is **NOT**
the live path — don't wire to it.)

At boot, `bootstrapIRE()` builds a registry from `knowledge-base/`: clauses,
mappings (`document_type → clause_ids`), blueprints (with **variant groups**),
and constraint sets.

`validateDocument` runs **6 layers**, pools issues, dedupes, scores by severity:

1. **Structure** — blueprint (required clause IDs present, variant-aware),
   structural (required categories, clause ordering, witnesses/notarisation/
   registration), completeness/execution/semantic text checks.
2. **Contract-Act doctrine** — `IRE/src/universal/` primitives: consideration,
   consent, capacity, restraint of trade (§27 non-competes), indemnity,
   termination, arbitration, enforceability.
3. **Statutory KB** — compares the draft to real IndiaCode sections
   (`IRE/src/statutes/`): DPDP Act, Companies Act, etc. + subordinate-legislation
   notices. Wrapped in try/catch ("fails safely").
4. **Illegal-clause detection** — pattern rules from
   `knowledge-base/rules/illegal_clauses.rules.json` (data, not code), with
   `isProtectedReference` exemptions (e.g. clauses that *require* Competition Act
   compliance must not be flagged as violations).
5. **Stamp duty / registration** — state-aware.
6. **AI clause integrity** — safety re-check of AI-tailored / user-edited clauses.

**Modes (depth dial):** `background` (layer 1, live edit) → `generation`
(1–2 + illegal, first draft) → `final` (all six, export gate).

**Verdict:** `certified = risk_level !== "BLOCKED"`. Any CRITICAL → BLOCKED (an
absolute wall). Export requires `certified && issues.length === 0`.

## 6. Situation-aware drafting (why two same-type docs differ)

- **Conditional clauses** (`include_if`) appear only when facts call for them
  (e.g. personal data → DPDP data-processing clause).
- **Variant clauses** (`replaces` + `select_first_match`) swap a baseline clause
  for a stronger context-matched one (senior vs junior employee, factory vs
  office hours, secured vs unsecured loan).
- Flags that drive these are computed **only** by `deriveGenerationControls` at
  generate time, deterministically from variables. Recurring gotcha: any variant
  whose replaced default appears in a constraint's `fails_if` must add the variant
  id there too, or it falsely trips a constraint.

## 7. Intake — three ways in, one pipeline

A standalone chooser screen (`frontend/src/pages/Form.jsx`, shown when `flow` is
null) offers three flows; all feed the **same** `form` object into the **same**
`/generate` pipeline:

- **Guided** — describe-your-situation interview (`InterviewPanel`) then the full
  detailed form.
- **Quick draft** — only essential fields (`backend/config/essentialFields.js`);
  validation relaxed to essentials, but the export gate stays strict.
- **Conversational** — `ConversationalIntake.jsx` + backend `interviewService` +
  `POST /interview/step` (gap-fill) and `POST /interview/extract` (bulk pass).
  **Prompt-first:** the user writes one free-form description; the AI
  **bulk-extracts** it into the `form` object in a single pass, filling variables
  only (extraction schema is all-string + all-required; "not stated" → `""`, never
  a guess — the provider-portable equivalent of nullable-but-present, since literal
  JSON `null` is not portable across Gemini/Groq here). The extracted partial
  object is run through the same oracle the generate gate uses —
  `validateVariables(documentType, partialVars, { mode: "detailed" })` — whose
  errors name exactly which required/conditional fields are still missing; the chat
  asks only for those (gap-fill, single source of truth, can't get stuck). A
  **mapping-confirmation step** echoes the full structured interpretation
  (label → value) before handoff, to catch valid-but-swapped mappings from the bulk
  pass. Hands off to the same review screen; never auto-generates.

**Conversational invariants (do not violate):** resolves user input to
**variables only**; never sets flags or selects clauses; writes to the **same
intake schema** (no parallel object); hands the object to the **same** validation
→ derivation → assembly → IRE → export-gate pipeline.

## 8. Admin governance + the flywheel

- The clause library is **human-governed**. Admins (`User.isAdmin`, enforced by
  `requireAdmin` after `protect`; granted via `scripts/makeAdmin.mjs`) work a
  **review queue** (`/admin/clause-reviews`): mined clauses + AI-proposed clauses
  arrive as `pending`; admin approves → promotes → finalizes into the live library.
  Nothing legal reaches users without sign-off.
- **AI gap analysis** (`/admin/clause-authoring/propose`) asks the AI which
  protections a document type is missing; proposals land in the queue (never live).
- **Flywheel:** real usage records gap signals → AI drafts candidates → lawyers
  approve → the library deepens → every future doc improves.

## 9. Documents that explain themselves

Every generated draft also carries:
- **Document intelligence** (`documentIntelligence.js`): per-clause why/legal-basis/
  enforceability, risk score, conflict detection.
- **Obligation tracker** (`obligationTracker.js`): dated obligations (stamp duty,
  registration, expiry, renewal, probation confirmation) exportable to calendar.

## 10. Conventions & invariants for anyone editing this code

- **Never let AI decide clauses or set flags.** AI = translate input + reword text.
- **Single-source validation.** The conversational loop and the generate gate must
  both use `validateVariables`. Don't fork a parallel validator.
- **Don't bypass the IRE chain or the export gate.** Ever.
- **`deriveGenerationControls` runs once at generate time** on a (near-)complete
  variable set; it conflates absent→`false` for several derived booleans, so do
  **not** use it as a per-turn oracle on partial input.
- **Strict structured-output schemas:** Groq/OpenAI require *every* property in
  `required`; `enforceStrictSchema` in `backend/ai/openaiCompatible.js` enforces
  this for all schemas. Gemini takes the schema as `responseSchema`.
- **Frontend uses the app's tokens** (gold-only accents, `--font-display` for
  headings, `--r-*` radii). No foreign accent colors.
- **Operational:** production needs a live AI key for clause tailoring; otherwise
  output is deterministic boilerplate (and the draft-consistency validator will
  block docs that don't reflect supplied inputs). Behind a proxy (Render), set
  `app.set("trust proxy", 1)`.

## 11. Key files (orientation map)

- `backend/services/documentService.js` — the generation conductor.
- `backend/services/variableValidator.js` — input validation (the oracle).
- `backend/services/generationControls.js` — flag derivation.
- `backend/services/clauseAssembler.js` — clause assembly + variant slots.
- `backend/ire/runner.js` → `IRE/engine.js` — the active validation path.
- `IRE/bootstrap.js` — loads the KB registry at boot.
- `backend/services/interviewService.js` — conversational + interview intake.
- `backend/config/essentialFields.js` — quick-mode essentials.
- `frontend/src/pages/Form.jsx` — chooser + form + 3 intake flows.
- `frontend/src/components/ConversationalIntake.jsx` — chat intake UI.
- `frontend/src/pages/AdminClauses.jsx` — review queue + AI gap analysis.
- `knowledge-base/` — clause library, blueprints, constraints, statutes, rules.

## 12. Roadmap (high level)

- **Now:** reliable AI tailoring in production; lawyer-review of `draft-needs-
  legal-review` clauses; deploy pending fixes.
- **Next:** deeper clause coverage per type; more document types; usage-driven gap
  prioritisation; lifecycle features (e-sign, registration assistance, renewal
  reminders).

---

**One-line summary:** LegalAId is an Indian legal-drafting engine where AI reads
the situation and rewrites wording, reviewed rules choose the clauses, a six-layer
engine proves the draft against Indian law, and humans govern the clause library —
producing first drafts you can actually trust.
