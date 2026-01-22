import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";

function linkTableFor(type) {
  switch (type) {
    case "service_request":
      return { table: "service_request_documents", fk: "request_id" };
    case "offer":
      return { table: "offer_documents", fk: "offer_id" };
    case "contract":
      return { table: "contract_documents", fk: "contract_id" };
    case "project":
      return { table: "project_documents", fk: "project_id" };
    default:
      return null;
  }
}

export async function createDocument(req, res) {
  try {
    const { file_name, storage_path, mime_type = null, file_size_bytes = null, meta = {} } = req.body || {};

    if (!file_name || !storage_path) {
      return fail(res, "Validation Error", "file_name and storage_path are required", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert([
        {
          file_name: String(file_name),
          storage_path: String(storage_path),
          mime_type: mime_type ? String(mime_type) : null,
          file_size_bytes: file_size_bytes !== null ? Number(file_size_bytes) : null,
          uploaded_by_user_id: req.user.id,
          meta,
        },
      ])
      .select("*")
      .single();

    if (error || !data) return fail(res, "Failed to create document", error || "Unknown error", 500);
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create document", 500);
  }
}

export async function attachDocument(req, res) {
  try {
    const { entity_type, entity_id, document_id } = req.body || {};
    if (!entity_type || !entity_id || !document_id) {
      return fail(res, "Validation Error", "entity_type, entity_id, document_id are required", 400);
    }

    const map = linkTableFor(String(entity_type));
    if (!map) return fail(res, "Validation Error", "Invalid entity_type", 400);

    const row = { [map.fk]: entity_id, document_id };

    const { data, error } = await supabaseAdmin.from(map.table).insert([row]).select("*").single();
    if (error || !data) return fail(res, "Failed to attach document", error || "Unknown error", 500);

    return ok(res, data, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to attach document", 500);
  }
}

export async function detachDocument(req, res) {
  try {
    const { entity_type, entity_id, document_id } = req.body || {};
    if (!entity_type || !entity_id || !document_id) {
      return fail(res, "Validation Error", "entity_type, entity_id, document_id are required", 400);
    }

    const map = linkTableFor(String(entity_type));
    if (!map) return fail(res, "Validation Error", "Invalid entity_type", 400);

    const { error } = await supabaseAdmin
      .from(map.table)
      .delete()
      .eq(map.fk, entity_id)
      .eq("document_id", document_id);

    if (error) return fail(res, "Failed to detach document", error, 500);
    return ok(res, { detached: true });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to detach document", 500);
  }
}

export async function listByEntity(req, res) {
  try {
    const { entity_type, entity_id } = req.query || {};
    if (!entity_type || !entity_id) return fail(res, "Validation Error", "entity_type and entity_id are required", 400);

    const map = linkTableFor(String(entity_type));
    if (!map) return fail(res, "Validation Error", "Invalid entity_type", 400);

    // 1) get link rows
    const { data: links, error: lErr } = await supabaseAdmin
      .from(map.table)
      .select("document_id,created_at")
      .eq(map.fk, String(entity_id))
      .order("created_at", { ascending: false });

    if (lErr) return fail(res, "Failed to fetch links", lErr, 500);

    const ids = (links || []).map((x) => x.document_id);
    if (!ids.length) return ok(res, []);

    // 2) fetch docs
    const { data: docs, error: dErr } = await supabaseAdmin.from("documents").select("*").in("id", ids);
    if (dErr) return fail(res, "Failed to fetch documents", dErr, 500);

    // keep order according to links
    const byId = new Map((docs || []).map((d) => [d.id, d]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    return ok(res, ordered);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list documents", 500);
  }
}
