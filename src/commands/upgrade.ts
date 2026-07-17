/**
 * `klaatai upgrade` — self-update through whichever channel installed us.
 *
 * Channel detection is path-based on the resolved binary location:
 *   node_modules/            → npm  (npm i -g klaatcode@latest)
 *   Cellar/ | linuxbrew/     → brew (brew upgrade klaatcode)
 *   ~/.klaatcode/            → curl / PowerShell installer (re-run it)
 *   running via bun src/     → source checkout (git pull)
 *
 * The installers are idempotent by design — re-running them IS the upgrade.
 */

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { checkForUpdate } from "../utils/update.js";
import { version as VERSION } from "../../package.json";

export type InstallChannel =
  | "npm"
  | "brew"
  | "installer"          // curl -fsSL klaatai.com/api/install | bash
  | "installer-windows"  // irm klaatai.com/api/install-windows | iex
  | "source"
  | "unknown";

export function detectInstallChannel(): InstallChannel {
  let exe = process.execPath;
  try { exe = realpathSync(exe); } catch { /* keep unresolved */ }

  // Dev: `bun run src/main.tsx` — execPath is the bun runtime itself.
  const script = process.argv[1] ?? "";
  if (basename(exe) === "bun" || /\.(ts|tsx)$/.test(script)) return "source";

  const p = exe.replace(/\\/g, "/");
  if (p.includes("/node_modules/")) return "npm";
  if (p.includes("/Cellar/") || p.includes("/linuxbrew/")) return "brew";

  const installerDir = join(homedir(), ".klaatcode").replace(/\\/g, "/");
  if (p.startsWith(installerDir)) {
    return process.platform === "win32" ? "installer-windows" : "installer";
  }
  return "unknown";
}

const CHANNEL_COMMANDS: Record<Exclude<InstallChannel, "source" | "unknown">, { label: string; cmd: string[] }> = {
  npm:  { label: "npm",       cmd: ["npm", "install", "-g", "klaatcode@latest"] },
  brew: { label: "Homebrew",  cmd: ["brew", "upgrade", "KlaatAI/klaatcode/klaatcode"] },
  installer: {
    label: "install script",
    cmd: ["bash", "-c", "curl -fsSL https://klaatai.com/api/install | bash"],
  },
  "installer-windows": {
    label: "install script",
    cmd: ["powershell", "-NoProfile", "-Command", "irm https://klaatai.com/api/install-windows | iex"],
  },
};

const BOLD = "\x1b[1m", DIM = "\x1b[2m", CYAN = "\x1b[36m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", RED = "\x1b[31m", RESET = "\x1b[0m";

/** Entry point for `klaatai upgrade [--check]`. Exits the process. */
export async function runUpgrade(opts: { check?: boolean } = {}): Promise<never> {
  process.stdout.write(`${DIM}Current version:${RESET} v${VERSION}\n`);
  process.stdout.write(`${DIM}Checking latest…${RESET}\n`);

  const info = await checkForUpdate(true);
  if (!info) {
    process.stderr.write(`${RED}✗${RESET} Could not reach https://klaatai.com/api/latest — check your connection and retry.\n`);
    process.exit(1);
  }

  if (!info.updateAvailable) {
    process.stdout.write(`${GREEN}✓${RESET} Up to date — running v${info.current}, latest release v${info.latest}.\n`);
    process.exit(0);
  }

  process.stdout.write(`${CYAN}Update available:${RESET} v${info.current} → ${BOLD}v${info.latest}${RESET}\n`);
  if (opts.check) process.exit(0);

  const channel = detectInstallChannel();

  if (channel === "source") {
    process.stdout.write(`\nRunning from a source checkout — upgrade with:\n  ${BOLD}git pull && bun install${RESET}\n`);
    process.exit(0);
  }
  if (channel === "unknown") {
    process.stdout.write(
      `\n${YELLOW}⚠${RESET} Could not detect how this copy was installed (${DIM}${process.execPath}${RESET}).\n` +
      `Upgrade manually with whichever you used to install:\n` +
      `  npm i -g klaatcode@latest\n` +
      `  brew upgrade KlaatAI/klaatcode/klaatcode\n` +
      `  curl -fsSL https://klaatai.com/api/install | bash\n` +
      `  irm https://klaatai.com/api/install-windows | iex\n`,
    );
    process.exit(1);
  }

  const { label, cmd } = CHANNEL_COMMANDS[channel];
  process.stdout.write(`${DIM}Installed via ${label} — running:${RESET} ${cmd.join(" ")}\n\n`);

  const res = spawnSync(cmd[0]!, cmd.slice(1), { stdio: "inherit" });
  if (res.error || res.status !== 0) {
    process.stderr.write(`\n${RED}✗${RESET} Upgrade command failed${res.status != null ? ` (exit ${res.status})` : ""}.\n`);
    process.exit(res.status ?? 1);
  }

  process.stdout.write(`\n${GREEN}✓${RESET} Upgraded to v${info.latest}. Restart klaatcode to use the new version.\n`);
  process.exit(0);
}
