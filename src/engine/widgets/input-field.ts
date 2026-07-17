/**
 * KlaatTUI — InputField widget.
 *
 * A multiline text editor with cursor, scrolling, and history navigation.
 * This is the centrepiece input widget — it replaces the Ink-based
 * <TextInput> used in the Ink REPL.
 *
 * Architecture:
 *   - Text is stored as `_lines: string[]` (one entry per logical line).
 *   - `_row` / `_col` are the cursor position (0-indexed into the line string
 *     by grapheme — not byte offset, so Unicode is handled correctly).
 *   - `render()` draws the visible window and sets `buf.cursorTarget`.
 *   - `handleKey()` processes a KeyEvent and returns true if consumed.
 *
 * Supported key bindings:
 *   Printable chars     — insert at cursor
 *   Enter               — newline (or submit if singleLine)
 *   Backspace           — delete char before cursor
 *   Delete              — delete char at cursor
 *   Left / Right        — move cursor horizontally
 *   Up / Down           — move cursor vertically (or history in singleLine)
 *   Home / End          — start / end of line
 *   ctrl+Home / ctrl+End — first / last line
 *   Alt+Left / Alt+Right — word left / word right
 *   Ctrl+A / Ctrl+E     — home / end (readline style)
 *   Ctrl+K              — kill to end of line
 *   Ctrl+U              — clear entire field
 *   Ctrl+W              — delete word before cursor
 *   Ctrl+C              — NOT handled (caller should wire this to app.quit)
 *
 * History:
 *   Call historyPrev(history) / historyNext(history) from arrow-key handlers
 *   when in singleLine mode to cycle through past inputs.
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type KeyEvent } from "../input.js";
import { stringWidth } from "../input.js";
import { type Rect } from "../layout.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split a string into an array of grapheme clusters (one JS string per grapheme). */
function graphemes(s: string): string[] {
  // Bun / Node 18+ support Intl.Segmenter; fall back to [...s] for V8 < 16.
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new (Intl as unknown as { Segmenter: new (locale: string, opts: object) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter("en", { granularity: "grapheme" });
    return [...seg.segment(s)].map((x) => x.segment);
  }
  return [...s];
}

/** Visual column of grapheme index `col` within `line`. */
function visualCol(line: string, col: number): number {
  return stringWidth(graphemesSlice(line, 0, col));
}

/** Slice a line by grapheme index. */
function graphemesSlice(line: string, start: number, end?: number): string {
  const gs = graphemes(line);
  return gs.slice(start, end).join("");
}

/** Length in graphemes. */
function graphemeLen(line: string): number {
  return graphemes(line).length;
}

/** Insert a string at a grapheme index. */
function graphemeInsert(line: string, col: number, text: string): string {
  const gs = graphemes(line);
  gs.splice(col, 0, ...graphemes(text));
  return gs.join("");
}

/** Delete `count` graphemes starting at index `col`. */
function graphemeDelete(line: string, col: number, count = 1): string {
  const gs = graphemes(line);
  gs.splice(col, count);
  return gs.join("");
}

/** Index of the previous word boundary (for Ctrl+W / Alt+Left). */
function prevWordBoundary(line: string, col: number): number {
  const gs = graphemes(line);
  let i = col - 1;
  // Skip trailing spaces
  while (i > 0 && gs[i] === " ") i--;
  // Skip word chars
  while (i > 0 && gs[i - 1] !== " ") i--;
  return Math.max(0, i);
}

/** Index of the next word boundary (for Alt+Right). */
function nextWordBoundary(line: string, col: number): number {
  const gs = graphemes(line);
  const len = gs.length;
  let i = col;
  // Skip leading spaces
  while (i < len && gs[i] === " ") i++;
  // Skip word chars
  while (i < len && gs[i] !== " ") i++;
  return i;
}

// ─── InputField ───────────────────────────────────────────────────────────────

export interface InputFieldOpts {
  /** Placeholder shown when the field is empty. */
  placeholder?: string;
  placeholderStyle?: Style;
  /** If true, Enter submits instead of inserting a newline. */
  singleLine?: boolean;
  /** Max length in graphemes (0 = unlimited). */
  maxLength?: number;
}

export class InputField {
  private _lines:      string[]  = [""];
  private _row:        number    = 0;  // cursor line (0-indexed)
  private _col:        number    = 0;  // cursor grapheme index within line
  private _scrollTop:  number    = 0;  // first visible line in the Rect

  // Mouse selection (grapheme positions); null = no selection.
  private _selA: { row: number; col: number } | null = null;
  private _selB: { row: number; col: number } | null = null;

  // History state
  private _histIdx:    number    = -1; // -1 = not browsing history
  private _histDraft:  string    = ""; // saved draft while browsing

  /** Called when the user presses Enter (singleLine) or Ctrl+Enter. */
  onSubmit?: (text: string) => void;

  /** Called on every keypress that changes the value. */
  onChange?: (text: string) => void;

  // ─── Value accessors ────────────────────────────────────────────────

  /** Full text value (lines joined with \n). */
  get value(): string {
    return this._lines.join("\n");
  }

  set value(v: string) {
    this._lines  = v.split("\n");
    if (this._lines.length === 0) this._lines = [""];
    this._row    = this._lines.length - 1;
    this._col    = graphemeLen(this._lines[this._row]!);
    this._scrollTop = 0;
  }

  /** Clear the field and reset cursor. */
  clear(): void {
    this._lines   = [""];
    this._row     = 0;
    this._col     = 0;
    this._scrollTop = 0;
    this._histIdx  = -1;
    this._histDraft = "";
  }

  /** Move cursor to the end of the content. */
  cursorToEnd(): void {
    this._row = this._lines.length - 1;
    this._col = graphemeLen(this._lines[this._row]!);
  }

  /**
   * Insert pasted text at the current cursor position.
   * Handles multi-line paste by splitting on newlines.
   */
  paste(text: string): void {
    const pasteLines = text.split("\n");
    for (let i = 0; i < pasteLines.length; i++) {
      const segment = pasteLines[i]!;
      // Insert text into current line
      if (segment) {
        const line = this._lines[this._row]!;
        this._lines[this._row] = graphemeInsert(line, this._col, segment);
        this._col += graphemes(segment).length;
      }
      // Insert newline between segments (not after the last)
      if (i < pasteLines.length - 1) {
        this._insertNewline();
      }
    }
    this._emit();
  }

  // ─── History ────────────────────────────────────────────────────────

  /**
   * Navigate to the previous history entry (older).
   * Only meaningful in singleLine mode.
   */
  historyPrev(history: string[]): void {
    if (history.length === 0) return;
    if (this._histIdx === -1) {
      this._histDraft = this.value;
    }
    const next = Math.min(this._histIdx + 1, history.length - 1);
    if (next !== this._histIdx) {
      this._histIdx = next;
      this.value    = history[history.length - 1 - next]!;
    }
  }

  /**
   * Navigate to the next history entry (newer), or back to draft.
   */
  historyNext(history: string[]): void {
    if (this._histIdx === -1) return;
    const next = this._histIdx - 1;
    if (next < 0) {
      this._histIdx = -1;
      this.value    = this._histDraft;
    } else {
      this._histIdx = next;
      this.value    = history[history.length - 1 - next]!;
    }
  }

  /** Reset history navigation (call after successful submit). */
  historyReset(): void {
    this._histIdx  = -1;
    this._histDraft = "";
  }

  // ─── Key handling ────────────────────────────────────────────────────

  /**
   * Handle a KeyEvent. Returns true if the key was consumed.
   * The caller should call app.requestRender() if this returns true.
   */
  handleKey(ev: KeyEvent, opts: InputFieldOpts = {}): boolean {
    const { singleLine = false, maxLength = 0 } = opts;
    const key = ev.key;

    // Any keystroke dismisses a mouse selection highlight.
    if (this._selA) this.clearSelection();

    switch (key) {
      // ── Cursor movement ────────────────────────────────────────────
      case "left":       this._moveLeft();            return true;
      case "right":      this._moveRight();           return true;
      case "up":         this._moveUp(singleLine);    return true;
      case "down":       this._moveDown(singleLine);  return true;
      case "home":
      case "ctrl+a":     this._col = 0;               return true;
      case "end":
      case "ctrl+e":
        this._col = graphemeLen(this._lines[this._row]!);
        return true;
      case "ctrl+home":
        this._row = 0; this._col = 0; this._scrollTop = 0;
        return true;
      case "ctrl+end":
        this._row = this._lines.length - 1;
        this._col = graphemeLen(this._lines[this._row]!);
        return true;
      case "alt+left":
        this._col = prevWordBoundary(this._lines[this._row]!, this._col);
        return true;
      case "alt+right":
        this._col = nextWordBoundary(this._lines[this._row]!, this._col);
        return true;

      // ── Deletion ───────────────────────────────────────────────────
      case "backspace":  this._backspace();            return true;
      case "delete":     this._deleteForward();        return true;
      case "ctrl+k":     this._killToEnd();            return true;
      case "ctrl+u":
        this._lines = [""]; this._row = 0; this._col = 0;
        this._scrollTop = 0;
        this._emit();
        return true;
      case "ctrl+w":     this._deleteWordBack();       return true;

      // ── Submit ─────────────────────────────────────────────────────
      case "enter":
        if (singleLine) {
          this.onSubmit?.(this.value);
        } else {
          this._insertNewline();
        }
        return true;

      default:
        // Printable char
        if (ev.char && !ev.ctrl && !ev.alt) {
          if (maxLength > 0) {
            const total = this._lines.reduce((s, l) => s + graphemeLen(l), 0) + this._lines.length - 1;
            if (total >= maxLength) return true;
          }
          this._insert(ev.char);
          return true;
        }
        return false;
    }
  }

  // ─── Edit operations ─────────────────────────────────────────────────

  private _insert(char: string): void {
    const line         = this._lines[this._row]!;
    this._lines[this._row] = graphemeInsert(line, this._col, char);
    this._col         += graphemes(char).length;
    this._emit();
  }

  private _insertNewline(): void {
    const line  = this._lines[this._row]!;
    const before = graphemesSlice(line, 0, this._col);
    const after  = graphemesSlice(line, this._col);
    this._lines[this._row] = before;
    this._lines.splice(this._row + 1, 0, after);
    this._row++;
    this._col = 0;
    this._emit();
  }

  private _backspace(): void {
    if (this._col > 0) {
      const line = this._lines[this._row]!;
      this._lines[this._row] = graphemeDelete(line, this._col - 1);
      this._col--;
      this._emit();
    } else if (this._row > 0) {
      // Merge with previous line
      const prevLine = this._lines[this._row - 1]!;
      const curLine  = this._lines[this._row]!;
      this._col = graphemeLen(prevLine);
      this._lines[this._row - 1] = prevLine + curLine;
      this._lines.splice(this._row, 1);
      this._row--;
      this._emit();
    }
  }

  private _deleteForward(): void {
    const line = this._lines[this._row]!;
    if (this._col < graphemeLen(line)) {
      this._lines[this._row] = graphemeDelete(line, this._col);
      this._emit();
    } else if (this._row < this._lines.length - 1) {
      // Merge next line into current
      this._lines[this._row] = line + this._lines[this._row + 1]!;
      this._lines.splice(this._row + 1, 1);
      this._emit();
    }
  }

  private _killToEnd(): void {
    const line = this._lines[this._row]!;
    if (this._col < graphemeLen(line)) {
      this._lines[this._row] = graphemesSlice(line, 0, this._col);
      this._emit();
    } else if (this._row < this._lines.length - 1) {
      // Join next line
      this._deleteForward();
    }
  }

  private _deleteWordBack(): void {
    const boundary = prevWordBoundary(this._lines[this._row]!, this._col);
    const line     = this._lines[this._row]!;
    this._lines[this._row] = graphemesSlice(line, 0, boundary) + graphemesSlice(line, this._col);
    this._col = boundary;
    this._emit();
  }

  // ─── Cursor movement ──────────────────────────────────────────────────

  private _moveLeft(): void {
    if (this._col > 0) {
      this._col--;
    } else if (this._row > 0) {
      this._row--;
      this._col = graphemeLen(this._lines[this._row]!);
    }
  }

  private _moveRight(): void {
    const lineLen = graphemeLen(this._lines[this._row]!);
    if (this._col < lineLen) {
      this._col++;
    } else if (this._row < this._lines.length - 1) {
      this._row++;
      this._col = 0;
    }
  }

  private _moveUp(singleLine: boolean): void {
    if (singleLine) return; // caller handles history
    if (this._row > 0) {
      this._row--;
      this._col = Math.min(this._col, graphemeLen(this._lines[this._row]!));
    }
  }

  private _moveDown(singleLine: boolean): void {
    if (singleLine) return;
    if (this._row < this._lines.length - 1) {
      this._row++;
      this._col = Math.min(this._col, graphemeLen(this._lines[this._row]!));
    }
  }

  // ─── onChange notify ──────────────────────────────────────────────────

  private _emit(): void {
    this.onChange?.(this.value);
  }

  // ─── Render ───────────────────────────────────────────────────────────

  /**
   * Soft-wrap the logical lines to `width`, producing visual rows. Each visual
   * row records which logical line and grapheme range it covers, so the cursor
   * can be mapped and horizontal overflow becomes a wrap to the next row
   * instead of scrolling off-screen.
   */
  private _wrap(width: number): {
    rows: { li: number; gStart: number; text: string }[];
    cursorVisual: number;
    cursorCol: number;
  } {
    const w = Math.max(1, width);
    const rows: { li: number; gStart: number; text: string }[] = [];
    let cursorVisual = 0, cursorCol = 0;

    for (let li = 0; li < this._lines.length; li++) {
      const gs = graphemes(this._lines[li]!);
      let gStart = 0, dw = 0, chunk = "";
      const flush = () => { rows.push({ li, gStart, text: chunk }); };

      for (let gi = 0; gi < gs.length; gi++) {
        const cw = stringWidth(gs[gi]!);
        if (dw + cw > w && chunk.length > 0) {
          flush();
          gStart = gi; dw = 0; chunk = "";
        }
        // Cursor sits just before grapheme gi on this logical line.
        if (li === this._row && gi === this._col) {
          cursorVisual = rows.length;
          cursorCol = dw;
        }
        chunk += gs[gi]!; dw += cw;
      }
      // Cursor at end of this logical line.
      if (li === this._row && this._col >= gs.length) {
        cursorVisual = rows.length;
        cursorCol = dw;
      }
      flush(); // always emit at least one (possibly empty) row per logical line
    }
    return { rows, cursorVisual, cursorCol };
  }

  /** Number of visual lines the current content occupies given `width`. */
  visualRowCount(width: number): number {
    return this._wrap(width).rows.length;
  }

  // ─── Mouse selection ────────────────────────────────────────────────────

  /** Map a screen coordinate inside render-rect `r` to a grapheme position. */
  posFromScreen(x: number, y: number, r: Rect): { row: number; col: number } {
    const { rows } = this._wrap(r.width);
    let vis = this._scrollTop + (y - r.y);
    vis = Math.max(0, Math.min(rows.length - 1, vis));
    const vr = rows[vis]!;
    const gs = graphemes(vr.text);
    const targetVX = Math.max(0, x - r.x);
    let vx = 0, gi = 0;
    for (; gi < gs.length; gi++) {
      const cw = stringWidth(gs[gi]!);
      if (vx + cw > targetVX) break;
      vx += cw;
    }
    return { row: vr.li, col: vr.gStart + gi };
  }

  selectAnchor(pos: { row: number; col: number }): void { this._selA = pos; this._selB = pos; }
  selectExtend(pos: { row: number; col: number }): void { if (this._selA) this._selB = pos; }
  clearSelection(): void { this._selA = this._selB = null; }

  private _normSel(): { a: { row: number; col: number }; b: { row: number; col: number } } | null {
    if (!this._selA || !this._selB) return null;
    const a = this._selA, b = this._selB;
    const swap = a.row > b.row || (a.row === b.row && a.col > b.col);
    const lo = swap ? b : a, hi = swap ? a : b;
    if (lo.row === hi.row && lo.col === hi.col) return null; // empty
    return { a: lo, b: hi };
  }

  hasSelection(): boolean { return this._normSel() !== null; }

  /** The selected text, or "" if no selection. */
  selectedText(): string {
    const r = this._normSel();
    if (!r) return "";
    const { a, b } = r;
    if (a.row === b.row) return graphemesSlice(this._lines[a.row]!, a.col, b.col);
    let out = graphemesSlice(this._lines[a.row]!, a.col);
    for (let li = a.row + 1; li < b.row; li++) out += "\n" + this._lines[li]!;
    out += "\n" + graphemesSlice(this._lines[b.row]!, 0, b.col);
    return out;
  }

  /**
   * Render the field into `r`, soft-wrapping long input across `r.height` rows.
   * Sets `buf.cursorTarget`. Caller should showCursor() before rendering.
   */
  render(
    buf:   CellBuffer,
    r:     Rect,
    style: Style = { fg: "white" },
    opts:  InputFieldOpts = {},
  ): void {
    const { placeholder = "", placeholderStyle = { fg: "gray" } } = opts;
    if (r.width <= 0 || r.height <= 0) return;

    const isEmpty = this._lines.length === 1 && this._lines[0] === "";
    if (isEmpty && placeholder) {
      buf.write(r.y, r.x, placeholder.slice(0, r.width), placeholderStyle);
      buf.cursorTarget = { row: r.y, col: r.x };
      return;
    }

    const { rows, cursorVisual, cursorCol } = this._wrap(r.width);

    // Keep the cursor's visual row in view (scroll in visual-row units).
    if (cursorVisual < this._scrollTop) this._scrollTop = cursorVisual;
    if (cursorVisual >= this._scrollTop + r.height) this._scrollTop = cursorVisual - r.height + 1;
    const maxTop = Math.max(0, rows.length - r.height);
    this._scrollTop = Math.max(0, Math.min(this._scrollTop, maxTop));

    for (let i = 0; i < r.height; i++) {
      const row = rows[this._scrollTop + i];
      if (row) buf.write(r.y + i, r.x, row.text, style);
    }

    // Paint selection highlight over the drawn cells.
    const sel = this._normSel();
    if (sel) {
      for (let i = 0; i < r.height; i++) {
        const row = rows[this._scrollTop + i];
        if (!row) continue;
        const gs = graphemes(row.text);
        const winStart = row.gStart, winEnd = row.gStart + gs.length;
        // Selected grapheme range on this logical line for this visual row.
        const lineSelStart = row.li < sel.a.row ? Infinity : row.li > sel.b.row ? -Infinity
          : (row.li === sel.a.row ? sel.a.col : 0);
        const lineSelEnd = row.li < sel.a.row ? -Infinity : row.li > sel.b.row ? Infinity
          : (row.li === sel.b.row ? sel.b.col : winEnd);
        const s = Math.max(winStart, lineSelStart);
        const e = Math.min(winEnd, lineSelEnd);
        if (s >= e) continue;
        // Visual columns for [s,e) within this row.
        let vx = 0;
        for (let g = 0; g < gs.length; g++) {
          const cw = stringWidth(gs[g]!);
          const gi = winStart + g;
          if (gi >= s && gi < e) {
            buf.write(r.y + i, r.x + vx, gs[g]!, { ...style, bg: 238 });
          }
          vx += cw;
        }
      }
    }

    const screenRow = cursorVisual - this._scrollTop;
    if (screenRow >= 0 && screenRow < r.height) {
      buf.cursorTarget = { row: r.y + screenRow, col: r.x + Math.min(cursorCol, r.width - 1) };
    }
  }
}
