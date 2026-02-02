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

**Accounts:** Supabase ([sign up](https://supabase.com)), Slack workspace, [OpenAI API key](https://platform.openai.com/api-keys), [AWS](https://aws.amazon.com) (for Cognito User Pool — required for dashboard sign-in).

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
   - `supabase/migrations/002_message_embeddings_similarity.sql` - Message embeddings and similarity search
   - `supabase/migrations/003_message_username.sql` - Message username column
   - `supabase/migrations/004_ticket_summary_assignees.sql` - Ticket summary and assignees
   - `supabase/migrations/005_messages_update_trigger.sql` - Message update trigger
   - `supabase/migrations/006_scored_matching.sql` - Scored matching functions
   - `supabase/migrations/007_cross_channel_context.sql` - Cross-channel context RPCs and `is_context_only` column
   - `supabase/migrations/008_summary_embedding.sql` - `summary_embedding` column and RPCs using it for matching
   - `supabase/migrations/009_redundancy_detection.sql` - Redundancy detection columns and helpers
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

### 5. AWS Cognito

The dashboard uses AWS Cognito for sign-up and sign-in. Create a User Pool and app client, then add the resulting values to your `.env` (see [§6 Environment variables](#6-environment-variables)).

1. In the [AWS Console](https://console.aws.amazon.com), open **Cognito** → **User Pools** → **Create user pool**.
2. **Sign-in experience:** Choose **Cognito user pool** → **Email** as the sign-in option (or Email and password if you prefer). Continue.
3. **Security requirements:** Choose password policy and MFA as needed. Continue.
4. **Sign-up experience:** Enable self-registration if you want users to sign up from the app. Under **Required attributes**, include at least **email**, **given_name**, **family_name**, and **preferred_username** (or match what the app expects). Continue.
5. **Message delivery:** Use Cognito’s default email (or configure SES). Continue.
6. **Integrate your app:** Set a **User pool name** (e.g. `nixo-dashboard`). Continue.
7. **Create app client:** Create an app client (e.g. `nixo-web`). For a browser app, create **without** a client secret (public client). Note the **Client ID**. Configure callback URL(s) and sign-out URL(s) if you use hosted UI; for Amplify/JS in the Next.js app, the app uses the client ID and region only.
8. Create the user pool. In the pool’s **User pool overview**, copy:
   - **User pool ID** → `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - **Region** (e.g. `us-east-1`) → `NEXT_PUBLIC_COGNITO_REGION`
   - From **App integration** → **App client** → the **Client ID** → `NEXT_PUBLIC_COGNITO_CLIENT_ID`

Add these three values to your root `.env` so the dashboard can authenticate users.

### 6. Environment variables

All configuration is in a single root `.env` file. Copy the example and edit:

```bash
cp .env.example .env
# Windows (PowerShell): Copy-Item .env.example .env
```

Set each variable:

| Variable                           | Description                                                                 | Example / Notes             |
| ---------------------------------- | --------------------------------------------------------------------------- | --------------------------- |
| **Slack**                          |                                                                             |                             |
| `SLACK_BOT_TOKEN`                  | Bot User OAuth Token                                                        | `xoxb-...`                  |
| `SLACK_APP_TOKEN`                  | App-Level Token (Socket Mode)                                               | `xapp-...`                  |
| `SLACK_SIGNING_SECRET`             | Signing Secret                                                              | Optional                    |
| `FDE_USER_ID`                      | Your Slack user ID                                                          | `U1234567890`               |
| **OpenAI**                         |                                                                             |                             |
| `OPENAI_API_KEY`                   | OpenAI API key                                                              | `sk-...`                    |
| `OPENAI_CONCURRENCY`               | Max concurrent OpenAI calls                                                 | `3` (default)               |
| `CHANNEL_CONTEXT_LIMIT`            | Number of recent channel messages to fetch for classification context       | `15` (default)              |
| `SCORE_THRESHOLD`                  | Match score threshold for Step 3 semantic matching (0-1, higher = stricter) | `0.75` (default)            |
| `RECENT_CHANNEL_SCORE_THRESHOLD`   | Match score threshold for Step 3.5 recent-channel fallback                  | `0.65` (default)            |
| `RECENT_WINDOW_MINUTES`            | Time window for recent-channel grouping                                     | `5` (default)               |
| `SIMILARITY_GRAYZONE_LOW`          | Lower bound of gray-zone distance range for LLM merge check                 | `0.17` (default)            |
| `SIMILARITY_GRAYZONE_HIGH`         | Upper bound of gray-zone distance range for LLM merge check                 | `0.30` (default)            |
| `CROSS_CHANNEL_DAYS`               | Days to look back for cross-channel context retrieval (CCR)                 | `14` (default)              |
| `MATCH_TOPK_TICKETS`               | Number of ticket candidates to fetch for CCR                                | `15` (default)              |
| `MATCH_TOPK_MESSAGES`              | Number of message candidates to fetch for CCR                               | `25` (default)              |
| `SAME_THREAD_BONUS`                | Score bonus when message is in same thread as candidate ticket              | `0.12` (default)            |
| `THREAD_IRRELEVANT_BLOCK`          | Block irrelevant filler in thread even when sameThread                      | `true` (default)            |
| `THREAD_CONTEXT_ONLY_MIN_SCORE`    | Min score for irrelevant thread messages to attach as context-only          | `0.60` (default)            |
| **Supabase**                       |                                                                             |                             |
| `SUPABASE_URL`                     | Supabase project URL                                                        | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY`        | Service role key                                                            | Project Settings → API      |
| **Backend**                        |                                                                             |                             |
| `APP_ORIGIN`                       | CORS origin for dashboard                                                   | `http://localhost:3000`     |
| `PORT`                             | Backend port                                                                | `4000`                      |
| `NODE_ENV`                         | Environment                                                                 | `development`               |
| **Frontend**                       |                                                                             |                             |
| `NEXT_PUBLIC_SOCKET_URL`           | Backend URL for Socket.IO                                                   | `http://localhost:4000`     |
| `NEXT_PUBLIC_API_URL`              | Backend URL for API                                                         | `http://localhost:4000`     |
| `NEXT_PUBLIC_APP_ORIGIN`           | Web app origin (for server-side fetch of tickets, e.g. dashboard/tickets)   | `http://localhost:3000`     |
| **AWS Cognito**                    |                                                                             |                             |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID (dashboard sign-in)                                    | `us-east-1_xxxxxxxxx`       |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID`    | Cognito app client ID (create without secret for browser)                   | From App integration        |
| `NEXT_PUBLIC_COGNITO_REGION`       | AWS region where the User Pool is created                                   | `us-east-1`                 |

_Note: Legacy variables like `SIMILARITY_THRESHOLD` are preserved for backward compatibility but superseded by score thresholds._

### 7. Run the application

From the project root:

```bash
pnpm dev
```

- **Backend** (Express + Socket.IO + Slack Bolt): http://localhost:4000
- **Web App** (Landing Page): http://localhost:3000
- **Dashboard** (overview): http://localhost:3000/dashboard
- **Tickets** (tickets-only list): http://localhost:3000/dashboard/tickets

Open **Dashboard** for an overview (stats cards + ticket list with search and filters). Open **Tickets** for a tickets-only view with taller cards (reporter, message count). Post a relevant message in a channel where the bot is invited to create a ticket.

Note: `/dashboard` and `/dashboard/tickets` are protected and require Sign-up/Login to access.

**Run apps individually (optional):**

```bash
cd apps/backend && pnpm dev    # or: cd apps/web && pnpm dev
```

### 8. Verify setup

- **Health:** http://localhost:4000/health → `{"status":"ok"}`
- **Backend API – list tickets:** `GET http://localhost:4000/api/tickets` (optional `?status=open|closed|resolved`) → JSON array of tickets, each including `message_count`
- **Backend API – single ticket:** `GET http://localhost:4000/api/tickets/:id` → ticket with messages
- **Slack:** Backend logs show "Slack Bolt app started"; sending a relevant message in Slack creates/updates a ticket
- **Dashboard:** http://localhost:3000/dashboard shows overview and ticket list; http://localhost:3000/dashboard/tickets shows the tickets-only view; new/updated tickets appear in real time (Socket.IO)
- **Ticket detail:** Open a ticket from Dashboard or Tickets; the back arrow returns to the page you came from (`/dashboard` or `/dashboard/tickets` via `?from=dashboard` or `?from=tickets`)
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
5. **Show Dashboard / Tickets**: Observe live updates at `http://localhost:3000/dashboard` or `http://localhost:3000/dashboard/tickets` without refreshing.

---

## Architecture Details

### Relevance Detection

1. **Heuristic filter:** Examples like "thanks", "ok", "cool" are flagged as low-signal.
2. **Context-aware OpenAI classification:** Classifies messages into `bug_report`, `support_question`, `feature_request`, etc.
   - The system attempts to attach messages to existing tickets (Steps 1–3.6); only messages with `is_relevant: true` create a _new_ ticket (Step 4).
   - Irrelevant messages may attach as **context-only** only if they meet score and evidence rules (see [Scoring system](docs/SCORING_SYSTEM.md)); pure filler in a thread can be blocked even when in the same thread.

### Relevance and Redundancy

**Definition of "Relevant to FDEs":**

- Actionable requests, bug reports, support questions, product questions
- Clarifications that change scope or add signals
- Excludes filler, greetings, pure acknowledgments

**Redundancy Behavior:**

Messages with the same `intent_key` are stored but hidden by default in the ticket timeline. Redundant messages are preserved for audit but do not trigger summary refreshes.

Examples:

- "make the button blue" vs "ensure the button is blue" → redundant (same `intent_key`)
- "make the dashboard blue" is NOT redundant with button request (different `intent_object`)

**Intent Key Format:**

Format: `${intent_action}|${intent_object}|${intent_value}`

- `intent_object` is required to prevent color-only grouping
- Ensures "button blue" and "dashboard blue" remain distinct
- Color tokens alone cannot group messages across different UI components

**UI Behavior:**

- Redundant messages are hidden by default in the ticket detail view
- A toggle allows viewing redundant confirmations when needed
- Redundant messages appear with reduced opacity when shown

### Grouping Algorithm (Step-by-Step Message Matching)

When a new Slack message arrives, it goes through a multi-step matching process. Full details (formulas, guardrails, in-thread rules) are in [**docs/SCORING_SYSTEM.md**](docs/SCORING_SYSTEM.md).

#### Step 1: Thread Candidate Boost

- If `root_thread_ts` matches an open ticket, that ticket is added as a **candidate** with a **sameThread** flag. The message does **not** attach here; it continues through Steps 2–3.6 and is scored like any other message.
- **sameThread** is a small score bonus (Step 3.5: +0.12, Step 3.6: +0.08), not a pass condition. **Relevance and evidence dominate:** irrelevant thread chatter (e.g. "lol thanks") is dropped unless it meets context-only rules (score ≥ 0.60 and overlap ≥ 1 or status-update or distance ≤ 0.30). Filler messages in thread can be blocked even when sameThread.

#### Step 2: Entity-Based Canonical Key Matching

- Entity signals and stable canonical key. **Match?** Attach & Done.

#### Step 3: Scored Semantic Matching

- Vector search (prefer **summary_embedding**, fallback **embedding**). Score ≥ `SCORE_THRESHOLD` (0.75) → Attach & Done.

#### Step 3.5: Recent Channel Fallback

- Same channel, last 5 mins; threshold `RECENT_CHANNEL_SCORE_THRESHOLD` (0.65). Irrelevant messages only attach as context-only if they meet the minimum score and evidence rules.

#### Step 3.6: Cross-Channel Context Retrieval (CCR)

- Union of top **15 tickets** and **25 messages** by vector search (prefer **summary_embedding**). Thread candidate included with sameThread bonus. Signals normalized (synonym map). Guardrails and optional LLM gray-zone check. Irrelevant messages follow the same context-only rules.

#### Step 4: Create New Ticket

- No match in 1–3.6 → create new ticket.

**Summary embeddings:** Tickets store **summary_embedding** (title + category + summary + signals) and use it for matching when present, improving cross-conversation accuracy over the initial-message embedding alone.

---

## Dashboard Features

### Pages and routes

| Route                | Description                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`         | **Dashboard** – Overview with stats cards and a ticket list (compact cards). Same search bar and filters (Date, Category, Priority, Status). Dynamic section title based on active filters. |
| `/dashboard/tickets` | **Tickets** – Tickets-only view with the same search bar and filters. Taller ticket cards showing **Reported by**, **Messages** count, and reporter icon.                                   |
| `/tickets/[id]`      | **Ticket detail** – Single ticket with message timeline. Back arrow returns to Dashboard or Tickets depending on where the ticket was opened (`?from=dashboard` or `?from=tickets`).        |

### Ticket list (Dashboard and Tickets tab)

- **Search bar** – Full-width search with the same design on both Dashboard and Tickets.
- **Filters** – Date, Category, Priority, Status (custom dropdowns; overlay when open). Active filter count shown on the Filters button.
- **Real-time updates** – Socket.IO pushes new/updated tickets without refresh.
- **No loading indicator** – Initial load and refetches do not show a "Loading..." message next to the tickets.

### Sidebar

- **Dashboard** – Overview (stats + tickets).
- **Tickets** – Tickets-only list.
- **Profile** – User profile (and Sign out in the user menu at the bottom).

### API (backend and web proxy)

**Backend** (http://localhost:4000):

| Method | Path               | Description                                                                                            |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------ |
| GET    | `/api/tickets`     | List tickets (optional `?status=open`, `closed`, or `resolved`). Each ticket includes `message_count`. |
| GET    | `/api/tickets/:id` | Single ticket with messages (channel/workspace names resolved when available).                         |
| PATCH  | `/api/tickets/:id` | Update ticket (e.g. body `{ "status": "resolved" }`).                                                  |
| DELETE | `/api/tickets/:id` | Delete a ticket.                                                                                       |

**Web app** (Next.js proxies to backend): `GET /api/tickets`, `GET /api/tickets/[id]`, `DELETE /api/tickets/[id]`.

---

## Troubleshooting

- **Bot not receiving events**: Check Socket Mode and `message.channels` scope.
- **Missing scopes**: Reinstall app after adding `channels:history`.
- **Dashboard blank**: Ensure you are at `/dashboard` or `/dashboard/tickets`, the backend is running, and Cognito env vars are set.
- **Sign-in / sign-up fails**: Check `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, and `NEXT_PUBLIC_COGNITO_REGION`; ensure the app client was created without a secret (public client).
- **Database errors**: Check `SUPABASE_URL` and run migrations in order.

---

## License

MIT
