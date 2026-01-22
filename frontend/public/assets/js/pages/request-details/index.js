// ============================
// Request Details - Main Entry Point
// ============================
import {
  requireAuthOrRedirect,
  getUser,
  fetchMe
} from "../../auth.js";
import { qp, $, setText, setError, clearError } from "./utils.js";
import {
  loadRequestData,
  loadOfferData,
  loadProjectData,
  loadAttachments
} from "./api.js";
import {
  setCurrentUser,
  setCurrentRequest,
  setCurrentOffer,
  setCurrentProject,
  getCurrentRequest,
  getCurrentOffer,
  getCurrentProject,
  getCurrentUser,
  isManager,
  offerStatus,
  autoCreateKey
} from "./state.js";
import {
  render,
  renderProjectButtons,
  renderAttachments
} from "./renderers.js";
import { bindActionsOnce, setLoadDataRef } from "./handlers.js";

/**
 * Get request ID from URL
 */
function reqId() {
  return qp("id");
}

/**
 * Load user session
 */
async function loadSession() {
  if (!requireAuthOrRedirect("login.html")) return;

  const me = await fetchMe();
  const userData = me?.ok ? (me.data?.user || me.data?.profile || me.data) : null;

  const user = userData || getUser();
  setCurrentUser(user);

  const name = user?.full_name || user?.email || "User";
  const role = (user?.role || "UNKNOWN").toUpperCase();

  setText("sessionLine", `${name} • ${role}`);
  setText("roleChip", role);
}

/**
 * Auto-create project (manager-only fallback)
 */
async function maybeAutoCreateProject() {
  const request = getCurrentRequest();
  const requestId = request?.id;
  if (!requestId) return;

  // Only when offer is client approved, and no project yet
  const st = offerStatus();
  if (st !== "CLIENT_APPROVED") return;
  if (getCurrentProject()?.id) return;

  // Only manager auto-creates (safe). Others just see "N/A".
  if (!isManager()) return;

  // Only try once per request per browser session
  if (sessionStorage.getItem(autoCreateKey(requestId)) === "1") return;
  sessionStorage.setItem(autoCreateKey(requestId), "1");

  try {
    const { createProjectFromRequest } = await import("./api.js");
    const project = await createProjectFromRequest(requestId);
    if (project?.id) {
      setCurrentProject(project);
      render(); // update UI instantly
    } else {
      // show retry button
      renderProjectButtons();
    }
  } catch (e) {
    renderProjectButtons();
  }
}

/**
 * Load all data for the page
 */
export async function loadData() {
  clearError();

  const id = reqId();
  if (!id) return setError("Missing request id in URL (?id=...)");

  try {
    // Load request data
    const request = await loadRequestData(id);
    setCurrentRequest(request);

    // Load offer data
    const offer = await loadOfferData(id);
    setCurrentOffer(offer);

    // Load project data
    const project = await loadProjectData(id);
    setCurrentProject(project);

    // Load and render attachments
    const attachments = await loadAttachments(id);
    renderAttachments(attachments);

    // Render everything
    render();

    // Manager-only auto create fallback
    await maybeAutoCreateProject();

    // After auto-create attempt, render again
    render();
  } catch (error) {
    console.error("Error loading data:", error);
    setError(`Error: ${error.message || "Failed to load data"}`);
  }
}

// ============================
// Main Initialization
// ============================
(async function main() {
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm";
  loadingIndicator.innerHTML = `
    <div class="text-center">
      <div class="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-3"
           style="border-color: var(--picton-blue); border-top-color: transparent;"></div>
      <div class="text-sm text-slate-600">Loading request details...</div>
    </div>
  `;
  document.body.appendChild(loadingIndicator);

  try {
    await loadSession();
    // Set loadData reference for handlers before binding
    setLoadDataRef(loadData);
    bindActionsOnce();
    await loadData();
  } catch (error) {
    console.error("Initialization error:", error);
    setError(`Error: ${error.message || "Failed to initialize"}`);
  } finally {
    loadingIndicator.remove();
  }
})();
