import { THEMES, type ThemeId } from "./types.ts";
import { store } from "./store.ts";
import { mountEditor, type EditorHandle } from "./editor.ts";
import { meetingTemplate, nowStamp, titleFromMarkdown } from "./markdown.ts";

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
  const editorRoot = el("div", { id: "editor", class: "editor-root" });
  const noteStamp = el("span", { class: "note-stamp" });
  const toast = el("div", { class: "toast", hidden: "" }, "已保存");
  const palette = el("div", { class: "overlay palette", hidden: "" });
  const themePop = el("div", { class: "popover themes", hidden: "" });
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
      el("div", { class: "brand" }, el("span", { class: "mark", "aria-hidden": "true" }), "闪记"),
      el("button", { class: "icon-btn", type: "button", "data-act": "new", title: "新会议笔记 Ctrl+N" }, "+"),
    ),
    search,
    listEl,
  );

  const topbar = el(
    "header",
    { class: "topbar" },
    el("button", { class: "icon-btn", type: "button", "data-act": "sidebar", title: "目录 Ctrl+\\" }, "☰"),
    noteStamp,
    el("span", { class: "flex" }),
    el("button", { class: "text-btn", type: "button", "data-act": "theme", title: "主题" }, "主题"),
    el("button", { class: "text-btn", type: "button", "data-act": "export", title: "导出 Ctrl+E" }, "导出"),
    el("button", { class: "text-btn", type: "button", "data-act": "help", title: "快捷键 ?" }, "?"),
  );

  const main = el("div", { class: "main" }, topbar, el("div", { class: "editor-scroll" }, editorRoot));
  host.append(sidebar, main, backdrop, themePop, palette, helpPop, toast);

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
      <h2>打开就能写</h2>
      <p>闪记为开会准备：启动后立刻落在编辑区。用 Markdown 写，当前段是原文，离开后立刻变成排版后的样子。</p>
      <dl>
        <div><dt>Ctrl + N</dt><dd>新会议笔记</dd></div>
        <div><dt>Ctrl + K</dt><dd>搜索 / 跳转</dd></div>
        <div><dt>Ctrl + \\</dt><dd>显示或隐藏目录</dd></div>
        <div><dt>Ctrl + Shift + F</dt><dd>专注模式</dd></div>
        <div><dt>Ctrl + Shift + T</dt><dd>下一主题</dd></div>
        <div><dt>Ctrl + ;</dt><dd>插入当前时间</dd></div>
        <div><dt>Ctrl + E</dt><dd>导出 Markdown</dd></div>
        <div><dt>Ctrl + S</dt><dd>立即保存</dd></div>
        <div><dt>Enter</dt><dd>下一段；列表中继续一条</dd></div>
      </dl>
      <p class="hint">标题用 <code># </code>，待办用 <code>- [ ] </code>，强调用 <code>**文字**</code>。</p>
    </div>`;

  THEMES.forEach((t) => {
    const b = el("button", { type: "button", class: "theme-swatch", "data-theme": t.id, title: t.name });
    b.style.setProperty("--swatch", t.swatch);
    b.style.setProperty("--ink", t.ink);
    b.append(el("i"), t.name);
    themePop.append(b);
  });

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
    themePop.querySelectorAll(".theme-swatch").forEach((n) => {
      n.classList.toggle("active", (n as HTMLElement).dataset.theme === id);
    });
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

  const paintList = () => {
    const q = searchQuery.trim().toLowerCase();
    const notes = store.list().filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });
    listEl.replaceChildren();
    if (notes.length === 0) {
      listEl.append(el("div", { class: "empty-list" }, q ? "没有匹配的笔记" : "还没有笔记"));
      return;
    }
    let lastGroup = "";
    for (const n of notes) {
      const g = groupLabel(n.updatedAt);
      if (g !== lastGroup) {
        lastGroup = g;
        listEl.append(el("div", { class: "group" }, g));
      }
      const item = el(
        "button",
        {
          type: "button",
          class: `note-item${n.id === currentId ? " active" : ""}`,
          "data-id": n.id,
          role: "listitem",
        },
        el("span", { class: "note-title" }, n.pinned ? `★ ${n.title}` : n.title),
        el("span", { class: "note-meta" }, formatWhen(n.updatedAt)),
      );
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openRowMenu(n.id, item);
      });
      listEl.append(item);
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
        const created = store.create(copy.content, `${copy.title} 副本`);
        closeRowMenu();
        openNote(created.id, false);
      }
    };
    del.onclick = () => {
      closeRowMenu();
      deleteNote(id);
    };
    menu.append(pin, dup, del);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.min(r.left, window.innerWidth - 160)}px`;
    document.body.append(menu);
    rowMenu = menu;
  };

  const openNote = (id: string, focus = true) => {
    persist(true);
    const n = store.get(id);
    if (!n) return;
    currentId = id;
    store.touch(id);
    editor?.setMarkdown(n.content, false);
    document.title = `${n.title} · 闪记`;
    paintList();
    if (focus) editor?.focus();
  };

  const newMeeting = () => {
    persist(true);
    const content = meetingTemplate();
    const n = store.create(content, titleFromMarkdown(content));
    currentId = n.id;
    editor?.setMarkdown(content, true);
    document.title = `${n.title} · 闪记`;
    paintList();
    editor?.focus();
  };

  const deleteNote = (id: string) => {
    store.remove(id);
    if (store.list().length === 0) {
      const content = meetingTemplate();
      const n = store.create(content, titleFromMarkdown(content));
      openNote(n.id);
      return;
    }
    if (id === currentId) {
      const next = store.last() ?? store.list()[0];
      if (next) openNote(next.id);
    } else {
      paintList();
    }
  };

  const cycleTheme = () => {
    const ids = THEMES.map((t) => t.id);
    const i = ids.indexOf(store.meta().theme);
    applyTheme(ids[(i + 1) % ids.length] ?? "paper");
    showToast(THEMES.find((t) => t.id === store.meta().theme)?.name ?? "主题");
  };

  const insertTime = () => {
    if (!editor) return;
    const md = editor.getMarkdown();
    editor.setMarkdown(`${md.replace(/\s+$/, "")}\n\n${nowStamp()} `, true);
    persist();
  };

  const closeOverlays = () => {
    palette.hidden = true;
    helpPop.hidden = true;
    themePop.hidden = true;
    closeRowMenu();
  };

  const openPalette = () => {
    helpPop.hidden = true;
    themePop.hidden = true;
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
        editor?.focus();
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

  let initial = store.last();
  if (!initial) {
    const content = meetingTemplate();
    initial = store.create(content, titleFromMarkdown(content));
  }
  currentId = initial.id;
  editor.setMarkdown(initial.content, true);
  document.title = `${initial.title} · 闪记`;
  applyTheme(store.meta().theme);
  paintList();
  editor.focus();

  listEl.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    if (id) {
      openNote(id);
      closeMobileSidebar();
    }
  });

  search.addEventListener("input", () => {
    searchQuery = search.value;
    paintList();
  });

  host.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (!act) return;
    if (act === "new") {
      newMeeting();
      closeMobileSidebar();
    }
    if (act === "sidebar") toggleSidebar();
    if (act === "sidebar-close") closeMobileSidebar();
    if (act === "theme") {
      const on = themePop.hidden;
      closeOverlays();
      themePop.hidden = !on;
    }
    if (act === "export") {
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

  themePop.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-theme]")?.getAttribute("data-theme") as ThemeId | null;
    if (!id) return;
    applyTheme(id);
    themePop.hidden = true;
    editor?.focus();
  });

  helpPop.addEventListener("click", (e) => {
    if (e.target === helpPop) helpPop.hidden = true;
  });
  palette.addEventListener("click", (e) => {
    if (e.target === palette) palette.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (rowMenu && !rowMenu.contains(e.target as Node)) closeRowMenu();
    if (!themePop.hidden && !(e.target as HTMLElement).closest("[data-act='theme']") && !themePop.contains(e.target as Node)) {
      themePop.hidden = true;
    }
  });

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (e.key === "Escape") {
      closeOverlays();
      closeMobileSidebar();
      editor?.focus();
      return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
      e.preventDefault();
      helpPop.hidden = !helpPop.hidden;
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (key === "n") {
      e.preventDefault();
      newMeeting();
    } else if (key === "k") {
      e.preventDefault();
      openPalette();
    } else if (key === "\\") {
      e.preventDefault();
      toggleSidebar();
    } else if (key === "s") {
      e.preventDefault();
      persist(true);
      showToast("已保存");
    } else if (key === "e") {
      e.preventDefault();
      const n = store.get(currentId);
      if (n) downloadMarkdown(n.title, editor?.getMarkdown() ?? n.content);
    } else if (key === ";" ) {
      e.preventDefault();
      insertTime();
    } else if (key === "t" && e.shiftKey) {
      e.preventDefault();
      cycleTheme();
    } else if (key === "f" && e.shiftKey) {
      e.preventDefault();
      store.setFocus(!store.meta().focus);
    }
  });

  window.addEventListener("beforeunload", () => persist(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist(true);
  });
}
