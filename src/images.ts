export const NOTE_ASSET_PREFIX = "/~notes/";
export const DESKTOP_IMAGE_MAX = 8 * 1024 * 1024;
export const BROWSER_IMAGE_MAX = Math.round(1.5 * 1024 * 1024);

const IMAGE_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function noteDir(noteId: string): string {
  const id = noteId.replace(/\\/g, "/");
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(0, i) : "";
}

export function extForImage(file: { type: string; name?: string }): string {
  const fromType = IMAGE_EXT[file.type.toLowerCase()];
  if (fromType) return fromType;
  const name = file.name ?? "";
  const dot = name.lastIndexOf(".");
  if (dot >= 0) {
    const ext = name.slice(dot).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".png";
}

export function imageFileName(noteId: string, ext: string, stamp: string): string {
  const base = noteId.replace(/\\/g, "/").replace(/\.md$/i, "").split("/").pop() || "image";
  const safe = base.replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "") || "image";
  return `${safe}-${stamp}${ext}`;
}

export function imageWritePath(noteId: string, fileName: string): string {
  const dir = noteDir(noteId);
  return dir ? `${dir}/images/${fileName}` : `images/${fileName}`;
}

export function imageSrcInNote(writePath: string, noteId: string): string {
  const dir = noteDir(noteId);
  if (dir && writePath.startsWith(`${dir}/`)) return writePath.slice(dir.length + 1);
  return writePath;
}

export function imageAlt(file: { name?: string }): string {
  const name = file.name?.trim() ?? "";
  if (!name || /^image\.\w+$/i.test(name) || /^image from clipboard/i.test(name)) return "图片";
  return name.replace(/\.[^.]+$/, "") || "图片";
}

export function markdownImage(alt: string, src: string): string {
  return `![${alt}](${src})\n`;
}

export function resolveAssetUrl(src: string, noteId: string): string {
  const clean = src.replace(/^\.\//, "").replace(/\\/g, "/");
  if (/^(https?:|data:|\/~notes\/|#)/i.test(clean)) return src;
  const dir = noteDir(noteId);
  const path = dir ? `${dir}/${clean}` : clean;
  return NOTE_ASSET_PREFIX + path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function displayMarkdown(md: string, noteId: string): string {
  return md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt: string, src: string) => {
    if (/^(https?:|data:|\/~notes\/|#)/i.test(src)) return full;
    return `![${alt}](${resolveAssetUrl(src, noteId)})`;
  });
}

export function storageMarkdown(md: string, noteId: string): string {
  const dir = noteDir(noteId);
  return md.replace(/!\[([^\]]*)\]\((\/~notes\/[^)\s]+)\)/g, (_full, alt: string, src: string) => {
    let rel = decodeURIComponent(src.slice(NOTE_ASSET_PREFIX.length));
    if (dir && (rel === dir || rel.startsWith(`${dir}/`))) rel = rel.slice(dir.length).replace(/^\//, "");
    return `![${alt}](${rel})`;
  });
}

export function localImagePaths(md: string): string[] {
  const out: string[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const src = m[1] ?? "";
    if (/^(https?:|data:|\/~notes\/|#)/i.test(src)) continue;
    out.push(src.replace(/^\.\//, ""));
  }
  return out;
}

export function imageStamp(now = Date.now(), rand = Math.random()): string {
  return `${now.toString(36)}-${Math.floor(rand * 1e5).toString(36)}`;
}
