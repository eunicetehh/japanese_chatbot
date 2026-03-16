# Baby Blue / Baby Purple Chatbot Website

A simple chatbot website with a **baby blue + baby purple** theme.

- Frontend: plain `HTML/CSS/JS` in [`web/`](web/)
- Backend: local `Node.js + Express` server in [`server/`](server/) that calls **OpenAI** (your API key stays server-side)

## Run locally (Windows)

### 1) Prereqs
- Node.js 18+ (Node 20+ recommended)

### 2) Configure the server
1. Copy the example env file:
   - Copy `server/.env.example` to `server/.env`
2. Edit `server/.env` and set:
   - `OPENAI_API_KEY=...`
   - (Optional) `OPENAI_MODEL=gpt-4o-mini`
   - (Optional) `PORT=3000`

### 3) Install and start
From the `server/` folder:

```bash
npm install
npm start
```

Then open:
- `http://localhost:3000`

## Notes
- The page sends `POST /api/chat` to the local server, and the server calls OpenAI.
- If you see an error like “Missing OPENAI_API_KEY”, create `server/.env` as described above.

## Troubleshooting
- **Port already in use**: change `PORT` in `server/.env` (or stop the other process using the port).
- **Blank page / can’t connect**: make sure you opened `http://localhost:3000` (not `web/index.html` directly).
- **OpenAI errors**: confirm your API key is valid and your selected model name exists for your account.

