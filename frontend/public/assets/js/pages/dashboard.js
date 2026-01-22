import { clearAuth, requireAuthOrRedirect } from "../auth.js";
import { apiGet, apiDelete, apiPatch } from "../api.js";

function $(id) { return document.getElementById(id); }

// =========================
// Toast System
// =========================
function toast(msg, type = "success") {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove("hidden");
  setTimeout(() => {
    t.classList.add("hidden");
    setTimeout(() => t.className = "toast hidden", 300);
  }, 3000);
}

// =========================
// State Management
// =========================
let allRequests = [];
let filteredRequests = [];
let currentPage = 1;
let pageSize = 25;
let lastRefreshTime = null;

// Projects state
let allProjects = [];
let filteredProjects = [];
let currentPageProjects = 1;
let pageSizeProjects = 25;
let lastRefreshTimeProjects = null;
let activeTab = "requests";

// =========================
// Utility Functions
// =========================
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(msg) {
  const box = $("errorBox");
  if (!box) return;
  box.textContent = msg || "";
  box.classList.toggle("hidden", !msg);
}

function setLoading(isLoading) {
  const skeleton = $("skeletonRows");
  const tableWrapper = $("rows")?.closest(".overflow-x-auto");
  if (skeleton) skeleton.classList.toggle("hidden", !isLoading);
  if (tableWrapper) tableWrapper.classList.toggle("hidden", isLoading);
  if (isLoading) {
    setEmpty(true);
    const pagination = $("pagination");
    if (pagination) pagination.classList.add("hidden");
  }
}

function setEmpty(isEmpty) {
  const empty = $("empty");
  if (empty) empty.classList.toggle("hidden", !isEmpty);
}

function fmtDate(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return String(x);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// =========================
// Status & Priority Pills
// =========================
function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  let bg = "bg-slate-100";
  let text = "text-slate-700";
  let border = "border-slate-300";

  if (s === "PENDING_REVIEW") {
    bg = "bg-blue-50";
    text = "text-blue-700";
    border = "border-blue-300";
  } else if (s === "CONSULTANT_ACCEPTED") {
    bg = "bg-green-50";
    text = "text-green-700";
    border = "border-green-300";
  } else if (s === "CONSULTANT_REJECTED") {
    bg = "bg-red-50";
    text = "text-red-700";
    border = "border-red-300";
  }

  const displayText = s.replace(/_/g, " ");
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${bg} ${text} ${border}">${escapeHtml(displayText || "-")}</span>`;
}

function priorityBadge(priority) {
  if (!priority) return "-";
  const p = String(priority).toUpperCase();
  let bg = "bg-slate-100";
  let text = "text-slate-700";

  if (p === "HIGH" || p === "URGENT") {
    bg = "bg-orange-50";
    text = "text-orange-700";
  } else if (p === "NORMAL" || p === "MEDIUM") {
    bg = "bg-blue-50";
    text = "text-blue-700";
  } else if (p === "LOW") {
    bg = "bg-slate-50";
    text = "text-slate-600";
  }

  return `<span class="inline-flex items-center rounded-full ${bg} ${text} px-2.5 py-1 text-xs font-medium">${escapeHtml(p)}</span>`;
}

// =========================
// URL Persistence
// =========================
function syncFiltersToUrl() {
  const params = new URLSearchParams();
  const status = $("filterStatus")?.value || "";
  const service = $("filterServiceType")?.value || "";
  const q = $("filterQ")?.value || "";
  const sort = $("filterSort")?.value || "created_desc";
  const page = currentPage > 1 ? currentPage : "";
  const size = pageSize !== 25 ? pageSize : "";

  if (status) params.set("status", status);
  if (service) params.set("service", service);
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  if (page) params.set("page", page);
  if (size) params.set("size", size);

  const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
  window.history.replaceState({}, "", newUrl);
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if ($("filterStatus")) $("filterStatus").value = params.get("status") || "";
  if ($("filterServiceType")) $("filterServiceType").value = params.get("service") || "";
  if ($("filterQ")) $("filterQ").value = params.get("q") || "";
  if ($("filterSort")) $("filterSort").value = params.get("sort") || "created_desc";
  currentPage = parseInt(params.get("page") || "1", 10);
  pageSize = parseInt(params.get("size") || "25", 10);
  if ($("pageSize")) $("pageSize").value = String(pageSize);
}

// =========================
// Filters & Sorting
// =========================
function applyFiltersAndSort() {
  let filtered = [...allRequests];

  // Filter by status
  const status = ($("filterStatus")?.value || "").trim();
  if (status) {
    filtered = filtered.filter(r => String(r.status || "").toUpperCase() === status.toUpperCase());
  }

  // Filter by service type
  const service = ($("filterServiceType")?.value || "").trim().toLowerCase();
  if (service) {
    filtered = filtered.filter(r =>
      String(r.service_type || "").toLowerCase().includes(service)
    );
  }

  // Filter by search query
  const q = ($("filterQ")?.value || "").trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(r => {
      const ref = String(r.reference_no || r.reference || r.ref_no || "").toLowerCase();
      const title = String(r.title || r.subject || "").toLowerCase();
      return ref.includes(q) || title.includes(q);
    });
  }

  // Sort
  const sort = $("filterSort")?.value || "created_desc";
  filtered.sort((a, b) => {
    if (sort === "created_desc") {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return db - da;
    } else if (sort === "created_asc") {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return da - db;
    } else if (sort === "priority_desc") {
      const priOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, MEDIUM: 2, LOW: 1 };
      const pa = priOrder[String(a.priority || "").toUpperCase()] || 0;
      const pb = priOrder[String(b.priority || "").toUpperCase()] || 0;
      return pb - pa;
    } else if (sort === "priority_asc") {
      const priOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, MEDIUM: 2, LOW: 1 };
      const pa = priOrder[String(a.priority || "").toUpperCase()] || 0;
      const pb = priOrder[String(b.priority || "").toUpperCase()] || 0;
      return pa - pb;
    } else if (sort === "status") {
      return String(a.status || "").localeCompare(String(b.status || ""));
    }
    return 0;
  });

  filteredRequests = filtered;
  syncFiltersToUrl();
}

// =========================
// KPIs
// =========================
function renderKpis() {
  const total = allRequests.length;
  const pending = allRequests.filter(r => String(r.status || "").toUpperCase() === "PENDING_REVIEW").length;
  const accepted = allRequests.filter(r => String(r.status || "").toUpperCase() === "CONSULTANT_ACCEPTED").length;
  const rejected = allRequests.filter(r => String(r.status || "").toUpperCase() === "CONSULTANT_REJECTED").length;

  safeSetText("kpiTotal", total);
  safeSetText("kpiPending", pending);
  safeSetText("kpiAccepted", accepted);
  safeSetText("kpiRejected", rejected);
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "0";
}

// =========================
// Table Rendering
// =========================
function renderTable(page = 1) {
  const tbody = $("rows");
  if (!tbody) return;

  applyFiltersAndSort();

  const total = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(Math.max(1, page), totalPages);

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = filteredRequests.slice(start, end);

  tbody.innerHTML = "";

  if (pageData.length === 0) {
    setEmpty(true);
    if ($("pagination")) $("pagination").classList.add("hidden");
    return;
  }

  setEmpty(false);
  if ($("pagination")) $("pagination").classList.remove("hidden");

  for (const r of pageData) {
    const id = r.id;
    const ref = r.reference_no || r.reference || r.ref_no || id;
    const title = r.title || r.subject || "-";
    const svc = r.service_type || "-";
    const pri = r.priority || "";
    const status = r.status || "-";
    const created = r.created_at || r.createdAt || null;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/50 cursor-pointer transition-colors";
    tr.addEventListener("click", (e) => {
      if (!e.target.closest("a")) {
        window.location.href = `request-details.html?id=${encodeURIComponent(id)}`;
      }
    });

    // Check if user can edit/delete (Manager or Admin only)
    const canEdit = window.currentUserRole && (window.currentUserRole.toUpperCase() === "MANAGER" || window.currentUserRole.toUpperCase() === "ADMIN");
    const canDelete = canEdit;

    tr.innerHTML = `
      <td class="px-4 md:px-5 py-3">
        <div class="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg inline-block bg-slate-50 text-slate-700 border border-slate-200">
          ${escapeHtml(ref)}
        </div>
      </td>
      <td class="px-4 md:px-5 py-3 font-medium text-slate-700">${escapeHtml(title)}</td>
      <td class="px-4 md:px-5 py-3 text-slate-600">${escapeHtml(svc)}</td>
      <td class="px-4 md:px-5 py-3">${priorityBadge(pri)}</td>
      <td class="px-4 md:px-5 py-3">${statusBadge(status)}</td>
      <td class="px-4 md:px-5 py-3 text-slate-500 text-xs whitespace-nowrap">${escapeHtml(fmtDate(created))}</td>
      <td class="px-4 md:px-5 py-3 text-right">
        <div class="flex items-center gap-2 justify-end">
          <a class="btn-secondary text-xs px-3 py-1.5 inline-flex items-center"
             href="request-details.html?id=${encodeURIComponent(id)}"
             onclick="event.stopPropagation()">
            View →
          </a>
          ${canEdit ? `
          <button class="btn-edit text-xs px-3 py-1.5 inline-flex items-center text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                  data-request-id="${escapeHtml(id)}"
                  data-request-ref="${escapeHtml(ref)}"
                  onclick="event.stopPropagation(); handleEditRequest(event)"
                  title="Edit request">
            ✏️ Edit
          </button>
          ` : ''}
          ${canDelete ? `
          <button class="btn-delete text-xs px-3 py-1.5 inline-flex items-center text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                  data-request-id="${escapeHtml(id)}"
                  data-request-ref="${escapeHtml(ref)}"
                  onclick="event.stopPropagation(); handleDeleteRequest(event)"
                  title="Delete request">
            🗑️
          </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  renderPagination(total, totalPages);
}

function renderPagination(total, totalPages) {
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  safeSetText("currentPage", currentPage);
  safeSetText("totalPages", totalPages);
  safeSetText("pageInfo", `Showing ${start + 1}-${end} of ${total}`);

  const btnPrev = $("btnPrevPage");
  const btnNext = $("btnNextPage");
  if (btnPrev) btnPrev.disabled = currentPage === 1;
  if (btnNext) btnNext.disabled = currentPage >= totalPages;
}

// =========================
// CSV Export
// =========================
function exportCsv() {
  applyFiltersAndSort();
  if (filteredRequests.length === 0) {
    toast("No data to export", "error");
    return;
  }

  const headers = ["Reference", "Title", "Service Type", "Priority", "Status", "Created"];
  const rows = filteredRequests.map(r => [
    r.reference_no || r.reference || r.ref_no || r.id || "",
    r.title || r.subject || "",
    r.service_type || "",
    r.priority || "",
    r.status || "",
    r.created_at ? new Date(r.created_at).toLocaleString() : ""
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `service-requests-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast(`Exported ${filteredRequests.length} requests`, "success");
}

// =========================
// Data Loading
// =========================
async function fetchRequests() {
  setError("");
  setLoading(true);

  try {
    const res = await apiGet("/api/service-requests");

    if (!res.ok) {
      if (res.details?.includes("401") || res.details?.includes("Unauthorized")) {
        clearAuth();
        window.location.href = "login.html?msg=Session expired";
        return;
      }
      const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
      setError(`${res.error || "Failed to load requests"}${details ? " — " + details : ""}`);
      console.error("API Error:", res);
      allRequests = [];
      renderKpis();
      renderTable(1);
      return;
    }

    allRequests = Array.isArray(res.data) ? res.data : (res.data?.items || []);
    lastRefreshTime = new Date();
    updateLastRefresh();
    renderKpis();
    renderTable(currentPage);
  } catch (error) {
    console.error("Fetch error:", error);
    setError("Network error. Please check your connection.");
    allRequests = [];
    renderKpis();
    renderTable(1);
  } finally {
    setLoading(false);
  }
}

function updateLastRefresh() {
  const el = $("lastRefresh");
  if (!el || !lastRefreshTime) return;
  const timeStr = lastRefreshTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  el.textContent = `Last refreshed: ${timeStr}`;
}

// =========================
// Tab Management
// =========================
function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const sections = {
    requests: $("tab-requests"),
    projects: $("tab-projects"),
  };

  function activate(key) {
    activeTab = key;
    buttons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(sections).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== key);
    });
  }

  buttons.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.tab)));
  activate("requests");
}

// Load projects when tab is activated
function setupTabChangeListener() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.tab === "projects" && allProjects.length === 0) {
        await fetchProjects();
      }
    });
  });
}

// =========================
// Projects Functions
// =========================
function projectStatusBadge(status) {
  const s = String(status || "").toUpperCase();
  let bg = "bg-slate-100";
  let text = "text-slate-700";
  let border = "border-slate-300";

  if (s === "ACTIVE") {
    bg = "bg-green-50";
    text = "text-green-700";
    border = "border-green-300";
  } else if (s === "DRAFT") {
    bg = "bg-blue-50";
    text = "text-blue-700";
    border = "border-blue-300";
  } else if (s === "CLOSED") {
    bg = "bg-emerald-50";
    text = "text-emerald-700";
    border = "border-emerald-300";
  } else if (s === "ARCHIVED") {
    bg = "bg-red-50";
    text = "text-red-700";
    border = "border-red-300";
  }

  const displayText = s.replace(/_/g, " ");
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${bg} ${text} ${border}">${escapeHtml(displayText || "-")}</span>`;
}

function applyProjectsFiltersAndSort() {
  let filtered = [...allProjects];

  const status = ($("filterProjectsStatus")?.value || "").trim();
  if (status) {
    filtered = filtered.filter(p => String(p.status || "").toUpperCase() === status.toUpperCase());
  }

  const q = ($("filterProjectsQ")?.value || "").trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(p => {
      const name = String(p.name || "").toLowerCase();
      const code = String(p.project_code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }

  const sort = $("filterProjectsSort")?.value || "created_desc";
  filtered.sort((a, b) => {
    if (sort === "created_desc") {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return db - da;
    } else if (sort === "created_asc") {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return da - db;
    } else if (sort === "name") {
      return String(a.name || "").localeCompare(String(b.name || ""));
    } else if (sort === "status") {
      return String(a.status || "").localeCompare(String(b.status || ""));
    }
    return 0;
  });

  filteredProjects = filtered;
}

function renderProjectsTable(page = 1) {
  const tbody = $("projectsRows");
  if (!tbody) return;

  applyProjectsFiltersAndSort();

  const total = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSizeProjects));
  currentPageProjects = Math.min(Math.max(1, page), totalPages);

  const start = (currentPageProjects - 1) * pageSizeProjects;
  const end = Math.min(start + pageSizeProjects, total);
  const pageData = filteredProjects.slice(start, end);

  tbody.innerHTML = "";

  const emptyEl = $("emptyProjects");
  const paginationEl = $("paginationProjects");
  const tableWrapper = tbody.closest(".overflow-x-auto");

  if (pageData.length === 0) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (paginationEl) paginationEl.classList.add("hidden");
    if (tableWrapper) tableWrapper.classList.add("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");
  if (paginationEl) paginationEl.classList.remove("hidden");
  if (tableWrapper) tableWrapper.classList.remove("hidden");

  for (const p of pageData) {
    const id = p.id;
    const code = p.project_code || "-";
    const name = p.name || "-";
    const status = p.status || "-";
    const value = p.value_sar || p.project_value || 0;
    const created = p.created_at || null;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/50 cursor-pointer transition-colors";
    tr.addEventListener("click", (e) => {
      if (!e.target.closest("a")) {
        window.location.href = `project-details.html?id=${encodeURIComponent(id)}`;
      }
    });

    tr.innerHTML = `
      <td class="px-4 md:px-5 py-3">
        <div class="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg inline-block bg-slate-50 text-slate-700 border border-slate-200">
          ${escapeHtml(code)}
        </div>
      </td>
      <td class="px-4 md:px-5 py-3 font-medium text-slate-700">${escapeHtml(name)}</td>
      <td class="px-4 md:px-5 py-3">${projectStatusBadge(status)}</td>
      <td class="px-4 md:px-5 py-3 text-slate-600">${value ? new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(value) : "-"}</td>
      <td class="px-4 md:px-5 py-3 text-slate-500 text-xs whitespace-nowrap">${escapeHtml(fmtDate(created))}</td>
      <td class="px-4 md:px-5 py-3 text-right">
        <a class="btn-secondary text-xs px-3 py-1.5 inline-flex items-center"
           href="project-details.html?id=${encodeURIComponent(id)}"
           onclick="event.stopPropagation()">
          View →
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  }

  const startIdx = (currentPageProjects - 1) * pageSizeProjects;
  const endIdx = Math.min(startIdx + pageSizeProjects, total);
  safeSetText("currentPageProjects", currentPageProjects);
  safeSetText("totalPagesProjects", totalPages);
  safeSetText("pageInfoProjects", `Showing ${startIdx + 1}-${endIdx} of ${total}`);

  const btnPrev = $("btnPrevPageProjects");
  const btnNext = $("btnNextPageProjects");
  if (btnPrev) btnPrev.disabled = currentPageProjects === 1;
  if (btnNext) btnNext.disabled = currentPageProjects >= totalPages;
}

async function fetchProjects() {
  const errorBox = $("errorBoxProjects");
  if (errorBox) errorBox.classList.add("hidden");

  const skeleton = $("skeletonProjectsRows");
  const tableWrapper = $("projectsRows")?.closest(".overflow-x-auto");
  if (skeleton) skeleton.classList.remove("hidden");
  if (tableWrapper) tableWrapper.classList.add("hidden");
  if ($("emptyProjects")) $("emptyProjects").classList.add("hidden");
  if ($("paginationProjects")) $("paginationProjects").classList.add("hidden");

  try {
    const res = await apiGet("/api/projects");

    if (!res.ok) {
      if (res.details?.includes("401") || res.details?.includes("Unauthorized")) {
        clearAuth();
        window.location.href = "login.html?msg=Session expired";
        return;
      }
      const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
      if (errorBox) {
        errorBox.textContent = `${res.error || "Failed to load projects"}${details ? " — " + details : ""}`;
        errorBox.classList.remove("hidden");
      }
      console.error("API Error:", res);
      allProjects = [];
      renderProjectsTable(1);
      return;
    }

    allProjects = Array.isArray(res.data) ? res.data : [];
    lastRefreshTimeProjects = new Date();
    const refreshEl = $("lastRefreshProjects");
    if (refreshEl && lastRefreshTimeProjects) {
      const timeStr = lastRefreshTimeProjects.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      refreshEl.textContent = `Last refreshed: ${timeStr}`;
    }
    renderProjectsTable(currentPageProjects);
  } catch (error) {
    console.error("Fetch error:", error);
    if (errorBox) {
      errorBox.textContent = "Network error. Please check your connection.";
      errorBox.classList.remove("hidden");
    }
    allProjects = [];
    renderProjectsTable(1);
  } finally {
    if (skeleton) skeleton.classList.add("hidden");
  }
}

function clearProjectsFilters() {
  if ($("filterProjectsStatus")) $("filterProjectsStatus").value = "";
  if ($("filterProjectsQ")) $("filterProjectsQ").value = "";
  if ($("filterProjectsSort")) $("filterProjectsSort").value = "created_desc";
  currentPageProjects = 1;
  if ($("pageSizeProjects")) $("pageSizeProjects").value = "25";
  pageSizeProjects = 25;
  renderProjectsTable(1);
}

function exportProjectsCsv() {
  applyProjectsFiltersAndSort();
  if (filteredProjects.length === 0) {
    toast("No data to export", "error");
    return;
  }

  const headers = ["Project Code", "Name", "Status", "Value (SAR)", "Created"];
  const rows = filteredProjects.map(p => [
    p.project_code || "",
    p.name || "",
    p.status || "",
    p.value_sar || p.project_value || 0,
    p.created_at ? new Date(p.created_at).toLocaleString() : ""
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `projects-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast(`Exported ${filteredProjects.length} projects`, "success");
}

// =========================
// Clear Filters
// =========================
function clearFilters() {
  if ($("filterStatus")) $("filterStatus").value = "";
  if ($("filterServiceType")) $("filterServiceType").value = "";
  if ($("filterQ")) $("filterQ").value = "";
  if ($("filterSort")) $("filterSort").value = "created_desc";
  currentPage = 1;
  if ($("pageSize")) $("pageSize").value = "25";
  pageSize = 25;
  syncFiltersToUrl();
  renderTable(1);
}

// =========================
// Initialization
// =========================
(async function init() {
  try {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    // Store user role globally for delete button visibility
    window.currentUserRole = user.role || "";

    // User chip
    const userNameEl = $("userName");
    const userRoleEl = $("userRole");
    if (userNameEl) userNameEl.textContent = user.full_name || user.email || "User";
    if (userRoleEl) {
      userRoleEl.textContent = user.role || "-";
      userRoleEl.className = "status-badge status-ACTIVE text-xs";
    }

    // Read filters from URL
    readFiltersFromUrl();

    // Event listeners
    $("btnLogout")?.addEventListener("click", () => {
      clearAuth();
      window.location.href = "login.html";
    });

    $("btnRefresh")?.addEventListener("click", () => {
      fetchRequests();
      toast("Refreshing...", "info");
    });

    $("btnExport")?.addEventListener("click", exportCsv);

    $("btnClearFilters")?.addEventListener("click", clearFilters);

    const debouncedSearch = debounce(() => {
      currentPage = 1;
      renderTable(1);
    }, 300);

    $("filterStatus")?.addEventListener("change", () => {
      currentPage = 1;
      renderTable(1);
    });
    $("filterServiceType")?.addEventListener("input", debouncedSearch);
    $("filterQ")?.addEventListener("input", debouncedSearch);
    $("filterSort")?.addEventListener("change", () => {
      currentPage = 1;
      renderTable(1);
    });

    $("pageSize")?.addEventListener("change", (e) => {
      pageSize = parseInt(e.target.value, 10);
      currentPage = 1;
      renderTable(1);
    });

    $("btnPrevPage")?.addEventListener("click", () => {
      if (currentPage > 1) renderTable(currentPage - 1);
    });

    $("btnNextPage")?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
      if (currentPage < totalPages) renderTable(currentPage + 1);
    });

    // Tab switching
    setupTabs();
    setupTabChangeListener();

    // Projects event listeners
    $("btnRefreshProjects")?.addEventListener("click", () => {
      fetchProjects();
      toast("Refreshing projects...", "info");
    });

    $("btnExportProjects")?.addEventListener("click", exportProjectsCsv);

    $("btnClearProjectsFilters")?.addEventListener("click", clearProjectsFilters);

    const debouncedProjectsSearch = debounce(() => {
      currentPageProjects = 1;
      renderProjectsTable(1);
    }, 300);

    $("filterProjectsStatus")?.addEventListener("change", () => {
      currentPageProjects = 1;
      renderProjectsTable(1);
    });
    $("filterProjectsQ")?.addEventListener("input", debouncedProjectsSearch);
    $("filterProjectsSort")?.addEventListener("change", () => {
      currentPageProjects = 1;
      renderProjectsTable(1);
    });

    $("pageSizeProjects")?.addEventListener("change", (e) => {
      pageSizeProjects = parseInt(e.target.value, 10);
      currentPageProjects = 1;
      renderProjectsTable(1);
    });

    $("btnPrevPageProjects")?.addEventListener("click", () => {
      if (currentPageProjects > 1) renderProjectsTable(currentPageProjects - 1);
    });

    $("btnNextPageProjects")?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSizeProjects));
      if (currentPageProjects < totalPages) renderProjectsTable(currentPageProjects + 1);
    });

    // Initial load
    await fetchRequests();
  } catch (error) {
    console.error("Init error:", error);
    setError("Failed to initialize dashboard");
  }
})();

// =========================
// Delete Request Handler
// =========================
async function handleDeleteRequest(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const requestId = button.getAttribute("data-request-id");
  const requestRef = button.getAttribute("data-request-ref") || requestId;

  if (!requestId) {
    toast("Error: Request ID not found", "error");
    return;
  }

  // Confirm deletion
  const confirmMessage = `هل أنت متأكد من حذف الطلب ${requestRef}؟\n\nهذا الإجراء لا يمكن التراجع عنه.\n\nAre you sure you want to delete request ${requestRef}?\n\nThis action cannot be undone.`;
  if (!confirm(confirmMessage)) {
    return;
  }

  // Disable button during deletion
  button.disabled = true;
  const originalText = button.innerHTML;
  button.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 border-2 rounded-full animate-spin"
           style="border-color: currentColor; border-top-color: transparent;"></div>
      Processing...
    </div>
  `;

  try {
    const res = await apiDelete(`/api/service-requests/${encodeURIComponent(requestId)}`);

    if (!res.ok) {
      const errorMsg = res.details || res.error || "Failed to delete request";
      toast(`خطأ: ${errorMsg} / Error: ${errorMsg}`, "error");
      return;
    }

    // Success - remove from list and refresh
    toast(`تم حذف الطلب ${requestRef} بنجاح / Request ${requestRef} deleted successfully`, "success");

    // Remove from local arrays
    allRequests = allRequests.filter(r => r.id !== requestId);
    filteredRequests = filteredRequests.filter(r => r.id !== requestId);

    // Refresh display
    renderKpis();
    renderTable(currentPage);
  } catch (error) {
    console.error("Delete error:", error);
    toast(`خطأ: ${error.message || "فشل حذف الطلب"} / Error: ${error.message || "Failed to delete request"}`, "error");
  } finally {
    // Always restore button state
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

// Make function globally available
window.handleDeleteRequest = handleDeleteRequest;

// =========================
// Edit Request Handler
// =========================
async function handleEditRequest(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const requestId = button.getAttribute("data-request-id");
  const requestRef = button.getAttribute("data-request-ref") || requestId;

  if (!requestId) {
    toast("Error: Request ID not found", "error");
    return;
  }

  // Find the request data
  const request = allRequests.find(r => r.id === requestId);
  if (!request) {
    toast("Error: Request data not found", "error");
    return;
  }

  // Show edit modal
  showEditModal(request);
}

function showEditModal(request) {
  // Create or get modal
  let modal = document.getElementById("editRequestModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "editRequestModal";
    modal.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gradient-primary px-6 py-4 rounded-t-2xl">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-white">Edit Request / تعديل الطلب</h2>
            <button id="closeEditModal" class="text-white hover:text-slate-200 text-2xl font-bold">&times;</button>
          </div>
        </div>
        <div class="p-6 space-y-4">
          <div id="editRequestError" class="hidden rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"></div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Title / العنوان *</label>
            <input id="editRequestTitle" type="text"
                   class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Request title..." required />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Description / الوصف</label>
            <textarea id="editRequestDescription" rows="4"
                     class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="Request description..."></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Service Type / نوع الخدمة</label>
              <input id="editRequestServiceType" type="text"
                     class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="e.g. EIA, Consulting..." />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Priority / الأولوية *</label>
              <select id="editRequestPriority"
                      class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="LOW">Low / منخفض</option>
                <option value="NORMAL">Normal / عادي</option>
                <option value="MEDIUM">Medium / متوسط</option>
                <option value="HIGH">High / عالي</option>
                <option value="URGENT">Urgent / عاجل</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Requester Name / اسم الطالب</label>
              <input id="editRequestRequesterName" type="text"
                     class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="Name..." />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Requester Email / البريد الإلكتروني</label>
              <input id="editRequestRequesterEmail" type="email"
                     class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="email@example.com" />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Requester Phone / الهاتف</label>
              <input id="editRequestRequesterPhone" type="tel"
                     class="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     placeholder="+966..." />
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-slate-200">
            <button id="saveEditRequest" class="flex-1 btn-primary px-6 py-2.5 text-sm font-semibold">
              Save Changes / حفظ التغييرات
            </button>
            <button id="cancelEditRequest" class="btn-secondary px-6 py-2.5 text-sm font-semibold">
              Cancel / إلغاء
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Bind close handlers
    document.getElementById("closeEditModal")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    document.getElementById("cancelEditRequest")?.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });

    // Bind save handler
    document.getElementById("saveEditRequest")?.addEventListener("click", async () => {
      await saveEditRequest();
    });
  }

  // Populate form with current data
  const titleInput = document.getElementById("editRequestTitle");
  const descInput = document.getElementById("editRequestDescription");
  const serviceInput = document.getElementById("editRequestServiceType");
  const prioritySelect = document.getElementById("editRequestPriority");
  const nameInput = document.getElementById("editRequestRequesterName");
  const emailInput = document.getElementById("editRequestRequesterEmail");
  const phoneInput = document.getElementById("editRequestRequesterPhone");

  if (titleInput) titleInput.value = request.title || "";
  if (descInput) descInput.value = request.description || "";
  if (serviceInput) serviceInput.value = request.service_type || "";
  if (prioritySelect) prioritySelect.value = (request.priority || "NORMAL").toUpperCase();
  if (nameInput) nameInput.value = request.requester_name || "";
  if (emailInput) emailInput.value = request.requester_email || "";
  if (phoneInput) phoneInput.value = request.requester_phone || "";

  // Store request ID for save
  modal.dataset.requestId = request.id;

  // Show modal
  modal.classList.remove("hidden");
  if (titleInput) titleInput.focus();
}

async function saveEditRequest() {
  const modal = document.getElementById("editRequestModal");
  if (!modal) return;

  const requestId = modal.dataset.requestId;
  if (!requestId) {
    toast("Error: Request ID not found", "error");
    return;
  }

  const titleInput = document.getElementById("editRequestTitle");
  const descInput = document.getElementById("editRequestDescription");
  const serviceInput = document.getElementById("editRequestServiceType");
  const prioritySelect = document.getElementById("editRequestPriority");
  const nameInput = document.getElementById("editRequestRequesterName");
  const emailInput = document.getElementById("editRequestRequesterEmail");
  const phoneInput = document.getElementById("editRequestRequesterPhone");
  const errorBox = document.getElementById("editRequestError");

  // Validate
  const title = (titleInput?.value || "").trim();
  if (!title) {
    if (errorBox) {
      errorBox.textContent = "Title is required / العنوان مطلوب";
      errorBox.classList.remove("hidden");
    }
    if (titleInput) titleInput.focus();
    return;
  }

  // Hide error
  if (errorBox) errorBox.classList.add("hidden");

  // Build payload
  const payload = {
    title,
    description: (descInput?.value || "").trim() || null,
    service_type: (serviceInput?.value || "").trim() || null,
    priority: (prioritySelect?.value || "NORMAL").toUpperCase(),
    requester_name: (nameInput?.value || "").trim() || null,
    requester_email: (emailInput?.value || "").trim() || null,
    requester_phone: (phoneInput?.value || "").trim() || null,
  };

  // Disable save button
  const saveBtn = document.getElementById("saveEditRequest");
  const originalText = saveBtn?.textContent || "Save";
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const res = await apiPatch(`/api/service-requests/${encodeURIComponent(requestId)}`, payload);

    if (!res.ok) {
      const errorMsg = res.details || res.error || "Failed to update request";
      if (errorBox) {
        errorBox.textContent = `Error: ${errorMsg}`;
        errorBox.classList.remove("hidden");
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
      return;
    }

    // Success
    toast(`Request ${requestId.substring(0, 8)}... updated successfully / تم تحديث الطلب بنجاح`, "success");

    // Update local data
    const index = allRequests.findIndex(r => r.id === requestId);
    if (index !== -1) {
      allRequests[index] = { ...allRequests[index], ...res.data };
    }

    // Refresh display
    renderKpis();
    renderTable(currentPage);

    // Close modal
    modal.classList.add("hidden");
  } catch (error) {
    console.error("Edit request error:", error);
    if (errorBox) {
      errorBox.textContent = `Error: ${error.message || "Failed to update request"}`;
      errorBox.classList.remove("hidden");
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }
}

// Make function globally available
window.handleEditRequest = handleEditRequest;
