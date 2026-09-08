import { CJK_FONTS, LATIN_FONTS, THEMES, type CjkFontId, type FileNode, type LatinFontId, type ThemeId } from "./types.ts";
import { store } from "./store.ts";
import { mountEditor, type EditorHandle } from "./editor.ts";
import { nowStamp, titleFromMarkdown } from "./markdown.ts";

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

  const sidebar = el(
    "aside",
    { class: "sidebar" },
    el(
      "div",
      { class: "sidebar-head" },
      el("button", { class: "brand", type: "button", "data-act": "home", title: "最近笔记" }, el("span", { class: "mark", "aria-hidden": "true" }), "闪记"),
      el("button", { class: "icon-btn", type: "button", "data-act": "new", title: "新建笔记 Ctrl+N" }, "+"),
    ),
    search,
    listEl,
    el(
      "div",
      { class: "sidebar-foot" },
      el("button", { class: "text-btn", type: "button", "data-act": "settings", title: "设置 Ctrl+," }, "设置"),
      el("button", { class: "text-btn", type: "button", "data-act": "export", title: "导出 Ctrl+E" }, "导出"),
    ),
    el("div", { class: "sidebar-resizer", title: "拖动调整宽度" }),
  );

  const topbar = el(
    "header",
    { class: "topbar" },
    el("button", { class: "icon-btn", type: "button", "data-act": "sidebar", title: "目录 Ctrl+\\" }, "☰"),
    noteStamp,
    el("span", { class: "flex" }),
    el("button", { class: "text-btn", type: "button", "data-act": "help", title: "快捷键 ?" }, "?"),
  );

  const main = el("div", { class: "main" }, topbar, el("div", { class: "editor-scroll" }, homeEl, editorRoot));
  host.append(sidebar, main, backdrop, settingsPop, palette, helpPop, toast);

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
        <div><dt>Ctrl + N</dt><dd>新建空白笔记</dd></div>
        <div><dt>Ctrl + K</dt><dd>搜索 / 跳转</dd></div>
        <div><dt>Ctrl + \\</dt><dd>显示或隐藏目录</dd></div>
        <div><dt>Ctrl + A</dt><dd>全选当前笔记</dd></div>
        <div><dt>Ctrl + B</dt><dd>粗体</dd></div>
        <div><dt>Ctrl + I</dt><dd>斜体</dd></div>
        <div><dt>Ctrl + U</dt><dd>下划线</dd></div>
        <div><dt>Ctrl + 1 … 6</dt><dd>一级到六级标题</dd></div>
        <div><dt>Tab</dt><dd>列表缩进</dd></div>
        <div><dt>Shift + Tab</dt><dd>取消缩进</dd></div>
        <div><dt>Ctrl + ,</dt><dd>设置</dd></div>
        <div><dt>Ctrl + Shift + F</dt><dd>专注模式</dd></div>
        <div><dt>Ctrl + Shift + T</dt><dd>下一主题</dd></div>
        <div><dt>Ctrl + ;</dt><dd>插入当前时间</dd></div>
        <div><dt>Ctrl + E</dt><dd>导出 Markdown</dd></div>
        <div><dt>Ctrl + S</dt><dd>立即保存</dd></div>
        <div><dt>Enter</dt><dd>下一段；列表中继续一条</dd></div>
      </dl>
      <p class="hint">拖动左侧目录边缘可调整宽度。Tab / Shift+Tab 缩进或取消缩进列表。Ctrl+, 打开设置。</p>
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
  let editor: EditorHandle | null = null;
  let saveTimer = 0;
  let searchQuery = "";
  let toastTimer = 0;

  const showToast = (text: string) => {
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1200);
  };

  const applyTheme = (id: ThemeId) => {
    store.setTheme(id);
    paintSettings();
    editor?.applyChrome();
  };

  const persist = (immediate = false) => {
    if (!currentId || !editor) return;
    const run = () => {
      const content = editor!.getMarkdown();
      const title = titleFromMarkdown(content);
      const n = store.save(currentId, { content, title });
      if (!n) return;
      const row = listEl.querySelector(`.note-item[data-id="${CSS.escape(currentId)}"]`);
      if (row) {
        const t = row.querySelector(".note-title");
        const m = row.querySelector(".note-meta");
        const nextTitle = n.pinned ? `★ ${title}` : title;
        if (t && t.textContent !== nextTitle) t.textContent = nextTitle;
        const when = formatWhen(n.updatedAt);
        if (m && m.textContent !== when) m.textContent = when;
      }
      const stamp = formatWhen(n.updatedAt);
      if (noteStamp.textContent !== stamp) noteStamp.textContent = stamp;
      const nextDoc = `${title} · 闪记`;
      if (document.title !== nextDoc) document.title = nextDoc;
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

  const appendFileRow = (id: string, title: string, updatedAt: number, depth: number, pinned: boolean) => {
    const item = el(
      "button",
      {
        type: "button",
        class: `note-item${id === currentId ? " active" : ""}`,
        "data-id": id,
        role: "listitem",
      },
      el("span", { class: "note-title" }, pinned ? `★ ${title}` : title),
      el("span", { class: "note-meta" }, formatWhen(updatedAt)),
    );
    item.style.setProperty("--depth", String(depth));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openRowMenu(id, item);
    });
    listEl.append(item);
  };

  const paintTree = (nodes: FileNode[], depth: number, q: string) => {
    for (const node of nodes) {
      if (node.dir) {
        const kids = node.children ?? [];
        const matchSelf = !q || node.name.toLowerCase().includes(q);
        const hasHit = matchSelf || JSON.stringify(kids).toLowerCase().includes(q);
        if (q && !hasHit) continue;
        const folded = collapsed.has(node.path) && !q;
        const row = el(
          "button",
          { type: "button", class: "tree-folder", "data-folder": node.path },
          `${folded ? "▸" : "▾"} ${node.name}`,
        );
        row.style.setProperty("--depth", String(depth));
        row.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (collapsed.has(node.path)) collapsed.delete(node.path);
          else collapsed.add(node.path);
          paintList();
        });
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
      appendFileRow(node.path, n?.title || node.title, n?.updatedAt || node.updatedAt, depth, n?.pinned === true);
    }
  };

  const paintList = () => {
    const q = searchQuery.trim().toLowerCase();
    listEl.replaceChildren();
    if (store.isDesktop()) {
      paintTree(store.tree(), 0, q);
      if (listEl.childElementCount === 0) {
        listEl.append(el("div", { class: "empty-list" }, q ? "没有匹配的笔记" : "还没有笔记"));
      }
      paintStamp();
      return;
    }
    const notes = store.list().filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });
    if (notes.length === 0) {
      listEl.append(el("div", { class: "empty-list" }, q ? "没有匹配的笔记" : "还没有笔记"));
      paintStamp();
      return;
    }
    let lastGroup = "";
    for (const n of notes) {
      const g = groupLabel(n.updatedAt);
      if (g !== lastGroup) {
        lastGroup = g;
        listEl.append(el("div", { class: "group" }, g));
      }
      appendFileRow(n.id, n.title, n.updatedAt, 0, n.pinned);
    }
    paintStamp();
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
    const del = el("button", { type: "button", class: "danger" }, "删除");
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
    menu.append(pin, dup, del);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.min(r.left, window.innerWidth - 160)}px`;
    document.body.append(menu);
    rowMenu = menu;
  };

  const paintHome = () => {
    const notes = store.list().slice(0, 16);
    const head = el("h1", {}, "最近");
    const lede = el("p", { class: "lede" }, notes.length ? "从一篇接着写，或新建空白笔记。" : "还没有笔记。新建一篇，标题自己打。");
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
    const createBtn = el("button", { class: "home-new", type: "button", "data-act": "new", tabindex: "0" }, "新建笔记");
    homeEl.replaceChildren(head, lede, list, createBtn);
  };

  const showHome = () => {
    persist(true);
    currentId = "";
    homeEl.hidden = false;
    editorRoot.hidden = true;
    document.title = "闪记";
    noteStamp.textContent = "";
    paintHome();
    paintList();
  };

  const showEditor = () => {
    homeEl.hidden = true;
    editorRoot.hidden = false;
  };

  const openNote = async (id: string, focus = true) => {
    persist(true);
    const n = (await store.load(id)) ?? store.get(id);
    if (!n) return;
    currentId = id;
    store.touch(id);
    showEditor();
    editor?.setMarkdown(n.content, false);
    document.title = `${n.title} · 闪记`;
    paintList();
    if (focus) editor?.focus();
  };

  const newMeeting = async () => {
    persist(true);
    const n = await store.create("", "未命名");
    await openNote(n.id, true);
  };

  const deleteNote = async (id: string) => {
    await store.remove(id);
    if (id === currentId || store.list().length === 0) {
      showHome();
      return;
    }
    paintList();
    if (!currentId) paintHome();
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
        const item = el("button", { type: "button", class: `palette-item${i === 0 ? " active" : ""}`, "data-id": n.id }, n.title);
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
  });

  applyTheme(store.meta().theme);
  paintList();
  showHome();

  listEl.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    if (id) {
      openNote(id);
      closeMobileSidebar();
    }
  });
  homeEl.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    if (id) void openNote(id);
  });

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
    if (act === "pick-dir") {
      void (async () => {
        const dir = await store.pickDir();
        if (!dir) return;
        paintSettings();
        const notes = store.list();
        if (notes.length === 0) {
          showHome();
        } else if (!notes.some((n) => n.id === currentId)) {
          showHome();
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

  helpPop.addEventListener("click", (e) => {
    if (e.target === helpPop) helpPop.hidden = true;
  });
  palette.addEventListener("click", (e) => {
    if (e.target === palette) palette.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (rowMenu && !rowMenu.contains(e.target as Node)) closeRowMenu();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
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
    } else if (!e.shiftKey && !inField && currentId && editor) {
      if (code === "KeyB") {
        e.preventDefault();
        editor.focus();
        editor.format("bold");
      } else if (code === "KeyI") {
        e.preventDefault();
        editor.focus();
        editor.format("italic");
      } else if (code === "KeyU") {
        e.preventDefault();
        editor.focus();
        editor.format("underline");
      } else if (/^Digit[1-6]$/.test(code)) {
        e.preventDefault();
        editor.focus();
        editor.format(`h${code.slice(5)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      }
    }
  });

  window.addEventListener("beforeunload", () => persist(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist(true);
  });
}
