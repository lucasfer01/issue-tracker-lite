type OnUnauthorized = () => void;

type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type Issue = {
  id: string;
  number: number;
  title: string;
  description?: string;
  status: IssueStatus;
  priority?: string;
  version: number;
};

export type Comment = {
  id: string;
  body: string;
  createdAt?: string;
};

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401) {
    api.onUnauthorized?.();
    throw new Error('UNAUTHENTICATED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || 'Request failed');
  }
  return res.json();
}

export const api = {
  onUnauthorized: undefined as OnUnauthorized | undefined,
  login: (email: string, password: string) => request<{ ok: boolean }>(`/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: () => request<{ ok: boolean }>(`/auth/refresh`, { method: 'POST' }),
  logout: () => request<{ ok: boolean }>(`/auth/logout`, { method: 'POST' }),
  me: () => request<{ id: string; email: string; name: string }>(`/me`),
  myProjects: () => request<Array<{ id: string; key: string; name: string }>>(`/projects`),
  createProject: (key: string, name: string) => request(`/projects`, { method: 'POST', body: JSON.stringify({ key, name }) }),
  getProject: (projectId: string) => request<{ id: string; key: string; name: string }>(`/projects/${projectId}`),
  addMember: (projectId: string, email: string, role: 'OWNER' | 'MAINTAINER' | 'REPORTER') => request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  listIssues: (projectId: string, params: Record<string, string | number | null | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    return request<{ items: Issue[]; nextCursor: string | null }>(`/projects/${projectId}/issues?${q.toString()}`);
  },
  createIssue: (projectId: string, data: { title: string; description?: string; priority?: string }) => request<Issue>(`/projects/${projectId}/issues`, { method: 'POST', body: JSON.stringify(data) }),
  getIssue: (issueId: string) => request<Issue>(`/issues/${issueId}`),
  patchIssue: (issueId: string, data: Partial<Pick<Issue, 'status' | 'priority'>> & { version: number }) => request<Issue>(`/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listComments: (issueId: string) => request<Comment[]>(`/issues/${issueId}/comments`),
  addComment: (issueId: string, body: string) => request(`/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
};
