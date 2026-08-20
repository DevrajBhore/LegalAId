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

  // These AUTO-* clauses are injected by the commercial engine AFTER document
  // hardening has run, so they are never seen by the clause builders in
  // documentHardening.js. That meant NDAs, employment contracts and the two
  // property types received this 29-word indemnity while every other document
  // type received the full conduct-of-claims version -- an indemnity with no
  // notice requirement, no conduct mechanism and no mitigation limb.
  INDEMNITY: {
    build: () => ({
      clause_id: "AUTO-INDEM-001",
      category: "RISK",
      title: "Indemnity",
      text: [
        'Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its directors, officers, employees, and authorised representatives (each an "Indemnified Party") from and against all losses, damages, claims, costs, and liabilities arising from the Indemnifying Party\'s breach of this Agreement, negligence, or wilful misconduct. The conduct of any claim to which this indemnity applies shall be governed as follows:',
        "(a) the Indemnified Party shall notify the Indemnifying Party in writing as soon as reasonably practicable after becoming aware of a claim for which indemnity is sought, giving reasonable particulars; a delay in giving notice shall reduce the Indemnifying Party's liability only to the extent it is actually prejudiced by that delay",
        "(b) the Indemnifying Party may, on written notice, assume conduct of the defence at its own cost using legal advisers reasonably acceptable to the Indemnified Party, and the Indemnified Party shall provide reasonable cooperation and access to relevant records at the Indemnifying Party's cost",
        "(c) neither Party shall settle or compromise a claim on terms that impose a non-indemnified liability, an admission of wrongdoing, or an ongoing restriction on the other without that other Party's prior written consent, save where urgent action is reasonably required to mitigate loss",
        "(d) the Indemnified Party shall take reasonable steps to mitigate its loss, and this indemnity shall not extend to loss to the extent caused or increased by the Indemnified Party's own breach, negligence, or failure to mitigate",
        "(e) recovery under this indemnity shall be reduced by any amount actually recovered from insurance or from a third party in respect of the same loss, so that the Indemnified Party is not compensated twice",
      ].join("\n"),
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
