// backend/commercial/signalDetector.js

/**
 * Detect commercial exposure signals from document text.
 */
export function detectSignals(text = "") {
  const lower = text.toLowerCase();

  return {
    hasPayment:
      /payment|fees?|salary|remuneration|invoice|rent|royalty|subscription|compensation/.test(
        lower
      ) || /inr\s?[\d,]+/.test(lower),

    hasServices:
      /services|deliverables|consulting|engagement|scope of work|performance/.test(
        lower
      ),

    hasIP:
      /intellectual property|copyright|patent|trademark|proprietary|source code|ownership/.test(
        lower
      ),

    hasConfidentiality: /confidential|non-disclosure|nda/.test(lower),

    hasTermination: /terminate|termination|expiry|expiration/.test(lower),

    hasDisputeResolution:
      /arbitration|dispute|jurisdiction|governing law/.test(lower),
  };
}
