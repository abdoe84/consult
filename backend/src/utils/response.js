// backend/src/utils/response.js
export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(res, error, details = null, status = 400) {
  // Hard guard: Express will crash if status is not a valid integer.
  let code = Number(status);
  if (!Number.isInteger(code) || code < 100 || code > 599) code = 400;

  const payload = { ok: false, error };
  if (details !== null && details !== undefined && details !== "") payload.details = details;

  return res.status(code).json(payload);
}
