import { supabaseAdmin } from "../../config/supabase.js";
import { ok, fail } from "../../utils/response.js";

export async function list(req, res) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_invoices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return fail(res, "Failed to fetch invoices", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list invoices", 500);
  }
}

export async function create(req, res) {
  try {
    const { projectId } = req.params;
    const {
      invoice_no = null,
      partner_id = null,
      description = null,
      currency = "SAR",
      amount = 0,
      status = "DRAFT",
      issued_at = null,
      due_at = null,
    } = req.body || {};

    const { data, error } = await supabaseAdmin
      .from("project_invoices")
      .insert([
        {
          project_id: projectId,
          invoice_no,
          partner_id,
          description,
          currency: String(currency),
          amount: Number(amount || 0),
          status: String(status),
          issued_at,
          due_at,
        },
      ])
      .select("*")
      .single();

    if (error || !data) return fail(res, "Failed to create invoice", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create invoice", 500);
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from("project_invoices").select("*").eq("id", id).single();
    if (error || !data) return fail(res, "Not Found", "Invoice not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch invoice", 500);
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};

    const { data, error } = await supabaseAdmin.from("project_invoices").update(patch).eq("id", id).select("*").single();
    if (error || !data) return fail(res, "Failed to update invoice", error || "Unknown error", 500);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update invoice", 500);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("project_invoices").delete().eq("id", id);
    if (error) return fail(res, "Failed to delete invoice", error, 500);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete invoice", 500);
  }
}
