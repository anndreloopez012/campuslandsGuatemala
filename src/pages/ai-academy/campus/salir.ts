import type { APIRoute } from "astro";
import { clearCampusSession } from "~/lib/academy-campus";

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  clearCampusSession(cookies);
  return redirect("/ai-academy/acceso/", 303);
};

export const GET = POST;
