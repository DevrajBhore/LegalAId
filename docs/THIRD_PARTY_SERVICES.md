# Third-party services and licences

The register of every external service LegalAId sends data to, and the licence
choices the code relies on. Terms were read on 26 Sep 2026; review this file
every quarter and whenever a provider or plan changes.

## Services that receive user data

| Service | What it does here | Data it receives | Where | Trains on it? | Retention | Plan / to confirm |
|---|---|---|---|---|---|---|
| Google Gemini API | Drafting, document chat, intake assistant (primary) | Intake answers, including other parties' names, addresses, PAN/GSTIN/CIN, salaries; draft text; chat messages | Any country Google operates in | **Free tier: yes, with human review. Paid tier: no.** | 55 days for abuse monitoring | **Confirm the project shows "Paid" under Billing Tier in AI Studio.** Users must be 18+. |
| Groq | Fallback when Gemini fails | Same as Gemini | US | No | Up to 30 days; zero-retention available | Turn on zero data retention. 18+. |
| MongoDB Atlas | All stored data | Accounts, drafts, versions | Cluster region (confirm; Mumbai keeps data in India) | No | Until deleted | DPA is part of the cloud terms. |
| Resend | Verification, password-reset and contact-form email | Name, email, message text | US | No | Per Resend DPA | DPA applies automatically. |
| Render | Backend hosting | All API traffic | Oregon, US by default | — | — | `render.yaml` is on `plan: free`, which Render says not to use for production. Move to a paid plan. |
| Vercel | Frontend hosting | Page requests (IP, user agent) | US | — | — | Hobby plan is non-commercial only and has no DPA. Confirm Pro. |

Not live: OpenAI (client code present, no key configured in `render.yaml`).

Removed: Google Fonts. The DM fonts are now self-hosted from `@fontsource`
packages, so page loads no longer reach Google.

## Licence decisions

- **Project licence:** proprietary (`LICENSE`, `"license": "UNLICENSED"` in every package.json).
- **jszip** (backend, via `docx`) is dual-licensed "MIT OR GPL-3.0-or-later". LegalAId uses it under **MIT**.
- **Frontend notices:** `frontend/public/third-party-notices.txt`, linked from the site footer. Regenerate with `node scripts/generateFrontendNotices.mjs` after changing frontend dependencies; `tests/launchCompliance.test.mjs` fails if it is stale.
- **Icons:** the inline icons in `frontend/src/utils/icons.jsx`, including the gavel used as the logo, are Lucide (ISC) and Feather (MIT) drawings. Their notices are in the file above. A stock icon cannot be registered as the brand's own mark; commission an original logo.
- **Fonts:** DM Serif Display, DM Sans, DM Mono — SIL Open Font License 1.1.
- **Backend and scraper** run on a server and are not distributed, so their dependencies' notice duties do not arise unless that changes (a Docker image or on-premise install would change it).
