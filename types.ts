export interface Coordinates {
  latitude: number;
  longitude: number;
}

export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system',
}

// ── Doctor ────────────────────────────────────────────────────────────────────

export interface Doctor {
  doctor_id: string;
  name: string;
  specialty: string | null;
  hospital_name: string | null;
  hospital_address: string | null;
  hospital_lat?: number | null;
  hospital_lng?: number | null;
  city: string | null;
  fee_walk_in: number | null;
  fee_online: number | null;
  satisfaction_pct: number | null;
  reviews_count: number | null;
  distance_km: number | null;
  profile_url: string;
  score?: number;
}

// ── Urgency ───────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';

// ── Chat message ──────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  /** True while the SSE stream hasn't produced any text yet */
  isTyping?: boolean;
  /** Short status line shown under typing dots during agent processing */
  agentStatus?: string;
  /** Doctor cards attached to a recommendation response */
  doctors?: Doctor[];
  /** Urgency level from the risk agent, attached once metadata arrives */
  urgency?: UrgencyLevel;
  /** True if the message triggered the emergency path */
  emergency?: boolean;
}

// ── Conversation persistence ──────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  last_active_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationWithMessages extends ConversationSummary {
  messages: ConversationMessage[];
}
