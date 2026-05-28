import { setStoredToken } from "./priceApi";

export function isAuthError(json: any, status: number) {
  const e = String(json?.error || "").toLowerCase();

  return (
    status === 401 &&
    (
      e === "no_session" ||
      e === "invalid_session" ||
      e === "unauthorized"
    )
  );
}

export function clearAuthSession() {
  setStoredToken(null);
}