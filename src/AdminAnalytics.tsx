import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";

import {
  buildPriceMapForList,
  calcActualExpensesFromSubmission,
  calcResourceCostFromSubmission,
  extractTasksFromSubmission,
  getCompositeUnitPrice,
} from "./lib/uwCalc";

type RangeKey = "this_week" | "last_week" | "this_month" | "all";

const API_BASE = "https://uw-backend.sebastian-gonzalez243.workers.dev";
const PRICE_LISTS_ENDPOINT = `${API_BASE}/api/price-lists`;
const SUBMISSIONS_ENDPOINT = `${API_BASE}/api/submissions`;
const EXPENSES_ENDPOINT = `${API_BASE}/api/expenses`;
const ADMIN_TOKEN = "3amigos";

const COLORS = [
  "#0f172a",
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#eab308",
  "#475569",
  "#0d9488",
];

function normalizeMatch(value: any) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function valuesMatch(a: any, b: any) {
  const x = normalizeMatch(a);
  const y = normalizeMatch(b);
  if (!x || !y) return false;

  return x === y || x.includes(y) || y.includes(x);
}

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

const MISSILE_ROW_TASK_MAP: Record<string, string> = {
  missile_shot_qty: "MISSILE_SHOT_EA",
  curb_shot_qty: "MISSILE_CURB_SHOT_EA",
  curb_sidewalk_shot_qty:
    "MISSILE_CURB_SIDEWALK_SHOT_EA",
  stub_shot_qty: "MISSILE_STUB_SHOT_EA",

  curb_dig_ft: "MISSILE_CURB_DIG_EA",
  curb_dig_ea: "MISSILE_CURB_DIG_EA",

  curb_and_dig_ft: "MISSILE_CURB_DIG_EA",
  curb_and_dig_ea: "MISSILE_CURB_DIG_EA",

  softscape_ft: "MISSILE_SOFTSCAPE_FT",
  hardscape_ft: "MISSILE_HARDSCAPE_FT",
};

function getMissileRowsForCsv(sub: any): any[] {
  function findRows(obj: any): any[] {
    if (!obj || typeof obj !== "object") return [];

    if (
      Array.isArray(
        obj?.MISILE_SHOT?.missile_rows
      )
    ) {
      return obj.MISILE_SHOT.missile_rows;
    }

    if (
      Array.isArray(
        obj?.production?.tasks?.MISILE_SHOT
          ?.missile_rows
      )
    ) {
      return obj.production.tasks.MISILE_SHOT
        .missile_rows;
    }

    if (
      Array.isArray(
        obj?.payload?.production?.tasks
          ?.MISILE_SHOT?.missile_rows
      )
    ) {
      return obj.payload.production.tasks
        .MISILE_SHOT.missile_rows;
    }

    if (
      Array.isArray(
        obj?.payload?.payload?.production
          ?.tasks?.MISILE_SHOT
          ?.missile_rows
      )
    ) {
      return obj.payload.payload.production
        .tasks.MISILE_SHOT.missile_rows;
    }

    if (
      Array.isArray(
        obj?.tasks?.MISILE_SHOT
          ?.missile_rows
      )
    ) {
      return obj.tasks.MISILE_SHOT
        .missile_rows;
    }

    return [];
  }

  const roots = [
    sub,
    safeObject(sub.entries_json),
    safeObject(sub.entries),
    safeObject(sub.payload),
  ];

  return (
    roots
      .map(findRows)
      .find((rows) => rows.length > 0) || []
  );
}

function getMissileTaskFromRow(
  row: any
): any | null {
  const qty = Number(row?.qty) || 0;

  const shotType = String(
    row?.shot_type || ""
  ).trim();

  if (!qty || !shotType) {
    return null;
  }

  const task_key =
    MISSILE_ROW_TASK_MAP[shotType];

  if (!task_key) {
    return null;
  }

  return {
    task_key,
    qty,
    quantity: qty,
    variant_code: null,
  };
}

function extractBalanceTasksFromSubmission(
  sub: any
): any[] {
  const missileRows =
    getMissileRowsForCsv(sub);

  const baseTasks =
    extractTasksFromSubmission(sub) || [];

  const missileTaskKeys = new Set(
    Object.values(MISSILE_ROW_TASK_MAP)
  );

  const safeBaseTasks = missileRows.length
    ? baseTasks.filter((task: any) => {
        const taskKey = String(
          task?.task_key || ""
        )
          .trim()
          .toUpperCase();

        return !missileTaskKeys.has(taskKey);
      })
    : baseTasks;

  const missileTasks = missileRows
    .map(getMissileTaskFromRow)
    .filter(Boolean);

  return [
    ...safeBaseTasks,
    ...missileTasks,
  ];
}

function calcBalanceRevenueForSubmission(
  sub: any,
  listId: string,
  priceMapsByListId: Record<string, Map<string, number>>
): number {
  const priceMap = priceMapsByListId[listId];

  if (!priceMap) return 0;

  return extractBalanceTasksFromSubmission(sub).reduce(
    (sum: number, task: any) => {
      const taskKey = String(task?.task_key || "").trim();

      const qty =
        Number(task?.qty ?? task?.quantity ?? 0) || 0;

      if (!taskKey || qty <= 0) {
        return sum;
      }

      const variant =
        task?.variant_code ||
        task?.variant ||
        task?.fiber_type ||
        task?.bore_type ||
        null;

      const unitPrice = getCompositeUnitPrice(
        priceMap,
        taskKey,
        variant
      );

      return sum + qty * unitPrice;
    },
    0
  );
}



function toDateKey(value: any) {
  return String(value || "").slice(0, 10);
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRangeKeys(range: RangeKey) {
  if (range === "all") {
    return { startKey: null, endKey: null };
  }

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "this_week" || range === "last_week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    start.setDate(now.getDate() + diff);

    if (range === "last_week") {
      start.setDate(start.getDate() - 7);
    }

    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  }

  if (range === "this_month") {
    start.setDate(1);

    end.setMonth(now.getMonth() + 1);
    end.setDate(0);
  }

  return {
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

function submissionBelongsToProject(sub: any, pl: any) {
  const subValues = [
    sub.project_id,
    sub.project_code,
    sub.project,
    sub.project_label,
  ]
    .filter(Boolean)
    .map(normalizeMatch);

  const projectValues = [
    pl.id,
    pl.project_code,
    pl.project_number,
    pl.name,
    pl.po_number,
  ]
    .filter(Boolean)
    .map(normalizeMatch);

  return subValues.some((subValue) =>
    projectValues.some((projectValue) => valuesMatch(subValue, projectValue))
  );
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>("this_week");
  const [lists, setLists] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, any>>({});
  const [rates, setRates] = useState<any>({
    crew_per_day: 0,
    truck_per_day: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const [resLists, resSubs, resExpenses] = await Promise.all([
        fetch(PRICE_LISTS_ENDPOINT, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }),
        fetch(`${SUBMISSIONS_ENDPOINT}?limit=500`),
        fetch(EXPENSES_ENDPOINT, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_TOKEN}`,
          },
        }),
      ]);

      const jsonLists = await resLists.json().catch(() => ({}));
      const jsonSubs = await resSubs.json().catch(() => ({}));
      const jsonExpenses = await resExpenses.json().catch(() => ({}));

      const listsRows = Array.isArray(jsonLists)
        ? jsonLists
        : Array.isArray(jsonLists?.rows)
        ? jsonLists.rows
        : Array.isArray(jsonLists?.data)
        ? jsonLists.data
        : Array.isArray(jsonLists?.lists)
        ? jsonLists.lists
        : [];

      const subsRows = Array.isArray(jsonSubs?.rows)
        ? jsonSubs.rows
        : Array.isArray(jsonSubs)
        ? jsonSubs
        : [];

      setLists(listsRows);
      setSubmissions(subsRows);

      const r = jsonExpenses?.payload?.rates || {};
      setRates({
        crew_per_day: Number(r.crew_per_day ?? 0) || 0,
        truck_per_day: Number(r.truck_per_day ?? 0) || 0,
      });

      const detailPairs = await Promise.all(
        listsRows.map(async (pl: any) => {
          try {
            const res = await fetch(`${PRICE_LISTS_ENDPOINT}/${pl.id}`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ADMIN_TOKEN}`,
              },
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok || json?.ok === false) return null;

            return [
              pl.id,
              {
                list: json.list || pl,
                prices: Array.isArray(json.prices) ? json.prices : [],
              },
            ];
          } catch {
            return null;
          }
        })
      );

      const nextDetails: Record<string, any> = {};

      detailPairs.forEach((pair: any) => {
        if (!pair) return;

        const listId = String(pair[0]);
        const det = pair[1];
        const pl = det?.list || {};

        nextDetails[listId] = det;

        [pl.project_code, pl.project_number, pl.name].forEach((alias) => {
          if (alias) nextDetails[String(alias)] = det;
        });
      });

      setDetailsById(nextDetails);
    } catch (e: any) {
      console.error("[AdminAnalytics]", e);
      setError(e?.message || "Error loading analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const activeProjects = useMemo(() => {
    return lists.filter((pl: any) => pl.status !== "completed");
  }, [lists]);

  const filteredSubmissions = useMemo(() => {
    const { startKey, endKey } = getRangeKeys(range);

    if (!startKey || !endKey) return submissions;

    return submissions.filter((sub: any) => {
      const dateKey = toDateKey(sub?.date);
      if (!dateKey) return false;

      return dateKey >= startKey && dateKey <= endKey;
    });
  }, [range, submissions]);

  const priceMapsByListId = useMemo(() => {
    const out: Record<string, Map<string, number>> = {};

    Object.entries(detailsById).forEach(([listId, det]: any) => {
      out[listId] = buildPriceMapForList(
        (det?.prices || []).map((p: any) => ({
          ...p,
          unit: p.unit ?? null,
        }))
      );
    });

    return out;
  }, [detailsById]);

  const projectAnalytics = useMemo(() => {
    return activeProjects.map((pl: any) => {
      const relatedSubs = filteredSubmissions.filter((sub: any) =>
        submissionBelongsToProject(sub, pl)
      );

      const revenue = relatedSubs.reduce((sum: number, sub: any) => {
        return (
          sum +
          calcBalanceRevenueForSubmission(
            sub,
            String(pl.id),
            priceMapsByListId
          )
        );
      }, 0);

      const expenses = relatedSubs.reduce((sum: number, sub: any) => {
        return (
          sum +
          (calcActualExpensesFromSubmission(sub) || 0) +
          (calcResourceCostFromSubmission(sub, rates) || 0)
        );
      }, 0);

      const profit = revenue - expenses;

      return {
        id: pl.id,
        name: pl.name || pl.project_code || "Unnamed",
        revenue,
        expenses,
        profit,
      };
    });
  }, [activeProjects, filteredSubmissions, priceMapsByListId, rates]);

  const totals = useMemo(() => {
    return projectAnalytics.reduce(
      (acc: any, p: any) => {
        acc.revenue += p.revenue;
        acc.expenses += p.expenses;
        acc.profit += p.profit;
        return acc;
      },
      {
        revenue: 0,
        expenses: 0,
        profit: 0,
      }
    );
  }, [projectAnalytics]);

  const financialMix = [
    { name: "Revenue", value: Math.abs(totals.revenue), rawValue: totals.revenue },
    { name: "Expenses", value: Math.abs(totals.expenses), rawValue: totals.expenses },
    {
      name: totals.profit < 0 ? "Loss" : "Profit",
      value: Math.abs(totals.profit),
      rawValue: totals.profit,
    },
  ].filter((x) => x.value > 0);

  const revenueByProject = buildChartData(projectAnalytics, "revenue");
  const profitByProject = buildChartData(projectAnalytics, "profit");
  const expensesByProject = buildChartData(projectAnalytics, "expenses");

  const productionBreakdown = useMemo(() => {
    const totalsByTask: Record<string, number> = {};

    filteredSubmissions.forEach((sub: any) => {
      const tasks = extractTasksFromSubmission(sub);

      tasks.forEach((t: any) => {
        const key = String(t?.task_key || "").toUpperCase();

        let group = "Other";

        if (key.includes("BORE") || key.includes("DRILL")) group = "Bore";
        else if (
          key.includes("FIBER") ||
          key.includes("BLOWING") ||
          key.includes("PLOWING")
        )
          group = "Fiber";
        else if (key.includes("ASPHALT")) group = "Asphalt";
        else if (key.includes("MASTIC")) group = "Mastic";
        else if (key.includes("MISSILE")) group = "Missile";
        else if (key.includes("VAULT")) group = "Vaults";
        else if (key.includes("POTHOLE")) group = "Potholes";
        else if (key.includes("DROP")) group = "Drops";

        totalsByTask[group] =
          (totalsByTask[group] || 0) + (Number(t?.qty) || 0);
      });
    });

    return Object.entries(totalsByTask)
      .filter(([, value]) => Math.abs(Number(value) || 0) > 0)
      .map(([name, value]) => ({
        name,
        value: Number(value) || 0,
        rawValue: Number(value) || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSubmissions]);

  return (
    <div className="space-y-3">
      <section className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <CalendarDays size={12} className="opacity-70" />
          Analytics Quick Range
        </span>

        <button
          onClick={loadAnalytics}
          className="h-8 w-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </section>

      <section className="flex flex-wrap gap-2">
        <FilterPill
          label="This Week"
          active={range === "this_week"}
          onClick={() => setRange("this_week")}
        />
        <FilterPill
          label="Last Week"
          active={range === "last_week"}
          onClick={() => setRange("last_week")}
        />
        <FilterPill
          label="This Month"
          active={range === "this_month"}
          onClick={() => setRange("this_month")}
        />
        <FilterPill
          label="All"
          active={range === "all"}
          onClick={() => setRange("all")}
        />
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-3 text-[12px]">
          {error}
        </div>
      )}

      <section className="grid grid-cols-3 gap-2">
        <MiniMetric
          label="Revenue"
          value={formatMoney(totals.revenue)}
          color="text-blue-600"
        />
        <MiniMetric
          label="Expenses"
          value={formatMoney(totals.expenses)}
          color="text-red-600"
        />
        <MiniMetric
          label="Profit"
          value={formatMoney(totals.profit)}
          color={totals.profit < 0 ? "text-red-600" : "text-emerald-600"}
        />
      </section>

      <DonutCard
        title="Financial Mix"
        subtitle="Revenue / Expenses / Profit"
        data={financialMix}
        centerLabel={totals.profit < 0 ? "Loss" : "Profit"}
        centerValue={formatMoney(totals.profit)}
      />

      <DonutCard
        title="Revenue by Project"
        subtitle="Active projects with revenue"
        data={revenueByProject}
        centerLabel="Revenue"
        centerValue={formatMoney(totals.revenue)}
      />

      <DonutCard
        title="Profit by Project"
        subtitle="Profit and loss by active project"
        data={profitByProject}
        centerLabel="Profit"
        centerValue={formatMoney(totals.profit)}
      />

      <DonutCard
        title="Expenses by Project"
        subtitle="Active projects with expenses"
        data={expensesByProject}
        centerLabel="Expenses"
        centerValue={formatMoney(totals.expenses)}
      />

      <DonutCard
        title="Production Breakdown"
        subtitle="Production by task type"
        data={productionBreakdown}
        centerLabel="Tasks"
        centerValue={filteredSubmissions.length.toString()}
        valueMode="number"
      />
    </div>
  );
}

function buildChartData(
  rows: any[],
  key: "revenue" | "profit" | "expenses"
) {
  return [...rows]
    .filter((p) => Math.abs(Number(p[key]) || 0) > 0)
    .sort((a, b) => Math.abs(Number(b[key])) - Math.abs(Number(a[key])))
    .map((p) => ({
      name: p.name,
      value: Math.abs(Number(p[key]) || 0),
      rawValue: Number(p[key]) || 0,
    }));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(Number(value) || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(Number(value) || 0);
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

function MiniMetric({
  label,
  value,
  color = "text-slate-900",
}: any) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3">
      <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 font-bold">
        {label}
      </div>
      <div className={`text-[14px] font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function DonutCard({
  title,
  subtitle,
  data,
  centerLabel,
  centerValue,
  valueMode = "money",
}: any) {
  const formatValue = (value: number) =>
    valueMode === "number" ? formatNumber(value) : formatMoney(value);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold text-slate-900 truncate">
            {title}
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {subtitle}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[9px] text-slate-500 font-semibold">
            {centerLabel}
          </div>
          <div className="text-[12px] font-extrabold text-slate-900">
            {centerValue}
          </div>
        </div>
      </div>

      <div className="relative h-[175px] mt-1 overflow-visible">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
              >
                {data.map((_: any, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <RTooltip
                formatter={(value: any) => formatValue(Number(value) || 0)}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[12px] text-slate-500">
            No data available.
          </div>
        )}
      </div>

      <div className="space-y-0.5 mt-1">
        {data.map((item: any, index: number) => (
          <div
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-2 py-0.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
              <span className="text-[10px] text-slate-600 truncate">
                {item.name}
              </span>
            </div>

            <span className="text-[10px] font-bold text-slate-900 shrink-0 tabular-nums">
              {formatValue(item.rawValue ?? item.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}