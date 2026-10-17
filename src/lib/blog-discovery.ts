import {
  INDEXABLE_PATHS,
  LAST_CONTENT_UPDATE,
  PAGE_SEO,
  SITE_URL,
  absoluteUrl,
  colombiaAlternateFor,
} from "../config/seo.mjs";
import { getBlogData, type BlogArticle, type BlogGallery } from "./blog";

type SitemapEntry = {
  url: string;
  lastmod: string;
  title: string;
  image?: string;
  alternate?: string | null;
};

const BLOG_ROOTS = new Set(["/blog/", "/galeria/"]);

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function validDate(value?: string): string {
  const parsed = new Date(value || LAST_CONTENT_UPDATE);
  return Number.isNaN(parsed.getTime())
    ? new Date(LAST_CONTENT_UPDATE).toISOString()
    : parsed.toISOString();
}

function latest(entries: SitemapEntry[]): string {
  return entries.map((entry) => entry.lastmod).sort().at(-1) || validDate();
}

function entryXml(entry: SitemapEntry): string {
  const alternate = entry.alternate
    ? `<xhtml:link rel="alternate" hreflang="es-CO" href="${xmlEscape(entry.alternate)}"/>`
    : "";
  const image = entry.image
    ? `<image:image><image:loc>${xmlEscape(entry.image)}</image:loc><image:title>${xmlEscape(entry.title)}</image:title></image:image>`
    : "";
  return `<url><loc>${xmlEscape(entry.url)}</loc><lastmod>${xmlEscape(entry.lastmod)}</lastmod>${alternate}${image}</url>`;
}

export function sitemapXml(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.map(entryXml).join("\n")}\n</urlset>\n`;
}

export function pageEntries(): SitemapEntry[] {
  return INDEXABLE_PATHS
    .filter((pathname) => !BLOG_ROOTS.has(pathname))
    .map((pathname) => ({
      url: absoluteUrl(SITE_URL, pathname),
      lastmod: validDate(),
      title: PAGE_SEO[pathname as keyof typeof PAGE_SEO].title,
      alternate: colombiaAlternateFor(pathname),
    }));
}

function articleEntry(article: BlogArticle): SitemapEntry {
  return {
    url: `${SITE_URL}/blog/${article.slug}/`,
    lastmod: validDate(article.modifiedDate || article.publishedDate || article.publishDate),
    title: article.title,
    image: article.seo?.shareImage?.url || article.coverImage?.url || undefined,
  };
}

function galleryEntry(gallery: BlogGallery): SitemapEntry {
  return {
    url: `${SITE_URL}/galeria/${gallery.slug}/`,
    lastmod: validDate(gallery.modifiedDate || gallery.publishedDate || gallery.publishDate),
    title: gallery.title,
    image: gallery.seo?.shareImage?.url || gallery.images[0]?.url || undefined,
  };
}

export async function liveBlogEntries(): Promise<SitemapEntry[]> {
  const { articles, galleries } = await getBlogData();
  const content = [
    ...articles.map(articleEntry),
    ...galleries.map(galleryEntry),
  ];
  const lastmod = latest(content);
  return [
    { url: `${SITE_URL}/blog/`, lastmod, title: PAGE_SEO["/blog/"].title },
    { url: `${SITE_URL}/galeria/`, lastmod, title: PAGE_SEO["/galeria/"].title },
    ...content,
  ];
}

export async function sitemapIndexXml(): Promise<string> {
  const blog = await liveBlogEntries();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${latest(pageEntries())}</lastmod></sitemap><sitemap><loc>${SITE_URL}/sitemap-blog.xml</loc><lastmod>${latest(blog)}</lastmod></sitemap></sitemapindex>\n`;
}

export async function rssXml(): Promise<string> {
  const { articles } = await getBlogData();
  const items = articles.slice(0, 50).map((article) => {
    const url = `${SITE_URL}/blog/${article.slug}/`;
    const published = validDate(article.publishedDate || article.publishDate);
    const image = article.seo?.shareImage?.url || article.coverImage?.url;
    return `<item><title>${xmlEscape(article.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${xmlEscape(article.excerpt)}</description><pubDate>${new Date(published).toUTCString()}</pubDate><dc:creator>${xmlEscape(article.authorName)}</dc:creator>${image ? `<media:content url="${xmlEscape(image)}" medium="image"/>` : ""}</item>`;
  }).join("\n");
  const lastBuildDate = articles.length
    ? new Date(validDate(articles[0].modifiedDate || articles[0].publishDate)).toUTCString()
    : new Date(validDate()).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Pulso Campuslands</title><link>${SITE_URL}/blog/</link><description>Publicaciones de Campuslands Guatemala sobre tecnología, comunidad y carrera.</description><language>es-GT</language><lastBuildDate>${lastBuildDate}</lastBuildDate><atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>\n`;
}
