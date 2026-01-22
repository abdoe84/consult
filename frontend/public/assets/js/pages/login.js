// assets/js/pages/login.js
import { API_BASE, TOKEN_KEY } from "../config.js";

function $(id) { return document.getElementById(id); }

function showError(msg) {
  const box = $("errorBox");
  if (!box) {
    console.error("[login] error:", msg);
    alert(msg);
    return;
  }
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
  console.log("[login] page loaded, initializing...");

  const form = $("loginForm");
  const btn = $("loginBtn");

  if (!form) {
    console.error("[login] loginForm not found!");
    showError("Form not found. Please refresh the page.");
    return;
  }

  console.log("[login] form found, attaching submit handler");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = ($("email")?.value || "").trim();
    const password = ($("password")?.value || "").trim();

    if (!email || !password) {
      return showError("Please enter email and password.");
    }

    console.log("[login] submitting...", { email, API_BASE });

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Logging in...";
      }

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      console.log("[login] response:", { status: res.status, data });

      if (!res.ok) {
        const errorMsg = data?.details || data?.error || `Login failed (${res.status})`;
        console.error("[login] error:", errorMsg);
        return showError(errorMsg);
      }

      const token = data?.data?.token || data?.token;
      if (!token) {
        console.error("[login] no token in response:", data);
        return showError("Login succeeded but token missing from response.");
      }

      console.log("[login] token received, saving...");
      localStorage.setItem(TOKEN_KEY, token);

      // Save user if provided
      if (data?.data?.user) {
        localStorage.setItem("REVIVA_USER", JSON.stringify(data.data.user));
      }

      console.log("[login] redirecting to dashboard...");
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("[login] exception:", err);
      showError(err?.message || "Network error. Check if backend server is running on port 4000.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Login";
      }
    }
  });

  console.log("[login] initialization complete");
});
