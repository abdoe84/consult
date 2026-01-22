import { requireAuthOrRedirect } from "../auth.js";
import { apiGet, apiPost } from "../api.js";

function $(id) { return document.getElementById(id); }
function qp(key) { return new URLSearchParams(window.location.search).get(key); }

function setBox(id, msg) {
  const el = $(id);
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}
function setError(msg) { setBox("errorBox", msg); }
function setSuccess(msg) { setBox("successBox", msg); }

function show(id, yes) { $(id).classList.toggle("hidden", !yes); }


function setStatus(s) {
  $("offerStatus").textContent = String(s || "-").toUpperCase();
}

function isManagerOrAdmin(role) {
  const r = String(role || "").toUpperCase();
  return r === "MANAGER" || r === "ADMIN";
}

let me = null;
let offer = null;

async function loadOfferByRequest(requestId) {
  const res = await apiGet(`/api/offers/by-request/${encodeURIComponent(requestId)}`);
  if (!res.ok) return null;
  return res.data;
}

function buildPortalUrlFromToken(token) {
  // Build simple URL: client-portal.html?token=...
  const url = new URL(window.location.origin + "/client-portal.html");
  url.searchParams.set("token", token);
  return url.toString();
}

function extractPortal(data) {
  const token =
    data?.client_portal?.token ||
    data?.client_portal_token ||
    data?.portal_token ||
    data?.token ||
    null;

  let url =
    data?.client_portal?.url ||
    data?.client_portal_url ||
    data?.portal_url ||
    null;

  if (!url && token) url = buildPortalUrlFromToken(token);

  return { token, url };
}

function safeJson(data) {
  try {
    if (typeof data === "string") return JSON.parse(data);
    return data || {};
  } catch {
    return {};
  }
}

function renderTechnical(technical) {
  const box = $("techPre");
  if (!box) return;

  const t = safeJson(technical);

  if (!t || Object.keys(t).length === 0) {
    box.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">📄</div>
        <div class="font-medium">لا توجد تفاصيل تقنية متوفرة</div>
        <div class="text-xs mt-1">No technical details provided</div>
      </div>
    `;
    return;
  }

  const sections = Array.isArray(t?.sections) ? t.sections : null;

  if (sections && sections.length) {
    box.innerHTML = sections.map((s, index) => {
      const title = String(s?.title || `القسم ${index + 1}`);
      const content = String(s?.content || "");

      return `
        <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg mb-4 transition-all hover:shadow-xl">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                 style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
              ${index + 1}
            </div>
            <div class="text-lg font-bold text-slate-800" style="color: var(--scampi);">${escapeHtml(title)}</div>
          </div>
          <div class="text-slate-700 leading-relaxed whitespace-pre-line pl-11">${escapeHtml(content) || '<span class="text-slate-400">لا يوجد محتوى</span>'}</div>
        </div>
      `;
    }).join("");
    return;
  }

  // fallback if it's not sections-based
  box.innerHTML = `
    <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg">
      <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(JSON.stringify(t, null, 2))}</div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTimeline(timeline) {
  const box = $("timelineBox");
  if (!box) return;

  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
    box.innerHTML = "";
    box.parentElement?.classList.add("hidden");
    return;
  }

  box.parentElement?.classList.remove("hidden");

  const sortedTimeline = [...timeline].sort((a, b) => {
    const dateA = new Date(a.start_date || 0);
    const dateB = new Date(b.start_date || 0);
    return dateA - dateB;
  });

  box.innerHTML = `
    <div class="relative">
      <!-- Timeline Line -->
      <div class="absolute left-6 top-0 bottom-0 w-0.5"
           style="background: linear-gradient(180deg, var(--reviva-blue), var(--fountain));"></div>

      <!-- Timeline Items -->
      <div class="space-y-6">
        ${sortedTimeline.map((item, index) => {
          const startDate = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—";
          const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—";
          const phase = escapeHtml(item.phase || `Phase ${index + 1}`);
          const description = escapeHtml(item.description || "");
          const status = item.status || "planned";

          const statusColors = {
            "planned": "bg-blue-100 text-blue-700 border-blue-300",
            "in-progress": "bg-amber-100 text-amber-700 border-amber-300",
            "completed": "bg-emerald-100 text-emerald-700 border-emerald-300",
            "on-hold": "bg-slate-100 text-slate-700 border-slate-300"
          };

          const statusLabels = {
            "planned": "Planned / مخطط",
            "in-progress": "In Progress / قيد التنفيذ",
            "completed": "Completed / مكتمل",
            "on-hold": "On Hold / متوقف"
          };

          return `
            <div class="relative flex items-start gap-4 pl-14">
              <!-- Timeline Dot -->
              <div class="absolute left-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10"
                   style="background: linear-gradient(135deg, var(--reviva-blue), var(--fountain));">
                ${index + 1}
              </div>

              <!-- Content Card -->
              <div class="flex-1 bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg transition-all hover:shadow-xl">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <div class="flex-1">
                    <h3 class="text-lg font-bold text-slate-800 mb-2" style="color: var(--scampi);">${phase}</h3>
                    <div class="flex items-center gap-4 text-sm text-slate-600">
                      <span class="flex items-center gap-1">
                        <span>📅</span>
                        <span><strong>Start:</strong> ${startDate}</span>
                      </span>
                      <span class="flex items-center gap-1">
                        <span>🏁</span>
                        <span><strong>End:</strong> ${endDate}</span>
                      </span>
                    </div>
                  </div>
                  <span class="px-3 py-1 rounded-lg text-xs font-semibold border ${statusColors[status] || statusColors.planned}">
                    ${statusLabels[status] || statusLabels.planned}
                  </span>
                </div>
                ${description ? `
                  <div class="text-slate-700 leading-relaxed whitespace-pre-line pt-3 border-t border-slate-200/50">
                    ${description}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFinancial(financial) {
  const box = $("finPre");
  if (!box) return;

  const f = safeJson(financial);

  if (!f || Object.keys(f).length === 0) {
    box.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">💰</div>
        <div class="font-medium">لا توجد تفاصيل مالية متوفرة</div>
        <div class="text-xs mt-1">No financial details provided</div>
      </div>
    `;
    return;
  }

  const items = Array.isArray(f?.items) ? f.items : [];
  const currency = f?.currency || "SAR";
  const vatRate = (f?.vat_rate || 0.15) * 100;
  const totals = f?.totals || {};

  if (items.length > 0) {
    let html = `
      <div class="bg-white/40 border-2 border-white/50 rounded-2xl p-6 shadow-xl">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <div class="text-sm font-bold text-slate-700 mb-1">العملة / Currency: <span class="text-base" style="color: var(--scampi);">${currency}</span></div>
            <div class="text-sm font-bold text-slate-700">ضريبة القيمة المضافة / VAT: <span class="text-base" style="color: var(--reviva-green);">${vatRate}%</span></div>
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border-2 border-slate-300 shadow-lg bg-white">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 text-white">
                <th class="px-5 py-3 text-right text-sm font-bold border-r border-white/20">الوصف / Description</th>
                <th class="px-5 py-3 text-center text-sm font-bold border-r border-white/20">الوحدة / Unit</th>
                <th class="px-5 py-3 text-center text-sm font-bold border-r border-white/20">الكمية / Qty</th>
                <th class="px-5 py-3 text-right text-sm font-bold border-r border-white/20">سعر التكلفة / Base Cost</th>
                <th class="px-5 py-3 text-center text-xs font-bold border-r border-white/20 bg-emerald-700/80">نسبة الربح % / Profit %</th>
                <th class="px-5 py-3 text-center text-xs font-bold border-r border-white/20 bg-amber-600/80">نسبة الطوارئ % / Contingency %</th>
                <th class="px-5 py-3 text-right text-sm font-bold" style="background: linear-gradient(135deg, rgba(102, 162, 134, 0.9), rgba(84, 192, 232, 0.9));">الإجمالي / Line Total</th>
              </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item) => {
      const qty = Number(item.qty || 0);

      // Support both old and new format
      let baseCost, profitPercent, contingencyPercent, discountPercent, lineTotal, unitPriceAfterDiscount;

      if (item.base_cost !== undefined) {
        // New format with percentages
        baseCost = Number(item.base_cost || 0);
        profitPercent = Number(item.profit_percent || 0);
        contingencyPercent = Number(item.contingency_percent || 0);
        discountPercent = Number(item.discount_percent || 0);

        // Calculate using new formula
        const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
        unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
        lineTotal = unitPriceAfterDiscount * qty;
      } else {
        // Old format - convert
        const unitPrice = Number(item.unit_price || 0);
        const contingency = Number(item.contingency || 0);
        const profit = Number(item.profit || 0);
        const baseTotal = qty * unitPrice;
        lineTotal = baseTotal + contingency + profit;
        unitPriceAfterDiscount = unitPrice;
        baseCost = unitPrice;
        profitPercent = 0;
        contingencyPercent = 0;
        discountPercent = 0;
      }

      html += `
        <tr class="group hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent border-b border-slate-200/50 bg-white">
          <td class="px-5 py-4 text-right">
            <div class="font-semibold text-slate-800 text-sm">${escapeHtml(item.description || "-")}</div>
          </td>
          <td class="px-5 py-4 text-center">
            <span class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">${escapeHtml(item.unit || "-")}</span>
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
          <td class="px-5 py-4 text-right">
            <div class="bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-lg px-4 py-2 inline-block">
              <div class="text-base font-bold text-slate-800">${lineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</div>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
    `;

    if (totals.subtotal || totals.vat || totals.total) {
      html += `
        <div class="mt-5 pt-5 border-t-2 border-slate-400 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg px-5 py-4">
          <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-300">
            <span class="text-sm font-bold text-slate-700">المجموع الأساسي / Subtotal:</span>
            <span class="text-base font-bold text-slate-800">${Number(totals.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</span>
          </div>
          <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-300">
            <div>
              <span class="text-sm font-bold text-slate-700">ضريبة القيمة المضافة / VAT:</span>
              <span class="text-xs text-slate-500 ml-2">${vatRate}%</span>
            </div>
            <span class="text-base font-bold text-slate-800">${Number(totals.vat || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</span>
          </div>
          <div class="flex justify-between items-center pt-3">
            <span class="text-xl font-bold text-slate-800">الإجمالي النهائي / Grand Total:</span>
            <span class="text-xl font-bold" style="color: var(--reviva-green);">${Number(totals.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currency}</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    box.innerHTML = html;
    return;
  }

  // fallback
  box.innerHTML = `
    <div class="bg-white/40 border border-white/30 rounded-2xl p-5 shadow-lg">
      <div class="text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(JSON.stringify(f, null, 2))}</div>
    </div>
  `;
}

function render(o, requestIdForBack) {
  offer = o;

  setStatus(o?.status);

  // Render technical offer with proper formatting
  const technicalData = o?.technical_data || o?.technical_offer;
  renderTechnical(technicalData);

  // Render timeline if available
  renderTimeline(technicalData?.timeline);

  // Render financial offer with proper formatting
  renderFinancial(o?.financial_offer);

  const status = String(o?.status || "").toUpperCase();
  const canDecide = status === "SUBMITTED_TO_MANAGER";

  $("btnApprove").disabled = !canDecide;
  $("btnReject").disabled = !canDecide;
  $("btnApprove").classList.toggle("opacity-50", !canDecide);
  $("btnReject").classList.toggle("opacity-50", !canDecide);

  if (requestIdForBack) {
    $("backLink").href = `request-details.html?id=${encodeURIComponent(requestIdForBack)}`;
    } else {
    $("backLink").href = `dashboard.html`;
  }

  const { token, url } = extractPortal(o);
  if (token || url) {
    show("portalBox", true);
    $("portalToken").textContent = token || "-";
    const finalUrl = url || "#";
    $("portalUrl").textContent = finalUrl;
    $("portalUrl").href = finalUrl;
  } else {
    show("portalBox", false);
  }
}

async function managerDecision(decision) {
  setError("");
  setSuccess("");

  if (!offer?.id) {
    setError("Offer id missing.");
    return;
  }

  const comment = ($("managerComment").value || "").trim();
  if (decision === "reject" && !comment) {
    setError("Manager comment is required when rejecting.");
    return;
  }

  // Get buttons and save original states
  const btnApprove = $("btnApprove");
  const btnReject = $("btnReject");
  const originalApproveText = btnApprove?.innerHTML || "";
  const originalRejectText = btnReject?.innerHTML || "";

  // Set loading state
  if (btnApprove) {
    btnApprove.disabled = true;
    btnApprove.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 border-2 rounded-full animate-spin"
             style="border-color: currentColor; border-top-color: transparent;"></div>
        Processing...
      </div>
    `;
  }
  if (btnReject) {
    btnReject.disabled = true;
    btnReject.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 border-2 rounded-full animate-spin"
             style="border-color: currentColor; border-top-color: transparent;"></div>
        Processing...
      </div>
    `;
  }

  try {
    // Use different endpoints for approve vs reject
    const endpoint = decision === "approve"
      ? `/api/offers/${encodeURIComponent(offer.id)}/manager/approve`
      : `/api/offers/${encodeURIComponent(offer.id)}/manager/reject`;

    const payload = { comment, manager_comment: comment };

    const res = await apiPost(endpoint, payload);
    if (!res.ok) {
      const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
      setError(`${res.error || "Decision failed"}${details ? " — " + details : ""}`);
      return;
    }

  // Handle approve response with client_link
  if (decision === "approve" && res.data) {
    const { offer: updatedOffer, client_link } = res.data;
    offer = updatedOffer || res.data;

    // Show client portal link if available
    if (client_link) {
      const box = document.getElementById("clientLinkBox");
      const inp = document.getElementById("clientLinkInput");
      const openBtn = document.getElementById("clientLinkOpen");
      const copyBtn = document.getElementById("clientLinkCopy");

      if (box && inp) {
        box.classList.remove("hidden");
        inp.value = client_link;

        if (openBtn) {
          openBtn.href = client_link;
          openBtn.target = "_blank";
        }

        if (copyBtn) {
          copyBtn.onclick = async () => {
            try {
              await navigator.clipboard.writeText(client_link);
              const originalText = copyBtn.textContent;
              copyBtn.textContent = "Copied ✓";
              setTimeout(() => {
                copyBtn.textContent = originalText;
              }, 1200);
            } catch (err) {
              setError("Failed to copy link");
            }
          };
        }
      }
    }
  } else {
    offer = res.data;
  }

    // Reload offer data to ensure we have the latest from database
    const reloadedOffer = await loadOfferByRequest(offer?.request_id);
    if (reloadedOffer) {
      offer = reloadedOffer;
    }

    render(offer, offer?.request_id);
    setSuccess(`تم حفظ قرار المدير: ${String(decision).toUpperCase()} / Manager decision saved: ${String(decision).toUpperCase()}`);
  } catch (error) {
    console.error("Manager decision error:", error);
    setError(`Failed to ${decision} offer: ${error.message || "Unknown error"}`);
  } finally {
    // Always restore button states
    if (btnApprove) {
      btnApprove.disabled = false;
      btnApprove.innerHTML = originalApproveText;
    }
    if (btnReject) {
      btnReject.disabled = false;
      btnReject.innerHTML = originalRejectText;
    }
  }
}

(async function init() {
  me = await requireAuthOrRedirect();
  if (!me) return;

  $("whoami").textContent = `${me.full_name || me.email || "User"} • ${me.role || "-"}`;

  if (!isManagerOrAdmin(me.role)) {
    setError("Forbidden: Only Manager/Admin can approve/reject offers.");
    $("btnApprove").disabled = true;
    $("btnReject").disabled = true;
    return;
  }

  const requestId = qp("requestId");
  if (!requestId) {
    setError("Missing requestId in URL.");
    return;
  }

  const o = await loadOfferByRequest(requestId);
  if (!o) {
    setError("No offer found for this request yet.");
    setStatus("-");
    renderTechnical(null);
    renderFinancial(null);
    $("btnApprove").disabled = true;
    $("btnReject").disabled = true;
    return;
  }

  $("pageTitle").textContent = `Offer Review • Request ${requestId}`;
    $("backLink").href = `request-details.html?id=${encodeURIComponent(requestId)}`;

  render(o, requestId);

  $("btnApprove").addEventListener("click", () => managerDecision("approve"));
  $("btnReject").addEventListener("click", () => managerDecision("reject"));
})();
