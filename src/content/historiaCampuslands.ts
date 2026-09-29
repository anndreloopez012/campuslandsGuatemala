export interface HistoriaStat {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export interface HistoriaChapter {
  id: string;
  year: number;
  act: number;
  title: string;
  text: string;
  place: string;
  coordinates: string;
  video: string;
  orbitLine: string;
  stats?: HistoriaStat[];
  pillars?: string[];
  orbitScene?: boolean;
}

export interface HistoriaAct {
  number: number;
  roman: string;
  name: string;
  span: string;
  tagline: string;
}

export const HISTORIA_VIDEO_BASE = "/video/historia";

// Subir este valor fuerza a los navegadores a volver a descargar los medios en caché.
export const HISTORIA_MEDIA_VERSION = "2026-09-29";

export const HISTORIA_PROLOGUE = {
  eyebrow: "Historia Campuslands · 2017 — 2026",
  title: "La historia de Campuslands",
  subtitle: "De una chispa en Bangalore a una misión en Guatemala.",
  orbitLine: "Hola, soy Orbit. Abróchate el cinturón: vamos a viajar por el tiempo.",
  video: "prologo-orbit",
};

export const HISTORIA_ACTS: HistoriaAct[] = [
  {
    number: 1,
    roman: "I",
    name: "La chispa",
    span: "2017 — 2020",
    tagline: "Un viaje, una pregunta y una necesidad que no podía esperar.",
  },
  {
    number: 2,
    roman: "II",
    name: "El despegue",
    span: "2021 — 2022",
    tagline: "Cuarenta jóvenes, un espacio pequeño y la valentía de crecer.",
  },
  {
    number: 3,
    roman: "III",
    name: "En órbita",
    span: "2023 — 2024",
    tagline: "El sueño toma forma de campus y se extiende por todo un país.",
  },
  {
    number: 4,
    roman: "IV",
    name: "Guatemala",
    span: "2025 — 2026",
    tagline: "La misión cruza fronteras y aterriza en el corazón de Centroamérica.",
  },
];

export const HISTORIA_CHAPTERS: HistoriaChapter[] = [
  {
    id: "chispa-del-cambio",
    year: 2017,
    act: 1,
    title: "La chispa del cambio",
    text:
      "Dos emprendedores colombianos llegan a Bangalore, India, y descubren cómo la formación tecnológica puede transformar vidas, sin saber que este viaje sería el comienzo de algo grande.",
    place: "Bangalore, India",
    coordinates: "12.97° N · 77.59° E",
    video: "2017-bangalore",
    orbitLine: "Todo empezó con un viaje… y una pregunta: ¿y si la tecnología pudiera cambiar vidas?",
  },
  {
    id: "inspiracion-sin-fronteras",
    year: 2019,
    act: 1,
    title: "Inspiración sin fronteras",
    text:
      "En Francia y España, un innovador modelo educativo sin profesores comenzó a revolucionar la educación. Esta experiencia inspira la creación de un proyecto único en Colombia.",
    place: "Francia y España",
    coordinates: "48.85° N · 2.35° E",
    video: "2019-europa",
    orbitLine: "¿Aprender sin profesores? Sí: entre pares, con retos reales y a tu propio ritmo.",
  },
  {
    id: "despertar-de-una-necesidad",
    year: 2020,
    act: 1,
    title: "El despertar de una necesidad",
    text:
      "La pandemia expone la urgente demanda de talento TI en Colombia. Los emprendedores deciden dar el primer paso: formar talento local para empresas globales.",
    place: "Colombia",
    coordinates: "4.57° N · 74.29° W",
    video: "2020-pandemia",
    orbitLine: "El mundo se detuvo, pero la demanda de talento tecnológico se aceleró.",
  },
  {
    id: "nace-campuslands",
    year: 2021,
    act: 2,
    title: "Nace Campuslands",
    text:
      "Con un espacio limitado dedicado a la formación de 40 jóvenes talentos. A pesar de los desafíos, descubren una verdad clave: el mundo necesita más programadores, y ellos están listos para liderar la transformación.",
    place: "Bucaramanga, Colombia",
    coordinates: "7.12° N · 73.12° W",
    video: "2021-nace-campuslands",
    orbitLine: "Cuarenta jóvenes, un espacio pequeño y un sueño enorme.",
    stats: [{ value: 40, label: "jóvenes talentos" }],
  },
  {
    id: "apuesta-por-la-expansion",
    year: 2022,
    act: 2,
    title: "Apuesta por la expansión",
    text:
      "El riesgo se hace realidad: se triplica el espacio y se recibe a 120 jóvenes. La deserción baja al 40% y el propósito se clarifica: formar el talento del mañana, hoy.",
    place: "Bucaramanga, Colombia",
    coordinates: "7.12° N · 73.12° W",
    video: "2022-expansion",
    orbitLine: "Cuando crees en tu propósito, te atreves a crecer.",
    stats: [
      { value: 3, suffix: "×", label: "más espacio" },
      { value: 120, label: "jóvenes" },
      { value: 40, suffix: "%", label: "de deserción" },
    ],
  },
  {
    id: "el-mundo-mira-a-bucaramanga",
    year: 2022,
    act: 2,
    title: "El mundo pone los ojos en Bucaramanga",
    text:
      "Empresarios de EE.UU. y México quedan impresionados por el impacto de Campuslands y deciden invertir, creando el primer centro de movilidad social en Colombia y Latinoamérica ubicado en Zona Franca de Santander.",
    place: "Zona Franca de Santander",
    coordinates: "7.07° N · 73.10° W",
    video: "2022-bucaramanga",
    orbitLine: "Desde EE. UU. y México vieron lo que pasaba aquí… y quisieron ser parte.",
    stats: [{ value: 1, suffix: ".er", label: "centro de movilidad social de Latinoamérica" }],
  },
  {
    id: "el-sueno-se-materializa",
    year: 2023,
    act: 3,
    title: "El sueño se materializa",
    text:
      "Campuslands inaugura su campus 100% presencial, con formación intensiva en programación, inglés y habilidades blandas, transformando a los jóvenes en profesionales listos para el mundo laboral.",
    place: "Bucaramanga, Colombia",
    coordinates: "7.12° N · 73.12° W",
    video: "2023-campus",
    orbitLine: "Un campus real, donde el talento se forma cara a cara.",
    stats: [{ value: 100, suffix: "%", label: "presencial" }],
    pillars: ["Programación", "Inglés", "Habilidades blandas"],
  },
  {
    id: "expansion-nacional",
    year: 2024,
    act: 3,
    title: "Expansión nacional: nuestro talento a nivel nacional",
    text:
      "Campuslands amplía su presencia en todo el país, llevando su modelo de formación y reclutamiento a diversas regiones, acercando el talento tecnológico a más empresas y estudiantes.",
    place: "Colombia",
    coordinates: "4.57° N · 74.29° W",
    video: "2024-nacional",
    orbitLine: "La red se encendió, región por región.",
  },
  {
    id: "campuslands-guatemala",
    year: 2025,
    act: 4,
    title: "Expansión internacional: Campuslands Guatemala",
    text:
      "Campuslands extiende sus fronteras y llega a Guatemala, llevando su innovador modelo educativo a más jóvenes talentosos. Con un enfoque en la formación intensiva en programación, inglés y habilidades adaptativas, Campuslands Guatemala se convierte en un faro de oportunidades, transformando vidas y potenciando el talento tecnológico en la región.",
    place: "Ciudad de Guatemala",
    coordinates: "14.62° N · 90.51° W",
    video: "2025-guatemala-orbit",
    orbitLine: "¡Y aquí entro yo! Guatemala, es un honor aterrizar en tu cielo.",
    pillars: ["Programación", "Inglés", "Habilidades adaptativas"],
    orbitScene: true,
  },
  {
    id: "primeras-cohortes-guatemala",
    year: 2026,
    act: 4,
    title: "Guatemala inicia sus primeras 4 cohortes y valida el modelo",
    text:
      "Campuslands inicia 4 cohortes con 50 jóvenes que se están formando como programadores e inteligencia artificial bajo el modelo de transformación profesional listo para emplear. El impacto no solo es tecnológico, es social.",
    place: "Campus Tec, Zona 4",
    coordinates: "14.62° N · 90.51° W",
    video: "2026-cohortes-orbit",
    orbitLine: "Cincuenta historias nuevas empiezan hoy. Y esto apenas comienza.",
    stats: [
      { value: 4, label: "cohortes" },
      { value: 50, label: "jóvenes en formación" },
    ],
    orbitScene: true,
  },
];

export const HISTORIA_EPILOGUE = {
  eyebrow: "Epílogo",
  title: "La historia continúa contigo",
  text: "El próximo capítulo todavía no está escrito. Puede empezar con tu nombre.",
  orbitLine: "¿Me acompañas al siguiente capítulo?",
  video: "epilogo-orbit",
  summary: [
    { value: 9, label: "años de historia" },
    { value: 2, label: "países" },
    { value: 10, label: "hitos" },
    { value: 50, label: "jóvenes en Guatemala" },
  ] satisfies HistoriaStat[],
  actions: [
    { label: "Sé un Camper", href: "/joinUs/", variant: "primary" },
    { label: "Contrata talento", href: "/emplea/", variant: "outline" },
    { label: "Patrocina un sueño", href: "/patrocina/", variant: "outline" },
  ],
};

export const HISTORIA_GUIDE_VIDEO = "orbit-guia";

// La pista reproduce la intro una vez y luego repite 40–104 s; la unión
// trae un fundido de 8 s integrado, por eso estos puntos no deben moverse.
export const HISTORIA_AUDIO = {
  src: "/audio/historia/banda-sonora-interestelar.mp3",
  loopStart: 40,
  loopEnd: 104,
};
