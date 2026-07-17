/**
 * KlaatTUI — Hit-region system for mouse click detection.
 *
 * Maps screen coordinates to interactive elements (clickable file paths,
 * buttons, links, etc.). The HitGrid is rebuilt each render frame and
 * queried on mouse events.
 *
 * Architecture:
 *   - During render, widgets register hit regions via grid.add(id, rect).
 *   - On mouse click, grid.hitTest(col, row) returns the topmost region.
 *   - Regions have string IDs that map back to actions.
 *   - Supports z-index for overlapping regions (higher = on top).
 *
 * Usage:
 *   const grid = new HitGrid();
 *   // In render:
 *   grid.clear();
 *   grid.add("file:src/main.ts", { x: 5, y: 10, width: 20, height: 1 });
 *   // On mouse click:
 *   const hit = grid.hitTest(mouseX, mouseY);
 *   if (hit) openFile(hit.id);
 */

import { type Rect, contains } from "./layout.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HitRegion {
  id:      string;
  rect:    Rect;
  zIndex:  number;
  /** Optional metadata attached to the region. */
  data?:   unknown;
}

export interface HitResult {
  id:    string;
  /** The matched region. */
  region: HitRegion;
}

// ─── HitGrid ──────────────────────────────────────────────────────────────────

export class HitGrid {
  private _regions: HitRegion[] = [];

  /** Clear all registered regions (call at the start of each render frame). */
  clear(): void {
    this._regions.length = 0;
  }

  /** Register a hit region. */
  add(id: string, rect: Rect, zIndex = 0, data?: unknown): void {
    this._regions.push({ id, rect, zIndex, data });
  }

  /** Register a single-row hit region (convenience). */
  addRow(id: string, row: number, col: number, width: number, zIndex = 0, data?: unknown): void {
    this.add(id, { x: col, y: row, width, height: 1 }, zIndex, data);
  }

  /**
   * Test which region the given point falls in.
   * Returns the region with the highest z-index at that point, or null.
   */
  hitTest(col: number, row: number): HitResult | null {
    let best: HitRegion | null = null;

    for (const region of this._regions) {
      if (contains(region.rect, col, row)) {
        if (!best || region.zIndex > best.zIndex) {
          best = region;
        }
      }
    }

    return best ? { id: best.id, region: best } : null;
  }

  /** Get all regions at a point (all z-indices). */
  hitTestAll(col: number, row: number): HitResult[] {
    return this._regions
      .filter((r) => contains(r.rect, col, row))
      .sort((a, b) => b.zIndex - a.zIndex)
      .map((r) => ({ id: r.id, region: r }));
  }

  /** Check if the mouse is hovering over a specific region ID. */
  isHovered(id: string, col: number, row: number): boolean {
    return this._regions.some((r) => r.id === id && contains(r.rect, col, row));
  }

  /** Get region by ID (for highlighting on hover). */
  getRegion(id: string): HitRegion | undefined {
    return this._regions.find((r) => r.id === id);
  }

  /** Number of registered regions. */
  get count(): number {
    return this._regions.length;
  }
}
