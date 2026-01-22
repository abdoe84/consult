import { fail } from "../utils/response.js";

export function requireRole(allowedRoles = []) {
  const allowed = new Set(allowedRoles);

  return (req, res, next) => {
    const role = req?.user?.role;
    if (!role) return fail(res, "Unauthorized", "Missing user role", 401);

    if (!allowed.has(role)) {
      return fail(res, "Forbidden", { required: [...allowed], got: role }, 403);
    }
    next();
  };
}
