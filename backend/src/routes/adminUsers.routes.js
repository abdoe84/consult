// backend/src/routes/adminUsers.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ok, fail } from "../utils/response.js";
import { supabaseAdmin } from "../config/supabase.js";

export const adminUsersRoutes = Router();

/**
 * Admin Users Routes (minimal - for now)
 * GET /api/admin/users  -> list users (profiles)
 */
adminUsersRoutes.get("/users", requireAuth, async (req, res) => {
  try {
    // Optional: restrict to admin/manager
    const role = (req.user?.role || "").toUpperCase();
    if (!["ADMIN", "MANAGER"].includes(role)) {
      return fail(res, "Forbidden", "Admin/Manager only", 403);
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,is_active,created_at")
      .order("created_at", { ascending: false });

    if (error) return fail(res, "DB Error", error.message, 500);
    return ok(res, data);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed to list users", 500);
  }
});
