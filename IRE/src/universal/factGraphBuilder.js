export function buildFactGraph(document, extractedFacts) {
    const clauses = document.clauses || [];
  
    return {
      metadata: {
        documentType: document.document_type,
        jurisdiction: document.jurisdiction
      },
  
      parties: clauses
        .filter(c => c.category === "IDENTITY")
        .map(c => ({ text: c.text })),
  
      payments: {
        exists: extractedFacts.hasConsideration,
        amount: extractedFacts.considerationValue
      },
  
      restrictions: {
        nonCompete: {
          exists: extractedFacts.hasNonCompete,
          durationMonths: extractedFacts.nonCompeteDurationMonths
        }
      },
  
      dispute: {
        arbitration: {
          exists: extractedFacts.hasArbitration,
          seat: extractedFacts.arbitrationSeat
        }
      },
  
      termination: {
        noticeDays: extractedFacts.terminationNoticeDays
      },
  
      indemnity: {
        exists: extractedFacts.hasIndemnity
      }
    };
  }