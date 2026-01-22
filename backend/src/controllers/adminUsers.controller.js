import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { ROLES } from "../config/constants.js";

function normalizeRole(role) {
  const r = String(role || "").toUpperCase();
  const allowed = new Set(Object.values(ROLES));
  return allowed.has(r) ? r : null;
}

export async function listUsers(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,is_active,created_at,last_login_at")
      .order("created_at", { ascending: false });

    if (error) return fail(res, "Failed to list users", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list users", 500);
  }
}

export async function createUser(req, res) {
  try {
    const { email, full_name = null, role = "CONSULTANT", password } = req.body || {};
    if (!email || !password) return fail(res, "Validation Error", "email and password are required", 400);

    const r = normalizeRole(role);
    if (!r) return fail(res, "Validation Error", { role, allowed: Object.values(ROLES) }, 400);

    const password_hash = await bcrypt.hash(String(password), 10);

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          email: String(email).toLowerCase(),
          full_name: full_name ? String(full_name) : null,
          role: r,
          is_active: true,
          password_hash,
        },
      ])
      .select("id,email,full_name,role,is_active,created_at")
      .single();

    if (error || !data) return fail(res, "Failed to create user", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create user", 500);
  }
}

export async function setUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password) return fail(res, "Validation Error", "password is required", 400);

    const password_hash = await bcrypt.hash(String(password), 10);

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ password_hash })
      .eq("id", id)
      .select("id,email,role,is_active")
      .single();

    if (error || !data) return fail(res, "Failed to set password", error || "Unknown error", 500);
    return ok(res, { updated: true, user: data });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to set password", 500);
  }
}

export async function deactivateUser(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id)
      .select("id,email,role,is_active")
      .single();

    if (error || !data) return fail(res, "Failed to deactivate user", error || "Unknown error", 500);
    return ok(res, { updated: true, user: data });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to deactivate user", 500);
  }
}
