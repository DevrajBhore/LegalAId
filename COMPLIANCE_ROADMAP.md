# LegalAId — Legal Compliance Roadmap

**Goal.** Not "legally perfect" — that isn't a state software can reach. The target is
**defensible**: every clause traceable to a reviewed source, every statutory obligation
checked as data rather than prose, every gap disclosed rather than hidden.

**Status of this document.** Engineering plan, written after reading the IRE, the
validation stack and the knowledge base. The substantive law referenced here is
signposting for your reviewing advocate to confirm — it is not legal advice.

---

## 1. What you already have

Worth stating plainly, because the plan builds on it rather than replacing it:

| Asset | Scale | State |
|---|---|---|
| Acts corpus (`knowledge-base/acts`) | 10,774 files | Populated, IndiaCode scrape |
| Sections (`knowledge-base/sections`) | 104,645 files | Populated |
| Subordinate legislation | 12,766 docs / 414 Acts | Partial (own audit flags gaps) |
| Stamp duty rates | ~20 doc types × 6 states | Real numeric data, code-consumed |
| Illegal-clause rules | 16 regex rules | Live, data-driven |
| Domain constraints | 12 domains, ~30 rules | Live, data-driven |
| Doc-type schema (`domainRegistry.js`) | ~160 types | Hardcoded JS |
| Case law | 71 files | Thin seed (own audit ranks this #2 gap) |

You have more legal *knowledge* than most projects in this space. The gap is between
the knowledge and the *checking*.

---

## 2. Three findings that reframe the work

These are not hypotheticals — each is verifiable in the current tree.

### 2.1 You already have a rule DSL, and it can express exactly one predicate

`knowledge-base/constraints/*.constraints.json` is a genuine data-driven rule format,
evaluated live by `constraintEngine.js`. It carries `rule_id`, `severity`,
`description`, `statutory_reference`, `applies_to_doc_types` — everything a lawyer
needs to read and approve a rule without touching JavaScript.

But `constraintEngine.js` is 1,801 bytes and supports one operation: *is at least one
of these clause IDs present?*

The cost of that shows up inside your own rules. From `rental.constraints.json`:

```json
{
  "rule_id": "RENTAL_REQUIRES_REGISTRATION_CLAUSE",
  "description": "Lease/rental agreements for periods exceeding 12 months must be
                  registered. Agreement should reference this requirement.",
  "statutory_reference": "Registration Act 1908 – S.17; Transfer of Property Act 1882 – S.107",
  "fails_if": ["PROP_REGISTRATION_001", "PROP_REGISTRATION_MANDATORY_001"]
}
```

The description states a condition — *term exceeding 12 months* — that the engine
cannot evaluate. So in practice:

- an 11-month leave-and-license is nagged for a registration clause it does not need;
- an 18-month lease passes as long as *some* registration prose is present, whether or
  not registration is actually addressed.

**The rule knows the law. The engine cannot ask the question.** This is the same shape
as the guarantee bug fixed earlier: legal logic that needs a condition, implemented
where conditions can't be expressed.

### 2.2 Your stamp duty notice cannot fire

`stampDutyValidator.js` raises `STAMP_ACT_S17_NOTICE` when the draft contains no stamp
acknowledgement, testing for `"non-judicial stamp"` among other strings.

`jurisdictionEngine.js::injectStampExecutionText` unconditionally prepends this to
every signature-category clause:

> "IN WITNESS WHEREOF, the Parties have executed this Agreement on non-judicial stamp
> paper of appropriate value as applicable in {State}."

That injection runs during `applyGenerationStages`, long before validation. So the
string the validator looks for is always present, and the notice is **unreachable for
any generated document**. The pipeline satisfies its own check with boilerplate.

The adequacy check below it is also effectively inert: it returns early unless
`stampDutyPaid` is supplied, which the intake never collects.

### 2.3 The legal metadata is inert

| Field | Where it appears | Read by code? |
|---|---|---|
| `mandatory_legal_checks` | 3 blueprints | **No** — zero references in `backend/` or `IRE/` |
| `invalid_if` | clause library | Display only (`documentIntelligence.js`) |
| `legal_basis` | clause library | Display only |
| `dispute_hotspots` | clause library | Display only |
| `review_status` | written by authoring services | **Never read** — gate is a manual file move |
| `indian_law_enforcement.rules.json` | 16 rules, 8 KB | **Nothing loads it** |

`guarantee.blueprint.json` lists "Board resolution required if guarantor is a company"
and "Stamp duty — must be adequately stamped under applicable State Stamp Act". These
are a real compliance checklist someone wrote. They execute nothing.

---

## 3. Division of labour

Because you have a reviewing advocate, the work splits cleanly. Keep this split — it is
what makes the output defensible.

**Advocate owns** (reviews and signs, never edits code):
- rule `description` + `statutory_reference` + severity for every rule
- state-wise stamp duty and registration data
- clause text and its `legal_basis`
- the pass/fail rubric for the golden corpus (Phase 1)

**Engineering owns:**
- the predicate vocabulary the rules are written in
- the evaluator, the CI gates, the scoring harness
- never encoding a legal condition in JavaScript again

The deliverable that makes this real is a **single reviewable rule file per domain**,
in a format the advocate reads directly. No legal condition should live in a `.filter()`
branch — that is precisely how the guarantee clause shipped inverted for months.

---

## 4. Phases

Sequenced so that each phase is shippable and the earliest ones de-risk the most.

### Phase 0 — Truth in certification (≈1 week)

The smallest change with the largest liability reduction.

`validationService.js` currently sets:

```js
certified: actionableIssues.length === 0
certification = "Certified"
score = 100 - (critical*40) - (high*20) - (medium*10) - (low*2)
```

"Certified" means *no regex fired*. It is presented to users as a legal seal, and the
score is arithmetic over issue counts rather than any measure of compliance.

**Do:**
1. Rename `certified` → `checks_passed`; `certification: "Certified"` → `"No issues detected"`.
2. Emit a **coverage object** alongside the issues: how many applicable requirements
   exist for this doc type + state, how many were machine-checked, how many need human
   review. Requires a registry of requirements (Phase 1 produces it).
3. Surface the not-checked list in the UI: *"7 requirements could not be verified
   automatically — review with a lawyer."*

Coverage reporting is more useful to users than a verdict, more honest, and becomes the
differentiator once the numbers are good.

### Phase 1 — Extend the constraint DSL + build the scoring harness (≈3–4 weeks)

These ship together: the harness is how you prove a rule change was an improvement.

**1a. Predicate vocabulary.** Extend `constraintEngine.js` from clause-ID presence to a
small, closed set of predicates. Closed is the point — a general expression language
becomes unreviewable. Proposal:

```json
{
  "rule_id": "RENTAL_REGISTRATION_MANDATORY_OVER_12M",
  "severity": "CRITICAL",
  "description": "A lease for a term of 12 months or more must be registered.",
  "statutory_reference": "Registration Act 1908 – S.17(1)(d); TPA 1882 – S.107",
  "reviewed_by": "adv-name",
  "reviewed_on": "2026-08-20",
  "applies_to_doc_types": ["RENTAL_AGREEMENT", "COMMERCIAL_LEASE_AGREEMENT"],
  "when":   [{ "var": "lease_term_months", "op": "gte", "value": 12 }],
  "assert": [{ "clause_present": ["PROP_REGISTRATION_MANDATORY_001"] },
             { "var_present": "registration_responsibility" }],
  "remedy": "Add the mandatory-registration clause and record who bears the fee."
}
```

Minimum viable predicate set for `when` and `assert`:

| Predicate | Purpose |
|---|---|
| `clause_present` / `clause_absent` | what `fails_if` does today (keep back-compatible) |
| `var` + `op` (`eq`, `neq`, `gte`, `lte`, `in`, `matches`) | condition on intake values |
| `var_present` | a required input was actually answered |
| `state_in` | jurisdiction-scoped rules |
| `text_matches` in a named category | last resort; explicitly the weakest predicate |

Rules with `severity: CRITICAL` block; everything else is advisory. Keep the existing
`fails_if` working so the 12 current constraint files need no rewrite.

**1b. Golden corpus.** 10–15 real documents per priority doc type. For each, the
advocate writes a pass/fail checklist. Then a harness that:

- runs generation + validation over the corpus on every build;
- scores **false negatives** (real defect the engine missed) separately from **false
  positives** (the Rockodile class — a correct document blocked);
- fails CI on any regression in either direction.

False positives matter as much as false negatives. A validator that blocks correct
documents trains users to ignore it, which is worse than not having it.

**Start with:** rental / commercial lease, employment, service agreement, NDA. Highest
volume, clearest statutory tests.

### Phase 2 — Migrate the inert metadata into real rules (≈2–3 weeks)

Now that conditions are expressible, move legal logic out of code and prose.

1. `mandatory_legal_checks` in the 3 blueprints → rules, or delete them. Documentation
   that claims to be enforcement is worse than no documentation.
2. `invalid_if` → an `invalid_when` predicate block. Keep the prose string for display;
   add the machine form beside it. Update `base_clause.schema.json`, which currently
   types `invalid_if` as free-text array.
3. Audit `documentQualityControl.js`, `documentHardening.js` and `draftingPolicy.js` for
   legal conditions encoded as JS branches, and migrate them. The guarantee-type filter
   is one; expect more.
4. Load `indian_law_enforcement.rules.json` or delete it. Its own comment claims the
   engine checks it.
5. Add a CI check: no new `documentType === "..."` legal branch in the services layer.

### Phase 3 — Compliance content (ongoing; advocate-led)

This is where the advocate does volume work and where user-visible correctness comes
from. Ordered by how often each actually bites.

**3.1 Registration (Registration Act 1908).** Highest impact. An unregistered lease
over the statutory period is inadmissible to prove its terms (s.49). Today
`registrationMandatory` is set on 3 of ~160 doc types and then *keyword-searched* in the
text. Needs: per-doc-type registration triggers, the term threshold as a condition,
state-wise fees, and who bears them.

**3.2 Stamp duty.** Fix the unreachable notice (2.2) by checking the *declared duty*
rather than the presence of boilerplate — and stop the injector from writing stamp prose
that isn't backed by a computed amount. Collect `stamp_duty_paid` and the financial
basis in intake so the adequacy check can run. Expand from 6 states. Keep it advisory:
under-stamping does not void a contract, it makes it inadmissible until cured.

**3.3 Execution formalities.** `executionValidator.js` exists; make it condition-driven —
witness counts by instrument and state, attestation, authorised-signatory capacity,
board resolution for corporate guarantors/borrowers, and the foreign-party cases.
`guarantee.blueprint.json` already names the board-resolution requirement in prose.

**3.4 Doc-type statutory minima.** One rule set per document family. Candidates for the
advocate to confirm and prioritise:

- **Employment** — POSH Act 2013 (mandatory at 10+ employees), PF/ESI thresholds,
  gratuity, state Shops & Establishments variation, notice/termination floors
- **NDA / employment restraints** — ICA s.27; post-termination non-competes are largely
  unenforceable in India, and your library ships `NDA_NON_COMPETE_001` /
  `EMP_NON_COMPETE_001` behind an opt-in flag with no s.27 warning attached
- **Commercial / supply** — MSMED 45-day payment ceiling (partly present as
  `MSME_PAYMENT_DELAY`), interest on delayed payment
- **Terms of Service** — IT Rules 2021 grievance-officer acknowledgement and resolution
  timelines, Consumer Protection (E-Commerce) Rules 2020
- **Privacy Policy** — DPDP Act 2023 notice and consent content requirements
- **Rental** — Model Tenancy Act adoption varies by state; deposit caps where adopted

Each is a `when` / `assert` rule with a citation. This is what turns "compliant" from a
claim into a list.

### Phase 4 — Provenance and staleness (≈2 weeks + ongoing)

Makes the advocate's review durable and answers "how do you stay current?", which is the
first question any serious customer asks.

1. **Enforce `review_status` in code.** `bootstrap.js` refuses to load any clause or rule
   lacking `reviewed_by` + `reviewed_on`. Today the gate is a human remembering to move a
   file out of staging.
2. **Pin statute versions.** Every `legal_basis` entry records the version/date of the
   section relied on.
3. **Staleness alarm.** You already scrape the gazette (457 files) and regulator
   circulars. Diff incoming amendments against pinned citations and flag affected clauses
   for re-review. Give clauses a review expiry.
4. **CI gate:** a clause whose cited section has changed cannot ship until re-reviewed.

### Phase 5 — Structured document model (large; last)

The deepest fix, deliberately last because everything above pays off sooner.

Today: intake → prose → regex over prose. That ordering is the root cause of both bug
classes — you cannot reliably detect a real defect in generated prose, and you generate
false alarms on correct prose.

Target: intake → **typed model** (parties, obligations, amounts, durations, conditions,
governing law) → validate the model → render prose from the model. `obligationTracker.js`
is already most of this model; it just sits downstream of the text instead of upstream.

Validating structure also makes Phase 1's predicates far stronger: `lease_term_months`
becomes a real field rather than something inferred from a sentence.

---

## 5. Explicitly do not do

- **Don't make the LLM the compliance layer.** Use it for wording; never let it decide
  whether a document is compliant. Your merge already treats the rule engine as the
  authority on structure — keep that boundary.
- **Don't block on stamp duty.** Advisory is legally correct. Fix the check, not the
  severity.
- **Don't claim "legally perfect", "certified" or "court-ready" in product copy.** Claim
  coverage: "checked against N statutory requirements for your state". It is defensible,
  and it is true.
- **Don't add clauses faster than the advocate can review them.** Coverage the reviewer
  hasn't signed is a liability, not a feature.

---

## 6. Suggested order of work

| # | Phase | Effort | Unblocks |
|---|---|---|---|
| 1 | Phase 0 — certification honesty | ~1 wk | Ships immediately; reduces liability |
| 2 | Phase 1a — predicate DSL | ~2 wks | Everything downstream |
| 3 | Phase 1b — golden corpus + harness | ~2 wks | Makes all later work measurable |
| 4 | Phase 2 — migrate inert metadata | ~2–3 wks | Removes the bug class found today |
| 5 | Phase 3.1/3.2 — registration + stamp | ~3 wks | Largest real-world correctness win |
| 6 | Phase 4 — provenance + staleness | ~2 wks | Makes review durable |
| 7 | Phase 3.3/3.4 — execution + statutory minima | ongoing | Advocate-led breadth |
| 8 | Phase 5 — structured model | large | Removes the root cause |

Phase 3 runs continuously alongside 6–8 once the DSL exists.

---

## 7. First concrete deliverable

If you want a single starting point that proves the approach end to end, take
`RENTAL_REQUIRES_REGISTRATION_CLAUSE` — the rule in §2.1 that cannot express its own
condition — and:

1. extend `constraintEngine.js` with `when` + `var`/`op` and `assert`;
2. rewrite that one rule to test `lease_term_months >= 12`;
3. add two golden documents (an 11-month licence, an 18-month lease) with the advocate's
   expected verdicts;
4. wire both into CI.

That is a working vertical slice of Phases 0, 1a and 1b in a few days, on a rule where
the law is unambiguous and the current behaviour is demonstrably wrong in both
directions.
