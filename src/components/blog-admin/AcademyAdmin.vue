<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { AI_ACADEMY_DEFAULT_STATE, AI_ACADEMY_WORKSHOPS } from "../../content/aiAcademy";
import type { BlogAdminApi, EditorWorkshop, EditorWorkshopChanges, EditorWorkshopCurriculum } from "../../lib/blog-admin";
import AcademyIcon from "./academy/AcademyIcon.vue";

const props = defineProps<{
  api: BlogAdminApi;
  cmsUrl: string;
  // Dentro del detalle de un taller: solo esa tarjeta y sin encabezado propio.
  embedded?: boolean;
  onlyKey?: string;
}>();

const emit = defineEmits<{
  (e: "notice", message: string, type?: "success" | "error"): void;
}>();

const MAX_PDF_MB = 20;

type Draft = { isOpen: boolean; startDate: string; curriculum: EditorWorkshopCurriculum | null };
type Card = {
  base: EditorWorkshop;
  draft: Draft;
  saving: boolean;
  uploading: boolean;
  progress: number;
  dragging: boolean;
  error: string;
  savedAt: number;
  copied: boolean;
};

const loading = ref(true);
const loadError = ref("");
const cards = ref<Card[]>([]);
const savingAll = ref(false);
const now = ref(Date.now());
let clock = 0;

const accentFor = (key: string) => AI_ACADEMY_WORKSHOPS.find((item) => item.id === key)?.accent ?? "#57bbff";
const promiseFor = (key: string) => AI_ACADEMY_WORKSHOPS.find((item) => item.id === key)?.promise ?? "";
const pagePath = (card: Card) => `/ai-academy/${card.base.slug}/`;

function fallbackWorkshops(): EditorWorkshop[] {
  return AI_ACADEMY_WORKSHOPS.map((workshop, index) => {
    const defaultState = AI_ACADEMY_DEFAULT_STATE[workshop.id] ?? {
      isOpen: false,
      startDate: "Próximamente",
    };
    return {
      key: workshop.id,
      slug: workshop.slug,
      code: workshop.code,
      title: workshop.title,
      order: index + 1,
      isOpen: defaultState.isOpen,
      startDate: defaultState.startDate,
      updatedAt: new Date().toISOString(),
      curriculum: null,
    };
  });
}

function draftOf(workshop: EditorWorkshop): Draft {
  return { isOpen: workshop.isOpen, startDate: workshop.startDate || "Próximamente", curriculum: workshop.curriculum };
}

function isDirty(card: Card) {
  return (
    card.draft.isOpen !== card.base.isOpen ||
    card.draft.startDate.trim() !== (card.base.startDate || "Próximamente") ||
    (card.draft.curriculum?.id ?? null) !== (card.base.curriculum?.id ?? null)
  );
}

const dirtyCards = computed(() => cards.value.filter(isDirty));
const openCount = computed(() => cards.value.filter((card) => card.base.isOpen).length);
const pdfCount = computed(() => cards.value.filter((card) => card.base.curriculum).length);

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    let workshops: EditorWorkshop[] = [];
    try {
      workshops = await props.api.workshops();
    } catch (apiError) {
      console.warn("[AI Academy Admin] Error al consultar talleres desde el CMS, usando respaldo local:", apiError);
      workshops = fallbackWorkshops();
    }

    if (!Array.isArray(workshops) || workshops.length === 0) {
      workshops = fallbackWorkshops();
    }

    if (props.onlyKey) workshops = workshops.filter((workshop) => workshop.key === props.onlyKey);
    cards.value = workshops.map((workshop) => ({
      base: workshop,
      draft: draftOf(workshop),
      saving: false,
      uploading: false,
      progress: 0,
      dragging: false,
      error: "",
      savedAt: 0,
      copied: false,
    }));
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "No se pudieron cargar los talleres.";
  } finally {
    loading.value = false;
  }
}

function formatSize(kilobytes: number) {
  if (!kilobytes) return "";
  return kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kilobytes))} KB`;
}

function formatDate(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function savedLabel(card: Card) {
  if (!card.savedAt) return "";
  const seconds = Math.round((now.value - card.savedAt) / 1000);
  return seconds < 60 ? "Guardado hace un momento" : `Guardado hace ${Math.round(seconds / 60)} min`;
}

function fileUrl(file: EditorWorkshopCurriculum) {
  return /^https?:\/\//.test(file.url) ? file.url : `${props.cmsUrl.replace(/\/+$/, "")}${file.url}`;
}

// Subida con progreso real (fetch no lo informa). El archivo queda en la biblioteca del CMS y se
// asigna al taller al guardar.
function uploadWithProgress(file: File, onProgress: (value: number) => void) {
  return new Promise<EditorWorkshopCurriculum>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${props.cmsUrl.replace(/\/+$/, "")}/api/upload`);
    request.setRequestHeader("Authorization", `Bearer ${props.api.token}`);
    request.setRequestHeader("Accept", "application/json");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let payload: any = null;
      try { payload = JSON.parse(request.responseText); } catch { /* respuesta vacía */ }
      if (request.status >= 200 && request.status < 300 && Array.isArray(payload) && payload[0]) {
        resolve(payload[0] as EditorWorkshopCurriculum);
      } else {
        let msg = payload?.error?.message || "El CMS no aceptó el archivo.";
        if (msg.includes("not allowed")) {
          msg = "Tipo de archivo no permitido en el servidor. Solo se admiten archivos PDF.";
        } else if (msg.includes("too large") || msg.includes("exceeds") || request.status === 413) {
          msg = `El archivo supera el tamaño máximo permitido (${MAX_PDF_MB} MB).`;
        }
        reject(new Error(msg));
      }
    };
    request.onerror = () => reject(new Error("No hay conexión con el CMS."));
    const form = new FormData();
    form.append("files", file);
    request.send(form);
  });
}

async function attachPdf(card: Card, file: File | undefined | null) {
  card.error = "";
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    card.error = "Solo se aceptan archivos PDF.";
    return;
  }
  if (file.size > MAX_PDF_MB * 1024 * 1024) {
    card.error = `El PDF pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${MAX_PDF_MB} MB.`;
    return;
  }
  card.uploading = true;
  card.progress = 0;
  try {
    const media = await uploadWithProgress(file, (value) => { card.progress = value; });
    const isMediaPdf = (media.mime && media.mime.includes("pdf")) || (media.ext && media.ext.toLowerCase().includes("pdf"));
    if (!isMediaPdf) throw new Error("El archivo subido no es un PDF válido.");
    card.draft.curriculum = media;
    emit("notice", `PDF listo para "${card.base.title}". Guarda el taller para publicarlo.`);
  } catch (error) {
    card.error = error instanceof Error ? error.message : "No se pudo subir el PDF.";
  } finally {
    card.uploading = false;
  }
}

function onPick(card: Card, event: Event) {
  const input = event.target as HTMLInputElement;
  void attachPdf(card, input.files?.[0]);
  input.value = "";
}

function onDrop(card: Card, event: DragEvent) {
  card.dragging = false;
  void attachPdf(card, event.dataTransfer?.files?.[0]);
}

function discard(card: Card) {
  card.draft = draftOf(card.base);
  card.error = "";
}

async function save(card: Card, quiet = false) {
  if (!isDirty(card) || card.saving) return true;
  const changes: EditorWorkshopChanges = {};
  if (card.draft.isOpen !== card.base.isOpen) changes.isOpen = card.draft.isOpen;
  const date = card.draft.startDate.trim() || "Próximamente";
  if (date !== (card.base.startDate || "Próximamente")) changes.startDate = date;
  if ((card.draft.curriculum?.id ?? null) !== (card.base.curriculum?.id ?? null)) changes.curriculum = card.draft.curriculum?.id ?? null;
  card.saving = true;
  card.error = "";
  try {
    const updated = await props.api.updateWorkshop(card.base.key, changes);
    card.base = updated;
    card.draft = draftOf(updated);
    card.savedAt = Date.now();
    if (!quiet) emit("notice", `"${updated.title}" quedó publicado en su página.`);
    return true;
  } catch (error) {
    card.error = error instanceof Error ? error.message : "No se pudo guardar.";
    if (!quiet) emit("notice", card.error, "error");
    return false;
  } finally {
    card.saving = false;
  }
}

async function saveAll() {
  savingAll.value = true;
  const pending = [...dirtyCards.value];
  const results = await Promise.all(pending.map((card) => save(card, true)));
  savingAll.value = false;
  const failed = results.filter((ok) => !ok).length;
  if (failed) emit("notice", `No se pudieron guardar ${failed} talleres. Revisa el mensaje en cada tarjeta.`, "error");
  else emit("notice", pending.length === 1 ? "Taller guardado y publicado." : `${pending.length} talleres guardados y publicados.`);
}

async function copyLink(card: Card) {
  const url = `${window.location.origin}${pagePath(card)}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copia el enlace del taller:", url);
  }
  card.copied = true;
  window.setTimeout(() => { card.copied = false; }, 2200);
}

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  if (!dirtyCards.value.length) return;
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => {
  void load();
  clock = window.setInterval(() => { now.value = Date.now(); }, 15000);
  window.addEventListener("beforeunload", warnBeforeLeaving);
});

onBeforeUnmount(() => {
  window.clearInterval(clock);
  window.removeEventListener("beforeunload", warnBeforeLeaving);
});
</script>

<template>
  <section class="academy" :class="{ 'academy--embedded': embedded }">
    <header v-if="!embedded" class="page-heading academy__heading">
      <div>
        <p>AI ACADEMY / TALLERES</p>
        <h1>Talleres y mallas curriculares</h1>
        <span>
          Abre o cierra inscripciones, define la fecha de inicio y sube la malla en PDF de cada taller.
          Al guardar, la página pública del taller se actualiza al instante y el PDF queda listo para descargar.
        </span>
      </div>
      <a class="academy__public" href="/ai-academy/" target="_blank" rel="noopener">Ver AI Academy ↗</a>
    </header>

    <div v-if="loading" class="academy__state">
      <i aria-hidden="true"></i>
      <p>Cargando talleres…</p>
    </div>

    <div v-else-if="loadError" class="academy__state academy__state--error">
      <span aria-hidden="true">!</span>
      <p>{{ loadError }}</p>
      <button type="button" @click="load">Reintentar</button>
    </div>

    <template v-else>
      <dl v-if="!embedded" class="academy__summary">
        <div><dt>{{ cards.length }}</dt><dd>talleres</dd></div>
        <div class="is-green"><dt>{{ openCount }}</dt><dd>con inscripciones abiertas</dd></div>
        <div class="is-blue"><dt>{{ pdfCount }}<small>/{{ cards.length }}</small></dt><dd>con malla en PDF</dd></div>
      </dl>

      <div class="academy__grid">
        <article
          v-for="(card, index) in cards"
          :key="card.base.key"
          class="workshop"
          :class="{ 'is-dirty': isDirty(card), 'is-open': card.draft.isOpen }"
          :style="{ '--accent': accentFor(card.base.key) }"
        >
          <header class="workshop__top">
            <span class="workshop__code">{{ card.base.code }}</span>
            <span class="workshop__order">{{ String(index + 1).padStart(2, "0") }}/{{ String(cards.length).padStart(2, "0") }}</span>
            <span v-if="isDirty(card)" class="workshop__badge">Sin guardar</span>
            <span v-else-if="savedLabel(card)" class="workshop__badge workshop__badge--saved"><AcademyIcon name="check" :size="12" /> {{ savedLabel(card) }}</span>
          </header>

          <h2>{{ card.base.title }}</h2>
          <p class="workshop__promise">{{ promiseFor(card.base.key) }}</p>

          <div class="workshop__links">
            <a :href="pagePath(card)" target="_blank" rel="noopener">Ver página ↗</a>
            <button type="button" @click="copyLink(card)">{{ card.copied ? "¡Enlace copiado!" : "Copiar enlace para compartir" }}</button>
          </div>

          <fieldset class="workshop__field">
            <legend>Inscripciones</legend>
            <div class="workshop__switch" role="radiogroup" :aria-label="`Estado de ${card.base.title}`">
              <button type="button" role="radio" :aria-checked="card.draft.isOpen" :class="{ active: card.draft.isOpen }" @click="card.draft.isOpen = true">
                <i aria-hidden="true"></i> Abiertas
              </button>
              <button type="button" role="radio" :aria-checked="!card.draft.isOpen" :class="{ active: !card.draft.isOpen }" @click="card.draft.isOpen = false">
                Próximamente
              </button>
            </div>
          </fieldset>

          <label class="workshop__field">
            <span class="workshop__label">Fecha de inicio</span>
            <div class="workshop__date">
              <input v-model="card.draft.startDate" type="text" maxlength="60" placeholder="Ej. 24 de octubre" />
              <button type="button" :class="{ active: card.draft.startDate === 'Próximamente' }" @click="card.draft.startDate = 'Próximamente'">Por confirmar</button>
            </div>
            <small>Se muestra tal cual en la página: «Inicia el 24 de octubre».</small>
          </label>

          <div class="workshop__field">
            <span class="workshop__label">Malla curricular (PDF)</span>

            <div v-if="card.uploading" class="pdf pdf--uploading">
              <div class="pdf__icon">PDF</div>
              <div class="pdf__info">
                <strong>Subiendo… {{ card.progress }}%</strong>
                <span class="pdf__bar"><i :style="{ width: `${card.progress}%` }"></i></span>
              </div>
            </div>

            <div v-else-if="card.draft.curriculum" class="pdf" :class="{ 'pdf--new': card.draft.curriculum.id !== card.base.curriculum?.id }">
              <div class="pdf__icon">PDF</div>
              <div class="pdf__info">
                <strong :title="card.draft.curriculum.name">{{ card.draft.curriculum.name }}</strong>
                <span>
                  {{ formatSize(card.draft.curriculum.size) }}
                  <template v-if="card.draft.curriculum.id !== card.base.curriculum?.id"> · nuevo, falta guardar</template>
                  <template v-else-if="formatDate(card.draft.curriculum.updatedAt)"> · subido el {{ formatDate(card.draft.curriculum.updatedAt) }}</template>
                </span>
              </div>
              <div class="pdf__actions">
                <a :href="fileUrl(card.draft.curriculum)" target="_blank" rel="noopener" title="Abrir el PDF">Ver</a>
                <label title="Reemplazar el PDF">
                  Cambiar
                  <input type="file" accept="application/pdf,.pdf" @change="onPick(card, $event)" />
                </label>
                <button type="button" title="Quitar el PDF del taller" @click="card.draft.curriculum = null">Quitar</button>
              </div>
            </div>

            <label
              v-else
              class="drop"
              :class="{ 'drop--over': card.dragging }"
              @dragover.prevent="card.dragging = true"
              @dragleave.prevent="card.dragging = false"
              @drop.prevent="onDrop(card, $event)"
            >
              <input type="file" accept="application/pdf,.pdf" @change="onPick(card, $event)" />
              <span class="drop__icon" aria-hidden="true">↑</span>
              <strong>Arrastra el PDF aquí o <u>elígelo</u></strong>
              <small>Solo PDF · hasta {{ MAX_PDF_MB }} MB</small>
            </label>
          </div>

          <p v-if="card.error" class="workshop__error" role="alert">{{ card.error }}</p>

          <footer class="workshop__footer">
            <button type="button" class="workshop__discard" :disabled="!isDirty(card) || card.saving" @click="discard(card)">Descartar</button>
            <button type="button" class="primary-action primary-action--small" :disabled="!isDirty(card) || card.saving || card.uploading" @click="save(card)">
              <span>{{ card.saving ? "Guardando…" : "Guardar y publicar" }}</span>
              <b><AcademyIcon name="check" :size="15" /></b>
            </button>
          </footer>
        </article>
      </div>

      <transition name="dock">
        <div v-if="dirtyCards.length" class="academy__dock" role="status">
          <span><i aria-hidden="true"></i>{{ dirtyCards.length === 1 ? "1 taller con cambios sin guardar" : `${dirtyCards.length} talleres con cambios sin guardar` }}</span>
          <button type="button" class="primary-action primary-action--small" :disabled="savingAll" @click="saveAll">
            <span>{{ savingAll ? "Guardando…" : "Guardar todo" }}</span>
            <b><AcademyIcon name="check" :size="15" /></b>
          </button>
        </div>
      </transition>
    </template>
  </section>
</template>

<style scoped>
.academy--embedded { padding-bottom: 40px; }
.academy--embedded .academy__grid { grid-template-columns: minmax(0, 720px); }
.academy { --card: linear-gradient(170deg, rgba(14, 30, 79, 0.82), rgba(5, 14, 47, 0.92)); padding-bottom: 96px; }
/* Los estilos de encabezado y botones del editor son locales a BlogAdmin: se repiten aquí. */
.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; }
.page-heading p { margin: 0; color: var(--blue); font: 700 10px/1 ui-monospace, monospace; letter-spacing: 0.18em; }
.page-heading h1 { margin: 10px 0 0; font-size: clamp(32px, 4vw, 58px); line-height: 1; letter-spacing: -0.05em; }
.page-heading > div > span { display: block; max-width: 680px; margin-top: 14px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.primary-action { display: inline-flex; min-height: 48px; padding: 0 16px; align-items: center; justify-content: center; gap: 18px; border: 0; border-radius: 12px; color: #021a21; background: linear-gradient(90deg, #50c8ff, #00d9a4); box-shadow: 0 14px 30px rgba(0, 217, 164, 0.14); cursor: pointer; font-weight: 750; transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s; }
.primary-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 38px rgba(0, 217, 164, 0.22); }
.primary-action b { font-size: 18px; }
.primary-action--small { min-height: 43px; }
.academy__heading { flex-wrap: wrap; }
.academy__public { display: inline-flex; min-height: 43px; padding: 0 16px; align-items: center; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: rgba(87, 187, 255, 0.06); font-size: 13px; font-weight: 700; text-decoration: none; transition: border-color 0.2s, background 0.2s; }
.academy__public:hover { border-color: rgba(87, 187, 255, 0.45); background: rgba(87, 187, 255, 0.12); }

.academy__state { display: grid; min-height: 40vh; place-content: center; justify-items: center; gap: 14px; color: var(--muted); font-size: 13px; text-align: center; }
.academy__state i { width: 36px; height: 36px; border: 2px solid rgba(87, 187, 255, 0.18); border-top-color: var(--green); border-radius: 50%; animation: spin 0.8s linear infinite; }
.academy__state--error span { display: grid; width: 50px; height: 50px; place-content: center; border: 1px solid rgba(255, 100, 120, 0.3); border-radius: 50%; color: #ff6478; font-size: 24px; }
.academy__state button { padding: 10px 16px; border: 1px solid var(--line); border-radius: 10px; color: white; background: rgba(87, 187, 255, 0.08); cursor: pointer; }

.academy__summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 34px 0 26px; }
.academy__summary div { padding: 18px 20px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); }
.academy__summary dt { font: 800 34px/1 ui-monospace, monospace; letter-spacing: -0.04em; }
.academy__summary dt small { color: var(--muted); font-size: 18px; }
.academy__summary dd { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
.academy__summary .is-green dt { color: var(--green); }
.academy__summary .is-blue dt { color: var(--blue); }

.academy__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 18px; }

.workshop { position: relative; display: flex; flex-direction: column; gap: 16px; padding: 24px; overflow: hidden; border: 1px solid var(--line); border-radius: 24px; background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 42%), var(--card); box-shadow: 0 24px 60px rgba(0, 0, 30, 0.28); transition: border-color 0.25s, box-shadow 0.25s; }
.workshop::before { position: absolute; top: 0; left: 24px; right: 24px; height: 2px; border-radius: 0 0 4px 4px; background: linear-gradient(90deg, var(--accent), transparent); content: ""; opacity: 0.8; }
.workshop.is-dirty { border-color: rgba(255, 197, 107, 0.45); box-shadow: 0 24px 60px rgba(0, 0, 30, 0.28), 0 0 0 3px rgba(255, 197, 107, 0.06); }

.workshop__top { display: flex; align-items: center; gap: 10px; }
.workshop__code { padding: 6px 10px; border-radius: 999px; color: #030b28; background: var(--accent); font: 800 11px/1 ui-monospace, monospace; letter-spacing: 0.08em; }
.workshop__order { color: var(--muted); font: 700 10px/1 ui-monospace, monospace; letter-spacing: 0.14em; }
.workshop__badge { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 6px 10px; border: 1px solid rgba(255, 197, 107, 0.4); border-radius: 999px; color: #ffd591; background: rgba(255, 197, 107, 0.08); font: 700 10px/1 ui-monospace, monospace; letter-spacing: 0.06em; }
.workshop__badge--saved { border-color: rgba(0, 217, 164, 0.35); color: #9ff5dd; background: rgba(0, 217, 164, 0.08); }

.workshop h2 { margin: 2px 0 0; font-size: clamp(22px, 2.2vw, 27px); line-height: 1.12; letter-spacing: -0.035em; }
.workshop__promise { margin: -6px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }

.workshop__links { display: flex; flex-wrap: wrap; gap: 8px; }
.workshop__links a, .workshop__links button { display: inline-flex; min-height: 34px; padding: 0 12px; align-items: center; border: 1px solid var(--line); border-radius: 10px; color: #bfe6ff; background: rgba(87, 187, 255, 0.05); font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.workshop__links a:hover, .workshop__links button:hover { border-color: rgba(87, 187, 255, 0.45); background: rgba(87, 187, 255, 0.12); }

.workshop__field { display: grid; gap: 9px; margin: 0; padding: 0; border: 0; min-width: 0; }
.workshop__field legend, .workshop__label { padding: 0; color: rgba(255, 255, 255, 0.67); font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
.workshop__field legend { margin-bottom: 9px; }
.workshop__field small { color: var(--muted); font-size: 11px; }

.workshop__switch { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; background: rgba(2, 9, 34, 0.7); }
.workshop__switch button { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 10px; color: var(--muted); background: transparent; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s, color 0.2s; }
.workshop__switch button.active { color: #fff; background: rgba(122, 60, 255, 0.28); box-shadow: inset 0 0 0 1px rgba(185, 151, 255, 0.35); }
.workshop__switch button:first-child.active { color: #021a21; background: linear-gradient(90deg, #50c8ff, #00d9a4); box-shadow: none; }
.workshop__switch i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.workshop__switch button:first-child.active i { background: #021a21; box-shadow: 0 0 0 3px rgba(2, 26, 33, 0.18); }

.workshop__date { display: flex; gap: 8px; }
.workshop__date input { flex: 1; min-width: 0; min-height: 44px; padding: 10px 13px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; outline: 0; color: white; background: rgba(2, 9, 34, 0.7); transition: border-color 0.2s, box-shadow 0.2s; }
.workshop__date input:focus { border-color: rgba(0, 217, 164, 0.55); box-shadow: 0 0 0 3px rgba(0, 217, 164, 0.08); }
.workshop__date button { padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; color: var(--muted); background: transparent; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.workshop__date button.active { border-color: rgba(185, 151, 255, 0.45); color: #e3d7ff; background: rgba(122, 60, 255, 0.16); }

.drop { position: relative; display: grid; min-height: 132px; place-content: center; justify-items: center; gap: 6px; padding: 18px; border: 1.5px dashed rgba(87, 187, 255, 0.32); border-radius: 18px; color: var(--ink); background: rgba(87, 187, 255, 0.03); text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s, transform 0.2s; }
.drop:hover, .drop--over { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.drop--over { transform: scale(1.01); }
.drop input, .pdf__actions label input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.drop__icon { display: grid; width: 40px; height: 40px; place-content: center; border-radius: 12px; color: #030b28; background: var(--accent); font-weight: 900; }
.drop strong { font-size: 14px; }
.drop u { color: var(--accent); text-underline-offset: 3px; }
.drop small { color: var(--muted); font-size: 11px; }

.pdf { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 14px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; background: rgba(2, 9, 34, 0.6); }
.pdf--new { border-color: rgba(255, 197, 107, 0.45); background: rgba(255, 197, 107, 0.05); }
.pdf__icon { display: grid; width: 46px; height: 56px; place-content: center; border-radius: 8px 14px 8px 8px; color: #fff; background: linear-gradient(160deg, #ff5b61, #c4262c); box-shadow: 0 10px 24px rgba(229, 72, 77, 0.28); font: 800 11px/1 ui-monospace, monospace; letter-spacing: 0.06em; }
.pdf__info { display: grid; gap: 5px; min-width: 0; }
.pdf__info strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.pdf__info span { color: var(--muted); font-size: 12px; }
.pdf__bar { display: block; height: 6px; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.08); }
.pdf__bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #50c8ff, #00d9a4); transition: width 0.2s; }
.pdf__actions { display: flex; gap: 6px; }
.pdf__actions a, .pdf__actions label, .pdf__actions button { position: relative; display: inline-flex; min-height: 34px; padding: 0 11px; align-items: center; border: 1px solid var(--line); border-radius: 10px; color: #d8f0ff; background: rgba(87, 187, 255, 0.05); font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; }
.pdf__actions a:hover, .pdf__actions label:hover { border-color: rgba(87, 187, 255, 0.45); }
.pdf__actions button { color: #ffb3bd; border-color: rgba(255, 100, 120, 0.25); background: rgba(255, 67, 91, 0.06); }
.pdf__actions button:hover { border-color: rgba(255, 100, 120, 0.55); }

.workshop__error { margin: 0; padding: 10px 12px; border: 1px solid rgba(255, 98, 117, 0.25); border-radius: 10px; color: #ff9aa7; background: rgba(255, 67, 91, 0.08); font-size: 12px; }

.workshop__footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: auto; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.workshop__discard { min-height: 43px; padding: 0 14px; border: 0; border-radius: 12px; color: var(--muted); background: transparent; font-weight: 700; cursor: pointer; }
.workshop__discard:not(:disabled):hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
.workshop__discard:disabled { opacity: 0.4; cursor: default; }
.workshop .primary-action:disabled { opacity: 0.4; cursor: default; transform: none; }

.academy__dock { position: fixed; bottom: 22px; left: 50%; z-index: 15; display: flex; align-items: center; gap: 18px; padding: 10px 10px 10px 20px; border: 1px solid rgba(255, 197, 107, 0.35); border-radius: 18px; color: #ffe2b0; background: rgba(12, 18, 52, 0.96); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45); font-size: 13px; font-weight: 600; transform: translateX(-50%); backdrop-filter: blur(16px); }
.academy__dock span { display: inline-flex; align-items: center; gap: 10px; }
.academy__dock i { width: 8px; height: 8px; border-radius: 50%; background: #ffc56b; box-shadow: 0 0 10px #ffc56b; animation: pulse 1.6s ease-in-out infinite; }
.dock-enter-active, .dock-leave-active { transition: opacity 0.25s, transform 0.25s; }
.dock-enter-from, .dock-leave-to { opacity: 0; transform: translate(-50%, 16px); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 50% { opacity: 0.45; transform: scale(1.3); } }

@media (max-width: 720px) {
  .academy__summary { grid-template-columns: 1fr; }
  .workshop { padding: 20px; }
  .pdf { grid-template-columns: auto minmax(0, 1fr); }
  .pdf__actions { grid-column: 1 / -1; }
  .academy__dock { right: 12px; left: 12px; justify-content: space-between; transform: none; }
  .dock-enter-from, .dock-leave-to { transform: translateY(16px); }
}

@media (prefers-reduced-motion: reduce) {
  .workshop, .drop, .pdf__bar i { transition: none; }
  .academy__dock i, .academy__state i { animation: none; }
}
</style>
