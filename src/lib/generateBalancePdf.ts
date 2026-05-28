// src/lib/generateBalancePdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AdminBalanceTask {
  project_name?: string;
  project_code?: string | null;
  group: string;
  task_key: string;
  label: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface AdminBalanceDay {
  date: string; // "YYYY-MM-DD"
  tasks: AdminBalanceTask[];
  day_total_revenue: number;
}

export interface AdminBalanceSummary {
  total_revenue: number;
  total_direct_costs: number;
  total_overhead: number;
  total_net: number;
}

export interface AdminBalanceReport {
  project: {
    id: string;
    name: string;
    customer?: string;
  };
  range: {
    from: string;
    to: string;
  };
  days: AdminBalanceDay[];
  summary: AdminBalanceSummary;
}

export function generateBalancePdf(report: AdminBalanceReport): void {
  const doc = new jsPDF("p", "mm", "letter");

  // ===== Header =====
  doc.setFontSize(14);
  doc.text("UW — Balance report", 10, 15);

  doc.setFontSize(11);
  doc.text(
    `Project: ${report.project.name || report.project.id}`,
    10,
    22
  );
  if (report.project.customer) {
    doc.text(`Customer: ${report.project.customer}`, 10, 28);
  }

  doc.text(
    `Range: ${report.range.from} to ${report.range.to}`,
    10,
    34
  );

  doc.text(
    `Total revenue: ${formatCurrency(report.summary.total_revenue)}`,
    10,
    42
  );
  doc.text(
    `Direct costs: ${formatCurrency(
      report.summary.total_direct_costs
    )}`,
    10,
    48
  );
  doc.text(
    `Fixed overhead: ${formatCurrency(report.summary.total_overhead)}`,
    10,
    54
  );
  doc.text(
    `Net: ${formatCurrency(report.summary.total_net)}`,
    10,
    60
  );

  let startY = 68;

  // ===== Per-day tables =====
  report.days.forEach((day, index) => {
    if (!day.tasks.length) return;

    const title = `Date: ${day.date} — Day revenue: ${formatCurrency(
      day.day_total_revenue
    )}`;

    autoTable(doc, {
      startY:
        index === 0
          ? startY
          : // @ts-ignore - lastAutoTable viene del plugin
            (doc as any).lastAutoTable.finalY + 8,
      head: [
        [
          "Project",
          "Code",
          "Group",
          "Task",
          "Qty",
          "Unit",
          "Unit price",
          "Line total",
        ],
      ],
      body: day.tasks.map((t) => [
        t.project_name || "",
        t.project_code || "",
        t.group,
        t.label,
        t.quantity.toFixed(2),
        t.unit,
        formatCurrency(t.unit_price),
        formatCurrency(t.line_total),
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
      },
      margin: { left: 10, right: 10 },
       didDrawPage: (data: any) => {
        doc.setFontSize(10);
        doc.text(
          title,
          data.settings.margin.left,
          data.settings.startY - 3
        );
      },
    } as any);
  });

  const safeName =
    report.project.name && report.project.name.trim().length
      ? report.project.name.trim().replace(/\s+/g, "_")
      : "All_projects";

  const filename = `UW_Balance_${safeName}_${report.range.from}_${report.range.to}.pdf`;
  doc.save(filename);
}

function formatCurrency(v: number): string {
  const n = typeof v === "number" && !isNaN(v) ? v : 0;
  return `$${n.toFixed(2)}`;
}
