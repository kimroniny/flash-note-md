import { CJK_FONTS, LATIN_FONTS, THEMES, isDarkTheme, type CjkFontId, type FileNode, type LatinFontId, type ThemeId } from "./types.ts";
import { store } from "./store.ts";
import { mountEditor, type EditorHandle } from "./editor.ts";
import { nowStamp, titleFromMarkdown } from "./markdown.ts";
import { createTabs } from "./tabs.ts";

const SAVE_MS = 500;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  if (tag === "button" && !node.hasAttribute("tabindex")) node.tabIndex = -1;
  node.append(...children);
  return node;
}

const ICONS: Record<string, string> = {
  plus: `<path d="M12 5v14M5 12h14"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  chevron: `<path d="M9 6l6 6-6 6"/>`,
  up: `<path d="M6 14l6-6 6 6"/>`,
  down: `<path d="M6 10l6 6 6-6"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.1 2.4c-.8.3-1.1 1-1.1 1.6V14"/><path d="M12 17.5h.01"/>`,
  more: `<circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>`,
  moon: `<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>`,
  home: `<path d="M4 11.5 12 4l8 7.5"/><path d="M7 10.5V20h10v-9.5"/>`,
};

function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = ICONS[name] ?? "";
  return svg;
}

function highlight(text: string, q: string): (Node | string)[] {
  const needle = q.trim();
  if (!needle) return [text];
  const lower = text.toLowerCase();
  const query = needle.toLowerCase();
  const out: (Node | string)[] = [];
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(query, i);
    if (at < 0) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(el("mark", {}, text.slice(at, at + needle.length)));
    i = at + needle.length;
  }
  return out;
}

function fillTitle(node: HTMLElement, title: string, pinned: boolean, q: string): void {
  node.replaceChildren();
  if (pinned) node.append("★ ");
  node.append(...highlight(title, q));
}

function emptyState(query: boolean): HTMLElement {
  const box = el("div", { class: "empty-list" });
  if (query) box.append(el("p", {}, "没有匹配的笔记"));
  else box.append(el("p", {}, "还没有笔记"), el("p", { class: "empty-hint" }, "按 Ctrl+N 新建第一篇"));
  return box;
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yday = new Date(now);
  yday.setDate(now.getDate() - 1);
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay(d, now)) return `今天 ${t}`;
  if (sameDay(d, yday)) return `昨天 ${t}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${t}`;
}

function groupLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = start(now) - start(d);
  if (diff === 0) return "今天";
  if (diff === 86400000) return "昨天";
  if (diff < 7 * 86400000) return "本周";
  return "更早";
}

function downloadMarkdown(title: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function startApp(host: HTMLElement): void {
  void startAppAsync(host);
}

async function startAppAsync(host: HTMLElement): Promise<void> {
  await store.init();
  const meta = store.meta();
  document.documentElement.setAttribute("data-theme", meta.theme);
  document.documentElement.classList.toggle("sidebar-collapsed", !meta.sidebar);
  document.documentElement.classList.toggle("focus-mode", meta.focus);

  host.innerHTML = "";
  host.className = "shell";

  const search = el("input", {
    class: "search",
    type: "search",
    placeholder: "搜索笔记",
    "aria-label": "搜索笔记",
  });
  const listEl = el("div", { class: "note-list", role: "list" });
  const editorRoot = el("div", { id: "editor", class: "editor-root", hidden: "" });
  const homeEl = el("div", { class: "home" });
  const noteStamp = el("span", { class: "note-stamp" });
  const toast = el("div", { class: "toast", hidden: "" }, "已保存");
  const palette = el("div", { class: "overlay palette", hidden: "" });
  const settingsPop = el("div", { class: "overlay settings", hidden: "" });
  const helpPop = el("div", { class: "overlay help", hidden: "" });
  const backdrop = el("button", {
    class: "sidebar-backdrop",
    type: "button",
    "data-act": "sidebar-close",
    "aria-label": "关闭目录",
  });

  const searchCount = el("span", { class: "search-count", hidden: "" });
  const searchClear = el(
    "button",
    { class: "icon-btn search-clear", type: "button", "data-act": "search-clear", title: "清除搜索", hidden: "" },
    icon("close"),
  );
  const searchWrap = el("div", { class: "search-wrap" }, search, searchCount, searchClear);
  const saveDot = el("span", { class: "save-dot", hidden: "", title: "已保存" });
  const themeBtn = el("button", { class: "icon-btn", type: "button", "data-act": "theme-toggle", title: "切换浅色或深色" }, icon("moon"));

  const sidebar = el(
    "aside",
    { class: "sidebar" },
    el(
      "div",
      { class: "sidebar-head" },
      el("button", { class: "brand", type: "button", "data-act": "home", title: "最近笔记" }, el("span", { class: "mark", "aria-hidden": "true" }), "闪记"),
      el("button", { class: "icon-btn", type: "button", "data-act": "new", title: "新建笔记 Ctrl+N" }, icon("plus")),
    ),
    searchWrap,
    listEl,
    el(
      "div",
      { class: "sidebar-foot" },
      el("button", { class: "text-btn", type: "button", "data-act": "settings", title: "设置 Ctrl+," }, "设置"),
      el("button", { class: "text-btn", type: "button", "data-act": "trash", title: "回收站" }, "回收站"),
      el("button", { class: "text-btn", type: "button", "data-act": "export", title: "导出 Ctrl+E" }, "导出"),
    ),
    el("div", { class: "sidebar-resizer", title: "拖动调整宽度" }),
  );

  const findBar = el("div", { class: "find-bar", hidden: "" });
  const findInput = el("input", {
    class: "find-input",
    type: "search",
    placeholder: "在笔记中查找",
    "aria-label": "在笔记中查找",
  });
  const findCount = el("span", { class: "find-count" });
  findBar.append(
    findInput,
    findCount,
    el("button", { class: "icon-btn", type: "button", "data-act": "find-prev", title: "上一个" }, icon("up")),
    el("button", { class: "icon-btn", type: "button", "data-act": "find-next", title: "下一个" }, icon("down")),
    el("button", { class: "icon-btn", type: "button", "data-act": "find-close", title: "关闭" }, icon("close")),
  );
  const tabBar = el("div", { class: "tab-bar", role: "tablist", "aria-label": "打开的笔记", hidden: "" });
  const topbar = el(
    "header",
    { class: "topbar" },
    el("button", { class: "icon-btn", type: "button", "data-act": "sidebar", title: "目录 Ctrl+\\" }, icon("menu")),
    el("button", { class: "icon-btn home-back", type: "button", "data-act": "home", title: "最近笔记" }, icon("home")),
    tabBar,
    el("span", { class: "stamp-wrap" }, noteStamp, saveDot),
    el("span", { class: "flex" }),
    findBar,
    themeBtn,
    el("button", { class: "icon-btn", type: "button", "data-act": "help", title: "快捷键 ?" }, icon("help")),
  );

  const trashPop = el("div", { class: "overlay trash", hidden: "" });
  const main = el("div", { class: "main" }, topbar, el("div", { class: "editor-scroll" }, homeEl, editorRoot));
  host.append(sidebar, main, backdrop, settingsPop, palette, helpPop, trashPop, toast);

  const narrowMq = window.matchMedia("(max-width: 800px)");
  let mobileOpen = false;

  const syncChrome = () => {
    const narrow = narrowMq.matches;
    document.documentElement.classList.toggle("is-narrow", narrow);
    if (narrow) {
      document.documentElement.classList.toggle("sidebar-collapsed", !mobileOpen);
    } else {
      document.documentElement.classList.toggle("sidebar-collapsed", !store.meta().sidebar);
    }
  };

  const toggleSidebar = () => {
    if (narrowMq.matches) {
      mobileOpen = !mobileOpen;
      syncChrome();
    } else {
      store.setSidebar(!store.meta().sidebar);
    }
  };

  const closeMobileSidebar = () => {
    if (!narrowMq.matches) return;
    mobileOpen = false;
    syncChrome();
  };

  syncChrome();
  narrowMq.addEventListener("change", () => {
    mobileOpen = false;
    syncChrome();
  });

  helpPop.innerHTML = `
    <div class="sheet" role="dialog" aria-label="快捷键">
      <h2>打开先看最近</h2>
      <p>启动后中间是最近笔记。点一篇再写；点 + 或 Ctrl+N 新建空白笔记，标题自己打。</p>
      <dl>
        <div><dt><kbd>Ctrl</kbd><kbd>N</kbd></dt><dd>新建空白笔记</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>K</kbd></dt><dd>搜索 / 跳转笔记</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>W</kbd></dt><dd>关闭当前标签</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>Tab</kbd></dt><dd>下一个打开的笔记</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>F</kbd></dt><dd>在当前笔记中查找</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>\\</kbd></dt><dd>显示或隐藏目录</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>A</kbd></dt><dd>全选当前笔记</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>B</kbd></dt><dd>粗体</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>I</kbd></dt><dd>斜体</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>U</kbd></dt><dd>下划线</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>1</kbd><kbd>…</kbd><kbd>6</kbd></dt><dd>一级到六级标题</dd></div>
        <div><dt><kbd>Tab</kbd></dt><dd>列表缩进</dd></div>
        <div><dt><kbd>Shift</kbd><kbd>Tab</kbd></dt><dd>取消缩进</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>,</kbd></dt><dd>设置</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>F</kbd></dt><dd>专注模式</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>T</kbd></dt><dd>下一主题</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>;</kbd></dt><dd>插入当前时间</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>E</kbd></dt><dd>导出 Markdown</dd></div>
        <div><dt><kbd>Ctrl</kbd><kbd>S</kbd></dt><dd>立即保存</dd></div>
        <div><dt><kbd>Enter</kbd></dt><dd>下一段；列表中继续一条</dd></div>
      </dl>
      <p class="hint">点目录里的笔记会在顶栏新开标签。顶栏按钮可在记住的浅色和深色主题之间切换。Ctrl+V 或拖入可插入截图，安装版会存到笔记旁的 images 文件夹。拖动目录边缘调整宽度。浏览器里可拖动笔记排序；安装版可把笔记拖进文件夹。删除后可在提示里撤销。</p>
    </div>`;

  const settingsSheet = el("div", { class: "sheet settings-sheet", role: "dialog", "aria-label": "设置" });
  const storagePath = el("div", { class: "storage-path" });
  const storageHint = el("p", { class: "hint" });
  const pickBtn = el("button", { class: "text-btn", type: "button", "data-act": "pick-dir" }, "选择文件夹");
  const themeBox = el("div", { class: "settings-themes" });
  THEMES.forEach((t) => {
    const b = el("button", { type: "button", class: "theme-swatch", "data-theme": t.id, title: t.name });
    b.style.setProperty("--swatch", t.swatch);
    b.style.setProperty("--ink", t.ink);
    b.append(el("i"), t.name);
    themeBox.append(b);
  });
  const latinBox = el("div", { class: "settings-fonts" });
  LATIN_FONTS.forEach((f) => {
    const b = el("button", { type: "button", class: "font-swatch", "data-latin": f.id }, f.name);
    b.style.fontFamily = f.css;
    b.append(el("span", { class: "font-sample" }, f.sample));
    latinBox.append(b);
  });
  const cjkBox = el("div", { class: "settings-fonts" });
  CJK_FONTS.forEach((f) => {
    const b = el("button", { type: "button", class: "font-swatch", "data-cjk": f.id }, f.name);
    b.style.fontFamily = f.css;
    b.append(el("span", { class: "font-sample" }, f.sample));
    cjkBox.append(b);
  });
  const sizeLabel = el("span", { class: "size-value" }, "18");
  const sizeInput = el("input", {
    class: "size-range",
    type: "range",
    min: "14",
    max: "26",
    step: "2",
    "aria-label": "字号",
  });
  settingsSheet.append(
    el("h2", {}, "设置"),
    el("section", { class: "settings-section" }, el("h3", {}, "存储"), storagePath, el("div", { class: "storage-actions" }, pickBtn), storageHint),
    el("section", { class: "settings-section" }, el("h3", {}, "主题"), themeBox),
    el("section", { class: "settings-section" }, el("h3", {}, "西文"), latinBox),
    el("section", { class: "settings-section" }, el("h3", {}, "中文"), cjkBox),
    el("section", { class: "settings-section" }, el("h3", {}, "字号"), el("div", { class: "size-row" }, sizeInput, sizeLabel, " px")),
  );
  settingsPop.append(settingsSheet);

  const paintSettings = () => {
    const m = store.meta();
    if (store.isDesktop()) {
      storagePath.textContent = store.storageDir() || "未选择";
      storageHint.textContent = "笔记保存为该目录下的 Markdown 文件，左侧按文件夹显示。";
      pickBtn.hidden = false;
    } else {
      storagePath.textContent = "浏览器本地存储";
      storageHint.textContent = "Windows 安装包里可以改成任意文件夹。浏览器预览只能存在本机浏览器里。";
      pickBtn.hidden = true;
    }
    themeBox.querySelectorAll(".theme-swatch").forEach((n) => {
      n.classList.toggle("active", (n as HTMLElement).dataset.theme === m.theme);
    });
    latinBox.querySelectorAll(".font-swatch").forEach((n) => {
      n.classList.toggle("active", (n as HTMLElement).dataset.latin === m.latinFont);
    });
    cjkBox.querySelectorAll(".font-swatch").forEach((n) => {
      n.classList.toggle("active", (n as HTMLElement).dataset.cjk === m.cjkFont);
    });
    sizeInput.value = String(m.fontSize);
    sizeLabel.textContent = String(m.fontSize);
  };

  const openSettings = () => {
    const on = settingsPop.hidden;
    closeOverlays();
    if (on) {
      paintSettings();
      settingsPop.hidden = false;
    }
  };

  const resizer = sidebar.querySelector(".sidebar-resizer") as HTMLElement;
  let resizing = false;
  resizer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    resizing = true;
    resizer.setPointerCapture(e.pointerId);
    document.documentElement.classList.add("resizing-sidebar");
  });
  resizer.addEventListener("pointermove", (e) => {
    if (!resizing) return;
    store.setSidebarWidth(e.clientX - sidebar.getBoundingClientRect().left);
  });
  const stopResize = () => {
    if (!resizing) return;
    resizing = false;
    document.documentElement.classList.remove("resizing-sidebar");
  };
  resizer.addEventListener("pointerup", stopResize);
  resizer.addEventListener("pointercancel", stopResize);

  let currentId = "";
  const tabs = createTabs();
  let editor: EditorHandle | null = null;
  let saveTimer = 0;
  let searchQuery = "";
  let toastTimer = 0;

  const showToast = (text: string, opts?: { tone?: "danger"; undo?: () => void }) => {
    toast.className = opts?.tone === "danger" ? "toast danger" : "toast";
    toast.replaceChildren(document.createTextNode(text));
    if (opts?.undo) {
      const undo = el("button", { type: "button", class: "toast-undo" }, "撤销");
      undo.addEventListener("click", () => {
        toast.hidden = true;
        window.clearTimeout(toastTimer);
        opts.undo?.();
      });
      toast.append(undo);
    }
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, opts?.undo ? 5000 : 2400);
  };

  const paintThemeBtn = () => {
    const dark = isDarkTheme(store.meta().theme);
    themeBtn.replaceChildren(icon(dark ? "sun" : "moon"));
    themeBtn.title = dark ? "切换到浅色" : "切换到深色";
  };

  const applyTheme = (id: ThemeId) => {
    store.setTheme(id);
    paintSettings();
    paintThemeBtn();
    editor?.applyChrome();
  };

  const setSaveState = (state: "saved" | "dirty") => {
    if (!currentId) {
      saveDot.hidden = true;
      return;
    }
    saveDot.hidden = false;
    saveDot.dataset.state = state;
    saveDot.title = state === "dirty" ? "未保存" : "已保存";
  };

  const persist = (immediate = false) => {
    if (!currentId || !editor) return;
    setSaveState("dirty");
    const run = () => {
      const content = editor!.getMarkdown();
      const title = titleFromMarkdown(content);
      const n = store.save(currentId, { content, title });
      if (!n) {
        setSaveState("saved");
        return;
      }
      const row = listEl.querySelector(`.note-item[data-id="${CSS.escape(currentId)}"]`);
      if (row) {
        const t = row.querySelector(".note-title");
        const m = row.querySelector(".note-meta");
        const plain = n.pinned ? `★ ${title}` : title;
        if (t instanceof HTMLElement && t.textContent !== plain) fillTitle(t, title, n.pinned, searchQuery);
        const when = formatWhen(n.updatedAt);
        if (m && m.textContent !== when) m.textContent = when;
      }
      const stamp = formatWhen(n.updatedAt);
      if (noteStamp.textContent !== stamp) noteStamp.textContent = stamp;
      const nextDoc = `${title} · 闪记`;
      if (document.title !== nextDoc) document.title = nextDoc;
      setSaveState("saved");
      paintTabs();
    };
    window.clearTimeout(saveTimer);
    if (immediate) run();
    else saveTimer = window.setTimeout(run, SAVE_MS);
  };

  const paintStamp = () => {
    const n = store.get(currentId);
    noteStamp.textContent = n ? formatWhen(n.updatedAt) : "";
  };

  const collapsed = new Set<string>();
  let suppressClick = false;

  const beginDrag = (event: DragEvent, id: string) => {
    if (searchQuery.trim()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData("text/plain", id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    document.documentElement.classList.add("is-dragging");
  };

  const endDrag = () => {
    document.documentElement.classList.remove("is-dragging");
    listEl.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 50);
  };

  const relocateNote = (from: string, to: string) => {
    if (from !== to && tabs.has(from)) tabs.rename(from, to);
    if (currentId === from) {
      currentId = to;
      store.touch(to);
    }
    paintList();
  };

  const bindFolderDrop = (row: HTMLElement, destDir: string) => {
    row.addEventListener("dragover", (e) => {
      if (!store.isDesktop() || searchQuery.trim()) return;
      e.preventDefault();
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drop-target");
      const from = e.dataTransfer?.getData("text/plain") ?? "";
      if (!from || !store.isDesktop()) return;
      void (async () => {
        const next = await store.move(from, destDir);
        if (!next) {
          showToast("无法移动");
          return;
        }
        relocateNote(from, next);
        showToast(destDir ? "已移入文件夹" : "已移到根目录");
      })();
    });
  };

  const appendFileRow = (id: string, title: string, updatedAt: number, depth: number, pinned: boolean, q: string) => {
    const titleEl = el("span", { class: "note-title" });
    fillTitle(titleEl, title, pinned, q);
    const item = el(
      "button",
      {
        type: "button",
        class: `note-item${id === currentId ? " active" : ""}${tabs.has(id) ? " open" : ""}`,
        "data-id": id,
        role: "listitem",
        draggable: searchQuery.trim() ? "false" : "true",
      },
      titleEl,
      el("span", { class: "note-meta" }, formatWhen(updatedAt)),
    );
    item.style.setProperty("--depth", String(depth));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openRowMenu(id, item);
    });
    item.addEventListener("dragstart", (e) => beginDrag(e, id));
    item.addEventListener("dragend", endDrag);
    if (!store.isDesktop()) {
      item.addEventListener("dragover", (e) => {
        if (searchQuery.trim()) return;
        e.preventDefault();
        item.classList.add("drop-target");
      });
      item.addEventListener("dragleave", () => item.classList.remove("drop-target"));
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove("drop-target");
        const from = e.dataTransfer?.getData("text/plain") ?? "";
        if (!from || from === id) return;
        store.reorder(from, id);
        paintList();
      });
    }
    const more = el(
      "button",
      { type: "button", class: "icon-btn note-more", "data-act": "row-menu", "data-id": id, title: "更多", "aria-label": "更多操作" },
      icon("more"),
    );
    const row = el("div", { class: "note-row" });
    row.append(item, more);
    listEl.append(row);
  };

  const paintTree = (nodes: FileNode[], depth: number, q: string) => {
    for (const node of nodes) {
      if (node.dir) {
        const kids = node.children ?? [];
        const matchSelf = !q || node.name.toLowerCase().includes(q);
        const hasHit = matchSelf || JSON.stringify(kids).toLowerCase().includes(q);
        if (q && !hasHit) continue;
        const folded = collapsed.has(node.path) && !q;
        const row = el("button", { type: "button", class: "tree-folder", "data-folder": node.path });
        const chev = icon("chevron");
        if (!folded) chev.classList.add("open");
        row.append(chev, ...highlight(node.name, q));
        row.style.setProperty("--depth", String(depth));
        row.addEventListener("click", (e) => {
          if (suppressClick) return;
          e.preventDefault();
          e.stopPropagation();
          if (collapsed.has(node.path)) collapsed.delete(node.path);
          else collapsed.add(node.path);
          paintList();
        });
        bindFolderDrop(row, node.path);
        listEl.append(row);
        if (!folded) paintTree(kids, depth + 1, q);
        continue;
      }
      if (q) {
        const n = store.get(node.path);
        const hay = `${node.title} ${node.name} ${n?.content ?? ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const n = store.get(node.path);
      appendFileRow(node.path, n?.title || node.title, n?.updatedAt || node.updatedAt, depth, n?.pinned === true, q);
    }
  };

  const paintTabs = () => {
    tabBar.replaceChildren();
    tabBar.hidden = tabs.ids.length === 0;
    for (const id of tabs.ids) {
      const n = store.get(id);
      const title = n?.title || "未命名";
      const tab = el("div", {
        class: `tab${id === currentId ? " active" : ""}`,
        role: "tab",
        "data-id": id,
        "aria-selected": id === currentId ? "true" : "false",
        title,
      });
      tab.append(
        el("span", { class: "tab-title" }, n?.pinned ? `★ ${title}` : title),
        el("button", { type: "button", class: "tab-close", "data-close-id": id, title: "关闭", "aria-label": `关闭 ${title}` }, icon("close")),
      );
      tabBar.append(tab);
    }
    const activeTab = tabBar.querySelector(".tab.active");
    if (activeTab instanceof HTMLElement) activeTab.scrollIntoView({ inline: "nearest", block: "nearest" });
  };

  const syncSearchChrome = () => {
    const q = searchQuery.trim();
    const matched = listEl.querySelectorAll(".note-item").length;
    searchClear.hidden = search.value.length === 0;
    searchCount.hidden = q.length === 0;
    searchCount.textContent = q ? String(matched) : "";
  };

  const paintList = () => {
    const q = searchQuery.trim().toLowerCase();
    listEl.replaceChildren();
    if (store.isDesktop()) {
      const rootDrop = el("div", { class: "tree-folder drop-root" }, "放到根目录");
      bindFolderDrop(rootDrop, "");
      listEl.append(rootDrop);
      paintTree(store.tree(), 0, q);
      if (listEl.querySelectorAll(".note-item, .tree-folder:not(.drop-root)").length === 0) {
        listEl.append(emptyState(Boolean(q)));
      }
      syncSearchChrome();
      paintStamp();
      paintTabs();
      return;
    }
    if (store.meta().customOrder && !q) {
      listEl.append(
        el(
          "div",
          { class: "order-bar" },
          "自定义顺序",
          el("button", { class: "text-btn", type: "button", "data-act": "reset-order" }, "按时间"),
        ),
      );
    }
    const notes = store.list().filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });
    if (notes.length === 0) {
      listEl.append(emptyState(Boolean(q)));
      syncSearchChrome();
      paintStamp();
      paintTabs();
      return;
    }
    let lastGroup = "";
    const grouped = !store.meta().customOrder;
    for (const n of notes) {
      if (grouped) {
        const g = groupLabel(n.updatedAt);
        if (g !== lastGroup) {
          lastGroup = g;
          listEl.append(el("div", { class: "group" }, g));
        }
      }
      appendFileRow(n.id, n.title, n.updatedAt, 0, n.pinned, q);
    }
    syncSearchChrome();
    paintStamp();
    paintTabs();
  };

  let rowMenu: HTMLElement | null = null;
  const closeRowMenu = () => {
    rowMenu?.remove();
    rowMenu = null;
  };

  const openRowMenu = (id: string, anchor: HTMLElement) => {
    closeRowMenu();
    const n = store.get(id);
    if (!n) return;
    const menu = el("div", { class: "row-menu" });
    const pin = el("button", { type: "button" }, n.pinned ? "取消置顶" : "置顶");
    const dup = el("button", { type: "button" }, "复制");
    const del = el("button", { type: "button", class: "danger" }, "移到回收站");
    pin.onclick = () => {
      store.save(id, { pinned: !n.pinned });
      closeRowMenu();
      paintList();
    };
    dup.onclick = () => {
      const copy = store.get(id);
      if (copy) {
        void (async () => {
          const created = await store.create(copy.content, `${copy.title} 副本`);
          closeRowMenu();
          await openNote(created.id, false);
        })();
      }
    };
    del.onclick = () => {
      closeRowMenu();
      void deleteNote(id);
    };
    menu.dataset.for = id;
    menu.append(pin, dup, del);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.min(r.left, window.innerWidth - 160)}px`;
    document.body.append(menu);
    rowMenu = menu;
  };

  const paintHome = () => {
    const notes = store
      .list()
      .slice()
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, 16);
    const head = el("div", { class: "home-head" });
    head.append(el("h1", {}, "最近"));
    const trashLink = el("button", { class: "text-btn home-trash", type: "button", "data-act": "trash" }, "回收站");
    void store.trashList().then((items) => {
      trashLink.textContent = items.length ? `回收站 ${items.length}` : "回收站";
    });
    head.append(trashLink);
    const lede = el("p", { class: "lede" }, notes.length ? "从一篇接着写，或新建空白笔记。" : "还没有笔记。新建一篇，标题自己打。");
    const createBtn = el("button", { class: "home-new", type: "button", "data-act": "new", tabindex: "0" }, "新建笔记");
    const list = el("div", { class: "home-list" });
    for (const n of notes) {
      const item = el(
        "button",
        { type: "button", class: "home-item", "data-id": n.id },
        el("span", { class: "note-title" }, n.pinned ? `★ ${n.title}` : n.title),
        el("span", { class: "note-meta" }, formatWhen(n.updatedAt)),
      );
      list.append(item);
    }
    homeEl.replaceChildren(head, createBtn, lede, list);
  };

  const showHome = () => {
    persist(true);
    currentId = "";
    tabs.deactivate();
    closeFind();
    homeEl.hidden = false;
    editorRoot.hidden = true;
    document.title = "闪记";
    noteStamp.textContent = "";
    saveDot.hidden = true;
    paintHome();
    paintList();
  };

  const showEditor = () => {
    homeEl.hidden = true;
    editorRoot.hidden = false;
  };

  const openNote = async (id: string, focus = true) => {
    if (currentId === id && !editorRoot.hidden) {
      tabs.open(id);
      paintTabs();
      if (focus) editor?.focus();
      return;
    }
    persist(true);
    const n = (await store.load(id)) ?? store.get(id);
    if (!n) return;
    tabs.open(id);
    currentId = id;
    store.touch(id);
    setSaveState("saved");
    closeFind();
    showEditor();
    editor?.setMarkdown(n.content, false);
    document.title = `${n.title} · 闪记`;
    paintList();
    if (focus) editor?.focus();
  };

  const closeTab = async (id: string) => {
    if (!tabs.has(id)) return;
    persist(true);
    const wasCurrent = currentId === id;
    const next = tabs.close(id);
    if (!wasCurrent) {
      paintList();
      return;
    }
    closeFind();
    if (next) await openNote(next, true);
    else showHome();
  };

  const newMeeting = async () => {
    persist(true);
    const n = await store.create("", "未命名");
    await openNote(n.id, true);
  };

  const closeFind = () => {
    findBar.hidden = true;
    findInput.value = "";
    findCount.textContent = "";
    editor?.clearFind();
  };

  const runFind = (dir: -1 | 0 | 1) => {
    if (!editor || !currentId) return;
    const q = findInput.value;
    const { index, total } = editor.find(q, dir);
    findCount.textContent = q.trim() ? (total ? `${index}/${total}` : "无匹配") : "";
    findInput.focus();
  };

  const openFind = () => {
    if (!currentId || !editor) {
      search.focus();
      return;
    }
    const sel = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (sel && sel.length <= 80) findInput.value = sel;
    findBar.hidden = false;
    findInput.focus();
    findInput.select();
    runFind(0);
  };

  const paintTrash = async () => {
    const items = await store.trashList();
    const sheet = el("div", { class: "sheet trash-sheet", role: "dialog", "aria-label": "回收站" });
    const head = el("div", { class: "trash-head" }, el("h2", {}, "回收站"));
    if (items.length) {
      const emptyBtn = el("button", { class: "text-btn danger-text", type: "button" }, "清空");
      emptyBtn.addEventListener("click", () => {
        if (!window.confirm("彻底删除回收站里的全部笔记？此操作无法撤销。")) return;
        void (async () => {
          await store.emptyTrash();
          await paintTrash();
          paintHome();
          showToast("回收站已清空", { tone: "danger" });
        })();
      });
      head.append(emptyBtn);
    }
    const list = el("div", { class: "trash-list" });
    if (items.length === 0) {
      list.append(el("p", { class: "lede" }, "回收站是空的。删除的笔记会先放在这里。"));
    }
    for (const item of items) {
      const row = el("div", { class: "trash-item" });
      row.append(
        el("div", { class: "trash-meta" }, el("span", { class: "note-title" }, item.title || "未命名"), el("span", { class: "note-meta" }, `删除于 ${formatWhen(item.deletedAt)}`)),
      );
      const restoreBtn = el("button", { class: "text-btn", type: "button" }, "恢复");
      const purgeBtn = el("button", { class: "text-btn danger-text", type: "button" }, "彻底删除");
      restoreBtn.addEventListener("click", () => {
        void (async () => {
          const note = await store.restore(item.id);
          await paintTrash();
          paintList();
          paintHome();
          if (note) {
            trashPop.hidden = true;
            await openNote(note.id, true);
            showToast("已恢复");
          }
        })();
      });
      purgeBtn.addEventListener("click", () => {
        if (!window.confirm(`彻底删除「${item.title || "未命名"}」？此操作无法撤销。`)) return;
        void (async () => {
          await store.purge(item.id);
          await paintTrash();
          paintHome();
          showToast("已彻底删除", { tone: "danger" });
        })();
      });
      row.append(el("div", { class: "trash-actions" }, restoreBtn, purgeBtn));
      list.append(row);
    }
    sheet.append(head, list);
    trashPop.replaceChildren(sheet);
  };

  const openTrash = () => {
    const on = trashPop.hidden;
    closeOverlays();
    if (on) {
      trashPop.hidden = false;
      void paintTrash();
    }
  };

  const deleteNote = async (id: string) => {
    persist(true);
    const wasCurrent = currentId === id;
    const trashId = await store.remove(id);
    const next = tabs.has(id) ? tabs.close(id) : tabs.active;
    if (wasCurrent) currentId = "";
    if (store.list().length === 0) {
      for (const leftover of [...tabs.ids]) tabs.close(leftover);
      closeFind();
      showHome();
    } else if (wasCurrent && next) {
      closeFind();
      await openNote(next, false);
    } else if (wasCurrent) {
      closeFind();
      showHome();
    } else {
      paintList();
      if (!currentId) paintHome();
    }
    if (!trashId) {
      showToast("已移到回收站");
      return;
    }
    showToast("已移到回收站", {
      undo: () => {
        void (async () => {
          const note = await store.restore(trashId);
          if (!note) return;
          if (wasCurrent) await openNote(note.id, true);
          else {
            paintList();
            if (!currentId) paintHome();
          }
          showToast("已恢复");
        })();
      },
    });
  };

  const cycleTheme = () => {
    const ids = THEMES.map((t) => t.id);
    const i = ids.indexOf(store.meta().theme);
    applyTheme(ids[(i + 1) % ids.length] ?? "paper");
    showToast(THEMES.find((t) => t.id === store.meta().theme)?.name ?? "主题");
  };

  const insertTime = () => {
    if (!editor || !currentId) return;
    editor.insert(nowStamp() + " ");
    persist();
  };

  const closeOverlays = () => {
    palette.hidden = true;
    helpPop.hidden = true;
    settingsPop.hidden = true;
    trashPop.hidden = true;
    closeRowMenu();
  };

  const openPalette = () => {
    helpPop.hidden = true;
    settingsPop.hidden = true;
    palette.hidden = false;
    const box = el("div", { class: "sheet palette-sheet" });
    const input = el("input", { class: "palette-input", type: "search", placeholder: "跳转到笔记…", autofocus: "" });
    const results = el("div", { class: "palette-results" });
    box.append(input, results);
    palette.replaceChildren(box);
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const notes = store.list().filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      results.replaceChildren();
      notes.slice(0, 20).forEach((n, i) => {
        const item = el("button", { type: "button", class: `palette-item${i === 0 ? " active" : ""}`, "data-id": n.id });
        item.append(...highlight(n.title, input.value));
        results.append(item);
      });
    };
    render();
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        palette.hidden = true;
        if (currentId) editor?.focus();
      }
      if (e.key === "Enter") {
        const first = results.querySelector("[data-id]") as HTMLElement | null;
        if (first?.dataset.id) {
          palette.hidden = true;
          openNote(first.dataset.id);
        }
      }
    });
    results.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
      if (id) {
        palette.hidden = true;
        openNote(id);
      }
    });
    window.setTimeout(() => input.focus(), 0);
  };

  editor = mountEditor(editorRoot, {
    onChange() {
      persist(false);
    },
    currentNoteId() {
      return currentId;
    },
    async saveImage(file) {
      if (!currentId) return null;
      persist(true);
      try {
        const src = await store.saveImage(currentId, file);
        if (!src) showToast("图片太大或无法保存");
        return src;
      } catch {
        showToast("无法保存图片");
        return null;
      }
    },
  });

  applyTheme(store.meta().theme);
  paintList();
  showHome();

  listEl.addEventListener("click", (e) => {
    if (suppressClick) return;
    const target = e.target as HTMLElement;
    const more = target.closest("[data-act='row-menu']");
    if (more) {
      e.preventDefault();
      e.stopPropagation();
      const id = more.getAttribute("data-id");
      if (!id) return;
      if (rowMenu?.dataset.for === id) closeRowMenu();
      else openRowMenu(id, more as HTMLElement);
      return;
    }
    const id = target.closest("[data-id]")?.getAttribute("data-id");
    if (id) {
      openNote(id);
      closeMobileSidebar();
    }
  });
  homeEl.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    if (id) void openNote(id);
  });

  tabBar.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const closeId = t.closest("[data-close-id]")?.getAttribute("data-close-id");
    if (closeId) {
      e.preventDefault();
      e.stopPropagation();
      void closeTab(closeId);
      return;
    }
    const id = t.closest("[data-id]")?.getAttribute("data-id");
    if (id) void openNote(id);
  });
  tabBar.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  tabBar.addEventListener("auxclick", (e) => {
    if (e.button !== 1) return;
    const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    if (!id) return;
    e.preventDefault();
    void closeTab(id);
  });
  tabBar.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      tabBar.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );

  search.addEventListener("input", () => {
    searchQuery = search.value;
    paintList();
  });

  host.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (!act) return;
    if (act === "home") {
      showHome();
      closeMobileSidebar();
    }
    if (act === "new") {
      void newMeeting();
      closeMobileSidebar();
    }
    if (act === "sidebar") toggleSidebar();
    if (act === "sidebar-close") closeMobileSidebar();
    if (act === "settings") {
      closeMobileSidebar();
      openSettings();
    }
    if (act === "trash") {
      closeMobileSidebar();
      openTrash();
    }
    if (act === "find-prev") runFind(-1);
    if (act === "find-next") runFind(1);
    if (act === "find-close") {
      closeFind();
      if (currentId) editor?.focus();
    }
    if (act === "pick-dir") {
      void (async () => {
        const dir = await store.pickDir();
        if (!dir) return;
        paintSettings();
        const keep = new Set(store.list().map((n) => n.id));
        for (const id of [...tabs.ids]) {
          if (!keep.has(id)) tabs.close(id);
        }
        if (!tabs.active) {
          currentId = "";
          showHome();
        } else if (tabs.active !== currentId) {
          await openNote(tabs.active, false);
        } else {
          paintList();
        }
        showToast("已切换目录");
        editor?.focus();
      })();
    }
    if (act === "export") {
      closeMobileSidebar();
      const n = store.get(currentId);
      if (n) {
        downloadMarkdown(n.title, editor?.getMarkdown() ?? n.content);
        showToast("已导出");
      }
    }
    if (act === "help") {
      const on = helpPop.hidden;
      closeOverlays();
      helpPop.hidden = !on;
    }
    if (act === "theme-toggle") {
      const m = store.meta();
      applyTheme(isDarkTheme(m.theme) ? m.lastLight : m.lastDark);
    }
    if (act === "search-clear") {
      search.value = "";
      searchQuery = "";
      paintList();
      search.focus();
    }
    if (act === "reset-order") {
      store.clearCustomOrder();
      paintList();
    }
  });

  settingsPop.addEventListener("click", (e) => {
    if (e.target === settingsPop) settingsPop.hidden = true;
    const themeId = (e.target as HTMLElement).closest("[data-theme]")?.getAttribute("data-theme") as ThemeId | null;
    if (themeId) applyTheme(themeId);
    const latinId = (e.target as HTMLElement).closest("[data-latin]")?.getAttribute("data-latin") as LatinFontId | null;
    if (latinId) {
      store.setLatinFont(latinId);
      paintSettings();
      editor?.applyChrome();
    }
    const cjkId = (e.target as HTMLElement).closest("[data-cjk]")?.getAttribute("data-cjk") as CjkFontId | null;
    if (cjkId) {
      store.setCjkFont(cjkId);
      paintSettings();
      editor?.applyChrome();
    }
  });
  sizeInput.addEventListener("input", () => {
    store.setFontSize(Number(sizeInput.value));
    paintSettings();
    editor?.applyChrome();
  });

  findInput.addEventListener("input", () => runFind(0));
  findInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeFind();
      if (currentId) editor?.focus();
    }
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (findBar.hidden || e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      runFind(e.shiftKey ? -1 : 1);
    },
    true,
  );
  helpPop.addEventListener("click", (e) => {
    if (e.target === helpPop) helpPop.hidden = true;
  });
  trashPop.addEventListener("click", (e) => {
    if (e.target === trashPop) trashPop.hidden = true;
  });
  palette.addEventListener("click", (e) => {
    if (e.target === palette) palette.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (!rowMenu) return;
    const target = e.target as HTMLElement;
    if (rowMenu.contains(target)) return;
    if (target.closest("[data-act='row-menu']")) return;
    closeRowMenu();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!findBar.hidden) {
        closeFind();
        if (currentId) editor?.focus();
        return;
      }
      closeOverlays();
      closeMobileSidebar();
      if (currentId) editor?.focus();
      return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) return;
      e.preventDefault();
      helpPop.hidden = !helpPop.hidden;
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const t = e.target as HTMLElement;
    const inField = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
    const code = e.code;
    if (code === "KeyN") {
      e.preventDefault();
      void newMeeting();
    } else if (code === "KeyW") {
      e.preventDefault();
      if (currentId) void closeTab(currentId);
    } else if (code === "Tab" && tabs.ids.length) {
      e.preventDefault();
      const next = tabs.cycle(e.shiftKey ? -1 : 1);
      if (next) void openNote(next);
    } else if (code === "PageDown" && tabs.ids.length) {
      e.preventDefault();
      const next = tabs.cycle(1);
      if (next) void openNote(next);
    } else if (code === "PageUp" && tabs.ids.length) {
      e.preventDefault();
      const next = tabs.cycle(-1);
      if (next) void openNote(next);
    } else if (code === "KeyA") {
      if (inField) return;
      if (!currentId) return;
      e.preventDefault();
      editor?.selectAll();
    } else if (code === "Comma") {
      e.preventDefault();
      openSettings();
    } else if (code === "KeyK") {
      e.preventDefault();
      openPalette();
    } else if (code === "Backslash") {
      e.preventDefault();
      toggleSidebar();
    } else if (code === "KeyS") {
      e.preventDefault();
      persist(true);
      showToast("已保存");
    } else if (code === "KeyE") {
      e.preventDefault();
      const n = store.get(currentId);
      if (n) downloadMarkdown(n.title, editor?.getMarkdown() ?? n.content);
    } else if (code === "Semicolon") {
      e.preventDefault();
      insertTime();
    } else if (code === "KeyT" && e.shiftKey) {
      e.preventDefault();
      cycleTheme();
    } else if (code === "KeyF" && e.shiftKey) {
      e.preventDefault();
      store.setFocus(!store.meta().focus);
    } else if (code === "KeyF") {
      e.preventDefault();
      openFind();
    } else if (!e.shiftKey && !inField && currentId && editor) {
      if (code === "KeyB") {
        e.preventDefault();
        editor.format("bold");
      } else if (code === "KeyI") {
        e.preventDefault();
        editor.format("italic");
      } else if (code === "KeyU") {
        e.preventDefault();
        editor.format("underline");
      } else if (/^Digit[1-6]$/.test(code)) {
        e.preventDefault();
        editor.format(`h${code.slice(5)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      }
    }
  });

  window.addEventListener("beforeunload", () => persist(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist(true);
  });
}
