// backend/src/routes/auth.routes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { ok, fail } from "../utils/response.js";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRoutes = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Success: { ok:true, data: { token, user } }
 */
authRoutes.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return fail(res, "Validation error", "email and password are required", 400);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return fail(res, "Server misconfigured", "Missing JWT_SECRET", 500);

    // Load user profile
    const { data: user, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,is_active,password_hash")
      .eq("email", String(email).toLowerCase().trim())
      .single();

    if (error || !user) return fail(res, "Invalid credentials", "Email or password is wrong", 401);
    if (!user.is_active) return fail(res, "Unauthorized", "User inactive", 401);
    if (!user.password_hash) return fail(res, "Server data error", "User has no password_hash", 500);

    const isOk = await bcrypt.compare(String(password), String(user.password_hash));
    if (!isOk) return fail(res, "Invalid credentials", "Email or password is wrong", 401);

    // JWT payload: keep it simple and stable
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };

    return ok(res, { token, user: safeUser });
  } catch (e) {
    return fail(res, "Server Error", e?.message || "Login failed", 500);
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
authRoutes.get("/me", requireAuth, async (req, res) => {
  return ok(res, req.user);
});
