// backend/commercial/protectionLibrary.js

export const PROTECTION_LIBRARY = {
  LIABILITY_CAP: {
    build: () => ({
      clause_id: "AUTO-LIAB-001",
      category: "RISK",
      title: "Limitation of Liability",
      text:
        "The aggregate liability of either Party arising out of or in connection with this Agreement shall not exceed the total consideration paid under this Agreement, except in cases of fraud, wilful misconduct, or liabilities that cannot be limited under applicable law.",
      statutory_reference: "Indian Contract Act, 1872, Section 73",
    }),
  },

  INDEMNITY: {
    build: () => ({
      clause_id: "AUTO-INDEM-001",
      category: "RISK",
      title: "Indemnity",
      text:
        "Each Party shall indemnify and hold harmless the other Party against losses, damages, claims, costs, and liabilities arising from that Party's breach of this Agreement, negligence, or wilful misconduct.",
      statutory_reference: "Indian Contract Act, 1872, Section 124",
    }),
  },

  FORCE_MAJEURE: {
    build: () => ({
      clause_id: "AUTO-FM-001",
      category: "FORCE_MAJEURE",
      title: "Force Majeure",
      text:
        "Neither Party shall be liable for any failure or delay in performance to the extent caused by force majeure events or other events beyond its reasonable control, including acts of God, natural disasters, war, civil disturbance, strikes, or governmental action, provided that the affected Party promptly notifies the other Party and resumes performance as soon as reasonably practicable.",
      statutory_reference: "Indian Contract Act, 1872, Section 56",
    }),
  },

  IP_OWNERSHIP: {
    build: () => ({
      clause_id: "AUTO-IP-001",
      category: "IP",
      title: "Intellectual Property Ownership",
      text:
        "Except for each Party's pre-existing intellectual property, all intellectual property in work product, deliverables, or materials created specifically under this Agreement shall vest in the commissioning Party upon full payment of the applicable fees, and the creating Party shall execute all documents reasonably required to perfect such ownership.",
      statutory_reference: "Copyright Act, 1957",
    }),
  },

  LATE_PAYMENT_INTEREST: {
    build: () => ({
      clause_id: "AUTO-LPI-001",
      category: "FINANCE",
      title: "Late Payment Interest",
      text:
        "Any undisputed amount not paid on the due date shall accrue interest from the due date until actual payment at the rate of eighteen percent (18%) per annum or the maximum rate permitted by law, whichever is lower.",
      statutory_reference: "Indian Contract Act, 1872",
    }),
  },

  TERMINATION_NOTICE: {
    build: () => ({
      clause_id: "AUTO-TN-001",
      category: "TERMINATION",
      title: "Termination Notice",
      text:
        "Where termination is permitted under this Agreement, the terminating Party shall provide at least thirty (30) days' prior written notice, unless immediate termination is expressly permitted for material breach, fraud, or insolvency.",
      statutory_reference: "Indian Contract Act, 1872",
    }),
  },
};
