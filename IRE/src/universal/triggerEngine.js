export function getTriggeredPrimitives(facts) {
    const primitives = [];
  
    if (facts.hasConsideration) primitives.push("consideration");
    if (facts.hasNonCompete) primitives.push("restraintOfTrade");
    if (facts.hasArbitration) primitives.push("arbitration");
    if (facts.terminationNoticeDays !== null) primitives.push("termination");
    if (facts.hasIndemnity) primitives.push("indemnity");
  
    return primitives;
  }