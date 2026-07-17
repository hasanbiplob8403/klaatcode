import { emit } from "../metrics/registry";

export function uploadFile(sizeBytes: number): boolean {
  emit("uploads.completed", 1, { kind: "binary" });
  emit("uploads.bytes", sizeBytes);
  return sizeBytes > 0;
}
