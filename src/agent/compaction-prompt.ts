/**
 * Structured compaction — the summary that replaces compacted history.
 *
 * Modeled on Claude Code's 9-section compact prompt: the summary must let a
 * model that never saw the original turns (with per-request routing, that is
 * literally the common case) resume the task without re-deriving anything.
 * The model writes an <analysis> scratchpad first (stripped before the
 * summary enters context), then the structured summary. Tool-free bracketing:
 * on some routed models a stray tool call would waste the summary turn.
 */

export const COMPACTION_PROMPT = `IMPORTANT: Respond with TEXT ONLY. Do not call any tools — tool calls will be rejected and waste this turn.

Summarize the conversation above so a different AI model with NO memory of it can resume the work seamlessly.

First, inside an <analysis> block, briefly review the conversation and check you have captured everything (this block will be discarded).

Then write a <summary> block with EXACTLY these sections:

1. **Task & intent** — what the user asked for, in order, including their exact wording for the current request.
2. **Key technical concepts** — frameworks, APIs, conventions in play.
3. **Files touched** — every file read/edited/created that still matters: path, what was done to it, and any code snippet a resuming model would need.
4. **Errors & fixes** — every error hit and how it was fixed; include any user corrections verbatim.
5. **Pending tasks** — what remains, in priority order.
6. **Current state** — precisely what was in progress at the moment of this summary.
7. **Next step** — the immediate next action, quoting the most recent instructions verbatim so nothing drifts.

Omit pleasantries. Be complete but dense — this summary REPLACES the conversation.

Respond with the <analysis> block then the <summary> block and nothing else.`;

/** Strip the <analysis> scratchpad and <summary> wrapper from the model output. */
export function extractSummary(raw: string): string {
  let s = raw.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "").trim();
  const m = s.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/i);
  if (m) s = m[1]!.trim();
  return s || raw.trim();
}

/**
 * Circuit breaker — after this many consecutive compaction failures, stop
 * auto-retrying (Claude Code measured runaway compact-retry loops burning
 * hundreds of thousands of calls fleet-wide before adding this).
 */
export const MAX_CONSECUTIVE_COMPACT_FAILURES = 3;
