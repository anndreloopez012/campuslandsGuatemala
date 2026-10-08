<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { AcademyWorkshop, BlogAdminApi } from "../../../lib/blog-admin";
import AcademyUsers from "./AcademyUsers.vue";

// Página propia de cuentas: administradores del panel y estudiantes del campus de AI Academy.
const props = defineProps<{ api: BlogAdminApi }>();
const emit = defineEmits<{ (e: "notice", message: string, type?: "success" | "error"): void }>();

const workshops = ref<AcademyWorkshop[]>([]);
const totals = ref({ students: 0, admins: 0 });

async function load() {
  try {
    const overview = await props.api.academyOverview();
    workshops.value = overview.workshops;
    totals.value = { students: overview.students, admins: overview.admins };
  } catch {
    workshops.value = [];
  }
}

onMounted(load);
</script>

<template>
  <section class="ac users-page">
    <header class="page-heading">
      <div>
        <p>PULSO / USUARIOS</p>
        <h1>Usuarios y accesos</h1>
        <span>Crea cuentas de administración para el panel y de estudiantes para el campus de AI Academy. Cada cuenta nueva recibe una contraseña temporal que debe cambiar al primer ingreso.</span>
      </div>
      <a class="ghost-action" href="/ai-academy/acceso/" target="_blank" rel="noopener">Ver acceso de estudiantes ↗</a>
    </header>
    <dl class="stats">
      <div class="is-green"><dt>{{ totals.students }}</dt><dd>estudiantes</dd></div>
      <div class="is-violet"><dt>{{ totals.admins }}</dt><dd>administradores</dd></div>
      <div class="is-blue"><dt>{{ workshops.length }}</dt><dd>talleres</dd></div>
    </dl>
    <AcademyUsers :api="api" :workshops="workshops" @notice="(message, type) => emit('notice', message, type)" @changed="load" />
  </section>
</template>

<style scoped src="./academy-admin.css"></style>
<style scoped>
.users-page { padding-bottom: 80px; }
</style>
