/**
 * Stateful HTTP browser session for the KlaatAI CLI.
 * Uses fetch + regex HTML parsing — no headless browser needed.
 * Provides the same tool-name surface as the Desktop Electron browser.
 */

const MAX_TEXT = 20_000;
const TIMEOUT_MS = 20_000;

interface Link { text: string; href: string }

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? htmlToText(m[1]).trim() : "";
}

function extractLinks(html: string, baseUrl: string): Link[] {
  const links: Link[] = [];
  const re = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  const base = new URL(baseUrl);
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    const text = htmlToText(m[2]).trim().replace(/\s+/g, " ");
    if (!href || !text || text.length > 200) continue;
    try {
      const abs = new URL(href, base).href;
      links.push({ text, href: abs });
    } catch { /* skip malformed */ }
  }
  return links.slice(0, 200);
}

class BrowserSession {
  private _url: string | null = null;
  private _title = "";
  private _text = "";
  private _links: Link[] = [];

  async navigate(url: string): Promise<string> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `Error: URL must start with http:// or https://`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 KlaatAI-CLI/1.0", Accept: "text/html,*/*" },
        redirect: "follow",
      });
      clearTimeout(timer);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        this._url = res.url || url;
        this._title = url;
        this._text = `[Binary content: ${contentType}]`;
        this._links = [];
        return `Navigated to ${url}. Content type: ${contentType}`;
      }

      const html = await res.text();
      this._url = res.url || url;
      this._title = extractTitle(html);
      this._text = htmlToText(html).slice(0, MAX_TEXT * 2);
      this._links = extractLinks(html, this._url);

      const summary = this._text.slice(0, 500).replace(/\s+/g, " ").trim();
      return [
        `Navigated to: ${this._url}`,
        `Title: ${this._title || "(no title)"}`,
        `Links: ${this._links.length}`,
        ``,
        summary,
      ].join("\n");
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      return `Error navigating to ${url}: ${msg}`;
    }
  }

  getState(): string {
    if (!this._url) return "No page loaded. Use browser_navigate first.";
    const snippet = this._text.slice(0, 400).replace(/\s+/g, " ").trim();
    return [
      `URL: ${this._url}`,
      `Title: ${this._title || "(no title)"}`,
      `Links on page: ${this._links.length}`,
      ``,
      snippet,
    ].join("\n");
  }

  getText(): string {
    if (!this._url) return "No page loaded. Use browser_navigate first.";
    return this._text.slice(0, MAX_TEXT) || "(no text content)";
  }

  click(args: { index?: number; text?: string }): Promise<string> {
    if (!this._url) return Promise.resolve("No page loaded. Use browser_navigate first.");
    if (args.index != null) {
      const link = this._links[args.index - 1];
      if (!link) return Promise.resolve(`No link at index ${args.index}. Use browser_get_state to see links.`);
      return this.navigate(link.href);
    }
    if (args.text) {
      const q = args.text.toLowerCase();
      const link = this._links.find((l) => l.text.toLowerCase().includes(q));
      if (!link) return Promise.resolve(`No link matching "${args.text}" found.`);
      return this.navigate(link.href);
    }
    return Promise.resolve("Error: provide index or text to click.");
  }

  getLinks(): string {
    if (!this._url) return "No page loaded. Use browser_navigate first.";
    if (this._links.length === 0) return "No links found on current page.";
    return this._links
      .slice(0, 50)
      .map((l, i) => `[${i + 1}] ${l.text} → ${l.href}`)
      .join("\n");
  }
}

export const browserSession = new BrowserSession();
