import type { ConversationSummary, ConversationWithMessages } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

type GetToken = (() => Promise<string | null>) | null;

async function authHeaders(getToken: GetToken): Promise<Record<string, string>> {
  if (!getToken) return {};
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listConversations(
  getToken: GetToken,
  page = 1,
  pageSize = 20
): Promise<{ conversations: ConversationSummary[]; total: number; page: number; page_size: number }> {
  const headers = await authHeaders(getToken);
  const res = await fetch(
    `${API_BASE}/api/conversations?page=${page}&page_size=${pageSize}`,
    { headers }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getConversation(
  getToken: GetToken,
  id: string
): Promise<ConversationWithMessages | null> {
  const headers = await authHeaders(getToken);
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function renameConversation(
  getToken: GetToken,
  id: string,
  title: string
): Promise<ConversationSummary> {
  const headers = await authHeaders(getToken);
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function archiveConversation(
  getToken: GetToken,
  id: string,
  archived = true
): Promise<ConversationSummary> {
  const headers = await authHeaders(getToken);
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_archived: archived }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteConversation(
  getToken: GetToken,
  id: string
): Promise<boolean> {
  const headers = await authHeaders(getToken);
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(await res.text());
  return true;
}
