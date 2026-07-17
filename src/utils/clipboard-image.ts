/**
 * Read a raw image (e.g. a screenshot) from the OS clipboard.
 *
 * Terminals only deliver *text* through paste events, so an image copied to
 * the clipboard never reaches onPaste — the user presses ctrl+v and we pull
 * the bytes straight from the OS:
 *   - macOS:  osascript (`the clipboard as «class PNGf»`) — no extra tools
 *   - Linux:  wl-paste (Wayland) or xclip (X11)
 *   - Windows: PowerShell System.Windows.Forms.Clipboard
 *
 * Returns null when the clipboard has no image or the platform tool is
 * missing — callers treat that as "nothing to attach", never an error.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ClipboardImage {
  b64: string;
  mime: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // API request-size guard

function fromMac(): ClipboardImage | null {
  // «data PNGf89504E47...» — AppleScript prints the PNG bytes as hex.
  const r = spawnSync("osascript", ["-e", "get the clipboard as «class PNGf»"], {
    encoding: "utf-8", timeout: 5_000, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return null;
  const m = /«data PNGf([0-9A-Fa-f]+)»/.exec(r.stdout);
  if (!m) return null;
  const buf = Buffer.from(m[1]!, "hex");
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { b64: buf.toString("base64"), mime: "image/png" };
}

function fromLinux(): ClipboardImage | null {
  for (const [cmd, args] of [
    ["wl-paste", ["-t", "image/png"]],
    ["xclip", ["-selection", "clipboard", "-t", "image/png", "-o"]],
  ] as const) {
    const r = spawnSync(cmd, args as unknown as string[], {
      timeout: 5_000, maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status === 0 && r.stdout && r.stdout.length > 8 && r.stdout.length <= MAX_IMAGE_BYTES) {
      return { b64: Buffer.from(r.stdout).toString("base64"), mime: "image/png" };
    }
  }
  return null;
}

function fromWindows(): ClipboardImage | null {
  const tmp = join(tmpdir(), `klaatai-clip-${process.pid}.png`);
  const script =
    "Add-Type -AssemblyName System.Windows.Forms; " +
    "$img = [System.Windows.Forms.Clipboard]::GetImage(); " +
    `if ($img) { $img.Save('${tmp}', [System.Drawing.Imaging.ImageFormat]::Png); 'ok' }`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf-8", timeout: 10_000,
  });
  if (r.status !== 0 || !r.stdout?.includes("ok")) return null;
  try {
    const buf = readFileSync(tmp);
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
    return { b64: buf.toString("base64"), mime: "image/png" };
  } catch {
    return null;
  } finally {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
  }
}

export function readClipboardImage(): ClipboardImage | null {
  try {
    switch (process.platform) {
      case "darwin": return fromMac();
      case "linux":  return fromLinux();
      case "win32":  return fromWindows();
      default:       return null;
    }
  } catch {
    return null;
  }
}
