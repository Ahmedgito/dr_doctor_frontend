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
  address?: string; // Sometimes available in snippet or inferred
  placeId?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  isTyping?: boolean;
  groundingMaps?: GroundingMap[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  location: Coordinates | null;
  locationError: string | null;
}
