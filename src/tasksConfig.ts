// src/tasksConfig.ts
// Shared task configuration for AdminPrices + FieldProductionForm

export interface TaskItem {
  key: string;
  label: string;
  unit: string; // e.g. "FT", "SQFT", "EA", "COUNT", "HOURS", "YD3", "$"
}

export interface TaskGroup {
  group: string;      // Section title (FIBER, BORE SHOT, etc.)
  items: TaskItem[];
}

/**
 * TASK_GROUPS is derived from your original UW TRACKER HTML.
 * The goal is to cover the same structure you already use in the web form.
 */
export const TASK_GROUPS: TaskGroup[] = [
  // =========================
  // FIBER
  // =========================
  {
    group: "FIBER",
    items: [
      {
        key: "FIBER_BLOWING_FT",
        label: "Fiber blowing (any count)",
        unit: "FT",
      },
      {
        key: "FIBER_DIRECT_BURY_FT",
        label: "Direct bury fiber (plowing)",
        unit: "FT",
      },
      // Opcional: si algún día quieres separar por tamaño:
      {
        key: "FIBER_BLOWING_PREMIUM_FT",
        label: "Fiber blowing – high count / special",
        unit: "FT",
      },
    ],
  },

  // =========================
  // BORE SHOT
  // =========================
  {
    group: "BORE SHOT",
    items: [
      {
        key: "BORE_DIRT_FT",
        label: "Bore shot – dirt",
        unit: "FT",
      },
      {
        key: "BORE_COBBLE_FT",
        label: "Bore shot – cobble",
        unit: "FT",
      },
      {
        key: "BORE_TOTAL_FT",
        label: "Bore shot – total (dirt + cobble)",
        unit: "FT",
      },
      {
        key: "BORE_DUCT_COUNT",
        label: "Bore shot – duct count",
        unit: "COUNT",
      },
    ],
  },

  // =========================
  // VAULTS
  // =========================
  {
    group: "VAULTS",
    items: [
      {
        key: "VAULT_PULLBOX_EA",
        label: "Pullbox",
        unit: "EA",
      },
      {
        key: "VAULT_T8_EA",
        label: "Vault T8",
        unit: "EA",
      },
      {
        key: "VAULT_17X30_EA",
        label: "Vault 17x30",
        unit: "EA",
      },
      {
        key: "VAULT_24X36_EA",
        label: "Vault 24x36",
        unit: "EA",
      },
      {
        key: "VAULT_CUSTOM_EA",
        label: "Custom vault size",
        unit: "EA",
      },
    ],
  },

  // =========================
  // CONDUIT
  // =========================
  {
    group: "CONDUIT",
    items: [
      {
        key: "CHAIN_TRENCH_FT",
        label: "Chaintrench",
        unit: "FT",
      },
      {
        key: "MICROTRENCH_FT",
        label: "Microtrench",
        unit: "FT",
      },
      {
        key: "PLOW_CONDUIT_FT",
        label: "Plowing conduit",
        unit: "FT",
      },
      {
        key: "PIPES_BUNDLE_FT",
        label: "Pipe bundle in microtrench",
        unit: "FT",
      },
    ],
  },

  // =========================
  // MISSILE SHOT
  // =========================
  {
    group: "MISSILE SHOT",
    items: [
      {
        key: "MISSILE_SHOT_FT",
        label: "Missile shot",
        unit: "FT",
      },
    ],
  },

  // =========================
  // MASTIC
  // =========================
  {
    group: "MASTIC",
    items: [
      {
        key: "MASTIC_FT",
        label: "Mastic",
        unit: "FT",
      },
    ],
  },

  // =========================
  // ASPHALT
  // =========================
  {
    group: "ASPHALT",
    items: [
      {
        key: "ASPHALT_HOTPATCH_SQFT",
        label: "Hotpatch (asphalt)",
        unit: "SQFT",
      },
      {
        key: "ASPHALT_COLDPATCH_SQFT",
        label: "Coldpatch (asphalt)",
        unit: "SQFT",
      },
      {
        key: "ASPHALT_EXTRA_HOTPATCH_SQFT",
        label: "Extra hotpatch (other customer / project)",
        unit: "SQFT",
      },
      {
        key: "ASPHALT_EXTRA_COLDPATCH_SQFT",
        label: "Extra coldpatch (other customer / project)",
        unit: "SQFT",
      },
    ],
  },

  // =========================
  // DROPS
  // =========================
  {
    group: "DROPS",
    items: [
      {
        key: "DROP_FIBER_COUNT",
        label: "Fiber drops (count)",
        unit: "COUNT",
      },
      {
        key: "DROP_FIBER_FT",
        label: "Fiber drops (feet)",
        unit: "FT",
      },
      {
        key: "DROP_CONDUIT_COUNT",
        label: "Conduit drops (count)",
        unit: "COUNT",
      },
      {
        key: "DROP_CONDUIT_FT",
        label: "Conduit drops (feet)",
        unit: "FT",
      },
      {
        key: "DROP_NIDS_COUNT",
        label: "NIDs installed",
        unit: "COUNT",
      },
    ],
  },

  // =========================
  // FLOW FILL
  // =========================
  {
    group: "FLOW FILL",
    items: [
      {
        key: "FLOW_FILL_FT",
        label: "Flow fill trench length",
        unit: "FT",
      },
      {
        key: "FLOW_FILL_YD3",
        label: "Flow fill cubic yards used",
        unit: "YD3",
      },
    ],
  },

  // =========================
  // SPLICE
  // =========================
  {
    group: "SPLICE",
    items: [
      {
        key: "FIBER_SPLICE_COUNT",
        label: "Fiber splices (total)",
        unit: "COUNT",
      },
      {
        key: "SPLICE_CASE_SMALL_EA",
        label: "Splice cases – small",
        unit: "EA",
      },
      {
        key: "SPLICE_CASE_LARGE_EA",
        label: "Splice cases – large",
        unit: "EA",
      },
    ],
  },

  // =========================
  // CONCRETE CUT
  // =========================
  {
    group: "CONCRETE CUT",
    items: [
      {
        key: "CONCRETE_CUT_SQFT",
        label: "Concrete cut (square feet)",
        unit: "SQFT",
      },
    ],
  },

  // =========================
  // HOURS OF EQUIPMENT
  // =========================
  {
    group: "HOURS OF EQUIPMENT",
    items: [
      {
        key: "EQUIPMENT_HOURS_HR",
        label: "Equipment hours",
        unit: "HOURS",
      },
    ],
  },

  // =========================
  // OTHERS
  // =========================
  {
    group: "OTHERS",
    items: [
      {
        key: "OTHER_TASK_FT",
        label: "Other linear task",
        unit: "FT",
      },
      {
        key: "OTHER_TASK_COUNT",
        label: "Other task (count)",
        unit: "COUNT",
      },
    ],
  },
];
