export class IndianRuleRegistry {
  constructor() {
    this.clauses = new Map();
    this.mappings = new Map();
    this.constraintsByDomain = new Map();
    this.mandatoryClauses = new Map();
  }

  addClauses(clauses) {
    clauses.forEach(c => this.clauses.set(c.clause_id, c));
  }

  addMapping(documentType, clauseIds) {
    this.mappings.set(documentType, clauseIds);
  }

  addMandatoryClauses(documentType, clauseIds) {
    if (!this.mandatoryClauses) {
      this.mandatoryClauses = new Map();
    }
    this.mandatoryClauses.set(documentType, clauseIds);
  }
  
  getMandatoryClauses(documentType) {
    return this.mandatoryClauses?.get(documentType) || [];
  }

  addConstraints(domain, rules) {
    if (!this.constraintsByDomain.has(domain)) {
      this.constraintsByDomain.set(domain, []);
    }
    this.constraintsByDomain.get(domain).push(...rules);
  }

  getConstraintsForDomains(domains) {
    return domains.flatMap(d => this.constraintsByDomain.get(d) || []);
  }
}
import { validateDocument } from "./documentValidator.js";
import { certify } from "./certifier.js";

// Initialize registry once
const registry = new IndianRuleRegistry();

// TODO: load clauses + mappings + constraints here
// For now registry is empty unless populated elsewhere

export async function validate(draft) {

  const result = validateDocument(registry, clauseIds);

  const validation = {
    issues: (result.violations || []).map(v => ({
      rule_id: v.rule_id || "UNKNOWN_RULE",
      severity: v.severity || "HIGH",
      message: v.message || "Constraint violation"
    }))
  };

  const certification = certify(validation);

  return {
    ...validation,
    ...certification
  };
}