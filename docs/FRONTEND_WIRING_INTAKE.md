# Guided Intake — Frontend Wiring Guide

> **Audience:** Frontend LLM implementing the guided conversational intake feature.
> **Read first:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [FRONTEND_MODULES.md](./FRONTEND_MODULES.md)

The backend now runs a **multi-turn guided intake** before suggesting any doctors.
It greets the user, asks follow-up questions, offers to find doctors, and only
returns doctor cards after the user agrees. Every `metadata` event carries a
`phase` field that tells the frontend what kind of response this turn is.

**You must gate doctor cards and the urgency badge on `phase === 'recommendation'`.
All other wiring (SSE parsing, filters, emergency banner) is unchanged.**

---

## 1. What Changed on the Backend

| Before | After |
|--------|-------|
| Every message → retrieval → doctor cards | First turns: greeting / gathering / confirm — no doctors |
| `metadata.doctors_shown` always populated (0–5 items) | `doctors_shown: []` on non-recommendation turns |
| `metadata` had no `phase` field | `metadata.phase` now present on every event |

The `phase` field is the single new input. Everything else (SSE protocol,
`conversation_id` threading, emergency handling, filter params) is unchanged.

---

## 2. New `phase` Values

| `phase` | When it fires | `doctors_shown` | What to render |
|---------|--------------|-----------------|----------------|
| `greeting` | User says hi / opens chat | `[]` | Text only |
| `chitchat` | Small talk, off-topic | `[]` | Text only |
| `gathering` | Bot asking clarifying follow-up | `[]` | Text only |
| `confirm` | Bot has enough context, asks "want me to find doctors?" | `[]` | Text only — user replies "yes" in the normal input |
| `recommendation` | Doctor search complete | populated | Text + doctor cards + urgency badge |
| `emergency` | Emergency short-circuit | `[]` | Text + red banner (tel:115) |

A typical conversation progresses: `greeting → gathering → gathering → confirm → recommendation`.

---

## 3. Required Code Changes

### 3.1 `types.ts` — add `ConversationPhase` and `phase` to `Message`

Add the `ConversationPhase` type and the `phase` field to the `Message` interface.

```typescript
// ADD this type
export type ConversationPhase =
  | 'greeting'
  | 'chitchat'
  | 'gathering'
  | 'confirm'
  | 'recommendation'
  | 'emergency';

// UPDATE Message — add the phase field
export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  isTyping?: boolean;
  groundingMaps?: GroundingMap[];
  doctors?: Doctor[];
  urgency?: UrgencyLevel;
  emergency?: boolean;
  phase?: ConversationPhase;      // ← ADD THIS
}
```

---

### 3.2 `App.tsx` — save `phase` in `onMetadata`, gate `doctors`/`urgency` on it

In the `streamChat` callback's `onMetadata` handler, you currently unconditionally
set `doctors` and `urgency`. Change it to only set them when
`meta.phase === 'recommendation'`.

**Find this pattern in `onMetadata`:**

```typescript
onMetadata: (meta) => {
  conversationId.current = meta.conversation_id;
  setMessages(prev => prev.map(msg =>
    msg.id === botId
      ? {
          ...msg,
          doctors: meta.doctors_shown,
          urgency: meta.urgency,
          emergency: meta.emergency,
        }
      : msg
  ));
},
```

**Replace with:**

```typescript
onMetadata: (meta) => {
  conversationId.current = meta.conversation_id;   // always save — critical for multi-turn
  setMessages(prev => prev.map(msg =>
    msg.id === botId
      ? {
          ...msg,
          phase: meta.phase,                                            // always store phase
          emergency: meta.emergency,                                    // always store emergency
          doctors: meta.phase === 'recommendation' ? meta.doctors_shown : undefined,
          urgency: meta.phase === 'recommendation' ? meta.urgency : undefined,
        }
      : msg
  ));
},
```

**Key rules:**
- `conversationId` must always be saved regardless of phase — the backend uses it to look up Redis intake state on every turn.
- `doctors` and `urgency` are only meaningful (and non-empty) on `phase === 'recommendation'`.
- `emergency` is always stored so the emergency banner can fire on any turn.

---

### 3.3 `MessageBubble.tsx` — gate cards and urgency badge on `phase`

**Urgency badge** — find the condition that renders the colored pill and add the phase check:

```typescript
// BEFORE
{message.urgency && !message.emergency && (
  <UrgencyBadge urgency={message.urgency} />
)}

// AFTER
{message.urgency && !message.emergency && message.phase === 'recommendation' && (
  <UrgencyBadge urgency={message.urgency} />
)}
```

**Doctor cards** — find the condition that renders the card row and add the phase check:

```typescript
// BEFORE
{!isUser && !message.emergency && message.doctors && message.doctors.length > 0 && (
  <DoctorCardRow doctors={message.doctors} />
)}

// AFTER
{!isUser && !message.emergency && message.phase === 'recommendation'
  && message.doctors && message.doctors.length > 0 && (
  <DoctorCardRow doctors={message.doctors} />
)}
```

The explicit `phase` check is belt-and-suspenders: `doctors_shown` is always `[]`
on non-recommendation turns anyway, but the gate makes the intent unambiguous.

---

## 4. What You Must NOT Change

| File | Why |
|------|-----|
| `services/chatApi.ts` | SSE parsing is correct; it already passes `meta.phase` via `onMetadata` |
| Filter chips (Best Price / Nearest / Top Rated) | Filters are applied at retrieval time; intake routing doesn't affect them |
| Emergency banner logic | Already gated on `meta.emergency === true`; no change needed |
| `DoctorCard.tsx` / `HospitalCard.tsx` | Pure presentation; nothing changes |
| `GET /api/doctors/search` integration | Not affected |

---

## 5. Conversation Threading — Critical Detail

Always send `conversation_id` on every follow-up, including during intake phases.

```typescript
// correct — send on every turn after the first metadata event
await streamChat(
  userMessage,
  conversationId.current,   // null on first message, set thereafter
  filters,
  callbacks
);
```

The backend stores intake state (pending confirm, gathered specialties) in Redis
keyed by `conversation_id`. If you omit it on any turn, the backend creates a new
conversation and loses all gathered context, resetting the intake flow.

---

## 6. Confirm Phase — No Special UI Needed

When `phase === 'confirm'`, the bot text will say something like:

> "Based on what you've described, it sounds like you'd benefit from seeing a Cardiologist. Would you like me to find some available doctors for you?"

The user replies **"yes"** (or "no") in the **same normal chat input** — no special confirm button or modal is needed. The backend detects the affirmative reply and moves to `phase === 'recommendation'` on the next turn.

---

## 7. Minimal Change Checklist

- [ ] `types.ts`: add `ConversationPhase` type + `phase?: ConversationPhase` to `Message`
- [ ] `App.tsx` `onMetadata`: always save `conversation_id`; gate `doctors`/`urgency` on `phase === 'recommendation'`; always save `phase` and `emergency`
- [ ] `MessageBubble.tsx` urgency badge: add `&& message.phase === 'recommendation'`
- [ ] `MessageBubble.tsx` doctor cards: add `&& message.phase === 'recommendation'`
- [ ] Verify: sending "hi" produces a warm greeting with no doctor cards
- [ ] Verify: the full flow `hi → describe symptoms → answer follow-up → "yes please"` ends with doctor cards on the final turn only

---

## 8. Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — SSE data-flow diagram
- [FRONTEND_MODULES.md](./FRONTEND_MODULES.md) — full module reference with all field tables
- [FRONTEND_INTEGRATION.md](../docs/FRONTEND_INTEGRATION.md) — complete backend API schemas and SSE format
