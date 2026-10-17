# Kaam Saathi — Gig Worker Companion (privacy-first MVP)

A no-login, mobile-first Hindi/English assistant for gig and informal workers. This is a working starter/MVP intended for review and further development, not a certified legal, welfare, or emergency service.

## Quality goals mapped to the problem statement

- **No login:** the main assistant and API endpoints work without user accounts.
- **Problem alignment:** five entry points cover earnings, safety, rights/schemes, document help, and complaint drafting.
- **Voice and accessibility:** browser speech recognition when supported, spoken answers, keyboard-friendly controls, visible focus/labels, status announcements, and a typed-input fallback.
- **Security and privacy:** AI key is server-side; request validation; basic per-process rate limiting; no user accounts; no server-side earnings or conversation persistence; no database or database credentials required.
- **Coding quality:** separated frontend/backend, typed React components, Pydantic validation, deterministic arithmetic, configuration via environment, Docker deployment, and a small API test suite.
- **Efficiency:** no database service for the MVP; bounded AI output; short provider timeout/retry behavior; frontend static assets served by Nginx.

## Important limitations

1. The app's AI integration is optional. Without `OPENAI_API_KEY`, it returns safe fallback guidance so the UI can be tested. Configure a valid key in the backend environment to enable live AI replies.
2. Rights and welfare scheme answers are **not backed by a curated verified-source catalogue yet**. Do not treat the demo as authoritative legal or eligibility guidance. Add official-source retrieval and verification dates before public launch.
3. The MVP does not submit complaints, file applications, contact emergency services, or integrate with gig platforms.
4. Document upload/OCR is not implemented in this starter. The document feature currently gives conversational guidance.
5. Voice input relies on browser Web Speech API support; browser speech services may process audio outside this application. Typed input is always available.
6. Rate limiting is in-memory per backend process, suitable only as a demo guardrail. Use a shared rate limiter/WAF and trusted proxy configuration for production.
7. No login means there is no cross-device recovery or saved earnings history. Earnings calculations are stateless and are not saved by the server.
8. Before public launch, add expert-reviewed content, HTTPS, monitoring, an abuse/security review, privacy notice, retention policy, and accessibility testing with real users.

## Run locally

1. Copy `.env.example` to `.env` if you want to configure the optional AI key. You can run without a `.env` file.
2. From this directory run:

   ```bash
   docker compose up --build -d
   docker compose ps
   docker compose logs -f backend
   ```

3. Open `http://localhost:18030`.
4. Health check: `curl http://127.0.0.1:18031/api/health`.
5. Stop only this stack with `docker compose down` from this project directory. This project has no database volume to delete.

Ports are bound to loopback (`127.0.0.1`) by default so they are not directly published to the public network. For an existing VPS, use a separate Nginx server block for the chosen domain; do not overwrite existing site configuration or stop unrelated containers.

## Run backend tests

With Python dependencies installed, from `backend/`:

```bash
python -m pip install -r requirements.txt
pytest -q
```

## Configuration

- `OPENAI_API_KEY`: optional server-side API key; never commit it.
- `OPENAI_MODEL`: model name supported by the configured API account.
- `CORS_ORIGINS`: allowed browser origin(s).
- `RATE_MAX_REQUESTS`: maximum requests per client IP in the rolling 60-second window, per process.

## Project layout

```text
kaam-saathi-v2/
├── backend/
│   ├── app/main.py
│   ├── tests/test_api.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/App.tsx
│   ├── src/main.tsx
│   ├── src/styles.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```
