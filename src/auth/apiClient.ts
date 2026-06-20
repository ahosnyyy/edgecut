const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

const JWT_KEY = "edgecut_jwt";
const USER_KEY = "edgecut_user";

export function getToken(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(JWT_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): { id: string; email: string; name: string | null } | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: { id: string; email: string; name: string | null }): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export interface ApiError {
  error: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).error || "Request failed");
  }

  return data as T;
}

export async function apiLogin(email: string, password: string): Promise<{
  token: string;
  user: { id: string; email: string; name: string | null };
}> {
  const result = await apiFetch<{
    token: string;
    user: { id: string; email: string; name: string | null };
  }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  setToken(result.token);
  setStoredUser(result.user);
  return result;
}

export async function apiSetup(
  email: string,
  password: string,
  name?: string,
): Promise<{
  token: string;
  user: { id: string; email: string; name: string | null };
}> {
  const result = await apiFetch<{
    token: string;
    user: { id: string; email: string; name: string | null };
  }>("/api/setup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

  setToken(result.token);
  setStoredUser(result.user);
  return result;
}
