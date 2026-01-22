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

      btnRetry.disabled = true;
      btnRetry.textContent = "Creating...";

      const r = await apiPost(`/api/projects/from-request/${encodeURIComponent(requestId)}`, {});
      btnRetry.disabled = false;
      btnRetry.textContent = "Retry Create Project";

      if (!r?.ok) {
        return setError(`${r.error}\n${r.details || ""}`);
      }

      currentProject = r.data || null;
      render();
      alert("Project created ✅");
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

      btnCancel.disabled = true;
      btnCancel.textContent = "Cancelling...";

      const r = await apiPost(`/api/projects/${encodeURIComponent(currentProject.id)}/cancel`, { reason });

      btnCancel.disabled = false;
      btnCancel.textContent = "Cancel Project";

      if (!r?.ok) return setError(`${r.error}\n${r.details || ""}`);

      currentProject = r.data;
      render();
      alert("Cancelled ✅");
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

  // Status badge
  const statusElement = $("reqStatus");
  if (statusElement) {
    const status = (req.status || "N/A").toUpperCase();
    statusElement.textContent = status;
    statusElement.className = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold";

    if (status.includes("PENDING")) {
      statusElement.classList.add("bg-amber-50", "text-amber-700", "border-amber-300");
      statusElement.innerHTML = `<span>⏱</span><span>${status}</span>`;
    } else if (status.includes("ACCEPTED") || status.includes("APPROVED")) {
      statusElement.classList.add("bg-emerald-50", "text-emerald-700", "border-emerald-300");
      statusElement.innerHTML = `<span>✓</span><span>${status}</span>`;
    } else if (status.includes("REJECTED") || status.includes("DECLINED")) {
      statusElement.classList.add("bg-red-50", "text-red-700", "border-red-300");
      statusElement.innerHTML = `<span>✕</span><span>${status}</span>`;
    } else {
      statusElement.classList.add("bg-slate-50", "text-slate-700", "border-slate-300");
      statusElement.innerHTML = `<span>📋</span><span>${status}</span>`;
    }
  }

  setText("serviceType", req.service_type || "N/A");
  setText("priority", req.priority || "N/A");
  setText("createdAt", fmtDate(req.created_at));
  setText("title", req.title || "N/A");
  setText("description", req.description || "N/A");

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

    const r = await apiPost(`/api/service-requests/${encodeURIComponent(id)}/review`, { decision: "ACCEPT" });

    if (btn) { btn.textContent = originalText; btn.disabled = false; }

    if (!r.ok) return setError(`${r.error}\n${r.details || ""}`);
    await loadData();
    alert("Accepted ✅");
  });

  $("btnRejectConfirm")?.addEventListener("click", async () => {
    const id = currentRequest?.id;
    if (!id) return;

    const reason = ($("rejectReason")?.value || "").trim();
    if (!reason) return alert("Reject reason is required.");

    const btn = $("btnRejectConfirm");
    const originalText = btn?.textContent || "Reject";
    if (btn) { btn.textContent = "Processing..."; btn.disabled = true; }

    const r = await apiPost(`/api/service-requests/${encodeURIComponent(id)}/review`, { decision: "REJECT", reason });

    if (btn) { btn.textContent = originalText; btn.disabled = false; }

    if (!r.ok) return setError(`${r.error}\n${r.details || ""}`);
    await loadData();
    alert("Rejected ❌");
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
