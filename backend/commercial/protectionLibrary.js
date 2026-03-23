// backend/commercial/protectionLibrary.js

export const PROTECTION_LIBRARY = {
    LIABILITY_CAP: {
      build: () => ({
        clause_id: "AUTO-LIAB-001",
        category: "EXCLUSIONS",
        title: "Limitation of Liability",
        text: `
  The aggregate liability of either Party arising out of or in connection with this Agreement shall not exceed the total consideration paid under this Agreement.
  `,
        statutory_reference: "Indian Contract Act, 1872, Section 73"
      })
    },
  
    INDEMNITY: {
      build: () => ({
        clause_id: "AUTO-INDEM-001",
        category: "ENFORCEABILITY",
        title: "Indemnification",
        text: `
  Each Party shall indemnify and hold harmless the other Party against any losses, damages, claims or liabilities arising from breach of this Agreement.
  `,
        statutory_reference: "Indian Contract Act, 1872, Section 73"
      })
    },
  
    FORCE_MAJEURE: {
      build: () => ({
        clause_id: "AUTO-FM-001",
        category: "TERM",
        title: "Force Majeure",
        text: `
  Neither Party shall be liable for failure or delay in performance due to events beyond its reasonable control including acts of God, natural disasters, war, or governmental action.
  `,
        statutory_reference: "Indian Contract Act, 1872"
      })
    }
  };