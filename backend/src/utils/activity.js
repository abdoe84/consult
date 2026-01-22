import { supabaseAdmin } from "../config/supabase.js";

export async function logActivity({
  actor_user_id = null,
  actor_role = null,
  entity_type,
  entity_id = null,
  action,
  message = null,
  data = {},
  ip = null,
}) {
  try {
    await supabaseAdmin.from("activity_log").insert([
      {
        actor_user_id,
        actor_role,
        entity_type,
        entity_id,
        action,
        message,
        data,
        ip,
      },
    ]);
  } catch {
    // Do not crash request because of logging
  }
}
