import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, "Validation Error", "email and password are required", 400);

    const { data: user, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,is_active,password_hash")
      .eq("email", String(email).toLowerCase())
      .eq("is_active", true)
      .single();

    if (error || !user) return fail(res, "Invalid credentials", null, 401);
    if (!user.password_hash) return fail(res, "Invalid credentials", "No password set for this user", 401);

    const match = await bcrypt.compare(String(password), String(user.password_hash));
    if (!match) return fail(res, "Invalid credentials", null, 401);

    const secret = process.env.JWT_SECRET;
    if (!secret) return fail(res, "Server misconfigured", "Missing JWT_SECRET", 500);

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.full_name || null,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    await supabaseAdmin.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    return ok(res, {
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Login failed", 500);
  }
}

export async function me(req, res) {
  return ok(res, { user: req.user });
}
