// frontend/assets/js/pages/offer-draft.js
import { apiGet, apiPost } from "../api.js";
import { requireAuthOrRedirect, logout } from "../auth.js";

const qs = new URLSearchParams(window.location.search);
const requestId = qs.get("requestId") || qs.get("id");

const el = (id) => document.getElementById(id);

const VAT_RATE = 0.15;

let user = null;
let request = null;
let offer = null;

let techSections = [
  { id: crypto.randomUUID(), title: "Project Overview", content: "" },
  { id: crypto.randomUUID(), title: "Scope of Work", content: "" },
  { id: crypto.randomUUID(), title: "Methodology", content: "" },
  { id: crypto.randomUUID(), title: "Timeline", content: "" },
];

let finItems = [
  { id: crypto.randomUUID(), description: "", unit: "Service", qty: 1, unit_price: 0 },
];

function money(n) {
  const v = Number(n || 0);
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function showError(msg) {
  const errorBox = el("errBox");
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() {
  el("errBox").classList.add("hidden");
}

function setTab(which) {
  const techTab = el("tabTech");
  const finTab = el("tabFin");

  // Update tab styles
  if (which === "tech") {
    techTab.style.borderColor = "#54c0e8";
    techTab.style.color = "#54c0e8";
    finTab.style.borderColor = "transparent";
    finTab.style.color = "#64748b";
  } else {
    finTab.style.borderColor = "#66a286";
    finTab.style.color = "#66a286";
    techTab.style.borderColor = "transparent";
    techTab.style.color = "#64748b";
  }

  // Show/hide panels
  el("panelTech").classList.toggle("hidden", which !== "tech");
  el("panelFin").classList.toggle("hidden", which !== "fin");
}

function renderTech() {
  const wrap = el("techSections");
  wrap.innerHTML = techSections
    .map(
      (s, index) => `
      <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
               style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
            ${index + 1}
          </div>
          <input data-id="${s.id}" data-field="title"
            class="flex-1 rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
            style="focus-ring-color: var(--reviva-blue);"
            value="${escapeHtml(s.title)}"
            placeholder="Section title..."
          />
          <button class="no-print w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-md bg-red-50 hover:bg-red-100 border border-red-300/50 text-red-600"
                  data-action="delSection" data-id="${s.id}"
                  title="Delete section">
            ✕
          </button>
        </div>
        <textarea data-id="${s.id}" data-field="content"
          class="w-full min-h-[140px] rounded-xl bg-white/90 border border-slate-200/60 px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
          style="focus-ring-color: var(--reviva-blue);"
          placeholder="Write section content here..."
        >${escapeHtml(s.content)}</textarea>
      </div>
    `
    )
    .join("");

  wrap.querySelectorAll("input,textarea").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const id = e.target.getAttribute("data-id");
      const field = e.target.getAttribute("data-field");
      const sec = techSections.find((x) => x.id === id);
      if (sec) sec[field] = e.target.value;

      // Add save indicator
      showSaveIndicator();
    });
  });

  wrap.querySelectorAll("[data-action='delSection']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (techSections.length <= 1) {
        showError("Cannot delete the last section");
        return;
      }
      const id = btn.getAttribute("data-id");
      techSections = techSections.filter((x) => x.id !== id);
      renderTech();
      showSaveIndicator();
    });
  });
}

function showSaveIndicator() {
  const saveBtn = el("btnSaveDraft");
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="opacity-80">●</span> Save Draft';
  setTimeout(() => {
    saveBtn.innerHTML = originalText;
  }, 1000);
}

function calcTotals() {
  const subtotal = finItems.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  el("subtotal").textContent = money(subtotal);
  el("vat").textContent = money(vat);
  el("total").textContent = money(total);
  return { subtotal, vat, total };
}

function renderFin() {
  const body = el("finBody");
  body.innerHTML = finItems
    .map((it, index) => {
      const lineTotal = Number(it.qty || 0) * Number(it.unit_price || 0);
      const isEven = index % 2 === 0;

      return `
        <tr class="transition-all hover:translate-x-1 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent ${isEven ? 'bg-slate-50/30' : 'bg-white'}">
          <td class="px-5 py-4">
            <input data-id="${it.id}" data-field="description"
              class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              style="focus-ring-color: var(--reviva-green);"
              placeholder="Description of service or item"
              value="${escapeHtml(it.description)}"
            />
          </td>
          <td class="px-5 py-4">
            <select data-id="${it.id}" data-field="unit"
              class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              style="focus-ring-color: var(--reviva-green);">
              <option value="Service" ${it.unit === 'Service' ? 'selected' : ''}>Service</option>
              <option value="Hour" ${it.unit === 'Hour' ? 'selected' : ''}>Hour</option>
              <option value="Day" ${it.unit === 'Day' ? 'selected' : ''}>Day</option>
              <option value="Week" ${it.unit === 'Week' ? 'selected' : ''}>Week</option>
              <option value="Month" ${it.unit === 'Month' ? 'selected' : ''}>Month</option>
              <option value="Unit" ${it.unit === 'Unit' ? 'selected' : ''}>Unit</option>
              <option value="Project" ${it.unit === 'Project' ? 'selected' : ''}>Project</option>
            </select>
          </td>
          <td class="px-5 py-4">
            <input type="number" min="0" step="1" data-id="${it.id}" data-field="qty"
              class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              style="focus-ring-color: var(--reviva-green);"
              value="${Number(it.qty || 0)}"
            />
          </td>
          <td class="px-5 py-4">
            <input type="number" min="0" step="0.01" data-id="${it.id}" data-field="unit_price"
              class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              style="focus-ring-color: var(--reviva-green);"
              value="${Number(it.unit_price || 0)}"
            />
          </td>
          <td class="px-5 py-4 font-bold text-slate-800 text-right">${money(lineTotal)}</td>
          <td class="no-print px-5 py-4 text-right">
            <button class="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-md bg-red-50 hover:bg-red-100 border border-red-300/50 text-red-600"
                    data-action="delRow" data-id="${it.id}"
                    title="Delete row">
              ✕
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll("input, select").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const id = e.target.getAttribute("data-id");
      const field = e.target.getAttribute("data-field");
      const row = finItems.find((x) => x.id === id);
      if (!row) return;

      if (field === "description" || field === "unit") {
        row[field] = e.target.value;
      } else {
        row[field] = Number(e.target.value || 0);
      }
      calcTotals();
      showSaveIndicator();
    });
  });

  body.querySelectorAll("[data-action='delRow']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (finItems.length <= 1) {
        showError("Cannot delete the last item");
        return;
      }
      const id = btn.getAttribute("data-id");
      finItems = finItems.filter((x) => x.id !== id);
      renderFin();
      calcTotals();
      showSaveIndicator();
    });
  });

  calcTotals();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function updateStatusBadge(elementId, status) {
  const element = el(elementId);
  if (!element) return;

  element.className = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold";
  const statusUpper = (status || "N/A").toUpperCase();

  if (statusUpper.includes("DRAFT")) {
    element.classList.add("bg-slate-50", "text-slate-700", "border-slate-300");
    element.innerHTML = '<span>📝</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("PENDING") || statusUpper.includes("REVIEW")) {
    element.classList.add("bg-amber-50", "text-amber-700", "border-amber-300");
    element.innerHTML = '<span>⏱</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("ACCEPTED") || statusUpper.includes("APPROVED")) {
    element.classList.add("bg-emerald-50", "text-emerald-700", "border-emerald-300");
    element.innerHTML = '<span>✓</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("REJECTED") || statusUpper.includes("DECLINED")) {
    element.classList.add("bg-red-50", "text-red-700", "border-red-300");
    element.innerHTML = '<span>✕</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("SUBMITTED")) {
    element.classList.add("bg-blue-50", "text-blue-700", "border-blue-300");
    element.innerHTML = '<span>📤</span><span>' + statusUpper + '</span>';
  } else {
    element.classList.add("bg-slate-50", "text-slate-700", "border-slate-300");
    element.innerHTML = '<span>📋</span><span>' + statusUpper + '</span>';
  }
}

async function load() {
  clearError();

  if (!requestId) {
    showError("Missing requestId in URL. Open this page as: offer-draft.html?requestId=...");
    return;
  }

  user = await requireAuthOrRedirect();
  if (!user) return;

  el("roleText").textContent = user.role || "—";
  el("subtitle").textContent = user.full_name ? `Offer Draft • ${user.full_name}` : `Offer Draft`;

  // Show loading state
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm';
  loadingIndicator.innerHTML = `
    <div class="text-center">
      <div class="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
           style="border-color: #54c0e8; border-top-color: transparent;"></div>
      <div class="text-sm text-slate-600">Loading offer data...</div>
    </div>
  `;
  document.body.appendChild(loadingIndicator);

  try {
    // Request
    const r = await apiGet(`/api/service-requests/${requestId}`);
    if (!r.ok) {
      showError(r.details ? `${r.error}: ${r.details}` : r.error);
      return;
    }
    request = r.data;

    el("reqTitle").textContent = request.title || "Service Request";
    el("reqRef").textContent = request.reference_no || request.id;
    updateStatusBadge("reqStatus", request.status);

    // Offer (if exists)
    const o = await apiGet(`/api/offers/by-request/${requestId}`);
    if (o.ok) {
      offer = o.data || null;
    } else {
      offer = null;
    }

    updateStatusBadge("offerStatus", offer?.status);
    el("offerId").textContent = offer?.id || "—";

    // Load saved draft json if exists
    if (offer?.technical_offer?.sections?.length) techSections = offer.technical_offer.sections;
    if (offer?.financial_offer?.items?.length) finItems = offer.financial_offer.items;

    renderTech();
    renderFin();
  } finally {
    loadingIndicator.remove();
  }
}

async function saveDraft() {
  clearError();

  if (!requestId) return;
  if (!user) return;

  // Show saving state
  const originalText = el("btnSaveDraft").innerHTML;
  el("btnSaveDraft").innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 border-2 rounded-full animate-spin"
           style="border-color: white; border-top-color: transparent;"></div>
      Saving...
    </div>
  `;
  el("btnSaveDraft").disabled = true;

  const totals = calcTotals();

  const payload = {
    technical_offer: {
      sections: techSections.map((s) => ({ id: s.id, title: s.title, content: s.content })),
    },
    financial_offer: {
      currency: "SAR",
      vat_rate: VAT_RATE,
      items: finItems.map((it) => ({
        id: it.id,
        description: it.description,
        unit: it.unit,
        qty: Number(it.qty || 0),
        unit_price: Number(it.unit_price || 0),
      })),
      totals,
    },
  };

  try {
    const res = await apiPost(`/api/offers/by-request/${requestId}`, payload);
    if (!res.ok) {
      showError(res.details ? `${res.error}: ${r.details}` : res.error);
      return;
    }

    offer = res.data;
    updateStatusBadge("offerStatus", offer?.status || "DRAFT");
    el("offerId").textContent = offer?.id || "—";

    // Show success message
    const originalText = el("btnSaveDraft").innerHTML;
    el("btnSaveDraft").innerHTML = `
      <div class="flex items-center gap-2">
        <span>✓</span>
        <span>Saved!</span>
      </div>
    `;
    setTimeout(() => {
      el("btnSaveDraft").innerHTML = originalText;
    }, 2000);
  } catch (error) {
    showError(`Failed to save: ${error.message}`);
  } finally {
    el("btnSaveDraft").innerHTML = originalText;
    el("btnSaveDraft").disabled = false;
  }
}

async function submitToManager() {
  clearError();

  if (!offer?.id) {
    showError("No offer yet. Click 'Save Draft' first to create it.");
    return;
  }

  // Show submitting state
  const originalText = el("btnSubmit").innerHTML;
  el("btnSubmit").innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 border-2 rounded-full animate-spin"
           style="border-color: var(--scampi); border-top-color: transparent;"></div>
      Submitting...
    </div>
  `;
  el("btnSubmit").disabled = true;

  try {
    const res = await apiPost(`/api/offers/${offer.id}/submit`, {});
    if (!res.ok) {
      showError(res.details ? `${res.error}: ${r.details}` : res.error);
      return;
    }

    offer = res.data;
    updateStatusBadge("offerStatus", offer?.status || "SUBMITTED_TO_MANAGER");

    // Show success message
    el("btnSubmit").innerHTML = `
      <div class="flex items-center gap-2">
        <span>✓</span>
        <span>Submitted!</span>
      </div>
    `;
    setTimeout(() => {
      el("btnSubmit").innerHTML = originalText;
      el("btnSubmit").disabled = false;
    }, 2000);
  } catch (error) {
    showError(`Failed to submit: ${error.message}`);
    el("btnSubmit").innerHTML = originalText;
    el("btnSubmit").disabled = false;
  }
}

function initUI() {
  el("logoutBtn").addEventListener("click", () => logout());

  el("backBtn").addEventListener("click", () => {
    window.location.href = `request-details.html?id=${encodeURIComponent(requestId)}`;
  });

  el("btnPrint").addEventListener("click", () => {
    window.print();
  });

  el("tabTech").addEventListener("click", () => setTab("tech"));
  el("tabFin").addEventListener("click", () => setTab("fin"));

  el("btnAddSection").addEventListener("click", () => {
    techSections.push({ id: crypto.randomUUID(), title: "New Section", content: "" });
    renderTech();
    showSaveIndicator();
  });

  el("btnAddRow").addEventListener("click", () => {
    finItems.push({ id: crypto.randomUUID(), description: "", unit: "Service", qty: 1, unit_price: 0 });
    renderFin();
    showSaveIndicator();
  });

  el("btnSaveDraft").addEventListener("click", saveDraft);
  el("btnSubmit").addEventListener("click", submitToManager);
}

initUI();
load();
