/**
 * KlaatTUI — Engine public API.
 *
 * Re-exports everything needed to build screens with the custom TUI engine.
 * Import from this file instead of individual modules:
 *
 *   import { App, CellBuffer, drawBorder, ScrollView, InputField, ... } from "../engine/index.js";
 */

// ─── Core ─────────────────────────────────────────────────────────────────────

export { App, type RenderFn, type AppEvents }      from "./app.js";
export { CellBuffer, type Cell, type Style }        from "./buffer.js";
export { type Color, fgCode, bgCode, buildStyle,
         ANSI_RESET, ANSI_BOLD, ANSI_DIM,
         ANSI_ITALIC, ANSI_UNDERLINE, ANSI_STRIKE,
         SUPPORTS_TRUECOLOR }                        from "./color.js";
export { InputParser, type KeyEvent, type MouseEvent,
         charWidth, stringWidth }                    from "./input.js";
export {
  type Rect, rect, rectValid,
  pad, padEach, padH, padV,
  splitH, splitV,
  takeTop, takeBottom, takeLeft, takeRight,
  splitHRatio, splitVRatio,
  center, inner, intersect, contains,
  flexLayout, flexSplitH, flexSplitV,
  type FlexChild, type FlexOpts, type FlexAlign, type FlexJustify,
}                                                   from "./layout.js";
export {
  enterAltScreen, exitAltScreen,
  hideCursor, showCursor,
  clearScreen, setRawMode,
  termSize, termWrite, restoreTerminal,
  enableMouse, disableMouse,
  enableKitty, disableKitty,
  enableBracketedPaste, disableBracketedPaste,
  type TermSize,
}                                                   from "./terminal.js";

// ─── Theme detection ──────────────────────────────────────────────────────────

export {
  detectTheme, getPalette,
  DARK_PALETTE, LIGHT_PALETTE, DRACULA_PALETTE, NORD_PALETTE,
  AYU_PALETTE, CATPPUCCIN_PALETTE, GRUVBOX_PALETTE, NEON_PALETTE,
  THEME_NAMES, THEME_DESCRIPTIONS,
  type Theme, type ThemePalette,
}                                                   from "./theme.js";

// ─── Styled text ──────────────────────────────────────────────────────────────

export {
  type Span, type StyledLine,
  span, spans, plain, sep, bold, dim, italic, underline, link, clickable,
  lineWidth, lineText,
  truncateLine,
  drawStyledLine, drawStyledLines,
  fromString, toString,
}                                                   from "./styled-text.js";

// ─── Hit-region system ────────────────────────────────────────────────────────

export {
  HitGrid,
  type HitRegion, type HitResult,
}                                                   from "./hit-region.js";

// ─── Widgets ──────────────────────────────────────────────────────────────────

export {
  wrapLines, drawText, drawTextLine,
  type TextAlign, type DrawTextOpts, type DrawTextLineOpts,
}                                                   from "./widgets/text.js";

export {
  drawBorder, type BorderOpts,
}                                                   from "./widgets/border.js";

export {
  Spinner, PulseBar,
  SPINNER_DOTS, SPINNER_LINE, SPINNER_ARC,
  SPINNER_PULSE, SPINNER_BOUNCE,
}                                                   from "./widgets/spinner.js";

export {
  ScrollView, type ScrollInfo,
}                                                   from "./widgets/scroll-view.js";

export {
  InputField, type InputFieldOpts,
}                                                   from "./widgets/input-field.js";

export {
  drawStatusBar, type StatusBarOpts,
}                                                   from "./widgets/status-bar.js";

export {
  TabBar, type Tab, type TabBarOpts,
}                                                   from "./widgets/tab-bar.js";

export {
  DialogManager, type ListItem, type DialogOpts,
}                                                   from "./widgets/dialog.js";

export {
  renderMarkdown, type MarkdownTheme, DEFAULT_MD_THEME,
}                                                   from "./widgets/markdown.js";

export {
  drawImage, loadImage, loadImageSync, loadImageFromBuffer,
  detectImageProtocol, supportsImages, estimateImageRows,
  type ImageData, type ImageProtocol, type DrawImageOpts,
}                                                   from "./widgets/image.js";
