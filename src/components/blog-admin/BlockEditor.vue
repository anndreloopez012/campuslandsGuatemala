<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { EditorMedia } from "../../lib/blog-admin";
import { renderBlogBlocks } from "../../lib/blog";
import { askConfirm, askText } from "../../lib/dialogs";

type BlockType = "paragraph" | "heading" | "quote" | "list" | "code" | "image" | "gallery" | "callout" | "button" | "video" | "embed" | "table" | "divider";
type EditorBlock = {
  id: string;
  type: BlockType;
  text: string;
  title?: string;
  level?: 2 | 3 | 4;
  format?: "ordered" | "unordered";
  image?: EditorMedia | null;
  images?: EditorMedia[];
  altText?: string;
  alignment?: "wide" | "full" | "left" | "center" | "right";
  layout?: "grid" | "masonry" | "carousel";
  autoplay?: boolean;
  tone?: "info" | "success" | "warning" | "note";
  label?: string;
  url?: string;
  variant?: "primary" | "secondary";
  openInNewTab?: boolean;
  provider?: "youtube" | "vimeo" | "direct";
  platform?: "instagram" | "facebook" | "x" | "other";
  caption?: string;
  language?: string;
  headersText?: string;
  rowsText?: string;
};

const props = defineProps<{
  modelValue: any[];
  uploadImage: (file: File) => Promise<EditorMedia>;
  mediaBaseUrl: string;
}>();
const emit = defineEmits<{ (event: "update:modelValue", value: any[]): void }>();

const blocks = ref<EditorBlock[]>([]);
const textareaRefs = new Map<string, HTMLTextAreaElement>();
const uploading = ref(false);
const uploadError = ref("");
const fullscreen = ref(false);
const draggedIndex = ref<number | null>(null);
const history = ref<string[]>([]);
const historyIndex = ref(-1);
let applyingHistory = false;
let lastEmitted = "";

const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1);
const blockCountLabel = computed(() => `${blocks.value.length} ${blocks.value.length === 1 ? "bloque" : "bloques"}`);
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function inlineToMarkdown(children: any[] = []) {
  return children.map((child) => {
    const raw = child.type === "link"
      ? `[${inlineToMarkdown(child.children)}](${child.url || ""})`
      : String(child.text || "");
    if (child.type === "link") return raw;
    if (child.code) return `\`${raw}\``;
    if (child.bold) return `**${raw}**`;
    if (child.underline) return `__${raw}__`;
    if (child.strikethrough) return `~~${raw}~~`;
    if (child.italic) return `*${raw}*`;
    return raw;
  }).join("");
}

function parseInline(value: string) {
  const children: any[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|`([^`]+)`)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) children.push({ type: "text", text: value.slice(cursor, index) });
    if (match[2] && match[3]) children.push({ type: "link", url: match[3], children: [{ type: "text", text: match[2] }] });
    else if (match[4]) children.push({ type: "text", text: match[4], bold: true });
    else if (match[5]) children.push({ type: "text", text: match[5], underline: true });
    else if (match[6]) children.push({ type: "text", text: match[6], strikethrough: true });
    else if (match[7]) children.push({ type: "text", text: match[7], italic: true });
    else if (match[8]) children.push({ type: "text", text: match[8], code: true });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) children.push({ type: "text", text: value.slice(cursor) });
  return children.length ? children : [{ type: "text", text: "" }];
}

function newBlock(type: BlockType): EditorBlock {
  return {
    id: id(), type, text: "",
    ...(type === "heading" ? { level: 2 as const } : {}),
    ...(type === "list" ? { format: "unordered" as const } : {}),
    ...(type === "image" ? { image: null, alignment: "wide" as const, altText: "" } : {}),
    ...(type === "gallery" ? { images: [], layout: "grid" as const, autoplay: false, title: "", caption: "" } : {}),
    ...(type === "callout" ? { tone: "info" as const, title: "" } : {}),
    ...(type === "button" ? { variant: "primary" as const, label: "", url: "", openInNewTab: false } : {}),
    ...(type === "video" ? { provider: "youtube" as const, url: "", caption: "" } : {}),
    ...(type === "embed" ? { platform: "instagram" as const, url: "", caption: "" } : {}),
    ...(type === "table" ? { headersText: "Columna 1 | Columna 2", rowsText: "Dato 1 | Dato 2", caption: "" } : {}),
    ...(type === "code" ? { language: "javascript" } : {}),
  };
}

function fromContent(value: any[] = []): EditorBlock[] {
  return value.map((block) => {
    if (block.type === "list") return { ...newBlock("list"), format: block.format === "ordered" ? "ordered" : "unordered", text: (block.children || []).map((item: any) => inlineToMarkdown(item.children)).join("\n") };
    if (block.type === "image") return { ...newBlock("image"), text: block.image?.caption || "", altText: block.image?.alternativeText || "", alignment: block.alignment || "wide", image: block.image };
    if (block.type === "gallery") return { ...newBlock("gallery"), title: block.title || "", caption: block.caption || "", layout: block.layout || "grid", autoplay: Boolean(block.autoplay), images: Array.isArray(block.images) ? block.images : [] };
    if (block.type === "code") return { ...newBlock("code"), text: block.text || block.children?.map((child: any) => child.text || "").join("") || "", language: block.language || "javascript" };
    if (block.type === "callout") return { ...newBlock("callout"), title: block.title || "", tone: block.tone || "info", text: inlineToMarkdown(block.children) };
    if (block.type === "button") return { ...newBlock("button"), label: block.label || "", url: block.url || "", variant: block.variant || "primary", openInNewTab: Boolean(block.openInNewTab) };
    if (block.type === "video") return { ...newBlock("video"), url: block.url || "", provider: block.provider || "direct", caption: block.caption || "" };
    if (block.type === "embed") return { ...newBlock("embed"), url: block.url || "", platform: block.platform || "other", caption: block.caption || "" };
    if (block.type === "table") return { ...newBlock("table"), headersText: (block.headers || []).join(" | "), rowsText: (block.rows || []).map((row: string[]) => row.join(" | ")).join("\n"), caption: block.caption || "" };
    if (block.type === "divider") return newBlock("divider");
    const type: BlockType = ["paragraph", "heading", "quote"].includes(block.type) ? block.type : "paragraph";
    return { ...newBlock(type), text: inlineToMarkdown(block.children), alignment: ["center", "right"].includes(block.alignment) ? block.alignment : "left", level: type === "heading" && [3, 4].includes(Number(block.level)) ? Number(block.level) as 3 | 4 : 2 };
  });
}

function cells(value = "") {
  return value.split("|").map((cell) => cell.trim());
}

function listLine(value: string) {
  const ordered = value.match(/^\s*\d+[.)]\s+(.+)$/);
  if (ordered) return { format: "ordered" as const, text: ordered[1].trim() };
  const unordered = value.match(/^\s*(?:[-+*]|[•‣▪◦])\s+(.+)$/);
  if (unordered) return { format: "unordered" as const, text: unordered[1].trim() };
  return null;
}

function isTableSeparator(value: string) {
  const columns = cells(value).filter(Boolean);
  return columns.length > 0 && columns.every((column) => /^:?-{3,}:?$/.test(column));
}

function markdownTable(lines: string[], start: number) {
  if (start + 1 >= lines.length || !lines[start].includes("|") || !isTableSeparator(lines[start + 1])) return null;
  const headers = cells(lines[start]).filter((cell, index, all) => cell || (index > 0 && index < all.length - 1));
  if (headers.length < 2) return null;
  const rows: string[][] = [];
  let cursor = start + 2;
  while (cursor < lines.length && lines[cursor].trim() && lines[cursor].includes("|")) {
    const row = cells(lines[cursor]).filter((cell, index, all) => cell || (index > 0 && index < all.length - 1));
    rows.push(row);
    cursor += 1;
  }
  return { block: { type: "table", headers, rows, caption: "" }, next: cursor };
}

function paragraphContent(block: EditorBlock) {
  const source = block.text.replace(/\r\n?/g, "\n").trim();
  if (!source) return [];

  if (block.type === "heading") return [{ type: "heading", level: block.level || 2, alignment: ["center", "right"].includes(block.alignment || "") ? block.alignment : "left", children: parseInline(source) }];
  if (block.type === "quote") return [{ type: "quote", alignment: ["center", "right"].includes(block.alignment || "") ? block.alignment : "left", children: parseInline(source.replace(/^>\s?/gm, "")) }];
  if (block.type === "callout") return [{ type: "callout", tone: block.tone || "info", title: block.title || "", children: parseInline(source) }];

  const lines = source.split("\n");
  const content: any[] = [];
  let paragraph: string[] = [];
  const alignment = ["center", "right"].includes(block.alignment || "") ? block.alignment : "left";
  const flushParagraph = () => {
    const text = paragraph.join("\n").trim();
    if (text) content.push({ type: "paragraph", alignment, children: parseInline(text) });
    paragraph = [];
  };

  for (let cursor = 0; cursor < lines.length;) {
    const line = lines[cursor];
    if (!line.trim()) {
      flushParagraph();
      cursor += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      flushParagraph();
      const language = line.trim().slice(3).trim() || "text";
      const code: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !/^\s*```/.test(lines[cursor])) code.push(lines[cursor++]);
      if (cursor < lines.length) cursor += 1;
      const text = code.join("\n");
      content.push({ type: "code", language, text, children: [{ type: "text", text }] });
      continue;
    }

    const table = markdownTable(lines, cursor);
    if (table) {
      flushParagraph();
      content.push(table.block);
      cursor = table.next;
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      content.push({ type: "heading", level: Math.min(4, Math.max(2, heading[1].length)), alignment, children: parseInline(heading[2].trim()) });
      cursor += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (cursor < lines.length && /^\s*>\s?/.test(lines[cursor])) quote.push(lines[cursor++].replace(/^\s*>\s?/, ""));
      content.push({ type: "quote", alignment, children: parseInline(quote.join("\n").trim()) });
      continue;
    }

    const item = listLine(line);
    if (item) {
      flushParagraph();
      const items: any[] = [];
      const format = item.format;
      while (cursor < lines.length) {
        const current = listLine(lines[cursor]);
        if (!current || current.format !== format) break;
        items.push({ type: "list-item", children: parseInline(current.text) });
        cursor += 1;
      }
      content.push({ type: "list", format, children: items });
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      content.push({ type: "divider" });
      cursor += 1;
      continue;
    }

    paragraph.push(line);
    cursor += 1;
  }
  flushParagraph();
  return content;
}

function toContent() {
  return blocks.value.flatMap((block) => {
    if (block.type === "image" && block.image) return [{
      type: "image",
      alignment: block.alignment || "wide",
      image: { ...block.image, alternativeText: block.altText || block.image.alternativeText || null, caption: block.text || block.image.caption || null },
      children: [{ type: "text", text: "" }],
    }];
    if (block.type === "gallery" && block.images?.length) return [{
      type: "gallery",
      title: block.title || "",
      caption: block.caption || "",
      layout: block.layout || "grid",
      autoplay: Boolean(block.autoplay),
      images: block.images,
    }];
    if (block.type === "list") {
      const parsed = block.text.split("\n").map((item) => listLine(item)?.text || item.trim()).filter(Boolean);
      return parsed.length ? [{ type: "list", format: block.format || "unordered", children: parsed.map((item) => ({ type: "list-item", children: parseInline(item) })) }] : [];
    }
    if (block.type === "code") return block.text.trim() ? [{ type: "code", language: block.language || "text", text: block.text, children: [{ type: "text", text: block.text }] }] : [];
    if (block.type === "callout") return block.text.trim() || block.title?.trim() ? [{ type: "callout", tone: block.tone || "info", title: block.title || "", children: parseInline(block.text) }] : [];
    if (block.type === "button") return block.label?.trim() && block.url?.trim() ? [{ type: "button", label: block.label, url: block.url, variant: block.variant || "primary", openInNewTab: Boolean(block.openInNewTab) }] : [];
    if (block.type === "video") return block.url?.trim() ? [{ type: "video", url: block.url, provider: block.provider || "direct", caption: block.caption || "" }] : [];
    if (block.type === "embed") return block.url?.trim() ? [{ type: "embed", url: block.url, platform: block.platform || "other", caption: block.caption || "" }] : [];
    if (block.type === "table") {
      const headers = cells(block.headersText).filter(Boolean);
      const rows = String(block.rowsText || "").split("\n").map(cells).filter((row) => row.some(Boolean));
      return headers.length || rows.length ? [{ type: "table", headers, rows, caption: block.caption || "" }] : [];
    }
    if (block.type === "divider") return [{ type: "divider" }];
    return paragraphContent(block);
  });
}

function renderBlockPreview(block: EditorBlock) {
  if (block.type === "list") {
    const items = block.text.split("\n").map((item) => listLine(item)?.text || item.trim()).filter(Boolean);
    return renderBlogBlocks(items.length ? [{ type: "list", format: block.format || "unordered", children: items.map((item) => ({ type: "list-item", children: parseInline(item) })) }] as any[] : []);
  }
  return renderBlogBlocks(paragraphContent(block) as any[]);
}

function remember() {
  if (applyingHistory) return;
  const snapshot = JSON.stringify(blocks.value);
  if (history.value[historyIndex.value] === snapshot) return;
  history.value = history.value.slice(0, historyIndex.value + 1);
  history.value.push(snapshot);
  if (history.value.length > 80) history.value.shift();
  historyIndex.value = history.value.length - 1;
}

function publishValue(record = true) {
  if (record) remember();
  const content = toContent();
  lastEmitted = JSON.stringify(content);
  emit("update:modelValue", content);
}

watch(() => props.modelValue, (value) => {
  const serialized = JSON.stringify(value || []);
  if (serialized === lastEmitted) return;
  blocks.value = fromContent(value || []);
  if (!blocks.value.length) blocks.value = [newBlock("paragraph")];
  history.value = [];
  historyIndex.value = -1;
  remember();
}, { immediate: true });

function restoreHistory(index: number) {
  const snapshot = history.value[index];
  if (!snapshot) return;
  applyingHistory = true;
  blocks.value = JSON.parse(snapshot);
  historyIndex.value = index;
  applyingHistory = false;
  publishValue(false);
}

function undo() { if (canUndo.value) restoreHistory(historyIndex.value - 1); }
function redo() { if (canRedo.value) restoreHistory(historyIndex.value + 1); }

function addBlock(type: BlockType, position = blocks.value.length) {
  const block = newBlock(type);
  blocks.value.splice(position, 0, block);
  publishValue();
  nextTick(() => textareaRefs.get(block.id)?.focus());
}

function duplicateBlock(index: number) {
  const copy = clone(blocks.value[index]);
  copy.id = id();
  blocks.value.splice(index + 1, 0, copy);
  publishValue();
}

function removeBlock(index: number) {
  if (blocks.value.length === 1) blocks.value = [newBlock("paragraph")];
  else blocks.value.splice(index, 1);
  publishValue();
}

function moveBlock(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= blocks.value.length) return;
  const [block] = blocks.value.splice(index, 1);
  blocks.value.splice(target, 0, block);
  publishValue();
}

function setBlockType(block: EditorBlock, type: BlockType) {
  const position = blocks.value.findIndex((candidate) => candidate.id === block.id);
  if (position < 0 || block.type === type) return;
  blocks.value[position] = { ...newBlock(type), text: block.text };
  publishValue();
}

function dragStart(index: number) { draggedIndex.value = index; }
function dropBlock(target: number) {
  if (draggedIndex.value === null || draggedIndex.value === target) return;
  const [block] = blocks.value.splice(draggedIndex.value, 1);
  blocks.value.splice(target, 0, block);
  draggedIndex.value = null;
  publishValue();
}

function setTextareaRef(blockId: string, element: any) {
  if (element instanceof HTMLTextAreaElement) textareaRefs.set(blockId, element);
  else textareaRefs.delete(blockId);
}

function wrapSelection(block: EditorBlock, prefix: string, suffix = prefix) {
  const field = textareaRefs.get(block.id);
  if (!field) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const selected = block.text.slice(start, end) || "texto";
  block.text = `${block.text.slice(0, start)}${prefix}${selected}${suffix}${block.text.slice(end)}`;
  publishValue();
  nextTick(() => { field.focus(); field.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
}

async function insertLink(block: EditorBlock) {
  const field = textareaRefs.get(block.id);
  if (!field) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const selected = block.text.slice(start, end) || "texto del enlace";
  const target = await askText({ title: "URL del enlace", value: "https://", inputType: "url", confirmText: "Insertar" });
  if (!target) return;
  block.text = `${block.text.slice(0, start)}[${selected}](${target})${block.text.slice(end)}`;
  publishValue();
}

async function addInlineImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploadError.value = "";
  uploading.value = true;
  try {
    const image = await props.uploadImage(file);
    blocks.value.push({ ...newBlock("image"), text: image.caption || "", altText: image.alternativeText || "", image });
    publishValue();
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : "No se pudo subir la imagen.";
  } finally {
    uploading.value = false;
  }
}

async function addGalleryImages(block: EditorBlock, event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  uploadError.value = "";
  uploading.value = true;
  try {
    const uploaded = await Promise.all(files.map((file) => props.uploadImage(file)));
    block.images = [...(block.images || []), ...uploaded];
    publishValue();
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : "No se pudieron subir las imágenes.";
  } finally {
    uploading.value = false;
  }
}

function removeGalleryImage(block: EditorBlock, index: number) {
  block.images?.splice(index, 1);
  publishValue();
}

function moveGalleryImage(block: EditorBlock, index: number, direction: -1 | 1) {
  if (!block.images) return;
  const target = index + direction;
  if (target < 0 || target >= block.images.length) return;
  const [image] = block.images.splice(index, 1);
  block.images.splice(target, 0, image);
  publishValue();
}

function imageUrl(image?: EditorMedia | null) {
  if (!image?.url) return "";
  return image.url.startsWith("http") ? image.url : `${props.mediaBaseUrl}${image.url}`;
}

const templates: Record<string, any[]> = {
  guide: [
    { type: "paragraph", children: [{ type: "text", text: "Abre con el problema, explica por qué importa y promete una respuesta concreta." }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "Lo que necesitas saber" }] },
    { type: "list", format: "unordered", children: ["Punto clave uno", "Punto clave dos", "Punto clave tres"].map((text) => ({ type: "list-item", children: [{ type: "text", text }] })) },
    { type: "callout", tone: "info", title: "Idea clave", children: [{ type: "text", text: "Resume aquí el aprendizaje que la audiencia debe recordar." }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "Cómo llevarlo a la práctica" }] },
    { type: "paragraph", children: [{ type: "text", text: "Desarrolla el proceso paso a paso y cierra con una acción aplicable." }] },
  ],
  tutorial: [
    { type: "paragraph", children: [{ type: "text", text: "Explica qué se construirá, para quién sirve y cuál será el resultado final." }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "Antes de comenzar" }] },
    { type: "list", format: "unordered", children: ["Requisito o herramienta", "Dato o acceso necesario"].map((text) => ({ type: "list-item", children: [{ type: "text", text }] })) },
    { type: "heading", level: 2, children: [{ type: "text", text: "Paso 1 — Preparación" }] },
    { type: "paragraph", children: [{ type: "text", text: "Detalla el primer paso con una instrucción verificable." }] },
    { type: "code", language: "javascript", text: "// Agrega aquí un ejemplo cuando sea útil", children: [{ type: "text", text: "// Agrega aquí un ejemplo cuando sea útil" }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "Siguiente paso" }] },
    { type: "paragraph", children: [{ type: "text", text: "Continúa el proceso y explica cómo validar que funcionó." }] },
  ],
  story: [
    { type: "quote", children: [{ type: "text", text: "Una frase que concentre la historia o el aprendizaje." }] },
    { type: "paragraph", children: [{ type: "text", text: "Presenta a la persona, comunidad o proyecto y el punto de partida." }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "El reto" }] },
    { type: "paragraph", children: [{ type: "text", text: "Cuenta el contexto, las decisiones y las dificultades reales." }] },
    { type: "heading", level: 2, children: [{ type: "text", text: "Lo que cambió" }] },
    { type: "paragraph", children: [{ type: "text", text: "Describe el resultado con evidencia y aprendizajes transferibles." }] },
  ],
};

async function applyTemplate(key: keyof typeof templates) {
  const hasWriting = toContent().some((block: any) => block.type !== "paragraph" || block.children?.some((child: any) => child.text?.trim()));
  if (hasWriting && !await askConfirm({ title: "¿Aplicar la plantilla?", text: "Reemplazará los bloques actuales.", confirmText: "Aplicar" })) return;
  blocks.value = fromContent(templates[key]);
  publishValue();
}

function handleShortcut(event: KeyboardEvent) {
  if (event.key === "Escape" && fullscreen.value) fullscreen.value = false;
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) redo(); else undo();
}

onMounted(() => window.addEventListener("keydown", handleShortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", handleShortcut));
</script>

<template>
  <div class="block-editor" :class="{ 'is-fullscreen': fullscreen }">
    <header class="block-editor__topbar">
      <div><span>ARMADOR DE PUBLICACIONES</span><p>{{ blockCountLabel }} · formato, medios y recursos interactivos</p></div>
      <nav aria-label="Herramientas del editor">
        <button type="button" :disabled="!canUndo" title="Deshacer (⌘Z)" @click="undo">↶</button>
        <button type="button" :disabled="!canRedo" title="Rehacer (⌘⇧Z)" @click="redo">↷</button>
        <button type="button" :title="fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'" @click="fullscreen = !fullscreen">{{ fullscreen ? "↙" : "↗" }}</button>
      </nav>
    </header>

    <div class="template-strip">
      <span>COMENZAR CON ESTRUCTURA</span>
      <button type="button" @click="applyTemplate('guide')">Guía editorial</button>
      <button type="button" @click="applyTemplate('tutorial')">Tutorial</button>
      <button type="button" @click="applyTemplate('story')">Historia</button>
    </div>

    <div class="block-editor__stack">
      <article
        v-for="(block, index) in blocks"
        :key="block.id"
        class="editor-block"
        :data-type="block.type"
        @dragover.prevent
        @drop="dropBlock(index)"
      >
        <div class="editor-block__rail">
          <span>{{ String(index + 1).padStart(2, "0") }}</span>
          <i draggable="true" title="Arrastrar para reordenar" @dragstart.stop="dragStart(index)" @dragend="draggedIndex = null">⠿</i>
          <button type="button" aria-label="Mover bloque arriba" :disabled="index === 0" @click="moveBlock(index, -1)">↑</button>
          <button type="button" aria-label="Mover bloque abajo" :disabled="index === blocks.length - 1" @click="moveBlock(index, 1)">↓</button>
          <button type="button" aria-label="Duplicar bloque" @click="duplicateBlock(index)">⧉</button>
          <button type="button" aria-label="Eliminar bloque" @click="removeBlock(index)">×</button>
        </div>

        <div class="editor-block__content">
          <div class="editor-block__toolbar">
            <select :value="block.type" aria-label="Tipo de bloque" @change="setBlockType(block, ($event.target as HTMLSelectElement).value as BlockType)">
              <option value="paragraph">Párrafo</option><option value="heading">Título</option><option value="quote">Cita</option>
              <option value="list">Lista</option><option value="code">Código</option><option value="gallery">Galería</option><option value="callout">Aviso</option>
              <option value="button">Botón</option><option value="video">Video</option><option value="embed">Red social</option>
              <option value="table">Tabla</option><option value="divider">Separador</option>
            </select>
            <select v-if="block.type === 'heading'" v-model="block.level" aria-label="Nivel del título" @change="publishValue"><option :value="2">H2</option><option :value="3">H3</option><option :value="4">H4</option></select>
            <select v-if="['paragraph','heading','quote'].includes(block.type)" v-model="block.alignment" aria-label="Alineación" @change="publishValue"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select>
            <select v-if="block.type === 'list'" v-model="block.format" aria-label="Tipo de lista" @change="publishValue"><option value="unordered">Viñetas</option><option value="ordered">Numerada</option></select>
            <select v-if="block.type === 'callout'" v-model="block.tone" aria-label="Tono del aviso" @change="publishValue"><option value="info">Información</option><option value="success">Consejo</option><option value="warning">Atención</option><option value="note">Nota</option></select>
            <template v-if="['paragraph','heading','quote','list','callout'].includes(block.type)">
              <button type="button" title="Negrita" @click="wrapSelection(block, '**')"><strong>B</strong></button>
              <button type="button" title="Cursiva" @click="wrapSelection(block, '*')"><em>I</em></button>
              <button type="button" title="Subrayado" @click="wrapSelection(block, '__')"><u>U</u></button>
              <button type="button" title="Tachado" @click="wrapSelection(block, '~~')"><s>S</s></button>
              <button type="button" title="Código en línea" @click="wrapSelection(block, '`')">&lt;/&gt;</button>
              <button type="button" title="Enlace" @click="insertLink(block)">↗</button>
            </template>
          </div>

          <figure v-if="block.type === 'image' && block.image" class="editor-block__image">
            <img :src="imageUrl(block.image)" :alt="block.altText || 'Imagen del artículo'" />
            <div class="image-fields">
              <label><span>Texto alternativo</span><input v-model="block.altText" type="text" maxlength="160" placeholder="Describe la imagen" @input="publishValue" /></label>
              <label><span>Pie de imagen</span><input v-model="block.text" type="text" maxlength="220" placeholder="Contexto o crédito opcional" @input="publishValue" /></label>
              <label><span>Alineación</span><select v-model="block.alignment" @change="publishValue"><option value="wide">Ancho editorial</option><option value="full">Ancho completo</option><option value="left">Flotar izquierda</option><option value="right">Flotar derecha</option></select></label>
            </div>
          </figure>

          <div v-else-if="block.type === 'image'" class="empty-media">Usa el botón “Imagen” del panel inferior para cargar una imagen.</div>

          <div v-else-if="block.type === 'gallery'" class="gallery-block-editor">
            <div class="structured-fields structured-fields--three">
              <label><span>Título de galería</span><input v-model="block.title" maxlength="140" placeholder="Momentos del taller" @input="publishValue" /></label>
              <label><span>Presentación</span><select v-model="block.layout" @change="publishValue"><option value="grid">Cuadrícula</option><option value="masonry">Mosaico</option><option value="carousel">Carrusel</option></select></label>
              <label class="inline-check"><input v-model="block.autoplay" type="checkbox" @change="publishValue" /> Avance automático en carrusel</label>
              <label class="span-three"><span>Descripción o crédito general</span><input v-model="block.caption" maxlength="320" @input="publishValue" /></label>
            </div>
            <div v-if="block.images?.length" :class="['gallery-block-grid', `gallery-block-grid--${block.layout || 'grid'}`]">
              <article v-for="(image, imageIndex) in block.images" :key="`${image.id}-${imageIndex}`">
                <img :src="imageUrl(image)" :alt="image.alternativeText || ''" />
                <span>{{ String(imageIndex + 1).padStart(2, '0') }}</span>
                <footer><button type="button" :disabled="imageIndex === 0" @click="moveGalleryImage(block, imageIndex, -1)">←</button><button type="button" :disabled="imageIndex === block.images!.length - 1" @click="moveGalleryImage(block, imageIndex, 1)">→</button><button type="button" @click="removeGalleryImage(block, imageIndex)">×</button></footer>
              </article>
            </div>
            <label class="gallery-block-upload" :class="{ 'is-loading': uploading }">＋ {{ uploading ? "Subiendo…" : "Agregar imágenes" }}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" :disabled="uploading" @change="addGalleryImages(block, $event)" /></label>
          </div>

          <div v-else-if="block.type === 'button'" class="structured-fields structured-fields--three">
            <label><span>Texto del botón</span><input v-model="block.label" maxlength="120" placeholder="Descargar guía" @input="publishValue" /></label>
            <label><span>Destino</span><input v-model="block.url" type="url" placeholder="https://…" @input="publishValue" /></label>
            <label><span>Estilo</span><select v-model="block.variant" @change="publishValue"><option value="primary">Principal</option><option value="secondary">Secundario</option></select></label>
            <label class="inline-check"><input v-model="block.openInNewTab" type="checkbox" @change="publishValue" /> Abrir en otra pestaña</label>
          </div>

          <div v-else-if="block.type === 'video'" class="structured-fields structured-fields--three">
            <label><span>Proveedor</span><select v-model="block.provider" @change="publishValue"><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="direct">Archivo de video</option></select></label>
            <label class="span-two"><span>URL del video</span><input v-model="block.url" type="url" placeholder="https://…" @input="publishValue" /></label>
            <label class="span-three"><span>Descripción o crédito</span><input v-model="block.caption" maxlength="220" @input="publishValue" /></label>
          </div>

          <div v-else-if="block.type === 'embed'" class="structured-fields structured-fields--three">
            <label><span>Plataforma</span><select v-model="block.platform" @change="publishValue"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="x">X</option><option value="other">Otro recurso</option></select></label>
            <label class="span-two"><span>URL de la publicación</span><input v-model="block.url" type="url" placeholder="https://…" @input="publishValue" /></label>
            <label class="span-three"><span>Texto de apoyo</span><input v-model="block.caption" maxlength="220" @input="publishValue" /></label>
          </div>

          <div v-else-if="block.type === 'table'" class="structured-fields">
            <label><span>Encabezados · separados por |</span><input v-model="block.headersText" placeholder="Tema | Resultado | Recurso" @input="publishValue" /></label>
            <label><span>Filas · una por línea y celdas con |</span><textarea v-model="block.rowsText" rows="5" placeholder="Tema 1 | Resultado 1 | Enlace 1" @input="publishValue"></textarea></label>
            <label><span>Pie de tabla</span><input v-model="block.caption" maxlength="220" @input="publishValue" /></label>
          </div>

          <div v-else-if="block.type === 'divider'" class="divider-preview"><span></span><b>SEPARADOR EDITORIAL</b><span></span></div>

          <template v-else>
            <label v-if="block.type === 'callout'" class="callout-title"><span>Título del aviso</span><input v-model="block.title" maxlength="120" placeholder="Idea clave" @input="publishValue" /></label>
            <label v-if="block.type === 'code'" class="code-language"><span>Lenguaje</span><input v-model="block.language" maxlength="30" placeholder="javascript" @input="publishValue" /></label>
            <textarea
              :ref="(element) => setTextareaRef(block.id, element)"
              v-model="block.text"
              :rows="block.type === 'code' || block.type === 'list' ? 7 : block.type === 'heading' ? 2 : 5"
              :placeholder="block.type === 'heading' ? 'Título de la sección' : block.type === 'list' ? 'Un elemento por línea' : block.type === 'code' ? 'Código o ejemplo técnico' : block.type === 'callout' ? 'Explica el dato, consejo o advertencia' : 'Escribe el contenido del bloque…'"
              @input="publishValue"
            ></textarea>
            <div v-if="['paragraph','heading','quote','list','callout'].includes(block.type) && block.text.trim()" class="formatted-preview"><span>VISTA ENRIQUECIDA · FORMATO FINAL</span><div class="formatted-preview__content" v-html="renderBlockPreview(block)"></div></div>
          </template>
        </div>
      </article>
    </div>

    <div class="block-editor__add">
      <span>AGREGAR</span>
      <button type="button" @click="addBlock('paragraph')">¶ Párrafo</button><button type="button" @click="addBlock('heading')">H2 Título</button>
      <button type="button" @click="addBlock('quote')">“ Cita</button><button type="button" @click="addBlock('list')">☷ Lista</button>
      <button type="button" @click="addBlock('callout')">◇ Aviso</button><button type="button" @click="addBlock('button')">↗ Botón</button>
      <button type="button" @click="addBlock('gallery')">▦ Galería</button>
      <button type="button" @click="addBlock('code')">&lt;/&gt; Código</button><button type="button" @click="addBlock('video')">▶ Video</button>
      <button type="button" @click="addBlock('embed')">◎ Red social</button><button type="button" @click="addBlock('table')">▦ Tabla</button>
      <button type="button" @click="addBlock('divider')">— Separador</button>
      <label :class="{ 'is-loading': uploading }">▧ {{ uploading ? "Subiendo…" : "Imagen" }}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" :disabled="uploading" @change="addInlineImage" /></label>
    </div>
    <p v-if="uploadError" class="block-editor__error" role="alert">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.block-editor { border: 1px solid rgba(85,186,255,.18); border-radius: 22px; background: rgba(3,12,39,.54); overflow: hidden; }
.block-editor.is-fullscreen { position: fixed; inset: 0; z-index: 100; border: 0; border-radius: 0; background: #030b28; overflow-y: auto; }
.block-editor__topbar { display: flex; position: sticky; top: 0; z-index: 4; min-height: 58px; padding: 12px 16px; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid rgba(85,186,255,.14); background: rgba(4,13,43,.94); backdrop-filter: blur(18px); }
.block-editor__topbar > div { display: grid; gap: 5px; }
.block-editor__topbar span,.template-strip > span { color: #64c7ff; font: 700 10px/1 ui-monospace,monospace; letter-spacing: .12em; }
.block-editor__topbar p { margin: 0; color: rgba(255,255,255,.4); font-size: 10px; }
.block-editor__topbar nav { display: flex; gap: 5px; }
.block-editor__topbar button { width: 31px; height: 31px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; color: rgba(255,255,255,.7); background: rgba(87,187,255,.06); cursor: pointer; }
.block-editor__topbar button:disabled { opacity: .25; cursor: default; }
.template-strip { display: flex; padding: 10px 14px; align-items: center; gap: 7px; border-bottom: 1px solid rgba(255,255,255,.06); overflow-x: auto; }
.template-strip > span { margin-right: 3px; color: rgba(255,255,255,.32); white-space: nowrap; }
.template-strip button,.block-editor__add button,.block-editor__add label { flex: 0 0 auto; padding: 8px 10px; border: 1px solid rgba(87,187,255,.16); border-radius: 9px; color: rgba(255,255,255,.67); background: rgba(87,187,255,.05); font-size: 10px; cursor: pointer; }
.template-strip button:hover,.block-editor__add button:hover,.block-editor__add label:hover { border-color: rgba(0,217,164,.5); color: white; }
.block-editor__stack { display: grid; max-width: 1100px; margin: 0 auto; gap: 10px; padding: 12px; }
.editor-block { display: grid; grid-template-columns: 42px minmax(0,1fr); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; background: rgba(8,19,55,.8); overflow: hidden; transition: border-color .2s ease,opacity .2s ease; }
.editor-block:focus-within { border-color: rgba(0,217,164,.48); }
.editor-block__rail { display: flex; padding: 9px 7px; flex-direction: column; align-items: center; gap: 5px; border-right: 1px solid rgba(255,255,255,.07); color: rgba(255,255,255,.35); }
.editor-block__rail span { color: #00d9a4; font: 700 9px/1 ui-monospace,monospace; }
.editor-block__rail > i { margin: 4px 0 auto; color: rgba(255,255,255,.22); font-style: normal; cursor: grab; }
.editor-block__rail button { width: 27px; height: 27px; border: 0; border-radius: 8px; color: rgba(255,255,255,.52); background: rgba(255,255,255,.05); cursor: pointer; }
.editor-block__rail button:hover:not(:disabled) { color: white; background: rgba(87,187,255,.15); }
.editor-block__rail button:disabled { opacity: .22; }
.editor-block__content { min-width: 0; }
.editor-block__toolbar { display: flex; min-height: 41px; padding: 6px 8px; align-items: center; gap: 5px; border-bottom: 1px solid rgba(255,255,255,.07); overflow-x: auto; }
.editor-block__toolbar select,.editor-block__toolbar button { min-height: 28px; border: 1px solid rgba(255,255,255,.09); border-radius: 8px; color: rgba(255,255,255,.73); background: #0b1742; font-size: 10px; }
.editor-block__toolbar select { padding: 0 24px 0 8px; }
.editor-block__toolbar button { min-width: 29px; padding: 0 7px; cursor: pointer; }
.editor-block textarea { display: block; width: 100%; min-height: 90px; padding: 15px; resize: vertical; border: 0; outline: 0; color: rgba(255,255,255,.88); background: transparent; font: 400 14px/1.65 inherit; }
.editor-block[data-type="heading"] textarea { color: white; font-size: 20px; font-weight: 700; line-height: 1.25; }
.editor-block[data-type="quote"] textarea { border-left: 3px solid #00d9a4; color: #bdeee2; font-style: italic; }
.editor-block[data-type="code"] textarea { color: #aee7ff; background: rgba(0,0,10,.16); font-family: ui-monospace,monospace; }
.editor-block[data-type="callout"] { box-shadow: inset 3px 0 0 #57bbff; }
.formatted-preview { margin: 0 14px 14px; padding: 11px 12px; border: 1px solid rgba(0,217,164,.12); border-radius: 9px; color: rgba(255,255,255,.72); background: rgba(0,217,164,.025); }
.formatted-preview > span { display: block; margin-bottom: 7px; color: rgba(0,217,164,.55); font: 700 7px/1 ui-monospace,monospace; letter-spacing: .11em; text-align: left; }
.formatted-preview__content { font-size: 13px; line-height: 1.65; }
.formatted-preview :deep(p),.formatted-preview :deep(blockquote),.formatted-preview :deep(ul),.formatted-preview :deep(ol) { margin: 0 0 .9em; }
.formatted-preview :deep(p:last-child),.formatted-preview :deep(blockquote:last-child),.formatted-preview :deep(ul:last-child),.formatted-preview :deep(ol:last-child) { margin-bottom: 0; }
.formatted-preview :deep(ul),.formatted-preview :deep(ol) { display: grid; padding-left: 1.5rem; gap: .35rem; }
.formatted-preview :deep(li::marker) { color: #00d9a4; }
.formatted-preview :deep(h2),.formatted-preview :deep(h3),.formatted-preview :deep(h4) { margin: 1.1em 0 .5em; color: white; line-height: 1.25; }
.formatted-preview :deep(h2:first-child),.formatted-preview :deep(h3:first-child),.formatted-preview :deep(h4:first-child) { margin-top: 0; }
.formatted-preview :deep(blockquote) { padding-left: .9rem; border-left: 2px solid #00d9a4; color: #bdeee2; }
.formatted-preview :deep(pre) { padding: .8rem; overflow-x: auto; border-radius: 7px; background: rgba(0,0,10,.26); }
.formatted-preview :deep(table) { width: 100%; border-collapse: collapse; }
.formatted-preview :deep(th),.formatted-preview :deep(td) { padding: .45rem; border: 1px solid rgba(255,255,255,.1); text-align: left; }
.formatted-preview :deep(a) { color: #72ccff; text-decoration: underline; }
.formatted-preview :deep(code) { padding: 1px 4px; border-radius: 4px; color: #bde8ff; background: rgba(87,187,255,.09); }
.editor-block__image { margin: 0; padding: 12px; }
.editor-block__image img { display: block; width: 100%; max-height: 420px; border-radius: 12px; object-fit: cover; }
.image-fields { display: grid; margin-top: 10px; grid-template-columns: 1fr 1fr 180px; gap: 8px; }
.image-fields label,.structured-fields label,.callout-title,.code-language { display: grid; gap: 6px; }
.image-fields span,.structured-fields span,.callout-title span,.code-language span { color: rgba(255,255,255,.45); font: 700 8px/1 ui-monospace,monospace; letter-spacing: .08em; text-transform: uppercase; }
.image-fields input,.image-fields select,.structured-fields input,.structured-fields select,.callout-title input,.code-language input { width: 100%; min-height: 40px; padding: 9px 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; color: white; background: rgba(0,0,20,.25); }
.structured-fields { display: grid; padding: 14px; gap: 10px; }
.structured-fields--three { grid-template-columns: repeat(3,minmax(0,1fr)); }
.structured-fields .span-two { grid-column: span 2; }
.structured-fields .span-three { grid-column: 1/-1; }
.structured-fields textarea { min-height: 108px; padding: 10px 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(0,0,20,.22); }
.structured-fields .inline-check { display: flex; grid-column: 1/-1; align-items: center; grid-auto-flow: column; justify-content: start; color: rgba(255,255,255,.55); font-size: 10px; }
.inline-check input { width: 15px; min-height: 15px; }
.callout-title,.code-language { padding: 12px 14px 0; }
.empty-media { padding: 30px; color: rgba(255,255,255,.4); text-align: center; font-size: 11px; }
.gallery-block-editor { padding-bottom: 14px; }
.gallery-block-grid { display: grid; padding: 0 14px 12px; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
.gallery-block-grid article { position: relative; border-radius: 10px; background: rgba(0,0,20,.28); overflow: hidden; }
.gallery-block-grid img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: contain; background: #020617; }
.gallery-block-grid--masonry { display: block; columns: 3; column-gap: 8px; }
.gallery-block-grid--masonry article { display: inline-block; width: 100%; margin-bottom: 8px; break-inside: avoid; }
.gallery-block-grid--masonry img { height: auto; aspect-ratio: auto; }
.gallery-block-grid--carousel { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
.gallery-block-grid--carousel article { flex: 0 0 min(82%,420px); scroll-snap-align: start; }
.gallery-block-grid--carousel img { aspect-ratio: 16/9; }
.gallery-block-grid > article > span { position: absolute; top: 6px; left: 6px; padding: 4px 6px; border-radius: 99px; color: #001a21; background: #00d9a4; font: 800 7px/1 ui-monospace,monospace; }
.gallery-block-grid footer { display: flex; padding: 5px; justify-content: flex-end; gap: 4px; }
.gallery-block-grid button { width: 25px; height: 25px; border: 1px solid rgba(255,255,255,.09); border-radius: 7px; color: rgba(255,255,255,.7); background: rgba(255,255,255,.04); cursor: pointer; }
.gallery-block-grid button:last-child { color: #ff8393; }
.gallery-block-upload { display: grid; min-height: 44px; margin: 0 14px; place-content: center; border: 1px dashed rgba(0,217,164,.32); border-radius: 10px; color: #77e8cd; background: rgba(0,217,164,.04); font-size: 9px; cursor: pointer; }
.gallery-block-upload input { display: none; }
.divider-preview { display: flex; min-height: 100px; padding: 20px; align-items: center; gap: 12px; color: rgba(255,255,255,.3); font: 700 8px/1 ui-monospace,monospace; letter-spacing: .1em; }
.divider-preview span { height: 1px; flex: 1; background: linear-gradient(90deg,transparent,#57bbff,transparent); }
.block-editor__add { display: flex; position: sticky; bottom: 0; z-index: 4; padding: 12px 14px; align-items: center; gap: 7px; border-top: 1px solid rgba(85,186,255,.14); background: rgba(4,13,43,.94); backdrop-filter: blur(18px); overflow-x: auto; }
.block-editor__add > span { margin-right: 4px; color: rgba(255,255,255,.36); font: 700 9px/1 ui-monospace,monospace; letter-spacing: .12em; }
.block-editor__add input { display: none; }
.block-editor__add .is-loading { opacity: .55; cursor: wait; }
.block-editor__error { margin: 0; padding: 0 16px 14px; color: #ff8f9d; font-size: 11px; }
@media (max-width: 720px) {
  .block-editor__topbar { align-items: flex-start; }
  .block-editor__topbar p { max-width: 230px; line-height: 1.4; }
  .editor-block { grid-template-columns: 34px minmax(0,1fr); }
  .editor-block__rail { padding-inline: 4px; }
  .image-fields,.structured-fields--three { grid-template-columns: 1fr; }
  .gallery-block-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .gallery-block-grid--masonry { columns: 2; }
  .gallery-block-grid--carousel { display: flex; }
  .structured-fields .span-two,.structured-fields .span-three { grid-column: auto; }
}
</style>
