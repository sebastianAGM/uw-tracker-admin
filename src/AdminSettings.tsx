// src/AdminSettings.tsx
import React, { useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";

const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";
const SETTINGS_ENDPOINT = `${API_BASE}/api/settings`;
const ADMIN_TOKEN = "3amigos";

// ====== TIPOS ======
type Currency = "USD" | "EUR" | "CLP";
type WeekStart = "monday" | "sunday";
type DistributionRule = "all-active" | "only-with-production" | "single-project";
type PriceListSort = "name" | "customer" | "last-updated";
type AccordionState = "open-all" | "closed-all" | "remember-last";

interface AppSettings {
  general: {
    currency: Currency;
    weekStartsOn: WeekStart;
  };
  overhead: {
    dailyFixedAmount: number;
    distributionRule: DistributionRule;
  };
  ui: {
    priceListDefaultSort: PriceListSort;
    defaultAccordionState: AccordionState;
  };
}

interface Props {
  onClose?: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    currency: "USD",
    weekStartsOn: "monday",
  },
  overhead: {
    dailyFixedAmount: 0,
    distributionRule: "all-active",
  },
  ui: {
    priceListDefaultSort: "name",
    defaultAccordionState: "open-all",
  },
};

const AdminSettings: React.FC<Props> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(SETTINGS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("GET /api/settings failed:", res.status, text);
        throw new Error("Unable to load settings");
      }

      const json = (await res.json()) as Partial<AppSettings>;

      const merged: AppSettings = {
        general: {
          ...DEFAULT_SETTINGS.general,
          ...(json.general || {}),
        },
        overhead: {
          ...DEFAULT_SETTINGS.overhead,
          ...(json.overhead || {}),
        },
        ui: {
          ...DEFAULT_SETTINGS.ui,
          ...(json.ui || {}),
        },
      };

      setSettings(merged);
    } catch (e: any) {
      console.error("loadSettings error:", e);
      setError(e?.message || "Error loading settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      setSaveMessage(null);

      const res = await fetch(SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("PUT /api/settings failed:", res.status, text);
        throw new Error("Unable to save settings");
      }

      setSaveMessage("Settings saved");

      // ⬅️ CERRAR SETTINGS AL GUARDAR
      if (onClose) {
        onClose();
      }
    } catch (e: any) {
      console.error("handleSave error:", e);
      setError(e?.message || "Error saving settings");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 2500);
    }
  }

  // ====== UPDATERS TIPADOS ======
  function updateGeneralField<K extends keyof AppSettings["general"]>(
    field: K,
    value: AppSettings["general"][K]
  ) {
    setSettings((prev) => ({
      ...prev,
      general: {
        ...prev.general,
        [field]: value,
      },
    }));
  }

  function updateUiField<K extends keyof AppSettings["ui"]>(
    field: K,
    value: AppSettings["ui"][K]
  ) {
    setSettings((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        [field]: value,
      },
    }));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="text-[13px] font-semibold text-slate-900">
            App settings
          </h1>
          <p className="text-[11px] text-slate-500">
            Configure currency, week start and default UI behavior for UW
            Tracker.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-95"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          <span>Reload</span>
        </button>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      {saveMessage && !error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
          {saveMessage}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-[11px] text-slate-600">
          Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          {/* GENERAL */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <h2 className="text-[11px] font-semibold text-slate-800 mb-1">
              General
            </h2>
            <p className="text-[10px] text-slate-500 mb-3">
              Base currency and week start for charts, reports and invoices.
            </p>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-800">Currency</label>
                <select
                  value={settings.general.currency}
                  onChange={(e) =>
                    updateGeneralField("currency", e.target.value as Currency)
                  }
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="USD">USD – US Dollar</option>
                  <option value="EUR">EUR – Euro</option>
                  <option value="CLP">CLP – Chilean Peso</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-800">Week starts on</label>
                <select
                  value={settings.general.weekStartsOn}
                  onChange={(e) =>
                    updateGeneralField(
                      "weekStartsOn",
                      e.target.value as WeekStart
                    )
                  }
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>
          </section>

          {/* UI BEHAVIOR */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <h2 className="text-[11px] font-semibold text-slate-800 mb-1">
              UI behavior
            </h2>
            <p className="text-[10px] text-slate-500 mb-3">
              How price lists and accordions behave by default in admin views.
            </p>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-800">
                  Price lists default sort
                </label>
                <select
                  value={settings.ui.priceListDefaultSort}
                  onChange={(e) =>
                    updateUiField(
                      "priceListDefaultSort",
                      e.target.value as PriceListSort
                    )
                  }
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="name">By name</option>
                  <option value="customer">By customer</option>
                  <option value="last-updated">Last updated</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-800">
                  Accordions default state
                </label>
                <select
                  value={settings.ui.defaultAccordionState}
                  onChange={(e) =>
                    updateUiField(
                      "defaultAccordionState",
                      e.target.value as AccordionState
                    )
                  }
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="open-all">Open all</option>
                  <option value="closed-all">Closed all</option>
                  <option value="remember-last">Remember last state</option>
                </select>
              </div>
            </div>
          </section>

          {/* Nota pequeña sobre overhead para el futuro (sin campos) */}
          <p className="text-[10px] text-slate-500 px-1">
            Overhead &amp; project distribution is currently managed from the{" "}
            <span className="font-semibold text-emerald-700">Expenses</span>{" "}
            module. You can wire these settings later if needed.
          </p>

          {/* LEGAL / COPYRIGHT */}
          <section className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <h2 className="text-[11px] font-semibold text-slate-800 mb-1">
              Legal
            </h2>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              © 2026 Utility Works LLC. All rights reserved.
              <br />
              This software is proprietary and licensed for internal use only.
              <br />
              Unauthorized copying, modification, distribution, or sublicensing
              is prohibited.
            </p>
          </section>

          {/* SAVE BUTTON */}
          <div className="pt-1 flex justify-end border-t border-slate-200 mt-1 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={13} />
              {isSaving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminSettings;
