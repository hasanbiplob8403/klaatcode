export interface Config {
  ui: { theme: string; font: string };
  version: number;
}

// withTheme(config, theme): return a NEW config with ui.theme replaced.
// Must not modify the original config. This implementation has a bug.
export function withTheme(config: Config, theme: string): Config {
  const next = { ...config };
  next.ui.theme = theme;
  return next;
}
