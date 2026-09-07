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

export function liveBlockKind(md: string): BlockKind {
  const line = md.split("\n")[0] ?? "";
  if (/^```/.test(line)) return "code";
  if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) return "hr";
  const hashes = line.match(/^(#{1,6})(?:\s|$)/);
  if (hashes?.[1]) return `h${hashes[1].length}` as BlockKind;
  if (line === ">" || /^>\s?/.test(line)) return "quote";
  if (md.split("\n").some(isTaskLine) || /^\s*[-*+]\s*\[[ xX]?\]?\s*$/.test(line)) return "task";
  if (/^\s*[-*+](?:\s|$)/.test(line)) return "ul";
  if (/^\s*\d+\.(?:\s|$)/.test(line)) return "ol";
  return blockKind(md);
}

function mdMark(s: string, cls = ""): string {
  const extra = cls ? ` ${cls}` : "";
  return `<span class="md-mark${extra}">${escapeHtml(s)}</span>`;
}

function decorateInline(src: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        parts.push(`${mdMark("`")}<code>${escapeHtml(src.slice(i + 1, end))}</code>${mdMark("`")}`);
        i = end + 1;
        continue;
      }
      parts.push(`${mdMark("`")}<code>${escapeHtml(src.slice(i + 1))}</code>`);
      break;
    }
    if (src[i] === "!" && src[i + 1] === "[") {
      const fromBracket = src.slice(i + 1);
      const done = fromBracket.match(/^\[([^\]]*)\]\(([^)\s]+)\)/);
      if (done) {
        parts.push(
          `${mdMark("![")}<span class="md-link">${escapeHtml(done[1] ?? "")}</span>${mdMark(`](${done[2]})`)}`,
        );
        i += 1 + done[0].length;
        continue;
      }
      const partial = fromBracket.match(/^\[([^\]]*)\]\(([^)]*)$/);
      if (partial) {
        parts.push(
          `${mdMark("![")}<span class="md-link">${escapeHtml(partial[1] ?? "")}</span>${mdMark(`](${partial[2]})`)}`,
        );
        break;
      }
    }
    const rest = src.slice(i);
    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      parts.push(
        `${mdMark("[")}<span class="md-link">${decorateInline(link[1] ?? "")}</span>${mdMark(`](${link[2]})`)}`,
      );
      i += link[0].length;
      continue;
    }
    const partialLink = rest.match(/^\[([^\]]+)\]\(([^)]*)$/);
    if (partialLink) {
      parts.push(
        `${mdMark("[")}<span class="md-link">${decorateInline(partialLink[1] ?? "")}</span>${mdMark(`](${partialLink[2]})`)}`,
      );
      break;
    }
    if (src.startsWith("==", i)) {
      const end = src.indexOf("==", i + 2);
      if (end > i) {
        parts.push(`${mdMark("==")}<mark>${decorateInline(src.slice(i + 2, end))}</mark>${mdMark("==")}`);
        i = end + 2;
        continue;
      }
      parts.push(`${mdMark("==")}<mark>${decorateInline(src.slice(i + 2))}</mark>`);
      break;
    }
    if (src.startsWith("~~", i)) {
      const end = src.indexOf("~~", i + 2);
      if (end > i) {
        parts.push(`${mdMark("~~")}<del>${decorateInline(src.slice(i + 2, end))}</del>${mdMark("~~")}`);
        i = end + 2;
        continue;
      }
      parts.push(`${mdMark("~~")}<del>${decorateInline(src.slice(i + 2))}</del>`);
      break;
    }
    if (src.startsWith("**", i) || src.startsWith("__", i)) {
      const mark = src.slice(i, i + 2);
      const end = src.indexOf(mark, i + 2);
      if (end > i) {
        parts.push(`${mdMark(mark)}<strong>${decorateInline(src.slice(i + 2, end))}</strong>${mdMark(mark)}`);
        i = end + 2;
        continue;
      }
      parts.push(`${mdMark(mark)}<strong>${decorateInline(src.slice(i + 2))}</strong>`);
      break;
    }
    if (src[i] === "*" || src[i] === "_") {
      const mark = src[i] ?? "*";
      const end = src.indexOf(mark, i + 1);
      if (end > i) {
        parts.push(`${mdMark(mark)}<em>${decorateInline(src.slice(i + 1, end))}</em>${mdMark(mark)}`);
        i = end + 1;
        continue;
      }
      parts.push(`${mdMark(mark)}<em>${decorateInline(src.slice(i + 1))}</em>`);
      break;
    }
    let j = i + 1;
    while (j < src.length && !"`*_~=![".includes(src[j] ?? "")) j += 1;
    parts.push(escapeHtml(src.slice(i, j)));
    i = j;
  }
  return parts.join("");
}

function listBullet(indent: number): string {
  if (indent >= 4) return "▪";
  if (indent >= 2) return "◦";
  return "•";
}

function decorateLine(line: string): string {
  if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
    return `<span class="md-mark md-hr-mark">${escapeHtml(line)}</span>`;
  }
  if (/^(#{1,6})(?:\s|$)/.test(line)) {
    const hashes = line.match(/^(#{1,6})([ \t]*)(.*)$/);
    if (hashes) return `${mdMark((hashes[1] ?? "") + (hashes[2] ?? ""))}${decorateInline(hashes[3] ?? "")}`;
  }
  const quote = line.match(/^(\s*)((?:[-*+]\s+)?)(>+[ \t]?)(.*)$/);
  if (quote?.[3]) {
    return `${escapeHtml(quote[1] ?? "")}${mdMark(`${quote[2] ?? ""}${quote[3] ?? ""}`, "md-quote-mark")}<span class="md-quote-text">${decorateInline(quote[4] ?? "")}</span>`;
  }
  const task = line.match(/^(\s*)((?:[-*+]\s+)?)([-*+]\s*\[([ xX]?)\]\s*)(.*)$/);
  if (task) {
    const checked = (task[4] ?? "").toLowerCase() === "x";
    const mark = `<span class="md-mark md-task-mark${checked ? " is-checked" : ""}">${escapeHtml(`${task[2] ?? ""}${task[3] ?? ""}`)}</span>`;
    const body = `<span class="md-task-text${checked ? " is-checked" : ""}">${decorateInline(task[5] ?? "")}</span>`;
    return `${escapeHtml(task[1] ?? "")}${mark}${body}`;
  }
  const taskTyping = line.match(/^(\s*)((?:[-*+]\s+)?)([-*+]\s*\[([ xX]?))\s*$/);
  if (taskTyping) {
    const checked = (taskTyping[4] ?? "").toLowerCase() === "x";
    const mark = `<span class="md-mark md-task-mark${checked ? " is-checked" : ""}">${escapeHtml(`${taskTyping[2] ?? ""}${taskTyping[3] ?? ""}`)}</span>`;
    return `${escapeHtml(taskTyping[1] ?? "")}${mark}`;
  }
  const ul = line.match(/^(\s*)([-*+])(\s+|$)(.*)$/);
  if (ul) {
    const indent = (ul[1] ?? "").replace(/\t/g, "  ").length;
    const mark = `<span class="md-mark md-ul-mark" data-bullet="${listBullet(indent)}">${escapeHtml(ul[2] ?? "")}</span>`;
    return `${escapeHtml(ul[1] ?? "")}${mark}${escapeHtml(ul[3] ?? "")}${decorateInline(ul[4] ?? "")}`;
  }
  const ol = line.match(/^(\s*)(\d+\.)(\s+|$)(.*)$/);
  if (ol) {
    const mark = `<span class="md-mark md-ol-mark">${escapeHtml(ol[2] ?? "")}</span>`;
    return `${escapeHtml(ol[1] ?? "")}${mark}${escapeHtml(ol[3] ?? "")}${decorateInline(ol[4] ?? "")}`;
  }
  if (/^```/.test(line)) return mdMark(line, "md-fence-mark");
  return decorateInline(line);
}

export function decorateSource(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  if (/^```/.test(lines[0] ?? "")) {
    return lines
      .map((line, i) => {
        if (i === 0 || /^```/.test(line)) return decorateLine(line);
        return escapeHtml(line);
      })
      .join("<br>");
  }
  return lines.map(decorateLine).join("<br>");
}

export function isListMarkdown(md: string): boolean {
  const kind = blockKind(md);
  return kind === "ul" || kind === "ol" || kind === "task";
}

function parseListLine(line: string): { indent: number; ordered: boolean; task: boolean; checked: boolean; text: string } | null {
  const task = line.match(/^(\s*)([-*+])\s*\[([ xX]?)\]\s*(.*)$/);
  if (task) {
    return {
      indent: (task[1] ?? "").replace(/\t/g, "  ").length,
      ordered: false,
      task: true,
      checked: (task[3] ?? "").toLowerCase() === "x",
      text: task[4] ?? "",
    };
  }
  const ul = line.match(/^(\s*)([-*+])\s+(.*)$/);
  if (ul) {
    return {
      indent: (ul[1] ?? "").replace(/\t/g, "  ").length,
      ordered: false,
      task: false,
      checked: false,
      text: ul[3] ?? "",
    };
  }
  const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (ol) {
    return {
      indent: (ol[1] ?? "").replace(/\t/g, "  ").length,
      ordered: true,
      task: false,
      checked: false,
      text: ol[3] ?? "",
    };
  }
  return null;
}

function listItemInner(row: NonNullable<ReturnType<typeof parseListLine>>): string {
  if (row.task) {
    const checked = row.checked;
    return `<button type="button" class="check" aria-label="${checked ? "已完成" : "待办"}" aria-checked="${checked}"></button><span>${renderInline(row.text)}</span>`;
  }
  return renderInline(row.text);
}

function nestedListHtml(rows: NonNullable<ReturnType<typeof parseListLine>>[]): string {
  let i = 0;
  const walk = (minIndent: number): string => {
    if (i >= rows.length || rows[i].indent < minIndent) return "";
    const base = rows[i].indent;
    const ordered = rows[i].ordered;
    let hasTask = false;
    const parts: string[] = [];
    while (i < rows.length && rows[i].indent >= base) {
      if (rows[i].indent > base) break;
      if (rows[i].ordered !== ordered) break;
      const row = rows[i];
      i += 1;
      if (row.task) hasTask = true;
      const cls = row.task ? ` class="task${row.checked ? " checked" : ""}"` : "";
      let li = `<li${cls}>${listItemInner(row)}`;
      if (i < rows.length && rows[i].indent > row.indent) li += walk(rows[i].indent);
      li += "</li>";
      parts.push(li);
    }
    const tag = ordered ? "ol" : "ul";
    const cls = hasTask ? ' class="task-list"' : "";
    return `<${tag}${cls}>${parts.join("")}</${tag}>`;
  };
  return walk(rows[0]?.indent ?? 0);
}

function listItems(md: string, _kind: "ul" | "ol" | "task"): string {
  const rows: NonNullable<ReturnType<typeof parseListLine>>[] = [];
  let pending: string | null = null;
  const flush = () => {
    if (pending === null) return;
    const parsed = parseListLine(pending);
    if (parsed) rows.push(parsed);
    pending = null;
  };
  for (const line of md.split("\n")) {
    if (LIST_LINE.test(line)) {
      flush();
      pending = line;
    } else if (pending !== null) {
      pending += ` ${line.trim()}`;
    }
  }
  flush();
  return nestedListHtml(rows);
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
  const prefixLines = prefix.split("\n");
  let prevListIndent = -1;
  for (let i = prefixLines.length - 1; i >= 0; i--) {
    const parsed = parseListLine(prefixLines[i] ?? "");
    if (parsed) {
      prevListIndent = parsed.indent;
      break;
    }
    if ((prefixLines[i] ?? "").trim()) break;
  }

  let deltaStart = 0;
  let deltaEnd = 0;
  let runningPrev = prevListIndent;
  const nextLines = lines.map((line, i) => {
    const parsed = parseListLine(line);
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
    } else if (parsed) {
      const maxIndent = runningPrev < 0 ? parsed.indent : runningPrev + 2;
      if (parsed.indent < maxIndent) {
        next = `  ${line}`;
        d = 2;
      }
    } else {
      next = `  ${line}`;
      d = 2;
    }
    if (i === 0) deltaStart = d;
    deltaEnd += d;
    const after = parseListLine(next);
    if (after) runningPrev = after.indent;
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
