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
};

export type FileNode = {
  path: string;
  name: string;
  title: string;
  dir: boolean;
  updatedAt: number;
  children?: FileNode[];
};
