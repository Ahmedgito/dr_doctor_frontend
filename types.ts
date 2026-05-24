export interface Coordinates {
  latitude: number;
  longitude: number;
}

export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system'
}

export interface GroundingMap {
  title: string;
  uri: string;
  address?: string;
  placeId?: string;
}

export interface Doctor {
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
  scores: {
    semantic: number;
    proximity: number;
    rating: number;
    fee: number;
    total: number;
  };
}

export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';

export type ConversationPhase =
  | 'greeting'
  | 'chitchat'
  | 'gathering'
  | 'confirm'
  | 'recommendation'
  | 'emergency';

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
  phase?: ConversationPhase;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  location: Coordinates | null;
  locationError: string | null;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  is_archived: boolean;
  conv_state: string;
  created_at: string;
  last_active_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  symptoms_extracted: string[] | null;
  specialties_targeted: string[] | null;
  urgency: string | null;
  created_at: string;
}

export interface ConversationWithMessages extends ConversationSummary {
  messages: ConversationMessage[];
}
