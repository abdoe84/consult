import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { generateRef } from "../utils/ids.js";
import { SERVICE_REQUEST_STATUS, canTransition } from "../config/constants.js";
import { logActivity } from "../utils/activity.js";

async function insertWithUniqueRef(payload, maxAttempts = 8) {
  let lastError = null;

  for (let i = 0; i < maxAttempts; i++) {
    const reference_no = generateRef("SR");
    const { data, error } = await supabaseAdmin
      .from("service_requests")
      .insert([{ ...payload, reference_no }])
      .select("*")
      .single();

    if (!error) return data;
    lastError = error;
    // retry on unique violation
    if (String(error?.code) !== "23505") break;
  }

  throw new Error(lastError?.message || "Failed to create service request");
}

export async function createServiceRequest(req, res) {
  try {
    const {
      title,
      description = null,
      service_type = null,
      priority = "NORMAL",
      requester_name = null,
      requester_email = null,
      assigned_consultant_id = null,
    } = req.body || {};

    if (!title) return fail(res, "Validation Error", "title is required", 400);

    const payload = {
      title: String(title),
      description: description ? String(description) : null,
      service_type: service_type ? String(service_type) : null,
      priority: String(priority || "NORMAL").toUpperCase(),
      requester_name: requester_name ? String(requester_name) : null,
      requester_email: requester_email ? String(requester_email).toLowerCase() : null,
      requested_by_user_id: req.user.id,
      assigned_consultant_id: assigned_consultant_id || null,
      status: SERVICE_REQUEST_STATUS.PENDING_REVIEW,
    };

    const created = await insertWithUniqueRef(payload);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "service_request",
      entity_id: created.id,
      action: "SR_CREATED",
      message: "Service request created",
      data: { reference_no: created.reference_no },
      ip: req.ip,
    });

    return ok(res, created, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create service request", 500);
  }
}

export async function listServiceRequests(req, res) {
  try {
    const { status, q, service_type, assigned } = req.query || {};

    let query = supabaseAdmin.from("service_requests").select("*").order("created_at", { ascending: false });

    if (status) query = query.eq("status", String(status));
    if (service_type) query = query.eq("service_type", String(service_type));

    if (q) {
      const term = String(q).trim();
      if (term) {
        query = query.or(
          `reference_no.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`
        );
      }
    }

    if (assigned) {
      const val = String(assigned);
      if (val === "me") query = query.eq("assigned_consultant_id", req.user.id);
      else if (val === "unassigned") query = query.is("assigned_consultant_id", null);
      else query = query.eq("assigned_consultant_id", val);
    }

    const { data, error } = await query;
    if (error) return fail(res, "Failed to fetch service requests", error, 500);

    return ok(res, data || []);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to list service requests", 500);
  }
}

export async function getServiceRequestById(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return fail(res, "Not Found", "Service request not found", 404);
    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch service request", 500);
  }
}

export async function getServiceRequestAttachments(req, res) {
  try {
    const { id } = req.params;

    // Verify service request exists
    const { data: request, error: reqError } = await supabaseAdmin
      .from("service_requests")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (reqError || !request) {
      return fail(res, "Not Found", "Service request not found", 404);
    }

    // Get linked documents
    const { data: links, error: linkError } = await supabaseAdmin
      .from("service_request_documents")
      .select("document_id, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    if (linkError) {
      return fail(res, "Database Error", linkError.message, 500);
    }

    if (!links || links.length === 0) {
      return ok(res, []);
    }

    // Get document details
    const documentIds = links.map((link) => link.document_id);
    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .in("id", documentIds);

    if (docError) {
      return fail(res, "Database Error", docError.message, 500);
    }

    // Build signed URLs for each document
    const attachments = await Promise.all(
      (documents || []).map(async (doc) => {
        let url = null;
        if (doc.storage_path) {
          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(doc.storage_path, 60 * 60 * 24); // 24 hours

          if (!signError && signed) {
            url = signed.signedUrl;
          }
        }

        return {
          id: doc.id,
          file_name: doc.file_name,
          mime_type: doc.mime_type,
          file_size_bytes: doc.file_size_bytes,
          uploaded_at: doc.uploaded_at,
          url,
        };
      })
    );

    return ok(res, attachments);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch attachments", 500);
  }
}

export async function reviewServiceRequest(req, res) {
  try {
    const { id } = req.params;
    const { decision, reject_reason, reason } = req.body || {}; // Support both reject_reason and reason for backward compatibility

    // Log incoming request for debugging
    console.log("[SERVICE_REQUESTS] Review request:", {
      id,
      decision,
      reject_reason,
      reason,
      body: req.body,
    });

    const d = String(decision || "").toLowerCase();
    if (!["accept", "reject"].includes(d)) {
      return fail(res, "Validation Error", "decision must be 'accept' or 'reject'", 400);
    }

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (srErr || !sr) return fail(res, "Not Found", "Service request not found", 404);

    if (sr.status !== SERVICE_REQUEST_STATUS.PENDING_REVIEW) {
      return fail(res, "Invalid status", { current: sr.status, expected: SERVICE_REQUEST_STATUS.PENDING_REVIEW }, 409);
    }

    const nextStatus =
      d === "accept" ? SERVICE_REQUEST_STATUS.CONSULTANT_ACCEPTED : SERVICE_REQUEST_STATUS.CONSULTANT_REJECTED;

    if (!canTransition("serviceRequest", sr.status, nextStatus)) {
      return fail(res, "Invalid transition", { from: sr.status, to: nextStatus }, 409);
    }

    const updatePayload = {
      status: nextStatus,
      consultant_reviewed_at: new Date().toISOString(),
      assigned_consultant_id: sr.assigned_consultant_id || req.user.id,
      reject_reason: null,
    };

    if (nextStatus === SERVICE_REQUEST_STATUS.CONSULTANT_REJECTED) {
      // Support both reject_reason and reason (for backward compatibility)
      const finalReason = String(reject_reason || reason || "").trim();
      if (!finalReason) {
        console.error("[SERVICE_REQUESTS] Reject reason missing:", { reject_reason, reason, body: req.body });
        return fail(res, "Validation Error", "reject_reason is required when rejecting", 400);
      }
      updatePayload.reject_reason = finalReason;
      console.log("[SERVICE_REQUESTS] Setting reject_reason:", finalReason);
    }

    console.log("[SERVICE_REQUESTS] Updating with payload:", updatePayload);

    const { data: updated, error } = await supabaseAdmin
      .from("service_requests")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[SERVICE_REQUESTS] Database update error:", error);
      return fail(res, "Failed to update", error.message || "Unknown error", 500);
    }

    if (!updated) {
      console.error("[SERVICE_REQUESTS] No data returned from update");
      return fail(res, "Failed to update", "No data returned", 500);
    }

    console.log("[SERVICE_REQUESTS] Update successful:", updated.id);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "service_request",
      entity_id: updated.id,
      action: d === "accept" ? "SR_ACCEPTED" : "SR_REJECTED",
      message: d === "accept" ? "Service request accepted" : "Service request rejected",
      data: { reject_reason: updatePayload.reject_reason || null },
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to review service request", 500);
  }
}

export async function updateServiceRequest(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only ADMIN or MANAGER can update requests
    const roleUpper = String(userRole || "").toUpperCase();
    if (roleUpper !== "ADMIN" && roleUpper !== "MANAGER") {
      return fail(res, "Forbidden", "Only Admin or Manager can update service requests", 403);
    }

    // Check if request exists
    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (srErr || !sr) {
      return fail(res, "Not Found", "Service request not found", 404);
    }

    // Extract updatable fields from request body
    const {
      title,
      description,
      service_type,
      priority,
      requester_name,
      requester_email,
      requester_phone,
      assigned_consultant_id,
    } = req.body || {};

    // Build update payload (only include fields that are provided)
    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updatePayload.title = String(title);
    if (description !== undefined) updatePayload.description = description ? String(description) : null;
    if (service_type !== undefined) updatePayload.service_type = service_type ? String(service_type) : null;
    if (priority !== undefined) updatePayload.priority = String(priority || "NORMAL").toUpperCase();
    if (requester_name !== undefined) updatePayload.requester_name = requester_name ? String(requester_name) : null;
    if (requester_email !== undefined) updatePayload.requester_email = requester_email ? String(requester_email).toLowerCase() : null;
    if (requester_phone !== undefined) updatePayload.requester_phone = requester_phone ? String(requester_phone) : null;
    if (assigned_consultant_id !== undefined) updatePayload.assigned_consultant_id = assigned_consultant_id || null;

    // Validate priority if provided
    if (priority !== undefined) {
      const validPriorities = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"];
      const priorityUpper = String(priority || "").toUpperCase();
      if (!validPriorities.includes(priorityUpper)) {
        return fail(res, "Validation Error", `Invalid priority. Must be one of: ${validPriorities.join(", ")}`, 400);
      }
    }

    // Validate title if provided
    if (title !== undefined && (!title || String(title).trim() === "")) {
      return fail(res, "Validation Error", "title cannot be empty", 400);
    }

    // Update the service request
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("service_requests")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[SERVICE_REQUESTS] Update error:", updateErr);
      return fail(res, "Database Error", updateErr.message || "Failed to update service request", 500);
    }

    if (!updated) {
      return fail(res, "Failed to update", "No data returned", 500);
    }

    // Log the update
    await logActivity({
      actor_user_id: userId,
      actor_role: userRole,
      entity_type: "service_request",
      entity_id: updated.id,
      action: "SR_UPDATED",
      message: "Service request updated",
      data: {
        reference_no: updated.reference_no,
        updated_fields: Object.keys(updatePayload).filter(k => k !== "updated_at")
      },
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    console.error("[SERVICE_REQUESTS] Update error:", err);
    return fail(res, "Server Error", err?.message || "Failed to update service request", 500);
  }
}

export async function deleteServiceRequest(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only ADMIN or MANAGER can delete requests
    const roleUpper = String(userRole || "").toUpperCase();
    if (roleUpper !== "ADMIN" && roleUpper !== "MANAGER") {
      return fail(res, "Forbidden", "Only Admin or Manager can delete service requests", 403);
    }

    // Check if request exists
    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (srErr || !sr) {
      return fail(res, "Not Found", "Service request not found", 404);
    }

    // Check if there are related offers
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from("offers")
      .select("id")
      .eq("request_id", id)
      .limit(1);

    if (offersErr) {
      return fail(res, "Database Error", "Failed to check related offers", 500);
    }

    if (offers && offers.length > 0) {
      return fail(
        res,
        "Cannot Delete",
        "Cannot delete service request: There are offers associated with this request. Please delete the offers first.",
        409
      );
    }

    // Check if there are related projects
    const { data: projects, error: projectsErr } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("request_id", id)
      .limit(1);

    if (projectsErr) {
      return fail(res, "Database Error", "Failed to check related projects", 500);
    }

    if (projects && projects.length > 0) {
      return fail(
        res,
        "Cannot Delete",
        "Cannot delete service request: There are projects associated with this request. Please delete the projects first.",
        409
      );
    }

    // Delete the service request
    const { error: deleteErr } = await supabaseAdmin
      .from("service_requests")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return fail(res, "Database Error", deleteErr.message || "Failed to delete service request", 500);
    }

    // Log the deletion
    await logActivity({
      actor_user_id: userId,
      actor_role: userRole,
      entity_type: "service_request",
      entity_id: id,
      action: "SR_DELETED",
      message: "Service request deleted",
      data: { reference_no: sr.reference_no },
      ip: req.ip,
    });

    return ok(res, { id, deleted: true, message: "Service request deleted successfully" });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to delete service request", 500);
  }
}
