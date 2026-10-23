export type BlogTextNode = {
  type: string;
  text?: string;
  url?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  children?: BlogTextNode[];
};

export type BlogBlock = BlogTextNode & {
  level?: number;
  format?: "ordered" | "unordered";
  image?: BlogMedia;
  images?: BlogMedia[];
  alignment?: "wide" | "full" | "left" | "center" | "right";
  layout?: "grid" | "masonry" | "carousel";
  autoplay?: boolean;
  tone?: "info" | "success" | "warning" | "note";
  title?: string;
  label?: string;
  variant?: "primary" | "secondary";
  openInNewTab?: boolean;
  caption?: string;
  provider?: "youtube" | "vimeo" | "direct";
  platform?: "instagram" | "facebook" | "x" | "other";
  headers?: string[];
  rows?: string[][];
};

export type BlogMedia = {
  id?: number | string | null;
  hash?: string | null;
  url: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  name?: string | null;
  formats?: Record<string, BlogMediaVariant> | null;
};

export type BlogMediaVariant = {
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
};

export type BlogArticleLink = {
  label: string;
  url: string;
  description: string;
  image: BlogMedia | null;
  openInNewTab: boolean;
  active: boolean;
};

export type GalleryTargetSection = "join-us" | "ai-academy";

export type BlogGallery = {
  id: string;
  title: string;
  slug: string;
  description: string;
  images: BlogMedia[];
  category: BlogCategory;
  tags: string[];
  featured: boolean;
  targetSection: GalleryTargetSection;
  publishDate: string;
  publishedDate: string;
  modifiedDate: string;
  seo: BlogSeo | null;
};

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  order: number;
  visualStyle: BlogVisualStyle;
};

export type BlogVisualStyle = "ai" | "code" | "community" | "career" | "notes";

export type BlogSeo = {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  shareImage?: BlogMedia | null;
};

export type BlogArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: BlogBlock[];
  coverImage: BlogMedia | null;
  coverAlt: string;
  coverMode: "category-animation" | "cover-image";
  category: BlogCategory;
  authorName: string;
  featured: boolean;
  readingTime: number;
  publishDate: string;
  publishedDate: string;
  modifiedDate: string;
  tags: string[];
  links: BlogArticleLink[];
  attachments: BlogMedia[];
  seo: BlogSeo | null;
};

export type BlogSettings = {
  publicationName: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  filterLabel: string;
  allCategoriesLabel: string;
  categoryIntro: string;
  featuredLabel: string;
  readArticleLabel: string;
  archiveEyebrow: string;
  archiveTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyButtonLabel: string;
  footerTitle: string;
  footerDescription: string;
  articleFooterTitle: string;
  articleFooterDescription: string;
  contentsLabel: string;
  tagsLabel: string;
  resourcesLabel: string;
  attachmentsLabel: string;
  galleriesLabel: string;
  galleriesTitle: string;
  galleriesDescription: string;
  viewGalleryLabel: string;
  galleryImagesLabel: string;
  relatedEyebrow: string;
  relatedTitle: string;
  viewAllLabel: string;
  seoTitle: string;
  seoDescription: string;
};

export type BlogData = {
  settings: BlogSettings | null;
  categories: BlogCategory[];
  articles: BlogArticle[];
  galleries: BlogGallery[];
  source: "cms" | "unavailable";
};

const runtimeCmsUrl = import.meta.env.SSR && typeof process !== "undefined"
  ? process.env.PUBLIC_CMS_URL
  : undefined;
const CMS_URL = String(runtimeCmsUrl || import.meta.env.PUBLIC_CMS_URL || "http://127.0.0.1:1337").replace(/\/+$/, "");

export function safeCategoryColor(value?: string): string {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? String(value).toUpperCase() : "#2CAAFF";
}

export function colorRgb(value: string): string {
  const color = safeCategoryColor(value).slice(1);
  return `${Number.parseInt(color.slice(0, 2), 16)} ${Number.parseInt(color.slice(2, 4), 16)} ${Number.parseInt(color.slice(4, 6), 16)}`;
}

export function formatBlogDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function compactSeoText(value?: string | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateSeoText(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  const end = lastSpace > maximum * 0.7 ? lastSpace : maximum;
  return `${shortened.slice(0, end).trim()}…`;
}

function normalizeDateTime(value?: string | null): string {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function blogSeoTitle(
  preferred: string | null | undefined,
  fallback: string,
): string {
  let title = truncateSeoText(compactSeoText(preferred) || compactSeoText(fallback), 64);
  if (!/campuslands/i.test(title)) {
    const suffix = " | Campuslands";
    title = `${truncateSeoText(title, 64 - suffix.length)}${suffix}`;
  }
  return title;
}

export function blogSeoDescription(
  preferred: string | null | undefined,
  fallback: string,
): string {
  let description = compactSeoText(preferred);
  if (description.length < 80) description = compactSeoText(fallback);
  if (description.length < 100) {
    description = `${description} Conoce la información completa en Campuslands Guatemala.`;
  }
  return truncateSeoText(description, 165);
}

function mediaUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith("/")) return "";
  return `${CMS_URL}${url}`;
}

function normalizeMedia(value: any): BlogMedia | null {
  if (!value?.url) return null;
  const formats = value.formats && typeof value.formats === "object"
    ? Object.fromEntries(
        Object.entries(value.formats).flatMap(([key, format]: [string, any]) => {
          const url = mediaUrl(format?.url);
          if (!url) return [];
          return [[key, {
            url,
            width: Number(format?.width) || null,
            height: Number(format?.height) || null,
            mime: format?.mime ? String(format.mime) : null,
          }]];
        }),
      )
    : null;
  return {
    id: value.id ?? null,
    hash: value.hash ? String(value.hash) : null,
    url: mediaUrl(value.url),
    alternativeText: value.alternativeText,
    caption: value.caption,
    width: Number(value.width) || null,
    height: Number(value.height) || null,
    mime: value.mime ? String(value.mime) : null,
    name: value.name ? String(value.name) : null,
    formats,
  };
}

function mediaVariants(value?: BlogMedia | null): BlogMediaVariant[] {
  if (!value?.url) return [];
  const candidates = [
    ...Object.values(value.formats || {}),
    { url: mediaUrl(value.url), width: value.width, height: value.height, mime: value.mime },
  ];
  const unique = new Map<string, BlogMediaVariant>();
  candidates.forEach((candidate) => {
    const url = mediaUrl(candidate?.url);
    const width = Number(candidate?.width) || 0;
    if (url && width) unique.set(`${url}:${width}`, { ...candidate, url, width });
  });
  return [...unique.values()].sort((left, right) => Number(left.width) - Number(right.width));
}

export function blogMediaSrcset(value?: BlogMedia | null): string | undefined {
  const variants = mediaVariants(value);
  return variants.length > 1
    ? variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ")
    : undefined;
}

function normalizeArticleLinks(value: unknown): BlogArticleLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: any) => {
    const url = safeLink(String(item?.url || ""));
    const label = String(item?.label || item?.buttonName || item?.button_name || "").trim();
    if (!url || !label) return [];
    return [{
      label,
      url,
      description: String(item?.description || ""),
      image: normalizeMedia(item?.image),
      openInNewTab: Boolean(item?.openInNewTab ?? item?.open_in_new_tab),
      active: item?.active !== false,
    }];
  });
}

function normalizeSettings(value: any): BlogSettings | null {
  if (!value?.publicationName || !value?.heroTitle) return null;
  const stringValue = (key: string) => String(value[key] || "");
  return {
    publicationName: stringValue("publicationName"),
    eyebrow: stringValue("eyebrow"),
    heroTitle: stringValue("heroTitle"),
    heroDescription: stringValue("heroDescription"),
    filterLabel: stringValue("filterLabel"),
    allCategoriesLabel: stringValue("allCategoriesLabel"),
    categoryIntro: stringValue("categoryIntro"),
    featuredLabel: stringValue("featuredLabel"),
    readArticleLabel: stringValue("readArticleLabel"),
    archiveEyebrow: stringValue("archiveEyebrow"),
    archiveTitle: stringValue("archiveTitle"),
    emptyTitle: stringValue("emptyTitle"),
    emptyDescription: stringValue("emptyDescription"),
    emptyButtonLabel: stringValue("emptyButtonLabel"),
    footerTitle: stringValue("footerTitle"),
    footerDescription: stringValue("footerDescription"),
    articleFooterTitle: stringValue("articleFooterTitle"),
    articleFooterDescription: stringValue("articleFooterDescription"),
    contentsLabel: stringValue("contentsLabel"),
    tagsLabel: stringValue("tagsLabel"),
    resourcesLabel: stringValue("resourcesLabel") || "RECURSOS PARA CONTINUAR",
    attachmentsLabel: stringValue("attachmentsLabel") || "ARCHIVOS DE LA PUBLICACIÓN",
    galleriesLabel: stringValue("galleriesLabel") || "GALERÍAS",
    galleriesTitle: stringValue("galleriesTitle") || "Historias que también se recorren con la mirada",
    galleriesDescription: stringValue("galleriesDescription") || "Colecciones visuales de la comunidad Campuslands.",
    viewGalleryLabel: stringValue("viewGalleryLabel") || "Abrir galería",
    galleryImagesLabel: stringValue("galleryImagesLabel") || "IMÁGENES DE LA GALERÍA",
    relatedEyebrow: stringValue("relatedEyebrow"),
    relatedTitle: stringValue("relatedTitle"),
    viewAllLabel: stringValue("viewAllLabel"),
    seoTitle: stringValue("seoTitle"),
    seoDescription: stringValue("seoDescription"),
  };
}

function normalizeCategory(value: any): BlogCategory | null {
  if (!value?.slug || !value?.name) return null;
  const legacyVisualStyles: Record<string, BlogVisualStyle> = {
    "inteligencia-artificial": "ai",
    programacion: "code",
    "comunidad-camper": "community",
    "carrera-empleabilidad": "career",
  };
  return {
    id: String(value.documentId || value.id || value.slug),
    name: String(value.name),
    slug: String(value.slug),
    description: String(value.description || ""),
    color: safeCategoryColor(value.color),
    order: Number(value.order) || 0,
    visualStyle: ["ai", "code", "community", "career", "notes"].includes(value.visualStyle)
      ? value.visualStyle
      : legacyVisualStyles[String(value.slug)] || "notes",
  };
}

function normalizeArticle(value: any): BlogArticle | null {
  const category = normalizeCategory(value?.category);
  if (!value?.slug || !value?.title || !category) return null;
  return {
    id: String(value.documentId || value.id || value.slug),
    title: String(value.title),
    slug: String(value.slug),
    excerpt: String(value.excerpt || ""),
    content: Array.isArray(value.content) ? value.content : [],
    coverImage: normalizeMedia(value.coverImage),
    coverAlt: String(value.coverAlt || value.coverImage?.alternativeText || ""),
    coverMode: value.coverMode === "cover-image" || (!value.coverMode && value.coverImage?.url)
      ? "cover-image"
      : "category-animation",
    category,
    authorName: String(value.authorName || ""),
    featured: Boolean(value.featured),
    readingTime: Math.max(1, Number(value.readingTime) || 1),
    publishDate: String(value.publishDate || value.publishedAt || "").slice(0, 10),
    publishedDate: normalizeDateTime(value.publishedAt || value.publishDate),
    modifiedDate: normalizeDateTime(value.updatedAt || value.publishedAt || value.publishDate),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag: unknown) => typeof tag === "string") : [],
    links: normalizeArticleLinks(value.links),
    attachments: Array.isArray(value.attachments)
      ? value.attachments.map(normalizeMedia).filter(Boolean) as BlogMedia[]
      : [],
    seo: value.seo
      ? {
          metaTitle: value.seo.metaTitle,
          metaDescription: value.seo.metaDescription,
          keywords: value.seo.keywords,
          shareImage: normalizeMedia(value.seo.shareImage),
        }
      : null,
  };
}

function normalizeGallery(value: any): BlogGallery | null {
  const category = normalizeCategory(value?.category);
  if (!value?.slug || !value?.title || !category) return null;
  const mediaById = new Map((Array.isArray(value.images) ? value.images : []).map((image: any) => [Number(image?.id), image]));
  const ordered = Array.isArray(value.imageDetails) && value.imageDetails.length ? value.imageDetails : value.images;
  const images = (Array.isArray(ordered) ? ordered : []).flatMap((item: any) => {
    const base = mediaById.get(Number(item?.id)) || item;
    const image = normalizeMedia({ ...base, alternativeText: item?.alternativeText ?? base?.alternativeText, caption: item?.caption ?? base?.caption });
    return image ? [image] : [];
  });
  const rawTarget = String(value.targetSection || "").trim().toLowerCase();
  const inferredTarget: GalleryTargetSection =
    category.slug === "inteligencia-artificial" ||
    /\b(ia|ai|academy|taller|marketing|finanzas|automatizacion|datos)\b/i.test(
      `${value.title || ""} ${value.slug || ""} ${category.slug}`,
    )
      ? "ai-academy"
      : "join-us";
  const targetSection: GalleryTargetSection =
    rawTarget === "join-us" || rawTarget === "ai-academy"
      ? rawTarget
      : inferredTarget;
  return {
    id: String(value.documentId || value.id || value.slug),
    title: String(value.title),
    slug: String(value.slug),
    description: String(value.description || ""),
    images,
    category,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag: unknown) => typeof tag === "string") : [],
    featured: Boolean(value.featured),
    targetSection,
    publishDate: String(value.publishDate || value.publishedAt || "").slice(0, 10),
    publishedDate: normalizeDateTime(value.publishedAt || value.publishDate),
    modifiedDate: normalizeDateTime(value.updatedAt || value.publishedAt || value.publishDate),
    seo: value.seo ? {
      metaTitle: value.seo.metaTitle,
      metaDescription: value.seo.metaDescription,
      keywords: value.seo.keywords,
      shareImage: normalizeMedia(value.seo.shareImage),
    } : null,
  };
}

export function filterGalleriesBySection(
  galleries: BlogGallery[] = [],
  section: "join-us" | "ai-academy",
): BlogGallery[] {
  return galleries.filter(
    (gallery) => gallery.images.length > 0 && gallery.targetSection === section,
  );
}

async function fetchJson(path: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${CMS_URL}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`CMS respondió HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }

  throw lastError;
}

async function fetchCollection(path: string) {
  const data: any[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetchJson(`${path}${separator}pagination[page]=${page}&pagination[pageSize]=100`);
    data.push(...(Array.isArray(response?.data) ? response.data : []));
    pageCount = Math.max(1, Number(response?.meta?.pagination?.pageCount) || 1);
    page += 1;
  } while (page <= pageCount);

  return data;
}

let lastSuccessfulBlogData: BlogData | undefined;

async function loadBlogData(): Promise<BlogData> {
  try {
    const [settingsResponse, categoryData, articleData, galleryData] = await Promise.all([
      fetchJson("/api/blog-setting"),
      fetchCollection("/api/categories?status=published&filters[visible][$eq]=true&sort=order:asc"),
      fetchCollection("/api/articles?status=published&populate[category]=true&populate[coverImage]=true&populate[attachments]=true&populate[seo][populate][shareImage]=true&sort=publishDate:desc"),
      fetchCollection("/api/galleries?status=published&populate[category]=true&populate[images]=true&populate[seo][populate][shareImage]=true&sort=publishDate:desc"),
    ]);

    const categories = categoryData.map(normalizeCategory).filter(Boolean) as BlogCategory[];
    const visibleCategorySlugs = new Set(categories.map((category) => category.slug));
    const articles = (articleData.map(normalizeArticle).filter(Boolean) as BlogArticle[])
      .filter((article) => visibleCategorySlugs.has(article.category.slug));
    const galleries = (galleryData.map(normalizeGallery).filter(Boolean) as BlogGallery[])
      .filter((gallery) => visibleCategorySlugs.has(gallery.category.slug));

    const currentBlogData: BlogData = {
      settings: normalizeSettings(settingsResponse.data),
      categories,
      articles,
      galleries,
      source: "cms",
    };
    lastSuccessfulBlogData = currentBlogData;
    return currentBlogData;
  } catch (error) {
    if (String(import.meta.env.REQUIRE_CMS_FOR_BUILD || "").toLowerCase() === "true") {
      throw new Error(`[Blog] No se puede compilar sin contenido válido del CMS: ${String(error)}`);
    }
    console.warn(`[Blog] El CMS no está disponible: ${String(error)}`);
    if (lastSuccessfulBlogData) return lastSuccessfulBlogData;
    return { settings: null, categories: [], articles: [], galleries: [], source: "unavailable" };
  }
}

export async function getBlogData(): Promise<BlogData> {
  return loadBlogData();
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeLink(value?: string): string {
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function renderInline(nodes: BlogTextNode[] = []): string {
  return nodes.map((node) => {
    if (node.type === "link") {
      const href = safeLink(node.url);
      const content = renderInline(node.children);
      if (!href) return content;
      const external = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(href)}"${external}>${content}</a>`;
    }

    let content = node.text !== undefined
      ? escapeHtml(node.text).replace(/\r?\n/g, "<br />")
      : renderInline(node.children);
    if (node.code) content = `<code>${content}</code>`;
    if (node.bold) content = `<strong>${content}</strong>`;
    if (node.italic) content = `<em>${content}</em>`;
    if (node.underline) content = `<u>${content}</u>`;
    if (node.strikethrough) content = `<s>${content}</s>`;
    return content;
  }).join("");
}

function plainText(nodes: BlogTextNode[] = []): string {
  return nodes.map((node) => node.text || plainText(node.children)).join("").trim();
}

function headingId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seccion";
}

export function getBlogHeadings(blocks: BlogBlock[] = []) {
  return blocks
    .filter((block) => block.type === "heading")
    .map((block) => {
      const label = plainText(block.children);
      return { id: headingId(label), label };
    })
    .filter((heading) => heading.label);
}

function videoEmbed(value?: string, provider?: string): string {
  const safe = safeLink(value);
  if (!safe || !/^https?:\/\//i.test(safe)) return "";
  try {
    const url = new URL(safe);
    if (provider === "youtube" || /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname)) {
      const id = url.hostname.includes("youtu.be")
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      return /^[\w-]{6,20}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (provider === "vimeo" || /(^|\.)vimeo\.com$/i.test(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return /^\d{5,15}$/.test(id || "") ? `https://player.vimeo.com/video/${id}` : "";
    }
  } catch {
    return "";
  }
  return "";
}

export function renderBlogBlocks(blocks: BlogBlock[] = []): string {
  return blocks.map((block) => {
    if (block.type === "paragraph") return `<p class="article-align--${["center", "right"].includes(block.alignment || "") ? block.alignment : "left"}">${renderInline(block.children)}</p>`;
    if (block.type === "heading") {
      const level = Math.min(4, Math.max(2, Number(block.level) || 2));
      const id = headingId(plainText(block.children));
      return `<h${level} class="article-align--${["center", "right"].includes(block.alignment || "") ? block.alignment : "left"}" id="${id}">${renderInline(block.children)}</h${level}>`;
    }
    if (block.type === "quote") return `<blockquote class="article-align--${["center", "right"].includes(block.alignment || "") ? block.alignment : "left"}">${renderInline(block.children)}</blockquote>`;
    if (block.type === "list") {
      const tag = block.format === "ordered" ? "ol" : "ul";
      const items = (block.children || []).map((item) => `<li>${renderInline(item.children)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    if (block.type === "code") return `<pre><code>${escapeHtml(block.children?.map((child) => child.text || "").join("") || block.text || "")}</code></pre>`;
    if (block.type === "image" && block.image?.url) {
      const url = mediaUrl(block.image.url);
      if (!url) return "";
      const label = block.image.alternativeText || block.image.caption || "Imagen de la publicación";
      const caption = block.image.caption ? `<figcaption>${escapeHtml(block.image.caption)}</figcaption>` : "";
      const alignment = ["wide", "full", "left", "right"].includes(block.alignment || "") ? block.alignment : "wide";
      const normalized = normalizeMedia(block.image);
      const srcset = blogMediaSrcset(normalized);
      const dimensions = normalized?.width && normalized?.height
        ? ` width="${normalized.width}" height="${normalized.height}"`
        : "";
      const responsive = srcset ? ` srcset="${escapeHtml(srcset)}" sizes="${alignment === "full" ? "(max-width: 1050px) 100vw, 1050px" : alignment === "left" || alignment === "right" ? "(max-width: 640px) 100vw, 352px" : "(max-width: 760px) 100vw, 760px"}"` : "";
      return `<figure class="article-image article-image--${alignment}"><img class="article-inline-image" src="${escapeHtml(url)}"${responsive} alt="${escapeHtml(label)}"${dimensions} loading="lazy" decoding="async" />${caption}</figure>`;
    }
    if (block.type === "gallery" && Array.isArray(block.images) && block.images.length) {
      const layout = ["grid", "masonry", "carousel"].includes(block.layout || "") ? block.layout : "grid";
      const title = block.title ? `<h3>${escapeHtml(block.title)}</h3>` : "";
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
      const images = block.images.flatMap((image, index) => {
        const url = mediaUrl(image.url);
        if (!url) return [];
        const alt = image.alternativeText || image.caption || `Imagen ${index + 1}`;
        const normalized = normalizeMedia(image);
        const srcset = blogMediaSrcset(normalized);
        const dimensions = normalized?.width && normalized?.height
          ? ` width="${normalized.width}" height="${normalized.height}"`
          : "";
        const responsive = srcset
          ? ` srcset="${escapeHtml(srcset)}" sizes="${layout === "carousel" ? "(max-width: 640px) 88vw, 760px" : "(max-width: 640px) 100vw, 480px"}"`
          : "";
        const orientation = Number(normalized?.height) > Number(normalized?.width) * 1.08
          ? "portrait"
          : Number(normalized?.width) > Number(normalized?.height) * 1.35
            ? "landscape"
            : "square";
        const itemCaption = image.caption
          ? `<small class="article-gallery__caption">${escapeHtml(image.caption)}</small>`
          : "";
        return [`<button class="article-gallery__item article-gallery__item--${orientation}" type="button" data-article-gallery-image data-src="${escapeHtml(url)}" data-alt="${escapeHtml(alt)}" data-caption="${escapeHtml(image.caption || "")}" aria-label="Abrir imagen ${index + 1}: ${escapeHtml(alt)}"><span class="article-gallery__media"><img src="${escapeHtml(url)}"${responsive} alt="${escapeHtml(alt)}"${dimensions} loading="lazy" decoding="async" /></span><b>${String(index + 1).padStart(2, "0")}</b>${itemCaption}</button>`];
      }).join("");
      const controls = layout === "carousel"
        ? '<nav class="article-gallery__controls" aria-label="Controles del carrusel"><button type="button" data-gallery-scroll="previous" aria-label="Ver imágenes anteriores">←</button><span>Desliza para explorar</span><button type="button" data-gallery-scroll="next" aria-label="Ver imágenes siguientes">→</button></nav>'
        : "";
      return `<figure class="article-gallery article-gallery--${layout}" data-article-gallery${block.autoplay ? ' data-autoplay="true"' : ""}>${title}<div class="article-gallery__viewport"><div class="article-gallery__items">${images}</div></div>${controls}${caption}</figure>`;
    }
    if (block.type === "callout") {
      const tone = ["info", "success", "warning", "note"].includes(block.tone || "") ? block.tone : "info";
      const title = block.title ? `<strong>${escapeHtml(block.title)}</strong>` : "";
      return `<aside class="article-callout article-callout--${tone}">${title}<p>${renderInline(block.children)}</p></aside>`;
    }
    if (block.type === "button") {
      const href = safeLink(block.url);
      if (!href || !block.label) return "";
      const external = block.openInNewTab || /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      const variant = block.variant === "secondary" ? "secondary" : "primary";
      return `<p class="article-inline-cta"><a class="article-inline-cta--${variant}" href="${escapeHtml(href)}"${external}>${escapeHtml(block.label)} <span aria-hidden="true">↗</span></a></p>`;
    }
    if (block.type === "video") {
      const href = safeLink(block.url);
      if (!href) return "";
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
      const embed = videoEmbed(href, block.provider);
      if (embed) {
        return `<figure class="article-video"><div><iframe src="${escapeHtml(embed)}" title="${escapeHtml(block.caption || "Video de la publicación")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>${caption}</figure>`;
      }
      return `<figure class="article-video"><video controls preload="metadata" src="${escapeHtml(href)}"></video>${caption}</figure>`;
    }
    if (block.type === "embed") {
      const href = safeLink(block.url);
      if (!href) return "";
      const platform = String(block.platform || "recurso").toUpperCase();
      return `<aside class="article-embed"><span>${escapeHtml(platform)}</span><div><strong>${escapeHtml(block.caption || "Contenido relacionado")}</strong><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Abrir publicación <span aria-hidden="true">↗</span></a></div></aside>`;
    }
    if (block.type === "table") {
      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (!headers.length && !rows.length) return "";
      const head = headers.length ? `<thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>` : "";
      const body = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
      return `<figure class="article-table"><div><table>${head}${body}</table></div>${caption}</figure>`;
    }
    if (block.type === "divider") return '<hr class="article-divider" />';
    return "";
  }).join("");
}

export function coverStyle(article: BlogArticle): string {
  const color = safeCategoryColor(article.category.color);
  const rgb = colorRgb(color);
  const image = mediaUrl(article.coverImage?.url);
  const photo = image ? `url('${image.replaceAll("'", "%27")}')` : "none";
  return `--category-color:${color};--category-rgb:${rgb};--cover-photo:${photo};--cover-image:radial-gradient(circle at 76% 22%, rgb(${rgb} / 0.72), transparent 26%),linear-gradient(135deg, rgb(${rgb} / 0.34), #07102b 58%, #000051);`;
}
