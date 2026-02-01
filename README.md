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
| `SIMILARITY_THRESHOLD`           | Cosine distance threshold (deprecated, kept for backward compatibility)     | `0.17` (default)            |
| `RECENT_CHANNEL_THRESHOLD`       | Recent-channel threshold (deprecated, kept for backward compatibility)      | `0.40` (default)            |
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
2. **Context-aware OpenAI classification:** `gpt-4o-mini` with Structured Outputs; categories: `bug_report`, `support_question`, `feature_request`, `product_question`, `irrelevant`. Only messages with `is_relevant: true` become tickets.
   - **Thread context:** For messages in a Slack thread, fetches previous messages in that thread to understand follow-ups and clarifications.
   - **Channel context:** For non-thread messages, fetches the last 15 channel messages (configurable via `CHANNEL_CONTEXT_LIMIT`) to detect indirect references (e.g., "I cannot see a button for it" where "it" refers to a feature mentioned earlier).
   - The classifier uses both context types to determine if a message is relevant, even when it seems vague in isolation.

### Grouping Algorithm (Step-by-Step Message Matching)

When a new Slack message arrives, it goes through a multi-step matching process to determine whether to attach it to an existing ticket or create a new one. Messages from the same channel are processed sequentially (queue-based) to prevent race conditions.

#### Step 1: Thread Matching

- Check if the message's `root_thread_ts` matches any message in an existing **open** ticket
- `root_thread_ts` = `event.thread_ts ?? event.ts` (stored on every message)
- **If match found:** Attach message to that ticket, refresh summary → **Done**

#### Step 2: Entity-Based Canonical Key Matching

- Compute a `canonical_key` from extracted entity signals (roles, permissions, objects, platform, endpoints, error codes, feature keywords)
- Entity extraction includes: roles (admin, superadmin), permissions (access, rbac), objects (budget, csv, export), platform (web, mobile, api), endpoints (`/v1/*`, `/api/*`), error codes (401, 403, 500)
- Signals are normalized (stopword filtering, stemming) and deduplicated
- Canonical key = sorted unique tokens joined by "|" (e.g., "dashboard does not allow non-admins to access budget" → `"access_control|admin|budget|dashboard|superadmin"`)
- **Entity-based canonical keys work globally across channels** (not limited to same channel)
- Example: "Hey could you add export to CSV?" → canonical key: `csv|export|feature_export`
- Check if any **open** ticket has the same `canonical_key` (searches across all channels)
- **If match found:** Attach message to that ticket, refresh summary → **Done**

#### Step 3: Scored Semantic Matching

See detailed description above in the "Scored Semantic Matching" section. Uses multi-factor scoring with category compatibility as a soft signal.

#### Step 3.5: Recent Channel Fallback (Scored)

See detailed description above in the "Recent Channel Fallback (Scored)" section. Uses the same scoring approach with a lower threshold.

#### Step 3.6: Cross-Channel Context Retrieval (CCR)

**Purpose:** Enables grouping related issues across multiple channels and longer time windows (days instead of minutes) using DB retrieval (vector search + signals) rather than strict time windows.

**Process:**

1. **Candidate Fetching:**

   - Fetches top K ticket candidates from `find_cross_channel_ticket_candidates` RPC (vector search on ticket embeddings, default top 15)
   - Fetches top K message candidates from `find_cross_channel_message_candidates` RPC (vector search on message embeddings, default top 25)
   - Also checks canonical key match if not already found in Step 2
   - Deduplicates candidates by ticket ID (keeps best distance per ticket)

2. **Filtering:**

   - Skips closed tickets
   - Skips same-channel tickets (already handled in Step 3.5)
   - Only processes open tickets from other channels

3. **Scoring:**

   - Uses CCR-specific scoring formula: `semanticSim * 0.55 + categoryBonus + overlapBonus + recencyBonus`
   - Category bonus: +0.15 if same category, +0.10 if compatible, 0 if incompatible
   - Overlap bonus: +0.05 per overlapping signal (max +0.20)
   - Recency bonus: +0.10 if updated within 24h, +0.05 if within 7d, 0 otherwise
   - Score range: 0-1 (higher = better match)

4. **Guardrails:**

   - **Topic guard:** Blocks merge if distance > 0.50 AND overlap = 0 (message is about different topic)
   - **Rare token list:** Identifies strong evidence (specific terms like "budget", "csv", "rbac", "403", "superadmin")
   - Blocks merge only when evidence is weak (no overlap, high distance, no rare tokens)

5. **Decision Rules:**

   - Merge if score >= `SCORE_THRESHOLD` (default 0.75)
   - Merge if overlapCount >= 2 AND distance <= 0.45 AND score >= 0.65 (strong signal overlap)
   - If score is in gray-zone (close to threshold), performs LLM merge check using `checkCCRLLMMerge`
   - LLM check is more conservative for cross-channel merges (requires confidence >= 0.7)

6. **Logging:**
   - Logs top 5 CCR candidates with scores, distances, overlaps, and channel IDs
   - Logs guardrail decisions and LLM outcomes

**Configuration:**

- `CROSS_CHANNEL_DAYS`: Days to look back (default 14)
- `MATCH_TOPK_TICKETS`: Number of ticket candidates (default 15)
- `MATCH_TOPK_MESSAGES`: Number of message candidates (default 25)

**If match found:** Attach message to that ticket, refresh summary → **Done**

#### Step 4: Create New Ticket

- If no match found in any step, create a new ticket with:
  - Title from AI classification's `short_title`
  - Category from classification
  - AI-generated summary with description, action items, technical details, and priority hint
  - The message's embedding stored for future similarity matching
- Attach the message to the new ticket → **Done**

#### FDE Message Handling

Messages from the FDE user (defined by `FDE_USER_ID`) follow the same matching steps, but:

- Can **attach to existing tickets** (Steps 1-3.6) to add context
- **Cannot create new tickets** (Step 4 is skipped) - if no match is found, the message is not stored

#### Context-Only Updates

- If a message is classified as `is_relevant: false` (irrelevant), the system still attempts to attach it to an existing ticket using the same grouping steps (1-3.6)
- If attachment succeeds, the message is stored with `is_context_only: true` flag
- If attachment fails, the message is skipped (not stored)
- This allows irrelevant messages that provide context (e.g., "thanks", "got it") to be attached to tickets without creating noise

#### Summary Refresh on Attach

Whenever a message is attached to an existing ticket, the ticket's summary is regenerated from the full conversation:

- All messages in the ticket are passed to the AI summarizer
- The summary, action items, and technical details are updated
- **Priority is escalated** if newer messages indicate higher urgency (e.g., "by tonight", "ASAP", "critical")
- **Category escalation**: If the new message's category has higher precedence than the ticket's current category, the ticket category is updated. Precedence order: `bug_report` > `feature_request` > `support_question` > `product_question`. This ensures tickets reflect the most urgent/actionable category.

### Cross-Channel Grouping

- **Entity-based canonical keys:** Work globally across channels (not limited to same channel). Messages with the same entity fingerprint (e.g., "csv|export|feature_export") are grouped together regardless of channel.
- **Cross-Channel Context Retrieval (CCR):** Step 3.6 enables grouping related issues across multiple channels and longer time windows (days instead of minutes) using DB retrieval (vector search + signals) rather than strict time windows.
- **Evidence-based guardrails:** Prevent over-merging for broad topic matches with weak evidence. Uses rare token list to identify strong evidence (specific terms like "budget", "csv", "rbac", "403") and blocks merges only when evidence is weak (no overlap, high distance, no rare tokens).
- **Cross-channel context for classification:** DB RAG retrieves similar tickets/messages from other channels before classification to help classify vague updates.

### Deduplication

- **Messages:** UNIQUE on `(slack_channel_id, slack_ts)`.
- **Tickets:** Partial unique index on `canonical_key WHERE status='open'`. On insert conflict, fetch existing ticket and attach message.

### Message Edits

- Only normal new messages are processed by default (subtypes ignored). Optional: handle `message_changed` to update existing message row; never create new tickets from edits.

### Real-Time Updates

- **Socket.IO events:** Backend emits `ticket_updated` event after every message attach (from `group.ts` pipeline) and when tickets are resolved/updated (from API routes)
- **Dashboard refetch:** Frontend subscribes to `ticket_updated` events and automatically refetches the ticket list
- **Reconnect handling:** Dashboard also refetches on socket connect/reconnect to ensure no updates are missed after disconnections
- **Per-message emission:** Every time a message is attached to a ticket (Steps 1-3.6), the backend emits `ticket_updated` with the ticket ID, ensuring the dashboard stays in sync

### Performance

- Classification cache (1h TTL, keyed by normalized text, skipped when context is present); p-limit (default 3) on OpenAI calls; Slack events acked immediately; no polling (Socket.IO only).
- Channel context fetching: Each non-thread message makes one additional Slack API call (`conversations.history`) to fetch recent messages. Consider caching channel history per channel for a short window if rate limits become an issue.
- **Per-channel message queue:** Messages from the same channel are processed sequentially to prevent race conditions. Messages from different channels can still process in parallel.
- **Scored matching:** Fetches top 5 candidates from vector search, scores each with multi-factor approach, applies guardrails, and optionally uses LLM for gray-zone cases. This is more robust than single-threshold matching but adds minimal overhead (typically 1-2 additional DB queries per message).
- **Cross-Channel Context Retrieval (CCR):** Step 3.6 fetches candidates from ticket and message vector search across channels (top 15 tickets, top 25 messages), scores each with CCR-specific formula, applies evidence-based guardrails, and optionally uses LLM for gray-zone cases. Adds 2-3 additional DB queries per message but enables grouping across channels and longer time windows (days instead of minutes).

### Security

- Service role key server-side only; CORS restricted to `APP_ORIGIN`.

### AI Usage

- **Classification** (`gpt-4o-mini` with Structured Outputs):
  - Thread context (for thread replies): Previous messages in the same Slack thread
  - Channel context (for non-thread messages): Last N channel messages (default 15, configurable via `CHANNEL_CONTEXT_LIMIT`) to detect indirect references
  - **Cross-channel context (DB RAG):** Before classification, retrieves top 3 similar open tickets and top 5 similar messages from other channels (within `CROSS_CHANNEL_DAYS`) to help classify vague updates. This context is included in the classification prompt to improve accuracy.
  - The prompt looks for pronouns ("it", "that", "this") that may refer to features/issues mentioned in context
  - Generates **specific, descriptive titles** incorporating context (e.g., "User cannot find CSV export button" vs generic "User cannot find button") to improve semantic grouping
- **Embeddings** (`text-embedding-3-small`, 1536 dimensions):
  - **Enhanced embedding text** includes category, short_title, signals, and original message for better semantic stability
  - **Scored matching** (industry-standard): Combines semantic similarity (60%) with structural signals (category compatibility as soft signal, channel match, recency, signal overlap)
  - Score thresholds: `SCORE_THRESHOLD` (default 0.75) for Step 3, `RECENT_CHANNEL_SCORE_THRESHOLD` (default 0.65) for Step 3.5
  - **Evidence-based guardrails**: Only block merges when categories are incompatible AND evidence is weak (high distance, no overlap, not same thread/channel). Compatible categories (e.g., feature_request + support_question) merge naturally.
  - **Gray-zone LLM check**: Optional `gpt-4o-mini` call when score is close to threshold (or when categories differ) to verify if messages refer to the same underlying issue
  - Supabase returns vector columns as strings; the backend parses them to arrays automatically
- **Summarization** (`gpt-4o-mini`):
  - Generates description, action items, technical details, and priority hint
  - When messages are grouped, the summary is regenerated from the full conversation
  - **Priority escalation:** If newer messages indicate higher urgency ("by tonight", "ASAP", "critical"), priority is automatically raised

---

## Dashboard Features

### Ticket List

- **Full-width search bar** with instant filtering by ticket title
- **Filters panel** (expandable with smooth animation):
  - Date: All time, Last 7/30/90 days
  - Category: Bug report, Support question, Feature request, Product question
  - Priority: Critical, High, Medium, Low
  - Status: Open, Resolved, Closed
- **Priority badges** on ticket cards (color-coded: Critical=red, High=amber, Medium=blue, Low=gray)
- **Real-time updates** via Socket.IO when tickets are created, updated, or resolved
- **Automatic refetch** on socket connect/reconnect to ensure dashboard stays in sync even after disconnections
- **Live updates** whenever a new message is added to any ticket (backend emits `ticket_updated` event after every message attach)

### Ticket Detail Page

- Full ticket information: title, category, status, priority, dates, reporter, assignees
- AI-generated summary with description, action items, and technical details
- Message timeline showing all grouped messages
- **Resolve/Reopen button** to change ticket status (persisted to DB, broadcasts update via socket)

### Sidebar

- Fixed position sidebar that remains stable during content changes
- User profile section with sign-out functionality

---

## Troubleshooting

### Bot not receiving events

- Socket Mode enabled; app-level token has `connections:write`; `SLACK_APP_TOKEN` correct in `.env`; app installed and bot invited to channel; Event Subscriptions include `message.channels` (and `message.groups` if using private channels).

### Missing scopes

- Add required Bot Token Scopes in OAuth & Permissions; reinstall app to workspace.

### Socket / dashboard not updating

- `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_API_URL` point to backend (e.g. `http://localhost:4000`); backend running; CORS allows `APP_ORIGIN`.

### Database errors

- Re-run migration SQL in Supabase SQL Editor in order (001 → 005 → 006 → 007); confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
- If you see "column t.embedding must appear in the GROUP BY clause" error, ensure migration `007_cross_channel_context.sql` has been applied (the function `get_ticket_context_for_classification` uses subqueries to avoid this error).

### OpenAI errors

- Valid `OPENAI_API_KEY`; access to `gpt-4o-mini` and `text-embedding-3-small`; check [OpenAI status](https://status.openai.com) and usage.

### Port already in use

- Change `PORT` in `.env` (e.g. `4001`) and set `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_API_URL` to the same URL and port.

---

## API Endpoints

### Backend API (`http://localhost:4000`)

- **GET `/health`** - Health check endpoint
- **GET `/api/tickets`** - Get all tickets (optional query: `?status=open|resolved|closed`)
- **GET `/api/tickets/:id`** - Get a specific ticket by ID
- **PATCH `/api/tickets/:id`** - Update ticket (e.g., resolve: `{ "status": "resolved" }`)
- **DELETE `/api/tickets/:id`** - Delete a ticket
- **POST `/dev/ingest`** - Development endpoint to ingest test messages (bypasses Slack)

### Frontend API Routes (`http://localhost:3000/api`)

- **GET `/api/tickets`** - Proxy to backend `/api/tickets`
- **GET `/api/tickets/[id]`** - Proxy to backend `/api/tickets/:id`

### Socket.IO Events

- **`ticket_updated`** - Emitted by backend when a ticket is created, updated, or a message is attached
  - Payload: `{ ticketId: string }`
  - Frontend subscribes to this event and refetches the ticket list

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
│       ├── 001_initial_schema.sql      # Core schema (tickets, messages, embeddings)
│       ├── 005_messages_update_trigger.sql  # Message update trigger
│       ├── 006_scored_matching.sql     # Scored matching functions
│       └── 007_cross_channel_context.sql  # Cross-channel context RPCs and is_context_only column
├── scripts/
│   ├── test-scenarios.ts    # TypeScript test scenarios script
│   ├── test-scenarios.ps1   # PowerShell test scenarios script (Windows)
│   └── test-scenarios.sh   # Bash test scenarios script (Linux/Mac)
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

**Single message:**

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
