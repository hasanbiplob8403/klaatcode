/**
 * KlaatTUI — Layout primitives.
 *
 * A Rect is the sole layout primitive: { x, y, width, height } in
 * terminal cell coordinates (0-indexed, col × row).
 *
 * All helpers are pure functions that return new Rects — no mutation.
 */

// ─── Rect ─────────────────────────────────────────────────────────────────────

export interface Rect {
  x:      number;  // left column  (0-indexed)
  y:      number;  // top row      (0-indexed)
  width:  number;  // columns
  height: number;  // rows
}

/** Construct a Rect. */
export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

/** True if the Rect has positive area. */
export function rectValid(r: Rect): boolean {
  return r.width > 0 && r.height > 0;
}

// ─── Padding ──────────────────────────────────────────────────────────────────

/** Inset a Rect by equal amounts on all sides. */
export function pad(r: Rect, amount: number): Rect {
  return padEach(r, amount, amount, amount, amount);
}

/** Inset a Rect individually: padEach(r, top, right, bottom, left). */
export function padEach(r: Rect, top: number, right: number, bottom: number, left: number): Rect {
  return {
    x:      r.x + left,
    y:      r.y + top,
    width:  Math.max(0, r.width  - left - right),
    height: Math.max(0, r.height - top  - bottom),
  };
}

/** Shrink horizontally by `cols` on each side. */
export function padH(r: Rect, cols: number): Rect {
  return padEach(r, 0, cols, 0, cols);
}

/** Shrink vertically by `rows` on each side. */
export function padV(r: Rect, rows: number): Rect {
  return padEach(r, rows, 0, rows, 0);
}

// ─── Splits ───────────────────────────────────────────────────────────────────

/**
 * Split horizontally (left / right).
 * `leftWidth` can be negative to mean "cols from the right".
 */
export function splitH(r: Rect, leftWidth: number): [Rect, Rect] {
  const lw = leftWidth >= 0
    ? Math.min(leftWidth, r.width)
    : Math.max(0, r.width + leftWidth);
  return [
    { x: r.x,       y: r.y, width: lw,           height: r.height },
    { x: r.x + lw,  y: r.y, width: r.width - lw, height: r.height },
  ];
}

/**
 * Split vertically (top / bottom).
 * `topHeight` can be negative to mean "rows from the bottom".
 */
export function splitV(r: Rect, topHeight: number): [Rect, Rect] {
  const th = topHeight >= 0
    ? Math.min(topHeight, r.height)
    : Math.max(0, r.height + topHeight);
  return [
    { x: r.x, y: r.y,       width: r.width, height: th },
    { x: r.x, y: r.y + th,  width: r.width, height: r.height - th },
  ];
}

/** Take `n` rows from the bottom, return [rest, bottom]. */
export function takeBottom(r: Rect, n: number): [Rect, Rect] {
  return splitV(r, -n);
}

/** Take `n` rows from the top, return [top, rest]. */
export function takeTop(r: Rect, n: number): [Rect, Rect] {
  return splitV(r, n);
}

/** Take `n` cols from the right, return [rest, right]. */
export function takeRight(r: Rect, n: number): [Rect, Rect] {
  return splitH(r, -n);
}

/** Take `n` cols from the left, return [left, rest]. */
export function takeLeft(r: Rect, n: number): [Rect, Rect] {
  return splitH(r, n);
}

// ─── Proportional splits ──────────────────────────────────────────────────────

/**
 * Split horizontally by ratio (0 < ratio < 1 = fraction for left pane).
 */
export function splitHRatio(r: Rect, ratio: number): [Rect, Rect] {
  return splitH(r, Math.round(r.width * ratio));
}

/**
 * Split vertically by ratio (0 < ratio < 1 = fraction for top pane).
 */
export function splitVRatio(r: Rect, ratio: number): [Rect, Rect] {
  return splitV(r, Math.round(r.height * ratio));
}

// ─── Centering ────────────────────────────────────────────────────────────────

/** Return a Rect of the given size, centered inside `r`. */
export function center(r: Rect, width: number, height: number): Rect {
  const w = Math.min(width,  r.width);
  const h = Math.min(height, r.height);
  return {
    x:      r.x + Math.floor((r.width  - w) / 2),
    y:      r.y + Math.floor((r.height - h) / 2),
    width:  w,
    height: h,
  };
}

// ─── Inner rect (border inset) ────────────────────────────────────────────────

/** Inset by 1 on all sides (inside a 1-cell border). */
export function inner(r: Rect): Rect {
  return pad(r, 1);
}

// ─── Mini Flexbox Engine ─────────────────────────────────────────────────────
//
// A zero-dependency CSS-flexbox-inspired layout engine for terminal UIs.
//
// Supports: row/column direction, flex-grow, fixed sizes, gap, padding,
// align-items, and justify-content. No floats, no wrapping.
//
// Usage:
//   const [chatRect, sideRect] = flexLayout(area, [
//     { flexGrow: 1 },
//     { size: 38 },
//   ], { direction: "row", gap: 1 });
//
//   const [topBar, main, footer] = flexLayout(area, [
//     { size: 1 },
//     { flexGrow: 1 },
//     { size: 3 },
//   ], { direction: "column" });

export interface FlexChild {
  /** Fixed size in the main axis (cols for "row", rows for "column").
   *  If flexGrow > 0, this is the minimum size; remaining space is distributed. */
  size?:     number;
  /** Share of remaining space after fixed sizes are allocated.
   *  0 = don't grow (but may shrink). Defaults to 0. */
  flexGrow?: number;
  /** Optional fixed size along the CROSS axis.
   *  Ignored if alignItems = "stretch" (the default). */
  crossSize?: number;
}

export type FlexAlign  = "start" | "center" | "end" | "stretch";
export type FlexJustify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";

export interface FlexOpts {
  direction?:   "row" | "column";   // default: "row"
  gap?:         number;             // cells between items
  padding?:     number;             // uniform padding inside container
  padTop?:      number;
  padRight?:    number;
  padBottom?:   number;
  padLeft?:     number;
  alignItems?:  FlexAlign;          // cross-axis alignment; default "stretch"
  justify?:     FlexJustify;        // main-axis distribution; default "start"
}

/**
 * Compute Rects for a list of flex children within a container.
 * Returns one Rect per child, in the same order.
 *
 * Sizes are in terminal cells.
 * Items that don't fit are clamped to zero.
 */
export function flexLayout(container: Rect, children: FlexChild[], opts: FlexOpts = {}): Rect[] {
  const {
    direction   = "row",
    gap         = 0,
    alignItems  = "stretch",
    justify     = "start",
  } = opts;

  // Resolve padding
  const pt = opts.padTop    ?? opts.padding ?? 0;
  const pr = opts.padRight  ?? opts.padding ?? 0;
  const pb = opts.padBottom ?? opts.padding ?? 0;
  const pl = opts.padLeft   ?? opts.padding ?? 0;

  // Inner rect after padding
  const inner: Rect = {
    x:      container.x + pl,
    y:      container.y + pt,
    width:  Math.max(0, container.width  - pl - pr),
    height: Math.max(0, container.height - pt - pb),
  };

  const isRow     = direction === "row";
  const mainSize  = isRow ? inner.width  : inner.height;
  const crossSize = isRow ? inner.height : inner.width;

  if (children.length === 0) return [];

  const n = children.length;

  // ── Step 1: compute fixed sizes ───────────────────────────────────────────
  const fixedSizes: number[] = children.map((c) => c.size ?? 0);
  const grows:      number[] = children.map((c) => Math.max(0, c.flexGrow ?? 0));
  const totalGrow             = grows.reduce((a, b) => a + b, 0);
  const totalGaps             = Math.max(0, n - 1) * gap;
  const totalFixed            = fixedSizes.reduce((a, b) => a + b, 0);

  // ── Step 2: distribute remaining space among flex-grow items ──────────────
  const remaining  = Math.max(0, mainSize - totalFixed - totalGaps);
  const itemSizes: number[] = fixedSizes.map((fixed, i) => {
    if (grows[i]! > 0 && totalGrow > 0) {
      return fixed + Math.floor((grows[i]! / totalGrow) * remaining);
    }
    return fixed;
  });

  // Adjust for rounding: give leftover pixels to the last grow item
  const totalAllocated = itemSizes.reduce((a, b) => a + b, 0) + totalGaps;
  const leftover = mainSize - totalAllocated;
  if (leftover !== 0) {
    // Find the last item with flexGrow > 0
    for (let i = n - 1; i >= 0; i--) {
      if (grows[i]! > 0) {
        itemSizes[i] = Math.max(0, itemSizes[i]! + leftover);
        break;
      }
    }
  }

  // ── Step 3: compute main-axis offsets based on justify ────────────────────
  const actualTotal = itemSizes.reduce((a, b) => a + b, 0);
  const freeSpace   = mainSize - actualTotal - totalGaps;

  let startOffset = 0;
  let betweenGap  = gap;

  if (justify === "center")       startOffset = Math.floor(freeSpace / 2);
  else if (justify === "end")     startOffset = freeSpace;
  else if (justify === "space-between" && n > 1) {
    betweenGap = gap + Math.floor(freeSpace / (n - 1));
  } else if (justify === "space-around") {
    const each  = Math.floor(freeSpace / n);
    startOffset = Math.floor(each / 2);
    betweenGap  = gap + each;
  } else if (justify === "space-evenly") {
    const each  = Math.floor(freeSpace / (n + 1));
    startOffset = each;
    betweenGap  = gap + each;
  }

  // ── Step 4: build Rects ───────────────────────────────────────────────────
  const rects: Rect[] = [];
  let mainOffset = startOffset;

  for (let i = 0; i < n; i++) {
    const ms = Math.max(0, itemSizes[i]!);

    // Cross-axis placement
    let cs: number;
    let co: number;
    const childCross = children[i]!.crossSize;
    if (alignItems === "stretch" || childCross === undefined) {
      cs = crossSize;
      co = 0;
    } else {
      cs = Math.min(childCross, crossSize);
      if (alignItems === "center") co = Math.floor((crossSize - cs) / 2);
      else if (alignItems === "end") co = crossSize - cs;
      else co = 0; // "start"
    }

    const rect: Rect = isRow
      ? { x: inner.x + mainOffset, y: inner.y + co, width: ms,         height: cs }
      : { x: inner.x + co,         y: inner.y + mainOffset, width: cs, height: ms };

    rects.push(rect);
    mainOffset += ms + betweenGap;
  }

  return rects;
}

/**
 * Shorthand: split a Rect into two children using flex-grow.
 * Equivalent to a 2-child flexLayout. Mirrors the splitH / splitV API.
 */
export function flexSplitH(r: Rect, leftGrow = 1, rightGrow = 1, gap = 0): [Rect, Rect] {
  const [a, b] = flexLayout(r, [{ flexGrow: leftGrow }, { flexGrow: rightGrow }],
    { direction: "row", gap });
  return [a!, b!];
}

export function flexSplitV(r: Rect, topGrow = 1, bottomGrow = 1, gap = 0): [Rect, Rect] {
  const [a, b] = flexLayout(r, [{ flexGrow: topGrow }, { flexGrow: bottomGrow }],
    { direction: "column", gap });
  return [a!, b!];
}

/** Intersect two Rects. Returns a zero-size Rect if they don't overlap. */
export function intersect(a: Rect, b: Rect): Rect {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width,  b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  return {
    x:      x1,
    y:      y1,
    width:  Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
  };
}

/** True if point (col, row) lies inside Rect. */
export function contains(r: Rect, col: number, row: number): boolean {
  return col >= r.x && col < r.x + r.width &&
         row >= r.y && row < r.y + r.height;
}
