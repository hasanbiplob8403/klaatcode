/**
 * Klaatu — the Klaat Code mascot (reserved for future use).
 *
 * A friendly little robot with a dark visor, glowing purple eyes,
 * and a rounded white body — matching the KlaatAI brand mascot.
 * Rendered as per-segment colored rows so eyes/visor glow
 * independently of the body.
 *
 * Currently not displayed in the welcome screen, but kept for
 * future use in notifications, loading states, or error screens.
 */

export interface MascotSeg { text: string; fg?: string; bold?: boolean }
export type MascotRow = MascotSeg[];

const BODY  = "#e8e8f0";
const VISOR = "#1a1a2e";
const EYE   = "#c084fc";
const MOUTH = "#d8b4fe";
const ARM   = "#d4d4e0";

function robot(eyeL: string, eyeR: string, mouth: string, armL: string, armR: string): MascotRow[] {
  return [
    [{ text: "  ╭───╮", fg: BODY }],
    [{ text: " ╭┤", fg: BODY }, { text: "▓▓▓", fg: VISOR }, { text: "├╮", fg: BODY }],
    [{ text: " │", fg: BODY }, { text: "▌", fg: VISOR }, { text: eyeL, fg: EYE, bold: true },
     { text: " ", fg: VISOR }, { text: eyeR, fg: EYE, bold: true }, { text: "▐", fg: VISOR }, { text: "│", fg: BODY }],
    [{ text: " │", fg: BODY }, { text: "▌", fg: VISOR }, { text: " ", fg: VISOR },
     { text: mouth, fg: MOUTH, bold: true }, { text: " ", fg: VISOR }, { text: "▐", fg: VISOR }, { text: "│", fg: BODY }],
    [{ text: " ╰┤", fg: BODY }, { text: "▓▓▓", fg: VISOR }, { text: "├╯", fg: BODY }],
    [{ text: armL, fg: ARM, bold: true }, { text: "╭───╮", fg: BODY }, { text: armR, fg: ARM, bold: true }],
    [{ text: " ╰───╯", fg: BODY }],
    [{ text: "  ╱ ╲", fg: BODY }],
  ];
}

export const MASCOT = {
  idle:     robot("◉", "◉", "◡", "ᗒ", "ᗕ"),
  thinking: robot("◔", "◔", "―", " ", " "),
  happy:    robot("^", "^", "◡", "ᗒ", "ᗕ"),
  working:  robot("▪", "▪", "―", " ", " "),
} as const satisfies Record<string, MascotRow[]>;

export type MascotMood = keyof typeof MASCOT;

export function mascotWidth(rows: MascotRow[]): number {
  return Math.max(...rows.map(r => r.reduce((w, s) => w + [...s.text].length, 0)));
}
