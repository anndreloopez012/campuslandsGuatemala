export const BLOG_EDITOR_STORAGE_KEY = "campuslands_blog_editor_session";

export type EditorUser = {
  id: number;
  username: string;
  email: string;
  role: { name: string; type: string };
};

export type EditorMedia = {
  id: number;
  documentId?: string;
  url: string;
  name?: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number;
  height?: number;
  mime?: string;
};

export type EditorCategory = {
  id?: number;
  documentId: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  order: number;
  visible: boolean;
  visualStyle: "ai" | "code" | "community" | "career" | "notes";
};

export type EditorSeo = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  shareImage?: EditorMedia | null;
};

export type EditorArticleLink = {
  label: string;
  url: string;
  description?: string;
  image?: EditorMedia | null;
  openInNewTab: boolean;
  active: boolean;
};

export type EditorGallery = {
  id?: number;
  documentId: string;
  title: string;
  slug: string;
  description: string;
  images: EditorMedia[];
  imageDetails?: EditorMedia[];
  category: EditorCategory;
  tags: string[];
  featured: boolean;
  publishDate: string;
  seo?: EditorSeo | null;
  publicationState?: "draft" | "published" | "modified";
  publishedAt?: string | null;
  publicPublishedAt?: string | null;
  updatedAt?: string;
};

export type EditorArticle = {
  id?: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: any[];
  category: EditorCategory;
  coverImage?: EditorMedia | null;
  coverAlt: string;
  coverMode?: "category-animation" | "cover-image";
  authorName: string;
  featured: boolean;
  readingTime: number;
  publishDate: string;
  tags: string[];
  links?: EditorArticleLink[];
  attachments?: EditorMedia[];
  seo?: EditorSeo | null;
  publicationState?: "draft" | "published" | "modified";
  publishedAt?: string | null;
  publicPublishedAt?: string | null;
  updatedAt?: string;
};

export type EditorWorkshopCurriculum = {
  id: number;
  name: string;
  url: string;
  size: number;
  mime: string;
  updatedAt: string;
};

export type EditorWorkshop = {
  key: string;
  slug: string;
  code: string;
  title: string;
  order: number;
  isOpen: boolean;
  startDate: string;
  updatedAt: string;
  curriculum: EditorWorkshopCurriculum | null;
};

export type EditorWorkshopChanges = Partial<{ isOpen: boolean; startDate: string; curriculum: number | null }>;

export type EditorDashboard = {
  articles: EditorArticle[];
  galleries: EditorGallery[];
  categories: EditorCategory[];
  settings: Record<string, any>;
};

export function mediaUrl(cmsUrl: string, media?: EditorMedia | null) {
  if (!media?.url) return "";
  return media.url.startsWith("http") ? media.url : `${cmsUrl}${media.url}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

// ------------------------------------------------------------------ campus de AI Academy

export type AcademyFile = { id: number; name: string; mime: string; size: number; url: string };

export type AcademyWorkshop = {
  id: number;
  key: string;
  slug: string;
  code: string;
  title: string;
  order: number;
  accent: string;
  description: string;
  hours: number;
  isPublic: boolean;
  isOpen: boolean;
  startDate: string;
  counts?: { students: number; diplomas: number; tools: number; videos: number };
  blocks?: AcademyBlock[];
};

export type AcademyPerson = {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  blocked: boolean;
  role: "student" | "admin";
  isOwner: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  workshops?: { key: string; code: string; title: string; accent: string; enrollmentId: number; status: string; block: AcademyBlockRef }[];
};

// Bloque: cada vez que se imparte el taller. El avance (%) sale de la sesión actual que define el administrador.
export type AcademyBlock = {
  id: number; name: string; startDate: string; totalSessions: number; currentSession: number; progress: number;
  status: "por-iniciar" | "en-curso" | "finalizado"; students?: number;
};
export type AcademyBlockRef = { id: number; name: string } | null;
export type AcademyEnrollment = { id: number; block: AcademyBlockRef; cohort: string; status: "inscrito" | "en-curso" | "completado"; enrolledAt: string; student: AcademyPerson };
export type AcademyDiploma = { id: number; credentialId: string; title: string; issuedAt: string; hours: number; skills: string[]; status: "emitido" | "revocado"; studentId: number | null; file: AcademyFile | null };
export type AcademyTool = { id: number; title: string; url: string; description: string; category: string; order: number; block: AcademyBlockRef };
export type AcademyVideo = { id: number; title: string; description: string; session: number | null; order: number; source: "archivo" | "enlace"; externalUrl: string; durationSeconds: number | null; file: AcademyFile | null; block: AcademyBlockRef };
export type AcademyDetail = { workshop: AcademyWorkshop; blocks: AcademyBlock[]; enrollments: AcademyEnrollment[]; diplomas: AcademyDiploma[]; tools: AcademyTool[]; videos: AcademyVideo[] };
export type AcademyOverview = { workshops: AcademyWorkshop[]; students: number; admins: number };

export class BlogAdminApi {
  cmsUrl: string;
  token: string;

  constructor(cmsUrl: string, token = "") {
    this.cmsUrl = cmsUrl.replace(/\/+$/, "");
    this.token = token;
  }

  setToken(token: string) {
    this.token = token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.cmsUrl}/api${path}`, { ...init, headers });
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || "No se pudo completar la operación.";
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload?.data ?? payload;
  }

  async login(identifier: string, password: string) {
    const response = await fetch(`${this.cmsUrl}/api/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.jwt) {
      throw new Error(payload?.error?.message || "Correo o contraseña incorrectos.");
    }
    this.setToken(payload.jwt);
    return payload as { jwt: string; user: Record<string, unknown> };
  }

  session() {
    return this.request<EditorUser>("/editor/session");
  }

  dashboard() {
    return this.request<EditorDashboard>("/editor/dashboard");
  }

  article(documentId: string) {
    return this.request<EditorArticle>(`/editor/articles/${encodeURIComponent(documentId)}`);
  }

  createArticle(data: Record<string, unknown>, publish: boolean) {
    return this.request<EditorArticle>("/editor/articles", {
      method: "POST",
      body: JSON.stringify({ data, publish }),
    });
  }

  updateArticle(documentId: string, data: Record<string, unknown>, publish: boolean) {
    return this.request<EditorArticle>(`/editor/articles/${encodeURIComponent(documentId)}`, {
      method: "PUT",
      body: JSON.stringify({ data, publish }),
    });
  }

  publishArticle(documentId: string) {
    return this.request<EditorArticle>(`/editor/articles/${encodeURIComponent(documentId)}/publish`, { method: "POST" });
  }

  unpublishArticle(documentId: string) {
    return this.request<EditorArticle>(`/editor/articles/${encodeURIComponent(documentId)}/unpublish`, { method: "POST" });
  }

  deleteArticle(documentId: string) {
    return this.request<void>(`/editor/articles/${encodeURIComponent(documentId)}`, { method: "DELETE" });
  }

  gallery(documentId: string) {
    return this.request<EditorGallery>(`/editor/galleries/${encodeURIComponent(documentId)}`);
  }

  createGallery(data: Record<string, unknown>, publish: boolean) {
    return this.request<EditorGallery>("/editor/galleries", {
      method: "POST",
      body: JSON.stringify({ data, publish }),
    });
  }

  updateGallery(documentId: string, data: Record<string, unknown>, publish: boolean) {
    return this.request<EditorGallery>(`/editor/galleries/${encodeURIComponent(documentId)}`, {
      method: "PUT",
      body: JSON.stringify({ data, publish }),
    });
  }

  publishGallery(documentId: string) {
    return this.request<EditorGallery>(`/editor/galleries/${encodeURIComponent(documentId)}/publish`, { method: "POST" });
  }

  unpublishGallery(documentId: string) {
    return this.request<EditorGallery>(`/editor/galleries/${encodeURIComponent(documentId)}/unpublish`, { method: "POST" });
  }

  deleteGallery(documentId: string) {
    return this.request<void>(`/editor/galleries/${encodeURIComponent(documentId)}`, { method: "DELETE" });
  }

  createCategory(data: Partial<EditorCategory>) {
    return this.request<EditorCategory>("/editor/categories", { method: "POST", body: JSON.stringify({ data }) });
  }

  updateCategory(documentId: string, data: Partial<EditorCategory>) {
    return this.request<EditorCategory>(`/editor/categories/${encodeURIComponent(documentId)}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
  }

  deleteCategory(documentId: string) {
    return this.request<void>(`/editor/categories/${encodeURIComponent(documentId)}`, { method: "DELETE" });
  }

  updateSettings(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/editor/settings", {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
  }

  workshops() {
    return this.request<EditorWorkshop[]>("/editor/workshops");
  }

  updateWorkshop(key: string, data: EditorWorkshopChanges) {
    return this.request<EditorWorkshop>(`/editor/workshops/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
  }

  async upload(file: File): Promise<EditorMedia> {
    const form = new FormData();
    form.append("files", file);
    const uploaded = await this.request<EditorMedia[]>("/upload", { method: "POST", body: form });
    if (!uploaded?.[0]) throw new Error("No se recibió el archivo cargado.");
    return uploaded[0];
  }

  async uploadMany(files: File[]): Promise<EditorMedia[]> {
    if (!files.length) return [];
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const uploaded = await this.request<EditorMedia[]>("/upload", { method: "POST", body: form });
    if (!Array.isArray(uploaded)) throw new Error("No se recibieron los archivos cargados.");
    return uploaded;
  }

  // ---------------------------------------------------------------- campus de AI Academy
  academyOverview() {
    return this.request<AcademyOverview>("/editor/academy");
  }

  academyWorkshop(key: string) {
    return this.request<AcademyDetail>(`/editor/academy/workshops/${encodeURIComponent(key)}`);
  }

  createAcademyWorkshop(data: Partial<AcademyWorkshop>) {
    return this.request<AcademyWorkshop>("/editor/academy/workshops", { method: "POST", body: JSON.stringify({ data }) });
  }

  updateAcademyWorkshop(key: string, data: Partial<AcademyWorkshop>) {
    return this.request<AcademyWorkshop>(`/editor/academy/workshops/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ data }) });
  }

  createBlock(data: { workshop: string; name: string; startDate?: string; totalSessions?: number }) {
    return this.request<AcademyBlock>("/editor/academy/blocks", { method: "POST", body: JSON.stringify({ data }) });
  }

  updateBlock(id: number, data: Partial<Pick<AcademyBlock, "name" | "startDate" | "totalSessions" | "currentSession">>) {
    return this.request<AcademyBlock>(`/editor/academy/blocks/${id}`, { method: "PUT", body: JSON.stringify({ data }) });
  }

  removeBlock(id: number) {
    return this.request<void>(`/editor/academy/blocks/${id}`, { method: "DELETE" });
  }

  enroll(data: { workshop: string; students: number[]; block?: number; status?: string }) {
    return this.request<{ created: number }>("/editor/academy/enrollments", { method: "POST", body: JSON.stringify({ data }) });
  }

  updateEnrollment(id: number, data: { block?: number; status?: string }) {
    return this.request<Partial<AcademyEnrollment>>(`/editor/academy/enrollments/${id}`, { method: "PUT", body: JSON.stringify({ data }) });
  }

  removeEnrollment(id: number) {
    return this.request<void>(`/editor/academy/enrollments/${id}`, { method: "DELETE" });
  }

  saveDiploma(data: Record<string, unknown>, id?: number) {
    return this.request<AcademyDiploma>(id ? `/editor/academy/diplomas/${id}` : "/editor/academy/diplomas", { method: id ? "PUT" : "POST", body: JSON.stringify({ data }) });
  }

  removeDiploma(id: number) {
    return this.request<void>(`/editor/academy/diplomas/${id}`, { method: "DELETE" });
  }

  saveTool(data: Record<string, unknown>, id?: number) {
    return this.request<AcademyTool>(id ? `/editor/academy/tools/${id}` : "/editor/academy/tools", { method: id ? "PUT" : "POST", body: JSON.stringify({ data }) });
  }

  removeTool(id: number) {
    return this.request<void>(`/editor/academy/tools/${id}`, { method: "DELETE" });
  }

  saveVideo(data: Record<string, unknown>, id?: number) {
    return this.request<AcademyVideo>(id ? `/editor/academy/videos/${id}` : "/editor/academy/videos", { method: id ? "PUT" : "POST", body: JSON.stringify({ data }) });
  }

  removeVideo(id: number) {
    return this.request<void>(`/editor/academy/videos/${id}`, { method: "DELETE" });
  }

  reorderAcademy(kind: "tools" | "videos", ids: number[]) {
    return this.request<{ ok: boolean }>(`/editor/academy/order/${kind}`, { method: "PUT", body: JSON.stringify({ ids }) });
  }

  academyUsers(role: "student" | "admin") {
    return this.request<{ canManageAdmins: boolean; users: AcademyPerson[] }>(`/editor/academy/users?role=${role}`);
  }

  createAcademyUser(data: Record<string, unknown>) {
    return this.request<{ id: number; email: string; fullName: string; temporaryPassword: string; active: boolean }>("/editor/academy/users", { method: "POST", body: JSON.stringify({ data }) });
  }

  updateAcademyUser(id: number, data: Record<string, unknown>) {
    return this.request<AcademyPerson>(`/editor/academy/users/${id}`, { method: "PUT", body: JSON.stringify({ data }) });
  }

  // Sin contraseña genera una temporal; con contraseña la deja activa de una vez.
  resetAcademyPassword(id: number, password = "") {
    return this.request<{ temporaryPassword: string; active: boolean }>(`/editor/academy/users/${id}/password`, { method: "POST", body: JSON.stringify({ data: password ? { password } : {} }) });
  }

  // Subida al almacén privado con progreso real (los videos pueden pesar cientos de MB).
  uploadAcademyFile(file: File, kind: "diploma" | "video", onProgress?: (value: number) => void) {
    return new Promise<AcademyFile>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `${this.cmsUrl}/api/editor/academy/files?kind=${kind}`);
      if (this.token) request.setRequestHeader("Authorization", `Bearer ${this.token}`);
      request.setRequestHeader("Accept", "application/json");
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        let payload: any = null;
        try { payload = JSON.parse(request.responseText); } catch { /* respuesta vacía */ }
        if (request.status >= 200 && request.status < 300 && payload?.data) resolve(payload.data as AcademyFile);
        else if (request.status === 413) reject(new Error("El archivo supera el límite del servidor."));
        else reject(new Error(payload?.error?.message || "El CMS no aceptó el archivo."));
      };
      request.onerror = () => reject(new Error("Se perdió la conexión con el CMS durante la subida."));
      const form = new FormData();
      form.append("file", file);
      request.send(form);
    });
  }

  fileUrl(file: Pick<AcademyFile, "url">) {
    return /^https?:\/\//.test(file.url) ? file.url : `${this.cmsUrl}${file.url}`;
  }
}
