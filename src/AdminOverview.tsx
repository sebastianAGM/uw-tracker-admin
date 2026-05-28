// src/AdminOverview.tsx
import React, { useEffect, useMemo, useState } from "react";
import { BarChart2, Factory, Layers, ChevronDown, ChevronUp } from "lucide-react";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  buildPriceMapForList,
  calcRevenueForSubmission,
  extractTasksFromSubmission,
  calcActualExpensesFromSubmission,
  calcResourceCostFromSubmission,
  calcMDUConsumedPct,
  calcMDURemainingBudget,
  calcMDULaborHoursForSubmission,
  getCompositeUnitPrice,
  getMDUContractTotal,
  getMDUStartDate,
  getMDUCloseOutBy,
  getWorkedHoursFromSubmission,
  isMDUPriceList,
  RatesPayload,
} from "./lib/uwCalc";

// ================== CONFIG ==================
const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";
const PRICE_LISTS_ENDPOINT = `${API_BASE}/api/price-lists`;
const PRICE_LIST_DETAILS_ENDPOINT = (id: string) => `${PRICE_LISTS_ENDPOINT}/${id}`;
const SUBMISSIONS_ENDPOINT = `${API_BASE}/api/submissions`;
const EXPENSES_ENDPOINT = `${API_BASE}/api/expenses`;
const ADMIN_TOKEN = "3amigos";
const PROJECT_VISIBLE_LIMIT = 50;

// 👇 Ajusta aquí si tus task_keys reales son otros
const FIBER_BLOWING_TASKKEY_CANDIDATES = [
  "FIBER_BLOWING_FT",
  "FIBER_BLOWING",
  "BLOWING_FT",
];

// ✅ incluye el CANON que tu uwCalc produce (alias FIBER_PLOWING_FT -> FIBER_DIRECT_BURY_FT)
const FIBER_PLOWING_TASKKEY_CANDIDATES = [
  "FIBER_PLOWING_FT",
  "FIBER_PLOWING",
  "PLOWING_FT",
  "FIBER_DIRECT_BURY_FT",
];

// ================== TYPES ==================
interface PriceListSummary {
  id: string;
  name: string;
  is_active?: boolean;
  status?: "draft" | "completed";
  customer?: string;
  project_code?: string;
  project_number?: string | null;
  po_number?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  subtotal?: number;
  created_at?: string | null;

  soil?: string | null;
  soil_type?: string | null;
  soilType?: string | null;
  soil_kind?: string | null;
  ground_type?: string | null;

  // MDU
  is_mdu?: boolean | number | string | null;
  mdu_start_date?: string | null;
  mdu_close_out_by?: string | null;
  mdu_po_amount?: number | null;
  mdu_total_amount?: number | null;
  mdu_hour_rate?: number | null;
}

interface SubmissionRow {
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

  soil?: string | null;
  soil_type?: string | null;
  soilType?: string | null;
  soil_kind?: string | null;
  ground_type?: string | null;
}

interface SeriesPoint {
  d: string;
  rev: number;
  exp: number;
}

type PriceListDetails = {
  list: PriceListSummary;
  prices: Array<{
    task_key: string;
    unit?: string | null;
    price_per_unit: number;
    variant_code?: string | null;
  }>;
};

type ExpenseBreakdown = {
  crewCount: number;
  truckCount: number;

  diesel: number;
  gas: number;
  propane: number;

  lodging: number;
  materials: number;
  other: number;

  crewCost: number;
  truckCost: number;

  actualTotal: number;
  resourceTotal: number;
  total: number;
};

type TaskSummaryRow = {
  task_key: string;
  qty: number;
  unitPrice: number;
  revenue: number;
  variant_code?: string | null;
};

type BoreSoilGroupedRow = {
  task_key: string;
  baseVariant: string;
  rows: Array<TaskSummaryRow & { soil: string }>;
};

const BORE_SOIL_CODES = new Set([
  "DIRT",
  "COBBLE",
  "ROCK",
  "CLAY",
  "ASPHALT",
  "HARDPAN",
  "UNKNOWN",
]);

function splitBoreSoilTasks(tasks: TaskSummaryRow[]): {
  boreGroups: BoreSoilGroupedRow[];
  otherTasks: TaskSummaryRow[];
} {
  const groupMap = new Map<string, BoreSoilGroupedRow>();
  const otherTasks: TaskSummaryRow[] = [];

  tasks.forEach((t) => {
    const taskKey = String(t.task_key || "").trim().toUpperCase();
    const rawVariant = String(t.variant_code || "").trim().toUpperCase();

    const isBoreBaseTask =
      taskKey.startsWith("BORE_") && taskKey !== "BORE_SOIL_MARKUP_FT";

    if (isBoreBaseTask && rawVariant) {
      const parts = rawVariant.split(/[_\s]+/).filter(Boolean);
      const soil = parts[parts.length - 1] || "";

      if (BORE_SOIL_CODES.has(soil)) {
        const baseVariant = parts.slice(0, -1).join("_");
        const groupKey = `${taskKey}::${baseVariant}`;

        const prev = groupMap.get(groupKey) || {
          task_key: taskKey,
          baseVariant,
          rows: [],
        };

        prev.rows.push({ ...t, soil });
        groupMap.set(groupKey, prev);
        return;
      }
    }

    otherTasks.push(t);
  });

  return {
    boreGroups: Array.from(groupMap.values()),
    otherTasks,
  };
}

type FiberVariantAgg = {
  blowingFt: number;
  plowingFt: number;
  totalFt: number;
};

type FiberVariantRow = {
  variant_code: string;
  blowingFt: number;
  plowingFt: number;
  totalFt: number;
  blowingUnitPrice: number;
  plowingUnitPrice: number;
  revenue: number;
};

type DailyDetail = {
  weekdayKey: string;
  dateLabel: string;

  revenue: number;
  expenses: number;

  tasks: TaskSummaryRow[];
  fiberVariants?: FiberVariantRow[];

  soilType?: string | null;

  crewCount: number;
  truckCount: number;
  diesel: number;
  gas: number;
  propane: number;
  lodging: number;
  materials: number;
  other: number;
  actualTotal: number;
  resourceTotal: number;

  fixedOh: number;

  workedHours: number;
  laborHours: number;

  // MDU
  isMDU?: boolean;
  mduTargetPerDay?: number;
  mduRemainingAfterDay?: number | null;
  mduConsumedPctAfterDay?: number | null;
  mduHourRate?: number;
  mduLaborCost?: number;
  mduTruckCost?: number;
  mduActualExpenses?: number;
  mduUsedToday?: number;

  _taskTotals?: Map<string, number>;
  _fiberVariantTotals?: Map<string, FiberVariantAgg>;
};

function DayPill({
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
      className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition active:scale-95
      ${
        active
          ? "bg-sky-600 border-sky-600 text-white shadow-sm"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function DayAxisTick({
  x,
  y,
  payload,
  selected,
}: {
  x: number;
  y: number;
  payload: { value: string };
  selected: string | undefined;
}) {
  const isActive = selected === payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="middle"
        className={isActive ? "font-semibold" : ""}
        style={{
          fontSize: 10,
          fill: isActive ? "#0f172a" : "#9ca3af",
        }}
      >
        {payload.value}
      </text>
    </g>
  );
}

function prettyName(key: unknown): string {
  if (typeof key !== "string") return "";

  return key
    .replace(/_FT$/i, "")
    .replace(/_EA$/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function prettyVariantName(code: unknown): string {
  if (!code) return "";

  return String(code)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(n: number | undefined | null): string {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactCurrency(n: number | undefined | null): string {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatQty(qty: number | undefined | null): string {
  const v = typeof qty === "number" && !isNaN(qty) ? qty : 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function sortPriceLists(lists: PriceListSummary[]): PriceListSummary[] {
  return [...lists].sort((a, b) => {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

    const aActive = !!a.is_active;
    const bActive = !!b.is_active;
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aDate !== bDate) return bDate - aDate;

    return (a.name || "").localeCompare(b.name || "");
  });
}

function normalizeRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.lists)) return data.lists;
  return [];
}

function normalizeProjectKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function buildSubmissionKeys(sub: SubmissionRow): string[] {
  const keys = [sub.project, sub.project_code, sub.project_label, sub.project_id]
    .map((v) => normalizeProjectKey(v as any))
    .filter(Boolean) as string[];
  return Array.from(new Set(keys));
}

function buildPriceListKeys(pl: PriceListSummary): string[] {
  const keys = [pl.project_code, pl.project_number, pl.name, pl.id]
    .map((v) => normalizeProjectKey(v as any))
    .filter(Boolean) as string[];
  return Array.from(new Set(keys));
}

function parseISODate(d: any): Date | null {
  if (!d) return null;
  const raw = String(d).trim();
  if (!raw) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const dt = new Date(normalized);
  return isNaN(dt.getTime()) ? null : dt;
}

function hasProductionToday(subs: SubmissionRow[]): boolean {
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return subs.some((s) => {
    const raw = String(s?.date ?? "").trim();
    if (!raw) return false;

    // Caso 1: viene como YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw === todayStr;
    }

    // Caso 2: viene con hora / timezone
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;

    const subStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

    return subStr === todayStr;
  });
}

function hasRecentProduction(subs: SubmissionRow[], days = 7): boolean {
  const now = new Date();
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days
  );

  return subs.some((s) => {
    const raw = String(s?.date ?? "").trim();
    if (!raw) return false;

    // formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split("-").map(Number);
      const subDate = new Date(y, m - 1, d);
      return subDate >= cutoff;
    }

    // con hora
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return false;

    const subDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return subDate >= cutoff;
  });
}

function normalizeSoilValue(value: any): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSoilFromObject(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;

  const direct =
    obj.soil_type ??
    obj.soilType ??
    obj.soil ??
    obj.soil_kind ??
    obj.ground_type ??
    obj.groundType ??
    obj.terrain_type ??
    obj.terrainType ??
    obj.ground ??
    obj.surface_type ??
    obj.surfaceType ??
    obj.meta?.soil_type ??
    obj.meta?.soilType ??
    obj.meta?.soil ??
    obj.meta?.soil_kind ??
    obj.meta?.ground_type ??
    obj.meta?.groundType ??
    obj.meta?.terrain_type ??
    obj.meta?.terrainType ??
    obj.meta?.ground ??
    obj.meta?.surface_type ??
    obj.meta?.surfaceType;

  return normalizeSoilValue(direct);
}

function getSoilFromTask(task: any): string | null {
  if (!task || typeof task !== "object") return null;

  const direct =
    task.soil_type ??
    task.soilType ??
    task.soil ??
    task.soil_kind ??
    task.ground_type ??
    task.groundType ??
    task.terrain_type ??
    task.terrainType ??
    task.ground ??
    task.surface_type ??
    task.surfaceType ??
    task.meta?.soil_type ??
    task.meta?.soilType ??
    task.meta?.soil ??
    task.meta?.soil_kind ??
    task.meta?.ground_type ??
    task.meta?.groundType ??
    task.meta?.terrain_type ??
    task.meta?.terrainType ??
    task.meta?.ground ??
    task.meta?.surface_type ??
    task.meta?.surfaceType;

  return normalizeSoilValue(direct);
}

function extractSoilFromSubmission(sub: SubmissionRow): string | null {
  const direct =
    getSoilFromObject(sub) ||
    getSoilFromObject(sub.entries) ||
    getSoilFromObject(sub.entries_json);

  if (direct) return direct;

  const tasks = extractOverviewTasksFromSubmission(sub);
  for (const t of tasks) {
    const soil = getSoilFromTask(t);
    if (soil) return soil;
  }

  return null;
}

function resolveProjectSoil(
  pl: PriceListSummary,
  details: PriceListDetails | undefined,
  matchedSubs: SubmissionRow[]
): string | null {
  const fromList = getSoilFromObject(pl) || getSoilFromObject(details?.list);
  if (fromList) return fromList;

  for (const sub of matchedSubs) {
    const soil = extractSoilFromSubmission(sub);
    if (soil) return soil;
  }

  return null;
}

const DAY_KEY_FROM_UTCDAY: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTodayDayKey(): string {
  const wd = new Date().getUTCDay();
  return DAY_KEY_FROM_UTCDAY[wd] || "Mon";
}

function startOfWeekMondayUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

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

function SummaryMetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm min-w-0">
      <div className={`text-[11px] ${accent}`}>{label}</div>
      <div className="text-[15px] font-semibold mt-1 tabular-nums text-slate-900 truncate">
        {value}
      </div>
    </div>
  );
}

// ================== FIBER HELPERS ==================
function normVariantFromTask(t: any): string {
  const v =
    t?.variant_code ??
    t?.variantCode ??
    t?.variant ??
    t?.fiber_type ??
    t?.fiberType ??
    t?.fiber_count ??
    t?.fiberCount ??
    t?.type ??
    t?.meta?.variant_code ??
    t?.meta?.fiber_type ??
    t?.meta?.fiber_count ??
    null;

  const s = String(v ?? "").trim();
  return s ? s.toUpperCase() : "UNKNOWN";
}

function isTaskKeyIn(key: any, candidates: string[]) {
  const k = String(key || "").trim().toUpperCase();
  return candidates.some((c) => String(c).trim().toUpperCase() === k);
}

const MISSILE_ROW_TASK_MAP: Record<string, string> = {
  missile_shot_qty: "MISSILE_SHOT_EA",
  curb_shot_qty: "MISSILE_CURB_SHOT_EA",
  curb_sidewalk_shot_qty: "MISSILE_CURB_SIDEWALK_SHOT_EA",
  stub_shot_qty: "MISSILE_STUB_SHOT_EA",
  curb_dig_qty: "MISSILE_CURB_DIG_EA",
  db_dig_deep_cut_qty: "DB_DIG_DEEP_CUT_EA",
  softscape_ft: "MISSILE_SOFTSCAPE_FT",
  hardscape_ft: "MISSILE_HARDSCAPE_FT",
};

function resolveMissileTaskKey(shotType: any): string {
  const raw = String(shotType || "").trim();
  const upper = raw.toUpperCase();

  return MISSILE_ROW_TASK_MAP[raw] || MISSILE_ROW_TASK_MAP[upper] || upper;
}

const MISSILE_TASK_KEYS = new Set(Object.values(MISSILE_ROW_TASK_MAP));

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

function getMissileRowsFromSubmission(sub: SubmissionRow): any[] {
  const root = safeObject(sub.entries_json ?? sub.entries);

  const candidates = [
    root?.production?.tasks?.MISILE_SHOT,
    root?.payload?.production?.tasks?.MISILE_SHOT,
    root?.payload?.payload?.production?.tasks?.MISILE_SHOT,
    root?.tasks?.MISILE_SHOT,
  ];

  for (const missile of candidates) {
    if (Array.isArray(missile?.missile_rows)) {
      return missile.missile_rows;
    }
  }

  return [];
}

function extractOverviewTasksFromSubmission(sub: SubmissionRow): any[] {
  const missileRows = getMissileRowsFromSubmission(sub);

  const baseTasks = extractTasksFromSubmission(sub).filter((t: any) => {
    if (!missileRows.length) return true;
    return !MISSILE_TASK_KEYS.has(String(t?.task_key || "").toUpperCase());
  });

  const missileTasks = missileRows
    .map((row: any) => {
      const qty = Number(row?.qty) || 0;
      const task_key = resolveMissileTaskKey(row?.shot_type);

          if (!task_key || qty <= 0) return null;

      return {
        task_key,
        qty,
      };
    })
    .filter(Boolean);

  return [...baseTasks, ...missileTasks];
}

function calcOverviewRevenueForSubmission(
  sub: SubmissionRow,
  listId: string,
  priceMapsByListId: Record<string, Map<string, number>>
): number {


  
  const priceMap = priceMapsByListId[listId] || new Map<string, number>();

  return extractOverviewTasksFromSubmission(sub).reduce((sum: number, t: any) => {
    const qty = Number(t?.qty) || 0;
    if (qty <= 0) return sum;

    const taskKey = String(t?.task_key || "").trim().toUpperCase();
    const variant = t?.variant_code ? String(t.variant_code).trim().toUpperCase() : null;
    
    const unitPrice = getCompositeUnitPrice(priceMap, taskKey, variant);

    return sum + qty * unitPrice;
  }, 0);
}

function pickPriceForVariant(
  priceRows: Array<{ task_key: string; price_per_unit: number; variant_code?: string | null }>,
  taskKeyCandidates: string[],
  variantCode: string
): number {
  const vNorm = String(variantCode || "").trim().toUpperCase();
  const matchTask = (rowKey: any, cand: string) =>
    String(rowKey || "").trim().toUpperCase() === String(cand).trim().toUpperCase();

  for (const cand of taskKeyCandidates) {
    const found = priceRows.find((p) => {
      const tkOk = matchTask(p.task_key, cand);
      const vc = String(p.variant_code ?? "").trim().toUpperCase();
      return tkOk && vc === vNorm;
    });
    if (found) return Number(found.price_per_unit) || 0;
  }

  for (const cand of taskKeyCandidates) {
    const found = priceRows.find((p) => {
      const tkOk = matchTask(p.task_key, cand);
      const vc = String(p.variant_code ?? "").trim();
      return tkOk && !vc;
    });
    if (found) return Number(found.price_per_unit) || 0;
  }

  return 0;
}

function calcProjectDays(pl: PriceListSummary): number | null {
  const start = parseISODate(getMDUStartDate(pl) || pl.mdu_start_date);
  const end = parseISODate(getMDUCloseOutBy(pl) || pl.mdu_close_out_by);
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / 86400000) + 1;
  return days > 0 ? days : null;
}

function calcDaysRemaining(pl: PriceListSummary): number | null {
  const closeOut = parseISODate(getMDUCloseOutBy(pl) || pl.mdu_close_out_by);
  if (!closeOut) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(closeOut.getFullYear(), closeOut.getMonth(), closeOut.getDate());

  const ms = end.getTime() - today.getTime();
  return Math.ceil(ms / 86400000);
}

function countUniqueSubmissionDates(submissions: SubmissionRow[]): number {
  const s = new Set<string>();
  submissions.forEach((sub) => {
    if (sub?.date) s.add(String(sub.date).slice(0, 10));
  });
  return s.size;
}

function getMDUHourRate(pl: PriceListSummary): number {
  const n = Number(pl?.mdu_hour_rate ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function calcMDULaborCost(crewCount: number, workedHours: number, hourRate: number): number {
  const crew = Number(crewCount) || 0;
  const hours = Number(workedHours) || 0;
  const rate = Number(hourRate) || 0;
  return crew * hours * rate;
}

// ================== MAIN COMPONENT ==================
const AdminOverview: React.FC = () => {
  const [lists, setLists] = useState<PriceListSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  const [rates, setRates] = useState<RatesPayload>({ crew_per_day: 0, truck_per_day: 0 });

  const [fixedOverheadPerDay, setFixedOverheadPerDay] = useState<number>(0);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const [detailsById, setDetailsById] = useState<Record<string, PriceListDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "all">("active");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const [selectedDayByProject, setSelectedDayByProject] = useState<Record<string, string>>({});

  async function ensureListDetailsLoaded(listId: string) {
    if (!listId) return;
    if (detailsById[listId] || detailsLoading[listId]) return;

    setDetailsLoading((p) => ({ ...p, [listId]: true }));
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

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Error loading price list details (${res.status})`);
      }

      setDetailsById((p) => ({
        ...p,
        [listId]: {
          list: json.list,
          prices: Array.isArray(json.prices) ? json.prices : [],
        },
      }));
    } catch (e) {
      console.error("[AdminOverview] ensureListDetailsLoaded:", e);
    } finally {
      setDetailsLoading((p) => ({ ...p, [listId]: false }));
    }
  }

  useEffect(() => {
  let cancelled = false;

  async function loadOverview() {
    if (!lists.length) {
  setLoading(true);
}
    setError(null);

    try {
      // 1) Cargar primero los projects / price lists
      console.time("overview-total-price-lists");
console.time("overview-fetch-price-lists");

const resLists = await fetch(PRICE_LISTS_ENDPOINT, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  },
});

console.timeEnd("overview-fetch-price-lists");

console.time("overview-json-price-lists");
const jsonLists: any = await resLists.json().catch(() => ({}));
console.timeEnd("overview-json-price-lists");

if (!resLists.ok || jsonLists.ok === false) {
  throw new Error(
    jsonLists.error || `Error loading price lists (${resLists.status})`
  );
}

console.time("overview-normalize-price-lists");
const rawLists = normalizeRows(jsonLists) as PriceListSummary[];
console.timeEnd("overview-normalize-price-lists");

console.time("overview-sort-price-lists");
const sorted = sortPriceLists(rawLists);
console.timeEnd("overview-sort-price-lists");

console.log("[overview price lists count]", rawLists.length);

if (cancelled) return;

setLists(sorted);

console.timeEnd("overview-total-price-lists");

requestAnimationFrame(() => {
  setLoading(false);
});

      // 2) Cargar submissions y expenses después
      const [resSubs, resExpenses] = await Promise.all([
        fetch(`${SUBMISSIONS_ENDPOINT}?limit=500`, { method: "GET" }),
        fetch(EXPENSES_ENDPOINT, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }),
      ]);

      if (cancelled) return;

      const jsonSubs: any = await resSubs.json().catch(() => ({}));

      if (!resSubs.ok || jsonSubs.ok === false) {
        console.warn(
          "[AdminOverview] submissions error:",
          jsonSubs?.error || resSubs.status
        );
        setSubmissions([]);
      } else {
        const rows = normalizeRows(jsonSubs.rows ?? jsonSubs) as SubmissionRow[];
        setSubmissions(rows);
      }

      const jsonExpenses: any = await resExpenses.json().catch(() => ({}));

      if (!resExpenses.ok || jsonExpenses.ok === false) {
        console.warn(
          "[AdminOverview] expenses error:",
          jsonExpenses?.error || resExpenses.status
        );
        setRates({ crew_per_day: 0, truck_per_day: 0 });
        setFixedOverheadPerDay(0);
      } else {
        const payload = jsonExpenses?.payload || {};
        const r = payload.rates || {};

        setRates({
          crew_per_day: Number(r.crew_per_day ?? 0) || 0,
          truck_per_day: Number(r.truck_per_day ?? 0) || 0,
        });

        const fixedItems = Array.isArray(payload.fixed) ? payload.fixed : [];
        const fixedTotal = fixedItems.reduce(
          (sum: number, it: any) => sum + (Number(it.amount) || 0),
          0
        );

        const workingDaysPerMonth = 22;
        const perDayGlobal = fixedTotal > 0 ? fixedTotal / workingDaysPerMonth : 0;

        setFixedOverheadPerDay(perDayGlobal);
      }
    } catch (e: any) {
      if (cancelled) return;
      console.error(e);
      setError(e.message || "Error loading overview");
      setLoading(false);
    }
  }

  loadOverview();

  return () => {
    cancelled = true;
  };
}, []);

  const filteredLists = useMemo(() => {
    return lists.filter((pl) => {
      const isCompleted = pl.status === "completed";
      if (statusFilter === "active") return !isCompleted;
      if (statusFilter === "completed") return isCompleted;
      return true;
    });
  }, [lists, statusFilter]);

  const visibleLists = useMemo(
    () => (showAllProjects ? filteredLists : filteredLists.slice(0, PROJECT_VISIBLE_LIMIT)),
    [filteredLists, showAllProjects]
  );

  // -------------------------
  // PRICE MAPS BY LIST ID
  // -------------------------
  const priceMapsByListId = useMemo(() => {
    const out: Record<string, Map<string, number>> = {};

    Object.entries(detailsById).forEach(([listId, det]) => {
      out[listId] = buildPriceMapForList(
        (det?.prices || []).map((p) => ({
          ...p,
          unit: p.unit ?? null,
        }))
      );
    });

    return out;
  }, [detailsById]);

  function getBreakdownForSubmission(sub: SubmissionRow): ExpenseBreakdown {
    const exp: any = (sub as any).expenses || {};
    const crewCount = Number(exp.crewCount ?? exp.crew ?? exp.crew_count) || 0;
    const truckCount = Number(exp.truckCount ?? exp.trucks ?? exp.truck_count) || 0;

    const diesel = Number(exp.diesel) || 0;
    const gas = Number(exp.gas) || 0;
    const propane = Number(exp.propane) || 0;

    const lodging = Number(exp.rent ?? exp.lodging ?? exp.hotel) || 0;
    const materials = Number(exp.materials ?? exp.material ?? exp.supplies) || 0;
    const other = Number(exp.other ?? exp.misc ?? 0) || 0;

    const crewCost = crewCount * (Number(rates?.crew_per_day) || 0);
    const truckCost = truckCount * (Number(rates?.truck_per_day) || 0);

    const actualTotal = calcActualExpensesFromSubmission(sub) || 0;
    const resourceTotal = calcResourceCostFromSubmission(sub, rates) || 0;

    return {
      crewCount,
      truckCount,
      diesel,
      gas,
      propane,
      lodging,
      materials,
      other,
      crewCost,
      truckCost,
      actualTotal,
      resourceTotal,
      total: actualTotal + resourceTotal,
    };
  }

  // -------------------------
  // Fecha de última submission -> semana actual
  // -------------------------
  const weekWindow = useMemo(() => {
    let latest: Date | null = null;

    submissions.forEach((sub) => {
      const dt = parseISODate(sub.date);
      if (!dt) return;
      if (!latest || dt > latest) latest = dt;
    });

    const anchor = latest || new Date();
    const start = startOfWeekMondayUTC(anchor);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    return { start, end };
  }, [submissions]);

  // -------------------------
  // matched submissions by project
  // -------------------------
  const submissionsByKey = useMemo(() => {
    const map = new Map<string, SubmissionRow[]>();

    submissions.forEach((sub) => {
      const keys = buildSubmissionKeys(sub);
      keys.forEach((key) => {
        const arr = map.get(key) || [];
        arr.push(sub);
        map.set(key, arr);
      });
    });

    return map;
  }, [submissions]);

  const projectSubmissionsByListId = useMemo(() => {
    const out = new Map<string, SubmissionRow[]>();

    visibleLists.forEach((pl) => {
      const plKeys = buildPriceListKeys(pl);
      if (!plKeys.length) {
        out.set(pl.id, []);
        return;
      }

      const merged = new Map<string, SubmissionRow>();

      plKeys.forEach((key) => {
        const arr = submissionsByKey.get(key) || [];
        arr.forEach((sub) => {
          merged.set(sub.id, sub);
        });
      });

      out.set(pl.id, Array.from(merged.values()));
    });

    return out;
  }, [lists, submissionsByKey]);

  // -------------------------
  // REVENUE / USED (total por proyecto)
  // Non-MDU: revenue real
  // MDU: used real basado en hour rate + truck + actual expenses
  // -------------------------
  const revenueByListId = useMemo(() => {
  if (!submissions.length) return new Map<string, number>();
    const m = new Map<string, number>();

    visibleLists.forEach((pl) => {
      const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];

      if (isMDUPriceList(pl)) {
        const hourRate = getMDUHourRate(pl);
        let used = 0;

        matchedSubs.forEach((sub) => {
          const breakdown = getBreakdownForSubmission(sub);
          const workedHours = getWorkedHoursFromSubmission(sub);

          const laborCost = calcMDULaborCost(breakdown.crewCount, workedHours, hourRate);

          const truckCost = breakdown.truckCost || 0;
          const actualExpenses = breakdown.actualTotal || 0;

          used += laborCost + truckCost + actualExpenses;
        });

        m.set(pl.id, used);
      } else {
        let total = 0;
        matchedSubs.forEach((sub) => {
          total += calcOverviewRevenueForSubmission(sub, pl.id, priceMapsByListId);
        });
        m.set(pl.id, total);
      }
    });

    return m;
  }, [visibleLists, projectSubmissionsByListId, priceMapsByListId, rates, submissions.length]);

  // -------------------------
  // COSTS REAL (total por lista)
  // Non-MDU: actual + resource
  // MDU: labor(hour rate) + trucks + actual expenses
  // -------------------------
  const expensesByListId = useMemo(() => {
  if (!submissions.length) return new Map<string, number>();
    const m = new Map<string, number>();

    visibleLists.forEach((pl) => {
      const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];
      const isMDU = isMDUPriceList(pl);
      const hourRate = getMDUHourRate(pl);

      let total = 0;

      matchedSubs.forEach((sub) => {
        const breakdown = getBreakdownForSubmission(sub);

        if (isMDU) {
          const workedHours = getWorkedHoursFromSubmission(sub);
          const laborCost = calcMDULaborCost(breakdown.crewCount, workedHours, hourRate);

          total += laborCost + (breakdown.truckCost || 0) + (breakdown.actualTotal || 0);
        } else {
          total +=
            (calcActualExpensesFromSubmission(sub) || 0) +
            (calcResourceCostFromSubmission(sub, rates) || 0);
        }
      });

      m.set(pl.id, total);
    });

    return m;
  }, [lists, projectSubmissionsByListId, rates]);

  // -------------------------
  // MDU LABOR COST TO DATE
  // -------------------------
  const mduLaborCostByListId = useMemo(() => {
  if (!submissions.length) return new Map<string, number>();
    const m = new Map<string, number>();

    visibleLists.forEach((pl) => {
      const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];
      const hourRate = getMDUHourRate(pl);

      if (!isMDUPriceList(pl) || hourRate <= 0) {
        m.set(pl.id, 0);
        return;
      }

      let total = 0;
      matchedSubs.forEach((sub) => {
        const breakdown = getBreakdownForSubmission(sub);
        const workedHours = getWorkedHoursFromSubmission(sub);
        total += calcMDULaborCost(breakdown.crewCount, workedHours, hourRate);
      });

      m.set(pl.id, total);
    });

    return m;
  }, [lists, projectSubmissionsByListId, rates]);

  // -------------------------
  // DETALLE DIARIO — con variantes + MDU
  // -------------------------
  const detailTargetLists = useMemo(() => {
    return lists.filter((pl) => openIds.has(pl.id));
  }, [lists, openIds]);

  const dailyDetailsByListId = useMemo(() => {
    const result = new Map<string, Map<string, DailyDetail>>();

    const IGNORED_KEYS = new Set([
      "feet",
      "ft",
      "ea",
      "qty",
      "quantity",
      "amount",
      "value",
      "total",
    ]);

    detailTargetLists.forEach((pl) => {
      const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];
      const perDay = new Map<string, DailyDetail>();
      const overheadDatesForProject = new Set<string>();
      const isMDU = isMDUPriceList(pl);
      const hourRate = getMDUHourRate(pl);

      const contractTotal = getMDUContractTotal(pl);
      const projectDays = calcProjectDays(pl);
      const targetPerDay =
        isMDU && contractTotal > 0 && projectDays && projectDays > 0
          ? contractTotal / projectDays
          : 0;

      matchedSubs.forEach((sub) => {
        const dt = parseISODate(sub.date);
        if (!dt) return;
        if (dt < weekWindow.start || dt >= weekWindow.end) return;

        const weekdayIndex = dt.getUTCDay();
        const dayKey = DAY_KEY_FROM_UTCDAY[weekdayIndex];
        if (!dayKey) return;

        const dateLabel = `${WEEKDAY_LABELS[weekdayIndex]} ${MONTH_LABELS[dt.getUTCMonth()]} ${dt
          .getUTCDate()
          .toString()
          .padStart(2, "0")}`;

        let dd = perDay.get(dayKey);
        if (!dd) {
          dd = {
            weekdayKey: dayKey,
            dateLabel,
            revenue: 0,
            expenses: 0,
            tasks: [],
            fiberVariants: [],
            soilType: null,
            crewCount: 0,
            truckCount: 0,
            diesel: 0,
            gas: 0,
            propane: 0,
            lodging: 0,
            materials: 0,
            other: 0,
            actualTotal: 0,
            resourceTotal: 0,
            fixedOh: 0,
            workedHours: 0,
            laborHours: 0,
            isMDU,
            mduTargetPerDay: targetPerDay,
            mduRemainingAfterDay: null,
            mduConsumedPctAfterDay: null,
            mduHourRate: hourRate,
            mduLaborCost: 0,
            mduTruckCost: 0,
            mduActualExpenses: 0,
            mduUsedToday: 0,
            _taskTotals: new Map<string, number>(),
            _fiberVariantTotals: new Map<string, FiberVariantAgg>(),
          };
          perDay.set(dayKey, dd);
        }

        const breakdown = getBreakdownForSubmission(sub);
        const workedHours = getWorkedHoursFromSubmission(sub);
        const laborHours = calcMDULaborHoursForSubmission(sub);

        dd.crewCount += breakdown.crewCount;
        dd.truckCount += breakdown.truckCount;
        dd.diesel += breakdown.diesel;
        dd.gas += breakdown.gas;
        dd.propane += breakdown.propane;
        dd.lodging += breakdown.lodging;
        dd.materials += breakdown.materials;
        dd.other += breakdown.other;
        dd.actualTotal += breakdown.actualTotal;
        dd.resourceTotal += breakdown.resourceTotal;
        dd.workedHours += workedHours;
        dd.laborHours += laborHours;

        if (!dd.soilType) {
          dd.soilType = extractSoilFromSubmission(sub);
        }

        const dateIso = dt.toISOString().slice(0, 10);
        let fixedOhForDay = 0;
        if (!overheadDatesForProject.has(dateIso)) {
          fixedOhForDay = fixedOverheadPerDay;
          dd.fixedOh += fixedOverheadPerDay;
          overheadDatesForProject.add(dateIso);
        }

        if (isMDU) {
          const laborCost = calcMDULaborCost(breakdown.crewCount, workedHours, hourRate);
          const truckCost = breakdown.truckCost || 0;
          const actualExpenses = breakdown.actualTotal || 0;
          const used = laborCost + truckCost + actualExpenses;

          dd.mduLaborCost = (dd.mduLaborCost || 0) + laborCost;
          dd.mduTruckCost = (dd.mduTruckCost || 0) + truckCost;
          dd.mduActualExpenses = (dd.mduActualExpenses || 0) + actualExpenses;
          dd.mduUsedToday = (dd.mduUsedToday || 0) + used;

          dd.revenue += used;
          dd.expenses += used;
        } else {
          const rev = calcOverviewRevenueForSubmission(sub, pl.id, priceMapsByListId);
          dd.revenue += rev;
          dd.expenses += breakdown.total + fixedOhForDay;
        }

        const tasks = extractOverviewTasksFromSubmission(sub);
        tasks.forEach((t: any) => {
          const rawKey = String(t.task_key || "").trim();
          const keyLower = rawKey.toLowerCase();
          if (!rawKey || IGNORED_KEYS.has(keyLower)) return;

          const qty = Number(t.qty) || 0;
          if (qty <= 0) return;

          if (!dd!.soilType) {
            const soilFromTask = getSoilFromTask(t);
            if (soilFromTask) dd!.soilType = soilFromTask;
          }

          const variant = String(t.variant_code || "").trim().toUpperCase();
          const k = `${rawKey}::${variant || ""}`;

          const totals: Map<string, number> = dd!._taskTotals || new Map();
          totals.set(k, (totals.get(k) || 0) + qty);
          dd!._taskTotals = totals;

          const taskKey = rawKey.toUpperCase();
          const variantNorm = variant || normVariantFromTask(t);

          const addVariant = (mode: "blowing" | "plowing", feet: number) => {
            const mapV = dd!._fiberVariantTotals || new Map<string, FiberVariantAgg>();
            const prev = mapV.get(variantNorm) || { blowingFt: 0, plowingFt: 0, totalFt: 0 };
            if (mode === "blowing") prev.blowingFt += feet;
            else prev.plowingFt += feet;
            prev.totalFt += feet;
            mapV.set(variantNorm, prev);
            dd!._fiberVariantTotals = mapV;
          };

          if (isTaskKeyIn(taskKey, FIBER_BLOWING_TASKKEY_CANDIDATES)) addVariant("blowing", qty);
          if (isTaskKeyIn(taskKey, FIBER_PLOWING_TASKKEY_CANDIDATES)) addVariant("plowing", qty);
        });
      });

      if (!perDay.size) {
        result.set(pl.id, perDay);
        return;
      }

      const orderedKeys = Array.from(perDay.keys()).sort(
        (a, b) => DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b)
      );

      let runningUsed = 0;

      orderedKeys.forEach((dayKey) => {
        const dd = perDay.get(dayKey);
        if (!dd) return;

        const totals: Map<string, number> = dd._taskTotals || new Map();
        const priceMap = priceMapsByListId[pl.id] || new Map<string, number>();

        const tasks: TaskSummaryRow[] = Array.from(totals.entries()).map(([compoundKey, qty]) => {
          const [task_key, variant_code_raw] = String(compoundKey).split("::");
          const variant_code = (variant_code_raw || "").trim() || null;

          const unitPrice = getCompositeUnitPrice(priceMap, task_key, variant_code);

          const revenue = (Number(qty) || 0) * unitPrice;

          return { task_key, qty, unitPrice, revenue, variant_code };
        });

        tasks.sort((a, b) => b.revenue - a.revenue);
        dd.tasks = tasks;

        const priceRows = (detailsById[pl.id]?.prices || []) as Array<{
          task_key: string;
          price_per_unit: number;
          variant_code?: string | null;
        }>;

        const fvMap = dd._fiberVariantTotals;
        if (fvMap && fvMap.size > 0) {
          const rows: FiberVariantRow[] = Array.from(fvMap.entries()).map(([variant_code, agg]) => {
            const blowingUnitPrice = pickPriceForVariant(
              priceRows,
              FIBER_BLOWING_TASKKEY_CANDIDATES,
              variant_code
            );
            const plowingUnitPrice = pickPriceForVariant(
              priceRows,
              FIBER_PLOWING_TASKKEY_CANDIDATES,
              variant_code
            );

            const revenue =
              (agg.blowingFt || 0) * blowingUnitPrice + (agg.plowingFt || 0) * plowingUnitPrice;

            return {
              variant_code,
              blowingFt: agg.blowingFt || 0,
              plowingFt: agg.plowingFt || 0,
              totalFt: agg.totalFt || 0,
              blowingUnitPrice,
              plowingUnitPrice,
              revenue,
            };
          });

          rows.sort((a, b) => (b.totalFt || 0) - (a.totalFt || 0));
          dd.fiberVariants = rows;
        } else {
          dd.fiberVariants = [];
        }

        if (isMDU) {
          runningUsed += dd.expenses;
          dd.mduRemainingAfterDay = calcMDURemainingBudget(contractTotal, runningUsed);
          dd.mduConsumedPctAfterDay = calcMDUConsumedPct(contractTotal, runningUsed);
        }

        delete dd._taskTotals;
        delete dd._fiberVariantTotals;
      });

      result.set(pl.id, perDay);
    });

    return result;
  }, [
    detailTargetLists,
    projectSubmissionsByListId,
    detailsById,
    priceMapsByListId,
    fixedOverheadPerDay,
    weekWindow,
    rates,
  ]);

  const kpis = useMemo(() => {
    const totalActive = lists.filter((pl) => pl.status !== "completed").length;
    const totalCompleted = lists.filter((pl) => pl.status === "completed").length;
    return { totalActive, totalCompleted };
  }, [lists]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function buildWeeklySeriesForProject(pl: PriceListSummary): SeriesPoint[] {
    const base: SeriesPoint[] = [
      { d: "Mon", rev: 0, exp: 0 },
      { d: "Tue", rev: 0, exp: 0 },
      { d: "Wed", rev: 0, exp: 0 },
      { d: "Thu", rev: 0, exp: 0 },
      { d: "Fri", rev: 0, exp: 0 },
      { d: "Sat", rev: 0, exp: 0 },
      { d: "Sun", rev: 0, exp: 0 },
    ];

    const idx = new Map<string, number>([
      ["Mon", 0],
      ["Tue", 1],
      ["Wed", 2],
      ["Thu", 3],
      ["Fri", 4],
      ["Sat", 5],
      ["Sun", 6],
    ]);

    const overheadDatesForProject = new Set<string>();
    const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];
    const isMDU = isMDUPriceList(pl);

    const contractTotal = getMDUContractTotal(pl);
    const projectDays = calcProjectDays(pl);
    const targetPerDay =
      isMDU && contractTotal > 0 && projectDays && projectDays > 0
        ? contractTotal / projectDays
        : 0;

    matchedSubs.forEach((sub) => {
      const dt = parseISODate(sub.date);
      if (!dt) return;
      if (dt < weekWindow.start || dt >= weekWindow.end) return;

      const dayKey = DAY_KEY_FROM_UTCDAY[dt.getUTCDay()];
      const i = dayKey ? idx.get(dayKey) : undefined;
      if (i == null) return;

      const breakdown = getBreakdownForSubmission(sub);

      const dateIso = dt.toISOString().slice(0, 10);
      let fixedShareForThisProjectAndDay = 0;
      if (!overheadDatesForProject.has(dateIso)) {
        fixedShareForThisProjectAndDay = fixedOverheadPerDay;
        overheadDatesForProject.add(dateIso);
      }

      if (isMDU) {
        const hourRate = getMDUHourRate(pl);
        const workedHours = getWorkedHoursFromSubmission(sub);
        const laborCost = calcMDULaborCost(breakdown.crewCount, workedHours, hourRate);
        const used = laborCost + (breakdown.truckCost || 0) + (breakdown.actualTotal || 0);

        base[i].rev += used;
        base[i].exp += targetPerDay;
      } else {
        const variableExp =
          (calcActualExpensesFromSubmission(sub) || 0) +
          (calcResourceCostFromSubmission(sub, rates) || 0);

        const rev = calcOverviewRevenueForSubmission(sub, pl.id, priceMapsByListId);
        base[i].rev += rev;
        base[i].exp += variableExp + fixedShareForThisProjectAndDay;
      }
    });

    return base;
  }

  return (
    <div className="space-y-3">
      <section className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <BarChart2 size={12} className="opacity-70" />
          Projects overview
        </span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <FilterPill
              label="Active"
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            />
            <FilterPill
              label="Completed"
              active={statusFilter === "completed"}
              onClick={() => setStatusFilter("completed")}
            />
            <FilterPill
              label="All"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
          </div>

          {filteredLists.length > PROJECT_VISIBLE_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllProjects((prev) => !prev)}
              className="px-2 py-0.5 rounded-full border border-slate-200 text-[10px] text-slate-600 bg-slate-50 hover:bg-slate-100 active:scale-95"
            >
              {showAllProjects ? "Collapse" : "Show all"}
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <KpiCard
          label="Active"
          value={kpis.totalActive.toString()}
          icon={<Layers size={14} />}
          accent="text-sky-600"
        />
        <KpiCard
          label="Completed"
          value={kpis.totalCompleted.toString()}
          icon={<BarChart2 size={14} />}
          accent="text-emerald-600"
        />
      </section>

      {loading && (
        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          Loading overview…
        </div>
      )}
      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
          {error}
        </div>
      )}

      <section className="space-y-3">
        {visibleLists.map((pl) => {
          const status = pl.status === "completed" ? "completed" : "active";
          const statusLabel = status === "completed" ? "Completed" : "Active";
          const isOpen = openIds.has(pl.id);
          const isDetLoading = !!detailsLoading[pl.id];
          const isMDU = isMDUPriceList(pl);

          const series = isOpen ? buildWeeklySeriesForProject(pl) : [];
          const maxY = Math.max(
            ...series.map((d) => Math.max(d.rev || 0, d.exp || 0)),
            0
          );
          const paddedMax = Math.ceil(maxY * 1.2);
          const finalMaxY = paddedMax > 0 ? paddedMax : 100;

          const matchedSubs = projectSubmissionsByListId.get(pl.id) || [];
          const hasTodayProduction = hasProductionToday(matchedSubs);
          const hasRecentProduction7d = hasRecentProduction(matchedSubs, 7);
          const projectSoilType = resolveProjectSoil(pl, detailsById[pl.id], matchedSubs);

          const perDayMap = dailyDetailsByListId.get(pl.id);
          const todayKey = getTodayDayKey();

          let dayKeyForCard = selectedDayByProject[pl.id];
          if (!dayKeyForCard && perDayMap && perDayMap.size > 0) {
            if (perDayMap.has(todayKey)) dayKeyForCard = todayKey;
            else dayKeyForCard = Array.from(perDayMap.keys())[0];
          }

          const dailyDetail = dayKeyForCard && perDayMap ? perDayMap.get(dayKeyForCard) : undefined;
          const dayLabelForHeader = dailyDetail?.dateLabel || dayKeyForCard || todayKey;
          const selectedDaySoilType = dailyDetail?.soilType || projectSoilType;

          const dailyRevenue = dailyDetail ? dailyDetail.revenue : 0;
          const dailyExpenses = dailyDetail ? dailyDetail.expenses : 0;
          const dailyProfit = dailyRevenue - dailyExpenses;

          const dailyTasks: TaskSummaryRow[] =
            dailyDetail && dailyDetail.tasks.length ? dailyDetail.tasks : [];
          const { boreGroups, otherTasks } = splitBoreSoilTasks(dailyTasks);
          const priceMapForList = priceMapsByListId[pl.id] || new Map<string, number>();

          const crewCount = dailyDetail?.crewCount ?? 0;
          const truckCount = dailyDetail?.truckCount ?? 0;
          const diesel = dailyDetail?.diesel ?? 0;
          const gas = dailyDetail?.gas ?? 0;
          const propane = dailyDetail?.propane ?? 0;
          const lodging = dailyDetail?.lodging ?? 0;
          const materials = dailyDetail?.materials ?? 0;
          const other = dailyDetail?.other ?? 0;
          const actualTotal = dailyDetail?.actualTotal ?? 0;
          const resourceTotal = dailyDetail?.resourceTotal ?? 0;
          const workedHours = dailyDetail?.workedHours ?? 0;
          const laborHours = dailyDetail?.laborHours ?? 0;

          const crewCost = crewCount * (Number(rates.crew_per_day) || 0);
          const truckCost = truckCount * (Number(rates.truck_per_day) || 0);

          const contractTotal = getMDUContractTotal(pl);
          const totalUsed = expensesByListId.get(pl.id) || 0;
          const remainingBudget = calcMDURemainingBudget(contractTotal, totalUsed);
          const burnPct = calcMDUConsumedPct(contractTotal, totalUsed);
          const daysWorked = countUniqueSubmissionDates(matchedSubs);
          const daysRemaining = calcDaysRemaining(pl);
          const projectDays = calcProjectDays(pl);

          const hourRate = getMDUHourRate(pl);
          const dailyMDULaborCost = dailyDetail?.mduLaborCost ?? 0;
          const dailyMDUTruckCost = dailyDetail?.mduTruckCost ?? 0;
          const dailyMDUActualExpenses = dailyDetail?.mduActualExpenses ?? 0;
          const dailyMDUUsed = dailyDetail?.mduUsedToday ?? 0;
          const totalMDULaborCost = mduLaborCostByListId.get(pl.id) || 0;

          return (
            <article
              key={pl.id}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
                status === "completed" ? "border-emerald-200" : "border-sky-200"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const willOpen = !isOpen;

                  toggleOpen(pl.id);

                  if (willOpen && !detailsById[pl.id] && !detailsLoading[pl.id]) {
                    void ensureListDetailsLoaded(pl.id);
                  }
                }}
                className="w-full text-left p-3 flex items-start gap-3"
              >
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-sky-400 to-fuchsia-500 flex items-center justify-center text-slate-900 flex-none">
                  <Factory size={18} />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 min-w-0">
                    <div className="text-[13px] font-semibold tracking-wide truncate text-slate-900">
                      {pl.name || "(no name)"}
                    </div>

                    {hasTodayProduction ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-green-500 flex-none"
                          title="Production today"
                        />
                      ) : hasRecentProduction7d ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-yellow-400 flex-none"
                          title="Production in last 7 days"
                        />
                      ) : null}
                  </div>

                    {isMDU && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border bg-violet-50 border-violet-300 text-violet-700">
                        MDU
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        status === "completed"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-sky-50 border-sky-300 text-sky-700"
                      }`}
                    >
                      {statusLabel}
                    </span>

                    {projectSoilType && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border bg-amber-50 border-amber-300 text-amber-700">
                        Soil: {projectSoilType}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 truncate">
                    {(pl.project_number || pl.project_code || "PRJ-XXX") +
                      " · " +
                      (pl.customer || "Customer") +
                      (pl.city ? ` · ${pl.city}${pl.state ? `, ${pl.state}` : ""}` : "")}
                  </div>
                </div>

                <div className="text-slate-400 pt-1 flex-none">
                  {isOpen ? (
                    <ChevronUp size={16} className="opacity-80" />
                  ) : (
                    <ChevronDown size={16} className="opacity-80" />
                  )}
                </div>
              </button>

              {isMDU && (
                <div className="px-3 pb-3 -mt-1">
                  <div className="flex flex-nowrap items-stretch gap-1.5 overflow-hidden">
                    <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-1.5 py-1">
                      <div className="text-[8px] text-violet-600 leading-none truncate">Contract</div>
                      <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-slate-900 leading-none truncate">
                        {formatCompactCurrency(contractTotal)}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-1.5 py-1">
                      <div className="text-[8px] text-rose-500 leading-none truncate">Used</div>
                      <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-slate-900 leading-none truncate">
                        {formatCompactCurrency(totalUsed)}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-1.5 py-1">
                      <div className="text-[8px] text-emerald-600 leading-none truncate">Remaining</div>
                      <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-slate-900 leading-none truncate">
                        {formatCompactCurrency(remainingBudget)}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-1.5 py-1">
                      <div className="text-[8px] text-amber-600 leading-none truncate">Burn %</div>
                      <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-slate-900 leading-none truncate">
                        {burnPct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-200 bg-slate-50">
                  {isDetLoading && (
                    <div className="mt-3 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1">
                      Loading prices for this list…
                    </div>
                  )}

                  <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-white">
                    <div className="px-3 py-2 text-[11px] flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1">
                        <BarChart2 size={14} />
                        {isMDU ? "Weekly used vs target" : "Weekly revenue vs expenses"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Tap / click a day to inspect
                      </span>
                    </div>

                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RLineChart
                          data={series}
                          margin={{ top: 8, right: 20, left: 10, bottom: 0 }}
                          onClick={(e: any) => {
                            const label = e?.activeLabel as string | undefined;
                            if (!label) return;
                            setSelectedDayByProject((prev) => ({ ...prev, [pl.id]: label }));
                          }}
                        >
                          <CartesianGrid stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="d"
                            axisLine={false}
                            tickLine={false}
                            tick={(props: any) => (
                              <DayAxisTick {...props} selected={dayKeyForCard} />
                            )}
                          />
                          <YAxis
                            domain={[0, finalMaxY]}
                            tickFormatter={(v) => Number(v).toFixed(2)}
                            tickCount={5}
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            width={42}
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
                            name={isMDU ? "Used" : "Revenue"}
                          />
                          <Line
                            type="monotone"
                            dataKey="exp"
                            stroke="#fb923c"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="4 4"
                            name={isMDU ? "Target" : "Expenses"}
                          />
                        </RLineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="px-3 pb-2 pt-1">
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {DAY_KEYS.map((dk) => (
                          <DayPill
                            key={dk}
                            label={dk}
                            active={dayKeyForCard === dk}
                            onClick={() =>
                              setSelectedDayByProject((prev) => ({ ...prev, [pl.id]: dk }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Customer</span>
                      <span className="font-semibold text-slate-900">{pl.customer || "—"}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-600">Project code</span>
                      <span className="font-semibold text-slate-900">
                        {pl.project_number || pl.project_code || pl.id}
                      </span>
                    </div>

                    {projectSoilType && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Soil type</span>
                        <span className="font-semibold text-slate-900">{projectSoilType}</span>
                      </div>
                    )}

                    {isMDU && (
                      <>
                        {pl.address && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Address</span>
                            <span className="font-semibold text-slate-900">{pl.address}</span>
                          </div>
                        )}
                        {pl.mdu_start_date && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Start</span>
                            <span className="font-semibold text-slate-900">{pl.mdu_start_date}</span>
                          </div>
                        )}
                        {pl.mdu_close_out_by && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Close out by</span>
                            <span className="font-semibold text-slate-900">
                              {pl.mdu_close_out_by}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-600">Hour rate</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(hourRate)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="pt-1 mt-1 border-t border-slate-200" />

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Selected day</span>
                      <span className="font-semibold text-slate-900">{dayLabelForHeader}</span>
                    </div>

                    {selectedDaySoilType && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Soil (day)</span>
                        <span className="font-semibold text-slate-900">{selectedDaySoilType}</span>
                      </div>
                    )}

                    {!isMDU ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Revenue (day)</span>
                          <span className="font-semibold text-emerald-700">
                            {formatCurrency(dailyRevenue)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Costs (day)</span>
                          <span className="font-semibold text-amber-700">
                            {formatCurrency(dailyExpenses)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Profit (day)</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(dailyProfit)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Used today</span>
                          <span className="font-semibold text-amber-700">
                            {formatCurrency(dailyMDUUsed)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Daily target</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(dailyDetail?.mduTargetPerDay ?? 0)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Crew number</span>
                          <span className="font-semibold text-slate-900">
                            {formatQty(crewCount)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Worked hours</span>
                          <span className="font-semibold text-slate-900">
                            {formatQty(workedHours)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Labor value today</span>
                          <span className="font-semibold text-slate-900">
                            {formatQty(crewCount)} × {formatQty(workedHours)} ×{" "}
                            {formatCurrency(hourRate)} = {formatCurrency(dailyMDULaborCost)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Remaining after day</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(dailyDetail?.mduRemainingAfterDay ?? remainingBudget)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Consumed after day</span>
                          <span className="font-semibold text-slate-900">
                            {`${Number(
                              dailyDetail?.mduConsumedPctAfterDay ?? burnPct
                            ).toFixed(1)}%`}
                          </span>
                        </div>
                      </>
                    )}

                    {!isMDU && dailyTasks.length > 0 && (
                      <div className="pt-1 mt-1 border-t border-slate-200 space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-700 font-semibold">
                            Daily production
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Tasks (qty × price = revenue)
                          </span>
                        </div>

                        {boreGroups.map((group) => (
                          <div
                            key={`${group.task_key}::${group.baseVariant}`}
                            className="space-y-0.5"
                          >
                            <div className="text-slate-700 font-medium break-words">
                              {prettyName(group.task_key)}
                            </div>

                            {group.baseVariant && (
                              <div className="text-[10px] text-slate-500 break-words">
                                {prettyVariantName(group.baseVariant)}
                              </div>
                            )}

                            <div className="mt-1 space-y-0.5">
                              {group.rows.map((row) => {
                                const basePrice = getCompositeUnitPrice(
                                  priceMapForList,
                                  group.task_key,
                                  group.baseVariant
                                );

                                const markupPrice =
                                  row.soil && row.soil !== "DIRT"
                                    ? getCompositeUnitPrice(
                                        priceMapForList,
                                        "BORE_SOIL_MARKUP_FT",
                                        row.soil
                                      )
                                    : 0;

                                const unitPrice = basePrice + markupPrice;
                                const revenue = row.qty * unitPrice;

                                return (
                                  <div
                                    key={`${group.task_key}::${group.baseVariant}::${row.soil}`}
                                    className="flex justify-between gap-2 pl-2 border-l border-slate-200"
                                  >
                                    <span className="text-[10px] text-slate-500 flex-1 min-w-0 break-words">
                                      {row.soil}
                                      {markupPrice > 0 ? ` (+${formatCurrency(markupPrice)})` : ""}
                                    </span>

                                    <span className="font-semibold text-slate-900 flex-none whitespace-nowrap text-right tabular-nums">
                                      {formatQty(row.qty)} × {formatCurrency(unitPrice)} ={" "}
                                      {formatCurrency(revenue)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {otherTasks.map((t) => (
                          <div
                            key={`${t.task_key}::${t.variant_code || ""}`}
                            className="flex justify-between gap-2"
                          >
                            <div className="text-slate-700 flex-1 min-w-0">
                              <div className="break-words">
                                {prettyName(t.task_key)}
                              </div>

                              {t.variant_code && (
                                <div className="text-[10px] text-slate-500 mt-0.5 break-words">
                                  {prettyVariantName(t.variant_code)}
                                </div>
                              )}
                            </div>

                            <span className="font-semibold text-slate-900 flex-none whitespace-nowrap text-right tabular-nums">
                              {formatQty(t.qty)} × {formatCurrency(t.unitPrice)} ={" "}
                              {formatCurrency(t.revenue)}
                            </span>
                          </div>
                        ))}
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
                          {crewCount} × {formatCurrency(rates.crew_per_day)} ={" "}
                          {formatCurrency(crewCost)}
                        </span>
                      </div>
                    )}

                    {isMDU && dailyMDULaborCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Labor</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(dailyMDULaborCost)}
                        </span>
                      </div>
                    )}

                    {truckCost > 0 && !isMDU && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Trucks</span>
                        <span className="font-semibold text-slate-900">
                          {truckCount} × {formatCurrency(rates.truck_per_day)} ={" "}
                          {formatCurrency(truckCost)}
                        </span>
                      </div>
                    )}

                    {isMDU && dailyMDUTruckCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Truck cost</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(dailyMDUTruckCost)}
                        </span>
                      </div>
                    )}

                    {workedHours > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Worked hours</span>
                        <span className="font-semibold text-slate-900">
                          {formatQty(workedHours)}
                        </span>
                      </div>
                    )}

                    {laborHours > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Labor hours</span>
                        <span className="font-semibold text-slate-900">
                          {formatQty(laborHours)}
                        </span>
                      </div>
                    )}

                    <div className="pt-1 mt-1 border-t border-slate-200" />

                    {diesel > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Diesel</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(diesel)}
                        </span>
                      </div>
                    )}
                    {gas > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Gas</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(gas)}
                        </span>
                      </div>
                    )}
                    {propane > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Propane</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(propane)}
                        </span>
                      </div>
                    )}
                    {lodging > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Purchases</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(lodging)}
                        </span>
                      </div>
                    )}
                    {materials > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Materials</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(materials)}
                        </span>
                      </div>
                    )}
                    {other > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Other</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(other)}
                        </span>
                      </div>
                    )}

                    <div className="pt-1 mt-1 border-t border-slate-200" />
                    {actualTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Actual expenses</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(actualTotal)}
                        </span>
                      </div>
                    )}
                    {!isMDU && resourceTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Resources total</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(resourceTotal)}
                        </span>
                      </div>
                    )}
                    {isMDU && dailyMDUActualExpenses > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Actual expenses</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(dailyMDUActualExpenses)}
                        </span>
                      </div>
                    )}

                    {isMDU && (
                      <>
                        <div className="pt-1 mt-1 border-t border-slate-200" />
                        <div className="text-[10px] text-slate-700 font-semibold">
                          MDU summary
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Contract total</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(contractTotal)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Hour rate</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(hourRate)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Used to date</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(totalUsed)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Labor value to date</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(totalMDULaborCost)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Remaining budget</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(remainingBudget)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Burn %</span>
                          <span className="font-semibold text-slate-900">
                            {burnPct.toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-600">Days worked</span>
                          <span className="font-semibold text-slate-900">{daysWorked}</span>
                        </div>

                        {projectDays !== null && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Project days</span>
                            <span className="font-semibold text-slate-900">
                              {projectDays}
                            </span>
                          </div>
                        )}

                        {daysRemaining !== null && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Days remaining</span>
                            <span className="font-semibold text-slate-900">
                              {daysRemaining}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {!loading && filteredLists.length === 0 && (
          <p className="text-[11px] text-slate-500">
            No price lists found for this filter. Create a list in{" "}
            <span className="font-semibold">Prices</span> to see it here.
          </p>
        )}
      </section>
    </div>
  );
};

export default AdminOverview;
export { AdminOverview };