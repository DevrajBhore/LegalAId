export function validateBlueprint(requiredClauses, draftedClauses) {

    const draftedIds = draftedClauses.map(c => c.clause_id);
  
    const missing = requiredClauses.filter(
      id => !draftedIds.includes(id)
    );
  
    return missing.map(id => ({
      rule_id: "MISSING_REQUIRED_CLAUSE",
      severity: "CRITICAL",
      message: `Blueprint requires clause ${id} but it is missing`
    }));
  
  }