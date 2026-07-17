/**
 * Fuzzy edit engine — a cascade of increasingly tolerant matchers.
 *
 * Cheap/weak routed models often produce old_string values that are *almost*
 * right: trimmed differently, re-indented, whitespace-collapsed, or with
 * escape sequences mangled. Exact-match-only editing burns a whole model
 * round-trip on every near-miss. Each replacer below yields candidate
 * substrings of the file that plausibly correspond to what the model meant;
 * the first candidate that exists (uniquely, unless replace_all) wins.
 *
 * Ported from KlaatAI.VSCode src/tools/edit-replacers.ts (9-pass cascade).
 */

type Replacer = (content: string, find: string) => Generator<string, void, unknown>;

const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3;

function levenshtein(a: string, b: string): number {
  if (a === "" || b === "") return Math.max(a.length, b.length);
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost);
    }
  }
  return matrix[a.length]![b.length]!;
}

/** Pass 1 — exact match. */
const SimpleReplacer: Replacer = function* (_content, find) {
  yield find;
};

/** Pass 2 — match ignoring per-line leading/trailing whitespace. */
const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j]!.trim() !== searchLines[j]!.trim()) { matches = false; break; }
    }
    if (!matches) continue;

    let start = 0;
    for (let k = 0; k < i; k++) start += originalLines[k]!.length + 1;
    let end = start;
    for (let k = 0; k < searchLines.length; k++) {
      end += originalLines[i + k]!.length;
      if (k < searchLines.length - 1) end += 1;
    }
    yield content.substring(start, end);
  }
};

/** Pass 3 — anchor on first+last line, score middle by similarity. */
const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines.length < 3) return;
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  const firstLineSearch = searchLines[0]!.trim();
  const lastLineSearch = searchLines[searchLines.length - 1]!.trim();
  const searchBlockSize = searchLines.length;

  const candidates: Array<{ startLine: number; endLine: number }> = [];
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i]!.trim() !== firstLineSearch) continue;
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j]!.trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j });
        break;
      }
    }
  }
  if (candidates.length === 0) return;

  const extract = (startLine: number, endLine: number): string => {
    let start = 0;
    for (let k = 0; k < startLine; k++) start += originalLines[k]!.length + 1;
    let end = start;
    for (let k = startLine; k <= endLine; k++) {
      end += originalLines[k]!.length;
      if (k < endLine) end += 1;
    }
    return content.substring(start, end);
  };

  const similarityOf = (startLine: number, endLine: number): number => {
    const actualBlockSize = endLine - startLine + 1;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);
    if (linesToCheck <= 0) return 1.0;
    let similarity = 0;
    for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
      const originalLine = originalLines[startLine + j]!.trim();
      const searchLine = searchLines[j]!.trim();
      const maxLen = Math.max(originalLine.length, searchLine.length);
      if (maxLen === 0) continue;
      similarity += (1 - levenshtein(originalLine, searchLine) / maxLen) / linesToCheck;
    }
    return similarity;
  };

  if (candidates.length === 1) {
    // Single candidate — the anchors are unique, trust them.
    yield extract(candidates[0]!.startLine, candidates[0]!.endLine);
    return;
  }

  let bestMatch: { startLine: number; endLine: number } | null = null;
  let maxSimilarity = -1;
  for (const candidate of candidates) {
    const s = similarityOf(candidate.startLine, candidate.endLine);
    if (s > maxSimilarity) { maxSimilarity = s; bestMatch = candidate; }
  }
  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
    yield extract(bestMatch.startLine, bestMatch.endLine);
  }
};

/** Pass 4 — collapse all whitespace runs to single spaces. */
const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const normalizedFind = normalize(find);

  const lines = content.split("\n");
  for (const line of lines) {
    if (normalize(line) === normalizedFind) {
      yield line;
    } else if (normalize(line).includes(normalizedFind)) {
      const words = find.trim().split(/\s+/);
      if (words.length > 0) {
        const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
        try {
          const match = line.match(new RegExp(pattern));
          if (match) yield match[0];
        } catch { /* invalid pattern — skip */ }
      }
    }
  }

  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length);
      if (normalize(block.join("\n")) === normalizedFind) yield block.join("\n");
    }
  }
};

/** Pass 5 — match ignoring common leading indentation. */
const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const textLines = text.split("\n");
    const nonEmpty = textLines.filter(l => l.trim().length > 0);
    if (nonEmpty.length === 0) return text;
    const minIndent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)![1]!.length));
    return textLines.map(l => (l.trim().length === 0 ? l : l.slice(minIndent))).join("\n");
  };

  const normalizedFind = removeIndentation(find);
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n");
    if (removeIndentation(block) === normalizedFind) yield block;
  }
};

/** Pass 6 — undo literal escape sequences the model may have double-escaped. */
const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescape = (str: string): string =>
    str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, ch: string) => {
      switch (ch) {
        case "n": return "\n";
        case "t": return "\t";
        case "r": return "\r";
        case "'": return "'";
        case '"': return '"';
        case "`": return "`";
        case "\\": return "\\";
        case "\n": return "\n";
        case "$": return "$";
        default: return match;
      }
    });

  const unescapedFind = unescape(find);
  if (content.includes(unescapedFind)) yield unescapedFind;

  const lines = content.split("\n");
  const findLines = unescapedFind.split("\n");
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    if (unescape(block) === unescapedFind) yield block;
  }
};

/** Pass 7 — the model added/removed surrounding blank space. */
const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim();
  if (trimmedFind === find) return;
  if (content.includes(trimmedFind)) yield trimmedFind;

  const lines = content.split("\n");
  const findLines = find.split("\n");
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    if (block.trim() === trimmedFind) yield block;
  }
};

/** Pass 8 — anchor lines match and ≥50% of the middle agrees. */
const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n");
  if (findLines.length < 3) return;
  if (findLines[findLines.length - 1] === "") findLines.pop();

  const contentLines = content.split("\n");
  const firstLine = findLines[0]!.trim();
  const lastLine = findLines[findLines.length - 1]!.trim();

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i]!.trim() !== firstLine) continue;
    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j]!.trim() !== lastLine) continue;
      const blockLines = contentLines.slice(i, j + 1);
      if (blockLines.length === findLines.length) {
        let matching = 0, total = 0;
        for (let k = 1; k < blockLines.length - 1; k++) {
          const b = blockLines[k]!.trim();
          const f = findLines[k]!.trim();
          if (b.length > 0 || f.length > 0) {
            total++;
            if (b === f) matching++;
          }
        }
        if (total === 0 || matching / total >= 0.5) {
          yield blockLines.join("\n");
          break;
        }
      }
      break;
    }
  }
};

/** Pass 9 — exact match at any occurrence (replace_all support). */
const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0;
  while (true) {
    const index = content.indexOf(find, startIndex);
    if (index === -1) break;
    yield find;
    startIndex = index + find.length;
  }
};

const REPLACERS: Array<[string, Replacer]> = [
  ["exact", SimpleReplacer],
  ["line-trimmed", LineTrimmedReplacer],
  ["block-anchor", BlockAnchorReplacer],
  ["whitespace-normalized", WhitespaceNormalizedReplacer],
  ["indentation-flexible", IndentationFlexibleReplacer],
  ["escape-normalized", EscapeNormalizedReplacer],
  ["trimmed-boundary", TrimmedBoundaryReplacer],
  ["context-aware", ContextAwareReplacer],
  ["multi-occurrence", MultiOccurrenceReplacer],
];

export type ReplaceResult =
  | { ok: true; content: string; matchedBy: string; occurrences: number }
  | { ok: false; reason: "identical" | "not_found" | "multiple"; hint?: string };

/**
 * Replace oldString with newString in content using the fuzzy cascade.
 * Never throws — returns a result object with a model-actionable hint on failure.
 */
export function replaceInContent(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): ReplaceResult {
  if (oldString === newString) return { ok: false, reason: "identical" };

  let foundNonUnique = false;
  for (const [name, replacer] of REPLACERS) {
    for (const search of replacer(content, oldString)) {
      if (search === "") continue;
      const index = content.indexOf(search);
      if (index === -1) continue;
      if (replaceAll) {
        const occurrences = content.split(search).length - 1;
        return { ok: true, content: content.replaceAll(search, newString), matchedBy: name, occurrences };
      }
      if (index !== content.lastIndexOf(search)) { foundNonUnique = true; continue; }
      return {
        ok: true,
        content: content.substring(0, index) + newString + content.substring(index + search.length),
        matchedBy: name,
        occurrences: 1,
      };
    }
  }

  if (foundNonUnique) {
    return {
      ok: false,
      reason: "multiple",
      hint: "old_string matches multiple locations. Include more surrounding lines to make it unique, or pass replace_all: true to replace every occurrence.",
    };
  }
  return { ok: false, reason: "not_found", hint: closestMatchHint(content, oldString) };
}

/**
 * Best-effort pointer to where the model probably meant to edit —
 * turns a dead-end failure into a one-round-trip recovery.
 */
function closestMatchHint(content: string, oldString: string): string {
  const firstFindLine = oldString.split("\n").find(l => l.trim().length > 0)?.trim();
  if (!firstFindLine) return "old_string was empty or whitespace-only.";

  const lines = content.split("\n");
  let bestIdx = -1;
  let bestScore = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.length === 0) continue;
    const d = levenshtein(line.slice(0, 200), firstFindLine.slice(0, 200));
    if (d < bestScore) { bestScore = d; bestIdx = i; }
  }
  if (bestIdx === -1 || bestScore > firstFindLine.length * 0.5) {
    return "No similar text found. Re-read the file — its contents may have changed.";
  }

  const from = Math.max(0, bestIdx - 2);
  const to = Math.min(lines.length, bestIdx + 4);
  const snippet = lines.slice(from, to).map((l, k) => `${from + k + 1}: ${l}`).join("\n");
  return `Closest match near line ${bestIdx + 1}:\n${snippet}\nRe-read that region and retry with the exact current text.`;
}
