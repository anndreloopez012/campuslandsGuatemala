import type { AstroCookies } from "astro";

// Sesión del campus de estudiantes de AI Academy. El token vive en una cookie httpOnly y todas
// las llamadas al CMS salen del servidor: el navegador nunca ve el token ni contenido ajeno.

const runtimeCmsUrl = import.meta.env.SSR && typeof process !== "undefined" ? process.env.PUBLIC_CMS_URL : undefined;
export const CMS_URL = String(runtimeCmsUrl || import.meta.env.PUBLIC_CMS_URL || "http://127.0.0.1:1337").replace(/\/+$/, "");

export const CAMPUS_COOKIE = "cl_ai_campus";
const MAX_AGE = 60 * 60 * 24 * 7;

export type CampusFile = { id: number; name: string; mime: string; size: number };
export type CampusDiploma = {
  id: number; credentialId: string; title: string; issuedAt: string; hours: number; skills: string[]; status: string; file: CampusFile | null;
  design?: { issuer?: string; place: string; signer: string; signerRole: string } | null;
};
export type CampusTool = { id: number; title: string; url: string; description: string; category: string };
export type CampusVideo = {
  id: number; title: string; description: string; session: number | null; source: "archivo" | "enlace"; externalUrl: string;
  durationSeconds: number | null; file: CampusFile | null; progress: { seconds: number; completed: boolean };
  // true si el bloque del alumno aún no llega a ese sábado: se muestra con candado y sin archivo.
  locked?: boolean;
};
// Bloque del alumno: su edición del taller. El avance lo define el administrador por sesión.
export type CampusBlock = {
  id: number; name: string; startDate: string; totalSessions: number; currentSession: number; progress: number;
  status: "por-iniciar" | "en-curso" | "finalizado";
};
export type CampusWorkshop = {
  key: string; slug: string; code: string; title: string; accent: string; description: string; hours: number; isPublic: boolean;
  enrollment: { cohort: string; status: string; enrolledAt: string };
  block: CampusBlock | null;
  diplomas: CampusDiploma[]; tools: CampusTool[]; videos: CampusVideo[];
};
export type CampusData = { student: { id: number; email: string; fullName: string; mustChangePassword: boolean }; workshops: CampusWorkshop[] };

// Los archivos del campus solo se abren con la sesión del estudiante dueño (ver campus/archivo/[id].ts).
export const campusFileUrl = (file: Pick<CampusFile, "id">, download = false) => `/ai-academy/campus/archivo/${file.id}/${download ? "?dl=1" : ""}`;

export function setCampusSession(cookies: AstroCookies, token: string) {
  cookies.set(CAMPUS_COOKIE, token, { httpOnly: true, secure: import.meta.env.PROD, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export function clearCampusSession(cookies: AstroCookies) {
  cookies.delete(CAMPUS_COOKIE, { path: "/" });
}

async function cms(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${CMS_URL}/api${path}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

// Inicia sesión y comprueba que la cuenta sea de estudiante: un administrador no entra al campus.
export async function loginStudent(email: string, password: string) {
  let login;
  try {
    login = await cms("/auth/local", { method: "POST", body: JSON.stringify({ identifier: email.trim().toLowerCase(), password }) });
  } catch {
    return { error: "No pudimos conectar con el campus. Intenta de nuevo en un momento." } as const;
  }
  if (!login.ok || !login.payload?.jwt) {
    const message = String(login.payload?.error?.message || "");
    if (/blocked/i.test(message)) return { error: "Tu cuenta está pausada. Escríbenos y te ayudamos a reactivarla." } as const;
    if (login.status === 429) return { error: "Demasiados intentos. Espera un minuto y vuelve a probar." } as const;
    return { error: "El correo o la contraseña no coinciden." } as const;
  }
  const me = await cms("/academy/me", { token: login.payload.jwt });
  if (!me.ok) return { error: "Esta cuenta no es de estudiante. Los administradores entran por el panel de administración." } as const;
  return { token: login.payload.jwt as string, data: me.payload.data as CampusData } as const;
}

export async function campusData(cookies: AstroCookies): Promise<CampusData | null> {
  const token = cookies.get(CAMPUS_COOKIE)?.value;
  if (!token) return null;
  try {
    const me = await cms("/academy/me", { token });
    if (me.ok) return me.payload.data as CampusData;
  } catch {
    return null;
  }
  clearCampusSession(cookies);
  return null;
}

export async function changeStudentPassword(cookies: AstroCookies, currentPassword: string, newPassword: string) {
  const token = cookies.get(CAMPUS_COOKIE)?.value;
  if (!token) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  const result = await cms("/academy/me/password", { method: "PUT", token, body: JSON.stringify({ currentPassword, newPassword }) });
  if (!result.ok) return { error: String(result.payload?.error?.message || "No se pudo cambiar la contraseña.") };
  return { ok: true };
}

export async function saveVideoProgress(cookies: AstroCookies, videoId: number, seconds: number, completed: boolean) {
  const token = cookies.get(CAMPUS_COOKIE)?.value;
  if (!token) return { status: 401 };
  const result = await cms(`/academy/progress/${videoId}`, { method: "PUT", token, body: JSON.stringify({ seconds, completed }) });
  return { status: result.status };
}

export async function verifyDiploma(credentialId: string) {
  try {
    const result = await cms(`/academy/diplomas/${encodeURIComponent(credentialId)}`);
    return result.ok ? result.payload.data : null;
  } catch {
    return null;
  }
}

const LINKEDIN_ORG_ID = String((typeof process !== "undefined" && process.env.PUBLIC_LINKEDIN_ORG_ID) || import.meta.env.PUBLIC_LINKEDIN_ORG_ID || "");

// Botón "Agregar a LinkedIn": abre el formulario de certificaciones del perfil ya lleno.
export function linkedinAddUrl(diploma: Pick<CampusDiploma, "title" | "issuedAt" | "credentialId">, verifyUrl: string) {
  const issued = new Date(`${diploma.issuedAt}T12:00:00Z`);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: diploma.title,
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: verifyUrl,
    certId: diploma.credentialId,
  });
  if (LINKEDIN_ORG_ID) params.set("organizationId", LINKEDIN_ORG_ID);
  else params.set("organizationName", "Campuslands Guatemala");
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export const linkedinShareUrl = (verifyUrl: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(Math.round(seconds % 60)).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function formatDiplomaDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

// YouTube y Vimeo se incrustan; cualquier otro enlace se abre aparte.
export function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}?rel=0`;
    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : "";
    }
    if (host === "vimeo.com") return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean)[0]}`;
    if (host === "player.vimeo.com") return url;
  } catch {
    return "";
  }
  return "";
}
