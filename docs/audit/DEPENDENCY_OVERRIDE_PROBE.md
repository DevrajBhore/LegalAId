# Phase C1 — where a dependency outranks an applicability gate

Gates stated across all blueprints: **117**  
Gates actually CLOSED by declining the flag: **51**  
Gates that could not be closed — the flag is not an answerable intake field on that 
family, or the derivation overrides the answer: 63  
Gates OVERRIDDEN — the clause ships although the user declined it: **1**  
Gates whose fixture could not generate with the flag declined: 3

Route taken by each override: {"dependencyResolver":1}

## Overridden

| document type | clause | declined flag | injected by |
|---|---|---|---|
| SALES_OF_GOODS_AGREEMENT | SUPPLY_INSPECTION_001 | include_inspection_rights | dependencyResolver |

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
| APPOINTMENT_LETTER | EMP_MOONLIGHTING_001 | restrict_moonlighting |
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
| EMPLOYMENT_CONTRACT | EMP_GARDEN_LEAVE_001 | is_senior_employee |
| EMPLOYMENT_CONTRACT | EMP_MATERNITY_BENEFITS_001 | is_female_employee |
| EMPLOYMENT_CONTRACT | EMP_FIXED_TERM_001 | is_fixed_term |
| INDEPENDENT_CONTRACTOR_AGREEMENT | SERVICE_DELIVERABLES_001 | include_deliverables |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| INDEPENDENT_CONTRACTOR_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| IP_ASSIGNMENT_AGREEMENT | IPA_COPYRIGHT_ASSIGNMENT_001 | assigns_copyright |
| IP_ASSIGNMENT_AGREEMENT | IP_PATENT_RIGHTS_001 | assigns_patents |
| IP_ASSIGNMENT_AGREEMENT | IPA_TRADEMARK_ASSIGNMENT_001 | assigns_trademarks |
| JOINT_VENTURE_AGREEMENT | CORE_DATA_PROCESSING_001 | jv_processes_personal_data |
| JOINT_VENTURE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| JOINT_VENTURE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| LOAN_AGREEMENT | LOAN_KYC_AML_001 | lender_is_nbfc |
| LOAN_AGREEMENT | GUARANTEE_OBLIGATION_001 | personal_guarantee_required |
| LOAN_AGREEMENT | LOAN_FEMA_ECB_001 | is_cross_border |
| MASTER_SERVICE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| MASTER_SERVICE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| MASTER_SERVICE_AGREEMENT | MSA_GOVERNANCE_BODY_001 | include_governance_protections |
| MASTER_SERVICE_AGREEMENT | SERVICE_CUSTOMER_DEPENDENCIES_001 | include_deliverables |
| MASTER_SERVICE_AGREEMENT | CORE_RESIDUAL_KNOWLEDGE_001 | include_confidentiality |
| NDA | NDA_NON_CIRCUMVENTION_001 | counterparty_is_vendor |
| PARTNERSHIP_DEED | CORE_DATA_PROCESSING_001 | firm_processes_personal_data |
| RENTAL_AGREEMENT | RENT_PROPERTY_USE_001 | is_commercial_lease |
| RENTAL_AGREEMENT | RENT_MAINTENANCE_001 | is_commercial_lease |
| RENTAL_AGREEMENT | RENT_SUBLEASE_001 | subletting_addressed |
| SEPARATION_AGREEMENT | EMP_GARDEN_LEAVE_001 | is_senior_employee |
| SERVICE_AGREEMENT | SERVICE_DELIVERABLES_001 | include_deliverables |
| SERVICE_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SERVICE_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| SHAREHOLDERS_AGREEMENT | CORE_DATA_PROCESSING_001 | company_processes_personal_data |
| SUPPLY_AGREEMENT | SUPPLY_SHORTAGE_001 | shortage_risk |
| SUPPLY_AGREEMENT | SUPPLY_RETURN_POLICY_001 | return_policy_required |
| SUPPLY_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SUPPLY_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_INSURANCE_001 | include_insurance |
| SOFTWARE_DEVELOPMENT_AGREEMENT | CORE_GOVERNANCE_PROTECTIONS_001 | include_governance_protections |
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
