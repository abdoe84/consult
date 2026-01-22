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
    body.innerHTML = `<tr><td class="py-3 text-slate-500" colspan="5">No financial lines.</td></tr>`;
    $("subTotal").textContent = "—";
    $("vatTotal").textContent = "—";
    $("grandTotal").textContent = "—";
    return;
  }

  body.innerHTML = lines.map((ln) => {
    const desc = ln.description ?? ln.desc ?? ln.title ?? "";
    const unit = ln.unit ?? "";
    const qty = Number(ln.qty ?? ln.quantity ?? 0);
    const unitPrice = Number(ln.unit_price ?? ln.unitPrice ?? ln.price ?? 0);
    const total = qty * unitPrice;

    return `
      <tr class="border-t border-slate-200/70">
        <td class="py-3 pr-3">${desc || "—"}</td>
        <td class="py-3 pr-3">${unit || "—"}</td>
        <td class="py-3 pr-3">${qty}</td>
        <td class="py-3 pr-3">${money(unitPrice)}</td>
        <td class="py-3 pr-3 font-semibold">${money(total)}</td>
      </tr>
    `;
  }).join("");

  // Prefer backend totals if provided, else compute
  let subtotal = Number(totals?.subtotal);
  let vat = Number(totals?.vat);
  let grand = Number(totals?.total);

  const totalsValid = Number.isFinite(subtotal) && Number.isFinite(vat) && Number.isFinite(grand);

  if (!totalsValid) {
    subtotal = lines.reduce((s, ln) => {
      const qty = Number(ln.qty ?? ln.quantity ?? 0);
      const unitPrice = Number(ln.unit_price ?? ln.unitPrice ?? ln.price ?? 0);
      return s + (qty * unitPrice);
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
