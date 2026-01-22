import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { OFFER_STATUS, SERVICE_REQUEST_STATUS, canTransition, ROLES } from "../config/constants.js";
import { randomToken, sha256Hex } from "../utils/ids.js";
import { logActivity } from "../utils/activity.js";

function isEditableOfferStatus(status) {
  return status === OFFER_STATUS.DRAFT || status === OFFER_STATUS.MANAGER_REJECTED;
}

export async function getOfferByRequest(req, res) {
  try {
    const { requestId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (error) return fail(res, "Failed to fetch offer", error, 500);
    return ok(res, data || null);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch offer", 500);
  }
}

export async function saveOfferDraftByRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { technical_offer = {}, financial_offer = {} } = req.body || {};

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("id,status,assigned_consultant_id")
      .eq("id", requestId)
      .single();

    if (srErr || !sr) return fail(res, "Not Found", "Service request not found", 404);

    if (sr.status !== SERVICE_REQUEST_STATUS.CONSULTANT_ACCEPTED) {
      return fail(res, "Invalid status", { request_status: sr.status, required: SERVICE_REQUEST_STATUS.CONSULTANT_ACCEPTED }, 409);
    }

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (exErr) return fail(res, "Failed to load offer", exErr, 500);

    if (existing && !isEditableOfferStatus(existing.status)) {
      return fail(res, "Offer not editable", { status: existing.status }, 409);
    }

    if (!existing) {
      const { data: created, error } = await supabaseAdmin
        .from("offers")
        .insert([
          {
            request_id: requestId,
            prepared_by_user_id: req.user.id,
            status: OFFER_STATUS.DRAFT,
            technical_offer,
            financial_offer,
          },
        ])
        .select("*")
        .single();

      if (error || !created) return fail(res, "Failed to create offer", error || "Unknown error", 500);

      await logActivity({
        actor_user_id: req.user.id,
        actor_role: req.user.role,
        entity_type: "offer",
        entity_id: created.id,
        action: "OFFER_CREATED",
        message: "Offer draft created",
        data: { request_id: requestId },
        ip: req.ip,
      });

      return ok(res, created, 201);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("offers")
      .update({
        technical_offer,
        financial_offer,
        prepared_by_user_id: existing.prepared_by_user_id || req.user.id,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !updated) return fail(res, "Failed to update offer", error || "Unknown error", 500);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "offer",
      entity_id: updated.id,
      action: "OFFER_UPDATED",
      message: "Offer draft updated",
      data: { request_id: requestId },
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to save offer", 500);
  }
}

export async function submitOffer(req, res) {
  try {
    const { id } = req.params;

    const { data: offer, error: offErr } = await supabaseAdmin.from("offers").select("*").eq("id", id).single();
    if (offErr || !offer) return fail(res, "Not Found", "Offer not found", 404);

    if (!canTransition("offer", offer.status, OFFER_STATUS.SUBMITTED_TO_MANAGER)) {
      return fail(res, "Invalid transition", { from: offer.status, to: OFFER_STATUS.SUBMITTED_TO_MANAGER }, 409);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("offers")
      .update({
        status: OFFER_STATUS.SUBMITTED_TO_MANAGER,
        submitted_to_manager_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) return fail(res, "Failed to submit offer", error || "Unknown error", 500);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "offer",
      entity_id: updated.id,
      action: "OFFER_SUBMITTED",
      message: "Offer submitted to manager",
      data: {},
      ip: req.ip,
    });

    return ok(res, updated);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to submit offer", 500);
  }
}

export async function managerDecision(req, res) {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body || {};

    if (![ROLES.MANAGER, ROLES.ADMIN].includes(req.user.role)) {
      return fail(res, "Forbidden", { required: [ROLES.MANAGER, ROLES.ADMIN] }, 403);
    }

    const d = String(decision || "").toLowerCase();
    if (!["approve", "reject"].includes(d)) {
      return fail(res, "Validation Error", "decision must be 'approve' or 'reject'", 400);
    }

    const { data: offer, error: offErr } = await supabaseAdmin.from("offers").select("*").eq("id", id).single();
    if (offErr || !offer) return fail(res, "Not Found", "Offer not found", 404);

    if (offer.status !== OFFER_STATUS.SUBMITTED_TO_MANAGER) {
      return fail(res, "Invalid status", { current: offer.status, expected: OFFER_STATUS.SUBMITTED_TO_MANAGER }, 409);
    }

    const nextStatus = d === "approve" ? OFFER_STATUS.MANAGER_APPROVED : OFFER_STATUS.MANAGER_REJECTED;

    if (!canTransition("offer", offer.status, nextStatus)) {
      return fail(res, "Invalid transition", { from: offer.status, to: nextStatus }, 409);
    }

    const updatePayload = {
      status: nextStatus,
      manager_decided_at: new Date().toISOString(),
      manager_decided_by_user_id: req.user.id,
      manager_comment: null,
    };

    if (nextStatus === OFFER_STATUS.MANAGER_REJECTED) {
      const c = String(comment || "").trim();
      if (!c) return fail(res, "Validation Error", "comment is required when rejecting", 400);
      updatePayload.manager_comment = c;
    }

    // If approved, generate token (store hash only), return token once
    let portalToken = null;
    let portalLink = null;

    if (nextStatus === OFFER_STATUS.MANAGER_APPROVED) {
      portalToken = randomToken(32);
      const tokenHash = sha256Hex(portalToken);
      const days = Number(process.env.CLIENT_PORTAL_EXPIRES_DAYS || 30);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      updatePayload.client_portal_token_hash = tokenHash;
      updatePayload.client_portal_created_at = new Date().toISOString();
      updatePayload.client_portal_expires_at = expiresAt;

      const base = process.env.CLIENT_PORTAL_BASE_URL || "http://localhost:3000";
      portalLink = `${base.replace(/\/+$/, "")}/offer/${offer.id}?token=${portalToken}`;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("offers")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) return fail(res, "Failed to update offer decision", error || "Unknown error", 500);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "offer",
      entity_id: updated.id,
      action: nextStatus === OFFER_STATUS.MANAGER_APPROVED ? "OFFER_APPROVED" : "OFFER_REJECTED",
      message: nextStatus === OFFER_STATUS.MANAGER_APPROVED ? "Offer approved" : "Offer rejected",
      data: { comment: updatePayload.manager_comment || null },
      ip: req.ip,
    });

    return ok(res, {
      offer: updated,
      client_portal: portalToken ? { token: portalToken, link: portalLink, expires_at: updated.client_portal_expires_at } : null,
    });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed manager decision", 500);
  }
}
