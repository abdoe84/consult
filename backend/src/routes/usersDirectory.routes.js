import express from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * GET /api/users/directory
 * returns all profiles for dropdowns (id, full_name, email, role)
 */
router.get("/directory", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .order("full_name", { ascending: true });

    if (error) return fail(res, "DB Error", error.message, 500);
    return ok(res, data || []);
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Failed", 500);
  }
});

export const usersDirectoryRoutes = router;
