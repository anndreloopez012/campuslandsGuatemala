import type { APIRoute } from "astro";
import { CAMPUS_COOKIE, CMS_URL } from "~/lib/academy-campus";

export const prerender = false;

// Diplomas y videos del campus: pasan por aquí con la sesión del estudiante.
// El CMS revisa que el archivo sea suyo; sin sesión o con un archivo ajeno no se entrega nada.
export const GET: APIRoute = async ({ params, request, cookies, url }) => {
  const token = cookies.get(CAMPUS_COOKIE)?.value;
  const id = Number(params.id);
  if (!token) return new Response("Inicia sesión en tu campus para abrir este archivo.", { status: 401 });
  if (!Number.isInteger(id) || id <= 0) return new Response("Archivo no válido.", { status: 400 });

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const download = url.searchParams.get("dl") === "1" ? "?dl=1" : "";
  const upstream = await fetch(`${CMS_URL}/api/academy/me/files/${id}${download}`, { headers }).catch(() => null);
  if (!upstream) return new Response("No pudimos conectar con el campus.", { status: 502 });
  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    return new Response(payload?.error?.message || "No tienes acceso a este archivo.", { status: upstream.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const out = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
};
