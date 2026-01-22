// backend/src/routes/offers.routes.js
import express from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES, OFFER_STATUS } from "../config/constants.js";

const router = express.Router();

// ===============================
// Helper Function: Ensure Project for Request
// ===============================
async function ensureProjectForRequest({ requestId, offerId, userId = null }) {
  // 1) already exists?
  const { data: existing } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (existing) return existing;

  // 2) build title from request
  const { data: reqRow } = await supabaseAdmin
    .from("service_requests")
    .select("reference_no, title")
    .eq("id", requestId)
    .maybeSingle();

  const title = reqRow?.title
    ? `Project • ${reqRow.title}`
    : `Project • ${reqRow?.reference_no || requestId}`;

  // 3) insert
  const payload = {
    request_id: requestId,
    offer_id: offerId,
    title,
    status: "DRAFT",
    created_by: userId,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // race condition unique
    if (String(error.message || "").includes("duplicate") || String(error.code || "") === "23505") {
      const { data: again } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("request_id", requestId)
        .maybeSingle();
      return again || null;
    }
    throw new Error(error.message);
  }

  return inserted;
}

// ===============================
// Helper Functions for Client Portal
// ===============================
function makePortalToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function sha256(x) {
  return crypto.createHash("sha256").update(String(x)).digest("hex");
}

function buildClientPortalLink(token) {
  const base =
    process.env.CLIENT_PORTAL_BASE_URL ||
    "http://127.0.0.1:5500/frontend/public/client-portal.html";

  return `${base}?token=${encodeURIComponent(token)}`;
}

function parseJson(x) {
  if (!x) return {};
  if (typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      return JSON.parse(x);
    } catch {
      return {};
    }
  }
  return {};
}

function nowIso() {
  return new Date().toISOString();
}

async function getOfferByToken(token) {
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(
      "id, request_id, status, technical_data, technical_offer, financial_offer, financial_data, updated_at, client_portal_token, client_portal_expires_at, client_decision_at, client_decision_comment, client_contact_name, payment_terms, contact_info, notes"
    )
    .eq("client_portal_token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function getRequestById(id) {
  const { data, error } = await supabaseAdmin
    .from("service_requests")
    .select("id, reference_no, title, service_type, status, created_at, updated_at, assigned_consultant_id, requester_name, requester_email, requester_phone")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

// Helper: Get user info for contact
async function getUserInfo(userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function updateRequestStatus(requestId, status) {
  const { error } = await supabaseAdmin
    .from("service_requests")
    .update({ status, updated_at: nowIso() })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
}

async function getOrCreateProject({ requestId, offerId }) {
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);
  if (existing) return existing;

  const payload = {
    request_id: requestId,
    offer_id: offerId,
    status: "ACTIVE",
    created_by: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { data: created, error: crErr } = await supabaseAdmin
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (crErr) throw new Error(crErr.message);
  return created;
}

// ===============================
// Client Portal routes (MUST be before any /:id routes)
// ===============================

// ===============================
// GET Client Portal - Public access via token
// GET /api/offers/portal?token=...
// ===============================
router.get("/portal", async (req, res) => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) return fail(res, "token is required", null, 400);

    const offer = await getOfferByToken(token);
    if (!offer) return fail(res, "invalid token", null, 404);

    const st = String(offer.status || "").toUpperCase();
    if (!["MANAGER_APPROVED", "CLIENT_APPROVED", "CLIENT_REJECTED"].includes(st)) {
      return fail(res, "portal not available for this offer status", st, 403);
    }

    const requestRow = await getRequestById(offer.request_id);

    // Normalize technical and financial data
    const technical_data = parseJson(offer.technical_data || offer.technical_offer);
    const financial_data = parseJson(offer.financial_offer || offer.financial_data);

    // Parse payment_terms if exists, otherwise use default
    let payment_terms = parseJson(offer.payment_terms);
    if (!payment_terms || Object.keys(payment_terms).length === 0) {
      // Default payment terms
      payment_terms = {
        milestones: [
          { name: "Advance", percent: 30, status: "pending", description: "Upon Contract Signing" },
          { name: "Progress", percent: 40, status: "pending", description: "At Milestone 2" },
          { name: "Final", percent: 30, status: "pending", description: "Upon Delivery" }
        ],
        methods: ["bank_transfer", "check"],
        bank_details: {
          bank_name: "REVIVA Bank",
          account_number: "To be provided upon contract signing",
          iban: "To be provided",
          swift: "To be provided"
        }
      };
    }

    // Build contact_info
    let contact_info = parseJson(offer.contact_info);
    if (!contact_info || Object.keys(contact_info).length === 0) {
      // Get account manager from assigned consultant
      let accountManager = null;
      if (requestRow?.assigned_consultant_id) {
        accountManager = await getUserInfo(requestRow.assigned_consultant_id);
      }

      // Default contact info
      contact_info = {
        account_manager: accountManager ? {
          name: accountManager.full_name || "Account Manager",
          email: accountManager.email || "contact@reviva.sa",
          phone: accountManager.phone || "+966XXXXXXXXX"
        } : {
          name: "Ayman Alobaid",
          email: "alobaid.a@reviva.sa",
          phone: "+966XXXXXXXXX"
        },
        company: {
          address: "Jeddah, Saudi Arabia",
          phone: "+966XXXXXXXXX",
          hours: "Sun-Thu 9AM-6PM"
        }
      };
    }

    return ok(res, {
      ...offer,
      technical_data,
      financial_data,
      payment_terms,
      contact_info,
      request: requestRow || null,
    });
  } catch (e) {
    return fail(res, "server error", String(e?.message || e), 500);
  }
});

// ===============================
// POST Client Portal Decision - Public access via token
// POST /api/offers/portal/decision
// body: { token, decision: "APPROVE"|"REJECT", comment?, name? }
//
// Behavior:
// - approve -> offer CLIENT_APPROVED -> request CLIENT_APPROVED -> create project -> request PROJECT_CREATED
// - reject  -> offer CLIENT_REJECTED  -> request CLIENT_REJECTED
// ===============================
router.post("/portal/decision", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const decision = String(req.body?.decision || "").trim().toUpperCase();
    const comment = String(req.body?.comment || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!token) return fail(res, "token is required", null, 400);
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return fail(res, "invalid decision", null, 400);
    }

    const offer = await getOfferByToken(token);
    if (!offer) return fail(res, "invalid token", null, 404);

    const st = String(offer.status || "").toUpperCase();
    if (!["MANAGER_APPROVED", "CLIENT_APPROVED", "CLIENT_REJECTED"].includes(st)) {
      return fail(res, "decision not allowed in this status", st, 403);
    }

    // Idempotent already decided
    if (st === "CLIENT_APPROVED") {
      const project = await ensureProjectForRequest({
        requestId: offer.request_id,
        offerId: offer.id,
        userId: null,
      });
      await updateRequestStatus(offer.request_id, "PROJECT_CREATED");
      return ok(res, { ...offer, project });
    }
    if (st === "CLIENT_REJECTED") {
      await updateRequestStatus(offer.request_id, "CLIENT_REJECTED");
      return ok(res, { ...offer, project: null });
    }

    const newOfferStatus = decision === "APPROVE" ? "CLIENT_APPROVED" : "CLIENT_REJECTED";

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: newOfferStatus,
        client_decision_at: nowIso(),
        client_decision_comment: comment || null,
        client_contact_name: name || null,
        updated_at: nowIso(),
      })
      .eq("id", offer.id)
      .select("*")
      .single();

    if (upErr) return fail(res, "db error", upErr.message, 500);

    if (decision === "APPROVE") {
      // بعد تحديث offer => CLIENT_APPROVED
      const project = await ensureProjectForRequest({
        requestId: updated.request_id,
        offerId: updated.id,
        userId: null, // client
      });

      // (اختياري) تحديث حالة الطلب
      await supabaseAdmin
        .from("service_requests")
        .update({ status: "CLIENT_APPROVED", updated_at: new Date().toISOString() })
        .eq("id", updated.request_id);

      return ok(res, { offer: updated, project });
    }

    // Rejected
    await updateRequestStatus(updated.request_id, "CLIENT_REJECTED");
    return ok(res, { offer: updated, project: null });
  } catch (e) {
    return fail(res, "server error", String(e?.message || e), 500);
  }
});

// ===============================
// GET latest offer by request
// GET /api/offers/by-request/:requestId
// ===============================
router.get("/by-request/:requestId", requireAuth, async (req, res) => {
  try {
    const requestId = req.params.requestId;

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return fail(res, "DB Error", 500, error.message);

    const row = data?.[0] || null;
    return ok(res, row);
  } catch (e) {
    return fail(res, "Server Error", 500, e?.message || String(e));
  }
});

// ===============================
// Save draft (upsert latest) - Consultant only
// POST /api/offers/by-request/:requestId
// body: { technical_data, financial_offer, notes? }
// ===============================
router.post(
  "/by-request/:requestId",
  requireAuth,
  requireRole([ROLES.CONSULTANT]),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const userId = req.user.id;

      // Validate requestId
      if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
        console.error("[OFFERS] Invalid requestId:", requestId);
        return fail(res, "Invalid request ID", "requestId is required and must be a non-empty string", 400);
      }

      // Accept both technical_data and technical_offer for backward compatibility
      const technical_data = req.body?.technical_data ?? req.body?.technical_offer ?? null;
      const financial_offer = req.body?.financial_offer ?? req.body?.financial_data ?? null;
      const notes = req.body?.notes ?? null;
      const payment_terms = req.body?.payment_terms ?? null;
      const contact_info = req.body?.contact_info ?? null;

      // Log request for debugging
      console.log("[OFFERS] Save draft request:", {
        requestId,
        userId,
        hasTechnicalData: !!technical_data,
        hasFinancialOffer: !!financial_offer,
        technicalDataType: typeof technical_data,
        financialOfferType: typeof financial_offer,
      });

      const { data: existing, error: e1 } = await supabaseAdmin
        .from("offers")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (e1) return fail(res, "DB Error", 500, e1.message);

      const current = existing?.[0] || null;

      if (!current) {
        const payload = {
          request_id: requestId,
          status: OFFER_STATUS.DRAFT,
          technical_data: technical_data || null,
          financial_offer: financial_offer || null,
          notes: notes || null,
          payment_terms: payment_terms || null,
          contact_info: contact_info || null,
          created_by: userId,
          updated_by: userId,
        };

        console.log("[OFFERS] Creating new offer with payload:", {
          request_id: payload.request_id,
          status: payload.status,
          hasTechnicalData: !!payload.technical_data,
          hasFinancialOffer: !!payload.financial_offer,
        });

        const { data: inserted, error: e2 } = await supabaseAdmin
          .from("offers")
          .insert(payload)
          .select("*")
          .single();

        if (e2) {
          console.error("[OFFERS] Database insert error:", e2);
          return fail(res, "DB Error", 500, e2.message);
        }
        console.log("[OFFERS] Offer created successfully:", inserted?.id);
        return ok(res, inserted, 201);
      }

      const currentStatusUpper = String(current.status).toUpperCase();
      // Allow editing if status is DRAFT or MANAGER_REJECTED (can be resubmitted after rejection)
      const isEditable = currentStatusUpper === OFFER_STATUS.DRAFT || currentStatusUpper === OFFER_STATUS.MANAGER_REJECTED;

      if (!isEditable) {
        console.log("[OFFERS] Cannot edit offer - current status:", currentStatusUpper, "allowed:", [OFFER_STATUS.DRAFT, OFFER_STATUS.MANAGER_REJECTED]);
        return fail(
          res,
          "Invalid state",
          409,
          `Cannot save draft because offer status is "${current.status}". Only DRAFT or MANAGER_REJECTED offers can be edited. Current status: ${current.status}`
        );
      }

      // If status is MANAGER_REJECTED, reset it to DRAFT when saving
      const newStatus = currentStatusUpper === OFFER_STATUS.MANAGER_REJECTED ? OFFER_STATUS.DRAFT : current.status;

      const updatePayload = {
        technical_data: technical_data !== undefined ? technical_data : current.technical_data,
        financial_offer: financial_offer !== undefined ? financial_offer : current.financial_offer,
        notes: notes !== undefined ? notes : current.notes,
        payment_terms: payment_terms !== undefined ? payment_terms : current.payment_terms,
        contact_info: contact_info !== undefined ? contact_info : current.contact_info,
        status: newStatus, // Reset to DRAFT if it was MANAGER_REJECTED
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      console.log("[OFFERS] Updating existing offer:", {
        offerId: current.id,
        currentStatus: current.status,
        hasTechnicalData: !!updatePayload.technical_data,
        hasFinancialOffer: !!updatePayload.financial_offer,
      });

      const { data: updated, error: e3 } = await supabaseAdmin
        .from("offers")
        .update(updatePayload)
        .eq("id", current.id)
        .select("*")
        .single();

      if (e3) {
        console.error("[OFFERS] Database update error:", e3);
        return fail(res, "DB Error", 500, e3.message);
      }
      console.log("[OFFERS] Offer updated successfully:", updated?.id);
      return ok(res, updated);
    } catch (e) {
      console.error("[OFFERS] Unexpected error in save draft:", e);
      return fail(res, "Server Error", 500, e?.message || String(e));
    }
  }
);

// ===============================
// Submit offer to manager - Consultant only
// POST /api/offers/:id/submit
// ===============================
router.post(
  "/:id/submit",
  requireAuth,
  requireRole([ROLES.CONSULTANT]),
  async (req, res) => {
    try {
      const id = req.params.id;
      const userId = req.user.id;

      const { data: offer, error: e1 } = await supabaseAdmin
        .from("offers")
        .select("*")
        .eq("id", id)
        .single();

      if (e1) return fail(res, "DB Error", 500, e1.message);
      if (!offer) return fail(res, "Not Found", 404, "Offer not found");

      if (String(offer.status).toUpperCase() !== OFFER_STATUS.DRAFT) {
        return fail(res, "Invalid state", 409, "Offer must be DRAFT to submit");
      }

      const now = new Date().toISOString();

      const { data: updated, error: e2 } = await supabaseAdmin
        .from("offers")
        .update({
          status: OFFER_STATUS.SUBMITTED_TO_MANAGER,
          submitted_at: now,
          updated_by: userId,
          updated_at: now,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (e2) return fail(res, "DB Error", 500, e2.message);
      return ok(res, updated);
    } catch (e) {
      return fail(res, "Server Error", 500, e?.message || String(e));
    }
  }
);

// ===============================
// GET Offer by ID (for review page)
// GET /api/offers/:id
// ===============================
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select(`
        id, request_id, status,
        technical_data, technical_offer,
        financial_offer, financial_data,
        notes,
        submitted_at,
        manager_decided_at, manager_decided_by_user_id, manager_comment,
        client_portal_token, client_portal_token_hash,
        client_portal_created_at, client_portal_expires_at,
        created_at, updated_at
      `)
      .eq("id", id)
      .single();

    if (error) return fail(res, "DB Error", 500, error.message);
    if (!offer) return fail(res, "Not Found", 404, "Offer not found");

    // normalize -> always objects
    const technical_data = parseJson(offer.technical_data || offer.technical_offer);
    const financial_data = parseJson(offer.financial_offer || offer.financial_data);

    return ok(res, { ...offer, technical_data, financial_data });
  } catch (e) {
    return fail(res, "Server Error", 500, e?.message || String(e));
  }
});

// ===============================
// Manager Decision (Approve/Reject) - Manager only
// POST /api/offers/:id/manager-decision
// body: { decision: "APPROVE"|"REJECT", comment? }
// ===============================
router.post(
  "/:id/manager-decision",
  requireAuth,
  requireRole([ROLES.MANAGER]),
  async (req, res) => {
    try {
      const id = req.params.id;
      const userId = req.user.id;

      const decision = String(req.body?.decision || "").toUpperCase();
      const comment = String(req.body?.comment || "").trim();

      const { data: offer, error: e1 } = await supabaseAdmin
        .from("offers")
        .select("*")
        .eq("id", id)
        .single();

      if (e1) return fail(res, "DB Error", 500, e1.message);
      if (!offer) return fail(res, "Not Found", 404, "Offer not found");

      if (String(offer.status).toUpperCase() !== OFFER_STATUS.SUBMITTED_TO_MANAGER) {
        return fail(res, "Invalid state", 409, "Offer must be SUBMITTED_TO_MANAGER");
      }

      if (decision !== "APPROVE" && decision !== "REJECT") {
        return fail(res, "Validation", 400, "decision must be APPROVE or REJECT");
      }

      if (decision === "REJECT" && !comment) {
        return fail(res, "Validation", 400, "Manager comment is required when rejecting");
      }

      const nextStatus =
        decision === "APPROVE" ? OFFER_STATUS.MANAGER_APPROVED : OFFER_STATUS.MANAGER_REJECTED;

      const now = new Date().toISOString();

      // update status
      let { data: updatedOffer, error: e2 } = await supabaseAdmin
        .from("offers")
        .update({
          status: nextStatus,
          manager_comment: comment || null,
          manager_decided_at: now,
          manager_decided_by_user_id: userId,
          updated_by: userId,
          updated_at: now,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (e2) return fail(res, "DB Error", 500, e2.message);

      // if approved -> ensure token + expiry + hash
      if (decision === "APPROVE") {
        let token = updatedOffer.client_portal_token;

        if (!token) {
          token = makePortalToken();
          const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

          const { data: withToken, error: e3 } = await supabaseAdmin
            .from("offers")
            .update({
              client_portal_token: token,
              client_portal_token_hash: sha256(token),
              client_portal_created_at: now,
              client_portal_expires_at: expiresAt,
              updated_at: now,
            })
            .eq("id", id)
            .select("*")
            .single();

          if (e3) return fail(res, "DB Error", 500, e3.message);
          updatedOffer = withToken;
        }

        const client_link = buildClientPortalLink(updatedOffer.client_portal_token);
        return ok(res, { offer: updatedOffer, client_link });
      }

      return ok(res, updatedOffer);
    } catch (e) {
      return fail(res, "Server Error", 500, e?.message || String(e));
    }
  }
);

// ===============================
// Backward-compatible endpoints (optional)
// POST /api/offers/:id/manager/approve
// POST /api/offers/:id/manager/reject
// ===============================
router.post(
  "/:id/manager/approve",
  requireAuth,
  requireRole([ROLES.MANAGER]),
  async (req, res) => {
    req.body = { decision: "APPROVE", comment: req.body?.comment || "" };
    return router.handle(req, res, () => {});
  }
);

router.post(
  "/:id/manager/reject",
  requireAuth,
  requireRole([ROLES.MANAGER]),
  async (req, res) => {
    req.body = { decision: "REJECT", comment: req.body?.comment || "" };
    return router.handle(req, res, () => {});
  }
);

// ===============================
// GET Client Portal Link (only after approval)
// GET /api/offers/:id/client-link
// ===============================
router.get("/:id/client-link", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select("id, status, client_portal_token, client_portal_expires_at")
      .eq("id", id)
      .single();

    if (error) return fail(res, "DB Error", 500, error.message);
    if (!offer) return fail(res, "Not Found", 404, "Offer not found");

    if (String(offer.status).toUpperCase() !== OFFER_STATUS.MANAGER_APPROVED) {
      return fail(res, "Not Ready", 409, "Client link is available only after manager approval");
    }

    if (!offer.client_portal_token) {
      return fail(res, "Not Ready", 409, "No client portal token yet");
    }

    return ok(res, {
      client_link: buildClientPortalLink(offer.client_portal_token),
      expires_at: offer.client_portal_expires_at || null,
    });
  } catch (e) {
    return fail(res, "Server Error", 500, e?.message || String(e));
  }
});

export const offersRoutes = router;
