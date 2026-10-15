<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { busyState } from "../../lib/busy";

// Pantalla de espera para procesos largos: cubre todo el panel, deja inerte el resto
// (sin clics ni teclado) y explica que no hay que cerrar ni cambiar de sección.
const current = computed(() => busyState.jobs[busyState.jobs.length - 1] ?? null);
const others = computed(() => Math.max(0, busyState.jobs.length - 1));

function setInert(active: boolean) {
  document.querySelectorAll<HTMLElement>("body > *:not(.busy)").forEach((node) => {
    if (active) node.setAttribute("inert", "");
    else node.removeAttribute("inert");
  });
}

// Solo en el navegador: en el renderizado del servidor no existe `document`.
onMounted(() => { watch(() => busyState.jobs.length > 0, setInert, { immediate: true }); });
onBeforeUnmount(() => setInert(false));
</script>

<template>
  <Teleport to="body">
    <Transition name="busy">
      <div v-if="current" class="busy" role="alertdialog" aria-modal="true" aria-live="assertive" :aria-label="current.title">
        <div class="busy__card">
          <div class="busy__orbit" aria-hidden="true"><i></i><i></i><i></i></div>
          <strong class="busy__title">{{ current.title }}</strong>
          <p v-if="current.detail" class="busy__detail">{{ current.detail }}</p>
          <p class="busy__warn">No cierres ni recargues esta ventana, ni cambies de sección, hasta que termine. Si se interrumpe, el proceso queda a medias.</p>
          <small v-if="others" class="busy__more">{{ others }} {{ others === 1 ? "proceso más en cola" : "procesos más en cola" }}</small>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.busy { display: grid; position: fixed; inset: 0; z-index: 1100; place-items: center; padding: 16px; background: rgb(3 11 40 / 78%); backdrop-filter: blur(8px); cursor: progress; font-family: Poppins, ui-sans-serif, system-ui, sans-serif; }
.busy__card { display: grid; width: min(420px, 100%); padding: 32px 28px 26px; justify-items: center; gap: 8px; border: 1px solid rgb(255 255 255 / 10%); border-radius: 22px; color: #f7f9ff; background: linear-gradient(180deg, #0b1748, #071235); box-shadow: 0 30px 80px rgb(0 0 0 / 55%), inset 0 1px 0 rgb(255 255 255 / 6%); text-align: center; }
.busy__orbit { position: relative; width: 64px; height: 64px; margin-bottom: 10px; }
.busy__orbit i { position: absolute; inset: 0; border: 3px solid transparent; border-top-color: #50c8ff; border-radius: 50%; animation: busy-spin 1.1s linear infinite; }
.busy__orbit i:nth-child(2) { inset: 9px; border-top-color: #00d9a4; animation-duration: 0.9s; animation-direction: reverse; }
.busy__orbit i:nth-child(3) { inset: 18px; border-top-color: #b997ff; animation-duration: 1.4s; }
.busy__title { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.busy__detail { margin: 0; color: #7fffdc; font-size: 13.5px; font-weight: 600; }
.busy__warn { margin: 6px 0 0; color: rgb(223 245 255 / 70%); font-size: 12.5px; line-height: 1.6; }
.busy__more { color: rgb(223 245 255 / 50%); font-size: 11.5px; }
.busy-enter-active, .busy-leave-active { transition: opacity 0.2s; }
.busy-enter-from, .busy-leave-to { opacity: 0; }
@keyframes busy-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .busy__orbit i { animation-duration: 3s; } }
</style>
