# DRISHTI AI — Autonomous AI QA Engineer

> **Team Refactor** | CODE APEX 3.0, iMocha Track IM-02 | VIT Pune, AISF

An autonomous AI agent that tests web applications: it explores the app, decides what to test, runs tests in a browser, validates failures, and reports real bugs with evidence.

## Quick Start

**Local, no Docker** (dashboard with its built-in engine, plus the ShopLite target):

```bash
# Dashboard
cd apps/frontend
# create .env.local with:
#   GROQ_API_KEY=gsk_...
#   NEXT_PUBLIC_API_URL=/api
#   BACKEND_API_URL=            (empty = use the built-in engine)
npm ci
npm run build && npm start         # http://localhost:3000

# ShopLite target (second terminal)
cd apps/shoplite
npm ci
PORT=3001 BUG_SET=all node src/index.js
```

**Full stack** (FastAPI backend, Python runner, MongoDB):

```bash
cp .env.example .env               # add GROQ_API_KEY
docker compose up --build          # http://localhost:3000
```

## Architecture

| Component     | Tech                | Port  |
|---------------|---------------------|-------|
| Dashboard     | Next.js + Tailwind  | 3000  |
| Backend API   | FastAPI + Pydantic  | 8000  |
| Runner        | Python + Playwright | —     |
| Database      | MongoDB             | 27017 |
| ShopLite      | Express.js          | 3001  |

See [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) for full design.

## Repository Layout

```
drishti-ai/
  apps/
    frontend/       # Next.js dashboard
    backend/        # FastAPI REST API
    runner/         # Pipeline (S1–S10), browser layer, LLM gateway
    shoplite/       # Benchmark target app with plantable bugs
  benchmarks/       # Benchmark bug descriptions
  docs/             # Architecture and research write-up
  data/             # created at runtime, gitignored — artifacts, LLM cache
```

## AI Tools and Models Used

| Tool / Model       | Purpose                              |
|--------------------|--------------------------------------|
| Groq — `openai/gpt-oss-120b` | LLM test planning and scenario generation (runner) |
| Groq — `openai/gpt-oss-20b`  | Fallback model                       |
| Playwright         | Browser automation                   |
| Claude Code (Anthropic) | Code assistance during development |

> Per IM-02 guidelines: all AI tools and models used are listed above.

## Credits

- [Playwright](https://playwright.dev/) — Browser automation (Apache-2.0)
- [FastAPI](https://fastapi.tiangolo.com/) — Backend framework (MIT)
- [Next.js](https://nextjs.org/) — Frontend framework (MIT)
- [MongoDB](https://www.mongodb.com/) — Database (SSPL)
- [pytest](https://pytest.org/) — Testing framework (MIT)

## Team

- **Paras Sanjay Kumbhar** — Team Leader
- *(add team members)*

## License

For CODE APEX 3.0 hackathon submission only.
