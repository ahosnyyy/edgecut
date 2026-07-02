import { formatLength } from "../engine/units";
import type { PiecePoolGroupData } from "../hooks/usePiecePools";

export interface PlanSectionData {
  profileType: string;
  profileTypeLabel: string;
  isApplied: boolean;
  bars: any[];
  summary: {
    totalBars: number;
    totalWastePercent: number;
    totalWasteLength: number;
    barsBreakdown: Record<string, number>;
  };
}

export interface ExportPDFOptions {
  projectName: string;
  buildingName: string;
  plans: PlanSectionData[];
  piecePoolGroups?: PiecePoolGroupData[];
  unit: string;
  unitLabel: string;
  getRGBForLength: (length: number) => [number, number, number];
  getStockById: (id: string) => { label: string; length: number } | null | undefined;
}

function groupBars(bars: any[]): any[] {
  const grouped: any[] = [];
  bars.forEach((bar) => {
    const pieceSignature = bar.pieces.map((p: any) => `${p.length}-${p.label}`).sort().join("|");
    const signature = `${bar.stockLengthId}-${bar.isRemnant}-${bar.stockLabel || ""}-${bar.waste}-${pieceSignature}`;
    const existing = grouped.find((g) => g.signature === signature);
    if (existing) {
      existing.count++;
    } else {
      grouped.push({ ...bar, signature, count: 1 });
    }
  });
  return grouped;
}

const PAGE_MARGIN = 15;
const HEADER_HEIGHT = 35;

function getPageDimensions(pdf: any) {
  return {
    width: pdf.internal.pageSize.getWidth(),
    height: pdf.internal.pageSize.getHeight(),
  };
}

function ensureSpace(pdf: any, currentY: number, needed: number): number {
  const { height } = getPageDimensions(pdf);
  if (currentY + needed > height - PAGE_MARGIN) {
    pdf.addPage();
    return PAGE_MARGIN + 5;
  }
  return currentY;
}

function drawHeader(pdf: any, title: string, subtitle: string) {
  const { width } = getPageDimensions(pdf);
  pdf.setFillColor(24, 24, 27);
  pdf.rect(0, 0, width, HEADER_HEIGHT, "F");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Edgecut", PAGE_MARGIN, 18);
  pdf.setFontSize(11);
  pdf.setTextColor(161, 161, 170);
  pdf.text(subtitle, PAGE_MARGIN, 26);
  pdf.setFontSize(10);
  pdf.setTextColor(200, 200, 200);
  pdf.text(title, width - PAGE_MARGIN, 18, { align: "right" });
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, width - PAGE_MARGIN, 26, { align: "right" });
}

function addPageFooters(pdf: any) {
  const { width, height } = getPageDimensions(pdf);
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(161, 161, 170);
    pdf.text(`Page ${i} of ${pageCount}`, width / 2, height - 8, { align: "center" });
  }
}

function drawCoverPage(
  pdf: any,
  projectName: string,
  buildingName: string,
  plans: PlanSectionData[],
  includePiecePools: boolean,
) {
  const { width } = getPageDimensions(pdf);
  drawHeader(pdf, `${projectName} — ${buildingName}`, "Optimized Cutting Plan");

  let y = HEADER_HEIGHT + 15;

  pdf.setFontSize(16);
  pdf.setTextColor(9, 9, 11);
  pdf.text("Overall Summary", PAGE_MARGIN, y);
  y += 10;

  const totalBars = plans.reduce((sum, p) => sum + p.summary.totalBars, 0);
  const totalWasteLength = plans.reduce((sum, p) => sum + p.summary.totalWasteLength, 0);
  const totalDemandLength = plans.reduce(
    (sum, p) => sum + p.bars.reduce((s: number, b: any) => s + b.pieces.reduce((ps: number, piece: any) => ps + piece.length, 0), 0),
    0,
  );
  const avgUtilization = totalDemandLength > 0 ? (1 - totalWasteLength / (totalDemandLength + totalWasteLength)) * 100 : 0;

  pdf.setFontSize(11);
  pdf.setTextColor(82, 82, 91);
  pdf.text(`Total Bars: ${totalBars}`, PAGE_MARGIN, y);
  y += 7;
  pdf.text(`Total Waste: ${totalWasteLength > 0 ? ((totalWasteLength / (totalDemandLength + totalWasteLength)) * 100).toFixed(1) : "0"}%`, PAGE_MARGIN, y);
  y += 7;
  pdf.text(`Avg Utilization: ${avgUtilization.toFixed(1)}%`, PAGE_MARGIN, y);
  y += 7;
  pdf.text(`Profile Types: ${plans.map((p) => p.profileTypeLabel).join(", ")}`, PAGE_MARGIN, y);
  y += 12;

  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.5);
  pdf.line(PAGE_MARGIN, y, width - PAGE_MARGIN, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.setTextColor(9, 9, 11);
  pdf.text("Contents", PAGE_MARGIN, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(82, 82, 91);
  for (const plan of plans) {
    const status = plan.isApplied ? "Applied" : "Saved";
    pdf.text(
      `${plan.profileTypeLabel}  ·  ${status}  ·  ${plan.summary.totalBars} bars  ·  ${plan.summary.totalWastePercent.toFixed(1)}% waste`,
      PAGE_MARGIN + 4,
      y,
    );
    y += 6;
  }

  if (includePiecePools) {
    pdf.text("Piece Pools (all groups)", PAGE_MARGIN + 4, y);
    y += 6;
  }
}

/**
 * Draws a full plan section (title + materials + bars) within a column.
 * Returns the Y position after drawing, or null if it overflowed (caller should continue on next page/column).
 */
function drawPlanSectionInColumn(
  pdf: any,
  plan: PlanSectionData,
  opts: ExportPDFOptions,
  colX: number,
  colWidth: number,
  startY: number,
  pageHeight: number,
): { endedY: number; overflowed: boolean } {
  let y = startY;
  const bottomLimit = pageHeight - PAGE_MARGIN;
  const barHeight = 6;
  const barEntryHeight = 10; // bar (6) + spacing (4)

  // Section header — one line: TYPE [Status] · 58× Frame Bar (600cm) · 7.0% waste
  if (y + 16 > bottomLimit) return { endedY: y, overflowed: true };

  // Build materials string
  const materialsMap = new Map<string, { count: number; length: number }>();
  for (const bar of plan.bars) {
    const key = bar.stockLabel || bar.stockLengthId || "Unknown";
    const existing = materialsMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      materialsMap.set(key, { count: 1, length: bar.stockLength || 0 });
    }
  }
  const materialsStr = Array.from(materialsMap.entries())
    .map(([label, info]) => `${info.count}× ${label} (${formatLength(info.length, opts.unit)})`)
    .join(", ");

  // Type name + status badge
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(9, 9, 11);
  const typeText = plan.profileTypeLabel.toUpperCase();
  pdf.text(typeText, colX, y + 4);
  let textX = colX + pdf.getTextWidth(typeText) + 4;

  const statusText = plan.isApplied ? "Applied" : "Saved";
  const statusColor = plan.isApplied ? [22, 163, 74] : [82, 82, 91];
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.text(`[${statusText}]`, textX, y + 4);

  // Subtitle: materials + waste
  pdf.setFontSize(8);
  pdf.setTextColor(113, 113, 122);
  const infoText = `${materialsStr} · ${plan.summary.totalWastePercent.toFixed(1)}% waste`;
  pdf.text(infoText, colX, y + 10);

  y += 18;

  // Cutting Instructions

  const barsToPrint = groupBars(plan.bars);
  barsToPrint.sort((a: any, b: any) => b.count - a.count);

  let barCount = 0;
  let remnantCount = 0;

  for (const bar of barsToPrint) {
    if (bar.pieces.length === 0) continue;

    if (y + barEntryHeight > bottomLimit) {
      return { endedY: y, overflowed: true };
    }

    const displayIndex = bar.isRemnant ? remnantCount++ : barCount++;

    // Count prefix in fixed-width column so bars align
    const countColWidth = 6;
    const countText = `${bar.count}×`;
    pdf.setFontSize(7);
    pdf.setTextColor(113, 113, 122);
    pdf.text(countText, colX, y + barHeight / 2 + 1, { align: "left" });

    // Draw waste area background
    const barX = colX + countColWidth + 1;
    const barDrawWidth = colWidth - countColWidth - 1;
    pdf.setFillColor(244, 244, 245);
    pdf.rect(barX, y, barDrawWidth, barHeight, "F");

    // Draw pieces
    for (const piece of bar.pieces) {
      const xOffset = barX + (piece.offset / bar.stockLength) * barDrawWidth;
      const pieceW = (piece.length / bar.stockLength) * barDrawWidth;
      const rgb = opts.getRGBForLength(piece.length);

      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.2);
      pdf.rect(xOffset, y, pieceW, barHeight, "FD");

      if (pieceW > 4) {
        pdf.setTextColor(255, 255, 255);
        const textX = xOffset + pieceW / 2;
        const textY = y + barHeight / 2;

        if (pieceW > 18) {
          // Full label + length on two lines
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6);
          pdf.text(piece.label, textX, textY - 1, { align: "center", baseline: "middle" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5);
          pdf.text(formatLength(piece.length, opts.unit, false), textX, textY + 1, { align: "center", baseline: "middle" });
        } else if (pieceW > 8) {
          // Length only
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5);
          pdf.text(formatLength(piece.length, opts.unit, false), textX, textY, { align: "center", baseline: "middle" });
        } else {
          // Abbreviated: first char of label above, rounded length below
          const abbrLabel = piece.label.charAt(0);
          const abbrLen = formatLength(piece.length, opts.unit, false);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(4);
          pdf.text(abbrLabel, textX, textY - 0.8, { align: "center", baseline: "middle" });
          pdf.text(abbrLen, textX, textY + 0.8, { align: "center", baseline: "middle" });
        }
      }
    }

    // Waste label
    if (bar.waste > 0) {
      const wasteW = (bar.waste / bar.stockLength) * colWidth;
      const wasteX = colX + colWidth - wasteW;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6);
      pdf.setTextColor(220, 38, 38);

      if (wasteW > 10) {
        pdf.text(formatLength(bar.waste, opts.unit, false), wasteX + wasteW / 2, y + barHeight / 2, { align: "center", baseline: "middle" });
      } else {
        pdf.text(formatLength(bar.waste, opts.unit, false), wasteX + wasteW + 1.5, y + barHeight / 2, { align: "left", baseline: "middle" });
      }
    }

    pdf.setFont("helvetica", "normal");
    y += barHeight + 4;
  }

  return { endedY: y, overflowed: false };
}

function drawPiecePoolTable(
  pdf: any,
  group: PiecePoolGroupData,
  opts: ExportPDFOptions,
  startY: number,
): number {
  const { width } = getPageDimensions(pdf);
  const { group: groupInfo, sizeGroups, piecesBySize, pieceGroups } = group;

  if (sizeGroups.length === 0 || piecesBySize.length === 0) return startY;

  let y = startY;

  // Check if we need a new page
  y = ensureSpace(pdf, y, 40);

  // Section header
  pdf.setFontSize(14);
  pdf.setTextColor(9, 9, 11);
  pdf.text(`Piece Pool: ${groupInfo.pieceTemplateName}`, PAGE_MARGIN, y);
  y += 10;

  const firstPieces = piecesBySize[0]?.pieces ?? [];
  const numPieceCols = firstPieces.length;

  // Column layout
  const fixedColWidths = [20, 14, 50, 18, 18]; // Size, Qty, Locations, W, H
  const fixedColTotal = fixedColWidths.reduce((a, b) => a + b, 0);
  const availableForPieces = width - 2 * PAGE_MARGIN - fixedColTotal;
  const pieceColWidth = numPieceCols > 0 ? Math.min(availableForPieces / numPieceCols, 28) : 0;
  const totalTableWidth = fixedColTotal + pieceColWidth * numPieceCols;

  // Adjust if too wide — use landscape-friendly approach: shrink piece columns
  const maxTableWidth = width - 2 * PAGE_MARGIN;
  const actualPieceColWidth = totalTableWidth > maxTableWidth
    ? (maxTableWidth - fixedColTotal) / numPieceCols
    : pieceColWidth;

  const colXs: number[] = [PAGE_MARGIN];
  const allColWidths = [...fixedColWidths, ...Array(numPieceCols).fill(actualPieceColWidth)];
  for (let i = 0; i < allColWidths.length; i++) {
    colXs.push(colXs[i] + allColWidths[i]);
  }

  const rowHeight = 7;
  const headerRowHeight = 6;

  // ── Profile type group header row ──
  y = ensureSpace(pdf, y, headerRowHeight * 2 + rowHeight * sizeGroups.length * 2 + 10);

  pdf.setFillColor(244, 244, 245);
  pdf.rect(PAGE_MARGIN, y, colXs[colXs.length - 1] - PAGE_MARGIN, headerRowHeight, "F");

  pdf.setFontSize(8);
  pdf.setTextColor(82, 82, 91);
  pdf.setFont("helvetica", "bold");

  // Fixed columns span both header rows
  const fixedHeaders = ["Size", "Qty", "Locations", "W", "H"];
  for (let i = 0; i < fixedHeaders.length; i++) {
    const cx = colXs[i] + allColWidths[i] / 2;
    if (fixedHeaders[i] === "Locations") {
      pdf.text(fixedHeaders[i], colXs[i] + 1, y + headerRowHeight - 1.5, { align: "left" });
    } else {
      pdf.text(fixedHeaders[i], cx, y + headerRowHeight - 1.5, { align: "center" });
    }
  }

  // Profile type group headers
  for (const pg of pieceGroups) {
    const startCol = 5 + pg.indices[0];
    const endCol = 5 + pg.indices[pg.indices.length - 1] + 1;
    const startX = colXs[startCol];
    const endX = colXs[endCol];
    const cx = (startX + endX) / 2;

    // Draw border for group header
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.3);
    pdf.line(startX, y, endX, y);

    pdf.setFontSize(8);
    pdf.setTextColor(9, 9, 11);
    pdf.text(pg.label, cx, y + headerRowHeight - 1.5, { align: "center" });
  }

  y += headerRowHeight;

  // ── Piece label header row ──
  pdf.setFillColor(250, 250, 250);
  pdf.rect(PAGE_MARGIN, y, colXs[colXs.length - 1] - PAGE_MARGIN, headerRowHeight, "F");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(113, 113, 122);

  for (let i = 0; i < firstPieces.length; i++) {
    const col = 5 + i;
    const cx = colXs[col] + allColWidths[col] / 2;
    const piece = firstPieces[i];
    pdf.text(`${piece.label}×${piece.quantity}`, cx, y + headerRowHeight - 1.5, { align: "center" });
  }

  y += headerRowHeight;

  // ── Data rows (per size group) ──
  for (let si = 0; si < sizeGroups.length; si++) {
    const sg = sizeGroups[si];
    const pieces = piecesBySize[si]?.pieces ?? [];

    // Calculate dynamic row height based on location count (3 per line)
    const locsPerLine = 3;
    const locLines = Math.max(1, Math.ceil(sg.locations.length / locsPerLine));
    const valueRowHeight = Math.max(rowHeight, locLines * 5 + 2);

    y = ensureSpace(pdf, y, valueRowHeight + rowHeight + 2);

    // Value row
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.3);
    pdf.setFontSize(7);
    pdf.setTextColor(82, 82, 91);
    pdf.setFont("helvetica", "normal");

    // Size # (vertically centered)
    pdf.text(`Size ${si + 1}`, colXs[0] + 1, y + valueRowHeight / 2, { align: "left" });
    // Qty (vertically centered)
    pdf.text(String(sg.count), colXs[1] + allColWidths[1] / 2, y + valueRowHeight / 2, { align: "center" });

    // Locations — wrapped in a grid (3 per line) like the web page
    const locColWidth = allColWidths[2] / locsPerLine;
    for (let li = 0; li < sg.locations.length; li++) {
      const lineIdx = Math.floor(li / locsPerLine);
      const colInLine = li % locsPerLine;
      const lx = colXs[2] + colInLine * locColWidth + locColWidth / 2;
      const ly = y + 3 + lineIdx * 5;
      pdf.text(sg.locations[li], lx, ly, { align: "center" });
    }

    // W, H (vertically centered)
    pdf.setFont("courier", "normal");
    pdf.text(sg.avgW, colXs[3] + allColWidths[3] / 2, y + valueRowHeight / 2, { align: "center" });
    pdf.text(sg.avgH, colXs[4] + allColWidths[4] / 2, y + valueRowHeight / 2, { align: "center" });
    pdf.setFont("helvetica", "normal");

    // Piece lengths (vertically centered)
    for (let pi = 0; pi < pieces.length; pi++) {
      const col = 5 + pi;
      const cx = colXs[col] + allColWidths[col] / 2;
      pdf.text(formatLength(pieces[pi].length, opts.unit, false), cx, y + valueRowHeight / 2, { align: "center" });
    }

    // Bottom border
    pdf.line(PAGE_MARGIN, y + valueRowHeight, colXs[colXs.length - 1], y + valueRowHeight);
    y += valueRowHeight;

    // Subtotal row (muted)
    pdf.setFillColor(250, 250, 250);
    pdf.rect(PAGE_MARGIN, y, colXs[colXs.length - 1] - PAGE_MARGIN, rowHeight, "F");

    pdf.setFontSize(7);
    pdf.setTextColor(161, 161, 170);

    // Subtotal quantities per piece
    for (let pi = 0; pi < pieces.length; pi++) {
      const col = 5 + pi;
      const cx = colXs[col] + allColWidths[col] / 2;
      pdf.text(`×${sg.count * pieces[pi].quantity}`, cx, y + rowHeight - 1.5, { align: "center" });
    }

    y += rowHeight;
  }

  // ── Grand total row ──
  y = ensureSpace(pdf, y, rowHeight + 4);
  pdf.setDrawColor(113, 113, 122);
  pdf.setLineWidth(0.5);
  pdf.line(PAGE_MARGIN, y, colXs[colXs.length - 1], y);
  y += 3;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(9, 9, 11);
  pdf.text("Total", colXs[0] + 1, y + rowHeight - 1.5, { align: "left" });

  const totalCount = sizeGroups.reduce((sum, sg) => sum + sg.count, 0);
  pdf.text(String(totalCount), colXs[1] + allColWidths[1] / 2, y + rowHeight - 1.5, { align: "center" });

  // Grand total per piece
  for (let pi = 0; pi < firstPieces.length; pi++) {
    const col = 5 + pi;
    const cx = colXs[col] + allColWidths[col] / 2;
    const total = sizeGroups.reduce((sum, sg, si) => {
      const pieces = piecesBySize[si]?.pieces ?? [];
      return sum + (pieces[pi] ? sg.count * pieces[pi].quantity : 0);
    }, 0);
    pdf.text(`×${total}`, cx, y + rowHeight - 1.5, { align: "center" });
  }

  pdf.setFont("helvetica", "normal");
  y += rowHeight + 8;
  return y;
}

export async function generateExportPDF(opts: ExportPDFOptions): Promise<any> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("l", "mm", "a4"); // landscape

  const includePiecePools = (opts.piecePoolGroups?.length ?? 0) > 0;

  // Cover page
  drawCoverPage(pdf, opts.projectName, opts.buildingName, opts.plans, includePiecePools);

  // Piece pools section (before plan sections)
  if (includePiecePools && opts.piecePoolGroups) {
    pdf.addPage();
    let y = PAGE_MARGIN + 5;
    pdf.setFontSize(16);
    pdf.setTextColor(9, 9, 11);
    pdf.text("Piece Pools", PAGE_MARGIN, y);
    y += 10;

    for (const group of opts.piecePoolGroups) {
      y = drawPiecePoolTable(pdf, group, opts, y);
    }
  }

  // Plan sections — two plans per page (left + right column)
  const { width, height } = getPageDimensions(pdf);
  const colGap = 20;
  const colWidth = (width - 2 * PAGE_MARGIN - colGap) / 2;
  const col1X = PAGE_MARGIN;
  const col2X = PAGE_MARGIN + colWidth + colGap;
  const colTopY = PAGE_MARGIN + 5;

  for (let i = 0; i < opts.plans.length; i++) {
    const plan = opts.plans[i];
    const colIndex = i % 2; // 0 = left, 1 = right

    if (colIndex === 0) {
      pdf.addPage();
    }

    const colX = colIndex === 0 ? col1X : col2X;
    const y = colTopY;

    // Draw the plan section in this column; if it overflows, continue on next page same column
    const result = drawPlanSectionInColumn(pdf, plan, opts, colX, colWidth, y, height);
    if (result.overflowed) {
      // Overflow fallback: give the plan its own full page
      pdf.addPage();
      const fullWidth = width - 2 * PAGE_MARGIN;
      drawPlanSectionInColumn(pdf, plan, opts, PAGE_MARGIN, fullWidth, colTopY, height);
    }
  }

  // Add page footers
  addPageFooters(pdf);

  return pdf;
}
