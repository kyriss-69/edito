import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Mise en forme légère des réponses de l'assistant : paragraphes, titres,
 * listes, **gras**, *italique*, `code` et liens. Pas de HTML brut.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={cn("flex flex-col gap-2 text-sm leading-relaxed", className)}>{blocks(text)}</div>;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const result: Block[] = [];
  let current = null as Block | null;
  const flush = () => {
    if (current) result.push(current);
    current = null;
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flush();
      result.push({ kind: "h", text: heading[1] });
    } else if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (current?.kind !== kind) {
        flush();
        current = { kind, items: [] };
      }
      (current as { items: string[] }).items.push(item);
    } else if (current?.kind === "ul" || current?.kind === "ol") {
      // Suite d'un élément de liste sur la ligne suivante.
      const items = current.items;
      items[items.length - 1] += ` ${line.trim()}`;
    } else {
      if (current?.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      (current as { lines: string[] }).lines.push(line);
    }
  }
  flush();
  return result;
}

function blocks(text: string) {
  return parseBlocks(text).map((block, i) => {
    if (block.kind === "h") {
      return (
        <p key={i} className="pt-1 font-semibold">
          {inline(block.text)}
        </p>
      );
    }
    if (block.kind === "p") {
      return (
        <p key={i} className="break-words">
          {block.lines.map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </p>
      );
    }
    const List = block.kind;
    return (
      <List key={i} className={cn("flex flex-col gap-1 pl-5", List === "ul" ? "list-disc" : "list-decimal")}>
        {block.items.map((item, j) => (
          <li key={j} className="break-words">
            {inline(item)}
          </li>
        ))}
      </List>
    );
  });
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+|\*[^*\s][^*]*\*)/g;

function inline(text: string) {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link || /^https?:\/\//.test(part)) {
      const href = link ? link[2] : part.replace(/[.,;:!?]+$/, "");
      const trailing = link ? "" : part.slice(href.length);
      return (
        <Fragment key={i}>
          <a href={href} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-2">
            {link ? link[1] : href}
          </a>
          {trailing}
        </Fragment>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
