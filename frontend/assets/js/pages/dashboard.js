import { clearAuth, requireAuthOrRedirect } from "../auth.js";
import { apiGet } from "../api.js";

function $(id) { return document.getElementById(id); }

function setError(msg) {
  const box = $("errorBox");
  box.textContent = msg || "";
  box.classList.toggle("hidden", !msg);
}

function setLoading(isLoading) {
  $("loading").classList.toggle("hidden", !isLoading);
}

function setEmpty(isEmpty) {
  $("empty").classList.toggle("hidden", !isEmpty);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(status) {
  const s = String(status || "").toUpperCase();
  let cls = "bg-slate-100 text-slate-700 border-slate-300";
  let icon = "●";

  if (s === "PENDING_REVIEW") {
    cls = "bg-amber-50 text-amber-700 border-amber-300";
    icon = "⏱";
  }
  if (s === "CONSULTANT_ACCEPTED") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-300";
    icon = "✓";
  }
  if (s === "CONSULTANT_REJECTED") {
    cls = "bg-red-50 text-red-700 border-red-300";
    icon = "✕";
  }

  const displayText = s.replace(/_/g, " ");
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cls}">
    <span>${icon}</span>
    <span>${escapeHtml(displayText || "-")}</span>
  </span>`;
}

function fmtDate(x) {
  if (!x) return "-";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return String(x);
  return d.toLocaleString();
}

function buildQuery() {
  const params = new URLSearchParams();
  const status = $("filterStatus").value.trim();
  const service_type = $("filterServiceType").value.trim();
  const q = $("filterQ").value.trim();

  if (status) params.set("status", status);
  if (service_type) params.set("service_type", service_type);
  if (q) params.set("q", q);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function renderRows(items) {
  const tbody = $("rows");
  tbody.innerHTML = "";

  if (!items || items.length === 0) {
    setEmpty(true);
    return;
  }
  setEmpty(false);

  for (const r of items) {
    const id = r.id;
    const ref = r.reference_no || r.reference || r.ref_no || r.id;
    const title = r.title || r.subject || "-";
    const svc = r.service_type || "-";
    const pri = r.priority || "-";
    const status = r.status || "-";
    const created = r.created_at || r.createdAt || null;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent";
    tr.innerHTML = `
      <td class="px-5 py-4">
        <div class="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg inline-block" style="background: linear-gradient(135deg, rgba(102, 162, 134, 0.1), rgba(84, 192, 232, 0.1)); color: var(--scampi);">
          ${escapeHtml(ref)}
        </div>
      </td>
      <td class="px-5 py-4 font-medium text-slate-700">${escapeHtml(title)}</td>
      <td class="px-5 py-4 text-slate-600">${escapeHtml(svc)}</td>
      <td class="px-5 py-4">
        <span class="inline-block px-3 py-1 rounded-lg text-xs font-medium" style="background: rgba(90, 181, 196, 0.15); color: var(--fountain);">
          ${escapeHtml(pri)}
        </span>
      </td>
      <td class="px-5 py-4">${badge(status)}</td>
      <td class="px-5 py-4 text-slate-500 text-xs">${escapeHtml(fmtDate(created))}</td>
      <td class="px-5 py-4 text-right">
        <a class="inline-flex items-center rounded-xl px-4 py-2 text-xs font-medium text-white hover:shadow-lg transition-all"
           style="background: linear-gradient(135deg, var(--reviva-green), var(--fountain));"
           href="request-details.html?id=${encodeURIComponent(id)}">
          View Details →
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

let debounceTimer = null;

async function load() {
  setError("");
  setLoading(true);

  const qs = buildQuery();
  const res = await apiGet(`/api/service-requests${qs}`);

  setLoading(false);

  if (!res.ok) {
    const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
    setError(`${res.error || "Failed to load requests"}${details ? " — " + details : ""}`);
    renderRows([]);
    return;
  }

  const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
  renderRows(items);
}

(async function init() {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  $("whoami").textContent = `${user.full_name || user.email || "User"} • ${user.role || "-"}`;

  $("btnLogout").addEventListener("click", () => {
    clearAuth();
    window.location.href = "login.html";
  });

  // filters
  const trigger = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 350);
  };

  $("filterStatus").addEventListener("change", load);
  $("filterServiceType").addEventListener("input", trigger);
  $("filterQ").addEventListener("input", trigger);

  await load();
})();
