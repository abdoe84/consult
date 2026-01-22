console.log('🚀 Client Portal Script Loading...');

const API_BASE = (window.__API_BASE || "http://127.0.0.1:4000/api").replace(/\/$/, "");
console.log('API_BASE:', API_BASE);

function qp(key) { return new URLSearchParams(window.location.search).get(key); }
function $(id) {
  const el = document.getElementById(id);
  if (!el && id) {
    console.warn('Element not found:', id);
  }
  return el;
}

// ============================================
// Utility Functions
// ============================================

function showError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.innerHTML = typeof msg === 'string' ? msg : String(msg);
  box.classList.remove("hidden");
  setTimeout(() => clearError(), 5000);
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
  box.innerHTML = typeof msg === 'string' ? msg : String(msg);
  box.classList.remove("hidden");
  setTimeout(() => clearSuccess(), 5000);
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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateStatusBadge(status, elementId = "statusChip") {
  const element = $(elementId);
  if (!element) return;

  const statusUpper = (status || "N/A").toUpperCase();
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
    if (loadingOverlay) loadingOverlay.remove();
  }
}

// ============================================
// Tab System
// ============================================

function initTabSystem() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Update buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('text-slate-600');
        btn.classList.remove('text-slate-700');
      });
      button.classList.add('active');
      button.classList.remove('text-slate-600');
      button.classList.add('text-slate-700');

      // Update contents
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      const targetContent = $(`tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// ============================================
// Countdown Timer
// ============================================

let countdownInterval = null;

function updateValidityTimer(validityDate) {
  if (!validityDate) {
    const timerEl = $("countdownTimer");
    if (timerEl) timerEl.innerHTML = '<span>—</span>';
    return;
  }

  const update = () => {
    const now = new Date().getTime();
    const validUntil = new Date(validityDate).getTime();
    const diff = validUntil - now;

    const timerEl = $("countdownTimer");
    if (!timerEl) return;

    if (diff <= 0) {
      timerEl.innerHTML = '<span class="text-red-600">Expired</span>';
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const isUrgent = diff < 48 * 60 * 60 * 1000; // Less than 48 hours
    timerEl.className = `text-sm font-bold ${isUrgent ? 'countdown-urgent text-red-600' : 'text-emerald-600'}`;
    timerEl.innerHTML = `<span>${days}d ${hours}h ${minutes}m ${seconds}s</span>`;
  };

  update();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(update, 1000);
}

// ============================================
// Sticky Elements
// ============================================

function initStickyElements() {
  const header = $("mainHeader");
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (header) {
      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    // Show/hide mini summary
    const miniSummary = $("stickyMiniSummary");
    const heroSection = $("heroSection");
    if (miniSummary && heroSection) {
      const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
      if (currentScroll > heroBottom) {
        miniSummary.classList.remove('hidden');
      } else {
        miniSummary.classList.add('hidden');
      }
    }

    lastScroll = currentScroll;
  });
}

// ============================================
// Auto-save
// ============================================

function autoSaveClientInput() {
  const nameInput = $("clientName");
  const commentInput = $("clientComment");

  const save = () => {
    const data = {
      name: nameInput?.value || '',
      comment: commentInput?.value || ''
    };
    localStorage.setItem('clientPortalInput', JSON.stringify(data));
  };

  nameInput?.addEventListener('input', save);
  commentInput?.addEventListener('input', save);

  // Load saved data
  const saved = localStorage.getItem('clientPortalInput');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (nameInput && data.name) nameInput.value = data.name;
      if (commentInput && data.comment) commentInput.value = data.comment;
    } catch (e) {
      console.error('Failed to load saved input', e);
    }
  }

  // Auto-save every 30 seconds
  setInterval(save, 30000);
}

// ============================================
// Render Functions
// ============================================

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
      const title = escapeHtml(String(s?.title || `Section ${index + 1}`));
      const content = escapeHtml(String(s?.content || "")).replace(/\n/g, '<br>');
      return `
        <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl card-hover">
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

  box.innerHTML = `
    <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg">
      <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(JSON.stringify(t, null, 2))}</div>
    </div>
  `;
}

function renderTimeline(timeline) {
  // Timeline rendering (if needed in future)
}

function renderFinancial(financial) {
  const body = $("financialBody");
  if (!body) {
    console.warn('financialBody element not found');
    return;
  }

  console.log('renderFinancial called with:', financial);
  const f = safeJson(financial);
  console.log('Parsed financial data:', f);

  const items = Array.isArray(f?.items) ? f.items : Array.isArray(f?.lines) ? f.lines : [];
  console.log('Financial items:', items);

  const currency = String(f?.currency || "SAR");
  const vatRate = Number(f?.vat_rate ?? 0.15);

  if ($("currency")) $("currency").textContent = currency;
  if ($("vatRate")) $("vatRate").textContent = `${Math.round(vatRate * 100)}%`;
  if ($("vatRateDisplay")) $("vatRateDisplay").textContent = `${Math.round(vatRate * 100)}%`;

  const notes = f?.notes || f?.note || "";
  const notesEl = $("financialNotes");
  if (notesEl) notesEl.innerHTML = notes ? `
    <div class="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3 text-sm text-slate-700">
      <div class="font-medium mb-1">Notes:</div>
      <div>${escapeHtml(notes)}</div>
    </div>
  ` : "";

  if (!items.length) {
    console.warn('No financial items found');
    body.innerHTML = `
      <tr>
        <td class="py-8 text-center text-slate-500" colspan="5">
          <div class="text-3xl mb-2">💰</div>
          <div class="font-medium">No financial items available</div>
        </td>
      </tr>
    `;
    if ($("subTotal")) $("subTotal").textContent = "—";
    if ($("vatTotal")) $("vatTotal").textContent = "—";
    if ($("grandTotal")) $("grandTotal").textContent = "—";
    if ($("heroGrandTotal")) $("heroGrandTotal").textContent = "—";
    if ($("overviewTotal")) $("overviewTotal").textContent = "—";
    return;
  }

  console.log(`Rendering ${items.length} financial items`);

  body.innerHTML = items.map((it, index) => {
    const desc = it.description ?? it.title ?? "";
    const unit = it.unit ?? "—";
    const qty = Number(it.qty ?? it.quantity ?? 0);

    let lineTotal, finalUnitPrice;
    if (it.base_cost !== undefined) {
      const baseCost = Number(it.base_cost || 0);
      const profitPercent = Number(it.profit_percent || 0);
      const contingencyPercent = Number(it.contingency_percent || 0);
      const discountPercent = Number(it.discount_percent || 0);
      const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
      finalUnitPrice = unitPriceAfterPercentages * (1 - (discountPercent / 100));
      lineTotal = finalUnitPrice * qty;
    } else {
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
          <div class="font-semibold text-slate-800 text-base">${escapeHtml(desc || 'No description')}</div>
        </td>
        <td class="px-6 py-5 text-center">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 border border-slate-300">${escapeHtml(unit)}</span>
        </td>
        <td class="px-6 py-5 text-center">
          <span class="inline-flex items-center justify-center w-12 h-12 rounded-lg text-base font-bold bg-blue-50 text-blue-700 border-2 border-blue-200">${qty}</span>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="text-base font-semibold text-slate-700">${money(finalUnitPrice, currency)}</div>
          <div class="text-xs text-slate-500 mt-1">per ${escapeHtml(unit)}</div>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg px-4 py-3 inline-block">
            <div class="text-lg font-bold text-slate-800">${money(lineTotal, currency)}</div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const totals = safeJson(f?.totals || {});
  let subtotal = Number(totals?.subtotal);
  let vat = Number(totals?.vat);
  let grand = Number(totals?.total);

  const validTotals = Number.isFinite(subtotal) && Number.isFinite(vat) && Number.isFinite(grand);
  if (!validTotals) {
    subtotal = items.reduce((s, it) => {
      const q = Number(it.qty ?? it.quantity ?? 0);
      if (it.base_cost !== undefined) {
        const baseCost = Number(it.base_cost || 0);
        const profitPercent = Number(it.profit_percent || 0);
        const contingencyPercent = Number(it.contingency_percent || 0);
        const discountPercent = Number(it.discount_percent || 0);
        const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
        const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
        return s + (unitPriceAfterDiscount * q);
      } else {
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

  // Update all total displays
  const totalValue = money(grand, currency);
  console.log('Updating totals:', { subtotal, vat, grand, totalValue });

  if ($("subTotal")) {
    $("subTotal").textContent = money(subtotal, currency);
    console.log('Updated subTotal');
  }
  if ($("vatTotal")) {
    $("vatTotal").textContent = money(vat, currency);
    console.log('Updated vatTotal');
  }
  if ($("grandTotal")) {
    $("grandTotal").textContent = totalValue;
    console.log('Updated grandTotal');
  }
  if ($("heroGrandTotal")) {
    $("heroGrandTotal").textContent = totalValue;
    console.log('Updated heroGrandTotal');
  }
  if ($("miniGrandTotal")) {
    $("miniGrandTotal").textContent = totalValue;
    console.log('Updated miniGrandTotal');
  }
  if ($("overviewTotal")) {
    $("overviewTotal").textContent = totalValue;
    console.log('Updated overviewTotal');
  }
}

// ============================================
// Payment Terms
// ============================================

function renderPaymentTerms(paymentTerms) {
  const timelineEl = $("paymentTimeline");
  const methodsEl = $("paymentMethods");
  const detailsEl = $("bankDetails");

  if (!paymentTerms) {
    // Default payment terms
    const defaultMilestones = [
      { name: "Advance", percent: 30, status: "pending" },
      { name: "Progress", percent: 40, status: "pending" },
      { name: "Final", percent: 30, status: "pending" }
    ];
    renderPaymentTimeline(defaultMilestones);
    renderPaymentMethods(["bank_transfer", "check"]);
    return;
  }

  const milestones = paymentTerms.milestones || [];
  const methods = paymentTerms.methods || ["bank_transfer", "check"];
  const bankDetails = paymentTerms.bank_details || {};

  renderPaymentTimeline(milestones);
  renderPaymentMethods(methods);
  renderBankDetails(bankDetails);
}

function renderPaymentTimeline(milestones) {
  const timelineEl = $("paymentTimeline");
  if (!timelineEl) return;

  if (!milestones.length) {
    timelineEl.innerHTML = '<p class="text-sm text-slate-500">No payment schedule provided</p>';
    return;
  }

  timelineEl.innerHTML = milestones.map((milestone, index) => {
    const isCompleted = milestone.status === "completed";
    const isPending = milestone.status === "pending";
    return `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }">
          ${isCompleted ? '✓' : '○'}
        </div>
        <div class="flex-1">
          <div class="font-semibold text-slate-800">${milestone.percent}% ${escapeHtml(milestone.name || '')}</div>
          <div class="text-xs text-slate-500">${escapeHtml(milestone.description || milestone.trigger || '')}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderPaymentMethods(methods) {
  const methodsEl = $("paymentMethods");
  if (!methodsEl) return;

  const methodLabels = {
    bank_transfer: { label: "Bank Transfer", icon: "🏦" },
    check: { label: "Check", icon: "📝" },
    cash: { label: "Cash", icon: "💵" },
    credit_card: { label: "Credit Card", icon: "💳" }
  };

  methodsEl.innerHTML = methods.map(method => {
    const info = methodLabels[method] || { label: method, icon: "💰" };
    return `
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 border border-white/40 text-sm">
        <span>${info.icon}</span>
        <span>${info.label}</span>
      </span>
    `;
  }).join("");
}

function renderBankDetails(bankDetails) {
  const detailsEl = $("bankDetails");
  if (!detailsEl) return;

  if (!bankDetails || !Object.keys(bankDetails).length) {
    detailsEl.innerHTML = '<p class="text-sm text-slate-500">Bank details not provided</p>';
    return;
  }

  detailsEl.innerHTML = `
    <div class="space-y-2 text-sm">
      ${bankDetails.bank_name ? `<div><strong>Bank:</strong> ${escapeHtml(bankDetails.bank_name)}</div>` : ''}
      ${bankDetails.account_number ? `<div><strong>Account:</strong> ${escapeHtml(bankDetails.account_number)}</div>` : ''}
      ${bankDetails.iban ? `<div><strong>IBAN:</strong> ${escapeHtml(bankDetails.iban)}</div>` : ''}
      ${bankDetails.swift ? `<div><strong>SWIFT:</strong> ${escapeHtml(bankDetails.swift)}</div>` : ''}
    </div>
  `;
}

// ============================================
// Contact Information
// ============================================

function renderContactInfo(contactInfo) {
  if (!contactInfo) {
    // Default contact info
    contactInfo = {
      account_manager: {
        name: "Ayman Alobaid",
        email: "alobaid.a@reviva.sa",
        phone: "+966XXXXXXXXX"
      },
      company: {
        address: "Jeddah, Saudi Arabia",
        phone: "+966XXXXXXXXX",
        hours: "Sun-Thu 9AM-6PM"
      }
    };
  }

  const manager = contactInfo.account_manager || {};
  const company = contactInfo.company || {};

  if ($("accountManagerName")) $("accountManagerName").textContent = manager.name || "—";
  if ($("accountManagerEmail")) {
    const emailEl = $("accountManagerEmail");
    emailEl.textContent = manager.email || "—";
    emailEl.href = manager.email ? `mailto:${manager.email}` : "#";
  }
  if ($("accountManagerPhone")) {
    const phoneEl = $("accountManagerPhone");
    phoneEl.textContent = manager.phone || "—";
    phoneEl.href = manager.phone ? `tel:${manager.phone}` : "#";
  }

  if ($("companyAddress")) $("companyAddress").textContent = company.address || "Jeddah, Saudi Arabia";
  if ($("companyPhone")) {
    const companyPhoneEl = $("companyPhone");
    companyPhoneEl.textContent = company.phone || "—";
    companyPhoneEl.href = company.phone ? `tel:${company.phone}` : "#";
  }
  if ($("companyHours")) $("companyHours").textContent = company.hours || "Sun-Thu 9AM-6PM";

  // Update action buttons
  if ($("btnCallManager") && manager.phone) {
    $("btnCallManager").href = `tel:${manager.phone}`;
  }
  if ($("btnEmailManager") && manager.email) {
    $("btnEmailManager").href = `mailto:${manager.email}`;
  }
}

// ============================================
// Confirmation Modal
// ============================================

let pendingDecision = null;

function showConfirmationModal(decision) {
  pendingDecision = decision;
  const modal = $("confirmationModal");
  const messageEl = document.getElementById("confirmMessage");
  const confirmBtn = $("btnConfirmDecision");

  if (!modal || !messageEl || !confirmBtn) return;

  const isApprove = decision === "APPROVE";
  messageEl.textContent = isApprove
    ? "Are you sure you want to APPROVE this offer? This action cannot be undone."
    : "Are you sure you want to REJECT this offer? Please ensure you have provided a comment.";

  confirmBtn.className = `px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
    isApprove
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-red-600 hover:bg-red-700'
  }`;

  modal.classList.remove("hidden");

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      pendingDecision = null;
    }
  });
}

function hideConfirmationModal() {
  const modal = $("confirmationModal");
  if (modal) modal.classList.add("hidden");
  pendingDecision = null;
}

// ============================================
// Live Chat Widget
// ============================================

function initLiveChat() {
  const chatToggle = $("chatToggle");
  const chatWindow = $("chatWindow");
  const chatClose = $("chatClose");
  const chatSend = $("chatSend");
  const chatInput = $("chatInput");
  const quickResponseBtns = document.querySelectorAll('.quick-response-btn');

  if (!chatToggle || !chatWindow) return;

  chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
  });

  chatClose?.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const messagesEl = $("chatMessages");
    if (!messagesEl) return;

    // Add user message
    messagesEl.innerHTML += `
      <div class="flex justify-end">
        <div class="bg-blue-100 rounded-lg px-4 py-2 max-w-[80%]">
          <div class="text-sm text-slate-800">${escapeHtml(text)}</div>
        </div>
      </div>
    `;

    // Simulate response (TODO: Replace with actual chat backend)
    setTimeout(() => {
      messagesEl.innerHTML += `
        <div class="flex justify-start">
          <div class="bg-slate-100 rounded-lg px-4 py-2 max-w-[80%]">
            <div class="text-sm text-slate-800">Thank you for your message. Our team will respond shortly. (This is a demo - actual chat integration coming soon.)</div>
          </div>
        </div>
      `;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 1000);

    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (chatInput) chatInput.value = '';
  };

  chatSend?.addEventListener('click', () => {
    if (chatInput) sendMessage(chatInput.value);
  });

  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value) {
      sendMessage(chatInput.value);
    }
  });

  quickResponseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const template = btn.getAttribute('data-template');
      const templates = {
        pricing: "I have a question about pricing",
        call: "When can we schedule a call?",
        specs: "I need clarification on technical specs"
      };
      if (chatInput && templates[template]) {
        chatInput.value = templates[template];
        chatInput.focus();
      }
    });
  });
}

// ============================================
// Success Animation
// ============================================

function showSuccessAnimation(decision) {
  const section = $("decisionSection");
  if (!section) return;

  const isApprove = decision === "APPROVE";
  section.innerHTML = `
    <div class="text-center py-12">
      <div class="text-6xl mb-4">${isApprove ? '🎉' : '📝'}</div>
      <h2 class="text-2xl font-bold mb-2" style="color: var(--reviva-green);">
        ${isApprove ? 'Offer Approved!' : 'Decision Recorded'}
      </h2>
      <p class="text-slate-600">
        ${isApprove
          ? 'Thank you for your business! REVIVA will contact you with next steps.'
          : 'Thank you for your feedback. REVIVA will review your comments.'}
      </p>
    </div>
  `;
}

// ============================================
// Lock Decision UI
// ============================================

function lockDecisionUI() {
  const a = $("btnApprove");
  const r = $("btnReject");
  const n = $("clientName");
  const c = $("clientComment");
  const section = $("decisionSection");

  [a, r, n, c].forEach(el => {
    if (el) {
      el.disabled = true;
      el.classList.add("opacity-50", "cursor-not-allowed");
    }
  });

  if (section) {
    section.style.pointerEvents = 'none';
    section.style.opacity = '0.7';
  }
}

// ============================================
// Accordion Toggle (for Terms)
// ============================================

window.toggleAccordion = function(id) {
  const content = $(`${id}Content`);
  const icon = $(`${id}Icon`);
  if (!content || !icon) return;

  const isHidden = content.classList.contains('hidden');
  content.classList.toggle('hidden');
  icon.textContent = isHidden ? '▲' : '▼';
};

// ============================================
// Main Function
// ============================================

async function main() {
  console.log('=== MAIN FUNCTION STARTED ===');
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
  console.log('Loading indicator added');

  try {
    console.log('Checking for token in URL...');
    const token = String(qp("token") || "").trim();
    console.log('Token found:', token ? 'YES (length: ' + token.length + ')' : 'NO');

    if (!token) {
      console.error('No token found in URL');
      showError("Missing token in URL. Please use the secure link provided by REVIVA.");
      return;
    }

    // Load offer
    console.log('Fetching offer from API...');
    let offer;
    try {
      offer = await apiFetch(`/offers/portal?token=${encodeURIComponent(token)}`);
      console.log('✅ Offer data received from API:', offer);
    } catch (apiError) {
      console.error('❌ API Error:', apiError);
      showError(`Failed to load offer: ${apiError?.message || 'Unknown error'}`);
      return;
    }

    if (!offer) {
      console.error('❌ Offer is null or undefined');
      showError("Failed to load offer data. Please try again.");
      return;
    }

    console.log('Offer keys:', Object.keys(offer));
    console.log('Has financial_data:', !!offer.financial_data);
    console.log('Has financial_offer:', !!offer.financial_offer);
    console.log('Has technical_data:', !!offer.technical_data);
    console.log('Has technical_offer:', !!offer.technical_offer);

    // Update header
    const offerId = offer?.id || "—";
    if ($("offerId")) $("offerId").textContent = offerId;
    if ($("breadcrumbOfferId")) $("breadcrumbOfferId").textContent = offerId;
    if ($("heroOfferId")) $("heroOfferId").textContent = `Offer #${offerId}`;

    const updatedAt = fmtDate(offer?.updated_at);
    if ($("updatedAt")) $("updatedAt").textContent = updatedAt;
    if ($("heroUpdatedAt")) $("heroUpdatedAt").textContent = updatedAt;

    const status = String(offer?.status || "—");
    updateStatusBadge(status, "statusChip");
    if ($("heroStatus")) $("heroStatus").textContent = status;

    // Validity date
    const validityDate = offer?.client_portal_expires_at || offer?.validity_date;
    if (validityDate) {
      if ($("validityDate")) $("validityDate").textContent = fmtDate(validityDate);
      if ($("miniValidity")) $("miniValidity").textContent = fmtDate(validityDate);
      if ($("overviewValidity")) $("overviewValidity").textContent = fmtDate(validityDate);
      updateValidityTimer(validityDate);
    }

    // Render content - check both field names
    const technicalData = offer?.technical_data || offer?.technical_offer;
    const financialData = offer?.financial_data || offer?.financial_offer;

    console.log('Rendering technical data:', technicalData);
    renderTechnical(technicalData);

    console.log('Rendering financial data:', financialData);
    renderFinancial(financialData);

    // Update overview with items count
    const financial = safeJson(financialData);
    const items = Array.isArray(financial?.items) ? financial.items : Array.isArray(financial?.lines) ? financial.lines : [];
    const itemsCount = items.length || 0;

    console.log('Items count:', itemsCount, 'Items:', items);

    if ($("heroItemsCount")) {
      $("heroItemsCount").textContent = itemsCount;
      console.log('Updated heroItemsCount');
    }
    if ($("overviewItems")) {
      $("overviewItems").textContent = itemsCount;
      console.log('Updated overviewItems');
    }

    // Ensure all hero elements are updated even if data is missing
    if (itemsCount === 0 && $("heroItemsCount")) {
      $("heroItemsCount").textContent = "0";
    }
    if (!$("heroGrandTotal")?.textContent || $("heroGrandTotal").textContent === "—") {
      // If grand total wasn't set, try to calculate it
      const totals = safeJson(financial?.totals || {});
      const grand = Number(totals?.total || 0);
      if (grand > 0 && $("heroGrandTotal")) {
        $("heroGrandTotal").textContent = money(grand, financial?.currency || "SAR");
      }
    }

    // Debug: Log to console
    console.log('Offer loaded successfully:', {
      id: offer?.id,
      status: offer?.status,
      itemsCount,
      hasFinancial: !!(offer?.financial_data || offer?.financial_offer),
      hasTechnical: !!(offer?.technical_data || offer?.technical_offer),
      financialKeys: Object.keys(financial || {}),
      heroGrandTotal: $("heroGrandTotal")?.textContent,
      heroItemsCount: $("heroItemsCount")?.textContent
    });

    // Payment terms
    renderPaymentTerms(offer?.payment_terms);

    // Contact info
    renderContactInfo(offer?.contact_info);

    // If already decided, show and lock
    if (offer?.client_decision_at) {
      const decision = offer.client_decision?.toUpperCase() || "DECIDED";
      const message = decision === "APPROVE"
        ? `✓ Offer approved on ${fmtDate(offer.client_decision_at)}. Thank you for your business!`
        : `✕ Offer rejected on ${fmtDate(offer.client_decision_at)}. Thank you for your feedback.`;
      showSuccess(message);
      lockDecisionUI();
      showSuccessAnimation(decision);
    }

    // Initialize systems
    initTabSystem();
    initStickyElements();
    autoSaveClientInput();
    initLiveChat();

    // Decision buttons
    const btnApprove = $("btnApprove");
    const btnReject = $("btnReject");
    const btnCancelConfirm = $("btnCancelConfirm");
    const btnConfirmDecision = $("btnConfirmDecision");

    btnApprove?.addEventListener("click", () => {
      showConfirmationModal("APPROVE");
    });

    btnReject?.addEventListener("click", () => {
      const comment = String($("clientComment")?.value || "").trim();
      if (!comment) {
        showError("💬 Comment is required to reject the offer. Please provide feedback.");
        return;
      }
      showConfirmationModal("REJECT");
    });

    btnCancelConfirm?.addEventListener("click", () => {
      hideConfirmationModal();
    });

    btnConfirmDecision?.addEventListener("click", async () => {
      if (!pendingDecision) return;

      clearError();
      clearSuccess();
      hideConfirmationModal();

      const name = String($("clientName")?.value || "").trim();
      const comment = String($("clientComment")?.value || "").trim();

      if (pendingDecision === "REJECT" && !comment) {
        showError("💬 Comment is required to reject the offer.");
        return;
      }

      lockDecisionUI();

      try {
        const resp = await apiFetch(`/offers/portal/decision`, {
          method: "POST",
          body: { token, decision: pendingDecision, name, comment },
        });

        showSuccess(`
          <div class="flex items-center gap-2">
            <span class="text-xl">${pendingDecision === "APPROVE" ? "🎉" : "📝"}</span>
            <span>${pendingDecision === "APPROVE"
              ? "Offer approved successfully! Thank you — REVIVA will contact you with next steps."
              : "Offer rejected. Thank you for your feedback — REVIVA will review your comments."}</span>
          </div>
        `);
        updateStatusBadge(String(resp?.status || `CLIENT_${pendingDecision}ED`), "statusChip");
        showSuccessAnimation(pendingDecision);
      } catch (e) {
        showError(`❌ ${e?.message || "Failed to submit decision. Please try again."}`);
        // Unlock UI on error
        const a = $("btnApprove");
        const r = $("btnReject");
        const n = $("clientName");
        const c = $("clientComment");
        [a, r, n, c].forEach(el => {
          if (el) {
            el.disabled = false;
            el.classList.remove("opacity-50", "cursor-not-allowed");
          }
        });
      }
    });

    // Download buttons (placeholder)
    $("btnDownloadTechnical")?.addEventListener("click", () => {
      showSuccess("📥 Download feature coming soon!");
    });
    $("btnDownloadQuotation")?.addEventListener("click", () => {
      showSuccess("📥 Download quotation feature coming soon!");
    });

    // Bank details toggle
    $("btnToggleBankDetails")?.addEventListener("click", () => {
      const detailsEl = $("bankDetails");
      const btnEl = $("btnToggleBankDetails");
      if (detailsEl && btnEl) {
        const isHidden = detailsEl.classList.contains("hidden");
        detailsEl.classList.toggle("hidden");
        btnEl.textContent = isHidden ? "Hide Bank Details" : "Show Bank Details";
      }
    });

  } catch (e) {
    console.error('Error loading offer:', e);
    showError(`⚠️ ${e?.message || "Unexpected error loading offer. Please check your link and try again."}`);

    // Show detailed error in console for debugging
    if (e.stack) {
      console.error('Stack trace:', e.stack);
    }
    if (e.payload) {
      console.error('Error payload:', e.payload);
    }
  } finally {
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }
  }
}

// Start when DOM is ready
console.log('Client portal script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
  console.log('Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, calling main()');
    main();
  });
} else {
  console.log('DOM already ready, calling main() immediately');
  main();
}
