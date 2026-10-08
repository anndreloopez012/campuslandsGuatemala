<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { AcademyPerson, AcademyWorkshop, BlogAdminApi } from "../../../lib/blog-admin";

const props = defineProps<{ api: BlogAdminApi; workshops: AcademyWorkshop[] }>();
const emit = defineEmits<{
  (e: "notice", message: string, type?: "success" | "error"): void;
  (e: "changed"): void;
}>();

type Role = "student" | "admin";
const role = ref<Role>("student");
const loading = ref(true);
const error = ref("");
const users = ref<AcademyPerson[]>([]);
const canManageAdmins = ref(false);
const search = ref("");
const filter = ref<"todos" | "activos" | "pendientes" | "bloqueados">("todos");
const busy = ref(false);

const say = (message: string, type: "success" | "error" = "success") => emit("notice", message, type);
const problem = (value: unknown, fallback: string) => (value instanceof Error ? value.message : fallback);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const accentOf = (key: string) => props.workshops.find((item) => item.key === key)?.accent || "#7A3CFF";

const visible = computed(() => users.value
  .filter((person) => `${person.fullName} ${person.email}`.toLowerCase().includes(search.value.trim().toLowerCase()))
  .filter((person) => filter.value === "todos"
    || (filter.value === "bloqueados" && person.blocked)
    || (filter.value === "pendientes" && !person.blocked && person.mustChangePassword)
    || (filter.value === "activos" && !person.blocked && !person.mustChangePassword)));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await props.api.academyUsers(role.value);
    users.value = result.users;
    canManageAdmins.value = result.canManageAdmins;
  } catch (value) {
    error.value = problem(value, "No se pudieron cargar las cuentas.");
  } finally {
    loading.value = false;
  }
}

watch(role, () => { search.value = ""; filter.value = "todos"; void load(); });

// ---------------------------------------------------------------- crear y editar
const creating = ref(false);
const form = reactive({ fullName: "", email: "", phone: "", cohort: "", workshops: [] as string[] });
const formError = ref("");
const created = ref<{ fullName: string; email: string; password: string; phone: string; reset?: boolean } | null>(null);

function openCreate() {
  Object.assign(form, { fullName: "", email: "", phone: "", cohort: "", workshops: [] });
  formError.value = "";
  created.value = null;
  creating.value = true;
}

async function create() {
  formError.value = "";
  busy.value = true;
  try {
    const result = await props.api.createAcademyUser({ ...form, role: role.value });
    created.value = { fullName: result.fullName, email: result.email, password: result.temporaryPassword, phone: form.phone };
    say(role.value === "student" ? "Estudiante creado." : "Administrador creado.");
    emit("changed");
    await load();
  } catch (value) {
    formError.value = problem(value, "No se pudo crear la cuenta.");
  } finally {
    busy.value = false;
  }
}

const editing = ref<AcademyPerson | null>(null);
const editForm = reactive({ fullName: "", phone: "" });
function openEdit(person: AcademyPerson) {
  editing.value = person;
  Object.assign(editForm, { fullName: person.fullName, phone: person.phone });
}
async function saveEdit() {
  if (!editing.value) return;
  busy.value = true;
  try {
    await props.api.updateAcademyUser(editing.value.id, { ...editForm });
    editing.value = null;
    say("Datos actualizados.");
    await load();
  } catch (value) {
    say(problem(value, "No se pudo guardar."), "error");
  } finally {
    busy.value = false;
  }
}

async function toggleBlock(person: AcademyPerson) {
  const next = !person.blocked;
  if (next && !window.confirm(`¿Bloquear a ${person.fullName}? No podrá iniciar sesión hasta que lo desbloquees.`)) return;
  try {
    await props.api.updateAcademyUser(person.id, { blocked: next });
    person.blocked = next;
    say(next ? "Cuenta bloqueada." : "Cuenta desbloqueada.");
  } catch (value) {
    say(problem(value, "No se pudo cambiar el estado."), "error");
  }
}

async function resetPassword(person: AcademyPerson) {
  if (!window.confirm(`¿Generar una contraseña temporal nueva para ${person.fullName}? La actual dejará de funcionar.`)) return;
  try {
    const result = await props.api.resetAcademyPassword(person.id);
    created.value = { fullName: person.fullName, email: person.email, password: result.temporaryPassword, phone: person.phone, reset: true };
    creating.value = true;
    await load();
  } catch (value) {
    say(problem(value, "No se pudo restablecer."), "error");
  }
}

// ---------------------------------------------------------------- mensaje de bienvenida
const loginUrl = computed(() => `${window.location.origin}${role.value === "student" ? "/ai-academy/acceso" : "/blog-admin"}`);
const welcome = computed(() => {
  if (!created.value) return "";
  const first = created.value.fullName.split(" ")[0];
  const where = role.value === "student" ? "tu campus de AI Academy" : "el administrador de Campuslands";
  return `Hola ${first}, ya tienes acceso a ${where}.\n\nIngresa en: ${loginUrl.value}\nCorreo: ${created.value.email}\nContraseña temporal: ${created.value.password}\n\nAl entrar te pediremos crear tu propia contraseña.`;
});
const whatsappLink = computed(() => {
  const digits = (created.value?.phone || "").replace(/\D/g, "");
  const number = digits.length === 8 ? `502${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(welcome.value)}`;
});
async function copyWelcome() {
  try { await navigator.clipboard.writeText(welcome.value); say("Mensaje copiado. Pégalo en WhatsApp o en un correo."); }
  catch { window.prompt("Copia el mensaje:", welcome.value); }
}

onMounted(load);
</script>

<template>
  <section class="ac users">
    <div class="users__bar">
      <nav class="seg" aria-label="Tipo de cuenta">
        <button type="button" :class="{ active: role === 'student' }" @click="role = 'student'">Estudiantes</button>
        <button type="button" :class="{ active: role === 'admin' }" @click="role = 'admin'">Administradores</button>
      </nav>
      <label class="field users__search"><input v-model="search" placeholder="Buscar por nombre o correo" aria-label="Buscar" /></label>
      <select v-model="filter" class="users__filter" aria-label="Filtrar">
        <option value="todos">Todas</option>
        <option value="activos">Activas</option>
        <option value="pendientes">Deben cambiar contraseña</option>
        <option value="bloqueados">Bloqueadas</option>
      </select>
      <button type="button" class="primary-action" :disabled="role === 'admin' && !canManageAdmins" :title="role === 'admin' && !canManageAdmins ? 'Solo la cuenta principal crea administradores' : ''" @click="openCreate">
        + {{ role === "student" ? "Nuevo estudiante" : "Nuevo administrador" }}
      </button>
    </div>

    <p v-if="role === 'admin' && !canManageAdmins" class="users__note">Solo la cuenta principal puede crear o editar administradores.</p>

    <div v-if="loading" class="state"><i aria-hidden="true"></i><p>Cargando cuentas…</p></div>
    <div v-else-if="error" class="state"><p class="error">{{ error }}</p></div>
    <div v-else-if="!visible.length" class="empty" style="margin-top: 18px">
      <b>{{ role === "student" ? "🎓" : "🛰" }}</b>
      <strong>{{ users.length ? "Nada coincide con la búsqueda" : role === "student" ? "Aún no hay estudiantes" : "Aún no hay administradores" }}</strong>
      {{ users.length ? "Prueba con otro nombre o filtro." : "Crea la primera cuenta con el botón de arriba." }}
    </div>
    <div v-else class="cards">
      <article v-for="person in visible" :key="person.id" class="person" :class="{ 'is-blocked': person.blocked }">
        <header>
          <span class="avatar" :style="{ '--accent': person.workshops?.[0] ? accentOf(person.workshops[0].key) : '#57BBFF' }">{{ initials(person.fullName) }}</span>
          <div>
            <strong>{{ person.fullName }}</strong>
            <span>{{ person.email }}</span>
          </div>
        </header>
        <div class="person__chips">
          <span v-if="person.isOwner" class="chip chip--ok">Cuenta principal</span>
          <span v-if="person.blocked" class="chip chip--bad">Bloqueada</span>
          <span v-else-if="person.mustChangePassword" class="chip chip--warn">Debe cambiar contraseña</span>
          <span v-else class="chip chip--ok">Activa</span>
          <span v-for="item in person.workshops ?? []" :key="item.key" class="chip" :style="{ '--accent': item.accent }">{{ item.code }}</span>
          <span v-if="role === 'student' && !(person.workshops ?? []).length" class="chip chip--soft">Sin talleres</span>
        </div>
        <footer>
          <button type="button" class="ghost-action ghost-action--small" :disabled="role === 'admin' && !canManageAdmins" @click="openEdit(person)">Editar</button>
          <button type="button" class="ghost-action ghost-action--small" :disabled="role === 'admin' && !canManageAdmins" @click="resetPassword(person)">Restablecer contraseña</button>
          <button v-if="!person.isOwner" type="button" class="ghost-action ghost-action--small" :class="{ 'ghost-action--danger': !person.blocked }" :disabled="role === 'admin' && !canManageAdmins" @click="toggleBlock(person)">{{ person.blocked ? "Desbloquear" : "Bloquear" }}</button>
        </footer>
      </article>
    </div>

    <!-- Crear / credenciales -->
    <transition name="modal">
      <div v-if="creating" class="modal" role="dialog" aria-modal="true" aria-labelledby="nueva-cuenta" @click.self="creating = false">
        <div class="modal__card">
          <template v-if="created">
            <h3 id="nueva-cuenta">{{ created.reset ? "Contraseña restablecida" : role === "student" ? "¡Estudiante listo!" : "¡Administrador listo!" }}</h3>
            <p>Comparte estos datos ahora: la contraseña temporal no se vuelve a mostrar. Al entrar, se le pedirá crear la suya.</p>
            <div class="secret">
              <dl>
                <dt>Nombre</dt><dd>{{ created.fullName }}</dd>
                <dt>Correo</dt><dd>{{ created.email }}</dd>
                <dt>Contraseña</dt><dd>{{ created.password }}</dd>
                <dt>Acceso</dt><dd>{{ loginUrl }}</dd>
              </dl>
            </div>
            <div class="form-actions">
              <button type="button" class="ghost-action" @click="copyWelcome">Copiar mensaje de bienvenida</button>
              <a v-if="created.phone" class="ghost-action" :href="whatsappLink" target="_blank" rel="noopener">Enviar por WhatsApp</a>
              <button type="button" class="primary-action" @click="creating = false; created = null">Listo</button>
            </div>
          </template>

          <form v-else @submit.prevent="create">
            <h3 id="nueva-cuenta">{{ role === "student" ? "Nuevo estudiante" : "Nuevo administrador" }}</h3>
            <p>{{ role === "student" ? "Tendrá acceso de solo consulta a los talleres que marques." : "Podrá gestionar el blog y el campus de AI Academy." }}</p>
            <div class="grid-2">
              <label class="field">Nombre completo<input v-model="form.fullName" maxlength="120" required placeholder="Como aparecerá en el diploma" /></label>
              <label class="field">Correo<input v-model="form.email" type="email" maxlength="160" required /></label>
            </div>
            <label class="field" style="margin-top: 12px">WhatsApp (opcional)<input v-model="form.phone" maxlength="30" placeholder="Ej. 5555 1234" /><small>Para enviarle el acceso con un clic.</small></label>
            <template v-if="role === 'student'">
              <div class="field" style="margin-top: 14px">Talleres
                <div class="wpick">
                  <label v-for="workshop in workshops" :key="workshop.key" class="wpick__item" :class="{ active: form.workshops.includes(workshop.key) }" :style="{ '--accent': workshop.accent }">
                    <input v-model="form.workshops" type="checkbox" :value="workshop.key" />
                    <span class="chip">{{ workshop.code }}</span>
                    <span>{{ workshop.title }}</span>
                  </label>
                </div>
              </div>
              <label class="field" style="margin-top: 12px">Cohorte (opcional)<input v-model="form.cohort" maxlength="80" placeholder="Ej. Cohorte octubre 2026" /></label>
            </template>
            <p v-if="formError" class="error" style="margin-top: 12px">{{ formError }}</p>
            <div class="form-actions">
              <button type="button" class="ghost-action" @click="creating = false">Cancelar</button>
              <button type="submit" class="primary-action" :disabled="busy">{{ busy ? "Creando…" : "Crear cuenta" }}</button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <!-- Editar -->
    <transition name="modal">
      <div v-if="editing" class="modal" role="dialog" aria-modal="true" aria-labelledby="editar-cuenta" @click.self="editing = null">
        <form class="modal__card" @submit.prevent="saveEdit">
          <h3 id="editar-cuenta">Editar cuenta</h3>
          <p>{{ editing.email }}</p>
          <label class="field">Nombre completo<input v-model="editForm.fullName" maxlength="120" required /></label>
          <label class="field" style="margin-top: 12px">WhatsApp<input v-model="editForm.phone" maxlength="30" /></label>
          <div class="form-actions">
            <button type="button" class="ghost-action" @click="editing = null">Cancelar</button>
            <button type="submit" class="primary-action" :disabled="busy">Guardar</button>
          </div>
        </form>
      </div>
    </transition>
  </section>
</template>

<style scoped src="./academy-admin.css"></style>
<style scoped>
.users { margin-top: 28px; padding-bottom: 60px; }
.users__bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.users__search { flex: 1; min-width: 200px; }
.users__filter { min-height: 44px; padding: 0 12px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #fff; background: var(--field); font: inherit; font-size: 13px; }
.users__note { margin: 12px 0 0; color: #ffd591; font-size: 12px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 12px; margin-top: 18px; }
.person { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); transition: border-color 0.2s, transform 0.2s; }
.person:hover { border-color: rgba(87, 187, 255, 0.35); transform: translateY(-2px); }
.person.is-blocked { opacity: 0.6; }
.person header { display: flex; align-items: center; gap: 12px; min-width: 0; }
.person header div { display: grid; gap: 3px; min-width: 0; }
.person strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.person header span:not(.avatar) { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.person__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.person footer { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.wpick { display: grid; gap: 6px; }
.wpick__item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.wpick__item.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.wpick__item input { accent-color: var(--green); }
</style>
