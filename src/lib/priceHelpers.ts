import type { PriceListSummary, PriceRow } from "./priceTypes";

export const DELETE_PASSWORD = "3amigos";

export const generateRowId = () => {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createEmptyRow = (): PriceRow => ({
  rowId: generateRowId(),
  taskKey: "",
  unit: "",
  variantCode: "",
  pricePerUnit: "",
});

export function formatCurrency(value: number | undefined | null): string {
  const n = typeof value === "number" && !isNaN(value) ? value : 0;
  return `$${n.toFixed(2)}`;
}

export function formatCreatedDate(value?: string | null): string {
  if (!value) return "";

  const raw = String(value).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function sortPriceLists(lists: PriceListSummary[]): PriceListSummary[] {
  return [...lists].sort((a, b) => {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

    const aActive = !!a.is_active && !aCompleted;
    const bActive = !!b.is_active && !bCompleted;
    if (aActive !== bActive) return aActive ? -1 : 1;

    return (a.name || "").localeCompare(b.name || "");
  });
}

export function upper(v: string) {
  return String(v || "").toUpperCase();
}

export function getProjectNumberFromList(list?: PriceListSummary | null) {
  if (!list) return "";
  return String(list.project_number || list.project_code || "");
}

export function buildMetaPayload(params: {
  name: string;
  customer: string;
  projectManager: string;
  projectNumber: string;
  poNumber: string;
  city: string;
  stateUS: string;
  address: string;
  isMDU: boolean;
  mduStartDate: string;
  mduCloseOutBy: string;
  mduPoAmount: string;
  mduTotalAmount: string;
  mduHourRate: string;
}) {
  const projectNumber = params.projectNumber.trim() || null;

  return {
    name: params.name.trim(),
    customer: params.customer.trim() || null,
    project_manager: params.projectManager.trim() || null,
    project_code: projectNumber,
    project_number: projectNumber,
    po_number: params.poNumber.trim() || null,
    city: params.city.trim() || null,
    state: params.stateUS.trim() || null,
    address: params.address.trim() || null,

    is_mdu: params.isMDU ? 1 : 0,
    mdu_start_date: params.isMDU ? params.mduStartDate.trim() || null : null,
    mdu_close_out_by: params.isMDU ? params.mduCloseOutBy.trim() || null : null,
    mdu_po_amount:
      params.isMDU && params.mduPoAmount.trim() !== ""
        ? Number(params.mduPoAmount)
        : null,
    mdu_total_amount:
      params.isMDU && params.mduTotalAmount.trim() !== ""
        ? Number(params.mduTotalAmount)
        : null,
    mdu_hour_rate:
      params.isMDU && params.mduHourRate.trim() !== ""
        ? Number(params.mduHourRate)
        : null,
  };
}

export function isAuthError(json: any, status: number) {
  const e = String(json?.error || "").toLowerCase();
  return (
    status === 401 &&
    (e === "no_session" || e === "invalid_session" || e === "unauthorized")
  );
}