import { fail } from "../utils/response.js";

export function notFound(req, res) {
  return fail(res, "Not Found", { path: req.originalUrl }, 404);
}
