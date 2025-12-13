import { Coordinates, GroundingMap } from "../types";

// This is now a mock service. 
// You can replace the logic inside sendMessageToGemini to connect to your own backend.

export interface ChatResponse {
  text: string;
  groundingMaps: GroundingMap[];
}

export const sendMessageToGemini = async (
  message: string,
  location: Coordinates | null
): Promise<ChatResponse> => {
  
  // Simulate network latency (1.5 seconds)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Default Mock Response
  // In a real backend, you would process 'message' and 'location' here.
  return {
    text: "I understand your symptoms. Based on what you've described, it sounds like you might need to see a general practitioner or an urgent care specialist.\n\nHere are the top-rated medical facilities near your location that can assist you.",
    groundingMaps: [
      {
        title: "City General Hospital",
        uri: "https://www.google.com/maps/search/?api=1&query=City+General+Hospital",
        address: "123 Medical Center Dr"
      },
      {
        title: "Downtown Urgent Care",
        uri: "https://www.google.com/maps/search/?api=1&query=Downtown+Urgent+Care",
        address: "456 Wellness Blvd"
      },
      {
        title: "Dr. Emily Smith, MD",
        uri: "https://www.google.com/maps/search/?api=1&query=Dr+Emily+Smith+MD",
        address: "789 Health Way, Suite 100"
      }
    ]
  };
};

export const initializeChat = () => {
  // No-op for mock service
  console.log("Chat initialized (Mock Mode)");
};