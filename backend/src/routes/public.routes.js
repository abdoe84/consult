import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { generateRef } from "../utils/ids.js";
import { SERVICE_REQUEST_STATUS } from "../config/constants.js";

export const publicRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
});

function safeName(name = "file") {
  return String(name)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 150);
}

function nowIso() {
  return new Date().toISOString();
}

async function getOfferByToken(token) {
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("id, request_id, status, technical_offer, financial_offer, updated_at, client_portal_token, client_decision_at, client_decision_comment, client_contact_name")
    .eq("client_portal_token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function getRequestById(id) {
  const { data, error } = await supabaseAdmin
    .from("service_requests")
    .select("id, reference_no, title, service_type, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
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
    updated_at: nowIso()
  };

  const { data: created, error: crErr } = await supabaseAdmin
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (crErr) throw new Error(crErr.message);
  return created;
}

/**
 * GET /api/public/client-portal?token=...
 */
publicRoutes.get("/client-portal", async (req, res) => {
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

    return ok(res, { request: requestRow || null, offer });
  } catch (e) {
    return fail(res, "server error", String(e?.message || e), 500);
  }
});

/**
 * POST /api/public/client-portal/decision
 * body: { token, decision: "approve"|"reject", comment?, name? }
 *
 * Behavior:
 * - approve -> offer CLIENT_APPROVED -> request CLIENT_APPROVED -> create project -> request PROJECT_CREATED
 * - reject  -> offer CLIENT_REJECTED  -> request CLIENT_REJECTED
 */
publicRoutes.post("/client-portal/decision", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const comment = String(req.body?.comment || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!token) return fail(res, "token is required", null, 400);
    if (!["approve", "reject"].includes(decision)) return fail(res, "invalid decision", null, 400);

    const offer = await getOfferByToken(token);
    if (!offer) return fail(res, "invalid token", null, 404);

    const st = String(offer.status || "").toUpperCase();
    if (!["MANAGER_APPROVED", "CLIENT_APPROVED", "CLIENT_REJECTED"].includes(st)) {
      return fail(res, "decision not allowed in this status", st, 403);
    }

    // Idempotent already decided
    if (st === "CLIENT_APPROVED") {
      const project = await getOrCreateProject({ requestId: offer.request_id, offerId: offer.id });
      // Ensure request reflects execution
      await updateRequestStatus(offer.request_id, "PROJECT_CREATED");
      return ok(res, { offer, project });
    }
    if (st === "CLIENT_REJECTED") {
      await updateRequestStatus(offer.request_id, "CLIENT_REJECTED");
      return ok(res, { offer, project: null });
    }

    const newOfferStatus = decision === "approve" ? "CLIENT_APPROVED" : "CLIENT_REJECTED";

    const { data: updatedOffer, error: upErr } = await supabaseAdmin
      .from("offers")
      .update({
        status: newOfferStatus,
        client_decision_at: nowIso(),
        client_decision_comment: comment || null,
        client_contact_name: name || null,
        updated_at: nowIso()
      })
      .eq("id", offer.id)
      .select("*")
      .single();

    if (upErr) return fail(res, "db error", upErr.message, 500);

    if (newOfferStatus === "CLIENT_APPROVED") {
      // Step 1: request moves to CLIENT_APPROVED
      await updateRequestStatus(updatedOffer.request_id, "CLIENT_APPROVED");

      // Step 2: create project
      const project = await getOrCreateProject({ requestId: updatedOffer.request_id, offerId: updatedOffer.id });

      // Step 3: request moves to PROJECT_CREATED (execution started)
      await updateRequestStatus(updatedOffer.request_id, "PROJECT_CREATED");

      return ok(res, { offer: updatedOffer, project });
    }

    // Rejected
    await updateRequestStatus(updatedOffer.request_id, "CLIENT_REJECTED");
    return ok(res, { offer: updatedOffer, project: null });
  } catch (e) {
    return fail(res, "server error", String(e?.message || e), 500);
  }
});

/**
 * POST /api/public/service-requests
 * Create a service request from public intake form (no auth required)
 * body: { title, description?, service_type?, priority?, requester_name?, requester_email?, requester_phone? }
 */
publicRoutes.post("/service-requests", async (req, res) => {
  try {
    const {
      title,
      description = null,
      service_type = null,
      priority = "NORMAL",
      requester_name = null,
      requester_email = null,
      requester_phone = null,
    } = req.body || {};

    if (!title) return fail(res, "Validation Error", "title is required", 400);

    // Generate unique reference number
    let reference_no;
    let attempts = 0;
    let inserted = false;
    let lastError = null;

    while (!inserted && attempts < 8) {
      reference_no = generateRef("SR");
      const payload = {
        title: String(title),
        description: description ? String(description) : null,
        service_type: service_type ? String(service_type) : null,
        priority: String(priority || "NORMAL").toUpperCase(),
        requester_name: requester_name ? String(requester_name) : null,
        requester_email: requester_email ? String(requester_email).toLowerCase() : null,
        requester_phone: requester_phone ? String(requester_phone) : null,
        requested_by_user_id: null, // Public requests have no user
        assigned_consultant_id: null,
        status: SERVICE_REQUEST_STATUS.PENDING_REVIEW,
        reference_no,
      };

      const { data, error } = await supabaseAdmin
        .from("service_requests")
        .insert([payload])
        .select("*")
        .single();

      if (!error) {
        inserted = true;
        return ok(res, data, 201);
      }

      lastError = error;
      // Retry only on unique violation
      if (String(error?.code) !== "23505") break;
      attempts++;
    }

    return fail(res, "Server Error", lastError?.message || "Failed to create service request", 500);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create service request", 500);
  }
});

/**
 * POST /api/public/service-requests/upload-attachment
 * Upload attachment for a service request (no auth required)
 * multipart/form-data: { file, service_request_id }
 */
publicRoutes.post("/service-requests/upload-attachment", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, "Validation Error", "file is required", 400);

    const serviceRequestId = String(req.body?.service_request_id || "").trim();
    if (!serviceRequestId) return fail(res, "Validation Error", "service_request_id is required", 400);

    // Verify service request exists
    const { data: request, error: reqError } = await supabaseAdmin
      .from("service_requests")
      .select("id")
      .eq("id", serviceRequestId)
      .maybeSingle();

    if (reqError || !request) {
      return fail(res, "Validation Error", "Service request not found", 404);
    }

    const originalName = req.file.originalname || "file";
    const file_name = safeName(originalName);
    const ext = file_name.includes(".") ? file_name.split(".").pop() : "";
    const key = `service-requests/${serviceRequestId}/${Date.now()}_${randomUUID()}${ext ? "." + ext : ""}`;

    // 1) Upload to storage
    const up = await supabaseAdmin.storage
      .from("documents")
      .upload(key, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (up.error) return fail(res, "Upload failed", up.error.message, 400);

    // 2) Insert into documents table
    const meta = {
      original_name: originalName,
      bucket: "documents",
      source: "public_intake",
    };

    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        file_name,
        storage_path: key,
        mime_type: req.file.mimetype || null,
        file_size_bytes: req.file.size || null,
        uploaded_by_user_id: null, // Public uploads have no user
        uploaded_at: new Date().toISOString(),
        meta,
      })
      .select("*")
      .single();

    if (docError || !document) {
      return fail(res, "DB insert failed", docError?.message || "Failed to create document record", 500);
    }

    // 3) Link to service request (check if service_request_documents table exists)
    const { data: link, error: linkError } = await supabaseAdmin
      .from("service_request_documents")
      .insert({
        request_id: serviceRequestId,
        document_id: document.id,
      })
      .select("*")
      .single();

    // If linking fails, document is still uploaded (we can link it later manually)
    if (linkError) {
      console.warn("Failed to link document to service request:", linkError);
      // Return success anyway - document is uploaded
    }

    return ok(res, {
      document_id: document.id,
      file_name: document.file_name,
      file_size_bytes: document.file_size_bytes,
      linked: !linkError,
    }, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to upload attachment", 500);
  }
});
