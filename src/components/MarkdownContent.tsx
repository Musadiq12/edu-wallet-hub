import { Fragment, type ReactNode } from "react";

const MARKDOWN_LINK = /^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/i;
const BARE_URL = /^https?:\/\/[^\s<>()]+$/i;

function inline(text: string): ReactNode[] {
  // Keep Markdown links and bare URLs as separate tokens so pasted URLs become clickable.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\)|`[^`]+`|https?:\/\/[^\s<>()]+)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;

    const markdownLink = part.match(MARKDOWN_LINK);
    if (markdownLink) {
      const [, label, href] = markdownLink;
      return <a key={i} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{label}</a>;
    }

    if (BARE_URL.test(part)) {
      // Sentence punctuation commonly follows pasted URLs; don't include it in the destination.
      const url = part.replace(/[.,!?;:]+$/, "");
      const trailing = part.slice(url.length);
      return <Fragment key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{trailing}</Fragment>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/);
  return <>{blocks.map((raw, i) => {
    const block = raw.trim();
    if (!block) return null;
    if (/^```/.test(block)) return <pre key={i}><code>{block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "")}</code></pre>;
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const rendered = inline(heading[2]);
      if (heading[1].length === 1) return <h2 key={i}>{rendered}</h2>;
      if (heading[1].length === 2) return <h2 key={i}>{rendered}</h2>;
      return <h3 key={i}>{rendered}</h3>;
    }
    if (/^>\s?/.test(block)) return <blockquote key={i}>{inline(block.replace(/^>\s?/gm, "").replace(/\n/g, " "))}</blockquote>;
    if (/^(?:[-*+]\s|\d+\.\s)/m.test(block)) {
      const lines = block.split("\n").filter(Boolean);
      const ordered = /^\d+\.\s/.test(lines[0]);
      const items = lines.map((line, j) => <li key={j}>{inline(line.replace(/^(?:[-*+]\s|\d+\.\s)/, ""))}</li>);
      return ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
    }
    return <p key={i}>{inline(block.replace(/\n/g, " "))}</p>;
  })}</>;
}
