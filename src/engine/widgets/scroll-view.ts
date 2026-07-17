/**
 * KlaatTUI — ScrollView widget.
 *
 * A ScrollView clips a list of pre-formatted lines to a visible viewport
 * and tracks a `scrollTop` offset so the user can scroll through content
 * larger than the Rect.
 *
 * Design:
 *   - Works with an array of line strings (caller owns wrapping).
 *   - Renders only lines [scrollTop, scrollTop + viewHeight).
 *   - Exposes scroll helpers and scroll-position metadata.
 *   - Does NOT manage key bindings — the caller does that and calls
 *     scroll() / scrollToBottom() / etc.
 *
 * Usage:
 *   const sv = new ScrollView();
 *   sv.scrollToBottom(lines.length, r.height); // stick to bottom
 *
 *   // In render:
 *   sv.render(buf, r, lines, { fg: "white" });
 *
 *   // On key "down":
 *   sv.scroll(1, lines.length, r.height);
 *   app.requestRender();
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type Rect } from "../layout.js";
import { drawTextLine } from "./text.js";

// ─── Scroll metadata ──────────────────────────────────────────────────────────

export interface ScrollInfo {
  scrollTop:    number;
  viewHeight:   number;
  totalLines:   number;
  canScrollUp:  boolean;
  canScrollDown:boolean;
  /** Fraction 0–1 of how far down we are (for a scrollbar thumb). */
  thumbPos:     number;
  /** Fraction 0–1 of how big the thumb is relative to the view. */
  thumbSize:    number;
}

// ─── ScrollView ───────────────────────────────────────────────────────────────

export class ScrollView {
  scrollTop: number = 0;

  /**
   * Scroll by `delta` lines, clamped to valid range.
   * Positive = scroll down (content moves up), negative = scroll up.
   */
  scroll(delta: number, totalLines: number, viewHeight: number): void {
    const maxTop = Math.max(0, totalLines - viewHeight);
    this.scrollTop = Math.max(0, Math.min(this.scrollTop + delta, maxTop));
  }

  /** Jump to the first line. */
  scrollToTop(): void {
    this.scrollTop = 0;
  }

  /** Clamp scrollTop so the last line is visible. */
  scrollToBottom(totalLines: number, viewHeight: number): void {
    this.scrollTop = Math.max(0, totalLines - viewHeight);
  }

  /** Jump so that line `lineIndex` is visible (scrolls minimally). */
  ensureVisible(lineIndex: number, viewHeight: number): void {
    if (lineIndex < this.scrollTop) {
      this.scrollTop = lineIndex;
    } else if (lineIndex >= this.scrollTop + viewHeight) {
      this.scrollTop = lineIndex - viewHeight + 1;
    }
  }

  /** Compute scroll metadata (used for rendering a scrollbar or status). */
  info(totalLines: number, viewHeight: number): ScrollInfo {
    const maxTop    = Math.max(0, totalLines - viewHeight);
    const top       = Math.max(0, Math.min(this.scrollTop, maxTop));
    const thumbSize = totalLines > 0
      ? Math.min(1, viewHeight / totalLines)
      : 1;
    const thumbPos  = totalLines > viewHeight
      ? top / (totalLines - viewHeight)
      : 0;

    return {
      scrollTop:    top,
      viewHeight,
      totalLines,
      canScrollUp:  top > 0,
      canScrollDown:top < maxTop,
      thumbPos,
      thumbSize,
    };
  }

  /**
   * Render `lines[scrollTop .. scrollTop + r.height]` into `r`.
   *
   * Each element of `lines` is a single screen line (no newlines).
   * Lines are drawn left-aligned; the caller is responsible for word-wrapping
   * before calling render().
   *
   * @returns ScrollInfo for this frame
   */
  render(
    buf:   CellBuffer,
    r:     Rect,
    lines: string[],
    style: Style = {},
  ): ScrollInfo {
    const info = this.info(lines.length, r.height);

    for (let row = 0; row < r.height; row++) {
      const lineIdx = info.scrollTop + row;
      const line    = lines[lineIdx] ?? "";
      drawTextLine(buf, r, r.y + row, line, style, { ellipsis: false });
    }

    return info;
  }

  /**
   * Render a minimal 1-column scrollbar on the right edge of `r`.
   *
   * Draws "▲" at top, "▼" at bottom, "█" for the thumb, "│" for the track.
   * Call this after render() using the ScrollInfo it returned.
   */
  renderScrollbar(
    buf:   CellBuffer,
    r:     Rect,
    info:  ScrollInfo,
    style: Style = { fg: "gray" },
    thumbStyle: Style = { fg: "white" },
  ): void {
    if (r.height < 3 || !info.canScrollUp && !info.canScrollDown) return;

    const col     = r.x + r.width - 1;
    const trackH  = r.height - 2; // exclude top/bottom arrows

    buf.write(r.y,            col, "▲", style);
    buf.write(r.y + r.height - 1, col, "▼", style);

    const thumbH   = Math.max(1, Math.round(info.thumbSize  * trackH));
    const thumbOff = Math.round(info.thumbPos * (trackH - thumbH));

    for (let i = 0; i < trackH; i++) {
      const isThumb = i >= thumbOff && i < thumbOff + thumbH;
      buf.write(r.y + 1 + i, col, isThumb ? "█" : "│", isThumb ? thumbStyle : style);
    }
  }
}
