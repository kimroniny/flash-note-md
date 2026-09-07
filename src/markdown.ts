export function nowStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function meetingTemplate(d = new Date()): string {
  return `# 会议 ${nowStamp(d)}\n\n`;
}

export function titleFromMarkdown(md: string): string {
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || line === "---" || line === "***" || line === "___") continue;
    const cleaned = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s*/, "")
      .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/[*_`~]/g, "")
      .trim();
    if (cleaned) return cleaned.slice(0, 56);
  }
  return "未命名会议";
}

export type BlockKind =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ul"
  | "ol"
  | "task"
  | "quote"
  | "code"
  | "hr";

const TASK_LINE = /^\s*[-*+]\s*\[([ xX]?)\]\s*(.*)$/;
const LIST_LINE = /^\s*(?:[-*+](?:\s+|\s*\[[ xX]?\])|\d+\.\s)/;

export function isTaskLine(line: string): boolean {
  return TASK_LINE.test(line);
}

export function blockKind(md: string): BlockKind {
  const line = md.split("\n")[0] ?? "";
  if (/^```/.test(line)) return "code";
  if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) return "hr";
  const h = line.match(/^(#{1,6})\s+/);
  if (h) return `h${h[1].length}` as BlockKind;
  if (/^>\s?/.test(line)) return "quote";
  if (md.split("\n").some(isTaskLine)) return "task";
  if (/^\s*[-*+]\s+/.test(line) || isTaskLine(line)) return "ul";
  if (/^\s*\d+\.\s+/.test(line)) return "ol";
  return "p";
}

export function splitBlocks(md: string): string[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^```/.test(line)) {
      const start = i;
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) i += 1;
      if (i < lines.length) i += 1;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim()) || /^#{1,6}\s+/.test(line)) {
      blocks.push(line);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const start = i;
      i += 1;
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) i += 1;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }
    if (LIST_LINE.test(line)) {
      const start = i;
      i += 1;
      while (
        i < lines.length &&
        (lines[i]?.trim() === ""
          ? i + 1 < lines.length &&
            /^\s+/.test(lines[i + 1] ?? "") &&
            (lines[i + 1] ?? "").trim() !== ""
          : LIST_LINE.test(lines[i] ?? "") ||
            (/^\s{2,}\S/.test(lines[i] ?? "") && !/^```/.test(lines[i] ?? "") && !/^#{1,6}\s+/.test(lines[i] ?? "")))
      ) {
        i += 1;
      }
      const chunk = lines.slice(start, i).join("\n").replace(/\n+$/, "");
      blocks.push(chunk);
      continue;
    }
    const start = i;
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^```/.test(lines[i] ?? "") &&
      !/^#{1,6}\s+/.test(lines[i] ?? "") &&
      !LIST_LINE.test(lines[i] ?? "") &&
      !/^>\s?/.test(lines[i] ?? "") &&
      !/^(---|\*\*\*|___)\s*$/.test((lines[i] ?? "").trim())
    ) {
      i += 1;
    }
    blocks.push(lines.slice(start, i).join("\n"));
  }
  if (blocks.length === 0) blocks.push("");
  if (/(?:\n[ \t]*){2,}$/.test(md) && (blocks[blocks.length - 1] ?? "") !== "") {
    blocks.push("");
  }
  return blocks;
}

export function joinBlocks(blocks: string[]): string {
  return blocks
    .map((b) => b.replace(/\s+$/, ""))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderInline(src: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        parts.push(`<code>${escapeHtml(src.slice(i + 1, end))}</code>`);
        i = end + 1;
        continue;
      }
    }
    const rest = src.slice(i);
    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      parts.push(
        `<a href="${escapeHtml(link[2])}" target="_blank" rel="noreferrer">${renderInline(link[1])}</a>`,
      );
      i += link[0].length;
      continue;
    }
    const hi = rest.match(/^==([^=]+)==/);
    if (hi) {
      parts.push(`<mark>${renderInline(hi[1])}</mark>`);
      i += hi[0].length;
      continue;
    }
    const strike = rest.match(/^~~([^~]+)~~/);
    if (strike) {
      parts.push(`<del>${renderInline(strike[1])}</del>`);
      i += strike[0].length;
      continue;
    }
    const bold = rest.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      parts.push(`<strong>${renderInline(bold[1])}</strong>`);
      i += bold[0].length;
      continue;
    }
    const italic = rest.match(/^\*(.+?)\*/);
    if (italic) {
      parts.push(`<em>${renderInline(italic[1])}</em>`);
      i += italic[0].length;
      continue;
    }
    let j = i + 1;
    while (j < src.length && !"`*[~=".includes(src[j] ?? "")) j += 1;
    parts.push(escapeHtml(src.slice(i, j)));
    i = j;
  }
  return parts.join("");
}

function listItems(md: string, kind: "ul" | "ol" | "task"): string {
  const lines = md.split("\n");
  const items: string[] = [];
  let current = "";
  let hasTask = kind === "task";
  const indentOf = (line: string) => {
    const lead = line.match(/^[ \t]*/)?.[0] ?? "";
    return Math.min(6, Math.floor(lead.replace(/\t/g, "  ").length / 2));
  };
  const push = () => {
    if (!current) return;
    const indent = indentOf(current);
    const raw = current.replace(/\n/g, " ").trim();
    const depthClass = indent > 0 ? ` indent-${indent}` : "";
    const task = raw.match(TASK_LINE);
    if (task) {
      hasTask = true;
      const checked = task[1]?.toLowerCase() === "x";
      items.push(
        `<li class="task${checked ? " checked" : ""}${depthClass}"><button type="button" class="check" aria-label="${checked ? "已完成" : "待办"}" aria-checked="${checked}"></button><span>${renderInline(task[2] ?? "")}</span></li>`,
      );
    } else {
      const stripped = raw.replace(/^([-*+]|\d+\.)\s*/, "");
      const cls = depthClass.trim();
      items.push(cls ? `<li class="${cls}">${renderInline(stripped)}</li>` : `<li>${renderInline(stripped)}</li>`);
    }
    current = "";
  };
  for (const line of lines) {
    if (LIST_LINE.test(line)) {
      push();
      current = line;
    } else if (current) {
      current += ` ${line.trim()}`;
    }
  }
  push();
  const tag = kind === "ol" ? "ol" : "ul";
  const cls = hasTask ? ' class="task-list"' : "";
  return `<${tag}${cls}>${items.join("")}</${tag}>`;
}

export function renderBlock(md: string): { html: string; kind: BlockKind } {
  const kind = blockKind(md);
  if (kind === "hr") return { html: "<hr />", kind };
  if (kind === "code") {
    const lines = md.split("\n");
    const lang = (lines[0] ?? "").replace(/^```/, "").trim();
    const end = lines.length > 1 && /^```/.test(lines[lines.length - 1] ?? "") ? lines.length - 1 : lines.length;
    const body = escapeHtml(lines.slice(1, end).join("\n"));
    return {
      html: `<pre><code data-lang="${escapeHtml(lang)}">${body}</code></pre>`,
      kind,
    };
  }
  if (kind.startsWith("h")) {
    const m = md.match(/^(#{1,6})\s+(.*)$/);
    const level = m?.[1].length ?? 1;
    return { html: `<h${level}>${renderInline(m?.[2] ?? md)}</h${level}>`, kind };
  }
  if (kind === "quote") {
    const text = md
      .split("\n")
      .map((l) => l.replace(/^>\s?/, ""))
      .join("\n");
    return { html: `<blockquote>${renderInline(text)}</blockquote>`, kind };
  }
  if (kind === "ul" || kind === "ol" || kind === "task") {
    return { html: listItems(md, kind), kind };
  }
  const paras = md.split("\n").map((l) => renderInline(l)).join("<br />");
  return { html: `<p>${paras || "<br />"}</p>`, kind };
}

export function toggleTaskAt(md: string, index: number): string {
  let n = 0;
  return md
    .split("\n")
    .map((line) => {
      if (!isTaskLine(line)) return line;
      if (n === index) {
        n += 1;
        return line.replace(/\[([ xX]?)\]/, (_, inner: string) =>
          inner.toLowerCase() === "x" ? "[ ]" : "[x]",
        );
      }
      n += 1;
      return line;
    })
    .join("\n");
}

export function indentMarkdownLines(
  md: string,
  selStart: number,
  selEnd: number,
  outdent: boolean,
): { md: string; start: number; end: number } {
  const start = Math.min(selStart, selEnd);
  const end = Math.max(selStart, selEnd);
  const lineStart = md.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let rangeEnd = end;
  if (end > start && md[end - 1] === "\n") rangeEnd = end - 1;
  let lineEnd = md.indexOf("\n", rangeEnd);
  if (lineEnd < 0) lineEnd = md.length;

  const prefix = md.slice(0, lineStart);
  const body = md.slice(lineStart, lineEnd);
  const suffix = md.slice(lineEnd);
  const lines = body.split("\n");
  let deltaStart = 0;
  let deltaEnd = 0;
  const nextLines = lines.map((line, i) => {
    let next = line;
    let d = 0;
    if (outdent) {
      if (line.startsWith("\t")) {
        next = line.slice(1);
        d = -1;
      } else if (line.startsWith("  ")) {
        next = line.slice(2);
        d = -2;
      } else if (line.startsWith(" ")) {
        next = line.slice(1);
        d = -1;
      }
    } else {
      next = `  ${line}`;
      d = 2;
    }
    if (i === 0) deltaStart = d;
    deltaEnd += d;
    return next;
  });
  return {
    md: prefix + nextLines.join("\n") + suffix,
    start: Math.max(lineStart, start + deltaStart),
    end: Math.max(lineStart, end + deltaEnd),
  };
}

export function continueList(md: string): { next: string; exit: boolean } {
  const lines = md.split("\n");
  const last = lines[lines.length - 1] ?? "";
  const task = last.match(/^(\s*)([-*+])\s*\[([ xX]?)\]\s*(.*)$/);
  if (task) {
    if (!(task[4] ?? "").trim()) {
      lines.pop();
      return { next: lines.join("\n"), exit: true };
    }
    return { next: `${md}\n${task[1]}${task[2]} [ ] `, exit: false };
  }
  const ul = last.match(/^(\s*)([-*+])\s+(.*)$/);
  if (ul) {
    if (!(ul[3] ?? "").trim()) {
      lines.pop();
      return { next: lines.join("\n"), exit: true };
    }
    return { next: `${md}\n${ul[1]}${ul[2]} `, exit: false };
  }
  const ol = last.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (ol) {
    if (!(ol[3] ?? "").trim()) {
      lines.pop();
      return { next: lines.join("\n"), exit: true };
    }
    return { next: `${md}\n${ol[1]}${Number(ol[2]) + 1}. `, exit: false };
  }
  return { next: md, exit: true };
}
