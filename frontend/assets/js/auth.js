// auth.js (ESM) - Single source of truth for auth in frontend

import { API_BASE, TOKEN_KEY } from "./config.js";

/** Optional: store cached user info (from /api/auth/me) */
const USER_KEY = "REVIVA_USER";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Cache user locally for UI (optional) */
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Fetch current session user from backend */
export async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const user = json?.data || null;
  setUser(user);
  return user;
}

/** Used by login page */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.details || json?.error || "Login failed";
    throw new Error(msg);
  }

  // expected backend response: { ok:true, data:{ token, user } }
  const token = json?.data?.token || "";
  const user = json?.data?.user || null;

  if (!token) throw new Error("Missing token in response");

  setToken(token);
  setUser(user);

  return { token, user };
}

/**
 * Prefer this in every protected page:
 * - redirects if no token / invalid token
 * - returns user
 */
export async function requireAuthOrRedirect(redirectTo = "login.html") {
  const token = getToken();
  if (!token) {
    window.location.href = redirectTo;
    return null;
  }

  // if we already cached user, fine
  const cached = getUser();
  if (cached) return cached;

  // otherwise call /me
  const me = await fetchMe();
  if (!me) {
    clearAuth();
    window.location.href = redirectTo;
    return null;
  }
  return me;
}

/** If you want "throw" instead of redirect */
export async function requireAuth() {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const me = await fetchMe();
  if (!me) throw new Error("Invalid session");
  return me;
}

export function logout(redirectTo = "login.html") {
  clearAuth();
  window.location.href = redirectTo;
}
