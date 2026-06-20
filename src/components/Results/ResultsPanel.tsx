import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, ACTIONS } from '../../context/AppContext';
import { formatLength } from '../../engine/units';
import { validateMove } from '../../engine/optimizer';
import {
  CircleGaugeIcon, MaterialAndTextureIcon, PackageIcon, WasteIcon, DollarSignIcon,
  PrinterIcon, FileDownloadIcon, DragDropVerticalIcon, Recycle01Icon, Add01Icon, Delete02Icon, ListSettingIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { DndContext, DragOverlay, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button, buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup
} from '../ui/dropdown-menu';

function groupBars(bars: any[]) {
  const grouped: any[] = [];
  bars.forEach((bar) => {
    const pieceSignature = bar.pieces.map((p: any) => `${p.length}-${p.label}`).sort().join('|');
    const signature = `${bar.stockLengthId}-${bar.isRemnant}-${bar.stockLabel || ''}-${bar.waste}-${pieceSignature}`;

    const existing = grouped.find(g => g.signature === signature);
    if (existing) {
      existing.count++;
    } else {
      grouped.push({ ...bar, signature, count: 1 });
    }
  });
  return grouped;
}

export default function ResultsPanel() {
  const { state, dispatch, getColorForLength, getRGBForLength, getStockById } = useApp();
  const { cuttingPlan, isOptimized, settings, stockLengths } = state;
  const { unit, pricePerBar, kerfWidth } = settings;

  const [activeDragPiece, setActiveDragPiece] = useState(null);
  const [activeDragBar, setActiveDragBar] = useState(null);
  const [selectedEmptyStockId, setSelectedEmptyStockId] = useState('');
  const [isGroupedView, setIsGroupedView] = useState(true);
  const [sortByCount, setSortByCount] = useState(true);

  const activeEmptyStock = stockLengths.find((s: any) => s.id === selectedEmptyStockId) || stockLengths[0];

  if (!isOptimized || !cuttingPlan) {
    return (
      <Card className="w-full border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <HugeiconsIcon icon={MaterialAndTextureIcon} size={24} className="text-muted-foreground mb-3" />
          <CardTitle className="mb-1.5">No cutting plan yet</CardTitle>
          <CardDescription className="max-w-sm">
            Add your stock lengths and demand pieces, then click <strong>Optimize Cuts</strong> to generate an optimal cutting plan.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const { bars, summary } = cuttingPlan;
  const estimatedCost = pricePerBar > 0 ? summary.totalBars * pricePerBar : null;

  const generatePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = 0;

    // --- Header Section ---
    pdf.setFillColor(24, 24, 27); // Zinc 900
    pdf.rect(0, 0, pageWidth, 35, 'F');
    
    pdf.setFontSize(22);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Edgecut', margin, 18);
    
    pdf.setFontSize(11);
    pdf.setTextColor(161, 161, 170); // Zinc 400
    pdf.text('Optimized Cutting Plan', margin, 26);
    
    // Summary Stats
    pdf.setFontSize(10);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 18, { align: 'right' });
    pdf.text(`Utilization: ${(100 - summary.totalWastePercent).toFixed(1)}%`, pageWidth - margin, 26, { align: 'right' });
    
    currentY = 48;

    // --- Required Materials ---
    if (Object.keys(summary.barsBreakdown).length > 0) {
      pdf.setFontSize(14);
      pdf.setTextColor(9, 9, 11); // Zinc 950
      pdf.text('Required Materials', margin, currentY);
      currentY += 8;
      
      pdf.setFontSize(10);
      Object.entries(summary.barsBreakdown).forEach(([stockId, count]: any) => {
        const stock = getStockById(stockId);
        const stockLabel = stock?.label || stockId;
        pdf.setTextColor(82, 82, 91); // Zinc 500
        pdf.text(`• ${count}×  ${stockLabel}  (${formatLength(stock?.length || 0, unit)})`, margin + 2, currentY);
        currentY += 6;
      });
      currentY += 6;
    }

    pdf.setDrawColor(228, 228, 231); // Zinc 200
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 12;

    // --- Cutting Diagrams ---
    pdf.setFontSize(14);
    pdf.setTextColor(9, 9, 11);
    pdf.text('Cutting Instructions', margin, currentY);
    currentY += 12;

    const barsToPrint = groupBars(bars);
    if (sortByCount) {
      barsToPrint.sort((a: any, b: any) => b.count - a.count);
    }
    let pdfBarCount = 0;
    let pdfRemnantCount = 0;

    barsToPrint.forEach((bar: any) => {
      if (bar.pieces.length === 0) return;

      const displayIndex = bar.isRemnant ? pdfRemnantCount++ : pdfBarCount++;

      if (currentY + 28 > pageHeight - margin) {
        pdf.addPage();
        currentY = margin + 5;
      }

      const barWidth = pageWidth - (margin * 2);
      const barHeight = 8;

      // Bar Header
      pdf.setFontSize(10);
      pdf.setTextColor(9, 9, 11);
      const title = `${bar.count > 1 ? `${bar.count}× ` : ''}${bar.stockLabel || `${bar.isRemnant ? 'Remnant' : 'Bar'} ${displayIndex + 1}`}`;
      pdf.text(title, margin, currentY);
      
      // Bar Details
      pdf.setFontSize(9);
      pdf.setTextColor(113, 113, 122); // Zinc 500
      pdf.text(`${formatLength(bar.stockLength, unit)} | Waste: ${bar.wastePercent.toFixed(1)}%`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 5;

      // Draw Waste Area
      pdf.setDrawColor(228, 228, 231);
      pdf.setFillColor(244, 244, 245);
      pdf.rect(margin, currentY, barWidth, barHeight, 'FD');

      // Draw Pieces
      bar.pieces.forEach((piece: any) => {
        const xOffset = margin + (piece.offset / bar.stockLength) * barWidth;
        const pieceW = (piece.length / bar.stockLength) * barWidth;

        const rgb = getRGBForLength(piece.length);
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(0.5);
        pdf.rect(xOffset, currentY, pieceW, barHeight, 'FD');

        if (pieceW > 10) {
          pdf.setTextColor(255, 255, 255);
          const textX = xOffset + (pieceW / 2);
          const textY = currentY + (barHeight / 2);
          
          if (pieceW > 20) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text(piece.label, textX, textY - 1.2, { align: 'center', baseline: 'middle' });
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            pdf.text(formatLength(piece.length, unit, false), textX, textY + 2.2, { align: 'center', baseline: 'middle' });
          } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            pdf.text(formatLength(piece.length, unit, false), textX, textY, { align: 'center', baseline: 'middle' });
          }
        }
      });

      // Draw Waste Text
      if (bar.waste > 0) {
        const wasteW = (bar.waste / bar.stockLength) * barWidth;
        const wasteX = margin + barWidth - wasteW;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(220, 38, 38); // Tailwind red-600
        
        if (wasteW > 12) {
          pdf.text(formatLength(bar.waste, unit, false), wasteX + (wasteW / 2), currentY + (barHeight / 2), { align: 'center', baseline: 'middle' });
        } else {
          pdf.text(formatLength(bar.waste, unit, false), wasteX + wasteW + 1.5, currentY + (barHeight / 2), { align: 'left', baseline: 'middle' });
        }
      }
      
      pdf.setFont('helvetica', 'normal');
      currentY += barHeight + 8;
    });

    // Add page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(161, 161, 170);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    return pdf;
  };

  const handlePrint = async () => {
    try {
      const pdf = await generatePDF();
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    } catch (err) {
      console.error('Print generation failed:', err);
    }
  };

  const handlePDF = async () => {
    try {
      const pdf = await generatePDF();
      pdf.save('cutting-plan.pdf');
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const handleClear = () => {
    dispatch({ type: ACTIONS.CLEAR_PLAN });
  };

  const handleAddEmptyBar = () => {
    if (!activeEmptyStock) return;
    dispatch({ type: ACTIONS.ADD_EMPTY_BAR, payload: { stockLengthId: activeEmptyStock.id } });
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const { piece, bar } = active.data.current;
    setActiveDragPiece(piece);
    setActiveDragBar(bar);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveDragPiece(null);
    setActiveDragBar(null);

    if (!over) return;

    const fromBarId = active.data.current.bar.id;
    const { piece: sourcePiece } = active.data.current;

    const isSwap = over.data.current?.type === 'piece';

    if (isSwap) {
      const targetPiece = over.data.current.piece;
      const toBarId = over.data.current.bar.id;

      if (sourcePiece.pieceId === targetPiece.pieceId && sourcePiece.instanceIndex === targetPiece.instanceIndex) return;

      dispatch({
        type: ACTIONS.SWAP_PIECES,
        payload: {
          pieceAId: sourcePiece.pieceId,
          instanceAIndex: sourcePiece.instanceIndex,
          barAId: fromBarId,
          pieceBId: targetPiece.pieceId,
          instanceBIndex: targetPiece.instanceIndex,
          barBId: toBarId
        }
      });
    } else {
      const toBarId = over.id;
      if (fromBarId === toBarId) return;

      const targetBar = cuttingPlan.bars.find((b: any) => b.id === toBarId);
      if (!targetBar) return;

      const check = validateMove(targetBar, sourcePiece, kerfWidth);
      if (check.valid) {
        dispatch({
          type: ACTIONS.MOVE_PIECE,
          payload: {
            pieceId: sourcePiece.pieceId,
            instanceIndex: sourcePiece.instanceIndex,
            fromBarId,
            toBarId
          }
        });
      } else {
        console.warn('Move invalid:', check.reason);
      }
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="space-y-3">
        {/* Summary Stats */}
        <div className={`grid grid-cols-2 ${estimatedCost !== null ? 'md:grid-cols-4' : 'md:grid-cols-3'} rounded-lg bg-card ring-1 ring-foreground/10 divide-x divide-y md:divide-y-0 overflow-hidden`}>
          <StatItem
            icon={<HugeiconsIcon icon={PackageIcon} size={13} className="text-blue-500 dark:text-blue-400" />}
            label="Total Bars"
            value={summary.totalBars}
          />
          <StatItem
            icon={<HugeiconsIcon icon={WasteIcon} size={13} className="text-orange-500 dark:text-orange-400" />}
            label="Total Waste"
            value={`${summary.totalWastePercent.toFixed(1)}%`}
            sub={formatLength(summary.totalWasteLength, unit)}
            valueClass={
              summary.totalWastePercent < 10 ? 'text-green-600 dark:text-green-500'
                : summary.totalWastePercent > 30 ? 'text-destructive'
                  : 'text-yellow-600 dark:text-yellow-500'
            }
          />
          {estimatedCost !== null && (
            <StatItem
              icon={<HugeiconsIcon icon={DollarSignIcon} size={13} className="text-amber-500 dark:text-amber-400" />}
              label="Est. Cost"
              value={`$${estimatedCost.toFixed(2)}`}
            />
          )}
          <StatItem
            icon={<HugeiconsIcon icon={CircleGaugeIcon} size={13} className="text-emerald-500 dark:text-emerald-400" />}
            label="Utilization"
            value={`${(100 - summary.totalWastePercent).toFixed(1)}%`}
          />
        </div>

        {/* Stock Breakdown & View Toggles */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(summary.barsBreakdown).length > 0 && (
              <>
                <span className="text-[11px] font-medium text-muted-foreground">Stock</span>
                {Object.entries(summary.barsBreakdown).map(([stockId, count]: any) => {
                  const stock = getStockById(stockId);
                  return (
                    <Badge key={stockId} variant="secondary" className="font-normal">
                      {stock?.label || stockId} <span className="ml-1 tabular-nums text-muted-foreground">×{count}</span>
                    </Badge>
                  );
                })}
              </>
            )}
          </div>

          <div className="flex items-center gap-1 no-print px-1 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 text-xs px-2 gap-1.5 text-muted-foreground" })}>
                <HugeiconsIcon icon={ListSettingIcon} size={13} />
                View Options
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs" inset={false}>Layout preferences</DropdownMenuLabel>
                  <DropdownMenuSeparator className="" />
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGroupedView(!isGroupedView);
                    }}
                  >
                    <Checkbox checked={isGroupedView} className="pointer-events-none" />
                    <span className="text-xs font-normal select-none">Group identical bars</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${!isGroupedView ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isGroupedView) setSortByCount(!sortByCount);
                    }}
                  >
                    <Checkbox checked={sortByCount} disabled={!isGroupedView} className="pointer-events-none" />
                    <span className="text-xs font-normal select-none">Sort by group count</span>
                  </div>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Cutting Diagram */}
        <Card id="cutting-plan-printable">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-1.5">
              <HugeiconsIcon icon={MaterialAndTextureIcon} size={14} /> Cutting Plan
            </CardTitle>
            <div className="flex items-center gap-1 no-print">
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleClear} title="Clear Plan">
                <HugeiconsIcon icon={Delete02Icon} size={13} /> Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePrint} title="Print">
                <HugeiconsIcon icon={PrinterIcon} size={13} /> Print
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePDF} title="Export PDF">
                <HugeiconsIcon icon={FileDownloadIcon} size={13} /> PDF
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-2">
            {(() => {
              const displayBars = isGroupedView ? groupBars(bars) : bars.map((b: any) => ({ ...b, count: 1 }));
              if (isGroupedView && sortByCount) {
                displayBars.sort((a: any, b: any) => b.count - a.count);
              }
              let displayBarCount = 0;
              let displayRemnantCount = 0;
              return displayBars.map((bar: any) => {
                const displayIndex = bar.isRemnant ? displayRemnantCount++ : displayBarCount++;
                return (
                  <BarVisualization
                    key={isGroupedView ? bar.signature : bar.id}
                    bar={bar}
                    index={displayIndex}
                    count={bar.count}
                    disableDnd={isGroupedView}
                    unit={unit}
                    getColorForLength={getColorForLength}
                    dispatch={dispatch}
                    kerfWidth={kerfWidth}
                  />
                );
              });
            })()}

            <div className="no-print flex gap-2 items-center pt-2">
              {stockLengths.length > 1 && (
                <Select value={activeEmptyStock?.id || ''} onValueChange={(val: string | null) => setSelectedEmptyStockId(val || '')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select stock length...">
                      {activeEmptyStock
                        ? `${activeEmptyStock.label} (${formatLength(activeEmptyStock.length, unit)})`
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stockLengths.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.label} ({formatLength(s.length, unit)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                className="flex-1 border-dashed text-muted-foreground hover:text-foreground"
                onClick={handleAddEmptyBar}
                title="Add an empty bar to use as a temporary workspace"
              >
                <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" /> Empty Bar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {createPortal(
        <DragOverlay zIndex={1000}>
          {activeDragPiece && activeDragBar ? (
            <DragPieceOverlay
              piece={activeDragPiece}
              bar={activeDragBar}
              unit={unit}
              getColorForLength={getColorForLength}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

function StatItem({ icon, label, value, sub, valueClass }: any) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-semibold tabular-nums tracking-tight ${valueClass || 'text-foreground'}`}>{value}</span>
        {sub && <span className="text-[11px] tabular-nums text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function BarVisualization({ bar, index, count, disableDnd, unit, getColorForLength, dispatch, kerfWidth }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: bar.id,
    data: { bar, type: 'bar' },
    disabled: disableDnd
  });

  const wastePercent = bar.wastePercent;
  const isEmpty = bar.pieces.length === 0;

  const groupedPieces: any[] = [];
  bar.pieces.forEach((p: any) => {
    const existing = groupedPieces.find((g: any) => g.length === p.length && g.label === p.label);
    if (existing) {
      existing.count++;
    } else {
      groupedPieces.push({ ...p, count: 1 });
    }
  });

  const handleRemoveBar = () => {
    dispatch({ type: ACTIONS.REMOVE_BAR, payload: { barId: bar.id } });
  };

  const wasteColor = wastePercent < 10 ? 'text-green-600 dark:text-green-500'
    : wastePercent > 30 ? 'text-destructive'
      : 'text-yellow-600 dark:text-yellow-500';

  return (
    <div
      className={`rounded-md border overflow-hidden ${isOver ? 'border-primary ring-1 ring-primary/30' : ''} ${isEmpty ? 'no-print border-dashed' : 'print-avoid-break'}`}
      data-html2canvas-ignore={isEmpty ? "true" : "false"}
    >
      {/* Bar Header */}
      <div className="flex items-center gap-2 px-2 py-1 border-b">
        <span className="text-[11px] font-medium flex items-center gap-1.5">
          {count > 1 && <Badge variant="default" className="h-4 px-1 text-[9px] pointer-events-none">{count}×</Badge>}
          {bar.isRemnant && <HugeiconsIcon icon={Recycle01Icon} size={11} className="text-muted-foreground" />}
          {bar.stockLabel || `${bar.isRemnant ? 'Remnant' : 'Bar'} ${index + 1}`}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
          {formatLength(bar.stockLength, unit)}
        </span>
        {isEmpty ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="no-print text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleRemoveBar}
            title="Remove empty bar"
          >
            <HugeiconsIcon icon={Delete02Icon} size={13} />
          </Button>
        ) : (
          <span className={`text-[10px] tabular-nums ${wasteColor}`}>
            {wastePercent.toFixed(1)}% waste
          </span>
        )}
      </div>

      {/* Visual bar */}
      <div
        className={`relative h-8 mx-2 my-1.5 rounded-xs bg-muted ring-1 ring-inset ring-foreground/7 overflow-hidden ${isOver ? 'bg-primary/5' : ''}`}
        style={!isOver ? {
          backgroundImage: 'repeating-linear-gradient(-45deg, color-mix(in oklch, var(--muted-foreground) 5%, transparent) 0 5px, transparent 5px 10px)',
        } : undefined}
        ref={setNodeRef}
      >
        {bar.pieces.map((piece: any) => (
          <DraggablePiece
            key={`${piece.pieceId}-${piece.instanceIndex}`}
            piece={piece}
            bar={bar}
            unit={unit}
            getColorForLength={getColorForLength}
            disabled={disableDnd}
          />
        ))}

        {/* Saw cut lines (kerf) */}
        {bar.pieces.map((piece: any, i: number) => {
          const kerfOffsetPercent = ((piece.offset + piece.length) / bar.stockLength) * 100;
          const kerfWidthPercent = (kerfWidth / bar.stockLength) * 100;
          if (kerfWidth <= 0 || kerfOffsetPercent >= 100) return null;
          return (
            <div
              key={`kerf-${i}`}
              className="absolute top-0 h-full bg-foreground/10 z-[3]"
              style={{
                left: `${kerfOffsetPercent}%`,
                width: `${Math.max(kerfWidthPercent, 0.2)}%`,
              }}
              title={`Saw cut — kerf: ${formatLength(kerfWidth, unit)}`}
            />
          );
        })}

        {/* Waste area */}
        {bar.waste > 0 && (
          <div
            className="absolute top-0 h-full flex items-center justify-center"
            style={{
              left: `${(bar.usedLength / bar.stockLength) * 100}%`,
              width: `${wastePercent}%`,
              background: 'repeating-linear-gradient(45deg, hsl(var(--destructive) / 0.08), hsl(var(--destructive) / 0.08) 4px, hsl(var(--destructive) / 0.15) 4px, hsl(var(--destructive) / 0.15) 8px)',
            }}
            title={`Waste: ${formatLength(bar.waste, unit)}`}
          >
            <span className="text-[10px] font-mono font-semibold text-destructive whitespace-nowrap">
              {formatLength(bar.waste, unit, false)}
            </span>
          </div>
        )}
      </div>

      {/* Piece details */}
      {groupedPieces.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 border-t">
          {groupedPieces.map((group: any, idx: number) => {
            const color = getColorForLength(group.length);
            return (
              <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                <div
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: color }}
                />
                <span className="text-foreground">
                  {group.count} × {group.label}
                </span>
                <span className="text-muted-foreground tabular-nums">{formatLength(group.length, unit)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraggablePiece({ piece, bar, unit, getColorForLength, disabled }: any) {
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, isDragging } = useDraggable({
    id: `${piece.pieceId}-${piece.instanceIndex}`,
    data: { piece, bar, type: 'piece' },
    disabled
  });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `${piece.pieceId}-${piece.instanceIndex}-drop`,
    data: { piece, bar, type: 'piece' },
    disabled
  });

  const setNodeRef = (node: any) => {
    setDraggableNodeRef(node);
    setDroppableNodeRef(node);
  };

  const color = getColorForLength(piece.length);
  const widthPercent = (piece.length / bar.stockLength) * 100;
  const offsetPercent = (piece.offset / bar.stockLength) * 100;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-0 h-full flex flex-col items-center justify-center text-white overflow-hidden min-w-[3px] transition-all duration-100 ring-1 ring-inset ring-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.12)] ${disabled ? '' : 'cursor-pointer hover:brightness-110 hover:z-[4]'} ${isDragging ? 'opacity-20 grayscale-[50%]' : ''} ${isOver ? 'ring-2 ring-primary z-[5] brightness-110' : ''}`}
      style={{
        left: `${offsetPercent}%`,
        width: `${widthPercent}%`,
        backgroundColor: color,
        opacity: isDragging ? 0.2 : 1,
      }}
      title={`${piece.label} — ${formatLength(piece.length, unit)}${!disabled ? ' (drag to move)' : ''}`}
    >
      <span className="text-[9px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center px-0.5 leading-tight">
        {piece.label}
      </span>
      <span className="text-[8px] opacity-90 whitespace-nowrap tabular-nums">
        {formatLength(piece.length, unit, false)}
      </span>

      {/* Drag handle overlay */}
      {!disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <HugeiconsIcon icon={DragDropVerticalIcon} size={12} className="text-white opacity-80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
        </div>
      )}
    </div>
  );
}

function DragPieceOverlay({ piece, unit, getColorForLength }: any) {
  const color = getColorForLength(piece.length);

  return (
    <div
      className="rounded-[3px] flex flex-col items-center justify-center text-white border border-black/15 shadow-xl rotate-2 scale-[1.02]"
      style={{
        width: '140px',
        height: '48px',
        position: 'relative',
        backgroundColor: color,
      }}
    >
      <span className="text-[10px] font-semibold whitespace-nowrap">{piece.label}</span>
      <span className="text-[9px] opacity-90 font-mono">{formatLength(piece.length, unit, false)}</span>
      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
        <HugeiconsIcon icon={DragDropVerticalIcon} size={12} className="text-white opacity-80" />
      </div>
    </div>
  );
}
