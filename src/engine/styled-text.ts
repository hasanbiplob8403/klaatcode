/**
 * KlaatTUI — Styled text spans.
 *
 * A StyledSpan is a fragment of text with its own fg, bg, and attributes.
 * A StyledLine is an array of spans that together form a single visual line.
 *
 * This is the fundamental building block for mixed-color text like:
 *   "Build · claude-sonnet KlaatAI · high"
 * where each word has a different color.
 *
 * Usage:
 *   const line = spans(
 *     span("Build", { fg: "cyan", bold: true }),
 *     span(" · ", { fg: "gray", dim: true }),
 *     span("claude-sonnet", { fg: "white" }),
 *     span(" KlaatAI", { fg: "gray", dim: true }),
 *   );
 *   drawStyledLine(buf, r, r.y, line);
 *
 * Template tag (shorthand):
 *   const line = styledLine`${{ fg: "cyan" }}Build${{ fg: "gray" }} · ${{ fg: "white" }}model`;
 */

import { type CellBuffer, type Style } from "./buffer.js";
import { type Color } from "./color.js";
import { type Rect } from "./layout.js";
import { stringWidth } from "./input.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Span {
  text: string;
  fg?:        Color;
  bg?:        Color;
  bold?:      boolean;
  dim?:       boolean;
  italic?:    boolean;
  underline?: boolean;
  /** Optional click-target ID (for hit-region tracking). */
  clickId?:   string;
  /** Optional link URL (for OSC 8 hyperlinks). */
  link?:      string;
}

export type StyledLine = Span[];

// ─── Constructors ─────────────────────────────────────────────────────────────

/** Create a single text span. */
export function span(text: string, style: Omit<Span, "text"> = {}): Span {
  return { text, ...style };
}

/** Create a StyledLine from multiple spans. */
export function spans(...items: Span[]): StyledLine {
  return items;
}

/** Create a plain (unstyled) span. */
export function plain(text: string): Span {
  return { text };
}

/** Create a dimmed separator span (commonly " · "). */
export function sep(text = " · "): Span {
  return { text, fg: "gray", dim: true };
}

// ─── Style helpers (chainable builders) ───────────────────────────────────────

export function bold(text: string, fg?: Color): Span {
  return { text, bold: true, fg };
}

export function dim(text: string, fg?: Color): Span {
  return { text, dim: true, fg: fg ?? "gray" };
}

export function italic(text: string, fg?: Color): Span {
  return { text, italic: true, fg };
}

export function underline(text: string, fg?: Color): Span {
  return { text, underline: true, fg };
}

export function link(text: string, url: string, fg: Color = "cyan"): Span {
  return { text, fg, underline: true, link: url };
}

export function clickable(text: string, id: string, fg?: Color): Span {
  return { text, fg, clickId: id };
}

// ─── Measurement ──────────────────────────────────────────────────────────────

/** Total visual column width of a StyledLine. */
export function lineWidth(line: StyledLine): number {
  let w = 0;
  for (const s of line) w += stringWidth(s.text);
  return w;
}

/** Concatenate the raw text of all spans (no styling). */
export function lineText(line: StyledLine): string {
  return line.map((s) => s.text).join("");
}

// ─── Truncation ───────────────────────────────────────────────────────────────

/** Truncate a StyledLine to fit within `maxW` columns, adding "…" if clipped. */
export function truncateLine(line: StyledLine, maxW: number): StyledLine {
  if (maxW <= 0) return [];
  const total = lineWidth(line);
  if (total <= maxW) return line;

  const result: Span[] = [];
  let remaining = maxW - 1; // reserve 1 col for "…"

  for (const s of line) {
    const sw = stringWidth(s.text);
    if (sw <= remaining) {
      result.push(s);
      remaining -= sw;
    } else {
      // Partial span: clip character by character
      let clipped = "";
      for (const ch of s.text) {
        const cw = stringWidth(ch);
        if (cw > remaining) break;
        clipped += ch;
        remaining -= cw;
      }
      if (clipped) result.push({ ...s, text: clipped });
      break;
    }
  }

  // Append ellipsis with the last span's style
  const lastStyle = result[result.length - 1] ?? {};
  result.push({ text: "…", fg: lastStyle.fg, dim: lastStyle.dim });
  return result;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Draw a StyledLine into the buffer at absolute row `absRow`,
 * starting at the left edge of `r` and clipping to `r.width`.
 *
 * @returns Map of clickId → { col, width } for hit-testing
 */
export function drawStyledLine(
  buf:    CellBuffer,
  r:      Rect,
  absRow: number,
  line:   StyledLine,
  opts:   { align?: "left" | "center" | "right"; highlightBg?: number } = {},
): Map<string, { col: number; width: number }> {
  const hits = new Map<string, { col: number; width: number }>();

  if (absRow < r.y || absRow >= r.y + r.height || r.width <= 0) return hits;

  const { align = "left", highlightBg } = opts;

  // If a selection highlight is active, paint the full row background first
  if (highlightBg !== undefined) {
    buf.write(absRow, r.x, " ".repeat(r.width), { bg: highlightBg });
  }

  // Truncate to fit
  const truncated = truncateLine(line, r.width);
  const totalW    = lineWidth(truncated);

  // Alignment offset
  let xOff = 0;
  if (align === "center") xOff = Math.floor((r.width - totalW) / 2);
  else if (align === "right") xOff = Math.max(0, r.width - totalW);

  let col = r.x + xOff;

  for (const s of truncated) {
    const style: Style = {
      fg:        s.fg,
      bg:        highlightBg !== undefined ? highlightBg : s.bg,
      bold:      s.bold,
      dim:       highlightBg !== undefined ? false : s.dim,
      italic:    s.italic,
      underline: s.underline,
    };

    const sw = stringWidth(s.text);

    if (s.clickId) {
      hits.set(s.clickId, { col, width: sw });
    }

    buf.write(absRow, col, s.text, style);
    col += sw;
  }

  return hits;
}

/**
 * Draw multiple StyledLines into a Rect, one per row, starting at r.y.
 *
 * @returns number of rows drawn
 */
export function drawStyledLines(
  buf:   CellBuffer,
  r:     Rect,
  lines: StyledLine[],
  opts:  { align?: "left" | "center" | "right" } = {},
): number {
  const count = Math.min(lines.length, r.height);
  for (let i = 0; i < count; i++) {
    drawStyledLine(buf, r, r.y + i, lines[i]!, opts);
  }
  return count;
}

// ─── Conversion from plain strings ────────────────────────────────────────────

/** Convert a plain string + style into a single-span StyledLine. */
export function fromString(text: string, style: Style = {}): StyledLine {
  return [{ text, ...style }];
}

/** Convert a StyledLine back to a plain string (strip styles). */
export function toString(line: StyledLine): string {
  return lineText(line);
}
