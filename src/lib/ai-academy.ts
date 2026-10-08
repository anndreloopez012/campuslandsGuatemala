import {
  AI_ACADEMY_DEFAULT_STATE,
  AI_ACADEMY_WORKSHOPS,
  type AiAcademyWorkshop,
  type AiAcademyWorkshopState,
} from "~/content/aiAcademy";

const runtimeCmsUrl = import.meta.env.SSR && typeof process !== "undefined"
  ? process.env.PUBLIC_CMS_URL
  : undefined;
const CMS_URL = String(runtimeCmsUrl || import.meta.env.PUBLIC_CMS_URL || "http://127.0.0.1:1337").replace(/\/+$/, "");

export interface WorkshopCurriculum {
  url: string;
  name: string;
  size: number;
  updatedAt: string;
}

export interface LiveWorkshop extends AiAcademyWorkshop, AiAcademyWorkshopState {
  curriculum: WorkshopCurriculum | null;
}

type CmsWorkshop = {
  key?: string;
  isOpen?: boolean;
  startDate?: string | null;
  curriculum?: { url?: string; name?: string; size?: number; mime?: string; updatedAt?: string } | null;
};

export const cmsAssetUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${CMS_URL}${url.startsWith("/") ? "" : "/"}${url}`);

// Estado vivo de los talleres (inscripciones, fecha y malla). Si el CMS no responde, la página
// se arma igual con los valores por defecto: nunca se rompe por el CMS.
export async function getLiveWorkshops(): Promise<LiveWorkshop[]> {
  const fromCms = new Map<string, CmsWorkshop>();
  try {
    const response = await fetch(`${CMS_URL}/api/workshops?populate=curriculum&pagination[pageSize]=20`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const payload = await response.json();
      for (const item of (payload?.data ?? []) as CmsWorkshop[]) {
        if (item?.key) fromCms.set(item.key, item);
      }
    }
  } catch (error) {
    console.warn("[AI Academy] No se pudo leer el estado de los talleres desde el CMS:", error);
  }

  return AI_ACADEMY_WORKSHOPS.map((workshop) => {
    const fallback = AI_ACADEMY_DEFAULT_STATE[workshop.id] ?? { isOpen: false, startDate: "Próximamente" };
    const live = fromCms.get(workshop.id);
    const file = live?.curriculum;
    return {
      ...workshop,
      isOpen: typeof live?.isOpen === "boolean" ? live.isOpen : fallback.isOpen,
      startDate: live?.startDate?.trim() || fallback.startDate,
      curriculum:
        file?.url && file.mime === "application/pdf"
          ? { url: cmsAssetUrl(file.url), name: file.name || "malla-curricular.pdf", size: Number(file.size) || 0, updatedAt: file.updatedAt || "" }
          : null,
    };
  });
}

export async function getLiveWorkshop(slug: string): Promise<LiveWorkshop | undefined> {
  const clean = slug.replace(/\/+$/, "");
  return (await getLiveWorkshops()).find((workshop) => workshop.slug === clean);
}

export const curriculumPath = (workshop: Pick<AiAcademyWorkshop, "slug">) => `/ai-academy/${workshop.slug}/malla-curricular`;

// Strapi guarda el tamaño en KB.
export function formatFileSize(kilobytes: number) {
  if (!kilobytes) return "";
  return kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kilobytes))} KB`;
}

export function formatUpdatedAt(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Guatemala" }).format(date);
}
