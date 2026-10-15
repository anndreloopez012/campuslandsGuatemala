<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { DEFAULT_DIPLOMA_DESIGN, diplomaLines, fitDiploma, sealStyle, type DiplomaData, type DiplomaDesign, type DiplomaSeal } from "../../../lib/academy-diploma";
import "../../../styles/ai-academy-diploma.css";

// Vista previa en vivo del diploma oficial: el mismo diseño que genera el PDF.
// Con `draggable`, el sello se puede arrastrar y se avisa su nueva posición en puntos PDF (centro).
const props = defineProps<{ data: DiplomaData; design?: DiplomaDesign | null; seal?: DiplomaSeal | null; draggable?: boolean }>();
const emit = defineEmits<{ (e: "move", position: { x: number; y: number }): void }>();
const root = ref<HTMLElement | null>(null);
const dragging = ref(false);
const lines = computed(() => diplomaLines(props.data, props.design ?? DEFAULT_DIPLOMA_DESIGN));
const sealCss = computed(() => (props.seal ? sealStyle(props.seal) : null));

async function fit() {
  await nextTick();
  if (root.value) fitDiploma(root.value);
}

onMounted(() => {
  void fit();
  void document.fonts?.ready.then(fit);
});
watch(lines, fit);

// Arrastre: la distancia en píxeles se convierte a puntos PDF con la escala del diploma (792 pt de ancho).
function startDrag(event: PointerEvent) {
  if (!props.draggable || !props.seal || !root.value) return;
  event.preventDefault();
  const scale = 792 / root.value.clientWidth;
  const origin = { x: props.seal.x, y: props.seal.y, px: event.clientX, py: event.clientY };
  const half = props.seal.size / 2;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  dragging.value = true;
  const move = (pointer: PointerEvent) => {
    const x = Math.min(792 - half, Math.max(half, origin.x + (pointer.clientX - origin.px) * scale));
    const y = Math.min(612 - half, Math.max(half, origin.y - (pointer.clientY - origin.py) * scale));
    emit("move", { x: Math.round(x), y: Math.round(y) });
  };
  const stop = () => {
    dragging.value = false;
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", stop);
    target.removeEventListener("pointercancel", stop);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", stop);
  target.addEventListener("pointercancel", stop);
}

// Flechas del teclado: 1 punto por pulsación, 10 con Mayús.
function nudge(event: KeyboardEvent) {
  if (!props.draggable || !props.seal) return;
  const step = event.shiftKey ? 10 : 1;
  const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  const move = delta[event.key];
  if (!move) return;
  event.preventDefault();
  emit("move", { x: props.seal.x + move[0], y: props.seal.y + move[1] });
}
</script>

<template>
  <div ref="root" class="dpl" role="img" :aria-label="`Vista previa del diploma de ${data.fullName}`">
    <p
      v-for="line in lines"
      :key="line.key"
      class="dpl__l"
      :class="[line.strong && 'dpl__l--strong', line.className]"
      :style="{ '--y': line.y, '--s': line.s, ...(line.w ? { '--w': line.w } : {}) }"
      data-fit
      :data-s="line.s"
      :data-min="line.min ?? 9"
      :data-wrap="line.wrap ? '1' : undefined"
      aria-hidden="true"
    >{{ line.text }}</p>
    <span class="dpl__rule" aria-hidden="true"></span>
    <div
      v-if="seal && sealCss"
      class="dpl__seal"
      :class="{ 'dpl__seal--drag': draggable, 'is-dragging': dragging }"
      :style="sealCss"
      :tabindex="draggable ? 0 : undefined"
      :role="draggable ? 'slider' : undefined"
      :aria-label="draggable ? 'Sello: arrástralo o muévelo con las flechas' : undefined"
      @pointerdown="startDrag"
      @keydown="nudge"
      v-html="seal.svg"
    ></div>
  </div>
</template>
