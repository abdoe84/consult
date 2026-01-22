import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail } from "../utils/response.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return fail(res, "Unauthorized", "Missing Authorization: Bearer <token>", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.sub || decoded?.id;
    if (!userId) return fail(res, "Unauthorized", "Invalid token payload", 401);

    const { data: user, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .eq("id", userId)
      .single();

    if (error || !user) return fail(res, "Unauthorized", "User not found", 401);
    if (!user.is_active) return fail(res, "Unauthorized", "User is inactive", 401);

    req.user = user;
    next();
  } catch (e) {
    return fail(res, "Unauthorized", e?.message || "Invalid token", 401);
  }
}
