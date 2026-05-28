export const API_BASE =
  "https://uw-backend.sebastian-gonzalez243.workers.dev";

export const TOKEN_KEY = "uw_admin_token";

export const PRICE_LISTS_ENDPOINT =
  `${API_BASE}/api/admin/price-lists`;

export const PRICES_ENDPOINT =
  `${API_BASE}/api/admin/prices`;

export const PRICES_BULK_ENDPOINT =
  `${API_BASE}/api/admin/prices/bulk`;

export const PRICE_LIST_DETAILS_ENDPOINT = (id: string) =>
  `${API_BASE}/api/admin/price-lists/${id}`;

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

export async function tokenFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const token = getStoredToken();

  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}