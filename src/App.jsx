import React, { Suspense, lazy, useEffect, useState } from "react";
import { Settings, LogOut, X } from "lucide-react";


import logo from "./assets/logo.png";
const AdminOverview = lazy(() => import("./AdminOverview"));
const AdminBalance = lazy(() => import("./AdminBalance"));
const AdminAnalytics = lazy(() => import("./AdminAnalytics"));
const PricesView = lazy(() => import("./AdminPrices"));
const AdminExpenses = lazy(() => import("./AdminExpenses"));
const AdminSettings = lazy(() => import("./AdminSettings"));

// ================== ANDROID TOKEN STORAGE ==================
const TOKEN_KEY = "uw_admin_token";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

// ✅ Usa tu Worker URL
const API_BASE = "";

export default function App() {
  const [view, setView] = useState("overview");

  // ✅ AUTH STATE
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [session, setSession] = useState(null); // { ok:true, email, role } o null

  // ✅ Logout confirm modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function checkSession() {
  setLoadingAuth(true);
  try {
    const token = getStoredToken();

      const r = await fetch(`${API_BASE}/api/admin/me`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

    if (!r.ok) {
      setSession(null);
      return;
    }

    const data = await r.json();
    setSession(data);
  } catch (e) {
    console.warn("[auth] checkSession failed", e);
    setSession(null);
  } finally {
    setLoadingAuth(false);
  }
}

  async function doLogout() {
  try {
    const token = getStoredToken();

    await fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (e) {
    console.warn("[auth] logout failed", e);
  } finally {
    setStoredToken(null);
    setSession(null);
    setView("overview");
  }
}

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
  console.log("[origin]", window.location.origin);
}, []);

  // ✅ Loading state (antes de mostrar dashboard o login)
  if (loadingAuth) {
    return (
      <div className="min-h-dvh w-full bg-slate-50 flex items-center justify-center text-slate-600">
        Loading...
      </div>
    );
  }

  // ✅ Si no hay sesión → mostrar LOGIN
  if (!session?.ok) {
    return <AdminLogin apiBase={API_BASE} onSuccess={() => checkSession()} />;
  }

  // ✅ Si hay sesión → render admin normal
  return (
    <div
      className="
        min-h-dvh w-full
        bg-slate-50
        bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]
        text-slate-800
        pb-[env(safe-area-inset-bottom)]
        flex justify-center
      "
    >
      {/* HEADER */}
      <header
        className="
          fixed z-30
          top-0
          w-full max-w-[480px]
          border-b border-slate-200
          bg-white/95
          backdrop-blur
          shadow-sm
        "
      >
        <div className="px-4 pb-2 pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2">
          {/* IZQUIERDA: LOGO + TEXTOS */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-10 w-10 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
              <img
                src={logo}
                alt="UW logo"
                className="w-[95%] h-[95%] object-contain"
              />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                UW Tracker
              </span>
              <span className="text-[13px] font-semibold text-slate-900">
                Admin Control
              </span>
              <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                {session.email}
              </span>
            </div>
          </div>

          {/* DERECHA: ICONOS */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
              onClick={() => setView("settings")}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={16} className="opacity-80" />
            </button>

            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition"
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={16} className="opacity-80" />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-slate-100 text-[11px]">
            <TabButton
              label="Overview"
              active={view === "overview"}
              onClick={() => setView("overview")}
            />
            <TabButton
              label="Balance"
              active={view === "balance"}
              onClick={() => setView("balance")}
            />
            <TabButton
              label="Analytics"
              active={view === "analytics"}
              onClick={() => setView("analytics")}
            />
            <TabButton
              label="Prices"
              active={view === "prices"}
              onClick={() => setView("prices")}
            />
            <TabButton
              label="Expenses"
              active={view === "expenses"}
              onClick={() => setView("expenses")}
            />
          </div>
        </div>
      </header>

      {/* BODY */}
      
      <main className="flex-1 w-full max-w-[480px] pt-[calc(110px+env(safe-area-inset-top))] pb-10 px-4 space-y-3">
  <Suspense
    fallback={
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-500 shadow-sm">
        Loading section...
      </div>
    }
  >
    {view === "overview" && <AdminOverview />}
    {view === "balance" && <AdminBalance />}
    {view === "analytics" && <AdminAnalytics />}
    {view === "prices" && <PricesView />}
    {view === "expenses" && <AdminExpenses />}
    {view === "settings" && (
      <AdminSettings onClose={() => setView("overview")} />
    )}
  </Suspense>
</main>

      {/* ✅ Logout confirm modal (floating, estilo UW) */}
      <ConfirmModal
        open={showLogoutConfirm}
        title="Log out"
        message="Do you want to log out?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await doLogout();
        }}
      />
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-xl font-semibold transition text-[11px] flex items-center justify-center
      ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
    >
      {label}
    </button>
  );
}

// ================== LOGIN SCREEN ==================
function AdminLogin({ apiBase, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
  e.preventDefault();
  setErr("");
  setLoading(true);

  try {
    const r = await fetch(`${apiBase}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });

    if (!r.ok) {
      setErr("Invalid email or password.");
      setLoading(false);
      return;
    }

    const data = await r.json().catch(() => ({}));

    // ✅ guardar token si viene
    if (data?.token) setStoredToken(data.token);

    setLoading(false);
    onSuccess();


    // ✅ si el backend devolvió token, lo guardamos (Android nativa)
    if (data?.token) {
      setStoredToken(data.token);
    }

    setLoading(false);
    onSuccess();
  } catch (e) {
    console.warn("[login] failed", e);
    setErr("Connection error. Please try again.");
    setLoading(false);
  }
}

  return (
    <div className="min-h-dvh w-full bg-slate-50 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-sm p-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
            <img
              src={logo}
              alt="UW logo"
              className="w-[95%] h-[95%] object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              UW Tracker
            </div>
            <div className="text-[14px] font-semibold text-slate-900">
              Admin Login
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-[11px] text-slate-600 font-semibold">
            Email
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />

          <label className="text-[11px] text-slate-600 font-semibold mt-2 block">
            Password
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {err ? (
            <div className="text-[12px] text-red-600 pt-1">{err}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-slate-900 text-white py-2 text-[13px] font-semibold hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ================== CONFIRM MODAL (UW floating style) ==================
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-label="Close dialog"
      />

      {/* Card */}
      <div className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">
              {title}
            </div>
            <div className="mt-1 text-[12px] text-slate-600">{message}</div>
          </div>

          <button
            onClick={onCancel}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
            aria-label="Close"
            title="Close"
          >
            <X size={16} className="opacity-80" />
          </button>
        </div>

        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition"
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
