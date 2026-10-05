import fs from "node:fs";
import path from "node:path";

const siteUrl=(process.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/,"");
if(!siteUrl) throw new Error("VITE_PUBLIC_SITE_URL is required to generate sitemap.xml");
const routes=["/","/shop","/free-resources","/about","/contact","/privacy","/terms"];
const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...routes.map(route=>`  <url><loc>${siteUrl}${route}</loc></url>`),"</urlset>",""].join("\n");
const robots=[ "User-agent: *","Allow: /","Disallow: /admin","Disallow: /checkout/","Disallow: /login","Disallow: /register","Disallow: /forgot-password","Disallow: /reset-password",`Sitemap: ${siteUrl}/sitemap.xml`,""].join("\n");
const out=path.resolve("public");
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,"sitemap.xml"),xml);
fs.writeFileSync(path.join(out,"robots.txt"),robots);
