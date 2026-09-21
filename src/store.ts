import {
  CJK_FONTS,
  LATIN_FONTS,
  THEMES,
  composeEditorFont,
  type CjkFontId,
  type FileNode,
  type LatinFontId,
  type Meta,
  type Note,
  type ThemeId,
  type TrashItem,
} from "./types.ts";

const META_KEY = "flashnote.v1.meta";
const TRASH_KEY = "flashnote.v1.trash";
const noteKey = (id: string) => `flashnote.v1.note.${id}`;
const TRASH_MAX = 80;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 520;

function uid(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clampWidth(px: number): number {
  if (!Number.isFinite(px)) return 268;
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, px)));
}

function clampFontSize(px: number): number {
  if (!Number.isFinite(px)) return 18;
  return Math.round(Math.min(26, Math.max(14, px)));
}

function defaultMeta(): Meta {
  return {
    ids: [],
    lastId: null,
    theme: "paper",
    sidebar: true,
    focus: false,
    sidebarWidth: 268,
    latinFont: "serif",
    cjkFont: "kai",
    fontSize: 18,
  };
}

function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<Meta> & { font?: string };
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((x) => typeof x === "string") : [];
    const theme = THEMES.some((t) => t.id === parsed.theme) ? (parsed.theme as ThemeId) : "paper";
    const migrated = migrateFonts(parsed);
    return {
      ids,
      lastId: typeof parsed.lastId === "string" ? parsed.lastId : null,
      theme,
      sidebar: parsed.sidebar !== false,
      focus: parsed.focus === true,
      sidebarWidth: clampWidth(typeof parsed.sidebarWidth === "number" ? parsed.sidebarWidth : 268),
      latinFont: migrated.latinFont,
      cjkFont: migrated.cjkFont,
      fontSize: clampFontSize(typeof parsed.fontSize === "number" ? parsed.fontSize : 18),
    };
  } catch {
    return defaultMeta();
  }
}

function writeMeta(meta: Meta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

const noteCache = new Map<string, Note>();

function readNote(id: string): Note | null {
  const hit = noteCache.get(id);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(noteKey(id));
    if (!raw) return null;
    const n = JSON.parse(raw) as Note;
    if (!n || typeof n.id !== "string") return null;
    const note: Note = {
      id: n.id,
      title: typeof n.title === "string" && n.title ? n.title : "未命名",
      content: typeof n.content === "string" ? n.content : "",
      createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      pinned: n.pinned === true,
    };
    noteCache.set(id, note);
    return note;
  } catch {
    return null;
  }
}

function writeNote(note: Note): void {
  noteCache.set(note.id, note);
  localStorage.setItem(noteKey(note.id), JSON.stringify(note));
}

function readTrash(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrashItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && typeof t.noteId === "string");
  } catch {
    return [];
  }
}

function writeTrash(items: TrashItem[]): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items.slice(0, TRASH_MAX)));
}

function flattenFiles(nodes: FileNode[], out: Note[] = []): Note[] {
  for (const n of nodes) {
    if (n.dir) flattenFiles(n.children ?? [], out);
    else {
      const prev = noteCache.get(n.path);
      out.push({
        id: n.path,
        title: n.title || n.name.replace(/\.md$/i, ""),
        content: prev?.content ?? "",
        createdAt: prev?.createdAt ?? n.updatedAt,
        updatedAt: n.updatedAt,
        pinned: prev?.pinned === true,
      });
    }
  }
  return out;
}

let meta = readMeta();
let desktop = false;
let storageDir = "";
let fileTree: FileNode[] = [];

function applySidebarWidth(px: number): void {
  document.documentElement.style.setProperty("--sidebar-width", `${px}px`);
}

function migrateFonts(parsed: Partial<Meta> & { font?: string }): { latinFont: LatinFontId; cjkFont: CjkFontId } {
  const latinOk = LATIN_FONTS.some((f) => f.id === parsed.latinFont);
  const cjkOk = CJK_FONTS.some((f) => f.id === parsed.cjkFont);
  if (latinOk && cjkOk) {
    return { latinFont: parsed.latinFont as LatinFontId, cjkFont: parsed.cjkFont as CjkFontId };
  }
  switch (parsed.font) {
    case "sans":
      return { latinFont: "sans", cjkFont: "hei" };
    case "song":
      return { latinFont: "serif", cjkFont: "song" };
    case "kai":
      return { latinFont: "serif", cjkFont: "kai" };
    case "mono":
      return { latinFont: "mono", cjkFont: "hei" };
    default:
      return { latinFont: "serif", cjkFont: "kai" };
  }
}

function applyTypography(latinFont: LatinFontId, cjkFont: CjkFontId, fontSize: number): void {
  document.documentElement.style.setProperty("--editor-font", composeEditorFont(latinFont, cjkFont));
  document.documentElement.style.setProperty("--editor-size", `${fontSize}px`);
  document.documentElement.setAttribute("data-latin-font", latinFont);
  document.documentElement.setAttribute("data-cjk-font", cjkFont);
}

export const store = {
  sidebarMin: SIDEBAR_MIN,
  sidebarMax: SIDEBAR_MAX,

  isDesktop(): boolean {
    return desktop;
  },

  storageDir(): string {
    return storageDir;
  },

  tree(): FileNode[] {
    return fileTree;
  },

  meta(): Meta {
    return meta;
  },

  async init(): Promise<void> {
    meta = readMeta();
    applySidebarWidth(meta.sidebarWidth);
    applyTypography(meta.latinFont, meta.cjkFont, meta.fontSize);
    desktop = typeof window.flashGetDir === "function" && typeof window.flashList === "function";
    if (!desktop) return;
    storageDir = (await window.flashGetDir?.()) ?? "";
    await this.refresh();
    if (fileTree.length === 0 && this.localNotes().length > 0) {
      for (const n of this.localNotes()) {
        await window.flashCreate?.(n.title, n.content);
      }
      await this.refresh();
    }
  },

  localNotes(): Note[] {
    return meta.ids.map(readNote).filter((n): n is Note => n !== null);
  },

  async refresh(): Promise<void> {
    if (!desktop || !window.flashList) {
      fileTree = [];
      return;
    }
    fileTree = (await window.flashList()) ?? [];
    const listed = flattenFiles(fileTree);
    const keep = new Set(listed.map((n) => n.id));
    for (const id of [...noteCache.keys()]) {
      if (!keep.has(id)) noteCache.delete(id);
    }
    for (const n of listed) {
      const prev = noteCache.get(n.id);
      noteCache.set(n.id, prev ? { ...n, content: prev.content, pinned: prev.pinned } : n);
    }
  },

  setTheme(theme: ThemeId): void {
    meta = { ...meta, theme };
    writeMeta(meta);
    document.documentElement.setAttribute("data-theme", theme);
  },

  setSidebar(sidebar: boolean): void {
    meta = { ...meta, sidebar };
    writeMeta(meta);
    document.documentElement.classList.toggle("sidebar-collapsed", !sidebar);
  },

  setSidebarWidth(px: number): void {
    const sidebarWidth = clampWidth(px);
    meta = { ...meta, sidebarWidth };
    writeMeta(meta);
    applySidebarWidth(sidebarWidth);
  },

  setFocus(focus: boolean): void {
    meta = { ...meta, focus };
    writeMeta(meta);
    document.documentElement.classList.toggle("focus-mode", focus);
  },

  setLatinFont(latinFont: LatinFontId): void {
    meta = { ...meta, latinFont };
    writeMeta(meta);
    applyTypography(meta.latinFont, meta.cjkFont, meta.fontSize);
  },

  setCjkFont(cjkFont: CjkFontId): void {
    meta = { ...meta, cjkFont };
    writeMeta(meta);
    applyTypography(meta.latinFont, meta.cjkFont, meta.fontSize);
  },

  setFontSize(px: number): void {
    meta = { ...meta, fontSize: clampFontSize(px) };
    writeMeta(meta);
    applyTypography(meta.latinFont, meta.cjkFont, meta.fontSize);
  },

  list(): Note[] {
    if (desktop) {
      return flattenFiles(fileTree).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
    }
    const notes = meta.ids.map(readNote).filter((n): n is Note => n !== null);
    if (notes.length !== meta.ids.length) {
      meta = { ...meta, ids: notes.map((n) => n.id) };
      writeMeta(meta);
    }
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  },

  get(id: string): Note | null {
    if (desktop) return noteCache.get(id) ?? flattenFiles(fileTree).find((n) => n.id === id) ?? null;
    return readNote(id);
  },

  async load(id: string): Promise<Note | null> {
    if (!desktop) return readNote(id);
    const prev = this.get(id);
    if (!window.flashRead) return prev;
    const content = await window.flashRead(id);
    const next: Note = {
      id,
      title: prev?.title || id.replace(/\.md$/i, ""),
      content,
      createdAt: prev?.createdAt ?? Date.now(),
      updatedAt: prev?.updatedAt ?? Date.now(),
      pinned: prev?.pinned === true,
    };
    noteCache.set(id, next);
    return next;
  },

  last(): Note | null {
    if (meta.lastId) {
      const n = this.get(meta.lastId);
      if (n) return n;
    }
    const all = this.list();
    return all[0] ?? null;
  },

  async create(content: string, title: string): Promise<Note> {
    const t = Date.now();
    if (desktop && window.flashCreate) {
      const path = await window.flashCreate(title, content);
      const note: Note = { id: path, title, content, createdAt: t, updatedAt: t, pinned: false };
      noteCache.set(path, note);
      meta = { ...meta, lastId: path };
      writeMeta(meta);
      await this.refresh();
      return note;
    }
    const note: Note = {
      id: uid(),
      title,
      content,
      createdAt: t,
      updatedAt: t,
      pinned: false,
    };
    writeNote(note);
    meta = { ...meta, ids: [note.id, ...meta.ids.filter((id) => id !== note.id)], lastId: note.id };
    writeMeta(meta);
    return note;
  },

  save(id: string, patch: Partial<Pick<Note, "title" | "content" | "pinned">>): Note | null {
    const prev = this.get(id);
    if (!prev) return null;
    const title = patch.title !== undefined ? patch.title : prev.title;
    const content = patch.content !== undefined ? patch.content : prev.content;
    const pinned = patch.pinned !== undefined ? patch.pinned : prev.pinned;
    if (title === prev.title && content === prev.content && pinned === prev.pinned) {
      return prev;
    }
    const next: Note = {
      ...prev,
      title,
      content,
      pinned,
      updatedAt: Date.now(),
    };
    noteCache.set(id, next);
    if (desktop) {
      if (patch.content !== undefined) void window.flashWrite?.(id, next.content);
    } else {
      writeNote(next);
    }
    if (meta.lastId !== id) {
      meta = { ...meta, lastId: id };
      writeMeta(meta);
    }
    return next;
  },

  touch(id: string): void {
    meta = { ...meta, lastId: id };
    writeMeta(meta);
  },

  async remove(id: string): Promise<void> {
    const note = (await this.load(id)) ?? this.get(id);
    if (!note) return;
    if (desktop && window.flashTrash) {
      await window.flashTrash(id);
      noteCache.delete(id);
      await this.refresh();
      if (meta.lastId === id) {
        meta = { ...meta, lastId: this.list()[0]?.id ?? null };
        writeMeta(meta);
      }
      return;
    }
    if (desktop) {
      await window.flashDelete?.(id);
      noteCache.delete(id);
      await this.refresh();
      if (meta.lastId === id) {
        meta = { ...meta, lastId: this.list()[0]?.id ?? null };
        writeMeta(meta);
      }
      return;
    }
    const item: TrashItem = {
      id: uid(),
      noteId: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: Date.now(),
    };
    writeTrash([item, ...readTrash().filter((t) => t.noteId !== id)]);
    noteCache.delete(id);
    localStorage.removeItem(noteKey(id));
    const ids = meta.ids.filter((x) => x !== id);
    meta = { ...meta, ids, lastId: meta.lastId === id ? (ids[0] ?? null) : meta.lastId };
    writeMeta(meta);
  },

  async trashList(): Promise<TrashItem[]> {
    if (desktop && window.flashTrashList) {
      return (await window.flashTrashList()) ?? [];
    }
    return readTrash().sort((a, b) => b.deletedAt - a.deletedAt);
  },

  async restore(trashId: string): Promise<Note | null> {
    if (desktop && window.flashRestore) {
      const path = await window.flashRestore(trashId);
      await this.refresh();
      const note = await this.load(path);
      if (note) {
        meta = { ...meta, lastId: note.id };
        writeMeta(meta);
      }
      return note;
    }
    const items = readTrash();
    const item = items.find((t) => t.id === trashId);
    if (!item) return null;
    writeTrash(items.filter((t) => t.id !== trashId));
    const taken = new Set(meta.ids);
    const id = taken.has(item.noteId) ? uid() : item.noteId;
    const note: Note = {
      id,
      title: item.title || "未命名",
      content: item.content ?? "",
      createdAt: item.createdAt || Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    writeNote(note);
    meta = { ...meta, ids: [note.id, ...meta.ids.filter((x) => x !== note.id)], lastId: note.id };
    writeMeta(meta);
    return note;
  },

  async purge(trashId: string): Promise<void> {
    if (desktop && window.flashPurge) {
      await window.flashPurge(trashId);
      return;
    }
    writeTrash(readTrash().filter((t) => t.id !== trashId));
  },

  async emptyTrash(): Promise<void> {
    if (desktop && window.flashEmptyTrash) {
      await window.flashEmptyTrash();
      return;
    }
    writeTrash([]);
  },

  async pickDir(): Promise<string | null> {
    if (!window.flashPickDir) return null;
    const dir = await window.flashPickDir();
    if (!dir) return null;
    storageDir = dir;
    noteCache.clear();
    await this.refresh();
    return dir;
  },
};
