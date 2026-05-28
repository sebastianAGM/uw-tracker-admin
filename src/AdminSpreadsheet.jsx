// src/AdminSpreadsheet.jsx
import React, { useMemo } from "react";

/**
 * Exporta a CSV (compatible con Google Sheets / Excel / QuickBooks import).
 *
 * Props:
 *  - filename: string (ej: "admin-balance-2026-01-01.csv")
 *  - headers: string[]
 *  - rows: (string | number | null | undefined)[][]
 *  - disabled?: boolean
 *  - className?: string
 *  - label?: string
 */
export default function AdminSpreadsheet({
  filename,
  headers,
  rows,
  disabled,
  className = "",
  label = "Download spreadsheet (CSV)",
}) {
  const safeFilename = filename || "admin-balance.csv";

  const csvText = useMemo(() => {
    const escapeCSV = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      // Si contiene coma, comillas o salto de línea -> quoted
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [];
    lines.push((headers || []).map(escapeCSV).join(","));
    for (const r of rows || []) {
      lines.push((r || []).map(escapeCSV).join(","));
    }
    // Excel a veces agradece BOM UTF-8, pero no es obligatorio.
    // Si quieres maximizar compatibilidad, descomenta:
    // return "\uFEFF" + lines.join("\n");
    return lines.join("\n");
  }, [headers, rows]);

  function isCapacitorNative() {
    try {
      const c = window?.Capacitor;
      return !!c && typeof c.isNativePlatform === "function" && c.isNativePlatform();
    } catch {
      return false;
    }
  }

  async function downloadMobileCapacitor() {
    // Import dinámico para no romper web builds
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    // Guarda en Documents
    const written = await Filesystem.writeFile({
      path: safeFilename,
      data: csvText,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    // Abre el share sheet (Drive, Mail, WhatsApp, etc.)
    await Share.share({
      title: safeFilename,
      text: "CSV export",
      url: written.uri,
      dialogTitle: "Share CSV",
    });
  }

  function downloadWeb() {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = safeFilename;

    // Safari/iOS a veces requiere que esté en el DOM
    document.body.appendChild(a);
    a.click();
    a.remove();

    // liberar memoria
    URL.revokeObjectURL(url);
  }

  async function download() {
    try {
      if (isCapacitorNative()) {
        await downloadMobileCapacitor();
        return;
      }
      downloadWeb();
    } catch (e) {
      console.error("[AdminSpreadsheet] CSV download failed:", e);
      // fallback: intenta web incluso si falló mobile
      try {
        downloadWeb();
      } catch (err2) {
        console.error("[AdminSpreadsheet] Fallback web download failed:", err2);
        alert("CSV export failed. Check console logs.");
      }
    }
  }

  const isDisabled = !!disabled || !rows || rows.length === 0;

  return (
    <button
      type="button"
      onClick={download}
      disabled={isDisabled}
      className={
        className ||
        `
          inline-flex items-center justify-center gap-2
          rounded-xl px-4 py-2 text-sm font-semibold
          bg-slate-900 text-white
          hover:bg-slate-800
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-sm
        `
      }
      title={isDisabled ? "No data to export" : "Download CSV"}
    >
      {label}
    </button>
  );
}
