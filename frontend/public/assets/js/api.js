// frontend/assets/js/api.js
import { API_BASE, TOKEN_KEY } from "./config.js";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("REVIVA_USER");
}

async function apiFetch(method, path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = body instanceof FormData;

  if (!isForm && body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined),
    });
  } catch (networkError) {
    // Handle network errors (connection refused, timeout, etc.)
    // Only log in development mode to reduce console noise
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.warn("Network error (handled):", networkError.message || networkError);
    }
    return {
      ok: false,
      error: "Network Error",
      details: "Cannot connect to server. Please check if the backend server is running on port 4000."
    };
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore parse errors
  }

  // Helper function to safely check if a value is a string and includes a substring
  const safeIncludes = (value, searchString) => {
    return typeof value === "string" && value.includes(searchString);
  };

  // Handle 401 Unauthorized - token expired
  const isUnauthorized = res.status === 401 ||
    (json && (
      safeIncludes(json.details, "401") ||
      safeIncludes(json.details, "Unauthorized") ||
      safeIncludes(json.error, "jwt expired") ||
      safeIncludes(json.error, "token expired") ||
      safeIncludes(json.error, "Unauthorized")
    ));

  if (isUnauthorized) {
    clearAuth();
    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html?msg=Session expired";
    }
    return { ok: false, error: "Unauthorized", details: "Session expired. Please log in again." };
  }

  // Handle 403 Forbidden - insufficient permissions
  if (res.status === 403) {
    const errorMsg = json?.error || "Forbidden";
    const detailsMsg = typeof json?.details === "string"
      ? json.details
      : (json?.details ? JSON.stringify(json.details) : "You don't have permission to perform this action.");
    return { ok: false, error: errorMsg, details: detailsMsg };
  }

  // Always return stable shape
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
