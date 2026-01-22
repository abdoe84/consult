import { API_BASE, TOKEN_KEY } from "./config.js";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function apiFetch(method, path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = body instanceof FormData;

  if (!isForm && body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined),
  });

  const json = await parseJsonSafe(res);

  // Normalize shape
  if (!json) {
    return { ok: false, error: "Bad response", details: `HTTP ${res.status}` };
  }
  return json;
}

export const apiGet = (path) => apiFetch("GET", path);
export const apiPost = (path, body) => apiFetch("POST", path, body);
export const apiPatch = (path, body) => apiFetch("PATCH", path, body);
export const apiDelete = (path) => apiFetch("DELETE", path);
export const apiUpload = (path, formData) => apiFetch("POST", path, formData);
