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

function setStatusBadge(s) {
  $("offerStatus").textContent = String(s || "-").toUpperCase();
}

function safePretty(obj) {
  try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; }
}

function parseJsonField(text, fieldName) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${fieldName} JSON invalid`);
  }
}

function isConsultantOrAdmin(role) {
  const r = String(role || "").toUpperCase();
  return r === "CONSULTANT" || r === "ADMIN";
}

let me = null;
let requestId = null;
let offer = null;

async function loadRequestBasic(id) {
  const res = await apiGet(`/api/service-requests/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.data;
}

async function loadOfferByRequest(id) {
  const res = await apiGet(`/api/offers/by-request/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.data; // either offer object or null
}

function fillFormFromOffer(o) {
  const tech = o?.technical_offer ?? {};
  const fin = o?.financial_offer ?? {};
  $("techJson").value = safePretty(tech);
  $("finJson").value = safePretty(fin);
  setStatusBadge(o?.status || "DRAFT");
}

function setButtonsState() {
  const status = String(offer?.status || "DRAFT").toUpperCase();

  // Save always allowed for consultant/admin (we still keep backend enforcing)
  $("btnSave").disabled = false;

  // Submit allowed only when draft-ish
  const canSubmit = (status === "DRAFT" || status === "MANAGER_REJECTED");
  $("btnSubmit").disabled = !canSubmit;
  $("btnSubmit").classList.toggle("opacity-50", !canSubmit);
}

async function saveDraft() {
  setError("");
  setSuccess("");

  let technical_offer, financial_offer;
  try {
    technical_offer = parseJsonField($("techJson").value, "Technical Offer");
    financial_offer = parseJsonField($("finJson").value, "Financial Offer");
  } catch (e) {
    setError(e.message);
    return;
  }

  const res = await apiPost(`/api/offers/by-request/${encodeURIComponent(requestId)}`, {
    technical_offer,
    financial_offer
  });

  if (!res.ok) {
    const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
    setError(`${res.error || "Save failed"}${details ? " — " + details : ""}`);
    return;
  }

  offer = res.data;
  fillFormFromOffer(offer);
  setButtonsState();
  setSuccess("Draft saved.");
}

async function submitToManager() {
  setError("");
  setSuccess("");

  if (!offer?.id) {
    setError("Save draft first (offer id is missing).");
    return;
  }

  const res = await apiPost(`/api/offers/${encodeURIComponent(offer.id)}/submit`, {});
  if (!res.ok) {
    const details = res.details ? (typeof res.details === "string" ? res.details : JSON.stringify(res.details)) : "";
    setError(`${res.error || "Submit failed"}${details ? " — " + details : ""}`);
    return;
  }

  offer = res.data;
  setStatusBadge(offer?.status);
  setButtonsState();
  setSuccess("Submitted to manager.");
}

(async function init() {
  me = await requireAuthOrRedirect();
  if (!me) return;

  $("whoami").textContent = `${me.full_name || me.email || "User"} • ${me.role || "-"}`;

  if (!isConsultantOrAdmin(me.role)) {
    setError("Forbidden: Only Consultant/Admin can edit offers.");
    $("btnSave").disabled = true;
    $("btnSubmit").disabled = true;
    return;
  }

  requestId = qp("requestId");
  if (!requestId) {
    setError("Missing requestId in URL.");
    return;
  }

  // back link
  $("backLink").href = `request-details.html?id=${encodeURIComponent(requestId)}`;

  // show request reference if possible
  const req = await loadRequestBasic(requestId);
  const ref = req?.reference_no || req?.reference || req?.ref_no || requestId;
  $("pageTitle").textContent = `Offer Draft • ${ref}`;

  // load existing offer
  offer = await loadOfferByRequest(requestId);
  if (offer) {
    fillFormFromOffer(offer);
  } else {
    // defaults
    $("techJson").value = safePretty({ scope: [], duration_days: 30 });
    $("finJson").value = safePretty({ currency: "SAR", total: 0 });
    setStatusBadge("DRAFT");
  }
  setButtonsState();

  $("btnSave").addEventListener("click", saveDraft);
  $("btnSubmit").addEventListener("click", submitToManager);
})();
