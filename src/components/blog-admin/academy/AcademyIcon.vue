<script setup lang="ts">
import { ACADEMY_ICONS, type AcademyIconName } from "../../../lib/academy-icons";

withDefaults(defineProps<{ name: AcademyIconName; size?: number; fill?: boolean }>(), { size: 20, fill: false });
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" :fill="fill ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="ACADEMY_ICONS[name]" />
</template>
