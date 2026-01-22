import { fail } from "../utils/response.js";

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error("[ERROR]", err);
  return fail(res, "Server Error", err?.message || "Unknown error", 500);
}
