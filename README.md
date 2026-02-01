# Nixo Slackbot + Realtime Dashboard

A Slackbot system for Forward-Deployed Engineers (FDEs) that detects relevant customer messages in Slack, classifies them using OpenAI, groups related messages into tickets using vector similarity, and displays them in a realtime Next.js dashboard with filtering, priority tracking, and ticket management.

## Architecture

```
Slack (Socket Mode) → Bolt → Pipeline → DB → Socket.IO → Next.js UI
```

**Realtime Flow**: Slack events → Bolt (Socket Mode) → Message pipeline → Supabase → Socket.IO broadcast → Next.js UI

---

## Prerequisites

| Requirement | Version / Notes                |
| ----------- | ------------------------------ |
| **Node.js** | 20 or higher                   |
| **pnpm**    | Latest (`npm install -g pnpm`) |
| **Git**     | For cloning the repository     |

**Accounts:** Supabase ([sign up](https://supabase.com)), Slack workspace, [OpenAI API key](https://platform.openai.com/api-keys).

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

This installs dependencies for all workspaces (backend, web, shared).

**If you see "Ignored build scripts: esbuild" or install fails:** The root `package.json` has limits scripts (to avoid recursive install loops) except for essential builds. If needed, run `pnpm approve-builds` and approve `esbuild`.

**Verify:** From the root, run `pnpm build`. If it completes without errors, the monorepo is set up.

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com) (New Project → name, password, region).
2. In the dashboard, open **SQL Editor**, run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql` - Core schema (tickets, messages, embeddings)
   - `supabase/migrations/005_messages_update_trigger.sql` - Message update trigger
   - `supabase/migrations/006_scored_matching.sql` - Scored matching functions
   - `supabase/migrations/007_cross_channel_context.sql` - Cross-channel context RPCs and `is_context_only` column
3. In **Project Settings** → **API**, copy **Project URL** and **Service role key** (use as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). Never expose the service role key in the frontend or in public repos.

### 3. Slack app

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps) (Create New App → From scratch).
2. **Socket Mode:** **Socket Mode** → Enable Socket Mode → Generate App-Level Token with scope `connections:write` → copy token (`xapp-`) → `SLACK_APP_TOKEN`. Store it; it is shown only once.
3. **Bot scopes:** **OAuth & Permissions** → Bot Token Scopes → add `channels:history` (required for channel context fetching), `channels:read`, and optionally `chat:write`. For private channels add `groups:history`, `groups:read`. The `channels:history` scope enables the bot to fetch recent channel messages for classification context.
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

| Variable                         | Description                                                                 | Example / Notes             |
| -------------------------------- | --------------------------------------------------------------------------- | --------------------------- |
| **Slack**                        |                                                                             |                             |
| `SLACK_BOT_TOKEN`                | Bot User OAuth Token                                                        | `xoxb-...`                  |
| `SLACK_APP_TOKEN`                | App-Level Token (Socket Mode)                                               | `xapp-...`                  |
| `SLACK_SIGNING_SECRET`           | Signing Secret                                                              | Optional                    |
| `FDE_USER_ID`                    | Your Slack user ID                                                          | `U1234567890`               |
| **OpenAI**                       |                                                                             |                             |
| `OPENAI_API_KEY`                 | OpenAI API key                                                              | `sk-...`                    |
| `OPENAI_CONCURRENCY`             | Max concurrent OpenAI calls                                                 | `3` (default)               |
| `CHANNEL_CONTEXT_LIMIT`          | Number of recent channel messages to fetch for classification context       | `15` (default)              |
| `SCORE_THRESHOLD`                | Match score threshold for Step 3 semantic matching (0-1, higher = stricter) | `0.75` (default)            |
| `RECENT_CHANNEL_SCORE_THRESHOLD` | Match score threshold for Step 3.5 recent-channel fallback                  | `0.65` (default)            |
| `RECENT_WINDOW_MINUTES`          | Time window for recent-channel grouping                                     | `5` (default)               |
| `SIMILARITY_GRAYZONE_LOW`        | Lower bound of gray-zone distance range for LLM merge check                 | `0.17` (default)            |
| `SIMILARITY_GRAYZONE_HIGH`       | Upper bound of gray-zone distance range for LLM merge check                 | `0.30` (default)            |
| `CROSS_CHANNEL_DAYS`             | Days to look back for cross-channel context retrieval (CCR)                 | `14` (default)              |
| `MATCH_TOPK_TICKETS`             | Number of ticket candidates to fetch for CCR                                | `15` (default)              |
| `MATCH_TOPK_MESSAGES`            | Number of message candidates to fetch for CCR                               | `25` (default)              |
| **Supabase**                     |                                                                             |                             |
| `SUPABASE_URL`                   | Supabase project URL                                                        | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY`      | Service role key                                                            | Project Settings → API      |
| **Backend**                      |                                                                             |                             |
| `APP_ORIGIN`                     | CORS origin for dashboard                                                   | `http://localhost:3000`     |
| `PORT`                           | Backend port                                                                | `4000`                      |
| `NODE_ENV`                       | Environment                                                                 | `development`               |
| **Frontend**                     |                                                                             |                             |
| `NEXT_PUBLIC_SOCKET_URL`         | Backend URL for Socket.IO                                                   | `http://localhost:4000`     |
| `NEXT_PUBLIC_API_URL`            | Backend URL for API                                                         | `http://localhost:4000`     |

_Note: Legacy variables like `SIMILARITY_THRESHOLD` are preserved for backward compatibility but superseded by score thresholds._

### 6. Run the application

From the project root:

```bash
pnpm dev
```

- **Backend** (Express + Socket.IO + Slack Bolt): http://localhost:4000
- **Web App** (Landing Page): http://localhost:3000
- **Dashboard** (Tickets): http://localhost:3000/dashboard

Open http://localhost:3000/dashboard for the tickets list. Post a relevant message in a channel where the bot is invited to create a ticket.

Note that /dashboard is protected and would need user Sign-Up/Login-in to access it.

**Run apps individually (optional):**

```bash
cd apps/backend && pnpm dev    # or: cd apps/web && pnpm dev
```

### 7. Verify setup

- **Health:** http://localhost:4000/health → `{"status":"ok"}`
- **API:** http://localhost:4000/api/tickets → JSON array of tickets
- **Slack:** Backend logs show "Slack Bolt app started"; sending a relevant message in Slack creates/updates a ticket
- **Dashboard:** http://localhost:3000/dashboard shows the list; new/updated tickets appear in real time (Socket.IO)
- **Test without Slack:**  
  `curl -X POST http://localhost:4000/dev/ingest -H "Content-Type: application/json" -d "{\"channel\":\"C1234567890\",\"ts\":\"1234567890.123456\",\"user\":\"U9876543210\",\"text\":\"I found a bug in the API\"}"`  
  A new ticket should appear on the dashboard.

---

## Demo Script

To demonstrate the system in 1-2 minutes:

1. **Post a feature request** ("We need a button to export reports to PDF") -> **New Ticket Created with category `Feature Request`**.
2. **Post a vague follow-up** ("I can’t see it anywhere on the settings page") -> **Attaches to previous ticket** (using thread or channel context).
3. **Post a status update** ("Dev team is looking into this") -> **Attaches as Context-Only** (updates ticket history but doesn't trigger new alerts).
4. **Post "Thanks!"** -> **Ignored** (Heuristic filter drops it, or attaches silently).
5. **Show Dashboard**: Observe live updates at `http://localhost:3000/dashboard` without refreshing.

---

## Architecture Details

### Relevance Detection

1. **Heuristic filter:** Examples like "thanks", "ok", "cool" are flagged as low-signal.
2. **Context-aware OpenAI classification:** Classifies messages into `bug_report`, `support_question`, `feature_request`, etc.
   - **Important:** The system still attempts to ATTACH low-signal messages to existing tickets (Steps 1-3.6 below) to maintain conversation context.
   - Ideally, only messages with `is_relevant: true` trigger the creation of a _NEW_ ticket (Step 4).
   - Context-only updates (e.g., "Thanks, got it") are attached to tickets to keep the timeline complete but are marked `is_context_only: true`.

### Grouping Algorithm (Step-by-Step Message Matching)

When a new Slack message arrives, it goes through a multi-step matching process.

#### Step 1: Thread Matching

- Check if `root_thread_ts` matches an open ticket.
- **Match?** Attach & Done.

#### Step 2: Entity-Based Canonical Key Matching

- Extracts entity signals (e.g., `csv|export`, `access_control|admin`).
- Generates a stable, sorted "canonical key".
- **Match?** Attach & Done.

#### Step 3: Scored Semantic Matching

- Fetches the **top 1 candidate** via vector search against open tickets.
- Computes a match score (Semantic Similarity 60% + Structural Signals).
- **Match?** If score ≥ `SCORE_THRESHOLD` (default 0.75), Attach & Done.

#### Step 3.5: Recent Channel Fallback (Scored)

- Checks recent tickets in the _same channel_ (last 5 mins).
- Uses a lower threshold (`RECENT_CHANNEL_SCORE_THRESHOLD`, default 0.65) because temporal locality is a strong signal.

#### Step 3.6: Cross-Channel Context Retrieval (CCR)

- **Goal:** Group related issues across different channels/days.
- **Process:**
  - Fetches top **15 tickets** and top **25 messages** via vector search.
  - Scores candidates using: `Semantic * 0.55 + Category Bonus + Overlap Bonus + Recency`.
  - **Guardrails:** prevent merging unrelated topics (requires signal overlap or very high similarity).
  - **LLM Check:** If score is in "Gray Zone", `gpt-4o-mini` decides if they represent the same underlying issue.

#### Step 4: Create New Ticket

- If no match found in Steps 1-3.6, create a new ticket.

**Scoring system:** The full scoring logic—formulas, guardrails, category compatibility matrix, semantic similarity, and gray-zone LLM checks—is documented in [**docs/SCORING_SYSTEM.md**](docs/SCORING_SYSTEM.md).

---

## Dashboard Features

### Ticket List

- **Full-width search bar** with instant filtering.
- **Filters panel**: Date, Category, Priority, Status.
- **Real-time updates**: Socket.IO pushes updates instantly.

### Sidebar

- Navigation and User Profile.

---

## Troubleshooting

- **Bot not receiving events**: Check Socket Mode and `message.channels` scope.
- **Missing scopes**: Reinstall app after adding `channels:history`.
- **Dashboard blank**: Ensure you are at `/dashboard` and backend is running.
- **Database errors**: Check `SUPABASE_URL` and run migrations in order.

---

## License

MIT
