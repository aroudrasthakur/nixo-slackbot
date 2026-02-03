# In-Depth Analysis of the Scoring System

The pipeline uses **two** main scoring paths plus **guardrails** and **gray-zone LLM checks**. Scoring is additive and capped; guardrails can block merges even when the score is high. **In-thread messages** no longer auto-attach; they enter the same pipeline and receive a small **same-thread bonus** when the thread ticket is a candidate.

---

## 1. In-Thread Matching (Step 1)

**Behavior:** If the message’s `root_thread_ts` matches an open ticket, that ticket is added as a **candidate** with a **sameThread** flag. The message does **not** attach immediately; it continues through Steps 2–3.6 and is scored like any other message.

- **sameThread bonus:** When the thread ticket is the chosen candidate: **Step 3.5** uses sameThread only in **guardrails** (to allow merge when sameThread + evidence); the numeric score in `computeMatchScore` does **not** include a sameThread bonus. **Step 3.6 (CCR)** adds +min(0.08, SAME_THREAD_BONUS) to the score.
- **Relevance over thread:** For **irrelevant** messages (`is_relevant: false`), attachment is allowed only as **context-only** if:
  - `score >= THREAD_CONTEXT_ONLY_MIN_SCORE` (default 0.60), **and**
  - at least one of: `overlapCount >= 1`, message matches **status-update** patterns (e.g. "on it", "fixed", "investigating"), or `distance <= 0.30`.
- **Filler block:** If the message is irrelevant **and** matches **filler** patterns (e.g. "thanks", "ok", "cool", "lol") **and** `overlapCount === 0` **and** it is not a status update, the merge is **blocked** even when sameThread is true (`THREAD_IRRELEVANT_BLOCK`, default true).

So: **relevance and evidence dominate**; same-thread is a bonus, not a pass condition.

**Env:** `SAME_THREAD_BONUS` (default 0.12), `THREAD_IRRELEVANT_BLOCK` (default true), `THREAD_CONTEXT_ONLY_MIN_SCORE` (default 0.60).

---

## 2. Two Scoring Contexts

| Aspect    | **Step 3.5 (Recent Channel)**                       | **Step 3.6 (CCR / Cross-Channel)**        |
| --------- | --------------------------------------------------- | ----------------------------------------- |
| Function  | `computeMatchScore`                                 | `computeCCRMatchScore`                    |
| Context   | Same channel, recent (e.g. 5 min)                   | Any channel, longer window (e.g. 14 days) |
| Threshold | `RECENT_CHANNEL_SCORE_THRESHOLD` (default **0.65**) | `SCORE_THRESHOLD` (default **0.75**)      |
| Rationale | Same channel + recency = strong prior; lower bar    | Cross-channel = weaker prior; higher bar  |

So: **same-channel recent** uses a **lower** threshold and **more structural bonuses**; **cross-channel** uses a **higher** threshold and **less** structural bonus (no same-channel).

---

## 3. Semantic Similarity (Base)

Both scores start from **cosine distance** between message and ticket (or message) embeddings.

- **Distance** ∈ [0, 2]: 0 = identical, 2 = opposite.
- **Conversion to similarity:**  
  `similarity = 1 - (distance / 2)`  
  so similarity ∈ [0, 1], clamped.

### 3.1 How Semantic Similarity Is Computed

**Embeddings**

- **Model:** OpenAI `text-embedding-3-small`, output dimension **1536**.
- **Incoming message:** The text sent to the embedding API is not raw message text only. It is an **enhanced** string built from classification and signals, truncated to 2000 characters:
  ```
  textToEmbed = "${category}: ${short_title}\nSignals: ${signalsText}\nMessage: ${messageText}".substring(0, 2000)
  ```
  So the vector represents **category + short title + extracted signals + original message**, which keeps embeddings stable and topic-aware (e.g. "feature_request: CSV export button" plus signals like "csv", "export").
- **Ticket embedding:** Stored on the ticket when it is created or updated; same model and dimension. The ticket may use **summary_embedding** (title + category + summary + signals) when available; otherwise the **creating-message** embedding. Matching prefers `summary_embedding` for better cross-conversation similarity.
- **Summary structure (JSONB):** `description`, `action_items`, `technical_details`, `priority_hint` (see migration 004).
- **Message embeddings:** Stored on each message row; same model. Used in Step 3 (find similar message) and in CCR (message vector search). Dimension must match (1536).

**Cosine distance (implementation)**

The code computes **cosine distance** between two vectors `a` and `b`:

1. **Dot product:** `dotProduct = Σ a[i] * b[i]`
2. **Norms:** `normA = Σ a[i]²`, `normB = Σ b[i]²`
3. **Cosine similarity:**  
   `cosineSimilarity = dotProduct / (√normA * √normB)`  
   This is the cosine of the angle between the vectors, in [−1, 1] for real vectors (in practice [0, 1] for embedding space).
4. **Cosine distance:**  
   `distance = 1 - cosineSimilarity`  
   So distance ∈ [0, 2]: 0 when identical direction, 2 when opposite. Lower distance = more similar.

Vectors must have the same length (1536); the code throws if dimensions differ.

**Where distance comes from**

- **Step 3:** The DB (Supabase/pgvector) does vector search using `COALESCE(t.summary_embedding, t.embedding)` for tickets and returns the best ticket or message with a **distance** (e.g. `<=>` in PostgreSQL). That distance is already cosine distance in the same metric as above.
- **Step 3.5:** The recent ticket’s **summary_embedding** (or **embedding**) is loaded from the DB; **cosine distance** is computed in app between the incoming message embedding and that vector.
- **Step 3.6 (CCR):** Candidates come from RPCs that use `COALESCE(summary_embedding, embedding)` for tickets and return rows with a **distance** column; the app uses it in `computeCCRMatchScore` and guardrails.

So **semantic similarity** in the doc means: embed text with the enhanced format → obtain 1536-d vectors → compare with **cosine distance** (1 − cosine similarity) → then convert distance to a [0, 1] similarity for scoring via `similarity = 1 - (distance / 2)` (clamped).

---

**Step 3.5 (Recent Channel):**

```
semanticSim = max(0, min(1, 1 - distance/2)) * 0.60
```

- Semantic is **at most 60%** of the score.
- So even with perfect similarity (distance 0), you only get 0.6; the rest comes from structure.

**Step 3.6 (CCR):**

```
semanticSim = max(0, min(1, 1 - distance/2))
score = semanticSim * 0.55
```

- Semantic is **55%** of the score.
- Slightly lower weight than in 3.5, leaving more room for overlap/category/recency.

Design: **embedding is the main signal**, but **structure** (channel, recency, category, overlap) can add up to **~40–45%** so that "same conversation" and "same topic" both matter.

---

## 4. Step 3.5: `computeMatchScore` (Recent Channel)

**Inputs:**  
`distance`, `sameChannel`, `minutesSinceTicketUpdate`, `categoryCompatibility`, `sameCategory`, `overlapCount`, `sameThread`.

**Formula (conceptually):**

| Component | Condition                    | Bonus / Penalty                          |
| --------- | ---------------------------- | ---------------------------------------- |
| Semantic  | Always                       | `(1 - distance/2) * 0.60` (capped 0–0.6) |
| Category  | Same category                | +0.10                                    |
| Category  | Compatible (not "sometimes") | +0.05                                    |
| Category  | Sometimes compatible         | +0.02                                    |
| Category  | Incompatible                 | **−0.10**                                |
| Structure | Same channel                 | +0.15                                    |
| Structure | Ticket updated ≤ 10 min ago  | +0.15                                    |
| Structure | overlapCount ≥ 1             | +0.10                                    |
| Structure | sameThread                   | +SAME_THREAD_BONUS (default 0.12)        |

**Cap:** `score = min(1.0, score)` (can go negative before cap; then min with 1).

**Typical maxima:** Best case (semantic 0.6 + same category 0.10 + same channel 0.15 + recent 0.15 + overlap 0.10) is **1.0** capped. Incompatible category still mergeable if above 0.65. sameThread does not add to score but can **allow** merge via guardrails; guardrails (including filler block) can still block.

---

## 5. Step 3.6: `computeCCRMatchScore` (Cross-Channel)

**Inputs:**  
`distance`, `sameCategory`, `categoryCompatibility`, `overlapCount`, `updatedAt`, `sameThread`.

**Formula:**

| Component  | Condition                 | Bonus                         |
| ---------- | ------------------------- | ----------------------------- |
| Semantic   | Always                    | `(1 - distance/2) * 0.55`     |
| Category   | Same category             | +0.10                         |
| Category   | Compatible                | +0.05                         |
| Overlap    | overlapCount ≥ 1          | +0.10                         |
| Overlap    | overlapCount ≥ 2          | +0.10 (extra)                 |
| Recency    | Ticket updated ≤ 24 h ago | +0.05                         |
| sameThread | Thread ticket candidate   | +min(SAME_THREAD_BONUS, 0.08) |

**Cap:** `score = max(0, min(1, score))`.

**No same-channel bonus** (by design; CCR is cross-channel). **Recency** is weaker (+0.05, 24 h) than in 3.5 (+0.15, 10 min). **Overlap** is emphasized; **sameThread** gives a smaller bonus in CCR (cap 0.08) than in 3.5.

---

## 6. Category Compatibility (Shared)

Used in **both** scoring paths and in **guardrails**.

- **Same category:** compatible, no penalty; in score: +0.10 (3.5) or +0.10 (CCR).
- **Always compatible pairs:**  
  support_question ↔ product_question, support_question ↔ feature_request, product_question ↔ feature_request  
  → +0.05 (3.5) or +0.05 (CCR).
- **Sometimes compatible:**  
  support_question ↔ bug_report, product_question ↔ bug_report  
  → +0.02 (3.5); in CCR they still get the "compatible" path if implemented the same.
- **Incompatible:**  
  bug_report ↔ feature_request  
  → −0.10 in 3.5; in CCR no bonus (effectively a penalty relative to "compatible").

So the **score** encodes "same vs compatible vs incompatible" as soft bonuses/penalties; the **guardrails** can still block when evidence is weak.

### Category compatibility matrix

Cell = compatibility when **message category** (row) is compared to **ticket category** (column). Symmetric (e.g. support_question ↔ feature_request is compatible in both directions).

|                      | bug_report                                       | feature_request                                  | product_question                             | support_question                             | irrelevant                                   |
| -------------------- | ------------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| **bug_report**       | <span style="color: green">same</span>           | <span style="color: red">**incompatible**</span> | <span style="color: orange">sometimes</span> | <span style="color: orange">sometimes</span> | <span style="color: red">incompatible</span> |
| **feature_request**  | <span style="color: red">**incompatible**</span> | <span style="color: green">same</span>           | <span style="color: blue">compatible</span>  | <span style="color: blue">compatible</span>  | <span style="color: red">incompatible</span> |
| **product_question** | <span style="color: orange">sometimes</span>     | <span style="color: blue">compatible</span>      | <span style="color: green">same</span>       | <span style="color: blue">compatible</span>  | <span style="color: red">incompatible</span> |
| **support_question** | <span style="color: orange">sometimes</span>     | <span style="color: blue">compatible</span>      | <span style="color: blue">compatible</span>  | <span style="color: green">same</span>       | <span style="color: red">incompatible</span> |
| **irrelevant**       | <span style="color: red">incompatible</span>     | <span style="color: red">incompatible</span>     | <span style="color: red">incompatible</span> | <span style="color: red">incompatible</span> | <span style="color: green">same</span>       |

**Score effect (Step 3.5):**

| Match type           | Step 3.5 bonus | Step 3.6 (CCR) bonus  |
| -------------------- | -------------- | --------------------- |
| Same category        | +0.10          | +0.10                 |
| Compatible           | +0.05          | +0.05                 |
| Sometimes compatible | +0.02          | +0.05 (as compatible) |
| Incompatible         | −0.10          | 0 (no bonus)          |

Incompatible pairs can still merge when guardrails allow (e.g. strong evidence: same thread **with** overlap/status/distance, high overlap, or same channel + recent + low distance).

---

## 7. Signal Overlap

**Definition:**  
Message signals (from classifier) vs ticket signals (from last 5 messages, `normalizeMessage` + entities).  
Signals are **normalized** with a synonym map (e.g. "rbac", "permission", "authorization" → `access_control`; "super admin" → `superadmin`; "budget page" → `budget`) and prefix stripping (`feature_`, `platform_`, `error_`) so e.g. `feature_export` and `export` can match. Overlap uses these normalized signals; cap length 25.

**Use in scoring:**

- **Step 3.5:** overlap ≥ 1 → +0.10 (no extra for 2+).
- **Step 3.6:** overlap ≥ 1 → +0.10, overlap ≥ 2 → +0.10 more (total +0.20 for 2+).

So **CCR relies more on overlap** to justify cross-channel merges.

### 7.1 Color Tokens and Object Requirements

Color tokens alone are not treated as primary overlap evidence unless paired with an object token. This prevents unrelated style requests across different UI components from being grouped together.

- "make the button blue" and "make the dashboard blue" have different `intent_object` values (button vs dashboard)
- Canonical key generation for `style_change` intents requires an object token
- Example allowed: `"button|style"` or `"dashboard|style"`
- Example blocked: `"blue|style"` alone (no object)

---

## 8. Redundancy Detection (Same Meaning Collapse)

**Overview:**  
Redundancy detection runs **after** a ticket is chosen (post-merge step). A message can be relevant and still be hidden if it repeats the same intent as a prior message in the ticket.

**When it runs:**  
After Steps 1-3.6 or Step 4 (create) determine the target ticket, but before `upsertMessage` stores the message.

**Fields:**

- `is_redundant`: boolean flag indicating if message is redundant
- `redundant_of_message_id`: UUID reference to the first message that established this intent
- `intent_key`: composite key `${intent_action}|${intent_object}|${intent_value ?? "*"}`
- `intent_action`: style_change, access_control, add_feature, bug, etc.
- `intent_object`: REQUIRED primary object (button, dashboard, navbar, etc.)
- `intent_value`: color (for style_change), role (for access_control), etc.

**Intent Key Format:**  
Format: `${intent_action}|${intent_object}|${intent_value ?? "*"}`

**Critical Rule:** `intent_object` is **mandatory**. If missing, `intent_key` is `null` and redundancy check is skipped. This ensures color words alone cannot group messages across different UI components.

**Examples:**

- "make the button blue" → `intent_key = "style_change|button|blue"`
- "ensure the button is blue" → `intent_key = "style_change|button|blue"` → **redundant** (same intent_key)
- "make the dashboard blue" → `intent_key = "style_change|dashboard|blue"` → **NOT redundant** (different intent_object)

**Redundancy Detection Logic:**

1. Compute `intent_key` for incoming message using `computeIntentFingerprint`.
2. Fetch last `REDUNDANT_LOOKBACK` (default 20) visible messages (`is_redundant=false`) for the ticket, ordered by `created_at DESC`.
3. For each prior message:

- If `intent_key` matches AND
- Semantic distance ≤ `REDUNDANT_DISTANCE_THRESHOLD` (default 0.18) AND
- No new information added (see override rules)
- Then mark incoming as redundant.

**"Adds new info" Override:**  
Even if `intent_key` matches, treat as **NOT redundant** if:

- Contains new platform (ios/android/web) not in ticket signals
- Contains error codes/endpoints not already present
- Introduces urgency/deadline words (asap, tonight, critical)
- Changes `intent_value` (e.g., blue → red)

**When redundant:**

- Message stored with `is_redundant=true`, `redundant_of_message_id`, `is_context_only=true`
- Summary refresh **skipped** (does not trigger `refreshTicketSummary`)
- UI hides by default (can be toggled to show)

**When not redundant:**

- Message stored normally with `is_redundant=false`
- Summary refresh proceeds as usual
- Message visible in UI

**Configuration:**

- `REDUNDANT_DISTANCE_THRESHOLD` (default 0.18): maximum embedding distance for redundancy
- `REDUNDANT_LOOKBACK` (default 20): number of prior messages to check

---

## 9. Guardrails (Pre-Score or Post-Score Blocks)

Guardrails can **allow** or **block** a merge regardless of the numeric score.

### 9.1 Step 3.5: `applyGuardrails`

**Allow (strong evidence overrides category):**

- Same thread → allow.
- overlapCount ≥ 2 and distance ≤ 0.30 → allow.
- Same channel and ticket updated within `RECENT_WINDOW_MINUTES` and distance ≤ 0.30 → allow.

**Block:**

- **Only if all of:**  
  not category-compatible **and** distance > 0.35 **and** overlapCount === 0 **and** not same thread **and** not (same channel and recent).

So: with **no** structural evidence (no thread, no overlap, or not same-channel+recent), **incompatible** category + **high distance** → block. With strong evidence (thread, overlap, or same-channel+recent+close), merge is still allowed.

### 9.2 Step 3.5: Topic Guard (After Score)

Even if guardrails pass and score ≥ 0.65:

- If **distance > 0.45** and **overlapCount === 0** → **do not merge** ("different topic"), proceed to Step 3.6 / 4.

So: high distance + **zero** overlap is treated as "different topic" and overrides the score.

### 9.3 Step 3.6: `applyCCRGuardrails`

**Rare tokens:**  
Fixed set (e.g. budget, csv, export, rbac, admin, superadmin, 403, 401, 500, invoice, oauth, sso, dashboard, analytics, pdf, report). Used to see if message and ticket share at least one **specific** term.

**Block:**

- overlapCount === 0 **and** distance > 0.35 **and** no rare-token overlap **and** not (overlapCount ≥ 2 and distance ≤ 0.45).  
  The last condition is redundant when overlapCount === 0; so in practice: **no overlap, no rare-token overlap, high distance** → block.

**Allow:**

- Rare-token overlap **or** overlapCount ≥ 2 **or** distance ≤ 0.30 → allow.

**Default:**  
If neither block nor explicit allow: allow (let score threshold decide).

So CCR guardrails **block** only when evidence is weak (no overlap, no rare tokens, high distance); **allow** when there is strong lexical or semantic evidence.

---

## 10. Gray-Zone and LLM Checks

When the score is **near** the threshold (or distance in a "gray" band), an LLM is asked "same underlying issue?" to reduce borderline mistakes.

### 10.1 Step 3.5: `isGrayZone`

Trigger **any** of:

- |score − threshold| ≤ 0.05.
- Different category and |score − threshold| ≤ 0.08.
- Distance in [SIMILARITY_GRAYZONE_LOW, SIMILARITY_GRAYZONE_HIGH] (default [0.17, 0.30]) **and** |score − threshold| ≤ 0.10.

So: **close to threshold** or **distance in middle range + close to threshold** → LLM check. Different category widens the "close" band (0.08 vs 0.05).

### 10.2 Step 3.6: `isCCRGrayZone`

Trigger **either**:

- score ≥ threshold − 0.08 and score < threshold (just below threshold), **or**
- distance in [0.25, 0.55] and overlapCount ≥ 1.

So CCR uses a **fixed 0.08 band** below threshold and/or **distance band + at least one overlap** to trigger the LLM.

### 10.3 LLM Decision

- **Step 3.5:** `checkLLMMerge` — same-channel merge; prompt stresses "same underlying issue, not same broad topic".
- **Step 3.6:** `checkCCRLLMMerge` — cross-channel; prompt stresses "more conservative", "clearly same issue across channels".

Merge only if LLM returns e.g. `should_merge === true` and **confidence ≥ 0.7**. So the LLM acts as a **tie-breaker** in ambiguous score/distance bands.

---

## 11. Decision Rules (How Score + Guardrails Are Used)

**Step 3.5 (recent channel):**

1. Guardrails: if block (including irrelevant filler in thread) → do not merge.
2. Topic guard: if distance > 0.45 and overlap === 0 → do not merge.
3. If score ≥ RECENT_CHANNEL_SCORE_THRESHOLD (0.65):
   - **If irrelevant:** merge only as context-only when score ≥ THREAD_CONTEXT_ONLY_MIN_SCORE **and** (overlapCount ≥ 1 **or** status-update **or** distance ≤ 0.30); otherwise **drop** (do not attach).
   - **If relevant:** merge (normal or context-only per options).
   - 3a. Redundancy check: if redundant → store as `is_redundant=true`, skip summary refresh, hide in UI. Otherwise proceed normally.
4. Else if gray-zone → LLM; if LLM says merge and confidence ≥ 0.7 → merge.
5. Else → no merge (continue to 3.6 / 4).

**Step 3.6 (CCR):**

1. For each candidate (including thread candidate when applicable): CCR guardrails; if block → skip candidate.
2. Sort by score; take best. Log top 5 with sameThread flag.
3. If score ≥ SCORE_THRESHOLD (0.75) **or** (overlapCount ≥ 2 and distance ≤ 0.45 and score ≥ 0.65):
   - **If relevant:** merge. (CCR merge path does **not** currently apply irrelevant/context-only rules or redundancy detection; message is stored with `upsertMessage` only.)
4. Else if CCR gray-zone → CCR LLM; if merge and confidence ≥ 0.7 → merge.
5. Else → no merge (Step 4).

So:

- **3.5:** One candidate (recent ticket in channel); threshold 0.65; topic guard and guardrails can still block.
- **3.6:** Many candidates; threshold 0.75 (or alternative rule for high overlap + moderate distance); CCR guardrails filter candidates; best candidate must pass threshold or LLM.

**Step 4 (create):**

- After creating ticket and inserting first message, redundancy check is skipped (no prior messages to compare).

---

## 12. Design Summary and Tradeoffs

**Design choices:**

- **In-thread = scored, not auto-attach:** Thread replies get a sameThread bonus but must pass score + guardrails; relevance and evidence dominate. Filler in thread can be blocked.
- **Summary embedding:** Matching prefers `summary_embedding` (title + category + summary + signals) over initial-message `embedding` for better cross-conversation matching.
- **Semantic weight ~55–60%:** Embedding is primary but not sole signal.
- **Structure (channel, recency, overlap, category, sameThread):** Prevents over-reliance on embeddings.
- **Two thresholds:** Stricter for cross-channel (0.75) than same-channel recent (0.65).
- **Category as soft signal:** Penalty for incompatible; guardrails (including **filler block** for irrelevant thread messages) add hard blocks when evidence is weak.
- **Topic guard (3.5):** Stops "same channel + recent but different topic" (high distance, zero overlap).
- **Rare tokens (CCR):** Require overlap, strong semantics, or shared specific terms for cross-channel merge.
- **Gray-zone LLM:** Tie-breaker near threshold; stricter prompt for cross-channel.

**Tradeoffs:**

- **Tunable:** Thresholds and weights are env-driven: SCORE_THRESHOLD, RECENT_CHANNEL_SCORE_THRESHOLD, SAME_THREAD_BONUS, THREAD_IRRELEVANT_BLOCK, THREAD_CONTEXT_ONLY_MIN_SCORE, REDUNDANT_DISTANCE_THRESHOLD, REDUNDANT_LOOKBACK, gray-zone bands (SIMILARITY_GRAYZONE_LOW, SIMILARITY_GRAYZONE_HIGH), RECENT_WINDOW_MINUTES, CROSS_CHANNEL_DAYS (default 14), MATCH_TOPK_TICKETS (default 15), MATCH_TOPK_MESSAGES (default 25). Raising thresholds → fewer merges.
- **Overlap + normalization:** Signal overlap uses normalized synonyms; CCR overlap has large impact (+0.20 for 2+). Noisy signals can increase merges/splits.
- **Rare-token set:** Fixed list; add domain terms if needed for CCR.
- **Recency:** 10 min (3.5) vs 24 h (3.6) in CCR is intentional.
- **Redundancy:** Post-merge optimization; does not affect scoring or merge decisions. Redundant messages preserved for audit but hidden by default.

Overall, the system is **multi-factor, threshold-based** with **evidence-based guardrails** (including **irrelevant filler block** for thread messages) and **LLM gray-zone** checks so merges stay aligned with "same underlying issue."
