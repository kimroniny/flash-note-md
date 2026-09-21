export type Tabs = {
  readonly ids: readonly string[];
  readonly active: string;
  open(id: string): void;
  close(id: string): string;
  rename(from: string, to: string): void;
  deactivate(): void;
  has(id: string): boolean;
  cycle(dir: 1 | -1): string;
};

export function createTabs(): Tabs {
  const ids: string[] = [];
  let active = "";

  return {
    get ids() {
      return ids;
    },
    get active() {
      return active;
    },
    open(id: string) {
      if (!id) return;
      if (!ids.includes(id)) ids.push(id);
      active = id;
    },
    close(id: string) {
      const i = ids.indexOf(id);
      if (i === -1) return active;
      ids.splice(i, 1);
      if (active === id) active = ids[i] ?? ids[i - 1] ?? "";
      return active;
    },
    rename(from: string, to: string) {
      const i = ids.indexOf(from);
      if (i === -1 || !to || from === to) return;
      if (ids.includes(to)) ids.splice(i, 1);
      else ids[i] = to;
      if (active === from) active = to;
    },
    deactivate() {
      active = "";
    },
    has(id: string) {
      return ids.includes(id);
    },
    cycle(dir: 1 | -1) {
      if (ids.length === 0) return "";
      if (!active) {
        active = dir === 1 ? (ids[0] ?? "") : (ids[ids.length - 1] ?? "");
        return active;
      }
      const i = ids.indexOf(active);
      const next = (Math.max(0, i) + dir + ids.length) % ids.length;
      active = ids[next] ?? "";
      return active;
    },
  };
}
