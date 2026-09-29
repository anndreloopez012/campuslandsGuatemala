import { createSoundtrack, soundPreference } from "./banda-sonora";

type SceneKind = "prologo" | "acto" | "capitulo" | "epilogo";

interface StageLayer {
  root: HTMLElement;
  video: HTMLVideoElement;
  mode: "scrub" | "loop";
  requested: boolean;
  ready: boolean;
  duration: number;
  shown: number;
  visible: boolean;
  last: string;
}

interface Scene {
  el: HTMLElement;
  kind: SceneKind;
  id: string;
  order: number;
  chapter: number;
  layer: StageLayer | null;
  top: number;
  height: number;
  progress: number;
  counted: boolean;
  orbitScene: boolean;
  line: string;
  year: string;
  title: string;
  place: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const pad = (value: number) => String(value).padStart(2, "0");

const CINE_SPEED: Record<SceneKind, number> = {
  prologo: 0.34,
  acto: 0.3,
  capitulo: 0.24,
  epilogo: 0.22,
};

class Starfield {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private stars = new Float32Array(0);
  private tints: string[] = [];
  private width = 0;
  private height = 0;
  private ratio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.resize();
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(1, Math.round(box.width));
    this.height = Math.max(1, Math.round(box.height));
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.context?.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const count = Math.round(clamp((this.width * this.height) / 2400, 160, 560));
    this.stars = new Float32Array(count * 3);
    this.tints = [];
    const palette = ["255 255 255", "173 229 255", "87 187 255", "0 221 177"];
    for (let index = 0; index < count; index += 1) {
      this.stars[index * 3] = Math.random() * 2 - 1;
      this.stars[index * 3 + 1] = Math.random() * 2 - 1;
      this.stars[index * 3 + 2] = Math.random();
      this.tints.push(palette[index % 7 === 0 ? 3 : index % 5 === 0 ? 2 : index % 3 === 0 ? 1 : 0]);
    }
  }

  draw(speed: number, delta: number) {
    const context = this.context;
    if (!context) return;
    const { width, height } = this;
    const centerX = width / 2;
    const centerY = height * 0.46;
    const focal = Math.max(width, height) * 0.62;
    const advance = speed * delta * 0.00011;
    const streak = clamp(speed * 0.018, 0.004, 0.16);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";

    for (let index = 0; index < this.stars.length; index += 3) {
      let z = this.stars[index + 2] - advance;
      if (z <= 0.02) {
        this.stars[index] = Math.random() * 2 - 1;
        this.stars[index + 1] = Math.random() * 2 - 1;
        z = 1;
      }
      this.stars[index + 2] = z;
      const x = this.stars[index];
      const y = this.stars[index + 1];
      const screenX = centerX + (x / z) * focal * 0.5;
      const screenY = centerY + (y / z) * focal * 0.5;
      if (screenX < -40 || screenX > width + 40 || screenY < -40 || screenY > height + 40) continue;
      const tailZ = Math.min(1, z + streak);
      const tailX = centerX + (x / tailZ) * focal * 0.5;
      const tailY = centerY + (y / tailZ) * focal * 0.5;
      const depth = 1 - z;
      const alpha = clamp(depth * 1.15, 0.05, 0.95);
      context.strokeStyle = `rgb(${this.tints[index / 3]} / ${alpha})`;
      context.lineWidth = 0.4 + depth * 1.9;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(screenX + 0.01, screenY + 0.01);
      context.stroke();
    }
  }
}

export function mountHistoria(root: HTMLElement): () => void {
  const doc = document.documentElement;
  const stage = root.querySelector<HTMLElement>("[data-historia-stage]");
  const hud = root.querySelector<HTMLElement>("[data-historia-hud]");
  if (!stage || !hud) return () => {};

  const params = new URLSearchParams(window.location.search);
  const kiosk = params.has("kiosco") || params.has("kiosk");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const useHd =
    !connection?.saveData &&
    window.innerWidth >= 900 &&
    Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2) >= 1500;

  root.classList.add("historia--cinema");
  if (reduceMotion) root.classList.add("historia--calm");
  doc.classList.add("historia-cinema-active");
  if (kiosk) doc.classList.add("historia-kiosco");
  hud.hidden = false;

  const layers = new Map<string, StageLayer>();
  stage.querySelectorAll<HTMLElement>("[data-layer]").forEach((layerRoot) => {
    const video = layerRoot.querySelector<HTMLVideoElement>("video");
    if (!video) return;
    layers.set(layerRoot.dataset.layer ?? "", {
      root: layerRoot,
      video,
      mode: layerRoot.dataset.mode === "loop" ? "loop" : "scrub",
      requested: false,
      ready: false,
      duration: 0,
      shown: 0,
      visible: false,
      last: "",
    });
  });

  const scenes: Scene[] = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]")).map(
    (el, order) => {
      const id = el.dataset.scene ?? "";
      const kind: SceneKind = el.classList.contains("historia-capitulo")
        ? "capitulo"
        : el.classList.contains("historia-acto")
          ? "acto"
          : id === "epilogo"
            ? "epilogo"
            : "prologo";
      const tagline = el.querySelector(".historia-acto__tagline")?.textContent?.trim() ?? "";
      const quote = el.querySelector(".historia-orbit-quote")?.textContent?.replace(/^\s*Orbit\s*/i, "").trim() ?? "";
      return {
        el,
        kind,
        id,
        order,
        chapter: Number(el.dataset.index ?? 0),
        layer: layers.get(id) ?? null,
        top: 0,
        height: 1,
        progress: 0,
        counted: false,
        orbitScene: el.classList.contains("historia-capitulo--orbit"),
        line: el.dataset.orbitLine ?? (kind === "acto" ? tagline : quote),
        year: el.dataset.year ?? "",
        title: el.dataset.title ?? el.querySelector("h2")?.textContent?.trim() ?? "",
        place: [
          el.querySelector(".historia-capitulo__place span")?.textContent?.trim(),
          el.querySelector(".historia-capitulo__coords")?.textContent?.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    },
  );
  const chapters = scenes.filter((scene) => scene.kind === "capitulo");
  const totalChapters = chapters.length;
  const prologue = scenes[0];
  const epilogue = scenes[scenes.length - 1];

  root.querySelectorAll<HTMLElement>("[data-words]").forEach((paragraph) => {
    if (paragraph.dataset.split === "true") return;
    const words = (paragraph.textContent ?? "").trim().split(/\s+/);
    paragraph.textContent = "";
    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "historia-word";
      span.style.setProperty("--i", String(index));
      span.textContent = word;
      paragraph.append(span);
      if (index < words.length - 1) paragraph.append(" ");
    });
    paragraph.style.setProperty("--n", String(words.length));
    paragraph.dataset.split = "true";
  });

  const hudCount = hud.querySelector<HTMLElement>("[data-hud-count]");
  const hudYear = hud.querySelector<HTMLElement>("[data-hud-year]");
  const hudTitle = hud.querySelector<HTMLElement>("[data-hud-title]");
  const hudCoords = hud.querySelector<HTMLElement>("[data-hud-coords]");
  const railFill = hud.querySelector<HTMLElement>("[data-rail-fill]");
  const railButtons = Array.from(hud.querySelectorAll<HTMLButtonElement>("[data-rail-target]"));
  const guide = hud.querySelector<HTMLElement>("[data-historia-guide]");
  const guideText = hud.querySelector<HTMLElement>("[data-guide-text]");
  const guideVideo = hud.querySelector<HTMLVideoElement>(".historia-guide__video");
  const mobileYear = hud.querySelector<HTMLElement>("[data-mobile-year]");
  const mobileFill = hud.querySelector<HTMLElement>("[data-mobile-fill]");
  const cineButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-historia-cine]"));
  const cineStatus = hud.querySelector<HTMLElement>("[data-cine-status]");
  const cineMessage = hud.querySelector<HTMLElement>("[data-cine-message]");
  const cineProgress = hud.querySelector<HTMLElement>("[data-cine-progress]");
  const fullscreenButton = hud.querySelector<HTMLButtonElement>("[data-historia-fullscreen]");
  const flash = stage.querySelector<HTMLElement>("[data-historia-flash]");
  const starsCanvas = stage.querySelector<HTMLCanvasElement>("[data-historia-stars]");
  const starfield = starsCanvas ? new Starfield(starsCanvas) : null;

  const soundtrack = root.dataset.audioSrc
    ? createSoundtrack({
        src: root.dataset.audioSrc,
        loopStart: Number(root.dataset.audioLoopStart ?? 0),
        loopEnd: Number(root.dataset.audioLoopEnd ?? 0),
      })
    : null;
  const audioButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-historia-audio]"));
  const volumeInput = hud.querySelector<HTMLInputElement>("[data-historia-volume]");

  const syncAudioUi = () => {
    const on = Boolean(soundtrack?.enabled);
    root.classList.toggle("historia--audio", on);
    audioButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", on ? "Silenciar banda sonora" : "Activar banda sonora");
      button.classList.toggle("is-on", on);
      const label = button.querySelector("[data-audio-label]");
      if (label && button.classList.contains("historia-btn--audio")) {
        label.textContent = on ? "Sonido activado" : "Activar sonido";
      }
    });
    if (volumeInput) {
      const percent = Math.round((soundtrack?.volume ?? 0.7) * 100);
      volumeInput.value = String(percent);
      volumeInput.setAttribute("aria-valuetext", `${percent} %`);
      volumeInput.style.setProperty("--vol", `${percent}%`);
    }
  };

  const autoSound = () => {
    if (!soundtrack || soundtrack.enabled || soundPreference() === "off") return;
    void soundtrack.enable();
  };

  let viewport = window.innerHeight;
  let rafId = 0;
  let lastTime = performance.now();
  let lastScroll = window.scrollY;
  let velocity = 0;
  let activeOrder = -1;
  let typeTimer = 0;
  let tweenId = 0;
  let flashTimer = 0;
  let idleTimer = 0;
  let cursorTimer = 0;
  let kioskLoopTimer = 0;
  let immersive = false;
  let destroyed = false;
  const counterFrames = new Set<number>();

  const cine = {
    active: false,
    position: 0,
    holdUntil: 0,
  };

  const requestLayer = (layer: StageLayer | null) => {
    if (!layer || layer.requested) return;
    layer.requested = true;
    const video = layer.video;
    if (video.dataset.poster) video.poster = video.dataset.poster;
    video.src = (useHd ? video.dataset.srcHd : video.dataset.srcSd) ?? "";
    video.preload = "auto";
    video.addEventListener(
      "loadedmetadata",
      () => {
        layer.duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (layer.mode === "scrub") {
          const primed = video.play();
          primed?.then(() => video.pause()).catch(() => {});
        }
      },
      { once: true },
    );
    video.addEventListener("loadeddata", () => (layer.ready = true), { once: true });
    video.addEventListener(
      "error",
      () => {
        const fallback = video.dataset.srcSd;
        if (!fallback || video.getAttribute("src") === fallback) return;
        video.src = fallback;
        video.load();
      },
      { once: true },
    );
    video.load();
  };

  const requestNearby = (order: number) => {
    scenes.forEach((scene) => {
      const distance = scene.order - order;
      if (distance >= -1 && distance <= 2) requestLayer(scene.layer);
    });
  };

  const requestGuide = () => {
    if (!guideVideo) return;
    if (!guideVideo.getAttribute("src")) {
      if (guideVideo.dataset.poster) guideVideo.poster = guideVideo.dataset.poster;
      guideVideo.src = guideVideo.dataset.srcSd ?? "";
      guideVideo.preload = "auto";
    }
    if (!reduceMotion && guideVideo.paused) guideVideo.play().catch(() => {});
  };

  const measure = () => {
    viewport = window.innerHeight;
    const scrollY = window.scrollY;
    scenes.forEach((scene) => {
      const box = scene.el.getBoundingClientRect();
      scene.top = box.top + scrollY;
      scene.height = Math.max(1, box.height);
    });
    starfield?.resize();
    if (reduceMotion) starfield?.draw(0, 16);
    schedule();
  };

  const anchorFor = (scene: Scene) => {
    if (scene.kind === "prologo") return 0;
    const reading = scene.kind === "capitulo" ? 0.52 : 0.5;
    return Math.max(0, scene.top + scene.height * reading - viewport / 2);
  };

  const cancelTween = () => {
    if (tweenId) cancelAnimationFrame(tweenId);
    tweenId = 0;
  };

  const scrollInstant = (top: number) => {
    window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  };

  const tweenTo = (target: number, onDone?: () => void) => {
    cancelTween();
    const start = window.scrollY;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      onDone?.();
      return;
    }
    const duration = reduceMotion ? 1 : clamp((Math.abs(distance) / viewport) * 240, 650, 2400);
    const begin = performance.now();
    const step = (now: number) => {
      const progress = clamp((now - begin) / duration);
      scrollInstant(start + distance * easeInOutCubic(progress));
      if (progress < 1) {
        tweenId = requestAnimationFrame(step);
      } else {
        tweenId = 0;
        onDone?.();
      }
    };
    tweenId = requestAnimationFrame(step);
  };

  const goToScene = (scene: Scene | undefined) => {
    if (!scene) return;
    stopCine();
    requestNearby(scene.order);
    tweenTo(anchorFor(scene));
  };

  const neighbour = (direction: 1 | -1) => {
    const current = window.scrollY;
    const anchors = scenes.map((scene) => ({ scene, top: anchorFor(scene) }));
    if (direction > 0) return anchors.find((anchor) => anchor.top > current + 12)?.scene;
    return [...anchors].reverse().find((anchor) => anchor.top < current - 12)?.scene;
  };

  const typeLine = (text: string) => {
    if (!guideText) return;
    window.clearInterval(typeTimer);
    if (reduceMotion || !text) {
      guideText.textContent = text;
      return;
    }
    let index = 0;
    guideText.textContent = "";
    typeTimer = window.setInterval(() => {
      index += 1;
      guideText.textContent = text.slice(0, index);
      if (index >= text.length) window.clearInterval(typeTimer);
    }, 26);
  };

  const triggerFlash = () => {
    if (!flash || reduceMotion) return;
    flash.classList.remove("is-flashing");
    void flash.offsetWidth;
    flash.classList.add("is-flashing");
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flash.classList.remove("is-flashing"), 900);
  };

  const countUp = (scene: Scene) => {
    scene.counted = true;
    scene.el.querySelectorAll<HTMLElement>("[data-count]").forEach((node, index) => {
      const target = Number(node.dataset.count ?? 0);
      const prefix = node.dataset.prefix ?? "";
      const suffix = node.dataset.suffix ?? "";
      if (reduceMotion || target <= 1) {
        node.textContent = `${prefix}${target}${suffix}`;
        return;
      }
      const begin = performance.now() + index * 140;
      const duration = 1500;
      const tick = (now: number) => {
        const progress = clamp((now - begin) / duration);
        node.textContent = `${prefix}${Math.round(target * easeOutExpo(progress))}${suffix}`;
        if (progress < 1) {
          const id = requestAnimationFrame(tick);
          counterFrames.add(id);
        }
      };
      counterFrames.add(requestAnimationFrame(tick));
    });
  };

  const setActive = (scene: Scene) => {
    if (scene.order === activeOrder) return;
    const previous = scenes[activeOrder];
    activeOrder = scene.order;
    requestNearby(scene.order);
    root.dataset.activeScene = scene.id;
    root.dataset.activeKind = scene.kind;
    soundtrack?.setScene(scene.kind);

    if (scene.kind === "acto" && previous && previous.kind !== "acto") triggerFlash();

    const chapter = scene.kind === "capitulo" ? scene : [...chapters].reverse().find((item) => item.order < scene.order);
    if (hudCount) hudCount.textContent = `${pad(chapter?.chapter ?? 0)} / ${pad(totalChapters)}`;
    if (hudYear) {
      hudYear.textContent =
        scene.kind === "acto"
          ? scene.el.querySelector(".historia-acto__label")?.textContent?.trim() ?? ""
          : chapter?.year ?? "";
    }
    if (hudTitle) hudTitle.textContent = scene.title;
    if (hudCoords) hudCoords.textContent = scene.kind === "capitulo" ? scene.place : "";
    if (mobileYear) mobileYear.textContent = scene.kind === "capitulo" ? scene.year : scene.title;

    railButtons.forEach((button) => {
      const isCurrent = button.dataset.railTarget === chapter?.id;
      const isPast = chapter ? chapters.findIndex((item) => item.id === button.dataset.railTarget) < chapter.chapter - 1 : false;
      if (isCurrent) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.classList.toggle("is-past", isPast);
    });

    const showGuide = (scene.kind === "capitulo" && !scene.orbitScene) || scene.kind === "acto";
    guide?.classList.toggle("is-visible", showGuide);
    if (showGuide) {
      requestGuide();
      typeLine(scene.line);
    } else {
      window.clearInterval(typeTimer);
      guideVideo?.pause();
    }
  };

  const applyLayer = (scene: Scene, center: number, fade: number) => {
    const layer = scene.layer;
    if (!layer) return 0;
    const start = scene.top;
    const end = scene.top + scene.height;
    const enter = scene.kind === "prologo" ? 1 : smoothstep(start - fade, start + fade, center);
    const exit = 1 - smoothstep(end - fade, end + fade, center);
    const weight = Math.min(enter, exit);

    if (weight <= 0.002) {
      if (layer.visible) {
        layer.visible = false;
        layer.root.style.visibility = "hidden";
        layer.root.style.opacity = "0";
        if (layer.mode === "loop") layer.video.pause();
      }
      return 0;
    }

    requestLayer(layer);
    if (!layer.visible) {
      layer.visible = true;
      layer.root.style.visibility = "visible";
    }

    let scale = 1 + scene.progress * 0.07;
    let blur = 0;
    if (!reduceMotion) {
      if (enter < 1) {
        scale += (1 - enter) * 0.12;
        blur = (1 - enter) * 7;
      }
      if (exit < 1) {
        scale += (1 - exit) * 0.24;
        blur = Math.max(blur, (1 - exit) * 11);
      }
    } else {
      scale = 1;
    }

    const style = `${weight.toFixed(3)}|${scale.toFixed(4)}|${blur.toFixed(1)}`;
    if (style !== layer.last) {
      layer.last = style;
      layer.root.style.opacity = weight.toFixed(3);
      layer.root.style.transform = `scale(${scale.toFixed(4)})`;
      layer.root.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px) saturate(${(1 + blur * 0.035).toFixed(2)})` : "";
    }

    const video = layer.video;
    if (layer.mode === "loop") {
      if (!reduceMotion && video.paused && layer.requested) video.play().catch(() => {});
      return weight;
    }

    if (reduceMotion || !layer.ready || !layer.duration) return weight;
    const target = clamp((scene.progress - 0.03) / 0.94) * Math.max(0, layer.duration - 0.06);
    layer.shown += (target - layer.shown) * (cine.active ? 0.35 : 0.2);
    if (!video.seeking && Math.abs(video.currentTime - layer.shown) > 0.012) {
      video.currentTime = layer.shown;
    }
    return Math.abs(target - layer.shown) > 0.004 ? weight + 1 : weight;
  };

  const setImmersive = (value: boolean) => {
    if (value === immersive) return;
    immersive = value;
    doc.classList.toggle("historia-immersive", value);
  };

  const frame = (now: number) => {
    rafId = 0;
    if (destroyed) return;
    const delta = clamp(now - lastTime, 1, 64);
    lastTime = now;
    const scrollY = window.scrollY;
    const deltaScroll = scrollY - lastScroll;
    lastScroll = scrollY;
    velocity += ((deltaScroll / delta) * 16 - velocity) * 0.18;

    const center = scrollY + viewport * 0.5;
    const fade = viewport * 0.24;
    let active = scenes[0];
    let actPresence = 0;
    let unsettled = false;

    for (const scene of scenes) {
      scene.progress = clamp((center - scene.top) / scene.height);
      scene.el.style.setProperty("--c", scene.progress.toFixed(4));
      if (center >= scene.top && center < scene.top + scene.height) active = scene;
      if (scene.kind === "acto") {
        const presence =
          smoothstep(scene.top - fade, scene.top + fade, center) *
          (1 - smoothstep(scene.top + scene.height - fade, scene.top + scene.height + fade, center));
        actPresence = Math.max(actPresence, presence);
      }
      if (!scene.counted && (scene.kind === "capitulo" || scene.kind === "epilogo") && scene.progress > 0.34) {
        countUp(scene);
      }
    }
    if (center >= epilogue.top + epilogue.height) active = epilogue;
    setActive(active);

    let coverage = 0;
    for (const scene of scenes) {
      const result = applyLayer(scene, center, fade);
      if (result > 1) unsettled = true;
      coverage = Math.max(coverage, result > 1 ? result - 1 : result);
    }

    const storyStart = scenes[1]?.top ?? 0;
    const storyEnd = epilogue.top;
    const story = clamp((center - storyStart) / Math.max(1, storyEnd - storyStart));
    root.style.setProperty("--story", story.toFixed(4));
    if (railFill) railFill.style.transform = `scaleY(${story.toFixed(4)})`;
    if (mobileFill) mobileFill.style.transform = `scaleX(${story.toFixed(4)})`;

    const ended = center > epilogue.top + epilogue.height + fade;
    const started = prologue.progress > 0.62 || prologue.kind !== "prologo";
    stage.dataset.state = ended ? "ended" : "playing";
    hud.dataset.state = ended || !started ? "idle" : "active";

    const pastIntro = scrollY > viewport * 0.55;
    if (!pastIntro || ended) setImmersive(false);
    else if (velocity > 2.5) setImmersive(true);
    else if (velocity < -5) setImmersive(false);

    if (starfield && !reduceMotion) {
      const speed = 0.9 + Math.min(Math.abs(velocity), 90) * 0.34 + actPresence * 4.2 + (1 - coverage) * 1.6;
      stage.style.setProperty("--stars", clamp(0.28 + actPresence * 0.72 + (1 - coverage) * 0.5, 0.28, 1).toFixed(3));
      starfield.draw(speed, delta);
    }

    if (cine.active) advanceCine(delta, active, now);

    const ambient = !reduceMotion && !ended && !document.hidden;
    if (ambient || unsettled || cine.active || Math.abs(velocity) > 0.05) schedule();
  };

  function schedule() {
    if (!rafId && !destroyed) rafId = requestAnimationFrame(frame);
  }

  const cineEnd = () => anchorFor(epilogue);

  function setCineUi(active: boolean, message = "") {
    cineButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(active));
      const label = button.querySelector("[data-cine-label]");
      if (label) label.textContent = active ? "Pausar cine" : "Modo cine";
      button.classList.toggle("is-playing", active);
    });
    root.classList.toggle("historia--cine", active);
    if (cineStatus) cineStatus.dataset.visible = String(Boolean(message) || active);
    if (cineMessage) cineMessage.textContent = message;
  }

  function startCine() {
    cancelTween();
    if (window.scrollY >= cineEnd() - 4) scrollInstant(0);
    cine.active = true;
    cine.position = window.scrollY;
    cine.holdUntil = performance.now() + (window.scrollY < 4 ? 1400 : 300);
    lastScroll = window.scrollY;
    setCineUi(true, "Modo cine · toca o desliza para tomar el control");
    requestGuide();
    schedule();
  }

  function stopCine(message = "") {
    if (!cine.active) return;
    cine.active = false;
    setCineUi(false, message);
    if (message) window.setTimeout(() => cineStatus && (cineStatus.dataset.visible = "false"), 2600);
  }

  function advanceCine(delta: number, active: Scene, now: number) {
    if (now < cine.holdUntil) return;
    const end = cineEnd();
    const speed = CINE_SPEED[active.kind] * viewport;
    cine.position = Math.min(end, cine.position + (speed * delta) / 1000);
    scrollInstant(cine.position);
    lastScroll = window.scrollY;
    velocity = (speed * delta) / 1000 / (delta / 16);
    if (cineProgress) cineProgress.style.transform = `scaleX(${clamp(cine.position / Math.max(1, end)).toFixed(4)})`;
    if (cine.position >= end - 0.5) {
      stopCine("Fin de la historia · el próximo capítulo lo escribes tú");
      if (kiosk) {
        window.clearTimeout(kioskLoopTimer);
        kioskLoopTimer = window.setTimeout(() => {
          scrollInstant(0);
          startCine();
        }, 14000);
      }
    }
  }

  const onUserIntent = (event: Event) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-historia-cine], [data-historia-audio], .historia-controls, .historia-rail")
    ) {
      return;
    }
    if (kiosk && event.type !== "wheel") autoSound();
    if (cine.active) stopCine("Modo cine en pausa · pulsa Modo cine para continuar");
    cancelTween();
    window.clearTimeout(kioskLoopTimer);
    armIdle();
  };

  const armIdle = () => {
    doc.classList.remove("historia-cursor-hidden");
    window.clearTimeout(cursorTimer);
    if (kiosk) cursorTimer = window.setTimeout(() => doc.classList.add("historia-cursor-hidden"), 3500);
    if (!kiosk) return;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!cine.active) startCine();
    }, 25000);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key;
    if (key === "ArrowRight") {
      event.preventDefault();
      goToScene(neighbour(1));
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      goToScene(neighbour(-1));
    } else if (key === "c" || key === "C") {
      cine.active ? stopCine("Modo cine en pausa") : startCine();
    } else if (key === "f" || key === "F") {
      toggleFullscreen();
    } else if ((key === "m" || key === "M") && soundtrack) {
      void soundtrack.toggle();
    } else {
      onUserIntent(event);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else doc.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  };

  const onFullscreenChange = () => {
    fullscreenButton?.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
    doc.classList.toggle("historia-fullscreen", Boolean(document.fullscreenElement));
    window.setTimeout(measure, 120);
  };

  const onCineClick = (event: Event) => {
    event.preventDefault();
    if (cine.active) {
      stopCine("Modo cine en pausa");
    } else {
      autoSound();
      startCine();
    }
  };

  const onAudioClick = (event: Event) => {
    event.preventDefault();
    void soundtrack?.toggle();
  };

  const onVolumeInput = () => {
    if (!soundtrack || !volumeInput) return;
    const value = Number(volumeInput.value) / 100;
    soundtrack.setVolume(value);
    if (value > 0 && !soundtrack.enabled) void soundtrack.enable();
  };

  const onRailClick = (event: Event) => {
    const button = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement>("[data-rail-target]");
    goToScene(scenes.find((scene) => scene.id === button?.dataset.railTarget));
  };

  const onStartClick = (event: Event) => {
    event.preventDefault();
    autoSound();
    goToScene(scenes[1]);
  };

  const onReplay = () => {
    stopCine();
    tweenTo(0);
  };

  const onVisibility = () => {
    soundtrack?.onVisibility(document.hidden);
    if (document.hidden) {
      guideVideo?.pause();
      return;
    }
    lastTime = performance.now();
    if (guide?.classList.contains("is-visible")) requestGuide();
    schedule();
  };

  const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions?]> = [
    [window, "scroll", schedule, { passive: true }],
    [window, "resize", measure, { passive: true }],
    [window, "load", measure],
    [window, "wheel", onUserIntent, { passive: true }],
    [window, "touchstart", onUserIntent, { passive: true }],
    [window, "pointerdown", onUserIntent, { passive: true }],
    [window, "pointermove", armIdle, { passive: true }],
    [window, "keydown", onKey as EventListener],
    [document, "fullscreenchange", onFullscreenChange],
    [document, "visibilitychange", onVisibility],
  ];

  cineButtons.forEach((button) => {
    button.hidden = false;
    listeners.push([button, "click", onCineClick]);
  });
  railButtons.forEach((button) => listeners.push([button, "click", onRailClick]));
  root.querySelectorAll("[data-historia-start]").forEach((link) => listeners.push([link, "click", onStartClick]));
  root.querySelectorAll<HTMLButtonElement>("[data-historia-replay], [data-historia-restart]").forEach((button) => {
    button.hidden = false;
    listeners.push([button, "click", onReplay]);
  });
  const prevButton = hud.querySelector("[data-historia-prev]");
  const nextButton = hud.querySelector("[data-historia-next]");
  if (prevButton) listeners.push([prevButton, "click", () => goToScene(neighbour(-1))]);
  if (nextButton) listeners.push([nextButton, "click", () => goToScene(neighbour(1))]);
  if (fullscreenButton && document.fullscreenEnabled) {
    fullscreenButton.hidden = false;
    listeners.push([fullscreenButton, "click", toggleFullscreen]);
  }
  if (soundtrack) {
    audioButtons.forEach((button) => {
      button.hidden = false;
      listeners.push([button, "click", onAudioClick]);
    });
    if (volumeInput) listeners.push([volumeInput, "input", onVolumeInput]);
    soundtrack.subscribe(syncAudioUi);
    syncAudioUi();
  } else {
    hud.querySelector<HTMLElement>("[data-historia-audio-group]")?.setAttribute("hidden", "");
  }

  listeners.forEach(([target, type, handler, options]) => target.addEventListener(type, handler, options));

  const resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(root);

  if (window.scrollY < window.innerHeight) requestLayer(prologue.layer);
  measure();
  armIdle();
  if (kiosk) {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!cine.active) startCine();
    }, 6000);
  }

  return () => {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    cancelTween();
    counterFrames.forEach((id) => cancelAnimationFrame(id));
    [typeTimer].forEach((id) => window.clearInterval(id));
    [flashTimer, idleTimer, cursorTimer, kioskLoopTimer].forEach((id) => window.clearTimeout(id));
    listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    resizeObserver.disconnect();
    layers.forEach((layer) => layer.video.pause());
    guideVideo?.pause();
    soundtrack?.destroy();
    doc.classList.remove(
      "historia-cinema-active",
      "historia-immersive",
      "historia-kiosco",
      "historia-cursor-hidden",
      "historia-fullscreen",
    );
  };
}
