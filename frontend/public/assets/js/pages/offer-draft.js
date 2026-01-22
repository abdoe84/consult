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
];

let timelineItems = [];

// Payment terms data
let paymentMilestones = [];
let paymentMethods = [];

let finItems = [
  {
    id: crypto.randomUUID(),
    description: "",
    unit: "Service",
    qty: 1,
    base_cost: 0,  // سعر التكلفة الأساسي
    profit_percent: 0,  // نسبة الربح %
    contingency_percent: 0,  // نسبة الطوارئ %
    discount_percent: 0  // نسبة الخصم % (اختياري)
  },
];

function money(n) {
  const v = Number(n || 0);
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function showError(msg) {
  const errorBox = el("errBox");
  if (errorBox) {
    const msgSpan = errorBox.querySelector("span.font-semibold");
    if (msgSpan) {
      msgSpan.textContent = msg;
    } else {
      errorBox.textContent = msg;
    }
    errorBox.classList.remove("hidden");

    // Auto-hide after 5 seconds
    setTimeout(() => {
      clearError();
    }, 5000);
  } else {
    // Fallback: use console or alert if error box doesn't exist
    console.error(msg);
    alert(msg);
  }
}

function clearError() {
  const errorBox = el("errBox");
  if (errorBox) {
    errorBox.classList.add("hidden");
  }
}

function setTab(which) {
  const techTab = el("tabTech");
  const finTab = el("tabFin");
  const paymentTab = el("tabPayment");

  // Reset all tabs
  [techTab, finTab, paymentTab].forEach(tab => {
    if (tab) {
      tab.style.borderColor = "transparent";
      tab.style.color = "#64748b";
    }
  });

  // Update active tab style
  if (which === "tech") {
    if (techTab) {
      techTab.style.borderColor = "#54c0e8";
      techTab.style.color = "#54c0e8";
    }
  } else if (which === "fin") {
    if (finTab) {
      finTab.style.borderColor = "#66a286";
      finTab.style.color = "#66a286";
    }
  } else if (which === "payment") {
    if (paymentTab) {
      paymentTab.style.borderColor = "#635d9e";
      paymentTab.style.color = "#635d9e";
    }
  }

  // Show/hide panels
  el("panelTech")?.classList.toggle("hidden", which !== "tech");
  el("panelFin")?.classList.toggle("hidden", which !== "fin");
  el("panelPayment")?.classList.toggle("hidden", which !== "payment");
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

function renderTimeline() {
  const container = el("timelineContainer");
  if (!container) return;

  if (timelineItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 bg-white/40 border border-white/30 rounded-2xl">
        <div class="text-4xl mb-2">📅</div>
        <div class="font-medium">لا يوجد جدول زمني / No timeline defined</div>
        <div class="text-sm mt-1">انقر على "Add Phase" لإضافة مرحلة جديدة / Click "Add Phase" to add a new phase</div>
      </div>
    `;
    return;
  }

  container.innerHTML = timelineItems
    .map((item, index) => {
      const startDate = item.start_date || "";
      const endDate = item.end_date || "";
      const phase = item.phase || "";
      const description = item.description || "";
      const status = item.status || "planned";

      return `
        <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl" data-timeline-id="${item.id}">
          <div class="flex items-start gap-4">
            <!-- Timeline Icon -->
            <div class="flex flex-col items-center shrink-0">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                   style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
                ${index + 1}
              </div>
              ${index < timelineItems.length - 1 ? `
                <div class="w-0.5 h-full min-h-[60px] mt-2"
                     style="background: linear-gradient(180deg, var(--reviva-blue), var(--fountain));"></div>
              ` : ''}
            </div>

            <!-- Content -->
            <div class="flex-1 space-y-3">
              <!-- Phase Name -->
              <div>
                <input
                  type="text"
                  data-id="${item.id}"
                  data-field="phase"
                  class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md font-bold text-lg"
                  style="focus-ring-color: var(--reviva-blue);"
                  placeholder="Phase name / اسم المرحلة"
                  value="${escapeHtml(phase)}"
                />
              </div>

              <!-- Dates Row -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">Start Date / تاريخ البدء</label>
                  <input
                    type="date"
                    data-id="${item.id}"
                    data-field="start_date"
                    class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                    style="focus-ring-color: var(--reviva-blue);"
                    value="${startDate}"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">End Date / تاريخ الانتهاء</label>
                  <input
                    type="date"
                    data-id="${item.id}"
                    data-field="end_date"
                    class="w-full rounded-xl bg-white/90 border border-slate-200/60 px-4 py-2.5 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                    style="focus-ring-color: var(--reviva-blue);"
                    value="${endDate}"
                  />
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Description / الوصف</label>
                <textarea
                  data-id="${item.id}"
                  data-field="description"
                  class="w-full min-h-[100px] rounded-xl bg-white/90 border border-slate-200/60 px-4 py-3 outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                  style="focus-ring-color: var(--reviva-blue);"
                  placeholder="Describe this phase in detail..."
                >${escapeHtml(description)}</textarea>
              </div>

              <!-- Status & Delete -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <label class="text-xs font-semibold text-slate-600">Status:</label>
                  <select
                    data-id="${item.id}"
                    data-field="status"
                    class="rounded-lg bg-white/90 border border-slate-200/60 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:border-transparent transition-all"
                    style="focus-ring-color: var(--reviva-blue);"
                  >
                    <option value="planned" ${status === "planned" ? "selected" : ""}>Planned / مخطط</option>
                    <option value="in-progress" ${status === "in-progress" ? "selected" : ""}>In Progress / قيد التنفيذ</option>
                    <option value="completed" ${status === "completed" ? "selected" : ""}>Completed / مكتمل</option>
                    <option value="on-hold" ${status === "on-hold" ? "selected" : ""}>On Hold / متوقف</option>
                  </select>
                </div>
                <button
                  class="no-print w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-md bg-red-50 hover:bg-red-100 border border-red-300/50 text-red-600"
                  data-action="delTimelineItem"
                  data-id="${item.id}"
                  title="Delete phase"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Add event listeners
  container.querySelectorAll("input, textarea, select").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const id = e.target.getAttribute("data-id");
      const field = e.target.getAttribute("data-field");
      const item = timelineItems.find((x) => x.id === id);
      if (item) {
        item[field] = e.target.value;
        showSaveIndicator();
      }
    });
  });

  container.querySelectorAll("[data-action='delTimelineItem']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      timelineItems = timelineItems.filter((x) => x.id !== id);
      renderTimeline();
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

// Calculate line total for a single item
function calculateLineTotal(item) {
  const qty = Number(item.qty || 0);
  const baseCost = Number(item.base_cost || 0);
  const profitPercent = Number(item.profit_percent || 0);
  const contingencyPercent = Number(item.contingency_percent || 0);
  const discountPercent = Number(item.discount_percent || 0);

  // Calculate unit price after adding profit and contingency percentages
  // base_cost × (1 + (profit_percent/100) + (contingency_percent/100))
  const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));

  // Apply discount if any
  const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));

  // Multiply by quantity
  const lineTotal = unitPriceAfterDiscount * qty;

  return {
    baseCost,
    profitPercent,
    contingencyPercent,
    discountPercent,
    unitPriceAfterPercentages,
    unitPriceAfterDiscount,
    lineTotal,
    qty
  };
}

function calcTotals() {
  // Calculate subtotal from all line totals
  const subtotal = finItems.reduce((sum, it) => {
    const calc = calculateLineTotal(it);
    return sum + calc.lineTotal;
  }, 0);

  // Get discount total if any
  const discountTotal = finItems.reduce((sum, it) => {
    const calc = calculateLineTotal(it);
    const beforeDiscount = calc.unitPriceAfterPercentages * calc.qty;
    return sum + (beforeDiscount - calc.lineTotal);
  }, 0);

  // Subtotal before VAT (after discounts)
  const subtotalBeforeVat = subtotal;

  // VAT
  const vat = subtotalBeforeVat * VAT_RATE;

  // Grand total
  const grandTotal = subtotalBeforeVat + vat;

  // Update UI
  const subtotalEl = el("subtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotalBeforeVat);

  const discountTotalEl = el("discountTotal");
  if (discountTotalEl && discountTotal > 0) {
    discountTotalEl.textContent = money(discountTotal);
  }

  // subtotalBeforeVat is same as subtotal (after discounts)
  const subtotalBeforeVatEl = el("subtotalBeforeVat");
  if (subtotalBeforeVatEl) {
    subtotalBeforeVatEl.textContent = money(subtotalBeforeVat);
  }

  const vatRateDisplayEl = el("vatRateDisplay");
  if (vatRateDisplayEl) {
    vatRateDisplayEl.textContent = `${(VAT_RATE * 100).toFixed(0)}%`;
  }

  const vatEl = el("vat");
  if (vatEl) vatEl.textContent = money(vat);

  const totalEl = el("total");
  if (totalEl) totalEl.textContent = money(grandTotal);

  return {
    subtotal: subtotalBeforeVat,
    discountTotal,
    subtotalBeforeVat,
    vat,
    total: grandTotal
  };
}

let showPercentages = true;
let showDiscount = false;

function renderFin() {
  const body = el("finBody");
  if (!body) return;

  if (finItems.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-12 text-center text-slate-500">
          <div class="text-4xl mb-3">📊</div>
          <div class="text-lg font-medium">لا توجد بنود مالية / No financial items</div>
          <div class="text-sm mt-2">انقر على "Add Item" لإضافة بند جديد / Click "Add Item" to add a new item</div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = finItems
    .map((it, index) => {
      const calc = calculateLineTotal(it);
      const rowClass = '';

      return `
        <tr class="group ${rowClass} transition-all duration-200" data-item-id="${it.id}">
          <!-- 1. الوصف / Description -->
          <td class="px-3 py-2 align-top input-cell">
            <input
              type="text"
              data-id="${it.id}"
              data-field="description"
              class="input-field text-slate-700 font-normal placeholder-slate-400"
              placeholder="Enter description..."
              value="${escapeHtml(it.description || '')}"
              title="الوصف / Description"
            />
          </td>

          <!-- 2. الكمية / Qty -->
          <td class="px-3 py-2 align-top input-cell text-center">
            <input
              type="number"
              min="0"
              step="1"
              data-id="${it.id}"
              data-field="qty"
              class="input-field text-slate-700 font-normal text-center"
              value="${Number(it.qty || 0)}"
              title="الكمية / Quantity"
            />
          </td>

          <!-- 3. الوحدة / Unit -->
          <td class="px-3 py-2 align-top input-cell">
            <select
              data-id="${it.id}"
              data-field="unit"
              class="input-field text-slate-700 font-normal cursor-pointer"
              title="الوحدة / Unit"
            >
              <option value="Service" ${it.unit === 'Service' ? 'selected' : ''}>Service</option>
              <option value="Hour" ${it.unit === 'Hour' ? 'selected' : ''}>Hour</option>
              <option value="Day" ${it.unit === 'Day' ? 'selected' : ''}>Day</option>
              <option value="Week" ${it.unit === 'Week' ? 'selected' : ''}>Week</option>
              <option value="Month" ${it.unit === 'Month' ? 'selected' : ''}>Month</option>
              <option value="Unit" ${it.unit === 'Unit' ? 'selected' : ''}>Unit</option>
              <option value="Project" ${it.unit === 'Project' ? 'selected' : ''}>Project</option>
              <option value="Piece" ${it.unit === 'Piece' ? 'selected' : ''}>Piece</option>
            </select>
          </td>

          <!-- 4. سعر التكلفة الأساسي / Base Cost -->
          <td class="px-3 py-2 align-top input-cell text-right">
            <input
              type="number"
              min="0"
              step="0.01"
              data-id="${it.id}"
              data-field="base_cost"
              class="input-field text-slate-700 font-normal text-right"
              placeholder="0.00"
              value="${Number(it.base_cost || 0).toFixed(2)}"
              title="سعر التكلفة الأساسي / Base Cost (SAR)"
            />
          </td>

          <!-- 5. نسبة الربح % / Profit % -->
          ${showPercentages ? `
          <td class="px-3 py-2 align-top input-cell percentage-col text-center">
            <div class="percentage-input">
              <input
                type="number"
                min="0"
                step="0.1"
                max="100"
                data-id="${it.id}"
                data-field="profit_percent"
                class="input-field text-slate-700 font-normal text-center"
                placeholder="0"
                value="${Number(it.profit_percent || 0)}"
                title="أدخل نسبة الربح % / Enter Profit %"
              />
              <span class="percentage-symbol text-slate-400">%</span>
            </div>
          </td>
          ` : '<td class="px-3 py-2 percentage-col hidden"></td>'}

          <!-- 6. نسبة الطوارئ % / Contingency % -->
          ${showPercentages ? `
          <td class="px-3 py-2 align-top input-cell percentage-col text-center">
            <div class="percentage-input">
              <input
                type="number"
                min="0"
                step="0.1"
                max="100"
                data-id="${it.id}"
                data-field="contingency_percent"
                class="input-field text-slate-700 font-normal text-center"
                placeholder="0"
                value="${Number(it.contingency_percent || 0)}"
                title="أدخل نسبة الطوارئ % / Enter Contingency %"
              />
              <span class="percentage-symbol text-slate-400">%</span>
            </div>
          </td>
          ` : '<td class="px-3 py-2 percentage-col hidden"></td>'}

          <!-- 7. نسبة الخصم % / Discount % -->
          ${showDiscount ? `
          <td class="px-3 py-2 align-top input-cell discount-col text-center">
            <div class="percentage-input">
              <input
                type="number"
                min="0"
                step="0.1"
                max="100"
                data-id="${it.id}"
                data-field="discount_percent"
                class="input-field text-slate-700 font-normal text-center"
                placeholder="0"
                value="${Number(it.discount_percent || 0)}"
                title="أدخل نسبة الخصم % / Enter Discount %"
              />
              <span class="percentage-symbol text-slate-400">%</span>
            </div>
          </td>
          ` : '<td class="px-3 py-2 discount-col hidden"></td>'}

          <!-- 8. الإجمالي / Line Total -->
          <td class="px-4 py-3 align-middle text-right input-cell" data-line-total-cell="${it.id}">
            <div class="text-base font-semibold text-slate-800">${money(calc.lineTotal)}</div>
            <div class="text-xs text-slate-500 font-normal mt-0.5 opacity-70">
              ${calc.unitPriceAfterDiscount.toFixed(2)} × ${calc.qty}
            </div>
          </td>

          <!-- 9. زر الحذف / Delete Button -->
          <td class="no-print px-3 py-2 align-middle text-center">
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center transition-all hover:bg-red-50 text-slate-400 hover:text-red-600 font-medium text-sm opacity-0 group-hover:opacity-100"
              data-action="delRow"
              data-id="${it.id}"
              title="حذف البند / Delete Item"
            >
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

      // Save focus state
      const activeElement = document.activeElement;
      const cursorPosition = activeElement.selectionStart;
      const isActive = activeElement === e.target;

      if (field === "description" || field === "unit") {
        row[field] = e.target.value;
      } else {
        row[field] = Number(e.target.value || 0);
      }

      // Update only the line total cell instead of full re-render
      if (["qty", "base_cost", "profit_percent", "contingency_percent", "discount_percent"].includes(field)) {
        // Find the row and update only the line total cell using data attribute
        const rowElement = inp.closest('tr');
        if (rowElement) {
          const lineTotalCell = rowElement.querySelector(`[data-line-total-cell="${id}"]`);
          if (lineTotalCell) {
            const calc = calculateLineTotal(row);
            lineTotalCell.innerHTML = `
              <div class="text-base font-semibold text-slate-800">${money(calc.lineTotal)}</div>
              <div class="text-xs text-slate-500 font-normal mt-0.5 opacity-70">
                ${calc.unitPriceAfterDiscount.toFixed(2)} × ${calc.qty}
              </div>
            `;
          }
        }
        calcTotals();
      }

      // Restore focus and cursor position
      if (isActive && activeElement.tagName === 'INPUT') {
        setTimeout(() => {
          activeElement.focus();
          if (activeElement.setSelectionRange && cursorPosition !== null) {
            activeElement.setSelectionRange(cursorPosition, cursorPosition);
          }
        }, 0);
      }

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

  const roleText = el("roleText");
  if (roleText) roleText.textContent = user.role || "—";

  const subtitle = el("subtitle");
  if (subtitle) subtitle.textContent = user.full_name ? `Offer Draft • ${user.full_name}` : `Offer Draft`;

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
      // Check if it's a network error
      if (r.error === "Network Error") {
        showError("⚠️ Cannot connect to server. Please make sure the backend server is running on port 4000.");
      } else {
        showError(r.details ? `${r.error}: ${r.details}` : r.error);
      }
      // Remove loading indicator
      const loadingIndicator = document.querySelector('.fixed.inset-0.z-50');
      if (loadingIndicator) loadingIndicator.remove();
      return;
    }
    request = r.data;

    const reqTitle = el("reqTitle");
    if (reqTitle) reqTitle.textContent = request.title || "Service Request";

    const reqRef = el("reqRef");
    if (reqRef) reqRef.textContent = request.reference_no || request.id;

    const reqId = el("reqId");
    if (reqId) reqId.textContent = request.id || "—";

    updateStatusBadge("reqStatus", request.status);

    // Offer (if exists)
    const o = await apiGet(`/api/offers/by-request/${requestId}`);
    if (!o.ok) {
      // Check if it's a network error
      if (o.error === "Network Error") {
        showError("⚠️ Cannot connect to server. Please make sure the backend server is running on port 4000.");
        const loadingIndicator = document.querySelector('.fixed.inset-0.z-50');
        if (loadingIndicator) loadingIndicator.remove();
        return;
      }
      // For other errors, just set offer to null (offer might not exist yet)
      offer = null;
    } else {
      offer = o.data || null;

      // If offer exists and is not DRAFT, show a warning
      if (offer && offer.status && offer.status.toUpperCase() !== "DRAFT") {
        const statusUpper = offer.status.toUpperCase();
        if (statusUpper === "MANAGER_REJECTED") {
          // Manager rejected offers can be edited (according to isEditableOfferStatus)
          console.log("Offer is MANAGER_REJECTED, can be edited");
        } else {
          console.warn(`Offer exists but status is ${offer.status}. Only DRAFT and MANAGER_REJECTED offers can be edited.`);
        }
      }
    }

    updateStatusBadge("offerStatus", offer?.status);

    const offerId = el("offerId");
    if (offerId) offerId.textContent = offer?.id || "—";

    // Load saved draft json if exists
    const technicalData = offer?.technical_data || offer?.technical_offer;
    if (technicalData?.sections?.length) techSections = technicalData.sections;
    if (technicalData?.timeline?.length) timelineItems = technicalData.timeline;
    if (offer?.financial_offer?.items?.length) {
      finItems = offer.financial_offer.items.map(item => {
        // Support both old and new format
        if (item.base_cost !== undefined) {
          // New format
          return {
            id: item.id || crypto.randomUUID(),
            description: item.description || "",
            unit: item.unit || "Service",
            qty: Number(item.qty || 1),
            base_cost: Number(item.base_cost || 0),
            profit_percent: Number(item.profit_percent || 0),
            contingency_percent: Number(item.contingency_percent || 0),
            discount_percent: Number(item.discount_percent || 0),
          };
        } else {
          // Old format - convert to new format
          const unitPrice = Number(item.unit_price || 0);
          const qty = Number(item.qty || 1);
          const contingency = Number(item.contingency || 0);
          const profit = Number(item.profit || 0);
          const baseTotal = (unitPrice * qty) - contingency - profit;
          const baseCost = qty > 0 ? baseTotal / qty : 0;

          // Estimate percentages (approximate)
          const profitPercent = baseCost > 0 ? (profit / baseCost) * 100 : 0;
          const contingencyPercent = baseCost > 0 ? (contingency / baseCost) * 100 : 0;

          return {
            id: item.id || crypto.randomUUID(),
            description: item.description || "",
            unit: item.unit || "Service",
            qty: qty,
            base_cost: baseCost,
            profit_percent: profitPercent,
            contingency_percent: contingencyPercent,
            discount_percent: 0,
          };
        }
      });
    }

    // Load payment terms and contact info
    if (offer) {
      // Validity date
      if (offer.client_portal_expires_at) {
        const validityInput = el("inputValidityDate");
        if (validityInput) {
          // Convert ISO string to datetime-local format
          const date = new Date(offer.client_portal_expires_at);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          validityInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      }

      // Payment terms
      if (offer.payment_terms) {
        // Load payment milestones
        if (Array.isArray(offer.payment_terms.milestones)) {
          paymentMilestones = offer.payment_terms.milestones.map(m => ({
            id: crypto.randomUUID(),
            name: String(m.name || ""),
            percentage: Number(m.percentage) || 0,
            due_on: String(m.due_on || "on_acceptance")
          }));
          renderPaymentMilestones();
        }

        // Load payment methods
        if (Array.isArray(offer.payment_terms.methods)) {
          paymentMethods = [...offer.payment_terms.methods];
          renderPaymentMethods();
        }

        // Load bank details
        if (offer.payment_terms.bank_details) {
          const bankDetails = offer.payment_terms.bank_details;
          const bankName = el("inputBankName");
          const accountNumber = el("inputAccountNumber");
          const iban = el("inputIBAN");
          const swift = el("inputSWIFT");

          if (bankName && bankDetails.bank_name) bankName.value = bankDetails.bank_name;
          if (accountNumber && bankDetails.account_number) accountNumber.value = bankDetails.account_number;
          if (iban && bankDetails.iban) iban.value = bankDetails.iban;
          if (swift && bankDetails.swift) swift.value = bankDetails.swift;
        }
      }

      // Contact info
      if (offer.contact_info) {
        const managerName = el("inputManagerName");
        const managerEmail = el("inputManagerEmail");
        const managerPhone = el("inputManagerPhone");
        const companyAddress = el("inputCompanyAddress");
        const companyPhone = el("inputCompanyPhone");
        const companyHours = el("inputCompanyHours");

        if (offer.contact_info.account_manager) {
          const am = offer.contact_info.account_manager;
          if (managerName && am.name) managerName.value = am.name;
          if (managerEmail && am.email) managerEmail.value = am.email;
          if (managerPhone && am.phone) managerPhone.value = am.phone;
        }

        if (offer.contact_info.company) {
          const comp = offer.contact_info.company;
          if (companyAddress && comp.address) companyAddress.value = comp.address;
          if (companyPhone && comp.phone) companyPhone.value = comp.phone;
          if (companyHours && comp.hours) companyHours.value = comp.hours;
        }
      }
    }

    renderTech();
    renderTimeline();
    renderFin();
    calcTotals();
  } catch (error) {
    console.error("Load error:", error);
    if (error.message && (error.message.includes("fetch") || error.message.includes("network"))) {
      showError("⚠️ Cannot connect to server. Please make sure the backend server is running on port 4000.");
    } else {
      showError(`Failed to load: ${error.message || "Unknown error"}`);
    }
  } finally {
    // Always remove loading indicator
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }
  }
}

async function saveDraft() {
  clearError();

  if (!requestId) return;
  if (!user) return;

  // Show saving state
  const btnSaveDraft = el("btnSaveDraft");
  if (!btnSaveDraft) return;

  const originalText = btnSaveDraft.innerHTML;
  btnSaveDraft.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 border-2 rounded-full animate-spin"
           style="border-color: white; border-top-color: transparent;"></div>
      Saving...
    </div>
  `;
  btnSaveDraft.disabled = true;

  const totals = calcTotals();

  // Ensure we have valid data structures
  const payload = {
    technical_data: {
      sections: (techSections || []).map((s) => ({
        id: s.id || crypto.randomUUID(),
        title: String(s.title || ""),
        content: String(s.content || ""),
      })),
      timeline: (timelineItems || []).map((t) => ({
        id: t.id || crypto.randomUUID(),
        phase: String(t.phase || ""),
        start_date: String(t.start_date || ""),
        end_date: String(t.end_date || ""),
        description: String(t.description || ""),
        status: String(t.status || "planned"),
      })),
    },
    financial_offer: {
      currency: "SAR",
      vat_rate: Number(VAT_RATE) || 0.15,
      items: (finItems || []).map((it) => {
        const calc = calculateLineTotal(it);

        // Ensure all numeric values are valid (not NaN or Infinity)
        const safeNumber = (val, def = 0) => {
          const num = Number(val);
          return (isNaN(num) || !isFinite(num)) ? def : num;
        };

        return {
          id: it.id || crypto.randomUUID(),
          description: String(it.description || ""),
          unit: String(it.unit || "Service"),
          qty: safeNumber(it.qty, 0),
          base_cost: safeNumber(it.base_cost, 0),
          profit_percent: safeNumber(it.profit_percent, 0),
          contingency_percent: safeNumber(it.contingency_percent, 0),
          discount_percent: safeNumber(it.discount_percent, 0),
          // Keep old fields for backward compatibility
          unit_price: safeNumber(calc.unitPriceAfterDiscount, 0),
          contingency: safeNumber((calc.unitPriceAfterPercentages || 0) - (calc.baseCost || 0), 0),
          profit: safeNumber((calc.baseCost || 0) * (calc.profitPercent || 0) / 100, 0),
        };
      }),
      totals: {
        subtotal: (() => {
          const val = Number(totals.subtotal || 0);
          return isNaN(val) || !isFinite(val) ? 0 : val;
        })(),
        discountTotal: (() => {
          const val = Number(totals.discountTotal || 0);
          return isNaN(val) || !isFinite(val) ? 0 : val;
        })(),
        subtotalBeforeVat: (() => {
          const val = Number(totals.subtotalBeforeVat || 0);
          return isNaN(val) || !isFinite(val) ? 0 : val;
        })(),
        vat: (() => {
          const val = Number(totals.vat || 0);
          return isNaN(val) || !isFinite(val) ? 0 : val;
        })(),
        total: (() => {
          const val = Number(totals.total || 0);
          return isNaN(val) || !isFinite(val) ? 0 : val;
        })(),
      },
    },
  };

  // Collect payment terms and contact info
  const validityDateInput = el("inputValidityDate");
  if (validityDateInput && validityDateInput.value) {
    // Convert datetime-local to ISO string
    const dateValue = validityDateInput.value;
    if (dateValue) {
      payload.client_portal_expires_at = new Date(dateValue).toISOString();
    }
  }

  // Payment terms
  payload.payment_terms = {};

  // Payment milestones
  if (paymentMilestones && paymentMilestones.length > 0) {
    payload.payment_terms.milestones = paymentMilestones
      .filter(m => m.name && m.name.trim())
      .map(m => ({
        name: String(m.name || "").trim(),
        percentage: Number(m.percentage) || 0,
        due_on: String(m.due_on || "on_acceptance")
      }));
  }

  // Payment methods
  if (paymentMethods && paymentMethods.length > 0) {
    payload.payment_terms.methods = paymentMethods.filter(m => m && m.trim());
  }

  // Bank details
  const bankName = el("inputBankName");
  const accountNumber = el("inputAccountNumber");
  const iban = el("inputIBAN");
  const swift = el("inputSWIFT");

  if (bankName || accountNumber || iban || swift) {
    payload.payment_terms.bank_details = {};
    if (bankName && bankName.value) payload.payment_terms.bank_details.bank_name = bankName.value.trim();
    if (accountNumber && accountNumber.value) payload.payment_terms.bank_details.account_number = accountNumber.value.trim();
    if (iban && iban.value) payload.payment_terms.bank_details.iban = iban.value.trim();
    if (swift && swift.value) payload.payment_terms.bank_details.swift = swift.value.trim();
  }

  // Contact info
  const managerName = el("inputManagerName");
  const managerEmail = el("inputManagerEmail");
  const managerPhone = el("inputManagerPhone");
  const companyAddress = el("inputCompanyAddress");
  const companyPhone = el("inputCompanyPhone");
  const companyHours = el("inputCompanyHours");

  if (managerName || managerEmail || managerPhone || companyAddress || companyPhone || companyHours) {
    payload.contact_info = {};

    // Account manager
    if (managerName || managerEmail || managerPhone) {
      payload.contact_info.account_manager = {};
      if (managerName && managerName.value) payload.contact_info.account_manager.name = managerName.value.trim();
      if (managerEmail && managerEmail.value) payload.contact_info.account_manager.email = managerEmail.value.trim();
      if (managerPhone && managerPhone.value) payload.contact_info.account_manager.phone = managerPhone.value.trim();
    }

    // Company info
    if (companyAddress || companyPhone || companyHours) {
      payload.contact_info.company = {};
      if (companyAddress && companyAddress.value) payload.contact_info.company.address = companyAddress.value.trim();
      if (companyPhone && companyPhone.value) payload.contact_info.company.phone = companyPhone.value.trim();
      if (companyHours && companyHours.value) payload.contact_info.company.hours = companyHours.value.trim();
    }
  }

  try {
    // Validate requestId
    if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
      showError("Invalid request ID. Please refresh the page and try again.");
      btnSaveDraft.innerHTML = originalText;
      btnSaveDraft.disabled = false;
      return;
    }

    // Ensure requestId is properly encoded
    const encodedRequestId = encodeURIComponent(requestId.trim());

    // Validate payload can be serialized to JSON
    try {
      const testJson = JSON.stringify(payload);
      if (testJson.length > 1000000) { // 1MB limit
        showError("Payload too large. Please reduce the amount of data.");
        btnSaveDraft.innerHTML = originalText;
        btnSaveDraft.disabled = false;
        return;
      }
    } catch (jsonError) {
      console.error("JSON serialization error:", jsonError);
      showError("Invalid data format. Please check your inputs.");
      btnSaveDraft.innerHTML = originalText;
      btnSaveDraft.disabled = false;
      return;
    }

    // Log payload for debugging (only in development)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.log("Saving draft with payload:", {
        requestId: encodedRequestId,
        payloadSize: JSON.stringify(payload).length,
        itemsCount: payload.financial_offer?.items?.length || 0,
        sectionsCount: payload.technical_data?.sections?.length || 0,
      });
    }

    const res = await apiPost(`/api/offers/by-request/${encodedRequestId}`, payload);

    if (!res.ok) {
      // Log error details for debugging
      console.error("Save draft error response:", res);

      // Handle specific error cases
      let errorMsg = res.error || "Failed to save draft";

      if (res.error === "Invalid state" || (res.details && String(res.details).includes("status"))) {
        // Offer exists but is not in DRAFT status
        const statusMatch = String(res.details || "").match(/status is (\w+)/i);
        const currentStatus = statusMatch ? statusMatch[1] : "unknown";

        errorMsg = `⚠️ Cannot save draft. The offer is currently in "${currentStatus}" status. `;
        errorMsg += "Only DRAFT offers can be edited. Please contact a manager if you need to modify this offer.";

        // Try to reload the offer to get current status
        try {
          const offerRes = await apiGet(`/api/offers/by-request/${encodedRequestId}`);
          if (offerRes.ok && offerRes.data) {
            offer = offerRes.data;
            updateStatusBadge("offerStatus", offer?.status);
            const offerId = el("offerId");
            if (offerId) offerId.textContent = offer?.id || "—";
          }
        } catch (e) {
          console.error("Failed to reload offer:", e);
        }
      } else if (res.details) {
        if (typeof res.details === "string") {
          errorMsg += `: ${res.details}`;
        } else if (typeof res.details === "object") {
          errorMsg += `: ${JSON.stringify(res.details)}`;
        } else {
          errorMsg += `: ${res.details}`;
        }
      }

      showError(errorMsg);

      // Reset button state
      btnSaveDraft.innerHTML = originalText;
      btnSaveDraft.disabled = false;
      return;
    }

    offer = res.data;
    updateStatusBadge("offerStatus", offer?.status || "DRAFT");

    const offerId = el("offerId");
    if (offerId) offerId.textContent = offer?.id || "—";

    // Show success message
    btnSaveDraft.innerHTML = `
      <div class="flex items-center gap-2">
        <span>✓</span>
        <span>Saved!</span>
      </div>
    `;
    setTimeout(() => {
      btnSaveDraft.innerHTML = originalText;
      btnSaveDraft.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Save draft error:", error);
    if (error.message && error.message.includes("400")) {
      showError("Bad request. Please check that all required fields are filled correctly.");
    } else {
      showError(`Failed to save: ${error.message || "Unknown error"}`);
    }
    btnSaveDraft.innerHTML = originalText;
    btnSaveDraft.disabled = false;
  }
}

async function submitToManager() {
  clearError();

  // First, ensure we have a saved draft
  if (!offer?.id) {
    // Try to save draft first
    try {
      await saveDraft();
      // Wait a bit for the save to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      showError("Failed to save draft before submitting. Please try again.");
      return;
    }
  }

  // Check if offer still doesn't exist after save attempt
  if (!offer?.id) {
    showError("No offer yet. Click 'Save Draft' first to create it.");
    return;
  }

  // Check if offer is in DRAFT status
  if (offer.status && offer.status.toUpperCase() !== "DRAFT") {
    showError(`Cannot submit offer. Current status: ${offer.status}. Only DRAFT offers can be submitted.`);
    return;
  }

  // Show submitting state
  const btnSubmit = el("btnSubmit");
  if (!btnSubmit) return;

  const originalText = btnSubmit.innerHTML;
  btnSubmit.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 border-2 rounded-full animate-spin"
           style="border-color: var(--scampi); border-top-color: transparent;"></div>
      Submitting...
    </div>
  `;
  btnSubmit.disabled = true;

  try {
    const res = await apiPost(`/api/offers/${offer.id}/submit`, {});
    if (!res.ok) {
      // Check for specific error messages
      if (res.error === "Invalid state" && res.details?.includes("DRAFT")) {
        showError("Offer must be in DRAFT status to submit. Please save as draft first.");
      } else {
        showError(res.details ? `${res.error}: ${res.details}` : res.error);
      }
      return;
    }

    offer = res.data;
    updateStatusBadge("offerStatus", offer?.status || "SUBMITTED_TO_MANAGER");

    const offerId = el("offerId");
    if (offerId) offerId.textContent = offer?.id || "—";

    // Show success message
    btnSubmit.innerHTML = `
      <div class="flex items-center gap-2">
        <span>✓</span>
        <span>Submitted!</span>
      </div>
    `;
    setTimeout(() => {
      btnSubmit.innerHTML = originalText;
      btnSubmit.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Submit error:", error);
    if (error.message && error.message.includes("400")) {
      showError("Bad request. The offer may not be in DRAFT status. Please save as draft first.");
    } else {
      showError(`Failed to submit: ${error.message || "Unknown error"}`);
    }
  } finally {
    // Always restore button state if not already restored by success timeout
    if (btnSubmit.disabled) {
      btnSubmit.innerHTML = originalText;
      btnSubmit.disabled = false;
    }
  }
}

function initUI() {
  // Optional elements - may not exist in all pages
  el("logoutBtn")?.addEventListener("click", () => logout());
  el("backBtn")?.addEventListener("click", () => {
    window.location.href = `request-details.html?id=${encodeURIComponent(requestId)}`;
  });

  // Required elements
  const btnPrint = el("btnPrint");
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  const tabTech = el("tabTech");
  const tabFin = el("tabFin");
  const tabPayment = el("tabPayment");
  if (tabTech) tabTech.addEventListener("click", () => setTab("tech"));
  if (tabFin) tabFin.addEventListener("click", () => setTab("fin"));
  if (tabPayment) tabPayment.addEventListener("click", () => setTab("payment"));

  const btnAddSection = el("btnAddSection");
  if (btnAddSection) {
    btnAddSection.addEventListener("click", () => {
      techSections.push({ id: crypto.randomUUID(), title: "New Section", content: "" });
      renderTech();
      showSaveIndicator();
    });
  }

  const btnAddTimelineItem = el("btnAddTimelineItem");
  if (btnAddTimelineItem) {
    btnAddTimelineItem.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Add Phase button clicked");
      timelineItems.push({
        id: crypto.randomUUID(),
        phase: "",
        start_date: "",
        end_date: "",
        description: "",
        status: "planned",
      });
      renderTimeline();
      showSaveIndicator();
    });
  } else {
    console.warn("btnAddTimelineItem not found in DOM");
  }

  const btnAddRow = el("btnAddRow");
  if (btnAddRow) {
    btnAddRow.addEventListener("click", () => {
      finItems.push({
        id: crypto.randomUUID(),
        description: "",
        unit: "Service",
        qty: 1,
        base_cost: 0,
        profit_percent: 0,
        contingency_percent: 0,
        discount_percent: 0
      });
      renderFin();
      calcTotals();
      showSaveIndicator();
    });
  }

  const btnSaveDraft = el("btnSaveDraft");
  const btnSubmit = el("btnSubmit");
  if (btnSaveDraft) btnSaveDraft.addEventListener("click", saveDraft);
  if (btnSubmit) btnSubmit.addEventListener("click", submitToManager);

  // Toggle percentages visibility
  el("btnTogglePercentages")?.addEventListener("click", () => {
    showPercentages = !showPercentages;
    const btn = el("btnTogglePercentages");
    const text = el("percentagesToggleText");
    const percentageCols = document.querySelectorAll('.percentage-col');

    if (btn && text) {
      text.textContent = showPercentages ? "إخفاء النسب / Hide Percentages" : "إظهار النسب / Show Percentages";
      btn.style.background = showPercentages
        ? "linear-gradient(135deg, var(--reviva-blue), var(--fountain))"
        : "linear-gradient(135deg, var(--scampi), var(--reviva-hippy))";
    }

    // Toggle visibility of percentage columns
    percentageCols.forEach(col => {
      if (showPercentages) {
        col.classList.remove('hidden');
      } else {
        col.classList.add('hidden');
      }
    });

    renderFin();
  });

  // Toggle discount column
  el("btnToggleDiscount")?.addEventListener("click", () => {
    showDiscount = !showDiscount;
    const btn = el("btnToggleDiscount");
    const text = el("discountToggleText");
    const discountRow = el("discountRow");
    const discountCols = document.querySelectorAll('.discount-col');

    if (btn && text) {
      text.textContent = showDiscount ? "إخفاء الخصم / Hide Discount" : "إظهار الخصم / Show Discount";
      btn.style.background = showDiscount
        ? "linear-gradient(135deg, var(--reviva-green), var(--fountain))"
        : "";
      btn.style.color = showDiscount ? "white" : "var(--scampi)";
    }
    if (discountRow) {
      discountRow.classList.toggle("hidden", !showDiscount);
    }

    // Toggle visibility of discount columns
    discountCols.forEach(col => {
      if (showDiscount) {
        col.classList.remove('hidden');
      } else {
        col.classList.add('hidden');
      }
    });

    renderFin();
  });

  // Apply same percentages to all items
  el("btnApplySamePercentages")?.addEventListener("click", () => {
    if (finItems.length === 0) return;

    const profitPercent = prompt("أدخل نسبة الربح % / Enter Profit %:", "0");
    const contingencyPercent = prompt("أدخل نسبة الطوارئ % / Enter Contingency %:", "0");

    if (profitPercent === null || contingencyPercent === null) return;

    const profit = Number(profitPercent) || 0;
    const contingency = Number(contingencyPercent) || 0;

    finItems.forEach(item => {
      item.profit_percent = profit;
      item.contingency_percent = contingency;
    });

    renderFin();
    calcTotals();
    showSaveIndicator();
  });
}

// Ensure DOM is ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initUI();
    load();
  });
} else {
  // DOM is already ready
  initUI();
  load();
}
