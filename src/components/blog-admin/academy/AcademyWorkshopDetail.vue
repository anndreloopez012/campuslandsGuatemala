<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { AcademyBlock, AcademyDetail, AcademyDiploma, AcademyEnrollment, AcademyPerson, AcademyTool, AcademyVideo, BlogAdminApi } from "../../../lib/blog-admin";
import AcademyAdmin from "../AcademyAdmin.vue";
import AcademyIcon from "./AcademyIcon.vue";

const props = defineProps<{ api: BlogAdminApi; cmsUrl: string; workshopKey: string }>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "users"): void;
  (e: "notice", message: string, type?: "success" | "error"): void;
}>();

type Tab = "bloques" | "estudiantes" | "diplomas" | "herramientas" | "videos" | "publicacion" | "ajustes";
const tab = ref<Tab>("bloques");
const loading = ref(true);
const error = ref("");
const detail = ref<AcademyDetail | null>(null);
const busy = ref(false);

const say = (message: string, type: "success" | "error" = "success") => emit("notice", message, type);
const problem = (value: unknown, fallback: string) => (value instanceof Error ? value.message : fallback);

async function load(quiet = false) {
  if (!quiet) loading.value = true;
  error.value = "";
  try {
    detail.value = await props.api.academyWorkshop(props.workshopKey);
  } catch (value) {
    error.value = problem(value, "No se pudo cargar el taller.");
  } finally {
    loading.value = false;
  }
}

const workshop = computed(() => detail.value?.workshop);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const sizeLabel = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const dateLabel = (value?: string) => (value ? new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "");
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- bloques
// Cada bloque es una edición del taller con su grupo de alumnos. El administrador define el avance
// eligiendo la sesión en la que va el bloque: sábado 2 de 4 = 50 %. Los sábados siguientes quedan con candado.
const blocks = computed<AcademyBlock[]>(() => detail.value?.blocks ?? []);
const blockName = (id?: number | null) => blocks.value.find((block) => block.id === id)?.name ?? "";
const newestBlock = computed(() => blocks.value[0]?.id ?? 0);
const blockForm = reactive({ name: "", startDate: "", totalSessions: 4 });
const blockOpen = ref(false);
const blockError = ref("");
const statusLabel = { "por-iniciar": "Por iniciar", "en-curso": "En curso", finalizado: "Finalizado" } as const;

function openBlock() {
  const month = new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(new Date());
  Object.assign(blockForm, { name: `Bloque ${month}`, startDate: today(), totalSessions: 4 });
  blockError.value = "";
  blockOpen.value = true;
}

async function createBlock() {
  blockError.value = "";
  busy.value = true;
  try {
    await props.api.createBlock({ workshop: props.workshopKey, ...blockForm });
    blockOpen.value = false;
    say(`Bloque "${blockForm.name}" creado: inscribe a sus alumnos y avanza sus sesiones.`);
    await load(true);
  } catch (value) {
    blockError.value = problem(value, "No se pudo crear el bloque.");
  } finally {
    busy.value = false;
  }
}

async function patchBlock(block: AcademyBlock, change: Partial<Pick<AcademyBlock, "name" | "startDate" | "totalSessions" | "currentSession">>, message = "") {
  try {
    Object.assign(block, await props.api.updateBlock(block.id, change));
    if (message) say(message);
  } catch (value) {
    say(problem(value, "No se pudo actualizar el bloque."), "error");
  }
}

function setSession(block: AcademyBlock, session: number) {
  const next = block.currentSession === session ? session - 1 : session;
  const label = next === 0 ? "sin iniciar" : `en el sábado ${next} de ${block.totalSessions}`;
  void patchBlock(block, { currentSession: next }, `${block.name} quedó ${label} (${Math.round((next / block.totalSessions) * 100)} %). Sus alumnos ya lo ven.`);
}

async function deleteBlock(block: AcademyBlock) {
  if (!window.confirm(`¿Eliminar "${block.name}"? Sus videos y herramientas exclusivos pasarán a ser de todos los bloques.`)) return;
  try {
    await props.api.removeBlock(block.id);
    say("Bloque eliminado.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo eliminar."), "error");
  }
}

// ---------------------------------------------------------------- estudiantes
const allStudents = ref<AcademyPerson[]>([]);
const studentsLoaded = ref(false);
const enrollPick = ref(0);
const enrollBlock = ref(0);
const studentFilter = ref(0);
const visibleEnrollments = computed(() => (detail.value?.enrollments ?? []).filter((item) => !studentFilter.value || item.block?.id === studentFilter.value));
const enrolledIds = computed(() => new Set(detail.value?.enrollments.map((item) => item.student.id)));
const byName = (a: AcademyPerson, b: AcademyPerson) => a.fullName.localeCompare(b.fullName, "es");
const candidates = computed(() => allStudents.value.filter((person) => !enrolledIds.value.has(person.id) && !person.blocked).sort(byName));

async function loadStudents() {
  try {
    allStudents.value = (await props.api.academyUsers("student")).users;
  } catch (value) {
    say(problem(value, "No se pudo cargar la lista de estudiantes."), "error");
  } finally {
    studentsLoaded.value = true;
  }
}

async function enrollSelected() {
  if (!enrollPick.value) return;
  busy.value = true;
  try {
    await props.api.enroll({ workshop: props.workshopKey, students: [enrollPick.value], block: enrollBlock.value || newestBlock.value || undefined });
    const person = allStudents.value.find((item) => item.id === enrollPick.value);
    enrollPick.value = 0;
    say(`${person?.fullName ?? "Estudiante"} quedó inscrito en ${blockName(enrollBlock.value || newestBlock.value) || "el taller"}: ya ve su campus.`);
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo inscribir."), "error");
  } finally {
    busy.value = false;
  }
}

async function updateEnrollment(item: AcademyEnrollment, change: { block?: number; status?: string }) {
  try {
    const updated = await props.api.updateEnrollment(item.id, change);
    if (change.status) item.status = change.status as AcademyEnrollment["status"];
    if (change.block) { item.block = updated.block ?? item.block; say(`${item.student.fullName} pasó a ${blockName(change.block)}.`); await load(true); }
  } catch (value) {
    say(problem(value, "No se pudo actualizar la inscripción."), "error");
  }
}

async function unenroll(item: AcademyEnrollment) {
  if (!window.confirm(`¿Quitar a ${item.student.fullName} de este taller? Dejará de ver su contenido.`)) return;
  try {
    await props.api.removeEnrollment(item.id);
    say("Inscripción eliminada.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo quitar la inscripción."), "error");
  }
}

// ---------------------------------------------------------------- diplomas
type DiplomaDraft = { id?: number; student: number; title: string; issuedAt: string; hours: number; skills: string; status: "emitido" | "revocado"; file: { id: number; name: string; size: number } | null; uploading: number | null };
const editing = ref<DiplomaDraft | null>(null);
const diplomaOf = (studentId: number) => detail.value?.diplomas.find((item) => item.studentId === studentId);

// Emitir desde el taller: se elige al estudiante en un desplegable y se sube su PDF.
// Si aún no estaba inscrito, se inscribe en el mismo paso para que el diploma quede amarrado a su cuenta.
const issue = reactive({ student: 0, title: "", issuedAt: today(), hours: 16, skills: "", file: null as { id: number; name: string; size: number } | null, uploading: null as number | null });
const issueError = ref("");
const issueEnrolled = computed(() => (detail.value?.enrollments ?? []).map((item) => item.student).filter((person) => !diplomaOf(person.id)).sort(byName));
const issueOthers = computed(() => candidates.value);
const issueStudent = computed(() => allStudents.value.find((person) => person.id === issue.student) ?? detail.value?.enrollments.find((item) => item.student.id === issue.student)?.student);

function resetIssue() {
  Object.assign(issue, { student: 0, title: workshop.value?.title || "", issuedAt: today(), hours: workshop.value?.hours || 16, skills: "", file: null, uploading: null });
  issueError.value = "";
}

async function attachIssuePdf(file: File | undefined | null) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) { issueError.value = "El diploma debe ser un PDF."; return; }
  issueError.value = "";
  issue.uploading = 0;
  try {
    const uploaded = await props.api.uploadAcademyFile(file, "diploma", (value) => { issue.uploading = value; });
    issue.file = { id: uploaded.id, name: uploaded.name, size: uploaded.size };
  } catch (value) {
    issueError.value = problem(value, "No se pudo subir el PDF.");
  } finally {
    issue.uploading = null;
  }
}

async function issueDiploma() {
  issueError.value = "";
  if (!issue.student) { issueError.value = "Elige al estudiante dueño del diploma."; return; }
  if (!issue.file) { issueError.value = "Sube el PDF del diploma."; return; }
  busy.value = true;
  try {
    if (!enrolledIds.value.has(issue.student)) await props.api.enroll({ workshop: props.workshopKey, students: [issue.student], block: newestBlock.value || undefined });
    await props.api.saveDiploma({
      workshop: props.workshopKey, student: issue.student, title: issue.title || workshop.value?.title, issuedAt: issue.issuedAt,
      hours: issue.hours, skills: issue.skills, status: "emitido", file: issue.file.id,
    });
    say(`Diploma emitido a ${issueStudent.value?.fullName ?? "el estudiante"}: solo esa cuenta puede verlo y descargarlo.`);
    resetIssue();
    await load(true);
  } catch (value) {
    issueError.value = problem(value, "No se pudo emitir el diploma.");
  } finally {
    busy.value = false;
  }
}
const issuedCount = computed(() => detail.value?.diplomas.filter((item) => item.status === "emitido").length ?? 0);

function startDiploma(student: AcademyPerson, diploma?: AcademyDiploma) {
  editing.value = {
    id: diploma?.id,
    student: student.id,
    title: diploma?.title || workshop.value?.title || "",
    issuedAt: diploma?.issuedAt || today(),
    hours: diploma?.hours || workshop.value?.hours || 16,
    skills: (diploma?.skills ?? []).join(", "),
    status: diploma?.status || "emitido",
    file: diploma?.file ? { id: diploma.file.id, name: diploma.file.name, size: diploma.file.size } : null,
    uploading: null,
  };
}

async function attachDiplomaPdf(file: File | undefined | null) {
  const draft = editing.value;
  if (!draft || !file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) return say("El diploma debe ser un PDF.", "error");
  draft.uploading = 0;
  try {
    const uploaded = await props.api.uploadAcademyFile(file, "diploma", (value) => { draft.uploading = value; });
    draft.file = { id: uploaded.id, name: uploaded.name, size: uploaded.size };
  } catch (value) {
    say(problem(value, "No se pudo subir el PDF."), "error");
  } finally {
    draft.uploading = null;
  }
}

async function saveDiploma() {
  const draft = editing.value;
  if (!draft) return;
  busy.value = true;
  try {
    await props.api.saveDiploma({
      workshop: props.workshopKey, student: draft.student, title: draft.title, issuedAt: draft.issuedAt,
      hours: draft.hours, skills: draft.skills, status: draft.status, file: draft.file?.id ?? null,
    }, draft.id);
    editing.value = null;
    say(draft.id ? "Diploma actualizado." : "Diploma emitido: el estudiante ya lo ve en su campus.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo guardar el diploma."), "error");
  } finally {
    busy.value = false;
  }
}

async function toggleRevoke(diploma: AcademyDiploma) {
  const next = diploma.status === "emitido" ? "revocado" : "emitido";
  if (next === "revocado" && !window.confirm("¿Revocar este diploma? La página de verificación lo mostrará como revocado.")) return;
  try {
    await props.api.saveDiploma({ status: next }, diploma.id);
    diploma.status = next;
    say(next === "revocado" ? "Diploma revocado." : "Diploma reactivado.");
  } catch (value) {
    say(problem(value, "No se pudo cambiar el estado."), "error");
  }
}

async function deleteDiploma(diploma: AcademyDiploma) {
  if (!window.confirm("¿Eliminar el diploma y su PDF? El enlace de verificación dejará de existir.")) return;
  try {
    await props.api.removeDiploma(diploma.id);
    say("Diploma eliminado.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo eliminar."), "error");
  }
}

const verifyUrl = (diploma: AcademyDiploma) => `${window.location.origin}/ai-academy/diploma/${diploma.credentialId}/`;
async function copy(textValue: string, message: string) {
  try { await navigator.clipboard.writeText(textValue); } catch { window.prompt("Copia el enlace:", textValue); return; }
  say(message);
}

// Carga masiva: cada PDF se asigna al estudiante cuyo correo o nombre aparece en el nombre del archivo.
const bulk = ref<{ file: File; student: AcademyPerson | null; state: "pendiente" | "subiendo" | "listo" | "error"; message?: string }[]>([]);
const bulkOver = ref(false);
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function matchStudent(fileName: string) {
  const name = normalize(fileName.replace(/\.pdf$/i, ""));
  return detail.value?.enrollments.map((item) => item.student).find((student) => {
    const local = normalize(student.email.split("@")[0]);
    const full = normalize(student.fullName);
    return (local && name.includes(local)) || (full && name.includes(full)) || (full && full.split(" ").length > 1 && full.split(" ").every((part) => name.includes(part)));
  }) ?? null;
}
function addBulk(files: FileList | File[] | null | undefined) {
  bulkOver.value = false;
  for (const file of Array.from(files ?? [])) {
    if (!file.name.toLowerCase().endsWith(".pdf")) continue;
    bulk.value.push({ file, student: matchStudent(file.name), state: "pendiente" });
  }
}
async function runBulk() {
  busy.value = true;
  for (const item of bulk.value.filter((entry) => entry.student && entry.state === "pendiente")) {
    item.state = "subiendo";
    try {
      const uploaded = await props.api.uploadAcademyFile(item.file, "diploma");
      const existing = diplomaOf(item.student!.id);
      await props.api.saveDiploma(existing
        ? { file: uploaded.id }
        : { workshop: props.workshopKey, student: item.student!.id, title: workshop.value?.title, issuedAt: today(), hours: workshop.value?.hours, file: uploaded.id }, existing?.id);
      item.state = "listo";
    } catch (value) {
      item.state = "error";
      item.message = problem(value, "No se pudo emitir.");
    }
  }
  busy.value = false;
  const done = bulk.value.filter((entry) => entry.state === "listo").length;
  say(`${done} diplomas emitidos en lote.`);
  await load(true);
}

// ---------------------------------------------------------------- herramientas
const toolForm = reactive({ id: 0, title: "", url: "", category: "", description: "", block: 0 });
const toolOpen = ref(false);
const favicon = (url: string) => { try { return `https://www.google.com/s2/favicons?sz=64&domain=${new URL(url).hostname}`; } catch { return ""; } };
function editTool(tool?: AcademyTool) {
  Object.assign(toolForm, tool ? { id: tool.id, title: tool.title, url: tool.url, category: tool.category, description: tool.description, block: tool.block?.id ?? 0 } : { id: 0, title: "", url: "", category: "", description: "", block: 0 });
  toolOpen.value = true;
}
async function saveTool() {
  busy.value = true;
  try {
    await props.api.saveTool({ ...toolForm, workshop: props.workshopKey }, toolForm.id || undefined);
    toolOpen.value = false;
    say(toolForm.id ? "Herramienta actualizada." : "Herramienta agregada.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo guardar la herramienta."), "error");
  } finally {
    busy.value = false;
  }
}
async function deleteTool(tool: AcademyTool) {
  if (!window.confirm(`¿Quitar "${tool.title}"?`)) return;
  await props.api.removeTool(tool.id).catch((value) => say(problem(value, "No se pudo quitar."), "error"));
  await load(true);
}
async function move(kind: "tools" | "videos", list: { id: number }[], index: number, step: number) {
  const target = index + step;
  if (target < 0 || target >= list.length) return;
  const ids = list.map((item) => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await props.api.reorderAcademy(kind, ids).catch((value) => say(problem(value, "No se pudo reordenar."), "error"));
  await load(true);
}

// ---------------------------------------------------------------- videos
const videoForm = reactive({ id: 0, block: 0, title: "", description: "", session: 1 as number | null, source: "archivo" as "archivo" | "enlace", externalUrl: "", durationSeconds: 0, file: null as { id: number; name: string; size: number } | null });
const videoOpen = ref(false);
const videoUpload = ref<number | null>(null);
const videoOver = ref(false);
const maxSessions = computed(() => Math.max(4, ...blocks.value.map((block) => block.totalSessions)));
const sessions = computed(() => {
  const groups = new Map<string, AcademyVideo[]>();
  // Sábados en orden y el material complementario al final, como lo ve el alumno.
  for (const video of [...(detail.value?.videos ?? [])].sort((x, y) => (x.session ?? 99) - (y.session ?? 99))) {
    const key = video.session ? `Sábado ${video.session}` : "Material complementario";
    groups.set(key, [...(groups.get(key) ?? []), video]);
  }
  return [...groups.entries()];
});
const duration = (seconds?: number | null) => (seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}` : "");

function editVideo(video?: AcademyVideo) {
  Object.assign(videoForm, video
    ? { id: video.id, block: video.block?.id ?? 0, title: video.title, description: video.description, session: video.session, source: video.source, externalUrl: video.externalUrl, durationSeconds: video.durationSeconds ?? 0, file: video.file ? { id: video.file.id, name: video.file.name, size: video.file.size } : null }
    : { id: 0, block: 0, title: "", description: "", session: 1, source: "archivo", externalUrl: "", durationSeconds: 0, file: null });
  videoOpen.value = true;
}

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const probe = document.createElement("video");
    const url = URL.createObjectURL(file);
    probe.preload = "metadata";
    probe.onloadedmetadata = () => { resolve(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0); URL.revokeObjectURL(url); };
    probe.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    probe.src = url;
  });
}

async function attachVideo(file: File | undefined | null) {
  videoOver.value = false;
  if (!file) return;
  if (!/\.(mp4|webm|mov)$/i.test(file.name)) return say("Sube un video MP4, WebM o MOV.", "error");
  if (!videoForm.title) videoForm.title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  videoForm.durationSeconds = await readDuration(file);
  videoUpload.value = 0;
  try {
    const uploaded = await props.api.uploadAcademyFile(file, "video", (value) => { videoUpload.value = value; });
    videoForm.file = { id: uploaded.id, name: uploaded.name, size: uploaded.size };
  } catch (value) {
    say(problem(value, "No se pudo subir el video."), "error");
  } finally {
    videoUpload.value = null;
  }
}

async function saveVideo() {
  busy.value = true;
  try {
    await props.api.saveVideo({ ...videoForm, file: videoForm.file?.id ?? null, workshop: props.workshopKey }, videoForm.id || undefined);
    videoOpen.value = false;
    say(videoForm.id ? "Video actualizado." : "Video publicado en el campus.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudo guardar el video."), "error");
  } finally {
    busy.value = false;
  }
}

async function deleteVideo(video: AcademyVideo) {
  if (!window.confirm(`¿Eliminar "${video.title}"? También se borra el archivo y el progreso de los estudiantes.`)) return;
  await props.api.removeVideo(video.id).catch((value) => say(problem(value, "No se pudo eliminar."), "error"));
  await load(true);
}

// ---------------------------------------------------------------- ajustes
const settings = reactive({ title: "", code: "", accent: "#7A3CFF", description: "", hours: 16, isPublic: true });
function fillSettings() {
  if (workshop.value) Object.assign(settings, { title: workshop.value.title, code: workshop.value.code, accent: workshop.value.accent, description: workshop.value.description, hours: workshop.value.hours, isPublic: workshop.value.isPublic });
}
async function saveSettings() {
  busy.value = true;
  try {
    await props.api.updateAcademyWorkshop(props.workshopKey, { ...settings });
    say("Ajustes del taller guardados.");
    await load(true);
  } catch (value) {
    say(problem(value, "No se pudieron guardar los ajustes."), "error");
  } finally {
    busy.value = false;
  }
}

function selectTab(next: Tab) {
  tab.value = next;
  if (next === "ajustes") fillSettings();
  if (next === "diplomas" && !issue.title) resetIssue();
}

onMounted(async () => {
  await Promise.all([load(), loadStudents()]);
  resetIssue();
});
</script>

<template>
  <section class="ac detail" :style="{ '--accent': workshop?.accent || '#7A3CFF' }">
    <button type="button" class="link-action detail__back" @click="emit('back')">← Todos los talleres</button>

    <div v-if="loading" class="state"><i aria-hidden="true"></i><p>Cargando el taller…</p></div>
    <div v-else-if="error || !detail || !workshop" class="state"><p class="error">{{ error || "No se encontró el taller." }}</p></div>

    <template v-else>
      <header class="hero">
        <span class="hero__orb" aria-hidden="true"></span>
        <div class="hero__copy">
          <div class="hero__chips">
            <span class="chip">{{ workshop.code }}</span>
            <span class="chip" :class="workshop.isPublic ? 'chip--soft' : 'chip--warn'">{{ workshop.isPublic ? "Público en la web" : "Solo campus" }}</span>
            <span class="chip chip--soft">{{ workshop.hours }} horas</span>
          </div>
          <h1>{{ workshop.title }}</h1>
          <p>{{ workshop.description || "Agrega una descripción en Ajustes." }}</p>
        </div>
        <dl class="hero__stats">
          <div><dt>{{ detail.enrollments.length }}</dt><dd>estudiantes</dd></div>
          <div><dt>{{ issuedCount }}</dt><dd>diplomas</dd></div>
          <div><dt>{{ detail.tools.length }}</dt><dd>herramientas</dd></div>
          <div><dt>{{ detail.videos.length }}</dt><dd>videos</dd></div>
        </dl>
      </header>

      <nav class="tabs" aria-label="Secciones del taller">
        <button v-for="item in ([['bloques', 'Bloques'], ['estudiantes', 'Estudiantes'], ['diplomas', 'Diplomas'], ['herramientas', 'Herramientas'], ['videos', 'Videos'], ['publicacion', 'Publicación web'], ['ajustes', 'Ajustes']] as [Tab, string][])" :key="item[0]" type="button" :class="{ active: tab === item[0] }" @click="selectTab(item[0])">{{ item[1] }}</button>
      </nav>

      <!-- BLOQUES -->
      <section v-if="tab === 'bloques'" class="panel">
        <div class="panel__head">
          <div><h3>Bloques del taller</h3><p>Cada vez que impartes el taller es un bloque con sus propios alumnos. Toca el sábado en el que va cada bloque: así defines su avance y qué clases tiene habilitadas.</p></div>
          <button type="button" class="primary-action" @click="openBlock">+ Nuevo bloque</button>
        </div>
        <div v-if="!blocks.length" class="empty"><b><AcademyIcon name="orbita" :size="26" /></b><strong>Aún no hay bloques</strong>Crea el primero, por ejemplo "Bloque octubre 2026".</div>
        <div v-else class="blocks">
          <article v-for="block in blocks" :key="block.id" class="block" :class="`block--${block.status}`">
            <header class="block__head">
              <div>
                <input class="block__name" :value="block.name" maxlength="80" aria-label="Nombre del bloque" @change="patchBlock(block, { name: ($event.target as HTMLInputElement).value }, 'Nombre actualizado.')" />
                <span class="block__meta">
                  <span class="chip" :class="block.status === 'finalizado' ? 'chip--ok' : block.status === 'en-curso' ? 'chip--soft' : 'chip--warn'">{{ statusLabel[block.status] }}</span>
                  {{ block.students ?? 0 }} {{ block.students === 1 ? "alumno" : "alumnos" }}
                  <template v-if="block.startDate"> · inicia {{ dateLabel(block.startDate) }}</template>
                </span>
              </div>
              <div class="block__pct"><b>{{ block.progress }}%</b><small>avance</small></div>
            </header>
            <div class="block__bar" aria-hidden="true"><i :style="{ width: `${block.progress}%` }"></i></div>
            <div class="block__sessions" role="group" :aria-label="`Sesión actual de ${block.name}`">
              <button v-for="number in block.totalSessions" :key="number" type="button" class="block__session" :class="{ done: number <= block.currentSession, now: number === block.currentSession }" :aria-pressed="number <= block.currentSession" @click="setSession(block, number)">
                <AcademyIcon v-if="number <= block.currentSession" name="check" :size="14" />
                <span>Sábado {{ number }}</span>
              </button>
            </div>
            <footer class="block__foot">
              <label>Inicio<input type="date" class="mini-input" :value="block.startDate" @change="patchBlock(block, { startDate: ($event.target as HTMLInputElement).value }, 'Fecha actualizada.')" /></label>
              <label>Sesiones<select class="mini-input" :value="block.totalSessions" @change="patchBlock(block, { totalSessions: Number(($event.target as HTMLSelectElement).value) }, 'Número de sesiones actualizado.')"><option v-for="number in 12" :key="number" :value="number">{{ number }}</option></select></label>
              <button type="button" class="ghost-action ghost-action--small" @click="studentFilter = block.id; selectTab('estudiantes')">Ver alumnos</button>
              <button type="button" class="ghost-action ghost-action--small ghost-action--danger" :disabled="Boolean(block.students)" :title="block.students ? 'Mueve a sus alumnos a otro bloque para eliminarlo' : ''" @click="deleteBlock(block)">Eliminar</button>
            </footer>
          </article>
        </div>
      </section>

      <!-- ESTUDIANTES -->
      <section v-else-if="tab === 'estudiantes'" class="panel">
        <div class="panel__head">
          <div><h3>Estudiantes inscritos</h3><p>Solo ellos verán los diplomas, herramientas y videos de este taller.</p></div>
        </div>
        <form class="enroll" @submit.prevent="enrollSelected">
          <label class="field enroll__who">Estudiante
            <select v-model.number="enrollPick" :disabled="!candidates.length" aria-label="Estudiante a inscribir">
              <option :value="0">{{ !studentsLoaded ? "Cargando estudiantes…" : candidates.length ? "Elige un estudiante" : "Todos los estudiantes ya están inscritos" }}</option>
              <option v-for="person in candidates" :key="person.id" :value="person.id">{{ person.fullName }} · {{ person.email }}</option>
            </select>
          </label>
          <label class="field enroll__cohort">Bloque
            <select v-model.number="enrollBlock" aria-label="Bloque">
              <option :value="0">{{ blocks.length ? `${blocks[0].name} (el más reciente)` : "Se crea Bloque 1" }}</option>
              <option v-for="block in blocks.slice(1)" :key="block.id" :value="block.id">{{ block.name }}</option>
            </select>
          </label>
          <button type="submit" class="primary-action" :disabled="busy || !enrollPick">Inscribir</button>
          <button type="button" class="link-action enroll__new" @click="emit('users')">+ Crear estudiante en Usuarios</button>
        </form>
        <div v-if="blocks.length > 1" class="seg block-filter" role="group" aria-label="Filtrar por bloque">
          <button type="button" :class="{ active: !studentFilter }" @click="studentFilter = 0">Todos <i>{{ detail.enrollments.length }}</i></button>
          <button v-for="block in blocks" :key="block.id" type="button" :class="{ active: studentFilter === block.id }" @click="studentFilter = block.id">{{ block.name }} <i>{{ block.students ?? 0 }}</i></button>
        </div>
        <div v-if="!detail.enrollments.length" class="empty"><b><AcademyIcon name="estudiantes" :size="26" /></b><strong>Aún no hay estudiantes</strong>Elige uno en el desplegable de arriba para inscribirlo.</div>
        <div v-else class="rows">
          <div v-for="item in visibleEnrollments" :key="item.id" class="row">
            <span class="avatar">{{ initials(item.student.fullName) }}</span>
            <div class="row__main">
              <strong>{{ item.student.fullName }} <span v-if="item.student.blocked" class="chip chip--bad">Bloqueado</span></strong>
              <span>{{ item.student.email }}</span>
            </div>
            <div class="row__actions">
              <select class="mini-input" :value="item.block?.id" aria-label="Bloque" @change="updateEnrollment(item, { block: Number(($event.target as HTMLSelectElement).value) })">
                <option v-for="block in blocks" :key="block.id" :value="block.id">{{ block.name }}</option>
              </select>
              <select class="mini-input" :value="item.status" aria-label="Estado" @change="updateEnrollment(item, { status: ($event.target as HTMLSelectElement).value })">
                <option value="inscrito">Inscrito</option><option value="en-curso">En curso</option><option value="completado">Completado</option>
              </select>
              <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="unenroll(item)">Quitar</button>
            </div>
          </div>
        </div>
      </section>

      <!-- DIPLOMAS -->
      <template v-else-if="tab === 'diplomas'">
        <section class="panel">
          <div class="panel__head">
            <div><h3>Emitir diploma</h3><p>Elige al estudiante dueño del diploma y sube su PDF. Solo esa cuenta podrá verlo, descargarlo y agregarlo a LinkedIn.</p></div>
          </div>
          <form class="issue" @submit.prevent="issueDiploma">
            <label class="field">Estudiante
              <select v-model.number="issue.student" aria-label="Estudiante dueño del diploma">
                <option :value="0">{{ !studentsLoaded ? "Cargando estudiantes…" : issueEnrolled.length || issueOthers.length ? "Elige al estudiante" : "No hay estudiantes: créalos en Usuarios" }}</option>
                <optgroup v-if="issueEnrolled.length" label="Inscritos en este taller">
                  <option v-for="person in issueEnrolled" :key="person.id" :value="person.id">{{ person.fullName }} · {{ person.email }}</option>
                </optgroup>
                <optgroup v-if="issueOthers.length" :label="`Sin inscribir (se inscribe en ${blocks[0]?.name ?? 'Bloque 1'})`">
                  <option v-for="person in issueOthers" :key="person.id" :value="person.id">{{ person.fullName }} · {{ person.email }}</option>
                </optgroup>
              </select>
            </label>
            <div class="field">Diploma en PDF
              <div v-if="issue.uploading !== null" class="file-tile"><span class="file-tile__icon">PDF</span><div><strong>Subiendo… {{ issue.uploading }}%</strong><span class="progress"><i :style="{ width: `${issue.uploading}%` }"></i></span></div></div>
              <div v-else-if="issue.file" class="file-tile">
                <span class="file-tile__icon">PDF</span>
                <div><strong>{{ issue.file.name }}</strong><span>{{ sizeLabel(issue.file.size) }}</span></div>
                <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="issue.file = null">Quitar</button>
              </div>
              <label v-else class="drop drop--compact" @dragover.prevent @drop.prevent="attachIssuePdf($event.dataTransfer?.files?.[0])">
                <input type="file" accept="application/pdf,.pdf" @change="attachIssuePdf(($event.target as HTMLInputElement).files?.[0])" />
                <span class="drop__icon" aria-hidden="true"><AcademyIcon name="subir" /></span>
                <strong>Arrastra el PDF o <u>elígelo</u></strong>
                <small>Queda privado: solo el dueño puede abrirlo.</small>
              </label>
            </div>
            <label class="field">Título de la credencial<input v-model="issue.title" maxlength="160" /></label>
            <div class="grid-2">
              <label class="field">Fecha de emisión<input v-model="issue.issuedAt" type="date" required /></label>
              <label class="field">Horas<input v-model.number="issue.hours" type="number" min="1" max="400" /></label>
            </div>
            <label class="field issue__wide">Competencias<input v-model="issue.skills" placeholder="Prompts, Agentes, Automatización" /><small>Separadas por comas. Aparecen en el diploma digital.</small></label>
            <p v-if="issueError" class="error issue__wide">{{ issueError }}</p>
            <div class="form-actions issue__wide">
              <button type="button" class="ghost-action" @click="resetIssue">Limpiar</button>
              <button type="submit" class="primary-action" :disabled="busy || issue.uploading !== null || !issue.student || !issue.file">{{ busy ? "Emitiendo…" : "Emitir diploma" }}</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="panel__head">
            <div><h3>Diplomas del taller</h3><p>Cada diploma lleva un identificador verificable y un botón para agregarlo a LinkedIn.</p></div>
          </div>
          <div v-if="!detail.enrollments.length" class="empty"><b><AcademyIcon name="diploma" :size="26" /></b><strong>Aún no hay diplomas</strong>Emite el primero con el formulario de arriba.</div>
          <div v-else class="rows">
            <div v-for="item in detail.enrollments" :key="item.id" class="row">
              <span class="avatar">{{ initials(item.student.fullName) }}</span>
              <div class="row__main">
                <strong>{{ item.student.fullName }}</strong>
                <span v-if="diplomaOf(item.student.id)">
                  <span class="chip" :class="diplomaOf(item.student.id)!.status === 'emitido' ? 'chip--ok' : 'chip--bad'">{{ diplomaOf(item.student.id)!.status === "emitido" ? "Emitido" : "Revocado" }}</span>
                  {{ diplomaOf(item.student.id)!.credentialId }} · {{ dateLabel(diplomaOf(item.student.id)!.issuedAt) }}{{ diplomaOf(item.student.id)!.file ? "" : " · sin PDF" }}
                </span>
                <span v-else>Sin diploma todavía</span>
              </div>
              <div class="row__actions">
                <template v-if="diplomaOf(item.student.id)">
                  <a v-if="diplomaOf(item.student.id)!.file" class="ghost-action ghost-action--small" :href="api.fileUrl(diplomaOf(item.student.id)!.file!)" target="_blank" rel="noopener">PDF</a>
                  <button type="button" class="ghost-action ghost-action--small" @click="copy(verifyUrl(diplomaOf(item.student.id)!), 'Enlace de verificación copiado.')">Verificación</button>
                  <button type="button" class="ghost-action ghost-action--small" @click="startDiploma(item.student, diplomaOf(item.student.id))">Editar</button>
                  <button type="button" class="ghost-action ghost-action--small" @click="toggleRevoke(diplomaOf(item.student.id)!)">{{ diplomaOf(item.student.id)!.status === "emitido" ? "Revocar" : "Reactivar" }}</button>
                  <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="deleteDiploma(diplomaOf(item.student.id)!)">Eliminar</button>
                </template>
                <button v-else type="button" class="primary-action" @click="startDiploma(item.student)">Emitir diploma</button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="detail.enrollments.length" class="panel">
          <div class="panel__head"><div><h3>Carga masiva</h3><p>Arrastra varios PDF: se asignan solos si el nombre del archivo contiene el correo o el nombre completo del estudiante.</p></div></div>
          <label class="drop" :class="{ 'drop--over': bulkOver }" @dragover.prevent="bulkOver = true" @dragleave.prevent="bulkOver = false" @drop.prevent="addBulk($event.dataTransfer?.files)">
            <input type="file" accept="application/pdf,.pdf" multiple @change="addBulk(($event.target as HTMLInputElement).files)" />
            <span class="drop__icon" aria-hidden="true"><AcademyIcon name="subir" /></span>
            <strong>Arrastra los diplomas aquí o <u>elígelos</u></strong>
            <small>Ej. ana.perez@correo.com.pdf o Diploma - Ana Pérez.pdf</small>
          </label>
          <div v-if="bulk.length" class="rows" style="margin-top: 14px">
            <div v-for="(item, index) in bulk" :key="index" class="row">
              <span class="file-tile__icon">PDF</span>
              <div class="row__main"><strong>{{ item.file.name }}</strong><span>{{ item.student ? `→ ${item.student.fullName}` : "Sin coincidencia: renómbralo o emítelo a mano" }}</span></div>
              <span class="chip" :class="{ 'chip--ok': item.state === 'listo', 'chip--bad': item.state === 'error' || !item.student, 'chip--soft': item.state === 'pendiente' && item.student, 'chip--warn': item.state === 'subiendo' }">{{ item.state === "listo" ? "Emitido" : item.state === "error" ? item.message : item.state === "subiendo" ? "Subiendo…" : item.student ? "Listo para emitir" : "Sin asignar" }}</span>
            </div>
            <div class="form-actions">
              <button type="button" class="ghost-action" @click="bulk = []">Limpiar</button>
              <button type="button" class="primary-action" :disabled="busy || !bulk.some((item) => item.student && item.state === 'pendiente')" @click="runBulk">Emitir {{ bulk.filter((item) => item.student && item.state === "pendiente").length }} diplomas</button>
            </div>
          </div>
        </section>
      </template>

      <!-- HERRAMIENTAS -->
      <section v-else-if="tab === 'herramientas'" class="panel">
        <div class="panel__head">
          <div><h3>Herramientas</h3><p>Enlaces que el estudiante abre desde su campus: apps, plantillas, documentos, prompts.</p></div>
          <button type="button" class="primary-action" @click="editTool()">+ Agregar enlace</button>
        </div>
        <div v-if="!detail.tools.length" class="empty"><b><AcademyIcon name="herramienta" :size="24" /></b><strong>Sin herramientas todavía</strong>Agrega el primer enlace para este taller.</div>
        <div v-else class="tools">
          <article v-for="(tool, index) in detail.tools" :key="tool.id" class="tool">
            <img v-if="favicon(tool.url)" :src="favicon(tool.url)" alt="" width="40" height="40" loading="lazy" />
            <div class="tool__body">
              <strong>{{ tool.title }}</strong>
              <a :href="tool.url" target="_blank" rel="noopener">{{ tool.url.replace(/^https?:\/\//, "").replace(/\/$/, "") }}</a>
              <span v-if="tool.description">{{ tool.description }}</span>
              <span class="tool__chips"><span v-if="tool.category" class="chip chip--soft">{{ tool.category }}</span><span class="chip" :class="tool.block ? 'chip--warn' : 'chip--soft'">{{ tool.block ? tool.block.name : "Todos los bloques" }}</span></span>
            </div>
            <div class="tool__actions">
              <button type="button" class="ghost-action ghost-action--small" :disabled="index === 0" aria-label="Subir" @click="move('tools', detail.tools, index, -1)">↑</button>
              <button type="button" class="ghost-action ghost-action--small" :disabled="index === detail.tools.length - 1" aria-label="Bajar" @click="move('tools', detail.tools, index, 1)">↓</button>
              <button type="button" class="ghost-action ghost-action--small" @click="editTool(tool)">Editar</button>
              <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="deleteTool(tool)">Quitar</button>
            </div>
          </article>
        </div>
      </section>

      <!-- VIDEOS -->
      <section v-else-if="tab === 'videos'" class="panel">
        <div class="panel__head">
          <div><h3>Videos</h3><p>Sube el archivo (MP4 recomendado) o pega un enlace de YouTube o Vimeo. Cada video es de un sábado: el alumno lo ve cuando su bloque llega a ese sábado.</p></div>
          <button type="button" class="primary-action" @click="editVideo()">+ Agregar video</button>
        </div>
        <div v-if="!detail.videos.length" class="empty"><b><AcademyIcon name="video" :size="26" /></b><strong>Sin videos todavía</strong>Sube la primera clase del taller.</div>
        <div v-for="[group, videos] in sessions" :key="group" class="vgroup">
          <h4>{{ group }}</h4>
          <div class="rows">
            <div v-for="video in videos" :key="video.id" class="row">
              <span class="file-tile__icon file-tile__icon--video">{{ video.source === "enlace" ? "URL" : "MP4" }}</span>
              <div class="row__main">
                <strong>{{ video.title }} <span class="chip" :class="video.block ? 'chip--warn' : 'chip--soft'">{{ video.block ? video.block.name : "Todos los bloques" }}</span></strong>
                <span>{{ video.source === "enlace" ? video.externalUrl : `${video.file?.name ?? ""} · ${video.file ? sizeLabel(video.file.size) : ""}` }}{{ video.durationSeconds ? ` · ${duration(video.durationSeconds)}` : "" }}</span>
              </div>
              <div class="row__actions">
                <button type="button" class="ghost-action ghost-action--small" aria-label="Subir" @click="move('videos', detail.videos, detail.videos.indexOf(video), -1)">↑</button>
                <button type="button" class="ghost-action ghost-action--small" aria-label="Bajar" @click="move('videos', detail.videos, detail.videos.indexOf(video), 1)">↓</button>
                <a class="ghost-action ghost-action--small" :href="video.source === 'enlace' ? video.externalUrl : api.fileUrl(video.file!)" target="_blank" rel="noopener">Ver</a>
                <button type="button" class="ghost-action ghost-action--small" @click="editVideo(video)">Editar</button>
                <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="deleteVideo(video)">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- PUBLICACIÓN -->
      <AcademyAdmin v-else-if="tab === 'publicacion'" :api="api" :cms-url="cmsUrl" :only-key="workshopKey" embedded @notice="(message, type) => emit('notice', message, type)" />

      <!-- AJUSTES -->
      <form v-else class="panel" @submit.prevent="saveSettings">
        <div class="panel__head"><div><h3>Ajustes del taller</h3><p>Identidad del taller en el campus y en el administrador.</p></div></div>
        <div class="grid-2">
          <label class="field">Nombre<input v-model="settings.title" maxlength="120" required /></label>
          <label class="field">Código<input v-model="settings.code" maxlength="16" required /></label>
        </div>
        <label class="field" style="margin-top: 12px">Descripción<textarea v-model="settings.description" maxlength="420"></textarea></label>
        <div class="grid-2" style="margin-top: 12px">
          <label class="field">Horas<input v-model.number="settings.hours" type="number" min="1" max="400" /></label>
          <label class="field">Color<input v-model="settings.accent" type="color" /></label>
        </div>
        <label class="toggle" style="margin-top: 16px"><input v-model="settings.isPublic" type="checkbox" /> Visible en la web pública de AI Academy</label>
        <div class="form-actions"><button type="submit" class="primary-action" :disabled="busy">{{ busy ? "Guardando…" : "Guardar ajustes" }}</button></div>
      </form>
    </template>

    <!-- Diploma -->
    <transition name="modal">
      <div v-if="editing" class="modal" role="dialog" aria-modal="true" aria-labelledby="diploma" @click.self="editing = null">
        <form class="modal__card" @submit.prevent="saveDiploma">
          <h3 id="diploma">{{ editing.id ? "Editar diploma" : "Emitir diploma" }}</h3>
          <p>El estudiante lo verá en su campus con su identificador verificable y el botón para agregarlo a LinkedIn.</p>
          <label class="field">Título de la credencial<input v-model="editing.title" maxlength="160" required /></label>
          <div class="grid-2" style="margin-top: 12px">
            <label class="field">Fecha de emisión<input v-model="editing.issuedAt" type="date" required /></label>
            <label class="field">Horas<input v-model.number="editing.hours" type="number" min="1" max="400" /></label>
          </div>
          <label class="field" style="margin-top: 12px">Competencias<input v-model="editing.skills" placeholder="Prompts, Agentes, Automatización" /><small>Separadas por comas. Aparecen en el diploma digital y en la verificación.</small></label>
          <div class="field" style="margin-top: 12px">Diploma en PDF
            <div v-if="editing.uploading !== null" class="file-tile"><span class="file-tile__icon">PDF</span><div><strong>Subiendo… {{ editing.uploading }}%</strong><span class="progress"><i :style="{ width: `${editing.uploading}%` }"></i></span></div></div>
            <div v-else-if="editing.file" class="file-tile">
              <span class="file-tile__icon">PDF</span>
              <div><strong>{{ editing.file.name }}</strong><span>{{ sizeLabel(editing.file.size) }}</span></div>
              <button type="button" class="ghost-action ghost-action--small ghost-action--danger" @click="editing.file = null">Quitar</button>
            </div>
            <label v-else class="drop" @dragover.prevent @drop.prevent="attachDiplomaPdf($event.dataTransfer?.files?.[0])">
              <input type="file" accept="application/pdf,.pdf" @change="attachDiplomaPdf(($event.target as HTMLInputElement).files?.[0])" />
              <span class="drop__icon" aria-hidden="true"><AcademyIcon name="subir" /></span>
              <strong>Arrastra el PDF o <u>elígelo</u></strong>
              <small>Queda privado: solo el estudiante puede descargarlo.</small>
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="ghost-action" @click="editing = null">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="busy || editing.uploading !== null">{{ busy ? "Guardando…" : editing.id ? "Guardar cambios" : "Emitir diploma" }}</button>
          </div>
        </form>
      </div>
    </transition>

    <!-- Bloque -->
    <transition name="modal">
      <div v-if="blockOpen" class="modal" role="dialog" aria-modal="true" aria-labelledby="nuevo-bloque" @click.self="blockOpen = false">
        <form class="modal__card" @submit.prevent="createBlock">
          <h3 id="nuevo-bloque">Nuevo bloque</h3>
          <p>Una nueva edición del taller con su propio grupo de alumnos. Empieza sin iniciar (0 %).</p>
          <label class="field">Nombre<input v-model="blockForm.name" maxlength="80" required placeholder="Ej. Bloque octubre 2026" /></label>
          <div class="grid-2" style="margin-top: 12px">
            <label class="field">Fecha de inicio<input v-model="blockForm.startDate" type="date" /></label>
            <label class="field">Sesiones (sábados)<select v-model.number="blockForm.totalSessions"><option v-for="number in 12" :key="number" :value="number">{{ number }}</option></select></label>
          </div>
          <p v-if="blockError" class="error" style="margin-top: 12px">{{ blockError }}</p>
          <div class="form-actions">
            <button type="button" class="ghost-action" @click="blockOpen = false">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="busy">{{ busy ? "Creando…" : "Crear bloque" }}</button>
          </div>
        </form>
      </div>
    </transition>

    <!-- Herramienta -->
    <transition name="modal">
      <div v-if="toolOpen" class="modal" role="dialog" aria-modal="true" aria-labelledby="herramienta" @click.self="toolOpen = false">
        <form class="modal__card" @submit.prevent="saveTool">
          <h3 id="herramienta">{{ toolForm.id ? "Editar herramienta" : "Agregar herramienta" }}</h3>
          <p>El logo del sitio aparece solo.</p>
          <div class="grid-2">
            <label class="field">Nombre<input v-model="toolForm.title" maxlength="120" required placeholder="Ej. ChatGPT" /></label>
            <label class="field">Categoría<input v-model="toolForm.category" maxlength="40" placeholder="Ej. Asistente, Plantilla" /></label>
          </div>
          <label class="field" style="margin-top: 12px">Enlace<input v-model="toolForm.url" type="url" required placeholder="https://…" /></label>
          <label class="field" style="margin-top: 12px">¿Para qué bloque?
            <select v-model.number="toolForm.block">
              <option :value="0">Todos los bloques</option>
              <option v-for="block in blocks" :key="block.id" :value="block.id">Solo {{ block.name }}</option>
            </select>
          </label>
          <label class="field" style="margin-top: 12px">Para qué sirve<textarea v-model="toolForm.description" maxlength="400"></textarea></label>
          <div class="form-actions">
            <button type="button" class="ghost-action" @click="toolOpen = false">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="busy">{{ busy ? "Guardando…" : "Guardar" }}</button>
          </div>
        </form>
      </div>
    </transition>

    <!-- Video -->
    <transition name="modal">
      <div v-if="videoOpen" class="modal" role="dialog" aria-modal="true" aria-labelledby="video" @click.self="videoUpload === null && (videoOpen = false)">
        <form class="modal__card" @submit.prevent="saveVideo">
          <h3 id="video">{{ videoForm.id ? "Editar video" : "Agregar video" }}</h3>
          <p>Los archivos quedan privados y se reproducen solo dentro del campus.</p>
          <div class="seg" style="margin-bottom: 14px">
            <button type="button" :class="{ active: videoForm.source === 'archivo' }" @click="videoForm.source = 'archivo'">Subir archivo</button>
            <button type="button" :class="{ active: videoForm.source === 'enlace' }" @click="videoForm.source = 'enlace'">Enlace (YouTube, Vimeo)</button>
          </div>
          <template v-if="videoForm.source === 'archivo'">
            <div v-if="videoUpload !== null" class="file-tile"><span class="file-tile__icon file-tile__icon--video">MP4</span><div><strong>Subiendo… {{ videoUpload }}%</strong><span class="progress"><i :style="{ width: `${videoUpload}%` }"></i></span></div></div>
            <div v-else-if="videoForm.file" class="file-tile">
              <span class="file-tile__icon file-tile__icon--video">MP4</span>
              <div><strong>{{ videoForm.file.name }}</strong><span>{{ sizeLabel(videoForm.file.size) }}{{ videoForm.durationSeconds ? ` · ${duration(videoForm.durationSeconds)}` : "" }}</span></div>
              <button type="button" class="ghost-action ghost-action--small" @click="videoForm.file = null">Cambiar</button>
            </div>
            <label v-else class="drop" :class="{ 'drop--over': videoOver }" @dragover.prevent="videoOver = true" @dragleave.prevent="videoOver = false" @drop.prevent="attachVideo($event.dataTransfer?.files?.[0])">
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" @change="attachVideo(($event.target as HTMLInputElement).files?.[0])" />
              <span class="drop__icon" aria-hidden="true"><AcademyIcon name="video" /></span>
              <strong>Arrastra el video o <u>elígelo</u></strong>
              <small>MP4, WebM o MOV · hasta 2 GB</small>
            </label>
          </template>
          <label v-else class="field">Enlace del video<input v-model="videoForm.externalUrl" type="url" placeholder="https://www.youtube.com/watch?v=…" required /></label>
          <div class="grid-2" style="margin-top: 12px">
            <label class="field">Título<input v-model="videoForm.title" maxlength="160" required /></label>
            <label class="field">Sesión
              <select v-model="videoForm.session">
                <option v-for="number in maxSessions" :key="number" :value="number">Sábado {{ number }}</option>
                <option :value="null">Material complementario (siempre visible)</option>
              </select>
            </label>
          </div>
          <label class="field" style="margin-top: 12px">¿Para qué bloque?
            <select v-model.number="videoForm.block">
              <option :value="0">Todos los bloques</option>
              <option v-for="block in blocks" :key="block.id" :value="block.id">Solo {{ block.name }}</option>
            </select>
            <small>Usa "Solo …" para la grabación propia de un bloque.</small>
          </label>
          <label class="field" style="margin-top: 12px">Descripción<textarea v-model="videoForm.description" maxlength="600"></textarea></label>
          <div class="form-actions">
            <button type="button" class="ghost-action" :disabled="videoUpload !== null" @click="videoOpen = false">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="busy || videoUpload !== null || (videoForm.source === 'archivo' && !videoForm.file)">{{ busy ? "Guardando…" : "Publicar video" }}</button>
          </div>
        </form>
      </div>
    </transition>
  </section>
</template>

<style scoped src="./academy-admin.css"></style>
<style scoped>
.detail { padding-bottom: 80px; }
.blocks { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 14px; }
.block { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); }
.block--en-curso { border-color: color-mix(in srgb, var(--accent) 45%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent), 0 18px 40px rgba(0, 0, 30, 0.35); }
.block__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.block__name { width: 100%; padding: 4px 6px; margin: -4px -6px 6px; border: 1px solid transparent; border-radius: 8px; color: #fff; background: transparent; font: inherit; font-size: 17px; font-weight: 700; }
.block__name:hover, .block__name:focus { border-color: var(--line); outline: 0; background: rgba(2, 9, 34, 0.6); }
.block__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.block__pct { display: grid; justify-items: end; }
.block__pct b { color: var(--accent); font: 800 30px/1 ui-monospace, monospace; letter-spacing: -0.04em; }
.block__pct small { color: var(--muted); font-size: 11px; }
.block__bar { height: 8px; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.07); }
.block__bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #50c8ff, var(--accent)); transition: width 0.4s cubic-bezier(0.2, 0.9, 0.2, 1); }
.block__sessions { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.block__session { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: auto; min-height: 40px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 12px; color: var(--muted); background: transparent; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.block__session:hover { border-color: var(--accent); color: #fff; }
.block__session.done { border-style: solid; border-color: color-mix(in srgb, var(--accent) 50%, transparent); color: #fff; background: color-mix(in srgb, var(--accent) 16%, transparent); }
.block__session.now { color: #030b28; background: var(--accent); }
.block__foot { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.block__foot label { display: grid; gap: 4px; color: var(--muted); font-size: 11px; }
.block-filter { margin-bottom: 14px; flex-wrap: wrap; }
.tool__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.enroll { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; align-items: end; gap: 12px; margin-bottom: 18px; padding: 16px; border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--accent) 6%, rgba(2, 9, 34, 0.5)); }
.enroll .primary-action { min-height: 44px; }
.enroll__new { grid-column: 1 / -1; justify-self: start; font-size: 12px; }
.issue { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 14px; }
.issue > .field { align-content: start; }
.issue__wide { grid-column: 1 / -1; }
.issue .grid-2 { margin: 0; }
.field select { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; color: #fff; background: rgba(2, 9, 34, 0.7); font: inherit; font-size: 14px; }
.field select:focus { outline: 0; border-color: var(--accent); }
.field select option, .field select optgroup { color: #fff; background: #07102e; }
.drop--compact { min-height: 0; padding: 14px; }
@media (max-width: 760px) { .enroll, .issue { grid-template-columns: 1fr; } }
.detail__back { margin-bottom: 18px; font-size: 13px; }
.hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; padding: clamp(24px, 3vw, 36px); overflow: hidden; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 28px; background: radial-gradient(circle at 90% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 55%), var(--card); isolation: isolate; }
.hero__orb { position: absolute; right: -6%; bottom: -60%; z-index: -1; width: 46%; aspect-ratio: 1; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 50%; box-shadow: 0 0 120px color-mix(in srgb, var(--accent) 22%, transparent), inset 0 0 60px color-mix(in srgb, var(--accent) 10%, transparent); }
.hero__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.hero h1 { margin: 14px 0 0; font-size: clamp(30px, 3.6vw, 48px); line-height: 1.02; letter-spacing: -0.045em; }
.hero p { max-width: 640px; margin: 12px 0 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
.hero__stats { display: grid; grid-template-columns: repeat(4, auto); gap: 22px; margin: 0; }
.hero__stats dt { font: 800 30px/1 ui-monospace, monospace; }
.hero__stats dd { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.tabs { position: sticky; top: 0; z-index: 5; display: flex; gap: 4px; margin: 18px 0; padding: 6px; overflow-x: auto; border: 1px solid var(--line); border-radius: 16px; background: rgba(5, 14, 47, 0.92); backdrop-filter: blur(14px); scrollbar-width: none; }
.tabs button { flex: none; min-height: 40px; padding: 0 16px; border: 0; border-radius: 11px; color: var(--muted); background: transparent; cursor: pointer; font-size: 13px; font-weight: 700; transition: background 0.2s, color 0.2s; }
.tabs button:hover { color: #fff; }
.tabs button.active { color: #030b28; background: var(--accent); }
.mini-input { min-height: 34px; padding: 0 10px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 9px; color: #fff; background: var(--field); font: inherit; font-size: 12px; max-width: 170px; }
.tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 12px; }
.tool { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; background: rgba(2, 9, 34, 0.55); }
.tool img { width: 40px; height: 40px; padding: 6px; border-radius: 12px; background: #fff; }
.tool__body { display: grid; gap: 5px; min-width: 0; }
.tool__body strong { font-size: 15px; }
.tool__body a { overflow: hidden; color: #9ad8ff; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.tool__body span:not(.chip) { color: var(--muted); font-size: 12px; line-height: 1.5; }
.tool__body .chip { justify-self: start; }
.tool__actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
.vgroup + .vgroup { margin-top: 18px; }
.vgroup h4 { margin: 0 0 10px; color: var(--accent); font: 800 11px/1 ui-monospace, monospace; letter-spacing: 0.14em; text-transform: uppercase; }
.pick { display: grid; gap: 6px; max-height: 320px; margin-top: 14px; overflow: auto; }
.pick__item { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 14px; cursor: pointer; }
.pick__item.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.pick__item input { accent-color: var(--green); }
.pick__item strong { display: block; font-size: 14px; }
.pick__item small { color: var(--muted); font-size: 12px; }
.pick__empty { color: var(--muted); font-size: 13px; text-align: center; }
@media (max-width: 900px) { .hero { grid-template-columns: 1fr; } .hero__stats { grid-template-columns: repeat(4, 1fr); } }
</style>
