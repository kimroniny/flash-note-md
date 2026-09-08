import Vditor from "vditor";
import "vditor/dist/index.css";

export type EditorHandle = {
  getMarkdown(): string;
  setMarkdown(md: string, focusEnd?: boolean): void;
  insert(text: string): void;
  focus(): void;
  selectAll(): void;
  applyChrome(): void;
  destroy(): void;
};

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

  instance = new Vditor(host, {
    cdn,
    mode: "ir",
    lang: "zh_CN",
    theme: chromeTheme(),
    value: "",
    height: "auto",
    minHeight: 320,
    placeholder: "开始写…",
    tab: "  ",
    cache: { enable: false },
    toolbar: [],
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
    applyChrome() {
      if (!ready || !instance) return;
      instance.setTheme(chromeTheme());
    },
    destroy() {
      destroyed = true;
      instance?.destroy();
      instance = null;
      root.replaceChildren();
    },
  };
}
