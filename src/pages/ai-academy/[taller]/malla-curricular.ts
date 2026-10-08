import type { APIRoute } from "astro";
import { getLiveWorkshop } from "~/lib/ai-academy";

export const prerender = false;

const fileName = (slug: string) => `Malla-curricular-${slug}-Campuslands-AI-Academy.pdf`;

// Descarga con nombre claro y enlace directo para compartir. Sin malla cargada, vuelve a la
// página del taller (que ofrece pedirla por WhatsApp).
export const GET: APIRoute = async ({ params, url, redirect }) => {
  const slug = String(params.taller ?? "");
  const workshop = await getLiveWorkshop(slug);
  if (!workshop) return new Response("Taller no encontrado", { status: 404 });
  if (!workshop.curriculum) return redirect(`/ai-academy/${workshop.slug}/#malla-curricular`, 302);

  let upstream: Response;
  try {
    upstream = await fetch(workshop.curriculum.url, { signal: AbortSignal.timeout(20000) });
  } catch {
    return redirect(`/ai-academy/${workshop.slug}/#malla-curricular`, 302);
  }
  if (!upstream.ok || !upstream.body) return redirect(`/ai-academy/${workshop.slug}/#malla-curricular`, 302);

  const inline = url.searchParams.has("ver");
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName(workshop.slug)}"`,
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { status: 200, headers });
};
