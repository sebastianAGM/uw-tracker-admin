// src/lib/uwCalc.ts

// ================== TYPES ==================
export type PriceListSummary = {
  id: string;
  name: string;
  is_active?: boolean | number;
  status?: "draft" | "completed";
  customer?: string | null;
  project_code?: string | null;

  // compat nueva metadata
  project_number?: string | null;
  po_number?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;

  // MDU
  is_mdu?: boolean | number | string | null;
  mdu_start_date?: string | null;
  mdu_close_out_by?: string | null;
  mdu_po_amount?: number | null;
  mdu_total_amount?: number | null;
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

  entries_json?: any; // string | object
  entries?: any; // compat

  // lo que devuelve el Worker en /api/submissions
  expenses?: any;
};

export type TaskPriceRow = {
  task_key: string;
  unit: string | null;
  price_per_unit: number;
  variant_code?: string | null;
};

export type PriceListDetails = {
  list: PriceListSummary;
  prices: TaskPriceRow[];
};

export type RatesPayload = {
  crew_per_day: number;
  truck_per_day: number;
};

// Canon task from submissions
export type CanonTask = {
  task_key: string;
  qty: number;
  variant_code?: string | null;
};

// ================== TASK KEY NORMALIZATION (ALIAS → CANON) ==================
const TASK_KEY_ALIAS_MAP: Record<string, string> = {
  // FIBER
  FIBER_PLOWING_FT: "FIBER_DIRECT_BURY_FT",

// CONDUIT / BORE
BORE_DUCTS: "CONDUIT_PIPES_FT",
CHAINTRENCH_FT: "CONDUIT_CHAIN_FT",
MICROTRENCH_FT: "CONDUIT_MICRO_FT",
PLOWING_CONDUIT_FT_TOTAL: "CONDUIT_PLOW_FT",
TRACER_INSTALLATION_FT: "TRACER_INSTALLATION_FT",

// BM60 BORE
BORE_BM60_FT: "BORE_BM60_FT",
BORE_BM60: "BORE_BM60_FT",
BM60: "BORE_BM60_FT",

  // POTHOLES
POTHOLE_SOFTSCAPE_EA: "POTHOLE_SOFTSCAPE_EA",
POTHOLE_HARDSCAPE_EA: "POTHOLE_HARDSCAPE_EA",

// aliases por nombres usados antes
POTHOLE_HARD_SURFACE_EA: "POTHOLE_HARDSCAPE_EA",
"POTHOLE_HARD SURFACE_EA": "POTHOLE_HARDSCAPE_EA",
HARD_SURFACE_POTHOLE_EA: "POTHOLE_HARDSCAPE_EA",
HARDSCAPE_POTHOLE_EA: "POTHOLE_HARDSCAPE_EA",
  

  // VAULTS
  VAULT_PULLBOX_CT: "VAULT_PULLBOX_EA",
  VAULT_T8_CT: "VAULT_T8_EA",
  VAULT_1730_CT: "VAULT_17X30_EA",
  VAULT_2436_CT: "VAULT_24X36_EA",

  // DROPS
  DROPS_COUNT: "DROPS_COUNT_EA",
  DROPS_NIDS: "DROPS_NIDS_EA",

  // SPLICE
  SPLICE_TOTAL: "SPLICE_TOTAL_EA",

  // HOURS / OTHERS
  EQUIPMENT_HOURS: "HOURS_EQUIPMENT_HR",
  OTHER_FEET: "OTHERS_FEET_FT",

  // MISSILE flat fields
  MISSILE_SHOT_QTY: "MISSILE_SHOT_EA",
  CURB_SHOT_QTY: "MISSILE_CURB_SHOT_EA",
  CURB_SIDEWALK_SHOT_QTY: "MISSILE_CURB_SIDEWALK_SHOT_EA",
  STUB_SHOT_QTY: "MISSILE_STUB_SHOT_EA",
  CURB_DIG_: "MISSILE_CURB_DIG_EA",
  CURB_DIG: "MISSILE_CURB_DIG_EA",
  CURB_DIG_QTY: "MISSILE_CURB_DIG_EA",
  DB_DIG_DEEP_CUT_FT: "DB_DIG_DEEP_CUT_EA",
  DB_DIG_DEEP_CUT: "DB_DIG_DEEP_CUT_EA",
  DB_DIG_DEEP_CUT_QTY: "DB_DIG_DEEP_CUT_EA",
  SOFTSCAPE_FT: "MISSILE_SOFTSCAPE_FT",
  HARDSCAPE_FT: "MISSILE_HARDSCAPE_FT",
};

function normalizeTaskKeyName(raw: any): string {
  const base = String(raw || "").trim().toUpperCase();
  if (!base) return "";
  const mapped = TASK_KEY_ALIAS_MAP[base];
  return (mapped || base).trim().toUpperCase();
}

// ================== IGNORE UNIT-ONLY "TASKS" ==================
const UNIT_ONLY_TASK_KEYS = new Set(["FEET", "FT", "FOOT", "METER", "METERS", "M"]);

function isUnitOnlyKey(rawKey: any): boolean {
  const k = String(rawKey ?? "").trim().toUpperCase();
  return UNIT_ONLY_TASK_KEYS.has(k);
}

// ================== IGNORE NON-BILLABLE / AUX TASKS ==================
const IGNORED_TASK_KEYS = new Set([
  "ESTOP",
  "ESTOP_QTY",
  "ESTOP_MODE",
]);

function isIgnoredTaskKey(rawKey: any): boolean {
  const k = String(rawKey ?? "").trim().toUpperCase();
  return IGNORED_TASK_KEYS.has(k);
}

// ================== SOIL HELPERS ==================
export function normalizeSoilVariant(raw: any): string | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!v) return null;

  if (v === "DIRT" || v === "SOIL") return "DIRT";
  if (v === "COBBLE") return "COBBLE";
  if (v === "ROCK") return "ROCK";
  if (v === "CLAY") return "CLAY";
  if (v === "ASPHALT") return "ASPHALT";
  if (v === "HARDPAN") return "HARDPAN";

  return "UNKNOWN";
}

export function isBoreBaseTask(taskKey: any): boolean {
  const k = normalizeTaskKeyName(taskKey);

  return k.startsWith("BORE_") && k !== "BORE_SOIL_MARKUP_FT";
}

export function isBoreSoilMarkupTask(taskKey: any): boolean {
  return normalizeTaskKeyName(taskKey) === "BORE_SOIL_MARKUP_FT";
}

const SOIL_VARIANT_CODES = new Set([
  "DIRT",
  "COBBLE",
  "ROCK",
  "CLAY",
  "ASPHALT",
  "HARDPAN",
  "UNKNOWN",
]);

function appendSoilToVariant(boreVariant: string | null, soilVariant: string | null): string | null {
  const bore = String(boreVariant || "").trim().toUpperCase();
  const soil = String(soilVariant || "").trim().toUpperCase();

  if (!soil) return bore || null;
  return [bore, soil].filter(Boolean).join("_") || null;
}

function splitBoreVariantAndSoil(rawVariant: any): { boreVariant: string | null; soilVariant: string | null } {
  const variant = String(rawVariant || "").trim().toUpperCase();
  if (!variant) return { boreVariant: null, soilVariant: null };

  const parts = variant.split("_").filter(Boolean);
  const last = parts[parts.length - 1] || "";

  if (SOIL_VARIANT_CODES.has(last)) {
    const base = parts.slice(0, -1).join("_");
    return { boreVariant: base || null, soilVariant: last };
  }

  return { boreVariant: variant, soilVariant: null };
}

// ================== SMALL HELPERS ==================
export function normalizeRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.lists)) return data.lists;
  return [];
}

export function safeJson(v: any) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export function normalizeKey(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.toLowerCase();
}

function toIsoDateOnly(v: any): string | null {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const s = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function safeNumber(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function unwrapSubmissionPayload(raw: any): any {
  let p = safeJson(raw);
  if (!p) return null;

  for (let i = 0; i < 3; i++) {
    const next =
      (p &&
        typeof p === "object" &&
        ((p as any).entries_json ??
          (p as any).entries ??
          (p as any).payload ??
          (p as any).data ??
          (p as any).form ??
          (p as any).submission)) ||
      null;

    if (!next) break;

    const parsed = safeJson(next);
    if (!parsed || parsed === p) break;
    p = parsed;
  }

  return p;
}

function toCanonTask(obj: any): CanonTask | null {
  if (!obj || typeof obj !== "object") return null;

  const rawKey = obj.task_key ?? obj.key ?? obj.task ?? obj.taskKey ?? "";
  const key = normalizeTaskKeyName(rawKey);
  if (!key) return null;
  if (isUnitOnlyKey(key)) return null;
  if (isIgnoredTaskKey(key)) return null;

  const qtyRaw =
    obj.qty ??
    obj.quantity ??
    obj.value ??
    obj.amount ??
    obj.count ??
    obj.total ??
    obj.ft ??
    obj.feet ??
    obj.ea ??
    0;

  const qty = Number(qtyRaw) || 0;
  if (qty <= 0) return null;

  const variant =
    obj.variant_code ??
    obj.variantCode ??
    obj.variant ??
    obj.fiber_type ??
    obj.fiberType ??
    obj.fiber_count ??
    obj.fiberCount ??
    obj.type ??
    null;

  return {
    task_key: key,
    qty,
    variant_code: variant ? String(variant).trim().toUpperCase() : null,
  };
}

function collectFromArray(arr: any): CanonTask[] {
  if (!Array.isArray(arr)) return [];
  const out: CanonTask[] = [];
  for (const it of arr) {
    const t = toCanonTask(it);
    if (t) out.push(t);
  }
  return out;
}

function collectFromKeyValueObject(obj: any): CanonTask[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const out: CanonTask[] = [];
  for (const k of Object.keys(obj)) {
    const qty = Number((obj as any)[k]) || 0;
    if (qty > 0) {
      const tk = normalizeTaskKeyName(k);
      if (!isUnitOnlyKey(tk) && !isIgnoredTaskKey(tk)) {
        out.push({ task_key: tk, qty, variant_code: null });
      }
    }
  }
  return out;
}

function dedupeAndSum(tasks: CanonTask[]): CanonTask[] {
  const m = new Map<string, { task_key: string; variant_code: string; qty: number }>();

  for (const t of tasks) {
    const task_key = normalizeTaskKeyName(t.task_key);
    if (!task_key) continue;
    if (isUnitOnlyKey(task_key)) continue;
    if (isIgnoredTaskKey(task_key)) continue;

    const variant = String(t.variant_code || "").trim().toUpperCase();
    const mapKey = `${task_key}::${variant}`;

    const prev = m.get(mapKey);
    const add = Number(t.qty) || 0;

    if (!prev) {
      m.set(mapKey, { task_key, variant_code: variant, qty: add });
    } else {
      prev.qty += add;
    }
  }

  return Array.from(m.values())
    .map((x) => ({
      task_key: x.task_key,
      variant_code: x.variant_code || null,
      qty: x.qty,
    }))
    .filter((t) => t.task_key && t.qty > 0);
}

function deepFindTasks(root: any, maxDepth = 5): CanonTask[] {
  const out: CanonTask[] = [];
  const seen = new Set<any>();

  function walk(node: any, depth: number) {
    if (!node || depth > maxDepth) return;
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      out.push(...collectFromArray(node));
      for (const it of node) walk(it, depth + 1);
      return;
    }

    const directArrays = [
      (node as any).tasks,
      (node as any).entries,
      (node as any).production,
      (node as any).items,
      (node as any).lines,
      (node as any).rows,
      (node as any).data,
    ];

    for (const a of directArrays) out.push(...collectFromArray(a));

    out.push(...collectFromKeyValueObject((node as any).tasks));
    out.push(...collectFromKeyValueObject((node as any).production));

    for (const k of Object.keys(node)) {
      walk((node as any)[k], depth + 1);
    }
  }

  walk(root, 0);

  if (out.length) return dedupeAndSum(out);
  return [];
}

// ================== MATCHING: submission -> list ==================
export function buildListKeyIndex(lists: PriceListSummary[]) {
  const idx = new Map<string, string>();

  lists.forEach((pl) => {
    const keys = [pl.project_code, pl.project_number, pl.name, pl.id]
      .map(normalizeKey)
      .filter(Boolean) as string[];

    keys.forEach((k) => {
      if (!idx.has(k)) idx.set(k, pl.id);
    });
  });

  return idx;
}

export function matchSubmissionToListId(
  sub: SubmissionRow,
  listKeyIndex: Map<string, string>
): string | null {
  const keys = [sub.project, sub.project_code, sub.project_label, sub.project_id]
    .map(normalizeKey)
    .filter(Boolean) as string[];

  for (const k of keys) {
    const id = listKeyIndex.get(k);
    if (id) return id;
  }
  return null;
}

// ================== PRICES ==================
export function buildPriceMapForList(prices: TaskPriceRow[]): Map<string, number> {
  const m = new Map<string, number>();

  (prices || []).forEach((p) => {
    const task = normalizeTaskKeyName(p.task_key);
    if (!task) return;

    const variant = String(p.variant_code || "").trim().toUpperCase();
    const val = Number(p.price_per_unit || 0) || 0;

    m.set(variant ? `${task}:${variant}` : task, val);
  });

  return m;
}

export function priceLookup(
  priceMap: Map<string, number>,
  task_key: string,
  variant_code?: string | null
) {
  const task = normalizeTaskKeyName(task_key);
  if (!task) return 0;

  const variant = String(variant_code || "").trim().toUpperCase();

  if (variant) {
    const variantCandidates = [
      variant,
      variant.replace(/\s+/g, "_"),
      variant.replace(/_/g, " "),
    ];

    for (const v of variantCandidates) {
      const exact = priceMap.get(`${task}:${v}`);
      if (exact != null) return exact;
    }
  }

  const base = priceMap.get(task);
  if (base != null) return base;

  return 0;
}

export function getCompositeUnitPrice(
  priceMap: Map<string, number>,
  task_key: string,
  variant_code?: string | null
): number {
  const task = normalizeTaskKeyName(task_key);
  if (!task) return 0;

  const variant = String(variant_code || "").trim().toUpperCase();

  // ✅ Bore base with optional soil suffix in the variant.
  // Supports display variants like:
  //   D_1_125_R_DIRT
  //   D_1_125_R_COBBLE
  // Pricing stays compatible with your existing Prices setup:
  //   BORE_BM60_FT + D_1_125_R      = base price
  //   BORE_SOIL_MARKUP_FT + COBBLE  = extra markup
  if (isBoreBaseTask(task)) {
    const { boreVariant, soilVariant } = splitBoreVariantAndSoil(variant);

    if (variant) {
      // Exact match first, in case a combined price is ever created.
      const exactCombinedPrice = priceMap.get(`${task}:${variant}`);
      if (exactCombinedPrice != null) return exactCombinedPrice;
    }

    let basePrice = 0;

    if (boreVariant) {
      const exactBaseVariantPrice = priceMap.get(`${task}:${boreVariant}`);
      basePrice =
        exactBaseVariantPrice != null
          ? exactBaseVariantPrice
          : priceLookup(priceMap, task, null);
    } else {
      basePrice = priceLookup(priceMap, task, null);
    }

    const markupPrice =
      soilVariant && soilVariant !== "DIRT"
        ? priceLookup(priceMap, "BORE_SOIL_MARKUP_FT", soilVariant)
        : 0;

    return basePrice + markupPrice;
  }

  return priceLookup(priceMap, task, variant);
}

// ================== SUBMISSION: extract tasks ==================
export function extractTasksFromSubmission(
  sub: SubmissionRow,
  _listId?: string,
  _priceMapsByListId?: Record<string, Map<string, number>>
): CanonTask[] {
  const raw = (sub as any).entries_json ?? (sub as any).entries;
  const payload0 = unwrapSubmissionPayload(raw);
  if (!payload0 || typeof payload0 !== "object") return [];

  const tasksRoot = (payload0 as any)?.production?.tasks || (payload0 as any)?.tasks || payload0;
  if (!tasksRoot || typeof tasksRoot !== "object") return [];

  const out: CanonTask[] = [];

  // ====== FIBER ======
  const fiber = (tasksRoot as any).FIBER;
  if (fiber && typeof fiber === "object") {
    const normVariant = (row: any): string | null => {
      const variant =
        row?.variant_code ??
        row?.variantCode ??
        row?.variant ??
        row?.fiber_type ??
        row?.fiberType ??
        row?.fiber_count ??
        row?.fiberCount ??
        row?.type ??
        null;

      const v = String(variant ?? "").trim().toUpperCase();
      return v ? v : null;
    };

    const pushFiberRows = (rows: any[], rawTaskKey: string) => {
      if (!Array.isArray(rows)) return;

      const byVariant = new Map<string, number>();

      for (const row of rows) {
        const feet = Number(row?.feet ?? row?.ft ?? row?.qty ?? row?.quantity ?? 0) || 0;
        if (feet <= 0) continue;

        const v = normVariant(row);
        const key = v || "";
        byVariant.set(key, (byVariant.get(key) || 0) + feet);
      }

      for (const [key, qty] of byVariant.entries()) {
        if (qty <= 0) continue;
        out.push({
          task_key: normalizeTaskKeyName(rawTaskKey),
          qty,
          variant_code: key ? key : null,
        });
      }
    };

    pushFiberRows(fiber.blowing_rows, "FIBER_BLOWING_FT");
    pushFiberRows(fiber.plowing_rows, "FIBER_PLOWING_FT");
  }

  // ====== BORE / BORE_SHOT (bore type + soil breakdown + BM60 variant) ======
  const bore =
    (tasksRoot as any).BORE ||
    (tasksRoot as any).BORE_SHOT;

  if (bore && typeof bore === "object") {
    const boreRows = Array.isArray((bore as any).bore_rows)
      ? (bore as any).bore_rows
      : Array.isArray((bore as any).rows)
      ? (bore as any).rows
      : [];

    for (const row of boreRows) {
      const boreType = normalizeTaskKeyName(
        row?.bore_type ??
          row?.boreType ??
          row?.type ??
          "BORE_BM60_FT"
      );

      if (!boreType) continue;
      if (isUnitOnlyKey(boreType)) continue;
      if (isIgnoredTaskKey(boreType)) continue;

      const rawBoreVariant =
        row?.variant_code ??
        row?.variantCode ??
        row?.variant ??
        row?.bore_variant ??
        row?.boreVariant ??
        row?.bm60_variant ??
        row?.bm60Variant ??
        null;

      const boreVariant = String(rawBoreVariant ?? "").trim().toUpperCase() || null;

      const soilSegments = Array.isArray(row?.soil_segments)
        ? row.soil_segments
        : Array.isArray(row?.soilSegments)
        ? row.soilSegments
        : Array.isArray(row?.soil_breakdown)
        ? row.soil_breakdown
        : Array.isArray(row?.soils)
        ? row.soils
        : [];

      // ✅ Visual + pricing model:
      // 100 ft DIRT   => BORE_BM60_FT + D_1_125_R_DIRT   => base price only
      // 100 ft COBBLE => BORE_BM60_FT + D_1_125_R_COBBLE => base + cobble markup
      //
      // No separate BORE_SOIL_MARKUP_FT task is emitted from bore rows here.
      // The markup is added by getCompositeUnitPrice() when it sees the soil suffix.
      if (soilSegments.length > 0) {
        for (const seg of soilSegments) {
          const qty =
            Number(
              seg?.feet ??
                seg?.ft ??
                seg?.qty ??
                seg?.quantity ??
                0
            ) || 0;

          if (qty <= 0) continue;

          const soilVariant = normalizeSoilVariant(
            seg?.soil_type ??
              seg?.soilType ??
              seg?.soil ??
              seg?.type ??
              null
          ) || "DIRT";

          out.push({
            task_key: boreType,
            qty,
            variant_code: appendSoilToVariant(boreVariant, soilVariant),
          });
        }

        continue;
      }

      // ✅ fallback: if no soil breakdown exists, use total feet and preserve BM60 variant.
      const totalFeet =
        Number(
          row?.total_feet ??
            row?.totalFeet ??
            row?.feet ??
            row?.ft ??
            row?.qty ??
            row?.quantity ??
            0
        ) || 0;

      if (totalFeet > 0) {
        out.push({
          task_key: boreType,
          qty: totalFeet,
          variant_code: boreVariant,
        });
      }
    }
  }

// ====== MISSILE_SHOT ======
const missile =
  (tasksRoot as any).MISSILE_SHOT ||
  (tasksRoot as any).MISILE_SHOT;

  

if (missile && typeof missile === "object") {
  const rows = Array.isArray(missile.missile_rows)
    ? missile.missile_rows
    : Array.isArray(missile.rows)
    ? missile.rows
    : [];

 const legacyShotTypeMap: Record<string, string> = {
  MISSILE_SHOT_QTY: "MISSILE_SHOT_EA",
  MISSILE_SHOT: "MISSILE_SHOT_EA",

  CURB_SHOT_QTY: "MISSILE_CURB_SHOT_EA",
  CURB_SHOT: "MISSILE_CURB_SHOT_EA",

  CURB_SIDEWALK_SHOT_QTY:
    "MISSILE_CURB_SIDEWALK_SHOT_EA",

  CURB_SIDEWALK_SHOT:
    "MISSILE_CURB_SIDEWALK_SHOT_EA",

  STUB_SHOT_QTY: "MISSILE_STUB_SHOT_EA",
  STUB_SHOT: "MISSILE_STUB_SHOT_EA",

  CURB_DIG_QTY: "MISSILE_CURB_DIG_EA",
  CURB_DIG_FT: "MISSILE_CURB_DIG_EA",
  CURB_DIG: "MISSILE_CURB_DIG_EA",

  DB_DIG_DEEP_CUT_QTY: "DB_DIG_DEEP_CUT_EA",
  DB_DIG_DEEP_CUT: "DB_DIG_DEEP_CUT_EA",
  DB_DIG_DEEP_CUT_FT: "DB_DIG_DEEP_CUT_EA",

  SOFTSCAPE_FT: "MISSILE_SOFTSCAPE_FT",
  SOFTSCAPE: "MISSILE_SOFTSCAPE_FT",

  HARDSCAPE_FT: "MISSILE_HARDSCAPE_FT",
  HARDSCAPE: "MISSILE_HARDSCAPE_FT",
};

for (const r of rows) {
  const qty = Number(r?.qty ?? r?.quantity ?? 0) || 0;
  if (qty <= 0) continue;

  const rawShotType = normalizeTaskKeyName(
    r?.shot_type ?? r?.task_key ?? ""
  );

  const taskKey = legacyShotTypeMap[rawShotType] || rawShotType;

  if (!taskKey) continue;

  out.push({
    task_key: taskKey,
    qty,
    variant_code: null,
  });
}

  for (const r of rows) {
    const type = String(r?.type ?? "").trim().toLowerCase();

    // ===== SHOTS (EA) =====
    if (type === "curb") {
      out.push({
        task_key: "MISSILE_CURB_SHOT_EA",
        qty: 1,
        variant_code: null,
      });
    }

    if (type === "curb_sidewalk") {
      out.push({
        task_key: "MISSILE_CURB_SIDEWALK_SHOT_EA",
        qty: 1,
        variant_code: null,
      });
    }

    if (type === "stub") {
      out.push({
        task_key: "MISSILE_STUB_SHOT_EA",
        qty: 1,
        variant_code: null,
      });
    }

    // ===== CURB & DIG (FT) =====
    const curbDigFt =
      Number(
        r?.curb_dig_ft ??
        r?.curbDigFt ??
        r?.curb_dig ??
        0
      ) || 0;

    if (curbDigFt > 0) {
      out.push({
        task_key: "MISSILE_CURB_DIG_EA",
        qty: curbDigFt,
        variant_code: null,
      });
    }

    // ===== RESTORATION =====
    const softscape =
      Number(r?.softscape_ft ?? r?.softscape ?? 0) || 0;

    if (softscape > 0) {
      out.push({
        task_key: "MISSILE_SOFTSCAPE_FT",
        qty: softscape,
        variant_code: null,
      });
    }

    const hardscape =
      Number(r?.hardscape_ft ?? r?.hardscape ?? 0) || 0;

    if (hardscape > 0) {
      out.push({
        task_key: "MISSILE_HARDSCAPE_FT",
        qty: hardscape,
        variant_code: null,
      });
    }
  }

  // ===== MISSILE_SHOT (fallback plano) =====
  const legacyMissileMap: Record<string, string> = {
    missile_shot_qty: "MISSILE_SHOT_EA",
    missile_shot: "MISSILE_SHOT_EA",

    curb_shot_qty: "MISSILE_CURB_SHOT_EA",
    curb_shot: "MISSILE_CURB_SHOT_EA",

    curb_sidewalk_shot_qty: "MISSILE_CURB_SIDEWALK_SHOT_EA",
    curb_sidewalk_shot: "MISSILE_CURB_SIDEWALK_SHOT_EA",

    stub_shot_qty: "MISSILE_STUB_SHOT_EA",
    stub_shot: "MISSILE_STUB_SHOT_EA",

    curb_dig_ft: "MISSILE_CURB_DIG_EA",
    curbDigFt: "MISSILE_CURB_DIG_EA",
    curb_dig: "MISSILE_CURB_DIG_EA",

    softscape_ft: "MISSILE_SOFTSCAPE_FT",
    softscape: "MISSILE_SOFTSCAPE_FT",

    hardscape_ft: "MISSILE_HARDSCAPE_FT",
    hardscape: "MISSILE_HARDSCAPE_FT",
  };

  for (const [legacyKey, taskKey] of Object.entries(legacyMissileMap)) {
    const qty = Number((missile as any)?.[legacyKey] ?? 0) || 0;
    if (qty <= 0) continue;

    out.push({
      task_key: taskKey,
      qty,
      variant_code: null,
    });
  }
}

  // ====== PARSER GENERAL ======
  function walk(obj: any) {
    if (!obj || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {
      const upperKey = String(key).trim().toUpperCase();
      if (
          upperKey === "FIBER" ||
          upperKey === "BORE" ||
          upperKey === "BORE_SHOT" ||
          upperKey === "MISSILE_SHOT"
        ) {
          continue;
        }

      const val = obj[key];

      if (typeof val === "number" || typeof val === "string") {
        const qty = Number(val) || 0;
        if (qty > 0) {
          const tk = normalizeTaskKeyName(key);
          if (!isUnitOnlyKey(tk) && !isIgnoredTaskKey(tk)) {
            out.push({ task_key: tk, qty, variant_code: null });
          }
        }
        continue;
      }

      if (typeof val === "object" && !Array.isArray(val)) {
        const qtyRaw =
          (val as any).qty ??
          (val as any).quantity ??
          (val as any).value ??
          (val as any).amount ??
          (val as any).count ??
          (val as any).total ??
          (val as any).ft ??
          (val as any).feet ??
          (val as any).ea;

        if (qtyRaw != null) {
          const qty = Number(qtyRaw) || 0;
          if (qty > 0) {
            const tk = normalizeTaskKeyName(key);
            if (!isUnitOnlyKey(tk) && !isIgnoredTaskKey(tk)) {
              const variant =
                (val as any).variant_code ??
                (val as any).variantCode ??
                (val as any).variant ??
                (val as any).fiber_type ??
                (val as any).fiberType ??
                (val as any).fiber_count ??
                (val as any).fiberCount ??
                (val as any).type ??
                null;

              out.push({
                task_key: tk,
                qty,
                variant_code: variant ? String(variant).trim().toUpperCase() : null,
              });
            }
          }
          continue;
        }

        walk(val);
        continue;
      }

      if (Array.isArray(val)) {
        for (const it of val) {
          if (typeof it === "object") {
            const t = toCanonTask(it);
            if (t) out.push(t);
            walk(it);
          }
        }
      }
    }
  }

  walk(tasksRoot);

  if (!out.length) {
    try {
      const deep = deepFindTasks(tasksRoot);
      if (deep?.length) return deep;
    } catch {
      // ignore
    }
  }

  return dedupeAndSum(out);
}

// ================== REVENUE ==================
export function calcRevenue(tasks: CanonTask[], priceMap: Map<string, number>) {
  let sum = 0;

  tasks.forEach((t) => {
    const taskKey = normalizeTaskKeyName(t.task_key);
    if (!taskKey) return;
    if (isUnitOnlyKey(taskKey)) return;
    if (isIgnoredTaskKey(taskKey)) return;

    const unitPrice = getCompositeUnitPrice(priceMap, taskKey, t.variant_code || "");
    sum += (Number(t.qty) || 0) * (Number(unitPrice) || 0);
  });

  return sum;
}

export function calcRevenueForSubmission(
  sub: SubmissionRow,
  listId: string,
  priceMapsByListId: Record<string, Map<string, number>>
): number {
  const priceMap = priceMapsByListId[listId];
  if (!priceMap) return 0;
  const tasks = extractTasksFromSubmission(sub);
  if (!tasks.length) return 0;
  return calcRevenue(tasks, priceMap);
}

// ================== EXPENSES FROM SUBMISSION ==================
export function getSubmissionExpenseBlob(sub: SubmissionRow): any {
  if ((sub as any).expenses && typeof (sub as any).expenses === "object") {
    return (sub as any).expenses;
  }

  const raw = (sub as any).entries_json ?? (sub as any).entries;
  const payload = unwrapSubmissionPayload(raw);
  if (!payload) return null;

  return (payload as any).expenses || (payload as any).costs || (payload as any).resources || null;
}

export function calcActualExpensesFromSubmission(sub: SubmissionRow): number {
  const exp = getSubmissionExpenseBlob(sub) || {};
  const diesel = Number(exp.diesel) || 0;
  const gas = Number(exp.gas) || 0;
  const propane = Number(exp.propane) || 0;
  const lodging = Number(exp.rent ?? exp.lodging ?? exp.hotel) || 0;
  const materials = Number(exp.materials ?? exp.material ?? exp.supplies) || 0;
  const other = Number(exp.other ?? exp.misc ?? 0) || 0;

  return diesel + gas + propane + lodging + materials + other;
}

export function getResourceDaysFromSubmission(
  sub: SubmissionRow
): { crewDays: number; truckDays: number } {
  const exp = getSubmissionExpenseBlob(sub) || {};

  const crewDays =
    Number(
      exp.crewDays ??
        exp.crew_days ??
        exp.crewDay ??
        exp.crew_day ??
        exp.crewCount ??
        exp.crew ??
        exp.crew_count ??
        0
    ) || 0;

  const truckDays =
    Number(
      exp.truckDays ??
        exp.truck_days ??
        exp.truckDay ??
        exp.truck_day ??
        exp.truckCount ??
        exp.trucks ??
        exp.truck_count ??
        0
    ) || 0;

  return { crewDays, truckDays };
}

export function calcResourceCostFromSubmission(sub: SubmissionRow, rates: RatesPayload): number {
  const { crewDays, truckDays } = getResourceDaysFromSubmission(sub);

  const crewCost = crewDays * (Number(rates?.crew_per_day) || 0);
  const truckCost = truckDays * (Number(rates?.truck_per_day) || 0);

  return crewCost + truckCost;
}

// ================== MDU HELPERS ==================
export function isMDUPriceList(pl?: PriceListSummary | null): boolean {
  return !!(pl && (pl.is_mdu === true || pl.is_mdu === 1 || pl.is_mdu === "1"));
}

export function getMDUContractTotal(pl?: PriceListSummary | null): number {
  if (!pl) return 0;
  return safeNumber(pl.mdu_total_amount);
}

export function getMDUPOAmount(pl?: PriceListSummary | null): number {
  if (!pl) return 0;
  return safeNumber(pl.mdu_po_amount);
}

export function getMDUStartDate(pl?: PriceListSummary | null): string | null {
  return toIsoDateOnly(pl?.mdu_start_date);
}

export function getMDUCloseOutBy(pl?: PriceListSummary | null): string | null {
  return toIsoDateOnly(pl?.mdu_close_out_by);
}

export function calcMDUConsumedForSubmission(
  sub: SubmissionRow,
  rates: RatesPayload,
  fixedShare = 0
): number {
  const variable =
    calcActualExpensesFromSubmission(sub) + calcResourceCostFromSubmission(sub, rates);

  return variable + safeNumber(fixedShare);
}

export function calcMDURemainingBudget(contractTotal: number, consumed: number): number {
  return safeNumber(contractTotal) - safeNumber(consumed);
}

export function calcMDUConsumedPct(contractTotal: number, consumed: number): number {
  const total = safeNumber(contractTotal);
  if (total <= 0) return 0;
  return (safeNumber(consumed) / total) * 100;
}

export function getWorkedHoursFromSubmission(sub: SubmissionRow): number {
  const exp = getSubmissionExpenseBlob(sub) || {};
  return (
    Number(
      exp.workedHours ??
        exp.worked_hours ??
        exp.hoursWorked ??
        exp.hours_worked ??
        exp.hours ??
        0
    ) || 0
  );
}

export function getCrewCountFromSubmission(sub: SubmissionRow): number {
  const exp = getSubmissionExpenseBlob(sub) || {};
  return (
    Number(
      exp.crewCount ??
        exp.crew_count ??
        exp.crew ??
        exp.crewDays ??
        exp.crew_days ??
        0
    ) || 0
  );
}

export function getTruckCountFromSubmission(sub: SubmissionRow): number {
  const exp = getSubmissionExpenseBlob(sub) || {};
  return (
    Number(
      exp.truckCount ??
        exp.truck_count ??
        exp.trucks ??
        exp.truckDays ??
        exp.truck_days ??
        0
    ) || 0
  );
}

export function calcMDULaborHoursForSubmission(sub: SubmissionRow): number {
  const crew = getCrewCountFromSubmission(sub);
  const workedHours = getWorkedHoursFromSubmission(sub);
  return crew * workedHours;
}

export function calcMDUWorkedDayUnitsForSubmission(
  sub: SubmissionRow,
  hoursPerDay = 10
): number {
  const workedHours = getWorkedHoursFromSubmission(sub);
  const base = Number(hoursPerDay) || 10;
  if (base <= 0) return 0;
  return workedHours / base;
}

export function calcMDUDaysWorkedFromSubmissions(
  submissions: SubmissionRow[],
  hoursPerDay = 10
): number {
  return (submissions || []).reduce(
    (sum, sub) => sum + calcMDUWorkedDayUnitsForSubmission(sub, hoursPerDay),
    0
  );
}

export function countUniqueSubmissionDates(submissions: SubmissionRow[]): number {
  const s = new Set<string>();
  (submissions || []).forEach((sub) => {
    const d = toIsoDateOnly(sub?.date);
    if (d) s.add(d);
  });
  return s.size;
}

export function calcMDUConsumedFromSubmissions(
  submissions: SubmissionRow[],
  rates: RatesPayload,
  fixedShareBySubmission?: (sub: SubmissionRow) => number
): number {
  return (submissions || []).reduce((sum, sub) => {
    const fixed = fixedShareBySubmission ? fixedShareBySubmission(sub) : 0;
    return sum + calcMDUConsumedForSubmission(sub, rates, fixed);
  }, 0);
}

export function calcMDURemainingBudgetFromSubmissions(
  pl: PriceListSummary | null | undefined,
  submissions: SubmissionRow[],
  rates: RatesPayload,
  fixedShareBySubmission?: (sub: SubmissionRow) => number
): number {
  const total = getMDUContractTotal(pl);
  const consumed = calcMDUConsumedFromSubmissions(submissions, rates, fixedShareBySubmission);
  return calcMDURemainingBudget(total, consumed);
}

export function calcMDUConsumedPctFromSubmissions(
  pl: PriceListSummary | null | undefined,
  submissions: SubmissionRow[],
  rates: RatesPayload,
  fixedShareBySubmission?: (sub: SubmissionRow) => number
): number {
  const total = getMDUContractTotal(pl);
  const consumed = calcMDUConsumedFromSubmissions(submissions, rates, fixedShareBySubmission);
  return calcMDUConsumedPct(total, consumed);
}

export function calcMDUDaysRemaining(
  pl: PriceListSummary | null | undefined,
  todayIso?: string | null
): number | null {
  const closeOut = getMDUCloseOutBy(pl);
  if (!closeOut) return null;

  const today = toIsoDateOnly(todayIso) || toIsoDateOnly(new Date().toISOString());
  if (!today) return null;

  const end = new Date(`${closeOut}T00:00:00`);
  const start = new Date(`${today}T00:00:00`);
  if (isNaN(end.getTime()) || isNaN(start.getTime())) return null;

  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / 86400000);
}