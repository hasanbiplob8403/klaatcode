/**
 * KlaatTUI — StatusBar widget.
 *
 * A single-row bar at the bottom of the screen showing project info,
 * keyboard shortcuts, and session metadata.
 *
 * Layout:
 *   [left content]                                [right content]
 *
 * Usage:
 *   drawStatusBar(buf, area, {
 *     left:  [span("~/project", { fg: "gray" }), span(" KLAAT CODE", { fg: "#d8b4fe", bold: true })],
 *     right: [span("143.7K tokens", { fg: "white" }), span("  ctrl+p commands", { fg: "gray" })],
 *   });
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type Rect } from "../layout.js";
import { type StyledLine, drawStyledLine, lineWidth } from "../styled-text.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusBarOpts {
  left?:   StyledLine;
  center?: StyledLine;
  right?:  StyledLine;
  bg?:     string | null;
}

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Draw a status bar at the specified row within `r`.
 * The bar fills the entire width of `r`.
 */
export function drawStatusBar(
  buf:  CellBuffer,
  r:    Rect,
  opts: StatusBarOpts,
): void {
  if (r.height <= 0 || r.width <= 0) return;

  const row = r.y;

  // Optional background fill
  if (opts.bg) {
    buf.fill(row, r.x, 1, r.width, " ", { bg: opts.bg });
  }

  // Left content
  if (opts.left && opts.left.length > 0) {
    const leftR: Rect = { x: r.x + 1, y: row, width: r.width - 2, height: 1 };
    drawStyledLine(buf, leftR, row, opts.left);
  }

  // Center content
  if (opts.center && opts.center.length > 0) {
    drawStyledLine(buf, r, row, opts.center, { align: "center" });
  }

  // Right content
  if (opts.right && opts.right.length > 0) {
    const rw = lineWidth(opts.right);
    const rightR: Rect = { x: r.x + r.width - rw - 1, y: row, width: rw, height: 1 };
    drawStyledLine(buf, rightR, row, opts.right);
  }
}
