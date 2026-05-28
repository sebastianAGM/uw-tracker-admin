// src/App.jsx
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Settings, LogOut, X } from "lucide-react";
import logo from "./assets/logo.webp";
import { AdminDataProvider } from "./AdminDataContext";
import { getStoredToken, setStoredToken } from "./lib/priceApi";

const AdminOverview  = lazy(() => import("./AdminOverview"));
const AdminBalance   = lazy(() => import("./AdminBalance"));
const AdminAnalytics = lazy(() => import("./AdminAnalytics"));
const PricesView     = lazy(() => import("./AdminPrices"));
const AdminExpenses  = lazy(() => import("./AdminExpenses"));
const AdminSettings  = lazy(() => import("./AdminSettings"));

const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";

export default function App() {
  const [view, setView] = useState("overview");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const hasToken = Boolean(getStoredToken());
  const [loadingAuth, setLoadingAuth] = useState(!hasToken);
  const [session, setSession] = useState(
    hasToken ? { ok: true, email: "" } : null
  );

  async function checkSession() {
    if (!hasToken) setLoadingAuth(true);
    try {
      const token = getStoredToken();
      const r = await fetch(`${API_BASE}/api/admin/me`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        setStoredToken(null);
        setSession(null);
        return;
      }
      const data = await r.json();
      setSession(data);
    } catch (e) {
      console.warn("[auth] checkSession failed", e);
      if (!hasToken) setSession(null);
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

  useEffect(() => { checkSession(); }, []);

  // Loading — solo primera vez o sin token
  if (loadingAuth) {
    return (
      <div className="min-h-dvh w-full bg-[#f8f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center p-1.5">
            <img src={logo} alt="UW" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[13px] font-semibold text-slate-800">UW Tracker</span>
            <span className="text-[11px] text-slate-400">Signing in…</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  // Login
  if (!session?.ok) {
    return <AdminLogin apiBase={API_BASE} onSuccess={() => checkSession()} />;
  }

  // Dashboard
  return (
    <AdminDataProvider>
      <div className="min-h-dvh w-full bg-[#f8f9fb] text-slate-800 pb-[env(safe-area-inset-bottom)]">

        {/* HEADER */}
        <header className="fixed z-30 top-0 left-0 right-0 bg-white/95 backdrop-blur border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="mx-auto w-full max-w-[480px] lg:max-w-5xl px-4 lg:px-6">

            {/* Top row */}
            <div className="pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2 py-2">
              {/* Logo + brand */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 p-1">
                  <img src={logo} alt="UW" className="w-full h-full object-contain brightness-0 invert" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 leading-none">
                    UW Tracker
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900 leading-tight">
                    Admin Control
                  </span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[160px] leading-none mt-0.5">
                    {session.email}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setView("settings")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                  title="Settings" aria-label="Settings"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 active:scale-95 transition-all"
                  title="Log out" aria-label="Log out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex gap-0 border-b border-slate-100">
              {[
                { id: "overview",  label: "Overview"  },
                { id: "balance",   label: "Balance"   },
                { id: "analytics", label: "Analytics" },
                { id: "prices",    label: "Prices"    },
                { id: "expenses",  label: "Expenses"  },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`px-3 py-2.5 text-[11px] font-medium border-b-2 -mb-px transition-all whitespace-nowrap
                    ${view === tab.id
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* MAIN */}
        <main className="mx-auto w-full max-w-[480px] lg:max-w-5xl pt-[calc(100px+env(safe-area-inset-top))] pb-10 px-4 lg:px-6 space-y-3 lg:space-y-4">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-400 shadow-sm animate-pulse">
                Loading…
              </div>
            }
          >
            {view === "overview"  && <AdminOverview />}
            {view === "balance"   && <AdminBalance />}
            {view === "analytics" && <AdminAnalytics />}
            {view === "prices"    && <PricesView />}
            {view === "expenses"  && <AdminExpenses />}
            {view === "settings"  && <AdminSettings onClose={() => setView("overview")} />}
          </Suspense>
        </main>

        {/* LOGOUT MODAL */}
        <ConfirmModal
          open={showLogoutConfirm}
          title="Log out"
          message="Do you want to log out of Admin Control?"
          confirmLabel="Log out"
          cancelLabel="Cancel"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={async () => { setShowLogoutConfirm(false); await doLogout(); }}
        />
      </div>
    </AdminDataProvider>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onCancel} aria-label="Close" />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-[12px] text-slate-500">{message}</div>
          </div>
          <button onClick={onCancel} className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95 transition" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.99] transition">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────
function AdminLogin({ apiBase, onSuccess }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!r.ok) { setErr("Invalid email or password."); return; }
      const data = await r.json().catch(() => ({}));
      if (data?.token) setStoredToken(data.token);
      onSuccess();
    } catch {
      setErr("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh w-full bg-[#f8f9fb] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center p-1.5">
            <img src={logo} alt="UW" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">UW Tracker</div>
            <div className="text-[15px] font-semibold text-slate-900">Admin Login</div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Email</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
              placeholder="you@email.com" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="username" required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">Password</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
              placeholder="••••••••" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required
            />
          </div>
          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-600">{err}</div>
          )}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-[13px] font-semibold hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
