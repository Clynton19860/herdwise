/**
 * Tiny dependency-free markdown renderer for the AI chat bubbles.
 * Handles: paragraphs, **bold**, *italic*, `code`, bullet lists, numbered lists, line breaks.
 * Not a full Markdown parser — good enough for short chat responses.
 */
import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code first, then bold, italic, links
  const tokens: { kind: string; value: string }[] = [];
  let i = 0;
  while (i < text.length) {
    // inline code
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        tokens.push({ kind: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // bold **...**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i) {
        tokens.push({ kind: "bold", value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // italic *...*  (skip if followed by *)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i) {
        tokens.push({ kind: "italic", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // plain text run
    let j = i;
    while (j < text.length) {
      const c = text[j];
      if (c === "`") break;
      if (c === "*" && (text[j + 1] === "*" || (j + 1 < text.length))) break;
      j++;
    }
    tokens.push({ kind: "text", value: text.slice(i, j) });
    i = j === i ? j + 1 : j;
  }

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.kind === "code") {
      out.push(
        <code
          key={k}
          className="font-mono text-[12px] px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-emerald-100"
        >
          {t.value}
        </code>
      );
    } else if (t.kind === "bold") {
      out.push(
        <strong key={k} className="text-white font-semibold">
          {t.value}
        </strong>
      );
    } else if (t.kind === "italic") {
      out.push(
        <em key={k} className="text-white/85 italic">
          {t.value}
        </em>
      );
    } else {
      out.push(<span key={k}>{t.value}</span>);
    }
  }
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; level: number; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let cur: Block | null = null;

  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }

    // Headers
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      continue;
    }

    // Bullet list
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (cur && cur.kind === "ul") cur.items.push(ul[1]);
      else {
        flush();
        cur = { kind: "ul", items: [ul[1]] };
      }
      continue;
    }

    // Numbered list
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (cur && cur.kind === "ol") cur.items.push(ol[1]);
      else {
        flush();
        cur = { kind: "ol", items: [ol[1]] };
      }
      continue;
    }

    if (cur && cur.kind === "p") cur.lines.push(line);
    else {
      flush();
      cur = { kind: "p", lines: [line] };
    }
  }
  flush();
  return blocks;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="space-y-2.5 leading-relaxed text-[14px]">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          const size =
            b.level === 1 ? "text-lg" :
            b.level === 2 ? "text-base" :
            "text-sm";
          return (
            <div key={i} className={`${size} font-semibold tracking-tight text-white`}>
              {renderInline(b.text)}
            </div>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {b.items.map((it, k) => (
                <li key={k} className="flex gap-2.5">
                  <span className="mt-2 h-1 w-1 rounded-full bg-emerald-300 shrink-0" />
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="space-y-1.5 pl-1 list-decimal list-inside marker:text-emerald-300/80 marker:font-mono marker:text-xs">
              {b.items.map((it, k) => (
                <li key={k}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="text-white/90">
            {renderInline(b.lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
