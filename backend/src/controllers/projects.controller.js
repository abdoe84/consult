import { supabaseAdmin } from "../config/supabase.js";
import { ok, fail } from "../utils/response.js";
import { generateRef } from "../utils/ids.js";
import { OFFER_STATUS, CONTRACT_STATUS, PROJECT_STATUS } from "../config/constants.js";
import { logActivity } from "../utils/activity.js";

async function insertProjectWithUniqueCode(payload, maxAttempts = 8) {
  let lastError = null;

  for (let i = 0; i < maxAttempts; i++) {
    const project_code = generateRef("PRJ");
    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert([{ ...payload, project_code }])
      .select("*")
      .single();

    if (!error) return data;
    lastError = error;
    if (String(error?.code) !== "23505") break;
  }

  throw new Error(lastError?.message || "Failed to create project");
}

export async function createProjectFromRequest(req, res) {
  try {
    const { requestId } = req.params;

    const trigger = String(process.env.PROJECT_CREATE_TRIGGER || "CONTRACT_SIGNED");

    const { data: existingProject, error: exErr } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    if (exErr) return fail(res, "Failed to check existing project", exErr, 500);
    if (existingProject) return fail(res, "Already exists", { project_id: existingProject.id }, 409);

    const { data: sr, error: srErr } = await supabaseAdmin
      .from("service_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (srErr || !sr) return fail(res, "Not Found", "Service request not found", 404);

    const { data: offer } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();

    const canCreate =
      trigger === "MANAGER_APPROVED"
        ? offer && offer.status === OFFER_STATUS.MANAGER_APPROVED
        : contract && contract.status === CONTRACT_STATUS.CONTRACT_SIGNED;

    if (!canCreate) {
      return fail(
        res,
        "Trigger not satisfied",
        {
          trigger,
          offer_status: offer?.status || null,
          contract_status: contract?.status || null,
        },
        409
      );
    }

    const payload = {
      request_id: requestId,
      offer_id: offer?.id || null,
      contract_id: contract?.id || null,
      name: `Project - ${sr.title}`,
      description: sr.description || null,
      status: PROJECT_STATUS.ACTIVE,
      created_by_user_id: req.user.id,
      project_manager_user_id: sr.assigned_consultant_id || req.user.id,
    };

    const created = await insertProjectWithUniqueCode(payload);

    await logActivity({
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      entity_type: "project",
      entity_id: created.id,
      action: "PROJECT_CREATED",
      message: "Project created from request",
      data: { request_id: requestId, trigger },
      ip: req.ip,
    });

    return ok(res, created, 201);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to create project", 500);
  }
}

export async function getProjectById(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin.from("projects").select("*").eq("id", id).single();
    if (error || !data) return fail(res, "Not Found", "Project not found", 404);

    return ok(res, data);
  } catch (err) {
    return fail(res, "Server Error", err?.message || "Failed to fetch project", 500);
  }
}
