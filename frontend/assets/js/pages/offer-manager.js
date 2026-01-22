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

function pretty(obj) {
  try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; }
}

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

function render(o, requestIdForBack) {
  offer = o;

  setStatus(o?.status);
  $("techPre").textContent = pretty(o?.technical_offer);
  $("finPre").textContent = pretty(o?.financial_offer);

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

  render(offer, offer?.request_id);
  setSuccess(`Manager decision saved: ${String(decision).toUpperCase()}`);
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
    $("techPre").textContent = "-";
    $("finPre").textContent = "-";
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
