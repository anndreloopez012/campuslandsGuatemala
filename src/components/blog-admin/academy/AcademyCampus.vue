<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { AcademyOverview, AcademyWorkshop, BlogAdminApi } from "../../../lib/blog-admin";
import AcademyWorkshopDetail from "./AcademyWorkshopDetail.vue";
import AcademyUsers from "./AcademyUsers.vue";

const props = defineProps<{ api: BlogAdminApi; cmsUrl: string }>();
const emit = defineEmits<{ (e: "notice", message: string, type?: "success" | "error"): void }>();

type View = "talleres" | "usuarios";
const view = ref<View>("talleres");
const openKey = ref<string | null>(null);
const loading = ref(true);
const error = ref("");
const overview = ref<AcademyOverview>({ workshops: [], students: 0, admins: 0 });

const PALETTE = ["#57BBFF", "#FF7AD9", "#7FFFDC", "#FFC56B", "#B997FF", "#FF8A5B", "#7CFF8A"];
const creating = ref(false);
const saving = ref(false);
const form = reactive({ title: "", code: "", accent: PALETTE[5], description: "", hours: 16, isPublic: false });
const formError = ref("");

const totals = computed(() => overview.value.workshops.reduce(
  (sum, item) => ({ diplomas: sum.diplomas + (item.counts?.diplomas ?? 0), videos: sum.videos + (item.counts?.videos ?? 0) }),
  { diplomas: 0, videos: 0 },
));

// En silencio: refresca las cifras sin desmontar la sección abierta (y sus ventanas).
async function load(quiet = false) {
  if (!quiet) loading.value = true;
  error.value = "";
  try {
    overview.value = await props.api.academyOverview();
  } catch (problem) {
    error.value = problem instanceof Error ? problem.message : "No se pudo cargar el campus.";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, { title: "", code: "", accent: PALETTE[overview.value.workshops.length % PALETTE.length], description: "", hours: 16, isPublic: false });
  formError.value = "";
  creating.value = true;
}

async function create() {
  formError.value = "";
  if (!form.title.trim() || !form.code.trim()) {
    formError.value = "Escribe el nombre y el código del taller.";
    return;
  }
  saving.value = true;
  try {
    const workshop = await props.api.createAcademyWorkshop({ ...form });
    creating.value = false;
    emit("notice", `Taller "${workshop.title}" creado. Ya puedes inscribir estudiantes y cargar su contenido.`);
    await load();
    openKey.value = workshop.key;
  } catch (problem) {
    formError.value = problem instanceof Error ? problem.message : "No se pudo crear el taller.";
  } finally {
    saving.value = false;
  }
}

function accentOf(workshop: AcademyWorkshop) {
  return { "--accent": workshop.accent || "#7A3CFF" };
}

onMounted(load);
</script>

<template>
  <section class="ac campus">
    <AcademyWorkshopDetail
      v-if="openKey"
      :api="api"
      :cms-url="cmsUrl"
      :workshop-key="openKey"
      @back="openKey = null; load(true)"
      @notice="(message, type) => emit('notice', message, type)"
    />

    <template v-else>
      <header class="page-heading">
        <div>
          <p>AI ACADEMY / CAMPUS</p>
          <h1>Talleres, estudiantes y credenciales</h1>
          <span>Crea talleres, inscribe estudiantes y publica sus diplomas, herramientas y videos. Cada estudiante solo verá el contenido de los talleres en los que está inscrito.</span>
        </div>
        <div class="campus__nav">
          <nav class="seg" aria-label="Secciones del campus">
            <button type="button" :class="{ active: view === 'talleres' }" @click="view = 'talleres'">Talleres <i>{{ overview.workshops.length }}</i></button>
            <button type="button" :class="{ active: view === 'usuarios' }" @click="view = 'usuarios'">Usuarios <i>{{ overview.students + overview.admins }}</i></button>
          </nav>
          <a class="ghost-action" href="/ai-academy/acceso" target="_blank" rel="noopener">Ver acceso de estudiantes ↗</a>
        </div>
      </header>

      <div v-if="loading" class="state"><i aria-hidden="true"></i><p>Cargando el campus…</p></div>
      <div v-else-if="error" class="state"><p class="error">{{ error }}</p><button type="button" class="ghost-action" @click="load()">Reintentar</button></div>

      <template v-else-if="view === 'talleres'">
        <dl class="stats">
          <div><dt>{{ overview.workshops.length }}</dt><dd>talleres</dd></div>
          <div class="is-green"><dt>{{ overview.students }}</dt><dd>estudiantes</dd></div>
          <div class="is-violet"><dt>{{ totals.diplomas }}</dt><dd>diplomas emitidos</dd></div>
          <div class="is-blue"><dt>{{ totals.videos }}</dt><dd>videos publicados</dd></div>
        </dl>

        <div class="campus__grid">
          <button
            v-for="workshop in overview.workshops"
            :key="workshop.key"
            type="button"
            class="wcard"
            :style="accentOf(workshop)"
            @click="openKey = workshop.key"
          >
            <span class="wcard__glow" aria-hidden="true"></span>
            <span class="wcard__top">
              <span class="chip">{{ workshop.code }}</span>
              <span class="chip" :class="workshop.isPublic ? 'chip--soft' : 'chip--warn'">{{ workshop.isPublic ? "Público" : "Solo campus" }}</span>
            </span>
            <strong class="wcard__title">{{ workshop.title }}</strong>
            <span class="wcard__desc">{{ workshop.description || "Sin descripción todavía." }}</span>
            <span class="wcard__metrics">
              <span><b>{{ workshop.counts?.students ?? 0 }}</b>estudiantes</span>
              <span><b>{{ workshop.counts?.diplomas ?? 0 }}</b>diplomas</span>
              <span><b>{{ workshop.counts?.tools ?? 0 }}</b>herramientas</span>
              <span><b>{{ workshop.counts?.videos ?? 0 }}</b>videos</span>
            </span>
            <span class="wcard__open">Administrar taller <span aria-hidden="true">→</span></span>
          </button>

          <button type="button" class="wcard wcard--new" @click="openCreate">
            <span class="wcard__plus" aria-hidden="true">+</span>
            <strong>Crear taller</strong>
            <span>Un taller nuevo nace privado: solo existe en el campus hasta que decidas publicarlo.</span>
          </button>
        </div>
      </template>

      <AcademyUsers v-else :api="api" :workshops="overview.workshops" @notice="(message, type) => emit('notice', message, type)" @changed="load(true)" />
    </template>

    <transition name="modal">
      <div v-if="creating" class="modal" role="dialog" aria-modal="true" aria-labelledby="crear-taller" @click.self="creating = false">
        <form class="modal__card" :style="{ '--accent': form.accent }" @submit.prevent="create">
          <h3 id="crear-taller">Crear taller</h3>
          <p>Define su identidad. Después podrás inscribir estudiantes y cargar diplomas, herramientas y videos.</p>
          <div class="grid-2">
            <label class="field">Nombre del taller<input v-model="form.title" maxlength="120" placeholder="Ej. IA para Recursos Humanos" required /></label>
            <label class="field">Código<input v-model="form.code" maxlength="16" placeholder="Ej. RH.06" required /></label>
          </div>
          <label class="field" style="margin-top: 12px">Descripción corta<textarea v-model="form.description" maxlength="420" placeholder="La promesa del taller en una o dos frases."></textarea></label>
          <div class="grid-2" style="margin-top: 12px">
            <label class="field">Horas<input v-model.number="form.hours" type="number" min="1" max="400" /></label>
            <div class="field">Color del taller
              <div class="swatches">
                <button v-for="tone in PALETTE" :key="tone" type="button" :style="{ background: tone }" :class="{ active: form.accent === tone }" :aria-label="`Color ${tone}`" @click="form.accent = tone"></button>
                <input v-model="form.accent" type="color" aria-label="Color personalizado" />
              </div>
            </div>
          </div>
          <label class="toggle" style="margin-top: 16px"><input v-model="form.isPublic" type="checkbox" /> Mostrarlo también en la web pública</label>
          <div class="preview" aria-hidden="true">
            <span class="chip">{{ form.code || "CÓDIGO" }}</span>
            <strong>{{ form.title || "Nombre del taller" }}</strong>
          </div>
          <p v-if="formError" class="error">{{ formError }}</p>
          <div class="form-actions">
            <button type="button" class="ghost-action" @click="creating = false">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="saving">{{ saving ? "Creando…" : "Crear taller" }}</button>
          </div>
        </form>
      </div>
    </transition>
  </section>
</template>

<style scoped src="./academy-admin.css"></style>
<style scoped>
.campus { padding-bottom: 80px; }
.campus__nav { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.campus__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 16px; }

.wcard { position: relative; display: flex; flex-direction: column; gap: 12px; min-height: 290px; padding: 22px; overflow: hidden; border: 1px solid var(--line); border-radius: 24px; color: #fff; background: var(--card); text-align: left; cursor: pointer; isolation: isolate; transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), border-color 0.3s, box-shadow 0.3s; }
.wcard::before { position: absolute; top: 0; left: 22px; right: 22px; height: 2px; background: linear-gradient(90deg, var(--accent), transparent); content: ""; }
.wcard__glow { position: absolute; top: -40%; right: -30%; z-index: -1; width: 80%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent), transparent 65%); transition: transform 0.5s; }
.wcard:hover { transform: translateY(-5px); border-color: color-mix(in srgb, var(--accent) 50%, transparent); box-shadow: 0 26px 60px rgba(0, 0, 30, 0.45), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent); }
.wcard:hover .wcard__glow { transform: scale(1.25); }
.wcard__top { display: flex; flex-wrap: wrap; gap: 8px; }
.wcard__title { font-size: 22px; line-height: 1.12; letter-spacing: -0.03em; }
.wcard__desc { color: var(--muted); font-size: 13px; line-height: 1.6; }
.wcard__metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.wcard__metrics span { display: grid; gap: 4px; color: var(--muted); font-size: 10px; }
.wcard__metrics b { color: #fff; font: 800 20px/1 ui-monospace, monospace; }
.wcard__open { display: flex; justify-content: space-between; color: var(--accent); font-size: 13px; font-weight: 800; }
.wcard__open span { transition: transform 0.25s; }
.wcard:hover .wcard__open span { transform: translateX(4px); }
.wcard--new { align-items: center; justify-content: center; gap: 10px; border-style: dashed; border-color: rgba(87, 187, 255, 0.3); background: rgba(87, 187, 255, 0.03); text-align: center; }
.wcard--new strong { font-size: 18px; }
.wcard--new span { max-width: 260px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.wcard__plus { display: grid; width: 58px; height: 58px; place-content: center; border-radius: 18px; color: #021a21; background: linear-gradient(135deg, #50c8ff, #00d9a4); font: 300 40px/1 system-ui, sans-serif; }
.swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 44px; }
.swatches button { width: 28px; height: 28px; border: 2px solid transparent; border-radius: 50%; cursor: pointer; transition: transform 0.2s; }
.swatches button.active { border-color: #fff; transform: scale(1.12); }
.swatches input { width: 34px; height: 34px; padding: 0; border: 0; background: none; cursor: pointer; }
.preview { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 16px; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); border-radius: 16px; background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%), rgba(2, 9, 34, 0.6); }
.preview strong { font-size: 18px; letter-spacing: -0.02em; }
@media (prefers-reduced-motion: reduce) { .wcard, .wcard__glow { transition: none; } }
</style>
