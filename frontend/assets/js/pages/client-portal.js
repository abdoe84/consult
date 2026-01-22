const API_BASE = (window.__API_BASE || "http://127.0.0.1:4000/api").replace(/\/$/, "");

function qp(key) { return new URLSearchParams(window.location.search).get(key); }
function $(id) { return document.getElementById(id); }

const translations = {
  en: {
    subtitle: "Review your offer and submit your decision",
    offerIdLabel: "Offer ID",
    portalDesc: "Secure client portal for offer review and decision",
    lastUpdated: "Last Updated",
    currencyLabel: "Currency",
    vatRateLabel: "VAT Rate",
    technicalOffer: "Technical Offer",
    technicalDesc: "Detailed technical specifications and scope of work",
    viewOnly: "View Only",
    financialOffer: "Financial Offer",
    financialDesc: "Complete breakdown with totals",
    sarVat: "SAR • VAT 15%",
    description: "Description",
    unit: "Unit",
    qty: "Qty",
    unitPrice: "Unit Price",
    lineTotal: "Line Total",
    subtotal: "Subtotal",
    vat: "VAT (15%)",
    grandTotal: "Grand Total",
    makeDecision: "Make Your Decision",
    decisionDesc: "Approve or reject this offer. Your feedback is valuable to us.",
    nameLabel: "Your Name (optional)",
    nameHelp: "Helpful for follow-up communication",
    commentsLabel: "Comments (required for rejection)",
    commentsHelp: "Required if rejecting the offer",
    linkUnique: "This link is unique to you • Please do not share",
    decisionCommunicated: "Your decision will be communicated to our team",
    rejectOffer: "Reject Offer",
    approveOffer: "Approve Offer",
    langText: "English",
    namePlaceholder: "Enter your name for reference",
    commentsPlaceholder: "Share your feedback, questions, or concerns..."
  },
  ar: {
    subtitle: "راجع عرضك وأرسل قرارك",
    offerIdLabel: "رقم العرض",
    portalDesc: "بوابة عميل آمنة لمراجعة العرض واتخاذ القرار",
    lastUpdated: "آخر تحديث",
    currencyLabel: "العملة",
    vatRateLabel: "معدل الضريبة",
    technicalOffer: "العرض الفني",
    technicalDesc: "المواصفات الفنية التفصيلية ونطاق العمل",
    viewOnly: "للعرض فقط",
    financialOffer: "العرض المالي",
    financialDesc: "تفصيل كامل مع الإجماليات",
    sarVat: "ريال • ضريبة 15%",
    description: "الوصف",
    unit: "الوحدة",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "إجمالي السطر",
    subtotal: "المجموع الفرعي",
    vat: "الضريبة (15%)",
    grandTotal: "الإجمالي الكلي",
    makeDecision: "اتخذ قرارك",
    decisionDesc: "وافق أو ارفض هذا العرض. ملاحظاتك قيمة بالنسبة لنا.",
    nameLabel: "اسمك (اختياري)",
    nameHelp: "مفيد للتواصل اللاحق",
    commentsLabel: "التعليقات (مطلوبة للرفض)",
    commentsHelp: "مطلوبة إذا كنت ترفض العرض",
    linkUnique: "هذا الرابط فريد لك • يرجى عدم مشاركته",
    decisionCommunicated: "سيتم إبلاغ فريقنا بقرارك",
    rejectOffer: "رفض العرض",
    approveOffer: "الموافقة على العرض",
    langText: "العربية",
    namePlaceholder: "أدخل اسمك للرجوع إليه",
    commentsPlaceholder: "شارك ملاحظاتك، أسئلتك، أو مخاوفك..."
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Update all elements with data-key
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-placeholder-key]').forEach(el => {
    const key = el.getAttribute('data-placeholder-key');
    if (translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // Update lang button
  const langTextEl = $('langText');
  if (langTextEl) langTextEl.textContent = translations[lang].langText;
}

// Initialize language on load
setLanguage(currentLang);

// Language toggle
$('langToggle').addEventListener('click', () => {
  const newLang = currentLang === 'ar' ? 'en' : 'ar';
  setLanguage(newLang);
});

function showError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.classList.remove("hidden");

  // Auto-hide error after 5 seconds
  setTimeout(() => {
    clearError();
  }, 5000);
}

function clearError() {
  const box = $("errorBox");
  if (!box) return;
  box.classList.add("hidden");
  box.textContent = "";
}

function showSuccess(msg) {
  const box = $("successBox");
  if (!box) return;
  box.textContent = msg;
  box.classList.remove("hidden");

  // Auto-hide success after 5 seconds
  setTimeout(() => {
    clearSuccess();
  }, 5000);
}

function clearSuccess() {
  const box = $("successBox");
  if (!box) return;
  box.classList.add("hidden");
  box.textContent = "";
}

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function money(n, currency = "SAR") {
  const v = Number(n || 0);
  const formatted = v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${formatted} ${currency}`;
}

function safeJson(x) {
  if (x == null) return {};
  if (typeof x === "string") {
    try { return JSON.parse(x); } catch { return {}; }
  }
  if (typeof x === "object") return x;
  return {};
}

function updateStatusBadge(status, elementId = "statusChip") {
  const element = $(elementId);
  if (!element) return;

  const statusUpper = (status || "N/A").toUpperCase();

  // Reset classes
  element.className = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold";

  if (statusUpper.includes("APPROVED")) {
    element.classList.add("bg-emerald-50", "text-emerald-700", "border-emerald-300");
    element.innerHTML = '<span>✓</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("REJECTED")) {
    element.classList.add("bg-red-50", "text-red-700", "border-red-300");
    element.innerHTML = '<span>✕</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("PENDING")) {
    element.classList.add("bg-amber-50", "text-amber-700", "border-amber-300");
    element.innerHTML = '<span>⏱</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("DRAFT")) {
    element.classList.add("bg-slate-50", "text-slate-700", "border-slate-300");
    element.innerHTML = '<span>📝</span><span>' + statusUpper + '</span>';
  } else if (statusUpper.includes("SUBMITTED")) {
    element.classList.add("bg-blue-50", "text-blue-700", "border-blue-300");
    element.innerHTML = '<span>📤</span><span>' + statusUpper + '</span>';
  } else {
    element.classList.add("bg-slate-50", "text-slate-700", "border-slate-300");
    element.innerHTML = '<span>📋</span><span>' + statusUpper + '</span>';
  }
}

async function apiFetch(path, { method = "GET", body } = {}) {
  // Show loading state for long operations
  const showLoading = method !== "GET" || path.includes("decision");

  if (showLoading) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm';
    loadingIndicator.id = 'loadingOverlay';
    loadingIndicator.innerHTML = `
      <div class="text-center">
        <div class="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
             style="border-color: #54c0e8; border-top-color: transparent;"></div>
        <div class="text-sm text-slate-600">Processing...</div>
      </div>
    `;
    document.body.appendChild(loadingIndicator);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    const unwrap = (x) => (x?.data ?? x);

    if (!res.ok) {
      const msg =
        unwrap(json)?.details ||
        unwrap(json)?.error ||
        unwrap(json)?.message ||
        `HTTP ${res.status} ${res.statusText}`;
      const e = new Error(msg);
      e.status = res.status;
      e.payload = json;
      throw e;
    }
    return unwrap(json);
  } finally {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }
}

function renderTechnical(technical) {
  const box = $("technicalBox");
  if (!box) return;

  const t = safeJson(technical);

  if (!t || Object.keys(t).length === 0) {
    box.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">📄</div>
        <div class="font-medium">No technical details provided</div>
        <div class="text-xs mt-1">Contact REVIVA for more information</div>
      </div>
    `;
    return;
  }

  const sections = Array.isArray(t?.sections) ? t.sections : null;

  if (sections && sections.length) {
    box.innerHTML = sections.map((s, index) => {
      const title = String(s?.title || `Section ${index + 1}`);
      const content = String(s?.content || "");

      return `
        <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                 style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
              ${index + 1}
            </div>
            <div class="text-lg font-bold text-slate-800" style="color: var(--scampi);">${title}</div>
          </div>
          <div class="text-slate-700 leading-relaxed whitespace-pre-line pl-11">${content || '<span class="text-slate-400">No content provided</span>'}</div>
        </div>
      `;
    }).join("");
    return;
  }

  // fallback if it's not sections-based
  box.innerHTML = `
    <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg">
      <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${JSON.stringify(t, null, 2)}</div>
    </div>
  `;
}

function renderFinancial(financial) {
  const body = $("financialBody");
  if (!body) return;

  const f = safeJson(financial);
  const items =
    Array.isArray(f?.items) ? f.items :
    Array.isArray(f?.lines) ? f.lines :
    [];

  const currency = String(f?.currency || "SAR");
  const vatRate = Number(f?.vat_rate ?? 0.15);
  const currencyEl = $("currency");
  if (currencyEl) currencyEl.textContent = currency;
  const vatRateEl = $("vatRate");
  if (vatRateEl) vatRateEl.textContent = `${Math.round(vatRate * 100)}%`;
  if ($("vatRateDisplay")) $("vatRateDisplay").textContent = `${Math.round(vatRate * 100)}%`;

  const notes = f?.notes || f?.note || "";
  const notesEl = $("financialNotes");
  if (notesEl) notesEl.innerHTML = notes ? `
    <div class="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-sm text-slate-700">
      <div class="font-medium mb-1">Notes:</div>
      <div>${notes}</div>
    </div>
  ` : "";

  if (!items.length) {
    body.innerHTML = `
      <tr>
        <td class="py-8 text-center text-slate-500" colspan="5">
          <div class="text-3xl mb-2">💰</div>
          <div class="font-medium">No financial items available</div>
        </td>
      </tr>
    `;
    const subTotalEl = $("subTotal");
    if (subTotalEl) subTotalEl.textContent = "—";
    const vatTotalEl = $("vatTotal");
    if (vatTotalEl) vatTotalEl.textContent = "—";
    const grandTotalEl = $("grandTotal");
    if (grandTotalEl) grandTotalEl.textContent = "—";
    return;
  }

  body.innerHTML = items.map((it, index) => {
    const desc = it.description ?? it.title ?? "";
    const unit = it.unit ?? "—";
    const qty = Number(it.qty ?? it.quantity ?? 0);

    // Support both old and new format
    let lineTotal, finalUnitPrice;

    if (it.base_cost !== undefined) {
      // New format with percentages (client sees final price only - percentages hidden)
      const baseCost = Number(it.base_cost || 0);
      const profitPercent = Number(it.profit_percent || 0);
      const contingencyPercent = Number(it.contingency_percent || 0);
      const discountPercent = Number(it.discount_percent || 0);

      // Calculate using new formula (client sees final price only)
      const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
      finalUnitPrice = unitPriceAfterPercentages * (1 - (discountPercent / 100));
      lineTotal = finalUnitPrice * qty;
    } else {
      // Old format
      const baseUnitPrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0);
      const contingency = Number(it.contingency ?? 0);
      const profit = Number(it.profit ?? 0);
      const baseTotal = qty * baseUnitPrice;
      lineTotal = baseTotal + contingency + profit;
      finalUnitPrice = qty > 0 ? lineTotal / qty : 0;
    }

    const isEven = index % 2 === 0;

    return `
      <tr class="group transition-all hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent border-b border-slate-200/50 ${isEven ? 'bg-white' : 'bg-slate-50/30'}">
        <td class="px-6 py-5">
          <div class="font-semibold text-slate-800 text-base">${desc || '<span class="text-slate-400 italic">No description</span>'}</div>
        </td>
        <td class="px-6 py-5 text-center">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 border border-slate-300">${unit}</span>
        </td>
        <td class="px-6 py-5 text-center">
          <span class="inline-flex items-center justify-center w-12 h-12 rounded-lg text-base font-bold bg-blue-50 text-blue-700 border-2 border-blue-200">${qty}</span>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="text-base font-semibold text-slate-700">${money(finalUnitPrice, currency)}</div>
          <div class="text-xs text-slate-500 mt-1">per ${unit}</div>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg px-4 py-3 inline-block">
            <div class="text-lg font-bold text-slate-800">${money(lineTotal, currency)}</div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Prefer stored totals if present
  const totals = safeJson(f?.totals || {});
  let subtotal = Number(totals?.subtotal);
  let vat = Number(totals?.vat);
  let grand = Number(totals?.total);

  const validTotals = Number.isFinite(subtotal) && Number.isFinite(vat) && Number.isFinite(grand);

  if (!validTotals) {
    // Calculate subtotal (client sees final prices only, percentages hidden)
    subtotal = items.reduce((s, it) => {
      const q = Number(it.qty ?? it.quantity ?? 0);

      if (it.base_cost !== undefined) {
        // New format
        const baseCost = Number(it.base_cost || 0);
        const profitPercent = Number(it.profit_percent || 0);
        const contingencyPercent = Number(it.contingency_percent || 0);
        const discountPercent = Number(it.discount_percent || 0);

        const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
        const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
        return s + (unitPriceAfterDiscount * q);
      } else {
        // Old format
        const basePrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0);
        const contingency = Number(it.contingency ?? 0);
        const profit = Number(it.profit ?? 0);
        const baseTotal = q * basePrice;
        return s + baseTotal + contingency + profit;
      }
    }, 0);
    vat = subtotal * (Number.isFinite(vatRate) ? vatRate : 0.15);
    grand = subtotal + vat;
  }

  const subTotalEl = $("subTotal");
  if (subTotalEl) subTotalEl.textContent = money(subtotal, currency);
  const vatTotalEl = $("vatTotal");
  if (vatTotalEl) vatTotalEl.textContent = money(vat, currency);
  const grandTotalEl = $("grandTotal");
  if (grandTotalEl) grandTotalEl.textContent = money(grand, currency);
  if ($("vatRateDisplay")) {
    const vatPercent = (Number.isFinite(vatRate) ? vatRate : 0.15) * 100;
    $("vatRateDisplay").textContent = `${vatPercent.toFixed(0)}%`;
  }
}

function lockDecisionUI() {
  const a = $("btnApprove");
  const r = $("btnReject");
  const n = $("clientName");
  const c = $("clientComment");

  if (a) {
    a.disabled = true;
    a.classList.add("opacity-50", "cursor-not-allowed");
  }
  if (r) {
    r.disabled = true;
    r.classList.add("opacity-50", "cursor-not-allowed");
  }
  if (n) {
    n.disabled = true;
    n.classList.add("bg-slate-100", "cursor-not-allowed");
  }
  if (c) {
    c.disabled = true;
    c.classList.add("bg-slate-100", "cursor-not-allowed");
  }
}

function setButtonLoading(button, isLoading) {
  if (!button) return;

  if (isLoading) {
    const originalText = button.innerHTML;
    button.dataset.originalText = originalText;
    button.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 border-2 rounded-full animate-spin"
             style="border-color: currentColor; border-top-color: transparent;"></div>
        Processing...
      </div>
    `;
    button.disabled = true;
  } else {
    const originalText = button.dataset.originalText;
    if (originalText) {
      button.innerHTML = originalText;
    }
    button.disabled = false;
  }
}

async function main() {
  clearError();
  clearSuccess();

  // Show initial loading
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm';
  loadingIndicator.innerHTML = `
    <div class="text-center">
      <div class="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
           style="border-color: #54c0e8; border-top-color: transparent;"></div>
      <div class="text-sm text-slate-600">Loading offer details...</div>
    </div>
  `;
  document.body.appendChild(loadingIndicator);

  try {
    const token = String(qp("token") || "").trim();
    if (!token) {
      showError("Missing token in URL. Please use the secure link provided by REVIVA.");
      return;
    }

    // Load offer
    const offer = await apiFetch(`/offers/portal?token=${encodeURIComponent(token)}`);

    const offerIdEl = $("offerId");
    if (offerIdEl) offerIdEl.textContent = offer?.id || "—";

    const updatedAtEl = $("updatedAt");
    if (updatedAtEl) updatedAtEl.textContent = fmtDate(offer?.updated_at);

    const subTitleEl = $("subTitle");
    if (subTitleEl) subTitleEl.textContent = offer?.title ? `Reviewing: ${offer.title}` : "Review your offer and submit decision";

    const status = String(offer?.status || "—");
    updateStatusBadge(status, "statusChip");

    renderTechnical(offer?.technical_data);
    renderFinancial(offer?.financial_data);

    // If already decided, show and lock
    if (offer?.client_decision_at) {
      const decision = offer.client_decision?.toUpperCase() || "DECIDED";
      const message = decision === "APPROVE"
        ? `✓ Offer approved on ${fmtDate(offer.client_decision_at)}. Thank you for your business!`
        : `✕ Offer rejected on ${fmtDate(offer.client_decision_at)}. Thank you for your feedback.`;

      showSuccess(message);
      lockDecisionUI();
    }

    const btnApprove = $("btnApprove");
    const btnReject = $("btnReject");

    btnApprove?.addEventListener("click", async () => {
      clearError();
      clearSuccess();

      const name = String($("clientName")?.value || "").trim();
      const comment = String($("clientComment")?.value || "").trim();

      setButtonLoading(btnApprove, true);
      setButtonLoading(btnReject, true);

      try {
        const resp = await apiFetch(`/offers/portal/decision`, {
          method: "POST",
          body: { token, decision: "APPROVE", name, comment },
        });

        showSuccess(`
          <div class="flex items-center gap-2">
            <span class="text-xl">🎉</span>
            <span>Offer approved successfully! Thank you — REVIVA will contact you with next steps.</span>
          </div>
        `);
        updateStatusBadge(String(resp?.status || "CLIENT_APPROVED"), "statusChip");
        lockDecisionUI();
      } catch (e) {
        showError(`❌ ${e?.message || "Failed to submit decision. Please try again."}`);
        setButtonLoading(btnApprove, false);
        setButtonLoading(btnReject, false);
      }
    });

    btnReject?.addEventListener("click", async () => {
      clearError();
      clearSuccess();

      const name = String($("clientName")?.value || "").trim();
      const comment = String($("clientComment")?.value || "").trim();

      if (!comment) {
        showError("💬 Comment is required to reject the offer. Please provide feedback.");
        return;
      }

      setButtonLoading(btnApprove, true);
      setButtonLoading(btnReject, true);

      try {
        const resp = await apiFetch(`/offers/portal/decision`, {
          method: "POST",
          body: { token, decision: "REJECT", name, comment },
        });

        showSuccess(`
          <div class="flex items-center gap-2">
            <span class="text-xl">📝</span>
            <span>Offer rejected. Thank you for your feedback — REVIVA will review your comments.</span>
          </div>
        `);
        updateStatusBadge(String(resp?.status || "CLIENT_REJECTED"), "statusChip");
        lockDecisionUI();
      } catch (e) {
        showError(`❌ ${e?.message || "Failed to submit decision. Please try again."}`);
        setButtonLoading(btnApprove, false);
        setButtonLoading(btnReject, false);
      }
    });

  } catch (e) {
    console.error(e);
    showError(`⚠️ ${e?.message || "Unexpected error loading offer. Please check your link and try again."}`);
  } finally {
    loadingIndicator.remove();
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
