# Deploy LegalAId on Vercel + Render

This setup keeps the current repo structure unchanged:

- `frontend` -> Vercel
- `backend` + `IRE` + `knowledge-base` + `shared` -> Render
- MongoDB Atlas -> already provisioned separately

## 1. Push this repo

Push the full repo to GitHub. Render needs the top-level checkout because the backend reads:

- `knowledge-base` at runtime
- `IRE` at runtime

Do not deploy the `backend` folder by itself.

## 2. Deploy the backend to Render

Use the included [render.yaml](/D:/dev/LegalAId/render.yaml), or configure manually:

- Runtime: `Node`
- Plan: `Free`
- Root directory: repo root
- Build command: `cd IRE && npm install && cd ../backend && npm install`
- Start command: `cd backend && npm start`
- Health check path: `/health`

### Required backend env vars

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`

### Optional but recommended backend env vars

- `GEMINI_API_KEY` or `GROQ_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `JWT_EXPIRES_IN=7d`

### Important note on auth

Email verification is currently required before login. If `RESEND_API_KEY` or SMTP credentials are not configured, registration and password reset flows will not work properly.

## 3. Deploy the frontend to Vercel

Create a Vercel project with:

- Root directory: `frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Set:

- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`

The included `frontend/vercel.json` rewrites all routes to `index.html` so React Router deep links continue to work.

## 4. Link both sides together

After Vercel gives you a frontend URL, set this in Render:

- `CLIENT_URL=https://<your-vercel-project>.vercel.app`

Redeploy the backend once after updating `CLIENT_URL`.

## 5. Smoke test after deploy

Check:

1. `GET /health` on Render
2. Frontend loads from Vercel
3. Signup flow works
4. Login works after verification
5. Generate document works
6. Export DOCX works

## 6. Free-tier caveats

- Render free web services sleep after idle time, so the first backend request may be slow.
- MongoDB Atlas free is fine for small usage and demos.
- AI providers and email providers have their own quotas and costs.
