<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { DEFAULT_DIPLOMA_DESIGN, diplomaLines, fitDiploma, type DiplomaData, type DiplomaDesign } from "../../../lib/academy-diploma";
import "../../../styles/ai-academy-diploma.css";

// Vista previa en vivo del diploma oficial: el mismo diseño que genera el PDF.
const props = defineProps<{ data: DiplomaData; design?: DiplomaDesign | null }>();
const root = ref<HTMLElement | null>(null);
const lines = computed(() => diplomaLines(props.data, props.design ?? DEFAULT_DIPLOMA_DESIGN));

async function fit() {
  await nextTick();
  if (root.value) fitDiploma(root.value);
}

onMounted(() => {
  void fit();
  void document.fonts?.ready.then(fit);
});
watch(lines, fit);
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
  </div>
</template>
