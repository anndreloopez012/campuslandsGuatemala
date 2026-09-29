type SceneKind = "prologo" | "acto" | "capitulo" | "epilogo";

interface SoundtrackOptions {
  src: string;
  loopStart: number;
  loopEnd: number;
  data?: ArrayBuffer | null;
}

export interface Soundtrack {
  readonly enabled: boolean;
  readonly volume: number;
  enable: () => Promise<void>;
  disable: () => void;
  toggle: () => Promise<void>;
  setVolume: (value: number) => void;
  setScene: (kind: SceneKind) => void;
  onVisibility: (hidden: boolean) => void;
  subscribe: (listener: () => void) => () => void;
  destroy: () => void;
}

const STORAGE_STATE = "historia-sonido";
const STORAGE_VOLUME = "historia-volumen";
const FADE_IN = 2.6;
const FADE_OUT = 1.4;

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento no disponible (modo privado o bloqueado): se mantiene en memoria.
  }
};

const SCENE_MIX: Record<SceneKind, { cutoff: number; level: number }> = {
  prologo: { cutoff: 16000, level: 1 },
  acto: { cutoff: 19000, level: 1 },
  capitulo: { cutoff: 6500, level: 0.82 },
  epilogo: { cutoff: 17000, level: 1 },
};

export function createSoundtrack({ src, loopStart, loopEnd, data }: SoundtrackOptions): Soundtrack {
  const AudioContextClass =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  const storedVolume = Number(readStorage(STORAGE_VOLUME));
  let volume = Number.isFinite(storedVolume) && storedVolume > 0 && storedVolume <= 1 ? storedVolume : 0.7;
  let enabled = false;
  let destroyed = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sceneGain: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let bufferPromise: Promise<AudioBuffer> | null = null;
  let suspendTimer = 0;
  let scene: SceneKind = "prologo";
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const ensureGraph = () => {
    if (context || !AudioContextClass) return context;
    context = new AudioContextClass({ latencyHint: "playback" });
    master = context.createGain();
    sceneGain = context.createGain();
    filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.4;
    filter.frequency.value = SCENE_MIX[scene].cutoff;
    sceneGain.gain.value = SCENE_MIX[scene].level;
    master.gain.value = 0;
    filter.connect(sceneGain).connect(master).connect(context.destination);
    return context;
  };

  const loadBuffer = () => {
    if (bufferPromise) return bufferPromise;
    const audioContext = ensureGraph();
    if (!audioContext) return Promise.reject(new Error("Web Audio no disponible"));
    // decodeAudioData desprende el buffer; se entrega una copia para poder reintentar.
    const bytes = data
      ? Promise.resolve(data.slice(0))
      : fetch(src).then((response) => {
          if (!response.ok) throw new Error(`Audio ${response.status}`);
          return response.arrayBuffer();
        });
    bufferPromise = bytes.then((buffer) => audioContext.decodeAudioData(buffer));
    bufferPromise.catch(() => {
      bufferPromise = null;
    });
    return bufferPromise;
  };

  const startSource = (buffer: AudioBuffer) => {
    if (!context || !filter || source) return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = Math.min(loopStart, buffer.duration - 1);
    source.loopEnd = Math.min(loopEnd, buffer.duration);
    source.connect(filter);
    source.start(0, 0);
  };

  const ramp = (target: number, seconds: number) => {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + seconds);
  };

  const enable = async () => {
    if (destroyed) return;
    window.clearTimeout(suspendTimer);
    enabled = true;
    writeStorage(STORAGE_STATE, "on");
    notify();
    try {
      const audioContext = ensureGraph();
      if (!audioContext) throw new Error("Web Audio no disponible");
      if (audioContext.state === "suspended") await audioContext.resume();
      const buffer = await loadBuffer();
      if (!enabled || destroyed) return;
      startSource(buffer);
      ramp(volume, FADE_IN);
    } catch {
      enabled = false;
      notify();
    }
  };

  const disable = () => {
    enabled = false;
    writeStorage(STORAGE_STATE, "off");
    notify();
    if (!context) return;
    ramp(0, FADE_OUT);
    window.clearTimeout(suspendTimer);
    suspendTimer = window.setTimeout(() => {
      if (!enabled) context?.suspend().catch(() => {});
    }, FADE_OUT * 1000 + 120);
  };

  const setVolume = (value: number) => {
    volume = Math.min(1, Math.max(0, value));
    writeStorage(STORAGE_VOLUME, volume.toFixed(2));
    if (enabled) ramp(volume, 0.25);
    notify();
  };

  const setScene = (kind: SceneKind) => {
    scene = kind;
    if (!context || !filter || !sceneGain) return;
    const now = context.currentTime;
    filter.frequency.setTargetAtTime(SCENE_MIX[kind].cutoff, now, 0.9);
    sceneGain.gain.setTargetAtTime(SCENE_MIX[kind].level, now, 1.1);
  };

  const onVisibility = (hidden: boolean) => {
    if (!context || !enabled) return;
    if (hidden) {
      context.suspend().catch(() => {});
    } else {
      context.resume().catch(() => {});
    }
  };

  const destroy = () => {
    destroyed = true;
    enabled = false;
    window.clearTimeout(suspendTimer);
    listeners.clear();
    if (!context) return;
    const closing = context;
    ramp(0, 0.4);
    window.setTimeout(() => {
      try {
        source?.stop();
      } catch {
        // La fuente ya estaba detenida.
      }
      closing.close().catch(() => {});
    }, 480);
  };

  return {
    get enabled() {
      return enabled;
    },
    get volume() {
      return volume;
    },
    enable,
    disable,
    toggle: () => (enabled ? Promise.resolve(disable()) : enable()),
    setVolume,
    setScene,
    onVisibility,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy,
  };
}

export const soundPreference = () => readStorage(STORAGE_STATE);
