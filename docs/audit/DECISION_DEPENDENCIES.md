# D4.24 — are the six open decisions independent?

Decisions: **6**. Ordered pairs: **30**.

| | LCA | IA | TFDS | TAS | ARS | SAADP |
|---|---|---|---|---|---|---|
| **LCA** LIABILITY_CAP_APPORTIONMENT | · | **C** | — | — | **C** | — |
| **IA** INDEMNITY_APPORTIONMENT | **C** | · | — | — | — | — |
| **TFDS** TERMINATION_FOR_DEFAULT_SCOPE | — | — | · | **C** | — | **G** |
| **TAS** TRANSITION_ASSISTANCE_SCOPE | — | — | — | · | — | — |
| **ARS** ARBITRATION_REFERENCE_SCOPE | — | — | — | — | · | — |
| **SAADP** SURVIVAL_AGAINST_A_DEPARTING_PARTY | **C** | — | — | — | **C** | · |

G = GATES, C = CONSTRAINS, D = DETERMINES, — = independent. Row resolves, column is affected.

## Edge census

| edge kind | count | meaning |
|---|---|---|
| DETERMINES | 0 | resolving one fixes another outright |
| GATES | 1 | resolving one can delete the other question |
| CONSTRAINS | 6 | removes candidates, or makes some answer pairs inconsistent |
| INDEPENDENT | 23 | no relation |

## The claimed edges, each with a worked instance

### TERMINATION_FOR_DEFAULT_SCOPE → SURVIVAL_AGAINST_A_DEPARTING_PARTY — **GATES**

Choose ENDS_THE_INSTRUMENT: the survival trigger fires, every former party stays bound, and there is nothing left to ask. Choose REQUIRES_ALL_INNOCENT_PARTIES: still instrument-level, same result. Only ENDS_THAT_RELATIONSHIP leaves a party outside both regimes and needs a second answer.

*Demonstrated in:* docs/audit/SURVIVAL_COUNTERFACTUAL.md — 3 of 3 pair-regimes differ between the worlds

### TERMINATION_FOR_DEFAULT_SCOPE → TRANSITION_ASSISTANCE_SCOPE — **CONSTRAINS**

TRANSITION_ASSISTANCE_SCOPE offers TO_EACH_REMAINING or TO_THE_CONTINUING_ENTITY. Under ENDS_THE_INSTRUMENT there IS no continuing entity — the venture has ended for everybody — so the second candidate has no referent and the choice collapses to one. Under ENDS_THAT_RELATIONSHIP both remain live. Resolving the parent therefore deletes a candidate from the child without answering it.

### LIABILITY_CAP_APPORTIONMENT → INDEMNITY_APPORTIONMENT — **CONSTRAINS** (both directions)

Three parties, a cap of ₹10,00,000 and a loss of ₹25,00,000 indemnifiable by two parties to the third. SEVERAL_TO_EACH has each indemnifier owe the whole loss to each indemnitee, so the indemnity promises ₹50,00,000 of cover. The table below computes what each cap treatment permits.

THE COMPUTATION CORRECTED THE CLAIM THIS EDGE WAS FIRST WRITTEN WITH. The narrative said SHARED plus SEVERAL_TO_EACH conflicts while PER_PARTY plus SEVERAL_TO_EACH is coherent. It is not: at three parties PER_PARTY permits ₹30,00,000 against ₹50,00,000 promised, so that pairing fails too. The tension is not a quirk of one combination — an indemnity in which everyone owes everyone the whole loss outruns any finite cap once the parties outnumber two, and which clause yields is a third question nobody has asked.

*Computed, not asserted* — cap ₹10,00,000, loss ₹25,00,000, 3 parties:

| cap treatment + indemnity treatment | indemnity promises | cap permits | coherent |
|---|---|---|---|
| SHARED + SEVERAL | ₹50,00,000 | ₹10,00,000 | **NO** |
| PER_PARTY + SEVERAL | ₹50,00,000 | ₹30,00,000 | **NO** |


*Risk class:* `INCONSISTENT_ANSWERS`

### SURVIVAL_AGAINST_A_DEPARTING_PARTY → LIABILITY_CAP_APPORTIONMENT — **CONSTRAINS**

Limitation of liability is one of the nine enumerated survivors. Choose DEPARTING_PARTY_RELEASED and the cap stops binding the departing party — which also stops PROTECTING them, since a party outside the cap is exposed without limit. So the apportionment question is being answered for a set of parties that the survival answer has already changed the membership of.

### SURVIVAL_AGAINST_A_DEPARTING_PARTY → ARBITRATION_REFERENCE_SCOPE — **CONSTRAINS**

Dispute resolution is also an enumerated survivor. Choose DEPARTING_PARTY_RELEASED and the departing party is released from the arbitration agreement along with everything else — so there is no forum in which to determine whether they were validly released, or to enforce the accrued rights the same clause preserves. The candidate is close to self-defeating, which is an argument against it and is recorded as an interaction rather than settled here.

*Risk class:* `SELF_DEFEATING_COMBINATION`

### LIABILITY_CAP_APPORTIONMENT → ARBITRATION_REFERENCE_SCOPE — **CONSTRAINS**

INTER_SE_ONLY caps claims BETWEEN THE PARTIES and leaves a stranger's claim untouched. Choose it together with BILATERAL_REFERENCE and a party to the instrument who was not joined to the reference is simultaneously a party (so capped) and a stranger to the award (so unbound). 'Inter se' stops having a determinate referent, and the cap's scope turns on a procedural choice made elsewhere.

## Reading

**No DETERMINES edges and exactly 1 GATES edge.** Resolving one decision almost never
answers another and almost never deletes another. The dependency is real but it is thin.

So the answer to 'general mechanism or named edges' is **named edges**. A general
treatment-level conditionality engine would be built to carry one live instance, which is
the abstraction-on-spec this method exists to refuse. If a second and third GATES edge
appear in other families, that is the evidence to revisit it.

**The more important finding is that the risk is not conditionality at all.**

2 of the 6 edges carry a named risk, and both are about ANSWERS THAT
CONTRADICT rather than questions that disappear:

- `INCONSISTENT_ANSWERS` — LIABILITY_CAP_APPORTIONMENT with INDEMNITY_APPORTIONMENT
- `SELF_DEFEATING_COMBINATION` — SURVIVAL_AGAINST_A_DEPARTING_PARTY with ARBITRATION_REFERENCE_SCOPE

An advocate working a flat checklist can answer SHARED and SEVERAL_TO_EACH on consecutive
lines and produce an instrument that promises five times the cover its cap permits. Nothing
in the current model would notice. **The engine gap worth building is a consistency check
across resolved treatments, not a conditionality mechanism** — and it is not built here,
because one measurement is not yet a case for either.

## Implied order of resolution

1. `TERMINATION_FOR_DEFAULT_SCOPE`
2. `TRANSITION_ASSISTANCE_SCOPE`, `SURVIVAL_AGAINST_A_DEPARTING_PARTY`
3. **`INDEMNITY_APPORTIONMENT` and `LIABILITY_CAP_APPORTIONMENT` — jointly**
4. `ARBITRATION_REFERENCE_SCOPE`

**1 pair(s) cannot be sequenced at all.** INDEMNITY_APPORTIONMENT and LIABILITY_CAP_APPORTIONMENT
constrain each other, so an advocate answering them one after the other can produce a
coherent answer to each and an incoherent instrument. They are one decision with two parts.

TERMINATION_FOR_DEFAULT_SCOPE comes first because it gates one question and constrains
another. Answering it is worth more than any other single answer, which is a scheduling
fact a flat list cannot express.
