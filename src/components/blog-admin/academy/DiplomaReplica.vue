<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { DEFAULT_DIPLOMA_DESIGN, diplomaLines, fitDiploma, sealStyle, signatureStyle, type DiplomaData, type DiplomaDesign, type DiplomaSeal, type DiplomaSignature } from "../../../lib/academy-diploma";
import "../../../styles/ai-academy-diploma.css";

// Vista previa en vivo del diploma oficial: el mismo diseño que genera el PDF.
// Con `draggable`, el sello se puede arrastrar; con `signatureDraggable`, la firma. Se avisa la nueva
// posición en puntos PDF (centro) con `move` (sello) o `move-signature` (firma).
const props = defineProps<{ data: DiplomaData; design?: DiplomaDesign | null; seal?: DiplomaSeal | null; signature?: DiplomaSignature | null; draggable?: boolean; signatureDraggable?: boolean }>();
const emit = defineEmits<{ (e: "move", position: { x: number; y: number }): void; (e: "move-signature", position: { x: number; y: number }): void }>();
const root = ref<HTMLElement | null>(null);
const dragging = ref<"seal" | "signature" | null>(null);
const lines = computed(() => diplomaLines(props.data, props.design ?? DEFAULT_DIPLOMA_DESIGN));
const sealCss = computed(() => (props.seal ? sealStyle(props.seal) : null));
const signatureCss = computed(() => (props.signature ? signatureStyle(props.signature) : null));

async function fit() {
  await nextTick();
  if (root.value) fitDiploma(root.value);
}

onMounted(() => {
  void fit();
  void document.fonts?.ready.then(fit);
});
watch(lines, fit);

type Target = "seal" | "signature";
const canDrag = (target: Target) => (target === "seal" ? props.draggable && props.seal : props.signatureDraggable && props.signature);
const current = (target: Target) => (target === "seal" ? props.seal! : props.signature!);
// Medio ancho (y medio alto) del elemento, para que no se salga de la hoja.
const half = (target: Target) => (target === "seal" ? { x: props.seal!.size / 2, y: props.seal!.size / 2 } : { x: props.signature!.width / 2, y: 20 });
const report = (target: Target, x: number, y: number) => emit(target === "seal" ? "move" : "move-signature", { x: Math.round(x), y: Math.round(y) });

// Arrastre: la distancia en píxeles se convierte a puntos PDF con la escala del diploma (792 pt de ancho).
function startDrag(event: PointerEvent, target: Target) {
  if (!canDrag(target) || !root.value) return;
  event.preventDefault();
  const scale = 792 / root.value.clientWidth;
  const item = current(target);
  const origin = { x: item.x, y: item.y, px: event.clientX, py: event.clientY };
  const limit = half(target);
  const node = event.currentTarget as HTMLElement;
  node.setPointerCapture(event.pointerId);
  dragging.value = target;
  const move = (pointer: PointerEvent) => {
    const x = Math.min(792 - limit.x, Math.max(limit.x, origin.x + (pointer.clientX - origin.px) * scale));
    const y = Math.min(612 - limit.y, Math.max(limit.y, origin.y - (pointer.clientY - origin.py) * scale));
    report(target, x, y);
  };
  const stop = () => {
    dragging.value = null;
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", stop);
    node.removeEventListener("pointercancel", stop);
  };
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
}

// Flechas del teclado: 1 punto por pulsación, 10 con Mayús.
function nudge(event: KeyboardEvent, target: Target) {
  if (!canDrag(target)) return;
  const step = event.shiftKey ? 10 : 1;
  const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  const move = delta[event.key];
  if (!move) return;
  event.preventDefault();
  const item = current(target);
  report(target, item.x + move[0], item.y + move[1]);
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
      v-if="signature && signatureCss"
      class="dpl__sig"
      :class="{ 'dpl__sig--drag': signatureDraggable, 'is-dragging': dragging === 'signature' }"
      :style="signatureCss"
      :tabindex="signatureDraggable ? 0 : undefined"
      :role="signatureDraggable ? 'slider' : undefined"
      :aria-label="signatureDraggable ? 'Firma: arrástrala o muévela con las flechas' : undefined"
      @pointerdown="startDrag($event, 'signature')"
      @keydown="nudge($event, 'signature')"
    ><img :src="signature.url" alt="" draggable="false" /></div>
    <div
      v-if="seal && sealCss"
      class="dpl__seal"
      :class="{ 'dpl__seal--drag': draggable, 'is-dragging': dragging === 'seal' }"
      :style="sealCss"
      :tabindex="draggable ? 0 : undefined"
      :role="draggable ? 'slider' : undefined"
      :aria-label="draggable ? 'Sello: arrástralo o muévelo con las flechas' : undefined"
      @pointerdown="startDrag($event, 'seal')"
      @keydown="nudge($event, 'seal')"
      v-html="seal.svg"
    ></div>
  </div>
</template>
