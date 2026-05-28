import { TASK_INDEX } from "../../../shared/taskCatalog";

export const CSV_TASK_LABELS: Record<string, string> = {
  FIBER_BLOWING_FT: "Invoice Fiber Blowing",
  FIBER_DIRECT_BURY_FT: "Invoice Direct Bury Fiber",

  BORE_A1_MICRODUCT_FT: "Invoice Bore A1 With Microduct",
  BORE_A1_NO_MICRODUCT_FT: "Invoice Bore A1 No Microduct",
  BORE_A2_MICRODUCT_FT: "Invoice Bore A2 With Microduct",
  BORE_A2_NO_MICRODUCT_FT: "Invoice Bore A2 No Microduct",
  BORE_BM60_FT: "Invoice BM60 Bore",
  BORE_SOIL_MARKUP_FT: "Invoice Bore Soil Markup",
  BORE_GAS_2IN_FT: 'Invoice Gas Bore 2"',
  BORE_GAS_4IN_FT: 'Invoice Gas Bore 4"',
  BORE_GAS_6IN_FT: 'Invoice Gas Bore 6"',
  BORE_GAS_8IN_FT: 'Invoice Gas Bore 8"',

  VAULT_DVT8_EA: "Invoice DVT8 Vault",
  VAULT_DVT_15_EA: "Invoice DVT 15 Vault",
  VAULT_DVT_22_EA: "Invoice DVT 22 Vault",
  VAULT_SVT_15_EA: "Invoice SVT 15 Vault",
  VAULT_SVT_22_EA: "Invoice SVT 22 Vault",
  VAULT_LVT_22_EA: "Invoice LVT 22 Vault",
  VAULT_CUSTOM_EA: "Invoice Custom Vault",

  CONDUIT_CHAIN_FT: "Invoice Chain Trench",
  CONDUIT_MICRO_FT: "Invoice Micro Trench",
  CONDUIT_PLOW_FT: "Invoice Plowed Conduit",
  CONDUIT_PIPES_FT: "Invoice Pipe Bundle",
  TRACER_INSTALLATION_FT: "Invoice Tracer Wire Installation",

  POTHOLE_SOFTSCAPE_EA: "Invoice Soft Surface Pothole",
  POTHOLE_HARDSCAPE_EA: "Invoice Hard Surface Pothole",

  MISSILE_SHOT_EA: "Invoice Missile Shot",
  MISSILE_CURB_SHOT_EA: "Curb Shot Only",
  MISSILE_CURB_SIDEWALK_SHOT_EA: "Invoice Curb And Sidewalk Shot",
  MISSILE_STUB_SHOT_EA: "Invoice Stub Shot",
  MISSILE_CURB_DIG_EA: "Curb Shot & DB Dig ",
  MISSILE_DB_DIG_ONLY_EA: "Invoice DB Dig Only",
  MISSILE_B2_CURB_SHOT_DB_DIG_EA: "B2 Curb Shot & DB Dig",
  MISSILE_B2_CURB_SHOT_ONLY_EA: "B2 Curb Shot Only",
  
  MISSILE_SOFTSCAPE_FT: "Invoice Missile Softscape",
  MISSILE_HARDSCAPE_FT: "Invoice Missile Hardscape",

  MASTIC_FT: "Invoice Mastic Seal",
  ASPHALT_HOTPATCH_SQFT: "Invoice Asphalt Hot Patch",
  ASPHALT_COLDPATCH_SQFT: "Invoice Asphalt Cold Patch",

  DROPS_COUNT_EA: "Invoice Drop Count",
  DROPS_FEET_FT: "Invoice Drop Footage",
  DROPS_NIDS_EA: "Invoice NID Installation",

  FLOW_FILL_FT: "Invoice Flow Fill Footage",
  FLOW_FILL_YD3: "Invoice Flow Fill Cubic Yards",

  SPLICE_TOTAL_EA: "Invoice Fiber Splice",
  SPLICE_CASE_SMALL_EA: "Invoice Small Splice Case",
  SPLICE_CASE_LARGE_EA: "Invoice Large Splice Case",

  CONCRETE_CUT_SQFT: "Invoice Concrete Cut",
  HOURS_EQUIPMENT_HR: "Invoice Equipment Hours",
  OTHERS_FEET_FT: "Invoice Other Work",
};

export const CSV_VARIANT_LABELS: Record<string, string> = {
  RANGE_1_50: "1-50 LF",
  RANGE_51_100: "51-100 LF",
  RANGE_101_PLUS: "101+ LF",

  D_1_125: "D 1 × 1.25",
  D_2_125: "D 2 × 1.25",
  D_3_125: "D 3 × 1.25",
  D_1_125_R: "D 1 × 1.25 R",
  D_2_125_R: "D 2 × 1.25 R",
  D_3_125_R: "D 3 × 1.25 R",
  D_1_125_RR: "D 1 × 1.25 RR",
  D_2_125_RR: "D 2 × 1.25 RR",
  D_3_125_RR: "D 3 × 1.25 RR",

  DIRT: "Dirt",
  COBBLE: "Cobble",
  ROCK: "Rock",
  CLAY: "Clay",
  ASPHALT: "Asphalt",
  HARDPAN: "Hardpan",
  UNKNOWN: "Unknown Soil",

  "4FO": "4FO",
  "6FO": "6FO",
  "12FO": "12FO",
  "24FO": "24FO",
  "48FO": "48FO",
  "72FO": "72FO",
  "96FO": "96FO",
  "144FO": "144FO",
  "192FO": "192FO",
  "288FO": "288FO",
  "432FO": "432FO",
  BMST: "BMST",
};

export function getCsvTaskLabel(
  taskKey: string,
  variantCode?: string | null
): string {
  const key = String(taskKey || "").trim().toUpperCase();
  const variant = String(variantCode || "").trim().toUpperCase();

  const taskLabel = CSV_TASK_LABELS[key] || TASK_INDEX[key]?.label || key;
  const variantLabel = variant ? CSV_VARIANT_LABELS[variant] || variant : "";

  return variantLabel ? `${taskLabel} - ${variantLabel}` : taskLabel;
}