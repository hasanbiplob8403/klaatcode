/**
 * KlaatTUI — TabBar widget.
 *
 * Horizontal tab switcher rendered as a single row.
 * Used for switching between agents (Build / Plan / Shell).
 *
 * Visual:
 *   ┃ ◆ Build │ ◇ Plan │ ◇ Shell ┃
 *
 * The active tab is highlighted with a filled diamond (◆) and bold text;
 * inactive tabs use an open diamond (◇) and dimmed text.
 *
 * Usage:
 *   const tabs = new TabBar(["Build", "Plan", "Shell"]);
 *   tabs.render(buf, r, { activeColor: "#d8b4fe" });
 *   // On Tab key:
 *   tabs.next();
 *   app.requestRender();
 */

import { type CellBuffer, type Style } from "../buffer.js";
import { type Rect } from "../layout.js";
import { type Color } from "../color.js";
import { stringWidth } from "../input.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tab {
  label:  string;
  /** Optional per-tab accent color (overrides activeColor). */
  color?: Color;
}

export interface TabBarOpts {
  activeColor?:   Color;
  inactiveColor?: Color;
  borderColor?:   Color;
  separator?:     string;
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

export class TabBar {
  private _tabs:   Tab[];
  private _active: number = 0;

  constructor(tabs: (string | Tab)[]) {
    this._tabs = tabs.map((t) =>
      typeof t === "string" ? { label: t } : t
    );
  }

  get active(): number { return this._active; }
  get activeTab(): Tab { return this._tabs[this._active]!; }
  get count(): number { return this._tabs.length; }

  /** Set the active tab by index. */
  setActive(index: number): void {
    this._active = Math.max(0, Math.min(index, this._tabs.length - 1));
  }

  /** Cycle to the next tab. */
  next(): void {
    this._active = (this._active + 1) % this._tabs.length;
  }

  /** Cycle to the previous tab. */
  prev(): void {
    this._active = (this._active - 1 + this._tabs.length) % this._tabs.length;
  }

  /** Get tab by index. */
  tab(index: number): Tab | undefined {
    return this._tabs[index];
  }

  // ─── Render ──────────────────────────────────────────────────────────

  /**
   * Render the tab bar into a single row at `r.y`.
   * The bar occupies the full width of `r`.
   */
  render(
    buf:  CellBuffer,
    r:    Rect,
    opts: TabBarOpts = {},
  ): void {
    const {
      activeColor   = "#d8b4fe",
      inactiveColor = "gray",
      borderColor   = "#555",
      separator     = " │ ",
    } = opts;

    if (r.height <= 0 || r.width <= 0) return;

    const row = r.y;
    let col = r.x;

    // Left border
    buf.write(row, col, "┃", { fg: borderColor });
    col += 2;

    for (let i = 0; i < this._tabs.length; i++) {
      const tab      = this._tabs[i]!;
      const isActive = i === this._active;
      const color    = tab.color ?? (isActive ? activeColor : inactiveColor);
      const icon     = isActive ? "◆" : "◇";

      const style: Style = {
        fg:   color,
        bold: isActive,
        dim:  !isActive,
      };

      buf.write(row, col, icon, style);
      col += 2;
      buf.write(row, col, tab.label, style);
      col += stringWidth(tab.label);

      // Separator between tabs
      if (i < this._tabs.length - 1) {
        buf.write(row, col, separator, { fg: borderColor, dim: true });
        col += stringWidth(separator);
      }
    }

    // Right padding + border
    col += 1;
    buf.write(row, col, "┃", { fg: borderColor });
  }
}
