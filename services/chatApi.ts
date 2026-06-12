import type { Doctor, UrgencyLevel } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ── Request types ─────────────────────────────────────────────────────────────

export interface ChatFilters {
  user_lat?: number;
  user_lng?: number;
  max_fee?: number;
  min_satisfaction?: number;
}

// ── SSE event types (matching backend app/api/chat.py) ────────────────────────

interface TextEvent {
  type: 'text';
  content: string;
}

export interface AgentStatusEvent {
  type: 'agent';
  name: string;
  status: string;
}

export interface MetadataEvent {
  type: 'metadata';
  conversation_id: string;
  emergency: boolean;
  urgency: UrgencyLevel;
  symptoms_extracted: string[];
  specialties_targeted: string[];
  doctors_shown: Doctor[];
  active_agent: string;
}

interface ErrorEvent {
  type: 'error';
  code: number;
  message: string;
}

// ── Callback surface ──────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onText: (chunk: string) => void;
  onMetadata: (meta: MetadataEvent) => void;
  onError: (err: { code: number; message: string }) => void;
  onDone: () => void;
  onAgentStatus?: (name: string, status: string) => void;
}

const AGENT_HINTS: Record<string, string> = {
  search: 'Finding specialists…',
  stage5: 'Finding specialists…',
};

export function agentStatusHint(name: string, status: string): string {
  if (status !== 'running') return '';
  return AGENT_HINTS[name] ?? 'Processing…';
}

// ── streamChat options ────────────────────────────────────────────────────────

export interface StreamOptions {
  getToken?: (() => Promise<string | null>) | null;
  userId?: string | null;
  signal?: AbortSignal;
}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

// ── Main streaming function ───────────────────────────────────────────────────

export async function streamChat(
  message: string,
  conversationId: string | null,
  filters: ChatFilters,
  callbacks: StreamCallbacks,
  options: StreamOptions = {},
): Promise<void> {
  const { getToken, userId, signal } = options;

  console.log('[chat] streamChat START', {
    conversationId,
    userId,
    messagePreview: message.slice(0, 60),
  });

  if (signal?.aborted) {
    console.log('[chat] already aborted before fetch');
    callbacks.onDone();
    return;
  }

  const token = getToken ? await getToken() : null;

  if (signal?.aborted) {
    console.log('[chat] aborted after token fetch');
    callbacks.onDone();
    return;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const requestBody: Record<string, unknown> = { message, filters };
  if (conversationId) requestBody['conversation_id'] = conversationId;
  if (userId) requestBody['user_id'] = userId;

  console.log('[chat] POST /api/chat body:', {
    conversation_id: requestBody['conversation_id'] ?? null,
    user_id: requestBody['user_id'] ?? null,
    filters: requestBody['filters'],
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      console.log('[chat] fetch aborted by user');
      callbacks.onDone();
      return;
    }
    console.error('[chat] fetch network error:', err);
    callbacks.onError({ code: 0, message: "Can't reach the server. Please check your connection." });
    callbacks.onDone();
    return;
  }

  console.log('[chat] HTTP response status:', response.status, response.statusText);

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => ({}));
    console.error('[chat] HTTP error response:', response.status, errBody);
    callbacks.onError({ code: response.status, message: errBody?.detail ?? 'Server error.' });
    callbacks.onDone();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`[chat] stream ended (done=true) after ${eventCount} events`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6).trim();

        if (raw === '[DONE]') {
          console.log(`[chat] [DONE] received after ${eventCount} events`);
          callbacks.onDone();
          return;
        }

        try {
          const event = JSON.parse(raw) as TextEvent | AgentStatusEvent | MetadataEvent | ErrorEvent;
          eventCount++;

          switch (event.type) {
            case 'text':
              // Only log first chunk per response to avoid console spam
              if (eventCount === 1) console.log('[chat] first text chunk received');
              callbacks.onText(event.content);
              break;

            case 'agent':
              console.log('[chat] agent status:', event.name, event.status);
              callbacks.onAgentStatus?.(event.name, event.status);
              break;

            case 'metadata':
              console.log('[chat] metadata received:', {
                conversation_id: event.conversation_id,
                active_agent: event.active_agent,
                urgency: event.urgency,
                emergency: event.emergency,
                doctors_count: event.doctors_shown?.length ?? 0,
              });
              callbacks.onMetadata(event);
              break;

            case 'error':
              console.error('[chat] error event from backend:', event.code, event.message);
              callbacks.onError(event);
              break;
          }
        } catch (parseErr) {
          console.warn('[chat] failed to parse SSE line:', raw, parseErr);
        }
      }
    }
  } catch (err) {
    if (isAbortError(err)) {
      console.log('[chat] stream reading aborted');
    } else {
      console.error('[chat] stream read error:', err);
      callbacks.onError({ code: 0, message: 'Stream interrupted unexpectedly.' });
    }
  } finally {
    reader.releaseLock();
  }

  // Reached when stream ends without [DONE] (connection closed)
  console.log('[chat] stream closed without [DONE], calling onDone');
  callbacks.onDone();
}
