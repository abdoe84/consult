// backend/src/routes/contracts.routes.js
import { Router } from "express";
import { ok, fail } from "../utils/response.js";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const contractsRoutes = Router();

/**
 * Create contract by request
 * POST /api/contracts/by-request/:requestId
 * Body: { offer_id?, status?, notes? }
 */
contractsRoutes.post(
  "/by-request/:requestId",
  requireAuth,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { offer_id = null, status = "CONTRACT_DRAFT", notes = null } = req.body || {};

      if (!requestId) {
        return fail(res, "Validation error", "requestId is required", 400);
      }

      // Ensure request exists
      const { data: reqRow, error: reqErr } = await supabaseAdmin
        .from("service_requests")
        .select("id")
        .eq("id", requestId)
        .single();

      if (reqErr || !reqRow) return fail(res, "Not found", "Service request not found", 404);

      // Create contract
      const insertPayload = {
        request_id: requestId,
        offer_id,
        status,
        notes,
        uploaded_by_user_id: req.user?.id || null,
      };

      const { data: created, error } = await supabaseAdmin
        .from("contracts")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) return fail(res, "Database error", error.message, 400);

      return ok(res, created);
    } catch (e) {
      return fail(res, "Server error", e?.message || "Failed to create contract", 500);
    }
  }
);

/**
 * Update contract status
 * POST /api/contracts/:id/status
 * Body: { status, notes? }
 */
contractsRoutes.post(
  "/:id/status",
  requireAuth,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes = null } = req.body || {};

      if (!id) return fail(res, "Validation error", "id is required", 400);
      if (!status) return fail(res, "Validation error", "status is required", 400);

      const patch = {
        status,
        notes,
        updated_at: new Date().toISOString(),
      };

      // Optional timestamps based on status
      if (status === "CONTRACT_UPLOADED") patch.uploaded_at = new Date().toISOString();
      if (status === "CONTRACT_SIGNED") patch.signed_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("contracts")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return fail(res, "Database error", error.message, 400);
      return ok(res, data);
    } catch (e) {
      return fail(res, "Server error", e?.message || "Failed to update contract status", 500);
    }
  }
);

/**
 * Backward-compatible alias (if you were already calling POST /api/contracts/:id)
 * POST /api/contracts/:id
 * Body: { status, notes? }
 */
contractsRoutes.post(
  "/:id",
  requireAuth,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    // forward to /:id/status logic
    req.url = `/${req.params.id}/status`;
    return contractsRoutes.handle(req, res);
  }
);
