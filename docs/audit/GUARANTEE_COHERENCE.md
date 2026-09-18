# D4.25 — does the cap/indemnity inconsistency reproduce in the guarantee family?

## Does each family order the two clauses against each other?

| family | clause | interaction rule present |
|---|---|---|
| Founders | `CORE_LIABILITY_LIMIT_FALLBACK_001` | **no** |
| Founders | `CORE_INDEMNITY_FULL_001` | **no** |
| Guarantee | `GUARANTEE_OBLIGATION_001` | **yes** |
| Guarantee | `GUARANTEE_INDEMNITY_001` | **yes** |

Founders carries an interaction rule: **false**. Guarantee carries one: **true**.

**Reachability.** 21 document types carry a cap AND an indemnity. 5 carry the two DECISION-BEARING clauses together: `COMMERCIAL_LEASE_AGREEMENT`, `EMPLOYMENT_CONTRACT`, `FOUNDERS_AGREEMENT`, `LEAVE_AND_LICENSE_AGREEMENT`, `NDA`.
So the D4.24 inconsistency is not hypothetical — it is reachable in real documents, and in
four of those five families a third principal is admitted today.

The guarantee family states it TWICE, from both ends — the cap says it applies "taken
together with any liability under the indemnity", and the indemnity says it "forms part
of, and shall not increase, the aggregate cap". Belt and braces, deliberately.

## The same arithmetic, both families

Cap ₹10,00,000, loss ₹25,00,000, 3 parties.

### Founders — cap and indemnity both bound the SAME exposure, with nothing ordering them

| cap treatment | indemnity promises | cap permits | coherent |
|---|---|---|---|
| SHARED + SEVERAL_TO_EACH | ₹50,00,000 | ₹10,00,000 | **NO** |
| PER_PARTY + SEVERAL_TO_EACH | ₹50,00,000 | ₹30,00,000 | **NO** |

### Guarantee — the indemnity is inside the cap, and s.146 works on a different axis

| cap treatment | creditor may recover | indemnity adds exposure | s.146 share each | within each cap | coherent |
|---|---|---|---|---|---|
| SHARED | ₹10,00,000 | **no** — express rule | ₹3,33,333.333 | yes | **yes** |
| PER_PARTY | ₹25,00,000 | **no** — express rule | ₹8,33,333.333 | yes | **yes** |

## Which of the three outcomes

Founders incoherent combinations: **2 of 2**.
Guarantee incoherent combinations: **0 of 2**.

**IT DOES NOT REPRODUCE**, and the two reasons are different from each other:

1. **The guarantee family already drafts the interaction.** The indemnity is expressed to
   form part of the cap, from both ends. The two clauses cannot promise more than the cap
   permits because one of them says so.

2. **Section 146 does not do what it might appear to do here.** It allocates AS BETWEEN the
   co-sureties, in the absence of contract to the contrary. The cap bounds what the CREDITOR
   may recover, under s.128's "unless it is otherwise provided by the contract". A rule about
   contribution between sureties and a rule about the creditor's reach operate on different
   axes and therefore cannot contradict each other. **The statute did not resolve the conflict;
   there was no conflict for it to resolve.** Testing that rather than assuming it is the
   difference between a finding and a plausible story.

## What this says about building a consistency engine

The generalisable statement is narrower than INCONSISTENT_ANSWERS, and better:

> Cross-treatment inconsistency arises where two treatments quantify **the same exposure on
> the same axis** with no precedence rule between them. It does not arise where an express
> interaction clause orders them, and it does not arise where a statute allocates on a
> different axis.

So the defect is **a missing interaction clause, not a missing engine** — and the remedy
already exists in this repository, authored by the same hands, in another family. A
consistency checker would be a detector for a defect that one sentence of ordinary drafting
prevents. That is worth knowing before building one, and it is the opposite of what D4.24
looked like it was pointing at.

**The N-party question survives untouched.** "The aggregate liability of the Guarantor" with
three co-guarantors is still per-guarantor or shared, and s.146 does not answer it because it
speaks to contribution rather than to the ceiling. LIABILITY_CAP_APPORTIONMENT therefore
reaches the guarantee family too — and this probe classifies nothing.
