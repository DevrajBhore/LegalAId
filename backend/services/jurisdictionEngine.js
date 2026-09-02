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

  // The terms an arbitration clause has to settle if it is going to work when it
  // is finally needed. Leaving them out does not leave them open -- it leaves
  // them to be argued about at the moment the Parties are least able to agree.
  // Seat is stated separately from venue because under the 1996 Act the seat is
  // what fixes supervisory jurisdiction, and a clause that names only a "venue"
  // invites the argument that no court was chosen at all.
  // True only when we have an actual city; a bare state is not a seat.
  // A venue equal to the governing-law state IS the state: injectJurisdictionRules
  // falls disputeVenue back to `governingLawState || operatingState` before this
  // function ever sees it, so a bare-state venue arrives looking like a city.
  // Testing `executionCity || disputeVenue` for truthiness therefore passed on a
  // state and kept emitting "the seat of arbitration shall be Maharashtra" -- the
  // exact defect this was written to prevent. Compare against the state instead.
  const venueText = normalizeWhitespace(disputeVenue);
  const stateText = normalizeWhitespace(governingLawState);
  const seatIsPlace =
    Boolean(normalizeWhitespace(executionCity)) ||
    (Boolean(venueText) && venueText.toLowerCase() !== stateText.toLowerCase());

  const seatSentence = (place) =>
    seatIsPlace
      ? `The seat of arbitration shall be ${place}, and the courts at ${place} shall have exclusive supervisory jurisdiction over the arbitration.`
      // No city was captured. Naming the state would fix no court at all, so the
      // clause states a rule that resolves to one: the Parties pick a place, and
      // failing that the place of execution governs. Both are identifiable
      // forums; neither puts a city into the Parties' mouths that they did not
      // choose.
      : `The seat of arbitration shall be such place within ${place} as the Parties agree in writing before the arbitration commences and, failing such agreement, the place at which this Agreement was executed; and the courts at the seat so determined shall have exclusive supervisory jurisdiction over the arbitration.`;

  const hearingSentence = (place) =>
    seatIsPlace
      ? `Hearings may be held at ${place} or, where the arbitrator so directs or the Parties agree, by video conference.`
      : `Hearings may be held at the seat or, where the arbitrator so directs or the Parties agree, by video conference.`;

  const arbitrationTerms = (place) =>
    [
      seatSentence(place),
      hearingSentence(place),
      "The arbitral tribunal shall consist of a sole arbitrator, and the proceedings and the award shall be in the English language.",
      "The award shall be in writing, shall state the reasons on which it is based, and shall be final and binding on the Parties.",
      "The arbitrator shall determine the costs of the arbitration, including the fees and expenses of the arbitrator and the reasonable legal costs of the Parties, in accordance with Section 31A of the Arbitration and Conciliation Act, 1996.",
      "Nothing in this clause prevents a Party from applying to a competent court for interim measures of protection under Section 9 of the Arbitration and Conciliation Act, 1996, before or during the arbitral proceedings.",
    ]
      .map((term, index) => `(${String.fromCharCode(97 + index)}) ${term}`)
      .join("\n");

  if (normalizedMethod === "courts") {
    return `The Parties shall attempt in good faith to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through amicable discussions. If the dispute remains unresolved within fifteen (15) days of written notice, ${seatIsPlace ? `the competent courts at ${venue}` : `the competent courts having jurisdiction in the State of ${venue}`} shall have exclusive jurisdiction, subject to applicable law.`;
  }

  if (normalizedMethod === "negotiation, then arbitration") {
    return `The Parties shall first seek to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through good-faith negotiations for a period of fifteen (15) days after written notice of the dispute. If the dispute is not resolved within that period, it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The arbitration shall be conducted on the following terms:\n${arbitrationTerms(venue)}`;
  }

  if (normalizedMethod === "mediation, then arbitration") {
    return `The Parties shall first attempt to resolve any dispute, controversy, or claim arising out of or in connection with this Agreement through mediation in ${venue}. If the dispute is not settled within thirty (30) days after the mediator is appointed, the dispute shall be finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The arbitration shall be conducted on the following terms:\n${arbitrationTerms(venue)}`;
  }

  return `Any dispute, controversy, or claim arising out of or in connection with this Agreement shall first be attempted to be resolved amicably between the Parties. If the dispute remains unresolved within fifteen (15) days of written notice, it shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. ${arbitrationAppointmentSentence} The arbitration shall be conducted on the following terms:\n${arbitrationTerms(venue)}`;
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
