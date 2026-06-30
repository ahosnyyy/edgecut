// @ts-nocheck
/**
 * 1D Cutting Stock Optimizer — BFD + Local Search (v2)
 *
 * Solves the 1D Cutting Stock Problem using a two-phase approach:
 *
 *   Phase 1: Best Fit Decreasing (BFD)
 *     - Sort pieces descending by length
 *     - Place each piece in the bin where it leaves the LEAST remaining space
 *     - Respects locked assignments and prefers remnant stock
 *
 *   Kerf model: every piece consumes (length + kerf) of bar material.
 *   Physically, each piece is separated by a saw cut, including the last
 *   piece which is cut from the remaining waste.
 *
 *   Phase 2: Local Search improvement loop
 *     Priority order of moves:
 *     1. Bar elimination  — redistribute all pieces from the most wasteful bar
 *     2. Compound swap    — trade 1 piece for N pieces between two bars (1-for-N)
 *     3. Relocate         — move a single piece to another bar
 *     4. Simple swap      — 1-for-1 piece exchange between bars
 *
 *   Objective hierarchy:
 *     1. Minimize bar count (primary)
 *     2. Minimize total waste (secondary — usually fixed for same bar count)
 *     3. Maximize utilization concentration (tertiary — prefers tightly-packed bars
 *        over evenly-distributed waste, making remnants larger and more useful)
 *
 * All lengths are in millimeters (internal representation).
 */

let _barIdCounter = 0;

function nextBarId() {
  return `bar-${++_barIdCounter}`;
}

/**
 * Reset the bar ID counter (useful for testing).
 */
export function resetBarIdCounter() {
  _barIdCounter = 0;
}

// ─── Utility Helpers ─────────────────────────────────────────────

/**
 * Expand demand pieces by quantity into a flat list of individual cuts.
 */
function expandPieces(demandPieces) {
  const expanded = [];
  for (const piece of demandPieces) {
    for (let i = 0; i < piece.quantity; i++) {
      expanded.push({
        pieceId: piece.id,
        instanceIndex: i,
        length: piece.length,
        label: piece.label,
        groupId: piece.groupId || null,
      });
    }
  }
  return expanded;
}

/**
 * Sort stock lengths by priority:
 * 1. Remnants first (use up leftovers)
 * 2. Then by length based on strategy ('asc' = smallest first, 'desc' = largest first)
 */
function sortStockByPriority(stockLengths, strategy = 'asc') {
  return [...stockLengths].sort((a, b) => {
    if (a.isRemnant && !b.isRemnant) return -1;
    if (!a.isRemnant && b.isRemnant) return 1;
    return strategy === 'asc' ? a.length - b.length : b.length - a.length;
  });
}

/**
 * Open a new bar from available stock (mutates stock quantities).
 */
function openNewBar(sortedStock, minRequired) {
  for (const stock of sortedStock) {
    if (stock.length >= minRequired && (stock.quantity === Infinity || stock.quantity > 0)) {
      if (stock.quantity !== Infinity) stock.quantity--;
      return {
        id: nextBarId(),
        stockLengthId: stock.id,
        stockLength: stock.length,
        isRemnant: stock.isRemnant || false,
        stockLabel: stock.label || '',
        pieces: [],
        usedLength: 0,
        waste: stock.length,
        wastePercent: 100,
      };
    }
  }
  return null;
}

/**
 * Remaining usable length of a bar.
 */
function remainingLength(bar) {
  return bar.stockLength - bar.usedLength;
}

/**
 * How much bar material a piece consumes: piece_length + kerf.
 * Every piece requires a cut (kerf) to separate it from the remaining bar.
 */
function spaceNeeded(pieceLength, kerfWidth) {
  return pieceLength + kerfWidth;
}

/**
 * Check if a piece fits in a bar.
 */
function pieceFits(bar, pieceLength, kerfWidth) {
  return remainingLength(bar) >= spaceNeeded(pieceLength, kerfWidth);
}

/**
 * Place a piece at the end of a bar (mutates the bar).
 * Layout: |piece|kerf|piece|kerf|...|piece|kerf|waste|
 */
function placePiece(bar, piece, kerfWidth) {
  const offset = bar.usedLength;
  const placedPiece = { ...piece, offset };
  bar.pieces.push(placedPiece);
  bar.usedLength = offset + piece.length + kerfWidth;
  bar.waste = bar.stockLength - bar.usedLength;
  bar.wastePercent = (bar.waste / bar.stockLength) * 100;
  return placedPiece;
}

/**
 * Rebuild a bar's offsets and waste from its pieces array (mutates).
 */
function rebuildBar(bar, kerfWidth) {
  bar.usedLength = 0;
  for (let i = 0; i < bar.pieces.length; i++) {
    const offset = bar.usedLength;
    bar.pieces[i] = { ...bar.pieces[i], offset };
    bar.usedLength = offset + bar.pieces[i].length + kerfWidth;
  }
  bar.waste = bar.stockLength - bar.usedLength;
  bar.wastePercent = bar.stockLength > 0 ? (bar.waste / bar.stockLength) * 100 : 0;
}

/**
 * Deep-clone a bar.
 */
function cloneBar(bar) {
  return {
    ...bar,
    pieces: bar.pieces.map(p => ({ ...p })),
  };
}

/**
 * Total number of bars.
 */
function totalBarCount(bars) {
  return bars.length;
}

/**
 * Utilization concentration score: sum of (utilization²) per bar.
 * Higher = better — rewards solutions where most bars are tightly packed
 * and waste is concentrated in fewer bars (making remnants larger/more useful).
 *
 * Example: bars with utilization [99%, 97%, 35%] score higher than
 *          bars with utilization [94%, 92%, 76%] even though total waste is the same.
 */
function utilizationScore(bars) {
  let score = 0;
  for (const bar of bars) {
    if (bar.stockLength > 0) {
      const util = bar.usedLength / bar.stockLength;
      score += util * util;
    }
  }
  return score;
}


// ─── Solution Comparison ─────────────────────────────────────────

/**
 * Check if solution A is strictly better than solution B.
 *
 * Objective hierarchy:
 *   1. Fewer standard (non-remnant) bars (primary — directly reduces new material cost)
 *   2. Less total standard stock length used (prefer shorter standard bars if available)
 *   3. Maximize total length of pieces packed into remnants (forces pieces into scraps)
 *   4. Higher utilization score (concentrates waste, packs bars tightly)
 *   5. Fewer total bars (fallback — less total material pieces to handle)
 */
function isBetter(barsA, barsB, strategy = 'maximize_large_bars') {
  // 1. Minimize Standard (non-remnant) bar count
  const stdCountA = barsA.filter(b => !b.isRemnant).length;
  const stdCountB = barsB.filter(b => !b.isRemnant).length;
  if (stdCountA < stdCountB) return true;
  if (stdCountA > stdCountB) return false;

  // 2. Minimize total Standard stock length used
  const stdLenA = barsA.reduce((sum, b) => b.isRemnant ? sum : sum + b.stockLength, 0);
  const stdLenB = barsB.reduce((sum, b) => b.isRemnant ? sum : sum + b.stockLength, 0);
  if (stdLenA < stdLenB - 0.01) return true;
  if (stdLenA > stdLenB + 0.01) return false;

  // 3. Maximize total length of pieces packed into remnants
  const remUsedA = barsA.reduce((sum, b) => b.isRemnant ? sum + b.usedLength : sum, 0);
  const remUsedB = barsB.reduce((sum, b) => b.isRemnant ? sum + b.usedLength : sum, 0);
  if (remUsedA > remUsedB + 0.01) return true;
  if (remUsedA < remUsedB - 0.01) return false;

  // 4. Maximize utilization score (concentrates waste)
  let utilA, utilB;
  if (strategy === 'maximize_large_bars') {
    // Squaring absolute length strongly rewards filling the largest possible bars
    utilA = barsA.reduce((sum, b) => sum + (b.usedLength * b.usedLength), 0);
    utilB = barsB.reduce((sum, b) => sum + (b.usedLength * b.usedLength), 0);
  } else {
    // Default 'balanced': Squaring percentage rewards filling the smallest possible bars
    utilA = utilizationScore(barsA);
    utilB = utilizationScore(barsB);
  }

  if (utilA > utilB + 0.0001) return true;
  if (utilA < utilB - 0.0001) return false;

  // 5. Minimize total bar count
  const countA = totalBarCount(barsA);
  const countB = totalBarCount(barsB);
  if (countA < countB) return true;
  if (countA > countB) return false;

  return false;
}


// ─── Phase 1: Best Fit Decreasing (BFD) ─────────────────────────

/**
 * BFD placement: for a given piece, find the bar where it fits with the
 * LEAST remaining space after placement (tightest fit).
 * Prefers remnant bars over standard bars when remaining space is similar.
 */
function bestFitBar(bars, pieceLength, kerfWidth) {
  let bestIdx = -1;
  let bestRemaining = Infinity;
  let bestIsRemnant = false;

  for (let i = 0; i < bars.length; i++) {
    if (pieceFits(bars[i], pieceLength, kerfWidth)) {
      const remaining = remainingLength(bars[i]) - spaceNeeded(pieceLength, kerfWidth);
      const isRemnant = bars[i].isRemnant || false;

      // Prefer this bar if:
      // 1. It has a tighter fit, OR
      // 2. Same fit but this is a remnant and current best is not
      if (remaining < bestRemaining || (Math.abs(remaining - bestRemaining) < 0.01 && isRemnant && !bestIsRemnant)) {
        bestRemaining = remaining;
        bestIdx = i;
        bestIsRemnant = isRemnant;
      }
    }
  }
  return bestIdx;
}

/**
 * Run BFD to produce the initial solution.
 */
function runBFD(pieces, sortedStock, kerfWidth, preLockBars) {
  const bars = preLockBars.map(cloneBar);
  const unplaced = [];

  // Sort descending by length (the "Decreasing" in BFD)
  const sorted = [...pieces].sort((a, b) => b.length - a.length);

  for (const piece of sorted) {
    const bestIdx = bestFitBar(bars, piece.length, kerfWidth);

    if (bestIdx >= 0) {
      placePiece(bars[bestIdx], piece, kerfWidth);
    } else {
      const newBar = openNewBar(sortedStock, piece.length);
      if (newBar) {
        placePiece(newBar, piece, kerfWidth);
        bars.push(newBar);
      } else {
        unplaced.push(piece);
      }
    }
  }

  return { bars, unplaced };
}


// ─── Phase 2: Local Search ───────────────────────────────────────

/**
 * Move 1: Try to eliminate the bar with the most waste by redistributing
 * all its unlocked pieces into other bars.
 */
function tryEliminateWorstBar(bars, kerfWidth, strategy) {
  const indices = bars.map((_, i) => i);
  indices.sort((a, b) => bars[b].waste - bars[a].waste);

  for (const targetIdx of indices) {
    const targetBar = bars[targetIdx];
    const unlockedPieces = targetBar.pieces;
    if (unlockedPieces.length === 0) continue;

    const otherBars = bars
      .filter((_, i) => i !== targetIdx)
      .map(cloneBar);

    let allPlaced = true;
    const piecesToPlace = [...unlockedPieces].sort((a, b) => b.length - a.length);

    for (const piece of piecesToPlace) {
      const bestIdx = bestFitBar(otherBars, piece.length, kerfWidth);
      if (bestIdx >= 0) {
        placePiece(otherBars[bestIdx], piece, kerfWidth);
      } else {
        allPlaced = false;
        break;
      }
    }

    if (allPlaced && isBetter(otherBars, bars, strategy)) {
      return otherBars;
    }
  }

  return null;
}

/**
 * Choose the subset of `items` that fills `capacity` as fully as possible
 * without exceeding it (0/1 subset-sum, maximizing used length+kerf).
 *
 * This replaces a greedy largest-first fill, which can miss better-packing
 * combinations (e.g. picking one 720 over two 500s in a 1010 remnant).
 *
 * Weights are rounded to integer millimetres for a bounded DP; any sub-mm
 * rounding slack is caught later by the caller's waste validation.
 */
function bestFillSubset(items, capacity, kerfWidth) {
  const n = items.length;
  const cap = Math.max(0, Math.floor(capacity + 1e-6));
  if (n === 0 || cap === 0) return [];

  const weights = items.map(it => Math.max(1, Math.round(it.length + kerfWidth)));
  const take = [];
  let dp = new Int32Array(cap + 1); // dp[j] = best fill achievable with capacity j

  for (let i = 0; i < n; i++) {
    const row = new Uint8Array(cap + 1);
    const ndp = new Int32Array(cap + 1);
    const w = weights[i];
    for (let j = 0; j <= cap; j++) {
      let best = dp[j]; // option: skip item i
      if (w <= j) {
        const withItem = dp[j - w] + w;
        if (withItem > best) {
          best = withItem;
          row[j] = 1; // option: take item i
        }
      }
      ndp[j] = best;
    }
    dp = ndp;
    take.push(row);
  }

  // Reconstruct chosen items
  const chosen = [];
  let j = cap;
  for (let i = n - 1; i >= 0; i--) {
    if (take[i][j]) {
      chosen.push(items[i]);
      j -= weights[i];
    }
  }
  return chosen;
}

/**
 * Move 2: Compound swap — remove one piece from bar A, then fill the freed
 * space with multiple pieces from bar B. This finds 1-for-N trades that
 * single swaps miss.
 *
 * Example: trading one 700mm piece for two 500mm pieces (1-for-2).
 */
function tryCompoundSwap(bars, kerfWidth, strategy) {
  for (let srcIdx = 0; srcIdx < bars.length; srcIdx++) {
    const srcBar = bars[srcIdx];

    for (let pIdx = 0; pIdx < srcBar.pieces.length; pIdx++) {
      const pieceOut = srcBar.pieces[pIdx];


      for (let dstIdx = 0; dstIdx < bars.length; dstIdx++) {
        if (dstIdx === srcIdx) continue;
        const dstBar = bars[dstIdx];

        // pieceOut must fit in dstBar
        if (!pieceFits(dstBar, pieceOut.length, kerfWidth)) continue;

        // Calculate freed space in srcBar after removing pieceOut
        const tempSrcPieces = srcBar.pieces.filter((_, i) => i !== pIdx);
        let tempUsed = 0;
        for (let i = 0; i < tempSrcPieces.length; i++) {
          tempUsed += tempSrcPieces[i].length + kerfWidth;
        }
        const freeSpace = srcBar.stockLength - tempUsed;

        // Choose the subset of dstBar pieces that best fills the freed space.
        const piecesIn = bestFillSubset(dstBar.pieces, freeSpace, kerfWidth);

        // Must move at least 1 piece in (otherwise it's just a relocate)
        if (piecesIn.length === 0) continue;
        // Skip trivial 1-for-1 same-length (handled by trySwap)
        if (piecesIn.length === 1 && Math.abs(piecesIn[0].length - pieceOut.length) < 0.01) continue;

        // Build new solution
        const newBars = bars.map(cloneBar);

        // Remove pieceOut from src
        newBars[srcIdx].pieces = newBars[srcIdx].pieces.filter(
          p => !(p.pieceId === pieceOut.pieceId && p.instanceIndex === pieceOut.instanceIndex)
        );

        // Remove piecesIn from dst
        for (const pIn of piecesIn) {
          newBars[dstIdx].pieces = newBars[dstIdx].pieces.filter(
            p => !(p.pieceId === pIn.pieceId && p.instanceIndex === pIn.instanceIndex)
          );
        }

        // Add pieceOut to dst
        newBars[dstIdx].pieces.push({ ...pieceOut });

        // Add piecesIn to src
        for (const pIn of piecesIn) {
          newBars[srcIdx].pieces.push({ ...pIn });
        }

        // Rebuild both bars
        rebuildBar(newBars[srcIdx], kerfWidth);
        rebuildBar(newBars[dstIdx], kerfWidth);

        // Validate (waste must be non-negative)
        if (newBars[srcIdx].waste < -0.01 || newBars[dstIdx].waste < -0.01) continue;

        const filtered = newBars.filter(b => b.pieces.length > 0);

        if (isBetter(filtered, bars, strategy)) {
          return filtered;
        }
      }
    }
  }

  return null;
}

/**
 * Helper to dynamically calculate available stock based on the current solution bars.
 */
function getAvailableStock(bars, stockLengths) {
  const available = stockLengths.map(s => ({ ...s }));
  for (const bar of bars) {
    const stock = available.find(s => s.id === bar.stockLengthId);
    if (stock && stock.quantity !== Infinity) {
      stock.quantity--;
    }
  }
  return available;
}

/**
 * Move 2.5: Downsize Bar — Try to swap a partially empty bar for a shorter available stock size.
 * This ensures "longest-first" strategies still use small bars to finish off the cut list.
 */
function tryDownsizeBar(bars, stockLengths, kerfWidth, strategy) {
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (bar.isRemnant) continue; // We only downsize standard bars

    const reqLength = bar.usedLength; 
    const availableStock = getAvailableStock(bars, stockLengths);

    // Sort available stock ascending so we try the absolute smallest possible replacement first
    availableStock.sort((a, b) => a.length - b.length);

    for (const stock of availableStock) {
      if (stock.length < bar.stockLength && stock.length >= reqLength) {
        if (stock.quantity === Infinity || stock.quantity > 0) {
          const newBars = bars.map(cloneBar);
          newBars[i].stockLengthId = stock.id;
          newBars[i].stockLength = stock.length;
          newBars[i].isRemnant = stock.isRemnant || false;
          newBars[i].stockLabel = stock.label || '';
          rebuildBar(newBars[i], kerfWidth);

          if (isBetter(newBars, bars, strategy)) {
            return newBars;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Move 3: Relocate — move a single unlocked piece from one bar to another.
 * Accepts any move that improves the solution by the objective hierarchy.
 */
function tryRelocate(bars, kerfWidth, strategy) {
  for (let srcIdx = 0; srcIdx < bars.length; srcIdx++) {
    const srcBar = bars[srcIdx];

    for (let pIdx = 0; pIdx < srcBar.pieces.length; pIdx++) {
      const piece = srcBar.pieces[pIdx];


      for (let dstIdx = 0; dstIdx < bars.length; dstIdx++) {
        if (dstIdx === srcIdx) continue;
        if (!pieceFits(bars[dstIdx], piece.length, kerfWidth)) continue;

        const newBars = bars.map(cloneBar);

        // Remove piece from source
        newBars[srcIdx].pieces = newBars[srcIdx].pieces.filter(
          p => !(p.pieceId === piece.pieceId && p.instanceIndex === piece.instanceIndex)
        );
        rebuildBar(newBars[srcIdx], kerfWidth);

        // Add piece to destination
        placePiece(newBars[dstIdx], piece, kerfWidth);

        // Filter out empty bars
        const filtered = newBars.filter(b => b.pieces.length > 0);

        if (isBetter(filtered, bars, strategy)) {
          return filtered;
        }
      }
    }
  }
  return null;
}

/**
 * Move 4: Simple swap — exchange one unlocked piece from bar A with one
 * from bar B, if the swap is feasible and improves the solution.
 */
function trySwap(bars, kerfWidth, strategy) {
  for (let i = 0; i < bars.length; i++) {
    for (let j = i + 1; j < bars.length; j++) {
      const barA = bars[i];
      const barB = bars[j];

      for (const pieceA of barA.pieces) {
        for (const pieceB of barB.pieces) {
          if (Math.abs(pieceA.length - pieceB.length) < 0.01) continue;

          // Approximate feasibility check
          const barAFreeAfterRemove = remainingLength(barA) + pieceA.length + kerfWidth;
          const barBFreeAfterRemove = remainingLength(barB) + pieceB.length + kerfWidth;

          const pieceBNeedsInA = pieceB.length + kerfWidth;
          const pieceANeedsInB = pieceA.length + kerfWidth;

          if (barAFreeAfterRemove < pieceBNeedsInA) continue;
          if (barBFreeAfterRemove < pieceANeedsInB) continue;

          // Perform the swap
          const newBars = bars.map(cloneBar);

          newBars[i].pieces = newBars[i].pieces.filter(
            p => !(p.pieceId === pieceA.pieceId && p.instanceIndex === pieceA.instanceIndex)
          );
          newBars[j].pieces = newBars[j].pieces.filter(
            p => !(p.pieceId === pieceB.pieceId && p.instanceIndex === pieceB.instanceIndex)
          );

          newBars[i].pieces.push({ ...pieceB });
          newBars[j].pieces.push({ ...pieceA });

          rebuildBar(newBars[i], kerfWidth);
          rebuildBar(newBars[j], kerfWidth);

          if (newBars[i].waste < -0.01 || newBars[j].waste < -0.01) continue;

          const filtered = newBars.filter(b => b.pieces.length > 0);

          if (isBetter(filtered, bars, strategy)) {
            return filtered;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Run the local search improvement loop.
 * Applies moves in priority order, restarting from the top after each improvement.
 * Stops when no improving move is found (local optimum).
 */
function localSearch(bars, stockLengths, kerfWidth, strategy, maxIterations = 200) {
  let current = bars;
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    // 1. Bar elimination (highest impact — reduces bar count)
    const eliminated = tryEliminateWorstBar(current, kerfWidth, strategy);
    if (eliminated) {
      current = eliminated;
      improved = true;
      continue;
    }

    // 2. Downsize Bar (reduces material waste footprint)
    const downsized = tryDownsizeBar(current, stockLengths, kerfWidth, strategy);
    if (downsized) {
      current = downsized;
      improved = true;
      continue;
    }

    // 2. Compound swap (high impact — 1-for-N trades enable redistribution)
    const compounded = tryCompoundSwap(current, kerfWidth, strategy);
    if (compounded) {
      current = compounded;
      improved = true;
      continue;
    }

    // 3. Relocate (medium impact — single piece moves)
    const relocated = tryRelocate(current, kerfWidth, strategy);
    if (relocated) {
      current = relocated;
      improved = true;
      continue;
    }

    // 4. Simple swap (fine-tuning — 1-for-1 exchanges)
    const swapped = trySwap(current, kerfWidth, strategy);
    if (swapped) {
      current = swapped;
      improved = true;
      continue;
    }
  }

  return current;
}


// ─── Post-processing ─────────────────────────────────────────────

/**
 * Sort pieces within each bar by length descending (longest first).
 * Groups same-length pieces together for a logical cutting sequence.
 * Rebuilds offsets after sorting.
 */
function sortPiecesInBars(bars, kerfWidth) {
  for (const bar of bars) {
    bar.pieces.sort((a, b) => {
      // Primary: length descending (longest first)
      if (b.length !== a.length) return b.length - a.length;
      // Secondary: label alphabetical (group same-length pieces)
      return (a.label || '').localeCompare(b.label || '');
    });
    rebuildBar(bar, kerfWidth);
  }
}


// ─── Main Entry Point ────────────────────────────────────────────

/**
 * Run the optimizer: BFD + Local Search.
 *
 * @param {object} params
 * @param {Array} params.stockLengths - Available stock: [{ id, length, quantity, isRemnant, label }]
 * @param {Array} params.demandPieces - Required cuts: [{ id, label, length, quantity, groupId }]
 * @param {number} params.kerfWidth - Blade kerf in mm
 */
export function optimize({ stockLengths, demandPieces, kerfWidth = 0, optimizationStrategy = 'maximize_large_bars' }) {
  const strategies = ['asc', 'desc'];
  let bestBars = null;
  let bestUnplaced = [];

  for (const strategy of strategies) {
    resetBarIdCounter(); // Reset IDs so they start at 1 for each simulation pass

    // Deep copy inputs because `runBFD` mutates stock quantities and pieces
    const stockCopy = stockLengths.map(s => ({ ...s }));
    const sortedStock = sortStockByPriority(stockCopy, strategy);
    const allPieces = expandPieces(demandPieces);

    // Record initial stock quantities before BFD consumes them
    const initialStockQty = {};
    for (const s of stockCopy) {
      initialStockQty[s.id] = s.quantity;
    }

    // ── Phase 1: BFD ──
    const bfdResult = runBFD(allPieces, sortedStock, kerfWidth, []);
    const bfdBars = bfdResult.bars;
    let unplacedPieces = bfdResult.unplaced;

    // ── Phase 2: Local Search ──
    let optimizedBars = localSearch(bfdBars, stockCopy, kerfWidth, optimizationStrategy);

    // ── Phase 2b: Recovery ──
    // Local search may have eliminated bars (redistributing their pieces),
    // freeing up stock that BFD had consumed. Restore that freed stock and
    // try to place any unplaced pieces using it.
    if (unplacedPieces.length > 0 && optimizedBars.length < bfdBars.length) {
      // Count how many bars of each stock type are actually used in the result
      const usedStockCounts = {};
      for (const bar of optimizedBars) {
        usedStockCounts[bar.stockLengthId] = (usedStockCounts[bar.stockLengthId] || 0) + 1;
      }

      // Restore freed stock: original quantity minus what's actually used
      for (const stock of stockCopy) {
        const used = usedStockCounts[stock.id] || 0;
        stock.quantity = (initialStockQty[stock.id] ?? 0) - used;
        if (stock.quantity < 0) stock.quantity = 0;
      }

      // Re-sort stock by priority for recovery placement
      const recoveryStock = sortStockByPriority(stockCopy, strategy);

      // Try to place unplaced pieces into existing bars + new bars from freed stock.
      // runBFD clones pre-locked bars, so recoveryResult.bars contains all bars
      // (clones of existing + any new ones opened from freed stock).
      const recoveryResult = runBFD(unplacedPieces, recoveryStock, kerfWidth, optimizedBars);
      optimizedBars = recoveryResult.bars;
      unplacedPieces = recoveryResult.unplaced;
    }

    // ── Compare with best known solution ──
    if (!bestBars || isBetter(optimizedBars, bestBars, optimizationStrategy)) {
      bestBars = optimizedBars;
      bestUnplaced = unplacedPieces;
    }
  }

  // ── Post-process best solution ──
  sortPiecesInBars(bestBars, kerfWidth);
  bestBars.sort((a, b) => a.waste - b.waste);
  const summary = recalculateSummary(bestBars);

  const unplacedSummary = bestUnplaced.length > 0
    ? {
        count: bestUnplaced.length,
        totalLength: bestUnplaced.reduce((sum, p) => sum + p.length, 0),
        pieces: bestUnplaced,
      }
    : null;

  return { bars: bestBars, summary, unplaced: unplacedSummary };
}


// ─── Public API (unchanged for UI/override use) ──────────────────

/**
 * Reorganize bars the same way the optimizer post-processes its result:
 *   1. Sort pieces within each bar longest-first (clean cut sequence)
 *   2. Sort bars by ascending waste
 *
 * Operates on clones so the input bars (and shared state) are never mutated.
 * Useful after manual drag-and-drop edits to keep the layout consistent with
 * freshly optimized output.
 */
export function reorganizeBars(bars, kerfWidth) {
  const cloned = bars.map(cloneBar);
  sortPiecesInBars(cloned, kerfWidth);
  cloned.sort((a, b) => a.waste - b.waste);
  return cloned;
}


/**
 * Validate that a manual override (move piece to bar) is feasible.
 */
export function validateMove(bar, piece, kerfWidth) {
  if (pieceFits(bar, piece.length, kerfWidth)) {
    return { valid: true };
  }
  const remaining = remainingLength(bar);
  const needed = piece.length + kerfWidth;
  return {
    valid: false,
    reason: `Not enough space. Need ${needed}mm, only ${Math.round(remaining)}mm available.`,
  };
}

/**
 * Remove a piece from a bar and recalculate offsets and waste.
 * Returns a new bar object (immutable).
 */
export function removePieceFromBar(bar, pieceId, instanceIndex, kerfWidth) {
  const newPieces = bar.pieces.filter(
    p => !(p.pieceId === pieceId && p.instanceIndex === instanceIndex)
  );

  let usedLength = 0;
  for (let i = 0; i < newPieces.length; i++) {
    const offset = usedLength;
    newPieces[i] = { ...newPieces[i], offset };
    usedLength = offset + newPieces[i].length + kerfWidth;
  }

  return {
    ...bar,
    pieces: newPieces,
    usedLength,
    waste: bar.stockLength - usedLength,
    wastePercent: ((bar.stockLength - usedLength) / bar.stockLength) * 100,
  };
}

/**
 * Add a piece to a bar and recalculate. Returns null if piece doesn't fit.
 */
export function addPieceToBar(bar, piece, kerfWidth) {
  if (!pieceFits(bar, piece.length, kerfWidth)) return null;

  const newBar = { ...bar, pieces: [...bar.pieces] };
  placePiece(newBar, piece, kerfWidth);
  return newBar;
}

/**
 * Recalculate the summary for an array of bars.
 */
export function recalculateSummary(bars) {
  const totalBars = bars.length;
  const totalUsed = bars.reduce((sum, b) => sum + b.usedLength, 0);
  const totalStock = bars.reduce((sum, b) => sum + b.stockLength, 0);
  const totalWasteLength = totalStock - totalUsed;
  const totalWastePercent = totalStock > 0 ? (totalWasteLength / totalStock) * 100 : 0;

  const barsBreakdown = {};
  for (const bar of bars) {
    barsBreakdown[bar.stockLengthId] = (barsBreakdown[bar.stockLengthId] || 0) + 1;
  }

  return {
    totalBars,
    totalWastePercent: Math.round(totalWastePercent * 100) / 100,
    totalWasteLength: Math.round(totalWasteLength * 100) / 100,
    totalUsedLength: Math.round(totalUsed * 100) / 100,
    totalStockLength: Math.round(totalStock * 100) / 100,
    barsBreakdown,
  };
}
