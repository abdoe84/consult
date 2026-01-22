import { supabaseAdmin } from "../../config/supabase.js";
import { ok, fail } from "../../utils/response.js";

export async function list(req, res) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_partners")
      .select("id, project_id, party_type, name, created_by, updated_by, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return fail(res, "Failed to fetch partners", error, 500);
    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list partners", 500);
  }
}

export async function create(req, res) {
  try {
    const { projectId } = req.params;
    const { partner_type, name } = req.body || {};

    if (!partner_type || !name) return fail(res, "Validation Error", "partner_type and name are required", 400);

    const payload = {
      project_id: projectId,
      party_type: String(partner_type).toUpperCase(),
      name: String(name).trim(),
      created_by: req.user?.id || null,
      updated_by: req.user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("project_partners")
      .insert([payload])
      .select("id, project_id, party_type, name, created_by, updated_by, created_at, updated_at")
      .single();

    if (error || !data) return fail(res, "Failed to create partner", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create partner", 500);
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("project_partners")
      .select("id, project_id, party_type, name, created_by, updated_by, created_at, updated_at")
      .eq("id", id)
      .single();
    if (error || !data) return fail(res, "Not Found", "Partner not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch partner", 500);
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;
    const patch = { ...req.body, updated_at: new Date().toISOString(), updated_by: req.user?.id || null };

    // Only allow specific fields
    const allowedFields = ['party_type', 'name', 'updated_at', 'updated_by'];
    const filteredPatch = {};
    for (const key of allowedFields) {
      if (patch[key] !== undefined) {
        filteredPatch[key] = typeof patch[key] === 'string' && key !== 'updated_at' ? patch[key].trim() : patch[key];
        if (key === 'party_type') filteredPatch[key] = filteredPatch[key].toUpperCase();
      }
    }

    const { data, error } = await supabaseAdmin
      .from("project_partners")
      .update(filteredPatch)
      .eq("id", id)
      .select("id, project_id, party_type, name, created_by, updated_by, created_at, updated_at")
      .single();
    if (error || !data) return fail(res, "Failed to update partner", error || "Unknown error", 500);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update partner", 500);
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("project_partners").delete().eq("id", id);
    if (error) return fail(res, "Failed to delete partner", error, 500);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete partner", 500);
  }
}
