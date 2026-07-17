/**
 * Full-screen welcome card — rendered into the chat body while the transcript
 * is empty. Bordered, vertically-centered content: big KLAAT CODE wordmark,
 * greeting, two columns of tips, tier-flow value prop, and project footer.
 */

import {
  CellBuffer, type Rect,
  drawBorder, drawStyledLine, span, stringWidth,
  type Span, type ThemePalette,
} from "../engine/index.js";
import { homedir } from "node:os";

// ─── Big block-letter wordmark (same as splash screen) ────────────────────────

const KLAAT_ROWS = [
  " ██╗  ██╗██╗      █████╗  █████╗ ████████╗",
  " ██║ ██╔╝██║     ██╔══██╗██╔══██╗╚══██╔══╝",
  " █████╔╝ ██║     ███████║███████║   ██║   ",
  " ██╔═██╗ ██║     ██╔══██║██╔══██║   ██║   ",
  " ██║  ██╗███████╗██║  ██║██║  ██║   ██║   ",
  " ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ",
];
const CODE_ROWS = [
  "  ██████╗ ██████╗ ██████╗ ███████╗",
  " ██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  " ██║     ██║   ██║██║  ██║█████╗  ",
  " ██║     ██║   ██║██║  ██║██╔══╝  ",
  " ╚██████╗╚██████╔╝██████╔╝███████╗",
  "  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
];
const WM_W = stringWidth(KLAAT_ROWS[0]! + CODE_ROWS[0]!);
const WM_H = KLAAT_ROWS.length;

export interface WelcomeCardOpts {
  palette: ThemePalette;
  version: string;
  userLabel?: string;
  projectRoot: string;
  hasProjectRules: boolean;
}

export function drawWelcomeCard(buf: CellBuffer, r: Rect, opts: WelcomeCardOpts): void {
  const { palette, version, userLabel, projectRoot, hasProjectRules } = opts;
  const accent = palette.accent;
  const dimFg  = palette.mutedFg;

  const cx = r.x + 1;
  const cy = r.y + 1;
  const cw = r.width - 2;
  const ch = r.height - 2;
  if (cw < 20 || ch < 10) return;

  drawBorder(buf, { x: cx, y: cy, width: cw, height: ch }, {
    style: "rounded",
    fg: palette.border,
    title: " ✦ Klaat Code ",
    titleRight: ` v${version} `,
    titleStyle: { fg: accent, bold: true },
  });

  const inX = cx + 3;
  const inW = cw - 6;
  const maxX = cx + cw - 1; // rightmost drawable column

  const centered = (y: number, segs: Span[]) => {
    const wdt = segs.reduce((a, s) => a + stringWidth(s.text), 0);
    const x = cx + Math.max(0, Math.floor((cw - wdt) / 2));
    drawStyledLine(buf, { x, y, width: Math.min(wdt, maxX - x), height: 1 }, y, segs);
  };

  // Determine if wordmark fits; fall back to compact text if too narrow
  const showWordmark = cw >= WM_W + 4;
  const blockH = (showWordmark ? WM_H : 1) + 14;
  let y = cy + Math.max(2, Math.floor((ch - blockH) / 2));

  // ── Big KLAAT CODE wordmark (or compact fallback) ─────────────────────────
  if (showWordmark) {
    const wmX = cx + Math.max(0, Math.floor((cw - WM_W) / 2));
    for (let i = 0; i < WM_H; i++) {
      const kRow = KLAAT_ROWS[i] ?? "";
      const cRow = CODE_ROWS[i]  ?? "";
      buf.write(y, wmX, kRow, { bold: true });
      buf.write(y, wmX + stringWidth(kRow), cRow, { fg: accent, bold: true });
      y++;
    }
  } else {
    centered(y, [
      span("KLAAT ", { fg: "white", bold: true }),
      span("CODE", { fg: accent, bold: true }),
    ]);
    y++;
  }
  y += 1;

  // Tagline
  const tagText = cw > 50 ? "smart-routed AI coding  ·  more for less" : "smart-routed AI coding";
  centered(y, [span(tagText, { fg: dimFg })]);
  y += 2;

  // Greeting
  centered(y, [
    span(userLabel ? `Welcome back, ${userLabel}` : "Welcome", { fg: "white", bold: true }),
  ]);
  y += 2;

  // Two-column layout or single column when narrow
  const useTwoCols = inW >= 60;
  const leftRows: Span[][] = [
    [span("→ ", { fg: accent }), span("type a prompt to start coding", { fg: dimFg })],
    [span("→ ", { fg: accent }), span("@file", { fg: 75, bold: true }), span(" to reference a file", { fg: dimFg })],
    [span("→ ", { fg: accent }), span("/model", { fg: 75, bold: true }), span(" to pin a routing tier", { fg: dimFg })],
  ];
  const rightRows: Span[][] = [
    [span("Tab", { fg: 75, bold: true }), span("     switch agent", { fg: dimFg })],
    [span("Ctrl+P", { fg: 75, bold: true }), span("  command palette", { fg: dimFg })],
    [span("/help", { fg: 75, bold: true }), span("   all commands", { fg: dimFg })],
  ];

  if (useTwoCols) {
    const colGap = 4;
    const colW = Math.min(30, Math.floor((inW - colGap) / 2));
    const blockW = colW * 2 + colGap;
    const bx = cx + Math.max(inX - cx, Math.floor((cw - blockW) / 2));
    const rx = bx + colW + colGap;

    drawStyledLine(buf, { x: bx, y, width: colW, height: 1 }, y, [span("Getting started", { fg: accent, bold: true })]);
    drawStyledLine(buf, { x: rx, y, width: colW, height: 1 }, y, [span("Shortcuts", { fg: accent, bold: true })]);
    y += 1;
    for (let i = 0; i < 3; i++) {
      drawStyledLine(buf, { x: bx, y, width: colW, height: 1 }, y, leftRows[i]!);
      drawStyledLine(buf, { x: rx, y, width: colW, height: 1 }, y, rightRows[i]!);
      y += 1;
    }
  } else {
    drawStyledLine(buf, { x: inX, y, width: inW, height: 1 }, y, [span("Getting started", { fg: accent, bold: true })]);
    y += 1;
    for (const row of leftRows) {
      drawStyledLine(buf, { x: inX, y, width: inW, height: 1 }, y, row);
      y += 1;
    }
    y += 1;
    drawStyledLine(buf, { x: inX, y, width: inW, height: 1 }, y, [span("Shortcuts", { fg: accent, bold: true })]);
    y += 1;
    for (const row of rightRows) {
      drawStyledLine(buf, { x: inX, y, width: inW, height: 1 }, y, row);
      y += 1;
    }
  }
  y += 2;

  // Value prop (only if there's enough width)
  if (inW >= 55) {
    centered(y, [
      span("nano", { fg: 250 }), span(" → ", { fg: dimFg }),
      span("fast", { fg: 87 }), span(" → ", { fg: dimFg }),
      span("code", { fg: 75 }), span(" → ", { fg: dimFg }),
      span("reason", { fg: 213 }), span(" → ", { fg: dimFg }),
      span("heavy", { fg: 204 }),
      ...(inW >= 80 ? [span("   chosen per request · tool calls are free", { fg: dimFg })] : []),
    ]);
  }

  // Footer
  const fy = cy + ch - 2;
  if (fy <= y) return;
  const projPath = projectRoot.replace(homedir(), "~");
  const maxPathW = Math.max(10, inW - 22);
  const shownPath = stringWidth(projPath) > maxPathW ? "…" + projPath.slice(-(maxPathW - 1)) : projPath;
  const footL: Span[] = [
    span("● ", { fg: 114 }),
    span(shownPath, { fg: dimFg }),
    ...(hasProjectRules && inW > 40 ? [span("  ·  ", { fg: dimFg }), span("rules loaded", { fg: 114 })] : []),
  ];
  drawStyledLine(buf, { x: inX, y: fy, width: inW, height: 1 }, fy, footL);
  if (inW > 40) {
    const hint: Span[] = [span("Type below to begin", { fg: dimFg })];
    const hintW = hint.reduce((a, s) => a + stringWidth(s.text), 0);
    const hintX = Math.min(cx + cw - 3 - hintW, maxX - hintW);
    if (hintX > inX + stringWidth(shownPath) + 8) {
      drawStyledLine(buf, { x: hintX, y: fy, width: hintW, height: 1 }, fy, hint);
    }
  }
}
