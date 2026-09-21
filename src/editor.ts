import Vditor from "vditor";
import "vditor/dist/index.css";
import "vditor/dist/js/i18n/zh_CN.js";

export type EditorHandle = {
  getMarkdown(): string;
  setMarkdown(md: string, focusEnd?: boolean): void;
  insert(text: string): void;
  focus(): void;
  selectAll(): void;
  format(cmd: FormatCmd): void;
  find(query: string, dir?: -1 | 0 | 1): { index: number; total: number };
  clearFind(): void;
  applyChrome(): void;
  destroy(): void;
};

export type FormatCmd = "bold" | "italic" | "underline" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type Options = {
  onChange: () => void;
};

const DARK_THEMES = new Set(["ink", "ocean", "contrast"]);

function vditorCdn(): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base.replace(/\/?$/, "/")}vditor`;
}

function chromeTheme(): "dark" | "classic" {
  const id = document.documentElement.getAttribute("data-theme") ?? "paper";
  return DARK_THEMES.has(id) ? "dark" : "classic";
}

export function mountEditor(root: HTMLElement, options: Options): EditorHandle {
  let ready = false;
  let destroyed = false;
  let queued: string | null = null;
  let wantFocus = false;
  let instance: Vditor | null = null;
  let findQuery = "";
  let findIndex = -1;

  root.className = "editor-root";
  const host = document.createElement("div");
  host.className = "md-editor";
  host.id = "flashnote-vditor";
  root.replaceChildren(host);

  const cdn = vditorCdn();

  const fireToolbar = (selector: string) => {
    const btn = host.querySelector(selector);
    if (!(btn instanceof HTMLElement)) return false;
    btn.click();
    return true;
  };

  const selectionInHost = () => {
    const node = window.getSelection()?.anchorNode;
    return Boolean(node && host.contains(node));
  };

  const focusSurface = () => {
    if (selectionInHost()) return;
    const pre = host.querySelector(".vditor-ir pre, [contenteditable='true']");
    if (pre instanceof HTMLElement) pre.focus();
  };

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const wrapSelection = (prefix: string, suffix: string, asHtml = false) => {
    if (!instance || destroyed) return;
    const text = window.getSelection()?.toString() ?? "";
    if (text) document.execCommand("delete", false);
    if (asHtml) {
      instance.insertValue(text ? `${prefix}${escapeHtml(text)}${suffix}` : `${prefix}${suffix}`, true);
    } else {
      instance.insertMD(text ? `${prefix}${text}${suffix}` : `${prefix}${suffix}`);
    }
    if (ready) options.onChange();
  };

  const htmlInlineTag = (el: Element | null): string | null => {
    if (!(el instanceof HTMLElement) || el.getAttribute("data-type") !== "html-inline") return null;
    return (el.textContent ?? "").replace(/\u200b/g, "").trim();
  };

  const paintUnderlines = () => {
    const pre = host.querySelector(".vditor-ir pre");
    if (!(pre instanceof HTMLElement)) return;
    pre.querySelectorAll("span.fn-u").forEach((span) => {
      span.replaceWith(...span.childNodes);
    });
    const nodes = [...pre.querySelectorAll<HTMLElement>('[data-type="html-inline"]')];
    for (let i = 0; i < nodes.length; i++) {
      if (htmlInlineTag(nodes[i]) !== "<u>") continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (htmlInlineTag(nodes[j]) !== "</u>") continue;
        if (nodes[i].parentNode !== nodes[j].parentNode) break;
        const range = document.createRange();
        range.setStartAfter(nodes[i]);
        range.setEndBefore(nodes[j]);
        if (range.collapsed) break;
        const span = document.createElement("span");
        span.className = "fn-u";
        const frag = range.extractContents();
        span.append(frag);
        range.insertNode(span);
        break;
      }
    }
  };

  const applyUnderline = () => {
    if (destroyed) return;
    focusSurface();
    const node = window.getSelection()?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    const painted = el?.closest("span.fn-u");
    if (painted instanceof HTMLElement) {
      const open = painted.previousElementSibling;
      const close = painted.nextElementSibling;
      if (open && htmlInlineTag(open) === "<u>") open.remove();
      if (close && htmlInlineTag(close) === "</u>") close.remove();
      painted.replaceWith(...painted.childNodes);
      if (ready) options.onChange();
      return;
    }
    const selected = window.getSelection()?.toString() ?? "";
    if (selected) document.execCommand("delete", false);
    document.execCommand("insertText", false, selected ? `<u>${selected}</u>` : "<u></u>");
    paintUnderlines();
    if (ready) options.onChange();
  };

  const closestType = (type: "strong" | "em") => {
    const node = window.getSelection()?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    return el?.closest(`[data-type="${type}"]`);
  };

  const applyInline = (type: "bold" | "italic") => {
    if (destroyed) return;
    focusSurface();
    const dataType = type === "bold" ? "strong" : "em";
    if (closestType(dataType)) {
      fireToolbar(`[data-type="${type}"]`);
      if (ready) options.onChange();
      return;
    }
    const marker = type === "bold" ? "**" : "*";
    const selected = window.getSelection()?.toString() ?? "";
    if (selected) document.execCommand("delete", false);
    document.execCommand("insertText", false, selected ? `${marker}${selected}${marker}` : `${marker}${marker}`);
    if (ready) options.onChange();
  };

  const applyHeading = (level: number) => {
    const marker = `${"#".repeat(level)} `;
    if (!fireToolbar(`[data-value="${marker}"]`)) {
      wrapSelection(marker, "");
    } else if (ready) options.onChange();
  };

  const format = (cmd: FormatCmd) => {
    if (destroyed) return;
    if (cmd === "bold") applyInline("bold");
    else if (cmd === "italic") applyInline("italic");
    else if (cmd === "underline") applyUnderline();
    else applyHeading(Number(cmd.slice(1)));
  };

  const onFormatKey = (event: KeyboardEvent) => {
    if (destroyed || event.isComposing || event.altKey) return;
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const inHost = target instanceof Node && host.contains(target);
    if (!inHost && !selectionInHost()) return;
    const { code } = event;
    if (code === "KeyB") format("bold");
    else if (code === "KeyI") format("italic");
    else if (code === "KeyU") format("underline");
    else if (/^Digit[1-6]$/.test(code)) format(`h${code.slice(5)}` as FormatCmd);
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  document.addEventListener("keydown", onFormatKey, true);

  instance = new Vditor(host, {
    cdn,
    mode: "ir",
    lang: "zh_CN",
    i18n: window.VditorI18n,
    theme: chromeTheme(),
    value: "",
    height: "auto",
    minHeight: 320,
    placeholder: "开始写…",
    tab: "  ",
    cache: { enable: false },
    toolbar: [
      "headings",
      "bold",
      "italic",
      {
        name: "underline",
        tip: "下划线",
        hotkey: "⌘U",
        tipPosition: "n",
        icon: "<span>U</span>",
        click() {
          applyUnderline();
        },
      },
    ],
    toolbarConfig: { hide: true, pin: false },
    outline: { enable: false, position: "left" },
    counter: { enable: false },
    resize: { enable: false },
    comment: { enable: false },
    hint: { parse: false, emoji: {} },
    preview: {
      hljs: { enable: false },
      math: { engine: "KaTeX", inlineDigit: false },
      markdown: {
        mark: true,
        toc: false,
        mathBlockPreview: false,
        codeBlockPreview: true,
        paragraphBeginningSpace: false,
        listStyle: true,
      },
      theme: {
        current: chromeTheme() === "dark" ? "dark" : "light",
        path: `${cdn}/dist/css/content-theme`,
      },
    },
    input() {
      if (destroyed) return;
      paintUnderlines();
      if (ready) options.onChange();
    },
    after() {
      if (destroyed) return;
      if (queued !== null) {
        instance?.setValue(queued, true);
        queued = null;
      }
      ready = true;
      instance?.setTheme(chromeTheme());
      paintUnderlines();
      if (wantFocus) {
        instance?.focus();
        wantFocus = false;
      }
    },
  });

  return {
    getMarkdown() {
      if (queued !== null) return queued;
      if (ready && instance) return instance.getValue();
      return "";
    },
    setMarkdown(md: string, focusEnd = false) {
      if (!ready || !instance) {
        queued = md;
        wantFocus = focusEnd || wantFocus;
        return;
      }
      instance.setValue(md, true);
      findQuery = "";
      findIndex = -1;
      try {
        CSS.highlights?.delete("fn-find");
      } catch {
        /* ignore */
      }
      if (focusEnd) instance.focus();
    },
    insert(text: string) {
      if (!ready || !instance) {
        queued = `${queued ?? ""}${text}`;
        return;
      }
      instance.focus();
      instance.insertValue(text, true);
      options.onChange();
    },
    focus() {
      if (!ready || !instance) {
        wantFocus = true;
        return;
      }
      instance.focus();
    },
    selectAll() {
      const pre = host.querySelector(".vditor-ir pre") ?? host.querySelector("[contenteditable='true']");
      if (!(pre instanceof HTMLElement)) return;
      pre.focus();
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
    find(query: string, dir: -1 | 0 | 1 = 0) {
      const pre = host.querySelector(".vditor-ir pre") ?? host.querySelector("[contenteditable='true']");
      const needle = query.trim().toLowerCase();
      const paint = (range: Range | null) => {
        try {
          CSS.highlights?.delete("fn-find");
        } catch {
          /* ignore */
        }
        if (!range) return;
        try {
          CSS.highlights?.set("fn-find", new Highlight(range));
        } catch {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        const el = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
        el?.scrollIntoView({ block: "center", inline: "nearest" });
      };
      if (!(pre instanceof HTMLElement) || !needle) {
        findQuery = "";
        findIndex = -1;
        paint(null);
        return { index: 0, total: 0 };
      }
      const hits: { node: Text; start: number; end: number }[] = [];
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const el = (node as Text).parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          if (el.closest(".vditor-ir__marker")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? "";
        const lower = text.toLowerCase();
        let from = 0;
        while (from < lower.length) {
          const i = lower.indexOf(needle, from);
          if (i < 0) break;
          hits.push({ node: node as Text, start: i, end: i + needle.length });
          from = i + needle.length;
        }
      }
      if (hits.length === 0) {
        findQuery = needle;
        findIndex = -1;
        paint(null);
        return { index: 0, total: 0 };
      }
      let idx: number;
      if (findQuery !== needle || findIndex < 0) idx = dir < 0 ? hits.length - 1 : 0;
      else if (dir === 0) idx = Math.min(findIndex, hits.length - 1);
      else idx = (findIndex + dir + hits.length) % hits.length;
      findQuery = needle;
      findIndex = idx;
      const hit = hits[idx];
      if (!hit) return { index: 0, total: hits.length };
      const range = document.createRange();
      range.setStart(hit.node, hit.start);
      range.setEnd(hit.node, hit.end);
      paint(range);
      return { index: idx + 1, total: hits.length };
    },
    clearFind() {
      findQuery = "";
      findIndex = -1;
      try {
        CSS.highlights?.delete("fn-find");
      } catch {
        /* ignore */
      }
    },
    format,
    applyChrome() {
      if (!ready || !instance) return;
      instance.setTheme(chromeTheme());
    },
    destroy() {
      destroyed = true;
      document.removeEventListener("keydown", onFormatKey, true);
      instance?.destroy();
      instance = null;
      root.replaceChildren();
    },
  };
}
