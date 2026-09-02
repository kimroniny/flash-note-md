import { THEMES, type Meta, type Note, type ThemeId } from "./types.ts";

const META_KEY = "flashnote.v1.meta";
const noteKey = (id: string) => `flashnote.v1.note.${id}`;

function uid(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultMeta(): Meta {
  return {
    ids: [],
    lastId: null,
    theme: "paper",
    sidebar: true,
    focus: false,
  };
}

function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<Meta>;
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((x) => typeof x === "string") : [];
    const theme = THEMES.some((t) => t.id === parsed.theme) ? (parsed.theme as ThemeId) : "paper";
    return {
      ids,
      lastId: typeof parsed.lastId === "string" ? parsed.lastId : null,
      theme,
      sidebar: parsed.sidebar !== false,
      focus: parsed.focus === true,
    };
  } catch {
    return defaultMeta();
  }
}

function writeMeta(meta: Meta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function readNote(id: string): Note | null {
  try {
    const raw = localStorage.getItem(noteKey(id));
    if (!raw) return null;
    const n = JSON.parse(raw) as Note;
    if (!n || typeof n.id !== "string") return null;
    return {
      id: n.id,
      title: typeof n.title === "string" && n.title ? n.title : "未命名会议",
      content: typeof n.content === "string" ? n.content : "",
      createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      pinned: n.pinned === true,
    };
  } catch {
    return null;
  }
}

let meta = readMeta();

export const store = {
  meta(): Meta {
    return meta;
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

  setFocus(focus: boolean): void {
    meta = { ...meta, focus };
    writeMeta(meta);
    document.documentElement.classList.toggle("focus-mode", focus);
  },

  list(): Note[] {
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
    return readNote(id);
  },

  last(): Note | null {
    if (meta.lastId) {
      const n = readNote(meta.lastId);
      if (n) return n;
    }
    const all = this.list();
    return all[0] ?? null;
  },

  create(content: string, title: string): Note {
    const t = Date.now();
    const note: Note = {
      id: uid(),
      title,
      content,
      createdAt: t,
      updatedAt: t,
      pinned: false,
    };
    localStorage.setItem(noteKey(note.id), JSON.stringify(note));
    meta = { ...meta, ids: [note.id, ...meta.ids.filter((id) => id !== note.id)], lastId: note.id };
    writeMeta(meta);
    return note;
  },

  save(id: string, patch: Partial<Pick<Note, "title" | "content" | "pinned">>): Note | null {
    const prev = readNote(id);
    if (!prev) return null;
    const next: Note = {
      ...prev,
      ...patch,
      updatedAt: Date.now(),
    };
    localStorage.setItem(noteKey(id), JSON.stringify(next));
    meta = { ...meta, lastId: id, ids: [id, ...meta.ids.filter((x) => x !== id)] };
    writeMeta(meta);
    return next;
  },

  touch(id: string): void {
    meta = { ...meta, lastId: id };
    writeMeta(meta);
  },

  remove(id: string): void {
    localStorage.removeItem(noteKey(id));
    const ids = meta.ids.filter((x) => x !== id);
    meta = { ...meta, ids, lastId: meta.lastId === id ? (ids[0] ?? null) : meta.lastId };
    writeMeta(meta);
  },
};
