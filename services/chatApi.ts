import type { Doctor, UrgencyLevel, ConversationPhase } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export interface ChatFilters {
  user_lat?: number;
  user_lng?: number;
  max_fee?: number;
  min_satisfaction?: number;
}

interface TextEvent {
  type: 'text';
  content: string;
}

/** New in orchestrator mode: emitted while a tool is executing */
export interface ToolStatusEvent {
  type: 'tool';
  name: string;
  status: 'running' | 'done' | 'error';
}

export interface MetadataEvent {
  type: 'metadata';
  conversation_id: string;
  phase: ConversationPhase;
  emergency: boolean;
  safe_to_proceed: boolean;
  urgency: UrgencyLevel;
  symptoms_extracted: string[];
  specialties_targeted: string[];
  user_facing_note: string;
  doctors_shown: Doctor[];
  /** Present when orchestrator mode is active */
  tool_calls_made?: Array<{ name: string; status: string; elapsed_ms: number }>;
}

interface ErrorEvent {
  type: 'error';
  code: number;
  message: string;
}

export interface StreamCallbacks {
  onText: (chunk: string) => void;
  onMetadata: (meta: MetadataEvent) => void;
  onError: (err: { code: number; message: string }) => void;
  onDone: () => void;
  /** Called when the orchestrator starts or finishes a tool step */
  onToolStatus?: (name: string, status: ToolStatusEvent['status']) => void;
}

/** Human-readable hint for each tool name shown in the typing indicator */
const TOOL_HINTS: Record<string, string> = {
  update_case_memory:  'Understanding your symptoms…',
  search_doctors:      'Searching for doctors…',
  get_doctor_details:  'Looking up doctor details…',
  refine_search:       'Refining search results…',
  trigger_emergency:   'Assessing urgency…',
};

export function toolStatusHint(name: string, status: ToolStatusEvent['status']): string {
  if (status === 'done') return '';
  return TOOL_HINTS[name] ?? 'Thinking…';
}

export async function streamChat(
  message: string,
  conversationId: string | null,
  filters: ChatFilters,
  callbacks: StreamCallbacks,
  getToken: (() => Promise<string | null>) | null = null
): Promise<void> {
  let response: Response;

  const token = getToken ? await getToken() : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        filters,
      }),
    });
  } catch {
    callbacks.onError({ code: 0, message: "Can't reach the server. Please check your connection." });
    callbacks.onDone();
    return;
  }

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    callbacks.onError({ code: response.status, message: body?.detail ?? 'Server error.' });
    callbacks.onDone();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Split on \n so we handle both \r\n\r\n and \n\n event separators
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';  // keep last partial line

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');  // strip \r from \r\n
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6).trim();

        if (raw === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const event = JSON.parse(raw) as TextEvent | ToolStatusEvent | MetadataEvent | ErrorEvent;
          if (event.type === 'text') {
            callbacks.onText(event.content);
          } else if (event.type === 'tool') {
            callbacks.onToolStatus?.(event.name, event.status);
          } else if (event.type === 'metadata') {
            callbacks.onMetadata(event);
          } else if (event.type === 'error') {
            callbacks.onError(event);
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } catch {
    callbacks.onError({ code: 0, message: 'Stream interrupted unexpectedly.' });
  } finally {
    reader.releaseLock();
  }

  callbacks.onDone();
}
