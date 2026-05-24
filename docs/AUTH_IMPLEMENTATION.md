# Frontend Auth Integration Guide

> Hand this document to the frontend LLM. It covers every backend contract needed
> to wire Clerk auth into the chat UI: token delivery, conversation persistence,
> session history, and error handling. Read it top-to-bottom before touching any code.

**Backend base URL:** `http://localhost:8000` (dev) — replace with prod URL via env var.  
**Auth provider:** Clerk  
**Backend auth module:** `app/core/auth.py`

---

## 1. How the backend reads the token

Every protected request must include:

```
Authorization: Bearer <clerk_session_token>
```

Get the token from Clerk's `useAuth()` hook:

```ts
import { useAuth } from "@clerk/clerk-react"; // or @clerk/nextjs

const { getToken } = useAuth();
const token = await getToken(); // returns null if signed out
```

Pass it on every API call:

```ts
async function apiRequest(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
```

**Rules:**
- If the user is signed out, omit the `Authorization` header entirely — do not send `Bearer null` or `Bearer undefined`.
- Tokens expire. Always call `getToken()` immediately before each request; Clerk refreshes automatically.
- `POST /api/chat` works **without** a token (anonymous), but conversations won't appear in the user's history list.

---

## 2. Endpoint reference

### 2.1 Chat — `POST /api/chat`

**Auth:** Optional. Anonymous users can chat; authenticated users get their conversations saved and retrievable.

**Request body:**
```json
{
  "message": "I have had a headache for 3 days",
  "conversation_id": "3af5dd3e-d1c4-4a8d-aa4f-f315500f133f",
  "filters": {
    "user_lat": 24.8607,
    "user_lng": 67.0011,
    "max_fee": 1500,
    "min_satisfaction": 85
  },
  "top_k_retrieval": 20,
  "top_n_response": 5
}
```

- `conversation_id` — omit on the first message of a new conversation. The backend creates one and returns it in the `metadata` event. Pass it on every subsequent turn.
- `filters` — all optional. Omit the whole object if not needed.

**Response:** Server-Sent Events stream. Each line is `data: <JSON>\n\n`.

Three event types:

```
data: {"type":"text","content":"I understand that ..."}

data: {"type":"metadata","conversation_id":"uuid","phase":"gathering","doctors_shown":[],"symptoms_extracted":["headache"],"specialties_targeted":[],"urgency":"low","emergency":false,"safe_to_proceed":true,"user_facing_note":""}

data: [DONE]
```

**`metadata` fields you must read:**

| Field | Type | What to do |
|---|---|---|
| `conversation_id` | `string` | Save this. Pass it on every subsequent turn in the same chat session. |
| `phase` | `"greeting" \| "gathering" \| "confirm" \| "recommendation" \| "emergency"` | Controls what UI to show (see §4). |
| `doctors_shown` | `DoctorCard[]` | Render only when `phase === "recommendation"`. Empty array otherwise. |
| `urgency` | `"low" \| "moderate" \| "high" \| "emergency"` | Show urgency badge only when `phase === "recommendation"` or `"emergency"`. |
| `emergency` | `boolean` | If true, hide doctor cards; show emergency hotline (115). |
| `symptoms_extracted` | `string[]` | Optional debug display. |

**Error event:**
```
data: {"type":"error","code":400,"message":"Message is empty after sanitisation."}
```

**Status codes:**
- `200` — stream started (errors arrive as JSON events within the stream)
- `403` — authenticated user tried to access another user's `conversation_id`
- `429` — rate limited (see §5)

---

### 2.2 List conversations — `GET /api/conversations`

**Auth:** Required (`401` if missing).

**Query params:**
| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number (1-indexed) |
| `page_size` | `20` | Max 100 |
| `include_archived` | `false` | Pass `true` to show archived |

**Response:**
```json
{
  "conversations": [
    {
      "id": "3af5dd3e-d1c4-4a8d-aa4f-f315500f133f",
      "title": "I have had a headache for 3 days",
      "is_archived": false,
      "conv_state": "GATHERING",
      "created_at": "2026-05-24T10:30:00.000000",
      "last_active_at": "2026-05-24T11:45:00.000000"
    }
  ],
  "total": 47,
  "page": 1,
  "page_size": 20
}
```

- `title` — auto-set from the first 80 characters of the first user message. `null` until the first message is sent.
- `conv_state` — internal state machine value. Use `phase` from the SSE stream for UI decisions; `conv_state` is for debugging only.

---

### 2.3 Create blank conversation — `POST /api/conversations`

**Auth:** Required.

**Request body:** None (empty POST).

**Response `201`:**
```json
{
  "id": "3af5dd3e-d1c4-4a8d-aa4f-f315500f133f",
  "title": null,
  "is_archived": false,
  "conv_state": "GREETING",
  "created_at": "2026-05-24T10:30:00.000000",
  "last_active_at": "2026-05-24T10:30:00.000000"
}
```

You can pre-create a conversation and pass its `id` as `conversation_id` in the first chat message. The backend will also create one automatically if you omit `conversation_id` on the first chat message — use whichever is simpler.

---

### 2.4 Get conversation with messages — `GET /api/conversations/{id}`

**Auth:** Required. Returns `404` if not found or not owned by the caller.

**Response:**
```json
{
  "id": "...",
  "title": "I have had a headache for 3 days",
  "is_archived": false,
  "conv_state": "GATHERING",
  "created_at": "...",
  "last_active_at": "...",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "I have had a headache for 3 days",
      "symptoms_extracted": ["headache"],
      "specialties_targeted": ["Neurologist"],
      "urgency": "low",
      "created_at": "..."
    },
    {
      "id": "...",
      "role": "assistant",
      "content": "I hear you — a headache lasting three days ...",
      "symptoms_extracted": null,
      "specialties_targeted": null,
      "urgency": null,
      "created_at": "..."
    }
  ]
}
```

Use this to restore a conversation session when the user clicks a history item.

---

### 2.5 Rename or archive — `PATCH /api/conversations/{id}`

**Auth:** Required.

**Request body (both fields optional, send only what changes):**
```json
{
  "title": "New title",
  "is_archived": true
}
```

To clear the title: `{ "title": null }`.  
To archive: `{ "is_archived": true }`.  
To unarchive: `{ "is_archived": false }`.

**Response `200`:** `ConversationSummary` (same shape as list items, without `messages`).

---

### 2.6 Delete conversation — `DELETE /api/conversations/{id}`

**Auth:** Required.

**Response:** `204 No Content`. Returns `404` if not found or not owned.

---

## 3. Full wiring example (React + TypeScript)

### 3.1 Types

```ts
export type ConversationPhase =
  | "greeting"
  | "gathering"
  | "confirm"
  | "recommendation"
  | "emergency";

export interface DoctorCard {
  doctor_id: string;
  name: string;
  specialty: string | null;
  hospital_name: string | null;
  hospital_address: string | null;
  city: string | null;
  fee_online: number | null;
  fee_walk_in: number | null;
  satisfaction_pct: number | null;
  reviews_count: number | null;
  distance_km: number | null;
  profile_url: string;
}

export interface ChatMetadata {
  conversation_id: string;
  phase: ConversationPhase;
  doctors_shown: DoctorCard[];
  symptoms_extracted: string[];
  specialties_targeted: string[];
  urgency: string;
  emergency: boolean;
  safe_to_proceed: boolean;
  user_facing_note: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  is_archived: boolean;
  conv_state: string;
  created_at: string;
  last_active_at: string;
}
```

### 3.2 API client

```ts
// lib/api.ts
import { getToken } from "./clerk"; // or however you expose getToken

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Conversations ──────────────────────────────────────────────────────────

export async function listConversations(page = 1, pageSize = 20) {
  const headers = await authHeaders();
  const res = await fetch(
    `${BASE_URL}/api/conversations?page=${page}&page_size=${pageSize}`,
    { headers }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    conversations: ConversationSummary[];
    total: number;
    page: number;
    page_size: number;
  }>;
}

export async function getConversation(id: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/api/conversations/${id}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function renameConversation(id: string, title: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/api/conversations/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ConversationSummary>;
}

export async function archiveConversation(id: string, archived = true) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/api/conversations/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ is_archived: archived }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ConversationSummary>;
}

export async function deleteConversation(id: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(await res.text());
  return true;
}

// ── Chat (SSE) ─────────────────────────────────────────────────────────────

export async function* streamChat(
  message: string,
  conversationId: string | null,
  options: {
    userLat?: number;
    userLng?: number;
    maxFee?: number;
    minSatisfaction?: number;
  } = {}
): AsyncGenerator<
  { type: "text"; content: string } |
  { type: "metadata" } & ChatMetadata |
  { type: "error"; code: number; message: string }
> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      filters: {
        user_lat: options.userLat ?? null,
        user_lng: options.userLng ?? null,
        max_fee: options.maxFee ?? null,
        min_satisfaction: options.minSatisfaction ?? null,
      },
    }),
  });

  if (!res.ok || !res.body) {
    yield { type: "error", code: res.status, message: await res.text() };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data);
      } catch {
        // malformed line — skip
      }
    }
  }
}
```

### 3.3 Chat hook

```ts
// hooks/useChat.ts
import { useState, useRef } from "react";
import { streamChat, type ChatMetadata } from "../lib/api";

export function useChat() {
  const [text, setText] = useState("");
  const [metadata, setMetadata] = useState<ChatMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  async function sendMessage(message: string) {
    setLoading(true);
    setError(null);
    setText("");
    setMetadata(null);

    try {
      for await (const event of streamChat(message, conversationIdRef.current)) {
        if (event.type === "text") {
          setText((prev) => prev + event.content);
        } else if (event.type === "metadata") {
          conversationIdRef.current = event.conversation_id;
          setMetadata(event as ChatMetadata);
        } else if (event.type === "error") {
          setError(event.message);
        }
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    conversationIdRef.current = null;
    setText("");
    setMetadata(null);
    setError(null);
  }

  return {
    text,
    metadata,
    loading,
    error,
    conversationId: conversationIdRef.current,
    sendMessage,
    reset,
  };
}
```

---

## 4. Phase-gated UI rules

The `phase` field in every `metadata` event tells you what the backend's state machine decided. Gate your UI strictly on this — do not try to infer phase from message content.

| `phase` | What to render |
|---|---|
| `"greeting"` | Just the assistant text. No doctors, no urgency badge. |
| `"gathering"` | Just the assistant text. The bot is still collecting symptoms. |
| `"confirm"` | Assistant text + disclaimer. The bot is asking "shall I find doctors?" |
| `"recommendation"` | Assistant text + doctor cards from `doctors_shown` + urgency badge. |
| `"emergency"` | Emergency message text + Pakistan emergency number (115). No doctor cards. |

```tsx
// In your MessageBubble or ChatResponse component:
{metadata?.phase === "recommendation" && metadata.doctors_shown.length > 0 && (
  <DoctorCardList doctors={metadata.doctors_shown} />
)}

{(metadata?.phase === "recommendation") && (
  <UrgencyBadge level={metadata.urgency} />
)}

{metadata?.phase === "emergency" && (
  <EmergencyBanner hotline="115" />
)}
```

---

## 5. Error handling and rate limits

### 401 Unauthorized
Clerk token missing or expired. Call `getToken()` again — Clerk refreshes silently. If it returns `null`, the user is signed out; redirect to `/sign-in`.

```ts
if (res.status === 401) {
  const fresh = await getToken({ skipCache: true });
  if (!fresh) router.push("/sign-in");
  // retry with fresh token
}
```

### 403 Forbidden
The `conversation_id` in the chat request belongs to a different user. Clear your local `conversation_id` ref and start a new conversation.

```ts
if (event.type === "error" && event.code === 403) {
  conversationIdRef.current = null;
  // optionally show a "Session expired, starting fresh" message
}
```

### 429 Too Many Requests
Response body contains `{ "detail": "...", "retry_after": <seconds> }` and header `Retry-After: <seconds>`.

- Authenticated users: 60 requests/minute.
- Anonymous users: 20 requests/minute.

```ts
if (res.status === 429) {
  const body = await res.json();
  const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
  showRateLimitBanner(`Too many requests. Try again in ${retryAfter}s.`);
}
```

---

## 6. Conversation history sidebar

Typical flow for a sidebar showing past conversations:

```ts
// On mount / when user signs in:
const { conversations, total } = await listConversations(1, 20);

// When user clicks a history item:
const conv = await getConversation(selectedId);
// conv.messages contains the full history — render them in the chat view
// Set conversationIdRef.current = selectedId so the next message continues it

// When user sends a new message in a restored session:
// streamChat(message, selectedId) — the backend loads history from DB automatically

// Rename on blur of title input:
await renameConversation(id, newTitle);

// Archive from context menu:
await archiveConversation(id, true);

// Delete with confirmation:
const deleted = await deleteConversation(id);
if (deleted) removeFromSidebar(id);
```

**Pagination:** use `total` and `page_size` to decide whether to show a "Load more" button:
```ts
const hasMore = page * pageSize < total;
```

---

## 7. Anonymous → authenticated upgrade

If a user chats anonymously and then signs in, the anonymous `conversation_id` is **not** automatically migrated to their account (it has `user_id = null` in the DB). Handle this by:

1. When the user signs in, reset `conversationIdRef.current = null`.
2. On the next message, the backend creates a new authenticated conversation.
3. Optionally show a "Your previous chat was anonymous and won't appear in history" notice.

Do not attempt to PATCH the old anonymous conversation — the CRUD endpoints reject requests where `user_id` doesn't match.

---

## 8. Checklist for the frontend LLM

- [ ] `getToken()` called immediately before every request — never cached across renders.
- [ ] `Authorization` header omitted entirely when `getToken()` returns `null`.
- [ ] `conversation_id` from `metadata.conversation_id` saved to a ref (not state) to survive re-renders without triggering loops.
- [ ] Doctor cards rendered only when `phase === "recommendation"`.
- [ ] Urgency badge rendered only when `phase === "recommendation"` or `phase === "emergency"`.
- [ ] 401 → re-fetch token → if still null, redirect to sign-in.
- [ ] 403 → clear local `conversation_id`, start fresh.
- [ ] 429 → show `retry_after` seconds from response body or `Retry-After` header.
- [ ] On sign-out: clear `conversationIdRef.current` and the conversation list.
- [ ] On sign-in: reload conversation list from `GET /api/conversations`.
