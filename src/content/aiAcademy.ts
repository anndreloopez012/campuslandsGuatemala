// Talleres de AI Academy: contenido fijo de cada taller. Lo que cambia seguido (inscripciones
// abiertas, fecha de inicio y malla curricular en PDF) vive en el CMS y se administra desde
// /blog-admin; ver src/lib/ai-academy.ts.

export const AI_ACADEMY_WHATSAPP = "50232705200";

export interface AiAcademySession {
  title: string;
  description: string;
  output: string;
}

export interface AiAcademyWorkshop {
  id: string;
  slug: string;
  accent: string;
  code: string;
  cohort?: string;
  eyebrow?: string;
  title: string;
  fullName?: string;
  promise: string;
  audience: string;
  tools: string[];
  sessions: AiAcademySession[];
  final: string;
}

export interface AiAcademyWorkshopState {
  isOpen: boolean;
  startDate: string;
}

export const AI_ACADEMY_DEFAULT_STATE: Record<string, AiAcademyWorkshopState> = {
  "ia-cero-agentes": { isOpen: true, startDate: "24 de octubre" },
  marketing: { isOpen: false, startDate: "Próximamente" },
  finanzas: { isOpen: false, startDate: "Próximamente" },
  datos: { isOpen: false, startDate: "Próximamente" },
  automatizaciones: { isOpen: false, startDate: "Próximamente" },
};

export const AI_ACADEMY_WORKSHOPS: AiAcademyWorkshop[] = [
  {
    id: "ia-cero-agentes",
    slug: "taller-ia-0-agentes",
    accent: "#57bbff",
    code: "IA.01",
    cohort: "INICIA 24 DE OCTUBRE",
    eyebrow: "Taller Práctico:",
    title: "IA de cero a Agentes",
    fullName: "Taller Práctico: IA de cero a Agentes",
    promise:
      "Aprende a utilizar la inteligencia artificial con un método claro, desde la configuración inicial hasta la creación de agentes y subagentes.",
    audience:
      "Profesionales, emprendedores y estudiantes sin experiencia previa en programación que desean dirigir la IA.",
    tools: ["ChatGPT", "Claude", "Gemini", "Skills & Agentes"],
    sessions: [
      {
        title: "Configuración y fundamentos",
        description:
          "Configurarás correctamente ChatGPT, Claude y Gemini. Conocerás sus funciones principales, diferencias, límites, comandos y buenas prácticas para utilizarlas de manera segura y efectiva.",
        output: "Cuentas configuradas + kit base",
      },
      {
        title: "Prompts que generan mejores resultados",
        description:
          "Aprenderás a darle instrucciones claras a la IA utilizando objetivos, contexto, roles, restricciones, formatos, ejemplos, hooks y loops. Practicarás estructuras reutilizables para tareas reales.",
        output: "Biblioteca de prompts reutilizables",
      },
      {
        title: "Creación de Skills",
        description:
          "Convertirás tareas repetitivas en instrucciones organizadas y reutilizables. Diseñarás una skill paso a paso, la probarás y aprenderás a mejorarla (requiere plan de pago en ChatGPT, Claude o Gemini).",
        output: "Skill funcional creada",
      },
      {
        title: "Agentes y subagentes",
        description:
          "Construirás un agente capaz de ejecutar tareas con un objetivo definido. También aprenderás a utilizar subagentes especializados, coordinar responsabilidades, establecer límites y verificar sus resultados.",
        output: "Agente coordinador con subagentes",
      },
    ],
    final:
      "Un agente coordinador con subagentes especializados, biblioteca de prompts reutilizables y skill funcional para tus metas.",
  },
  {
    id: "marketing",
    slug: "taller-ia-marketing",
    accent: "#ff7ad9",
    code: "MKT.02",
    title: "Marketing IA",
    promise:
      "Construye un sistema de marketing que investiga, crea, distribuye y aprende con mayor velocidad.",
    audience:
      "Emprendedores, estudiantes, creadores de contenido y equipos comerciales.",
    tools: ["Prompts", "Automatización", "Agentes", "Contenido"],
    sessions: [
      {
        title: "Comprende la marca",
        description:
          "Domina prompts, analiza la marca, define buyer personas y compara competidores.",
        output: "Diagnóstico de marca",
      },
      {
        title: "Crea con dirección",
        description:
          "Genera ideas, hooks, copies, guiones y un calendario editorial de 30 días.",
        output: "Sistema de contenidos",
      },
      {
        title: "Convierte atención",
        description:
          "Define propuesta de valor, funnel, anuncios y secuencias para WhatsApp o mensajes directos.",
        output: "Campaña de 7 días",
      },
      {
        title: "Mide y escala",
        description:
          "Reutiliza contenido, analiza métricas y consolida una biblioteca de prompts para la marca.",
        output: "Plan de marketing de 30 días",
      },
    ],
    final:
      "Un sistema de marketing para una marca: estrategia, contenido, campaña y medición.",
  },
  {
    id: "finanzas",
    slug: "taller-ia-finanzas",
    accent: "#7fffdc",
    code: "FIN.03",
    title: "Finanzas IA",
    promise:
      "Lleva finanzas de la operación transaccional a una función estratégica que recomienda y decide.",
    audience:
      "Profesionales de finanzas, contabilidad, administración, planeación y negocio.",
    tools: ["IA generativa", "Excel", "Escenarios", "KPIs"],
    sessions: [
      {
        title: "Mapea el valor",
        description:
          "Identifica oportunidades de IA en flujos financieros y prioriza por impacto, riesgo y trazabilidad.",
        output: "Mapa estratégico de IA",
      },
      {
        title: "Ordena y reporta",
        description:
          "Estructura datos y transforma reportes financieros en información ejecutiva.",
        output: "Reporte financiero optimizado",
      },
      {
        title: "Anticipa escenarios",
        description:
          "Modela escenarios, analiza variaciones y rediseña procesos financieros críticos.",
        output: "Modelo de escenarios",
      },
      {
        title: "Decide e influye",
        description:
          "Conecta KPIs, recomendaciones y narrativa ejecutiva en un marco de decisión financiera.",
        output: "Framework de decisión",
      },
    ],
    final:
      "Un blueprint financiero con procesos, escenarios, KPIs y narrativa para dirección.",
  },
  {
    id: "datos",
    slug: "taller-ia-analisis-datos",
    accent: "#ffc56b",
    code: "DATA.04",
    title: "Análisis de Datos IA",
    promise:
      "Pasa de datos dispersos a hallazgos confiables, visualizaciones claras y decisiones accionables.",
    audience:
      "Analistas y equipos de negocio, operaciones, ventas, finanzas o marketing.",
    tools: ["Copilot", "Excel", "KPIs", "Storytelling"],
    sessions: [
      {
        title: "Pregunta y prepara",
        description:
          "Define la pregunta de negocio, limpia datos y establece criterios de validación.",
        output: "Dataset listo para analizar",
      },
      {
        title: "Encuentra patrones",
        description:
          "Explora tendencias, formula hipótesis y convierte hallazgos en visualizaciones comprensibles.",
        output: "Resumen de insights",
      },
      {
        title: "Diseña KPIs",
        description:
          "Construye métricas útiles y un flujo de análisis reutilizable con Copilot.",
        output: "Sistema de KPIs",
      },
      {
        title: "Influye con evidencia",
        description:
          "Crea una narrativa ejecutiva y un sistema de decisión que conecte insight, acción y seguimiento.",
        output: "Blueprint de decisión",
      },
    ],
    final:
      "Un flujo de análisis reproducible con KPIs, visualización y narrativa ejecutiva.",
  },
  {
    id: "automatizaciones",
    slug: "taller-ia-automatizaciones",
    accent: "#b997ff",
    code: "AUTO.05",
    title: "Automatizaciones IA",
    promise:
      "Convierte tareas repetitivas en flujos que trabajan contigo y dejan tiempo para decisiones de mayor valor.",
    audience:
      "Emprendedores, estudiantes y equipos administrativos, comerciales u operativos.",
    tools: ["Make", "n8n", "Zapier", "IA generativa"],
    sessions: [
      {
        title: "Detecta oportunidades",
        description:
          "Mapea procesos, identifica cuellos de botella y crea un kit de prompts para la operación diaria.",
        output: "Mapa de proceso + SOP",
      },
      {
        title: "Conecta sin código",
        description:
          "Integra formularios, hojas de cálculo, correo, Notion, Airtable y mensajería.",
        output: "3 automatizaciones diseñadas",
      },
      {
        title: "Activa la inteligencia",
        description:
          "Clasifica información, resume documentos y genera reportes con salidas estructuradas.",
        output: "Flujo con IA validado",
      },
      {
        title: "Lanza tu sistema",
        description:
          "Construye, prueba y presenta una automatización completa con control humano y manejo de errores.",
        output: "Automatización funcional",
      },
    ],
    final:
      "Una automatización implementada, checklist de validación y presentación ejecutiva.",
  },
];

export const AI_ACADEMY_FAQS = [
  {
    question: "¿Necesito experiencia previa usando inteligencia artificial?",
    answer:
      "No. Los talleres parten de fundamentos prácticos y avanzan mediante ejercicios guiados. No necesitas saber programación ni tener experiencia previa, solamente curiosidad y ganas de experimentar con situaciones reales.",
  },
  {
    question: "¿Necesito saber programar?",
    answer:
      "No. No necesitas saber programación ni tener experiencia previa. Talleres como 'IA de cero a Agentes' y 'Automatizaciones IA' parten desde los fundamentos prácticos, configuración y herramientas no-code para aplicar la inteligencia artificial a tus metas.",
  },
  {
    question: "¿Cómo se distribuyen las 16 horas?",
    answer:
      "Cada taller se desarrolla en cuatro sesiones de 4 horas (16 horas en total), combinando un 50% de fundamentos y método con un 50% de práctica individual donde construyes tu proyecto paso a paso.",
  },
  {
    question: "¿Los talleres son presenciales?",
    answer:
      "La propuesta publicada de AI Academy es presencial en Campuslands Guatemala, dentro de Campus Tec, Zona 4. Confirma la cohorte y el horario disponibles con nuestro equipo.",
  },
  {
    question: "¿Qué debo llevar?",
    answer:
      "Una computadora portátil y acceso a las cuentas o herramientas indicadas antes de iniciar. Los requisitos específicos pueden variar según el taller.",
  },
  {
    question: "¿Las herramientas de IA están incluidas?",
    answer:
      "Algunas ofrecen planes gratuitos y otras pueden requerir suscripción activa. Para el taller 'IA de cero a Agentes', la clase de creación de Skills requiere una cuenta de pago en ChatGPT, Claude o Gemini. Antes de cada cohorte te compartiremos la lista detallada para que puedas prepararte.",
  },
  {
    question: "¿Con qué termino el taller?",
    answer:
      "Terminas con un proyecto aplicado a tu realidad: un agente coordinador con subagentes y biblioteca de prompts, un sistema de marketing, un blueprint financiero, un análisis de datos o una automatización funcional, según el taller elegido.",
  },
  {
    question: "¿Cuándo inicia la próxima cohorte y cuál es el costo?",
    answer:
      "Iniciamos el 24 de octubre. Las fechas, cupos y costos se confirman directamente con el equipo de Campuslands Guatemala. Escribe 'IA' por mensaje directo o WhatsApp para recibir la información de inscripción y consultar las opciones de pago con tarjeta.",
  },
];

export const workshopPath = (workshop: Pick<AiAcademyWorkshop, "slug">) => `/ai-academy/${workshop.slug}/`;

export const workshopName = (workshop: AiAcademyWorkshop) => workshop.fullName || workshop.title;

export const workshopBySlug = (slug: string) =>
  AI_ACADEMY_WORKSHOPS.find((workshop) => workshop.slug === slug.replace(/\/+$/, ""));

export const workshopWhatsappUrl = (workshop?: AiAcademyWorkshop) => {
  const text = !workshop
    ? "¡Hola! Me interesan los talleres de AI Academy de Campuslands Guatemala. ¿Podrían compartirme fechas, disponibilidad y costos?"
    : workshop.id === "ia-cero-agentes"
      ? "¡Hola! Escribo IA para recibir la información de inscripción, fechas y consultar las opciones de pago con tarjeta para el Taller Práctico: IA de cero a Agentes de Campuslands Guatemala."
      : `¡Hola! Me interesa el taller "${workshop.title}" de AI Academy en Campuslands Guatemala. ¿Podrían compartirme fechas, disponibilidad y costos?`;
  return `https://wa.me/${AI_ACADEMY_WHATSAPP}?text=${encodeURIComponent(text)}`;
};
