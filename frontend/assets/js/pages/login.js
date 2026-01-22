// assets/js/pages/login.js
import { API_BASE, TOKEN_KEY } from "../config.js";

function $(id) { return document.getElementById(id); }

function showError(msg) {
  const box = $("errorBox");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.classList.remove("hidden");
}

function clearError() {
  const box = $("errorBox");
  if (!box) return;
  box.textContent = "";
  box.classList.add("hidden");
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("[login] loaded");

  const form = $("loginForm");
  const btn = $("loginBtn");

  if (!form) {
    console.warn("[login] loginForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = ($("email")?.value || "").trim();
    const password = ($("password")?.value || "").trim();

    if (!email || !password) return showError("Please enter email and password.");

    try {
      btn && (btn.disabled = true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      console.log("[login] status:", res.status, data);

      if (!res.ok) {
        return showError(data?.details || data?.error || "Login failed.");
      }

      const token = data?.data?.token || data?.token;
      if (!token) return showError("Login succeeded but token missing from response.");

      localStorage.setItem(TOKEN_KEY, token);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
      showError(err?.message || "Unexpected error.");
    } finally {
      btn && (btn.disabled = false);
    }
  });
});
