import {
  buildPriceMapForList,
  extractTasksFromSubmission,
  calcActualExpensesFromSubmission,
  calcResourceCostFromSubmission,
  getCompositeUnitPrice,
  getWorkedHoursFromSubmission,
  isMDUPriceList,
  type RatesPayload,
} from "./uwCalc";

export type PriceListSummary = {
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
  created_at?: string | null;
  is_mdu?: boolean | number | string | null;
  mdu_hour_rate?: number | null;
};

export type SubmissionRow = {
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
};

export type PriceListDetails = {
  list: PriceListSummary;
  prices: Array<{
    task_key: string;
    unit?: string | null;
    price_per_unit: number;
    variant_code?: string | null;
  }>;
};

export type ProjectAnalyticsRow = {
  listId: string;
  projectName: string;
  customer: string;
  projectCode: string;
  poNumber: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  submissionsCount: number;
  laborHours: number;
  lastSubmissionDate: string | null;
};

export type ReportAnalytics = {
  totals: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    submissionsCount: number;
    laborHours: number;
  };
  projects: ProjectAnalyticsRow[];
  topRevenue: ProjectAnalyticsRow[];
  topProfit: ProjectAnalyticsRow[];
  topExpenses: ProjectAnalyticsRow[];
  losses: ProjectAnalyticsRow[];
};

const MISSILE_ROW_TASK_MAP: Record<string, string> = {
  missile_shot: "MISSILE_SHOT_EA",
  curb_shot: "MISSILE_CURB_SHOT_EA",
  curb_sidewalk_shot: "MISSILE_CURB_SIDEWALK_SHOT_EA",
  stub_shot: "MISSILE_STUB_SHOT_EA",
  softscape_ft: "MISSILE_SOFTSCAPE_FT",
  hardscape_ft: "MISSILE_HARDSCAPE_FT",
};

const MISSILE_TASK_KEYS = new Set(Object.values(MISSILE_ROW_TASK_MAP));

export function normalizeRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.lists)) return data.lists;
  return [];
}

export function sortPriceLists(lists: PriceListSummary[]): PriceListSummary[] {
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

export function buildPriceMapsByListId(
  detailsById: Record<string, PriceListDetails>
): Record<string, Map<string, number>> {
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
    if (Array.isArray(missile?.missile_rows)) return missile.missile_rows;
  }

  return [];
}

export function extractReportTasksFromSubmission(sub: SubmissionRow): any[] {
  const missileRows = getMissileRowsFromSubmission(sub);

  const baseTasks = extractTasksFromSubmission(sub).filter((t: any) => {
    if (!missileRows.length) return true;
    return !MISSILE_TASK_KEYS.has(String(t?.task_key || "").toUpperCase());
  });

  const missileTasks = missileRows
    .map((row: any) => {
      const qty = Number(row?.qty) || 0;
      const task_key = MISSILE_ROW_TASK_MAP[row?.shot_type];

      if (!task_key || qty <= 0) return null;

      return {
        task_key,
        qty,
        variant_code: row?.variant_code ?? null,
      };
    })
    .filter(Boolean);

  return [...baseTasks, ...missileTasks];
}

export function calcReportRevenueForSubmission(
  sub: SubmissionRow,
  listId: string,
  priceMapsByListId: Record<string, Map<string, number>>
): number {
  const priceMap = priceMapsByListId[listId] || new Map<string, number>();

  return extractReportTasksFromSubmission(sub).reduce((sum: number, t: any) => {
    const qty = Number(t?.qty) || 0;
    if (qty <= 0) return sum;

    const taskKey = String(t?.task_key || "").trim().toUpperCase();
    const variant = t?.variant_code
      ? String(t.variant_code).trim().toUpperCase()
      : null;

    const unitPrice = getCompositeUnitPrice(priceMap, taskKey, variant);
    return sum + qty * unitPrice;
  }, 0);
}

export function buildSubmissionsByListId(
  lists: PriceListSummary[],
  submissions: SubmissionRow[]
): Map<string, SubmissionRow[]> {
  const submissionsByKey = new Map<string, SubmissionRow[]>();

  submissions.forEach((sub) => {
    buildSubmissionKeys(sub).forEach((key) => {
      const arr = submissionsByKey.get(key) || [];
      arr.push(sub);
      submissionsByKey.set(key, arr);
    });
  });

  const out = new Map<string, SubmissionRow[]>();

  lists.forEach((pl) => {
    const merged = new Map<string, SubmissionRow>();

    buildPriceListKeys(pl).forEach((key) => {
      const arr = submissionsByKey.get(key) || [];
      arr.forEach((sub) => merged.set(sub.id, sub));
    });

    out.set(pl.id, Array.from(merged.values()));
  });

  return out;
}

function getMDUHourRate(pl: PriceListSummary): number {
  const n = Number(pl?.mdu_hour_rate ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function calcMDULaborCost(crewCount: number, workedHours: number, hourRate: number): number {
  return (Number(crewCount) || 0) * (Number(workedHours) || 0) * (Number(hourRate) || 0);
}

function getCrewCount(sub: SubmissionRow): number {
  const exp: any = sub.expenses || {};
  return Number(exp.crewCount ?? exp.crew ?? exp.crew_count) || 0;
}

function getTruckCost(sub: SubmissionRow, rates: RatesPayload): number {
  const exp: any = sub.expenses || {};
  const truckCount = Number(exp.truckCount ?? exp.trucks ?? exp.truck_count) || 0;
  return truckCount * (Number(rates?.truck_per_day) || 0);
}

function calcReportExpensesForSubmission(
  sub: SubmissionRow,
  pl: PriceListSummary,
  rates: RatesPayload
): number {
  const actual = calcActualExpensesFromSubmission(sub) || 0;

  if (isMDUPriceList(pl)) {
    const workedHours = getWorkedHoursFromSubmission(sub) || 0;
    const laborCost = calcMDULaborCost(getCrewCount(sub), workedHours, getMDUHourRate(pl));
    return actual + getTruckCost(sub, rates) + laborCost;
  }

  return actual + (calcResourceCostFromSubmission(sub, rates) || 0);
}

function latestDate(subs: SubmissionRow[]): string | null {
  let latest: string | null = null;

  subs.forEach((sub) => {
    const d = sub.date ? String(sub.date).slice(0, 10) : null;
    if (!d) return;
    if (!latest || d > latest) latest = d;
  });

  return latest;
}

export function buildReportAnalytics(args: {
  lists: PriceListSummary[];
  submissions: SubmissionRow[];
  priceMapsByListId: Record<string, Map<string, number>>;
  rates: RatesPayload;
}): ReportAnalytics {
  const { lists, submissions, priceMapsByListId, rates } = args;

  const submissionsByListId = buildSubmissionsByListId(lists, submissions);

  const projects: ProjectAnalyticsRow[] = lists.map((pl) => {
    const matchedSubs = submissionsByListId.get(pl.id) || [];

    let revenue = 0;
    let expenses = 0;
    let laborHours = 0;

    matchedSubs.forEach((sub) => {
      revenue += calcReportRevenueForSubmission(sub, pl.id, priceMapsByListId);
      expenses += calcReportExpensesForSubmission(sub, pl, rates);
      laborHours += getWorkedHoursFromSubmission(sub) || 0;
    });

    const profit = revenue - expenses;
    const margin = revenue > 0 ? profit / revenue : 0;

    return {
      listId: pl.id,
      projectName: pl.name || pl.project_code || "Unnamed project",
      customer: pl.customer || "",
      projectCode: pl.project_code || pl.project_number || "",
      poNumber: pl.po_number || "",
      revenue,
      expenses,
      profit,
      margin,
      submissionsCount: matchedSubs.length,
      laborHours,
      lastSubmissionDate: latestDate(matchedSubs),
    };
  });

  const activeProjects = projects.filter(
    (p) => p.revenue !== 0 || p.expenses !== 0 || p.submissionsCount > 0
  );

  const totals = activeProjects.reduce(
    (acc, p) => {
      acc.revenue += p.revenue;
      acc.expenses += p.expenses;
      acc.profit += p.profit;
      acc.submissionsCount += p.submissionsCount;
      acc.laborHours += p.laborHours;
      return acc;
    },
    {
      revenue: 0,
      expenses: 0,
      profit: 0,
      margin: 0,
      submissionsCount: 0,
      laborHours: 0,
    }
  );

  totals.margin = totals.revenue > 0 ? totals.profit / totals.revenue : 0;

  return {
    totals,
    projects: activeProjects,
    topRevenue: [...activeProjects].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    topProfit: [...activeProjects].sort((a, b) => b.profit - a.profit).slice(0, 5),
    topExpenses: [...activeProjects].sort((a, b) => b.expenses - a.expenses).slice(0, 5),
    losses: [...activeProjects].filter((p) => p.profit < 0).sort((a, b) => a.profit - b.profit),
  };
}