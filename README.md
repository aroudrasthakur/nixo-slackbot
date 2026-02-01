# Nixo Slackbot + Realtime Dashboard

A minimal Slackbot system for Forward-Deployed Engineers (FDEs) that detects relevant customer messages in Slack, classifies them using OpenAI, groups related messages into tickets using vector similarity, and displays them in a realtime Next.js dashboard.

## Architecture

```
Slack (Socket Mode) → Bolt → Pipeline → DB → Socket.IO → Next.js UI
```

**Realtime Flow**: Slack events → Bolt (Socket Mode) → Message pipeline → Supabase → Socket.IO broadcast → Next.js UI

---

## Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| **Node.js** | 20 or higher |
| **pnpm** | Latest (`npm install -g pnpm`) |
| **Git** | For cloning the repository |

**Accounts:** Supabase ([sign up](https://supabase.com)), Slack workspace, [OpenAI API key](https://platform.openai.com/api-keys). Optional: Python 3.8+ for Python tooling.

**Verify:**

```bash
node --version   # v20.x or higher
pnpm --version
```

---

## Setup

Follow these steps in order.

### 1. Clone and install

```bash
git clone <repository-url>
cd nixo-slackbot
pnpm install
```

This installs dependencies for all workspaces (backend, web, shared). Dependencies are also listed in `requirements.txt`.

**If you see "Ignored build scripts: esbuild" or install fails:** The root `package.json` has no `install` script (to avoid recursive install loops). The repo includes `.npmrc` with `ignore-scripts=false` so dependency build scripts (e.g. esbuild) can run. To allow scripts only for specific packages, remove that line and run `pnpm approve-builds`, then approve `esbuild`.

**Verify:** From the root, run `pnpm build`. If it completes without errors, the monorepo is set up.

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com) (New Project → name, password, region).
2. In the dashboard, open **SQL Editor**, paste the contents of `supabase/migrations/001_initial_schema.sql`, and run it.
3. In **Project Settings** → **API**, copy **Project URL** and **Service role key** (use as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). Never expose the service role key in the frontend or in public repos.

### 3. Slack app

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps) (Create New App → From scratch).
2. **Socket Mode:** **Socket Mode** → Enable Socket Mode → Generate App-Level Token with scope `connections:write` → copy token (`xapp-`) → `SLACK_APP_TOKEN`. Store it; it is shown only once.
3. **Bot scopes:** **OAuth & Permissions** → Bot Token Scopes → add `channels:history`, `channels:read`, and optionally `chat:write`. For private channels add `groups:history`, `groups:read`.
4. **Events:** **Event Subscriptions** → Enable Events → Subscribe to bot events → add `message.channels` (required), optionally `message.groups` → Save.
5. **Install:** **Install App** → Install to Workspace → copy **Bot User OAuth Token** (`xoxb-`) → `SLACK_BOT_TOKEN`.
6. **Signing secret (optional):** **Basic Information** → App Credentials → **Signing Secret** → `SLACK_SIGNING_SECRET`.
7. **Your user ID:** In Slack, open your profile → More → Copy member ID (or from profile URL) → `FDE_USER_ID`.
8. Invite the bot to a channel: in a public channel run `/invite @YourBotName`.

### 4. OpenAI API key

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Ensure the account has access to **gpt-4o-mini** and **text-embedding-3-small**.

### 5. Environment variables

All configuration is in a single root `.env` file. Copy the example and edit:

```bash
cp .env.example .env
# Windows (PowerShell): Copy-Item .env.example .env
```

Set each variable:

| Variable | Description | Example / Notes |
|----------|-------------|------------------|
| **Slack** | | |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token | `xoxb-...` |
| `SLACK_APP_TOKEN` | App-Level Token (Socket Mode) | `xapp-...` |
| `SLACK_SIGNING_SECRET` | Signing Secret | Optional |
| `FDE_USER_ID` | Your Slack user ID | `U1234567890` |
| **OpenAI** | | |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_CONCURRENCY` | Max concurrent OpenAI calls | `3` (default) |
| **Supabase** | | |
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Project Settings → API |
| **Backend** | | |
| `APP_ORIGIN` | CORS origin for dashboard | `http://localhost:3000` |
| `PORT` | Backend port | `4000` |
| `NODE_ENV` | Environment | `development` |
| **Frontend** | | |
| `NEXT_PUBLIC_SOCKET_URL` | Backend URL for Socket.IO | `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL` | Backend URL for API | `http://localhost:4000` |

Do not commit `.env`.

### 6. Run the application

From the project root:

```bash
pnpm dev
```

- **Backend** (Express + Socket.IO + Slack Bolt): http://localhost:4000  
- **Web** (Next.js dashboard): http://localhost:3000  

Open http://localhost:3000 for the tickets list. Post a relevant message in a channel where the bot is invited to create a ticket.

**Run apps individually (optional):**

```bash
cd apps/backend && pnpm dev    # or: cd apps/web && pnpm dev
```

### 7. Verify setup

- **Health:** http://localhost:4000/health → `{"status":"ok"}`
- **API:** http://localhost:4000/api/tickets → JSON array of tickets
- **Slack:** Backend logs show "Slack Bolt app started"; sending a relevant message in Slack creates/updates a ticket
- **Dashboard:** http://localhost:3000 shows the list; new/updated tickets appear in real time (Socket.IO)
- **Test without Slack:**  
  `curl -X POST http://localhost:4000/dev/ingest -H "Content-Type: application/json" -d "{\"channel\":\"C1234567890\",\"ts\":\"1234567890.123456\",\"user\":\"U9876543210\",\"text\":\"I found a bug in the API\"}"`  
  A new ticket should appear on the dashboard.

---

## Architecture Details

### Relevance Detection

1. **Heuristic filter:** Ignores casual messages (e.g. thanks, ok, cool).
2. **OpenAI classification:** `gpt-4o-mini` with Structured Outputs; categories: `bug_report`, `support_question`, `feature_request`, `product_question`, `irrelevant`. Only messages with `is_relevant: true` become tickets.

### Grouping Algorithm

1. **Thread:** If `root_thread_ts` matches an existing message in an open ticket, attach to that ticket. `root_thread_ts = event.thread_ts ?? event.ts` (stored on every message).
2. **Canonical key:** From normalized text + signals (error codes, platform, feature keywords). If an open ticket has the same `canonical_key`, attach.
3. **Vector similarity:** Embed `short_title` with `text-embedding-3-small` (1536 dims). Search open tickets from last 14 days by cosine distance (`<=>`). If distance ≤ 0.17, attach to best match; else create a new ticket.

### Deduplication

- **Messages:** UNIQUE on `(slack_channel_id, slack_ts)`.
- **Tickets:** Partial unique index on `canonical_key WHERE status='open'`. On insert conflict, fetch existing ticket and attach message.

### Message Edits

- Only normal new messages are processed by default (subtypes ignored). Optional: handle `message_changed` to update existing message row; never create new tickets from edits.

### Performance

- Classification cache (1h TTL, keyed by normalized text); p-limit (default 3) on OpenAI calls; Slack events acked immediately; no polling (Socket.IO only).

### Security

- Service role key server-side only; CORS restricted to `APP_ORIGIN`.

### AI Usage

- Classification: OpenAI Structured Outputs (not JSON mode), `gpt-4o-mini`. Embeddings: `text-embedding-3-small` (1536). Vector similarity: cosine distance `<=>`, threshold 0.17.

---

## Troubleshooting

### Bot not receiving events

- Socket Mode enabled; app-level token has `connections:write`; `SLACK_APP_TOKEN` correct in `.env`; app installed and bot invited to channel; Event Subscriptions include `message.channels` (and `message.groups` if using private channels).

### Missing scopes

- Add required Bot Token Scopes in OAuth & Permissions; reinstall app to workspace.

### Socket / dashboard not updating

- `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_API_URL` point to backend (e.g. `http://localhost:4000`); backend running; CORS allows `APP_ORIGIN`.

### Database errors

- Re-run migration SQL in Supabase SQL Editor; confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### OpenAI errors

- Valid `OPENAI_API_KEY`; access to `gpt-4o-mini` and `text-embedding-3-small`; check [OpenAI status](https://status.openai.com) and usage.

### Port already in use

- Change `PORT` in `.env` (e.g. `4001`) and set `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_API_URL` to the same URL and port.

---

## Development

### Project Structure

```
nixo-slackbot/
├── apps/
│   ├── backend/     # Express + Socket.IO + Slack Bolt
│   │   └── src/
│   │       ├── index.ts          # Main server entry point
│   │       ├── slack/             # Slack Bolt integration
│   │       ├── pipeline/          # Message processing pipeline
│   │       ├── db/                # Supabase database queries
│   │       ├── api/               # REST API routes
│   │       └── socket/             # Socket.IO event handlers
│   └── web/         # Next.js dashboard
│       └── src/
│           ├── app/               # Next.js App Router pages
│           ├── components/       # React components
│           ├── hooks/             # React hooks
│           └── lib/               # Utility functions
├── packages/
│   └── shared/      # Shared types and Zod schemas
│       └── src/
│           ├── types.ts          # TypeScript type definitions
│           └── schemas.ts         # Zod validation schemas
├── supabase/
│   └── migrations/  # Database migrations
├── .env.example      # Environment variables template
├── requirements.txt   # All dependencies reference
└── venv/             # Python virtual environment (optional)
```

### Dependencies

All dependencies are listed in `requirements.txt`. Install with `pnpm install` from the root; both backend and frontend read env from the single root `.env` (frontend only uses `NEXT_PUBLIC_*` in the browser).

### Python Virtual Environment (Optional)

Only needed if you add Python tooling. `venv` is built-in (Python 3.3+).

```bash
python -m venv venv
# Windows: venv\Scripts\Activate.ps1  or  venv\Scripts\activate.bat
# macOS/Linux: source venv/bin/activate
deactivate   # when done
```

**Note:** The root `requirements.txt` is for **Node.js/pnpm only** (reference). Do not run `pip install -r requirements.txt`—it will fail. If you add Python dependencies, create a separate file (e.g. `requirements-py.txt`) and use `pip install -r requirements-py.txt`.

`venv/` is in `.gitignore`. On Windows execution policy errors: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

### Testing without Slack

```bash
curl -X POST http://localhost:4000/dev/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C1234567890",
    "ts": "1234567890.123456",
    "user": "U9876543210",
    "text": "I found a bug in the API"
  }'
```

---

## License

MIT
