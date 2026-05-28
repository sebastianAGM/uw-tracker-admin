// src/lib/overviewHistory.ts
import {
  PriceListSummary,
  SubmissionRow,
  RatesPayload,
  calcRevenueForSubmission,
  calcActualExpensesFromSubmission,
  calcResourceCostFromSubmission,
  extractTasksFromSubmission,
  calcMDUConsumedPct,
  calcMDURemainingBudget,
  calcMDULaborHoursForSubmission,
  getMDUContractTotal,
  getMDUStartDate,
  getMDUCloseOutBy,
  getWorkedHoursFromSubmission,
  isMDUPriceList,
} from "./uwCalc";

export const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_KEY_FROM_UTCDAY: Record<number, DayKey | undefined> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_LABELS_SHORT = [
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

export type PriceMapsByListId = Record<string, Map<string, number>>;

export type TaskSummaryRow = {
  task_key: string;
  qty: number;
  unitPrice: number;
  revenue: number;
  variant_code?: string | null;
};

export type DailyDetail = {
  weekdayKey: DayKey;
  dateLabel: string;
  dateISO: string;

  revenue: number;
  expenses: number;

  tasks: TaskSummaryRow[];

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
};

export type OverviewWeekSeriesPoint = {
  d: DayKey;
  rev: number;
  exp: number;
};

function clampISO(v: string | null | undefined): string | null {
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

function prettyName(key: unknown): string {
  if (typeof key !== "string") return "";
  return key
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function calcProjectDays(pl: PriceListSummary): number | null {
  const start = parseISODate(getMDUStartDate(pl) || (pl as any).mdu_start_date);
  const end = parseISODate(getMDUCloseOutBy(pl) || (pl as any).mdu_close_out_by);
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / 86400000) + 1;
  return days > 0 ? days : null;
}

function getBreakdownForSubmission(
  sub: SubmissionRow,
  rates: RatesPayload
): {
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
} {
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

function calcMDULaborCost(
  crewCount: number,
  workedHours: number,
  hourRate: number
): number {
  const crew = Number(crewCount) || 0;
  const hours = Number(workedHours) || 0;
  const rate = Number(hourRate) || 0;
  return crew * hours * rate;
}

type BuildOverviewWeekDataArgs = {
  project: PriceListSummary;
  submissions: SubmissionRow[];
  rates: RatesPayload;
  priceMapsByListId: PriceMapsByListId;
  fixedOverheadPerDay: number;
};

export function buildOverviewWeekDataForProject({
  project,
  submissions,
  rates,
  priceMapsByListId,
  fixedOverheadPerDay,
}: BuildOverviewWeekDataArgs): {
  series: OverviewWeekSeriesPoint[];
  perDay: Map<DayKey, DailyDetail>;
} {
  const perDay = new Map<DayKey, DailyDetail>();
  const overheadDatesForProject = new Set<string>();

  const isMDU = isMDUPriceList(project);
  const hourRate = Number((project as any)?.mdu_hour_rate ?? 0) || 0;
  const contractTotal = getMDUContractTotal(project);
  const projectDays = calcProjectDays(project);
  const targetPerDay =
    isMDU && contractTotal > 0 && projectDays && projectDays > 0
      ? contractTotal / projectDays
      : 0;

  const priceMap = priceMapsByListId[project.id];

  submissions.forEach((sub) => {
    const dt = parseISODate(sub.date);
    const dateISO = clampISO(sub.date);
    if (!dt || !dateISO) return;

    const weekdayIndex = dt.getDay();
    const dayKey = DAY_KEY_FROM_UTCDAY[weekdayIndex];
    if (!dayKey) return;

    const dateLabel = `${WEEKDAY_LABELS[weekdayIndex]} ${
      MONTH_LABELS_SHORT[dt.getMonth()]
    } ${String(dt.getDate()).padStart(2, "0")}`;

    let dd = perDay.get(dayKey);
    if (!dd) {
      dd = {
        weekdayKey: dayKey,
        dateLabel,
        dateISO,
        revenue: 0,
        expenses: 0,
        tasks: [],
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
      };
      perDay.set(dayKey, dd);
    }

    const breakdown = getBreakdownForSubmission(sub, rates);
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

    let fixedOhForDay = 0;
    if (!overheadDatesForProject.has(dateISO)) {
      fixedOhForDay = fixedOverheadPerDay;
      dd.fixedOh += fixedOverheadPerDay;
      overheadDatesForProject.add(dateISO);
    }

    if (isMDU) {
      const laborCost = calcMDULaborCost(
        breakdown.crewCount,
        workedHours,
        hourRate
      );
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
      const rev = calcRevenueForSubmission(sub, project.id, priceMapsByListId);
      dd.revenue += rev;
      dd.expenses += breakdown.total + fixedOhForDay;
    }

    const tasks = extractTasksFromSubmission(sub) || [];
    tasks.forEach((t: any) => {
      const rawKey = String(t.task_key || "").trim();
      if (!rawKey) return;

      const qty = Number(t.qty ?? t.quantity ?? 0) || 0;
      if (qty <= 0) return;

      const variant = String(t.variant_code || "").trim().toUpperCase();
      const key = `${rawKey}::${variant || ""}`;

      const totals = dd!._taskTotals || new Map<string, number>();
      totals.set(key, (totals.get(key) || 0) + qty);
      dd!._taskTotals = totals;
    });
  });

  let runningUsed = 0;

  DAY_KEYS.forEach((dayKey) => {
    const dd = perDay.get(dayKey);
    if (!dd) return;

    const totals = dd._taskTotals || new Map<string, number>();

    dd.tasks = Array.from(totals.entries())
      .map(([compoundKey, qty]) => {
        const [task_key, variant_code_raw] = String(compoundKey).split("::");
        const variant_code = (variant_code_raw || "").trim() || null;

        const unitPrice = priceMap
          ? Number(
              priceMap.get(
                `${String(task_key || "").trim().toUpperCase()}::${String(
                  variant_code || ""
                )
                  .trim()
                  .toUpperCase()}`
              ) ??
                priceMap.get(
                  `${String(task_key || "").trim().toUpperCase()}::`
                ) ??
                0
            ) || 0
          : 0;

        return {
          task_key,
          qty,
          unitPrice,
          revenue: (Number(qty) || 0) * unitPrice,
          variant_code,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    if (isMDU) {
      runningUsed += dd.expenses;
      dd.mduRemainingAfterDay = calcMDURemainingBudget(contractTotal, runningUsed);
      dd.mduConsumedPctAfterDay = calcMDUConsumedPct(contractTotal, runningUsed);
    }

    delete dd._taskTotals;
  });

  const series: OverviewWeekSeriesPoint[] = DAY_KEYS.map((d) => {
    const row = perDay.get(d);
    return {
      d,
      rev: row?.revenue || 0,
      exp: row?.expenses || 0,
    };
  });

  return { series, perDay };
}