// ============================
// API Services
// ============================
import { API_BASE } from "../../config.js";
import { getToken } from "../../auth.js";
import { normalizeBaseUrl } from "./utils.js";

/**
 * API fetch wrapper
 */
async function apiFetch(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = normalizeBaseUrl(API_BASE, path);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  // Check HTTP status code
  if (!res.ok) {
    // If response has JSON with error info, use it
    if (json) {
      return {
        ok: false,
        error: json.error || json.message || `HTTP ${res.status}`,
        details: json.details || json.error || `Server returned ${res.status}`,
        status: res.status
      };
    }
    // Otherwise create error from status
    return {
      ok: false,
      error: `HTTP ${res.status} ${res.statusText}`,
      details: `Request failed with status ${res.status}`,
      status: res.status
    };
  }

  // Success response
  return json || { ok: true, data: null };
}

export const apiGet = (path) => apiFetch("GET", path);
export const apiPost = (path, body) => apiFetch("POST", path, body);
export const apiPatch = (path, body) => apiFetch("PATCH", path, body);

/**
 * Load service request data
 */
export async function loadRequestData(id) {
  const r = await apiGet(`/api/service-requests/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(r.error || r.details || "Failed to load request");
  return r.data;
}

/**
 * Load offer data by request ID
 */
export async function loadOfferData(requestId) {
  const r = await apiGet(`/api/offers/by-request/${encodeURIComponent(requestId)}`);
  return r.ok ? r.data : null;
}

/**
 * Load project data by request ID
 */
export async function loadProjectData(requestId) {
  const r = await apiGet(`/api/projects/by-request/${encodeURIComponent(requestId)}`);
  return r.ok ? r.data : null;
}

/**
 * Load attachments for a request
 */
export async function loadAttachments(requestId) {
  const r = await apiGet(`/api/service-requests/${encodeURIComponent(requestId)}/attachments`);
  if (!r.ok) throw new Error(r.error || "Failed to load attachments");
  return r.data || [];
}

/**
 * Review service request (accept/reject)
 */
export async function reviewRequest(id, decision, rejectReason = null) {
  const payload = { decision };
  if (rejectReason) payload.reject_reason = rejectReason;
  const r = await apiPost(`/api/service-requests/${encodeURIComponent(id)}/review`, payload);
  if (!r.ok) {
    // Provide more specific error messages
    if (r.status === 409) {
      const details = typeof r.details === 'object' ? JSON.stringify(r.details) : r.details;
      throw new Error(r.error || `Cannot ${decision} request: ${details || 'Request status conflict. The request may have already been reviewed.'}`);
    }
    throw new Error(r.error || r.details || `Failed to ${decision} request`);
  }
  return r.data;
}

/**
 * Create project from request
 */
export async function createProjectFromRequest(requestId) {
  const r = await apiPost(`/api/projects/from-request/${encodeURIComponent(requestId)}`, {});
  if (!r.ok) throw new Error(r.error || r.details || "Failed to create project");
  return r.data;
}

/**
 * Update project
 */
export async function updateProject(projectId, payload) {
  const r = await apiPatch(`/api/projects/${encodeURIComponent(projectId)}`, payload);
  if (!r.ok) throw new Error(r.error || r.details || "Failed to update project");
  return r.data;
}

/**
 * Cancel project
 */
export async function cancelProject(projectId, reason = "") {
  const r = await apiPost(`/api/projects/${encodeURIComponent(projectId)}/cancel`, { reason });
  if (!r.ok) throw new Error(r.error || r.details || "Failed to cancel project");
  return r.data;
}
