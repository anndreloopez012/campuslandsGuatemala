<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import BlockEditor from "./BlockEditor.vue";
import GalleryAdmin from "./GalleryAdmin.vue";
import AcademyCampus from "./academy/AcademyCampus.vue";
import { renderBlogBlocks } from "../../lib/blog";
import {
  BLOG_EDITOR_STORAGE_KEY,
  BlogAdminApi,
  mediaUrl,
  slugify,
  type EditorArticle,
  type EditorCategory,
  type EditorDashboard,
  type EditorMedia,
  type EditorUser,
} from "../../lib/blog-admin";

type WorkspaceTab = "posts" | "galleries" | "categories" | "academy" | "settings";
type AppState = "checking" | "login" | "workspace";
type ArticleSearchScope = "all" | "title" | "author" | "category" | "tags";
type ArticleSortOrder = "recent" | "oldest" | "title-asc" | "title-desc";
type BlogVisualStyle = EditorCategory["visualStyle"];
type ResourceLinkDraft = {
  key: string;
  label: string;
  url: string;
  description: string;
  image: EditorMedia | null;
  imageFile: File | null;
  imagePreview: string;
  openInNewTab: boolean;
  active: boolean;
};

const cmsUrl = String(import.meta.env.PUBLIC_CMS_URL || "http://127.0.0.1:1337").replace(/\/+$/, "");
const api = new BlogAdminApi(cmsUrl);
const state = ref<AppState>("checking");
const activeTab = ref<WorkspaceTab>("posts");
const user = ref<EditorUser | null>(null);
const dashboard = ref<EditorDashboard>({ articles: [], galleries: [], categories: [], settings: {} });
const loading = ref(false);
const errorMessage = ref("");
const notice = ref<{ type: "success" | "error"; message: string } | null>(null);
let noticeTimer: number | undefined;

const loginForm = reactive({ identifier: "", password: "" });
const loginLoading = ref(false);
const loginError = ref("");
const search = ref("");
const searchScope = ref<ArticleSearchScope>("all");
const statusFilter = ref("all");
const categoryFilter = ref("all");
const sortOrder = ref<ArticleSortOrder>("recent");

const editorOpen = ref(false);
const editorLoading = ref(false);
const editorSaving = ref(false);
const editorError = ref("");
const coverFile = ref<File | null>(null);
const coverPreview = ref("");
const attachmentFiles = ref<File[]>([]);
const previewOpen = ref(false);
const localDraftAvailable = ref(false);
const lastAutosavedAt = ref("");
const LOCAL_DRAFT_KEY = "campuslands_blog_editor_local_draft";
let autosaveTimer: number | undefined;

const visualStyleOptions: { value: BlogVisualStyle; label: string; description: string }[] = [
  { value: "ai", label: "Idea + criterio", description: "Órbita de inteligencia artificial" },
  { value: "code", label: "Código en práctica", description: "Editor de programación animado" },
  { value: "community", label: "Aprender juntos", description: "Red colaborativa de campers" },
  { value: "career", label: "Siguiente nivel", description: "Ruta profesional y empleabilidad" },
  { value: "notes", label: "Nueva idea", description: "Plantilla editorial adaptable" },
];

function visualStyleLabel(value?: BlogVisualStyle) {
  return visualStyleOptions.find((option) => option.value === value)?.label || "Nueva idea";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function draftKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyArticle() {
  return {
    documentId: "",
    title: "",
    slug: "",
    excerpt: "",
    content: [] as any[],
    categoryDocumentId: "",
    coverImage: null as EditorMedia | null,
    coverAlt: "",
    coverMode: "category-animation" as "category-animation" | "cover-image",
    authorName: "Equipo Campuslands",
    featured: false,
    readingTime: 5,
    publishDate: today(),
    tagsText: "",
    links: [] as ResourceLinkDraft[],
    attachments: [] as EditorMedia[],
    seo: { metaTitle: "", metaDescription: "", keywords: "" },
  };
}

const articleForm = reactive(emptyArticle());
const newCategory = reactive({ name: "", slug: "", description: "", color: "#2CAAFF", order: 0, visible: true, visualStyle: "notes" as BlogVisualStyle });
const categorySavingId = ref("");
const settingsDraft = reactive<Record<string, any>>({});
const settingsSaving = ref(false);

const settingGroups = [
  {
    title: "Identidad editorial",
    description: "Nombre y lenguaje que identifican la publicación.",
    fields: [
      ["publicationName", "Nombre de la publicación", "input", 80],
      ["eyebrow", "Etiqueta editorial", "input", 100],
      ["heroTitle", "Idea editorial principal", "input", 160],
      ["heroDescription", "Descripción editorial", "textarea", 420],
    ],
  },
  {
    title: "Catálogo y navegación",
    description: "Textos breves utilizados por filtros, destacados y estados vacíos.",
    fields: [
      ["filterLabel", "Título de filtros", "input", 80],
      ["allCategoriesLabel", "Botón para ver todo", "input", 40],
      ["categoryIntro", "Introducción de categorías", "textarea", 320],
      ["featuredLabel", "Etiqueta de destacada", "input", 80],
      ["readArticleLabel", "Acción de lectura", "input", 60],
      ["archiveEyebrow", "Etiqueta del archivo", "input", 80],
      ["archiveTitle", "Título del archivo", "input", 100],
      ["emptyTitle", "Título sin resultados", "input", 140],
      ["emptyDescription", "Descripción sin resultados", "textarea", 320],
      ["emptyButtonLabel", "Botón sin resultados", "input", 40],
    ],
  },
  {
    title: "Lectura y continuidad",
    description: "Mensajes que acompañan el artículo, contenido relacionado y pie editorial.",
    fields: [
      ["footerTitle", "Título del pie del blog", "input", 140],
      ["footerDescription", "Descripción del pie", "textarea", 320],
      ["articleFooterTitle", "Título del pie de artículo", "input", 140],
      ["articleFooterDescription", "Descripción del pie de artículo", "textarea", 320],
      ["contentsLabel", "Etiqueta de contenidos", "input", 60],
      ["tagsLabel", "Etiqueta de temas", "input", 40],
      ["resourcesLabel", "Etiqueta de recursos", "input", 80],
      ["attachmentsLabel", "Etiqueta de archivos", "input", 80],
      ["galleriesLabel", "Etiqueta de galerías", "input", 80],
      ["galleriesTitle", "Título del catálogo de galerías", "input", 120],
      ["galleriesDescription", "Descripción de galerías", "textarea", 320],
      ["viewGalleryLabel", "Acción para abrir galería", "input", 60],
      ["galleryImagesLabel", "Etiqueta de imágenes", "input", 80],
      ["relatedEyebrow", "Etiqueta de relacionados", "input", 80],
      ["relatedTitle", "Título de relacionados", "input", 100],
      ["viewAllLabel", "Acción para ver todo", "input", 60],
    ],
  },
  {
    title: "SEO del catálogo",
    description: "Información principal para Google, redes y sistemas de recomendación.",
    fields: [
      ["seoTitle", "Título SEO", "input", 70],
      ["seoDescription", "Descripción SEO", "textarea", 170],
    ],
  },
] as const;

const articleStats = computed(() => ({
  total: dashboard.value.articles.length,
  published: dashboard.value.articles.filter((article) => article.publicationState === "published").length,
  drafts: dashboard.value.articles.filter((article) => article.publicationState === "draft").length,
  pending: dashboard.value.articles.filter((article) => article.publicationState === "modified").length,
}));

function searchableText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function articleSearchValues(article: EditorArticle) {
  const values: Record<ArticleSearchScope, unknown[]> = {
    all: [
      article.title,
      article.slug,
      article.excerpt,
      article.authorName,
      article.category?.name,
      ...(article.tags || []),
      article.seo?.metaTitle,
      article.seo?.keywords,
    ],
    title: [article.title, article.seo?.metaTitle],
    author: [article.authorName],
    category: [article.category?.name],
    tags: article.tags || [],
  };
  return values[searchScope.value];
}

const filteredArticles = computed(() => {
  const term = searchableText(search.value);
  const articles = dashboard.value.articles.filter((article) => {
    const matchesSearch = !term || articleSearchValues(article)
      .some((value) => searchableText(value).includes(term));
    const matchesStatus = statusFilter.value === "all" || article.publicationState === statusFilter.value;
    const matchesCategory = categoryFilter.value === "all" || article.category?.documentId === categoryFilter.value;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return [...articles].sort((first, second) => {
    if (sortOrder.value === "title-asc") return first.title.localeCompare(second.title, "es", { sensitivity: "base" });
    if (sortOrder.value === "title-desc") return second.title.localeCompare(first.title, "es", { sensitivity: "base" });
    const firstDate = new Date(first.publishDate || first.updatedAt || 0).getTime();
    const secondDate = new Date(second.publishDate || second.updatedAt || 0).getTime();
    return sortOrder.value === "oldest" ? firstDate - secondDate : secondDate - firstDate;
  });
});

const hasActiveArticleFilters = computed(() => Boolean(
  search.value.trim()
  || searchScope.value !== "all"
  || statusFilter.value !== "all"
  || categoryFilter.value !== "all"
  || sortOrder.value !== "recent",
));

const articleSearchPlaceholder = computed(() => ({
  all: "Buscar por título, autor, categoría, etiqueta o slug",
  title: "Escribe el título de la nota",
  author: "Escribe el nombre del autor",
  category: "Escribe el nombre de la categoría",
  tags: "Escribe una etiqueta",
}[searchScope.value]));

function clearArticleFilters() {
  search.value = "";
  searchScope.value = "all";
  statusFilter.value = "all";
  categoryFilter.value = "all";
  sortOrder.value = "recent";
}

function collectText(value: any): string[] {
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!value || typeof value !== "object") return typeof value === "string" ? [value] : [];
  return [value.text, value.title, value.label, value.caption, value.description]
    .filter((item) => typeof item === "string")
    .concat(Object.entries(value).filter(([key]) => !["text", "title", "label", "caption", "description", "url"].includes(key)).flatMap(([, item]) => collectText(item)));
}

const articleWordCount = computed(() => collectText(articleForm.content).join(" ").trim().split(/\s+/).filter(Boolean).length);
const suggestedReadingTime = computed(() => Math.max(1, Math.ceil(articleWordCount.value / 200)));
const previewHtml = computed(() => renderBlogBlocks(articleForm.content as any[]));
const selectedCategory = computed(() => dashboard.value.categories.find((category) => category.documentId === articleForm.categoryDocumentId));
const activeLinks = computed(() => articleForm.links.filter((link) => link.active && link.label.trim() && link.url.trim()));
const visibleStoredAttachments = computed(() => articleForm.attachments.filter((attachment) => (
  Number(attachment.id) !== Number(articleForm.coverImage?.id)
)));
const visibleAttachmentFiles = computed(() => {
  if (!coverFile.value) return attachmentFiles.value;
  const coverKey = `${coverFile.value.name}:${coverFile.value.size}:${coverFile.value.lastModified}`;
  return attachmentFiles.value.filter((file) => `${file.name}:${file.size}:${file.lastModified}` !== coverKey);
});
const editorialChecks = computed(() => [
  { label: "Título claro (35–65 caracteres)", ok: articleForm.title.trim().length >= 35 && articleForm.title.trim().length <= 65 },
  { label: "Resumen completo", ok: articleForm.excerpt.trim().length >= 90 },
  { label: "Contenido desarrollado", ok: articleWordCount.value >= 250 || activeLinks.value.length > 0 },
  { label: "Visual de portada configurado", ok: articleForm.coverMode === "category-animation" || Boolean(coverPreview.value && articleForm.coverAlt.trim()) },
  { label: "Jerarquía con al menos un H2", ok: articleForm.content.some((block: any) => block.type === "heading" && Number(block.level) === 2) },
  { label: "SEO listo para publicar", ok: articleForm.seo.metaTitle.trim().length >= 30 && articleForm.seo.metaDescription.trim().length >= 120 },
]);
const editorialScore = computed(() => Math.round((editorialChecks.value.filter((check) => check.ok).length / editorialChecks.value.length) * 100));

function showNotice(message: string, type: "success" | "error" = "success") {
  notice.value = { message, type };
  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { notice.value = null; }, 4200);
}

function formatDate(value?: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function statusMeta(status?: string) {
  if (status === "published") return { label: "Publicado", className: "is-published" };
  if (status === "modified") return { label: "Cambios pendientes", className: "is-modified" };
  return { label: "Borrador", className: "is-draft" };
}

async function restoreSession() {
  const token = sessionStorage.getItem(BLOG_EDITOR_STORAGE_KEY) || "";
  if (!token) {
    state.value = "login";
    return;
  }
  api.setToken(token);
  try {
    user.value = await api.session();
    state.value = "workspace";
    await loadDashboard();
  } catch {
    sessionStorage.removeItem(BLOG_EDITOR_STORAGE_KEY);
    api.setToken("");
    state.value = "login";
  }
}

async function login() {
  loginError.value = "";
  loginLoading.value = true;
  try {
    const response = await api.login(loginForm.identifier.trim(), loginForm.password);
    sessionStorage.setItem(BLOG_EDITOR_STORAGE_KEY, response.jwt);
    user.value = await api.session();
    loginForm.password = "";
    state.value = "workspace";
    await loadDashboard();
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : "No fue posible iniciar sesión.";
  } finally {
    loginLoading.value = false;
  }
}

function logout() {
  sessionStorage.removeItem(BLOG_EDITOR_STORAGE_KEY);
  api.setToken("");
  user.value = null;
  dashboard.value = { articles: [], galleries: [], categories: [], settings: {} };
  state.value = "login";
  editorOpen.value = false;
}

async function loadDashboard(silent = false) {
  if (!silent) loading.value = true;
  errorMessage.value = "";
  try {
    dashboard.value = await api.dashboard();
    Object.keys(settingsDraft).forEach((key) => delete settingsDraft[key]);
    Object.assign(settingsDraft, dashboard.value.settings || {});
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401 || status === 403) return logout();
    errorMessage.value = error instanceof Error ? error.message : "No se pudo cargar el contenido.";
  } finally {
    loading.value = false;
  }
}

function resetArticleForm() {
  articleForm.links.forEach((link) => {
    if (link.imagePreview.startsWith("blob:")) URL.revokeObjectURL(link.imagePreview);
  });
  Object.assign(articleForm, emptyArticle());
  coverFile.value = null;
  attachmentFiles.value = [];
  previewOpen.value = false;
  if (coverPreview.value.startsWith("blob:")) URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = "";
  editorError.value = "";
}

function newArticle() {
  resetArticleForm();
  editorOpen.value = true;
  localDraftAvailable.value = Boolean(localStorage.getItem(LOCAL_DRAFT_KEY));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyArticleDetail(detail: EditorArticle, asCopy = false) {
  Object.assign(articleForm, {
    documentId: asCopy ? "" : detail.documentId,
    title: asCopy ? `Copia de ${detail.title || "publicación"}`.slice(0, 140) : detail.title || "",
    slug: asCopy ? `${detail.slug || slugify(detail.title || "publicacion")}-copia`.slice(0, 140) : detail.slug || "",
    excerpt: detail.excerpt || "",
    content: JSON.parse(JSON.stringify(detail.content || [])),
    categoryDocumentId: detail.category?.documentId || "",
    coverImage: detail.coverImage || null,
    coverAlt: detail.coverAlt || "",
    coverMode: detail.coverMode || (detail.coverImage ? "cover-image" : "category-animation"),
    authorName: detail.authorName || "Equipo Campuslands",
    featured: asCopy ? false : Boolean(detail.featured),
    readingTime: detail.readingTime || 5,
    publishDate: asCopy ? today() : detail.publishDate || today(),
    tagsText: Array.isArray(detail.tags) ? detail.tags.join(", ") : "",
    links: (detail.links || []).map((link) => ({
      key: draftKey(),
      label: link.label || "", url: link.url || "", description: link.description || "",
      image: link.image || null, imageFile: null,
      imagePreview: mediaUrl(cmsUrl, link.image),
      openInNewTab: Boolean(link.openInNewTab), active: link.active !== false,
    })),
    attachments: [...(detail.attachments || [])],
    seo: {
      metaTitle: asCopy ? `Copia de ${detail.seo?.metaTitle || detail.title || ""}`.slice(0, 60) : detail.seo?.metaTitle || "",
      metaDescription: detail.seo?.metaDescription || "",
      keywords: detail.seo?.keywords || "",
    },
  });
  coverFile.value = null;
  attachmentFiles.value = [];
  coverPreview.value = mediaUrl(cmsUrl, detail.coverImage);
}

async function editArticle(article: EditorArticle) {
  editorOpen.value = true;
  editorLoading.value = true;
  editorError.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    const detail = await api.article(article.documentId);
    applyArticleDetail(detail);
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : "No se pudo abrir la publicación.";
  } finally {
    editorLoading.value = false;
  }
}

async function duplicateArticle(article: EditorArticle) {
  editorOpen.value = true;
  editorLoading.value = true;
  editorError.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    const detail = await api.article(article.documentId);
    applyArticleDetail(detail, true);
    showNotice("La publicación se cargó como una copia nueva. Revisa título, slug y fecha antes de publicar.");
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : "No se pudo duplicar la publicación.";
  } finally {
    editorLoading.value = false;
  }
}

function restoreLocalDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) || "{}");
    if (!saved?.article) return;
    Object.assign(articleForm, saved.article);
    articleForm.documentId = saved.article.documentId || "";
    articleForm.links = Array.isArray(saved.article.links) ? saved.article.links.map((link: any) => ({
      key: link.key || draftKey(),
      label: link.label || "",
      url: link.url || "",
      description: link.description || "",
      image: link.image || null,
      imageFile: null,
      imagePreview: mediaUrl(cmsUrl, link.image),
      openInNewTab: link.openInNewTab !== false,
      active: link.active !== false,
    })) : [];
    coverPreview.value = mediaUrl(cmsUrl, articleForm.coverImage);
    localDraftAvailable.value = false;
    showNotice("Borrador local recuperado.");
  } catch {
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    localDraftAvailable.value = false;
  }
}

function closeEditor() {
  editorOpen.value = false;
  resetArticleForm();
}

function titleChanged() {
  if (!articleForm.documentId || !articleForm.slug) articleForm.slug = slugify(articleForm.title);
  if (!articleForm.seo.metaTitle) articleForm.seo.metaTitle = articleForm.title.slice(0, 60);
}

function chooseCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (coverPreview.value.startsWith("blob:")) URL.revokeObjectURL(coverPreview.value);
  coverFile.value = file;
  attachmentFiles.value = attachmentFiles.value.filter((attachment) => (
    `${attachment.name}:${attachment.size}:${attachment.lastModified}` !== `${file.name}:${file.size}:${file.lastModified}`
  ));
  coverPreview.value = URL.createObjectURL(file);
  if (!articleForm.coverAlt) articleForm.coverAlt = `Portada de ${articleForm.title || "la publicación"}`;
}

function removeCover() {
  if (coverPreview.value.startsWith("blob:")) URL.revokeObjectURL(coverPreview.value);
  coverFile.value = null;
  coverPreview.value = "";
  articleForm.coverImage = null;
}

async function uploadInlineImage(file: File) {
  return api.upload(file);
}

function addResourceLink() {
  articleForm.links.push({
    key: draftKey(), label: "", url: "", description: "", image: null,
    imageFile: null, imagePreview: "", openInNewTab: true, active: true,
  });
}

function removeResourceLink(index: number) {
  const preview = articleForm.links[index]?.imagePreview || "";
  if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  articleForm.links.splice(index, 1);
}

function chooseResourceImage(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  input.value = "";
  if (!file) return;
  const link = articleForm.links[index];
  if (!link) return;
  if (link.imagePreview.startsWith("blob:")) URL.revokeObjectURL(link.imagePreview);
  link.imageFile = file;
  link.imagePreview = URL.createObjectURL(file);
}

function removeResourceImage(index: number) {
  const link = articleForm.links[index];
  if (!link) return;
  if (link.imagePreview.startsWith("blob:")) URL.revokeObjectURL(link.imagePreview);
  link.image = null;
  link.imageFile = null;
  link.imagePreview = "";
}

function chooseAttachments(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files || []);
  input.value = "";
  if (!selected.length) return;
  const known = new Set(attachmentFiles.value.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const coverKey = coverFile.value
    ? `${coverFile.value.name}:${coverFile.value.size}:${coverFile.value.lastModified}`
    : "";
  attachmentFiles.value.push(...selected.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    return key !== coverKey && !known.has(key);
  }));
}

function removePendingAttachment(index: number) {
  attachmentFiles.value.splice(index, 1);
}

function removeStoredAttachment(index: number) {
  articleForm.attachments.splice(index, 1);
}

function attachmentLabel(media: EditorMedia) {
  return media.name || media.url.split("/").pop() || "Archivo adjunto";
}

function useSuggestedReadingTime() {
  articleForm.readingTime = suggestedReadingTime.value;
}

function validateArticle() {
  if (!articleForm.title.trim()) return "Agrega el título de la publicación.";
  if (!articleForm.slug.trim()) return "Agrega el slug de la publicación.";
  if (!articleForm.excerpt.trim()) return "Agrega un resumen para el catálogo.";
  if (!articleForm.categoryDocumentId) return "Selecciona una categoría.";
  if (!articleForm.content.length && !activeLinks.value.length) return "Agrega contenido o al menos un recurso activo.";
  if (!articleForm.seo.metaTitle.trim()) return "Agrega el título SEO.";
  if (!articleForm.seo.metaDescription.trim()) return "Agrega la descripción SEO.";
  return "";
}

async function saveArticle(publish: boolean) {
  editorError.value = validateArticle();
  if (editorError.value) return;
  editorSaving.value = true;
  try {
    let cover = articleForm.coverImage;
    if (coverFile.value) cover = await api.upload(coverFile.value);
    const uploadedAttachments = attachmentFiles.value.length ? await api.uploadMany(attachmentFiles.value) : [];
    const attachments = [...articleForm.attachments, ...uploadedAttachments]
      .filter((attachment) => Number(attachment.id) !== Number(cover?.id));
    const links = await Promise.all(articleForm.links.map(async (link) => {
      const image = link.imageFile ? await api.upload(link.imageFile) : link.image;
      return {
        label: link.label,
        url: link.url,
        description: link.description,
        image,
        openInNewTab: link.openInNewTab,
        active: link.active,
      };
    }));
    const data = {
      title: articleForm.title,
      slug: slugify(articleForm.slug),
      excerpt: articleForm.excerpt,
      content: articleForm.content,
      categoryDocumentId: articleForm.categoryDocumentId,
      coverImageId: cover?.id || null,
      coverAlt: articleForm.coverAlt,
      coverMode: articleForm.coverMode,
      authorName: articleForm.authorName,
      featured: articleForm.featured,
      readingTime: articleForm.readingTime,
      publishDate: articleForm.publishDate,
      tags: articleForm.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      links,
      attachmentIds: attachments.map((attachment) => attachment.id),
      seo: {
        ...articleForm.seo,
        shareImageId: cover?.id || null,
      },
    };
    if (articleForm.documentId) await api.updateArticle(articleForm.documentId, data, publish);
    else await api.createArticle(data, publish);
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    localDraftAvailable.value = false;
    await loadDashboard(true);
    closeEditor();
    showNotice(publish ? "Publicación guardada y publicada." : "Borrador guardado correctamente.");
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : "No fue posible guardar la publicación.";
  } finally {
    editorSaving.value = false;
  }
}

async function quickPublish(article: EditorArticle) {
  try {
    await api.publishArticle(article.documentId);
    await loadDashboard(true);
    showNotice("La publicación ya está disponible en el blog.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo publicar.", "error");
  }
}

async function quickUnpublish(article: EditorArticle) {
  if (!window.confirm(`¿Retirar “${article.title}” del blog público? El contenido seguirá guardado como borrador.`)) return;
  try {
    await api.unpublishArticle(article.documentId);
    await loadDashboard(true);
    showNotice("La publicación fue retirada y permanece como borrador.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo retirar.", "error");
  }
}

async function removeArticle(article: EditorArticle) {
  if (!window.confirm(`Eliminar definitivamente “${article.title}”? Esta acción no se puede deshacer.`)) return;
  try {
    await api.deleteArticle(article.documentId);
    await loadDashboard(true);
    showNotice("La publicación fue eliminada.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo eliminar.", "error");
  }
}

function articlePublicUrl(article: EditorArticle) {
  return `/blog/${article.slug}/`;
}

async function saveCategory(category: Partial<EditorCategory>, create = false) {
  const key = create ? "new" : String(category.documentId);
  categorySavingId.value = key;
  try {
    if (create) {
      await api.createCategory(category);
      Object.assign(newCategory, { name: "", slug: "", description: "", color: "#2CAAFF", order: dashboard.value.categories.length + 1, visible: true, visualStyle: "notes" });
    } else if (category.documentId) {
      await api.updateCategory(category.documentId, category);
    }
    await loadDashboard(true);
    showNotice(create ? "Categoría creada." : "Categoría actualizada.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo guardar la categoría.", "error");
  } finally {
    categorySavingId.value = "";
  }
}

async function removeCategory(category: EditorCategory) {
  if (!window.confirm(`¿Eliminar la categoría “${category.name}”?`)) return;
  try {
    await api.deleteCategory(category.documentId);
    await loadDashboard(true);
    showNotice("Categoría eliminada.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo eliminar la categoría.", "error");
  }
}

async function saveSettings() {
  settingsSaving.value = true;
  try {
    await api.updateSettings(settingsDraft);
    await loadDashboard(true);
    showNotice("Identidad y textos editoriales actualizados.");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo guardar la configuración.", "error");
  } finally {
    settingsSaving.value = false;
  }
}

function selectTab(tab: WorkspaceTab) {
  activeTab.value = tab;
  editorOpen.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

watch(articleForm, () => {
  if (!editorOpen.value || editorLoading.value) return;
  if (autosaveTimer) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), article: articleForm }));
      lastAutosavedAt.value = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    } catch {
      // El guardado principal continúa disponible aunque el navegador bloquee el almacenamiento local.
    }
  }, 900);
}, { deep: true });

onMounted(() => {
  localDraftAvailable.value = Boolean(localStorage.getItem(LOCAL_DRAFT_KEY));
  restoreSession();
});
onBeforeUnmount(() => {
  if (noticeTimer) window.clearTimeout(noticeTimer);
  if (autosaveTimer) window.clearTimeout(autosaveTimer);
  if (coverPreview.value.startsWith("blob:")) URL.revokeObjectURL(coverPreview.value);
  articleForm.links.forEach((link) => {
    if (link.imagePreview.startsWith("blob:")) URL.revokeObjectURL(link.imagePreview);
  });
});
</script>

<template>
  <div class="editor-app">
    <div class="editor-atmosphere" aria-hidden="true"><span></span><span></span><span></span></div>

    <section v-if="state === 'checking'" class="state-screen" aria-live="polite">
      <div class="state-orbit"><i></i></div>
      <p>ABRIENDO MESA EDITORIAL</p>
    </section>

    <main v-else-if="state === 'login'" class="login-shell">
      <section class="login-brand">
        <a href="/blog/" class="brand-mark" aria-label="Volver a Pulso Campuslands">
          <span></span><strong>PULSO</strong><small>CAMPUSLANDS</small>
        </a>
        <div class="login-brand__copy">
          <p>CONTROL EDITORIAL / 01</p>
          <h1>Las ideas entran aquí.<br /><span>Salen listas para circular.</span></h1>
          <p class="login-brand__description">Una mesa de trabajo propia para crear, revisar y publicar el contenido de Campuslands.</p>
        </div>
        <div class="login-brand__signal" aria-hidden="true"><b>draft</b><i></i><b>review</b><i></i><b>publish</b></div>
      </section>

      <section class="login-panel" aria-labelledby="login-title">
        <div class="login-panel__top"><span>ACCESO PRIVADO</span><i></i></div>
        <h2 id="login-title">Mesa editorial</h2>
        <p>Ingresa con tu cuenta de editor de Pulso Campuslands.</p>
        <form @submit.prevent="login">
          <label>
            <span>Correo editorial</span>
            <input v-model="loginForm.identifier" type="email" autocomplete="username" placeholder="editor@campuslands.com" required />
          </label>
          <label>
            <span>Contraseña</span>
            <input v-model="loginForm.password" type="password" autocomplete="current-password" placeholder="••••••••••••" required />
          </label>
          <p v-if="loginError" class="form-error" role="alert">{{ loginError }}</p>
          <button type="submit" class="primary-action" :disabled="loginLoading">
            <span>{{ loginLoading ? "Verificando…" : "Entrar al editor" }}</span><b>→</b>
          </button>
        </form>
        <a href="/blog/" class="back-public">← Volver al blog público</a>
      </section>
    </main>

    <div v-else class="workspace-shell">
      <aside class="workspace-sidebar">
        <a href="/blog/" class="brand-mark brand-mark--compact" aria-label="Abrir Pulso Campuslands">
          <span></span><strong>PULSO</strong><small>CAMPUSLANDS</small>
        </a>
        <nav aria-label="Administración editorial">
          <button :class="{ active: activeTab === 'posts' }" @click="selectTab('posts')"><b>01</b><span>Publicaciones</span><i>{{ articleStats.total }}</i></button>
          <button :class="{ active: activeTab === 'galleries' }" @click="selectTab('galleries')"><b>02</b><span>Galerías</span><i>{{ dashboard.galleries.length }}</i></button>
          <button :class="{ active: activeTab === 'categories' }" @click="selectTab('categories')"><b>03</b><span>Categorías</span><i>{{ dashboard.categories.length }}</i></button>
          <button :class="{ active: activeTab === 'academy' }" @click="selectTab('academy')"><b>04</b><span>AI Academy</span><i>✦</i></button>
          <button :class="{ active: activeTab === 'settings' }" @click="selectTab('settings')"><b>05</b><span>Identidad y SEO</span><i>↗</i></button>
        </nav>
        <div class="workspace-sidebar__bottom">
          <a href="/ai-academy/" target="_blank" rel="noopener">Ver AI Academy ↗</a>
          <a href="/blog/" target="_blank" rel="noopener">Ver blog público ↗</a>
          <div><span>{{ user?.username }}</span><small>{{ user?.email }}</small></div>
          <button @click="logout">Cerrar sesión</button>
        </div>
      </aside>

      <header class="mobile-admin-bar">
        <div class="brand-mark brand-mark--compact"><span></span><strong>PULSO</strong></div>
        <select :value="activeTab" aria-label="Sección administrativa" @change="selectTab(($event.target as HTMLSelectElement).value as WorkspaceTab)">
          <option value="posts">Publicaciones</option>
          <option value="galleries">Galerías</option>
          <option value="categories">Categorías</option>
          <option value="academy">AI Academy</option>
          <option value="settings">Identidad y SEO</option>
        </select>
        <button aria-label="Cerrar sesión" @click="logout">↪</button>
      </header>

      <main class="workspace-main">
        <div v-if="notice" class="notice" :class="`notice--${notice.type}`" role="status"><span></span>{{ notice.message }}</div>

        <section v-if="loading" class="workspace-loading" aria-live="polite"><i></i><p>Sincronizando contenido editorial…</p></section>
        <section v-else-if="errorMessage" class="workspace-error"><span>!</span><h1>No pudimos cargar la mesa editorial.</h1><p>{{ errorMessage }}</p><button @click="loadDashboard()">Intentar de nuevo</button></section>

        <template v-else-if="activeTab === 'posts'">
          <section v-if="editorOpen" class="article-editor">
            <header class="page-heading page-heading--editor">
              <div><button class="back-button" @click="closeEditor">← Publicaciones</button><p>DOCUMENTO EDITORIAL</p><h1>{{ articleForm.documentId ? "Editar publicación" : "Nueva publicación" }}</h1></div>
              <div class="editor-actions">
                <button class="secondary-action" type="button" @click="previewOpen = true">Vista previa</button>
                <button class="secondary-action" :disabled="editorSaving" @click="saveArticle(false)">{{ editorSaving ? "Guardando…" : "Guardar borrador" }}</button>
                <button class="primary-action primary-action--small" :disabled="editorSaving" @click="saveArticle(true)"><span>{{ editorSaving ? "Procesando…" : "Publicar" }}</span><b>↑</b></button>
              </div>
            </header>

            <div class="editor-status-line">
              <button v-if="localDraftAvailable && !articleForm.documentId" type="button" @click="restoreLocalDraft">Recuperar borrador guardado en este navegador</button>
              <span v-if="lastAutosavedAt">Respaldo local actualizado a las {{ lastAutosavedAt }}</span>
            </div>

            <p v-if="editorError" class="form-error form-error--wide" role="alert">{{ editorError }}</p>
            <div v-if="editorLoading" class="editor-loading">Cargando documento…</div>
            <form v-else class="editor-layout" @submit.prevent="saveArticle(false)">
              <div class="editor-canvas">
                <section class="form-section form-section--lead">
                  <div class="section-label"><span>01</span><div><h2>La idea central</h2><p>Lo que verá la audiencia antes de abrir la publicación.</p></div></div>
                  <label class="field field--title"><span>Título</span><textarea v-model="articleForm.title" rows="2" maxlength="140" placeholder="Escribe un título claro y útil" required @input="titleChanged"></textarea><small>{{ articleForm.title.length }}/140</small></label>
                  <label class="field"><span>Slug público</span><div class="slug-field"><b>/blog/</b><input v-model="articleForm.slug" maxlength="140" required @blur="articleForm.slug = slugify(articleForm.slug)" /><i>/</i></div></label>
                  <label class="field"><span>Resumen</span><textarea v-model="articleForm.excerpt" rows="4" maxlength="320" placeholder="Resume la promesa de lectura en dos frases" required></textarea><small>{{ articleForm.excerpt.length }}/320</small></label>
                </section>

                <section class="form-section">
                  <div class="section-label"><span>02</span><div><h2>Contenido</h2><p>Construye la publicación con bloques reordenables y formato editorial.</p></div></div>
                  <BlockEditor v-model="articleForm.content" :upload-image="uploadInlineImage" :media-base-url="cmsUrl" />
                </section>

                <section class="form-section">
                  <div class="section-label"><span>03</span><div><h2>Recursos y llamadas a la acción</h2><p>Agrega enlaces útiles, inscripciones, descargas o referencias al final de la publicación.</p></div></div>
                  <div class="resource-editor">
                    <article v-for="(link, index) in articleForm.links" :key="link.key" class="resource-editor__row">
                      <span>{{ String(index + 1).padStart(2, "0") }}</span>
                      <div class="resource-editor__body">
                        <div class="resource-image-field">
                          <label :class="{ 'has-image': link.imagePreview }">
                            <img v-if="link.imagePreview" :src="link.imagePreview" :alt="link.label || 'Imagen del enlace'" />
                            <span v-else><b>＋</b> Imagen del enlace</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" @change="chooseResourceImage(index, $event)" />
                          </label>
                          <button v-if="link.imagePreview" type="button" @click="removeResourceImage(index)">Quitar imagen</button>
                        </div>
                        <div class="field-grid">
                          <label class="field"><span>Nombre visible</span><input v-model="link.label" maxlength="120" placeholder="Descargar plantilla" /></label>
                          <label class="field"><span>URL</span><input v-model="link.url" placeholder="https://… o /ruta/" /></label>
                          <label class="field field--full"><span>Descripción</span><input v-model="link.description" maxlength="180" placeholder="Explica qué encontrará la persona" /></label>
                        </div>
                      </div>
                      <div class="resource-editor__controls">
                        <label><input v-model="link.active" type="checkbox" /> Activo</label>
                        <label><input v-model="link.openInNewTab" type="checkbox" /> Nueva pestaña</label>
                        <button type="button" @click="removeResourceLink(index)">Eliminar</button>
                      </div>
                    </article>
                    <button type="button" class="resource-add" @click="addResourceLink">＋ Agregar recurso o llamada a la acción</button>
                  </div>
                </section>

                <section class="form-section">
                  <div class="section-label"><span>04</span><div><h2>Posicionamiento</h2><p>Cómo se presenta la nota en búsquedas, redes y asistentes.</p></div></div>
                  <div class="field-grid">
                    <label class="field field--full"><span>Título SEO</span><input v-model="articleForm.seo.metaTitle" maxlength="60" required /><small :class="{ warning: articleForm.seo.metaTitle.length > 58 }">{{ articleForm.seo.metaTitle.length }}/60</small></label>
                    <label class="field field--full"><span>Descripción SEO</span><textarea v-model="articleForm.seo.metaDescription" rows="4" maxlength="160" required></textarea><small :class="{ warning: articleForm.seo.metaDescription.length > 155 }">{{ articleForm.seo.metaDescription.length }}/160</small></label>
                    <label class="field field--full"><span>Palabras clave</span><input v-model="articleForm.seo.keywords" placeholder="IA aplicada, automatización, productividad" /><small>Separadas por coma</small></label>
                  </div>
                  <article class="search-preview">
                    <span>VISTA PREVIA EN BUSCADOR</span>
                    <h3>{{ articleForm.seo.metaTitle || articleForm.title || "Título de la publicación" }}</h3>
                    <p>https://www.campuslands.pro/blog/{{ articleForm.slug || "slug-de-la-publicacion" }}/</p>
                    <div>{{ articleForm.seo.metaDescription || articleForm.excerpt || "La descripción SEO aparecerá aquí." }}</div>
                  </article>
                </section>
              </div>

              <aside class="editor-inspector">
                <section class="inspector-card">
                  <div class="inspector-card__title"><span>PUBLICACIÓN</span><i></i></div>
                  <label class="field"><span>Categoría</span><select v-model="articleForm.categoryDocumentId" required><option value="" disabled>Seleccionar</option><option v-for="category in dashboard.categories" :key="category.documentId" :value="category.documentId">{{ category.name }}</option></select></label>
                  <div class="field-grid field-grid--two">
                    <label class="field"><span>Fecha</span><input v-model="articleForm.publishDate" type="date" required /></label>
                    <label class="field"><span>Lectura</span><div class="number-field"><input v-model.number="articleForm.readingTime" type="number" min="1" max="120" /><b>min</b></div></label>
                  </div>
                  <button type="button" class="reading-suggestion" @click="useSuggestedReadingTime">Usar cálculo editorial: {{ suggestedReadingTime }} min</button>
                  <label class="field"><span>Autor</span><input v-model="articleForm.authorName" maxlength="100" required /></label>
                  <label class="switch-field"><input v-model="articleForm.featured" type="checkbox" /><span><i></i></span><div><strong>Publicación destacada</strong><small>La tarjeta llevará una señal especial.</small></div></label>
                </section>

                <section class="inspector-card">
                  <div class="inspector-card__title"><span>PORTADA</span><i></i></div>
                  <div class="cover-mode" role="radiogroup" aria-label="Visual de la publicación">
                    <label :class="{ active: articleForm.coverMode === 'category-animation' }">
                      <input v-model="articleForm.coverMode" type="radio" value="category-animation" />
                      <span><strong>Animación de categoría</strong><small>{{ selectedCategory?.name || "Selecciona una categoría" }} · {{ visualStyleLabel(selectedCategory?.visualStyle) }}</small></span>
                    </label>
                    <label :class="{ active: articleForm.coverMode === 'cover-image' }">
                      <input v-model="articleForm.coverMode" type="radio" value="cover-image" />
                      <span><strong>Imagen de portada</strong><small>Usa la fotografía cargada en la tarjeta y la nota.</small></span>
                    </label>
                  </div>
                  <label class="cover-drop" :class="{ 'has-image': coverPreview }">
                    <img v-if="coverPreview" :src="coverPreview" alt="Vista previa de portada" />
                    <template v-else><b>＋</b><strong>Cargar imagen</strong><small>JPG, PNG, WebP o AVIF · máx. 10 MB</small></template>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" @change="chooseCover" />
                  </label>
                  <button v-if="coverPreview" type="button" class="text-action text-action--danger" @click="removeCover">Quitar portada</button>
                  <label class="field"><span>Texto alternativo</span><textarea v-model="articleForm.coverAlt" rows="3" maxlength="160" placeholder="Describe la imagen para accesibilidad"></textarea></label>
                </section>

                <section class="inspector-card">
                  <div class="inspector-card__title"><span>TEMAS</span><i></i></div>
                  <label class="field"><span>Etiquetas</span><textarea v-model="articleForm.tagsText" rows="4" placeholder="programación, aprendizaje, proyectos"></textarea><small>Separadas por coma</small></label>
                </section>

                <section class="inspector-card">
                  <div class="inspector-card__title"><span>ARCHIVOS ADJUNTOS</span><i></i></div>
                  <label class="attachment-drop">＋ Seleccionar archivos<input type="file" multiple @change="chooseAttachments" /></label>
                  <div v-if="visibleStoredAttachments.length || visibleAttachmentFiles.length" class="attachment-list">
                    <article v-for="attachment in visibleStoredAttachments" :key="`stored-${attachment.id}`"><span>✓</span><div><strong>{{ attachmentLabel(attachment) }}</strong><small>Ya cargado</small></div><button type="button" aria-label="Quitar archivo" @click="removeStoredAttachment(articleForm.attachments.indexOf(attachment))">×</button></article>
                    <article v-for="file in visibleAttachmentFiles" :key="`new-${file.name}-${file.lastModified}`"><span>↑</span><div><strong>{{ file.name }}</strong><small>{{ Math.max(1, Math.round(file.size / 1024)) }} KB · se subirá al guardar</small></div><button type="button" aria-label="Quitar archivo" @click="removePendingAttachment(attachmentFiles.indexOf(file))">×</button></article>
                  </div>
                  <p v-else class="attachment-empty">Puedes adjuntar PDF, hojas de cálculo, presentaciones, imágenes, audio o video.</p>
                </section>

                <section class="inspector-card quality-card">
                  <div class="inspector-card__title"><span>CONTROL EDITORIAL</span><i></i><b>{{ editorialScore }}%</b></div>
                  <div class="quality-meter"><i :style="`width:${editorialScore}%`"></i></div>
                  <div class="quality-stats"><strong>{{ articleWordCount }}</strong><span>palabras</span><strong>{{ articleForm.content.length }}</strong><span>bloques</span></div>
                  <ul><li v-for="check in editorialChecks" :key="check.label" :class="{ done: check.ok }"><span>{{ check.ok ? "✓" : "○" }}</span>{{ check.label }}</li></ul>
                </section>

                <div class="mobile-save-actions">
                  <button type="button" class="secondary-action" @click="previewOpen = true">Vista previa</button>
                  <button type="button" class="secondary-action" :disabled="editorSaving" @click="saveArticle(false)">Guardar borrador</button>
                  <button type="button" class="primary-action primary-action--small" :disabled="editorSaving" @click="saveArticle(true)"><span>Publicar</span><b>↑</b></button>
                </div>
              </aside>
            </form>
          </section>

          <section v-else>
            <header class="page-heading">
              <div><p>PULSO / PUBLICACIONES</p><h1>Mesa de contenido</h1><span>Crea, revisa y decide qué ideas salen a circulación.</span></div>
              <button class="primary-action primary-action--small" @click="newArticle"><span>Nueva publicación</span><b>＋</b></button>
            </header>

            <div class="stat-grid">
              <article><span>01 / TOTAL</span><strong>{{ articleStats.total.toString().padStart(2, "0") }}</strong><i></i></article>
              <article><span>02 / PUBLICADAS</span><strong>{{ articleStats.published.toString().padStart(2, "0") }}</strong><i></i></article>
              <article><span>03 / BORRADORES</span><strong>{{ articleStats.drafts.toString().padStart(2, "0") }}</strong><i></i></article>
              <article><span>04 / POR REPUBLICAR</span><strong>{{ articleStats.pending.toString().padStart(2, "0") }}</strong><i></i></article>
            </div>

            <section class="content-console">
              <div class="console-filters">
                <label class="search-field">
                  <span class="search-field__icon" aria-hidden="true">⌕</span>
                  <span class="sr-only">Buscar publicaciones</span>
                  <input v-model="search" type="search" :placeholder="articleSearchPlaceholder" autocomplete="off" />
                  <button v-if="search" type="button" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" @click="search = ''">×</button>
                </label>
                <select v-model="searchScope" aria-label="Campo de búsqueda">
                  <option value="all">Buscar en todo</option>
                  <option value="title">Buscar por título</option>
                  <option value="author">Buscar por autor</option>
                  <option value="category">Buscar por categoría</option>
                  <option value="tags">Buscar por etiqueta</option>
                </select>
                <select v-model="statusFilter" aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="published">Publicadas</option><option value="draft">Borradores</option><option value="modified">Cambios pendientes</option></select>
                <select v-model="categoryFilter" aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option><option v-for="category in dashboard.categories" :key="category.documentId" :value="category.documentId">{{ category.name }}</option></select>
                <select v-model="sortOrder" aria-label="Ordenar publicaciones"><option value="recent">Más recientes</option><option value="oldest">Más antiguas</option><option value="title-asc">Título A–Z</option><option value="title-desc">Título Z–A</option></select>
                <span class="result-count">{{ filteredArticles.length }} {{ filteredArticles.length === 1 ? "resultado" : "resultados" }}</span>
              </div>

              <div v-if="filteredArticles.length" class="article-list">
                <article v-for="(article, index) in filteredArticles" :key="article.documentId" class="article-row" :style="`--category:${article.category?.color || '#2CAAFF'}`">
                  <button class="article-row__main" :aria-label="`Editar la nota ${article.title}`" @click="editArticle(article)">
                    <span class="article-index">{{ String(index + 1).padStart(2, "0") }}</span>
                    <span class="article-category"><i></i>{{ article.category?.name || "Sin categoría" }}</span>
                    <span class="article-title-label">Título de la nota</span>
                    <strong>{{ article.title || "Nota sin título" }}</strong>
                    <small>{{ article.excerpt || "Esta nota todavía no tiene un resumen editorial." }}</small>
                    <span class="article-facts">
                      <span><b>Autor</b>{{ article.authorName || "Sin autor" }}</span>
                      <span><b>Ruta</b>/blog/{{ article.slug }}/</span>
                      <span v-if="article.tags?.length"><b>Etiquetas</b>{{ article.tags.slice(0, 3).join(" · ") }}</span>
                    </span>
                  </button>
                  <div class="article-row__meta">
                    <span class="status-pill" :class="statusMeta(article.publicationState).className">{{ statusMeta(article.publicationState).label }}</span>
                    <span><b>Publicación</b>{{ formatDate(article.publishDate) }}</span>
                    <span><b>Actualización</b>{{ formatDate(article.updatedAt) }}</span>
                    <span><b>Lectura</b>{{ article.readingTime }} min</span>
                  </div>
                  <div class="article-row__actions">
                    <button title="Editar" @click="editArticle(article)">Editar</button>
                    <button title="Crear una publicación nueva con esta estructura y contenido" @click="duplicateArticle(article)">Usar como base</button>
                    <a v-if="article.publicationState !== 'draft'" :href="articlePublicUrl(article)" target="_blank" rel="noopener" title="Ver en el blog">Ver ↗</a>
                    <button v-if="article.publicationState !== 'published'" title="Publicar" @click="quickPublish(article)">Publicar</button>
                    <button v-if="article.publicationState !== 'draft'" title="Retirar del sitio" @click="quickUnpublish(article)">Retirar</button>
                    <button class="danger" title="Eliminar" @click="removeArticle(article)">Eliminar</button>
                  </div>
                </article>
              </div>
              <div v-else class="empty-console"><span>{ 00 }</span><h2>No encontramos publicaciones.</h2><p>Cambia los filtros o crea una nueva entrada editorial.</p><button v-if="hasActiveArticleFilters" @click="clearArticleFilters">Limpiar búsqueda y filtros</button><button v-else @click="newArticle">Crear publicación</button></div>
            </section>
          </section>
        </template>

        <GalleryAdmin
          v-else-if="activeTab === 'galleries'"
          :api="api"
          :cms-url="cmsUrl"
          :galleries="dashboard.galleries"
          :categories="dashboard.categories"
          :settings="settingsDraft"
          @refresh="loadDashboard(true)"
          @notice="showNotice($event.message, $event.type)"
        />

        <section v-else-if="activeTab === 'categories'">
          <header class="page-heading"><div><p>PULSO / CATEGORÍAS</p><h1>Arquitectura de contenido</h1><span>Cada categoría define un tema, una señal cromática y su lugar en el catálogo.</span></div></header>
          <div class="category-layout">
            <form class="category-create" @submit.prevent="saveCategory(newCategory, true)">
              <div class="section-label"><span>＋</span><div><h2>Nueva categoría</h2><p>Crea un nuevo territorio editorial.</p></div></div>
              <label class="field"><span>Nombre</span><input v-model="newCategory.name" required maxlength="80" @input="newCategory.slug = slugify(newCategory.name)" /></label>
              <label class="field"><span>Slug</span><input v-model="newCategory.slug" required maxlength="80" /></label>
              <label class="field"><span>Descripción</span><textarea v-model="newCategory.description" rows="4" required maxlength="280"></textarea></label>
              <label class="field"><span>Animación para sus tarjetas</span><select v-model="newCategory.visualStyle"><option v-for="option in visualStyleOptions" :key="option.value" :value="option.value">{{ option.label }} · {{ option.description }}</option></select><small>Las publicaciones podrán usar esta animación o su propia portada.</small></label>
              <div class="field-grid field-grid--two"><label class="field"><span>Color</span><div class="color-field"><input v-model="newCategory.color" type="color" /><input v-model="newCategory.color" pattern="^#[0-9A-Fa-f]{6}$" /></div></label><label class="field"><span>Orden</span><input v-model.number="newCategory.order" type="number" min="0" /></label></div>
              <button class="primary-action primary-action--small" :disabled="categorySavingId === 'new'"><span>{{ categorySavingId === "new" ? "Creando…" : "Crear categoría" }}</span><b>＋</b></button>
            </form>

            <div class="category-stack">
              <article v-for="(category, index) in dashboard.categories" :key="category.documentId" class="category-card" :style="`--category:${category.color}`">
                <header><span>{{ String(index + 1).padStart(2, "0") }}</span><i></i><label class="switch-field switch-field--compact"><input v-model="category.visible" type="checkbox" /><span><i></i></span><div><strong>{{ category.visible ? "Visible" : "Oculta" }}</strong></div></label></header>
                <div class="field-grid field-grid--two"><label class="field"><span>Nombre</span><input v-model="category.name" maxlength="80" /></label><label class="field"><span>Slug</span><input v-model="category.slug" maxlength="80" /></label></div>
                <label class="field"><span>Descripción</span><textarea v-model="category.description" rows="3" maxlength="280"></textarea></label>
                <label class="field"><span>Animación para sus tarjetas</span><select v-model="category.visualStyle"><option v-for="option in visualStyleOptions" :key="option.value" :value="option.value">{{ option.label }} · {{ option.description }}</option></select><small>Se aplicará a las notas configuradas para usar la animación de categoría.</small></label>
                <div class="field-grid field-grid--two"><label class="field"><span>Color distintivo</span><div class="color-field"><input v-model="category.color" type="color" /><input v-model="category.color" /></div></label><label class="field"><span>Orden</span><input v-model.number="category.order" type="number" min="0" /></label></div>
                <footer><button class="text-action text-action--danger" @click="removeCategory(category)">Eliminar</button><button class="secondary-action" :disabled="categorySavingId === category.documentId" @click="saveCategory(category)">{{ categorySavingId === category.documentId ? "Guardando…" : "Guardar cambios" }}</button></footer>
              </article>
            </div>
          </div>
        </section>

        <AcademyCampus
          v-else-if="activeTab === 'academy'"
          :api="api"
          :cms-url="cmsUrl"
          @notice="(message, type) => showNotice(message, type)"
        />

        <section v-else>
          <header class="page-heading"><div><p>PULSO / IDENTIDAD Y SEO</p><h1>Lenguaje editorial</h1><span>Todo lo que nombra, explica y posiciona la publicación pública.</span></div><button class="primary-action primary-action--small" :disabled="settingsSaving" @click="saveSettings"><span>{{ settingsSaving ? "Guardando…" : "Guardar cambios" }}</span><b>✓</b></button></header>
          <div class="settings-grid">
            <section v-for="(group, groupIndex) in settingGroups" :key="group.title" class="settings-card">
              <div class="section-label"><span>{{ String(groupIndex + 1).padStart(2, "0") }}</span><div><h2>{{ group.title }}</h2><p>{{ group.description }}</p></div></div>
              <div class="field-grid">
                <label v-for="field in group.fields" :key="field[0]" class="field" :class="{ 'field--full': field[2] === 'textarea' }">
                  <span>{{ field[1] }}</span>
                  <textarea v-if="field[2] === 'textarea'" v-model="settingsDraft[field[0]]" rows="3" :maxlength="field[3]"></textarea>
                  <input v-else v-model="settingsDraft[field[0]]" :maxlength="field[3]" />
                  <small>{{ String(settingsDraft[field[0]] || '').length }}/{{ field[3] }}</small>
                </label>
              </div>
            </section>
          </div>
          <div class="settings-save-mobile"><button class="primary-action" :disabled="settingsSaving" @click="saveSettings"><span>{{ settingsSaving ? "Guardando…" : "Guardar identidad y SEO" }}</span><b>✓</b></button></div>
        </section>
      </main>
    </div>

    <div v-if="previewOpen" class="preview-overlay" role="dialog" aria-modal="true" aria-label="Vista previa de la publicación" @click.self="previewOpen = false">
      <article class="preview-sheet" :style="`--preview-color:${selectedCategory?.color || '#2CAAFF'}`">
        <header class="preview-toolbar"><div><span>VISTA PREVIA EDITORIAL</span><small>Representación del contenido público antes de guardar</small></div><button type="button" aria-label="Cerrar vista previa" @click="previewOpen = false">×</button></header>
        <div class="preview-article">
          <p class="preview-category"><i></i>{{ selectedCategory?.name || "Sin categoría" }}</p>
          <h1>{{ articleForm.title || "Título de la publicación" }}</h1>
          <p class="preview-excerpt">{{ articleForm.excerpt || "El resumen de la publicación aparecerá en este espacio." }}</p>
          <div class="preview-meta"><span>{{ articleForm.authorName }}</span><span>{{ formatDate(articleForm.publishDate) }}</span><span>{{ articleForm.readingTime }} min de lectura</span></div>
          <img v-if="articleForm.coverMode === 'cover-image' && coverPreview" class="preview-cover" :src="coverPreview" :alt="articleForm.coverAlt || ''" />
          <div v-else class="preview-animation" :data-visual="selectedCategory?.visualStyle || 'notes'"><span>{{ visualStyleLabel(selectedCategory?.visualStyle) }}</span><strong>{{ selectedCategory?.name || "Animación editorial" }}</strong><i></i></div>
          <div class="preview-body" v-html="previewHtml"></div>
          <section v-if="activeLinks.length" class="preview-resources"><span>{{ settingsDraft.resourcesLabel || "RECURSOS PARA CONTINUAR" }}</span><a v-for="link in activeLinks" :key="link.key" :href="link.url" target="_blank" rel="noopener"><img v-if="link.imagePreview" :src="link.imagePreview" :alt="link.label" /><div><strong>{{ link.label }}</strong><small v-if="link.description">{{ link.description }}</small></div><b>↗</b></a></section>
          <section v-if="visibleStoredAttachments.length || visibleAttachmentFiles.length" class="preview-resources"><span>{{ settingsDraft.attachmentsLabel || "ARCHIVOS DE LA PUBLICACIÓN" }}</span><a v-for="attachment in visibleStoredAttachments" :key="attachment.id" :href="mediaUrl(cmsUrl, attachment)" target="_blank" rel="noopener"><div><strong>{{ attachmentLabel(attachment) }}</strong><small>Archivo adjunto</small></div><b>↓</b></a><div v-for="file in visibleAttachmentFiles" :key="file.name" class="preview-file"><div><strong>{{ file.name }}</strong><small>Se publicará al guardar</small></div><b>↑</b></div></section>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(html) { background: #030b28; }
:global(body) { margin: 0; min-width: 320px; color: #f7f9ff; background: #030b28; font-family: Poppins, ui-sans-serif, system-ui, sans-serif; }
:global(button), :global(input), :global(textarea), :global(select) { font: inherit; }
:global(button), :global(a) { -webkit-tap-highlight-color: transparent; }
.editor-app { --ink: #f7f9ff; --muted: rgba(247,249,255,.55); --line: rgba(93,188,255,.16); --blue: #57bbff; --green: #00d9a4; position: relative; min-height: 100vh; isolation: isolate; }
.editor-atmosphere { position: fixed; inset: 0; z-index: -2; overflow: hidden; background: #030b28; pointer-events: none; }
.editor-atmosphere::before { position: absolute; inset: 0; background-image: linear-gradient(rgba(80,170,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(80,170,255,.035) 1px,transparent 1px); background-size: 44px 44px; content: ""; mask-image: linear-gradient(to bottom,black,transparent 82%); }
.editor-atmosphere span { position: absolute; width: 32rem; height: 32rem; border-radius: 50%; filter: blur(90px); opacity: .18; }
.editor-atmosphere span:nth-child(1) { top: -15rem; left: -12rem; background: #1259ff; }
.editor-atmosphere span:nth-child(2) { top: 25%; right: -18rem; background: #7a3cff; }
.editor-atmosphere span:nth-child(3) { bottom: -20rem; left: 35%; background: #00d9a4; opacity: .08; }
.state-screen { display: grid; min-height: 100vh; place-content: center; gap: 24px; color: var(--blue); text-align: center; font: 700 10px/1 ui-monospace,monospace; letter-spacing: .18em; }
.state-orbit { display: grid; width: 64px; height: 64px; margin: auto; place-content: center; border: 1px solid rgba(87,187,255,.28); border-radius: 50%; animation: orbit 1.2s linear infinite; }
.state-orbit i { width: 12px; height: 12px; border-radius: 50%; background: var(--green); box-shadow: 0 0 20px var(--green); }
@keyframes orbit { to { transform: rotate(360deg); } }
.login-shell { display: grid; width: min(1180px, calc(100% - 40px)); min-height: 100vh; margin: auto; padding: 48px 0; grid-template-columns: minmax(0,1.2fr) minmax(340px,.72fr); align-items: center; gap: clamp(50px,8vw,120px); }
.brand-mark { display: inline-flex; align-items: center; gap: 9px; color: white; text-decoration: none; }
.brand-mark > span { width: 11px; height: 11px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 7px rgba(0,217,164,.08),0 0 18px rgba(0,217,164,.7); }
.brand-mark strong { font: 800 15px/1 ui-monospace,monospace; letter-spacing: .16em; }
.brand-mark small { color: #83ceff; font: 600 11px/1 ui-monospace,monospace; letter-spacing: .14em; }
.login-brand__copy { margin-top: clamp(70px,12vh,130px); }
.login-brand__copy > p:first-child, .page-heading p { color: var(--blue); font: 700 10px/1 ui-monospace,monospace; letter-spacing: .18em; }
.login-brand h1 { max-width: 720px; margin: 22px 0 0; font-size: clamp(42px,5.2vw,76px); line-height: .98; letter-spacing: -.058em; }
.login-brand h1 span { color: transparent; background: linear-gradient(90deg,#58c4ff,#00d9a4); background-clip: text; }
.login-brand__description { max-width: 590px; margin: 28px 0 0; color: var(--muted); font-size: 16px; line-height: 1.75; }
.login-brand__signal { display: flex; max-width: 580px; margin-top: 70px; align-items: center; gap: 14px; color: rgba(255,255,255,.38); font: 600 10px/1 ui-monospace,monospace; letter-spacing: .12em; }
.login-brand__signal i { height: 1px; flex: 1; background: linear-gradient(90deg,rgba(87,187,255,.38),rgba(0,217,164,.18)); }
.login-panel { padding: clamp(28px,4vw,44px); border: 1px solid rgba(87,187,255,.22); border-radius: 28px; background: linear-gradient(180deg,rgba(14,30,79,.88),rgba(5,14,47,.93)); box-shadow: 0 35px 100px rgba(0,0,30,.42); backdrop-filter: blur(24px); }
.login-panel__top { display: flex; align-items: center; gap: 12px; color: var(--green); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .15em; }
.login-panel__top i { height: 1px; flex: 1; background: linear-gradient(90deg,rgba(0,217,164,.4),transparent); }
.login-panel h2 { margin: 28px 0 0; font-size: 32px; letter-spacing: -.04em; }
.login-panel > p { margin: 8px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
.login-panel form { display: grid; margin-top: 34px; gap: 18px; }
.login-panel label, .field { display: grid; position: relative; gap: 8px; color: rgba(255,255,255,.67); font-size: 11px; font-weight: 600; }
.login-panel input, .field input, .field textarea, .field select, .console-filters select { width: 100%; min-height: 46px; padding: 11px 13px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; outline: 0; color: white; background: rgba(2,9,34,.7); transition: border-color .2s,box-shadow .2s; }
.login-panel input:focus, .field input:focus, .field textarea:focus, .field select:focus, .console-filters select:focus { border-color: rgba(0,217,164,.55); box-shadow: 0 0 0 3px rgba(0,217,164,.08); }
.form-error { margin: 0; padding: 10px 12px; border: 1px solid rgba(255,98,117,.25); border-radius: 10px; color: #ff9aa7; background: rgba(255,67,91,.08); font-size: 12px; }
.form-error--wide { margin-bottom: 18px; }
.primary-action, .secondary-action { display: inline-flex; min-height: 48px; padding: 0 16px; align-items: center; justify-content: center; gap: 18px; border: 0; border-radius: 12px; cursor: pointer; font-weight: 750; transition: transform .2s,box-shadow .2s,opacity .2s; }
.primary-action { color: #021a21; background: linear-gradient(90deg,#50c8ff,#00d9a4); box-shadow: 0 14px 30px rgba(0,217,164,.14); }
.primary-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 38px rgba(0,217,164,.22); }
.primary-action b { font-size: 18px; }
.primary-action:disabled, .secondary-action:disabled { opacity: .55; cursor: wait; }
.primary-action--small { min-height: 43px; }
.secondary-action { min-height: 42px; border: 1px solid rgba(87,187,255,.22); color: rgba(255,255,255,.8); background: rgba(87,187,255,.07); }
.secondary-action:hover:not(:disabled) { border-color: rgba(87,187,255,.5); color: white; }
.back-public { display: block; margin-top: 24px; color: rgba(255,255,255,.43); text-align: center; text-decoration: none; font-size: 11px; }
.workspace-shell { display: grid; min-height: 100vh; grid-template-columns: 250px minmax(0,1fr); }
.workspace-sidebar { display: flex; position: sticky; top: 0; height: 100vh; padding: 28px 20px 22px; flex-direction: column; border-right: 1px solid var(--line); background: rgba(3,11,40,.9); backdrop-filter: blur(22px); }
.brand-mark--compact { padding: 4px 8px; }
.brand-mark--compact strong { font-size: 12px; }
.brand-mark--compact small { font-size: 8px; }
.brand-mark--compact > span { width: 8px; height: 8px; }
.workspace-sidebar nav { display: grid; margin-top: 58px; gap: 8px; }
.workspace-sidebar nav button { display: grid; min-height: 54px; padding: 10px 12px; grid-template-columns: 26px 1fr auto; align-items: center; gap: 6px; border: 1px solid transparent; border-radius: 13px; color: rgba(255,255,255,.52); background: transparent; text-align: left; cursor: pointer; }
.workspace-sidebar nav button b { color: rgba(87,187,255,.45); font: 700 9px/1 ui-monospace,monospace; }
.workspace-sidebar nav button span { font-size: 12px; }
.workspace-sidebar nav button i { min-width: 24px; padding: 4px 6px; border-radius: 999px; color: rgba(255,255,255,.4); background: rgba(255,255,255,.05); font: 700 9px/1 ui-monospace,monospace; text-align: center; font-style: normal; }
.workspace-sidebar nav button:hover,.workspace-sidebar nav button.active { border-color: rgba(87,187,255,.16); color: white; background: linear-gradient(90deg,rgba(87,187,255,.12),rgba(0,217,164,.035)); }
.workspace-sidebar nav button.active b { color: var(--green); }
.workspace-sidebar__bottom { display: grid; margin-top: auto; gap: 16px; }
.workspace-sidebar__bottom > a { color: #79ccff; text-decoration: none; font-size: 10px; }
.workspace-sidebar__bottom > div { display: grid; padding-top: 15px; gap: 3px; border-top: 1px solid var(--line); }
.workspace-sidebar__bottom span { font-size: 11px; font-weight: 700; }
.workspace-sidebar__bottom small { overflow: hidden; color: rgba(255,255,255,.4); font-size: 9px; text-overflow: ellipsis; }
.workspace-sidebar__bottom button { padding: 7px 0; border: 0; color: rgba(255,255,255,.38); background: none; text-align: left; font-size: 10px; cursor: pointer; }
.mobile-admin-bar { display: none; }
.workspace-main { width: 100%; max-width: 1540px; min-width: 0; margin: 0 auto; padding: clamp(30px,4vw,62px); }
.notice { display: flex; position: fixed; top: 18px; right: 24px; z-index: 20; max-width: min(430px,calc(100vw - 40px)); padding: 13px 18px; align-items: center; gap: 10px; border: 1px solid rgba(0,217,164,.28); border-radius: 12px; color: #cafff1; background: rgba(4,34,43,.96); box-shadow: 0 16px 50px rgba(0,0,0,.35); font-size: 12px; }
.notice span { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px var(--green); }
.notice--error { border-color: rgba(255,100,120,.3); color: #ffc4cc; background: rgba(54,13,28,.96); }
.notice--error span { background: #ff6478; box-shadow: 0 0 10px #ff6478; }
.workspace-loading,.workspace-error { display: grid; min-height: 60vh; place-content: center; justify-items: center; gap: 14px; text-align: center; }
.workspace-loading i { width: 36px; height: 36px; border: 2px solid rgba(87,187,255,.18); border-top-color: var(--green); border-radius: 50%; animation: orbit .8s linear infinite; }
.workspace-loading p,.workspace-error p { color: var(--muted); font-size: 12px; }
.workspace-error span { display: grid; width: 50px; height: 50px; place-content: center; border: 1px solid rgba(255,100,120,.3); border-radius: 50%; color: #ff6478; font-size: 24px; }
.workspace-error button { padding: 10px 16px; border: 1px solid var(--line); border-radius: 10px; color: white; background: rgba(87,187,255,.08); }
.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; }
.page-heading h1 { margin: 10px 0 0; font-size: clamp(32px,4vw,58px); line-height: 1; letter-spacing: -.05em; }
.page-heading > div > span { display: block; max-width: 630px; margin-top: 14px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.page-heading--editor { align-items: center; }
.back-button { margin-bottom: 18px; padding: 0; border: 0; color: rgba(255,255,255,.45); background: transparent; font-size: 11px; cursor: pointer; }
.editor-actions { display: flex; gap: 9px; }
.stat-grid { display: grid; margin-top: 38px; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
.stat-grid article { display: grid; position: relative; min-height: 126px; padding: 18px; align-content: space-between; border-right: 1px solid var(--line); background: rgba(8,20,57,.52); }
.stat-grid article:last-child { border: 0; }
.stat-grid span { color: rgba(255,255,255,.37); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .1em; }
.stat-grid strong { font-size: 38px; font-weight: 400; letter-spacing: -.04em; }
.stat-grid i { position: absolute; right: 18px; bottom: 20px; width: 7px; height: 7px; border-radius: 50%; background: var(--blue); box-shadow: 0 0 12px var(--blue); }
.stat-grid article:nth-child(2) i { background: var(--green); box-shadow: 0 0 12px var(--green); }
.stat-grid article:nth-child(3) i { background: #a26bff; box-shadow: 0 0 12px #a26bff; }
.stat-grid article:nth-child(4) i { background: #ffb547; box-shadow: 0 0 12px #ffb547; }
.content-console { margin-top: 24px; border: 1px solid var(--line); border-radius: 22px; background: rgba(4,13,43,.58); overflow: hidden; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.console-filters { display: grid; padding: 13px; grid-template-columns: minmax(240px,1fr) 145px 155px 175px 145px auto; align-items: center; gap: 8px; border-bottom: 1px solid var(--line); }
.search-field { display: flex; min-height: 42px; padding: 0 12px; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,.09); border-radius: 11px; background: rgba(0,0,20,.2); }
.search-field:focus-within { border-color: rgba(87,187,255,.45); box-shadow: 0 0 0 3px rgba(87,187,255,.07); }
.search-field__icon { color: var(--blue); font-size: 20px; }
.search-field input { width: 100%; min-width: 0; border: 0; outline: 0; color: white; background: transparent; font-size: 13px; }
.search-field button { width: 24px; height: 24px; padding: 0; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.1); border-radius: 50%; color: rgba(255,255,255,.55); background: rgba(255,255,255,.04); cursor: pointer; }
.search-field button:hover { border-color: rgba(87,187,255,.35); color: white; }
.console-filters select { min-height: 42px; padding-block: 8px; font-size: 12px; }
.result-count { color: rgba(255,255,255,.48); font: 650 10px/1 ui-monospace,monospace; white-space: nowrap; }
.article-list { display: grid; }
.article-row { display: grid; min-width: 0; grid-template-columns: minmax(0,1fr) 180px 220px; border-bottom: 1px solid rgba(255,255,255,.065); }
.article-row:last-child { border: 0; }
.article-row:hover { background: linear-gradient(90deg,color-mix(in srgb,var(--category),transparent 94%),transparent); }
.article-row__main { display: grid; position: relative; width: 100%; min-width: 0; height: auto; min-height: 178px; padding: 24px 24px 22px 68px; grid-template-columns: auto 1fr; align-content: center; gap: 9px 12px; border: 0; border-radius: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.article-index { position: absolute; top: 27px; left: 22px; color: rgba(255,255,255,.38); font: 700 11px/1 ui-monospace,monospace; }
.article-category { display: flex; grid-column: 1/-1; align-items: center; gap: 8px; color: var(--category); font: 750 10px/1 ui-monospace,monospace; letter-spacing: .1em; text-transform: uppercase; }
.article-category i { width: 20px; height: 2px; background: var(--category); box-shadow: 0 0 8px var(--category); }
.article-title-label { grid-column: 1/-1; margin-top: 3px; color: rgba(255,255,255,.5); font: 750 9px/1 ui-monospace,monospace; letter-spacing: .12em; text-transform: uppercase; }
.article-row__main > strong { display: block; grid-column: 1/-1; width: 100%; color: #fff; font-size: clamp(18px,1.3vw,22px); font-weight: 680; line-height: 1.32; letter-spacing: -.018em; overflow-wrap: anywhere; }
.article-row__main > small { display: block; grid-column: 1/-1; overflow: hidden; color: rgba(255,255,255,.62); font-size: 12px; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.article-facts { display: flex; grid-column: 1/-1; min-width: 0; margin-top: 4px; align-items: center; gap: 8px 17px; flex-wrap: wrap; color: rgba(255,255,255,.58); font: 500 10px/1.4 ui-monospace,monospace; }
.article-facts > span { display: inline-flex; min-width: 0; align-items: baseline; gap: 5px; }
.article-facts b { color: rgba(87,187,255,.9); font-size: 8px; letter-spacing: .08em; text-transform: uppercase; }
.article-row__meta { display: grid; padding: 20px 16px; align-content: center; gap: 10px; border-left: 1px solid rgba(255,255,255,.055); color: rgba(255,255,255,.6); font-size: 11px; }
.article-row__meta > span:not(.status-pill) { display: grid; gap: 2px; }
.article-row__meta > span > b { color: rgba(255,255,255,.38); font: 700 8px/1 ui-monospace,monospace; letter-spacing: .08em; text-transform: uppercase; }
.status-pill { width: fit-content; padding: 6px 9px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; color: rgba(255,255,255,.68); font: 750 9px/1 ui-monospace,monospace; text-transform: uppercase; }
.status-pill.is-published { border-color: rgba(0,217,164,.25); color: #62e7c7; background: rgba(0,217,164,.07); }
.status-pill.is-modified { border-color: rgba(255,181,71,.3); color: #ffd18e; background: rgba(255,181,71,.07); }
.article-row__actions { display: flex; padding: 18px 15px; align-items: center; justify-content: flex-end; gap: 5px; border-left: 1px solid rgba(255,255,255,.055); flex-wrap: wrap; }
.article-row__actions button,.article-row__actions a { padding: 8px 10px; border: 1px solid rgba(87,187,255,.2); border-radius: 8px; color: rgba(255,255,255,.72); background: rgba(87,187,255,.06); text-decoration: none; font-size: 10px; cursor: pointer; }
.article-row__actions .danger { border-color: rgba(255,100,120,.12); color: rgba(255,140,155,.7); }
.empty-console { display: grid; min-height: 340px; place-content: center; justify-items: center; text-align: center; }
.empty-console > span { color: var(--blue); font: 700 26px/1 ui-monospace,monospace; }
.empty-console h2 { margin: 16px 0 0; font-size: 20px; }
.empty-console p { color: var(--muted); font-size: 11px; }
.empty-console button { margin-top: 12px; padding: 9px 13px; border: 1px solid var(--line); border-radius: 9px; color: white; background: rgba(87,187,255,.08); }
.article-editor { padding-bottom: 60px; }
.editor-layout { display: grid; margin-top: 34px; grid-template-columns: minmax(0,1fr) minmax(300px,330px); align-items: start; gap: 22px; }
.editor-layout,.editor-layout * { box-sizing: border-box; }
.editor-layout > *,.editor-canvas,.editor-inspector,.form-section,.inspector-card { width: 100%; max-width: 100%; min-width: 0; }
.editor-canvas { display: grid; gap: 18px; }
.form-section,.inspector-card,.category-create,.category-card,.settings-card { padding: clamp(18px,2.5vw,28px); border: 1px solid var(--line); border-radius: 22px; background: rgba(6,16,49,.67); }
.form-section--lead { background: linear-gradient(145deg,rgba(11,28,73,.82),rgba(5,15,47,.7)); }
.section-label { display: flex; margin-bottom: 25px; align-items: flex-start; gap: 13px; }
.section-label > span { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-content: center; border: 1px solid rgba(0,217,164,.22); border-radius: 50%; color: var(--green); font: 700 9px/1 ui-monospace,monospace; }
.section-label h2 { margin: 0; font-size: 17px; letter-spacing: -.025em; }
.section-label p { margin: 4px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
.field { min-width: 0; margin-top: 15px; }
.field:first-child { margin-top: 0; }
.field > span { color: rgba(255,255,255,.58); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .06em; text-transform: uppercase; }
.field textarea { resize: vertical; line-height: 1.6; }
.field small { position: absolute; right: 7px; bottom: 6px; color: rgba(255,255,255,.28); font-size: 8px; }
.field small.warning { color: #ffb547; }
.field--title textarea { min-height: 105px; padding: 14px 15px; font-size: clamp(22px,3vw,34px); font-weight: 700; line-height: 1.15; letter-spacing: -.04em; }
.slug-field,.number-field { display: flex; min-height: 46px; align-items: center; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: rgba(2,9,34,.7); overflow: hidden; }
.slug-field b,.slug-field i,.number-field b { padding: 0 11px; color: rgba(255,255,255,.34); font: 600 10px/1 ui-monospace,monospace; font-style: normal; }
.slug-field input,.number-field input { width: 100%; min-width: 0; min-height: 44px; padding-inline: 0; border: 0; background: transparent; box-shadow: none; }
.number-field input { flex: 1 1 0; }
.number-field b { flex: 0 0 auto; }
.field-grid { display: grid; min-width: 0; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 14px; }
.field-grid > * { min-width: 0; }
.field-grid--two { grid-template-columns: repeat(2,minmax(0,1fr)); }
.editor-inspector .field-grid--two { grid-template-columns: minmax(0,1.25fr) minmax(96px,.75fr); }
.field--full { grid-column: 1/-1; }
.search-preview { margin-top: 22px; padding: 18px; border: 1px solid rgba(87,187,255,.13); border-radius: 15px; background: rgba(0,0,20,.18); }
.search-preview > span { color: rgba(255,255,255,.3); font: 700 8px/1 ui-monospace,monospace; letter-spacing: .1em; }
.search-preview h3 { margin: 13px 0 2px; color: #78b9ff; font-size: 17px; font-weight: 500; }
.search-preview p { margin: 0; color: #51c498; font-size: 9px; }
.search-preview div { margin-top: 7px; color: rgba(255,255,255,.55); font-size: 10px; line-height: 1.5; }
.editor-inspector { display: grid; position: sticky; top: 22px; gap: 14px; }
.inspector-card { padding: 19px; border-radius: 18px; }
.inspector-card__title { display: flex; margin-bottom: 17px; align-items: center; gap: 10px; color: var(--blue); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .12em; }
.inspector-card__title i { height: 1px; flex: 1; background: linear-gradient(90deg,rgba(87,187,255,.3),transparent); }
.switch-field { display: flex; margin-top: 18px; align-items: center; gap: 10px; cursor: pointer; }
.switch-field > input { position: absolute; opacity: 0; }
.switch-field > span { display: flex; width: 36px; height: 20px; flex: 0 0 auto; padding: 3px; align-items: center; border-radius: 999px; background: rgba(255,255,255,.12); transition: background .2s; }
.switch-field > span i { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,.65); transition: transform .2s; }
.switch-field > input:checked + span { background: rgba(0,217,164,.35); }
.switch-field > input:checked + span i { transform: translateX(16px); background: var(--green); }
.switch-field > div { display: grid; gap: 2px; }
.switch-field strong { font-size: 10px; }
.switch-field small { color: var(--muted); font-size: 8px; }
.switch-field--compact { margin: 0 0 0 auto; }
.cover-mode { display: grid; margin-bottom: 14px; gap: 8px; }
.cover-mode > label { display: grid; grid-template-columns: 18px 1fr; padding: 11px 12px; align-items: start; gap: 8px; border: 1px solid rgba(87,187,255,.14); border-radius: 12px; color: rgba(255,255,255,.48); background: rgba(3,10,35,.42); cursor: pointer; transition: border-color .2s ease,background .2s ease,color .2s ease; }
.cover-mode > label.active { border-color: rgba(0,217,164,.48); color: #fff; background: linear-gradient(135deg,rgba(0,217,164,.1),rgba(44,170,255,.06)); box-shadow: inset 0 0 0 1px rgba(0,217,164,.05); }
.cover-mode input { margin-top: 2px; accent-color: var(--green); }
.cover-mode span { display: grid; gap: 4px; }
.cover-mode strong { font-size: 10px; }
.cover-mode small { color: rgba(255,255,255,.38); font-size: 8px; line-height: 1.45; }
.cover-drop { display: grid; min-height: 170px; place-content: center; justify-items: center; gap: 6px; border: 1px dashed rgba(87,187,255,.28); border-radius: 14px; color: rgba(255,255,255,.55); background: rgba(87,187,255,.035); text-align: center; cursor: pointer; overflow: hidden; }
.cover-drop input { display: none; }
.cover-drop > b { display: grid; width: 38px; height: 38px; place-content: center; border-radius: 50%; color: var(--green); background: rgba(0,217,164,.08); font-size: 22px; }
.cover-drop strong { font-size: 11px; }
.cover-drop small { max-width: 180px; color: rgba(255,255,255,.32); font-size: 8px; }
.cover-drop.has-image { display: block; min-height: 0; }
.cover-drop img { display: block; width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.text-action { padding: 7px 0; border: 0; color: var(--blue); background: transparent; font-size: 9px; cursor: pointer; }
.text-action--danger { color: #ff8393; }
.editor-status-line { display: flex; min-height: 26px; margin-top: 10px; align-items: center; justify-content: flex-end; gap: 14px; color: rgba(255,255,255,.36); font: 600 9px/1 ui-monospace,monospace; }
.editor-status-line button { padding: 6px 9px; border: 1px solid rgba(0,217,164,.23); border-radius: 8px; color: #79ead0; background: rgba(0,217,164,.06); cursor: pointer; }
.resource-editor { display: grid; gap: 10px; }
.resource-editor__row { display: grid; padding: 14px; grid-template-columns: 30px minmax(0,1fr); gap: 0 10px; border: 1px solid rgba(87,187,255,.13); border-radius: 14px; background: rgba(1,8,30,.24); }
.resource-editor__row > span { padding-top: 19px; color: var(--green); font: 700 9px/1 ui-monospace,monospace; }
.resource-editor__body { display: grid; grid-template-columns: 145px minmax(0,1fr); gap: 12px; }
.resource-image-field { display: grid; align-content: start; gap: 6px; }
.resource-image-field label { display: grid; min-height: 112px; place-items: center; border: 1px dashed rgba(87,187,255,.25); border-radius: 11px; color: rgba(255,255,255,.45); background: rgba(87,187,255,.04); overflow: hidden; cursor: pointer; }
.resource-image-field label.has-image { display: block; border-style: solid; }
.resource-image-field label span { display: grid; padding: 12px; justify-items: center; gap: 7px; font-size: 8px; text-align: center; }
.resource-image-field label b { color: var(--green); font-size: 20px; }
.resource-image-field img { display: block; width: 100%; height: 112px; object-fit: cover; }
.resource-image-field input { display: none; }
.resource-image-field > button { padding: 0; border: 0; color: #ff8393; background: transparent; text-align: left; font-size: 8px; cursor: pointer; }
.resource-editor__controls { display: flex; grid-column: 2; margin-top: 10px; align-items: center; gap: 14px; color: rgba(255,255,255,.48); font-size: 9px; }
.resource-editor__controls label { display: flex; align-items: center; gap: 5px; }
.resource-editor__controls button { margin-left: auto; border: 0; color: #ff8393; background: none; font-size: 9px; cursor: pointer; }
.resource-add { min-height: 42px; border: 1px dashed rgba(0,217,164,.3); border-radius: 12px; color: #7debd0; background: rgba(0,217,164,.04); font-size: 10px; cursor: pointer; }
.reading-suggestion { margin-top: 7px; padding: 0; border: 0; color: #72c9ff; background: none; font-size: 8px; cursor: pointer; }
.attachment-drop { display: grid; min-height: 42px; place-content: center; border: 1px dashed rgba(87,187,255,.28); border-radius: 10px; color: #83d0ff; background: rgba(87,187,255,.04); font-size: 9px; cursor: pointer; }
.attachment-drop input { display: none; }
.attachment-list { display: grid; margin-top: 9px; gap: 6px; }
.attachment-list article,.preview-file { display: grid; padding: 9px; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,.07); border-radius: 9px; background: rgba(0,0,20,.18); }
.attachment-list article > span { color: var(--green); font: 700 9px/1 ui-monospace,monospace; }
.attachment-list article > div,.preview-file > div { display: grid; min-width: 0; gap: 2px; }
.attachment-list strong,.preview-file strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.attachment-list small,.preview-file small { color: rgba(255,255,255,.33); font-size: 7px; }
.attachment-list button { width: 24px; height: 24px; border: 0; border-radius: 7px; color: #ff8393; background: rgba(255,100,120,.06); cursor: pointer; }
.attachment-empty { margin: 10px 0 0; color: rgba(255,255,255,.36); font-size: 8px; line-height: 1.55; }
.quality-card .inspector-card__title b { color: var(--green); font-size: 11px; }
.quality-meter { height: 4px; margin-bottom: 13px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
.quality-meter i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#57bbff,#00d9a4); transition: width .25s ease; }
.quality-stats { display: grid; margin-bottom: 14px; grid-template-columns: auto 1fr auto 1fr; align-items: baseline; gap: 3px 5px; }
.quality-stats strong { color: white; font-size: 18px; font-weight: 500; }
.quality-stats span { color: rgba(255,255,255,.35); font-size: 8px; }
.quality-card ul { display: grid; margin: 0; padding: 0; gap: 7px; list-style: none; }
.quality-card li { display: flex; align-items: center; gap: 7px; color: rgba(255,255,255,.4); font-size: 8px; line-height: 1.35; }
.quality-card li span { color: #ffb547; font: 700 10px/1 ui-monospace,monospace; }
.quality-card li.done { color: rgba(255,255,255,.68); }
.quality-card li.done span { color: var(--green); }
.preview-overlay { display: grid; position: fixed; inset: 0; z-index: 90; padding: 24px; place-items: start center; background: rgba(0,4,20,.84); backdrop-filter: blur(18px); overflow-y: auto; }
.preview-sheet { width: min(980px,100%); border: 1px solid color-mix(in srgb,var(--preview-color),transparent 58%); border-radius: 24px; background: #07102e; box-shadow: 0 40px 120px rgba(0,0,20,.65); overflow: hidden; }
.preview-toolbar { display: flex; position: sticky; top: 0; z-index: 2; min-height: 62px; padding: 12px 18px; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.09); background: rgba(5,14,43,.95); backdrop-filter: blur(20px); }
.preview-toolbar > div { display: grid; gap: 4px; }
.preview-toolbar span { color: var(--preview-color); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .14em; }
.preview-toolbar small { color: rgba(255,255,255,.36); font-size: 8px; }
.preview-toolbar button { width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.1); border-radius: 50%; color: white; background: rgba(255,255,255,.05); font-size: 20px; cursor: pointer; }
.preview-article { width: min(760px,calc(100% - 40px)); margin: 0 auto; padding: clamp(36px,7vw,82px) 0; }
.preview-category { display: flex; align-items: center; gap: 8px; color: var(--preview-color); font: 700 10px/1 ui-monospace,monospace; letter-spacing: .13em; text-transform: uppercase; }
.preview-category i { width: 25px; height: 1px; background: currentColor; box-shadow: 0 0 9px currentColor; }
.preview-article > h1 { max-width: 800px; margin: 22px 0 0; font-size: clamp(38px,6.3vw,76px); line-height: 1.03; letter-spacing: -.055em; }
.preview-excerpt { margin: 24px 0 0; color: rgba(255,255,255,.62); font-size: clamp(15px,2vw,19px); line-height: 1.7; }
.preview-meta { display: flex; margin-top: 22px; gap: 18px; color: rgba(255,255,255,.38); font: 600 9px/1 ui-monospace,monospace; flex-wrap: wrap; }
.preview-cover { display: block; width: 100%; margin-top: 32px; aspect-ratio: 16/9; border-radius: 18px; object-fit: cover; }
.preview-animation { position: relative; display: grid; min-height: 230px; margin-top: 32px; padding: 28px; align-content: end; overflow: hidden; border: 1px solid color-mix(in srgb,var(--preview-color),transparent 48%); border-radius: 18px; background: radial-gradient(circle at 74% 24%,color-mix(in srgb,var(--preview-color),transparent 42%),transparent 28%),linear-gradient(135deg,color-mix(in srgb,var(--preview-color),transparent 72%),#07102b 58%,#000051); box-shadow: inset 0 0 45px rgba(0,0,20,.35); }
.preview-animation::before { position: absolute; inset: -30%; background-image: linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px); background-size: 28px 28px; content: ""; transform: rotate(-8deg); }
.preview-animation span,.preview-animation strong { position: relative; z-index: 1; }
.preview-animation span { color: var(--preview-color); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .13em; text-transform: uppercase; }
.preview-animation strong { max-width: 72%; margin-top: 9px; color: #fff; font-size: clamp(22px,4vw,34px); line-height: 1.05; }
.preview-animation i { position: absolute; top: 24%; right: 14%; width: 78px; aspect-ratio: 1; border: 1px dashed var(--preview-color); border-radius: 50%; box-shadow: 0 0 42px color-mix(in srgb,var(--preview-color),transparent 46%); }
.preview-body { margin-top: 40px; color: rgba(255,255,255,.76); font-size: 16px; line-height: 1.85; }
.preview-body :deep(h2),.preview-body :deep(h3),.preview-body :deep(h4) { margin: 2em 0 .65em; color: white; line-height: 1.2; letter-spacing: -.035em; }
.preview-body :deep(h2) { font-size: 32px; }.preview-body :deep(h3) { font-size: 24px; }.preview-body :deep(h4) { font-size: 19px; }
.preview-body :deep(p),.preview-body :deep(ul),.preview-body :deep(ol),.preview-body :deep(blockquote) { margin: 0 0 1.35em; }
.preview-body :deep(a) { color: #72ccff; }.preview-body :deep(img) { max-width: 100%; border-radius: 14px; }
.preview-body :deep(.article-image) { margin: 28px 0; }.preview-body :deep(.article-inline-image) { min-height: 360px; border-radius: 14px; background-position: center; background-size: cover; }
.preview-body :deep(.article-gallery) { width: 100%; margin: 32px 0; padding: 10px; border: 1px solid color-mix(in srgb,var(--preview-color),transparent 72%); border-radius: 18px; background: rgba(2,6,23,.62); overflow: hidden; }
.preview-body :deep(.article-gallery > h3) { margin: 4px 4px 12px; }
.preview-body :deep(.article-gallery__viewport) { width: 100%; border-radius: 13px; overflow: hidden; }
.preview-body :deep(.article-gallery__items) { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.preview-body :deep(.article-gallery__item) { display: grid; position: relative; width: 100%; height: auto; min-width: 0; padding: 0; border: 1px solid rgba(255,255,255,.1); border-radius: 13px; color: white; background: #020617; overflow: hidden; }
.preview-body :deep(.article-gallery__media) { display: grid; width: 100%; aspect-ratio: 4/3; place-items: center; overflow: hidden; }
.preview-body :deep(.article-gallery__item img) { display: block; width: 100%; height: 100%; border-radius: 0; object-fit: contain; }
.preview-body :deep(.article-gallery__item > b) { position: absolute; top: 8px; left: 8px; padding: 5px 7px; border-radius: 999px; color: #031326; background: var(--preview-color); font: 800 8px/1 ui-monospace,monospace; }
.preview-body :deep(.article-gallery__caption) { padding: 8px 10px; color: rgba(255,255,255,.58); font-size: 10px; }
.preview-body :deep(.article-gallery--masonry .article-gallery__viewport) { overflow: visible; }
.preview-body :deep(.article-gallery--masonry .article-gallery__items) { display: block; columns: 2; column-gap: 8px; }
.preview-body :deep(.article-gallery--masonry .article-gallery__item) { display: inline-grid; margin-bottom: 8px; break-inside: avoid; }
.preview-body :deep(.article-gallery--masonry .article-gallery__media) { aspect-ratio: auto; }
.preview-body :deep(.article-gallery--masonry img) { height: auto; }
.preview-body :deep(.article-gallery--carousel .article-gallery__viewport) { overflow-x: auto; scroll-snap-type: x mandatory; }
.preview-body :deep(.article-gallery--carousel .article-gallery__items) { display: flex; width: max-content; gap: 9px; }
.preview-body :deep(.article-gallery--carousel .article-gallery__item) { flex: 0 0 min(70vw,620px); scroll-snap-align: start; }
.preview-body :deep(.article-gallery--carousel .article-gallery__media) { aspect-ratio: 16/9; }
.preview-body :deep(.article-gallery__controls) { display: flex; margin-top: 8px; align-items: center; justify-content: flex-end; gap: 7px; }
.preview-body :deep(.article-gallery__controls span) { margin-right: auto; color: rgba(255,255,255,.4); font: 700 8px/1 ui-monospace,monospace; }
.preview-body :deep(.article-gallery__controls button) { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; border: 1px solid color-mix(in srgb,var(--preview-color),transparent 68%); border-radius: 50%; color: white; background: color-mix(in srgb,var(--preview-color),transparent 92%); }
.preview-body :deep(pre) { padding: 18px; border: 1px solid rgba(87,187,255,.16); border-radius: 13px; background: rgba(0,0,15,.38); overflow-x: auto; }
.preview-body :deep(.article-callout) { margin: 24px 0; padding: 18px; border: 1px solid color-mix(in srgb,var(--preview-color),transparent 62%); border-radius: 14px; background: color-mix(in srgb,var(--preview-color),transparent 93%); }
.preview-body :deep(.article-callout strong) { display: block; margin-bottom: 6px; color: var(--preview-color); }
.preview-body :deep(.article-inline-cta a) { display: inline-flex; margin: 10px 0 24px; padding: 12px 18px; border: 1px solid var(--preview-color); border-radius: 999px; color: #03172b; background: var(--preview-color); text-decoration: none; font-weight: 700; }
.preview-body :deep(.article-video),.preview-body :deep(.article-table) { width: 100%; margin: 26px 0; border-radius: 14px; overflow: hidden; }
.preview-body :deep(.article-embed) { display: flex; margin: 24px 0; padding: 16px; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; }
.preview-body :deep(.article-embed > div) { display: grid; gap: 4px; }
.preview-body :deep(.article-divider) { height: 1px; margin: 40px 0; border: 0; background: linear-gradient(90deg,transparent,var(--preview-color),transparent); }
.preview-body :deep(iframe),.preview-body :deep(video) { width: 100%; aspect-ratio: 16/9; border: 0; }
.preview-body :deep(table) { width: 100%; border-collapse: collapse; }.preview-body :deep(th),.preview-body :deep(td) { padding: 10px; border: 1px solid rgba(255,255,255,.12); text-align: left; }
.preview-resources { display: grid; margin-top: 34px; gap: 8px; }
.preview-resources > span { margin-bottom: 4px; color: var(--preview-color); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .12em; }
.preview-resources > a,.preview-file { display: flex; padding: 14px; align-items: center; justify-content: space-between; gap: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; color: white; background: rgba(255,255,255,.035); text-decoration: none; }
.preview-resources > a > img { width: 80px; height: 58px; flex: 0 0 auto; border-radius: 8px; object-fit: cover; }
.preview-resources > a > div { flex: 1; }
.preview-resources > a > div { display: grid; gap: 3px; }.preview-resources > a strong { font-size: 12px; }.preview-resources > a small { color: rgba(255,255,255,.42); font-size: 9px; }
.mobile-save-actions,.settings-save-mobile { display: none; }
.editor-loading { display: grid; min-height: 400px; place-content: center; border: 1px solid var(--line); border-radius: 20px; color: var(--muted); }
.category-layout { display: grid; margin-top: 34px; grid-template-columns: 330px minmax(0,1fr); align-items: start; gap: 20px; }
.category-create { position: sticky; top: 30px; }
.category-stack { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
.category-card { position: relative; padding-top: 18px; box-shadow: inset 0 3px 0 color-mix(in srgb,var(--category),transparent 10%); }
.category-card header { display: flex; align-items: center; gap: 10px; }
.category-card header > span { color: var(--category); font: 700 11px/1 ui-monospace,monospace; }
.category-card header > i { height: 1px; flex: 1; background: linear-gradient(90deg,var(--category),transparent); opacity: .35; }
.category-card footer { display: flex; margin-top: 18px; align-items: center; justify-content: space-between; gap: 12px; }
.color-field { display: grid; grid-template-columns: 46px 1fr; gap: 7px; }
.color-field input[type="color"] { min-height: 46px; padding: 4px; }
.settings-grid { display: grid; margin-top: 34px; grid-template-columns: repeat(2,minmax(0,1fr)); align-items: start; gap: 16px; }
.settings-card .field-grid { gap: 0 13px; }
@media (max-width: 1180px) {
  .workspace-shell { grid-template-columns: 210px minmax(0,1fr); }
  .workspace-main { padding: 34px 28px; }
  .console-filters { grid-template-columns: minmax(240px,1fr) repeat(2,minmax(150px,.55fr)); }
  .result-count { text-align: right; }
  .article-row { grid-template-columns: minmax(0,1fr) 145px; }
  .article-row__actions { grid-column: 1/-1; padding: 8px 14px 12px; border: 0; justify-content: flex-start; }
  .editor-layout { grid-template-columns: 1fr; }
  .editor-inspector { position: static; grid-template-columns: repeat(2,minmax(0,1fr)); }
  .editor-inspector > :first-child { grid-column: 1/-1; }
  .category-stack { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .login-shell { grid-template-columns: 1fr; padding: 30px 0 50px; gap: 44px; }
  .login-brand__copy { margin-top: 60px; }
  .login-brand__signal { margin-top: 40px; }
  .workspace-shell { display: block; }
  .workspace-sidebar { display: none; }
  .mobile-admin-bar { display: flex; position: sticky; top: 0; z-index: 12; min-height: 64px; padding: 10px 18px; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); background: rgba(3,11,40,.93); backdrop-filter: blur(20px); }
  .mobile-admin-bar select { min-height: 38px; padding: 0 30px 0 10px; border: 1px solid var(--line); border-radius: 9px; color: white; background: #09163f; font-size: 10px; }
  .mobile-admin-bar > button { border: 0; color: rgba(255,255,255,.5); background: transparent; font-size: 18px; }
  .workspace-main { padding: 28px 20px 60px; }
  .stat-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .stat-grid article:nth-child(2) { border-right: 0; }
  .stat-grid article:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .article-row { grid-template-columns: 1fr; }
  .article-row__meta { display: flex; padding: 0 20px 12px 64px; align-items: center; flex-wrap: wrap; border: 0; }
  .article-row__actions { padding-left: 64px; }
  .editor-layout { grid-template-columns: 1fr; }
  .editor-inspector { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .editor-inspector > :first-child { grid-column: 1/-1; }
  .editor-actions { display: none; }
  .mobile-save-actions { display: flex; grid-column: 1/-1; gap: 10px; }
  .mobile-save-actions > * { flex: 1; }
  .category-layout { grid-template-columns: 1fr; }
  .category-create { position: static; }
  .category-stack { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .settings-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .login-shell { width: min(100% - 28px,460px); }
  .login-brand h1 { font-size: 40px; }
  .login-brand__description { font-size: 13px; }
  .login-brand__signal { display: none; }
  .login-panel { padding: 25px 20px; }
  .workspace-main { padding-inline: 14px; }
  .page-heading { align-items: flex-start; flex-direction: column; }
  .page-heading > .primary-action { width: 100%; }
  .stat-grid article { min-height: 100px; }
  .stat-grid strong { font-size: 30px; }
  .console-filters { grid-template-columns: 1fr; }
  .result-count { text-align: left; }
  .article-row__main { min-height: 0; padding: 20px 14px 20px 48px; align-content: start; }
  .article-row__main > strong { font-size: 18px; line-height: 1.35; }
  .article-row__main > small { max-height: 3.6em; white-space: normal; }
  .article-facts { font-size: 9px; }
  .article-facts > span { overflow-wrap: anywhere; }
  .article-index { left: 14px; }
  .article-row__meta,.article-row__actions { padding-left: 48px; }
  .field-grid,.field-grid--two { grid-template-columns: 1fr; }
  .field--full { grid-column: auto; }
  .editor-inspector { grid-template-columns: 1fr; }
  .editor-inspector > :first-child { grid-column: auto; }
  .resource-editor__row { grid-template-columns: 24px minmax(0,1fr); padding: 11px; }
  .resource-editor__body { grid-template-columns: 1fr; }
  .resource-image-field label { min-height: 150px; }
  .resource-image-field img { height: 150px; }
  .resource-editor__controls { align-items: flex-start; flex-direction: column; }
  .resource-editor__controls button { margin-left: 0; }
  .editor-status-line { align-items: flex-end; flex-direction: column; }
  .mobile-save-actions { flex-wrap: wrap; }
  .mobile-save-actions > * { min-width: calc(50% - 5px); }
  .preview-overlay { padding: 8px; }
  .preview-sheet { border-radius: 16px; }
  .preview-article { width: min(100% - 28px,760px); }
  .form-section,.inspector-card,.category-create,.category-card,.settings-card { padding: 17px 14px; }
  .category-stack { grid-template-columns: 1fr; }
  .settings-save-mobile { display: block; position: sticky; bottom: 10px; z-index: 8; margin-top: 16px; }
  .settings-save-mobile button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
</style>
