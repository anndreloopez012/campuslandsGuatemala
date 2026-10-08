import type { APIRoute } from "astro";
import { saveVideoProgress } from "~/lib/academy-campus";

export const prerender = false;

// El reproductor guarda dónde quedó el estudiante; la sesión va en la cookie, no en el navegador.
export const POST: APIRoute = async ({ cookies, request }) => {
  const body = await request.json().catch(() => ({}));
  const videoId = Number(body.videoId);
  if (!Number.isInteger(videoId) || videoId <= 0) return new Response(null, { status: 400 });
  const { status } = await saveVideoProgress(cookies, videoId, Math.max(0, Number(body.seconds) || 0), body.completed === true);
  return new Response(null, { status: status >= 200 && status < 300 ? 204 : status });
};
