# Phase D4.5 — what is the smallest independently selectable legal unit?

D4.4-B established that `requirement -> clause` is too coarse: a clause can implement
several legally distinct propositions under different statutes. The obvious response is a
TREATMENT object between them. This probe asks whether the evidence supports one, because
an abstraction earns its place by defeating a failure the existing model cannot represent.

## The library as written

- 315 clauses
- 182 cite more than one distinct Act
- **142** of those have at least as many sentences as Acts
- **40** have fewer sentences than Acts and cannot be split along
  authority lines without rewriting the text

> The sentence count is an UPPER BOUND on severability and nothing more. A single sentence
> can carry two obligations and four sentences can all serve one. What the count settles is
> only the negative case: a clause with fewer sentences than Acts certainly cannot be split
> as written.

## Is a treatment reusable? NOT DEMONSTRATED.

370 distinct authorities are cited across the library; 146 by more
than one clause and 114 across more than one category. **Those numbers do not
mean what they appear to mean.**

Indian Contract Act 1872 s.73 is cited by 26 clauses in 13 categories, and the authoring
notes say what it is doing there: *"Compensation for loss caused by breach"*, *"Damages for
breach"*, *"Damages for breach of employment obligation"*. Those 26 clauses are not
implementing one damages treatment — each imposes its own obligation and cites the general
law of damages as background. The same is true of s.37 (obligation to perform) and s.10
(formation).

**Citing the same section is not implementing the same proposition.** On this evidence the
smallest independently selectable legal unit is still the CLAUSE, and the repair for a
composite clause is to split it rather than to introduce a layer of treatment objects that
would be one-to-one with clauses almost everywhere.

### What is actually missing

Not a treatment layer — a declaration of which authority each clause exists to implement.
198 of 315 clauses carry no `statutory_reference` at all, and
47 of the 117 that do name more than one. So for most of the library there is no
way to tell a clause's own proposition from the background law it cites — which is exactly
how a principal-employer liability allocation under EPF s.8A came to live inside a clause
about key personnel, with nothing to mark it as a separate thing.

That declaration is far cheaper than a treatment layer, and it is the prerequisite for one:
a clause whose own proposition is unstated cannot be decomposed into treatments by anybody,
machine or advocate.

### Authorities expressed by the most clauses

| authority | clauses | categories |
|---|---|---|
| `Indian Contract Act, 1872 s.27` | 26 | 10 |
| `Indian Contract Act, 1872 s.73` | 26 | 13 |
| `Indian Contract Act, 1872 s.10` | 23 | 10 |
| `Indian Contract Act, 1872 s.37` | 19 | 13 |
| `Indian Contract Act, 1872 s.74` | 12 | 7 |
| `Information Technology Act, 2000 s.43A` | 11 | 4 |
| `Indian Contract Act, 1872 s.39` | 11 | 6 |
| `Copyright Act, 1957 s.17` | 10 | 4 |
| `Consumer Protection (E-Commerce) Rules, 2020 s.4` | 9 | 4 |
| `Indian Contract Act, 1872 s.124` | 8 | 6 |
| `Indian Contract Act, 1872 s.55` | 8 | 6 |
| `Indian Contract Act, 1872 s.63` | 8 | 7 |
| `Code on Social Security, 2020 s.53` | 8 | 3 |
| `Registration Act, 1908 s.17` | 7 | 6 |
| `Transfer of Property Act, 1882 s.105` | 7 | 4 |

### Clauses that cannot be split along authority lines as written

| clause | distinct Acts | sentences |
|---|---|---|
| `CORE_COMPLIANCE_WITH_LAW_001` | 5 | 1 |
| `CORE_CONFIDENTIALITY_001` | 4 | 1 |
| `CORE_SIGNATURE_BLOCK_001` | 4 | 1 |
| `NDA_CONFIDENTIAL_INFORMATION_SCOPE_001` | 3 | 1 |
| `SUPPLY_GOODS_DESCRIPTION_001` | 3 | 1 |
| `CORE_DEFINITIONS_001` | 3 | 1 |
| `CORE_GOVERNING_LAW_001` | 3 | 1 |
| `CORE_NOTICE_001` | 3 | 1 |
| `CORE_RELATIONSHIP_OF_PARTIES_001` | 4 | 2 |
| `IP_ASSIGNMENT_001` | 2 | 1 |
| `NDA_BREACH_REMEDIES_001` | 2 | 1 |
| `NDA_DATA_SECURITY_001` | 2 | 1 |
| `IP_LICENSE_001` | 2 | 1 |
| `IP_LICENSE_RESTRICTIONS_001` | 2 | 1 |
| `SERVICE_SCOPE_001` | 2 | 1 |
| `CORE_AMENDMENT_001` | 2 | 1 |
| `CORE_ASSIGNMENT_001` | 2 | 1 |
| `CORE_CONTRACT_FORMATION_001` | 2 | 1 |
| `CORE_LATE_PAYMENT_INTEREST_001` | 2 | 1 |
| `CORE_COUNTERPARTS_001` | 2 | 1 |

For each of these, treatment-level selection would mean AUTHORING NEW LEGAL TEXT, not
composing existing text. That is a different and much larger undertaking than splitting a
clause whose propositions already sit in separate sentences.
