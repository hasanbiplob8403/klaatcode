/**
 * Session helpers — logout + whoami.
 *
 * Auth is browser-OAuth (subscription JWT) only; the interactive command lives
 * in main.tsx (`klaatai login`). There is no API-key login path.
 */

import chalk from "chalk";
import { getAuthToken, loadCredentials, saveCredentials } from "./credentials.js";
import { KlaatAIClient } from "../api/client.js";

/** Run the `klaatai logout` command — clear stored credentials. */
export function runLogout(): void {
  saveCredentials({});
  console.log(chalk.yellow("  Signed out. Credentials cleared."));
}

/** Run the `klaatai whoami` command. */
export async function runWhoami(baseUrl: string): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    console.log(chalk.yellow("  Not signed in. Run: klaatai login"));
    return;
  }
  const client = new KlaatAIClient({ apiKey: token, baseUrl });
  try {
    const info = await client.ping();
    const creds = loadCredentials();
    console.log();
    if (creds.email) console.log(chalk.bold("  Account:  ") + creds.email);
    if (creds.plan)  console.log(chalk.bold("  Plan:     ") + creds.plan);
    console.log(chalk.bold("  Session:  ") + "subscription (JWT)");
    console.log(chalk.bold("  Backend:  ") + (info.status === "ok" ? chalk.green("Online") : chalk.red("Offline")));
    console.log();
  } catch {
    console.error(chalk.red("  Could not reach KlaatAI API."));
  }
}
