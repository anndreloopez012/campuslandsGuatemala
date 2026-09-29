import { perfilDispositivo } from "./dispositivo";

interface Recurso {
  url: string;
  size: number;
}

interface Escena {
  etiqueta: string;
  hd: Recurso;
  sd: Recurso;
}

interface Manifiesto {
  version: string;
  posters: Recurso[];
  escenas: Escena[];
  guia: Recurso;
  audio: Recurso;
}

export interface MediosPrecargados {
  calidad: "hd" | "sd";
  resolver: (url: string) => string;
  audio: ArrayBuffer | null;
}

export interface Precarga {
  listo: Promise<MediosPrecargados>;
  entrada: Promise<{ sonido: boolean | null }>;
  revelar: () => Promise<void>;
  destruir: () => void;
}

interface Tarea {
  recurso: Recurso;
  etiqueta: string;
  tipo: "blob" | "audio";
}

const CACHE_PREFIX = "historia-medios-";
const PARALELO = 3;
const SEGUNDOS_MAX_HD = 45;
const AVISO_LENTO_MS = 15000;
const ENTRADA_AUTOMATICA_MS = 30000;

const TIPOS: Record<string, string> = {
  mp4: "video/mp4",
  webp: "image/webp",
  mp3: "audio/mpeg",
};

const tipoPorUrl = (url: string) => TIPOS[url.split(".").pop() ?? ""] ?? "application/octet-stream";
const megas = (bytes: number) => (bytes / 1048576).toFixed(1);

export function crearPrecarga(root: HTMLElement, opciones: { kiosco: boolean }): Precarga | null {
  const overlay = root.querySelector<HTMLElement>("[data-historia-precarga]");
  if (!overlay?.dataset.manifiesto) return null;
  (window as Window & { __historiaPrecargaViva?: boolean }).__historiaPrecargaViva = true;

  const manifiesto = JSON.parse(overlay.dataset.manifiesto) as Manifiesto;
  const perfil = perfilDispositivo();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const abort = new AbortController();
  const blobs = new Map<string, string>();
  const doc = document.documentElement;

  const anillo = overlay.querySelector<SVGCircleElement>("[data-precarga-anillo]");
  const porcentaje = overlay.querySelector<HTMLElement>("[data-precarga-porcentaje]");
  const estado = overlay.querySelector<HTMLElement>("[data-precarga-estado]");
  const detalle = overlay.querySelector<HTMLElement>("[data-precarga-detalle]");
  const calidadEtiqueta = overlay.querySelector<HTMLElement>("[data-precarga-calidad]");
  const titulo = overlay.querySelector<HTMLElement>("[data-precarga-titulo]");
  const acciones = overlay.querySelector<HTMLElement>("[data-precarga-acciones]");
  const saltar = overlay.querySelector<HTMLButtonElement>("[data-precarga-saltar]");
  const botonesEntrada = Array.from(overlay.querySelectorAll<HTMLButtonElement>("[data-precarga-entrar]"));
  const longitudAnillo = Number(anillo?.dataset.longitud ?? 0);

  let audio: ArrayBuffer | null = null;
  let cargados = 0;
  let total = 0;
  let mostrado = 0;
  let bytesRed = 0;
  let inicioRed = 0;
  let calidad: "hd" | "sd" = perfil.admiteHd ? "hd" : "sd";
  let terminado = false;
  let destruido = false;
  const temporizadores: number[] = [];

  let resolverListo: (valor: MediosPrecargados) => void = () => {};
  let resolverEntrada: (valor: { sonido: boolean | null }) => void = () => {};
  const listo = new Promise<MediosPrecargados>((resolve) => (resolverListo = resolve));
  const entrada = new Promise<{ sonido: boolean | null }>((resolve) => (resolverEntrada = resolve));

  const medios = (): MediosPrecargados => ({
    calidad,
    resolver: (url: string) => blobs.get(url) ?? url,
    audio,
  });

  const velocidadMbps = () => {
    if (!bytesRed || !inicioRed) return 0;
    const segundos = (performance.now() - inicioRed) / 1000;
    return segundos > 0.2 ? (bytesRed * 8) / segundos / 1_000_000 : 0;
  };

  const pintar = () => {
    const fraccion = total ? Math.min(1, cargados / total) : 0;
    mostrado = Math.max(mostrado, fraccion);
    if (porcentaje) porcentaje.textContent = String(Math.floor(mostrado * 100));
    if (anillo) anillo.style.strokeDashoffset = String(longitudAnillo * (1 - mostrado));
    if (!detalle) return;
    const mbps = velocidadMbps();
    const restante = Math.max(0, total - cargados);
    const eta = mbps > 0 ? Math.ceil((restante * 8) / (mbps * 1_000_000)) : 0;
    detalle.textContent =
      `${megas(cargados)} / ${megas(total)} MB` +
      (mbps > 0 ? ` · ${mbps.toFixed(1)} Mb/s` : "") +
      (eta > 0 && !terminado ? ` · ~${eta} s` : "");
  };

  const sumar = (bytes: number, desdeRed: boolean) => {
    cargados += bytes;
    if (desdeRed) {
      if (!inicioRed) inicioRed = performance.now();
      bytesRed += bytes;
    }
    pintar();
  };

  const abrirCache = async () => {
    if (!("caches" in window)) return null;
    try {
      const nombre = `${CACHE_PREFIX}${manifiesto.version}`;
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((clave) => clave.startsWith(CACHE_PREFIX) && clave !== nombre).map((clave) => caches.delete(clave)),
      );
      return await caches.open(nombre);
    } catch {
      return null;
    }
  };

  const descargar = async (recurso: Recurso, cache: Cache | null): Promise<Blob> => {
    const guardado = cache ? await cache.match(recurso.url).catch(() => undefined) : undefined;
    if (guardado) {
      const blob = await guardado.blob();
      sumar(recurso.size || blob.size, false);
      return blob;
    }
    const respuesta = await fetch(recurso.url, { signal: abort.signal, cache: "force-cache" });
    if (!respuesta.ok || !respuesta.body) throw new Error(`${respuesta.status} ${recurso.url}`);
    const lector = respuesta.body.getReader();
    const partes: Uint8Array[] = [];
    let recibidos = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value);
      recibidos += value.byteLength;
      sumar(value.byteLength, true);
    }
    if (recurso.size && recibidos < recurso.size) sumar(recurso.size - recibidos, false);
    const tipo = respuesta.headers.get("content-type")?.split(";")[0] || tipoPorUrl(recurso.url);
    const blob = new Blob(partes, { type: tipo });
    cache
      ?.put(recurso.url, new Response(blob, { headers: { "Content-Type": tipo, "Content-Length": String(blob.size) } }))
      .catch(() => {});
    return blob;
  };

  const ejecutar = async (tareas: Tarea[], cache: Cache | null) => {
    let siguiente = 0;
    const trabajador = async () => {
      while (siguiente < tareas.length && !destruido) {
        const tarea = tareas[siguiente++];
        if (estado) estado.textContent = tarea.etiqueta;
        try {
          const blob = await descargar(tarea.recurso, cache);
          if (tarea.tipo === "audio") audio = await blob.arrayBuffer();
          else blobs.set(tarea.recurso.url, URL.createObjectURL(blob));
        } catch (error) {
          if (destruido || (error as Error).name === "AbortError") return;
          // El motor usará la URL original para este recurso; no bloquea la entrada.
          sumar(tarea.recurso.size, false);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, tareas.length) }, trabajador));
  };

  const decidirCalidad = async (cache: Cache | null) => {
    if (!perfil.admiteHd) return "sd" as const;
    const totalHd = manifiesto.escenas.reduce((suma, escena) => suma + escena.hd.size, 0);
    if (cache) {
      const aciertos = await Promise.all(manifiesto.escenas.map((escena) => cache.match(escena.hd.url)));
      if (aciertos.every(Boolean)) return "hd" as const;
    }
    const mbps = velocidadMbps() || perfil.anchoBandaEstimado || 10;
    const segundos = (totalHd * 8) / (mbps * 1_000_000);
    return segundos <= SEGUNDOS_MAX_HD ? ("hd" as const) : ("sd" as const);
  };

  const mostrarEntrada = () => {
    overlay.dataset.state = "ready";
    overlay.setAttribute("aria-busy", "false");
    if (titulo) titulo.textContent = "Todo listo para el despegue";
    if (estado) estado.textContent = "La historia está cargada por completo en este equipo.";
    if (saltar) saltar.hidden = true;
    if (acciones) acciones.hidden = false;
    botonesEntrada[0]?.focus({ preventScroll: true });
    if (opciones.kiosco) {
      resolverEntrada({ sonido: null });
      return;
    }
    temporizadores.push(window.setTimeout(() => resolverEntrada({ sonido: null }), ENTRADA_AUTOMATICA_MS));
  };

  const totalPara = (opcion: "hd" | "sd") =>
    manifiesto.posters.reduce((suma, poster) => suma + poster.size, 0) +
    manifiesto.guia.size +
    manifiesto.audio.size +
    manifiesto.escenas.reduce((suma, escena) => suma + escena[opcion].size, 0);

  const iniciar = async () => {
    const cache = await abrirCache();
    total = totalPara(calidad);
    pintar();

    // Los recursos ligeros miden la conexión antes de elegir la calidad.
    if (estado) estado.textContent = "Calibrando la conexión…";
    await ejecutar(
      [
        ...manifiesto.posters.map((poster) => ({ recurso: poster, etiqueta: "Preparando el cielo estrellado…", tipo: "blob" as const })),
        { recurso: manifiesto.guia, etiqueta: "Despertando a Orbit…", tipo: "blob" as const },
      ],
      cache,
    );
    if (destruido) return;

    calidad = await decidirCalidad(cache);
    total = totalPara(calidad);
    if (calidadEtiqueta) {
      calidadEtiqueta.textContent =
        calidad === "hd" ? "Calidad Full HD para esta pantalla" : "Calidad optimizada para este equipo y conexión";
    }

    const escenas = manifiesto.escenas.map((escena) => ({
      recurso: calidad === "hd" ? escena.hd : escena.sd,
      etiqueta: `Cargando ${escena.etiqueta}…`,
      tipo: "blob" as const,
    }));
    const tareas: Tarea[] = [
      ...escenas.slice(0, 2),
      { recurso: manifiesto.audio, etiqueta: "Afinando la banda sonora…", tipo: "audio" },
      ...escenas.slice(2),
    ];
    pintar();

    await ejecutar(tareas, cache);
    if (destruido) return;

    terminado = true;
    cargados = total;
    pintar();
    resolverListo(medios());
    mostrarEntrada();
  };

  const alSaltar = () => {
    if (terminado) return;
    resolverListo(medios());
    resolverEntrada({ sonido: null });
  };

  const alEntrar = (event: Event) => {
    const boton = event.currentTarget as HTMLButtonElement;
    resolverEntrada({ sonido: boton.dataset.precargaEntrar === "sonido" });
  };

  // Si la red de seguridad ya retiró la pantalla, la carga sigue en segundo plano sin bloquear.
  if (overlay.dataset.state === "done") {
    resolverListo(medios());
    resolverEntrada({ sonido: null });
  }

  botonesEntrada.forEach((boton) => boton.addEventListener("click", alEntrar));
  saltar?.addEventListener("click", alSaltar);
  temporizadores.push(
    window.setTimeout(() => {
      if (!terminado && saltar) saltar.hidden = false;
    }, AVISO_LENTO_MS),
  );

  void iniciar();

  const revelar = () =>
    new Promise<void>((resolve) => {
      overlay.dataset.state = "leaving";
      root.classList.add("historia--revelada");
      const cerrar = () => {
        overlay.dataset.state = "done";
        doc.classList.remove("historia-precargando");
        document.getElementById("historia-titulo")?.focus({ preventScroll: true });
        resolve();
      };
      if (reduce) cerrar();
      else temporizadores.push(window.setTimeout(cerrar, 950));
    });

  const destruir = () => {
    destruido = true;
    abort.abort();
    temporizadores.forEach((id) => window.clearTimeout(id));
    botonesEntrada.forEach((boton) => boton.removeEventListener("click", alEntrar));
    saltar?.removeEventListener("click", alSaltar);
    blobs.forEach((url) => URL.revokeObjectURL(url));
    blobs.clear();
    doc.classList.remove("historia-precargando");
  };

  return { listo, entrada, revelar, destruir };
}
