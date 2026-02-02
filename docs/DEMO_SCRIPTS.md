# Nixo FDE Slackbot – Demo Script

This script contains three separate conversation flows across multiple Slack channels.
It is designed to demonstrate:

- Relevance detection
- Grouping across channels and threads
- De-duplication
- Ignoring casual messages
- Realtime UI updates

Assume:

- You are the only FDE
- Everyone else is a customer
- Bot is already installed and listening to events

---

## Flow 1: Bug Report Grouped Across Channels

### Channel: #acme-bugs

Customer (Nathan):

> The login button doesn’t work on mobile Safari. It just spins forever.

Expected bot behavior:

- Classified as bug report
- New ticket created
- Appears in dashboard within 10 seconds
- Title example: "Login broken on mobile Safari"

Customer (Jordan):

> Same issue here on iPhone 14, iOS 17. Login just shows a white screen.

Expected bot behavior:

- Detected as relevant
- Grouped into the existing "Login broken on mobile Safari" ticket
- No new ticket created

---

### Channel: #acme-onboarding

Customer (Nathan):

> We started seeing this login issue right after enabling SSO. Not sure if related.

Expected bot behavior:

- Detected as relevant
- Grouped into the same login bug ticket
- Demonstrates cross-channel grouping

Customer (Nathan):

> Thanks!

Expected bot behavior:

- Ignored as casual
- No UI change

---

## Flow 2: Feature Request With Multi-Message Context

### Channel: #acme-feature-requests

Customer (Jordan):

> Feature request: can you add export to CSV for audit logs?

Expected bot behavior:

- Classified as feature request
- New ticket created
- Appears in dashboard
- Title example: "Export audit logs to CSV"

Customer (Jordan):

> I don’t see any export button right now, only filters.

Expected bot behavior:

- Detected as relevant
- Grouped into the same feature request ticket

Customer (Nathan):

> +1, we need this for monthly compliance reports.

Expected bot behavior:

- Detected as relevant
- Grouped into the same ticket
- Shows multiple authors in UI

Customer (Jordan):

> lol let’s grab dinner after this

Expected bot behavior:

- Ignored
- No ticket created

---

## Flow 3: Threaded Support + De-duplication

### Channel: #acme-support

Customer (Nathan):

> Our webhook deliveries are failing with 401 errors.

Expected bot behavior:

- Classified as support issue
- New ticket created
- Title example: "Webhooks failing with 401"

FDE (You):

> Did you rotate your signing secret recently?

Customer (Nathan) [in thread]:

> Yeah, we rotated secrets yesterday and everything broke after that.

Expected bot behavior:

- Detected as relevant
- Grouped into the same webhook ticket
- Thread context preserved

---

### Channel: #acme-bugs

Customer (Nathan):

> Still seeing 401s on webhook retries. Nothing is getting delivered.

Expected bot behavior:

- Detected as relevant
- De-duplicated
- Appended to existing "Webhooks failing with 401" ticket
- No new ticket created

---

## Expected Dashboard State After Demo

You should see exactly four tickets:

1. Login broken on mobile Safari

   - Messages from #acme-bugs and #acme-onboarding
   - Multiple customers
   - Grouped by semantic similarity

2. Export audit logs to CSV

   - Messages from #acme-feature-requests
   - Clearly marked as feature request

3. Webhooks failing with 401

   - Messages from #acme-support thread and #acme-bugs
   - Demonstrates de-duplication

4. (Optional) SSO setup question
   - Only if you choose to classify onboarding questions as relevant

Ignored:

- Thank-you messages
- Social chatter
- Non-product conversation

End of demo.
