# LegalAId

LegalAId is an India-focused legal drafting platform for generating, validating, editing, and exporting legal documents. It combines structured intake forms, a local legal knowledge base, deterministic clause assembly, AI-assisted drafting, and an Indian Rule Engine (IRE) for validation.

## What It Does

- Generates first drafts for supported Indian legal documents
- Interprets user inputs as legal facts and commercial intent, not just template placeholders
- Validates drafts through a multi-layer Indian Rule Engine
- Lets users edit drafts, save history, chat with an AI assistant, and repair flagged issues
- Exports validated drafts as DOCX

## Supported Live Documents

- Non-Disclosure Agreement
- Employment Contract
- Service Agreement
- Consultancy Agreement
- Partnership Deed
- Shareholders Agreement
- Joint Venture Agreement
- Supply Agreement
- Distribution Agreement
- Sale of Goods Agreement
- Independent Contractor Agreement
- Commercial Lease Agreement
- Leave and License Agreement
- Loan Agreement
- Guarantee Agreement
- Software Development Agreement
- Memorandum of Understanding

## Project Structure

- `backend`: Express API, auth, generation, validation, export, history
- `frontend`: React + Vite application
- `IRE`: Indian Rule Engine validation layer
- `knowledge-base`: clauses, blueprints, rules, constraints, legal metadata
- `shared`: shared document registry and metadata
- `tests`: generation and integration checks
- `scraper`: offline data/scraping utilities for the legal knowledge base

## End-to-End Flow

1. User selects a document type in the frontend.
2. The frontend fetches the form schema from the backend.
3. The user fills document-specific inputs.
4. The backend sanitizes and validates inputs.
5. The generator builds a blueprint-based draft from the knowledge base.
6. A semantic interpretation layer turns raw inputs into legal facts and drafting guidance.
7. AI drafting and deterministic hardening produce a coherent legal draft.
8. The validation pipeline checks structure, legal logic, statutory issues, clause quality, and consistency with user inputs.
9. The user edits, saves, revalidates, chats with AI, or applies issue-specific fixes.
10. Export is allowed only after final validation passes.

## Core Architecture

### Backend

- Entry point: `backend/index.js`
- Main generator: `backend/services/documentService.js`
- Semantic input interpretation: `backend/services/inputSemantics.js`
- Prompt construction: `backend/ai/promptBuilder.js`
- Deterministic clause hardening: `backend/services/documentHardening.js`
- Validation wrapper: `backend/services/validationService.js`

### Frontend

- App entry: `frontend/src/main.jsx`
- Routes: `frontend/src/App.jsx`
- API layer: `frontend/src/services/api.js`
- Form builder page: `frontend/src/pages/Form.jsx`
- Editor page: `frontend/src/pages/Editor.jsx`

### Rule Engine

- IRE entry: `IRE/engine.js`
- Bootstrap: `IRE/bootstrap.js`

## Local Setup

### Prerequisites

- Node.js 20+ recommended
- npm
- MongoDB connection string

### Install

Run these in separate folders:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../IRE && npm install
```

## Environment Variables

Backend typically needs:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `GEMINI_API_KEY` or `GROQ_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Frontend typically needs:

- `VITE_API_BASE_URL`

## Run Locally

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

IRE is used by the backend directly and does not need a separate dev server for normal app usage.

## Verification Commands

Generation suite:

```bash
node tests/generateAndValidate.js
```

IRE integration suite:

```bash
node IRE/test.integration.js
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Current Design Principles

- Use document blueprints and the knowledge base as the drafting backbone
- Use AI to understand user intent and improve language, not to hallucinate legal structure
- Keep drafting policy reusable and future-friendly for new document types
- Validate aggressively before allowing export
- Prefer universal logic and policy-driven behavior over document-specific hardcoding

## Notes

- The knowledge base is a runtime dependency for drafting and validation.
- The backend and IRE should be deployed with access to the same repository tree.
- The root repo contains the full monorepo; the frontend and backend are deployed separately but share the same source base.
