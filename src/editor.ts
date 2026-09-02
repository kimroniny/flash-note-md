import {
  blockKind,
  continueList,
  joinBlocks,
  renderBlock,
  splitBlocks,
  toggleTaskAt,
  type BlockKind,
} from "./markdown.ts";

export type EditorHandle = {
  getMarkdown(): string;
  setMarkdown(md: string, focusEnd?: boolean): void;
  focus(): void;
  destroy(): void;
};

type Options = {
  onChange: (md: string) => void;
};

function autosize(el: HTMLTextAreaElement): void {
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
}

function kindClass(kind: BlockKind): string {
  return `kind-${kind}`;
}

export function mountEditor(root: HTMLElement, options: Options): EditorHandle {
  let blocks: string[] = [""];
  let editing = -1;
  let destroyed = false;

  root.classList.add("md-editor");
  root.replaceChildren();

  const emit = () => {
    if (!destroyed) options.onChange(joinBlocks(blocks));
  };

  const makeView = (md: string): HTMLElement => {
    const view = document.createElement("div");
    view.className = "block-view";
    const { html, kind } = renderBlock(md);
    view.innerHTML = md.trim() === "" ? '<p class="blank">&nbsp;</p>' : html;
    view.dataset.kind = kind;
    return view;
  };

  const wrapBlock = (md: string, index: number): HTMLElement => {
    const el = document.createElement("div");
    const kind = blockKind(md);
    el.className = `block ${kindClass(kind)}`;
    el.dataset.index = String(index);
    el.append(makeView(md));
    return el;
  };

  const rerender = (focusIndex = -1, caret = -1): void => {
    editing = -1;
    root.replaceChildren();
    blocks.forEach((md, i) => root.append(wrapBlock(md, i)));
    if (focusIndex >= 0) beginEdit(focusIndex, caret);
  };

  const currentTextarea = (): HTMLTextAreaElement | null =>
    root.querySelector("textarea.block-src");

  const commitEdit = (keepIndex = false): number => {
    const ta = currentTextarea();
    if (!ta || editing < 0) return -1;
    const index = editing;
    const value = ta.value.replace(/\s+$/, "");
    const parts = splitBlocks(value);
    if (parts.length <= 1) {
      blocks[index] = parts[0] ?? "";
      if (!keepIndex) {
        const parent = ta.parentElement;
        if (parent) {
          parent.className = `block ${kindClass(blockKind(blocks[index] ?? ""))}`;
          parent.replaceChildren(makeView(blocks[index] ?? ""));
        }
        editing = -1;
      }
      return index;
    }
    blocks.splice(index, 1, ...parts);
    rerender(keepIndex ? index + parts.length - 1 : -1);
    return index;
  };

  const beginEdit = (index: number, caret = -1): void => {
    if (index < 0 || index >= blocks.length) return;
    if (editing === index) {
      currentTextarea()?.focus();
      return;
    }
    if (editing >= 0) commitEdit(false);
    const el = root.children[index] as HTMLElement | undefined;
    if (!el) return;
    editing = index;
    const md = blocks[index] ?? "";
    const ta = document.createElement("textarea");
    ta.className = "block-src";
    ta.value = md;
    ta.spellcheck = true;
    ta.setAttribute("aria-label", "编辑段落");
    ta.rows = 1;
    el.classList.add("editing");
    el.replaceChildren(ta);
    autosize(ta);
    ta.focus();
    const pos = caret < 0 ? ta.value.length : Math.min(caret, ta.value.length);
    ta.setSelectionRange(pos, pos);
  };

  const insertBlockAfter = (index: number, md = ""): void => {
    commitEdit(false);
    blocks.splice(index + 1, 0, md);
    rerender(index + 1, 0);
    emit();
  };

  const mergePrev = (index: number): void => {
    if (index <= 0) return;
    const prev = blocks[index - 1] ?? "";
    const caret = prev.length;
    const joined = prev ? `${prev}\n${blocks[index] ?? ""}` : (blocks[index] ?? "");
    blocks.splice(index - 1, 2, joined);
    rerender(index - 1, caret);
    emit();
  };

  root.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    const check = t.closest(".check");
    if (check) {
      e.preventDefault();
      e.stopPropagation();
      const block = t.closest(".block");
      if (!block) return;
      const index = Number((block as HTMLElement).dataset.index);
      const item = t.closest("li.task");
      const list = [...(block.querySelectorAll("li.task") ?? [])];
      const itemIndex = item ? list.indexOf(item) : -1;
      if (itemIndex < 0) return;
      if (editing === index) commitEdit(false);
      blocks[index] = toggleTaskAt(blocks[index] ?? "", itemIndex);
      const el = root.children[index] as HTMLElement | undefined;
      if (el && editing !== index) {
        el.className = `block ${kindClass(blockKind(blocks[index] ?? ""))}`;
        el.replaceChildren(makeView(blocks[index] ?? ""));
      }
      emit();
      return;
    }
    const link = t.closest("a");
    if (link) return;
    const block = t.closest(".block");
    if (!block) return;
    const index = Number((block as HTMLElement).dataset.index);
    if (editing === index) return;
    beginEdit(index);
  });

  root.addEventListener("input", (e) => {
    const ta = e.target;
    if (!(ta instanceof HTMLTextAreaElement)) return;
    if (editing < 0) return;
    blocks[editing] = ta.value;
    const kind = blockKind(ta.value);
    if (ta.parentElement) ta.parentElement.className = `block editing ${kindClass(kind)}`;
    autosize(ta);
    emit();
  });

  root.addEventListener("keydown", (e) => {
    const ta = e.target;
    if (!(ta instanceof HTMLTextAreaElement) || editing < 0) return;
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const insert = "  ";
      ta.setRangeText(insert, start, end, "end");
      blocks[editing] = ta.value;
      autosize(ta);
      emit();
      return;
    }
    if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      if (ta.value === "" && blocks.length > 1) {
        e.preventDefault();
        const idx = editing;
        editing = -1;
        blocks.splice(idx, 1);
        const next = Math.max(0, idx - 1);
        rerender(next);
        emit();
      } else if (ta.selectionStart === 0 && editing > 0) {
        e.preventDefault();
        mergePrev(editing);
      }
      return;
    }
    if (e.key === "ArrowUp" && ta.selectionStart === 0 && editing > 0) {
      e.preventDefault();
      const prev = editing - 1;
      commitEdit(false);
      beginEdit(prev);
      return;
    }
    if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length && editing < blocks.length - 1) {
      e.preventDefault();
      const next = editing + 1;
      commitEdit(false);
      beginEdit(next, 0);
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const kind = blockKind(ta.value);
    if (kind === "code") {
      const lines = ta.value.split("\n");
      const closed = lines.length > 1 && /^```/.test(lines[0] ?? "") && /^```/.test(lines[lines.length - 1] ?? "");
      if (!closed) return;
    }
    if (kind === "ul" || kind === "ol" || kind === "task") {
      e.preventDefault();
      const result = continueList(ta.value);
      if (result.exit) {
        blocks[editing] = result.next.replace(/\n+$/, "");
        insertBlockAfter(editing, "");
      } else {
        ta.value = result.next;
        blocks[editing] = ta.value;
        autosize(ta);
        ta.setSelectionRange(ta.value.length, ta.value.length);
        emit();
      }
      return;
    }
    e.preventDefault();
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos).replace(/\s+$/, "");
    const after = ta.value.slice(pos).replace(/^\s+/, "");
    blocks[editing] = before;
    if (after) {
      blocks.splice(editing + 1, 0, after);
      rerender(editing + 1, 0);
    } else {
      insertBlockAfter(editing, "");
      return;
    }
    emit();
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!root.contains(e.target as Node) && editing >= 0) {
        commitEdit(false);
      }
    },
    true,
  );

  rerender();

  return {
    getMarkdown() {
      if (editing >= 0) commitEdit(true);
      return joinBlocks(blocks);
    },
    setMarkdown(md: string, focusEnd = false) {
      blocks = splitBlocks(md);
      rerender(focusEnd ? blocks.length - 1 : -1);
    },
    focus() {
      const i = blocks.length - 1;
      beginEdit(i);
    },
    destroy() {
      destroyed = true;
      root.replaceChildren();
    },
  };
}
