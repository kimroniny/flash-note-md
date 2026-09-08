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

  const applyUnderline = () => wrapSelection("<u>", "</u>", true);

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
      if (!destroyed && ready) options.onChange();
    },
    after() {
      if (destroyed) return;
      if (queued !== null) {
        instance?.setValue(queued, true);
        queued = null;
      }
      ready = true;
      instance?.setTheme(chromeTheme());
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
