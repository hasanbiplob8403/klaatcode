/**
 * KlaatTUI — Border widget.
 *
 * Draws a single-cell border around a Rect using Unicode box-drawing characters.
 *
 * Supported styles:
 *   "single"  — ┌─┐│└─┘
 *   "double"  — ╔═╗║╚═╝
 *   "rounded" — ╭─╮│╰─╯   (default)
 *   "thick"   — ┏━┓┃┗━┛
 *   "blank"   — spaces (still reserves 1-cell border area for inner() usage)
 *
 * Title placement:
 *   An optional title string is drawn inside the top border, left-aligned
 *   with one space of padding each side: "╭─ My Title ─╮".
 *   A titleRight string is drawn flush to the right side of the top border.
 *
 * Usage:
 *   drawBorder(buf, r, { style: "rounded", title: "Chat", fg: "#d8b4fe" });
 *   const content = inner(r); // Rect inset by 1 on all sides
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type Color } from "../color.js";
import { type Rect, inner } from "../layout.js";
import { stringWidth } from "../input.js";

// ─── Char sets ────────────────────────────────────────────────────────────────

interface Chars {
  tl: string;  // top-left corner
  tr: string;  // top-right corner
  bl: string;  // bottom-left corner
  br: string;  // bottom-right corner
  h:  string;  // horizontal bar
  v:  string;  // vertical bar
}

const BORDER_CHARS: Record<string, Chars> = {
  single: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
  double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  rounded:{ tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  thick:  { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃" },
  blank:  { tl: " ", tr: " ", bl: " ", br: " ", h: " ", v: " " },
};

// ─── Options ──────────────────────────────────────────────────────────────────

export interface BorderOpts {
  style?:       "single" | "double" | "rounded" | "thick" | "blank";
  title?:       string;
  titleRight?:  string;
  titleStyle?:  Style;
  fg?:          Color;
  bg?:          Color;
}

// ─── drawBorder ───────────────────────────────────────────────────────────────

/**
 * Draw a box border around `r`.
 *
 * The interior of the box is `inner(r)` (pad by 1 on all sides).
 * Out-of-bounds writes are silently ignored by the buffer.
 */
export function drawBorder(
  buf:  CellBuffer,
  r:    Rect,
  opts: BorderOpts = {},
): void {
  const {
    style      = "rounded",
    title      = "",
    titleRight = "",
    titleStyle,
    fg         = null,
    bg         = null,
  } = opts;

  const ch = BORDER_CHARS[style] ?? BORDER_CHARS["rounded"]!;
  const s: Style = { fg, bg };

  const { x, y, width: w, height: h } = r;
  if (w < 2 || h < 2) return; // too small to draw

  const right  = x + w - 1;
  const bottom = y + h - 1;

  // ── Corners ──────────────────────────────────────────────────────────
  buf.write(y,      x,     ch.tl, s);
  buf.write(y,      right, ch.tr, s);
  buf.write(bottom, x,     ch.bl, s);
  buf.write(bottom, right, ch.br, s);

  // ── Horizontal bars ───────────────────────────────────────────────────
  // Top edge
  for (let c = x + 1; c < right; c++) buf.write(y,      c, ch.h, s);
  // Bottom edge
  for (let c = x + 1; c < right; c++) buf.write(bottom, c, ch.h, s);

  // ── Vertical bars ─────────────────────────────────────────────────────
  for (let row = y + 1; row < bottom; row++) {
    buf.write(row, x,     ch.v, s);
    buf.write(row, right, ch.v, s);
  }

  // ── Title (left, top edge) ────────────────────────────────────────────
  if (title && w >= 6) {
    const maxW   = w - 4;       // leave room for "─ " and " ─" + corners
    const ts     = titleStyle ?? s;
    const label  = truncate(title, maxW);
    const labelW = stringWidth(label);

    // Overwrite horizontal bar chars: "─ label ─"
    const col = x + 2;
    buf.write(y, col - 1, " ", s);           // space before label
    buf.write(y, col,     label, ts);
    buf.write(y, col + labelW, " ", s);      // space after label
    // Re-draw separator segments on either side of the gap
    // (corners already drawn; horizontal bar already filled; the above overwrites are enough)
  }

  // ── titleRight (right, top edge) ─────────────────────────────────────
  if (titleRight && w >= 6) {
    const maxW   = w - 4;
    const ts     = titleStyle ?? s;
    const label  = truncate(titleRight, maxW);
    const labelW = stringWidth(label);
    const col    = right - 1 - labelW;
    buf.write(y, col - 1, " ", s);
    buf.write(y, col,     label, ts);
    buf.write(y, col + labelW, " ", s);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxW: number): string {
  let out = "";
  let w   = 0;
  for (const ch of text) {
    const cw = stringWidth(ch);
    if (w + cw > maxW) break;
    out += ch;
    w   += cw;
  }
  return out;
}

// Re-export `inner` for convenience so callers don't need to import layout.ts
export { inner };
