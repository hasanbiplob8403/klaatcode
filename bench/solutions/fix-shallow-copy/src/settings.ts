export interface Config {
  ui: { theme: string; font: string };
  version: number;
}

export function withTheme(config: Config, theme: string): Config {
  return { ...config, ui: { ...config.ui, theme } };
}
