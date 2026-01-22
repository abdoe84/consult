// frontend/assets/js/pages/offer-review.js
// Self-contained (does NOT rely on auth.js exports)

const API_BASE = (window.__API_BASE || "http://127.0.0.1:4000/api").replace(/\/$/, "");
const TOKEN_KEY = window.__TOKEN_KEY || "REVIVA_TOKEN";

function qp(key) { return new URLSearchParams(window.location.search).get(key); }
function $(id) { return document.getElementById(id); }

function showError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.classList.remove("hidden");
}
function clearError() {
  const box = $("errorBox");
  if (!box) return;
  box.classList.add("hidden");
  box.textContent = "";
}

function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString();
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(x) {
  if (x == null) return {};
  if (typeof x === "string") {
    try { return JSON.parse(x); } catch { return {}; }
  }
  if (typeof x === "object") return x;
  return {};
}

function normalizeOfferData(offer) {
  const technical = safeJson(offer.technical_data ?? offer.technical_offer);
  const financial = safeJson(offer.financial_data ?? offer.financial_offer);

  const lines =
    Array.isArray(financial.items) ? financial.items :
    Array.isArray(financial.lines) ? financial.lines :
    [];

  const notes = financial.notes || financial.note || offer.notes || "";
  const vatRate = Number(financial.vat_rate ?? financial.vatRate ?? 0.15);
  const currency = String(financial.currency || "SAR");

  // totals may already exist
  const totals = safeJson(financial.totals || {});

  return { technical, financial, lines, notes, vatRate, currency, totals };
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "login.html";
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  // unwrap helpers: backend may return {ok:true,data:...} or {data:...}
  const unwrap = (x) => (x?.data ?? x?.offer ?? x?.user ?? x);

  if (!res.ok) {
    const errMsg =
      unwrap(json)?.details ||
      unwrap(json)?.error ||
      unwrap(json)?.message ||
      json?.details ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status} ${res.statusText}`;

    const e = new Error(errMsg);
    e.status = res.status;
    e.payload = json;
    throw e;
  }

  return unwrap(json);
}

function ensureClientLinkUI(link) {
  const box = $("clientLinkBox");
  const inp = $("clientLinkInput");
  const openA = $("clientLinkOpen");
  const copyB = $("clientLinkCopy");

  if (!box || !inp) return; // <-- if you didn't add HTML block, nothing will show

  box.classList.remove("hidden");
  inp.value = link || "";

  if (openA) openA.href = link || "#";

  if (copyB) {
    copyB.onclick = async () => {
      try {
        await navigator.clipboard.writeText(link || "");
        copyB.textContent = "Copied ✓";
        setTimeout(() => (copyB.textContent = "Copy"), 1200);
      } catch {
        inp.focus();
        inp.select();
        document.execCommand("copy");
        copyB.textContent = "Copied ✓";
        setTimeout(() => (copyB.textContent = "Copy"), 1200);
      }
    };
  }
}

function renderTechnical(offer) {
  const box = $("technicalBox");
  if (!box) return;

  const { technical } = normalizeOfferData(offer);

  if (!technical || Object.keys(technical).length === 0) {
    box.innerHTML = `<div class="text-slate-500">No technical proposal.</div>`;
    return;
  }

  const sections = Array.isArray(technical?.sections) ? technical.sections : null;

  if (sections) {
    box.innerHTML = sections.map((s) => {
      const title = (s?.title || "Section").toString();
      const content = (s?.content || "").toString().replaceAll("\n", "<br/>");
      return `
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="font-bold text-slate-800 mb-2">${title}</div>
          <div class="text-slate-700 leading-relaxed">${content || "—"}</div>
        </div>
      `;
    }).join("");
    return;
  }

  box.innerHTML = `<pre class="whitespace-pre-wrap text-slate-700 bg-white rounded-2xl p-4 border border-slate-200">${JSON.stringify(technical, null, 2)}</pre>`;
}

function renderFinancial(offer) {
  const body = $("financialBody");
  if (!body) return;

  const { lines, notes, vatRate, currency, totals } = normalizeOfferData(offer);

  const notesEl = $("financialNotes");
  if (notesEl) notesEl.textContent = notes ? String(notes) : "—";

  if (!lines.length) {
    body.innerHTML = `<tr><td class="py-3 text-slate-500" colspan="8">No financial lines.</td></tr>`;
    $("subTotal").textContent = "—";
    $("vatTotal").textContent = "—";
    $("grandTotal").textContent = "—";
    return;
  }

  // Check if discount column should be shown
  const hasDiscount = lines.some(ln => {
    const discountPercent = ln.base_cost !== undefined
      ? Number(ln.discount_percent || 0)
      : 0;
    return discountPercent > 0;
  });

  // Show/hide discount column header
  setTimeout(() => {
    const discountHeaders = document.querySelectorAll('.discount-col');
    discountHeaders.forEach(header => {
      header.classList.toggle('hidden', !hasDiscount);
    });
  }, 0);

  body.innerHTML = lines.map((ln, index) => {
    const desc = ln.description ?? ln.desc ?? ln.title ?? "";
    const unit = ln.unit ?? "";
    const qty = Number(ln.qty ?? ln.quantity ?? 0);

    // Support both old and new format
    let baseCost, profitPercent, contingencyPercent, discountPercent, lineTotal;

    if (ln.base_cost !== undefined) {
      // New format
      baseCost = Number(ln.base_cost || 0);
      profitPercent = Number(ln.profit_percent || 0);
      contingencyPercent = Number(ln.contingency_percent || 0);
      discountPercent = Number(ln.discount_percent || 0);

      const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
      const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
      lineTotal = unitPriceAfterDiscount * qty;
    } else {
      // Old format
      const baseUnitPrice = Number(ln.unit_price ?? ln.unitPrice ?? ln.price ?? 0);
      const contingency = Number(ln.contingency ?? 0);
      const profit = Number(ln.profit ?? 0);
      const baseTotal = qty * baseUnitPrice;
      lineTotal = baseTotal + contingency + profit;
      baseCost = baseUnitPrice;
      profitPercent = baseCost > 0 ? (profit / baseCost) * 100 : 0;
      contingencyPercent = baseCost > 0 ? (contingency / baseCost) * 100 : 0;
      discountPercent = 0;
    }

    const isEven = index % 2 === 0;

    return `
      <tr class="border-t border-slate-200/70 ${isEven ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/30 transition-colors">
        <td class="px-5 py-4">
          <div class="font-semibold text-slate-800">${escapeHtml(desc || "—")}</div>
        </td>
        <td class="px-5 py-4 text-center">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">${escapeHtml(unit || "—")}</span>
        </td>
        <td class="px-5 py-4 text-center">
          <span class="inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold bg-blue-50 text-blue-700 border-2 border-blue-200">${qty.toLocaleString()}</span>
        </td>
        <td class="px-5 py-4 text-right">
          <div class="text-sm font-semibold text-slate-700">${baseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</div>
        </td>
        <td class="px-5 py-4 text-center">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 border-2 border-emerald-300">${profitPercent.toFixed(1)}%</span>
        </td>
        <td class="px-5 py-4 text-center">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 border-2 border-amber-300">${contingencyPercent.toFixed(1)}%</span>
        </td>
        ${hasDiscount ? `
        <td class="px-5 py-4 text-center discount-col">
          <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 border-2 border-red-300">${discountPercent.toFixed(1)}%</span>
        </td>
        ` : '<td class="px-5 py-4 discount-col hidden"></td>'}
        <td class="px-5 py-4 text-right">
          <div class="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg px-4 py-2 inline-block">
            <div class="text-base font-bold text-slate-800">${money(lineTotal, currency)}</div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Prefer backend totals if provided, else compute
  let subtotal = Number(totals?.subtotal);
  let vat = Number(totals?.vat);
  let grand = Number(totals?.total);

  const totalsValid = Number.isFinite(subtotal) && Number.isFinite(vat) && Number.isFinite(grand);

  if (!totalsValid) {
    // Calculate subtotal (support both old and new format)
    subtotal = lines.reduce((s, ln) => {
      const qty = Number(ln.qty ?? ln.quantity ?? 0);

      if (ln.base_cost !== undefined) {
        // New format
        const baseCost = Number(ln.base_cost || 0);
        const profitPercent = Number(ln.profit_percent || 0);
        const contingencyPercent = Number(ln.contingency_percent || 0);
        const discountPercent = Number(ln.discount_percent || 0);

        const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
        const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
        return s + (unitPriceAfterDiscount * qty);
      } else {
        // Old format
        const basePrice = Number(ln.unit_price ?? ln.unitPrice ?? ln.price ?? 0);
        const contingency = Number(ln.contingency ?? 0);
        const profit = Number(ln.profit ?? 0);
        const baseTotal = qty * basePrice;
        return s + baseTotal + contingency + profit;
      }
    }, 0);

    vat = subtotal * (Number.isFinite(vatRate) ? vatRate : 0.15);
    grand = subtotal + vat;
  }

  $("subTotal").textContent = `${money(subtotal)} ${currency}`;
  $("vatTotal").textContent = `${money(vat)} ${currency}`;
  $("grandTotal").textContent = `${money(grand)} ${currency}`;
}

function updateButtonsVisibility(user, offer) {
  const btnApprove = $("btnApprove");
  const btnReject = $("btnReject");
  if (!btnApprove || !btnReject) return;

  const isManager = (user?.role || "").toUpperCase() === "MANAGER";
  const st = (offer?.status || "").toUpperCase();

  const show = isManager && st === "SUBMITTED_TO_MANAGER";
  btnApprove.style.display = show ? "block" : "none";
  btnReject.style.display = show ? "block" : "none";
}

async function loadMeOrRedirect() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "login.html";
    throw new Error("No token");
  }

  try {
    return await apiFetch("/auth/me");
  } catch (e) {
    // ✅ logout ONLY if unauthorized
    if (e?.status === 401 || e?.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "login.html";
    } else {
      // keep token, show error
      showError(`Auth check failed: ${e?.message || "Unknown error"}`);
    }
    throw e;
  }
}

async function loadOffer(offerId) {
  return await apiFetch(`/offers/${offerId}`);
}

async function loadRequest(requestId) {
  if (!requestId) return null;
  return await apiFetch(`/service-requests/${requestId}`);
}

async function tryLoadClientLink(offerId) {
  try {
    const res = await apiFetch(`/offers/${offerId}/client-link`);
    return res?.client_link || null;
  } catch {
    return null;
  }
}

// New decision endpoint with fallback to old endpoints
async function managerDecision(offerId, decision, comment) {
  // try new endpoint first
  try {
    return await apiFetch(`/offers/${offerId}/manager-decision`, {
      method: "POST",
      body: { decision, comment },
    });
  } catch (e) {
    // fallback: old endpoints if backend not updated
    if (e?.status === 404) {
      const path = decision === "APPROVE"
        ? `/offers/${offerId}/manager/approve`
        : `/offers/${offerId}/manager/reject`;
      return await apiFetch(path, { method: "POST", body: { comment } });
    }
    throw e;
  }
}

async function main() {
  clearError();

  const offerId = qp("id") || qp("offerId");
  if (!offerId) {
    showError("Missing offer id in URL. Use: offer-review.html?id=<offerId>");
    return;
  }

  const logoutBtn = $("btnLogout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Load current user
  const user = await loadMeOrRedirect();

  $("roleChip").textContent = (user?.role || "—").toString().toUpperCase();
  $("subTitle").textContent = `${user?.full_name || user?.email || "User"} • ${(user?.role || "").toString().toUpperCase()}`;

  // Load offer + request
  const offer = await loadOffer(offerId);

  $("offerId").textContent = offer?.id || offerId;
  $("offerStatus").textContent = (offer?.status || "—").toString();
  $("offerUpdated").textContent = fmtDate(offer?.updated_at);

  if (offer?.request_id) {
    const request = await loadRequest(offer.request_id);
    $("requestRef").textContent = request?.reference_no || request?.reference || offer?.request_id || "—";

    const backBtn = $("btnBack");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = `request-details.html?id=${encodeURIComponent(offer.request_id)}`;
      });
    }
  } else {
    $("requestRef").textContent = "—";
    const backBtn = $("btnBack");
    if (backBtn) backBtn.addEventListener("click", () => window.history.back());
  }

  renderTechnical(offer);
  renderFinancial(offer);
  updateButtonsVisibility(user, offer);

  // ✅ Only try get client link if already approved
  if ((offer?.status || "").toUpperCase() === "MANAGER_APPROVED") {
    const link = await tryLoadClientLink(offerId);
    if (link) ensureClientLinkUI(link);
  }

  // Actions
  const btnApprove = $("btnApprove");
  const btnReject = $("btnReject");
  const commentEl = $("managerComment");

  if (btnApprove) {
    btnApprove.addEventListener("click", async () => {
      clearError();
      btnApprove.disabled = true;
      if (btnReject) btnReject.disabled = true;

      try {
        const comment = (commentEl?.value || "").trim();

        const resp = await managerDecision(offerId, "APPROVE", comment);

        const updatedOffer = resp?.offer || resp;
        const link = resp?.client_link || null;

        if (updatedOffer?.status) $("offerStatus").textContent = updatedOffer.status;
        if (updatedOffer?.updated_at) $("offerUpdated").textContent = fmtDate(updatedOffer.updated_at);

        let finalLink = link;
        if (!finalLink) finalLink = await tryLoadClientLink(offerId);

        if (finalLink) {
          ensureClientLinkUI(finalLink);
        } else {
          showError("Approved, but no client link returned. Backend must generate client_portal_token after approval.");
        }

        updateButtonsVisibility(user, { ...offer, ...updatedOffer });
      } catch (e) {
        showError(e?.message || "Failed to approve offer.");
      } finally {
        btnApprove.disabled = false;
        if (btnReject) btnReject.disabled = false;
      }
    });
  }

  if (btnReject) {
    btnReject.addEventListener("click", async () => {
      clearError();

      const comment = (commentEl?.value || "").trim();
      if (!comment) {
        showError("Comment is required for rejection.");
        return;
      }

      if (btnApprove) btnApprove.disabled = true;
      btnReject.disabled = true;

      try {
        const resp = await managerDecision(offerId, "REJECT", comment);

        const updatedOffer = resp?.offer || resp;

        if (updatedOffer?.status) $("offerStatus").textContent = updatedOffer.status;
        if (updatedOffer?.updated_at) $("offerUpdated").textContent = fmtDate(updatedOffer.updated_at);

        updateButtonsVisibility(user, { ...offer, ...updatedOffer });
      } catch (e) {
        showError(e?.message || "Failed to reject offer.");
      } finally {
        if (btnApprove) btnApprove.disabled = false;
        btnReject.disabled = false;
      }
    });
  }
}

main().catch((e) => {
  console.error(e);
  showError(e?.message || "Unexpected error.");
});
