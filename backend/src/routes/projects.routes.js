import express from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

function isManager(req) {
  return String(req.user?.role || "").toUpperCase() === "MANAGER";
}

function norm(x) {
  return String(x ?? "").trim();
}

// ===============================
// GET /api/projects (List all projects)
// ===============================
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail(res, "DB Error", error.message, 500);
    return ok(res, data || []);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

// ===============================
// GET /api/projects/by-request/:requestId
// ===============================
router.get("/by-request/:requestId", requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (error) return fail(res, "DB Error", error.message, 500);
    return ok(res, data || null);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

// ===============================
// POST /api/projects/from-request/:requestId
// Manager Retry (Rescue)
// Creates project ONLY if offer is CLIENT_APPROVED and no project exists
// ===============================
router.post("/from-request/:requestId", requireAuth, async (req, res) => {
  try {
    if (!isManager(req)) return fail(res, "Forbidden", "Only MANAGER can retry", 403);

    const { requestId } = req.params;

    // 1) if project exists -> return it
    const { data: existing, error: e0 } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (e0) return fail(res, "DB Error", e0.message, 500);
    if (existing) return ok(res, existing);

    // 2) must have an approved offer by client
    const { data: offer, error: e1 } = await supabaseAdmin
      .from("offers")
      .select("id, request_id, status")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (e1) return fail(res, "DB Error", e1.message, 500);
    if (!offer) return fail(res, "Not Found", "No offer found for this request", 404);

    if (String(offer.status).toUpperCase() !== "CLIENT_APPROVED") {
      return fail(res, "Invalid state", `Offer must be CLIENT_APPROVED (current: ${offer.status})`, 409);
    }

    // 3) build project name from request
    const { data: reqRow, error: e2 } = await supabaseAdmin
      .from("service_requests")
      .select("reference_no, title")
      .eq("id", requestId)
      .maybeSingle();

    if (e2) return fail(res, "DB Error", e2.message, 500);

    const name = reqRow?.title
      ? `Project • ${reqRow.title}`
      : `Project • ${reqRow?.reference_no || requestId}`;

    // 4) insert project (IMPORTANT: name is NOT NULL in DB)
    const now = new Date().toISOString();
    const payload = {
      request_id: requestId,
      offer_id: offer.id,
      name,
      status: "DRAFT",
      created_by: req.user.id,
      created_by_user_id: req.user.id,
      updated_by: req.user.id,
      updated_at: now,
    };

    const { data: inserted, error: e3 } = await supabaseAdmin
      .from("projects")
      .insert(payload)
      .select("*")
      .single();

    if (e3) {
      if (String(e3.message || "").includes("duplicate") || String(e3.code || "") === "23505") {
        const { data: again } = await supabaseAdmin
          .from("projects")
          .select("*")
          .eq("request_id", requestId)
          .maybeSingle();
        return ok(res, again || null);
      }
      return fail(res, "DB Error", e3.message, 500);
    }

    return ok(res, inserted, 201);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

// ===============================
// PATCH /api/projects/:id (Edit) - Manager only
// body: { name, description, status, project_manager_user_id }
// ===============================
router.patch("/:id", requireAuth, requireRole(["MANAGER"]), async (req, res) => {
  try {
    const { id } = req.params;

    const patch = {
      updated_at: new Date().toISOString(),
      updated_by: req.user.id,
    };

    if (req.body?.name !== undefined) {
      const v = norm(req.body.name);
      if (!v) return fail(res, "Validation", "name is required", 400);
      patch.name = v;
    }
    if (req.body?.description !== undefined) patch.description = norm(req.body.description) || null;
    if (req.body?.status !== undefined) {
      const status = norm(req.body.status).toUpperCase();
      const validStatuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];
      // Map old values to new ones for backward compatibility
      const statusMap = {
        "ON_HOLD": "ACTIVE",
        "COMPLETED": "CLOSED",
        "CANCELLED": "ARCHIVED"
      };
      const mappedStatus = statusMap[status] || status;
      if (!validStatuses.includes(mappedStatus)) {
        return fail(res, "Validation", `Status must be one of: ${validStatuses.join(", ")}`, 400);
      }
      patch.status = mappedStatus;
    }

    if (req.body?.project_manager_user_id === null) patch.project_manager_user_id = null;
    if (typeof req.body?.project_manager_user_id === "string" && req.body.project_manager_user_id) {
      patch.project_manager_user_id = req.body.project_manager_user_id;
    }

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return fail(res, "DB Error", error.message, 500);
    if (!data) return fail(res, "Not Found", "Project not found", 404);

    return ok(res, data);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

// ===============================
// POST /api/projects/:id/cancel (Soft cancel)
// Manager only
// body: { reason? }
// NOTE: To avoid unknown status constraints, we set status=ARCHIVED
// ===============================
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    if (!isManager(req)) return fail(res, "Forbidden", "Only MANAGER can cancel", 403);

    const { id } = req.params;
    const reason = norm(req.body?.reason) || null;
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update({
        status: "ARCHIVED",
        cancel_reason: reason,
        cancelled_at: now,
        cancelled_by: req.user.id,
        archived_at: now,
        archived_by: req.user.id,
        updated_by: req.user.id,
        updated_at: now,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return fail(res, "DB Error", error.message, 500);
    if (!data) return fail(res, "Not Found", "Project not found", 404);

    return ok(res, data);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

export const projectsRoutes = router;
