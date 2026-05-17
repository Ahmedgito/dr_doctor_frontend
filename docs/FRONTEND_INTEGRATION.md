# DrDoctor — Frontend Integration Guide

> Give this document to your frontend LLM. It contains every detail needed to wire up the UI to the backend with zero guesswork.

**Live API docs:** `http://localhost:8000/docs` (Swagger UI) · `http://localhost:8000/redoc`

---

## 1. Base URL

| Environment | Base URL |
|-------------|----------|
| Local dev   | `http://localhost:8000` |
| Production  | _(set when deployed)_ |

All endpoints are prefixed with `/api`. CORS is fully open (`*`) — no proxy needed in development.

---

## 2. Endpoints

### 2.1 `POST /api/chat` — AI Symptom Chat (SSE Stream)

This is the primary endpoint. It returns a **Server-Sent Events** stream, not a regular JSON response.

#### Request

```http
POST /api/chat
Content-Type: application/json
```

```jsonc
{
  "message": "I have been having chest tightness and palpitations for a week",

  // Optional — omit on first message, pass on follow-ups
  "conversation_id": "3af5dd3e-d1c4-4a8d-aa4f-f315500f133f",

  // All filters are optional
  "filters": {
    "user_lat": 24.8607,      // user GPS for proximity ranking
    "user_lng": 67.0011,
    "max_fee": 1500,          // PKR ceiling — doctors with no fee data are excluded
    "min_satisfaction": 85    // 0–100 — doctors with no data excluded
  },

  // Advanced — defaults are fine for most UIs
  "top_k_retrieval": 20,   // candidates fetched from vector store
  "top_n_response": 5      // top doctors shown to the user
}
```

#### SSE Event Stream Format

Every line from the response is:
```
data: <JSON payload>\n\n
```

**Three event types, always in this order:**

##### 1. `text` events (0..N)
One per sentence chunk from the LLM. Accumulate and display progressively.

```json
{ "type": "text", "content": "I understand how concerning chest tightness can be." }
```

##### 2. `metadata` event (exactly 1, always last before `[DONE]`)
Contains the full structured result. Use this to render doctor cards.

```jsonc
{
  "type": "metadata",
  "conversation_id": "3af5dd3e-d1c4-4a8d-aa4f-f315500f133f",  // save for multi-turn
  "emergency": false,
  "safe_to_proceed": true,
  "urgency": "moderate",          // "low" | "moderate" | "high" | "emergency"
  "symptoms_extracted": ["chest tightness", "palpitations"],
  "specialties_targeted": ["Cardiologist", "General Physician"],
  "user_facing_note": "I understand how worrying these symptoms can be...",
  "doctors_shown": [
    {
      "doctor_id": "uuid",
      "name": "Dr. Ali Ammar",
      "specialty": "Cardiologist",
      "hospital_name": "National Institute Of Cardiovascular Diseases (NICVD), Karachi",
      "hospital_address": "Rafique Shaheed Rd, Bizerta Lines, Cantt, Karachi",
      "city": "Karachi",
      "fee_online": null,
      "fee_walk_in": 1500,
      "satisfaction_pct": 96,   // null if no data
      "reviews_count": 77,      // null if no data
      "distance_km": null,       // null if user location not provided
      "profile_url": "https://www.marham.pk/doctors/...",
      "scores": {
        "semantic": 0.617,    // vector similarity to the user's query
        "proximity": 0.5,     // 0.5 = neutral (no GPS provided)
        "rating": 0.95,
        "fee": 0.7,
        "total": 0.714        // weighted composite score
      }
    }
    // ... up to top_n_response doctors
  ]
}
```

##### 3. Stream terminator
```
data: [DONE]
```

##### Error event (replaces text+metadata when something goes wrong)
```json
{ "type": "error", "code": 503, "message": "Service temporarily unavailable." }
```
Followed immediately by `data: [DONE]`.

---

### 2.2 `GET /api/doctors/search` — Browse Doctors

A standard REST endpoint for browsing without the AI pipeline. Useful for a "Browse Doctors" page.

#### Request

```http
GET /api/doctors/search?specialty=Cardiologist&max_fee=1500&min_satisfaction=85&page=1&limit=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `specialty` | string | Case-insensitive exact match, e.g. `Cardiologist`, `Dermatologist` |
| `city` | string | Case-insensitive, e.g. `Karachi` |
| `max_fee` | int | Max consultation fee in PKR |
| `min_satisfaction` | int | Min satisfaction % (0–100) |
| `lat` | float | User latitude — requires `lng` + `radius_km` |
| `lng` | float | User longitude |
| `radius_km` | float | Search radius in km from lat/lng |
| `page` | int | Page number, 1-indexed (default: 1) |
| `limit` | int | Results per page, max 100 (default: 20) |

#### Response

```jsonc
{
  "page": 1,
  "limit": 20,
  "total": 239,
  "pages": 12,
  "doctors": [
    {
      "doctor_id": "uuid",
      "name": "Dr. Ali Ammar",
      "specialty": "Cardiologist",
      "qualifications": ["MBBS", "FCPS (Cardiology)", "Fellowship in Interventional Cardiology"],
      "satisfaction_pct": 96,
      "reviews_count": 77,
      "profile_url": "https://www.marham.pk/doctors/...",
      "hospital_name": "National Institute Of Cardiovascular Diseases (NICVD), Karachi",
      "hospital_address": "Rafique Shaheed Rd, Bizerta Lines, Cantt, Karachi",
      "city": "Karachi",
      "fee_walk_in": 1500,
      "fee_online": null
    }
  ]
}
```

---

### 2.3 `GET /health` — Liveness Probe

```http
GET /health
→ 200 { "status": "ok" }
```

---

## 3. SSE Integration — Code Examples

### JavaScript / TypeScript (Fetch + ReadableStream)

This is the recommended approach — works in all modern browsers without a library.

```typescript
interface TextEvent {
  type: "text";
  content: string;
}

interface Doctor {
  doctor_id: string;
  name: string;
  specialty: string | null;
  hospital_name: string;
  hospital_address: string;
  city: string | null;
  fee_walk_in: number | null;
  fee_online: number | null;
  satisfaction_pct: number | null;
  reviews_count: number | null;
  distance_km: number | null;
  profile_url: string;
  scores: { semantic: number; proximity: number; rating: number; fee: number; total: number };
}

interface MetadataEvent {
  type: "metadata";
  conversation_id: string;
  emergency: boolean;
  safe_to_proceed: boolean;
  urgency: "low" | "moderate" | "high" | "emergency";
  symptoms_extracted: string[];
  specialties_targeted: string[];
  user_facing_note: string;
  doctors_shown: Doctor[];
}

interface ErrorEvent {
  type: "error";
  code: number;
  message: string;
}

type ChatEvent = TextEvent | MetadataEvent | ErrorEvent;

async function streamChat(
  message: string,
  conversationId: string | null,
  filters: {
    user_lat?: number;
    user_lng?: number;
    max_fee?: number;
    min_satisfaction?: number;
  } = {},
  callbacks: {
    onText: (chunk: string) => void;
    onMetadata: (meta: MetadataEvent) => void;
    onError: (err: ErrorEvent) => void;
    onDone: () => void;
  }
): Promise<void> {
  const response = await fetch("http://localhost:8000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      filters,
    }),
  });

  if (!response.ok || !response.body) {
    callbacks.onError({ type: "error", code: response.status, message: "Network error" });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();

      if (raw === "[DONE]") {
        callbacks.onDone();
        return;
      }

      try {
        const event = JSON.parse(raw) as ChatEvent;
        if (event.type === "text") callbacks.onText(event.content);
        else if (event.type === "metadata") callbacks.onMetadata(event);
        else if (event.type === "error") callbacks.onError(event);
      } catch {
        // malformed line — ignore
      }
    }
  }
}
```

#### Usage example

```typescript
let conversationId: string | null = null;
let fullText = "";

await streamChat(
  "I have chest tightness and palpitations",
  conversationId,
  { max_fee: 2000 },
  {
    onText: (chunk) => {
      fullText += chunk;
      setChatText(fullText); // update UI progressively
    },
    onMetadata: (meta) => {
      conversationId = meta.conversation_id; // save for next turn
      setDoctors(meta.doctors_shown);
      setUrgency(meta.urgency);
      if (meta.emergency) showEmergencyBanner();
    },
    onError: (err) => showError(err.message),
    onDone: () => setLoading(false),
  }
);
```

### React hook

```typescript
import { useState, useCallback, useRef } from "react";

export function useChat() {
  const [text, setText] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const conversationId = useRef<string | null>(null);

  const send = useCallback(async (message: string, filters = {}) => {
    setLoading(true);
    setText("");
    setDoctors([]);
    setEmergency(false);

    await streamChat(message, conversationId.current, filters, {
      onText: (chunk) => setText((prev) => prev + chunk),
      onMetadata: (meta) => {
        conversationId.current = meta.conversation_id;
        setDoctors(meta.doctors_shown);
        setEmergency(meta.emergency);
      },
      onError: (err) => console.error(err.message),
      onDone: () => setLoading(false),
    });
  }, []);

  return { text, doctors, loading, emergency, send };
}
```

---

## 4. Conversation Flow (Multi-turn)

```
Turn 1:  POST /api/chat  { message: "I have headaches and fever" }
         → metadata.conversation_id = "abc-123"

Turn 2:  POST /api/chat  { message: "Show me cheaper options",
                           conversation_id: "abc-123",
                           filters: { max_fee: 800 } }
         → LLM receives full turn-1 history + turn-2 message
         → metadata.conversation_id = "abc-123"  (same)

Turn 3:  POST /api/chat  { message: "I prefer a female doctor",
                           conversation_id: "abc-123" }
```

- The backend stores up to **12 turns** (configurable) per conversation.
- History is cached in Redis (1-hour TTL) and persisted in Postgres.
- A new `conversation_id` is auto-created when the field is omitted.

---

## 5. Emergency Handling

When `emergency: true` in the metadata event:

- `doctors_shown` is always `[]`
- `urgency` is always `"emergency"`
- The text stream contains the emergency message with Pakistan hotline **115**
- **Show a prominent alert/banner** — do not just render it as a normal chat bubble

```typescript
if (meta.emergency) {
  // Show red alert banner with 115 hotline
  // Do NOT render doctor cards
}
```

---

## 6. Urgency Badges

Map `urgency` to a UI indicator:

| Value | Colour | Label |
|-------|--------|-------|
| `"low"` | Green | Routine |
| `"moderate"` | Yellow | See doctor soon |
| `"high"` | Orange | See doctor today |
| `"emergency"` | Red | Emergency — call 115 |

---

## 7. Doctor Card Data

All `fee_*`, `satisfaction_pct`, `reviews_count`, and `distance_km` can be `null` (~70% of dataset has no fee/rating data). Always guard:

```typescript
const fee = doctor.fee_online ?? doctor.fee_walk_in;
const feeLabel = fee != null ? `Rs. ${fee.toLocaleString()}` : "Fee not listed";

const rating = doctor.satisfaction_pct != null
  ? `${doctor.satisfaction_pct}% (${doctor.reviews_count} reviews)`
  : "Rating not available";

const distance = doctor.distance_km != null
  ? `${doctor.distance_km.toFixed(1)} km away`
  : null;
```

---

## 8. Error Handling

| Scenario | What happens |
|----------|-------------|
| Empty message | `{"type":"error","code":400,"message":"Message is empty after sanitisation."}` |
| Backend down | `{"type":"error","code":503,"message":"Service temporarily unavailable."}` |
| Network failure | `response.ok` is false — handle before reading stream |
| Rate limit (Phase 4) | HTTP 429 before stream starts |

Always check `response.ok` before attaching the stream reader:

```typescript
if (!response.ok) {
  const body = await response.json().catch(() => ({}));
  showError(body.detail ?? "Unknown error");
  return;
}
```

---

## 9. Available Specialties (for filter dropdowns)

Top specialties in the database — use for a specialty picker UI:

```
Gynecologist · Dentist · General Surgeon · Pediatrician · General Physician
Dermatologist · Cardiologist · Orthopedic Surgeon · Physiotherapist
Internal Medicine Specialist · Psychiatrist · Psychologist · ENT Specialist
Pulmonologist / Lung Specialist · Urologist · Neurologist · Nephrologist
Gastroenterologist · Ophthalmologist · Endocrinologist · Rheumatologist
```

---

## 10. OpenAPI / Swagger

- **Swagger UI:** `http://localhost:8000/docs` — try every endpoint interactively
- **ReDoc:** `http://localhost:8000/redoc` — clean reference documentation
- **OpenAPI JSON:** `http://localhost:8000/openapi.json` — import into Postman or generate a TypeScript client

### Generate TypeScript client (optional)

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```

---

## 11. Checklist for Frontend LLM

- [ ] `POST /api/chat` uses `fetch` with streaming body reader (not `EventSource` — that doesn't support POST)
- [ ] SSE buffer splits on `\n\n`, strips `data: ` prefix
- [ ] `conversation_id` saved from `metadata` event and sent on every subsequent request
- [ ] `doctors_shown` rendered only when `emergency === false`
- [ ] Emergency banner shown when `emergency === true`
- [ ] All nullable fields (`fee_*`, `satisfaction_pct`, `distance_km`) have fallback labels
- [ ] Stream considered complete when `[DONE]` is received
- [ ] `loading` state cleared in `onDone` and `onError`
