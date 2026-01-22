import { API_BASE } from "../config.js?v=20260109a";
import {
  requireAuthOrRedirect,
  getToken,
  getUser,
  fetchMe,
  logout
} from "../auth.js?v=20260109a";

function qp(key) { return new URLSearchParams(window.location.search).get(key); }
function $(id) { return document.getElementById(id); }

function setText(id, v) {
  const el = $(id);
  if (!el) return;
  el.textContent = (v === null || v === undefined || v === "") ? "N/A" : String(v);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(data) {
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

function money(amount, currency = "SAR") {
  const num = Number(amount || 0);
  if (isNaN(num) || !isFinite(num)) return `0.00 ${currency}`;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function parseClientInfoFromDescription(description) {
  if (!description) return {};

  const info = {};
  const lines = description.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Client Name - match "Client Name:" at start or anywhere
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

function renderClientInfo(req) {
  const container = $("clientInfo");
  if (!container) return;

  // Get client info from dedicated fields or parse from description
  const clientName = req.requester_name || "";
  const clientEmail = req.requester_email || "";
  const clientPhone = req.requester_phone || "";

  // Parse additional info from description if needed
  const parsedInfo = parseClientInfoFromDescription(req.description || "");

  const finalName = clientName || parsedInfo.name || "N/A";
  const finalEmail = clientEmail || parsedInfo.email || "N/A";
  const finalPhone = clientPhone || parsedInfo.phone || "N/A";
  const source = parsedInfo.source || "N/A";
  const subService = parsedInfo.subService || "";

  let html = '';

  // Client Name (الاسم) - Modern clean design
  if (finalName !== "N/A") {
    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 shrink-0">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide">Name</div>
          <div class="text-sm font-semibold text-slate-800">${escapeHtml(finalName)}</div>
        </div>
      </div>
    `;
  }

  // Client Email (الإيميل)
  if (finalEmail !== "N/A") {
    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 shrink-0">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide">Email</div>
          <a href="mailto:${escapeHtml(finalEmail)}" class="text-sm font-semibold text-slate-800 hover:opacity-70 break-all">${escapeHtml(finalEmail)}</a>
        </div>
      </div>
    `;
  }

  // Client Phone (رقم التواصل)
  if (finalPhone !== "N/A") {
    html += `
      <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 shrink-0">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide">Phone</div>
          <a href="tel:${escapeHtml(finalPhone)}" class="text-sm font-semibold text-slate-800 hover:opacity-70">${escapeHtml(finalPhone)}</a>
        </div>
      </div>
    `;
  }

  if (!html) {
    html = '<div class="text-sm text-slate-500 italic">No client information available</div>';
  }

  container.innerHTML = html;
}

async function loadAttachments(requestId) {
  const container = $("attachments");
  if (!container) return;

  try {
    const r = await apiGet(`/api/service-requests/${encodeURIComponent(requestId)}/attachments`);

    if (!r.ok) {
      container.innerHTML = '<div class="text-sm text-slate-500 italic">Failed to load attachments</div>';
      return;
    }

    const attachments = r.data || [];

    if (attachments.length === 0) {
      container.innerHTML = '<div class="text-sm text-slate-500 italic">No attachments</div>';
      return;
    }

    let html = '';
    attachments.forEach((att) => {
      const fileSize = att.file_size_bytes
        ? (att.file_size_bytes < 1024
            ? `${att.file_size_bytes} B`
            : att.file_size_bytes < 1024 * 1024
            ? `${(att.file_size_bytes / 1024).toFixed(2)} KB`
            : `${(att.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`)
        : 'Unknown size';

      const icon = getFileIcon(att.mime_type || '', att.file_name || '');

      html += `
        <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition-all">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shrink-0"
                 style="background: var(--scampi);">
              ${icon}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(att.file_name || 'Unknown file')}</div>
              <div class="text-xs text-slate-500 mt-0.5">${fileSize} • ${fmtDate(att.uploaded_at)}</div>
            </div>
          </div>
          ${att.url ? `
            <a href="${escapeHtml(att.url)}" target="_blank" rel="noopener noreferrer"
               class="ml-3 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity shrink-0"
               style="background: var(--patina);">
              Download
            </a>
          ` : `
            <span class="ml-3 px-4 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-100 shrink-0">
              Unavailable
            </span>
          `}
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading attachments:', error);
    container.innerHTML = '<div class="text-sm text-red-500">Error loading attachments</div>';
  }
}

function getFileIcon(mimeType, fileName) {
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

function renderDescription(req) {
  const container = $("description");
  if (!container) return;

  let description = req.description || "";

  // Extract sub-service first (to display separately)
  const parsedInfo = parseClientInfoFromDescription(description);
  const subService = parsedInfo.subService || "";

  // Clean description: remove client info, source, separators, and sub-service lines
  if (description) {
    const lines = description.split('\n');
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();

      // Skip empty lines and separators
      if (!trimmed || trimmed.startsWith('---')) return false;

      // Skip client information lines (anywhere in the line, case-insensitive)
      if (trimmed.includes('Client Name:') || trimmed.toLowerCase().includes('client name:')) return false;
      if (trimmed.includes('Client Email:') || trimmed.toLowerCase().includes('client email:')) return false;
      if (trimmed.includes('Client Phone:') || trimmed.toLowerCase().includes('client phone:')) return false;
      if (trimmed.includes('Source:') || trimmed.toLowerCase().includes('source:')) return false;

      // Skip sub-service line (already extracted and will be shown separately)
      if (trimmed.includes('الخدمة الفرعية')) return false;

      return true;
    });

    description = cleanLines.join('\n').trim();
  }

  // Build description HTML with modern, professional styling
  let html = '';

  // Sub-service section (if available) - styled prominently at the top
  if (subService) {
    html += `
      <div class="mb-4 pb-4 border-b-2 border-purple-200/50">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-6 h-6 rounded-md flex items-center justify-center bg-purple-100/50 shrink-0">
            <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <div class="text-xs font-semibold text-purple-600 uppercase tracking-wide">الخدمة الفرعية / Sub Service</div>
        </div>
        <div class="pl-8 text-base font-bold text-purple-700">${escapeHtml(subService)}</div>
      </div>
    `;
  }

  // Main description content (cleaned of all client info and metadata)
  if (description && description !== "") {
    // Clean up any placeholder text patterns (like repeated x's)
    let cleanDesc = description.replace(/^x{3,}$/gmi, '').trim();

    if (cleanDesc) {
      html += `
        <div class="${subService ? 'mt-4' : ''} prose prose-sm max-w-none">
          <div class="text-sm text-slate-700 leading-relaxed whitespace-pre-line">${escapeHtml(cleanDesc)}</div>
        </div>
      `;
    } else if (subService) {
      // If only sub-service exists and no other description, don't show empty message
      html += '';
    } else {
      html += '<div class="text-sm text-slate-400 italic">No description provided</div>';
    }
  } else if (!subService) {
    html += '<div class="text-sm text-slate-400 italic">No description provided</div>';
  }

  // Fallback if nothing was generated
  if (!html && !subService) {
    html = '<div class="text-sm text-slate-400 italic">No description provided</div>';
  }

  container.innerHTML = html || '';
  container.classList.remove("text-slate-400", "italic");
}

function show(el, on = true) { if (el) el.classList.toggle("hidden", !on); }

function fmtDate(x) {
  try { return x ? new Date(x).toLocaleString() : "N/A"; }
  catch { return String(x || "N/A"); }
}

function setError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = String(msg || "Error");
  box.classList.remove("hidden");
}
function clearError() { $("errorBox")?.classList.add("hidden"); }

function normalizeBaseUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;

  // If base already ends with /api AND path starts with /api -> avoid /api/api
  if (b.endsWith("/api") && p.startsWith("/api/")) return `${b}${p.slice(4)}`;
  return `${b}${p}`;
}

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
  return json || { ok: false, error: "Bad response", details: "No JSON" };
}

const apiGet = (path) => apiFetch("GET", path);
const apiPost = (path, body) => apiFetch("POST", path, body);
const apiPatch = (path, body) => apiFetch("PATCH", path, body);

function goToOfferReview(offerId) {
  window.location.href = `offer-review.html?id=${encodeURIComponent(offerId)}`;
}

function goToProject(projectId) {
  // Change this URL to your real project details page when you create it
  window.location.href = `project-details.html?id=${encodeURIComponent(projectId)}`;
}

let currentUser = null;
let currentRequest = null;
let currentOffer = null;
let currentProject = null;

let actionsBound = false;

function isManager() {
  return String(currentUser?.role || "").toUpperCase() === "MANAGER";
}

function reqId() {
  return qp("id");
}

function offerStatus() {
  return String(currentOffer?.status || "").toUpperCase();
}

// ============================
// Auto create project (MANAGER fallback)
// ============================
function autoCreateKey(requestId) {
  return `AUTO_PROJECT_TRIED_${requestId}`;
}

async function maybeAutoCreateProject() {
  const requestId = currentRequest?.id;
  if (!requestId) return;

  // Only when offer is client approved, and no project yet
  const st = offerStatus();
  if (st !== "CLIENT_APPROVED") return;
  if (currentProject?.id) return;

  // Only manager auto-creates (safe). Others just see "N/A".
  if (!isManager()) return;

  // Only try once per request per browser session
  if (sessionStorage.getItem(autoCreateKey(requestId)) === "1") return;
  sessionStorage.setItem(autoCreateKey(requestId), "1");

  try {
    const r = await apiPost(`/api/projects/from-request/${encodeURIComponent(requestId)}`, {});
    if (r?.ok && r.data?.id) {
      currentProject = r.data;
      render(); // update UI instantly
    } else {
      // show retry button
      renderProjectButtons();
    }
  } catch (e) {
    renderProjectButtons();
  }
}

function renderProjectButtons() {
  const btnRetry = $("btnRetryCreateProject");
  const btnOpen = $("btnOpenProject");
  const btnEdit = $("btnEditProject");
  const btnCancel = $("btnCancelProject");

  const manager = isManager();
  const hasProject = !!currentProject?.id;
  const st = offerStatus();

  // Retry only if client approved and still no project
  show(btnRetry, manager && !hasProject && st === "CLIENT_APPROVED");

  // Open project if exists
  show(btnOpen, hasProject);

  // Manager controls if exists
  show(btnEdit, manager && hasProject);
  show(btnCancel, manager && hasProject);

  // Wire dynamic actions (use onclick to avoid duplicate listeners)
  if (btnRetry) {
    btnRetry.onclick = async () => {
      const requestId = currentRequest?.id;
      if (!requestId) return;

      const originalText = btnRetry.textContent || "Retry Create Project";
      btnRetry.disabled = true;
      btnRetry.textContent = "Creating...";

      try {
        const r = await apiPost(`/api/projects/from-request/${encodeURIComponent(requestId)}`, {});

        if (!r?.ok) {
          setError(`${r.error}\n${r.details || ""}`);
          return;
        }

        currentProject = r.data || null;
        render();
        alert("Project created ✅");
      } catch (error) {
        console.error("Create project error:", error);
        setError(`Failed to create project: ${error.message || "Unknown error"}`);
      } finally {
        btnRetry.disabled = false;
        btnRetry.textContent = originalText;
      }
    };
  }

  if (btnOpen) {
    btnOpen.onclick = () => {
      if (!currentProject?.id) return;
      goToProject(currentProject.id);
    };
  }

  if (btnEdit) {
    btnEdit.onclick = async () => {
      if (!currentProject?.id) return;

      const newTitle = prompt("New project title:", currentProject?.title || "");
      if (newTitle === null) return; // cancelled
      const title = String(newTitle).trim();
      if (!title) return alert("Title is required.");

      btnEdit.disabled = true;
      btnEdit.textContent = "Saving...";

      const r = await apiPatch(`/api/projects/${encodeURIComponent(currentProject.id)}`, { title });

      btnEdit.disabled = false;
      btnEdit.textContent = "Edit Project Title";

      if (!r?.ok) return setError(`${r.error}\n${r.details || ""}`);

      currentProject = r.data;
      render();
      alert("Updated ✅");
    };
  }

  if (btnCancel) {
    btnCancel.onclick = async () => {
      if (!currentProject?.id) return;

      const reason = prompt("Cancel reason (optional):", "");
      if (reason === null) return;

      if (!confirm("Are you sure you want to cancel this project?")) return;

      const originalText = btnCancel.textContent || "Cancel Project";
      btnCancel.disabled = true;
      btnCancel.textContent = "Cancelling...";

      try {
        const r = await apiPost(`/api/projects/${encodeURIComponent(currentProject.id)}/cancel`, { reason });

        if (!r?.ok) {
          setError(`${r.error}\n${r.details || ""}`);
          return;
        }

        currentProject = r.data;
        render();
        alert("Cancelled ✅");
      } catch (error) {
        console.error("Cancel project error:", error);
        setError(`Failed to cancel project: ${error.message || "Unknown error"}`);
      } finally {
        btnCancel.disabled = false;
        btnCancel.textContent = originalText;
      }
    };
  }
}

// ============================
// Session / Load
// ============================
async function loadSession() {
  if (!requireAuthOrRedirect("login.html")) return;

  const me = await fetchMe();
  const userData = me?.ok ? (me.data?.user || me.data?.profile || me.data) : null;

  currentUser = userData || getUser();

  const name = currentUser?.full_name || currentUser?.email || "User";
  const role = (currentUser?.role || "UNKNOWN").toUpperCase();

  setText("sessionLine", `${name} • ${role}`);
  setText("roleChip", role);
}

async function loadData() {
  clearError();

  const id = reqId();
  if (!id) return setError("Missing request id in URL (?id=...)");

  const r = await apiGet(`/api/service-requests/${encodeURIComponent(id)}`);
  if (!r.ok) return setError(`${r.error}\n${r.details || ""}`);
  currentRequest = r.data;

  const o = await apiGet(`/api/offers/by-request/${encodeURIComponent(id)}`);
  currentOffer = o.ok ? o.data : null;

  const p = await apiGet(`/api/projects/by-request/${encodeURIComponent(id)}`);
  currentProject = p.ok ? p.data : null;

  // Load attachments
  await loadAttachments(id);

  render();

  // ✅ manager-only auto create fallback
  await maybeAutoCreateProject();

  // After auto-create attempt, render again
  render();
}

// ============================
// Render + UI
// ============================
function render() {
  const req = currentRequest;
  if (!req) return;

  const ref = req.reference_no || "N/A";
  setText("refNo", ref);
  setText("refNo2", ref);

  // Status badge (professional design with less saturation)
  const statusElement = $("reqStatus");
  if (statusElement) {
    const status = (req.status || "N/A").toUpperCase();
    statusElement.className = "status-badge inline-flex items-center gap-1.5";

    if (status.includes("PENDING")) {
      statusElement.classList.add("pending");
      statusElement.innerHTML = `<span>⏱</span><span>${status}</span>`;
    } else if (status.includes("ACCEPTED") || status.includes("APPROVED")) {
      statusElement.classList.add("accepted");
      statusElement.innerHTML = `<span>✓</span><span>${status}</span>`;
    } else if (status.includes("REJECTED") || status.includes("DECLINED")) {
      statusElement.classList.add("rejected");
      statusElement.innerHTML = `<span>✕</span><span>${status}</span>`;
    } else {
      statusElement.classList.add("pending");
      statusElement.innerHTML = `<span>📋</span><span>${status}</span>`;
    }
  }

  // Extract main service name from title (format: "Service Name - Client Name")
  let mainServiceName = "N/A";
  if (req.title) {
    const titleParts = req.title.split(" - ");
    if (titleParts.length > 0) {
      mainServiceName = titleParts[0].trim();
    }
  }
  // Fallback to service_type if title extraction fails
  if (mainServiceName === "N/A" || mainServiceName === "") {
    mainServiceName = req.service_type || "N/A";
  }

  setText("serviceType", mainServiceName);
  setText("priority", req.priority || "N/A");
  setText("createdAt", fmtDate(req.created_at));
  setText("title", req.title || "N/A");

  // Time Logs
  const createdTimeEl = $("createdTime");
  const updatedTimeEl = $("updatedTime");
  if (createdTimeEl) createdTimeEl.textContent = fmtDate(req.created_at) || "—";
  if (updatedTimeEl) updatedTimeEl.textContent = fmtDate(req.updated_at) || "—";

  // Parse and render client information
  renderClientInfo(req);

  // Parse and render description (clean description without client info)
  renderDescription(req);

  // Offer box
  if (currentOffer?.id) {
    setText("offerStatus", (currentOffer.status || "N/A").toUpperCase());
    setText("offerId", currentOffer.id);
    setText("offerUpdated", fmtDate(currentOffer.updated_at || currentOffer.created_at));
  } else {
    setText("offerStatus", "N/A");
    setText("offerId", "N/A");
    setText("offerUpdated", "N/A");
  }

  // Review Offer button
  const btnOfferReview = $("btnOfferReview");
  if (btnOfferReview) {
    if (currentOffer?.id) {
      btnOfferReview.classList.remove("hidden");
      btnOfferReview.onclick = () => goToOfferReview(currentOffer.id);
      btnOfferReview.textContent = "Review Offer";
    } else {
      btnOfferReview.classList.add("hidden");
    }
  }

  // Project box
  if (currentProject?.id) {
    setText("projectStatus", (currentProject.status || "N/A").toUpperCase());
    setText("projectId", currentProject.id);
    setText("projectUpdated", fmtDate(currentProject.updated_at || currentProject.created_at));
    show($("noProject"), false);
  } else {
    setText("projectStatus", "N/A");
    setText("projectId", "N/A");
    setText("projectUpdated", "N/A");
    show($("noProject"), true);
  }

  // Buttons visibility (existing logic)
  const role = String(currentUser?.role || "").toUpperCase();
  const status = String(req.status || "").toUpperCase();

  show($("consultantActions"), role === "CONSULTANT" && status === "PENDING_REVIEW");
  show($("btnOpenOfferDraft"), role === "CONSULTANT" && status === "CONSULTANT_ACCEPTED");

  // ✅ New project controls
  renderProjectButtons();

  // Render offer details (Technical & Financial) for Manager/Admin
  if (currentOffer?.id) {
    renderOfferDetails(currentOffer);
  } else {
    // Hide offer sections if no offer
    show($("technicalOfferSection"), false);
    show($("financialOfferSection"), false);
  }
}

function renderOfferDetails(offer) {
  const role = String(currentUser?.role || "").toUpperCase();
  const offerStatusUpper = String(offer?.status || "").toUpperCase();

  // Show offer details for Manager/Admin when offer is submitted or approved
  const canViewOffer = (role === "MANAGER" || role === "ADMIN") &&
                       (offerStatusUpper === "SUBMITTED_TO_MANAGER" ||
                        offerStatusUpper === "MANAGER_APPROVED" ||
                        offerStatusUpper === "MANAGER_REJECTED" ||
                        offerStatusUpper === "CLIENT_APPROVED" ||
                        offerStatusUpper === "CLIENT_REJECTED");

  if (!canViewOffer) {
    show($("technicalOfferSection"), false);
    show($("financialOfferSection"), false);
    return;
  }

  // Render Technical Offer
  renderTechnicalOffer(offer);

  // Render Timeline
  renderTimelineOffer(offer);

  // Render Financial Offer
  renderFinancialOffer(offer);
}

function renderTechnicalOffer(offer) {
  const container = $("technicalOfferContent");
  const section = $("technicalOfferSection");
  if (!container || !section) return;

  const technical = safeJson(offer.technical_data || offer.technical_offer);

  if (!technical || Object.keys(technical).length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">📄</div>
        <div class="font-medium">لا توجد تفاصيل تقنية متوفرة</div>
        <div class="text-xs mt-1">No technical details provided</div>
      </div>
    `;
    show(section, true);
    return;
  }

  const sections = Array.isArray(technical?.sections) ? technical.sections : null;

  if (sections && sections.length > 0) {
    container.innerHTML = sections.map((s, index) => {
      const title = String(s?.title || `Section ${index + 1}`);
      const content = String(s?.content || "");

      return `
        <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                 style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
              ${index + 1}
            </div>
            <div class="text-lg font-bold text-slate-800" style="color: var(--scampi);">${escapeHtml(title)}</div>
          </div>
          <div class="text-slate-700 leading-relaxed whitespace-pre-line pl-11">${escapeHtml(content) || '<span class="text-slate-400">لا يوجد محتوى</span>'}</div>
        </div>
      `;
    }).join("");
    show(section, true);
    return;
  }

  // Fallback if it's not sections-based
  container.innerHTML = `
    <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg">
      <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(JSON.stringify(technical, null, 2))}</div>
    </div>
  `;
  show(section, true);
}

function renderTimelineOffer(offer) {
  const technical = safeJson(offer.technical_data || offer.technical_offer);
  const timeline = technical?.timeline;

  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
    return;
  }

  // Find or create timeline section in HTML
  let timelineSection = document.getElementById("timelineOfferSection");
  if (!timelineSection) {
    // Create timeline section after technical offer
    const technicalSection = document.getElementById("technicalOfferSection");
    if (technicalSection) {
      timelineSection = document.createElement("div");
      timelineSection.id = "timelineOfferSection";
      timelineSection.className = "mt-6 bg-white/60 border border-white/40 rounded-3xl p-6 shadow-2xl backdrop-blur-sm";
      timelineSection.innerHTML = `
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold mb-1" style="color: var(--reviva-blue);">📅 Project Timeline</h2>
            <p class="text-sm text-slate-600">Project phases and milestones</p>
          </div>
        </div>
        <div id="timelineOfferContent"></div>
      `;
      technicalSection.after(timelineSection);
    } else {
      return;
    }
  }

  const container = document.getElementById("timelineOfferContent");
  if (!container) return;

  const sortedTimeline = [...timeline].sort((a, b) => {
    const dateA = new Date(a.start_date || 0);
    const dateB = new Date(b.start_date || 0);
    return dateA - dateB;
  });

  container.innerHTML = `
    <div class="relative">
      <div class="absolute left-6 top-0 bottom-0 w-0.5"
           style="background: linear-gradient(180deg, var(--reviva-blue), var(--fountain));"></div>
      <div class="space-y-6">
        ${sortedTimeline.map((item, index) => {
          const startDate = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—";
          const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—";
          const phase = escapeHtml(item.phase || `Phase ${index + 1}`);
          const description = escapeHtml(item.description || "");
          const status = item.status || "planned";

          const statusColors = {
            "planned": "bg-blue-100 text-blue-700 border-blue-300",
            "in-progress": "bg-amber-100 text-amber-700 border-amber-300",
            "completed": "bg-emerald-100 text-emerald-700 border-emerald-300",
            "on-hold": "bg-slate-100 text-slate-700 border-slate-300"
          };

          const statusLabels = {
            "planned": "Planned / مخطط",
            "in-progress": "In Progress / قيد التنفيذ",
            "completed": "Completed / مكتمل",
            "on-hold": "On Hold / متوقف"
          };

          return `
            <div class="relative flex items-start gap-4 pl-14">
              <div class="absolute left-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10"
                   style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
                ${index + 1}
              </div>
              <div class="flex-1 bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg transition-all hover:shadow-xl">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-800 mb-2" style="color: var(--scampi);">${phase}</h3>
                    <div class="flex items-center gap-4 text-sm text-slate-600">
                      <span class="flex items-center gap-1">
                        <span>📅</span>
                        <span><strong>Start:</strong> ${startDate}</span>
                      </span>
                      <span class="flex items-center gap-1">
                        <span>🏁</span>
                        <span><strong>End:</strong> ${endDate}</span>
                      </span>
                    </div>
                  </div>
                  <span class="px-3 py-1 rounded-lg text-xs font-semibold border ${statusColors[status] || statusColors.planned}">
                    ${statusLabels[status] || statusLabels.planned}
                  </span>
                </div>
                ${description ? `
                  <div class="text-slate-700 leading-relaxed whitespace-pre-line pt-3 border-t border-slate-200/50">
                    ${description}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  timelineSection.classList.remove("hidden");
}

function renderFinancialOffer(offer) {
  const container = $("financialOfferContent");
  const section = $("financialOfferSection");
  if (!container || !section) return;

  const financial = safeJson(offer.financial_offer || offer.financial_data);

  if (!financial || Object.keys(financial).length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">💰</div>
        <div class="font-medium">لا توجد تفاصيل مالية متوفرة</div>
        <div class="text-xs mt-1">No financial details provided</div>
      </div>
    `;
    show(section, true);
    return;
  }

  const items = Array.isArray(financial?.items) ? financial.items :
                Array.isArray(financial?.lines) ? financial.lines : [];
  const currency = String(financial?.currency || "SAR");
  const vatRate = Number(financial?.vat_rate ?? 0.15);
  const totals = safeJson(financial?.totals || {});

  let html = '';

  if (items.length > 0) {
    html += `
      <div class="mt-6 overflow-hidden rounded-2xl border-2 border-slate-300 shadow-2xl bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 text-white">
                <th class="px-6 py-4 text-left text-sm font-bold border-r border-white/20">الوصف / Description</th>
                <th class="px-6 py-4 text-center text-sm font-bold border-r border-white/20">الوحدة / Unit</th>
                <th class="px-6 py-4 text-center text-sm font-bold border-r border-white/20">الكمية / Qty</th>
                <th class="px-6 py-4 text-right text-sm font-bold border-r border-white/20">سعر التكلفة / Base Cost</th>
                <th class="px-6 py-4 text-center text-sm font-bold border-r border-white/20 bg-emerald-700/90">نسبة الربح % / Profit %</th>
                <th class="px-6 py-4 text-center text-sm font-bold border-r border-white/20 bg-amber-600/90">نسبة الطوارئ % / Contingency %</th>
                <th class="px-6 py-4 text-right text-sm font-bold" style="background: linear-gradient(135deg, rgba(102, 162, 134, 0.95), rgba(84, 192, 232, 0.95));">الإجمالي / Line Total</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-200">
    `;

    items.forEach((item, index) => {
      const qty = Number(item.qty || 0);
      let baseCost, profitPercent, contingencyPercent, lineTotal;

      if (item.base_cost !== undefined) {
        // New format
        baseCost = Number(item.base_cost || 0);
        profitPercent = Number(item.profit_percent || 0);
        contingencyPercent = Number(item.contingency_percent || 0);
        const discountPercent = Number(item.discount_percent || 0);

        const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
        const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
        lineTotal = unitPriceAfterDiscount * qty;
      } else {
        // Old format
        const unitPrice = Number(item.unit_price || 0);
        const contingency = Number(item.contingency || 0);
        const profit = Number(item.profit || 0);
        const baseTotal = qty * unitPrice;
        lineTotal = baseTotal + contingency + profit;
        baseCost = unitPrice;
        profitPercent = baseCost > 0 ? (profit / baseCost) * 100 : 0;
        contingencyPercent = baseCost > 0 ? (contingency / baseCost) * 100 : 0;
      }

      const isEven = index % 2 === 0;
      html += `
        <tr class="group ${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50 transition-all duration-200">
          <td class="px-6 py-4">
            <div class="font-semibold text-slate-800 text-sm">${escapeHtml(item.description || "-")}</div>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">${escapeHtml(item.unit || "-")}</span>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 border-2 border-blue-200">${qty.toLocaleString()}</span>
          </td>
          <td class="px-6 py-4 text-right">
            <div class="text-sm font-semibold text-slate-700">${baseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</div>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 border-2 border-emerald-300">${profitPercent.toFixed(1)}%</span>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 border-2 border-amber-300">${contingencyPercent.toFixed(1)}%</span>
          </td>
          <td class="px-6 py-4 text-right">
            <div class="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg px-4 py-2 inline-block">
              <div class="text-base font-bold text-slate-800">${money(lineTotal, currency)}</div>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Summary
    const subtotal = Number(totals.subtotal || 0);
    const vat = Number(totals.vat || 0);
    const grandTotal = Number(totals.total || 0);

    html += `
      <div class="mt-6 flex flex-col lg:flex-row gap-6">
        <div class="flex-1"></div>
        <div class="w-full lg:w-96 bg-gradient-to-br from-white to-slate-50 border-2 border-slate-300 rounded-2xl p-6 shadow-xl">
          <h3 class="text-lg font-bold text-slate-800 mb-6 pb-3 border-b-2 border-slate-300" style="color: var(--scampi);">
            الملخص النهائي / Final Summary
          </h3>

          <div class="space-y-4">
            <div class="flex justify-between items-center py-2">
              <span class="text-sm font-semibold text-slate-700">المجموع الجزئي / Subtotal:</span>
              <span class="text-base font-bold text-slate-800">${money(subtotal, currency)}</span>
            </div>

            <div class="flex justify-between items-center py-3 border-t-2 border-slate-300 bg-blue-50 rounded-lg px-3 -mx-3">
              <div>
                <span class="text-sm font-semibold text-slate-700">ضريبة القيمة المضافة / VAT:</span>
                <span class="text-xs text-slate-500 ml-2 font-medium">${(vatRate * 100).toFixed(0)}%</span>
              </div>
              <span class="text-base font-bold text-slate-800">${money(vat, currency)}</span>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t-2 border-slate-400 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg px-4 py-4 -mx-4 -mb-4">
            <div class="flex justify-between items-center">
              <span class="text-xl font-bold text-slate-800">الإجمالي النهائي / Grand Total:</span>
              <span class="text-2xl font-bold" style="color: var(--reviva-green);">${money(grandTotal, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">📊</div>
        <div class="font-medium">لا توجد بنود مالية</div>
        <div class="text-xs mt-1">No financial items</div>
      </div>
    `;
  }

  container.innerHTML = html;
  show(section, true);
}

function bindActionsOnce() {
  if (actionsBound) return;
  actionsBound = true;

  $("btnBack")?.addEventListener("click", () => history.back());
  $("btnLogout")?.addEventListener("click", () => logout("login.html"));

  $("btnRejectToggle")?.addEventListener("click", () => {
    show($("rejectBox"), true);
    $("rejectReason")?.focus();
  });

  $("btnRejectCancel")?.addEventListener("click", () => {
    show($("rejectBox"), false);
    if ($("rejectReason")) $("rejectReason").value = "";
  });

  $("btnAccept")?.addEventListener("click", async () => {
    const id = currentRequest?.id;
    if (!id) return;

    const btn = $("btnAccept");
    const originalText = btn?.textContent || "Accept";
    if (btn) { btn.textContent = "Processing..."; btn.disabled = true; }

    try {
      const r = await apiPost(`/api/service-requests/${encodeURIComponent(id)}/review`, { decision: "ACCEPT" });

      if (!r.ok) {
        const errorMsg = r.details || r.error || "Failed to accept request";
        setError(`Error: ${errorMsg}`);
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
        return;
      }

      await loadData();
      alert("Accepted ✅");
    } catch (error) {
      console.error("Accept error:", error);
      setError(`Failed to accept: ${error.message || "Unknown error"}`);
      if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
  });

  $("btnRejectConfirm")?.addEventListener("click", async () => {
    const id = currentRequest?.id;
    if (!id) return;

    const reason = ($("rejectReason")?.value || "").trim();
    if (!reason) {
      setError("Reject reason is required. Please provide a reason for rejection.");
      return;
    }

    const btn = $("btnRejectConfirm");
    const originalText = btn?.textContent || "Reject";
    if (btn) { btn.textContent = "Processing..."; btn.disabled = true; }

    try {
      // Log payload before sending
      const payload = {
        decision: "REJECT",
        reject_reason: reason
      };
      console.log("[REQUEST_DETAILS] Sending reject request:", { id, payload });

      const r = await apiPost(`/api/service-requests/${encodeURIComponent(id)}/review`, payload);

      if (!r.ok) {
        const errorMsg = r.details || r.error || "Failed to reject request";
        setError(`Error: ${errorMsg}`);
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
        return;
      }

      await loadData();
      alert("Rejected ❌");
    } catch (error) {
      console.error("Reject error:", error);
      setError(`Failed to reject: ${error.message || "Unknown error"}`);
      if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
  });

  $("btnOpenOfferDraft")?.addEventListener("click", () => {
    const requestId = currentRequest?.id;
    if (!requestId) return;
    window.location.href = `offer-draft.html?requestId=${encodeURIComponent(requestId)}`;
  });
}

// ============================
// Main
// ============================
(async function main() {
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm";
  loadingIndicator.innerHTML = `
    <div class="text-center">
      <div class="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
           style="border-color: #54c0e8; border-top-color: transparent;"></div>
      <div class="text-sm text-slate-600">Loading request details...</div>
    </div>
  `;
  document.body.appendChild(loadingIndicator);

  try {
    await loadSession();
    bindActionsOnce();
    await loadData();
  } catch (error) {
    setError(`Error loading data: ${error.message}`);
  } finally {
    loadingIndicator.remove();
  }
})();
