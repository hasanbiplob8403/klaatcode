import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  gitRemote: string | null;
}

function getGitRemote(cwd: string): string | null {
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf-8" });
  if (r.status !== 0) return null;
  return r.stdout.trim() || null;
}

function repoBasename(remote: string | null): string {
  if (!remote) return "";
  const clean = remote.replace(/\.git$/, "");
  return clean.split("/").pop()?.split(":").pop() ?? "";
}

/** sha256(remote + "|" + name)[:16] — matches Desktop and VS Code formula exactly. */
function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export function resolveProjectId(rootPath: string): ProjectInfo | null {
  const remote = getGitRemote(rootPath);
  const name = repoBasename(remote) || basename(rootPath);
  const id = sha16(`${remote ?? ""}|${name}`);
  return { id, name, rootPath, gitRemote: remote };
}
