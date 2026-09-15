# Phase D4.15 — what does "the other Party" mean?

The N-party repair has two halves that must agree: a repeating-entity representation and
N-party clause language. The language is taken first, because it decides the shape of the
schema. Designing a generic `parties[]` and discovering afterwards that it cannot express
the relationships is the failure this ordering exists to avoid.

**No interpretation is assigned mechanically.** Which reading a sentence bears is a legal
judgement, and a regex that guessed would manufacture the very evidence a schema would
then be built on.

23 shared CORE clauses carry binary-party language, 
14 of them in at least one family where more than two principals are ordinary.

| clause | occurrences | families | exposed families | quantitative |
|---|---|---|---|---|
| `CORE_FORCE_MAJEURE_001` | 5 | 25 | 5 | **yes** |
| `CORE_ASSIGNMENT_001` | 4 | 28 | 5 | no |
| `CORE_CONFIDENTIALITY_001` | 3 | 14 | 5 | no |
| `CORE_AMENDMENT_001` | 1 | 29 | 5 | no |
| `CORE_ENTIRE_AGREEMENT_001` | 1 | 31 | 5 | **yes** |
| `CORE_GOVERNING_LAW_001` | 1 | 37 | 5 | no |
| `CORE_NOTICE_001` | 1 | 29 | 5 | no |
| `CORE_TERMINATION_001` | 19 | 16 | 4 | **yes** |
| `CORE_LIMITATION_LIABILITY_001` | 4 | 15 | 4 | **yes** |
| `CORE_INDEMNITY_001` | 2 | 16 | 4 | no |
| `CORE_INDEMNITY_FULL_001` | 2 | 5 | 1 | **yes** |
| `CORE_LIABILITY_LIMIT_FALLBACK_001` | 1 | 5 | 1 | **yes** |
| `CORE_GOVERNANCE_PROTECTIONS_001` | 1 | 8 | 1 | no |
| `CORE_REPRESENTATIONS_001` | 1 | 4 | 1 | no |
| `CORE_RELATIONSHIP_OF_PARTIES_001` | 4 | 8 | 0 | no |
| `CORE_TRANSITION_ASSISTANCE_001` | 4 | 0 | 0 | no |
| `CORE_COMPLIANCE_WITH_LAW_001` | 3 | 3 | 0 | no |
| `CORE_LIABILITY_CAP_001` | 3 | 1 | 0 | **yes** |
| `CORE_FORCE_MAJEURE_FALLBACK_001` | 2 | 0 | 0 | no |
| `CORE_INSURANCE_001` | 2 | 0 | 0 | **yes** |
| `CORE_RESIDUAL_KNOWLEDGE_001` | 2 | 0 | 0 | no |
| `CORE_DATA_PROCESSING_001` | 1 | 1 | 0 | no |
| `CORE_INDEMNITY_PROCEDURE_001` | 1 | 1 | 0 | no |

**Quantitative matters more than the counts.** A confidentiality obligation read as
severally-owed means the same thing whether there are two parties or five. An aggregate
liability cap does not: with three parties, "the aggregate liability of either Party" is
either three caps or one shared cap, and those are different amounts of money.

## The sentences, for reading

### `CORE_FORCE_MAJEURE_001` — FORCE_MAJEURE

Emitted in 25 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.32; Indian Contract Act, 1872 s.56; Sale of Goods Act, 1930 s.8

- Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement to the extent that the failure or delay is caused by a Force Majeure Event, provided that the affected Party complies with this clause.
- (a) the affected Party shall notify the other Party in writing within seven (7) days of becoming aware of the Force Majeure Event, describing the event, the obligations affected, and its anticipated duration, and shall keep the other Party reasonably informed of material developments (b) the affecte

### `CORE_ASSIGNMENT_001` — ASSIGNMENT

Emitted in 28 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Transfer of Property Act, 1882 s.37; Indian Contract Act, 1872 s.37

- Neither Party shall assign, transfer, charge, subcontract, or otherwise deal with all or any of its rights or obligations under this Agreement without the prior written consent of the other Party, such consent not to be unreasonably withheld or delayed.
- (a) a Party may, on written notice to the other Party, assign or novate this Agreement to an Affiliate, or to a successor in title to substantially the whole of the business or assets to which this Agreement relates, provided that the assignee agrees in writing to be bound by this Agreement (b) any 
- (a) a Party may, on written notice to the other Party, assign or novate this Agreement to an Affiliate, or to a successor in title to substantially the whole of the business or assets to which this Agreement relates, provided that the Assignee agrees in writing to be bound by this Agreement (b) any 

### `CORE_CONFIDENTIALITY_001` — CONFIDENTIALITY

Emitted in 14 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.27; Information Technology Act, 2000 s.43A; SEBI (Prohibition of Insider Trading) Regulations, 2015 s.3; Digital Personal Data Protection Act, 2023 s.4

- Neither Party shall disclose Confidential Information to any third party except to its employees, professional advisers, auditors, or subcontractors who have a strict need to know the same and who are bound by confidentiality obligations no less protective than those contained herein, or where discl
- Each Party shall exercise at least reasonable care to protect the other Party's Confidential Information and shall, upon termination or written request, promptly return or securely destroy the Confidential Information of the other Party except to the extent retention is required by law or bona fide 

### `CORE_AMENDMENT_001` — AMENDMENT

Emitted in 29 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.62; Indian Evidence Act, 1872 s.92

- Where an amendment attracts stamp duty or compulsory registration under Applicable Law, that amendment shall be duly stamped and, where required, registered before either Party relies upon it.

### `CORE_ENTIRE_AGREEMENT_001` — ENTIRE_AGREEMENT

Emitted in 31 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Evidence Act, 1872 s.92; Indian Contract Act, 1872 s.17

- (a) each Party acknowledges that in entering into this Agreement it does not rely on, and shall have no remedy in respect of, any statement, representation, assurance, or warranty that is not expressly set out in this Agreement (b) nothing in this clause shall exclude or limit any liability for frau

### `CORE_GOVERNING_LAW_001` — GOVERNING_LAW

Emitted in 37 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.23; Civil Procedure Code, 1908 s.20; Arbitration and Conciliation Act, 1996 s.42

- (a) subject to the dispute resolution provisions of this Agreement, the competent courts at Pune, Maharashtra shall have exclusive jurisdiction to settle any dispute or claim arising out of or in connection with this Agreement, and each Party irrevocably submits to that jurisdiction (b) each Party w

### `CORE_NOTICE_001` — NOTICE

Emitted in 29 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.4; Information Technology Act, 2000 s.13; Indian Evidence Act, 1872 s.65B

- Local time and no delivery-failure notification is received, and otherwise on the next Business Day A Party changing its address or electronic mail address for notices shall give the other Party not less than seven (7) days' prior written notice of the change, and until that notice is given a commun

### `CORE_TERMINATION_001` — TERMINATION

Emitted in 16 families; exposed in FOUNDERS_AGREEMENT, JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT.
Cites: Indian Contract Act, 1872 s.39; Indian Contract Act, 1872 s.55; Specific Relief Act, 1963 s.14

- This Agreement may be terminated (a) by either Employer or Employee for convenience upon 3 days' prior written notice to the other Party;
- (b) by either Party with immediate effect if the other Party commits a material breach of this Agreement and, where such breach is capable of remedy, fails to cure it within 3 days after receipt of written notice requiring the same to be remedied;
- (c) by either Party with immediate effect if the other Party becomes insolvent, is wound up, enters into a composition with creditors, or ceases to carry on business.
- This Agreement may be terminated (a) by either Fiduciary or Processor for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either First Founder or Second Founder for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Organisation or Intern for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Lender or Borrower for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either First Party or Second Party for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Disclosing Party or Receiving Party for convenience upon 3 days' prior written notice to the other Party;
- (b) by either Party with immediate effect if the other Party commits a material breach of this Agreement and, where such breach is capable of remedy, fails to cure it within 15 days after receipt of written notice requiring the same to be remedied;
- This Agreement may be terminated (a) by either Partner 1 or Partner 2 for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Seller or Buyer for convenience upon 30 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Client or Service Provider for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Shareholder 1 or Shareholder 2 for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Client or Developer for convenience upon 3 days' prior written notice to the other Party;
- This Agreement may be terminated (a) by either Supplier or Buyer for convenience upon 3 days' prior written notice to the other Party;

### `CORE_LIMITATION_LIABILITY_001` — RISK

Emitted in 15 families; exposed in JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.73; Indian Contract Act, 1872 s.74; Consumer Protection Act, 2019 s.2

- Subject to the carve-outs below, the aggregate liability of either Party under or in connection with this Agreement, whether arising in contract, tort (including negligence), breach of statutory duty, restitution, or otherwise, shall not exceed the aggregate fees paid or payable under this Agreement
- (a) neither Party shall be liable for indirect, incidental, special, punitive, exemplary, or consequential loss, or for loss of profits, loss of anticipated savings, loss of opportunity, loss of goodwill, or loss of business, in each case whether or not that loss was foreseeable at the date of this 
- Subject to the carve-outs below, the aggregate liability of either Party under or in connection with this Agreement, whether arising in contract, tort (including negligence), breach of statutory duty, restitution, or otherwise, shall not exceed the aggregate fees paid or payable under this Agreement

### `CORE_INDEMNITY_001` — RISK

Emitted in 16 families; exposed in JOINT_VENTURE_AGREEMENT, PARTNERSHIP_DEED, SHAREHOLDERS_AGREEMENT, SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.124; Indian Contract Act, 1872 s.125; Indian Contract Act, 1872 s.73

- Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives (each an "Indemnified Party") from and against losses, liabilities, costs, and expenses directly arising from that Party's material 
- Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives (each an "Indemnified Party") from and against any loss, liability, cost, or expense arising from that Party's breach of this Agreem

### `CORE_INDEMNITY_FULL_001` — RISK

Emitted in 5 families; exposed in FOUNDERS_AGREEMENT.
Cites: Indian Contract Act, 1872 s.124; Indian Contract Act, 1872 s.125

- Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives (each an "Indemnified Party") from and against all losses, damages, claims, costs, and liabilities arising from the Indemnifying Par
- The conduct of any claim to which this indemnity applies shall be governed as follows: (a) the Indemnified Party shall notify the Indemnifying Party in writing as soon as reasonably practicable after becoming aware of a claim for which indemnity is sought, giving reasonable particulars; a delay in g

### `CORE_LIABILITY_LIMIT_FALLBACK_001` — RISK

Emitted in 5 families; exposed in FOUNDERS_AGREEMENT.
Cites: Indian Contract Act, 1872 s.73; Indian Contract Act, 1872 s.74

- The aggregate liability of either Party arising out of or in connection with this Agreement shall not exceed the total consideration paid under this Agreement, except in cases of fraud, wilful misconduct, or liabilities that cannot be limited under applicable law.

### `CORE_GOVERNANCE_PROTECTIONS_001` — GOVERNANCE

Emitted in 8 families; exposed in JOINT_VENTURE_AGREEMENT.
Cites: Indian Contract Act, 1872 s.37; Companies Act, 2013 s.128; Central Goods and Services Tax Act, 2017 s.36

- Where this Agreement confers a right of audit, of information, or an escalation route, that right is exercised on reasonable prior written notice, during normal business hours, and without unreasonable disruption to the other Party's business.

### `CORE_REPRESENTATIONS_001` — REPRESENTATIONS

Emitted in 4 families; exposed in SHARE_SUBSCRIPTION_AGREEMENT.
Cites: Indian Contract Act, 1872 s.10; Companies Act, 2013 s.179; Limited Liability Partnership Act, 2008 s.23

- Each Party represents and warrants to the other Party, as at the date of this Agreement, that: (a) it is duly incorporated, registered, or otherwise validly constituted under the laws of India, and is validly existing and in good standing (b) it has full power and authority to enter into this Agreem
