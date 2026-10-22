import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\)|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/);
  return <>{blocks.map((raw, i) => {
    const block = raw.trim();
    if (!block) return null;
    if (/^\`\`\`/.test(block)) return <pre key={i}><code>{block.replace(/^\`\`\`[^\n]*\n?/, "").replace(/\n?\`\`\`$/, "")}</code></pre>;
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const text = inline(heading[2]);
      if (heading[1].length === 1) return <h2 key={i}>{text}</h2>;
      if (heading[1].length === 2) return <h2 key={i}>{text}</h2>;
      return <h3 key={i}>{text}</h3>;
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
