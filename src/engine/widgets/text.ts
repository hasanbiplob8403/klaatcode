/**
 * KlaatTUI — Text rendering widget.
 *
 * Provides word-wrapped and single-line text drawing into a CellBuffer Rect.
 *
 * API:
 *   drawText(buf, r, text, style?, opts?)
 *     — Word-wraps `text` into `r`, returns number of rows used.
 *
 *   drawTextLine(buf, r, row, text, style?, opts?)
 *     — Draws a single line at the given row, with optional alignment
 *       and ellipsis truncation.
 *
 *   wrapLines(text, width)
 *     — Pure helper: splits text into word-wrapped lines ≤ `width` columns.
 */

import { type CellBuffer } from "../buffer.js";
import { type Style } from "../buffer.js";
import { type Rect } from "../layout.js";
import { stringWidth } from "../input.js";

// ─── Line breaking ────────────────────────────────────────────────────────────

/**
 * Split `text` into lines that are ≤ `width` columns wide.
 *
 * - Hard newlines (\n) always produce a line break.
 * - Words longer than `width` are hard-wrapped at column boundary.
 * - Leading/trailing whitespace is preserved within hard lines but
 *   trimmed at soft-wrap join points.
 */
export function wrapLines(text: string, width: number): string[] {
  if (width <= 0) return [];

  const result: string[] = [];

  for (const hardLine of text.split("\n")) {
    // Fast path: line fits as-is
    if (stringWidth(hardLine) <= width) {
      result.push(hardLine);
      continue;
    }

    // Word-wrap this hard line
    const words = hardLine.split(/(\s+)/); // keep whitespace tokens
    let current = "";
    let currentW = 0;

    for (const token of words) {
      const tokenW = stringWidth(token);

      if (tokenW === 0) continue;

      // If the token itself exceeds width, hard-break it character by character
      if (tokenW > width) {
        // Flush current line first
        if (currentW > 0) {
          result.push(current);
          current  = "";
          currentW = 0;
        }
        // Hard-break token
        for (const ch of token) {
          const cw = stringWidth(ch);
          if (currentW + cw > width) {
            result.push(current);
            current  = "";
            currentW = 0;
          }
          current  += ch;
          currentW += cw;
        }
        continue;
      }

      // Whitespace token at the start of a line → skip
      if (/^\s+$/.test(token) && currentW === 0) continue;

      if (currentW + tokenW <= width) {
        current  += token;
        currentW += tokenW;
      } else {
        // Flush current line (trim trailing whitespace)
        if (currentW > 0) result.push(current.trimEnd());
        // If this is a whitespace token, skip it (it becomes the gap)
        if (/^\s+$/.test(token)) {
          current  = "";
          currentW = 0;
        } else {
          current  = token;
          currentW = tokenW;
        }
      }
    }

    if (current.length > 0 || result.length === 0) {
      result.push(current);
    }
  }

  return result;
}

// ─── Alignment helpers ────────────────────────────────────────────────────────

export type TextAlign = "left" | "center" | "right";

function alignOffset(contentW: number, areaW: number, align: TextAlign): number {
  if (align === "center") return Math.floor((areaW - contentW) / 2);
  if (align === "right")  return Math.max(0, areaW - contentW);
  return 0; // left
}

// ─── drawTextLine ─────────────────────────────────────────────────────────────

export interface DrawTextLineOpts {
  align?:    TextAlign;
  ellipsis?: boolean;  // truncate with "…" if text is too wide (default true)
}

/**
 * Draw a single line of text into `buf` at absolute row `absRow`,
 * clipped to the horizontal bounds of `r`.
 *
 * @returns actual column width written
 */
export function drawTextLine(
  buf:    CellBuffer,
  r:      Rect,
  absRow: number,
  text:   string,
  style:  Style = {},
  opts:   DrawTextLineOpts = {},
): number {
  const { align = "left", ellipsis = true } = opts;

  if (absRow < r.y || absRow >= r.y + r.height || r.width <= 0) return 0;

  let display = text;
  let displayW = stringWidth(display);

  // Truncate with ellipsis if needed
  if (displayW > r.width && ellipsis) {
    const ellipsisChar = "…";
    const ellipsisW    = 1; // "…" is 1 column
    let truncated = "";
    let truncW    = 0;
    for (const ch of display) {
      const cw = stringWidth(ch);
      if (truncW + cw + ellipsisW > r.width) break;
      truncated += ch;
      truncW    += cw;
    }
    display  = truncated + ellipsisChar;
    displayW = truncW + ellipsisW;
  }

  const xOffset = r.x + alignOffset(displayW, r.width, align);
  buf.write(absRow, xOffset, display, style);
  return displayW;
}

// ─── drawText ─────────────────────────────────────────────────────────────────

export interface DrawTextOpts {
  align?:     TextAlign;
  ellipsis?:  boolean;  // applies when a single word overflows (default true)
  maxLines?:  number;   // cap rendered lines (default: r.height)
}

/**
 * Word-wrap `text` and draw it into `r`, starting at row r.y.
 *
 * @returns number of rows actually used
 */
export function drawText(
  buf:   CellBuffer,
  r:     Rect,
  text:  string,
  style: Style = {},
  opts:  DrawTextOpts = {},
): number {
  const { align = "left", ellipsis = true } = opts;
  const maxLines = opts.maxLines ?? r.height;

  if (r.width <= 0 || r.height <= 0 || maxLines <= 0) return 0;

  const lines = wrapLines(text, r.width);
  const count = Math.min(lines.length, maxLines, r.height);

  for (let i = 0; i < count; i++) {
    drawTextLine(buf, r, r.y + i, lines[i]!, style, { align, ellipsis });
  }

  return count;
}
