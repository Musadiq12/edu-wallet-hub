import { Fragment, type ReactNode } from "react";

const MARKDOWN_LINK = /^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)$/i;
const BARE_URL = /^https?:\/\/[^\s<>()]+$/i;

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|~~[^~]+~~|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\)|`[^`]+`|https?:\/\/[^\s<>()]+)/gi);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={i}>{part.slice(2,-2)}</s>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1,-1)}</em>;
    if (part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1,-1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1,-1)}</code>;
    const markdownLink = part.match(MARKDOWN_LINK);
    if (markdownLink) { const [, label, href] = markdownLink; return <a key={i} href={href} target={href.startsWith("http")?"_blank":undefined} rel={href.startsWith("http")?"noopener noreferrer":undefined}>{label}</a>; }
    if (BARE_URL.test(part)) { const url=part.replace(/[.,!?;:]+$/,""); return <Fragment key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{part.slice(url.length)}</Fragment>; }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function isHtml(content: string) { return /<(p|h[1-6]|ul|ol|blockquote|figure|img|table|pre|iframe|hr|div)\b/i.test(content); }

export function MarkdownContent({ content }: { content: string }) {
  if (isHtml(content)) {
    // Tiptap HTML is authored only by authenticated administrators; URLs and media
    // are constrained at the editor upload boundary and HTML is sanitized before rendering.
    return <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(content) }} />;
  }
  const blocks = content.split(/\n\s*\n/);
  return <>{blocks.map((raw,i)=>{
    const block=raw.trim(); if(!block)return null;
    if(/^```/.test(block))return <pre key={i}><code>{block.replace(/^```[^\n]*\n?/,"").replace(/\n?```$/,"")}</code></pre>;
    if(/^---+$/.test(block))return <hr key={i}/>;
    const heading=block.match(/^(#{1,4})\s+(.+)$/);
    if(heading){const Tag=`h${heading[1].length}` as keyof JSX.IntrinsicElements;return <Tag key={i}>{inline(heading[2])}</Tag>;}
    if(/^>\s?/.test(block))return <blockquote key={i}>{inline(block.replace(/^>\s?/gm,"").replace(/\n/g," "))}</blockquote>;
    if(/^(?:[-*+]\s|\d+\.\s)/m.test(block)){const lines=block.split("\n").filter(Boolean),ordered=/^\d+\.\s/.test(lines[0]);const items=lines.map((line,j)=><li key={j}>{inline(line.replace(/^(?:[-*+]\s|\d+\.\s)/,""))}</li>);return ordered?<ol key={i}>{items}</ol>:<ul key={i}>{items}</ul>;}
    return <p key={i}>{inline(block.replace(/\n/g," "))}</p>;
  })}</>;
}

// Allow only editor-supported structural HTML. Scripts, event handlers, styles,
// SVG, forms, and unknown embeds are removed to avoid stored-XSS in public posts.
function sanitizeArticleHtml(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
  const doc = new DOMParser().parseFromString(html,"text/html");
  const allowed = new Set(["P","H1","H2","H3","H4","UL","OL","LI","BLOCKQUOTE","STRONG","B","EM","I","U","S","DEL","A","IMG","FIGURE","FIGCAPTION","HR","PRE","CODE","TABLE","THEAD","TBODY","TR","TH","TD","BR","DIV","IFRAME"]);
  for(const element of Array.from(doc.body.querySelectorAll("*"))){
    if(!allowed.has(element.tagName)){element.replaceWith(...Array.from(element.childNodes));continue;}
    for(const attr of Array.from(element.attributes)){
      const name=attr.name.toLowerCase(),value=attr.value.trim();
      if(name.startsWith("on")||name==="style"||name==="srcdoc"||name==="srcset"||(name!=="href"&&name!=="src"&&name!=="alt"&&name!=="title"&&name!=="width"&&name!=="height"&&name!=="colspan"&&name!=="rowspan"&&name!=="target"&&name!=="rel"&&name!=="class"))element.removeAttribute(attr.name);
      if((name==="href"||name==="src")&&!/^(https:\/\/|\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value))element.removeAttribute(attr.name);
      if(name==="src"&&element.tagName==="IFRAME"&&!/^https:\/\/(www\.)?youtube-nocookie\.com\/embed\//i.test(value))element.removeAttribute(attr.name);
    }
    if(element.tagName==="A"){element.setAttribute("rel","noopener noreferrer");if(element.getAttribute("target")==="_blank")element.setAttribute("target","_blank");}
    if(element.tagName==="IMG"){element.setAttribute("loading","lazy");element.setAttribute("decoding","async");element.setAttribute("draggable","false");}
  }
  return doc.body.innerHTML;
}
