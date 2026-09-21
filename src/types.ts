export const THEMES = [
  { id: "paper", name: "日光", swatch: "#f6f1e8", ink: "#1c1917" },
  { id: "ink", name: "墨夜", swatch: "#16141f", ink: "#ece8df" },
  { id: "sepia", name: "羊皮纸", swatch: "#f0e2c8", ink: "#3f2a14" },
  { id: "forest", name: "林间", swatch: "#e7f0e4", ink: "#1d3320" },
  { id: "ocean", name: "深海", swatch: "#0f1c28", ink: "#d5e6f2" },
  { id: "sakura", name: "樱花", swatch: "#fff0f3", ink: "#4a1e2b" },
  { id: "slate", name: "石墨", swatch: "#e8eaee", ink: "#1b1f24" },
  { id: "contrast", name: "高对比", swatch: "#ffffff", ink: "#000000" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const DARK_THEMES = new Set<ThemeId>(["ink", "ocean", "contrast"]);

export function isDarkTheme(id: ThemeId): boolean {
  return DARK_THEMES.has(id);
}

export const LATIN_FONTS = [
  {
    id: "serif",
    name: "衬线",
    sample: "Aa",
    css: '"Iowan Old Style", "Palatino Linotype", Cambria, Georgia, "Times New Roman"',
  },
  {
    id: "sans",
    name: "无衬线",
    sample: "Aa",
    css: '"Segoe UI Variable Text", "Segoe UI", Calibri, Arial',
  },
  {
    id: "mono",
    name: "等宽",
    sample: "Aa",
    css: '"Cascadia Code", Consolas, "Courier New"',
  },
] as const;

export const CJK_FONTS = [
  {
    id: "song",
    name: "宋体",
    sample: "汉字",
    css: 'SimSun, NSimSun, "Songti SC", "Noto Serif SC", PMingLiU, serif',
  },
  {
    id: "hei",
    name: "黑体",
    sample: "汉字",
    css: '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  },
  {
    id: "kai",
    name: "楷体",
    sample: "汉字",
    css: 'KaiTi, STKaiti, "Kaiti SC", "KaiTi_GB2312", serif',
  },
  {
    id: "fang",
    name: "仿宋",
    sample: "汉字",
    css: 'FangSong, STFangsong, "FangSong_GB2312", serif',
  },
] as const;

export type LatinFontId = (typeof LATIN_FONTS)[number]["id"];
export type CjkFontId = (typeof CJK_FONTS)[number]["id"];

export function composeEditorFont(latinId: LatinFontId, cjkId: CjkFontId): string {
  const latin = LATIN_FONTS.find((f) => f.id === latinId) ?? LATIN_FONTS[0];
  const cjk = CJK_FONTS.find((f) => f.id === cjkId) ?? CJK_FONTS[0];
  return `${latin.css}, ${cjk.css}`;
}

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

export type Meta = {
  ids: string[];
  lastId: string | null;
  theme: ThemeId;
  sidebar: boolean;
  focus: boolean;
  sidebarWidth: number;
  latinFont: LatinFontId;
  cjkFont: CjkFontId;
  fontSize: number;
  lastLight: ThemeId;
  lastDark: ThemeId;
  customOrder: boolean;
};

export type FileNode = {
  path: string;
  name: string;
  title: string;
  dir: boolean;
  updatedAt: number;
  children?: FileNode[];
};

export type TrashItem = {
  id: string;
  noteId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
};
