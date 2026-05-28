// src/App.jsx
import React, { useMemo, useState } from "react";
import { DollarSign, Settings } from "lucide-react";

import AdminExpenses from "./AdminExpenses";
import { AdminOverview } from "./AdminOverview";
import PricesView from "./AdminPrices";
import AdminBalance from "./AdminBalance";
import AdminSettings from "./AdminSettings"; 

import FieldProjects from "./field/FieldProjects";
import FieldProductionForm from "./field/FieldProductionForm";

// ================== FOOTER MOCK GLOBAL NET ==================
const MOCK_PROJECTS = [
  {
    id: "PRJ-001",
    name: "OLD FAITHFUL FTTH",
    customer: "Google",
    status: "active",
    series: [
      { d: "Mon", prod: 120, exp: 40 },
      { d: "Tue", prod: 180, exp: 60 },
      { d: "Wed", prod: 140, exp: 45 },
      { d: "Thu", prod: 210, exp: 80 },
      { d: "Fri", prod: 170, exp: 55 },
    ],
    tasks: [
      { task: "MASTIC", unit: "ft", qty: 850, ppu: 2.35 },
      { task: "FIBER", unit: "ft", qty: 1200, ppu: 1.5 },
      { task: "DROPS", unit: "count", qty: 12, ppu: 45 },
    ],
  },
  {
    id: "PRJ-002",
    name: "CITY CORE MICRO-TRENCH",
    customer: "CenturyLink",
    status: "completed",
    series: [
      { d: "Mon", prod: 60, exp: 25 },
      { d: "Tue", prod: 110, exp: 35 },
      { d: "Wed", prod: 90, exp: 30 },
      { d: "Thu", prod: 130, exp: 50 },
      { d: "Fri", prod: 160, exp: 60 },
    ],
    tasks: [
      { task: "MASTIC", unit: "ft", qty: 420, ppu: 2.4 },
      { task: "FLOW_FILL", unit: "yd3", qty: 10, ppu: 85 },
    ],
  },
];

function formatCurrency(n) {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

function computeGlobalTotals(projects) {
  let revenue = 0;
  let expenses = 0;

  projects.forEach((p) => {
    p.tasks.forEach((t) => {
      revenue += t.qty * t.ppu;
    });
    expenses += p.series?.reduce((s, d) => s + (d.exp || 0), 0) || 0;
  });

  return {
    revenue,
    expenses,
    net: revenue - expenses,
  };
}

// ================== ROOT APP ==================
export default function App() {
  const [view, setView] = useState("overview");
  const [selectedProject, setSelectedProject] = useState(null);

  const globalTotals = useMemo(
    () => computeGlobalTotals(MOCK_PROJECTS),
    []
  );

  const isProductionView =
    view === "field-projects" || view === "field-entry";

  return (
    <div className="min-h-dvh w-full bg-[#020617] bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_50%),radial-gradient(circle_at_bottom,_#22c55e_0,_transparent_55%)] text-slate-100 flex justify-center">
      <div className="w-full max-w-[480px] flex flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#020617]/90 backdrop-blur">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-cyan-400 via-sky-400 to-fuchsia-500 flex items-center justify-center text-slate-900 font-black text-xs shadow-[0_0_25px_rgba(34,211,238,0.75)]">
                UW
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  UW Tracker
                </span>
                <span className="text-[13px] font-semibold">
                  Control Center
                </span>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] hover:bg-white/10 active:scale-95 transition"
              onClick={() => setView("settings")} // ⬅️ ABRE SETTINGS
            >
              <Settings size={14} className="opacity-80" />
              <span>Settings</span>
            </button>
          </div>

          {/* MAIN TABS */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-5 gap-2 p-1 rounded-2xl bg-black/40 border border-white/15 text-[11px]">
              <TabButton
                label="Overview"
                active={view === "overview"}
                onClick={() => setView("overview")}
                gradient="from-sky-500/40 via-cyan-400/30 to-fuchsia-500/40"
              />
              <TabButton
                label="Balance"
                active={view === "balance"}
                onClick={() => setView("balance")}
                gradient="from-emerald-500/40 via-teal-400/30 to-emerald-500/40"
              />
              <TabButton
                label="Prices"
                active={view === "prices"}
                onClick={() => setView("prices")}
                gradient="from-emerald-500/40 via-lime-400/30 to-emerald-500/40"
              />
              <TabButton
                label="Expenses"
                active={view === "expenses"}
                onClick={() => setView("expenses")}
                gradient="from-cyan-500/40 via-teal-400/30 to-amber-400/40"
              />
              <TabButton
                label="Production"
                active={isProductionView}
                onClick={() => {
                  setSelectedProject(null);
                  setView("field-projects");
                }}
                gradient="from-sky-500/40 via-emerald-400/30 to-cyan-500/40"
              />
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="px-4 pt-3 pb-24 space-y-3">
          {view === "overview" && <AdminOverview />}
          {view === "balance" && <AdminBalance />}
          {view === "prices" && <PricesView />}
          {view === "expenses" && <AdminExpenses />}
          {view === "settings" && (
                      <AdminSettings
                        onClose={() => setView("overview")}
                      />
                    )}

          {view === "field-projects" && (
            <FieldProjects
              onSelectProject={(project) => {
                setSelectedProject(project);
                setView("field-entry");
              }}
            />
          )}

          {view === "field-entry" && selectedProject && (
            <FieldProductionForm
              project={selectedProject}
              onBack={() => {
                setView("field-projects");
              }}
            />
          )}
        </main>

        {/* FOOTER SUMMARY (global net mock) */}
      <footer className="fixed bottom-0 left-0 right-0 flex justify-center">
        <div className="w-full max-w-[480px] px-4 pb-3">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-tr from-white/10 via-white/5 to-transparent p-3 backdrop-blur shadow-[0_15px_40px_rgba(0,0,0,0.75)]">

            {/* 
              TEXTO + MONTO OCULTOS

            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1 text-slate-200">
                <DollarSign size={14} className="text-cyan-300" />
                Global net (prod − expenses)
              </span>
              <span className="font-extrabold tracking-wide text-cyan-300">
                {formatCurrency(globalTotals.net)}
              </span>
            </div>
            */}

            {/* NAV BUTTONS (se mantienen) */}
            <div className="mt-2 grid grid-cols-5 gap-2 text-[11px]">
              <FooterNav
                label="Overview"
                active={view === "overview"}
                onClick={() => setView("overview")}
              />
              <FooterNav
                label="Balance"
                active={view === "balance"}
                onClick={() => setView("balance")}
              />
              <FooterNav
                label="Prices"
                active={view === "prices"}
                onClick={() => setView("prices")}
              />
              <FooterNav
                label="Expenses"
                active={view === "expenses"}
                onClick={() => setView("expenses")}
              />
              <FooterNav
                label="Production"
                active={isProductionView}
                onClick={() => {
                  setSelectedProject(null);
                  setView("field-projects");
                }}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
);
}

// ================== UI HELPERS ==================
function TabButton({ label, active, onClick, gradient }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-xl font-semibold transition text-[11px] ${
        active
          ? `bg-gradient-to-r ${gradient} shadow-inner shadow-cyan-500/40`
          : "opacity-70 hover:opacity-100"
      }`}
    >
      {label}
    </button>
  );
}

function FooterNav({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-lg border text-center font-semibold transition active:scale-95 ${
        active
          ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100"
          : "border-white/15 bg-black/30 text-slate-200/80 hover:bg-black/50"
      }`}
    >
      {label}
    </button>
  );
}
