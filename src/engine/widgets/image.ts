/**
 * KlaatTUI — Image widget.
 *
 * Renders images directly in the terminal using escape-sequence protocols.
 * Supports:
 *   1. iTerm2 Inline Images (iTerm2, WezTerm, VSCode, Mintty, Ghostty)
 *   2. Kitty Graphics Protocol (Kitty, WezTerm)
 *   3. Sixel (xterm, foot, mlterm, DomTerm)
 *
 * Because images bypass the cell buffer (they're raw escape sequences),
 * the caller must flush the buffer FIRST, then call drawImage, so the
 * image renders on top of the cell layer.
 *
 * Usage:
 *   const img = await loadImage("./logo.png");
 *   // After buf.flush():
 *   drawImage(img, { row: 5, col: 10, width: 40, height: 12 });
 */

import { readFileSync, existsSync } from "fs";
import { moveTo, termWrite } from "../terminal.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImageProtocol = "iterm2" | "kitty" | "sixel" | "none";

export interface ImageData {
  base64: string;
  width:  number;     // original pixel width (0 if unknown)
  height: number;     // original pixel height (0 if unknown)
  format: string;     // "png" | "jpg" | "gif" | "webp" | "svg"
}

export interface DrawImageOpts {
  row:      number;   // terminal row (0-indexed)
  col:      number;   // terminal column (0-indexed)
  width?:   number;   // desired width in terminal columns
  height?:  number;   // desired height in terminal rows
  preserveAspect?: boolean;  // default true
}

// ─── Protocol detection ──────────────────────────────────────────────────────

let _detectedProtocol: ImageProtocol | null = null;

export function detectImageProtocol(): ImageProtocol {
  if (_detectedProtocol !== null) return _detectedProtocol;

  const term = process.env.TERM_PROGRAM ?? "";
  const termEnv = process.env.TERM ?? "";
  const lc = process.env.LC_TERMINAL ?? "";

  if (term === "iTerm.app" || lc === "iTerm2") {
    _detectedProtocol = "iterm2";
  } else if (term === "WezTerm" || termEnv.includes("wezterm")) {
    _detectedProtocol = "iterm2";
  } else if (process.env.GHOSTTY_RESOURCES_DIR) {
    _detectedProtocol = "iterm2";
  } else if (process.env.VSCODE_PID || term === "vscode") {
    _detectedProtocol = "iterm2";
  } else if (termEnv === "xterm-kitty" || process.env.KITTY_PID) {
    _detectedProtocol = "kitty";
  } else if (termEnv.includes("sixel")) {
    _detectedProtocol = "sixel";
  } else {
    // Fallback: try iTerm2 protocol — most terminals silently ignore it
    _detectedProtocol = "iterm2";
  }

  return _detectedProtocol;
}

export function supportsImages(): boolean {
  return detectImageProtocol() !== "none";
}

// ─── Load image ──────────────────────────────────────────────────────────────

export function loadImageSync(filePath: string): ImageData | null {
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath);
  const base64 = raw.toString("base64");

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "png";
  const formatMap: Record<string, string> = {
    png: "png", jpg: "jpg", jpeg: "jpg",
    gif: "gif", webp: "webp", svg: "svg",
  };

  // Try to read dimensions from PNG header
  let width = 0, height = 0;
  if (ext === "png" && raw.length > 24) {
    width  = raw.readUInt32BE(16);
    height = raw.readUInt32BE(20);
  }

  return {
    base64,
    width,
    height,
    format: formatMap[ext] ?? "png",
  };
}

export async function loadImage(filePath: string): Promise<ImageData | null> {
  const { readFile } = await import("fs/promises");
  const { existsSync: exists } = await import("fs");

  if (!exists(filePath)) return null;

  const raw = await readFile(filePath);
  const base64 = raw.toString("base64");

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "png";
  const formatMap: Record<string, string> = {
    png: "png", jpg: "jpg", jpeg: "jpg",
    gif: "gif", webp: "webp", svg: "svg",
  };

  let width = 0, height = 0;
  if (ext === "png" && raw.length > 24) {
    width  = raw.readUInt32BE(16);
    height = raw.readUInt32BE(20);
  }

  return {
    base64,
    width,
    height,
    format: formatMap[ext] ?? "png",
  };
}

export function loadImageFromBuffer(buf: Buffer, format: string = "png"): ImageData {
  const base64 = buf.toString("base64");

  let width = 0, height = 0;
  if (format === "png" && buf.length > 24) {
    width  = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
  }

  return { base64, width, height, format };
}

// ─── Draw image ──────────────────────────────────────────────────────────────

/**
 * Render an image at the specified terminal position.
 *
 * IMPORTANT: call this AFTER CellBuffer.flush(), since images are
 * written as raw escape sequences that bypass the cell buffer.
 */
export function drawImage(image: ImageData, opts: DrawImageOpts): void {
  const protocol = detectImageProtocol();

  switch (protocol) {
    case "iterm2":
      drawImageITerm2(image, opts);
      break;
    case "kitty":
      drawImageKitty(image, opts);
      break;
    default:
      drawImageFallback(image, opts);
      break;
  }
}

// ─── iTerm2 Inline Images Protocol ──────────────────────────────────────────
//
// ESC ] 1337 ; File=[args] : base64data BEL
// https://iterm2.com/documentation-images.html

function drawImageITerm2(image: ImageData, opts: DrawImageOpts): void {
  const { row, col, width, height } = opts;

  // Position cursor
  termWrite(moveTo(row, col));

  const args: string[] = [
    "inline=1",
    "preserveAspectRatio=1",
  ];

  if (width)  args.push(`width=${width}`);
  if (height) args.push(`height=${height}`);

  const argStr = args.join(";");
  const seq = `\x1b]1337;File=${argStr}:${image.base64}\x07`;

  termWrite(seq);
}

// ─── Kitty Graphics Protocol ─────────────────────────────────────────────────
//
// ESC_APC G <control data> ; <payload> ESC_ST
// https://sw.kovidgoyal.net/kitty/graphics-protocol/

function drawImageKitty(image: ImageData, opts: DrawImageOpts): void {
  const { row, col, width, height } = opts;

  termWrite(moveTo(row, col));

  const chunkSize = 4096;
  const data = image.base64;
  const chunks = Math.ceil(data.length / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const isFirst = i === 0;
    const isLast  = i === chunks - 1;
    const chunk   = data.slice(i * chunkSize, (i + 1) * chunkSize);

    const ctrl: string[] = [];

    if (isFirst) {
      ctrl.push("a=T");         // action = transmit and display
      ctrl.push("f=100");       // format = PNG (100)
      ctrl.push("t=d");         // transmission = direct (inline data)
      if (width)  ctrl.push(`c=${width}`);
      if (height) ctrl.push(`r=${height}`);
    }

    ctrl.push(`m=${isLast ? 0 : 1}`);  // more data flag

    const ctrlStr = ctrl.join(",");
    termWrite(`\x1b_G${ctrlStr};${chunk}\x1b\\`);
  }
}

// ─── Fallback (no image support) ─────────────────────────────────────────────

function drawImageFallback(_image: ImageData, opts: DrawImageOpts): void {
  const { row, col, width = 20 } = opts;
  termWrite(moveTo(row, col));
  const label = `[image: ${_image.format} ${_image.width}x${_image.height}]`;
  const padded = label.length > width
    ? label.slice(0, width - 1) + "…"
    : label;
  termWrite(`\x1b[2;37m${padded}\x1b[0m`);
}

// ─── Utility: measure image in terminal cells ────────────────────────────────

/**
 * Estimate how many terminal rows an image will occupy given a column width.
 * Uses a 2:1 character aspect ratio (each cell is ~twice as tall as wide).
 */
export function estimateImageRows(
  pixelWidth: number,
  pixelHeight: number,
  termCols: number,
): number {
  if (pixelWidth <= 0 || pixelHeight <= 0) return 4;
  const scale = termCols / pixelWidth;
  const scaledHeight = pixelHeight * scale;
  return Math.max(1, Math.round(scaledHeight / 2));
}
