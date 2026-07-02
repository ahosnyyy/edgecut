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
  includeMiniPiecePools?: boolean;
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
const HEADER_HEIGHT = 28;

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

function drawHeader(pdf: any, title: string, subtitle: string, logos?: { edge?: string; bunyan?: string }) {
  const { width } = getPageDimensions(pdf);
  const centerX = width / 2;

  // Edge logo — top left
  if (logos?.edge) {
    try {
      pdf.addImage(logos.edge, "PNG", PAGE_MARGIN, 5, 45, 13);
    } catch (_e) { /* optional */ }
  }

  // Bunyan logo — top right
  if (logos?.bunyan) {
    try {
      pdf.addImage(logos.bunyan, "PNG", width - PAGE_MARGIN - 35, 5, 35, 12);
    } catch (_e) { /* optional */ }
  }

  // Centered title block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(9, 9, 11);
  pdf.text(title, centerX, 12, { align: "center" });

  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(113, 113, 122);
    pdf.text(subtitle, centerX, 19, { align: "center" });
  }

  // Header bottom border
  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.5);
  pdf.line(PAGE_MARGIN, HEADER_HEIGHT - 2, width - PAGE_MARGIN, HEADER_HEIGHT - 2);
}

function addPageFooters(pdf: any, title?: string, subtitle?: string) {
  const { width, height } = getPageDimensions(pdf);
  const pageCount = pdf.getNumberOfPages();
  const dateStr = new Date().toLocaleDateString();
  const centerText = [title, subtitle].filter(Boolean).join("  ·  ");
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(161, 161, 170);
    pdf.text(dateStr, PAGE_MARGIN, height - 8, { align: "left" });
    if (centerText) {
      pdf.text(centerText, width / 2, height - 8, { align: "center" });
    }
    pdf.text(`Page ${i} of ${pageCount}`, width - PAGE_MARGIN, height - 8, { align: "right" });
  }
}

function drawCoverPage(
  pdf: any,
  projectName: string,
  buildingName: string,
  plans: PlanSectionData[],
  includePiecePools: boolean,
  logos?: { edge?: string; bunyan?: string },
  piecePoolGroups?: PiecePoolGroupData[],
  opts?: ExportPDFOptions,
) {
  const { width } = getPageDimensions(pdf);
  const subtitle = piecePoolGroups && piecePoolGroups.length > 0
    ? piecePoolGroups.map((g) => g.group.pieceTemplateName).join(", ")
    : "";
  drawHeader(pdf, `${projectName} — ${buildingName}`, subtitle, logos);

  let y = HEADER_HEIGHT + 6;

  // Summary table title — colored bar
  pdf.setFillColor(244, 244, 245);
  pdf.rect(PAGE_MARGIN, y, width - 2 * PAGE_MARGIN, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(9, 9, 11);
  pdf.text("Cutting Plan Summary", PAGE_MARGIN + 2, y + 5.5);
  pdf.setFont("helvetica", "normal");
  y += 10;

  // Summary table (per-type + overall totals)
  if (plans.length > 0) {
    const sumCols = ["Profile Type", "Bars", "Waste %", "Utilization %"];
    const sumColRatios = [0.3, 0.3, 0.2, 0.2];
    const sumTotalWidth = width - 2 * PAGE_MARGIN;
    const sumColWidths = sumColRatios.map((r) => r * sumTotalWidth);
    const sumXs: number[] = [PAGE_MARGIN];
    for (let i = 0; i < sumColWidths.length; i++) {
      sumXs.push(sumXs[i] + sumColWidths[i]);
    }

    const sumRowH = 7;
    const sumHeaderH = 7;

    // Top border
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.5);
    pdf.line(PAGE_MARGIN, y, sumXs[sumXs.length - 1], y);

    // Header row
    pdf.setFillColor(244, 244, 245);
    pdf.rect(PAGE_MARGIN, y, sumTotalWidth, sumHeaderH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(82, 82, 91);
    for (let i = 0; i < sumCols.length; i++) {
      if (i < 2) {
        pdf.text(sumCols[i], sumXs[i] + 2, y + sumHeaderH - 2, { align: "left" });
      } else {
        const cx = sumXs[i] + sumColWidths[i] / 2;
        pdf.text(sumCols[i], cx, y + sumHeaderH - 2, { align: "center" });
      }
    }
    pdf.setFont("helvetica", "normal");

    // Bottom border for header row
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.3);
    pdf.line(PAGE_MARGIN, y + sumHeaderH, sumXs[sumXs.length - 1], y + sumHeaderH);

    y += sumHeaderH;

    // Data rows
    pdf.setFontSize(8);
    pdf.setTextColor(82, 82, 91);
    let totalBars = 0;
    let totalWasteLength = 0;
    let totalDemandLength = 0;

    for (const plan of plans) {
      const utilization = 100 - plan.summary.totalWastePercent;

      // Build bars breakdown string
      const barsStr = Object.entries(plan.summary.barsBreakdown)
        .map(([stockId, count]: any) => {
          const stock = opts?.getStockById(stockId);
          const label = stock?.label || stockId;
          const len = stock?.length && opts ? ` (${formatLength(stock.length, opts.unit)})` : "";
          return `${count}× ${label}${len}`;
        })
        .join(", ");

      pdf.setDrawColor(228, 228, 231);
      pdf.setLineWidth(0.3);
      pdf.line(PAGE_MARGIN, y, sumXs[sumXs.length - 1], y);

      pdf.text(plan.profileTypeLabel, sumXs[0] + 2, y + sumRowH - 2, { align: "left" });
      pdf.text(barsStr, sumXs[1] + 2, y + sumRowH - 2, { align: "left" });
      pdf.text(`${plan.summary.totalWastePercent.toFixed(1)}%`, sumXs[2] + sumColWidths[2] / 2, y + sumRowH - 2, { align: "center" });
      pdf.text(`${utilization.toFixed(1)}%`, sumXs[3] + sumColWidths[3] / 2, y + sumRowH - 2, { align: "center" });

      totalBars += plan.summary.totalBars;
      totalWasteLength += plan.summary.totalWasteLength;
      totalDemandLength += plan.bars.reduce(
        (s: number, b: any) => s + b.pieces.reduce((ps: number, piece: any) => ps + piece.length, 0), 0,
      );

      y += sumRowH;
    }

    // Total row
    const totalWastePct = totalWasteLength > 0 ? (totalWasteLength / (totalDemandLength + totalWasteLength)) * 100 : 0;
    const totalUtil = 100 - totalWastePct;

    pdf.line(PAGE_MARGIN, y, sumXs[sumXs.length - 1], y);
    pdf.setFillColor(244, 244, 245);
    pdf.rect(PAGE_MARGIN, y, sumTotalWidth, sumRowH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Total", sumXs[0] + 2, y + sumRowH - 2, { align: "left" });
    pdf.text(String(totalBars), sumXs[1] + 2, y + sumRowH - 2, { align: "left" });
    pdf.text(`${totalWastePct.toFixed(1)}%`, sumXs[2] + sumColWidths[2] / 2, y + sumRowH - 2, { align: "center" });
    pdf.text(`${totalUtil.toFixed(1)}%`, sumXs[3] + sumColWidths[3] / 2, y + sumRowH - 2, { align: "center" });
    pdf.line(PAGE_MARGIN, y + sumRowH, sumXs[sumXs.length - 1], y + sumRowH);
    pdf.setFont("helvetica", "normal");

    y += sumRowH + 10;
  }

  // Piece pool tables
  if (includePiecePools && piecePoolGroups && opts) {
    for (const group of piecePoolGroups) {
      y = drawPiecePoolTable(pdf, group, opts, y);
    }
  }
}

/**
 * Draws a mini piece pool table for a specific profile type, filtered from the full group data.
 * Shows only pieces belonging to the given profileType.
 */
function drawMiniPiecePoolTable(
  pdf: any,
  groups: PiecePoolGroupData[],
  profileType: string,
  opts: ExportPDFOptions,
  colX: number,
  colWidth: number,
  startY: number,
  pageHeight: number,
): { y: number; rows: { sizeNum: number; count: number; avgW: string; avgH: string; locations: string[]; pieces: { label: string; length: number; quantity: number }[] }[] } {
  const bottomLimit = pageHeight - PAGE_MARGIN;
  let y = startY;

  // Collect all pieces for this profile type across all groups
  const rows: { sizeNum: number; count: number; avgW: string; avgH: string; locations: string[]; pieces: { label: string; length: number; quantity: number }[] }[] = [];

  for (const group of groups) {
    // Find the piece group matching this profile type
    const pg = group.pieceGroups.find((g) => g.profileType === profileType);
    if (!pg) continue;

    for (let si = 0; si < group.sizeGroups.length; si++) {
      const sg = group.sizeGroups[si];
      const allPieces = group.piecesBySize[si]?.pieces ?? [];
      // Filter pieces to only those in this profile type's indices
      const filteredPieces = pg.indices
        .map((idx) => allPieces[idx])
        .filter((p) => p != null)
        .map((p) => ({ label: p.label, length: p.length, quantity: p.quantity }));

      if (filteredPieces.length === 0) continue;

      rows.push({
        sizeNum: rows.length + 1,
        count: sg.count,
        avgW: sg.avgW,
        avgH: sg.avgH,
        locations: sg.locations,
        pieces: filteredPieces,
      });
    }
  }

  if (rows.length === 0) return { y, rows: [] };

  // Check space for header + at least one row
  if (y + 20 > bottomLimit) return { y, rows: [] };

  // Column layout — compact, with Locations as last column
  const fixedCols = [
    { label: "Size", w: 8 },
    { label: "Qty", w: 7 },
  ];
  const fixedTotal = fixedCols.reduce((s, c) => s + c.w, 0);
  const numPieceCols = rows[0]?.pieces.length ?? 0;
  const pieceColW = 12;
  const pieceTotal = numPieceCols * pieceColW;
  const locColW = colWidth - fixedTotal - pieceTotal;

  const colXs: number[] = [colX];
  const allWidths = [...fixedCols.map((c) => c.w), locColW, ...Array(numPieceCols).fill(pieceColW)];
  for (let i = 0; i < allWidths.length; i++) {
    colXs.push(colXs[i] + allWidths[i]);
  }

  const locColIndex = 2; // right after Qty
  const locsPerLine = Math.max(1, Math.floor(locColW / 11));
  const rh = 5;

  // Header row
  pdf.setFillColor(244, 244, 245);
  pdf.rect(colX, y, colXs[colXs.length - 1] - colX, rh, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(82, 82, 91);

  for (let i = 0; i < fixedCols.length; i++) {
    pdf.text(fixedCols[i].label, colXs[i] + allWidths[i] / 2, y + rh - 1.5, { align: "center" });
  }
  pdf.text("Locations", colXs[locColIndex] + 1, y + rh - 1.5, { align: "left" });
  for (let i = 0; i < numPieceCols; i++) {
    const piece = rows[0].pieces[i];
    pdf.text(`${piece.label}×${piece.quantity}`, colXs[3 + i] + allWidths[3 + i] / 2, y + rh - 1.5, { align: "center" });
  }

  // Header bottom border
  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.3);
  pdf.line(colX, y + rh, colXs[colXs.length - 1], y + rh);

  y += rh;

  // Data rows — dynamic height based on location count
  pdf.setFont("helvetica", "normal");
  for (const row of rows) {
    const locLines = Math.max(1, Math.ceil(row.locations.length / locsPerLine));
    const rowH = Math.max(rh, locLines * 4.5 + 1);

    if (y + rowH > bottomLimit) break;

    // Row separator line (top of this row)
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.2);
    pdf.line(colX, y, colXs[colXs.length - 1], y);

    const rowMidY = y + rowH / 2 + 1;
    const rowTopY = y + 3.5;

    pdf.setFontSize(6);
    pdf.setTextColor(82, 82, 91);

    pdf.text(`S${row.sizeNum}`, colXs[0] + allWidths[0] / 2, rowMidY, { align: "center" });
    pdf.text(String(row.count), colXs[1] + allWidths[1] / 2, rowMidY, { align: "center" });
    pdf.setFont("helvetica", "normal");

    for (let pi = 0; pi < row.pieces.length; pi++) {
      const cx = colXs[3 + pi] + allWidths[3 + pi] / 2;
      pdf.text(formatLength(row.pieces[pi].length, opts.unit, false), cx, rowMidY, { align: "center" });
    }

    // Locations — wrapped grid within the locations column
    const locCellW = locColW / locsPerLine;
    for (let li = 0; li < row.locations.length; li++) {
      const lineIdx = Math.floor(li / locsPerLine);
      const colInLine = li % locsPerLine;
      const lx = colXs[locColIndex] + colInLine * locCellW + locCellW / 2;
      const ly = y + 3 + lineIdx * 4.5;
      pdf.text(row.locations[li], lx, ly, { align: "center" });
    }

    y += rowH;

    // Subtotal row (muted)
    if (y + rh > bottomLimit) break;
    pdf.setFillColor(250, 250, 250);
    pdf.rect(colX, y, colXs[colXs.length - 1] - colX, rh, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5);
    pdf.setTextColor(161, 161, 170);

    for (let pi = 0; pi < row.pieces.length; pi++) {
      const cx = colXs[3 + pi] + allWidths[3 + pi] / 2;
      pdf.text(`×${row.count * row.pieces[pi].quantity}`, cx, y + rh / 2 + 1, { align: "center" });
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    y += rh;
  }

  // Bottom border after last row
  pdf.line(colX, y, colXs[colXs.length - 1], y);

  pdf.setFont("helvetica", "normal");
  y += 6;
  return { y, rows };
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
  const barEntryHeight = 8; // bar (6) + spacing (2)

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

  // Type name — colored bar
  pdf.setFillColor(244, 244, 245);
  pdf.rect(colX, y, colWidth, 8, "F");
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(9, 9, 11);
  const typeText = plan.profileTypeLabel.toUpperCase();
  pdf.text(typeText, colX + 2, y + 5.5);

  // Subtitle: materials + waste
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(113, 113, 122);
  const infoText = `${materialsStr} · ${plan.summary.totalWastePercent.toFixed(1)}% waste`;
  pdf.text(infoText, colX + 2, y + 12);

  y += 16;

  // Mini piece pool table for this profile type
  let poolRows: { sizeNum: number; count: number; avgW: string; avgH: string; locations: string[]; pieces: { label: string; length: number; quantity: number }[] }[] = [];
  if (opts.includeMiniPiecePools && opts.piecePoolGroups && opts.piecePoolGroups.length > 0) {
    const poolResult = drawMiniPiecePoolTable(pdf, opts.piecePoolGroups, plan.profileType, opts, colX, colWidth, y, pageHeight);
    y = poolResult.y;
    poolRows = poolResult.rows;
  }

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
    y += barHeight + 2;
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

  // Section header — colored bar with template name
  y = ensureSpace(pdf, y, 50);
  pdf.setFillColor(244, 244, 245);
  pdf.rect(PAGE_MARGIN, y, width - 2 * PAGE_MARGIN, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(9, 9, 11);
  pdf.text(`Piece Pool: ${groupInfo.pieceTemplateName}`, PAGE_MARGIN + 2, y + 5.5);
  pdf.setFont("helvetica", "normal");
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
  const headerRowHeight = 7;

  // ── Profile type group header row ──
  y = ensureSpace(pdf, y, headerRowHeight * 2 + rowHeight * sizeGroups.length * 2 + 10);

  // Top border line
  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.5);
  pdf.line(PAGE_MARGIN, y, colXs[colXs.length - 1], y);

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
      pdf.text(fixedHeaders[i], colXs[i] + 1, y + headerRowHeight - 2, { align: "left" });
    } else {
      pdf.text(fixedHeaders[i], cx, y + headerRowHeight - 2, { align: "center" });
    }
  }

  // Profile type group headers
  for (const pg of pieceGroups) {
    const startCol = 5 + pg.indices[0];
    const endCol = 5 + pg.indices[pg.indices.length - 1] + 1;
    const startX = colXs[startCol];
    const endX = colXs[endCol];
    const cx = (startX + endX) / 2;

    pdf.setFontSize(8);
    pdf.setTextColor(9, 9, 11);
    pdf.text(pg.label, cx, y + headerRowHeight - 2, { align: "center" });
  }

  // Bottom border for first header row
  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE_MARGIN, y + headerRowHeight, colXs[colXs.length - 1], y + headerRowHeight);

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
    pdf.text(`${piece.label}×${piece.quantity}`, cx, y + headerRowHeight - 2, { align: "center" });
  }

  y += headerRowHeight;

  // Bottom border for piece label header row
  pdf.setDrawColor(228, 228, 231);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE_MARGIN, y, colXs[colXs.length - 1], y);

  // ── Data rows (per size group) ──
  for (let si = 0; si < sizeGroups.length; si++) {
    const sg = sizeGroups[si];
    const pieces = piecesBySize[si]?.pieces ?? [];

    // Calculate dynamic row height based on location count (4 per line)
    const locsPerLine = 4;
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

    // Locations — wrapped in a grid (4 per line) like the web page
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

  pdf.setFont("helvetica", "normal");
  y += 8;
  return y;
}

export async function generateExportPDF(opts: ExportPDFOptions): Promise<any> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("l", "mm", "a4"); // landscape

  // Fetch logos at runtime from public directory
  const logos: { edge?: string; bunyan?: string } = {};
  try {
    const edgeResp = await fetch("/edge.png");
    if (edgeResp.ok) {
      const blob = await edgeResp.blob();
      logos.edge = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (_e) { /* optional */ }
  try {
    const bunyanResp = await fetch("/bunyan.png");
    if (bunyanResp.ok) {
      const blob = await bunyanResp.blob();
      logos.bunyan = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (_e) { /* optional */ }

  const includePiecePools = (opts.piecePoolGroups?.length ?? 0) > 0;

  // Cover page (includes summary table + piece pool tables)
  drawCoverPage(pdf, opts.projectName, opts.buildingName, opts.plans, includePiecePools, logos, opts.piecePoolGroups, opts);

  const { width, height } = getPageDimensions(pdf);

  // Plan sections — two plans per page (left + right column)
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
  const footerTitle = `${opts.projectName} — ${opts.buildingName}`;
  const footerSubtitle = opts.piecePoolGroups && opts.piecePoolGroups.length > 0
    ? opts.piecePoolGroups.map((g) => g.group.pieceTemplateName).join(", ")
    : "";
  addPageFooters(pdf, footerTitle, footerSubtitle);

  return pdf;
}
