const INFORMATIONAL_DISCLAIMER =
  "This content is for general information about Indian legal documents. It is not legal advice and does not replace review by a qualified lawyer for your specific facts.";

export const documentInfo = {
  NDA: {
    title: "Non-Disclosure Agreement (NDA)",
    tagline: "Protect confidential information before you share it.",
    whatIsIt:
      "An NDA is a contract that controls how confidential information may be used, disclosed, protected, and returned. In India, it is generally supported by the Indian Contract Act, 1872, provided the obligations are clear, lawful, and reasonable.",
    whyNeeded:
      "Use it before sharing business plans, customer data, financials, technology details, product ideas, trade secrets, or sensitive commercial information with another person or entity.",
    commonUses: [
      "Startup discussions with investors, vendors, or consultants",
      "Sharing product, pricing, or technical information with partners",
      "Employee or contractor access to business secrets",
      "Due diligence, pilot projects, and vendor evaluation",
    ],
    keyClauses: [
      "Definition of confidential information",
      "Permitted purpose and restricted use",
      "Exclusions from confidentiality",
      "Confidentiality period and survival",
      "Return or destruction of materials",
      "Remedies, governing law, and dispute resolution",
    ],
    howToGenerate: [
      "Identify who is disclosing and who is receiving information.",
      "Describe the purpose for which information will be shared.",
      "Add the confidentiality period, agreement term, and arbitration city.",
      "Review the generated restrictions before sharing the document.",
    ],
    timeEstimate: "5 minutes",
    faqs: [
      {
        q: "Can an NDA last forever in India?",
        a: "A perpetual restraint can be risky. Trade secret protection may justify longer obligations, but ordinary confidential information should usually have a reasonable survival period.",
      },
      {
        q: "Is an NDA enough to protect an idea?",
        a: "It helps protect disclosure of the idea, but intellectual property ownership and registration may need separate protection.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  EMPLOYMENT_CONTRACT: {
    title: "Employment Contract",
    tagline: "Set role, pay, duties, confidentiality, and exit terms clearly.",
    whatIsIt:
      "An employment contract records the relationship between an employer and employee. It should align with the Indian Contract Act, 1872 and applicable labour, shops and establishments, wage, benefits, and state-specific employment rules.",
    whyNeeded:
      "It reduces disputes about job duties, salary, probation, notice period, confidentiality, IP created during employment, termination, and workplace obligations.",
    commonUses: [
      "Hiring full-time employees",
      "Issuing formal appointment terms",
      "Defining probation and confirmation terms",
      "Protecting company information and work product",
    ],
    keyClauses: [
      "Designation, role, and reporting",
      "Compensation and benefits",
      "Probation, working hours, and location",
      "Confidentiality and IP ownership",
      "Notice period and termination grounds",
      "Governing law and dispute resolution",
    ],
    howToGenerate: [
      "Enter employer and employee identity details.",
      "Add role, salary, location, start date, and notice period.",
      "Choose confidentiality, IP, and termination preferences.",
      "Review entity details so PAN, GST, and CIN fields do not remain blank.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "Can an employment contract include a non-compete?",
        a: "Post-employment non-competes are generally difficult to enforce in India under Section 27 of the Indian Contract Act, 1872. Confidentiality and non-solicit wording should be carefully drafted.",
      },
      {
        q: "Do employment terms differ by state?",
        a: "Yes. Shops and establishments rules, holidays, working hours, and other employment requirements can vary by state.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  SERVICE_AGREEMENT: {
    title: "Service Agreement",
    tagline: "Define services, deliverables, payment, acceptance, and risk.",
    whatIsIt:
      "A service agreement is a contract for performance of services. It is usually governed by the Indian Contract Act, 1872 and may also involve tax, GST, data, IP, and sector-specific obligations.",
    whyNeeded:
      "It helps avoid disputes about what services are included, when deliverables are accepted, how payment is made, what happens on delay, and who bears liability.",
    commonUses: [
      "Client and service provider engagements",
      "Professional or operational services",
      "Ongoing support or managed services",
      "Project-based commercial work",
    ],
    keyClauses: [
      "Scope of services",
      "Deliverables and acceptance criteria",
      "Fees, invoices, GST, and payment timelines",
      "Change requests and dependencies",
      "Liability cap and indemnity",
      "Termination and dispute resolution",
    ],
    howToGenerate: [
      "Describe the services and deliverables in practical detail.",
      "Enter contract value, payment terms, and duration.",
      "Add acceptance criteria and any service levels if relevant.",
      "Review risk clauses before export.",
    ],
    timeEstimate: "6 minutes",
    faqs: [
      {
        q: "Should deliverables be detailed?",
        a: "Yes. Clear deliverables and acceptance criteria reduce disputes about completion and payment.",
      },
      {
        q: "Should the agreement include GST?",
        a: "If GST applies, invoice and tax responsibility should be stated clearly.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  CONSULTANCY_AGREEMENT: {
    title: "Consultancy Agreement",
    tagline: "Engage an expert advisor without creating employment confusion.",
    whatIsIt:
      "A consultancy agreement governs advisory or professional consulting work. It should distinguish an independent consultant from an employee and record scope, fees, confidentiality, and ownership of work product.",
    whyNeeded:
      "It protects both sides by defining the consultant's mandate, payment terms, independence, deliverables, and limits of responsibility.",
    commonUses: [
      "Business, finance, HR, legal operations, or strategy consulting",
      "Technology or product advisory",
      "Temporary expert engagements",
      "Retainer-based professional support",
    ],
    keyClauses: [
      "Consulting scope",
      "Deliverables and timelines",
      "Fees, expenses, and taxes",
      "Independent contractor status",
      "Confidentiality and work-product ownership",
      "Termination and dispute resolution",
    ],
    howToGenerate: [
      "Identify the client and consultant.",
      "Describe the consulting services and deliverables.",
      "Enter fee, payment, expense, and duration details.",
      "Review independence, confidentiality, and IP language.",
    ],
    timeEstimate: "6 minutes",
    faqs: [
      {
        q: "Is a consultant the same as an employee?",
        a: "No. The agreement should avoid employee-style control if the intended relationship is independent consulting.",
      },
      {
        q: "Who owns the consultant's output?",
        a: "Ownership depends on the contract. If the client should own deliverables, the agreement should say so clearly.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  PARTNERSHIP_DEED: {
    title: "Partnership Deed",
    tagline: "Record partner contributions, profit sharing, powers, and exits.",
    whatIsIt:
      "A partnership deed records the terms of a partnership firm. Indian partnerships are governed by the Indian Partnership Act, 1932, and registration may be important for enforceability of certain claims.",
    whyNeeded:
      "It prevents disputes between partners by documenting capital contribution, profit sharing, management powers, admission or retirement of partners, accounts, and dissolution.",
    commonUses: [
      "Starting a traditional partnership firm",
      "Formalizing an existing business relationship",
      "Defining partner investments and profit sharing",
      "Recording management and banking authority",
    ],
    keyClauses: [
      "Firm name and business purpose",
      "Capital contribution",
      "Profit and loss sharing",
      "Partner duties and decision-making",
      "Accounts, audit, and bank operation",
      "Retirement, expulsion, dissolution, and dispute resolution",
    ],
    howToGenerate: [
      "Enter firm and partner details.",
      "Add business purpose and principal office.",
      "Enter contributions and profit-sharing ratio.",
      "Review decision-making, exit, and dissolution mechanics.",
    ],
    timeEstimate: "8 minutes",
    faqs: [
      {
        q: "Is registration mandatory?",
        a: "A partnership may exist without registration, but non-registration can restrict certain legal actions by the firm or partners.",
      },
      {
        q: "Should profit sharing match capital contribution?",
        a: "Not necessarily. Partners can agree on a different ratio, but it should be written clearly.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  SHAREHOLDERS_AGREEMENT: {
    title: "Shareholders Agreement",
    tagline: "Govern ownership, control, transfers, investor rights, and exits.",
    whatIsIt:
      "A shareholders agreement is a contract among shareholders and often the company. It works alongside the Companies Act, 2013 and the company's articles of association.",
    whyNeeded:
      "It defines governance, reserved matters, share transfers, information rights, founder or investor protections, deadlock resolution, and exit rights.",
    commonUses: [
      "Startup founder and investor arrangements",
      "Private company ownership governance",
      "Minority shareholder protections",
      "Share transfer and exit planning",
    ],
    keyClauses: [
      "Shareholding and capitalization",
      "Board and governance rights",
      "Reserved matters",
      "Transfer restrictions",
      "Tag-along, drag-along, and pre-emption",
      "Deadlock, exit, confidentiality, and dispute resolution",
    ],
    howToGenerate: [
      "Enter company and shareholder details.",
      "Record ownership and governance expectations.",
      "Add reserved matters and transfer restrictions.",
      "Review exit and deadlock provisions carefully.",
    ],
    timeEstimate: "10 minutes",
    faqs: [
      {
        q: "Should the articles match the shareholders agreement?",
        a: "Important rights should usually be aligned with the articles so company-level enforcement is not weakened.",
      },
      {
        q: "Is this only for startups?",
        a: "No. It is useful for many private companies with multiple owners.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  JOINT_VENTURE_AGREEMENT: {
    title: "Joint Venture Agreement",
    tagline: "Structure a shared business project with clear governance and exit rules.",
    whatIsIt:
      "A joint venture agreement records how two or more parties will collaborate for a specific business objective. It may be contractual or implemented through a company, LLP, or partnership structure.",
    whyNeeded:
      "It defines contributions, ownership, governance, business activities, IP, funding, deadlock resolution, liability allocation, and exit mechanics.",
    commonUses: [
      "Co-developing products or technology",
      "Market entry or distribution collaborations",
      "Infrastructure, manufacturing, or project ventures",
      "Founder or company collaboration arrangements",
    ],
    keyClauses: [
      "JV objective and structure",
      "Capital, asset, or service contributions",
      "Ownership and governance",
      "Business plan and reserved matters",
      "Deadlock and exit mechanism",
      "IP, confidentiality, termination, and dispute resolution",
    ],
    howToGenerate: [
      "Describe the JV structure and business objective.",
      "Enter each party's contribution and ownership expectations.",
      "Add governance, decision, and reserved matter details.",
      "Review deadlock, exit, IP, and winding-up language.",
    ],
    timeEstimate: "10 minutes",
    faqs: [
      {
        q: "Is a JV always a company?",
        a: "No. A JV can be contractual or use a separate legal entity depending on tax, liability, investment, and governance needs.",
      },
      {
        q: "Why is deadlock important?",
        a: "A JV can stall if parties have equal control or veto rights. Deadlock clauses explain what happens when decisions cannot be made.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  SUPPLY_AGREEMENT: {
    title: "Supply Agreement",
    tagline: "Set terms for supplying goods, quality, delivery, pricing, and risk.",
    whatIsIt:
      "A supply agreement governs sale and supply of goods over one or more orders. It is generally supported by the Indian Contract Act, 1872, Sale of Goods Act, 1930, GST rules, and sector-specific requirements where applicable.",
    whyNeeded:
      "It clarifies product specifications, delivery schedule, price, quality standards, inspection rights, risk transfer, rejection, warranties, and payment.",
    commonUses: [
      "Manufacturer and buyer supply relationships",
      "Recurring purchase arrangements",
      "Raw material or component supply",
      "Private-label or vendor supply",
    ],
    keyClauses: [
      "Product specifications",
      "Purchase orders and delivery",
      "Price, taxes, invoices, and payment",
      "Inspection, rejection, and replacement",
      "Risk, title, warranty, and indemnity",
      "Termination and force majeure",
    ],
    howToGenerate: [
      "Identify buyer and supplier.",
      "Describe goods, specifications, and delivery expectations.",
      "Enter price, payment, tax, and inspection terms.",
      "Review risk transfer and rejection mechanics.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "When does risk transfer?",
        a: "The agreement should say whether risk passes on dispatch, delivery, acceptance, or another agreed point.",
      },
      {
        q: "Should specifications be attached?",
        a: "For technical goods, specifications should be detailed in the agreement or a schedule.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  DISTRIBUTION_AGREEMENT: {
    title: "Distribution Agreement",
    tagline: "Appoint a distributor with territory, sales, pricing, and channel controls.",
    whatIsIt:
      "A distribution agreement sets the terms under which a distributor buys, markets, resells, or distributes products. It should be drafted carefully to avoid unclear agency, exclusivity, competition, and liability issues.",
    whyNeeded:
      "It records territory, exclusivity, sales targets, product standards, marketing obligations, payment, inventory, returns, brand use, and termination.",
    commonUses: [
      "Regional product distribution",
      "Channel partner appointments",
      "Exclusive or non-exclusive territory arrangements",
      "Brand-controlled resale networks",
    ],
    keyClauses: [
      "Appointment and territory",
      "Exclusivity and sales targets",
      "Orders, pricing, and payment",
      "Brand use and marketing obligations",
      "Inventory, returns, and product compliance",
      "Termination and post-termination restrictions",
    ],
    howToGenerate: [
      "Enter supplier and distributor details.",
      "Define territory and exclusivity.",
      "Add sales, pricing, ordering, and marketing terms.",
      "Review termination and brand-use controls.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "Is exclusivity always safe?",
        a: "Exclusivity can be useful but should be tied to clear territory, targets, duration, and termination rights.",
      },
      {
        q: "Is a distributor an agent?",
        a: "Not usually. If the distributor buys and resells on its own account, the agreement should avoid language that accidentally creates agency.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  SALES_OF_GOODS_AGREEMENT: {
    title: "Sale of Goods Agreement",
    tagline: "Document one-time or defined sale of goods with price and delivery terms.",
    whatIsIt:
      "A sale of goods agreement records the sale and purchase of movable goods. It is shaped by the Indian Contract Act, 1872 and the Sale of Goods Act, 1930.",
    whyNeeded:
      "It reduces uncertainty around goods description, price, delivery, inspection, title, risk, warranties, and remedies for non-delivery or defective goods.",
    commonUses: [
      "One-time sale of equipment or inventory",
      "Business asset purchases involving goods",
      "Bulk goods transactions",
      "Commercial purchase and delivery arrangements",
    ],
    keyClauses: [
      "Description of goods",
      "Price, taxes, and payment",
      "Delivery and inspection",
      "Transfer of title and risk",
      "Warranties and rejection rights",
      "Default, termination, and dispute resolution",
    ],
    howToGenerate: [
      "Describe the goods accurately.",
      "Enter price, tax, delivery, and payment details.",
      "Add inspection and acceptance expectations.",
      "Review risk and title transfer wording.",
    ],
    timeEstimate: "6 minutes",
    faqs: [
      {
        q: "Why separate title and risk?",
        a: "Ownership and risk of loss can pass at different times if the contract says so.",
      },
      {
        q: "Do warranties need to be written?",
        a: "Yes, express warranties and exclusions should be clear to avoid later disputes.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    title: "Independent Contractor Agreement",
    tagline: "Engage non-employee workers with clear scope, payment, and ownership terms.",
    whatIsIt:
      "An independent contractor agreement records a non-employment service relationship. It should make the contractor's independent status clear while addressing services, payment, confidentiality, IP, and compliance.",
    whyNeeded:
      "It helps avoid confusion about employment benefits, control, tax responsibility, deliverable ownership, and termination rights.",
    commonUses: [
      "Freelancer engagements",
      "Project-based technical or creative work",
      "Specialist short-term services",
      "Contractor support for startups and SMEs",
    ],
    keyClauses: [
      "Independent contractor status",
      "Scope and deliverables",
      "Fees, taxes, and expenses",
      "Confidentiality and IP assignment",
      "Compliance and non-solicitation",
      "Termination and handover",
    ],
    howToGenerate: [
      "Identify client and contractor.",
      "Describe project scope and deliverables.",
      "Enter fee, payment, duration, and expense terms.",
      "Review IP, confidentiality, and independence language.",
    ],
    timeEstimate: "6 minutes",
    faqs: [
      {
        q: "Can a contractor look like an employee?",
        a: "Yes. Excessive control, fixed employment-style hours, and integration into normal staff structures can create classification risk.",
      },
      {
        q: "Who owns contractor-created work?",
        a: "The agreement should expressly assign or license the work product if the client needs ownership.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  COMMERCIAL_LEASE_AGREEMENT: {
    title: "Commercial Lease Agreement",
    tagline: "Lease business premises with rent, use, deposit, and compliance terms.",
    whatIsIt:
      "A commercial lease records the right to use business premises. It may involve the Transfer of Property Act, 1882, Registration Act, 1908, Indian Stamp Act, 1899, state stamp laws, municipal rules, and local rent/control laws where applicable.",
    whyNeeded:
      "It protects landlord and tenant by recording rent, deposit, permitted use, lock-in, maintenance, taxes, renewal, termination, and possession terms.",
    commonUses: [
      "Office leases",
      "Retail shops or showrooms",
      "Warehouses and commercial units",
      "Business premises renewals",
    ],
    keyClauses: [
      "Premises description and permitted use",
      "Rent, deposit, escalation, and taxes",
      "Term, lock-in, renewal, and handover",
      "Maintenance, utilities, and repairs",
      "Restrictions on assignment or subletting",
      "Termination, default, and dispute resolution",
    ],
    howToGenerate: [
      "Enter landlord, tenant, and premises details.",
      "Add rent, deposit, term, escalation, and lock-in.",
      "Describe permitted use and maintenance responsibilities.",
      "Review stamp, registration, and possession terms.",
    ],
    timeEstimate: "8 minutes",
    faqs: [
      {
        q: "Does a lease need registration?",
        a: "Many leases, especially those exceeding one year, may require registration. Stamp and registration rules depend on state law and document terms.",
      },
      {
        q: "Should permitted use be specific?",
        a: "Yes. Specific use language helps avoid disputes and regulatory violations.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  LEAVE_AND_LICENSE_AGREEMENT: {
    title: "Leave and License Agreement",
    tagline: "Permit use of premises without transferring leasehold interest.",
    whatIsIt:
      "A leave and license agreement permits a licensee to occupy or use premises without creating a leasehold transfer. It is common in Indian property practice and may be affected by state stamp, registration, and local housing laws.",
    whyNeeded:
      "It clarifies license fee, deposit, duration, use restrictions, renewal, termination, maintenance, and handover while preserving the licensor's ownership and control.",
    commonUses: [
      "Residential occupancy arrangements",
      "Short-term commercial premises use",
      "Company guest house or staff accommodation",
      "Temporary licensed premises arrangements",
    ],
    keyClauses: [
      "License grant and premises description",
      "License fee, deposit, and utilities",
      "Term, renewal, and termination",
      "Use restrictions and no tenancy interest",
      "Maintenance, inspection, and handover",
      "Stamp, registration, and dispute resolution",
    ],
    howToGenerate: [
      "Enter licensor, licensee, and premises details.",
      "Add fee, deposit, term, and permitted use.",
      "Record maintenance and handover duties.",
      "Review state-specific stamp and registration requirements.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "Is leave and license the same as lease?",
        a: "No. A license permits use without transferring an interest in the property, while a lease generally creates a stronger property right.",
      },
      {
        q: "Does it need stamping?",
        a: "Yes. Stamp duty usually applies and the amount depends on state law and transaction terms.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  LOAN_AGREEMENT: {
    title: "Loan Agreement",
    tagline: "Record principal, interest, repayment, default, and security.",
    whatIsIt:
      "A loan agreement records the lender's advance of money and the borrower's repayment obligation. It is supported by the Indian Contract Act, 1872 and may involve stamp duty, security, RBI, company law, or money-lending rules depending on the parties.",
    whyNeeded:
      "It prevents disputes about amount, interest, tenure, repayment schedule, prepayment, default interest, security, guarantees, and enforcement.",
    commonUses: [
      "Private or business loans",
      "Founder or shareholder loans",
      "Secured lending against assets",
      "Inter-corporate or related-party advances",
    ],
    keyClauses: [
      "Loan amount and disbursement",
      "Interest and repayment schedule",
      "Prepayment and default interest",
      "Representations and covenants",
      "Security and guarantees",
      "Events of default and remedies",
    ],
    howToGenerate: [
      "Enter lender and borrower details.",
      "Add principal amount, interest, tenure, and repayment terms.",
      "Describe any security or guarantee.",
      "Review default, acceleration, and enforcement clauses.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "Should the agreement mention amount in words?",
        a: "Yes. Amounts should be formatted consistently in figures and words to reduce ambiguity.",
      },
      {
        q: "Can anyone lend money commercially?",
        a: "Some lending activities may need RBI, company law, or state money-lending compliance depending on the facts.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  GUARANTEE_AGREEMENT: {
    title: "Guarantee Agreement",
    tagline: "Back another party's obligation with enforceable surety terms.",
    whatIsIt:
      "A guarantee agreement records a guarantor's promise to answer for a principal debtor's obligation. Guarantees are recognized under the Indian Contract Act, 1872, especially the law of suretyship.",
    whyNeeded:
      "It gives a creditor additional recourse if the principal debtor defaults, while defining whether the guarantee is continuing, specific, limited, secured, or revocable for future obligations.",
    commonUses: [
      "Loan guarantees",
      "Payment guarantees",
      "Performance guarantees",
      "Group company or promoter support arrangements",
    ],
    keyClauses: [
      "Guaranteed obligations",
      "Continuing or specific guarantee",
      "Limit of liability",
      "Invocation procedure",
      "Guarantor representations",
      "Revocation for future obligations and discharge",
    ],
    howToGenerate: [
      "Enter creditor, principal debtor, and guarantor details.",
      "Describe the guaranteed obligation.",
      "Choose guarantee type and liability cap if any.",
      "Review invocation, revocation, and discharge provisions.",
    ],
    timeEstimate: "7 minutes",
    faqs: [
      {
        q: "What is a continuing guarantee?",
        a: "It covers a series of transactions or obligations until revoked or discharged according to law and contract terms.",
      },
      {
        q: "Can a guarantor revoke everything?",
        a: "Revocation generally affects future obligations, not liabilities already incurred, unless the agreement or law provides otherwise.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    title: "Software Development Agreement",
    tagline: "Define build scope, milestones, acceptance, IP, support, and delivery.",
    whatIsIt:
      "A software development agreement governs creation or customization of software. It combines contract principles with IP, confidentiality, data protection, information technology, and commercial delivery obligations.",
    whyNeeded:
      "It reduces disputes about requirements, milestones, source code, acceptance testing, bugs, change requests, ownership, licenses, warranties, and support.",
    commonUses: [
      "Custom software builds",
      "App or platform development",
      "SaaS customization projects",
      "Technology outsourcing",
    ],
    keyClauses: [
      "Specifications and milestones",
      "Development process and change requests",
      "Acceptance testing",
      "IP ownership and source code delivery",
      "Confidentiality, data, and security",
      "Support, warranty, liability, and termination",
    ],
    howToGenerate: [
      "Enter client and developer details.",
      "Describe software scope, milestones, and deliverables.",
      "Add payment, acceptance, source-code, and support terms.",
      "Review IP, data, warranty, and liability clauses.",
    ],
    timeEstimate: "8 minutes",
    faqs: [
      {
        q: "Who owns the software?",
        a: "Ownership depends on the agreement. If the client needs ownership, the IP assignment and source code language must be explicit.",
      },
      {
        q: "Why are acceptance tests important?",
        a: "They create an objective process for deciding whether the software meets agreed requirements and when payment or handover is due.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },

  MOU: {
    title: "Memorandum of Understanding (MOU)",
    tagline: "Record commercial intent before a detailed contract is finalized.",
    whatIsIt:
      "An MOU records the understanding between parties about a proposed collaboration or transaction. In India, parts of an MOU may become binding if they show clear intention, certainty, lawful consideration, and enforceable obligations under the Indian Contract Act, 1872.",
    whyNeeded:
      "It helps parties document intent, responsibilities, timelines, confidentiality, exclusivity, cost sharing, next steps, and which parts are binding or non-binding.",
    commonUses: [
      "Early-stage commercial collaborations",
      "Pilot projects",
      "Strategic partnerships",
      "Pre-contract transaction frameworks",
    ],
    keyClauses: [
      "Purpose and background",
      "Roles and responsibilities",
      "Commercial framework and next steps",
      "Binding and non-binding provisions",
      "Confidentiality and exclusivity",
      "Term, termination, and dispute resolution",
    ],
    howToGenerate: [
      "Identify the parties and purpose.",
      "Describe each party's expected role.",
      "Add timeline, commercial understanding, and next steps.",
      "Review which clauses should be binding.",
    ],
    timeEstimate: "5 minutes",
    faqs: [
      {
        q: "Is an MOU legally binding?",
        a: "It depends on wording and intention. Some clauses may be binding even if the overall MOU is described as non-binding.",
      },
      {
        q: "Should an MOU include confidentiality?",
        a: "Yes, if sensitive information will be exchanged before a final agreement is signed.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  },
};

const documentInfoDetails = {
  NDA: {
    informationNeeded: [
      "Full legal names, addresses, and legal form of both parties",
      "Whether the NDA is mutual or one-way in practical effect",
      "Purpose for which information is being shared",
      "Confidentiality period, agreement term, and arbitration city",
      "Any sensitive categories such as source code, pricing, customer lists, or trade secrets",
    ],
    legalNotes: [
      "Confidentiality obligations should be precise enough to avoid uncertainty under contract law.",
      "Indian courts may scrutinize broad restraint language, especially post-relationship restrictions.",
      "Trade secret style protection can justify stronger survival language than ordinary business information.",
    ],
    commonMistakes: [
      "Using an indefinite obligation for all information without explaining trade secret protection",
      "Forgetting exclusions for public domain or independently developed information",
      "Not limiting use of information to a specific purpose",
    ],
    reviewChecklist: [
      "Party names and roles are consistent",
      "No blank placeholders remain",
      "Confidentiality period is commercially reasonable",
      "Dispute city and governing law are correct",
    ],
  },

  EMPLOYMENT_CONTRACT: {
    informationNeeded: [
      "Employer CIN, PAN, GSTIN, address, and signatory details",
      "Employee name, address, PAN, role, department, and work location",
      "Salary, components, probation, start date, and notice period",
      "Confidentiality scope, IP ownership position, and termination style",
      "Applicable operating state for local employment context",
    ],
    legalNotes: [
      "State shops and establishments laws can affect working hours, leave, and employment conditions.",
      "Post-employment non-compete language is sensitive under Section 27 of the Indian Contract Act, 1872.",
      "Employee-created IP should be handled clearly, especially for software, creative, or technical roles.",
    ],
    commonMistakes: [
      "Mixing consultant language with employee language",
      "Leaving employer CIN, PAN, or employee PAN blank",
      "Using generic termination for convenience without employment-specific safeguards",
    ],
    reviewChecklist: [
      "Employer and employee descriptions match their legal status",
      "Salary and notice period are formatted correctly",
      "Confidentiality and IP clauses match the role",
      "Termination grounds are not contradictory",
    ],
  },

  SERVICE_AGREEMENT: {
    informationNeeded: [
      "Client and service provider legal details",
      "Detailed service scope, deliverables, dependencies, and acceptance criteria",
      "Contract value, payment schedule, GST/tax handling, and expenses",
      "Duration, renewal, termination notice, and arbitration city",
      "Liability cap amount and any special audit or reporting rights",
    ],
    legalNotes: [
      "The Indian Contract Act, 1872 supports service obligations when scope and consideration are clear.",
      "Acceptance and change-control mechanics reduce disputes about whether work is complete.",
      "Liability caps should use a defined amount where possible instead of vague fee references.",
    ],
    commonMistakes: [
      "Describing services too broadly",
      "Forgetting acceptance criteria",
      "Using both bullet and paragraph versions of the same obligation",
    ],
    reviewChecklist: [
      "Deliverables are specific enough to perform",
      "Payment and GST language is complete",
      "Liability cap is a clear amount",
      "Termination and handover obligations work together",
    ],
  },

  CONSULTANCY_AGREEMENT: {
    informationNeeded: [
      "Client and consultant names, addresses, and legal status",
      "Consulting scope, deliverables, and reporting expectations",
      "Consulting fee, payment terms, reimbursable expenses, and taxes",
      "Contract duration, notice period, and arbitration city",
      "Whether work product should be assigned, licensed, or retained",
    ],
    legalNotes: [
      "The agreement should avoid employee-style control if the relationship is independent consulting.",
      "Advisory output, reports, and work product ownership should be expressed clearly.",
      "Confidentiality is usually important because consultants often receive internal business information.",
    ],
    commonMistakes: [
      "Calling the consultant an employee in one clause and independent in another",
      "Ignoring ownership of reports, models, or recommendations",
      "Leaving expenses and tax responsibility unclear",
    ],
    reviewChecklist: [
      "Independent status language is consistent",
      "Scope and deliverables are practical",
      "Fee and expenses are clear",
      "Confidentiality and IP treatment match the engagement",
    ],
  },

  PARTNERSHIP_DEED: {
    informationNeeded: [
      "Firm name, principal place of business, and business purpose",
      "Partner names, addresses, and contribution amounts",
      "Profit/loss sharing ratio and management authority",
      "Bank operation, accounting, audit, and partner duties",
      "Retirement, admission, expulsion, dissolution, and dispute city",
    ],
    legalNotes: [
      "The Indian Partnership Act, 1932 governs ordinary partnership firms.",
      "Registration is not always mandatory to form a partnership, but non-registration can restrict legal enforcement.",
      "Profit sharing, capital, and authority should be internally consistent.",
    ],
    commonMistakes: [
      "Using company terminology for a partnership firm",
      "Forgetting loss-sharing or banking authority",
      "Leaving partner exit and settlement mechanics vague",
    ],
    reviewChecklist: [
      "Capital and profit-sharing figures match",
      "Partner powers are clear",
      "Accounts and audit obligations are included",
      "Dissolution and dispute clauses are workable",
    ],
  },

  SHAREHOLDERS_AGREEMENT: {
    informationNeeded: [
      "Company CIN, registered office, shareholding table, and shareholder details",
      "Board composition, quorum, voting thresholds, and reserved matters",
      "Transfer restrictions, pre-emption, tag-along, drag-along, and lock-in",
      "Information rights, investor rights, founder duties, and exit expectations",
      "Deadlock resolution and arbitration city",
    ],
    legalNotes: [
      "The agreement should align with the Companies Act, 2013 and the company's articles.",
      "Rights that affect company governance may need to be reflected in constitutional documents.",
      "Transfer restrictions should be drafted carefully for private company enforceability.",
    ],
    commonMistakes: [
      "Creating rights that conflict with the articles",
      "Using reserved matters without voting thresholds",
      "Mixing investor rights with ordinary shareholder rights without context",
    ],
    reviewChecklist: [
      "Shareholding and governance are consistent",
      "Reserved matters are precise",
      "Transfer and exit rights do not conflict",
      "Deadlock mechanics are usable",
    ],
  },

  JOINT_VENTURE_AGREEMENT: {
    informationNeeded: [
      "JV parties, structure, ownership, and business objective",
      "Capital, asset, personnel, technology, or service contributions",
      "Governance body, voting thresholds, reserved matters, and reporting",
      "Business plan, permitted activities, funding, and profit/loss sharing",
      "Deadlock, exit, winding-up, liability allocation, and IP allocation",
    ],
    legalNotes: [
      "A JV can be contractual or entity-based, and the drafting should match the chosen structure.",
      "Governance and exit provisions are often more important than generic termination language.",
      "IP, assets, liabilities, and employees should be allocated on exit or winding up.",
    ],
    commonMistakes: [
      "Only saying the JV structure is a company without explaining ownership and governance",
      "Treating exit and termination as the same thing",
      "Forgetting deadlock resolution",
    ],
    reviewChecklist: [
      "JV structure is explained in full",
      "Contributions and ownership match",
      "Deadlock and exit mechanisms are separate",
      "IP and liability allocation are included",
    ],
  },

  SUPPLY_AGREEMENT: {
    informationNeeded: [
      "Buyer and supplier details",
      "Goods description, specifications, quality standards, and packaging",
      "Price, GST/taxes, payment terms, delivery schedule, and location",
      "Inspection, rejection, replacement, warranty, and recall expectations",
      "Risk transfer, title transfer, force majeure, and termination terms",
    ],
    legalNotes: [
      "Goods contracts should account for the Sale of Goods Act, 1930 and Indian Contract Act, 1872.",
      "Risk and title can pass at different points if the contract says so.",
      "Specifications and inspection timelines should be measurable.",
    ],
    commonMistakes: [
      "Leaving specifications to informal purchase orders only",
      "Not saying when risk transfers",
      "Ignoring rejection and replacement process",
    ],
    reviewChecklist: [
      "Goods are described clearly",
      "Delivery and inspection are measurable",
      "Price and taxes are complete",
      "Risk, title, and warranty clauses align",
    ],
  },

  DISTRIBUTION_AGREEMENT: {
    informationNeeded: [
      "Supplier and distributor legal details",
      "Territory, channel, exclusivity, term, and renewal expectations",
      "Products, price list, ordering process, targets, and stock obligations",
      "Brand use, marketing duties, product compliance, and customer support",
      "Termination, post-termination stock handling, and dispute city",
    ],
    legalNotes: [
      "Distributor status should be distinguished from agency if the distributor buys and resells independently.",
      "Exclusivity should be tied to territory, targets, and termination rights.",
      "Brand use and marketing controls help protect goodwill.",
    ],
    commonMistakes: [
      "Accidentally creating agency language",
      "Granting exclusivity without targets",
      "Ignoring unsold stock after termination",
    ],
    reviewChecklist: [
      "Territory and exclusivity are clear",
      "Targets and consequences are practical",
      "Brand-use rights are limited",
      "Post-termination obligations are covered",
    ],
  },

  SALES_OF_GOODS_AGREEMENT: {
    informationNeeded: [
      "Seller and buyer details",
      "Goods description, quantity, condition, specifications, and serial numbers if any",
      "Purchase price, GST/taxes, payment date, and delivery location",
      "Inspection period, acceptance, rejection, and warranty details",
      "Risk/title transfer point and dispute city",
    ],
    legalNotes: [
      "The Sale of Goods Act, 1930 is directly relevant to movable goods transactions.",
      "Description, sample, quality, and fitness terms should match the commercial deal.",
      "Inspection and acceptance should be clear for high-value goods.",
    ],
    commonMistakes: [
      "Using vague goods descriptions",
      "Not matching delivery with risk transfer",
      "Forgetting tax and warranty treatment",
    ],
    reviewChecklist: [
      "Goods and quantity are unambiguous",
      "Price is shown correctly",
      "Inspection and acceptance are included",
      "Risk/title transfer is stated",
    ],
  },

  INDEPENDENT_CONTRACTOR_AGREEMENT: {
    informationNeeded: [
      "Client and contractor legal details",
      "Services, deliverables, milestones, and working arrangements",
      "Fees, payment terms, taxes, and reimbursable expenses",
      "Confidentiality, IP ownership, tools, and third-party materials",
      "Term, termination, handover, and dispute city",
    ],
    legalNotes: [
      "Contractor independence should be consistent across payment, control, tools, and working arrangements.",
      "IP assignment should be explicit for creative, software, design, or technical deliverables.",
      "Tax and compliance responsibility should not be left implied.",
    ],
    commonMistakes: [
      "Using employment-style supervision language",
      "Ignoring ownership of contractor deliverables",
      "Leaving handover obligations out",
    ],
    reviewChecklist: [
      "Independent contractor status is consistent",
      "Deliverables and milestones are clear",
      "Payment and tax terms are complete",
      "IP and confidentiality are covered",
    ],
  },

  COMMERCIAL_LEASE_AGREEMENT: {
    informationNeeded: [
      "Landlord and tenant identity details",
      "Premises description, area, fixtures, permitted use, and possession date",
      "Rent, deposit, escalation, taxes, maintenance, utilities, and fit-out period",
      "Term, lock-in, renewal, termination, and handover requirements",
      "Operating state for stamp/registration context",
    ],
    legalNotes: [
      "Commercial leases can involve the Transfer of Property Act, 1882, Registration Act, 1908, and state stamp laws.",
      "Registration and stamp duty depend on term, state, and document structure.",
      "Permitted use should match zoning, licensing, and business requirements.",
    ],
    commonMistakes: [
      "Ignoring stamp and registration implications",
      "Not separating rent, maintenance, and taxes",
      "Leaving handover condition unclear",
    ],
    reviewChecklist: [
      "Premises details are complete",
      "Rent, deposit, escalation, and taxes are clear",
      "Term and renewal are consistent",
      "Handover and damage obligations are included",
    ],
  },

  LEAVE_AND_LICENSE_AGREEMENT: {
    informationNeeded: [
      "Licensor, licensee, premises, and possession details",
      "License fee, deposit, utilities, maintenance, and permitted use",
      "Term, renewal, termination notice, and lock-in if any",
      "Inventory, inspection, handover, and no-tenancy language",
      "State for stamp and registration treatment",
    ],
    legalNotes: [
      "A license grants permission to use premises and should avoid language that creates a leasehold interest.",
      "State stamp and registration rules can be important, especially for residential arrangements.",
      "The document should preserve the licensor's control and ownership position.",
    ],
    commonMistakes: [
      "Using lease terminology throughout",
      "Not recording deposit refund conditions",
      "Forgetting inventory and handover details",
    ],
    reviewChecklist: [
      "License language is consistent",
      "Fee, deposit, and utilities are clear",
      "No tenancy interest is stated",
      "Handover and inspection terms are included",
    ],
  },

  LOAN_AGREEMENT: {
    informationNeeded: [
      "Lender and borrower identity and entity details",
      "Principal amount, disbursement date, interest rate, and tenure",
      "Repayment schedule, prepayment, default interest, and grace period",
      "Security, guarantee, covenants, and use of funds",
      "Operating state and arbitration city",
    ],
    legalNotes: [
      "Loan terms should clearly define principal amount, interest, repayment, and default.",
      "Security schedules should describe collateral with enough detail for identification.",
      "Certain lenders or related-party loans may trigger RBI, company law, or money-lending compliance.",
    ],
    commonMistakes: [
      "Mixing 'borrower amount' with 'loan amount' terminology",
      "Leaving security details vague",
      "Not writing amounts in figures and words",
    ],
    reviewChecklist: [
      "Principal amount is consistent everywhere",
      "Repayment mechanics are complete",
      "Security schedule identifies collateral",
      "Default and remedies are clear",
    ],
  },

  GUARANTEE_AGREEMENT: {
    informationNeeded: [
      "Creditor, principal debtor, and guarantor details",
      "Underlying obligation or loan being guaranteed",
      "Guarantee type, liability cap, and duration",
      "Invocation process, notices, and payment timeline",
      "Whether the guarantor is an individual, company, LLP, firm, or proprietor",
    ],
    legalNotes: [
      "Guarantees are governed by suretyship principles under the Indian Contract Act, 1872.",
      "Continuing guarantees should address revocation for future obligations.",
      "Entity grammar matters: companies use successors/assigns, individuals use heirs/representatives.",
    ],
    commonMistakes: [
      "Including generic termination for convenience in a continuing guarantee",
      "Generating both continuing and specific guarantee clauses",
      "Using company succession wording for an individual guarantor",
    ],
    reviewChecklist: [
      "Guarantee type is not contradictory",
      "Liability cap and guaranteed obligations are clear",
      "Invocation procedure is practical",
      "Entity grammar matches the guarantor",
    ],
  },

  SOFTWARE_DEVELOPMENT_AGREEMENT: {
    informationNeeded: [
      "Client and developer details",
      "Functional specifications, milestones, deliverables, and dependencies",
      "Fees, milestone payments, acceptance tests, and change request process",
      "IP ownership, source code, open-source components, and third-party tools",
      "Support, warranty, security, data protection, and liability cap",
    ],
    legalNotes: [
      "Software contracts should clearly distinguish ownership, license, and permitted use.",
      "Acceptance testing is central to payment and delivery disputes.",
      "Data/security terms may intersect with the IT Act, 2000 and Digital Personal Data Protection Act, 2023 depending on facts.",
    ],
    commonMistakes: [
      "Not saying who owns source code",
      "Leaving acceptance to subjective satisfaction",
      "Ignoring change requests and scope creep",
    ],
    reviewChecklist: [
      "Specifications are usable",
      "Milestones and payments align",
      "IP/source-code terms are explicit",
      "Support, warranty, and liability are complete",
    ],
  },

  MOU: {
    informationNeeded: [
      "Parties, purpose, and commercial background",
      "Proposed roles, responsibilities, timelines, and next steps",
      "Whether clauses are binding, non-binding, or partly binding",
      "Confidentiality, exclusivity, cost sharing, and public announcements",
      "Term, termination, and dispute city",
    ],
    legalNotes: [
      "An MOU can become binding if intention, certainty, consideration, and obligations are clear.",
      "Binding clauses should be expressly identified if the broader arrangement is preliminary.",
      "Confidentiality and exclusivity often need binding treatment even in a non-binding MOU.",
    ],
    commonMistakes: [
      "Calling everything non-binding while creating detailed obligations",
      "Forgetting confidentiality before negotiations",
      "Leaving next steps too vague",
    ],
    reviewChecklist: [
      "Binding and non-binding clauses are separated",
      "Purpose and next steps are clear",
      "Confidentiality/exclusivity are intentional",
      "Termination and expiry are included",
    ],
  },
};

export const DOCUMENT_INFO_TYPES = Object.keys(documentInfo);

export function getDocumentInfo(type) {
  const base = documentInfo[type];
  if (!base) return null;

  return {
    ...base,
    ...(documentInfoDetails[type] || {}),
  };
}

export { INFORMATIONAL_DISCLAIMER };
