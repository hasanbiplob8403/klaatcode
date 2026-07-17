import type { PartialConfig } from "./types";

/** Simulated contents of klaatapp.config.json checked into the deploy repo. */
let fileConfig: PartialConfig = {};

export function setFileConfig(cfg: PartialConfig): void { fileConfig = cfg; }
export function loadFileConfig(): PartialConfig { return { ...fileConfig }; }
