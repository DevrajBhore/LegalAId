# LegalAId Privacy Policy — DRAFT

> **Draft for review by a qualified advocate. Not in force.** Written on 26 September 2026 from the launch-compliance audit and the code as it stands. Everything in square brackets is for the company or the advocate to fill in or decide. The live page (`frontend/src/pages/PrivacyPolicy.jsx`) currently carries only factual statements; this draft replaces it once approved.
>
> **Questions for the advocate** are marked **[Q]**. The main ones: LegalAId's role for third-party data entered by users (section 3), the legal basis for cross-border transfer (section 6), and whether the DPDP Rules' consent-manager and notice formats need anything beyond this.

**Last updated:** [date of approval]
**Data Fiduciary:** [Company legal name], [registered address], [CIN]
**Contact for privacy questions and grievances:** [name or designation], [email] — see section 10

## 1. What this policy covers

This policy explains how LegalAId ("we") collects and uses personal data when you use legal-aid.xyz and its services, under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025.

## 2. What we collect

| Category | What it includes | Why we collect it |
|---|---|---|
| Account details | Name, email address, optional mobile number, password (stored only as a one-way hash) | To create and secure your account, verify your email and let you reset your password |
| Consent record | Which versions of the Terms and this policy you accepted, your confirmation that you are 18 or older, and when | To show what you agreed to |
| Intake answers | Everything you enter in a document form | To draft the document you asked for |
| Drafts and versions | Generated documents, your edits, automated check results, up to 20 saved versions per document | So you can return to, edit, restore and export your work |
| Assistant messages | Questions you ask the drafting assistant and its replies | To answer them |
| Contact messages | Name, email, topic and message sent through the contact form | To reply to you |
| Technical data | IP address and request details in server logs; one sign-in cookie | To run the service securely and keep you signed in |

We use aggregate counts of missing clauses per document type, which contain no personal data, to improve the clause library. We do not sell personal data, and we do not use it for advertising.

## 3. Information about other people

Legal documents name other people: the other parties, employees, guarantors, directors. When you enter their details (names, addresses, PAN, GSTIN, CIN, salaries, loan amounts), you confirm that you are entitled to share them with us for drafting.

**[Q]** Decide LegalAId's role for this data under the DPDP Act (Data Fiduciary in its own right, or processing on the user's behalf), and what, if anything, users must do to notify those people.

## 4. Who processes your data

| Provider | What it does | Where |
|---|---|---|
| Google LLC (Gemini API) | Drafts and edits documents; answers assistant messages | Outside India, including the United States |
| Groq, Inc. | Same, when Gemini is unavailable | United States |
| MongoDB, Inc. (Atlas) | Stores accounts and documents | [cluster region — confirm] |
| Resend | Sends verification, password-reset and contact emails | United States |
| Render | Hosts the application server | United States |
| Vercel | Hosts the website | United States |

Each provider processes data only to provide its service to us, under its data processing terms. **[Confirm that the Gemini project is on the paid tier: on Google's free tier, submitted data may be used to improve Google's products and reviewed by people.]**

## 5. How long we keep it

- **Account and documents:** until you delete them or delete your account. **[Decide: a period after which inactive accounts are deleted, and a period for unverified accounts. The code does not yet delete either automatically.]**
- **Versions:** up to 20 per document; older ones are removed when new ones are saved.
- **AI providers:** Google may keep submitted content for up to 55 days and Groq for up to 30 days, to detect abuse.
- **Contact messages:** [period] in our support inbox.
- **Server logs:** [period].

## 6. Transfers outside India

Our providers process data outside India, including in the United States. **[Q]** Confirm the transfer basis under section 16 of the DPDP Act and that no destination is restricted by notification.

## 7. Your rights

You can:

- **See and download your data:** Profile → Download my data gives you one file with your account details, consent record, documents and versions.
- **Correct it:** Profile → Save details for your name and mobile number. To change your sign-in email, contact us.
- **Delete it:** delete single drafts from My documents, or delete your account and everything in it from Profile.
- **Withdraw consent:** deleting your account withdraws it. We then stop processing your data, except what the law requires us to keep.
- **Complain:** see section 10. If you are not satisfied with our response, you may complain to the Data Protection Board of India.
- **Nominate someone** to exercise these rights if you die or become incapable: [process].

## 8. Children

LegalAId is for people aged 18 and over. We do not knowingly collect data from children. If we learn that a child has created an account, we will delete it.

## 9. Security

Passwords are hashed with bcrypt. Sessions use a secure, HTTP-only cookie. Every document query is limited to its owner's account. Traffic is encrypted in transit. **[Confirm encryption at rest on the Atlas cluster, and access-log retention of at least one year as DPDP Rule 6 requires.]**

If a breach affects your data, we will tell you without delay, and the Data Protection Board within 72 hours, as the DPDP Rules require.

## 10. Contact and grievances

For questions, requests or complaints about your data: [name or designation], [email], or the Contact page at legal-aid.xyz/contact. We will respond within [period — no more than 90 days, as the DPDP Rules allow].

## 11. Cookies

We use one cookie, `legalaid_token`: a secure, HTTP-only sign-in cookie that lasts up to seven days. The editor keeps your open draft in your browser's session storage until you close the tab. We use no analytics, advertising or tracking cookies, and fonts are served from our own site.

## 12. Changes

If we change this policy in a way that affects how your data is used, we will tell you by email or in the product before the change applies, and ask for your consent again where the law requires.
