import { API_BASE } from "../config.js";
import { requireAuthOrRedirect, getToken, getUser, logout } from "../auth.js";

// ============ Utility Functions ============
function qp(key) { return new URLSearchParams(window.location.search).get(key); }
function $(id) { return document.getElementById(id); }
function show(el, on = true) { if (el) el.classList.toggle("hidden", !on); }
function upper(x) { return String(x || "").toUpperCase(); }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// ============ UI Feedback ============
function setError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = `⚠️ ${String(msg || "Error")}`;
  box.classList.remove("hidden");
  box.classList.add("error-box");

  // Auto-hide after 5 seconds
  setTimeout(() => box.classList.add("hidden"), 5000);
}

function clearError() {
  const box = $("errorBox");
  if (box) box.classList.add("hidden");
}

let toastTimer = null;
function toast(msg, type = 'success') {
  const el = $("toast");
  if (!el) return;

  const icon = type === 'success' ? '✅' : '❌';
  el.textContent = `${icon} ${String(msg || "")}`;
  el.className = `toast ${type}`;
  el.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2500);
}

// ============ API Helpers ============
function normalizeBaseUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;
  return `${b}${p}`;
}

async function api(method, path, body) {
  const token = getToken();
  const url = normalizeBaseUrl(API_BASE, path);

  const headers = {};
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    cache: "no-store",
  });

  if (res.status === 401) {
    logout("login.html");
    throw new Error("Session expired. Please login again.");
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Bad response (no JSON)");
  if (json.ok === false) throw new Error(json.details || json.error || "Request failed");
  return json.data;
}

const apiGet = (p) => api("GET", p);
const apiPost = (p, b) => api("POST", p, b);
const apiPatch = (p, b) => api("PATCH", p, b);
const apiDel = (p) => api("DELETE", p);

// ============ State ============
let me = null;
let project = null;
let users = [];
let team = [];
let tasks = [];
let milestones = [];
let docs = [];
let partners = [];
let invoices = [];
let payments = [];

function canWrite() {
  const r = upper(me?.role);
  return r === "MANAGER" || r === "ADMIN";
}

function projectId() { return qp("id"); }

// ============ Tab Management ============
function setTab(tab) {
  const tabs = ["team", "timeline", "attachments", "partners", "invoices", "closing"];

  // Hide all tabs
  tabs.forEach(t => {
    const el = $(`tab-${t}`);
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("animate-fade-in");
    }
  });

  // Show selected tab with animation
  const selectedTab = $(`tab-${tab}`);
  if (selectedTab) {
    selectedTab.classList.remove("hidden");
    // Trigger animation
    setTimeout(() => selectedTab.classList.add("animate-fade-in"), 10);
  }

  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
}

// ============ Status Management ============
function fillStatusSelect(current) {
  const sel = $("selProjectStatus");
  if (!sel) return;

  const statuses = [
    { value: "DRAFT", label: "📝 Draft", color: "#94a3b8" },
    { value: "ACTIVE", label: "🟢 Active", color: "#4ca585" },
    { value: "ON_HOLD", label: "⏸️ On Hold", color: "#f59e0b" },
    { value: "COMPLETED", label: "✅ Completed", color: "#10b981" },
    { value: "CANCELLED", label: "❌ Cancelled", color: "#ef4444" },
    { value: "ARCHIVED", label: "📦 Archived", color: "#64748b" }
  ];

  const cur = upper(current || "");
  sel.innerHTML = statuses.map(s =>
    `<option value="${s.value}" ${s.value === cur ? "selected" : ""}>${s.label}</option>`
  ).join("");
}

function renderManagerSelect() {
  const sel = $("pmSelect");
  if (!sel) return;

  sel.innerHTML = `<option value="">— Not assigned —</option>` +
    users.map(u => {
      const label = `${u.full_name || u.email} (${upper(u.role || "USER")})`;
      return `<option value="${u.id}">${esc(label)}</option>`;
    }).join("");

  sel.value = project?.project_manager_user_id || "";
  sel.disabled = !canWrite();
}

// ============ Forms & KPIs ============
function formatCurrency(value, currency = 'SAR') {
  if (!value && value !== 0) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  return currency === 'SAR' ? `${formatted} SAR` : `$${formatted}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function fillBasicsForm() {
  // Header
  if ($("pName")) $("pName").textContent = project?.name || project?.title || "Untitled Project";
  if ($("pStatus")) {
    const status = $("pStatus");
    status.textContent = upper(project?.status || "DRAFT");
    status.className = `status-badge status-${upper(project?.status || "DRAFT")}`;
  }
  if ($("pCodeDisplay")) $("pCodeDisplay").textContent = project?.project_code || "—";
  if ($("pUpdatedDisplay")) {
    $("pUpdatedDisplay").textContent = project?.updated_at
      ? formatDate(project.updated_at)
      : formatDate(project?.created_at) || "—";
  }
  if ($("pDesc")) {
    $("pDesc").textContent = project?.description ||
      (project?.project_code ? `Project Code: ${project.project_code}` : "No description available");
  }

  // KPIs
  if ($("kpiValue")) $("kpiValue").textContent = formatCurrency(project?.project_value, project?.project_currency);
  if ($("kpiStartDate")) $("kpiStartDate").textContent = formatDate(project?.start_date);
  if ($("kpiEndDate")) $("kpiEndDate").textContent = formatDate(project?.target_end_date);
  if ($("kpiManager")) {
    const manager = users.find(u => u.id === project?.project_manager_user_id);
    $("kpiManager").textContent = manager?.full_name || manager?.email || "Not assigned";
  }
  if ($("kpiStatus")) $("kpiStatus").textContent = upper(project?.status || "DRAFT");

  // Form fields
  if ($("inpProjectName")) $("inpProjectName").value = project?.name || project?.title || "";
  if ($("inpProjectCode")) $("inpProjectCode").value = project?.project_code || "";
  if ($("inpProjectValue")) $("inpProjectValue").value = project?.project_value ?? "";
  if ($("selProjectCurrency")) $("selProjectCurrency").value = project?.project_currency || "SAR";
  if ($("inpStartDate")) $("inpStartDate").value = project?.start_date || "";
  if ($("inpTargetEndDate")) $("inpTargetEndDate").value = project?.target_end_date || "";
  if ($("inpDescription")) $("inpDescription").value = project?.description || "";

  fillStatusSelect(project?.status);

  // Disable fields if read-only
  const dis = !canWrite();
  ["inpProjectName", "inpProjectCode", "inpProjectValue", "selProjectCurrency",
   "inpStartDate", "inpTargetEndDate", "inpDescription", "selProjectStatus", "pmSelect"]
    .forEach(id => { if ($(id)) $(id).disabled = dis; });

  ["btnSaveBasics", "btnClose", "btnArchive", "btnAddTeam", "btnAddTask",
   "btnAddMilestone", "btnUpload", "btnAddPartner", "btnAddInvoice", "btnAddPayment"]
    .forEach(id => { if ($(id)) $(id).disabled = dis; });

  // Show read-only badge if applicable
  if ($("readOnlyBadge")) {
    show($("readOnlyBadge"), dis);
  }
}

// ============ Team Management ============
function renderTeamPicker() {
  const sel = $("teamPicker");
  if (!sel) return;

  const selected = new Set(team.map(m => m.user_id));
  sel.innerHTML = users.map(u => {
    const label = `${u.full_name || u.email} — ${upper(u.role || "USER")}`;
    const isSel = selected.has(u.id);
    return `<option value="${u.id}" ${isSel ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");

  sel.disabled = !canWrite();
}

function renderTeamTable() {
  const tbody = $("teamTbody");
  if (!tbody) return;

  if (!team.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500">
          <div class="text-4xl mb-2">👥</div>
          <div class="font-medium">No team members yet</div>
          <div class="text-sm mt-1">Add members to get started</div>
        </td>
      </tr>
    `;
    return;
  }

  const usersMap = new Map(users.map(u => [u.id, u]));

  tbody.innerHTML = team.map(m => {
    const prof = m.profiles || m.profile || usersMap.get(m.user_id) || {};
    const name = prof.full_name || prof.email || m.user_id;
    const email = prof.email || "—";
    const role = upper(prof.role || "USER");
    const rip = upper(m.role_in_project || "MEMBER");
    const mr = m.member_role || "—";

    const roleColors = {
      'ADMIN': 'bg-purple-100 text-purple-700 border-purple-200',
      'MANAGER': 'bg-blue-100 text-blue-700 border-blue-200',
      'USER': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    const ripColors = {
      'LEAD': 'bg-green-100 text-green-700 border-green-200',
      'MEMBER': 'bg-blue-100 text-blue-700 border-blue-200',
      'SUPPORT': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="font-semibold text-slate-900">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
              ${name.charAt(0).toUpperCase()}
            </div>
            ${esc(name)}
          </div>
        </td>
        <td class="text-slate-600">${esc(email)}</td>
        <td>
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[role] || roleColors['USER']}">
            ${esc(role)}
          </span>
        </td>
        <td>
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ripColors[rip] || ripColors['MEMBER']}">
            ${esc(rip)}
          </span>
        </td>
        <td class="text-slate-600">${esc(mr)}</td>
        <td class="text-right">
          ${canWrite() ? `
            <button class="btnRemove px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors" data-user="${m.user_id}">
              Remove
            </button>
          ` : `<span class="text-xs text-slate-400">Read-only</span>`}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btnRemove").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this team member?")) return;
      try {
        clearError();
        const uid = btn.getAttribute("data-user");
        await apiDel(`/api/project-execution/${encodeURIComponent(project.id)}/team/${encodeURIComponent(uid)}`);
        team = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/team`);
        renderTeamPicker();
        renderTeamTable();
        toast("Member removed successfully");
      } catch (e) {
        setError(e.message);
        toast(e.message, 'error');
      }
    });
  });
}

// ============ Tasks & Milestones ============
function renderTasksTable() {
  const tbody = $("tasksTbody");
  if (!tbody) return;

  if (!tasks.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500">
          <div class="text-4xl mb-2">📋</div>
          <div class="font-medium">No tasks yet</div>
          <div class="text-sm mt-1">Create your first task</div>
        </td>
      </tr>
    `;
    return;
  }

  const priorityIcons = {
    'LOW': '🟢',
    'NORMAL': '🟡',
    'HIGH': '🟠',
    'URGENT': '🔴'
  };

  tbody.innerHTML = tasks.map(t => {
    const st = upper(t.status || "TODO");
    const pr = upper(t.priority || "NORMAL");

    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="font-semibold text-slate-900">${esc(t.title || "—")}</td>
        <td><span class="chip">${esc(st)}</span></td>
        <td>
          <span class="inline-flex items-center gap-1 text-sm">
            ${priorityIcons[pr] || '⚪'}
            ${esc(pr)}
          </span>
        </td>
        <td class="text-slate-600">${formatDate(t.start_date)}</td>
        <td class="text-slate-600">${formatDate(t.due_date)}</td>
        <td class="text-right">
          ${canWrite() ? `
            <button class="btnDelTask px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors" data-id="${t.id}">
              Delete
            </button>
          ` : ""}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btnDelTask").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this task?")) return;
      try {
        clearError();
        const id = btn.getAttribute("data-id");
        await apiDel(`/api/project-execution/${encodeURIComponent(project.id)}/tasks/${encodeURIComponent(id)}`);
        tasks = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/tasks`);
        renderTasksTable();
        toast("Task deleted successfully");
      } catch (e) {
        setError(e.message);
        toast(e.message, 'error');
      }
    });
  });
}

function renderMilestonesTable() {
  const tbody = $("milestonesTbody");
  if (!tbody) return;

  if (!milestones.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500">
          <div class="text-4xl mb-2">🎯</div>
          <div class="font-medium">No milestones yet</div>
          <div class="text-sm mt-1">Set project milestones</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = milestones.map(m => {
    const st = upper(m.status || "PLANNED");
    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="font-semibold text-slate-900">${esc(m.title || "—")}</td>
        <td><span class="chip">${esc(st)}</span></td>
        <td class="text-slate-600">${formatDate(m.start_date)}</td>
        <td class="text-slate-600">${formatDate(m.end_date)}</td>
        <td class="text-slate-600 text-sm">${esc(m.notes || "—")}</td>
        <td class="text-right">
          ${canWrite() ? `
            <button class="btnDelMilestone px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors" data-id="${m.id}">
              Delete
            </button>
          ` : ""}
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btnDelMilestone").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this milestone?")) return;
      try {
        clearError();
        const id = btn.getAttribute("data-id");
        await apiDel(`/api/project-execution/${encodeURIComponent(project.id)}/milestones/${encodeURIComponent(id)}`);
        milestones = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/milestones`);
        renderMilestonesTable();
        toast("Milestone deleted successfully");
      } catch (e) {
        setError(e.message);
        toast(e.message, 'error');
      }
    });
  });
}

// ============ Event Bindings ============
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function bindSaveBasics() {
  $("btnSaveBasics")?.addEventListener("click", async () => {
    if (!canWrite()) return;

    try {
      clearError();
      const payload = {
        name: ($("inpProjectName")?.value || "").trim() || null,
        title: ($("inpProjectName")?.value || "").trim() || null,
        status: $("selProjectStatus")?.value || project.status,
        project_code: ($("inpProjectCode")?.value || "").trim() || null,
        project_manager_user_id: $("pmSelect")?.value || null,
        project_value: $("inpProjectValue")?.value === "" ? null : Number($("inpProjectValue")?.value),
        project_currency: $("selProjectCurrency")?.value || "SAR",
        start_date: $("inpStartDate")?.value || null,
        target_end_date: $("inpTargetEndDate")?.value || null,
        description: ($("inpDescription")?.value || "").trim() || null,
      };

      project = await apiPatch(`/api/project-execution/${encodeURIComponent(project.id)}`, payload);
      renderManagerSelect();
      fillBasicsForm();
      toast("Project updated successfully");
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    }
  });
}

function bindTeamActions() {
  $("btnAddTeam")?.addEventListener("click", async () => {
    if (!canWrite()) return;

    try {
      clearError();
      const sel = $("teamPicker");
      const selected = sel ? Array.from(sel.selectedOptions).map(o => o.value) : [];
      if (!selected.length) {
        toast("Please select at least one team member", 'error');
        return;
      }

      const role_in_project = $("roleInProject")?.value || "MEMBER";

      await apiPost(`/api/project-execution/${encodeURIComponent(project.id)}/team`, {
        user_ids: selected,
        role_in_project,
        member_role: null
      });

      team = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/team`);
      renderTeamPicker();
      renderTeamTable();
      toast("Team members added successfully");
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    }
  });
}

function bindTasksActions() {
  $("btnAddTask")?.addEventListener("click", async () => {
    if (!canWrite()) return;

    try {
      clearError();
      const title = ($("taskTitle")?.value || "").trim();
      if (!title) {
        toast("Task title is required", 'error');
        return;
      }

      await apiPost(`/api/project-execution/${encodeURIComponent(project.id)}/tasks`, {
        title,
        start_date: $("taskStart")?.value || null,
        due_date: $("taskDue")?.value || null,
        priority: $("taskPriority")?.value || "NORMAL",
        status: "TODO",
      });

      // Clear form
      if ($("taskTitle")) $("taskTitle").value = "";
      if ($("taskStart")) $("taskStart").value = "";
      if ($("taskDue")) $("taskDue").value = "";
      if ($("taskPriority")) $("taskPriority").value = "NORMAL";

      tasks = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/tasks`);
      renderTasksTable();
      toast("Task created successfully");
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    }
  });
}

function bindMilestonesActions() {
  document.addEventListener("click", async (ev) => {
    if (ev.target?.id !== "btnAddMilestone") return;
    if (!canWrite()) return;

    try {
      clearError();
      const title = ($("milestoneTitle")?.value || "").trim();
      if (!title) {
        toast("Milestone title is required", 'error');
        return;
      }

      await apiPost(`/api/project-execution/${encodeURIComponent(project.id)}/milestones`, {
        title,
        start_date: $("milestoneStart")?.value || null,
        end_date: $("milestoneEnd")?.value || null,
        status: $("milestoneStatus")?.value || "PLANNED",
        notes: ($("milestoneNotes")?.value || "").trim() || null,
      });

      // Clear form
      ["milestoneTitle", "milestoneStart", "milestoneEnd", "milestoneNotes"].forEach(id => {
        if ($(id)) $(id).value = "";
      });
      if ($("milestoneStatus")) $("milestoneStatus").value = "PLANNED";

      milestones = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/milestones`);
      renderMilestonesTable();
      toast("Milestone created successfully");
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    }
  });
}

// ============ Main Initialization ============
(async function main() {
  const u = await requireAuthOrRedirect("login.html");
  if (!u) return;

  try {
    clearError();

    // Initialize tabs
    bindTabs();
    setTab("team");

    // Load all data
    me = await apiGet("/api/auth/me");
    me = me?.user || me?.profile || me || getUser();

    users = await apiGet("/api/users/directory");

    const id = projectId();
    if (!id) throw new Error("Missing project ID in URL (?id=...)");

    project = await apiGet(`/api/project-execution/${encodeURIComponent(id)}`);

    // Load tab data
    team = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/team`).catch(() => []);
    tasks = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/tasks`).catch(() => []);
    milestones = await apiGet(`/api/project-execution/${encodeURIComponent(project.id)}/milestones`).catch(() => []);

    // Render UI
    renderManagerSelect();
    fillBasicsForm();
    renderTeamPicker();
    renderTeamTable();
    renderTasksTable();
    renderMilestonesTable();

    // Bind events
    bindSaveBasics();
    bindTeamActions();
    bindTasksActions();
    bindMilestonesActions();

    toast("Project loaded successfully");
  } catch (e) {
    console.error(e);
    setError(e.message || "Failed to load project");
    toast(e.message || "Failed to load project", 'error');
  }
})();
