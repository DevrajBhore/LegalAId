# Phase D4.11 — the jurisdiction contract

D4.10 established that `state_in` exists, is used by no knowledge record, and resolves its
state by reading `governing_law_state` first — a party choice — which is the wrong fact for
any rule that follows the situs of immovable property.

This audit asks the contract question rather than the implementation one: **which
jurisdictional subject would each rule need, and can the existing fact model represent those
subjects as distinct facts?** Nothing is implemented.

## Four resolution orders, two of them opposite

| module | order |
|---|---|
| `constraintEngine.js:193` (`state_in`) | `governing_law_state` → `operating_state` |
| `agreementGraphValidator.js:248` | `governing_law_state` → `operating_state` → `jurisdiction_state` |
| `documentHardening.js:2608` (stamp legislation) | **`operating_state` → `governing_law_state`** |
| `documentHardening.js:3190` (governing law) | `governing_law_state` → `operating_state` |

The same conceptual question is answered four ways, and the stamp-duty resolution is the
reverse of the engine's.

**This is not sloppiness, and reading it as sloppiness would produce the wrong repair.** The
stamp author put `operating_state` first because stamp duty follows where the instrument is
executed and the property sits, not what law the parties chose. The governing-law author put
`governing_law_state` first for the opposite and equally correct reason. **Four authors each
reached for the right jurisdictional subject and had no vocabulary to name it**, so each
encoded their intent as a fallback order. That is the strongest available evidence that what
is missing is a typed subject rather than a new evaluator.

`agreementGraphValidator.js` also reads `jurisdiction_state`, which appears in **zero** of the
40 intake schemas. A dead third fallback in a chain whose first two mean different things.

## Can the fact model carry the six subjects?

| jurisdictional subject | carried today | as what |
|---|---|---|
| contractual governing law | **yes** | `governing_law_state`, typed `select`, 36 families |
| immovable-property situs | no | `property_address`, free `textarea`, 3 families — no state |
| place of performance | no | `work_location` / `delivery_location`, free `text`, 3 families each |
| party residence / establishment | no | `party_N_address`, free `text`, 26 families |
| workplace location | no | `workplace_type` is a select about TYPE, not place |
| court / forum | partial | `arbitration_city` free text (1 family), `execution_city` free text (40) |

**One of six is a typed, machine-readable fact.** The other five exist only inside free-text
address blobs, or not at all.

`operating_state` is typed and present in all 40 families — and nothing says which of the five
non-governing-law subjects it means. It is doing undefined duty for all of them, which is why
four modules could each read it with a different subject in mind and none of them was
obviously wrong.

## The answer

> Can the existing fact model represent these as distinct facts while leaving `state_in` a
> closed predicate over an explicitly selected variable?

**Not today.** The evaluator half of that repair is small and backward-compatible — a
predicate that takes its subject explicitly rather than guessing through a fallback chain.
**The fact half is not small**: five of the six subjects are not collected as states at all,
so they cannot be selected explicitly until something asks for them, or derives them from
address free text with a provenance question attached.

So the architectural pressure is real, and it lands on the **intake and fact layer**, not the
evaluator. That is a different conclusion from both "just wire `state_in`" and "build a
jurisdiction engine", and it is the reason the contract was worth auditing before either.

## What is NOT concluded

That the five missing facts should be collected. A lease whose premises and governing law are
both in Maharashtra needs one answer, not six, and asking six questions to serve a rule
nobody has authored would be the intake equivalent of a premature abstraction. The finding is
that the facts are **not representable**, not that they must all be represented.

The immediate, separable defect is the resolution divergence: four orders, two opposite, one
reading a field that does not exist.
