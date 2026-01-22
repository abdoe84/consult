import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from "../api.js";
import { requireAuthOrRedirect } from "../auth.js";

function qp(key) { return new URLSearchParams(location.search).get(key); }
function $(id) { return document.getElementById(id); }

function showError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = String(msg || "Unknown error");
  box.classList.remove("hidden");
}
function clearError() {
  const box = $("errorBox");
  if (!box) return;
  box.textContent = "";
  box.classList.add("hidden");
}
function toast(msg, type = "success") {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove("hidden");
  setTimeout(() => {
    t.classList.add("hidden");
    setTimeout(() => t.className = "toast hidden", 300);
  }, 2000);
}

function fmtBytes(n) {
  const x = Number(n || 0);
  if (!x) return "—";
  const units = ["B","KB","MB","GB"];
  let v = x, i = 0;
  while (v >= 1024 && i < units.length-1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

function fmtDateShort(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString();
  } catch {
    return String(d).split("T")[0] || "—";
  }
}

function formatMoney(value, currency = "SAR") {
  if (!value && value !== 0) return "—";
  const num = Number(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function setStatusBadge(element, status) {
  if (!element) return;
  const s = String(status || "").toUpperCase();
  element.className = `status-badge status-${s}`;
  element.textContent = s || "—";
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) el.textContent = value || "—";
}

function safeSetValue(id, value) {
  const el = $(id);
  if (el) el.value = value || "";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}


function isWriteUser(user) {
  const r = String(user?.role || "").toUpperCase();
  return r === "MANAGER" || r === "ADMIN";
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const sections = {
    basics: $("tab-basics"),
    team: $("tab-team"),
    timeline: $("tab-timeline"),
    attachments: $("tab-attachments"),
    invoices: $("tab-invoices"),
    expenses: $("tab-expenses"),
    budget: $("tab-budget"),
    partners: $("tab-partners"),
    closing: $("tab-closing"),
  };

  function activate(key) {
    // Validate key exists
    if (!sections[key]) {
      console.warn(`Tab section "${key}" not found`);
      return;
    }

    buttons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(sections).forEach(([k, el]) => {
      if (!el) {
        console.warn(`Section element for tab "${k}" not found`);
        return;
      }
      el.classList.toggle("hidden", k !== key);
    });

    // Render Gantt chart when timeline tab is activated
    if (key === "timeline") {
      setTimeout(() => {
        if (typeof renderGantt === "function") {
          renderGantt();
        }
      }, 200); // Small delay to ensure canvas is visible
    }
    // Render overview charts when basics tab is activated
    if (key === "basics") {
      setTimeout(async () => {
        if (typeof renderTasksStatusChart === "function") {
          await renderTasksStatusChart();
        }
        if (typeof renderExpensesChart === "function") {
          await renderExpensesChart();
        }
        if (typeof renderTimelineProgressChart === "function") {
          await renderTimelineProgressChart();
        }
      }, 300);
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab;
      if (tabKey) {
        activate(tabKey);
      }
    });
  });

  // Activate basics tab by default
  activate("basics");
}

let me = null;
let projectId = null;
let users = [];
let project = null;
let allExpenses = [];

async function loadUsers() {
  const r = await apiGet("/api/users/directory");
  if (!r.ok) throw new Error(r.details || r.error || "Failed to load users");
  users = r.data || [];
}

function fillSelect(selectEl, items, { placeholder = null, valueKey="id", labelFn=null, allowEmpty=false } = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  if (allowEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder || "—";
    selectEl.appendChild(opt);
  }
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it[valueKey];
    opt.textContent = labelFn ? labelFn(it) : String(it[valueKey]);
    selectEl.appendChild(opt);
  }
}

function fillStatusSelect(current) {
  const sel = $("selProjectStatus");
  if (!sel) return;
  // Allowed statuses according to database constraint: DRAFT, ACTIVE, CLOSED, ARCHIVED
  const statuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];
  const cur = String(current || "").toUpperCase();
  // Map old values to new ones for backward compatibility
  const statusMap = {
    "ON_HOLD": "ACTIVE",
    "COMPLETED": "CLOSED",
    "CANCELLED": "ARCHIVED"
  };
  const mappedCur = statusMap[cur] || cur;
  const all = Array.from(new Set([mappedCur, ...statuses].filter(Boolean)));
  sel.innerHTML = all.map(s => `<option value="${s}" ${s === mappedCur ? "selected" : ""}>${s}</option>`).join("");
}

function setBasicsUI() {
  const canWrite = isWriteUser(me);

  // Extract name and value from related data (if available)
  const extractedName = project?._extracted?.name_from_request || null;
  const extractedValue = project?._extracted?.value_from_offer || null;

  // Use extracted name if available, otherwise fallback to stored name
  const projectName = extractedName || project?.name || project?.title || "Project";

  // Use extracted value (without VAT) if available, otherwise fallback to stored value
  const projectValue = extractedValue || project?.project_value || project?.value_sar || null;

  // Header - Update with extracted name
  safeSetText("pName", projectName);
  setStatusBadge($("pStatus"), project?.status);
  safeSetText("pDesc", project?.description || project?._related?.service_request?.description || "");
  safeSetText("pCodeDisplay", project?.project_code || "—");
  safeSetText("pUpdatedDisplay", project?.updated_at ? fmtDateShort(project.updated_at) : "—");

  // Read-only badge
  const roBadge = $("readOnlyBadge");
  if (roBadge) roBadge.classList.toggle("hidden", canWrite);

  // KPIs - Use extracted value
  safeSetText("kpiValue", projectValue ? formatMoney(projectValue, project?.project_currency || "SAR") : "—");
  safeSetText("kpiStartDate", project?.start_date ? fmtDateShort(project.start_date) : "—");
  safeSetText("kpiEndDate", project?.target_end_date ? fmtDateShort(project.target_end_date) : "—");

  const pmUser = users.find(u => u.id === project?.project_manager_user_id);
  safeSetText("kpiManager", pmUser ? (pmUser.full_name || pmUser.email) : "—");

  const statusEl = $("kpiStatus");
  if (statusEl) {
    statusEl.textContent = String(project?.status || "—").toUpperCase();
  }

  // Show auto-extracted badges
  const nameBadge = $("nameAutoBadge");
  if (nameBadge) {
    if (extractedName) {
      nameBadge.classList.remove("hidden");
      nameBadge.textContent = "Auto from Request";
    } else {
      nameBadge.classList.add("hidden");
    }
  }

  const valueBadge = $("valueAutoBadge");
  const valueSourceEl = $("kpiValueSource");
  if (valueBadge) {
    if (extractedValue) {
      valueBadge.classList.remove("hidden");
      valueBadge.textContent = "Auto from Offer";
    } else {
      valueBadge.classList.add("hidden");
    }
  }
  if (valueSourceEl) {
    if (extractedValue) {
      valueSourceEl.textContent = "From approved offer (excl. VAT)";
    } else {
      valueSourceEl.textContent = "";
    }
  }

  // Form fields - Use extracted values
  const nameEl = $("inpProjectName");
  if (nameEl) {
    nameEl.value = projectName;
  }

  safeSetValue("inpProjectCode", project?.project_code || "");

  const valueEl = $("inpProjectValue");
  if (valueEl) {
    valueEl.value = projectValue ? String(projectValue) : "";
  }

  safeSetValue("selProjectCurrency", project?.project_currency || "SAR");
  safeSetValue("inpStartDate", project?.start_date ? project.start_date.split("T")[0] : "");
  safeSetValue("inpTargetEndDate", project?.target_end_date ? project.target_end_date.split("T")[0] : "");
  safeSetValue("inpDescription", project?.description || "");

  fillStatusSelect(project?.status);

  const pm = $("pmSelect");
  if (pm) {
    fillSelect(pm, users, {
      allowEmpty: true,
      placeholder: "Unassigned",
      labelFn: (u) => `${u.full_name || "(No name)"} — ${u.email} [${u.role}]`,
    });
    pm.value = project?.project_manager_user_id || "";
  }

  // Only disable editable fields if user can't write (extracted fields are already handled above)
  const fields = ["inpProjectCode", "selProjectCurrency", "inpStartDate", "inpTargetEndDate", "inpDescription", "selProjectStatus", "pmSelect"];
  if (!extractedName) fields.push("inpProjectName");
  if (!extractedValue) fields.push("inpProjectValue");

  fields.forEach(id => { if ($(id)) $(id).disabled = !canWrite; });
  const buttons = ["btnSaveBasics", "btnClose", "btnArchive"];
  buttons.forEach(id => { if ($(id)) $(id).disabled = !canWrite; });

  // Update financial summary (will be called after expenses are loaded)
  if (typeof updateFinancialSummary === "function" && window.allExpenses) {
    updateFinancialSummary();
  }
}

async function loadProject() {
  const r = await apiGet(`/api/project-execution/${projectId}`);
  if (!r.ok) throw new Error(r.details || r.error || "Failed to load project");
  project = r.data;
}

async function saveBasics() {
  clearError();

  // Only update name/value if they weren't extracted (user can still override if they have permission)
  const extractedName = project?._extracted?.name_from_request;
  const extractedValue = project?._extracted?.value_from_offer;

  const payload = {
    // Only update name if it wasn't auto-extracted, or if user changed it
    name: ($("inpProjectName")?.value || "").trim() || (extractedName || null),
    title: ($("inpProjectName")?.value || "").trim() || (extractedName || null),
    status: $("selProjectStatus")?.value || project?.status || null,
    project_code: ($("inpProjectCode")?.value || "").trim() || null,
    project_manager_user_id: $("pmSelect")?.value || null,
    // Only update value if it wasn't auto-extracted, or if user changed it
    project_value: $("inpProjectValue")?.value === ""
      ? (extractedValue || null)
      : Number($("inpProjectValue")?.value || extractedValue || 0),
    value_sar: $("inpProjectValue")?.value === ""
      ? (extractedValue || null)
      : Number($("inpProjectValue")?.value || extractedValue || 0),
    project_currency: $("selProjectCurrency")?.value || "SAR",
    start_date: $("inpStartDate")?.value || null,
    target_end_date: $("inpTargetEndDate")?.value || null,
    description: ($("inpDescription")?.value || "").trim() || null,
  };

  const r = await apiPatch(`/api/project-execution/${projectId}`, payload);
  if (!r.ok) return showError(r.details || r.error || "Save failed");

  project = r.data;
  setBasicsUI();
  toast("Saved successfully", "success");
}

async function closeProject() {
  clearError();
  const notes = ($("closingNotes")?.value || "").trim() || null;
  const r = await apiPost(`/api/project-execution/${projectId}/close`, { notes });
  if (!r.ok) return showError(r.details || r.error || "Close failed");
  await loadProject();
  setBasicsUI();
  toast("Project closed", "success");
}

async function archiveProject() {
  clearError();
  const r = await apiPost(`/api/project-execution/${projectId}/archive`, {});
  if (!r.ok) return showError(r.details || r.error || "Archive failed");
  await loadProject();
  setBasicsUI();
  toast("Project archived", "success");
}

/* =========================
   TEAM
========================= */

async function loadTeam() {
  const r = await apiGet(`/api/project-execution/${projectId}/team`);
  if (!r.ok) throw new Error(r.details || r.error || "Failed to load team");
  return r.data || [];
}

function renderTeam(rows) {
  const tb = $("teamTbody");
  if (!tb) return;
  tb.innerHTML = "";

  if (!rows || rows.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No team members yet</div></td></tr>`;
    return;
  }

  const canWrite = isWriteUser(me);

  for (const row of rows) {
    const p = row.profiles || row.profile || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(p.full_name || "—")}</td>
      <td>${esc(p.email || "—")}</td>
      <td>${esc(p.role || "—")}</td>
      <td><span class="status-badge status-ACTIVE">${esc(row.role_in_project || "—")}</span></td>
      <td>${esc(row.member_role || "—")}</td>
      <td>
        <button data-del="${row.user_id}" class="action-chip" ${canWrite ? "" : "disabled"}>
          Remove
        </button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-del");
      if (!uid) return;
      const r = await apiDelete(`/api/project-execution/${projectId}/team/${uid}`);
      if (!r.ok) return showError(r.details || r.error || "Remove failed");
      await refreshTeam();
      toast("Removed", "success");
    });
  });
}

async function addTeamMembers() {
  clearError();
  const sel = $("teamPicker");
  const role = $("roleInProject")?.value || "MEMBER";
  const ids = Array.from(sel?.selectedOptions || []).map(o => o.value).filter(Boolean);

  if (!ids.length) return showError("Select at least one user.");
  const r = await apiPost(`/api/project-execution/${projectId}/team`, { user_ids: ids, role_in_project: role });
  if (!r.ok) return showError(r.details || r.error || "Add failed");
  await refreshTeam();
  // Clear selection
  if (sel) Array.from(sel.options).forEach(opt => opt.selected = false);
  toast("Added", "success");
}

async function refreshTeam() {
  let rows = [];
  try {
    rows = await loadTeam();
    renderTeam(rows);
  } catch (e) {
    console.error("Failed to load team:", e);
    renderTeam([]);
  }

  // Fill multiselect users (exclude already added members)
  const sel = $("teamPicker");
  if (sel) {
    const existingTeamIds = new Set((rows || []).map(r => r.user_id));
    const availableUsers = (users || []).filter(u => !existingTeamIds.has(u.id));

    sel.innerHTML = "";
    availableUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.full_name || "(No name)"} — ${u.email} [${u.role}]`;
      sel.appendChild(opt);
    });
  }
}

/* =========================
   TASKS (Timeline)
========================= */

function daysBetween(a, b) {
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  if (!da || !db || isNaN(da) || isNaN(db)) return 0;
  const diff = (db - da) / (1000*60*60*24);
  return Math.max(0, Math.round(diff));
}

function ganttBar(start, due) {
  if (!start || !due) return `<div class="text-xs text-slate-400">—</div>`;
  const d = daysBetween(start, due) || 1;
  const w = Math.min(240, 20 + d * 10);
  return `
    <div class="h-2 rounded-full bg-slate-200 w-[260px]">
      <div class="h-2 rounded-full bg-slate-900" style="width:${w}px"></div>
    </div>
    <div class="text-[11px] text-slate-500 mt-1">${start} → ${due} (${d}d)</div>
  `;
}

let timelineChartInstance = null;

async function renderGantt() {
  const canvas = document.getElementById("timelineChart");
  if (!canvas || typeof Chart === "undefined") {
    console.warn("Chart.js not loaded or canvas not found");
    return;
  }

  try {
    // Destroy existing chart if it exists - check both our instance and Chart.js registry
    if (timelineChartInstance) {
      try {
        timelineChartInstance.destroy();
      } catch (e) {
        console.warn("Error destroying chart instance:", e);
      }
      timelineChartInstance = null;
    }

    // Also check if Chart.js has registered this canvas and destroy it
    let existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
        existingChart = null;
      } catch (e) {
        console.warn("Error destroying existing chart:", e);
      }
    }

    // Double-check and ensure canvas is free - sometimes Chart.js needs a moment
    await new Promise(resolve => setTimeout(resolve, 50));

    // Final check to ensure no chart is registered
    existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn("Error in final chart cleanup:", e);
      }
    }

    // Load tasks and milestones
    const tasks = await loadTasks().catch(() => []);
    const milestones = await loadMilestones().catch(() => []);

    // Filter items with valid dates
    const itemsWithDates = [];

    tasks.forEach((task) => {
      if (task.start_date && task.due_date) {
        itemsWithDates.push({
          label: task.title || "Untitled Task",
          start: new Date(task.start_date),
          end: new Date(task.due_date),
          type: "task",
          status: task.status || "TODO"
        });
      }
    });

    milestones.forEach((milestone) => {
      if (milestone.start_date && milestone.end_date) {
        itemsWithDates.push({
          label: milestone.title || "Untitled Milestone",
          start: new Date(milestone.start_date),
          end: new Date(milestone.end_date),
          type: "milestone",
          status: milestone.status || "PLANNED"
        });
      }
    });

    // If no data, show empty state
    if (itemsWithDates.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No timeline data available", canvas.width / 2, canvas.height / 2);
      return;
    }

    // Sort by start date
    itemsWithDates.sort((a, b) => a.start - b.start);

    // Calculate date range
    const allDates = itemsWithDates.flatMap(item => [item.start, item.end]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    const dateRange = maxDate - minDate;
    const daysRange = Math.max(1, Math.ceil(dateRange / (1000 * 60 * 60 * 24)));

    // Prepare datasets for Chart.js - use simple approach with start and end points
    // Chart.js doesn't support width property directly, so we'll use a workaround
    const datasets = itemsWithDates.map((item, idx) => {
      const startDate = item.start;
      const endDate = item.end;

      // For Gantt chart, we need to create bars that span from start to end
      // We'll use a scatter-like approach with custom bar width calculation
      return {
        label: item.label,
        data: [{
          x: startDate,
          y: idx
        }],
        backgroundColor: item.type === "milestone"
          ? "rgba(99, 93, 158, 0.8)" // --scampi for milestones
          : getTaskColor(item.status),
        borderColor: item.type === "milestone"
          ? "rgba(99, 93, 158, 1)"
          : getTaskColor(item.status).replace("0.8", "1"),
        borderWidth: 2,
        borderRadius: 4,
        barThickness: 24,
        // Store duration for tooltip
        duration: endDate - startDate,
        endDate: endDate
      };
    });

    // Final safety check before creating new chart
    const finalCheck = Chart.getChart(canvas);
    if (finalCheck) {
      try {
        finalCheck.destroy();
      } catch (e) {
        console.warn("Error in pre-creation cleanup:", e);
      }
    }

    // Create chart using Chart.js with time scale
    timelineChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        datasets: datasets
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: datasets.length <= 10,
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 10,
              font: {
                size: 11
              },
              filter: (item, chart) => {
                // Only show unique labels - with safety checks
                if (!chart || !chart.data || !chart.data.datasets) {
                  return true; // Show all if chart data is not available
                }
                try {
                  const labels = chart.data.datasets.map(d => d.label);
                  return labels.indexOf(item.text) === labels.lastIndexOf(item.text);
                } catch (e) {
                  return true; // Show all on error
                }
              }
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items || items.length === 0) return "";
                return items[0]?.dataset?.label || "";
              },
              label: (item) => {
                try {
                  const dataset = item.dataset;
                  const data = item.raw;
                  if (data && data.x && dataset) {
                    const start = new Date(data.x);
                    const end = dataset.endDate ? new Date(dataset.endDate) : start;
                    const days = dataset.duration ? Math.ceil(dataset.duration / (1000 * 60 * 60 * 24)) : 0;
                    return [
                      `Start: ${start.toLocaleDateString()}`,
                      `End: ${end.toLocaleDateString()}`,
                      `Duration: ${days} day${days !== 1 ? "s" : ""}`
                    ];
                  }
                  return "";
                } catch (e) {
                  return "";
                }
              }
            }
          }
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                day: "MMM dd, yyyy"
              },
              tooltipFormat: "MMM dd, yyyy"
            },
            title: {
              display: true,
              text: "Timeline",
              color: "#64748b",
              font: {
                size: 12
              }
            },
            grid: {
              color: "rgba(0,0,0,0.05)"
            },
            min: minDate.getTime() - (dateRange * 0.1),
            max: maxDate.getTime() + (dateRange * 0.1)
          },
          y: {
            display: false,
            grid: {
              display: false
            },
            ticks: {
              display: false
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("Failed to render Gantt chart:", error);
    // Clear any existing chart
    if (timelineChartInstance) {
      try {
        timelineChartInstance.destroy();
      } catch (e) {
        // Ignore
      }
      timelineChartInstance = null;
    }
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        // Ignore
      }
    }
    // Show error message
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width || 400, canvas.height || 300);
        ctx.fillStyle = "#ef4444";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Error rendering chart", (canvas.width || 400) / 2, (canvas.height || 300) / 2);
      }
    }
  }
}

function getTaskColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED") return "rgba(76, 165, 133, 0.8)"; // --patina
  if (s === "IN_PROGRESS" || s === "INPROGRESS") return "rgba(84, 192, 232, 0.8)"; // --picton-blue
  if (s === "BLOCKED" || s === "CANCELLED") return "rgba(239, 68, 68, 0.8)"; // red
  return "rgba(148, 163, 184, 0.8)"; // slate (default)
}

async function loadTasks() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/tasks`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load tasks:", e);
    return [];
  }
}

function getTaskStatusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED") return "bg-green-50 text-green-700 border-green-200";
  if (s === "IN_PROGRESS" || s === "INPROGRESS") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "BLOCKED" || s === "CANCELLED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function renderTasks(rows) {
  const tb = $("tasksTbody");
  if (!tb) return;
  tb.innerHTML = "";

  const canWrite = isWriteUser(me);
  const statusOptions = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"];

  for (const t of rows) {
    const currentStatus = (t.status || "TODO").toUpperCase();
    const statusColor = getTaskStatusColor(currentStatus);

    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition-colors";
    tr.innerHTML = `
      <td class="py-2 pr-3 font-medium text-slate-900">${esc(t.title || "—")}</td>
      <td class="py-2 pr-3">
        ${canWrite ? `
          <select
            data-task-status="${t.id}"
            class="status-select text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${statusColor} focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer"
          >
            ${statusOptions.map(opt => `<option value="${opt}" ${opt === currentStatus ? "selected" : ""}>${opt}</option>`).join("")}
          </select>
        ` : `
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor}">
            ${esc(currentStatus)}
          </span>
        `}
      </td>
      <td class="py-2 pr-3"><span class="chip">${esc(t.priority || "—")}</span></td>
      <td class="py-2 pr-3 text-sm text-slate-600">${t.start_date ? esc(t.start_date.split("T")[0]) : "—"}</td>
      <td class="py-2 pr-3 text-sm text-slate-600">${t.due_date ? esc(t.due_date.split("T")[0]) : "—"}</td>
      <td class="py-2 pr-3">${ganttBar(t.start_date, t.due_date)}</td>
      <td class="py-2 pr-3">
        <button data-del="${t.id}" class="px-3 py-1 rounded-xl border border-red-200 bg-white text-red-600 text-xs hover:bg-red-50 transition-colors" ${canWrite ? "" : "disabled"}>
          Delete
        </button>
      </td>
    `;
    tb.appendChild(tr);
  }

  // Handle status updates
  tb.querySelectorAll("select[data-task-status]").forEach(select => {
    const originalStatus = select.value;
    select.addEventListener("change", async (e) => {
      const taskId = e.target.getAttribute("data-task-status");
      const newStatus = e.target.value.toUpperCase();

      if (!taskId) {
        return showError("Task ID not found.");
      }

      // Update status via API
      const r = await apiPatch(`/api/project-execution/${projectId}/tasks/${taskId}`, {
        status: newStatus
      });

      if (!r.ok) {
        // Revert selection on error
        e.target.value = originalStatus;
        return showError(r.details || r.error || "Status update failed");
      }

      // Update UI color immediately
      const statusColor = getTaskStatusColor(newStatus);
      e.target.className = `status-select text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${statusColor} focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer`;

      await refreshTasks();
      await renderGantt(); // Update Gantt chart
      toast("Status updated successfully", "success");
    });
  });

  // Handle delete buttons
  tb.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const r = await apiDelete(`/api/project-execution/${projectId}/tasks/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshTasks();
      await renderGantt(); // Update Gantt chart
      toast("Deleted", "success");
    });
  });
}

async function addTask() {
  clearError();
  const title = ($("taskTitle")?.value || "").trim();
  if (!title) return showError("Task title is required.");

  const payload = {
    title,
    start_date: $("taskStart")?.value || null,
    due_date: $("taskDue")?.value || null,
    priority: $("taskPriority")?.value || "NORMAL",
    status: "TODO",
  };

  const r = await apiPost(`/api/project-execution/${projectId}/tasks`, payload);
  if (!r.ok) return showError(r.details || r.error || "Add task failed");

  $("taskTitle").value = "";
  $("taskStart").value = "";
  $("taskDue").value = "";
  await refreshTasks();
  toast("Task added", "success");
}

async function refreshTasks() {
  try {
    const rows = await loadTasks();
    renderTasks(rows);
    await renderGantt(); // Update Gantt chart after tasks refresh
  } catch (e) {
    console.error("Failed to load tasks:", e);
    renderTasks([]);
    await renderGantt(); // Update Gantt chart even on error
  }
}

/* =========================
   ATTACHMENTS
========================= */

async function loadDocs() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/documents`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load documents:", e);
    return [];
  }
}

function renderDocs(rows) {
  const tb = $("docsTbody");
  if (!tb) return;
  tb.innerHTML = "";

  const canWrite = isWriteUser(me);

  for (const d of rows) {
    const cat = d?.category || d?.meta?.category || d?.entity_type || "—";
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 pr-3">${d.file_name || "—"}</td>
      <td class="py-2 pr-3"><span class="chip">${cat}</span></td>
      <td class="py-2 pr-3">${fmtBytes(d.file_size_bytes)}</td>
      <td class="py-2 pr-3">${fmtDate(d.uploaded_at || d.created_at)}</td>
      <td class="py-2 pr-3 flex items-center gap-2">
        ${d.url ? `<a class="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs hover:bg-slate-50" href="${d.url}" target="_blank">Download</a>` : ""}
        <button data-del="${d.id}" class="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs hover:bg-slate-50" ${canWrite ? "" : "disabled"}>Remove</button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const linkId = btn.getAttribute("data-del");
      const r = await apiDelete(`/api/project-execution/${projectId}/documents/${linkId}`);
      if (!r.ok) return showError(r.details || r.error || "Remove failed");
      await refreshDocs();
      toast("Removed", "success");
    });
  });
}

async function uploadDoc() {
  clearError();

  const input = $("docFile");
  const file = input?.files?.[0];
  if (!file) return showError("Choose a file first.");

  const category = $("docCategory")?.value || "DOCUMENT";
  const notes = ($("fileNotes")?.value || "").trim();

  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", category);
  fd.append("notes", notes);

  const r = await apiUpload(`/api/project-execution/${projectId}/documents/upload`, fd);
  if (!r.ok) return showError(r.details || r.error || "Upload failed");

  input.value = "";
  if ($("fileNotes")) $("fileNotes").value = "";
  await refreshDocs();
  toast("Uploaded", "success");
}

async function refreshDocs() {
  try {
    const rows = await loadDocs();
    renderDocs(rows);
  } catch (e) {
    console.error("Failed to load documents:", e);
    renderDocs([]);
  }
}

/* =========================
   FINANCIAL
========================= */

async function loadInvoices() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/invoices`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load invoices:", e);
    return [];
  }
}

function renderInvoices(rows) {
  const tb = $("invTbody");
  if (!tb) return;
  tb.innerHTML = "";

  for (const inv of rows) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 pr-3">${inv.invoice_no || "—"}</td>
      <td class="py-2 pr-3">${Number(inv.amount || 0).toFixed(2)}</td>
      <td class="py-2 pr-3">${inv.currency || "—"}</td>
      <td class="py-2 pr-3"><span class="chip">${inv.status || "—"}</span></td>
      <td class="py-2 pr-3">${fmtDate(inv.created_at)}</td>
    `;
    tb.appendChild(tr);
  }
}

async function addInvoice() {
  clearError();

  if (!projectId) {
    return showError("Project ID is missing. Please refresh the page.");
  }

  const amountEl = $("invAmount");
  const amountStr = amountEl?.value?.trim() || "";

  if (!amountStr) {
    return showError("Invoice amount is required.");
  }

  const amount = Number(amountStr);

  if (!Number.isFinite(amount) || isNaN(amount)) {
    return showError("Invalid invoice amount. Please enter a valid number.");
  }

  if (amount < 0) {
    return showError("Invoice amount cannot be negative.");
  }

  const payload = {
    invoice_no: ($("invNo")?.value || "").trim() || null,
    amount: amount,
    currency: ($("invCurrency")?.value || "SAR").toUpperCase(),
    status: ($("invStatus")?.value || "DRAFT").trim().toUpperCase(),
  };

  // Log payload for debugging (only in development)
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("Adding invoice with payload:", payload);
  }

  try {
    const r = await apiPost(`/api/project-execution/${projectId}/invoices`, payload);

    if (!r.ok) {
      console.error("Add invoice error response:", r);
      const errorMsg = r.details || r.error || "Add invoice failed";
      return showError(errorMsg);
    }

    // Clear form
    if ($("invNo")) $("invNo").value = "";
    if (amountEl) amountEl.value = "";
    if ($("invCurrency")) $("invCurrency").value = "SAR";
    if ($("invStatus")) $("invStatus").value = "DRAFT";

    await refreshInvoices();
    toast("Invoice added successfully", "success");
  } catch (e) {
    console.error("Add invoice exception:", e);
    showError(e?.message || "Failed to add invoice. Please try again.");
  }
}

async function refreshInvoices() {
  try {
    const rows = await loadInvoices();
    renderInvoices(rows);
  } catch (e) {
    console.error("Failed to load invoices:", e);
    renderInvoices([]);
  }
}

/* =========================
   PAYMENTS
========================= */

async function loadPayments() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/payments`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load payments:", e);
    return [];
  }
}

function renderPayments(rows) {
  const tb = $("payTbody");
  if (!tb) return;
  tb.innerHTML = "";

  for (const p of rows) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 pr-3">${p.reference || "—"}</td>
      <td class="py-2 pr-3">${Number(p.amount || 0).toFixed(2)}</td>
      <td class="py-2 pr-3">${p.method || "—"}</td>
      <td class="py-2 pr-3">${fmtDate(p.paid_at)}</td>
    `;
    tb.appendChild(tr);
  }
}

async function addPayment() {
  clearError();
  const amount = Number($("payAmount")?.value);
  if (!Number.isFinite(amount) || amount <= 0) return showError("Payment amount is required.");

  const payload = {
    payment_ref: ($("payRef")?.value || "").trim() || null,
    amount,
    method: ($("payMethod")?.value || "").trim() || null,
    paid_at: $("payAt")?.value || null,
  };

  const r = await apiPost(`/api/project-execution/${projectId}/payments`, payload);
  if (!r.ok) return showError(r.details || r.error || "Add payment failed");

  $("payRef").value = "";
  $("payAmount").value = "";
  $("payMethod").value = "";
  $("payAt").value = "";
  await refreshPayments();
  toast("Payment added", "success");
}

async function refreshPayments() {
  try {
    const rows = await loadPayments();
    renderPayments(rows);
  } catch (e) {
    console.error("Failed to load payments:", e);
    renderPayments([]);
  }
}

/* =========================
   MILESTONES
========================= */

async function loadMilestones() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/milestones`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load milestones:", e);
    return [];
  }
}

function renderMilestones(rows) {
  const tb = $("milestonesTbody");
  if (!tb) return;
  tb.innerHTML = "";

  const canWrite = isWriteUser(me);

  for (const m of rows) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 pr-3">${m.title || "—"}</td>
      <td class="py-2 pr-3"><span class="chip">${m.status || "—"}</span></td>
      <td class="py-2 pr-3">${m.start_date ? m.start_date.split("T")[0] : "—"}</td>
      <td class="py-2 pr-3">${m.end_date ? m.end_date.split("T")[0] : "—"}</td>
      <td class="py-2 pr-3">${m.notes || "—"}</td>
      <td class="py-2 pr-3">
        <button data-del="${m.id}" class="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs hover:bg-slate-50" ${canWrite ? "" : "disabled"}>Delete</button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const r = await apiDelete(`/api/project-execution/${projectId}/milestones/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshMilestones();
      toast("Deleted", "success");
    });
  });
}

async function addMilestone() {
  clearError();
  const title = ($("milestoneTitle")?.value || "").trim();
  if (!title) return showError("Milestone title is required.");

  const payload = {
    title,
    start_date: $("milestoneStart")?.value || null,
    end_date: $("milestoneEnd")?.value || null,
    status: $("milestoneStatus")?.value || "PLANNED",
    notes: ($("milestoneNotes")?.value || "").trim() || null,
  };

  const r = await apiPost(`/api/project-execution/${projectId}/milestones`, payload);
  if (!r.ok) return showError(r.details || r.error || "Add milestone failed");

  const titleEl = $("milestoneTitle");
  const startEl = $("milestoneStart");
  const endEl = $("milestoneEnd");
  const statusEl = $("milestoneStatus");
  const notesEl = $("milestoneNotes");

  if (titleEl) titleEl.value = "";
  if (startEl) startEl.value = "";
  if (endEl) endEl.value = "";
  if (statusEl) statusEl.value = "PLANNED";
  if (notesEl) notesEl.value = "";
  await refreshMilestones();
  toast("Milestone added", "success");
}

async function refreshMilestones() {
  try {
    const rows = await loadMilestones();
    renderMilestones(rows);
    await renderGantt(); // Update Gantt chart after milestones refresh
  } catch (e) {
    console.error("Failed to load milestones:", e);
    renderMilestones([]);
    await renderGantt(); // Update Gantt chart even on error
  }
}

/* =========================
   PARTNERS + PROCUREMENT
========================= */

async function loadPartners() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/partners`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load partners:", e);
    return [];
  }
}

function formatDateForDisplay(dateValue) {
  try {
    // Handle null or undefined first
    if (dateValue === null || dateValue === undefined) return "—";

    // Handle empty string
    if (typeof dateValue === 'string' && dateValue.trim() === '') return "—";

    // Handle string dates (YYYY-MM-DD or ISO format)
    if (typeof dateValue === 'string') {
      // Remove time part if present (handles both 'T' and ' ' separators)
      const parts = dateValue.split(/[T\s]/);
      const dateStr = parts[0] || "";

      // Check if it's valid YYYY-MM-DD format
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }

      // Try to parse and format if not in expected format
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Handle Date objects
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return "—";
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return "—";
  } catch (e) {
    console.warn("Date format error:", e, dateValue);
    return "—";
  }
}

function getDocTypeLabel(docType) {
  const types = {
    "PR": { label: "PR", icon: "📋", desc: "Purchase Request" },
    "PO": { label: "PO", icon: "📝", desc: "Purchase Order" },
    "SEC": { label: "SEC", icon: "📋", desc: "Service Entry Sheet" }
  };
  const t = String(docType || "").toUpperCase();
  return types[t] || { label: t, icon: "📄", desc: "" };
}

function procurementTable(partner) {
  const rows = partner.procurement || [];
  const canWrite = isWriteUser(me);

  const getStatusColor = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "OPEN") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "IN_PROGRESS" || s === "INPROGRESS") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (s === "COMPLETED" || s === "DONE") return "bg-green-50 text-green-700 border-green-200";
    if (s === "CLOSED") return "bg-slate-50 text-slate-700 border-slate-200";
    if (s === "CANCELLED" || s === "CANCELED") return "bg-red-50 text-red-700 border-red-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const htmlRows = rows.map(r => {
    const statusColor = getStatusColor(r.status);
    const docTypeInfo = getDocTypeLabel(r.doc_type);
    const displayDate = formatDateForDisplay(r.start_date);
    const currentStatus = String(r.status || "OPEN").toUpperCase();

    return `
    <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
      <td class="py-3 px-4">
        <div class="flex items-center gap-2">
          <span class="text-base">${docTypeInfo.icon}</span>
          <div>
            <div class="font-medium text-sm text-slate-900">${esc(docTypeInfo.label)}</div>
            <div class="text-xs text-slate-500">${esc(docTypeInfo.desc)}</div>
          </div>
        </div>
      </td>
      <td class="py-3 px-4">
        <div class="font-mono text-sm font-semibold text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
          ${esc(r.sap_ref || "—")}
        </div>
      </td>
      <td class="py-3 px-4">
        ${displayDate !== "—" ? `
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span class="text-sm text-slate-700 font-medium">${displayDate}</span>
          </div>
        ` : `
          <span class="text-sm text-slate-400 italic">—</span>
        `}
      </td>
      <td class="py-3 px-4">
        ${canWrite ? `
          <select
            data-proc-status-update="${r.id}"
            data-partner-id="${partner.id}"
            class="procurement-status-select w-full text-xs font-medium px-3 py-2 rounded-lg border transition-all ${statusColor} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer hover:shadow-sm"
          >
            <option value="OPEN" ${currentStatus === "OPEN" ? "selected" : ""}>🟦 OPEN</option>
            <option value="IN_PROGRESS" ${currentStatus === "IN_PROGRESS" ? "selected" : ""}>🟨 IN_PROGRESS</option>
            <option value="COMPLETED" ${currentStatus === "COMPLETED" ? "selected" : ""}>🟩 COMPLETED</option>
            <option value="CLOSED" ${currentStatus === "CLOSED" ? "selected" : ""}>⚫ CLOSED</option>
            <option value="CANCELLED" ${currentStatus === "CANCELLED" ? "selected" : ""}>🔴 CANCELLED</option>
          </select>
        ` : `
          <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border ${statusColor}">
            ${esc(currentStatus)}
          </span>
        `}
      </td>
      <td class="py-3 px-4">
        <div class="text-sm text-slate-600 max-w-xs truncate" title="${esc(r.notes || "")}">
          ${esc(r.notes || "—")}
        </div>
      </td>
      <td class="py-3 px-4">
        <button
          data-del-proc="${r.id}"
          data-partner-id="${partner.id}"
          class="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-medium hover:bg-red-50 hover:border-red-300 transition-all opacity-0 group-hover:opacity-100"
          ${canWrite ? "" : "disabled"}
          title="Delete procurement item"
        >
          🗑️ Delete
        </button>
      </td>
    </tr>
  `;
  }).join("");

  return `
    <div class="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/30 via-white to-slate-50/30 shadow-sm">
      <!-- Header Section -->
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200 rounded-t-2xl px-5 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-white rounded-lg shadow-sm">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Procurement Tracking</h3>
              <p class="text-xs text-slate-600 mt-0.5">PR / PO / SEC Documents</p>
            </div>
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <span class="text-sm font-semibold text-slate-700">${rows.length}</span>
            <span class="text-xs text-slate-500">item${rows.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <!-- Add Form Section -->
      <div class="p-5 border-b border-slate-200 bg-white">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">📄 Document Type</label>
            <select
              data-proc-type="${partner.id}"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
            >
              <option value="PR">📋 PR (Purchase Request)</option>
              <option value="PO">📝 PO (Purchase Order)</option>
              <option value="SEC">📋 SEC (Service Entry Sheet)</option>
            </select>
          </div>
          <div class="md:col-span-3">
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">🔢 SAP Reference</label>
            <input
              data-proc-sap="${partner.id}"
              type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="e.g. 4500123456"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">📅 Start Date</label>
            <input
              data-proc-start="${partner.id}"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">📊 Status</label>
            <select
              data-proc-status="${partner.id}"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
            >
              <option value="OPEN">🟦 OPEN</option>
              <option value="IN_PROGRESS">🟨 IN_PROGRESS</option>
              <option value="COMPLETED">🟩 COMPLETED</option>
              <option value="CLOSED">⚫ CLOSED</option>
            </select>
          </div>
          <div class="md:col-span-3 flex items-end">
            <button
              data-add-proc="${partner.id}"
              class="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              ${canWrite ? "" : "disabled"}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Add Procurement
            </button>
          </div>
        </div>
      </div>

      <!-- Table Section -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th class="py-3.5 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Type</th>
              <th class="py-3.5 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SAP Reference</th>
              <th class="py-3.5 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Start Date</th>
              <th class="py-3.5 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
              <th class="py-3.5 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Notes</th>
              <th class="py-3.5 px-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-100">
            ${htmlRows || `
              <tr>
                <td colspan="6" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div class="p-4 bg-slate-100 rounded-full">
                      <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    </div>
                    <div class="text-sm font-medium text-slate-600">No procurement items yet</div>
                    <div class="text-xs text-slate-400">Add your first procurement item using the form above</div>
                  </div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPartners(rows) {
  const wrap = $("partnersWrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (rows.length === 0) {
    wrap.innerHTML = `
      <div class="text-center py-16 px-4">
        <div class="inline-flex p-4 bg-slate-100 rounded-full mb-4">
          <svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-900 mb-2">No Partners Yet</h3>
        <p class="text-sm text-slate-500 max-w-md mx-auto">Add your first partner using the form above to start tracking procurement documents.</p>
      </div>
    `;
    return;
  }

  const canWrite = isWriteUser(me);

  for (const p of rows) {
    const card = document.createElement("div");
    card.className = "rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow mb-6 overflow-hidden";

    const partnerTypeColor = p.partner_type === "LAB" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-amber-100 text-amber-700 border-amber-200";
    const statusColor = p.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-200";

    card.innerHTML = `
      <!-- Partner Header -->
      <div class="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-5 py-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-bold text-slate-900">${esc(p.name)}</h3>
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${partnerTypeColor}">
                ${esc(p.partner_type)}
              </span>
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusColor}">
                ${esc(p.status)}
              </span>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <div class="flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span>Created: ${fmtDate(p.created_at)}</span>
              </div>
            </div>
            ${p.notes ? `
              <div class="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p class="text-sm text-slate-700">${esc(p.notes)}</p>
              </div>
            ` : ""}
          </div>
          <button
            data-del-partner="${p.id}"
            class="px-4 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 whitespace-nowrap"
            ${canWrite ? "" : "disabled opacity-50 cursor-not-allowed"}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        </div>
      </div>

      <!-- Procurement Section -->
      ${procurementTable(p)}
    `;
    wrap.appendChild(card);
  }

  wrap.querySelectorAll("button[data-del-partner]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-partner");
      const r = await apiDelete(`/api/project-execution/${projectId}/partners/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshPartners();
      toast("Partner deleted", "success");
    });
  });

  wrap.querySelectorAll("button[data-add-proc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const pid = btn.getAttribute("data-add-proc");
      const doc_type = document.querySelector(`[data-proc-type="${pid}"]`)?.value || "PR";
      const sap_ref = (document.querySelector(`[data-proc-sap="${pid}"]`)?.value || "").trim();
      const start_dateInput = document.querySelector(`[data-proc-start="${pid}"]`);
      let start_date = start_dateInput?.value?.trim() || null;
      // Convert empty string to null
      if (start_date === "") start_date = null;
      const status = (document.querySelector(`[data-proc-status="${pid}"]`)?.value || "OPEN").trim();

      if (!sap_ref) return showError("SAP Reference is required.");

      // Prepare payload
      const payload = {
        doc_type,
        sap_ref,
        status,
        notes: null
      };

      // Only include start_date if it's not null
      if (start_date) {
        payload.start_date = start_date;
      }

      // Clear form inputs after successful submission
      const r = await apiPost(`/api/project-execution/${projectId}/partners/${pid}/procurement`, payload);

      if (!r.ok) {
        console.error("Procurement add error:", r);
        return showError(r.details || r.error || "Add procurement failed");
      }

      // Clear form
      if (document.querySelector(`[data-proc-sap="${pid}"]`)) {
        document.querySelector(`[data-proc-sap="${pid}"]`).value = "";
      }
      if (start_dateInput) {
        start_dateInput.value = "";
      }
      if (document.querySelector(`[data-proc-type="${pid}"]`)) {
        document.querySelector(`[data-proc-type="${pid}"]`).value = "PR";
      }
      if (document.querySelector(`[data-proc-status="${pid}"]`)) {
        document.querySelector(`[data-proc-status="${pid}"]`).value = "OPEN";
      }

      await refreshPartners();
      toast("Procurement added successfully", "success");
    });
  });

  wrap.querySelectorAll("button[data-del-proc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-proc");
      const partnerId = btn.getAttribute("data-partner-id");
      if (!partnerId) {
        return showError("Partner ID not found.");
      }
      const r = await apiDelete(`/api/project-execution/${projectId}/partners/${partnerId}/procurement/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshPartners();
      toast("Procurement deleted", "success");
    });
  });

  // Add event listeners for status updates
  wrap.querySelectorAll("select[data-proc-status-update]").forEach(select => {
    const originalStatus = select.value;
    select.addEventListener("change", async (e) => {
      const procurementId = e.target.getAttribute("data-proc-status-update");
      const partnerId = e.target.getAttribute("data-partner-id");
      const newStatus = e.target.value.toUpperCase();

      if (!procurementId || !partnerId) {
        return showError("Missing procurement or partner ID.");
      }

      // Update status via API
      const r = await apiPatch(`/api/project-execution/procurement/${procurementId}`, {
        status: newStatus
      });

      if (!r.ok) {
        // Revert selection on error
        e.target.value = originalStatus;
        return showError(r.details || r.error || "Status update failed");
      }

      await refreshPartners();
      toast("Status updated successfully", "success");
    });
  });
}

async function addPartner() {
  clearError();
  const partnerTypeEl = $("partnerType");
  const partnerNameEl = $("partnerName");

  if (!partnerTypeEl || !partnerNameEl) {
    return showError("Partner form not found.");
  }

  const partner_type = (partnerTypeEl.value || "LAB").toUpperCase();
  const name = (partnerNameEl.value || "").trim();

  if (!name) return showError("Partner name is required.");

  // Validate partner_type
  const allowedTypes = ["LAB", "SUBCONTRACTOR"];
  if (!allowedTypes.includes(partner_type)) {
    return showError(`Partner type must be one of: ${allowedTypes.join(", ")}`);
  }

  const r = await apiPost(`/api/project-execution/${projectId}/partners`, { partner_type, name });
  if (!r.ok) return showError(r.details || r.error || "Add partner failed");

  partnerNameEl.value = "";
  await refreshPartners();
  toast("Partner added", "success");
}

async function refreshPartners() {
  try {
    const rows = await loadPartners();
    renderPartners(rows);
  } catch (e) {
    console.error("Failed to load partners:", e);
    renderPartners([]);
  }
}

/* =========================
   EXPENSES
========================= */

async function loadExpenses() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/expenses`);
    if (!r.ok) return [];
    const data = r.data || [];
    window.allExpenses = data; // Store globally for financial summary
    return data;
  } catch (e) {
    console.error("Failed to load expenses:", e);
    window.allExpenses = [];
    return [];
  }
}

function getExpenseStatusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (s === "APPROVED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "PAID") return "bg-green-50 text-green-700 border-green-200";
  if (s === "REJECTED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function renderExpenses(rows) {
  const tb = $("expTbody");
  if (!tb) return;
  tb.innerHTML = "";

  const canWrite = isWriteUser(me);

  if (rows.length === 0) {
    tb.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No expenses recorded yet.</td></tr>`;
    return;
  }

  for (const exp of rows) {
    const statusColor = getExpenseStatusColor(exp.status);
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition-colors";
    tr.innerHTML = `
      <td class="py-2 pr-3 text-sm text-slate-600">${exp.expense_date ? formatDateForDisplay(exp.expense_date) : "—"}</td>
      <td class="py-2 pr-3">
        <span class="chip">${esc(exp.category || "—")}</span>
      </td>
      <td class="py-2 pr-3 text-sm text-slate-600">${esc(exp.subcategory || "—")}</td>
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(exp.description || "—")}</td>
      <td class="py-2 pr-3 font-semibold text-slate-900">${formatMoney(exp.amount || 0, exp.currency || "SAR")}</td>
      <td class="py-2 pr-3">
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor}">
          ${esc(exp.status || "PENDING")}
        </span>
      </td>
      <td class="py-2 pr-3 text-sm text-slate-600">${esc(exp.vendor || "—")}</td>
      <td class="py-2 pr-3 text-right">
        <button data-del-exp="${exp.id}" class="px-3 py-1 rounded-xl border border-red-200 bg-white text-red-600 text-xs hover:bg-red-50 transition-colors" ${canWrite ? "" : "disabled"}>
          Delete
        </button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-del-exp]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-exp");
      const r = await apiDelete(`/api/project-execution/${projectId}/expenses/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshExpenses();
      toast("Expense deleted", "success");
    });
  });
}

async function addExpense() {
  clearError();
  const categoryEl = $("expCategory");
  const subcategoryEl = $("expSubcategory");
  const descriptionEl = $("expDescription");
  const amountEl = $("expAmount");
  const dateEl = $("expDate");
  const statusEl = $("expStatus");
  const vendorEl = $("expVendor");
  const referenceEl = $("expReference");
  const notesEl = $("expNotes");

  if (!categoryEl || !amountEl) {
    return showError("Expense form not found.");
  }

  const category = (categoryEl.value || "").trim().toUpperCase();
  const subcategory = (subcategoryEl?.value || "").trim() || null;
  const description = (descriptionEl?.value || "").trim() || null;
  const amount = parseFloat(amountEl.value || 0);
  const expense_date = dateEl?.value || new Date().toISOString().split("T")[0];
  const status = (statusEl?.value || "PENDING").toUpperCase();
  const vendor = (vendorEl?.value || "").trim() || null;
  const reference = (referenceEl?.value || "").trim() || null;
  const notes = (notesEl?.value || "").trim() || null;

  if (!category) return showError("Category is required.");
  if (!amount || amount <= 0) return showError("Amount must be greater than 0.");

  const r = await apiPost(`/api/project-execution/${projectId}/expenses`, {
    category,
    subcategory,
    description,
    amount,
    currency: "SAR",
    expense_date,
    status,
    vendor,
    reference,
    notes
  });

  if (!r.ok) return showError(r.details || r.error || "Add expense failed");

  // Clear form
  if (categoryEl) categoryEl.value = "";
  if (subcategoryEl) subcategoryEl.value = "";
  if (descriptionEl) descriptionEl.value = "";
  if (amountEl) amountEl.value = "";
  if (dateEl) dateEl.value = "";
  if (statusEl) statusEl.value = "PENDING";
  if (vendorEl) vendorEl.value = "";
  if (referenceEl) referenceEl.value = "";
  if (notesEl) notesEl.value = "";

  await refreshExpenses();
  toast("Expense added", "success");
}

async function refreshExpenses() {
  try {
    const rows = await loadExpenses();
    renderExpenses(rows);
    updateFinancialSummary();
  } catch (e) {
    console.error("Failed to load expenses:", e);
    renderExpenses([]);
  }
}

function updateFinancialSummary() {
  if (!project) return;

  const projectValue = parseFloat(project.value_sar || project.project_value || 0);
  const expenses = window.allExpenses || [];
  const totalExpenses = expenses.reduce((sum, exp) => {
    const amount = parseFloat(exp.amount || 0);
    // Convert to SAR if needed (simplified - assumes 1:1 for now)
    return sum + amount;
  }, 0);

  const profitLoss = projectValue - totalExpenses;

  // Update KPI cards
  const expensesEl = $("kpiExpenses");
  const profitEl = $("kpiProfit");

  if (expensesEl) {
    expensesEl.textContent = formatMoney(totalExpenses, "SAR");
  }

  if (profitEl) {
    profitEl.textContent = formatMoney(profitLoss, "SAR");
    if (profitLoss >= 0) {
      profitEl.className = "kpi-value text-green-600";
    } else {
      profitEl.className = "kpi-value text-red-600";
    }
  }
}

/* =========================
   CHARTS
========================= */

let tasksStatusChartInstance = null;
let expensesChartInstance = null;
let timelineProgressChartInstance = null;

async function renderTasksStatusChart() {
  const canvas = document.getElementById("tasksStatusChart");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    // First, check if Chart.js has registered this canvas and destroy it
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn("Error destroying existing chart on canvas:", e);
      }
    }

    // Also destroy our stored instance if it exists
    if (tasksStatusChartInstance) {
      try {
        tasksStatusChartInstance.destroy();
      } catch (e) {
        console.warn("Error destroying tasks status chart instance:", e);
      }
      tasksStatusChartInstance = null;
    }

    // Small delay to ensure canvas is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    const tasks = await loadTasks().catch(() => []);
    const statusCounts = {};
    tasks.forEach(t => {
      const status = (t.status || "TODO").toUpperCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const colors = labels.map(s => {
      if (s === "DONE" || s === "COMPLETED") return "#4ca585"; // green
      if (s === "IN_PROGRESS" || s === "INPROGRESS") return "#54c0e8"; // blue
      if (s === "BLOCKED" || s === "CANCELLED") return "#ef4444"; // red
      return "#94a3b8"; // slate
    });

    if (data.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No tasks data", canvas.width / 2, canvas.height / 2);
      return;
    }

    tasksStatusChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 10,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.label}: ${item.parsed} task${item.parsed !== 1 ? "s" : ""}`
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("Failed to render tasks status chart:", e);
  }
}

async function renderExpensesChart() {
  const canvas = document.getElementById("expensesChart");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    // First, check if Chart.js has registered this canvas and destroy it
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn("Error destroying existing chart on canvas:", e);
      }
    }

    // Also destroy our stored instance if it exists
    if (expensesChartInstance) {
      try {
        expensesChartInstance.destroy();
      } catch (e) {
        console.warn("Error destroying expenses chart instance:", e);
      }
      expensesChartInstance = null;
    }

    // Small delay to ensure canvas is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    const expenses = await loadExpenses().catch(() => []);

    // Group expenses by category and sum amounts
    const categoryTotals = {};
    expenses.forEach(exp => {
      const category = (exp.category || "OTHER").toUpperCase();
      const amount = parseFloat(exp.amount || 0);
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Color mapping for expense categories
    const categoryColors = {
      "SALARIES": "#625d9c",      // REVIVA Purple
      "MATERIALS": "#4ca585",      // REVIVA Green
      "TRAVEL": "#54c0e8",         // REVIVA Blue
      "EQUIPMENT": "#66a286",      // Patina
      "SUBCONTRACTOR": "#5f84b5",  // Hippie Blue
      "OTHER": "#94a3b8"           // Slate
    };

    const colors = labels.map(cat => categoryColors[cat] || "#94a3b8");

    if (data.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No expenses data", canvas.width / 2, canvas.height / 2);
      return;
    }

    expensesChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 10,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const label = item.label || "";
                const value = item.parsed || 0;
                const total = data.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${formatMoney(value, "SAR")} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("Failed to render expenses chart:", e);
  }
}

async function renderTimelineProgressChart() {
  const canvas = document.getElementById("timelineProgressChart");
  if (!canvas || typeof Chart === "undefined") return;

  try {
    // First, check if Chart.js has registered this canvas and destroy it
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn("Error destroying existing chart on canvas:", e);
      }
    }

    // Also destroy our stored instance if it exists
    if (timelineProgressChartInstance) {
      try {
        timelineProgressChartInstance.destroy();
      } catch (e) {
        console.warn("Error destroying timeline progress chart instance:", e);
      }
      timelineProgressChartInstance = null;
    }

    // Small delay to ensure canvas is ready
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!project || !project.start_date || !project.target_end_date) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No timeline data", canvas.width / 2, canvas.height / 2);
      return;
    }

    const start = new Date(project.start_date);
    const end = new Date(project.target_end_date);
    const now = new Date();
    const total = end - start;
    const elapsed = Math.max(0, now - start);
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));

    timelineProgressChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Completed", "Remaining"],
        datasets: [{
          data: [progress, 100 - progress],
          backgroundColor: ["#4ca585", "#e2e8f0"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      },
      plugins: [{
        id: "progressText",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
          const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
          ctx.save();
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.round(progress)}%`, centerX, centerY - 10);
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#64748b";
          ctx.fillText("Progress", centerX, centerY + 15);
          ctx.restore();
        }
      }]
    });
  } catch (e) {
    console.error("Failed to render timeline progress chart:", e);
  }
}

/* =========================
   BUDGET
========================= */

async function loadBudget() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/budget`);
    if (!r.ok) return [];
    return r.data || [];
  } catch (e) {
    console.error("Failed to load budget:", e);
    return [];
  }
}

async function loadBudgetSummary() {
  try {
    const r = await apiGet(`/api/project-execution/${projectId}/budget/summary`);
    if (!r.ok) return null;
    return r.data;
  } catch (e) {
    console.error("Failed to load budget summary:", e);
    return null;
  }
}

function renderBudget(rows) {
  const tb = $("budgetTbody");
  if (!tb) return;
  tb.innerHTML = "";

  const canWrite = isWriteUser(me);

  if (rows.length === 0) {
    tb.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No budget items yet. Add your first budget item above.</td></tr>`;
    return;
  }

  for (const item of rows) {
    const budgeted = parseFloat(item.budgeted_amount || 0);
    const actual = parseFloat(item.actual_amount || 0);
    const remaining = budgeted - actual;
    const statusColor = getBudgetStatusColor(item.status);

    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition-colors";
    tr.innerHTML = `
      <td class="py-2 pr-3 font-medium text-slate-900">${esc(item.category || "—")}</td>
      <td class="py-2 pr-3 text-sm text-slate-600">${esc(item.subcategory || "—")}</td>
      <td class="py-2 pr-3 text-sm text-slate-600">${esc(item.description || "—")}</td>
      <td class="py-2 pr-3 font-semibold text-slate-900">${formatMoney(budgeted, item.currency || "SAR")}</td>
      <td class="py-2 pr-3 font-semibold ${actual > budgeted ? "text-red-600" : "text-green-600"}">${formatMoney(actual, item.currency || "SAR")}</td>
      <td class="py-2 pr-3 font-semibold ${remaining < 0 ? "text-red-600" : "text-slate-900"}">${formatMoney(remaining, item.currency || "SAR")}</td>
      <td class="py-2 pr-3">
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColor}">
          ${esc(item.status || "—")}
        </span>
      </td>
      <td class="py-2 pr-3 text-right">
        <button data-del-budget="${item.id}" class="px-3 py-1 rounded-xl border border-red-200 bg-white text-red-600 text-xs hover:bg-red-50 transition-colors" ${canWrite ? "" : "disabled"}>
          Delete
        </button>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.querySelectorAll("button[data-del-budget]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-budget");
      const r = await apiDelete(`/api/project-execution/${projectId}/budget/${id}`);
      if (!r.ok) return showError(r.details || r.error || "Delete failed");
      await refreshBudget();
      toast("Budget item deleted", "success");
    });
  });
}

function getBudgetStatusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED" || s === "ACTIVE") return "bg-green-50 text-green-700 border-green-200";
  if (s === "CLOSED") return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

async function updateBudgetSummary() {
  const summary = await loadBudgetSummary();
  if (!summary) return;

  safeSetText("budgetTotal", formatMoney(summary.total_budgeted || 0, "SAR"));
  safeSetText("budgetActual", formatMoney(summary.total_actual || 0, "SAR"));
  safeSetText("budgetRemaining", formatMoney(summary.remaining || 0, "SAR"));

  const utilizationEl = $("budgetUtilization");
  if (utilizationEl) {
    const util = summary.utilization || 0;
    utilizationEl.textContent = `${util}%`;
    if (util > 100) {
      utilizationEl.className = "text-2xl font-bold text-red-900";
    } else if (util > 80) {
      utilizationEl.className = "text-2xl font-bold text-orange-900";
    } else {
      utilizationEl.className = "text-2xl font-bold text-orange-900";
    }
  }
}

async function addBudgetItem() {
  clearError();
  const categoryEl = $("budgetCategory");
  const amountEl = $("budgetAmount");
  const statusEl = $("budgetStatus");
  const descriptionEl = $("budgetDescription");
  const subcategoryEl = $("budgetSubcategory");
  const notesEl = $("budgetNotes");

  if (!categoryEl || !amountEl) {
    return showError("Budget form not found.");
  }

  const category = (categoryEl.value || "").trim().toUpperCase();
  const budgeted_amount = parseFloat(amountEl.value || 0);
  const status = (statusEl?.value || "PLANNED").toUpperCase();
  const description = (descriptionEl?.value || "").trim() || null;
  const subcategory = (subcategoryEl?.value || "").trim() || null;
  const notes = (notesEl?.value || "").trim() || null;

  if (!category) return showError("Category is required.");
  if (!budgeted_amount || budgeted_amount <= 0) return showError("Budgeted amount must be greater than 0.");

  const r = await apiPost(`/api/project-execution/${projectId}/budget`, {
    category,
    subcategory,
    description,
    budgeted_amount,
    currency: "SAR",
    status,
    notes
  });

  if (!r.ok) return showError(r.details || r.error || "Add budget item failed");

  // Clear form
  if (categoryEl) categoryEl.value = "";
  if (amountEl) amountEl.value = "";
  if (statusEl) statusEl.value = "PLANNED";
  if (descriptionEl) descriptionEl.value = "";
  if (subcategoryEl) subcategoryEl.value = "";
  if (notesEl) notesEl.value = "";

  await refreshBudget();
  toast("Budget item added", "success");
}

async function refreshBudget() {
  try {
    const rows = await loadBudget();
    renderBudget(rows);
    await updateBudgetSummary();
  } catch (e) {
    console.error("Failed to load budget:", e);
    renderBudget([]);
  }
}

/* =========================
   INIT
========================= */

window.addEventListener("DOMContentLoaded", async () => {
  try {
    setupTabs();
    clearError();

    me = await requireAuthOrRedirect("login.html");
    projectId = qp("id");
    if (!projectId) return showError("Missing project id in URL. Use ?id=<project_uuid>");

    await loadUsers();
    await loadProject();

    // bind buttons
    $("btnSaveBasics")?.addEventListener("click", saveBasics);
    $("btnClose")?.addEventListener("click", closeProject);
    $("btnArchive")?.addEventListener("click", archiveProject);

    $("btnAddTeam")?.addEventListener("click", addTeamMembers);
    $("btnAddTask")?.addEventListener("click", addTask);
    $("btnAddMilestone")?.addEventListener("click", addMilestone);
    $("btnUpload")?.addEventListener("click", uploadDoc);
    $("btnAddInvoice")?.addEventListener("click", addInvoice);
    $("btnAddPayment")?.addEventListener("click", addPayment);
    $("btnAddPartner")?.addEventListener("click", addPartner);
    $("btnAddExpense")?.addEventListener("click", addExpense);
    $("btnAddBudget")?.addEventListener("click", addBudgetItem);

    // initial loads
    await refreshTeam();
    await refreshTasks();
    await refreshMilestones();
    await refreshDocs();
    await refreshInvoices();
    await refreshPayments();
    await refreshPartners();
    await refreshExpenses(); // Load expenses before setBasicsUI
    await refreshBudget(); // Load budget

    setBasicsUI(); // This will call updateFinancialSummary after expenses are loaded
    updateFinancialSummary(); // Ensure it's called after all data is loaded
  } catch (e) {
    showError(e?.message || "Failed to load page");
  }
});
