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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  location: Coordinates | null;
  locationError: string | null;
}
