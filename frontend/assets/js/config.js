// frontend/assets/js/config.js
// Local dev: API on :4000. Production: same origin (frontend + API served together).
export const API_BASE =
  (location.hostname === "127.0.0.1" || location.hostname === "localhost")
    ? "http://127.0.0.1:4000"
    : window.location.origin;

export const TOKEN_KEY = "REVIVA_TOKEN";
export const USER_KEY  = "REVIVA_USER";

