# ChatGPT-Style Interface — Frontend Integration Guide

> Give this doc to your frontend LLM. It has the complete picture needed to
> build a ChatGPT-like sidebar + chat experience backed by this backend.
>
> Read alongside `FRONTEND_AUTH_INTEGRATION.md` for token delivery details.

---

## 1. What this backend gives you

| Feature | How the backend supports it |
|---|---|
| New chat | `POST /api/conversations` → returns a new `id` |
| Conversation list (sidebar) | `GET /api/conversations?page=1&page_size=20` |
| Auto-title | Backend generates a 3–5 word LLM title after the first message. The title appears in `GET /api/conversations` once it's ready (usually 1–2 s after the first reply). |
| Context isolation | Each conversation has its own state machine. Passing `conversation_id` in the chat request loads only that conversation's history. |
| Rename | `PATCH /api/conversations/{id}` with `{ "title": "New name" }` |
| Archive / unarchive | `PATCH /api/conversations/{id}` with `{ "is_archived": true/false }` |
| Delete | `DELETE /api/conversations/{id}` |
| Restore a session | `GET /api/conversations/{id}` returns full message history |

---

## 2. The complete data flow

```
User clicks "New Chat"
  → POST /api/conversations  (optional — backend also creates one automatically on first message)
  → store returned id as activeConversationId

User types message, hits send
  → POST /api/chat { message, conversation_id: activeConversationId }
  → stream events:
      type:text     → append to chat bubble (streaming effect)
      type:metadata → save conversation_id (may be NEW if none was passed)
                      gate doctor cards on phase === "recommendation"
      [DONE]        → mark loading=false

Backend fires a task after the first message
  → LLM generates a 3-5 word title
  → Saved to conversations.title in DB (async, ~1-2s delay)

User clicks refresh / polls sidebar
  → GET /api/conversations → conversations[0].title is now set
  → Update sidebar item
```

---

## 3. State you need in the app

```ts
interface AppState {
  // Sidebar
  conversations: ConversationSummary[];  // from GET /api/conversations
  sidebarPage: number;
  sidebarHasMore: boolean;

  // Active chat window
  activeConversationId: string | null;
  messages: ChatMessage[];
  streamingText: string;        // text being streamed right now
  isLoading: boolean;
  lastMetadata: ChatMetadata | null;
}

interface ChatMessage {
  id: string;                   // local uuid for React key
  role: "user" | "assistant";
  content: string;
  metadata?: ChatMetadata;       // only on assistant messages at the recommendation turn
  createdAt: Date;
}
```

---

## 4. Building the sidebar

### 4.1 Load conversations on sign-in

```ts
async function loadSidebar(page = 1) {
  const { conversations, total, page_size } = await listConversations(page, 20);
  setConversations(prev => page === 1 ? conversations : [...prev, ...conversations]);
  setSidebarHasMore(page * page_size < total);
}

// Call on mount and whenever the user signs in:
useEffect(() => {
  if (isSignedIn) loadSidebar(1);
  else setConversations([]);
}, [isSignedIn]);
```

### 4.2 Sidebar item component

```tsx
function ConversationItem({ conv, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={isActive ? "sidebar-item active" : "sidebar-item"}
    >
      <span className="title">
        {conv.title ?? "New conversation"}
      </span>
      <span className="date">
        {formatRelative(new Date(conv.last_active_at))}
      </span>
    </button>
  );
}
```

- Show `"New conversation"` when `title` is `null` — the backend will fill it in shortly.
- Sort by `last_active_at DESC` — the API already does this, maintain the order.
- Highlight the `activeConversationId`.

### 4.3 New chat button

```ts
async function handleNewChat() {
  // Option A: create the conversation up-front (get a guaranteed id)
  const conv = await createConversation();          // POST /api/conversations
  setActiveConversationId(conv.id);
  setMessages([]);
  setConversations(prev => [conv, ...prev]);         // prepend to sidebar

  // Option B (simpler): don't pre-create — just clear the window.
  // The backend creates a new conversation on the first message and returns
  // the id in the metadata event. Update the sidebar after that.
  setActiveConversationId(null);
  setMessages([]);
}
```

Use **Option A** if you want the sidebar item to appear immediately (before the user sends the first message). Use **Option B** for simplicity.

### 4.4 Refreshing the title after the first message

The backend sets the title ~1-2 s after the first turn completes (LLM call in background). Poll or refresh the sidebar once after the first response:

```ts
async function handleFirstTurnComplete(conversationId: string) {
  // Wait a couple of seconds then refresh just this one conversation's title.
  await new Promise(r => setTimeout(r, 2500));
  const { conversations } = await listConversations(1, 20);
  setConversations(conversations);  // re-renders sidebar with real title
}
```

Or, simpler: just reload the whole sidebar after every completed turn. The list is paginated and fast.

---

## 5. Switching between conversations

When the user clicks a sidebar item:

```ts
async function switchToConversation(conv: ConversationSummary) {
  setActiveConversationId(conv.id);
  setMessages([]);
  setIsLoading(true);

  try {
    const detail = await getConversation(conv.id);  // GET /api/conversations/{id}
    if (!detail) { setIsLoading(false); return; }

    // Reconstruct the message list from history
    const msgs: ChatMessage[] = detail.messages.map(m => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(m.created_at),
    }));
    setMessages(msgs);
  } finally {
    setIsLoading(false);
  }
}
```

**Important:** After switching, pass `activeConversationId` as `conversation_id` on the NEXT message. The backend will load that conversation's state machine state (from Redis or DB) and continue from exactly where it left off — symptoms accumulated, current phase, etc.

---

## 6. Sending a message (full implementation)

```ts
async function sendMessage(text: string) {
  if (!text.trim() || isLoading) return;

  // Add user message immediately (optimistic)
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    createdAt: new Date(),
  };
  setMessages(prev => [...prev, userMsg]);
  setStreamingText("");
  setIsLoading(true);
  const isFirst = messages.length === 0;  // first message in this chat

  // Placeholder assistant bubble (shows while streaming)
  const assistantId = crypto.randomUUID();
  setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", createdAt: new Date() }]);

  try {
    for await (const event of streamChat(text, activeConversationId)) {
      if (event.type === "text") {
        // Update the placeholder bubble in-place
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + event.content } : m
        ));
      } else if (event.type === "metadata") {
        // Lock in conversation_id (may be new if we didn't pre-create)
        setActiveConversationId(event.conversation_id);

        // Attach metadata to the assistant message
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, metadata: event as ChatMetadata } : m
        ));

        // Refresh sidebar to pick up updated last_active_at
        loadSidebar(1);

        // On first turn, poll once more to pick up the LLM-generated title
        if (isFirst) handleFirstTurnComplete(event.conversation_id);
      } else if (event.type === "error") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${event.message}` } : m
        ));
      }
    }
  } finally {
    setIsLoading(false);
  }
}
```

---

## 7. Rendering the chat window

```tsx
function ChatWindow({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="chat-window">
      {messages.map(msg => (
        <div key={msg.id} className={`bubble ${msg.role}`}>
          <p>{msg.content}</p>

          {/* Doctor cards — only on recommendation turns */}
          {msg.metadata?.phase === "recommendation" &&
            msg.metadata.doctors_shown.length > 0 && (
            <DoctorCardList doctors={msg.metadata.doctors_shown} />
          )}

          {/* Urgency badge */}
          {msg.metadata?.phase === "recommendation" && (
            <UrgencyBadge level={msg.metadata.urgency} />
          )}

          {/* Emergency banner */}
          {msg.metadata?.phase === "emergency" && (
            <EmergencyBanner hotline="115" />
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 8. Rename, archive, delete from sidebar

### Rename (on double-click or edit icon)

```ts
async function renameConversation(id: string, newTitle: string) {
  const updated = await apiRenameConversation(id, newTitle);
  setConversations(prev => prev.map(c => c.id === id ? { ...c, title: updated.title } : c));
}
```

### Archive (context menu)

```ts
async function archiveConversation(id: string) {
  await apiArchiveConversation(id, true);
  setConversations(prev => prev.filter(c => c.id !== id));
  if (activeConversationId === id) handleNewChat();
}
```

### Delete (with confirm dialog)

```ts
async function deleteConversation(id: string) {
  const confirmed = await showConfirmDialog("Delete this conversation?");
  if (!confirmed) return;
  await apiDeleteConversation(id);
  setConversations(prev => prev.filter(c => c.id !== id));
  if (activeConversationId === id) handleNewChat();
}
```

---

## 9. Context isolation — how it works

Each conversation is fully isolated:

- **State machine**: `conv:{id}:state` in Redis, backed by `conversations.conv_state` in Postgres. Switching `conversation_id` loads a different state machine (GREETING vs GATHERING vs post-recommendation).
- **Message history**: Loaded from `messages` table filtered by `conversation_id`. The LLM gets the last 12 turns of that specific conversation as context.
- **No cross-contamination**: Two different `conversation_id` values never share history or state.

You do NOT need to manage context on the frontend. Just pass the right `conversation_id` and the backend handles the rest.

---

## 10. Conversation phases and what to show

| `phase` | UI |
|---|---|
| `"greeting"` | Just the assistant text. No cards, no badge. |
| `"gathering"` | Just the assistant text. Bot is collecting symptoms. |
| `"confirm"` | Assistant text + subtle "Looking for doctors?" indicator. |
| `"recommendation"` | Assistant text + `DoctorCardList` + `UrgencyBadge`. |
| `"emergency"` | Emergency message + `EmergencyBanner` (hotline 115). No cards. |

---

## 11. Checklist for the frontend LLM

- [ ] `activeConversationId` stored in a `useRef` (or state) — updated from `metadata.conversation_id` on every turn.
- [ ] Every `POST /api/chat` includes `conversation_id: activeConversationId` (null for new chats).
- [ ] Sidebar reloads after every completed turn to catch `last_active_at` sort updates.
- [ ] Title refresh: after first turn completes, wait 2.5 s then reload sidebar to show LLM title.
- [ ] `GET /api/conversations/{id}` called when user clicks a sidebar item to restore history.
- [ ] After restore, next `POST /api/chat` passes the restored conversation's id.
- [ ] "New Chat" clears `activeConversationId`, `messages`, and `streamingText`.
- [ ] Doctor cards shown only when `phase === "recommendation"`.
- [ ] On sign-out: clear conversations list, activeConversationId, messages.
- [ ] Handle `title === null` in sidebar (show `"New conversation"` placeholder).
