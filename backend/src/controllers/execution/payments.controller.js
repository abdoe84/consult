import { supabaseAdmin } from "../../config/supabase.js";
import { ok, fail } from "../../utils/response.js";

export async function list(req, res) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_payments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return fail(res, "Failed to fetch payments", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list payments", 500);
  }
}

export async function create(req, res) {
  try {
    const { projectId } = req.params;
    const { invoice_id = null, currency = "SAR", amount = 0, status = "PENDING", method = null, reference = null, paid_at = null } =
      req.body || {};

    const { data, error } = await supabaseAdmin
      .from("project_payments")
      .insert([
        {
          project_id: projectId,
          invoice_id,
          currency: String(currency),
          amount: Number(amount || 0),
          status: String(status),
          method,
          reference,
          paid_at,
        },
      ])
      .select("*")
      .single();

    if (error || !data) return fail(res, "Failed to create payment", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create payment", 500);
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from("project_payments").select("*").eq("id", id).single();
    if (error || !data) return fail(res, "Not Found", "Payment not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch payment", 500);
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};

    const { data, error } = await supabaseAdmin.from("project_payments").update(patch).eq("id", id).select("*").single();
    if (error || !data) return fail(res, "Failed to update payment", error || "Unknown error", 500);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update payment", 500);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("project_payments").delete().eq("id", id);
    if (error) return fail(res, "Failed to delete payment", error, 500);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete payment", 500);
  }
}
