import type { FileNode } from "./types.ts";

export {};

declare global {
  interface Window {
    flashGetDir?: () => Promise<string>;
    flashPickDir?: () => Promise<string>;
    flashSetDir?: (path: string) => Promise<string>;
    flashList?: () => Promise<FileNode[]>;
    flashRead?: (rel: string) => Promise<string>;
    flashWrite?: (rel: string, content: string) => Promise<void>;
    flashCreate?: (title: string, content: string) => Promise<string>;
    flashDelete?: (rel: string) => Promise<void>;
  }
}
