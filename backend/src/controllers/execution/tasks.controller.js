import { supabaseAdmin } from "../../config/supabase.js";
import { ok, fail } from "../../utils/response.js";

export async function list(req, res) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return fail(res, "Failed to fetch tasks", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list tasks", 500);
  }
}

export async function create(req, res) {
  try {
    const { projectId } = req.params;
    const {
      title,
      description = null,
      status = "TODO",
      priority = "NORMAL",
      assigned_to_user_id = null,
      due_date = null,
      milestone_id = null,
    } = req.body || {};

    if (!title) return fail(res, "Validation Error", "title is required", 400);

    const { data, error } = await supabaseAdmin
      .from("project_tasks")
      .insert([
        {
          project_id: projectId,
          milestone_id,
          title: String(title),
          description: description ? String(description) : null,
          status: String(status),
          priority: String(priority),
          assigned_to_user_id,
          due_date,
        },
      ])
      .select("*")
      .single();

    if (error || !data) return fail(res, "Failed to create task", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create task", 500);
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from("project_tasks").select("*").eq("id", id).single();
    if (error || !data) return fail(res, "Not Found", "Task not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch task", 500);
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;
    const patch = req.body || {};

    // Auto-set completed_at if status becomes DONE
    if (patch.status === "DONE") patch.completed_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("project_tasks").update(patch).eq("id", id).select("*").single();
    if (error || !data) return fail(res, "Failed to update task", error || "Unknown error", 500);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update task", 500);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("project_tasks").delete().eq("id", id);
    if (error) return fail(res, "Failed to delete task", error, 500);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete task", 500);
  }
}
