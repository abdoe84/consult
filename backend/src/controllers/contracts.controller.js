import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { CONTRACT_STATUS, canTransition } from "../config/constants.js";
import { logActivity } from "../utils/activity.js";

export async function upsertContractByRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { notes = null, offer_id = null } = req.body || {};

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("id")
      .eq("id", requestId)
      .single();

    if (srErr || !sr) return fail(res, "Not Found", "Service request not found", 404);

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (exErr) return fail(res, "Failed to load contract", exErr, 500);

    if (!existing) {
      const { data: created, error } = await supabaseAdmin
        .from("contracts")
        .insert([
          {
            request_id: requestId,
            offer_id: offer_id || null,
            status: CONTRACT_STATUS.CONTRACT_DRAFT,
            notes: notes ? String(notes) : null,
          },
        ])
        .select("*")
        .single();

      if (error || !created) return fail(res, "Failed to create contract", error || "Unknown error", 500);

      await logActivity({
        actor_user_id: req.user.id,
        actor_role: req.user.role,
        entity_type: "contract",
        entity_id: created.id,
        action: "CONTRACT_CREATED",
        message: "Contract draft created",
        data: { request_id: requestId },
        ip: req.ip,
      });

      return ok(res, created, 201);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("contracts")
      .update({
        notes: notes ? String(notes) : existing.notes,
        offer_id: offer_id || existing.offer_id,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !updated) return fail(res, "Failed to update contract", error || "Unknown error", 500);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "contract",
      entity_id: updated.id,
      action: "CONTRACT_UPDATED",
      message: "Contract updated",
      data: {},
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed contract upsert", 500);
  }
}

export async function updateContractStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status) return fail(res, "Validation Error", "status is required", 400);

    const { data: contract, error: cErr } = await supabaseAdmin.from("contracts").select("*").eq("id", id).single();
    if (cErr || !contract) return fail(res, "Not Found", "Contract not found", 404);

    const to = String(status);
    if (!canTransition("contract", contract.status, to)) {
      return fail(res, "Invalid transition", { from: contract.status, to }, 409);
    }

    const updatePayload = { status: to };

    if (to === CONTRACT_STATUS.CONTRACT_UPLOADED) {
      updatePayload.uploaded_at = new Date().toISOString();
      updatePayload.uploaded_by_user_id = req.user.id;
    }
    if (to === CONTRACT_STATUS.CONTRACT_SIGNED) {
      updatePayload.signed_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabaseAdmin
      .from("contracts")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) return fail(res, "Failed to update contract status", error || "Unknown error", 500);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "contract",
      entity_id: updated.id,
      action: "CONTRACT_STATUS_CHANGED",
      message: `Contract status -> ${to}`,
      data: { from: contract.status, to },
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to update contract status", 500);
  }
}
