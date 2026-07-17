/**
 * KlaatTUI — Spinner widget.
 *
 * Provides animated spinner frame sequences and a Spinner class that
 * drives an interval timer and notifies the caller on each tick so
 * they can call app.requestRender().
 *
 * Pre-built frame sets:
 *   SPINNER_DOTS   — braille dot cycle (10 frames, 80 ms default)
 *   SPINNER_LINE   — classic ASCII  -\|/ (4 frames, 120 ms default)
 *   SPINNER_ARC    — arc sweep (6 frames, 80 ms)
 *   SPINNER_PULSE  — ▬/─ two-frame for PulseBar (28 ms)
 *   SPINNER_BOUNCE — left-right bounce (9 frames, 60 ms)
 *
 * Usage:
 *   const spinner = new Spinner(SPINNER_DOTS);
 *   spinner.start(() => app.requestRender());
 *   // in render:
 *   buf.write(row, col, spinner.frame, { fg: "#d8b4fe" });
 *   // stop:
 *   spinner.stop();
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type Rect } from "../layout.js";

// ─── Frame sets ───────────────────────────────────────────────────────────────

export const SPINNER_DOTS: string[] = [
  "⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏",
];

export const SPINNER_LINE: string[] = ["-", "\\", "|", "/"];

export const SPINNER_ARC: string[] = ["◜","◠","◝","◞","◡","◟"];

/** Two-frame PulseBar (▬ vs ─) for the input busy indicator. */
export const SPINNER_PULSE: string[] = ["▬", "─"];

export const SPINNER_BOUNCE: string[] = [
  "⠁","⠂","⠄","⠠","⠐","⠈","⠁","⠂","⠄",
];

// ─── Spinner class ────────────────────────────────────────────────────────────

export class Spinner {
  private _frames:   string[];
  private _index:    number = 0;
  private _timer:    ReturnType<typeof setInterval> | null = null;
  private _onTick:   (() => void) | null = null;
  readonly defaultMs: number;

  constructor(frames: string[] = SPINNER_DOTS, defaultMs = 80) {
    this._frames   = frames;
    this.defaultMs = defaultMs;
  }

  /** Current animation frame string. */
  get frame(): string {
    return this._frames[this._index % this._frames.length]!;
  }

  /** Whether the spinner is currently running. */
  get running(): boolean {
    return this._timer !== null;
  }

  /**
   * Start the animation. `onTick` is called after each frame advance
   * so the caller can schedule a re-render.
   *
   * Safe to call while already running (re-starts with new interval).
   */
  start(onTick: () => void, ms?: number): void {
    this.stop();
    this._onTick = onTick;
    const interval = ms ?? this.defaultMs;
    this._timer = setInterval(() => {
      this._index = (this._index + 1) % this._frames.length;
      this._onTick?.();
    }, interval);
    // Prevent the interval from keeping the process alive
    if (this._timer && typeof this._timer === "object" && "unref" in this._timer) {
      (this._timer as NodeJS.Timeout).unref();
    }
  }

  /** Stop the animation and reset to frame 0. */
  stop(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._index  = 0;
    this._onTick = null;
  }

  /** Stop without resetting frame index (keeps last frame visible). */
  pause(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

// ─── PulseBar ─────────────────────────────────────────────────────────────────

/**
 * PulseBar — the horizontal scanning bar shown while the assistant is busy.
 *
 * Based on REPL.tsx design: a segment (28% of width) of "▬" chars slides
 * across a background of "─" chars, left-to-right, looping.
 *
 * Usage:
 *   const pb = new PulseBar();
 *   pb.start(() => app.requestRender());
 *   // in render:
 *   pb.draw(buf, r, { fg: "#d8b4fe" });
 *   pb.stop();
 */
export class PulseBar {
  private _pos:    number = 0;
  private _timer:  ReturnType<typeof setInterval> | null = null;
  private _onTick: (() => void) | null = null;

  /** Start the pulse animation. */
  start(onTick: () => void, ms = 28): void {
    this.stop();
    this._onTick = onTick;
    this._timer = setInterval(() => {
      this._pos++;
      this._onTick?.();
    }, ms);
    if (this._timer && typeof this._timer === "object" && "unref" in this._timer) {
      (this._timer as NodeJS.Timeout).unref();
    }
  }

  stop(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._pos    = 0;
    this._onTick = null;
  }

  /**
   * Draw the pulse bar into `r` (single row — r.height is ignored).
   * The bar is drawn at row `r.y`.
   */
  draw(
    buf:   CellBuffer,
    r:     Rect,
    style: Style = {},
    dimStyle: Style = {},
  ): void {
    const w       = r.width;
    if (w <= 0) return;

    const segW    = Math.max(1, Math.round(w * 0.28));
    const offset  = this._pos % (w + segW); // total travel = width + segW

    for (let i = 0; i < w; i++) {
      // Is column i within the segment?
      const inSeg = i >= offset - segW && i < offset;
      const char  = inSeg ? "▬" : "─";
      const s     = inSeg ? style : dimStyle;
      buf.write(r.y, r.x + i, char, s);
    }
  }
}
