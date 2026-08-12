/**
 * Real XLSX and PDF export builders.
 *
 * - XLSX: built with `exceljs` (a real .xlsx workbook — multiple sheets,
 *   styled headers, currency-formatted numbers).
 * - PDF: rendered as styled HTML via `expo-print`'s `printToFileAsync`, then
 *   handed off to the share sheet.
 *
 * Both produce actual files (not CSV disguised as another format).
 */

import * as Print from "expo-print";
import ExcelJS from "exceljs";

import type { Transaction } from "@/db/schema";
import {
  downloadBinaryFile,
  shareExistingFile,
} from "@/lib/export-utils";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export interface ExportRange {
  label: string;
  start: string | null;
  end: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function centsToNumber(cents: number): number {
  return Math.round(cents) / 100;
}

function currencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
  };
  return symbols[code] ?? `${code} `;
}

function formatMoney(cents: number, currency: string): string {
  return `${currencySymbol(currency)}${centsToNumber(cents).toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

/**
 * Build a real .xlsx workbook in memory and return its bytes.
 * Two sheets: "Transactions" (line-by-line) and "Summary" (income/expense/net
 * grouped by category).
 */
export async function buildXlsx(
  transactions: Transaction[],
  range: ExportRange,
  baseCurrency: string,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PaySmooth";
  workbook.created = new Date();

  // ── Sheet 1: Transactions ────────────────────────────────────────────────
  const txSheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  txSheet.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: '"$"#,##0.00' } },
    { header: "Running Balance", key: "balance", width: 16, style: { numFmt: '"$"#,##0.00' } },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Category", key: "category", width: 24 },
    { header: "Account", key: "account", width: 20 },
    { header: "Note", key: "note", width: 40 },
  ];
  txSheet.getRow(1).font = { bold: true };
  txSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8F5" },
  };

  let runningBalance = 0;
  for (const t of transactions) {
    runningBalance += t.amountCents;
    txSheet.addRow({
      id: t.id,
      date: t.date.slice(0, 10),
      type: t.amountCents >= 0 ? "Income" : "Expense",
      amount: centsToNumber(t.amountCents),
      balance: centsToNumber(runningBalance),
      currency: t.currencyCode,
      category: t.categoryName ?? "Uncategorized",
      account: t.accountName ?? "",
      note: t.note ?? "",
    });
  }

  // ── Sheet 2: Summary by category ─────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary");

  const incomeByCat = new Map<string, number>();
  const expenseByCat = new Map<string, number>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    const cat = t.categoryName ?? "Uncategorized";
    if (t.amountCents > 0) {
      incomeByCat.set(cat, (incomeByCat.get(cat) ?? 0) + t.amountCents);
      totalIncome += t.amountCents;
    } else {
      expenseByCat.set(cat, (expenseByCat.get(cat) ?? 0) + Math.abs(t.amountCents));
      totalExpense += Math.abs(t.amountCents);
    }
  }

  summarySheet.addRow(["PaySmooth Ledger — " + range.label]).font = {
    bold: true,
    size: 14,
  };
  summarySheet.addRow([]);
  summarySheet.addRow(["Total Income", formatMoney(totalIncome, baseCurrency)]);
  summarySheet.addRow(["Total Expenses", formatMoney(totalExpense, baseCurrency)]);
  summarySheet.addRow(["Net", formatMoney(totalIncome - totalExpense, baseCurrency)]);
  summarySheet.addRow([]);

  summarySheet.addRow(["Expenses by Category"]).font = { bold: true };
  summarySheet.addRow(["Category", "Amount"]);
  summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
  for (const [cat, amt] of Array.from(expenseByCat.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    summarySheet.addRow([cat, formatMoney(amt, baseCurrency)]);
  }

  summarySheet.addRow([]);
  summarySheet.addRow(["Income by Category"]).font = { bold: true };
  summarySheet.addRow(["Category", "Amount"]);
  summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
  for (const [cat, amt] of Array.from(incomeByCat.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    summarySheet.addRow([cat, formatMoney(amt, baseCurrency)]);
  }

  summarySheet.columns.forEach((col) => {
    if (col && typeof col.width !== "number") col.width = 24;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/**
 * Build the XLSX, write it to disk (native) or trigger a download (web).
 */
export async function exportLedgerXlsx(
  transactions: Transaction[],
  range: ExportRange,
  baseCurrency: string,
): Promise<void> {
  const bytes = await buildXlsx(transactions, range, baseCurrency);
  const fileName = `PaySmooth_Ledger_${dateStamp()}.xlsx`;
  await downloadBinaryFile(
    fileName,
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Export Excel Workbook",
  );
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function buildPdfHtml(
  transactions: Transaction[],
  range: ExportRange,
  baseCurrency: string,
): string {
  const incomeByCat = new Map<string, number>();
  const expenseByCat = new Map<string, number>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    const cat = t.categoryName ?? "Uncategorized";
    if (t.amountCents > 0) {
      incomeByCat.set(cat, (incomeByCat.get(cat) ?? 0) + t.amountCents);
      totalIncome += t.amountCents;
    } else {
      expenseByCat.set(cat, (expenseByCat.get(cat) ?? 0) + Math.abs(t.amountCents));
      totalExpense += Math.abs(t.amountCents);
    }
  }

  const rows = transactions
    .map((t) => {
      const sign = t.amountCents >= 0 ? "+" : "";
      return `<tr>
        <td>${escapeHtml(t.id)}</td>
        <td>${t.date.slice(0, 10)}</td>
        <td>${t.amountCents >= 0 ? "Income" : "Expense"}</td>
        <td>${escapeHtml(t.categoryName ?? "Uncategorized")}</td>
        <td>${escapeHtml(t.accountName ?? "")}</td>
        <td>${escapeHtml(t.note ?? "")}</td>
        <td style="text-align:right">${sign}${formatMoney(t.amountCents, t.currencyCode)}</td>
      </tr>`;
    })
    .join("");

  const catRows = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, amt]) =>
          `<tr><td>${escapeHtml(cat)}</td><td style="text-align:right">${formatMoney(amt, baseCurrency)}</td></tr>`,
      )
      .join("");

  const net = totalIncome - totalExpense;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 24px; @bottom-right { content: "Page " counter(page) " of " counter(pages); } }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12px; }
      .header { border-bottom: 1px solid #ccc; margin-bottom: 16px; padding-bottom: 8px; }
      .title { font-size: 20px; font-weight: bold; }
      .meta { color: #666; font-size: 11px; }
      .footer { position: fixed; bottom: 0; width: 100%; text-align: right; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { text-align: left; background: #e8e8f5; padding: 6px 8px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; }
      .totals td { font-weight: 700; border-top: 2px solid #1a1a1a; }
      .totals .net { color: #22c55e; }
      .section { page-break-inside: avoid; margin-top: 20px; }
      .section h2 { font-size: 15px; margin: 0 0 4px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">PaySmooth Ledger</div>
      <div class="meta">${escapeHtml(range.label)} · Exported ${new Date().toLocaleString()}</div>
    </div>
    <div class="footer">Page <span class="page"></span></div>

    <table class="totals">
      <tr><td>Total Income</td><td style="text-align:right">${formatMoney(totalIncome, baseCurrency)}</td></tr>
      <tr><td>Total Expenses</td><td style="text-align:right">${formatMoney(totalExpense, baseCurrency)}</td></tr>
      <tr class="net"><td>Net</td><td style="text-align:right">${formatMoney(net, baseCurrency)}</td></tr>
    </table>

    <div class="section">
      <h2>Expenses by Category</h2>
      <table>${catRows(expenseByCat)}</table>
    </div>

    <div class="section">
      <h2>Income by Category</h2>
      <table>${catRows(incomeByCat)}</table>
    </div>

    <div class="section">
      <h2>Transactions (${transactions.length})</h2>
      <table>
        <tr><th>ID</th><th>Date</th><th>Type</th><th>Category</th><th>Account</th><th>Note</th><th>Amount</th></tr>
        ${rows}
      </table>
    </div>
  </body>
</html>`;
}

/**
 * Build a real PDF via expo-print and share it.
 */
export async function exportLedgerPdf(
  transactions: Transaction[],
  range: ExportRange,
  baseCurrency: string,
): Promise<void> {
  const html = buildPdfHtml(transactions, range, baseCurrency);
  const { uri } = await Print.printToFileAsync({ html });
  await shareExistingFile(
    uri,
    "application/pdf",
    "Export PDF Report",
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
