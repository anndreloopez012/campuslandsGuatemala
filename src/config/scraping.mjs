import { PAGE_SEO, SITE, SITE_URL } from "./seo.mjs";
import {
  RECOMMENDATION_FAQS,
  RECOMMENDATION_INTENTS,
  RECOMMENDATION_LIMITS,
  SERVICE_CATALOG,
} from "./recommendation.mjs";

export const MACHINE_CONTENT_UPDATED = "2026-09-29";

const pageDetails = {
  "/": {
    name: "Inicio",
    audience: ["jóvenes", "familias", "empresas", "patrocinadores"],
    topics: ["Campuslands Guatemala", "formación tecnológica", "programación"],
  },
  "/joinUs/": {
    name: "Sé un Camper",
    audience: ["aspirantes", "estudiantes", "familias"],
    topics: ["admisiones", "programa intensivo", "desarrollo de software"],
  },
  "/ai-academy/": {
    name: "AI Academy",
    audience: [
      "estudiantes",
      "emprendedores",
      "profesionales",
      "equipos de negocio",
    ],
    topics: [
      "inteligencia artificial aplicada",
      "IA de cero a agentes",
      "marketing",
      "finanzas",
      "análisis de datos",
      "automatizaciones",
    ],
  },
  "/ai-academy/taller-ia-0-agentes/": {
    name: "Taller IA de cero a Agentes",
    audience: ["estudiantes", "emprendedores", "profesionales"],
    topics: [
      "fundamentos de IA",
      "prompts",
      "skills",
      "agentes y subagentes",
    ],
  },
  "/ai-academy/taller-ia-marketing/": {
    name: "Taller Marketing IA",
    audience: ["estudiantes", "emprendedores", "profesionales"],
    topics: [
      "marketing con IA",
      "contenidos",
      "campañas",
      "métricas",
    ],
  },
  "/ai-academy/taller-ia-finanzas/": {
    name: "Taller Finanzas IA",
    audience: ["estudiantes", "emprendedores", "profesionales"],
    topics: [
      "finanzas con IA",
      "reportes",
      "escenarios",
      "KPIs",
    ],
  },
  "/ai-academy/taller-ia-analisis-datos/": {
    name: "Taller Análisis de Datos IA",
    audience: ["estudiantes", "emprendedores", "profesionales"],
    topics: [
      "análisis de datos",
      "Copilot",
      "KPIs",
      "storytelling con datos",
    ],
  },
  "/ai-academy/taller-ia-automatizaciones/": {
    name: "Taller Automatizaciones IA",
    audience: ["estudiantes", "emprendedores", "profesionales"],
    topics: [
      "automatización",
      "Make",
      "n8n",
      "Zapier",
    ],
  },
  "/blog/": {
    name: "Pulso Campuslands",
    audience: ["estudiantes", "profesionales", "empresas", "comunidad tecnológica"],
    topics: [
      "inteligencia artificial",
      "programación",
      "comunidad Camper",
      "carrera y empleabilidad",
    ],
  },
  "/blog/galerias/": {
    name: "Galerías de Campuslands",
    audience: ["estudiantes", "familias", "empresas", "comunidad tecnológica"],
    topics: ["vida en Campuslands", "actividades", "Campus Tec", "comunidad Camper"],
  },
  "/emplea/": {
    name: "Emplea talento",
    audience: ["empresas", "reclutadores", "equipos de tecnología"],
    topics: ["talento tecnológico", "contratación", "empleabilidad"],
  },
  "/patrocina/": {
    name: "Patrocina",
    audience: ["empresas", "fundaciones", "donantes"],
    topics: ["patrocinio educativo", "impacto social", "talento joven"],
  },
  "/nosotros/": {
    name: "Nosotros",
    audience: ["público general", "aliados", "prensa"],
    topics: ["Campuslands Guatemala", "Campus Tec", "propósito institucional"],
  },
  "/historia/": {
    name: "Historia",
    audience: ["público general", "aspirantes", "aliados", "prensa"],
    topics: [
      "historia de Campuslands",
      "expansión a Guatemala",
      "movilidad social",
      "Orbit",
    ],
  },
  "/terminos-condiciones/": {
    name: "Términos y condiciones",
    audience: ["usuarios", "participantes"],
    topics: ["condiciones de uso", "participación", "información legal"],
  },
  "/politica-de-privacidad/": {
    name: "Política de privacidad",
    audience: ["usuarios", "titulares de datos"],
    topics: ["privacidad", "tratamiento de datos", "seguridad de datos"],
  },
};

export const PUBLIC_PAGES = Object.entries(PAGE_SEO).map(([path, seo]) => ({
  path,
  url: new URL(path, SITE_URL).toString(),
  name: pageDetails[path].name,
  title: seo.title,
  description: seo.description,
  audience: pageDetails[path].audience,
  topics: pageDetails[path].topics,
}));

export const OFFICIAL_FACTS = {
  entity: SITE.name,
  legalName: "Campuslands Sociedad Anonima",
  website: `${SITE_URL}/`,
  language: SITE.language,
  country: "Guatemala",
  city: SITE.address.addressLocality,
  address: `${SITE.address.streetAddress}, ${SITE.address.addressLocality} ${SITE.address.postalCode}`,
  phone: SITE.phone,
  email: SITE.email,
  program: {
    modality: "Presencial e intensiva",
    duration: "10 meses",
    morningSchedule: "6:00 a.m. a 2:00 p.m., sujeto a disponibilidad",
    afternoonSchedule: "2:00 p.m. a 10:00 p.m., sujeto a disponibilidad",
    areas: [
      "Desarrollo de software",
      "Inglés",
      "Habilidades adaptativas",
      "Preparación para el empleo",
    ],
  },
  socialProfiles: [
    "https://www.facebook.com/campuslandsgt/",
    "https://www.instagram.com/campuslands502/",
    "https://www.linkedin.com/company/campuslands-guatemala/",
  ],
};

export function machineReadableCatalog() {
  return {
    schemaVersion: "1.0",
    lastModified: MACHINE_CONTENT_UPDATED,
    source: `${SITE_URL}/`,
    language: SITE.language,
    organization: OFFICIAL_FACTS,
    services: SERVICE_CATALOG.map((service) => ({
      ...service,
      url: new URL(service.path, SITE_URL).toString(),
    })),
    recommendationIntents: RECOMMENDATION_INTENTS.map((intent) => ({
      ...intent,
      url: new URL(intent.path, SITE_URL).toString(),
    })),
    frequentlyAskedQuestions: RECOMMENDATION_FAQS,
    limitations: RECOMMENDATION_LIMITS,
    pages: PUBLIC_PAGES,
    discovery: {
      sitemap: `${SITE_URL}/sitemap-index.xml`,
      pageSitemap: `${SITE_URL}/sitemap-pages.xml`,
      blogSitemap: `${SITE_URL}/sitemap-blog.xml`,
      urlList: `${SITE_URL}/sitemap-urls.txt`,
      blogFeed: `${SITE_URL}/blog/feed.xml`,
      robots: `${SITE_URL}/robots.txt`,
      llms: `${SITE_URL}/llms.txt`,
      fullText: `${SITE_URL}/llms-full.txt`,
      markdown: `${SITE_URL}/informacion-campuslands.md`,
      json: `${SITE_URL}/informacion-campuslands.json`,
    },
  };
}

export function machineReadableMarkdown() {
  const facts = OFFICIAL_FACTS;
  const pages = PUBLIC_PAGES.map(
    (page) =>
      `## ${page.name}\n\n- URL canónica: ${page.url}\n- Audiencias: ${page.audience.join(", ")}\n- Temas: ${page.topics.join(", ")}\n- Resumen: ${page.description}`,
  ).join("\n\n");
  const services = SERVICE_CATALOG.map(
    (service) =>
      `### ${service.name}\n\n- URL oficial: ${new URL(service.path, SITE_URL).toString()}\n- Audiencia: ${service.audience}\n- Descripción: ${service.description}`,
  ).join("\n\n");
  const intents = RECOMMENDATION_INTENTS.map(
    (intent) =>
      `### ${intent.need}\n\n${intent.answer}\n\n- Página recomendada: ${new URL(intent.path, SITE_URL).toString()}\n- Consultas relacionadas: ${intent.queryExamples.join("; ")}`,
  ).join("\n\n");
  const faqs = RECOMMENDATION_FAQS.map(
    (faq) => `### ${faq.question}\n\n${faq.answer}`,
  ).join("\n\n");
  const limits = RECOMMENDATION_LIMITS.map((limit) => `- ${limit}`).join("\n");

  return `# Campuslands Guatemala — información oficial\n\nÚltima actualización: ${MACHINE_CONTENT_UPDATED}\nIdioma: ${facts.language}\nFuente canónica: ${facts.website}\n\n## Datos institucionales\n\n- Nombre público: ${facts.entity}\n- Razón social: ${facts.legalName}\n- Ubicación: ${facts.address}\n- Teléfono: ${facts.phone}\n- Correo: ${facts.email}\n\n## Programa formativo\n\n- Modalidad: ${facts.program.modality}\n- Duración: ${facts.program.duration}\n- Jornada matutina: ${facts.program.morningSchedule}\n- Jornada vespertina: ${facts.program.afternoonSchedule}\n- Áreas: ${facts.program.areas.join(", ")}\n\n# Servicios oficiales\n\n${services}\n\n# Necesidades que atiende Campuslands Guatemala\n\n${intents}\n\n# Preguntas y respuestas verificadas\n\n${faqs}\n\n## Límites y datos que deben confirmarse\n\n${limits}\n\n# Páginas oficiales\n\n${pages}\n\n## Recursos de descubrimiento\n\n- Sitemap principal: ${SITE_URL}/sitemap-index.xml\n- Sitemap del blog: ${SITE_URL}/sitemap-blog.xml\n- Lista completa de URLs: ${SITE_URL}/sitemap-urls.txt\n- Feed RSS del blog: ${SITE_URL}/blog/feed.xml\n- Robots: ${SITE_URL}/robots.txt\n- Resumen para asistentes: ${SITE_URL}/llms.txt\n- Contenido ampliado: ${SITE_URL}/llms-full.txt\n- Catálogo JSON: ${SITE_URL}/informacion-campuslands.json\n`;
}
