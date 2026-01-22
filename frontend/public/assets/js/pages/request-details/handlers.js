// ============================
// Event Handlers
// ============================
import { $, show, setError } from "./utils.js";
import {
  getCurrentRequest,
  getCurrentProject,
  getCurrentOffer,
  areActionsBound,
  setActionsBound
} from "./state.js";
import {
  reviewRequest,
  createProjectFromRequest,
  updateProject,
  cancelProject
} from "./api.js";
import { render, renderProjectButtons } from "./renderers.js";

// Load data reference (set from index.js to avoid circular dependency)
let loadDataRef = null;
export function setLoadDataRef(ref) {
  loadDataRef = ref;
}

/**
 * Bind all event handlers (called once on page load)
 */
export function bindActionsOnce() {
  if (areActionsBound()) return;
  setActionsBound(true);

  // Back button
  $("btnBack")?.addEventListener("click", () => history.back());

  // Logout button (imported from auth.js)
  import("../../auth.js").then(({ logout }) => {
    $("btnLogout")?.addEventListener("click", () => logout("login.html"));
  });

  // Reject toggle
  $("btnRejectToggle")?.addEventListener("click", () => {
    show($("rejectBox"), true);
    $("rejectReason")?.focus();
  });

  // Reject cancel
  $("btnRejectCancel")?.addEventListener("click", () => {
    show($("rejectBox"), false);
    if ($("rejectReason")) $("rejectReason").value = "";
  });

  // Accept button
  $("btnAccept")?.addEventListener("click", handleAccept);

  // Reject confirm button
  $("btnRejectConfirm")?.addEventListener("click", handleReject);

  // Open offer draft button
  $("btnOpenOfferDraft")?.addEventListener("click", () => {
    const requestId = getCurrentRequest()?.id;
    if (!requestId) return;
    window.location.href = `offer-draft.html?requestId=${encodeURIComponent(requestId)}`;
  });

  // Project buttons handlers (bound dynamically in renderProjectButtons)
  setupProjectButtons();
}

/**
 * Handle accept request
 */
async function handleAccept() {
  const request = getCurrentRequest();
  const id = request?.id;
  if (!id) {
    setError("Request ID not found. Please refresh the page.");
    return;
  }

  // Check if request is in the correct status
  const currentStatus = request?.status?.toUpperCase();
  if (currentStatus && currentStatus !== "PENDING_REVIEW") {
    setError(`Cannot accept this request. Current status: ${currentStatus}. Only requests with status PENDING_REVIEW can be accepted.`);
    return;
  }

  const btn = $("btnAccept");
  const originalText = btn?.textContent || "Accept";
  if (btn) {
    btn.textContent = "Processing...";
    btn.disabled = true;
  }

  try {
    await reviewRequest(id, "ACCEPT");
    if (loadDataRef) await loadDataRef();
    alert("Request accepted successfully ✅");
  } catch (error) {
    console.error("Accept error:", error);
    const errorMsg = error.message || "Unknown error";
    // Provide user-friendly error message
    if (errorMsg.includes("409") || errorMsg.includes("Conflict") || errorMsg.includes("Invalid status")) {
      setError(`Cannot accept this request. It may have already been reviewed or is not in the correct status. Please refresh the page to see the current status.`);
      // Auto-refresh after showing error
      setTimeout(() => {
        if (loadDataRef) loadDataRef();
      }, 2000);
    } else {
      setError(`Failed to accept request: ${errorMsg}`);
    }
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

/**
 * Handle reject request
 */
async function handleReject() {
  const request = getCurrentRequest();
  const id = request?.id;
  if (!id) {
    setError("Request ID not found. Please refresh the page.");
    return;
  }

  // Check if request is in the correct status
  const currentStatus = request?.status?.toUpperCase();
  if (currentStatus && currentStatus !== "PENDING_REVIEW") {
    setError(`Cannot reject this request. Current status: ${currentStatus}. Only requests with status PENDING_REVIEW can be rejected.`);
    return;
  }

  const reason = ($("rejectReason")?.value || "").trim();
  if (!reason) {
    setError("Reject reason is required. Please provide a reason for rejection.");
    return;
  }

  const btn = $("btnRejectConfirm");
  const originalText = btn?.textContent || "Reject";
  if (btn) {
    btn.textContent = "Processing...";
    btn.disabled = true;
  }

  try {
    console.log("[REQUEST_DETAILS] Sending reject request:", { id, reason });
    await reviewRequest(id, "REJECT", reason);
    if (loadDataRef) await loadDataRef();
    alert("Request rejected successfully ❌");
  } catch (error) {
    console.error("Reject error:", error);
    const errorMsg = error.message || "Unknown error";
    // Provide user-friendly error message
    if (errorMsg.includes("409") || errorMsg.includes("Conflict") || errorMsg.includes("Invalid status")) {
      setError(`Cannot reject this request. It may have already been reviewed or is not in the correct status. Please refresh the page to see the current status.`);
      // Auto-refresh after showing error
      setTimeout(() => {
        if (loadDataRef) loadDataRef();
      }, 2000);
    } else {
      setError(`Failed to reject request: ${errorMsg}`);
    }
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

/**
 * Setup project buttons handlers
 */
function setupProjectButtons() {
  // Retry Create Project
  const btnRetry = $("btnRetryCreateProject");
  if (btnRetry) {
    btnRetry.onclick = async () => {
      const request = getCurrentRequest();
      const requestId = request?.id;
      if (!requestId) return;

      const originalText = btnRetry.textContent || "Retry Create Project";
      btnRetry.disabled = true;
      btnRetry.textContent = "Creating...";

      try {
        const project = await createProjectFromRequest(requestId);
        import("./state.js").then(({ setCurrentProject }) => {
          setCurrentProject(project);
          render();
          alert("Project created ✅");
        });
      } catch (error) {
        console.error("Create project error:", error);
        setError(`Failed to create project: ${error.message || "Unknown error"}`);
      } finally {
        btnRetry.disabled = false;
        btnRetry.textContent = originalText;
      }
    };
  }

  // Open Project
  const btnOpen = $("btnOpenProject");
  if (btnOpen) {
    btnOpen.onclick = () => {
      const project = getCurrentProject();
      if (!project?.id) return;
      window.location.href = `project-details.html?id=${encodeURIComponent(project.id)}`;
    };
  }

  // Edit Project
  const btnEdit = $("btnEditProject");
  if (btnEdit) {
    btnEdit.onclick = async () => {
      const project = getCurrentProject();
      if (!project?.id) return;

      const newTitle = prompt("New project title:", project?.title || "");
      if (newTitle === null) return; // cancelled
      const title = String(newTitle).trim();
      if (!title) return alert("Title is required.");

      btnEdit.disabled = true;
      btnEdit.textContent = "Saving...";

      try {
        const updated = await updateProject(project.id, { title });
        import("./state.js").then(({ setCurrentProject }) => {
          setCurrentProject(updated);
          render();
          alert("Updated ✅");
        });
      } catch (error) {
        console.error("Update project error:", error);
        setError(`Failed to update project: ${error.message || "Unknown error"}`);
      } finally {
        btnEdit.disabled = false;
        btnEdit.textContent = "Edit Project Title";
      }
    };
  }

  // Cancel Project
  const btnCancel = $("btnCancelProject");
  if (btnCancel) {
    btnCancel.onclick = async () => {
      const project = getCurrentProject();
      if (!project?.id) return;

      const reason = prompt("Cancel reason (optional):", "");
      if (reason === null) return;

      if (!confirm("Are you sure you want to cancel this project?")) return;

      const originalText = btnCancel.textContent || "Cancel Project";
      btnCancel.disabled = true;
      btnCancel.textContent = "Cancelling...";

      try {
        const updated = await cancelProject(project.id, reason);
        import("./state.js").then(({ setCurrentProject }) => {
          setCurrentProject(updated);
          render();
          alert("Cancelled ✅");
        });
      } catch (error) {
        console.error("Cancel project error:", error);
        setError(`Failed to cancel project: ${error.message || "Unknown error"}`);
      } finally {
        btnCancel.disabled = false;
        btnCancel.textContent = originalText;
      }
    };
  }
}
