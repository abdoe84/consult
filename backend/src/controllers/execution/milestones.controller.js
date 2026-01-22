import { supabaseAdmin } from "../../config/supabase.js";
import { ok, fail } from "../../utils/response.js";

export async function list(req, res) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true });

    if (error) return fail(res, "Failed to fetch milestones", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list milestones", 500);
  }
}

export async function create(req, res) {
  try {
    const { projectId } = req.params;
    const { title, description = null, start_date = null, end_date = null, status = "PLANNED", order_index = 0 } =
      req.body || {};

    if (!title) return fail(res, "Validation Error", "title is required", 400);

    const { data, error } = await supabaseAdmin
      .from("project_milestones")
      .insert([
        {
          project_id: projectId,
          title: String(title),
          description: description ? String(description) : null,
          start_date,
          end_date,
          status: String(status),
          order_index: Number(order_index || 0),
        },
      ])
      .select("*")
      .single();

    if (error || !data) return fail(res, "Failed to create milestone", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create milestone", 500);
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from("project_milestones").select("*").eq("id", id).single();
    if (error || !data) return fail(res, "Not Found", "Milestone not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch milestone", 500);
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};

    const { data, error } = await supabaseAdmin.from("project_milestones").update(patch).eq("id", id).select("*").single();
    if (error || !data) return fail(res, "Failed to update milestone", error || "Unknown error", 500);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update milestone", 500);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("project_milestones").delete().eq("id", id);
    if (error) return fail(res, "Failed to delete milestone", error, 500);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete milestone", 500);
  }
}
