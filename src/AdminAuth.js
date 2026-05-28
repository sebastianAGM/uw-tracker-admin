const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";

export async function adminMe() {
  const r = await fetch(`${API_BASE}/api/admin/me`, {
    method: "GET",
    credentials: "include",
  });
  if (!r.ok) return null;
  return await r.json();
}

export async function adminLogin(email, password) {
  const r = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) return { ok: false };
  return { ok: true };
}

export async function adminLogout() {
  await fetch(`${API_BASE}/api/admin/logout`, {
    method: "POST",
    credentials: "include",
  });
}
