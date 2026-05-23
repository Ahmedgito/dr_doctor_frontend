# Dr.Doctor Frontend — Modules & Components

> **Audience:** Backend LLMs who need file-level detail on exactly what each frontend module does, what data it consumes, and how it renders backend responses.

For system-level overview, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Bootstrap — `index.tsx`

**Role:** Entry point. Mounts React and registers the service worker in production.

```typescript
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

- Throws if `#root` is missing from `index.html`
- Service worker (`/sw.js`) registered only when `import.meta.env.PROD`
- No routing, no global providers, no API initialization

**HTML shell (`index.html`):** Tailwind CDN config, dark mode class strategy, glass/scrollbar CSS, Plus Jakarta Sans font, full-height layout with `#root`.

---

## 2. Types — `types.ts`

Shared TypeScript interfaces used across the app.

### `Coordinates`

```typescript
{ latitude: number; longitude: number }
```

Stored in App from geolocation. Sent as `filters.user_lat` / `filters.user_lng`.

### `Sender` enum

| Value | UI |
|-------|-----|
| `User` | Right-aligned purple bubble |
| `Bot` | Left-aligned bubble; doctors, urgency, emergency |
| `System` | Centered pill — supported but not used by App today |

### `Doctor`

Mirrors backend `metadata.doctors_shown[]` items.

| Field | Displayed in UI |
|-------|-----------------|
| `name`, `specialty`, `hospital_name` | Yes |
| `fee_online` / `fee_walk_in` | Yes — prefers online, fallback walk-in |
| `satisfaction_pct`, `reviews_count` | Yes |
| `distance_km` | Yes, if not null |
| `profile_url` | Yes — "View Profile" link |
| `hospital_address`, `city`, `scores.*` | No |

### `UrgencyLevel`

`'low' | 'moderate' | 'high' | 'emergency'`

| Value | Badge label | Color |
|-------|-------------|-------|
| `low` | Routine | Green |
| `moderate` | See doctor soon | Yellow |
| `high` | See doctor today | Orange |
| `emergency` | Emergency — call 115 | Red (badge hidden; banner shown) |

### `Message`

Central chat unit. Each row in the message list.

```typescript
interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  isTyping?: boolean;
  groundingMaps?: GroundingMap[];  // legacy, unused
  doctors?: Doctor[];
  urgency?: UrgencyLevel;
  emergency?: boolean;
}
```

| Field | Set by | Source |
|-------|--------|--------|
| `text` | App / SSE | Accumulated `text` events |
| `doctors` | `onMetadata` | `metadata.doctors_shown` |
| `urgency` | `onMetadata` | `metadata.urgency` |
| `emergency` | `onMetadata` | `metadata.emergency` |
| `isTyping` | App | Placeholder before first text chunk |

### `GroundingMap` / `ChatState`

- `GroundingMap` — legacy map data for HospitalCard; not populated by current API
- `ChatState` — defined but unused; App uses inline state instead

### Nullable field handling

```typescript
const fee = doctor.fee_online ?? doctor.fee_walk_in;
const feeLabel = fee != null ? `Rs. ${fee.toLocaleString()}` : 'Fee not listed';
// satisfaction_pct, reviews_count, distance_km — hidden when null
```

---

## 3. Service — `services/chatApi.ts`

**Sole API integration layer.** All backend communication via `streamChat()`.

### Config

```typescript
const API_BASE = 'http://localhost:8000';  // hardcoded, no env override
```

### `streamChat(message, conversationId, filters, callbacks)`

**Request:**

```
POST http://localhost:8000/api/chat
Content-Type: application/json

{ "message": "...", "conversation_id": "...", "filters": { ... } }
```

`conversation_id` omitted when null. `filters` always present (may be `{}`).

### SSE parsing

- Uses `fetch` + `ReadableStream` (not `EventSource` — POST required)
- Splits buffer on `\n`, strips `\r`, processes `data: ` lines
- Malformed JSON silently skipped

| Event | Callback |
|-------|----------|
| `{ type: "text", content }` | `onText(content)` |
| `{ type: "metadata", ... }` | `onMetadata(event)` |
| `{ type: "error", code, message }` | `onError({ code, message })` |
| `[DONE]` | `onDone()` |

### Error handling

| Scenario | Result |
|----------|--------|
| Network failure | `onError({ code: 0, message: "Can't reach the server..." })` |
| HTTP error | `onError` with `body.detail` or `'Server error.'` |
| Stream interrupted | `onError({ code: 0, message: 'Stream interrupted...' })` |

`onDone()` always called exactly once.

### Metadata fields consumed vs ignored

| Field | Used |
|-------|------|
| `conversation_id`, `doctors_shown`, `urgency`, `emergency` | Yes |
| `symptoms_extracted`, `specialties_targeted`, `safe_to_proceed`, `user_facing_note` | No |

### Not implemented

Retry, AbortController, timeout, auth headers, `GET /api/doctors/search`, `GET /health`.

---

## 4. Component — `App.tsx`

**Root container.** Owns all state, orchestrates chat, layout, filters, geolocation, theme.

### Initial state

Hardcoded welcome bot message (`INITIAL_MESSAGE`). Not fetched from backend.

### Message send flow

```
1. Guard: empty input or isProcessing → return
2. Append user Message, create bot placeholder (isTyping: true)
3. Build ChatFilters from activeFilters + location
4. streamChat(userText, conversationId, filters, callbacks)
5. onText: accumulate into bot message, clear isTyping
6. onMetadata: save conversationId, attach doctors/urgency/emergency
7. onError: set bot message text to error message
8. onDone: isProcessing = false
```

Enter sends; Shift+Enter newline.

### Filter chips

| Label | id | Backend effect |
|-------|----|----------------|
| Best Price | `price` | `max_fee: 1500` |
| Nearest | `nearest` | `user_lat`/`user_lng` if geolocation granted |
| Top Rated | `experienced` | `min_satisfaction: 80` |

Multi-select toggles. Additive.

### Layout sections

| Section | Behavior |
|---------|----------|
| Mobile drawer | Slide-over sidebar, hamburger menu |
| Desktop sidebar | Logo, theme toggle, HIPAA badge, placeholder history |
| Chat area | Scrollable messages, filter chips, textarea + send |
| Mobile header | Menu, logo, theme, location re-request |

### Non-functional UI (not wired)

- Mic button (desktop) — no handler
- Recent History sidebar — placeholder text only

### Send button states

| Condition | State |
|-----------|-------|
| Empty or processing | Disabled, gray |
| Has text | Teal gradient |
| Processing | Spinning Sparkles icon |

---

## 5. Component — `MessageBubble.tsx`

**Renders one chat message.** Pure presentation — no state, no API calls.

### Props

```typescript
{ message: Message }
```

### Sender-based rendering

**System:** Centered gray pill (unused by App today).

**User:** Right-aligned, purple gradient bubble, User avatar, markdown text, timestamp.

**Bot:** Left-aligned, white/slate bubble, Sparkles avatar, markdown text, optional urgency/emergency/doctors below.

### Typing indicator

When `message.isTyping === true`: three bouncing teal dots. Cleared on first `onText` chunk.

### Markdown

`react-markdown` with custom styling for `p`, `ul`, `ol`, `li`, `strong`, `a`. Backend `**bold**` renders correctly.

### Urgency badge

**Condition:** Bot + `urgency` exists + `emergency === false`

Colored pill below bubble. Labels: Routine / See doctor soon / See doctor today.

### Emergency banner

**Condition:** Bot + `emergency === true`

Red alert with AlertTriangle icon, emergency text, and `tel:115` button.

When active: urgency badge hidden, doctor cards suppressed.

### Doctor cards

**Condition:** `!isUser && !emergency && doctors?.length > 0`

Horizontal scroll of `DoctorCard` components. Key: `doctor.doctor_id`.

### Hospital cards (legacy)

**Condition:** `groundingMaps?.length > 0 && !doctors`

Renders `HospitalCard`. Inactive — current API sends `doctors_shown`, not grounding maps.

### Timestamp

`HH:MM` via `toLocaleTimeString`.

---

## 6. Component — `DoctorCard.tsx`

**Single doctor recommendation card** from `metadata.doctors_shown`.

### Props

```typescript
{ doctor: Doctor; index: number }  // index = stagger animation delay
```

### Displayed content

```
┌─────────────────────────┐
│ Dr. Ali Ammar           │  name (bold)
│ Cardiologist            │  specialty (teal, hidden if null)
│ 📍 NICVD, Karachi       │  hospital_name
│ $ Rs. 1,500  ★ 96% (77) │  fee, rating, reviews
│   🧭 2.4 km             │  distance (optional)
│ [ View Profile ↗ ]      │  profile_url → new tab
└─────────────────────────┘
```

- Fee: `fee_online ?? fee_walk_in`, fallback `"Fee not listed"`
- Distance: `"X.X km"` only when `distance_km != null`
- Card width 240px, horizontal scroll in parent
- No booking or in-app navigation

---

## 7. Component — `HospitalCard.tsx`

**Legacy map/place card.** Inactive in current flow.

### Props

```typescript
{ mapData: GroundingMap; index: number }
```

### Status

- App never sets `message.groundingMaps`
- Current API returns `doctors_shown`, not map grounding
- Only renders when `groundingMaps` exists and `doctors` is absent

### Displayed content

- `title` — hospital/place name
- `address` — or fallback `"Medical Facility • Open Now"`
- Hardcoded `4.8` star rating (not from backend)
- "Navigate" button → `mapData.uri` in new tab

Kept for backward compatibility only.

---

## 8. Backend Integration Cheat Sheet

| User action | Backend effect |
|-------------|----------------|
| Send message | `POST /api/chat` with message + optional conversation_id + filters |
| Toggle Best Price | Adds `max_fee: 1500` on next send |
| Toggle Nearest | Adds lat/lng if geolocation granted |
| Toggle Top Rated | Adds `min_satisfaction: 80` on next send |
| Follow-up message | Same `conversation_id` from previous metadata |
| Grant location | Enables Nearest filter to send coordinates |
| Theme / sidebar | UI only — no backend |

| Backend sends | Frontend renders |
|---------------|------------------|
| `text` chunks | Markdown in bot bubble (streaming) |
| `metadata.doctors_shown` | DoctorCard row (if not emergency) |
| `metadata.urgency` | Colored badge (if not emergency) |
| `metadata.emergency: true` | Red banner + tel:115, no doctors |
| `metadata.conversation_id` | Saved for next turn |
| `error` event | Error text in bot bubble |

---

## 9. Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture and data flow
- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) — Full backend API schemas and SSE format
