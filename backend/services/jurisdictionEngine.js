function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeChoice(value = "") {
  return normalizeWhitespace(value).toLowerCase();
}

function buildGoverningLawClause(governingLawState = "") {
  const state = normalizeWhitespace(governingLawState);
  if (!state) {
    return "This Agreement shall be governed by and construed in accordance with the laws of India.";
  }

  return `This Agreement shall be governed by and construed in accordance with the laws of India and, to the extent relevant to local procedural, registration, or stamp matters, as applied in the State of ${state}.`;
}

// A seat of arbitration and a court's jurisdiction are both PLACES. Naming a
// state ("the seat shall be Maharashtra", "the courts at Maharashtra") fixes
// neither: under the Arbitration and Conciliation Act, 1996 the seat determines
// which court exercises supervisory jurisdiction, and a state is not a forum a
// party can file in. Render "City, State" whenever the city is known, and fall
// back to naming the competent courts OF the state -- which is at least
// grammatical and identifiable -- when it is not.
function composeForum(city = "", state = "") {
  const place = normalizeWhitespace(city);
  const region = normalizeWhitespace(state);
  if (place && region && place.toLowerCase() !== region.toLowerCase()) {
    return `${place}, ${region}`;
  }
  return place || region || "";
}

function buildDisputeResolutionClause(method = "", disputeVenue = "", governingLawState = "", executionCity = "") {
  const forum = composeForum(executionCity || disputeVenue, governingLawState);
  const venue = forum || normalizeWhitespace(disputeVenue || governingLawState) || "Mumbai";
  const normalizedMethod = normalizeChoice(method);
  const arbitrationAppointmentSentence =
    "The arbitration shall be conducted by a sole arbitrator jointly appointed by the Parties and, failing agreement within fifteen (15) days of a written request, the arbitrator shall be appointed in accordance with the Arbitration and Conciliation Act, 1996.";

  if (normalizedMethod === "courts") {
    return `The Parties shall attempt in good faith to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through amicable discussions. If the dispute remains unresolved within fifteen (15) days of written notice, the competent courts at ${venue} shall have exclusive jurisdiction, subject to applicable law.`;
  }

  if (normalizedMethod === "negotiation, then arbitration") {
    return `The Parties shall first seek to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through good-faith negotiations for a period of fifteen (15) days after written notice of the dispute. If the dispute is not resolved within that period, it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The seat and venue of arbitration shall be ${venue}, the proceedings shall be conducted in English, and the arbitral award shall be final and binding on the Parties.`;
  }

  if (normalizedMethod === "mediation, then arbitration") {
    return `The Parties shall first attempt to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through mediation in ${venue}. If the dispute is not settled within thirty (30) days after the mediator is appointed, the dispute shall be finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The seat and venue of arbitration shall be ${venue}, the proceedings shall be conducted in English, and the arbitral award shall be final and binding on the Parties.`;
  }

  return `Any dispute, controversy, or claim arising out of or in connection with this Agreement shall first be attempted to be resolved amicably between the Parties. If the dispute remains unresolved within fifteen (15) days of written notice, it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The seat and venue of arbitration shall be ${venue}, the proceedings shall be conducted in English, and the arbitral award shall be final and binding on the Parties.`;
}

function injectStampExecutionText(text = "", operatingState = "") {
  const normalizedText = String(text || "");
  if (/stamp paper|non-judicial stamp/i.test(normalizedText)) {
    return normalizedText;
  }

  const state = normalizeWhitespace(operatingState);
  const stampPrefix = state
    ? `IN WITNESS WHEREOF, the Parties have executed this Agreement on non-judicial stamp paper of appropriate value as applicable in ${state}.\n\n`
    : "IN WITNESS WHEREOF, the Parties have executed this Agreement on non-judicial stamp paper of appropriate value, if required by applicable law.\n\n";

  return `${stampPrefix}${normalizedText}`;
}

export function injectJurisdictionRules(draft, input) {
  if (!draft || !Array.isArray(draft.clauses) || !input) {
    return draft;
  }

  const operatingState = normalizeWhitespace(input.variables?.operating_state);
  const governingLawState = normalizeWhitespace(
    input.variables?.governing_law_state || operatingState
  );
  const disputeResolutionMethod = normalizeWhitespace(
    input.variables?.dispute_resolution_method || "Arbitration"
  );
  // The seat of arbitration is no longer a separate intake field -- the
  // jurisdiction already captured supplies it. A seat is properly a place, so
  // prefer the city where the instrument is executed over the bare state name,
  // and fall back to the state only when no city is known.
  const disputeVenue = normalizeWhitespace(
    input.variables?.arbitration_city ||
      input.variables?.execution_city ||
      governingLawState ||
      operatingState
  );

  const modifiedClauses = draft.clauses.map((clause) => {
    const category = String(clause.category || "").toUpperCase();
    let nextText = clause.text || "";

    if (category === "DISPUTE_RESOLUTION" || category === "ARBITRATION") {
      nextText = buildDisputeResolutionClause(
        disputeResolutionMethod,
        disputeVenue,
        governingLawState,
        normalizeWhitespace(input.variables?.execution_city)
      );
    }

    if (category === "GOVERNING_LAW") {
      nextText = buildGoverningLawClause(governingLawState);
    }

    if (category.includes("SIGNATURE")) {
      nextText = injectStampExecutionText(nextText, governingLawState || operatingState);
    }

    return {
      ...clause,
      text: nextText,
    };
  });

  return {
    ...draft,
    jurisdiction: governingLawState || operatingState || draft.jurisdiction,
    clauses: modifiedClauses,
  };
}
