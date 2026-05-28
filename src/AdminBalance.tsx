// src/AdminBalance.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Factory,
  Layers,
  DollarSign,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AdminSpreadsheet from "./AdminSpreadsheet";
import {
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart as RBarChart,
  Bar,
  LabelList,
  LineChart as RLineChart,
  Line,
} from "recharts";

import {
  normalizeRows,
  PriceListSummary,
  SubmissionRow,
  PriceListDetails,
  RatesPayload,
  buildListKeyIndex,
  matchSubmissionToListId,
  buildPriceMapForList,
  calcRevenueForSubmission,
  calcActualExpensesFromSubmission,
  calcResourceCostFromSubmission,
  extractTasksFromSubmission,
  calcMDUConsumedPct,
  calcMDURemainingBudget,
  getMDUContractTotal,
  getWorkedHoursFromSubmission,
  isMDUPriceList,
  getCompositeUnitPrice,
} from "./lib/uwCalc";

import {
  generateBalancePdf,
  AdminBalanceReport,
} from "./lib/generateBalancePdf";

import {
  DAY_KEYS,
  MONTH_LABELS_SHORT,
  buildOverviewWeekDataForProject,
  DailyDetail,
  OverviewWeekSeriesPoint,
} from "./lib/overviewHistory";


import { getCsvTaskLabel } from "./lib/csvTaskLabels";

// ================== CONFIG BACKEND ==================
const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";
const SUBMISSIONS_ENDPOINT = `${API_BASE}/api/submissions?limit=500`;
const PRICE_LISTS_ENDPOINT = `${API_BASE}/api/price-lists`;
const PRICE_LIST_DETAILS_ENDPOINT = (id: string) =>
  `${API_BASE}/api/price-lists/${id}`;
const EXPENSES_ENDPOINT = `${API_BASE}/api/expenses`;
const SETTINGS_ENDPOINT = `${API_BASE}/api/settings`;
const ADMIN_TOKEN = "3amigos";

// ================== HELPERS ==================
function formatCurrency(n: number | undefined | null): string {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

function formatQty(n: number | undefined | null): string {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clampISO(v: string | null | undefined) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseISODate(v: string | null | undefined): Date | null {
  const s = clampISO(v);
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeekSunday(d: Date): Date {
  const end = new Date(startOfWeekMonday(d));
  end.setDate(end.getDate() + 6);
  return end;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

function inRangeDate(rowDate: string | null, from: string, to: string) {
  const d = clampISO(rowDate);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function getRatesFromExpensesPayload(payload: any): RatesPayload {
  const p = payload || {};
  const rates = p.rates || {};
  return {
    crew_per_day: Number(rates.crew_per_day ?? 0) || 0,
    truck_per_day: Number(rates.truck_per_day ?? 0) || 0,
  };
}

function rateForTask(
  priceMap: Map<string, number> | undefined,
  canonTaskKey: string,
  variantCode?: string | null
): number {
  if (!priceMap) return 0;

  const task = String(canonTaskKey || "").trim().toUpperCase();
  const variant = String(variantCode || "").trim().toUpperCase();

  const key = `${task}::${variant}`;
  const fallback = `${task}::`;

  return Number(priceMap.get(key) ?? priceMap.get(fallback) ?? 0) || 0;
}

function resolveVariant(task: any): string | null {
  const raw =
    task?.variant_code ??
    task?.variantCode ??
    task?.variant ??
    task?.soil_type ??
    task?.soilType ??
    task?.soil ??
    task?.bore_type ??
    task?.boreType ??
    task?.ground_type ??
    task?.groundType ??
    task?.type ??
    task?.meta?.variant_code ??
    task?.meta?.soil_type ??
    task?.meta?.bore_type ??
    null;

  const normalized = String(raw ?? "").trim().toUpperCase();
  if (!normalized || normalized === "DIRT") return null;
  return normalized;
}


const MISSILE_ROW_TASK_MAP: Record<string, string> = {
  missile_shot_qty: "MISSILE_SHOT_EA",

  curb_shot_qty: "MISSILE_CURB_SHOT_EA",

  curb_sidewalk_shot_qty:
    "MISSILE_CURB_SIDEWALK_SHOT_EA",

  stub_shot_qty: "MISSILE_STUB_SHOT_EA",

  curb_dig_qty: "MISSILE_CURB_DIG_EA",

  db_dig_deep_cut_qty:
    "DB_DIG_DEEP_CUT_EA",

  softscape_ft: "MISSILE_SOFTSCAPE_FT",

  hardscape_ft: "MISSILE_HARDSCAPE_FT",
};


function resolveMissileTaskKey(shotType: any): string {
  const raw = String(shotType || "").trim();

  return (
    MISSILE_ROW_TASK_MAP[raw] ||
    MISSILE_ROW_TASK_MAP[raw.toLowerCase()] ||
    MISSILE_ROW_TASK_MAP[raw.toUpperCase()] ||
    raw.toUpperCase()
  );
}

const MISSILE_TASK_KEYS = new Set([
  ...Object.values(MISSILE_ROW_TASK_MAP).map((k) => String(k).toUpperCase()),

  "MISSILE_SHOT_EA",
  "MISSILE_CURB_SHOT_EA",
  "MISSILE_CURB_DIG_EA",
  "MISSILE_CURB_SIDEWALK_SHOT_EA",
  "MISSILE_STUB_SHOT_EA",
  "DB_DIG_DEEP_CUT_EA",
  "MISSILE_DB_DIG_ONLY_EA",
  "MISSILE_SOFTSCAPE_FT",
  "MISSILE_HARDSCAPE_FT",
  "MISSILE_B2_CURB_SHOT_ONLY_EA",
  "MISSILE_B2_CURB_SHOT_DB_DIG_EA",
]);



const MISSILE_ROW_LABEL_MAP: Record<string, { label: string; unit: "ea" | "ft" }> = {
  missile_shot_qty: { label: "Missile shot", unit: "ea" },
  curb_shot_qty: { label: "Curb shot", unit: "ea" },
  curb_sidewalk_shot_qty: { label: "Curb + sidewalk shot", unit: "ea" },
  stub_shot_qty: { label: "Stub shot", unit: "ea" },
  curb_dig_qty: { label: "Curb & Dig", unit: "ea" },
  db_dig_deep_cut_qty: { label: "DB Dig Deep Cut", unit: "ea" },
  softscape_ft: { label: "Softscape", unit: "ft" },
  hardscape_ft: { label: "Hardscape", unit: "ft" },
};

function safeObject(value: any): any {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

function getMissileRowsForCsv(sub: SubmissionRow): any[] {
  function findMissileRows(obj: any): any[] {
    if (!obj || typeof obj !== "object") return [];

    if (Array.isArray(obj?.MISILE_SHOT?.missile_rows)) {
      return obj.MISILE_SHOT.missile_rows;
    }

    if (Array.isArray(obj?.production?.tasks?.MISILE_SHOT?.missile_rows)) {
      return obj.production.tasks.MISILE_SHOT.missile_rows;
    }

    if (Array.isArray(obj?.payload?.production?.tasks?.MISILE_SHOT?.missile_rows)) {
      return obj.payload.production.tasks.MISILE_SHOT.missile_rows;
    }

    if (Array.isArray(obj?.payload?.payload?.production?.tasks?.MISILE_SHOT?.missile_rows)) {
      return obj.payload.payload.production.tasks.MISILE_SHOT.missile_rows;
    }

    if (Array.isArray(obj?.tasks?.MISILE_SHOT?.missile_rows)) {
      return obj.tasks.MISILE_SHOT.missile_rows;
    }

    return [];
  }

  const roots = [
    sub,
    safeObject((sub as any).entries_json),
    safeObject((sub as any).entries),
    safeObject((sub as any).payload),
  ];

  return roots.map(findMissileRows).find((rows) => rows.length > 0) || [];
}

function getMissileTaskFromRow(row: any): any | null {
  const qty = Number(row?.qty ?? row?.quantity ?? 0) || 0;
  if (qty <= 0) return null;

  const shotType = String(
    row?.shot_type ??
      row?.type ??
      row?.task_key ??
      row?.taskKey ??
      row?.key ??
      ""
  ).trim();

  const task_key = resolveMissileTaskKey(shotType);

  if (!task_key) return null;

  const meta =
    MISSILE_ROW_LABEL_MAP[shotType] ||
    MISSILE_ROW_LABEL_MAP[shotType.toLowerCase()] || {
      label: mapTaskLabel(task_key),
      unit: task_key.endsWith("_FT") ? "ft" : "ea",
    };

  return {
    task_key,
    qty,
    quantity: qty,
    label: meta.label,
    unit: meta.unit,
  };
}

function extractBalanceTasksFromSubmission(sub: SubmissionRow): any[] {
  const missileRows = getMissileRowsForCsv(sub);
  const baseTasks = extractTasksFromSubmission(sub) || [];

  const safeBaseTasks = missileRows.length
    ? baseTasks.filter((task: any) => {
        const taskKey = String(task?.task_key || "").trim().toUpperCase();
        return !MISSILE_TASK_KEYS.has(taskKey);
      })
    : baseTasks;

  const missileTasks = missileRows
    .map(getMissileTaskFromRow)
    .filter(Boolean);

  return [...safeBaseTasks, ...missileTasks];
}

function calcBalanceRevenueForSubmission(
  sub: SubmissionRow,
  listId: string,
  priceMapsByListId: Record<string, Map<string, number>>
): number {
  const priceMap = priceMapsByListId[listId];
  if (!priceMap) return 0;

  return extractBalanceTasksFromSubmission(sub).reduce((sum: number, task: any) => {
    const taskKey = String(task?.task_key || "").trim();
    const qty = Number(task?.qty ?? task?.quantity ?? 0) || 0;
    if (!taskKey || qty <= 0) return sum;

    const variant = MISSILE_TASK_KEYS.has(taskKey.toUpperCase())
      ? null
      : resolveVariant(task);
    const unitPrice = getCompositeUnitPrice(priceMap, taskKey, variant);

    return sum + qty * unitPrice;
  }, 0);
}

function withMissileRowsAsLegacyTotals(sub: SubmissionRow): SubmissionRow {
  const missileRows = getMissileRowsForCsv(sub);
  if (!missileRows.length) return sub;

  const totals: Record<string, number> = {};

  missileRows.forEach((row: any) => {
    const shotType = String(row?.shot_type || "").trim();
    const qty = Number(row?.qty) || 0;
    if (!shotType || qty <= 0) return;
    totals[shotType] = (totals[shotType] || 0) + qty;
  });

  const root = safeObject((sub as any).entries_json ?? (sub as any).entries);

  const nextRoot = {
    ...root,
    production: {
      ...(root.production || {}),
      tasks: {
        ...(root.production?.tasks || {}),
        MISILE_SHOT: {
          ...(root.production?.tasks?.MISILE_SHOT || {}),
          ...totals,
        },
      },
    },
  };

  return {
    ...sub,
    entries_json: nextRoot,
  } as SubmissionRow;
}

function prettyName(key: unknown): string {
  if (typeof key !== "string") return "";
  return key
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function mapTaskLabel(taskKey: string): string {
  const k = String(taskKey || "").trim().toUpperCase();

  if (k === "TRACER_INSTALLATION_FT") return "Tracer Installation";

  return prettyName(k);
}

function getMonthWeekNumberMonday(d: Date): number {
  const monthStart = startOfMonth(d);
  const firstWeekStart = startOfWeekMonday(monthStart);
  const currentWeekStart = startOfWeekMonday(d);

  const diffMs = currentWeekStart.getTime() - firstWeekStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  return diffWeeks + 1;
}

function getWeekLabelFromRange(
  weekStart: Date,
  weekEnd: Date,
  monthAnchor?: Date
): string {
  let anchor = new Date(weekStart);

  // Si la semana empieza en el mes anterior,
  // pero cruza dentro del mes seleccionado, usar el día 1 del mes.
  if (monthAnchor) {
    const monthStart = startOfMonth(monthAnchor);

    if (
      weekStart.getTime() < monthStart.getTime() &&
      weekEnd.getTime() >= monthStart.getTime()
    ) {
      anchor = monthStart;
    }
  }

  const monthLabel = MONTH_LABELS_SHORT[anchor.getMonth()] || "";
  const weekNum = getMonthWeekNumberMonday(anchor);

  return `${monthLabel} W${weekNum}`;
}

function sortWeekOptionsNewestFirst(weeks: WeekOption[]): WeekOption[] {
  return [...weeks].sort((a, b) => {
    const da = parseISODate(a.start)?.getTime() || 0;
    const db = parseISODate(b.start)?.getTime() || 0;
    return da - db;
  });
}



// ================== SPREADSHEET (CSV) ==================
const INVOICE_HEADERS = [
  "*InvoiceNo",
  "*Customer",
  "*InvoiceDate",
  "*DueDate",
  "Terms",
  "Location",
  "Memo",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "*ItemAmount",
  "ServiceDate",
];

// ================== TYPES LOCALES ==================
type DistributionRule = "all-active" | "only-with-production" | "single-project";

type BalanceRange =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "ytd"
  | "since_first_submission_week";

interface ProjectRow {
  id: string;
  code?: string | null;
  name: string;
  customer?: string;
  revenue: number;
  expenses: number;
  net: number;
  marginPct: number;
}

interface WeeklyPoint {
  w: string;
  revenue: number;
  expenses: number;
  profit: number;
  marginPct: number;
  weekKey?: string;
}

interface MduBurnPoint {
  d: string;
  remaining: number;
  burn: number;
  consumed: number;
  iso?: string;
}

interface MduDayRow {
  date: string;
  burn: number;
  accumulated: number;
  remaining: number;
}

interface BreakdownRow {
  label: string;
  value: number;
  pct: number;
}

interface UwExtractedTask {
  task_key?: string;
  group?: string | null;
  label?: string | null;
  task_label?: string | null;
  unit?: string | null;
  uom?: string | null;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  unitPrice?: number;
  price_per_unit?: number;
  price?: number;
  line_total?: number;
  lineTotal?: number;
}

interface AggregatedTask {
  group: string;
  task_key: string;
  label: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface DayAggregate {
  tasksMap: Map<string, AggregatedTask>;
  totalRevenue: number;
}

interface WeekOption {
  key: string;
  label: string;
  start: string;
  end: string;
  dates: string[];
}

type DayPillInfo = {
  key: string;
  label: string;
  hasData: boolean;
  dateISO: string | null;
};

// ================== COMPONENTE ==================
export const AdminBalance: React.FC = () => {
  const [range, setRange] = useState<BalanceRange>("this_month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, PriceListDetails>>({});
  const [rates, setRates] = useState<RatesPayload>({
    crew_per_day: 0,
    truck_per_day: 0,
  });

  const [dailyFixedAmount, setDailyFixedAmount] = useState<number>(0);
  const [distributionRule, setDistributionRule] =
    useState<DistributionRule>("all-active");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    "active" | "completed" | "all"
  >("active");

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [selectedDayKey, setSelectedDayKey] = useState<string>("Mon");
  const [showHistoricalSnapshot, setShowHistoricalSnapshot] = useState(false);

  const detailsLoadingRef = React.useRef<Set<string>>(new Set());

  async function ensureDetailsLoaded(listId: string) {
    if (!listId) return;
    if (detailsById[listId]) return;
    if (detailsLoadingRef.current.has(listId)) return;

    detailsLoadingRef.current.add(listId);

    try {
      const res = await fetch(PRICE_LIST_DETAILS_ENDPOINT(listId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      });

      const raw = await res.text();
      const json = raw ? JSON.parse(raw) : null;
      if (!res.ok || json?.ok === false) return;

      const prices = normalizeRows(json.prices).map((p: any) => ({
        task_key: String(p.task_key || p.task || p.key || "").trim(),
        unit: p.unit ?? null,
        price_per_unit:
          Number(p.price_per_unit ?? p.price ?? p.value ?? 0) || 0,
        variant_code: p.variant_code ?? p.variantCode ?? null,
      }));

      setDetailsById((prev) => ({
        ...prev,
        [listId]: {
          list: json.list,
          prices,
        },
      }));
    } catch (e) {
      console.error(e);
    } finally {
      detailsLoadingRef.current.delete(listId);
    }
  }

  async function refreshDetails(listId: string) {
    if (!listId) return;
    if (detailsLoadingRef.current.has(listId)) return;

    detailsLoadingRef.current.add(listId);

    try {
      const res = await fetch(PRICE_LIST_DETAILS_ENDPOINT(listId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
      });

      const raw = await res.text();
      const json = raw ? JSON.parse(raw) : null;
      if (!res.ok || json?.ok === false) return;

      const prices = normalizeRows(json.prices).map((p: any) => ({
        task_key: String(p.task_key || p.task || p.key || "").trim(),
        unit: p.unit ?? null,
        price_per_unit:
          Number(p.price_per_unit ?? p.price ?? p.value ?? 0) || 0,
        variant_code: p.variant_code ?? p.variantCode ?? null,
      }));

      setDetailsById((prev) => ({
        ...prev,
        [listId]: {
          list: json.list,
          prices,
        },
      }));
    } catch (e) {
      console.error(e);
    } finally {
      detailsLoadingRef.current.delete(listId);
    }
  }

  useEffect(() => {
    setShowHistoricalSnapshot(false);
  }, [selectedProjectId, selectedWeekKey]);

  useEffect(() => {
    async function loadBalanceData() {
      setLoading(true);
      setError(null);

      try {
        const settingsPromise = fetch(SETTINGS_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }).then((r) => r.json().catch(() => ({})));

        const submissionsPromise = fetch(SUBMISSIONS_ENDPOINT).then((r) =>
          r.json().catch(() => ({}))
        );

        const priceListsPromise = fetch(PRICE_LISTS_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }).then((r) => r.json().catch(() => ({})));

        const expensesPromise = fetch(EXPENSES_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }).then((r) => r.json().catch(() => ({})));

        const [settingsJson, submissionsJson, priceListsJson, expensesJson] =
          await Promise.all([
            settingsPromise,
            submissionsPromise,
            priceListsPromise,
            expensesPromise,
          ]);

        const overhead = settingsJson?.settings?.overhead || {};
        const daily = Number(overhead.dailyFixedAmount ?? 0) || 0;
        if (daily > 0) setDailyFixedAmount(daily);

        const rule = overhead.distributionRule;
        if (
          rule === "all-active" ||
          rule === "only-with-production" ||
          rule === "single-project"
        ) {
          setDistributionRule(rule);
        }

        const subRows = normalizeRows(
          submissionsJson?.rows ?? submissionsJson
        ) as SubmissionRow[];
        setSubs(subRows);

        const lists = normalizeRows(
          priceListsJson?.lists ?? priceListsJson
        ) as PriceListSummary[];
        setPriceLists(lists);

        const payload = expensesJson?.payload || {};
        setRates(getRatesFromExpensesPayload(payload));

        if (!daily || daily <= 0) {
          const fixedItems = Array.isArray(payload.fixed) ? payload.fixed : [];
          const fixedTotal = fixedItems.reduce(
            (sum: number, it: any) => sum + (Number(it.amount) || 0),
            0
          );
          const perDayFromExpenses = fixedTotal > 0 ? fixedTotal / 30 : 0;
          if (perDayFromExpenses > 0) {
            setDailyFixedAmount(perDayFromExpenses);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Error loading balance data");
      } finally {
        setLoading(false);
      }
    }

    loadBalanceData();
  }, []);

  const listKeyIndex = useMemo(() => buildListKeyIndex(priceLists), [priceLists]);

  const filteredProjectLists = useMemo(() => {
    return priceLists.filter((pl) => {
      const isCompleted = pl.status === "completed";
      if (projectStatusFilter === "active") return !isCompleted;
      if (projectStatusFilter === "completed") return isCompleted;
      return true;
    });
  }, [priceLists, projectStatusFilter]);

  const projectOptions = useMemo(
    () => [
      { id: "", label: "Select project", customer: "" },
      ...filteredProjectLists.map((pl) => ({
        id: pl.id,
        label: pl.name || pl.project_code || pl.id,
        customer: pl.customer || "",
      })),
    ],
    [filteredProjectLists]
  );

  const selectedProject = useMemo(
    () =>
      !selectedProjectId
        ? null
        : priceLists.find((pl) => pl.id === selectedProjectId) || null,
    [priceLists, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProjectId) return;
    refreshDetails(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    const stillVisible = filteredProjectLists.some((pl) => pl.id === selectedProjectId);
    if (!stillVisible) {
      setSelectedProjectId("");
    }
  }, [selectedProjectId, filteredProjectLists]);

  const isMduProject = useMemo(() => {
    if (!selectedProject) return false;
    return isMDUPriceList(selectedProject as any);
  }, [selectedProject]);

  const showMduBalance = !!selectedProjectId && isMduProject;

  const allSubsForSelection = useMemo(() => {
    if (!selectedProjectId) return [];
    return subs.filter((sub) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      return listId === selectedProjectId;
    });
  }, [subs, selectedProjectId, listKeyIndex]);

  function applyQuickRange(nextRange: BalanceRange) {
    setRange(nextRange);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const y = today.getFullYear();
    const m = today.getMonth();

    if (nextRange === "this_week") {
      const start = startOfWeekMonday(today);
      setFromDate(isoDate(start));
      setToDate(isoDate(today));
      return;
    }

    if (nextRange === "last_week") {
      const currentWeekStart = startOfWeekMonday(today);
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      setFromDate(isoDate(start));
      setToDate(isoDate(end));
      return;
    }

   if (nextRange === "this_month") {
      const weekStart = startOfWeekMonday(today);
      const anchorMonth = weekStart.getMonth();
      const anchorYear = weekStart.getFullYear();

      setFromDate(isoDate(new Date(anchorYear, anchorMonth, 1)));
      setToDate(isoDate(today));
      return;
    }

    if (nextRange === "last_month") {
      setFromDate(isoDate(new Date(y, m - 1, 1)));
      setToDate(isoDate(new Date(y, m, 0)));
      return;
    }

    if (nextRange === "ytd") {
      setFromDate(isoDate(new Date(y, 0, 1)));
      setToDate(isoDate(today));
      return;
    }

    if (nextRange === "since_first_submission_week") {
      const firstDate = allSubsForSelection
        .map((s) => clampISO(s.date))
        .filter(Boolean)
        .sort()[0];

      if (firstDate) {
        const first = parseISODate(firstDate);
        if (first) {
          const start = startOfWeekMonday(first);
          setFromDate(isoDate(start));
          setToDate(isoDate(today));
          return;
        }
      }

      setFromDate("");
      setToDate(isoDate(today));
    }
  }

  useEffect(() => {
    if (fromDate || toDate) return;
    applyQuickRange("this_month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const subsInRange = useMemo(() => {
    const from = fromDate || "";
    const to = toDate || "";
    return subs.filter((s) => inRangeDate(s.date, from, to));
  }, [subs, fromDate, toDate]);

  const subsForView = useMemo(() => {
    if (!selectedProjectId) return [];
    return subsInRange.filter((sub) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      return listId === selectedProjectId;
    });
  }, [subsInRange, selectedProjectId, listKeyIndex]);

  useEffect(() => {
    if (range === "since_first_submission_week") {
      applyQuickRange("since_first_submission_week");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, subs.length]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!subs.length) return;

    setSelectedWeekKey("");
    setSelectedDayKey("Mon");
  }, [selectedProjectId, subs.length]);

  function computeFixedShareForSubmission(
    sub: SubmissionRow,
    listId: string
  ): number {
    if (!dailyFixedAmount || dailyFixedAmount <= 0) return 0;
    if (!sub.date) return 0;

    const dayKey = clampISO(sub.date);
    if (!dayKey) return 0;

    const projectIds = new Set<string>();

    if (distributionRule === "single-project") {
      projectIds.add(listId);
    } else if (distributionRule === "only-with-production") {
      subs.forEach((s: SubmissionRow) => {
        const d = clampISO(s.date);
        if (d !== dayKey) return;
        const lid = matchSubmissionToListId(s, listKeyIndex);
        if (lid) projectIds.add(lid);
      });
    } else {
      priceLists.forEach((pl) => {
        const isActive =
          pl.status !== "completed" &&
          (pl.is_active === 1 || pl.is_active === true);
        if (isActive) projectIds.add(pl.id);
      });

      if (projectIds.size === 0) {
        subs.forEach((s: SubmissionRow) => {
          const d = clampISO(s.date);
          if (d !== dayKey) return;
          const lid = matchSubmissionToListId(s, listKeyIndex);
          if (lid) projectIds.add(lid);
        });
      }
    }

    if (projectIds.size === 0) {
      projectIds.add(listId);
    }

    const perProjectDaily = dailyFixedAmount / projectIds.size;

    let submissionsSameProjectSameDay = 0;
    subs.forEach((s: SubmissionRow) => {
      if (clampISO(s.date) !== dayKey) return;
      const lid = matchSubmissionToListId(s, listKeyIndex);
      if (lid === listId) submissionsSameProjectSameDay++;
    });

    if (submissionsSameProjectSameDay <= 0) submissionsSameProjectSameDay = 1;

    return perProjectDaily / submissionsSameProjectSameDay;
  }

  const priceMapsByListId = useMemo(() => {
    const out: Record<string, Map<string, number>> = {};
    priceLists.forEach((pl) => {
      const det = detailsById[pl.id];
      if (!det) return;
      out[pl.id] = buildPriceMapForList(det.prices || []);
    });
    return out;
  }, [priceLists, detailsById]);

  const invoiceRows = useMemo(() => {
  const rows: (string | number)[][] = [];
  let customerWritten = false;

    const mapItemAndDescription = (taskKeyRaw: string, variant?: string | null) => {
      const k = String(taskKeyRaw || "").trim().toUpperCase();
      const cleanVariant = String(variant || "").trim().toUpperCase();
      const suffix = cleanVariant && cleanVariant !== "DIRT" ? ` · ${cleanVariant}` : "";

      const csvLabel = getCsvTaskLabel(k, cleanVariant);

      if (k === "VAULT_DVT_15_EA") return { item: "boxes", desc: "Vault Dvt 15" };
      if (k === "VAULT_SVT_15_EA") return { item: "boxes", desc: "Vault Svt 15" };
      if (k === "VAULT_DVT_22_EA") return { item: "boxes", desc: "Vault Dvt 22" };
      if (k === "VAULT_SVT_22_EA") return { item: "boxes", desc: "Vault Svt 22" };
      if (k === "VAULT_LVT_22_EA") return { item: "boxes", desc: "Vault Lvt 22" };
      if (k.startsWith("VAULT")) return { item: "boxes", desc: prettyName(k) };

      if (k === "TRACER_INSTALLATION_FT") {
        return { item: "service", desc: "Tracer Installation" };
      }

      if (k.includes("BORE")) {
  return { item: "service", desc: csvLabel };
}

return { item: "service", desc: csvLabel };
    };

    const toTitleCase = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getCustomerForCsv = (
  customer: string,
  projectManager: string
) => {
  if (customerWritten) return "";

  const value = [
    toTitleCase(customer),
    toTitleCase(projectManager),
  ]
    .filter(Boolean)
    .join(" For ");

  customerWritten = true;

  return value;
};

    subsForView.forEach((sub) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const pl = priceLists.find((x) => x.id === listId) || null;
      const det = detailsById[listId];

      const serviceDate = clampISO(sub.date) || "";
      if (!serviceDate) return;

      const customer =
        (det?.list?.customer ?? pl?.customer ?? sub.customer ?? "") || "";

      const projectName =
        (det?.list?.name ??
          pl?.name ??
          pl?.project_code ??
          sub.project ??
          listId) || "";

      const projectManager =
        ((det?.list as any)?.project_manager ??
          (pl as any)?.project_manager ??
          "") || "";

      const poNumber =
        (det?.list?.po_number ??
          pl?.po_number ??
          "") || "";

      const projectNumber =
        (det?.list?.project_number ??
          pl?.project_number ??
          pl?.project_code ??
          "") || "";

      const priceMap = priceMapsByListId[listId];
      if (!priceMap) return;

      const missileRows = getMissileRowsForCsv(sub);

      missileRows.forEach((row: any) => {
        const qty = Number(row?.qty) || 0;
        if (qty <= 0) return;

        const shotType = String(
  row?.shot_type ??
    row?.type ??
    row?.task_key ??
    row?.taskKey ??
    row?.key ??
    ""
).trim();

const taskKey = resolveMissileTaskKey(shotType);

const meta =
  MISSILE_ROW_LABEL_MAP[shotType] ||
  MISSILE_ROW_LABEL_MAP[shotType.toLowerCase()] || {
    label: mapTaskLabel(taskKey),
    unit: taskKey.endsWith("_FT") ? "ft" : "ea",
  };

if (!taskKey) return;

        const unitPrice = getCompositeUnitPrice(priceMap, taskKey, null);
        const amount = +(qty * unitPrice).toFixed(2);
        const rate = +unitPrice.toFixed(2);
        if (amount <= 0) return;

       rows.push([
          "",
          getCustomerForCsv(customer, projectManager),
          "",
          "",
          "",
          "",
          "",
          meta.unit === "ft" ? projectName : getCsvTaskLabel(taskKey, null),
          row?.address || "",
          qty,
          rate,
          amount,
          serviceDate,
        ]);
      });

      const baseTasks = extractTasksFromSubmission(sub) || [];
      const tasks = missileRows.length
        ? baseTasks.filter((t: any) => {
            const taskKey = String(t?.task_key || "").trim().toUpperCase();
            return !MISSILE_TASK_KEYS.has(taskKey);
          })
        : baseTasks;

      if (!tasks?.length) return;

      tasks.forEach((t: any) => {
        const taskKey = String(t.task_key || "").trim();
        const qty = Number(t.qty ?? t.quantity ?? 0) || 0;
        if (!taskKey || qty <= 0) return;

        const variant = resolveVariant(t);
        const unitPrice = getCompositeUnitPrice(priceMap, taskKey, variant);
        const amount = +(qty * unitPrice).toFixed(2);
        const rate = +unitPrice.toFixed(2);
        if (amount <= 0) return;

        const { item, desc } = mapItemAndDescription(taskKey, variant);

       rows.push([
              "",
              getCustomerForCsv(customer, projectManager),
              "",
              "",
              "",
              "",
              "",
              item,
              desc,
              qty,
              rate,
              amount,
              serviceDate,
            ]);
      });
    });

    return rows;
  }, [subsForView, listKeyIndex, priceMapsByListId, priceLists, detailsById]);

  const csvFilename = useMemo(() => {
    const base =
      selectedProject?.name || selectedProject?.project_code || selectedProjectId || "all";
    const safe = String(base).replace(/[^a-z0-9_-]+/gi, "_");
    return `balance_${safe}_${Date.now()}.csv`;
  }, [selectedProject, selectedProjectId]);

  const totals = useMemo(() => {
    let revenue = 0;
    let expenses = 0;

    subsForView.forEach((sub: SubmissionRow) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const rev = calcBalanceRevenueForSubmission(sub, listId, priceMapsByListId);
      const varExp =
        calcActualExpensesFromSubmission(sub) +
        calcResourceCostFromSubmission(sub, rates);
      const fixedShare = computeFixedShareForSubmission(sub, listId);

      revenue += rev;
      expenses += varExp + fixedShare;
    });

    return { revenue, expenses, net: revenue - expenses };
  }, [
    subsForView,
    listKeyIndex,
    priceMapsByListId,
    rates,
    dailyFixedAmount,
    distributionRule,
  ]);

  const globalProfitMargin =
    totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : 0;

  const mduBalance = useMemo(() => {
    if (!showMduBalance || !selectedProject) return null;

    const contractTotal = getMDUContractTotal(selectedProject as any);
    const hourRate = Number((selectedProject as any)?.mdu_hour_rate ?? 0) || 0;

    let consumed = 0;
    let laborTotal = 0;
    let truckTotal = 0;
    let actualExpensesTotal = 0;

    subsForView.forEach((sub: SubmissionRow) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (listId !== selectedProject.id) return;

      const exp: any = (sub as any).expenses || {};
      const crewCount = Number(exp.crewCount ?? exp.crew ?? exp.crew_count) || 0;
      const truckCount = Number(exp.truckCount ?? exp.trucks ?? exp.truck_count) || 0;
      const truckCost = truckCount * (Number(rates?.truck_per_day) || 0);
      const workedHours = getWorkedHoursFromSubmission(sub);
      const laborCost = crewCount * workedHours * hourRate;
      const actualExpenses = calcActualExpensesFromSubmission(sub) || 0;
      const used = laborCost + truckCost + actualExpenses;

      consumed += used;
      laborTotal += laborCost;
      truckTotal += truckCost;
      actualExpensesTotal += actualExpenses;
    });

    const remaining = calcMDURemainingBudget(contractTotal, consumed);
    const progressPct = calcMDUConsumedPct(contractTotal, consumed);

    return {
      poAmount: contractTotal,
      consumed,
      remaining,
      progressPct,
      laborTotal,
      truckTotal,
      actualExpensesTotal,
    };
  }, [showMduBalance, selectedProject, subsForView, listKeyIndex, rates]);

  const mduBurnSeries = useMemo<MduBurnPoint[]>(() => {
    if (!showMduBalance || !selectedProject) return [];

    const contractTotal = getMDUContractTotal(selectedProject as any);
    const hourRate = Number((selectedProject as any)?.mdu_hour_rate ?? 0) || 0;

    const byDay = new Map<
      string,
      { labor: number; trucks: number; actual: number; used: number }
    >();

    subsForView.forEach((sub: SubmissionRow) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (listId !== selectedProject.id) return;

      const day = clampISO(sub.date);
      if (!day) return;

      const exp: any = (sub as any).expenses || {};
      const crewCount = Number(exp.crewCount ?? exp.crew ?? exp.crew_count) || 0;
      const truckCount = Number(exp.truckCount ?? exp.trucks ?? exp.truck_count) || 0;

      const workedHours = getWorkedHoursFromSubmission(sub);
      const laborCost = crewCount * workedHours * hourRate;
      const truckCost = truckCount * (Number(rates?.truck_per_day) || 0);
      const actualExpenses = calcActualExpensesFromSubmission(sub) || 0;
      const used = laborCost + truckCost + actualExpenses;

      const prev = byDay.get(day) || {
        labor: 0,
        trucks: 0,
        actual: 0,
        used: 0,
      };

      prev.labor += laborCost;
      prev.trucks += truckCost;
      prev.actual += actualExpenses;
      prev.used += used;

      byDay.set(day, prev);
    });

    const sortedDays = Array.from(byDay.keys()).sort();
    let accumulated = 0;

    const series: MduBurnPoint[] = [
      {
        d: "Start",
        burn: 0,
        remaining: contractTotal,
        consumed: 0,
      },
    ];

    sortedDays.forEach((day) => {
      const bucket = byDay.get(day);
      const burn = bucket?.used || 0;
      accumulated += burn;

      series.push({
        d: day,
        iso: day,
        burn,
        consumed: accumulated,
        remaining: calcMDURemainingBudget(contractTotal, accumulated),
      });
    });

    return series;
  }, [showMduBalance, selectedProject, subsForView, listKeyIndex, rates]);

  const mduDayRows = useMemo<MduDayRow[]>(() => {
    if (!showMduBalance) return [];
    return mduBurnSeries
      .filter((row) => row.d !== "Start")
      .map((row) => ({
        date: row.iso || row.d,
        burn: row.burn,
        accumulated: row.consumed,
        remaining: row.remaining,
      }));
  }, [showMduBalance, mduBurnSeries]);

  const perProject: ProjectRow[] = useMemo(() => {
    const byId = new Map<string, ProjectRow>();

    subsForView.forEach((sub: SubmissionRow) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const pl = priceLists.find((x) => x.id === listId);

      let entry =
        byId.get(listId) ||
        ({
          id: listId,
          code: pl?.project_code ?? null,
          name: pl?.name || listId,
          customer: pl?.customer || "",
          revenue: 0,
          expenses: 0,
          net: 0,
          marginPct: 0,
        } as ProjectRow);

      const rev = calcBalanceRevenueForSubmission(sub, listId, priceMapsByListId);
      const varExp =
        calcActualExpensesFromSubmission(sub) +
        calcResourceCostFromSubmission(sub, rates);
      const fixedShare = computeFixedShareForSubmission(sub, listId);

      entry.revenue += rev;
      entry.expenses += varExp + fixedShare;
      entry.net = entry.revenue - entry.expenses;
      entry.marginPct =
        entry.revenue > 0 ? (entry.net / entry.revenue) * 100 : 0;

      byId.set(listId, entry);
    });

    return Array.from(byId.values()).sort((a, b) => b.revenue - a.revenue);
  }, [
    subsForView,
    listKeyIndex,
    priceMapsByListId,
    priceLists,
    rates,
    dailyFixedAmount,
    distributionRule,
  ]);

  const totalProjects = perProject.length;
  const totalActive = priceLists.filter((pl) => pl.status !== "completed").length;
  const totalCompleted = priceLists.filter((pl) => pl.status === "completed").length;

  // ================== WEEK OPTIONS ==================
  const weekOptions = useMemo<WeekOption[]>(() => {
    if (!selectedProjectId || !fromDate || !toDate) return [];

    const from = parseISODate(fromDate);
    const to = parseISODate(toDate);
    if (!from || !to) return [];

    const buildWeekDates = (weekStart: Date, weekEnd: Date): string[] => {
      return Array.from(
        new Set(
          subsForView
            .map((s) => clampISO(s.date))
            .filter(Boolean)
            .filter((d) => {
              const dt = parseISODate(d!);
              if (!dt) return false;

              return (
                dt.getTime() >= weekStart.getTime() &&
                dt.getTime() <= weekEnd.getTime()
              );
            }) as string[]
        )
      ).sort();
    };

    if (range === "this_month" || range === "last_month") {
  const monthDate = parseISODate(fromDate);
  if (!monthDate) return [];

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  let cursor = startOfWeekMonday(monthStart);
  const monthWeeks: WeekOption[] = [];

  while (cursor.getTime() <= monthEnd.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = endOfWeekSunday(weekStart);

    const dates = Array.from(
      new Set(
        subsForView
          .map((s) => clampISO(s.date))
          .filter(Boolean)
          .filter((d) => {
            const dt = parseISODate(d!);
            if (!dt) return false;

            return (
              dt.getFullYear() === monthDate.getFullYear() &&
              dt.getMonth() === monthDate.getMonth() &&
              dt.getTime() >= weekStart.getTime() &&
              dt.getTime() <= weekEnd.getTime()
            );
          }) as string[]
      )
    ).sort();

    monthWeeks.push({
      key: isoDate(weekStart),
      label: getWeekLabelFromRange(weekStart, weekEnd, monthDate),
      start: isoDate(weekStart),
      end: isoDate(weekEnd),
      dates,
    });

    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }

  // 🔥 ESTE RETURN FALTABA
  return monthWeeks.sort((a, b) => {
    const da = parseISODate(a.start)?.getTime() || 0;
    const db = parseISODate(b.start)?.getTime() || 0;
    return da - db;
  });
}

    const historicalWeeks: WeekOption[] = [];
    let cursor = startOfWeekMonday(from);

    while (cursor.getTime() <= to.getTime()) {
      const weekStart = new Date(cursor);
      const weekEnd = endOfWeekSunday(cursor);

      historicalWeeks.push({
        key: isoDate(weekStart),
        label: getWeekLabelFromRange(weekStart, weekEnd),
        start: isoDate(weekStart),
        end: isoDate(weekEnd),
        dates: buildWeekDates(weekStart, weekEnd),
      });

      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    }

    return sortWeekOptionsNewestFirst(historicalWeeks);
  }, [selectedProjectId, fromDate, toDate, subsForView, range]);

  useEffect(() => {
    if (!weekOptions.length) {
      setSelectedWeekKey("");
      return;
    }
    if (!selectedWeekKey || !weekOptions.some((w) => w.key === selectedWeekKey)) {
      setSelectedWeekKey(weekOptions[0].key);
    }
  }, [weekOptions, selectedWeekKey]);

  const selectedWeek = useMemo(
    () => weekOptions.find((w) => w.key === selectedWeekKey) || null,
    [weekOptions, selectedWeekKey]
  );

  // ================== CHART SERIES ==================
  const weeklySeries: WeeklyPoint[] = useMemo(() => {
    if (!selectedProjectId) return [];

    if (range === "ytd") {
      const byMonth = new Map<string, { revenue: number; expenses: number }>();

      subsForView.forEach((sub: SubmissionRow) => {
        const listId = matchSubmissionToListId(sub, listKeyIndex);
        if (!listId || !sub.date) return;

        const dt = new Date(sub.date);
        if (isNaN(dt.getTime())) return;

        const monthKey = getMonthKey(dt);
        const rev = calcBalanceRevenueForSubmission(sub, listId, priceMapsByListId);
        const varExp =
          calcActualExpensesFromSubmission(sub) +
          calcResourceCostFromSubmission(sub, rates);
        const fixedShare = computeFixedShareForSubmission(sub, listId);

        const bucket = byMonth.get(monthKey) || { revenue: 0, expenses: 0 };
        bucket.revenue += rev;
        bucket.expenses += varExp + fixedShare;
        byMonth.set(monthKey, bucket);
      });

      const sortedKeys = Array.from(byMonth.keys()).sort();

      return sortedKeys.map((key) => {
        const bucket = byMonth.get(key)!;
        const profit = bucket.revenue - bucket.expenses;
        const marginPct =
          bucket.revenue > 0 ? (profit / bucket.revenue) * 100 : 0;

        const dt = parseISODate(`${key}-01`);
        const label = dt ? MONTH_LABELS_SHORT[dt.getMonth()] : key;

        return {
          w: label,
          revenue: bucket.revenue,
          expenses: bucket.expenses,
          profit,
          marginPct,
          weekKey: key,
        };
      });
    }

    const seriesBase = weekOptions.map((week) => {
      let revenue = 0;
      let expenses = 0;

      subsForView.forEach((sub) => {
        const listId = matchSubmissionToListId(sub, listKeyIndex);
        if (!listId) return;

        const d = parseISODate(sub.date);
        if (!d) return;

        const start = parseISODate(week.start)!;
        const end = parseISODate(week.end)!;
        if (d.getTime() < start.getTime() || d.getTime() > end.getTime()) return;

        const rev = calcBalanceRevenueForSubmission(sub, listId, priceMapsByListId);
        const varExp =
          calcActualExpensesFromSubmission(sub) +
          calcResourceCostFromSubmission(sub, rates);
        const fixedShare = computeFixedShareForSubmission(sub, listId);

        revenue += rev;
        expenses += varExp + fixedShare;
      });

      const profit = revenue - expenses;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        w: week.label,
        revenue,
        expenses,
        profit,
        marginPct,
        weekKey: week.key,
      };
    });

    return seriesBase;
  }, [
    selectedProjectId,
    range,
    subsForView,
    weekOptions,
    listKeyIndex,
    priceMapsByListId,
    rates,
    dailyFixedAmount,
    distributionRule,
  ]);

  // ================== OVERVIEW HISTORICAL REUSE ==================
  const selectedWeekSubmissions = useMemo(() => {
    if (!selectedProject || !selectedWeek) return [];
    const start = parseISODate(selectedWeek.start);
    const end = parseISODate(selectedWeek.end);
    if (!start || !end) return [];

    return subsForView.filter((sub) => {
      const d = parseISODate(sub.date);
      if (!d) return false;
      return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    });
  }, [selectedProject, selectedWeek, subsForView]);

  const historicalOverview = useMemo<{
    series: OverviewWeekSeriesPoint[];
    perDay: Map<any, DailyDetail>;
  } | null>(() => {
    if (!selectedProject || !selectedWeek) return null;

    return buildOverviewWeekDataForProject({
      project: selectedProject,
      submissions: selectedWeekSubmissions.map(withMissileRowsAsLegacyTotals),
      rates,
      priceMapsByListId,
      fixedOverheadPerDay: dailyFixedAmount,
    });
  }, [
    selectedProject,
    selectedWeek,
    selectedWeekSubmissions,
    rates,
    priceMapsByListId,
    dailyFixedAmount,
  ]);

  const dayPills = useMemo<DayPillInfo[]>(() => {
    if (!historicalOverview) {
      return DAY_KEYS.map((k) => ({
        key: k,
        label: k,
        hasData: false,
        dateISO: null,
      }));
    }

    return DAY_KEYS.map((k) => {
      const detail = historicalOverview.perDay.get(k);
      return {
        key: k,
        label: k,
        hasData: !!detail,
        dateISO: detail?.dateISO || null,
      };
    });
  }, [historicalOverview]);

  useEffect(() => {
    if (!historicalOverview) {
      setSelectedDayKey("Mon");
      return;
    }

    const hasCurrent = historicalOverview.perDay.has(selectedDayKey as any);
    if (hasCurrent) return;

    const firstWithData =
      DAY_KEYS.find((k) => historicalOverview.perDay.has(k)) || "Mon";
    setSelectedDayKey(firstWithData);
  }, [historicalOverview, selectedDayKey]);

  const selectedHistoricalDay = useMemo(
    () => historicalOverview?.perDay.get(selectedDayKey as any) || null,
    [historicalOverview, selectedDayKey]
  );

  const selectedWeekIndex = useMemo(
    () => weekOptions.findIndex((w) => w.key === selectedWeekKey),
    [weekOptions, selectedWeekKey]
  );

  const canGoPrevWeek = selectedWeekIndex > 0;
  const canGoNextWeek = selectedWeekIndex < weekOptions.length - 1;

  function goPrevWeek() {
  if (!canGoPrevWeek) return;
  const prev = weekOptions[selectedWeekIndex - 1];
  if (prev) setSelectedWeekKey(prev.key);
}

function goNextWeek() {
  if (!canGoNextWeek) return;
  const next = weekOptions[selectedWeekIndex + 1];
  if (next) setSelectedWeekKey(next.key);
}

  const productionBreakdown = useMemo<BreakdownRow[]>(() => {
    if (showMduBalance && mduBalance) {
      const rows = [
        { label: "Labor", value: mduBalance.laborTotal || 0 },
        { label: "Trucks", value: mduBalance.truckTotal || 0 },
        { label: "Actual expenses", value: mduBalance.actualExpensesTotal || 0 },
      ].filter((r) => r.value > 0);

      const total = rows.reduce((s, r) => s + r.value, 0);
      return rows.map((r) => ({
        ...r,
        pct: total > 0 ? (r.value / total) * 100 : 0,
      }));
    }

    const byType = new Map<string, number>();

    subsForView.forEach((sub) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const priceMap = priceMapsByListId[listId];
      if (!priceMap) return;

      const tasks = extractBalanceTasksFromSubmission(sub) || [];

      tasks.forEach((t: any) => {
        const taskKey = String(t.task_key || "").trim();
        const qty = Number(t.qty ?? t.quantity ?? 0) || 0;
        if (!taskKey || qty <= 0) return;

        const variant = MISSILE_TASK_KEYS.has(taskKey.toUpperCase())
  ? null
  : resolveVariant(t);
        const unitPrice = getCompositeUnitPrice(priceMap, taskKey, variant);
        const revenue = qty * unitPrice;

        if (revenue <= 0) return;

        const type = mapTaskLabel(taskKey);
        byType.set(type, (byType.get(type) || 0) + revenue);
      });
    });

   const rows = Array.from(byType.entries())
  .map(([label, value]) => ({ label, value }))
  .sort((a, b) => b.value - a.value);

    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows.map((r) => ({
      ...r,
      pct: total > 0 ? (r.value / total) * 100 : 0,
    }));
  }, [showMduBalance, mduBalance, subsForView, listKeyIndex, priceMapsByListId]);

  const expenseBreakdown = useMemo<BreakdownRow[]>(() => {
    const acc = {
      labor: 0,
      crew: 0,
      trucks: 0,
      fuel: 0,
      lodging: 0,
      materials: 0,
      other: 0,
      fixed: 0,
    };

    subsForView.forEach((sub) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const exp: any = (sub as any).expenses || {};
      const crewCount = Number(exp.crewCount ?? exp.crew ?? exp.crew_count) || 0;
      const truckCount = Number(exp.truckCount ?? exp.trucks ?? exp.truck_count) || 0;
      const diesel = Number(exp.diesel) || 0;
      const gas = Number(exp.gas) || 0;
      const propane = Number(exp.propane) || 0;
      const lodging = Number(exp.rent ?? exp.lodging ?? exp.hotel) || 0;
      const materials = Number(exp.materials ?? exp.material ?? exp.supplies) || 0;
      const other = Number(exp.other ?? exp.misc ?? 0) || 0;
      const fuel = diesel + gas + propane;

      if (showMduBalance && selectedProject) {
        if (listId !== selectedProject.id) return;
        const hourRate = Number((selectedProject as any)?.mdu_hour_rate ?? 0) || 0;
        const workedHours = getWorkedHoursFromSubmission(sub);

        acc.labor += crewCount * workedHours * hourRate;
        acc.trucks += truckCount * (Number(rates?.truck_per_day) || 0);
        acc.fuel += fuel;
        acc.lodging += lodging;
        acc.materials += materials;
        acc.other += other;
      } else {
        acc.crew += crewCount * (Number(rates?.crew_per_day) || 0);
        acc.trucks += truckCount * (Number(rates?.truck_per_day) || 0);
        acc.fuel += fuel;
        acc.lodging += lodging;
        acc.materials += materials;
        acc.other += other;
        acc.fixed += computeFixedShareForSubmission(sub, listId);
      }
    });

    const rows = [
      showMduBalance
        ? { label: "Labor", value: acc.labor }
        : { label: "Crew", value: acc.crew },
      { label: "Trucks", value: acc.trucks },
      { label: "Fuel", value: acc.fuel },
      { label: "Lodging / purchases", value: acc.lodging },
      { label: "Materials", value: acc.materials },
      { label: "Other", value: acc.other },
      ...(showMduBalance ? [] : [{ label: "Fixed OH", value: acc.fixed }]),
    ]
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows.map((r) => ({
      ...r,
      pct: total > 0 ? (r.value / total) * 100 : 0,
    }));
  }, [
    subsForView,
    listKeyIndex,
    rates,
    showMduBalance,
    selectedProject,
    dailyFixedAmount,
    distributionRule,
  ]);

  function handleGeneratePdf(): void {
    const from = fromDate || "";
    const to = toDate || "";
    if (!from || !to) return;

    const dayMap = new Map<string, DayAggregate>();
    const dayRevenueTotals = new Map<string, number>();

    let totalRevenue = 0;
    let totalDirectCosts = 0;
    let totalOverhead = 0;

    subsForView.forEach((sub: SubmissionRow) => {
      const listId = matchSubmissionToListId(sub, listKeyIndex);
      if (!listId) return;

      const priceMap = priceMapsByListId[listId];
      if (!priceMap) return;

      const dayKey = clampISO(sub.date || null);
      if (!dayKey) return;

      const tasksRaw = extractBalanceTasksFromSubmission(sub) as UwExtractedTask[];

      const existingDay = dayMap.get(dayKey);
      const dayAgg: DayAggregate =
        existingDay || {
          tasksMap: new Map<string, AggregatedTask>(),
          totalRevenue: 0,
        };

      tasksRaw.forEach((t: UwExtractedTask) => {
        const qty = Number(t.quantity ?? t.qty ?? 0) || 0;
        if (!qty) return;

        const taskKey = String(t.task_key || "").trim();
        const label = String(t.label ?? t.task_label ?? taskKey).trim();
        const variant = resolveVariant(t);
        const unitPrice =
          Number(
            t.unit_price ??
              t.unitPrice ??
              t.price_per_unit ??
              t.price ??
              getCompositeUnitPrice(priceMap, taskKey, variant)
          ) || 0;

        const safeLineTotal = unitPrice * qty;
        const aggKey = `${taskKey}__${label}`;

        const existingTask = dayAgg.tasksMap.get(aggKey);
        if (existingTask) {
          existingTask.quantity += qty;
          existingTask.line_total += safeLineTotal;
        } else {
          dayAgg.tasksMap.set(aggKey, {
            group: "Other",
            task_key: taskKey,
            label,
            unit: "",
            quantity: qty,
            unit_price: unitPrice,
            line_total: safeLineTotal,
          });
        }

        dayAgg.totalRevenue += safeLineTotal;
      });

      const rev = calcBalanceRevenueForSubmission(sub, listId, priceMapsByListId);
      const varExp =
        calcActualExpensesFromSubmission(sub) +
        calcResourceCostFromSubmission(sub, rates);
      const fixedShare = computeFixedShareForSubmission(sub, listId);

      totalRevenue += rev;
      totalDirectCosts += varExp;
      totalOverhead += fixedShare;

      const prevDayRev = dayRevenueTotals.get(dayKey) ?? 0;
      dayRevenueTotals.set(dayKey, prevDayRev + rev);

      dayMap.set(dayKey, dayAgg);
    });

    const dayKeysSorted = Array.from(dayMap.keys()).sort();
    const days = dayKeysSorted.map((dayKey: string) => {
      const agg = dayMap.get(dayKey)!;
      const tasksArray = Array.from(agg.tasksMap.values());

      const officialDayRev = dayRevenueTotals.get(dayKey);
      const dayTotalRevenue =
        officialDayRev !== undefined ? officialDayRev : agg.totalRevenue;

      return {
        date: dayKey,
        tasks: tasksArray,
        day_total_revenue: dayTotalRevenue,
      };
    });

    const report: AdminBalanceReport = {
      project: {
        id: selectedProject?.id || selectedProjectId,
        name: selectedProject?.name || selectedProjectId,
        customer: selectedProject?.customer || "",
      },
      range: { from, to },
      days,
      summary: {
        total_revenue: totalRevenue,
        total_direct_costs: totalDirectCosts,
        total_overhead: totalOverhead,
        total_net: totalRevenue - totalDirectCosts - totalOverhead,
      },
    };

    generateBalancePdf(report);
  }

  const advancedRangeValue = ["last_month", "ytd", "since_first_submission_week"].includes(range)
    ? range
    : "";

  const moreRangesValue =
    projectStatusFilter !== "active"
      ? `status:${projectStatusFilter}`
      : advancedRangeValue;

  const mduBurnColor =
    (mduBalance?.progressPct || 0) >= 100
      ? "#ef4444"
      : (mduBalance?.progressPct || 0) >= 80
      ? "#f59e0b"
      : "#10b981";

  return (
    <div className="space-y-3">
      <section className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <BarChart2 size={12} className="opacity-70" />
            {!selectedProjectId
              ? "Balance"
              : showMduBalance
              ? "MDU Balance"
              : "Project balance"}
          </span>
          <span className="text-[11px] text-slate-400">
            {!selectedProjectId
              ? "Select one project to view balance"
              : `Viewing: ${selectedProject?.name || "Unnamed project"}${
                  selectedProject?.customer ? ` · ${selectedProject.customer}` : ""
                }${showMduBalance ? " · MDU burn-down view" : ""}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AdminSpreadsheet
            filename={csvFilename}
            headers={INVOICE_HEADERS}
            rows={invoiceRows}
            disabled={loading || invoiceRows.length === 0}
            className="h-8 px-3 rounded-lg bg-white text-slate-900 font-semibold text-[10px] border border-slate-200 shadow-sm active:scale-95"
            label="Download CSV"
          />

          {false && (
            <button
              type="button"
              onClick={handleGeneratePdf}
              className="h-8 px-3 rounded-lg bg-slate-900 text-white font-semibold text-[10px] border border-slate-900 shadow-sm active:scale-95"
            >
              Download PDF
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-slate-500 mr-1">Quick range</span>
            <FilterPill
              label="This week"
              active={range === "this_week"}
              onClick={() => applyQuickRange("this_week")}
            />
            <FilterPill
              label="Last week"
              active={range === "last_week"}
              onClick={() => applyQuickRange("last_week")}
            />
            <FilterPill
              label="This month"
              active={range === "this_month"}
              onClick={() => applyQuickRange("this_month")}
            />

            <select
              className="h-7 rounded-full border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-600"
              value={moreRangesValue}
              onChange={(e) => {
                const v = e.target.value;

                if (v === "status:active") {
                  setProjectStatusFilter("active");
                  return;
                }
                if (v === "status:completed") {
                  setProjectStatusFilter("completed");
                  return;
                }
                if (v === "status:all") {
                  setProjectStatusFilter("all");
                  return;
                }

                setProjectStatusFilter("active");

                if (!v) return;
                applyQuickRange(v as BalanceRange);
              }}
            >
              <option value="">More ranges</option>
              <option value="last_month">Last month</option>
              <option value="ytd">Year to date</option>
              <option value="since_first_submission_week">
                Since 1st sub week
              </option>
              <option value="status:active">Active projects</option>
              <option value="status:completed">Completed projects</option>
              <option value="status:all">All projects</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <label className="block mb-0.5 text-slate-500">From</label>
              <input
                type="date"
                className="w-full rounded-lg bg-white border border-slate-200 px-2 py-1 text-slate-800 text-[11px]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-0.5 text-slate-500">To</label>
              <input
                type="date"
                className="w-full rounded-lg bg-white border border-slate-200 px-2 py-1 text-slate-800 text-[11px]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <div>
                <label className="block mb-0.5 text-slate-500">Project</label>
                <select
                  className={`w-full h-10 rounded-xl px-3 text-[12px] font-semibold transition cursor-pointer ${
                    !selectedProjectId
                      ? "bg-white border-2 border-slate-300 text-slate-700 hover:border-sky-400"
                      : "bg-sky-50 border-2 border-sky-400 text-sky-900 shadow-sm"
                  }`}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === ""
                        ? "Select project"
                        : p.customer
                        ? `${p.label} · ${p.customer}`
                        : p.label}
                    </option>
                  ))}
                </select>
              </div>

              {!!selectedProjectId && selectedProject && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        Viewing project
                      </div>
                      <div className="text-[12px] font-semibold text-sky-950 truncate">
                        {selectedProject.name || "Unnamed project"}
                      </div>
                      <div className="text-[10px] text-sky-700 truncate">
                        {selectedProject.project_number ||
                          selectedProject.project_code ||
                          selectedProject.id}
                        {selectedProject.customer
                          ? ` · ${selectedProject.customer}`
                          : ""}
                        {((detailsById[selectedProject.id]?.list as any)?.project_manager ||
                          (selectedProject as any)?.project_manager)
                          ? ` · PM: ${
                              (detailsById[selectedProject.id]?.list as any)?.project_manager ||
                              (selectedProject as any)?.project_manager
                            }`
                          : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-none">
                      {showMduBalance && (
                        <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700">
                          MDU
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[9px] font-semibold text-sky-700">
                        Selected
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500">
            Showing:{" "}
            <span className="font-semibold text-slate-700">
              {range === "this_week" && "This week"}
              {range === "last_week" && "Last week"}
              {range === "this_month" && "This month"}
              {range === "last_month" && "Last month"}
              {range === "ytd" && "Year to date"}
              {range === "since_first_submission_week" && "Since project start"}
            </span>
            {selectedProject?.name ? ` · Project: ${selectedProject.name}` : ""}
            {` · Scope: ${
              projectStatusFilter === "active"
                ? "Active projects"
                : projectStatusFilter === "completed"
                ? "Completed projects"
                : "All projects"
            }`}
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          Loading balance…
        </div>
      )}

      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
          {error}
        </div>
      )}

      {!loading && showMduBalance && (!mduBalance || mduBalance.poAmount <= 0) && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          This MDU project does not have a valid contract amount yet. Add the MDU contract total to
          see the burn-down balance correctly.
        </div>
      )}

      {!selectedProjectId && !loading && (
        <div className="text-[10px] text-slate-500">
          Select a project to view balance data.
        </div>
      )}

      {!!selectedProjectId && (
        <>
          {showMduBalance ? (
            <section className="grid grid-cols-2 gap-2">
              <KpiCard
                label="PO Amount"
                value={formatCurrency(mduBalance?.poAmount)}
                icon={<DollarSign size={14} />}
                accent="text-sky-600"
              />
              <KpiCard
                label="Consumed"
                value={formatCurrency(mduBalance?.consumed)}
                icon={<Layers size={14} />}
                accent="text-amber-600"
              />
              <KpiCard
                label="Remaining"
                value={formatCurrency(mduBalance?.remaining)}
                icon={<TrendingDown size={14} />}
                accent={
                  (mduBalance?.remaining || 0) >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }
              />
              <KpiCard
                label="Progress"
                value={`${(mduBalance?.progressPct || 0).toFixed(1)}%`}
                icon={<Factory size={14} />}
                accent="text-violet-600"
              />
            </section>
          ) : (
            <section className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Total revenue"
                value={formatCurrency(totals.revenue)}
                icon={<DollarSign size={14} />}
                accent="text-emerald-600"
              />
              <KpiCard
                label="Total expenses"
                value={formatCurrency(totals.expenses)}
                icon={<Layers size={14} />}
                accent="text-amber-600"
              />
              <KpiCard
                label="Profit"
                value={
                  totals.revenue > 0
                    ? `${formatCurrency(totals.net)} (${globalProfitMargin.toFixed(1)}%)`
                    : formatCurrency(totals.net)
                }
                icon={<BarChart2 size={14} />}
                accent={totals.net >= 0 ? "text-emerald-600" : "text-rose-600"}
              />
              <KpiCard
                label="Projects (A/C)"
                value={`${totalProjects} (${totalActive}/${totalCompleted})`}
                icon={<Factory size={14} />}
                accent="text-sky-600"
              />
            </section>
          )}

          {showMduBalance ? (
            <section className="rounded-2xl border border-slate-200 bg-white overflow-visible shadow-sm">
              <div className="px-3 py-2 text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-600">
                  <TrendingDown size={14} /> MDU budget burn-down
                </span>
                <span className="text-slate-400 text-[10px]">
                  Remaining balance by entered date
                </span>
              </div>

              <div className="px-3 pb-1">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (mduBalance?.progressPct || 0) >= 100
                        ? "bg-rose-600"
                        : (mduBalance?.progressPct || 0) >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(mduBalance?.progressPct || 0, 100)
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Consumed {formatCurrency(mduBalance?.consumed)}</span>
                  <span
                    className={`font-semibold ${
                      (mduBalance?.progressPct || 0) >= 100
                        ? "text-rose-600"
                        : (mduBalance?.progressPct || 0) >= 80
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {(mduBalance?.progressPct || 0).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RLineChart
                    data={mduBurnSeries}
                    margin={{ top: 18, right: 16, left: 14, bottom: 12 }}
                  >
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.18)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={44}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
                      }
                    />
                    <RTooltip
                      cursor={{ stroke: "rgba(15,23,42,0.18)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "rgba(255,255,255,0.96)",
                        border: "1px solid rgba(148,163,184,0.7)",
                        borderRadius: 12,
                        color: "#0f172a",
                        fontSize: 11,
                        boxShadow: "0 8px 18px rgba(15,23,42,0.18)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="remaining"
                      stroke={mduBurnColor}
                      strokeWidth={3}
                      dot={{ r: 3, fill: mduBurnColor, stroke: "#0f172a", strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: mduBurnColor, stroke: "#0f172a", strokeWidth: 1.5 }}
                    />
                  </RLineChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white overflow-visible shadow-sm">
              <div className="px-3 py-2 text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-600">
                  <BarChart2 size={14} /> Weekly balance history
                </span>
                <span className="text-slate-400 text-[10px]">
                  Tap / click a week to inspect
                </span>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart
                    data={weeklySeries}
                    margin={{ top: 18, right: 16, left: 14, bottom: 12 }}
                    barCategoryGap="40%"
                    onClick={(state: any) => {
                      const payload = state?.activePayload?.[0]?.payload as WeeklyPoint | undefined;
                      if (payload?.weekKey) setSelectedWeekKey(payload.weekKey);
                    }}
                  >
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.25)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="w"
                      tick={{ fontSize: 10, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-16}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                      }
                    />
                    <RTooltip
                      cursor={{ fill: "rgba(148,163,184,0.15)" }}
                      contentStyle={{
                        background: "rgba(255,255,255,0.96)",
                        border: "1px solid rgba(148,163,184,0.7)",
                        borderRadius: 12,
                        color: "#0f172a",
                        fontSize: 11,
                        boxShadow: "0 8px 18px rgba(15,23,42,0.18)",
                      }}
                      formatter={(value: any, _name: any, props: any) => {
                        const key = props?.dataKey as string;
                        if (key === "expenses")
                          return [formatCurrency(Number(value)), "Expenses"];
                        if (key === "profit")
                          return [formatCurrency(Number(value)), "Profit"];
                        if (key === "revenue")
                          return [formatCurrency(Number(value)), "Revenue"];
                        return [value, key];
                      }}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="#fb923c"
                      radius={[6, 6, 0, 0]}
                      barSize={18}
                    />
                    <Bar
                      dataKey="profit"
                      name="Profit"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                      barSize={18}
                    >
                      <LabelList
                        dataKey="profit"
                        position="top"
                        dy={-6}
                        formatter={(v: any) => {
                          const val = Number(v || 0);
                          if (val <= 0) return "";
                          if (Math.abs(val) >= 1000)
                            return `$${(val / 1000).toFixed(1)}k`;
                          return `$${val.toFixed(0)}`;
                        }}
                        style={{
                          fontSize: 10,
                          fill: "#111827",
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                  </RBarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <BreakdownCard
              title={showMduBalance ? "Used breakdown" : "Production breakdown"}
              subtitle={
                showMduBalance
                  ? "What consumed the MDU budget"
                  : "Which task types generated production"
              }
              rows={productionBreakdown}
            />
            <BreakdownCard
              title="Expense breakdown"
              subtitle="Which expense types are driving costs"
              rows={expenseBreakdown}
            />
          </section>

          {!!selectedWeek && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-700">
                  Historical weeks
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={goPrevWeek}
                    disabled={!canGoPrevWeek}
                    className="h-7 w-7 rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextWeek}
                    disabled={!canGoNextWeek}
                    className="h-7 w-7 rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight size={14} className="mx-auto" />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-3">
                <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {weekOptions.map((w) => (
                    <Pill
                      key={w.key}
                      label={w.label}
                      active={w.key === selectedWeekKey}
                      onClick={() => setSelectedWeekKey(w.key)}
                    />
                  ))}
                </div>

                {!!historicalOverview && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                    <div className="px-3 py-2 text-[11px] flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1">
                        <BarChart2 size={14} />
                        {showMduBalance ? "Weekly used vs costs" : "Weekly revenue vs expenses"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Tap / click a day to inspect
                      </span>
                    </div>

                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RLineChart
                            data={historicalOverview.series}
                            margin={{ top: 8, right: 20, left: 10, bottom: 0 }}
                            onClick={(e: any) => {
                              const label = e?.activeLabel as string | undefined;
                              if (!label) return;
                              setSelectedDayKey(label);
                            }}
                          >
                          <CartesianGrid stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="d"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            width={32}
                          />
                          <RTooltip
                            contentStyle={{
                              background: "rgba(255,255,255,0.96)",
                              border: "1px solid rgba(148,163,184,0.7)",
                              borderRadius: 12,
                              boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
                              fontSize: 11,
                              color: "#0f172a",
                            }}
                            formatter={(value: any, name: any) => [
                              formatCurrency(Number(value)),
                              name,
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="rev"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            dot={false}
                            name={showMduBalance ? "Used" : "Revenue"}
                          />
                          <Line
                            type="monotone"
                            dataKey="exp"
                            stroke="#fb923c"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                            name="Expenses"
                          />
                        </RLineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="px-3 pb-2 pt-1">
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {dayPills.map((day) => (
                          <DayChip
                            key={day.key}
                            label={day.label}
                            active={selectedDayKey === day.key}
                            muted={!day.hasData}
                            onClick={() => setSelectedDayKey(day.key)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {!!selectedHistoricalDay && selectedProject && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-700">
                    Historical overview snapshot
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Recovered from selected week and day
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHistoricalSnapshot((prev) => !prev)}
                  className="px-2.5 h-7 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 active:scale-95"
                >
                  {showHistoricalSnapshot ? "Hide" : "Show"}
                </button>
              </div>

              {showHistoricalSnapshot && (
                <div className="p-0">
                  <HistoricalOverviewCard
                    project={selectedProject}
                    detail={selectedHistoricalDay}
                    rates={rates}
                    isMDU={showMduBalance}
                    priceMap={priceMapsByListId[selectedProject.id]}
                    embedded
                  />
                </div>
              )}
            </section>
          )}

          {showMduBalance ? (
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-3 py-2 text-[11px] flex items-center justify-between border-b border-slate-200">
                <span className="font-semibold text-slate-700">
                  MDU daily burn
                </span>
                <span className="text-slate-400">
                  Burn / accumulated / remaining
                </span>
              </div>
              <div className="max-h-60 overflow-auto text-[11px]">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-1 text-slate-500">Date</th>
                      <th className="text-right px-3 py-1 text-slate-500">Burn</th>
                      <th className="text-right px-3 py-1 text-slate-500">
                        Accumulated
                      </th>
                      <th className="text-right px-3 py-1 text-slate-500">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mduDayRows.map((row, i) => {
                      const striped = i % 2 === 0 ? "bg-slate-50" : "bg-white";
                      return (
                        <tr key={`${row.date}-${i}`} className={striped}>
                          <td className="px-3 py-1 text-slate-800">{row.date}</td>
                          <td className="px-3 py-1 text-right text-slate-800">
                            {formatCurrency(row.burn)}
                          </td>
                          <td className="px-3 py-1 text-right text-slate-800">
                            {formatCurrency(row.accumulated)}
                          </td>
                          <td
                            className={`px-3 py-1 text-right font-semibold ${
                              row.remaining >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(row.remaining)}
                          </td>
                        </tr>
                      );
                    })}
                    {mduDayRows.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-3 text-center text-slate-500"
                        >
                          No production yet for this MDU project in the selected range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

// ================== SUB-COMPONENTES ==================
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-7 rounded-full border text-[10px] font-semibold transition active:scale-95 ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap transition active:scale-95 ${
        active
          ? "bg-sky-600 border-sky-600 text-white shadow-sm"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function DayChip({
  label,
  active,
  muted,
  onClick,
}: {
  label: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition active:scale-95 ${
        active
          ? "bg-sky-600 border-sky-600 text-white shadow-sm"
          : muted
          ? "bg-slate-50 border-slate-200 text-slate-400"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <span className={accent}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className="text-[16px] font-semibold mt-1 tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function HistoricalOverviewCard({
  project,
  detail,
  rates,
  isMDU,
  priceMap,
  embedded = false,
}: {
  project: PriceListSummary;
  detail: DailyDetail;
  rates: RatesPayload;
  isMDU: boolean;
  priceMap?: Map<string, number>;
  embedded?: boolean;
}) {
  const crewCost = (detail.crewCount || 0) * (Number(rates.crew_per_day) || 0);
  const truckCost = (detail.truckCount || 0) * (Number(rates.truck_per_day) || 0);

  return (
    <section
      className={
        embedded
          ? "bg-white"
          : "rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      }
    >
      {!embedded && (
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="text-[11px] font-semibold text-slate-700">
            Historical overview snapshot
          </div>
          <div className="text-[10px] text-slate-400">
            Recovered from selected week and day
          </div>
        </div>
      )}

      <div className="p-3 text-[11px] space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600">Customer</span>
          <span className="font-semibold text-slate-900">
            {project.customer || "—"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600">Project code</span>
          <span className="font-semibold text-slate-900">
            {project.project_code || project.id}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600">Selected day</span>
          <span className="font-semibold text-slate-900">
            {detail.dateLabel}
          </span>
        </div>

        {!isMDU ? (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600">Revenue (day)</span>
              <span className="font-semibold text-emerald-700">
                {formatCurrency(detail.revenue)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Costs (day)</span>
              <span className="font-semibold text-amber-700">
                {formatCurrency(detail.expenses)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Profit (day)</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(detail.revenue - detail.expenses)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600">Used today</span>
              <span className="font-semibold text-amber-700">
                {formatCurrency(detail.mduUsedToday)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Daily target</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(detail.mduTargetPerDay)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Crew number</span>
              <span className="font-semibold text-slate-900">
                {formatQty(detail.crewCount)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Worked hours</span>
              <span className="font-semibold text-slate-900">
                {formatQty(detail.workedHours)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Labor value today</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(detail.mduLaborCost)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Remaining after day</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(detail.mduRemainingAfterDay)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">Consumed after day</span>
              <span className="font-semibold text-slate-900">
                {`${Number(detail.mduConsumedPctAfterDay || 0).toFixed(1)}%`}
              </span>
            </div>
          </>
        )}

        {!isMDU && detail.tasks.length > 0 && (
          <div className="pt-1 mt-1 border-t border-slate-200 space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-700 font-semibold">
                Daily production
              </span>
              <span className="text-[10px] text-slate-500">
                Tasks (qty × price = revenue)
              </span>
            </div>

            {detail.tasks.map((t) => {
              const varLabel = t.variant_code
                ? ` · ${String(t.variant_code).toUpperCase()}`
                : "";

              const unitPrice = priceMap
                ? getCompositeUnitPrice(priceMap, t.task_key, t.variant_code ?? null)
                : t.unitPrice;

              const revenue = (Number(t.qty) || 0) * unitPrice;

              return (
                <div
                  key={`${t.task_key}::${t.variant_code || ""}`}
                  className="flex justify-between gap-2"
                >
                  <span className="text-slate-700 flex-1 min-w-0">
                    {mapTaskLabel(t.task_key)}
                    <span className="text-[10px] text-slate-500">{varLabel}</span>
                  </span>

                  <span className="font-semibold text-slate-900 flex-none whitespace-nowrap text-right tabular-nums">
                    {formatQty(t.qty)} × {formatCurrency(unitPrice)} ={" "}
                    {formatCurrency(revenue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-1 mt-1 border-t border-slate-200" />
        <div className="text-[10px] text-slate-700 font-semibold">
          Expenses breakdown (day)
        </div>

        {!isMDU && crewCost > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Crew</span>
            <span className="font-semibold text-slate-900">
              {detail.crewCount} × {formatCurrency(rates.crew_per_day)} ={" "}
              {formatCurrency(crewCost)}
            </span>
          </div>
        )}

        {isMDU && (detail.mduLaborCost || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Labor</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(detail.mduLaborCost)}
            </span>
          </div>
        )}

        {!isMDU && truckCost > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Trucks</span>
            <span className="font-semibold text-slate-900">
              {detail.truckCount} × {formatCurrency(rates.truck_per_day)} ={" "}
              {formatCurrency(truckCost)}
            </span>
          </div>
        )}

        {isMDU && (detail.mduTruckCost || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Truck cost</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(detail.mduTruckCost)}
            </span>
          </div>
        )}

        {detail.workedHours > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Worked hours</span>
            <span className="font-semibold text-slate-900">
              {formatQty(detail.workedHours)}
            </span>
          </div>
        )}

        {detail.laborHours > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Labor hours</span>
            <span className="font-semibold text-slate-900">
              {formatQty(detail.laborHours)}
            </span>
          </div>
        )}

        <div className="pt-1 mt-1 border-t border-slate-200" />

        {detail.diesel > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Diesel</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.diesel)}
            </span>
          </div>
        )}
        {detail.gas > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Gas</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.gas)}
            </span>
          </div>
        )}
        {detail.propane > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Propane</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.propane)}
            </span>
          </div>
        )}
        {detail.lodging > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Purchases</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.lodging)}
            </span>
          </div>
        )}
        {detail.materials > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Materials</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.materials)}
            </span>
          </div>
        )}
        {detail.other > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Other</span>
            <span className="font-semibold text-amber-700">
              {formatCurrency(detail.other)}
            </span>
          </div>
        )}

        <div className="pt-1 mt-1 border-t border-slate-200" />

        {detail.actualTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Actual expenses</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(detail.actualTotal)}
            </span>
          </div>
        )}

        {!isMDU && detail.resourceTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Resources total</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(detail.resourceTotal)}
            </span>
          </div>
        )}

        {isMDU && (detail.mduActualExpenses || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Actual expenses</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(detail.mduActualExpenses)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: BreakdownRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-slate-200">
        <div className="text-[11px] font-semibold text-slate-700">{title}</div>
        <div className="text-[10px] text-slate-400">{subtitle}</div>
      </div>

      <div className="p-3 space-y-2">
        {rows.length === 0 ? (
          <div className="text-[11px] text-slate-500">No data in this range.</div>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-700 truncate">{row.label}</span>
                <span className="font-semibold text-slate-900 whitespace-nowrap">
                  {formatCurrency(row.value)} · {row.pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.max(0, Math.min(row.pct, 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default AdminBalance;