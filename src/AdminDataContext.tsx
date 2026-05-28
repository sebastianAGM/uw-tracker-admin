// src/AdminDataContext.tsx
// ─────────────────────────────────────────────────────────────
// Shared data layer — fetches price-lists, submissions, expenses
// and settings ONCE and shares them with all admin components.
// Each tab consumes useAdminData() instead of fetching on its own.
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getStoredToken } from "./lib/priceApi";

// ─── Config ──────────────────────────────────────────────────
const API_BASE = "";

// ─── Types ───────────────────────────────────────────────────
export interface PriceListSummary {
  id: string;
  name: string;
  is_active?: boolean;
  status?: "draft" | "completed" | "archived";
  customer?: string | null;
  project_manager?: string | null;
  project_code?: string | null;
  project_number?: string | null;
  po_number?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  is_mdu?: boolean | number | null;
  mdu_start_date?: string | null;
  mdu_close_out_by?: string | null;
  mdu_po_amount?: number | null;
  mdu_total_amount?: number | null;
  mdu_hour_rate?: number | null;
  subtotal?: number;
  created_at?: string;
}

export interface SubmissionRow {
  id: string;
  date: string | null;
  project: string | null;
  project_code?: string | null;
  project_label?: string | null;
  project_id?: string | null;
  customer: string | null;
  jobsite: string | null;
  entries_json?: any;
  entries?: any;
  expenses?: any;
}

export interface ExpenseRow {
  id: string;
  date?: string | null;
  project?: string | null;
  amount?: number;
  category?: string | null;
  description?: string | null;
  [key: string]: any;
}

export interface RatesPayload {
  crew_per_day: number;
  truck_per_day: number;
}

export interface AppSettings {
  general?: {
    currency?: string;
    weekStartsOn?: string;
  };
  overhead?: {
    dailyFixedAmount?: number;
    distributionRule?: string;
  };
  ui?: {
    priceListDefaultSort?: string;
    defaultAccordionState?: string;
  };
  rates?: {
    crew_per_day?: number;
    truck_per_day?: number;
  };
}

interface AdminDataState {
  // Data
  lists: PriceListSummary[];
  submissions: SubmissionRow[];
  expenses: ExpenseRow[];
  settings: AppSettings;
  rates: RatesPayload;

  // Status
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  refresh: () => Promise<void>;
  refreshLists: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────
const AdminDataContext = createContext<AdminDataState | null>(null);

// ─── Hook ────────────────────────────────────────────────────
export function useAdminData(): AdminDataState {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error("useAdminData must be used inside <AdminDataProvider>");
  }
  return ctx;
}

// ─── Fetch helper ────────────────────────────────────────────
async function authFetch(url: string): Promise<Response> {
  const token = getStoredToken();
  return fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function normalizeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.lists)) return data.lists;
  if (Array.isArray(data?.price_lists)) return data.price_lists;
  if (Array.isArray(data?.submissions)) return data.submissions;
  if (Array.isArray(data?.expenses)) return data.expenses;
  return [];
}

// ─── Provider ────────────────────────────────────────────────
interface Props {
  children: React.ReactNode;
}

export function AdminDataProvider({ children }: Props) {
  const [lists, setLists] = useState<PriceListSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [rates, setRates] = useState<RatesPayload>({
    crew_per_day: 0,
    truck_per_day: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Prevent double fetch in React StrictMode
  const fetchingRef = useRef(false);

  // ── Full refresh (all endpoints in parallel) ──────────────
  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [listsRes, subsRes, expensesRes, settingsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/price-lists`),
        authFetch(`${API_BASE}/api/submissions?limit=500`),
        authFetch(`${API_BASE}/api/expenses`),
        authFetch(`${API_BASE}/api/settings`),
      ]);

      // Price lists
      if (listsRes.ok) {
        const data = await listsRes.json();
        setLists(normalizeArray(data));
      }

      // Submissions
      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubmissions(normalizeArray(data));
      }

      // Expenses
      if (expensesRes.ok) {
        const data = await expensesRes.json();
        setExpenses(normalizeArray(data));
      }

      // Settings + rates
      if (settingsRes.ok) {
        const data: AppSettings = await settingsRes.json();
        setSettings(data);
        const r = data?.rates || {};
        setRates({
          crew_per_day: Number(r.crew_per_day ?? 0) || 0,
          truck_per_day: Number(r.truck_per_day ?? 0) || 0,
        });
      }

      setLastFetched(Date.now());
    } catch (e: any) {
      console.error("[AdminDataContext] fetch error:", e);
      setError("Error loading data. Please try again.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // ── Refresh only price lists (after creating/editing a list) ─
  const refreshLists = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/price-lists`);
      if (res.ok) {
        const data = await res.json();
        setLists(normalizeArray(data));
      }
    } catch (e) {
      console.error("[AdminDataContext] refreshLists error:", e);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value: AdminDataState = {
    lists,
    submissions,
    expenses,
    settings,
    rates,
    loading,
    error,
    lastFetched,
    refresh,
    refreshLists,
  };

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}
