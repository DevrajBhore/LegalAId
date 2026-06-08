# Document Rulesets — the Level-3 "clause intelligence"

This folder holds the **canonical, lawyer-reviewable rulesets** that decide which
clauses go into a document for a given situation. It is the product's moat: the
finite legal feature taxonomy + the deterministic IF/THEN rules over it.

## The core idea
Situations a user describes are **infinite**. The legal **features** that change a
contract are **finite** (~10–25 per document type). So:

1. **AI translates** the user's free-text situation → a finite feature set
   (the interview step). AI reads; it never decides.
2. **These rules decide** the document from the features. Authored and reviewed
   by lawyers, deterministic, reproducible, auditable.
3. **Uncovered cases** fall back to a safe baseline + a "needs review" flag, and
   recurring ones get promoted into new rules over time (coverage grows).

Rules **compose** — `IF investor → heightened confidentiality` and
`IF source_code → IP clause` combine automatically. So you need a rule per
*feature*, not per *situation* (O(N), not O(2^N)).

## File format (see `nda.ruleset.json` for the gold standard)
- `feature_taxonomy` — the finite features, their types, and which intake field
  fills each. This is the part AI populates.
- `baseline_clauses` — always included, with `why` + `legal_basis`.
- `rules` — each: `{ id, when, action (add|replace), clause, why, legal_basis,
  review_status, priority }`. `when` is an expression over the features.
- `fallback_policy` — what to do when nothing matches (baseline + advisory flag).
- Every rule carries `legal_basis` and `review_status` for audit and trust.

## Relationship to the engine — the generator
The engine executes via
`knowledge-base/clause_library/blueprints/<type>.blueprint.json`. The ruleset is
what a **lawyer reviews**; the blueprint is what the **engine runs**.

**`scripts/rulesetToBlueprint.mjs` keeps them in sync** so they can't drift:
```
# drift check (no write) — run all rulesets against their blueprints
node scripts/rulesetToBlueprint.mjs all

# regenerate a blueprint FROM its ruleset (ruleset becomes source of truth)
node scripts/rulesetToBlueprint.mjs knowledge-base/rulesets/nda.ruleset.json --write
```
Mapping: `baseline_clauses → required_clauses`, `rules(add) → conditional_clauses`,
`rules(replace, grouped by slot) → variant_clauses`. `proposed_rules_gaps` are
ignored (not yet wired). Recommended workflow: **edit the ruleset → `--write` →
the blueprint is regenerated**. Run the drift check in CI to fail builds where a
blueprint was hand-edited out of sync with its ruleset.

## How to add a new document type
1. Write its `feature_taxonomy` (the 10–25 dimensions that matter for that type).
2. Add intake questions for any new features (so the form/interview can fill them).
3. Author the `rules` (add/replace clauses), each with `legal_basis`.
4. Get the ruleset **lawyer-reviewed** (`review_status: approved`).
5. Mirror it into the blueprint so the engine executes it.
6. AI may draft candidate clauses/rules → they go to the review queue first.
