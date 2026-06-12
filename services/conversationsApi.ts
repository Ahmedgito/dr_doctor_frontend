import type { ConversationSummary, ConversationWithMessages } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * List conversations for a Clerk user_id, ordered by most recent activity.
 * Returns an empty array on network error so the sidebar degrades gracefully.
 */
export async function listConversations(
  userId: string,
  limit = 30,
): Promise<ConversationSummary[]> {
  const params = new URLSearchParams({ user_id: userId, limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/conversations?${params}`);
  if (!res.ok) throw new Error(`Failed to list conversations: ${res.status}`);
  return res.json();
}

/** Fetch a single conversation with its full message history. */
export async function getConversation(id: string): Promise<ConversationWithMessages | null> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get conversation: ${res.status}`);
  return res.json();
}

/** Rename a conversation's title. No-op 404s so stale IDs don't throw. */
export async function renameConversation(id: string, title: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (res.ok || res.status === 404) return;
  throw new Error(`Failed to rename conversation: ${res.status}`);
}

/** Delete a conversation. Silently succeeds if already gone. */
export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, { method: 'DELETE' });
  if (res.ok || res.status === 404) return;
  throw new Error(`Failed to delete conversation: ${res.status}`);
}
