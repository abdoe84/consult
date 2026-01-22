import express from "express";
import multer from "multer";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { randomUUID } from "crypto";

export const projectExecutionRoutes = express.Router();

// Auth for all routes
projectExecutionRoutes.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function safeName(name = "file") {
  return String(name)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 150);
}

async function getProjectOr404(projectId) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !data) return { ok: false, error: "Not Found", details: error?.message || "Project not found" };
  return { ok: true, data };
}

// =========================
// Project (Basics)
// =========================
projectExecutionRoutes.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;

  const pr = await getProjectOr404(projectId);
  if (!pr.ok) return fail(res, pr.error, pr.details, 404);

  const projectData = pr.data;

  // Fetch related service request and offer for automatic name and value
  let serviceRequest = null;
  let offer = null;

  if (projectData.request_id) {
    const { data: sr } = await supabaseAdmin
      .from("service_requests")
      .select("id, title, reference_no, description")
      .eq("id", projectData.request_id)
      .maybeSingle();
    serviceRequest = sr;
  }

  if (projectData.offer_id) {
    const { data: of } = await supabaseAdmin
      .from("offers")
      .select("id, financial_offer, financial_data, status")
      .eq("id", projectData.offer_id)
      .maybeSingle();
    offer = of;
  }

  // Extract project value from offer (subtotal without VAT)
  let extractedValue = null;
  if (offer) {
    const financial = offer.financial_offer || offer.financial_data;
    if (financial && typeof financial === 'object') {
      // Try to get subtotal from totals object
      if (financial.totals && typeof financial.totals === 'object') {
        extractedValue = financial.totals.subtotal || financial.totals.subtotal_before_vat;
      }
      // If not found, calculate from items
      if (!extractedValue) {
        const items = financial.items || financial.lines || [];
        if (Array.isArray(items) && items.length > 0) {
          extractedValue = items.reduce((sum, item) => {
            const qty = Number(item.qty || item.quantity || 0);
            let lineTotal = 0;

            if (item.base_cost !== undefined) {
              // New format
              const baseCost = Number(item.base_cost || 0);
              const profitPercent = Number(item.profit_percent || 0);
              const contingencyPercent = Number(item.contingency_percent || 0);
              const discountPercent = Number(item.discount_percent || 0);
              const unitPriceAfterPercentages = baseCost * (1 + (profitPercent / 100) + (contingencyPercent / 100));
              const unitPriceAfterDiscount = unitPriceAfterPercentages * (1 - (discountPercent / 100));
              lineTotal = unitPriceAfterDiscount * qty;
            } else {
              // Old format
              const unitPrice = Number(item.unit_price || item.unitPrice || item.price || 0);
              const contingency = Number(item.contingency || 0);
              const profit = Number(item.profit || 0);
              lineTotal = (qty * unitPrice) + contingency + profit;
            }
            return sum + lineTotal;
          }, 0);
        }
      }
    }
  }

  // Build project name from service request title
  let extractedName = null;
  if (serviceRequest && serviceRequest.title) {
    extractedName = serviceRequest.title;
  }

  return ok(res, {
    ...projectData,
    _related: {
      service_request: serviceRequest,
      offer: offer ? { id: offer.id, status: offer.status } : null,
    },
    _extracted: {
      name_from_request: extractedName,
      value_from_offer: extractedValue,
    }
  });
});

projectExecutionRoutes.patch("/:projectId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;

  const allowed = [
    "name",
    "title",
    "description",
    "status",
    "project_code",
    "project_manager_user_id",
    "start_date",
    "target_end_date",
    "value_sar",
    "project_value", // Keep for backward compatibility
    "project_currency", // Keep for backward compatibility
  ];

  const payload = {};
  for (const k of allowed) {
    if (k in req.body) payload[k] = req.body[k];
  }

  // Validate status if provided
  if (payload.status) {
    const status = String(payload.status).toUpperCase();
    const validStatuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];
    // Map old values to new ones for backward compatibility
    const statusMap = {
      "ON_HOLD": "ACTIVE",
      "COMPLETED": "CLOSED",
      "CANCELLED": "ARCHIVED"
    };
    const mappedStatus = statusMap[status] || status;
    if (!validStatuses.includes(mappedStatus)) {
      return fail(res, "Invalid status", `Status must be one of: ${validStatuses.join(", ")}`, 400);
    }
    payload.status = mappedStatus;
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Update failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.post("/:projectId/close", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const notes = (req.body?.notes || "").trim() || null;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      closing_notes: notes,
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Close failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.post("/:projectId/archive", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update({
      status: "ARCHIVED",
      archived_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Archive failed", error.message, 400);
  return ok(res, data);
});

// =========================
// Team
// =========================
projectExecutionRoutes.get("/:projectId/team", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_team")
    .select("id, project_id, user_id, role_in_project, member_role, is_active, added_at, profiles:profiles(id,email,full_name,role)")
    .eq("project_id", projectId)
    .order("added_at", { ascending: false });

  if (error) return fail(res, "Team load failed", error.message, 400);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/team", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const user_ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
  const role_in_project = String(req.body?.role_in_project || "MEMBER").toUpperCase();
  const member_role = req.body?.member_role ? String(req.body.member_role) : null;

  if (!user_ids.length) return fail(res, "Invalid input", "user_ids is required", 400);

  const rows = user_ids.map((uid) => ({
    project_id: projectId,
    user_id: uid,
    role_in_project,
    member_role,
    is_active: true,
    added_at: new Date().toISOString(),
    added_by: req.user.id,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from("project_team")
    .upsert(rows, { onConflict: "project_id,user_id" })
    .select("id, project_id, user_id, role_in_project, member_role, is_active, added_at");

  if (error) return fail(res, "Add team failed", error.message, 400);
  return ok(res, data || []);
});

projectExecutionRoutes.delete("/:projectId/team/:userId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, userId } = req.params;

  const { error } = await supabaseAdmin
    .from("project_team")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) return fail(res, "Remove failed", error.message, 400);
  return ok(res, true);
});

// =========================
// Milestones
// =========================
projectExecutionRoutes.get("/:projectId/milestones", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_milestones")
    .select("id, project_id, title, status, start_date, end_date, notes, created_at, updated_at")
    .eq("project_id", projectId)
    .order("start_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) return fail(res, "Milestones fetch error", error.message, 500);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/milestones", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const { title, status, start_date, end_date, notes } = req.body || {};

  if (!title || !String(title).trim()) {
    return fail(res, "Title is required", "Title field is required", 400);
  }

  const payload = {
    project_id: projectId,
    title: String(title).trim(),
    status: status || "PLANNED",
    start_date: start_date || null,
    end_date: end_date || null,
    notes: notes || null,
  };

  const { data, error } = await supabaseAdmin
    .from("project_milestones")
    .insert(payload)
    .select("id, project_id, title, status, start_date, end_date, notes, created_at, updated_at")
    .single();

  if (error) return fail(res, "Milestone create error", error.message, 500);
  return ok(res, data);
});

projectExecutionRoutes.patch("/:projectId/milestones/:mid", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, mid } = req.params;

  const allowed = ["title", "status", "start_date", "end_date", "notes"];
  const patch = {};
  for (const k of allowed) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }

  const { data, error } = await supabaseAdmin
    .from("project_milestones")
    .update(patch)
    .eq("id", mid)
    .eq("project_id", projectId)
    .select("id, project_id, title, status, start_date, end_date, notes, created_at, updated_at")
    .single();

  if (error) return fail(res, "Milestone update error", error.message, 500);
  return ok(res, data);
});

projectExecutionRoutes.delete("/:projectId/milestones/:mid", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, mid } = req.params;

  const { error } = await supabaseAdmin
    .from("project_milestones")
    .delete()
    .eq("id", mid)
    .eq("project_id", projectId);

  if (error) return fail(res, "Milestone delete error", error.message, 500);
  return ok(res, { deleted: true });
});

// =========================
// Tasks
// =========================
projectExecutionRoutes.get("/:projectId/tasks", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .select("id, project_id, milestone_id, title, description, status, priority, assigned_to_user_id, start_date, due_date, completed_at, actual_days, notes, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(res, "Tasks load failed", error.message, 400);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/tasks", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const title = (req.body?.title || "").trim();
  if (!title) return fail(res, "Invalid input", "title is required", 400);

  const payload = {
    project_id: projectId,
    milestone_id: req.body?.milestone_id || null,
    title,
    description: req.body?.description || null,
    status: String(req.body?.status || "TODO").toUpperCase(),
    priority: String(req.body?.priority || "NORMAL").toUpperCase(),
    assigned_to_user_id: req.body?.assigned_to_user_id || null,
    start_date: req.body?.start_date || null,
    due_date: req.body?.due_date || null,
    actual_days: req.body?.actual_days ?? null,
    notes: req.body?.notes || null,
    updated_by: req.user.id,
  };

  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .insert(payload)
    .select("*")
    .single();

  if (error) return fail(res, "Create task failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.patch("/:projectId/tasks/:taskId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, taskId } = req.params;

  const allowed = [
    "title",
    "description",
    "status",
    "priority",
    "assigned_to_user_id",
    "start_date",
    "due_date",
    "actual_days",
    "notes",
    "completed_at",
  ];

  const payload = {};
  for (const k of allowed) {
    if (k in req.body) payload[k] = req.body[k];
  }
  payload.updated_by = req.user.id;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Update failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.delete("/:projectId/tasks/:taskId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, taskId } = req.params;

  const { error } = await supabaseAdmin
    .from("project_tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return fail(res, "Delete failed", error.message, 400);
  return ok(res, true);
});

// =========================
// Documents (Real Upload)
// - Upload -> storage bucket "documents"
// - Store metadata in documents table
// - Link in project_documents table
// =========================
projectExecutionRoutes.get("/:projectId/documents", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_documents")
    .select("id, project_id, document_id, created_at, entity_type, entity_id, documents:documents(id,file_name,storage_path,mime_type,file_size_bytes,uploaded_at,meta)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(res, "Documents load failed", error.message, 400);

  // Build signed URLs
  const rows = [];
  for (const r of data || []) {
    const doc = r.documents;
    let url = null;
    if (doc?.storage_path) {
      const { data: signed, error: signErr } = await supabaseAdmin
        .storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60 * 60 * 24); // 24h

      if (!signErr) url = signed?.signedUrl || null;
    }

    rows.push({
      id: r.id,
      project_id: r.project_id,
      document_id: r.document_id,
      created_at: r.created_at,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      file_name: doc?.file_name,
      storage_path: doc?.storage_path,
      mime_type: doc?.mime_type,
      file_size_bytes: doc?.file_size_bytes,
      uploaded_at: doc?.uploaded_at,
      category: doc?.meta?.category || null,
      notes: doc?.meta?.notes || null,
      url,
    });
  }

  return ok(res, rows);
});

projectExecutionRoutes.post(
  "/:projectId/documents/upload",
  requireRole(["ADMIN", "MANAGER"]),
  upload.single("file"),
  async (req, res) => {
    const { projectId } = req.params;

    if (!req.file) return fail(res, "Invalid input", "file is required", 400);

    const category = String(req.body?.category || "DOCUMENT").toUpperCase();
    const notes = (req.body?.notes || "").trim() || null;

    const originalName = req.file.originalname || "file";
    const file_name = safeName(originalName);
    const ext = file_name.includes(".") ? file_name.split(".").pop() : "";
    const key = `${projectId}/${Date.now()}_${randomUUID()}${ext ? "." + ext : ""}`;

    // 1) Upload to storage
    const up = await supabaseAdmin.storage
      .from("documents")
      .upload(key, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (up.error) return fail(res, "Upload failed", up.error.message, 400);

    // 2) Insert into documents table
    const meta = {
      category,
      notes,
      original_name: originalName,
      bucket: "documents",
    };

    const insDoc = await supabaseAdmin
      .from("documents")
      .insert({
        file_name,
        storage_path: key,
        mime_type: req.file.mimetype || null,
        file_size_bytes: req.file.size || null,
        uploaded_by_user_id: req.user.id,
        uploaded_at: new Date().toISOString(),
        meta,
      })
      .select("*")
      .single();

    if (insDoc.error) return fail(res, "DB insert failed", insDoc.error.message, 400);

    // 3) Link to project
    const link = await supabaseAdmin
      .from("project_documents")
      .insert({
        project_id: projectId,
        document_id: insDoc.data.id,
        entity_type: "PROJECT",
        entity_id: projectId,
      })
      .select("*")
      .single();

    if (link.error) return fail(res, "Link failed", link.error.message, 400);

    return ok(res, {
      project_document_id: link.data.id,
      document_id: insDoc.data.id,
      file_name: insDoc.data.file_name,
      storage_path: insDoc.data.storage_path,
      category,
      notes,
    });
  }
);

projectExecutionRoutes.delete("/:projectId/documents/:projectDocumentId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, projectDocumentId } = req.params;

  // Unlink only (do NOT delete shared file)
  const { error } = await supabaseAdmin
    .from("project_documents")
    .delete()
    .eq("id", projectDocumentId)
    .eq("project_id", projectId);

  if (error) return fail(res, "Delete failed", error.message, 400);
  return ok(res, true);
});

// =========================
// Financial - Invoices
// =========================
projectExecutionRoutes.get("/:projectId/invoices", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_invoices")
    .select("id, project_id, invoice_no, partner_id, description, currency, amount, status, issued_at, due_at, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(res, "Invoices load failed", error.message, 400);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/invoices", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate projectId
    if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
      return fail(res, "Invalid input", "Project ID is required", 400);
    }

    // Validate amount
    if (req.body?.amount === undefined || req.body?.amount === null) {
      return fail(res, "Invalid input", "Amount is required", 400);
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || isNaN(amount)) {
      return fail(res, "Invalid input", "Amount must be a valid number", 400);
    }

    if (amount < 0) {
      return fail(res, "Invalid input", "Amount cannot be negative", 400);
    }

    // Validate and normalize status
    const validStatuses = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"];
    let status = String(req.body?.status || "DRAFT").toUpperCase();

    // Map legacy statuses to valid ones
    if (status === "SENT") status = "ISSUED";
    if (status === "OVERDUE") status = "ISSUED"; // Map OVERDUE to ISSUED

    if (!validStatuses.includes(status)) {
      return fail(res, "Invalid input", `Status must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const payload = {
      project_id: projectId,
      invoice_no: (req.body?.invoice_no || "").trim() || null,
      partner_id: req.body?.partner_id || null,
      description: (req.body?.description || "").trim() || null,
      currency: String(req.body?.currency || "SAR").toUpperCase(),
      amount: amount,
      status: status,
      issued_at: req.body?.issued_at || null,
      due_at: req.body?.due_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("project_invoices")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Invoice insert error:", error);
      return fail(res, "Add invoice failed", error.message, 400);
    }

    return ok(res, data);
  } catch (e) {
    console.error("Invoice POST error:", e);
    return fail(res, "Server error", e?.message || "Failed to add invoice", 500);
  }
});

// =========================
// Financial - Payments
// =========================
projectExecutionRoutes.get("/:projectId/payments", async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("project_payments")
    .select("id, project_id, invoice_id, currency, amount, status, method, reference, paid_at, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return fail(res, "Payments load failed", error.message, 400);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/payments", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;

  const payload = {
    project_id: projectId,
    invoice_id: req.body?.invoice_id || null,
    currency: String(req.body?.currency || "SAR").toUpperCase(),
    amount: Number(req.body?.amount || 0),
    status: String(req.body?.status || "PENDING").toUpperCase(),
    method: req.body?.method || null,
    reference: req.body?.reference || req.body?.payment_ref || null,
    paid_at: req.body?.paid_at || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("project_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) return fail(res, "Add payment failed", error.message, 400);
  return ok(res, data);
});

// =========================
// Partners + Procurement
// =========================
projectExecutionRoutes.get("/:projectId/partners", async (req, res) => {
  const { projectId } = req.params;

  const { data: partners, error: pErr } = await supabaseAdmin
    .from("project_partners")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (pErr) return fail(res, "Partners load failed", pErr.message, 400);

  const ids = (partners || []).map((p) => p.id);
  let procurement = [];
  if (ids.length) {
    const { data: pr, error: prErr } = await supabaseAdmin
      .from("project_partner_procurement")
      .select("*")
      .in("partner_id", ids)
      .order("created_at", { ascending: false });

    if (prErr) return fail(res, "Procurement load failed", prErr.message, 400);
    procurement = pr || [];
  }

  const byPartner = new Map();
  for (const row of procurement) {
    const arr = byPartner.get(row.partner_id) || [];
    arr.push(row);
    byPartner.set(row.partner_id, arr);
  }

  const out = (partners || []).map((p) => ({
    ...p,
    procurement: byPartner.get(p.id) || [],
  }));

  return ok(res, out);
});

projectExecutionRoutes.post("/:projectId/partners", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;

  const partner_type = String(req.body?.partner_type || "LAB").toUpperCase();
  const name = (req.body?.name || "").trim();
  if (!name) return fail(res, "Invalid input", "name is required", 400);

  // Validate partner_type against allowed values
  const allowedTypes = ["LAB", "SUBCONTRACTOR"];
  if (!allowedTypes.includes(partner_type)) {
    return fail(res, "Invalid input", `partner_type must be one of: ${allowedTypes.join(", ")}`, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("project_partners")
    .insert({
      project_id: projectId,
      partner_type,
      name,
      status: "ACTIVE",
      created_by: req.user.id,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return fail(res, "Add partner failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.post("/:projectId/partners/:partnerId/procurement", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { partnerId } = req.params;

  const doc_type = String(req.body?.doc_type || "PR").toUpperCase();
  const sap_ref = (req.body?.sap_ref || "").trim();
  if (!sap_ref) return fail(res, "Invalid input", "sap_ref is required", 400);

  const status = String(req.body?.status || "OPEN").toUpperCase();
  // Handle start_date: convert empty string to null, validate format
  let start_date = req.body?.start_date;
  if (start_date === "" || start_date === undefined) {
    start_date = null;
  } else if (typeof start_date === 'string' && start_date.trim() === '') {
    start_date = null;
  }
  const notes = (req.body?.notes || "").trim() || null;

  const { data, error } = await supabaseAdmin
    .from("project_partner_procurement")
    .insert({
      partner_id: partnerId,
      doc_type,
      sap_ref,
      status,
      start_date,
      notes,
      created_by: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return fail(res, "Add procurement failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.patch("/procurement/:id", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { id } = req.params;

  const allowed = ["sap_ref", "start_date", "status", "notes"];
  const payload = {};
  for (const k of allowed) if (k in req.body) payload[k] = req.body[k];
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_partner_procurement")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return fail(res, "Update failed", error.message, 400);
  return ok(res, data);
});

projectExecutionRoutes.delete("/:projectId/partners/:partnerId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, partnerId } = req.params;

  const { error } = await supabaseAdmin
    .from("project_partners")
    .delete()
    .eq("id", partnerId)
    .eq("project_id", projectId);

  if (error) return fail(res, "Delete failed", error.message, 400);
  return ok(res, { deleted: true });
});

projectExecutionRoutes.delete("/:projectId/partners/:partnerId/procurement/:procurementId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, partnerId, procurementId } = req.params;

  // Verify procurement belongs to partner and partner belongs to project
  const { data: partner, error: pErr } = await supabaseAdmin
    .from("project_partners")
    .select("id")
    .eq("id", partnerId)
    .eq("project_id", projectId)
    .single();

  if (pErr || !partner) return fail(res, "Partner not found", "Partner does not belong to this project", 404);

  const { error } = await supabaseAdmin
    .from("project_partner_procurement")
    .delete()
    .eq("id", procurementId)
    .eq("partner_id", partnerId);

  if (error) return fail(res, "Delete failed", error.message, 400);
  return ok(res, { deleted: true });
});

// ================================
// Expenses
// ================================
projectExecutionRoutes.get("/:projectId/expenses", async (req, res) => {
  const { projectId } = req.params;
  const { data, error } = await supabaseAdmin
    .from("project_expenses")
    .select("*")
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false, nullsFirst: false });

  if (error) return fail(res, "Expenses fetch error", error.message, 500);
  return ok(res, data || []);
});

projectExecutionRoutes.post("/:projectId/expenses", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const { category, subcategory, description, amount, currency, expense_date, status, vendor, reference, notes } = req.body || {};

  if (!category || !String(category).trim()) return fail(res, "Category is required", null, 400);
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return fail(res, "Valid amount is required", null, 400);

  const payload = {
    project_id: projectId,
    category: String(category).trim().toUpperCase(),
    subcategory: (subcategory || "").trim() || null,
    description: (description || "").trim() || null,
    amount: Number(amount),
    currency: (currency || "SAR").toUpperCase(),
    expense_date: expense_date || null,
    status: (status || "PENDING").toUpperCase(),
    vendor: (vendor || "").trim() || null,
    reference: (reference || "").trim() || null,
    notes: (notes || "").trim() || null,
    created_by: req.user?.id || null,
  };

  const { data, error } = await supabaseAdmin
    .from("project_expenses")
    .insert(payload)
    .select("*")
    .single();

  if (error) return fail(res, "Expense create error", error.message, 500);
  return ok(res, data);
});

projectExecutionRoutes.patch("/:projectId/expenses/:expenseId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, expenseId } = req.params;
  const allowed = ["category", "description", "amount", "currency", "expense_date", "vendor", "reference", "notes"];
  const patch = {};
  for (const k of allowed) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_expenses")
    .update(patch)
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Expense update error", error.message, 500);
  return ok(res, data);
});

projectExecutionRoutes.delete("/:projectId/expenses/:expenseId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, expenseId } = req.params;
  const { error } = await supabaseAdmin
    .from("project_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("project_id", projectId);

  if (error) return fail(res, "Expense delete error", error.message, 500);
  return ok(res, { deleted: true });
});

// ============================================
// BUDGET ROUTES
// ============================================

// GET /api/project-execution/:projectId/budget
projectExecutionRoutes.get("/:projectId/budget", async (req, res) => {
  const { projectId } = req.params;
  const { data, error } = await supabaseAdmin
    .from("project_budget_items")
    .select("*")
    .eq("project_id", projectId)
    .order("category", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return fail(res, "Budget fetch error", error.message, 500);
  return ok(res, data || []);
});

// POST /api/project-execution/:projectId/budget
projectExecutionRoutes.post("/:projectId/budget", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId } = req.params;
  const { category, subcategory, description, budgeted_amount, currency, status, notes } = req.body || {};

  if (!category || !String(category).trim()) return fail(res, "Category is required", null, 400);
  if (!budgeted_amount || isNaN(Number(budgeted_amount)) || Number(budgeted_amount) < 0) {
    return fail(res, "Valid budgeted amount is required", null, 400);
  }

  const payload = {
    project_id: projectId,
    category: String(category).trim().toUpperCase(),
    subcategory: (subcategory || "").trim() || null,
    description: (description || "").trim() || null,
    budgeted_amount: Number(budgeted_amount),
    actual_amount: 0,
    currency: (currency || "SAR").toUpperCase(),
    status: (status || "PLANNED").toUpperCase(),
    notes: (notes || "").trim() || null,
    created_by: req.user?.id || null,
  };

  const { data, error } = await supabaseAdmin
    .from("project_budget_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) return fail(res, "Budget item create error", error.message, 500);
  return ok(res, data);
});

// PATCH /api/project-execution/:projectId/budget/:budgetId
projectExecutionRoutes.patch("/:projectId/budget/:budgetId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, budgetId } = req.params;
  const allowed = ["category", "subcategory", "description", "budgeted_amount", "currency", "status", "notes"];
  const patch = {};
  for (const k of allowed) {
    if (k in (req.body || {})) {
      if (k === "category" || k === "status") {
        patch[k] = String(req.body[k]).trim().toUpperCase();
      } else if (k === "budgeted_amount") {
        patch[k] = Number(req.body[k]);
      } else {
        patch[k] = req.body[k] ? String(req.body[k]).trim() : null;
      }
    }
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_budget_items")
    .update(patch)
    .eq("id", budgetId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Budget item update error", error.message, 500);
  return ok(res, data);
});

// DELETE /api/project-execution/:projectId/budget/:budgetId
projectExecutionRoutes.delete("/:projectId/budget/:budgetId", requireRole(["ADMIN", "MANAGER"]), async (req, res) => {
  const { projectId, budgetId } = req.params;
  const { data, error } = await supabaseAdmin
    .from("project_budget_items")
    .delete()
    .eq("id", budgetId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return fail(res, "Budget item delete error", error.message, 500);
  return ok(res, data || { id: budgetId });
});

// GET /api/project-execution/:projectId/budget/summary
projectExecutionRoutes.get("/:projectId/budget/summary", async (req, res) => {
  const { projectId } = req.params;

  // Get budget items
  const { data: budgetItems, error: budgetError } = await supabaseAdmin
    .from("project_budget_items")
    .select("id, category, budgeted_amount, actual_amount")
    .eq("project_id", projectId);

  if (budgetError) return fail(res, "Budget summary error", budgetError.message, 500);

  // Get actual expenses by category
  const { data: expenses, error: expensesError } = await supabaseAdmin
    .from("project_expenses")
    .select("category, amount")
    .eq("project_id", projectId);

  if (expensesError) return fail(res, "Expenses fetch error", expensesError.message, 500);

  // Calculate totals
  const totalBudgeted = (budgetItems || []).reduce((sum, item) => sum + Number(item.budgeted_amount || 0), 0);
  const totalActual = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const remaining = totalBudgeted - totalActual;
  const utilization = totalBudgeted > 0 ? ((totalActual / totalBudgeted) * 100).toFixed(1) : 0;

  // Update actual_amount in budget items based on expenses
  const categoryExpenses = {};
  (expenses || []).forEach(exp => {
    const cat = String(exp.category || "").toUpperCase();
    categoryExpenses[cat] = (categoryExpenses[cat] || 0) + Number(exp.amount || 0);
  });

  // Update budget items with actual amounts
  for (const item of (budgetItems || [])) {
    const cat = String(item.category || "").toUpperCase();
    const actual = categoryExpenses[cat] || 0;
    if (Number(item.actual_amount || 0) !== actual) {
      await supabaseAdmin
        .from("project_budget_items")
        .update({ actual_amount: actual })
        .eq("id", item.id);
    }
  }

  return ok(res, {
    total_budgeted: totalBudgeted,
    total_actual: totalActual,
    remaining: remaining,
    utilization: parseFloat(utilization),
    budget_items_count: (budgetItems || []).length,
    expenses_count: (expenses || []).length
  });
});
