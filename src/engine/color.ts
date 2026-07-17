/**
 * KlaatTUI — Color utilities.
 *
 * Supports:
 *   - Named ANSI colors  ("red", "cyan", "gray", etc.)
 *   - 24-bit hex RGB     ("#d8b4fe")
 *   - 8-bit indexed      (0-255)
 *   - null               (default terminal color)
 *
 * Automatically detects true-color support via COLORTERM env var.
 * Falls back to nearest 256-color approximation on terminals that
 * don't support 24-bit color (e.g. macOS Terminal.app).
 */

export type Color = string | number | null;

// ─── True-color support detection ─────────────────────────────────────────────

const COLORTERM = (process.env.COLORTERM ?? "").toLowerCase();
const TERM_PROGRAM = (process.env.TERM_PROGRAM ?? "").toLowerCase();

/**
 * True if the terminal supports 24-bit RGB color sequences.
 * Detected via COLORTERM=truecolor|24bit, or known terminal programs.
 * macOS Terminal.app is explicitly excluded (only supports 256 colors).
 */
export const SUPPORTS_TRUECOLOR: boolean = (() => {
  if (TERM_PROGRAM === "apple_terminal") return false;
  if (COLORTERM === "truecolor" || COLORTERM === "24bit") return true;
  if (
    TERM_PROGRAM === "iterm.app" ||
    TERM_PROGRAM === "iterm2" ||
    TERM_PROGRAM === "hyper" ||
    TERM_PROGRAM === "wezterm" ||
    TERM_PROGRAM === "ghostty" ||
    TERM_PROGRAM === "vscode" ||
    TERM_PROGRAM === "kitty" ||
    TERM_PROGRAM === "alacritty"
  ) return true;
  return false;
})();

// ─── Named color → ANSI code ──────────────────────────────────────────────────

const FG_NAMED: Record<string, number> = {
  black:          30,
  red:            31,
  green:          32,
  yellow:         33,
  blue:           34,
  magenta:        35,
  cyan:           36,
  white:          37,
  gray:           90,
  grey:           90,
  "bright-red":   91,
  "bright-green": 92,
  "bright-yellow":93,
  "bright-blue":  94,
  "bright-magenta":95,
  "bright-cyan":  96,
  "bright-white": 97,
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/**
 * Convert an RGB color to the nearest xterm 256-color index.
 * Uses the 6×6×6 color cube (indices 16–231) and the grayscale
 * ramp (indices 232–255), returning whichever is closest.
 */
function rgbTo256(r: number, g: number, b: number): number {
  // Check if it's close to grayscale
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }

  // Map to 6×6×6 color cube (indices 16–231)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  const cubeIdx = 16 + 36 * ri + 6 * gi + bi;

  // Also check nearest grayscale
  const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const grayIdx = gray < 8 ? 16 : gray > 248 ? 231 : Math.round((gray - 8) / 247 * 24) + 232;

  // Compare distances to decide cube vs grayscale
  const cubeR = ri * 51, cubeG = gi * 51, cubeB = bi * 51;
  const cubeDist = (r - cubeR) ** 2 + (g - cubeG) ** 2 + (b - cubeB) ** 2;

  const grayVal = grayIdx <= 16 ? 0 : grayIdx >= 231 ? 255 : (grayIdx - 232) * 10 + 8;
  const grayDist = (r - grayVal) ** 2 + (g - grayVal) ** 2 + (b - grayVal) ** 2;

  return grayDist < cubeDist ? grayIdx : cubeIdx;
}

/** ANSI foreground code for a Color value. */
export function fgCode(color: Color): string {
  if (color === null)           return "\x1b[39m";           // default fg
  if (typeof color === "number") return `\x1b[38;5;${color}m`; // 8-bit
  if (color.startsWith("#")) {
    const rgb = hexToRgb(color);
    if (!rgb) return "";
    if (SUPPORTS_TRUECOLOR) {
      return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;     // 24-bit
    }
    return `\x1b[38;5;${rgbTo256(rgb[0], rgb[1], rgb[2])}m`; // 256-color fallback
  }
  const code = FG_NAMED[color.toLowerCase()];
  return code !== undefined ? `\x1b[${code}m` : "";
}

/** ANSI background code for a Color value. */
export function bgCode(color: Color): string {
  if (color === null)           return "\x1b[49m";
  if (typeof color === "number") return `\x1b[48;5;${color}m`;
  if (color.startsWith("#")) {
    const rgb = hexToRgb(color);
    if (!rgb) return "";
    if (SUPPORTS_TRUECOLOR) {
      return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    }
    return `\x1b[48;5;${rgbTo256(rgb[0], rgb[1], rgb[2])}m`; // 256-color fallback
  }
  const code = FG_NAMED[color.toLowerCase()];
  return code !== undefined ? `\x1b[${code + 10}m` : "";
}

// ─── Attribute codes ──────────────────────────────────────────────────────────

export const ANSI_RESET     = "\x1b[0m";
export const ANSI_BOLD      = "\x1b[1m";
export const ANSI_DIM       = "\x1b[2m";
export const ANSI_ITALIC    = "\x1b[3m";
export const ANSI_UNDERLINE = "\x1b[4m";
export const ANSI_STRIKE    = "\x1b[9m";

/** Build a full style prefix string (always resets first). */
export function buildStyle(opts: {
  fg?:        Color;
  bg?:        Color;
  bold?:      boolean;
  dim?:       boolean;
  italic?:    boolean;
  underline?: boolean;
  strike?:    boolean;
}): string {
  let s = ANSI_RESET;
  if (opts.fg !== undefined && opts.fg !== null) s += fgCode(opts.fg);
  if (opts.bg !== undefined && opts.bg !== null) s += bgCode(opts.bg);
  if (opts.bold)      s += ANSI_BOLD;
  if (opts.dim)       s += ANSI_DIM;
  if (opts.italic)    s += ANSI_ITALIC;
  if (opts.underline) s += ANSI_UNDERLINE;
  if (opts.strike)    s += ANSI_STRIKE;
  return s;
}
