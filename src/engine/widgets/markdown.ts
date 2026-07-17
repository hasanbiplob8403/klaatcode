/**
 * KlaatTUI — Markdown renderer.
 *
 * Converts markdown text into StyledLines for rendering in the TUI.
 * Supports: headings, bold, italic, code spans, fenced code blocks,
 * bullet lists, numbered lists, horizontal rules, and links.
 *
 * Does NOT use an external parser — a lightweight regex-based approach
 * tuned for streaming LLM output (partial lines, incremental tokens).
 *
 * Usage:
 *   const lines = renderMarkdown(mdText, maxWidth, palette);
 *   drawStyledLines(buf, r, lines);
 */

import { type Color } from "../color.js";
import { type Span, type StyledLine, span, spans } from "../styled-text.js";
import { stringWidth } from "../input.js";

// ─── Theme colors for markdown elements ───────────────────────────────────────

export interface MarkdownTheme {
  heading:    Color;
  bold:       Color;
  italic:     Color;
  code:       Color;
  codeBg:     Color;
  codeBlock:  Color;
  blockBg:    Color;
  link:       Color;
  linkUrl:    Color;
  bullet:     Color;
  hr:         Color;
  text:       Color;
  dimText:    Color;
  /** Color for the thinking/reasoning block border and label */
  thinking?:  Color;
  /** Background for the thinking block content */
  thinkingBg?: Color;
}

export const DEFAULT_MD_THEME: MarkdownTheme = {
  heading:   "#d8b4fe",
  bold:      "white",
  italic:    "white",
  code:      "#f0abfc",
  codeBg:    236,
  codeBlock: "#e2e8f0",
  blockBg:   236,
  link:      "cyan",
  linkUrl:   "gray",
  bullet:    "#d8b4fe",
  hr:        "#555",
  text:      "white",
  dimText:   "gray",
  thinking:  245,
  thinkingBg: null,
};

// ─── Syntax highlighting ──────────────────────────────────────────────────────

/** Map of language aliases to canonical names. */
const LANG_ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", sh: "bash",
  shell: "bash", zsh: "bash", console: "bash", terminal: "bash",
  rs: "rust", rb: "ruby", go: "go", java: "java", cs: "csharp",
  cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", json: "json", jsonc: "json",
  yaml: "yaml", yml: "yaml", toml: "toml", md: "markdown", diff: "diff",
  patch: "diff", sql: "sql", graphql: "graphql", gql: "graphql",
  html: "html", xml: "html", css: "css", scss: "css",
};

const CANON_LANG = (raw: string): string =>
  LANG_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase();

/** Syntax-highlight a single code line and return Spans with colors. */
function highlightLine(line: string, lang: string, blockBg: Color): Span[] {
  const bg = blockBg;
  const L  = CANON_LANG(lang);

  // ── Diff / patch ──────────────────────────────────────────────────────
  if (L === "diff") {
    if (/^@@/.test(line))           return [span(line, { fg: 75,  bg, bold: true })];
    if (/^\+\+\+/.test(line))       return [span(line, { fg: 252, bg, bold: true })];
    if (/^---/.test(line))          return [span(line, { fg: 252, bg, bold: true })];
    if (line.startsWith("+"))       return [span(line, { fg: 114, bg })];
    if (line.startsWith("-"))       return [span(line, { fg: 204, bg })];
    if (line.startsWith(" "))       return [span(line, { fg: 245, bg })];
    return [span(line, { fg: 245, bg })];
  }

  // ── JSON ──────────────────────────────────────────────────────────────
  if (L === "json") {
    // Simple JSON: keys in cyan, string values in green, numbers/booleans in orange
    const jsonRe = /("(?:[^"\\]|\\.)*")\s*:/g;
    const parts: Span[] = [];
    let last = 0, m: RegExpExecArray | null;
    while ((m = jsonRe.exec(line)) !== null) {
      if (m.index > last) parts.push(span(line.slice(last, m.index), { fg: 252, bg }));
      parts.push(span(m[1]!, { fg: 75, bg }));
      last = m.index + m[1]!.length;
    }
    if (last < line.length) {
      const rest = line.slice(last);
      // Color string values, numbers, booleans differently
      const valParts = rest.replace(/("(?:[^"\\]|\\.)*")/g, '\x01$1\x02')
                           .replace(/\b(true|false|null)\b/g, '\x03$1\x04')
                           .replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '\x05$1\x06');
      for (const seg of valParts.split(/(\x01[^\x02]*\x02|\x03[^\x04]*\x04|\x05[^\x06]*\x06)/)) {
        if (seg.startsWith("\x01") && seg.endsWith("\x02"))
          parts.push(span(seg.slice(1, -1), { fg: 114, bg }));
        else if (seg.startsWith("\x03") && seg.endsWith("\x04"))
          parts.push(span(seg.slice(1, -1), { fg: 214, bg, bold: true }));
        else if (seg.startsWith("\x05") && seg.endsWith("\x06"))
          parts.push(span(seg.slice(1, -1), { fg: 214, bg }));
        else if (seg)
          parts.push(span(seg, { fg: 245, bg }));
      }
    }
    return parts.length > 0 ? parts : [span(line, { fg: 252, bg })];
  }

  // ── TypeScript / JavaScript ───────────────────────────────────────────
  if (L === "typescript" || L === "javascript") {
    return highlightGeneric(line, bg, {
      keywords: /\b(const|let|var|function|class|return|if|else|else if|while|for|of|in|do|switch|case|break|continue|new|delete|typeof|instanceof|void|null|undefined|true|false|import|export|default|from|as|async|await|try|catch|finally|throw|extends|implements|interface|type|enum|namespace|declare|abstract|static|public|private|protected|readonly|override|satisfies|keyof|infer|never|unknown|any|object)\b/g,
      kwColor:    213,
      typeRe:     /\b([A-Z][a-zA-Z0-9]*)\b/g,
      typeColor:  222,
      strColor:   114,
      numColor:   214,
      cmtColor:   243,
      defColor:   252,
    });
  }

  // ── Python ────────────────────────────────────────────────────────────
  if (L === "python") {
    return highlightGeneric(line, bg, {
      keywords: /\b(def|class|return|if|elif|else|while|for|in|not|and|or|is|None|True|False|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|del|global|nonlocal|assert|async|await)\b/g,
      kwColor:    75,
      typeRe:     /\b([A-Z][a-zA-Z0-9_]*)\b/g,
      typeColor:  222,
      strColor:   114,
      numColor:   214,
      cmtColor:   243,
      defColor:   252,
    });
  }

  // ── Go ────────────────────────────────────────────────────────────────
  if (L === "go") {
    return highlightGeneric(line, bg, {
      keywords: /\b(func|var|const|type|struct|interface|map|chan|go|defer|return|if|else|switch|case|for|range|break|continue|select|import|package|nil|true|false|make|new|append|len|cap|delete|copy|close|panic|recover|error)\b/g,
      kwColor:    87,
      typeRe:     /\b(int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|complex64|complex128|string|bool|byte|rune|error|[A-Z][a-zA-Z0-9]*)\b/g,
      typeColor:  222,
      strColor:   114,
      numColor:   214,
      cmtColor:   243,
      defColor:   252,
    });
  }

  // ── Rust ──────────────────────────────────────────────────────────────
  if (L === "rust") {
    return highlightGeneric(line, bg, {
      keywords: /\b(fn|let|mut|const|static|struct|enum|trait|impl|use|pub|mod|type|where|for|in|if|else|while|loop|match|return|break|continue|Self|self|super|crate|extern|unsafe|async|await|dyn|ref|move|box|true|false|None|Some|Ok|Err)\b/g,
      kwColor:    213,
      typeRe:     /\b([A-Z][a-zA-Z0-9_]*|i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|HashMap|Option|Result)\b/g,
      typeColor:  222,
      strColor:   114,
      numColor:   214,
      cmtColor:   243,
      defColor:   252,
    });
  }

  // ── Bash / shell ──────────────────────────────────────────────────────
  if (L === "bash") {
    if (line.trimStart().startsWith("#")) return [span(line, { fg: 243, bg })];
    if (line.trimStart().startsWith("$")) {
      const cmd = line.trimStart().slice(1).trimStart();
      return [
        span(line.slice(0, line.indexOf("$") + 1) + " ", { fg: 222, bold: true, bg }),
        span(cmd, { fg: "white", bg }),
      ];
    }
    return [span(line, { fg: 252, bg })];
  }

  // ── SQL ───────────────────────────────────────────────────────────────
  if (L === "sql") {
    return highlightGeneric(line, bg, {
      keywords: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CONSTRAINT|AS|DISTINCT|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|EXISTS|CASE|WHEN|THEN|ELSE|END|WITH|RETURNING)\b/gi,
      kwColor:    75,
      typeRe:     null,
      typeColor:  222,
      strColor:   114,
      numColor:   214,
      cmtColor:   243,
      defColor:   252,
    });
  }

  // ── Default: plain code block styling ─────────────────────────────────
  return [span(line, { fg: 252, bg })];
}

interface HighlightOpts {
  keywords:  RegExp | null;
  kwColor:   number;
  typeRe:    RegExp | null;
  typeColor: number;
  strColor:  number;
  numColor:  number;
  cmtColor:  number;
  defColor:  number;
}

/** Generic token-based highlighter for most C-style languages. */
function highlightGeneric(line: string, bg: Color, opts: HighlightOpts): Span[] {
  const { keywords, kwColor, typeRe, typeColor, strColor, numColor, cmtColor, defColor } = opts;

  // Detect full-line comment first
  const stripped = line.trimStart();
  if (stripped.startsWith("//") || stripped.startsWith("#")) {
    return [span(line, { fg: cmtColor, bg, italic: true })];
  }

  // Tokenise: strings, numbers, keywords, types, rest
  const tokenRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\/\/.*$)|(#.*$)/g;
  const segments: Array<{ text: string; color: number; bold?: boolean; italic?: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(line)) !== null) {
    if (m.index > last) {
      // Non-literal segment — apply keyword and type coloring
      segments.push(...tokeniseIdents(line.slice(last, m.index), keywords, kwColor, typeRe, typeColor, defColor));
    }
    if (m[1]) segments.push({ text: m[1], color: strColor });
    else if (m[2]) segments.push({ text: m[2], color: numColor });
    else if (m[3] || m[4]) segments.push({ text: m[0], color: cmtColor, italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    segments.push(...tokeniseIdents(line.slice(last), keywords, kwColor, typeRe, typeColor, defColor));
  }

  return segments.map(s => span(s.text, { fg: s.color, bg, ...(s.italic ? { italic: true } : {}), ...(s.bold ? { bold: true } : {}) }));
}

function tokeniseIdents(
  text:      string,
  keywords:  RegExp | null,
  kwColor:   number,
  typeRe:    RegExp | null,
  typeColor: number,
  defColor:  number,
): Array<{ text: string; color: number }> {
  if (!text) return [];
  if (!keywords && !typeRe) return [{ text, color: defColor }];

  const result: Array<{ text: string; color: number }> = [];
  // Build a combined regex that marks keyword and type matches
  const parts: RegExp[] = [];
  if (keywords) parts.push(new RegExp(keywords.source, keywords.flags.replace("g", "") + "g"));
  if (typeRe)   parts.push(new RegExp(typeRe.source,   typeRe.flags.replace("g", "")   + "g"));

  // Simple greedy approach: try each regex independently, pick earliest match
  let pos = 0;
  while (pos < text.length) {
    let earliest: { index: number; text: string; color: number } | null = null;

    if (keywords) {
      keywords.lastIndex = pos;
      const mk = keywords.exec(text);
      if (mk) {
        earliest = { index: mk.index, text: mk[0], color: kwColor };
      }
    }
    if (typeRe) {
      typeRe.lastIndex = pos;
      const mt = typeRe.exec(text);
      if (mt && (earliest === null || mt.index < earliest.index)) {
        earliest = { index: mt.index, text: mt[0], color: typeColor };
      }
    }

    if (!earliest) {
      result.push({ text: text.slice(pos), color: defColor });
      break;
    }
    if (earliest.index > pos) {
      result.push({ text: text.slice(pos, earliest.index), color: defColor });
    }
    result.push({ text: earliest.text, color: earliest.color });
    pos = earliest.index + earliest.text.length;
  }

  // Reset regex lastIndex to avoid cross-call pollution
  if (keywords) keywords.lastIndex = 0;
  if (typeRe)   typeRe.lastIndex   = 0;

  return result;
}

// ─── Inline span parser ──────────────────────────────────────────────────────

/** Parse inline markdown (bold, italic, code, links) into Spans. */
function parseInline(text: string, theme: MarkdownTheme): Span[] {
  const result: Span[] = [];

  // Regex for inline elements (order matters — longer patterns first)
  const inlineRe = /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      result.push(span(text.slice(lastIndex, match.index), { fg: theme.text }));
    }

    if (match[1]) {
      const code = match[1].slice(1, -1);
      result.push(span("`", { fg: theme.code, dim: true }));
      result.push(span(code, { fg: theme.code, bg: theme.codeBg, bold: true }));
      result.push(span("`", { fg: theme.code, dim: true }));
    } else if (match[2]) {
      const inner = match[2].slice(3, -3);
      result.push(span(inner, { fg: theme.bold, bold: true, italic: true }));
    } else if (match[3]) {
      const inner = match[3].slice(2, -2);
      result.push(span(inner, { fg: theme.bold, bold: true }));
    } else if (match[4]) {
      const inner = match[4].slice(1, -1);
      result.push(span(inner, { fg: theme.italic, italic: true }));
    } else if (match[5]) {
      const inner = match[5].slice(1, -1);
      result.push(span(inner, { fg: theme.italic, italic: true }));
    } else if (match[6]) {
      const linkText = match[7]!;
      const linkUrl  = match[8]!;
      result.push(span(linkText, { fg: theme.link, bold: true, underline: true, link: linkUrl }));
      result.push(span(` (${linkUrl})`, { fg: theme.linkUrl, dim: true }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    result.push(span(text.slice(lastIndex), { fg: theme.text }));
  }

  if (result.length === 0) {
    result.push(span(text, { fg: theme.text }));
  }

  return result;
}

// ─── Word-wrap a StyledLine to fit within maxW ────────────────────────────────

function wrapStyledLine(line: StyledLine, maxW: number): StyledLine[] {
  if (maxW <= 0) return [];

  // Fast path: single-line fits
  let total = 0;
  for (const s of line) total += stringWidth(s.text);
  if (total <= maxW) return [line];

  // Slow path: split spans at word boundaries
  const rows: StyledLine[] = [];
  let current: Span[] = [];
  let currentW = 0;

  for (const s of line) {
    const words = s.text.split(/( +)/);
    for (const word of words) {
      const ww = stringWidth(word);
      if (ww === 0) continue;

      if (currentW + ww <= maxW) {
        current.push({ ...s, text: word });
        currentW += ww;
      } else {
        if (current.length > 0) rows.push(current);
        // If word itself is wider than maxW, hard-break it
        if (ww > maxW) {
          let chunk = "";
          let chunkW = 0;
          for (const ch of word) {
            const cw = stringWidth(ch);
            if (chunkW + cw > maxW) {
              rows.push([{ ...s, text: chunk }]);
              chunk = "";
              chunkW = 0;
            }
            chunk += ch;
            chunkW += cw;
          }
          current = chunk ? [{ ...s, text: chunk }] : [];
          currentW = chunkW;
        } else {
          // Trim leading space on new line
          const trimmed = word.trimStart();
          current = trimmed ? [{ ...s, text: trimmed }] : [];
          currentW = stringWidth(trimmed);
        }
      }
    }
  }

  if (current.length > 0) rows.push(current);
  return rows;
}

// ─── Block-level markdown parser ──────────────────────────────────────────────

export function renderMarkdown(
  md:     string,
  maxW:   number,
  theme:  MarkdownTheme = DEFAULT_MD_THEME,
): StyledLine[] {
  const output: StyledLine[] = [];
  const lines = md.split("\n");

  let inCodeBlock = false;
  let codeLang    = "";
  let inThinking  = false;

  const thinkColor = theme.thinking ?? 245;
  const thinkBg    = theme.thinkingBg ?? null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // ── Thinking block open/close ─────────────────────────────────────
    const trimLine = line.trim();
    if (trimLine === "<thinking>" || trimLine === "<reasoning>") {
      inThinking = true;
      output.push([]);
      const label = " 💭 Thinking ";
      const borderW = Math.max(1, maxW - stringWidth(label) - 2);
      output.push([
        span("┌", { fg: thinkColor, dim: true }),
        span(label, { fg: thinkColor, italic: true }),
        span("─".repeat(borderW), { fg: thinkColor, dim: true }),
      ]);
      continue;
    }
    if (trimLine === "</thinking>" || trimLine === "</reasoning>") {
      inThinking = false;
      output.push([
        span("└", { fg: thinkColor, dim: true }),
        span("─".repeat(Math.max(1, maxW - 2)), { fg: thinkColor, dim: true }),
      ]);
      output.push([]);
      continue;
    }

    // ── Inside thinking block ─────────────────────────────────────────
    if (inThinking) {
      if (trimLine === "") {
        output.push([span("│", { fg: thinkColor, dim: true })]);
        continue;
      }
      const inlineSpans = parseInline(line, { ...theme, text: thinkColor, bold: thinkColor });
      const wrapped = wrapStyledLine(
        [span("│ ", { fg: thinkColor, dim: true }), ...inlineSpans.map(s => ({ ...s, fg: thinkColor, dim: true, bg: thinkBg, italic: true }))],
        maxW,
      );
      output.push(...wrapped);
      continue;
    }

    // ── Fenced code block toggle ──────────────────────────────────────
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        const isShell = /^(bash|sh|shell|zsh|terminal|console)$/i.test(codeLang);
        output.push([]);
        if (codeLang) {
          const langLabel = ` ${codeLang} `;
          const barW = Math.max(1, maxW - 1 - stringWidth(langLabel));
          output.push([
            span(langLabel, { fg: isShell ? 222 : 75, bold: true, bg: theme.blockBg }),
            span(" ".repeat(barW), { bg: theme.blockBg }),
          ]);
        } else {
          output.push([
            span(" ".repeat(maxW), { bg: theme.blockBg }),
          ]);
        }
        continue;
      } else {
        inCodeBlock = false;
        output.push([
          span(" ".repeat(maxW), { bg: theme.blockBg }),
        ]);
        output.push([]);
        continue;
      }
    }

    // ── Inside code block ─────────────────────────────────────────────
    if (inCodeBlock) {
      const isShell = /^(bash|sh|shell|zsh|terminal|console)$/i.test(codeLang);
      const lineW = stringWidth(line);
      const pad = " ".repeat(Math.max(0, maxW - 1 - lineW));

      if (isShell && line.trimStart().startsWith("$")) {
        const promptIdx = line.indexOf("$");
        const cmd = line.slice(promptIdx + 1).trimStart();
        output.push([
          span(" ", { bg: theme.blockBg }),
          span("$ ", { fg: 222, bold: true, bg: theme.blockBg }),
          span(cmd + " ".repeat(Math.max(0, maxW - 1 - 2 - stringWidth(cmd))), { fg: "white", bold: true, bg: theme.blockBg }),
        ]);
      } else if (isShell && line.trim().startsWith("#")) {
        output.push([
          span(" ", { bg: theme.blockBg }),
          span(line + pad, { fg: 243, bg: theme.blockBg }),
        ]);
      } else {
        // Syntax-highlighted line
        const hlSpans = highlightLine(line, codeLang, theme.blockBg);
        // Pad the last span to fill the block width
        const lineTextW = hlSpans.reduce((w, s) => w + stringWidth(s.text), 0);
        const padding = " ".repeat(Math.max(0, maxW - 1 - lineTextW));
        output.push([
          span(" ", { bg: theme.blockBg }),
          ...hlSpans,
          span(padding, { bg: theme.blockBg }),
        ]);
      }
      continue;
    }

    // ── Empty line ────────────────────────────────────────────────────
    if (trimLine === "") {
      output.push([]);
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────
    if (/^(---+|===+|\*\*\*+)\s*$/.test(line)) {
      output.push([span("─".repeat(maxW), { fg: theme.hr, dim: true })]);
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const text  = headingMatch[2]!;
      const inlineSpans = parseInline(text, { ...theme, text: theme.heading });
      const heading: StyledLine = [
        ...inlineSpans.map(s => ({ ...s, bold: true, fg: "white" as const })),
      ];
      const wrapped = wrapStyledLine(heading, maxW);
      output.push(...wrapped);
      if (level <= 2) {
        output.push([span("─".repeat(Math.min(maxW, 40)), { fg: theme.hr, dim: true })]);
      }
      continue;
    }

    // ── Bullet list ───────────────────────────────────────────────────
    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1]!.length;
      const text   = bulletMatch[3]!;
      const prefix = " ".repeat(indent) + "• ";
      const inlineSpans = parseInline(text, theme);
      const styledLine: StyledLine = [
        span(prefix, { fg: theme.bullet }),
        ...inlineSpans,
      ];
      output.push(...wrapStyledLine(styledLine, maxW));
      continue;
    }

    // ── Numbered list ─────────────────────────────────────────────────
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const indent = numMatch[1]!.length;
      const num    = numMatch[2]!;
      const text   = numMatch[3]!;
      const prefix = " ".repeat(indent) + `${num}. `;
      const inlineSpans = parseInline(text, theme);
      const styledLine: StyledLine = [
        span(prefix, { fg: theme.bullet, bold: true }),
        ...inlineSpans,
      ];
      output.push(...wrapStyledLine(styledLine, maxW));
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const text = quoteMatch[1]!;
      const inlineSpans = parseInline(text, theme);
      const styledLine: StyledLine = [
        span("┃ ", { fg: theme.heading }),
        ...inlineSpans.map(s => ({ ...s, italic: true })),
      ];
      output.push(...wrapStyledLine(styledLine, maxW));
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────────
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+[-| :]+\s*\|?$/.test(lines[i + 1]!)) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && (lines[j]!.includes("|") || /^\|?\s*[-:]+/.test(lines[j]!))) {
        tableLines.push(lines[j]!);
        j++;
      }
      const rendered = renderTable(tableLines, maxW, theme);
      output.push(...rendered);
      i = j - 1;
      continue;
    }

    // ── Regular paragraph ─────────────────────────────────────────────
    const inlineSpans = parseInline(line, theme);
    output.push(...wrapStyledLine(inlineSpans, maxW));
  }

  // Close unclosed code block (streaming)
  if (inCodeBlock) {
    output.push([
      span(" ".repeat(maxW), { bg: theme.blockBg }),
    ]);
  }

  // Close unclosed thinking block
  if (inThinking) {
    output.push([
      span("└", { fg: thinkColor, dim: true }),
      span("─".repeat(Math.max(1, maxW - 2)), { fg: thinkColor, dim: true }),
    ]);
  }

  return output;
}

// ─── Table rendering ──────────────────────────────────────────────────────────

function parseCells(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(
  tableLines: string[],
  maxW: number,
  theme: MarkdownTheme,
): StyledLine[] {
  if (tableLines.length < 2) return [];

  const headerCells = parseCells(tableLines[0]!);
  const numCols     = headerCells.length;

  // Find separator line index (has dashes)
  let sepIdx = 1;
  for (let i = 1; i < tableLines.length; i++) {
    if (/^\|?\s*[-:]+[-| :]+\s*\|?$/.test(tableLines[i]!)) {
      sepIdx = i;
      break;
    }
  }

  // Parse data rows (skip separator)
  const dataRows: string[][] = [];
  for (let i = sepIdx + 1; i < tableLines.length; i++) {
    const cells = parseCells(tableLines[i]!);
    if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;
    dataRows.push(cells);
  }

  // Calculate column widths
  const colWidths: number[] = new Array(numCols).fill(0);
  for (let c = 0; c < numCols; c++) {
    colWidths[c] = stringWidth(headerCells[c] ?? "");
    for (const row of dataRows) {
      colWidths[c] = Math.max(colWidths[c]!, stringWidth(row[c] ?? ""));
    }
  }

  // Clamp total width
  const totalW = colWidths.reduce((a, b) => a + b, 0) + (numCols + 1) * 3;
  if (totalW > maxW && numCols > 0) {
    const scale = maxW / totalW;
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = Math.max(4, Math.floor(colWidths[c]! * scale));
    }
  }

  const output: StyledLine[] = [];

  // Helper: render a row of cells
  function renderRow(cells: string[], isHeader: boolean): StyledLine {
    const spans_arr: Span[] = [];
    for (let c = 0; c < numCols; c++) {
      const cell = (cells[c] ?? "").slice(0, colWidths[c]!);
      const padded = cell + " ".repeat(Math.max(0, colWidths[c]! - stringWidth(cell)));
      if (c > 0) spans_arr.push(span("  ", {}));
      spans_arr.push(span(padded, {
        fg: isHeader ? theme.heading : theme.text,
        bold: isHeader,
      }));
    }
    return spans_arr;
  }

  // Helper: separator line
  function renderSep(): StyledLine {
    const parts: Span[] = [];
    for (let c = 0; c < numCols; c++) {
      if (c > 0) parts.push(span("──", { fg: theme.hr, dim: true }));
      parts.push(span("─".repeat(colWidths[c]!), { fg: theme.hr, dim: true }));
    }
    return parts;
  }

  // Header
  output.push(renderRow(headerCells, true));
  output.push(renderSep());

  // Data rows
  for (const row of dataRows) {
    output.push(renderRow(row, false));
  }

  return output;
}
