/**
 * File freshness tracking — enforces read-before-edit.
 *
 * Every successful read_file records the file's mtime. edit_file / multi_edit /
 * write_file (on existing files) refuse to run if the file was never read this
 * session, or if it changed on disk after the last read (user edit, linter,
 * another tool). This is the guard that stops the model from clobbering
 * changes it has never seen — and with per-request model routing, the model
 * serving this turn may literally never have seen the file even if "the
 * conversation" has.
 */

import { statSync } from "node:fs";

interface FileReadState {
  /** mtime (ms) of the file when it was last read or written by us. */
  timestamp: number;
}

const fileState = new Map<string, FileReadState>();

/** Record a successful read (or our own write) of absPath. */
export function recordFileRead(absPath: string): void {
  try {
    fileState.set(absPath, { timestamp: statSync(absPath).mtimeMs });
  } catch { /* file vanished between operations — treat as unread */ }
}

/**
 * May the model mutate absPath? Returns a model-actionable error string,
 * or null when the edit is allowed.
 */
export function checkMutationAllowed(absPath: string, mustExist: boolean): string | null {
  const state = fileState.get(absPath);
  if (!state) {
    return mustExist
      ? "Error: File has not been read yet. Use read_file on it first, then retry the edit."
      : null; // write_file creating a brand-new file needs no prior read
  }
  try {
    const mtime = statSync(absPath).mtimeMs;
    if (mtime > state.timestamp) {
      return "Error: File has been modified since it was last read (by the user, a linter, or another process). Use read_file again to see the current contents, then retry.";
    }
  } catch { /* stat failed — let the tool surface its own error */ }
  return null;
}

/** Session reset (e.g. /clear). */
export function clearFileState(): void {
  fileState.clear();
}
