# Phase C1 — where a dependency outranks an applicability gate

## Why `required_with` bypasses applicability

`dependencyResolver.resolveExplicitKbDependencies` concatenates a clause's
`depends_on` and `required_with` lists and injects any named clause that is not
already present. Before injecting it checks four things: that the clause is not
already there, that it was not deliberately swapped out by a variant slot, that
it is not on the `SUPPRESSED_DEPENDENCIES` list, and that
`isClauseCompatibleWithDocument` accepts it — a **document-type** check.

It never evaluates the target's applicability. It cannot: the gate lives in the
blueprint (`include_if: "is_secured == true"`) and the resolver operates on the
clause-library graph, which has no blueprint in scope.

So the two relations are structurally different objects that the engine treats
as one:

```
applicability   blueprint   include_if   a fact about this document
dependency      clause      required_with   a fact about the clause library
```

## Is the intended relationship already expressible?

**No.** The library has four relationship keys and they do not encode strength
in a way the resolver reads:

| key | clauses | consumed by |
|---|---|---|
| `depends_on` | 303 | dependency resolver — **identically to `required_with`** |
| `conflicts_with` | 296 | documentIntelligence, documentHardening |
| `suggested_with` | 196 | **nothing** |
| `required_with` | 189 | dependency resolver |

`depends_on` and `required_with` are concatenated on one line and are therefore
synonyms in effect, despite 24 edges being declared under both keys at once —
someone thought they differed. `suggested_with` is the weaker relation the
vocabulary already has, and it is inert, so demoting an edge to it means
"nothing happens", which is not `REQUIRED_IF_APPLICABLE`.

The distinction between *required unconditionally* and *required if applicable*
cannot currently be stated.

## The runtime population


Gates stated across all blueprints: **150**  
Gates actually CLOSED by declining the flag: **90**  
Gates that could not be closed — the flag is not an answerable intake field on that 
family, or the derivation overrides the answer: 55  
Gates OVERRIDDEN — the clause ships although the user declined it: **34**  
Gates whose fixture could not generate with the flag declined: 3

Route taken by each override: {"the gate itself":27,"dependencyResolver":7}

## Overridden

| document type | clause | declined flag | injected by |
|---|---|---|---|
| COMMERCIAL_LEASE_AGREEMENT | CORE_FORCE_MAJEURE_001 | long_term_lease | the gate itself |
| COMMERCIAL_LEASE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| CONSULTANCY_AGREEMENT | CORE_DEFINITIONS_001 | include_nomenclature_clause | dependencyResolver |
| CONSULTANCY_AGREEMENT | CORE_INDEMNITY_001 | include_indemnity_clause | the gate itself |
| CONSULTANCY_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| DISTRIBUTION_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| EMPLOYMENT_CONTRACT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| GUARANTEE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_DEFINITIONS_001 | include_nomenclature_clause | dependencyResolver |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_INDEMNITY_001 | include_indemnity_clause | the gate itself |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| IP_ASSIGNMENT_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| JOINT_VENTURE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| LEAVE_AND_LICENSE_AGREEMENT | CORE_FORCE_MAJEURE_001 | include_force_majeure | the gate itself |
| LEAVE_AND_LICENSE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| LOAN_AGREEMENT | LOAN_SECURITY_001 | is_secured | dependencyResolver |
| LOAN_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| MOU | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| MASTER_SERVICE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| NDA | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| PARTNERSHIP_DEED | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| RENTAL_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| SALES_OF_GOODS_AGREEMENT | CORE_FORCE_MAJEURE_001 | include_force_majeure | the gate itself |
| SALES_OF_GOODS_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| SALES_OF_GOODS_AGREEMENT | SUPPLY_INSPECTION_001 | include_inspection_rights | dependencyResolver |
| SERVICE_AGREEMENT | CORE_DEFINITIONS_001 | include_nomenclature_clause | dependencyResolver |
| SERVICE_AGREEMENT | CORE_INDEMNITY_001 | include_indemnity_clause | the gate itself |
| SERVICE_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| SHAREHOLDERS_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| SUPPLY_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_DEFINITIONS_001 | include_nomenclature_clause | dependencyResolver |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_INDEMNITY_001 | include_indemnity_clause | dependencyResolver |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |
| VENDOR_AGREEMENT | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement | the gate itself |

## Gates this probe could not close

**A LIMIT OF THE MEASUREMENT, NOT A LIST OF DEFECTS.** To close a gate the probe must
know which intake question backs it, and the gate's name is not always the field's
name — LOAN_SECURITY_001 is gated on `is_secured` while the question is called
`loan_is_secured`. That mapping is stated for the seven declared semantic facts and
nowhere else, so for the rest the probe writes into a key the schema does not have,
sanitisation drops it, and the gate stays open.

Some of these are probably gates written against a control no user can answer, which
would be a real defect. Others are simply names this probe cannot resolve. Until the
mapping exists they cannot be told apart, so the number is reported and not read.

| document type | clause | flag |
|---|---|---|
| APPOINTMENT_LETTER | EMP_POSH_POLICY_001 | employer_headcount_ge_10 |
| APPOINTMENT_LETTER | EMP_ESOP_001 | has_esop_or_variable_pay |
| COMMERCIAL_LEASE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| CONSULTANCY_AGREEMENT | SERVICE_DELIVERABLES_001 | include_deliverables |
| CONSULTANCY_AGREEMENT | SERVICE_SLA_001 | include_sla |
| CONSULTANCY_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| CONSULTANCY_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| CONSULTANCY_AGREEMENT | SERVICE_TIMELINES_001 | include_timelines |
| CONSULTANCY_AGREEMENT | SERVICE_REPORTING_001 | include_reporting |
| CONSULTANCY_AGREEMENT | SERVICE_ACCEPTANCE_001 | include_inspection_rights |
| CONSULTANCY_AGREEMENT | IP_INFRINGEMENT_001 | include_ip_assignment |
| CONSULTANCY_AGREEMENT | CORE_TRANSITION_ASSISTANCE_001 | include_transition_assistance |
| CONSULTANCY_AGREEMENT | SERVICE_EXPENSES_001 | include_expenses |
| CONSULTANCY_AGREEMENT | SERVICE_CHANGE_REQUEST_001 | include_change_control |
| DISTRIBUTION_AGREEMENT | DIST_COMPETITION_COMPLIANCE_001 | include_competition_compliance |
| DISTRIBUTION_AGREEMENT | SERVICE_REPORTING_001 | reporting_required |
| DISTRIBUTION_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| DISTRIBUTION_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| EMPLOYMENT_CONTRACT | EMP_MOONLIGHTING_001 | restrict_moonlighting |
| EMPLOYMENT_CONTRACT | EMP_MATERNITY_BENEFITS_001 | is_female_employee |
| INDEPENDENT_CONTRACTOR_AGREEMENT | SERVICE_DELIVERABLES_001 | include_deliverables |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| IP_ASSIGNMENT_AGREEMENT | IPA_COPYRIGHT_ASSIGNMENT_001 | assigns_copyright |
| JOINT_VENTURE_AGREEMENT | CORE_DATA_PROCESSING_001 | jv_processes_personal_data |
| JOINT_VENTURE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| JOINT_VENTURE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| LOAN_AGREEMENT | GUARANTEE_OBLIGATION_001 | personal_guarantee_required |
| MASTER_SERVICE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| MASTER_SERVICE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| MASTER_SERVICE_AGREEMENT | MSA_GOVERNANCE_BODY_001 | include_governance_protections |
| MASTER_SERVICE_AGREEMENT | SERVICE_CUSTOMER_DEPENDENCIES_001 | include_deliverables |
| MASTER_SERVICE_AGREEMENT | CORE_RESIDUAL_KNOWLEDGE_001 | include_confidentiality |
| PARTNERSHIP_DEED | CORE_DATA_PROCESSING_001 | firm_processes_personal_data |
| PRIVACY_POLICY | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement |
| RENTAL_AGREEMENT | RENT_SUBLEASE_001 | subletting_addressed |
| SERVICE_AGREEMENT | SERVICE_DELIVERABLES_001 | include_deliverables |
| SERVICE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SERVICE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| SHAREHOLDERS_AGREEMENT | CORE_DATA_PROCESSING_001 | company_processes_personal_data |
| SUPPLY_AGREEMENT | SUPPLY_SHORTAGE_001 | shortage_risk |
| SUPPLY_AGREEMENT | SUPPLY_RETURN_POLICY_001 | return_policy_required |
| SUPPLY_AGREEMENT | CORE_ASSIGNMENT_001 | assignment_addressed |
| SUPPLY_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SUPPLY_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| TERMS_OF_SERVICE | CORE_ENTIRE_AGREEMENT_001 | include_entire_agreement |
| VENDOR_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| VENDOR_AGREEMENT | CORE_CONFIDENTIALITY_001 | include_confidentiality |
| VENDOR_AGREEMENT | SUPPLY_SHORTAGE_001 | include_delivery_terms |
| VENDOR_AGREEMENT | SUPPLY_RETURN_POLICY_001 | return_policy_required |
| VENDOR_AGREEMENT | SUPPLY_PRICE_REVISION_001 | include_price_revision |
| VENDOR_AGREEMENT | CORE_INDEMNITY_001 | include_indemnity_clause |
| VENDOR_AGREEMENT | CORE_TRANSITION_ASSISTANCE_001 | include_transition_assistance |

## Not exercised — the fixture does not generate with the flag declined

These are NOT clean gates. Each is a state the family may not be able to represent,
the shape Phase B found on the loan, and each needs its own look.

| document type | clause | declined flag | refused with |
|---|---|---|---|
| EMPLOYMENT_CONTRACT | EMP_POSH_POLICY_001 | employer_headcount_ge_10 |  |
| LOAN_AGREEMENT | LOAN_SARFAESI_ENFORCEMENT_001 | lender_is_regulated |  |
| TERMS_OF_SERVICE | TOS_FEES_AND_BILLING_001 | is_paid_service |  |

---

## Reading this table: three populations, not one

**7 overridden via `dependencyResolver`.** This is the Phase C target — the gate
closed, and the clause arrived anyway through the dependency graph. They split
into two shapes:

- **`CORE_DEFINITIONS_001` (4 families).** A payment or confidentiality clause
  that uses defined terms needs the definitions. Here the dependency winning is
  arguably *right* and the defect is that it is silent: the user declined a
  nomenclature clause and got one, with no disclosure. The likely repair is
  disclosure, not suppression.
- **`LOAN_SECURITY_001`, `CORE_INDEMNITY_001`, `SUPPLY_INSPECTION_001`.**
  Substantive choices. A default clause does not presuppose collateral; a
  limitation of liability does not presuppose an indemnity. Here the dependency
  is asserting a relationship that does not hold.

**27 overridden "by the gate itself".** The clause never went through the
dependency resolver — it was selected normally, because it is listed as both
unconditional and conditional in the same blueprint, so the gate is decorative.
`CORE_ENTIRE_AGREEMENT_001` accounts for 20 of these across 20 families. A
different defect class: a gate that was never load-bearing.

**55 gates this probe could not close.** A measurement limit. See below.

## How the count moved, and why that matters

| reading | count | what was wrong |
|---|---|---|
| static edge sweep on `invalid_if` | 192 | `invalid_if` is advocate-review prose on 250 of 315 clauses; the filter matched nearly everything |
| static sweep, same-blueprint unconditional→gated | 12 | static edges are potential overrides; three looked serious and one fired |
| runtime, gate written by flag name | 74 | the flag is a derived control, not always an intake field — 69 gates never closed and the clause shipped because the user wanted it |
| runtime, gate confirmed closed | 34 | correct, but mixes three populations |
| **runtime, via the dependency resolver** | **7** | the actual Phase C target |

Each wrong number was produced by a filter that matched more than it meant. The
correction each time was the same: confirm at runtime that the thing being
measured actually happened.

---

# C2 — the Loan repair, and the assumption it falsified

## What was assumed

That `LOAN_DEFAULT_001`'s operative text lives in the clause library, so a
secured/unsecured variant pair authored there would decide limb (g), with no
JavaScript rewriting legal substance.

## What is actually true

The library text of this clause **is not what ships**. `documentHardening`
carries a builder for `LOAN_DEFAULT_001` that composes the clause at generation
time, and there are three sources in priority order:

1. the user's own `events_of_default` answer, rendered verbatim — which is right,
   and which means the baseline fixtures never reach the limbs at all;
2. limbs composed in `documentHardening`;
3. the library text, only for clause ids the builder does not know.

A variant pair authored in the library was therefore inert. `LOAN_DEFAULT_SECURED_001`
shipped its raw library text — including a "Schedule 1" reference the builder
would have resolved — and generation refused it with
`UNRESOLVED_SCHEDULE_REFERENCE`. The guard caught the mistake, which is the
system working; the variant pair was withdrawn rather than wired around it.

## The circularity, which was the real defect

The builder already gated limb (g). On the wrong thing:

```
LOAN_DEFAULT_001.required_with names LOAN_SECURITY_001
        ↓
dependency resolver injects it — the gate is never consulted
        ↓
present.has("security") is now true
        ↓
limb (g) is added
        ↓
an unsecured loan with a security clause AND an event of default
predicated on security — internally consistent, and false
```

Each mechanism supplied the other's premise. Removing only the dependency would
have left a **secured** loan silent about security in its events of default;
removing only the condition would have left the security clause shipping.

## The repair

| change | where | why |
|---|---|---|
| `LOAN_DEFAULT_001.required_with` drops `LOAN_SECURITY_001` | knowledge | a default provision does not presuppose collateral |
| `LOAN_SECURITY_001.required_with` keeps `LOAN_DEFAULT_001` | knowledge | security enforcement *does* presuppose a definition of default — the edge is sound in that direction only |
| limb (g) gated on the canonical `is_secured` fact | engine | a clause that arrived by any route cannot make a loan secured |
| library fallback text split so it carries no security limb | knowledge | if the builder is ever removed, the fallback must not assert security |
| `LOAN_DEFAULT_001` → v4.0, SARFAESI s.13 citation moved off it | knowledge | enforcement *of a security interest* is not the basis of anything in an unsecured facility |

Both governance fields are set: `review_status: draft-needs-legal-review`,
`source_provenance` recording that the limbs were separated and not redrafted,
and `verification_flags` carrying three open questions — whether an unsecured
facility needs a negative-pledge event of default, whether limb (g) should be
qualified by materiality or a cure period, and whether this clause's operative
text should live in the engine at all.

**Nothing here is a legal conclusion.** No limb was added, none was reworded; the
only editorial act was to separate the limb that presupposes security from the
ones that do not.

## Verified — both directions

| state | generates | security clause | security limb |
|---|---|---|---|
| secured + collateral | yes, 29 clauses | present | present |
| secured + no collateral | refused | — | — |
| unsecured + no collateral | yes, 28 clauses | absent | absent |
| unsecured + collateral | refused, contradiction named | — | — |

Pinned by `tests/loanSecurityTreatment.test.mjs`. Both directions, because a
repair that simply dropped the security treatment would satisfy every negative
assertion on its own.

## What C2 did NOT do

The resolver is unchanged. This edge was repaired **in the knowledge**, so the
six remaining dependency overrides are untouched and the mechanism that produced
them is intact. `positionOverride.test.mjs` moved the loan from OVERRIDDEN to
RESPECTED and still records one override plus three respected gates as controls.

## The constraint C3 has to solve

`resolveExplicitKbDependencies` cannot evaluate a target's applicability because
**the gate is not in scope**. Applicability lives in the blueprint
(`include_if: "is_secured == true"`); the resolver receives the assembled clause
list, the variables, the document type and the set of variant-replaced ids — no
blueprint, and no record of which clauses a gate excluded.

So distinguishing `depends_on` from `required_with` is not only a semantic
change to the knowledge. It needs the resolver to know **what the gate decided**,
which means either passing the blueprint down or passing the excluded set that
clause selection already computed. The second is smaller and says exactly what
is needed: *this clause was considered and excluded*, as against *this clause was
never in play*.
