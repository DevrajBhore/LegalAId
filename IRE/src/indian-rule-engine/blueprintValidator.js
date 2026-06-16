export function validateBlueprint(requiredClauses, draftedClauses, variantGroups = []) {

    const draftedIds = new Set(draftedClauses.map(c => c.clause_id));

    // A required clause that a variant slot REPLACES is satisfied when any of
    // that slot's alternatives (the stronger context-matched clause, or its
    // default) is present in the draft.
    const satisfiedByVariant = (id) => {
      const group = variantGroups.find(g => g.replaces === id);
      return Boolean(group) && group.alternatives.some(alt => draftedIds.has(alt));
    };

    const missing = requiredClauses.filter(
      id => !draftedIds.has(id) && !satisfiedByVariant(id)
    );

    return missing.map(id => ({
      rule_id: "MISSING_REQUIRED_CLAUSE",
      severity: "CRITICAL",
      message: `Blueprint requires clause ${id} but it is missing`
    }));

  }