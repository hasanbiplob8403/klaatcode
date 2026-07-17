/**
 * Plugins API — user-defined tools loaded from JavaScript modules.
 *
 * Locations (both scanned at startup):
 *   ~/.klaatai/plugins/*.js          — user-level
 *   <project>/.klaatai/tools/*.js    — project-level
 *
 * Plugin module format (default export):
 *   export default {
 *     name: "my-plugin",
 *     tools: [                       // OpenAI-style ToolDefinition[]
 *       { type: "function", function: { name: "my_tool", description: "…",
 *         parameters: { type: "object", properties: { q: { type: "string" } } } } },
 *     ],
 *     safeTools: ["my_tool"],        // optional: run without permission prompt
 *     async execute(toolCall, projectRoot) {
 *       const args = JSON.parse(toolCall.function.arguments);
 *       return "result string";
 *     },
 *   }
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolCall, ToolDefinition } from "../api/client.js";

interface PluginModule {
  name?: string;
  tools?: ToolDefinition[];
  safeTools?: string[];
  execute?: (tc: ToolCall, projectRoot: string) => Promise<string> | string;
}

export interface LoadedPlugin {
  name: string;
  file: string;
  scope: "global" | "project";
  tools: ToolDefinition[];
  safeTools: Set<string>;
  execute: (tc: ToolCall, projectRoot: string) => Promise<string> | string;
}

export interface PluginLoadError {
  file: string;
  error: string;
}

export class PluginRegistry {
  plugins: LoadedPlugin[] = [];
  errors: PluginLoadError[] = [];
  private _toolOwner = new Map<string, LoadedPlugin>();

  /** Scan plugin dirs and import every .js module. Errors are collected, never thrown. */
  async load(projectRoot: string): Promise<void> {
    this.plugins = [];
    this.errors = [];
    this._toolOwner.clear();

    const dirs: Array<{ dir: string; scope: "global" | "project" }> = [
      { dir: join(homedir(), ".klaatai", "plugins"), scope: "global" },
      { dir: join(projectRoot, ".klaatai", "tools"), scope: "project" },
    ];

    for (const { dir, scope } of dirs) {
      if (!existsSync(dir)) continue;
      let files: string[] = [];
      try { files = readdirSync(dir).filter(f => f.endsWith(".js") || f.endsWith(".mjs")); } catch { continue; }

      for (const f of files) {
        const file = join(dir, f);
        try {
          const mod = await import(pathToFileURL(file).href) as { default?: PluginModule };
          const p = mod.default;
          if (!p || typeof p.execute !== "function" || !Array.isArray(p.tools) || p.tools.length === 0) {
            this.errors.push({ file, error: "default export must have tools[] and execute()" });
            continue;
          }
          const loaded: LoadedPlugin = {
            name: p.name ?? f.replace(/\.(m?js)$/, ""),
            file,
            scope,
            tools: p.tools,
            safeTools: new Set(p.safeTools ?? []),
            execute: p.execute.bind(p),
          };
          for (const t of loaded.tools) {
            const tn = t.function.name;
            if (this._toolOwner.has(tn)) {
              this.errors.push({ file, error: `tool "${tn}" already registered by ${this._toolOwner.get(tn)!.name} — skipped` });
              continue;
            }
            this._toolOwner.set(tn, loaded);
          }
          this.plugins.push(loaded);
        } catch (err) {
          this.errors.push({ file, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  }

  get toolDefinitions(): ToolDefinition[] {
    // Only tools whose ownership won (dedup on collision).
    const out: ToolDefinition[] = [];
    for (const [tn, plugin] of this._toolOwner) {
      const def = plugin.tools.find(t => t.function.name === tn);
      if (def) out.push(def);
    }
    return out;
  }

  has(toolName: string): boolean {
    return this._toolOwner.has(toolName);
  }

  /** Safe = plugin explicitly declared the tool prompt-free. */
  isSafe(toolName: string): boolean {
    return this._toolOwner.get(toolName)?.safeTools.has(toolName) ?? false;
  }

  async call(tc: ToolCall, projectRoot: string): Promise<string> {
    const plugin = this._toolOwner.get(tc.function.name);
    if (!plugin) return `Error: no plugin provides tool "${tc.function.name}"`;
    try {
      const result = await plugin.execute(tc, projectRoot);
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      return `Plugin tool error (${plugin.name}/${tc.function.name}): ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
