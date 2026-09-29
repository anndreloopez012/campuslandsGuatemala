import { SERVICE_CATALOG } from "./recommendation.mjs";

export const SITE_URL = "https://www.campuslands.pro";
export const COLOMBIA_URL = "https://campuslands.com";
export const DEFAULT_IMAGE = `${SITE_URL}/img/og-campuslands-guatemala.jpg`;
export const LAST_CONTENT_UPDATE = "2026-09-29";

// Solo se publican alternos regionales cuando existe una página equivalente
// comprobada en Colombia. Un hreflang hacia una URL inexistente o no equivalente
// envía señales contradictorias a los buscadores.
export const COLOMBIA_ALTERNATES = {
  "/": `${COLOMBIA_URL}/`,
  "/joinUs/": `${COLOMBIA_URL}/joinUs/`,
  "/emplea/": `${COLOMBIA_URL}/servicios/emplea`,
  "/patrocina/": `${COLOMBIA_URL}/patrocina/`,
  "/nosotros/": `${COLOMBIA_URL}/nosotros/`,
  "/politica-de-privacidad/": `${COLOMBIA_URL}/privacidad`,
};

export const SITE = {
  name: "Campuslands Guatemala",
  locale: "es_GT",
  language: "es-GT",
  phone: "+50232705200",
  email: "contacto@campuslands.com",
  geo: {
    latitude: 14.6222193,
    longitude: -90.5142536,
  },
  address: {
    streetAddress: "Edificio Campus Tec, Vía 4 1-00, Zona 4, Torre 1, 7mo nivel",
    addressLocality: "Ciudad de Guatemala",
    addressRegion: "Guatemala",
    postalCode: "01004",
    addressCountry: "GT",
  },
};

export const PAGE_SEO = {
  "/": {
    title: "Campuslands Guatemala | Formación en Programación",
    description:
      "Formación intensiva y presencial en programación, inglés y habilidades profesionales para jóvenes con talento en Ciudad de Guatemala.",
    keywords: ["Campuslands Guatemala", "programación en Guatemala", "formación tecnológica"],
  },
  "/joinUs/": {
    title: "Estudia Programación en Guatemala | Campuslands",
    description:
      "Conviértete en Camper y fórmate en desarrollo de software, inglés y habilidades profesionales con Campuslands Guatemala.",
    keywords: ["estudiar programación", "curso de programación Guatemala", "Campuslands"],
  },
  "/ai-academy/": {
    title: "Talleres de Inteligencia Artificial en Guatemala | Campuslands",
    description:
      "Aprende IA aplicada en talleres presenciales de automatización, análisis de datos, marketing y finanzas: cuatro sábados y 16 horas.",
    keywords: [
      "talleres de inteligencia artificial Guatemala",
      "curso IA Guatemala",
      "automatización con IA",
      "AI Academy Campuslands",
    ],
  },
  "/blog/": {
    title: "Pulso Campuslands | Tecnología, comunidad y carrera",
    description:
      "Publicaciones de Campuslands Guatemala sobre inteligencia artificial, programación, comunidad y empleabilidad.",
    dynamic: true,
    keywords: [
      "Pulso Campuslands",
      "blog de tecnología Guatemala",
      "inteligencia artificial",
      "aprender programación",
      "empleabilidad tecnológica",
    ],
  },
  "/blog/galerias/": {
    title: "Galerías de Campuslands Guatemala | Comunidad Tech",
    description:
      "Explora galerías de Campuslands Guatemala con experiencias, actividades y momentos de nuestra comunidad de formación tecnológica en Campus Tec.",
    dynamic: true,
    keywords: [
      "galerías Campuslands Guatemala",
      "comunidad tecnológica Guatemala",
      "Campus Tec",
    ],
  },
  "/emplea/": {
    title: "Contrata Talento Tecnológico en Guatemala | Campuslands",
    description:
      "Conecta tu empresa con desarrolladores formados en programación, inglés y habilidades profesionales por Campuslands Guatemala.",
    keywords: ["contratar desarrolladores Guatemala", "talento tecnológico", "empleabilidad tech"],
  },
  "/patrocina/": {
    title: "Patrocina Talento Joven en Guatemala | Campuslands",
    description:
      "Impulsa la formación tecnológica de jóvenes guatemaltecos y genera impacto social mediante el programa de patrocinio de Campuslands.",
    keywords: ["patrocinio educativo", "impacto social Guatemala", "talento joven"],
  },
  "/nosotros/": {
    title: "Quiénes Somos | Campuslands Guatemala",
    description:
      "Conoce el modelo, la comunidad y el propósito de Campuslands Guatemala: formar talento joven para la industria tecnológica.",
    keywords: ["Campuslands Guatemala", "Campus Tec", "educación tecnológica"],
  },
  "/historia/": {
    title: "Historia de Campuslands | De Bangalore a Guatemala",
    description:
      "Vive la historia de Campuslands de 2017 a 2026: de una chispa en Bangalore al campus en Colombia y las primeras cohortes en Guatemala, guiada por Orbit.",
    keywords: [
      "historia de Campuslands",
      "Campuslands Guatemala",
      "Orbit Campuslands",
      "formación tecnológica en Latinoamérica",
    ],
  },
  "/terminos-condiciones/": {
    title: "Términos y condiciones | Campuslands Guatemala",
    description:
      "Consulta los términos y condiciones de participación en los programas formativos de Campuslands Guatemala.",
    keywords: ["términos Campuslands", "condiciones de participación"],
  },
  "/politica-de-privacidad/": {
    title: "Política de privacidad y datos | Campuslands Guatemala",
    description:
      "Consulta cómo Campuslands Guatemala recopila, utiliza, protege y administra los datos personales de estudiantes, familias, aliados y visitantes.",
    keywords: ["privacidad Campuslands", "protección de datos Guatemala"],
  },
};

export const INDEXABLE_PATHS = Object.keys(PAGE_SEO);

export function normalizePathname(pathname = "/") {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  if (cleanPath === "/") return "/";
  return `/${cleanPath.replace(/^\/+|\/+$/g, "")}/`;
}

export function absoluteUrl(base, pathname = "/") {
  return new URL(normalizePathname(pathname), base).toString();
}

export function colombiaAlternateFor(pathname = "/") {
  return COLOMBIA_ALTERNATES[normalizePathname(pathname)] ?? null;
}

export function organizationSchema() {
  return {
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE.name,
    legalName: "Campuslands Sociedad Anonima",
    alternateName: "Campuslands 502",
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
    },
    image: DEFAULT_IMAGE,
    description:
      "Centro de formación intensiva y presencial en desarrollo de software, inglés y habilidades profesionales en Guatemala.",
    slogan: "Formación tecnológica que transforma vidas",
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      ...SITE.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      ...SITE.geo,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "admisiones y atención general",
      telephone: SITE.phone,
      email: SITE.email,
      areaServed: "GT",
      availableLanguage: ["es"],
    },
    foundingDate: "2025",
    areaServed: {
      "@type": "Country",
      name: "Guatemala",
    },
    knowsAbout: [
      "Desarrollo de software",
      "Programación",
      "Inteligencia artificial aplicada",
      "Inglés",
      "Habilidades adaptativas",
      "Empleabilidad tecnológica",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servicios de Campuslands Guatemala",
      itemListElement: SERVICE_CATALOG.map((service) => {
        const url = new URL(service.path, SITE_URL).toString();
        return {
          "@type": "Offer",
          url,
          itemOffered: {
            "@type": service.type,
            "@id": `${url}#${service.id}`,
            name: service.name,
            description: service.description,
            url,
            audience: {
              "@type": "Audience",
              audienceType: service.audience,
            },
            provider: { "@id": `${SITE_URL}/#organization` },
            areaServed: { "@type": "Country", name: "Guatemala" },
          },
        };
      }),
    },
    sameAs: [
      "https://www.facebook.com/campuslandsgt/",
      "https://www.instagram.com/campuslands502/",
      "https://www.linkedin.com/company/campuslands-guatemala/",
    ],
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE.name,
    inLanguage: SITE.language,
    publisher: { "@id": `${SITE_URL}/#organization` },
    hasPart: Object.entries(PAGE_SEO).map(([path, page]) => {
      const url = absoluteUrl(SITE_URL, path);
      return {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: SITE.language,
      };
    }),
  };
}
