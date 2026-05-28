// src/pricingCatalog.ts

// ================== TIPOS BÁSICOS ==================
export type Unit = 'ft' | 'sqft' | 'yd3' | 'count' | 'hours';

export interface PriceVariant {
  /** Clave interna para D1: task_key */
  key: string;          // ej: "FIBER.BLOWING.4FO"
  /** Texto que verá el admin en el panel */
  label: string;        // ej: "Blowing 4FO"
  /** Unidad para cálculo: ft, sqft, yd3, count, hours */
  unit: Unit;
  /** Grupo / subtítulo dentro de la Task (opcional) */
  group?: string;       // ej: "Blowing", "Direct Bury"
}

export interface TaskDefinition {
  /** Código del task, debe coincidir con el frontend (FIBER, BORE_SHOT, etc.) */
  task: string;
  /** Label amigable para mostrar en el Admin */
  label: string;
  /** Variantes tarifables dentro de esa tarea */
  variants: PriceVariant[];
}

// ================== HELPERS ==================

// todas las counts que usas en FIBER
const FIBER_COUNTS: string[] = [
  '4FO', '6FO', '12FO', '24FO', '48FO',
  '72FO', '96FO', '144FO', '192FO',
  '288FO', '432FO', 'BMST',
];

function makeFiberBlowingVariants(): PriceVariant[] {
  return FIBER_COUNTS.map((count) => ({
    key: `FIBER.BLOWING.${count}`,
    label: `Blowing ${count}`,
    unit: 'ft',
    group: 'Blowing',
  }));
}

function makeFiberPlowVariants(): PriceVariant[] {
  return FIBER_COUNTS.map((count) => ({
    key: `FIBER.PLOW.${count}`,
    label: `Plowing ${count}`,
    unit: 'ft',
    group: 'Plowing (Direct Bury)',
  }));
}

// ================== CATÁLOGO PRINCIPAL ==================

export const TASK_CATALOG: TaskDefinition[] = [
  // ---------- FIBER ----------
  {
    task: 'FIBER',
    label: 'Fiber',
    variants: [
      ...makeFiberBlowingVariants(),
      ...makeFiberPlowVariants(),
      // los "custom count" del frontend se pueden mapear a otra clave genérica más adelante si quieres
    ],
  },

  // ---------- BORE SHOT ----------
  {
    task: 'BORE_SHOT',
    label: 'Bore Shot',
    variants: [
      {
        key: 'BORE.DIRT_FT',
        label: 'Dirt (feet)',
        unit: 'ft',
      },
      {
        key: 'BORE.COBBLE_FT',
        label: 'Cobble (feet)',
        unit: 'ft',
      },
      // Total es derivado -> no necesita precio
      {
        key: 'BORE.DUCT_COUNT',
        label: 'Ducts (count / size)',
        unit: 'count',
      },
    ],
  },

  // ---------- VAULTS ----------
  {
    task: 'VAULTS',
    label: 'Vaults',
    variants: [
      {
        key: 'VAULTS.PULLBOX',
        label: 'Pullbox',
        unit: 'count',
      },
      {
        key: 'VAULTS.T8',
        label: 'T8',
        unit: 'count',
      },
      {
        key: 'VAULTS.17X30',
        label: '17x30',
        unit: 'count',
      },
      {
        key: 'VAULTS.24X36',
        label: '24x36',
        unit: 'count',
      },
      // Si más adelante quieres custom por tamaño (30x48, etc) lo agregamos acá
    ],
  },

  // ---------- CONDUIT ----------
  {
    task: 'CONDUIT',
    label: 'Conduit',
    variants: [
      {
        key: 'CONDUIT.CHAIN.FT',
        label: 'Chaintrench (feet)',
        unit: 'ft',
        group: 'Chaintrench',
      },
      {
        key: 'CONDUIT.MICRO.FT',
        label: 'Microtrench (feet)',
        unit: 'ft',
        group: 'Microtrench',
      },
      {
        key: 'CONDUIT.PLOW.FT',
        label: 'Plowing Conduit (feet)',
        unit: 'ft',
        group: 'Plowing',
      },
    ],
  },

  // ---------- MISILE SHOT ----------
  {
    task: 'MISILE_SHOT',
    label: 'Missile Shot',
    variants: [
      {
        key: 'MISILE_SHOT.FEET',
        label: 'Missile Shot (feet)',
        unit: 'ft',
      },
      // si después agregas CURB / STUB en el frontend, ya tienes las claves acá:
      {
        key: 'MISILE_SHOT.CURB',
        label: 'Curb (ea)',
        unit: 'count',
      },
      {
        key: 'MISILE_SHOT.STUB',
        label: 'Stub (ea)',
        unit: 'count',
      },
    ],
  },

  // ---------- MASTIC ----------
  {
    task: 'MASTIC',
    label: 'Mastic',
    variants: [
      {
        key: 'MASTIC.FEET',
        label: 'Mastic (feet)',
        unit: 'ft',
      },
    ],
  },

  // ---------- ASPHALT ----------
  {
    task: 'ASPHALT',
    label: 'Asphalt',
    variants: [
      {
        key: 'ASPHALT.HOTPATCH.SQFT',
        label: 'Hotpatch (sq ft)',
        unit: 'sqft',
      },
      {
        key: 'ASPHALT.COLDPATCH.SQFT',
        label: 'Coldpatch (sq ft)',
        unit: 'sqft',
      },
    ],
  },

  // ---------- DROPS ----------
  {
    task: 'DROPS',
    label: 'Drops',
    variants: [
      {
        key: 'DROPS.FIBER.COUNT',
        label: 'Fiber (count per drop)',
        unit: 'count',
        group: 'Fiber',
      },
      {
        key: 'DROPS.FIBER.FEET',
        label: 'Fiber (feet)',
        unit: 'ft',
        group: 'Fiber',
      },
      {
        key: 'DROPS.CONDUIT.COUNT',
        label: 'Conduit (count per drop)',
        unit: 'count',
        group: 'Conduit',
      },
      {
        key: 'DROPS.CONDUIT.FEET',
        label: 'Conduit (feet)',
        unit: 'ft',
        group: 'Conduit',
      },
    ],
  },

  // ---------- FLOW FILL ----------
  {
    task: 'FLOW_FILL',
    label: 'Flow Fill',
    variants: [
      {
        key: 'FLOW_FILL.YARDS',
        label: 'Cubic Yards Used (yd³)',
        unit: 'yd3',
      },
      // feet es sólo referencia, no lo tarificamos por ahora
    ],
  },

  // ---------- SPLICE ----------
  {
    task: 'SPLICE',
    label: 'Splice',
    variants: [
      {
        key: 'SPLICE.COUNT',
        label: 'Total splices',
        unit: 'count',
      },
      {
        key: 'SPLICE.CASE_SMALL',
        label: 'Cases – small',
        unit: 'count',
      },
      {
        key: 'SPLICE.CASE_LARGE',
        label: 'Cases – large',
        unit: 'count',
      },
    ],
  },

  // ---------- CONCRETE CUT ----------
  {
    task: 'CONCRETE_CUT',
    label: 'Concrete Cut',
    variants: [
      {
        key: 'CONCRETE_CUT.SQFT',
        label: 'Concrete Cut (sq ft)',
        unit: 'sqft',
      },
    ],
  },

  // ---------- HOURS OF EQUIPMENT ----------
  {
    task: 'HOURS_EQUIPMENT',
    label: 'Hours of Equipment',
    variants: [
      {
        key: 'HOURS_EQUIPMENT.HOURS',
        label: 'Equipment hours',
        unit: 'hours',
      },
    ],
  },

  // ---------- OTHERS ----------
  {
    task: 'OTHERS',
    label: 'Others',
    variants: [
      {
        key: 'OTHERS.GENERIC.FEET',
        label: 'Generic – Feet',
        unit: 'ft',
      },
      {
        key: 'OTHERS.GENERIC.COUNT',
        label: 'Generic – Count',
        unit: 'count',
      },
    ],
  },
];
