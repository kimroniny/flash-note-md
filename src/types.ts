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

export const FONTS = [
  {
    id: "serif",
    name: "衬线",
    css: '"Iowan Old Style", "Palatino Linotype", "Songti SC", "Noto Serif SC", Georgia, serif',
  },
  {
    id: "sans",
    name: "黑体",
    css: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif',
  },
  {
    id: "song",
    name: "宋体",
    css: '"Songti SC", "Noto Serif SC", SimSun, "Songti SC", PMingLiU, serif',
  },
  {
    id: "kai",
    name: "楷体",
    css: 'KaiTi, STKaiti, "Kaiti SC", "Noto Serif SC", serif',
  },
  {
    id: "mono",
    name: "等宽",
    css: '"Cascadia Code", Consolas, "Sarasa Mono SC", "Microsoft YaHei UI", monospace',
  },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

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
  font: FontId;
  fontSize: number;
};

export type FileNode = {
  path: string;
  name: string;
  title: string;
  dir: boolean;
  updatedAt: number;
  children?: FileNode[];
};
