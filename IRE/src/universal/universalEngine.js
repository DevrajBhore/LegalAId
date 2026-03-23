import { extractFacts } from "./factExtractor.js";
import { buildFactGraph } from "./factGraphBuilder.js";
import { getTriggeredPrimitives } from "./triggerEngine.js";

import { evaluateFreeConsent } from "./primitives/consent.js";
import { evaluateEnforceability } from "./primitives/enforceability.js";
import { evaluateCapacity } from "./primitives/capacity.js";
import { evaluateRestraint } from "./primitives/restraintOfTrade.js";
import { evaluateTermination } from "./primitives/termination.js";
import { evaluateArbitration } from "./primitives/arbitration.js";
import { evaluateConsideration } from "./primitives/consideration.js";
import { evaluateIndemnity } from "./primitives/indemnity.js";

export function runUniversalValidation(document) {
  const clauseTexts = document?.clauses?.map((c) => c.text || "").join(" ");

  const extractedFacts = extractFacts(document);
  const factGraph = buildFactGraph(document, extractedFacts);
  const triggered = getTriggeredPrimitives(extractedFacts);

  let issues = [];

  // 🔹 Always run core doctrine checks
  issues.push(...evaluateCapacity(extractedFacts, clauseTexts));
  issues.push(...evaluateConsideration(extractedFacts, clauseTexts));
  issues.push(...evaluateEnforceability(extractedFacts, clauseTexts));
  issues.push(...evaluateFreeConsent(extractedFacts, clauseTexts));

  // 🔹 Conditional primitives
  if (triggered.includes("restraintOfTrade")) {
    issues.push(...evaluateRestraint(extractedFacts, clauseTexts));
  }

  if (triggered.includes("termination")) {
    issues.push(...evaluateTermination(extractedFacts));
  }

  if (triggered.includes("arbitration")) {
    issues.push(...evaluateArbitration(extractedFacts, clauseTexts));
  }

  if (triggered.includes("indemnity")) {
    issues.push(...evaluateIndemnity(extractedFacts, clauseTexts));
  }

  return {
    factGraph,
    triggered,
    issues,
  };
}
