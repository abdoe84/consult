import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { sha256Hex } from "../utils/ids.js";

export async function getOfferPublic(req, res) {
  try {
    const { id } = req.params;
    const token = String(req.query.token || "").trim();
    if (!token) return fail(res, "Unauthorized", "token query param is required", 401);

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select("id,request_id,status,technical_offer,financial_offer,client_portal_token_hash,client_portal_expires_at")
      .eq("id", id)
      .single();

    if (error || !offer) return fail(res, "Not Found", "Offer not found", 404);
    if (!offer.client_portal_token_hash) return fail(res, "Unauthorized", "Client portal not enabled for this offer", 401);

    if (offer.client_portal_expires_at && new Date(offer.client_portal_expires_at).getTime() < Date.now()) {
      return fail(res, "Unauthorized", "Token expired", 401);
    }

    const hash = sha256Hex(token);
    if (hash !== offer.client_portal_token_hash) return fail(res, "Unauthorized", "Invalid token", 401);

    // read-only payload
    return ok(res, {
      id: offer.id,
      request_id: offer.request_id,
      status: offer.status,
      technical_offer: offer.technical_offer,
      financial_offer: offer.financial_offer,
    });
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to load public offer", 500);
  }
}
