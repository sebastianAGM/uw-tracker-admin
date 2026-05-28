// src/AdminExpenses.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Truck,
  Users,
  Edit3,
  XCircle,
  CheckCircle2,
} from "lucide-react";

const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";
const EXPENSES_ENDPOINT = `${API_BASE}/api/expenses`;
const PRICE_LISTS_ENDPOINT = `${API_BASE}/api/price-lists`;
const ADMIN_TOKEN = "3amigos";

type ExpenseCategory = "fixed";

interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
}

interface RatesPayload {
  crew_per_day: number; // USD per person per day
  truck_per_day: number; // USD per truck per day
}

interface ExpensesPayload {
  fixed: ExpenseItem[];
  rates: RatesPayload;
}

interface SheetMeta {
  id: string;
  name: string;
  created_at?: string;
}

interface BackendExpensesResponse {
  ok: boolean;
  sheet: SheetMeta | null;
  payload: any; // flexible por compatibilidad con payload antiguo
}

interface PriceListSummary {
  id: string;
  name?: string;
  is_active?: number | boolean;
  status?: string | null;
}

// Helper
const currency = (n: number | undefined | null): string =>
  (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const newItem = (): ExpenseItem => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto.randomUUID() as string)
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  label: "",
  amount: 0,
});

const AdminExpenses: React.FC = () => {
  // único grupo editable: fixed
  const [activeCategory] = useState<ExpenseCategory>("fixed");

  // payload completo en memoria
  const [fixed, setFixed] = useState<ExpenseItem[]>([]);
  const [crewRate, setCrewRate] = useState<number>(0);
  const [truckRate, setTruckRate] = useState<number>(0);

  // filas que se editan en el panel superior (solo fixed)
  const [editRows, setEditRows] = useState<ExpenseItem[]>([newItem()]);

  const [sheet, setSheet] = useState<SheetMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // modal confirmación borrar fixed completo
  const [pendingDeleteCategory, setPendingDeleteCategory] =
    useState<ExpenseCategory | null>(null);

  // proyectos activos de AdminPrices
  const [activeProjects, setActiveProjects] = useState<number | null>(null);

  // ====== LOAD ACTIVE PRICE PROJECTS (AdminPrices) ======
  async function loadActivePriceProjects() {
    if (!PRICE_LISTS_ENDPOINT.includes("http")) return;
    try {
      const res = await fetch(PRICE_LISTS_ENDPOINT, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        mode: "cors",
      });

      const json: any = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(
          json.error || `Error loading price lists (${res.status})`
        );
      }

      const lists: PriceListSummary[] = Array.isArray(json.lists)
        ? json.lists
        : Array.isArray(json)
        ? json
        : [];

      const count = lists.filter((pl) => pl.status !== "completed").length;
      setActiveProjects(count || 0);
    } catch (e) {
      console.error("Error loading active price projects", e);
      setActiveProjects(0);
    }
  }

  // ====== LOAD FROM BACKEND (EXPENSES SHEET) ======
  useEffect(() => {
    async function loadExpenses() {
      if (!EXPENSES_ENDPOINT.includes("http")) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(EXPENSES_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
          mode: "cors",
        });

        const json: BackendExpensesResponse = await res
          .json()
          .catch(() => ({ ok: false, sheet: null, payload: {} }));

        if (!res.ok || json.ok === false) {
          throw new Error(
            (json as any).error ||
              `Error loading expenses sheet (${res.status})`
          );
        }

        setSheet(json.sheet);

        const payload = json.payload || {};

        // fixed list
        setFixed(Array.isArray(payload.fixed) ? payload.fixed : []);

        // rates (nuevo). Fallback: si payload antiguo no trae rates, queda 0.
        const rates = payload.rates || {};
        setCrewRate(Number(rates.crew_per_day) || 0);
        setTruckRate(Number(rates.truck_per_day) || 0);

        // panel superior fresh
        setEditRows([newItem()]);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Error loading expenses");
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
    loadActivePriceProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== HELPERS ======
  const categoryLabel = useMemo(() => "Fixed overhead", []);

  const totals = useMemo(() => {
    const fixedTotal = fixed.reduce((s, i) => s + (i.amount || 0), 0);
    return {
      fixed: fixedTotal,
      grand: fixedTotal,
      fixedCount: fixed.length,
    };
  }, [fixed]);

  // reparto de fixed overhead por proyecto activo
  const fixedPerProject = useMemo(() => {
    if (!activeProjects || activeProjects <= 0) return 0;
    if (!totals.fixed || totals.fixed <= 0) return 0;
    return totals.fixed / activeProjects;
  }, [totals.fixed, activeProjects]);

  const fixedAllocationPercent = useMemo(() => {
    if (!activeProjects || activeProjects <= 0) return 0;
    return 100 / activeProjects;
  }, [activeProjects]);

  // ====== PANEL SUPERIOR EDIT ======
  function resetEditRows() {
    setEditRows([newItem()]);
  }

  function handleAddRow() {
    setEditRows((prev) => [...prev, newItem()]);
  }

  function handleUpdateRow(id: string, patch: Partial<ExpenseItem>) {
    setEditRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function handleRemoveRow(id: string) {
    setEditRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [newItem()];
    });
  }

  // Cargar filas al dar "Edit" en la card de fixed
  function handleEditFixed() {
    setEditRows(fixed.length ? fixed.map((i) => ({ ...i })) : [newItem()]);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ====== SAVE (fixed + rates) ======
  async function handleSaveAll() {
    if (!EXPENSES_ENDPOINT.includes("http")) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Limpio filas vacías (fixed)
      const cleanedFixed = editRows
        .map((r) => ({
          ...r,
          label: (r.label || "").trim().toUpperCase(),
          amount: Number(r.amount) || 0,
        }))
        .filter((r) => r.label && r.amount > 0);

      // reflejar en estado
      setFixed(cleanedFixed);

      const payload: ExpensesPayload = {
        fixed: cleanedFixed,
        rates: {
          crew_per_day: Number(crewRate) || 0,
          truck_per_day: Number(truckRate) || 0,
        },
      };

      const defaultName = `Global expenses · ${new Date()
        .toISOString()
        .slice(0, 7)}`;

      const res = await fetch(EXPENSES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          name: sheet?.name || defaultName,
          payload,
        }),
        mode: "cors",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json as any).ok === false) {
        throw new Error(
          (json as any).error ||
            `Error saving expenses sheet (${res.status})`
        );
      }

      setSheet((prev) => ({
        id: (json as any).id || prev?.id || "",
        name: sheet?.name || defaultName,
        created_at: prev?.created_at,
      }));

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      resetEditRows();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error saving expenses");
    } finally {
      setSaving(false);
    }
  }

  // ====== DELETE FIXED (pone [] y guarda sheet) ======
  async function confirmDeleteFixed() {
    setPendingDeleteCategory(null);
    setSaving(true);
    setError(null);
    try {
      const payload: ExpensesPayload = {
        fixed: [],
        rates: {
          crew_per_day: Number(crewRate) || 0,
          truck_per_day: Number(truckRate) || 0,
        },
      };

      const defaultName = `Global expenses · ${new Date()
        .toISOString()
        .slice(0, 7)}`;

      const res = await fetch(EXPENSES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          name: sheet?.name || defaultName,
          payload,
        }),
        mode: "cors",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json as any).ok === false) {
        throw new Error(
          (json as any).error || `Error deleting fixed group (${res.status})`
        );
      }

      setFixed([]);
      resetEditRows();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error deleting fixed group");
    } finally {
      setSaving(false);
    }
  }

  // ====== RENDER ======
  return (
    <div className="space-y-4 text-[11px]">
      {/* MODAL DELETE FIXED (estilo claro como AdminPrices) */}
      {pendingDeleteCategory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] flex flex-col items-center text-center gap-2 shadow-xl max-w-md w-[90%]">
            <div className="flex items-center gap-1 text-slate-700 font-semibold uppercase tracking-wide">
              <XCircle className="w-3 h-3 text-rose-500" />
              Confirm delete fixed overhead
            </div>
            <p className="text-slate-600">
              This will{" "}
              <span className="font-bold text-rose-600">remove all rows</span>{" "}
              from fixed overhead. This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmDeleteFixed}
                className="inline-flex items-center gap-1 rounded-full border border-rose-600 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 active:scale-95"
              >
                <XCircle className="w-3 h-3" />
                Confirm delete
              </button>
              <button
                onClick={() => setPendingDeleteCategory(null)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50 active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD PRINCIPAL (paleta clara como AdminPrices) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex gap-2 items-start">
            <div className="h-7 w-7 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-800">
                Admin — Expenses setup
              </span>
              <span className="text-[10px] text-slate-500">
                Define fixed overhead and daily rates used by production.
              </span>
              {sheet && (
                <span className="mt-0.5 text-[10px] text-slate-500">
                  Active sheet:{" "}
                  <span className="font-semibold text-slate-800">
                    {sheet.name}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-[11px]">
            <span className="block text-slate-500">Fixed registered</span>
            <span className="block text-[14px] font-semibold text-emerald-600">
              {currency(totals.fixed)}
            </span>
          </div>
        </div>

        {/* DAILY RATES (tarjeta clara) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-800">
              Daily rates
            </span>
            <span className="text-[10px] text-slate-500">
              Used in production: crew_count & truck_count
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-700 flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-500" />
                Crew rate (USD / person / day)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                name="crew_rate_per_day"
                className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-right text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                value={crewRate || ""}
                onChange={(e) => setCrewRate(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-700 flex items-center gap-1">
                <Truck className="w-3 h-3 text-slate-500" />
                Truck rate (USD / truck / day)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                name="truck_rate_per_day"
                className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-right text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                value={truckRate || ""}
                onChange={(e) => setTruckRate(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* FIXED EDITOR (estilo tabla clara) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2.1fr)_1.1fr_0.6fr] px-3 py-1.5 text-[10px] bg-slate-100 text-slate-600">
            <span>Fixed label</span>
            <span className="text-right">Amount (USD)</span>
            <span className="text-right">Remove</span>
          </div>

          <div className="max-h-52 overflow-auto divide-y divide-slate-200">
            {editRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,2.1fr)_1.1fr_0.6fr] px-3 py-1.5 items-center text-[11px] bg-white"
              >
                <div className="pr-2">
                  <input
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    name={`fixed_label_${row.id}`}
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
                    placeholder="RENT, INSURANCE, YARD..."
                    value={row.label}
                    onChange={(e) =>
                      handleUpdateRow(row.id, { label: e.target.value })
                    }
                  />
                </div>

                <div className="pr-2">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    name={`fixed_amount_${row.id}`}
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-right text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={row.amount || ""}
                    onChange={(e) =>
                      handleUpdateRow(row.id, {
                        amount: Number(e.target.value),
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-95"
            >
              + Add row
            </button>
            <span className="text-[10px] text-slate-500">
              {editRows.length} rows in {categoryLabel.toLowerCase()}.
            </span>
          </div>
        </div>

        {/* ESTADOS (banners claros) */}
        <div className="mt-2 space-y-1">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
              {error}
            </div>
          )}
          {loading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
              Loading expenses…
            </div>
          )}
          {saved && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved ✓
            </div>
          )}
        </div>

        {/* BOTÓN SAVE (mismo estilo que Save prices) */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white active:scale-95 disabled:opacity-60 hover:bg-emerald-700"
          >
            <DollarSign className="w-3 h-3" />
            {saving ? "Saving…" : "Save fixed + rates"}
          </button>
        </div>
      </section>

      {/* KPIs (tarjetas blancas) */}
      <section className="grid grid-cols-3 gap-2">
        <KpiCard
          title="Fixed overhead"
          subtitle="Shared cost across active projects."
          value={currency(totals.fixed)}
          extraLines={[
            activeProjects === null
              ? "Active price projects: loading…"
              : `Active price projects: ${activeProjects}`,
            activeProjects && activeProjects > 0 && totals.fixed > 0
              ? `Per project allocation: ${currency(
                  fixedPerProject
                )} (${fixedAllocationPercent.toFixed(1)}% each)`
              : "Per project allocation: waiting for data",
          ]}
        />
        <KpiCard
          title="Crew rate"
          subtitle="USD per person per day"
          value={currency(crewRate)}
          extraLines={["crew_cost = crew_count × crew_rate"]}
        />
        <KpiCard
          title="Truck rate"
          subtitle="USD per truck per day"
          value={currency(truckRate)}
          extraLines={["truck_cost = truck_count × truck_rate"]}
        />
      </section>

      {/* FIXED MANAGER */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-800">
            Expenses groups manager
          </span>
          <span className="text-slate-500">
            Click Edit to load fixed rows above
          </span>
        </div>

        <div className="space-y-2.5">
          {totals.fixedCount > 0 ? (
            <GroupCard
              label="FIXED OVERHEAD"
              rowsCount={totals.fixedCount}
              total={totals.fixed}
              items={fixed}
              onEdit={handleEditFixed}
              onDelete={() => setPendingDeleteCategory("fixed")}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              No fixed overhead rows yet. Add at least one row and save.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// ====== SMALL COMPONENTS ======
function KpiCard({
  title,
  subtitle,
  value,
  extraLines,
}: {
  title: string;
  subtitle: string;
  value: string;
  extraLines?: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-sm">
      <span className="text-slate-800 font-semibold text-[11px]">
        {title}
      </span>
      <span className="block text-[10px] text-slate-500">{subtitle}</span>
      <span className="block mt-1 text-[14px] font-semibold text-emerald-600">
        {value}
      </span>
      {extraLines && extraLines.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {extraLines.map((line, idx) => (
            <span key={idx} className="block text-[10px] text-slate-500">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * GroupCard con Show/Hide (igual idea que en AdminPrices):
 * - Solo cambia la UI a paleta clara.
 */
function GroupCard({
  label,
  rowsCount,
  total,
  items = [],
  onEdit,
  onDelete,
}: {
  label: string;
  rowsCount: number;
  total: number;
  items?: ExpenseItem[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-semibold tracking-wide text-slate-900 uppercase whitespace-normal break-words">
              {label}
            </span>
            <span className="text-[10px] text-slate-500 whitespace-normal break-words">
              {rowsCount} rows registered
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-right">
            <span className="block text-[10px] text-slate-500">Total</span>
            <span className="block text-[14px] font-semibold text-emerald-600">
              {currency(total)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-end gap-1.5 flex-wrap">
            <button
              type="button"
              title="Show/Hide details"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100 active:scale-95"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide" : "Show"}
            </button>

            <button
              type="button"
              title="Edit group"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100 active:scale-95"
              onClick={onEdit}
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </button>

            <button
              type="button"
              title="Delete group"
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] text-rose-700 hover:bg-rose-100 active:scale-95"
              onClick={onDelete}
            >
              <XCircle className="w-3 h-3" />
              Del
            </button>
          </div>
        </div>
      </div>

      {/* DETAILS */}
      {expanded && items.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_1fr] px-3 py-1.5 text-[10px] bg-slate-100 text-slate-600">
            <span>Label</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="divide-y divide-slate-200">
            {items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[minmax(0,2fr)_1fr] px-3 py-1.5 text-[11px] items-center bg-white"
              >
                <span className="text-slate-700 truncate">{it.label}</span>
                <span className="text-right text-emerald-600 font-medium">
                  {currency(it.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && items.length === 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          No fixed rows to show yet.
        </div>
      )}
    </div>
  );
}

export default AdminExpenses;
