# Outfit jewelry recommendation (POC)

React (Vite) + Fastify + Gemini. Catalog is imported from `jewellery-dataset.xlsx` into `apps/api/data/jewelry.json` (Firestore can replace this later).

## Setup

```bash
npm install
cp .env.example apps/api/.env
# Edit apps/api/.env and set GEMINI_API_KEY
```

Regenerate catalog JSON after changing the Excel file:

```bash
npm run import-data
```

## Dev

Runs Vite on port 5173 and the API on 3001 (with `/api` proxied from the dev server).

```bash
npm run dev
```

Open `http://localhost:5173`. Use **Shop** to browse inventory and **AI outfit match** to upload outfit photos.

## Production build

```bash
npm run build
```

Serve `apps/web/dist` as static files and run `node apps/api/dist/index.js` (set `WEB_ORIGIN` to your frontend origin).

## Privacy

User images are sent to Google’s Gemini API for vision analysis. Do not use production customer data without disclosure and policy.

## Env

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Required for recommendations |
| `GEMINI_MODEL` | Optional; default `gemini-2.5-flash` |
| `PORT` | API port (default 3001) |
| `WEB_ORIGIN` | CORS allowlist for the API |

