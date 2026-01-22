// ============================
// Utility Functions
// ============================

/**
 * Get URL query parameter
 */
export function qp(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Get DOM element by ID
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Set text content of an element
 */
export function setText(id, v) {
  const el = $(id);
  if (!el) return;
  el.textContent = (v === null || v === undefined || v === "") ? "N/A" : String(v);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Safely parse JSON data
 */
export function safeJson(data) {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data || {};
}

/**
 * Format money amount with currency
 */
export function money(amount, currency = "SAR") {
  const num = Number(amount || 0);
  if (isNaN(num) || !isFinite(num)) return `0.00 ${currency}`;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Format date to locale string
 */
export function fmtDate(x) {
  try {
    return x ? new Date(x).toLocaleString() : "N/A";
  } catch {
    return String(x || "N/A");
  }
}

/**
 * Toggle element visibility
 */
export function show(el, on = true) {
  if (el) el.classList.toggle("hidden", !on);
}

/**
 * Parse client information from description text
 */
export function parseClientInfoFromDescription(description) {
  if (!description) return {};

  const info = {};
  const lines = description.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Client Name
    if (trimmed.includes('Client Name:')) {
      const match = trimmed.match(/Client Name\s*:\s*(.+)/i);
      if (match && match[1]) {
        info.name = match[1].trim();
      }
    }
    // Client Email
    else if (trimmed.includes('Client Email:')) {
      const match = trimmed.match(/Client Email\s*:\s*(.+)/i);
      if (match && match[1]) {
        info.email = match[1].trim();
      }
    }
    // Client Phone
    else if (trimmed.includes('Client Phone:')) {
      const match = trimmed.match(/Client Phone\s*:\s*(.+)/i);
      if (match && match[1]) {
        info.phone = match[1].trim();
      }
    }
    // Source
    else if (trimmed.includes('Source:')) {
      const match = trimmed.match(/Source\s*:\s*(.+)/i);
      if (match && match[1]) {
        info.source = match[1].trim();
      }
    }
    // Sub Service (Arabic)
    else if (trimmed.includes('الخدمة الفرعية')) {
      const match = trimmed.match(/الخدمة الفرعية\s*:?\s*(.+)/);
      if (match && match[1]) {
        info.subService = match[1].trim();
      }
    }
  }

  return info;
}

/**
 * Set error message
 */
export function setError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = String(msg || "Error");
  box.classList.remove("hidden");
}

/**
 * Clear error message
 */
export function clearError() {
  $("errorBox")?.classList.add("hidden");
}

/**
 * Normalize base URL for API calls
 */
export function normalizeBaseUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;

  // If base already ends with /api AND path starts with /api -> avoid /api/api
  if (b.endsWith("/api") && p.startsWith("/api/")) return `${b}${p.slice(4)}`;
  return `${b}${p}`;
}

/**
 * Get file icon based on mime type or extension
 */
export function getFileIcon(mimeType, fileName) {
  if (mimeType) {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
  if (['zip', 'rar'].includes(ext)) return '📦';

  return '📎';
}
