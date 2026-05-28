export interface BackendPrice {
  id?: string;
  task_key: string;
  unit?: string | null;
  price_per_unit: number;
  variant_code?: string | null;
}

export interface ActiveList {
  id: string;
  name: string;
}

export interface PriceRow {
  rowId: string;
  taskKey: string;
  unit: string;
  variantCode: string;
  pricePerUnit: string;
}

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

export type PriceListDetails = {
  list: PriceListSummary;
  prices: Array<{
    task_key: string;
    unit: string | null;
    price_per_unit: number;
    variant_code?: string | null;
  }>;
};