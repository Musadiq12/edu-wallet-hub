import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { MarkdownContent } from "@/components/MarkdownContent";
import { siteConfig } from "@/config/site";
import { absoluteUrl, BRAND, buildMeta, buildTitle } from "@/lib/seo";
import { coverImageUrl, postBySlugQuery, readingTimeMinutes, relatedProductsQuery } from "@/lib/blog";
import "@/components/blog-editor.css";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({context,params}) => context.queryClient.ensureQueryData(postBySlugQuery(params.slug)),
  head: ({loaderData,params}) => {
    const p=loaderData as {title?:string;meta_title?:string;seo_title?:string|null;excerpt?:string;meta_description?:string;cover_image?:string}|undefined;
    const title=p?.seo_title?.trim()||buildTitle([p?.meta_title||p?.title||"Exam Preparation Blog",BRAND]);
    const description=buildMeta(p?.meta_description||p?.excerpt||siteConfig.shortDescription);
    return {meta:[{title},{name:"description",content:description},{property:"og:title",content:title},{property:"og:description",content:description},{property:"og:type",content:"article"},{property:"og:url",content:absoluteUrl(`/blog/${params.slug}`)},...(p?.cover_image?[{property:"og:image",content:coverImageUrl(p.cover_image)}]:[]),...(!p?[{name:"robots",content:"noindex"}]:[])],links:p?[{rel:"canonical",href:absoluteUrl(`/blog/${params.slug}`)}]:[]};
  },
  component: Page,
});

function collectHeadings(html:string) {
  if(typeof DOMParser==="undefined")return [];
  const doc=new DOMParser().parseFromString(html,"text/html");
  return Array.from(doc.body.querySelectorAll("h2,h3")).map((h,i)=>({id:`section-${i+1}`,title:h.textContent??"",level:Number(h.tagName.slice(1))}));
}
function addHeadingIds(html:string) {
  if(typeof DOMParser==="undefined")return html;
  const doc=new DOMParser().parseFromString(html,"text/html");
  Array.from(doc.body.querySelectorAll("h2,h3")).forEach((h,i)=>h.id=`section-${i+1}`);
  return doc.body.innerHTML;
}

function Page() {
  const p=Route.useLoaderData();
  const rel=useQuery(relatedProductsQuery(p??undefined));
  const outline=useMemo(()=>p?collectHeadings(p.content):[],[p?.content]);
  if(!p)return <main className="page-container py-12 text-center"><EmptyState title="Article not found" description="This article may have been unpublished or moved."/><Link to="/blog" className="text-primary underline">Browse all articles</Link></main>;
  const image=p.cover_image?coverImageUrl(p.cover_image):"";
  const htmlContent=/<(p|h[1-6]|ul|ol|blockquote|figure|img|table|pre|iframe|hr|div)\b/i.test(p.content);
  const htmlContentWithIds=htmlContent?addHeadingIds(p.content):p.content;
  const shareUrl=typeof window!=="undefined"?window.location.href:absoluteUrl(`/blog/${p.slug}`);
  const share=async()=>{if(typeof navigator!=="undefined"&&navigator.share){try{await navigator.share({title:p.title,text:p.excerpt,url:shareUrl});}catch{return;}}else if(typeof navigator!=="undefined"&&navigator.clipboard){await navigator.clipboard.writeText(shareUrl);}};
  const ld={"@context":"https://schema.org","@type":"BlogPosting",headline:p.title,description:p.meta_description||p.excerpt,mainEntityOfPage:absoluteUrl(`/blog/${p.slug}`),...(image?{image:[image]}:{}),...(p.published_at?{datePublished:p.published_at}:{}),dateModified:p.updated_at,author:{"@type":"Organization",name:siteConfig.fallbackBrand.brandName},publisher:{"@type":"Organization",name:siteConfig.fallbackBrand.brandName}};
  return <main className="page-container max-w-6xl py-8 sm:py-12">
    <article className="mx-auto max-w-4xl">
      {image&&<img src={image} alt={p.title? `Cover image for ${p.title}`:"Article cover"} width="1200" height="675" loading="eager" fetchPriority="high" decoding="async" className="mb-8 max-h-[500px] w-full rounded-2xl object-cover"/>}
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-primary">{p.category} <span className="px-2 text-muted-foreground">·</span>{readingTimeMinutes(p.content)} min read</p>
        <p className="mt-2 text-sm text-muted-foreground"><time dateTime={p.published_at??p.created_at}>Published {new Date(p.published_at??p.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}</time></p>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{p.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{p.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void share()} className="rounded-full border px-4 py-2 text-sm hover:bg-muted">Share article</button><a className="rounded-full border px-4 py-2 text-sm hover:bg-muted" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(p.title+" "+shareUrl)}`}>Share on WhatsApp</a></div>
      </div>
      {outline.length>0&&<nav aria-label="Table of contents" className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-card p-5"><h2 className="font-semibold">In this article</h2><ol className="mt-3 space-y-2 text-sm">{outline.map(item=><li key={item.id} className={item.level===3?"ml-4":""}><a href={`#${item.id}`} className="text-muted-foreground hover:text-primary">{item.title}</a></li>)}</ol></nav>}
      <div className="prose-blog mx-auto mt-9 max-w-3xl text-[1.05rem] leading-[1.85] [&_h1]:mt-9 [&_h1]:text-3xl [&_h2]:mt-9 [&_h2]:text-2xl [&_h3]:mt-7 [&_h3]:text-xl [&_p]:my-5 [&_ul]:my-5 [&_ol]:my-5" style={{userSelect:"text",WebkitUserSelect:"text"}}>
        <MarkdownContent content={htmlContentWithIds}/>
      </div>
      <div className="mt-8 flex flex-wrap gap-2">{p.tags.map(tag=><span key={tag} className="rounded-full border px-3 py-1 text-xs">{tag}</span>)}</div>
      <Link to="/blog" className="mt-8 inline-block text-primary">← Back to blog</Link>
    </article>
    <section className="mt-14"><h2 className="mb-5 text-2xl font-bold">Study material for this topic</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rel.data?.map(x=><ProductCard key={x.id} product={x} compact/>)}</div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(ld).replace(/</g,"\\u003c")}}/>
  </main>;
}
