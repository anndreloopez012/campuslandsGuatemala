<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { askConfirm } from "../../lib/dialogs";
import { startBusy } from "../../lib/busy";
import {
  BlogAdminApi,
  mediaUrl,
  slugify,
  type EditorCategory,
  type EditorGallery,
  type EditorMedia,
} from "../../lib/blog-admin";

type GalleryImageDraft = {
  key: string;
  media: EditorMedia | null;
  file: File | null;
  preview: string;
  alternativeText: string;
  caption: string;
};

const props = defineProps<{
  api: BlogAdminApi;
  cmsUrl: string;
  galleries: EditorGallery[];
  categories: EditorCategory[];
  settings: Record<string, any>;
}>();
const emit = defineEmits<{
  (event: "refresh"): void;
  (event: "notice", value: { message: string; type: "success" | "error" }): void;
}>();

const editorOpen = ref(false);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const search = ref("");
const statusFilter = ref("all");
const categoryFilter = ref("all");
const images = ref<GalleryImageDraft[]>([]);
const draggedIndex = ref<number | null>(null);
const previewOpen = ref(false);
const previewIndex = ref(0);
const autoplay = ref(false);
let autoplayTimer: number | undefined;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function key() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyForm() {
  return {
    documentId: "",
    title: "",
    slug: "",
    description: "",
    categoryDocumentId: "",
    tagsText: "",
    featured: false,
    publishDate: today(),
    seo: { metaTitle: "", metaDescription: "", keywords: "" },
  };
}

const form = reactive(emptyForm());
const filteredGalleries = computed(() => {
  const term = search.value.trim().toLowerCase();
  return props.galleries.filter((gallery) => {
    const matchesSearch = !term || [gallery.title, gallery.description, gallery.category?.name]
      .some((value) => String(value || "").toLowerCase().includes(term));
    const matchesStatus = statusFilter.value === "all" || gallery.publicationState === statusFilter.value;
    const matchesCategory = categoryFilter.value === "all" || gallery.category?.documentId === categoryFilter.value;
    return matchesSearch && matchesStatus && matchesCategory;
  });
});
const selectedCategory = computed(() => props.categories.find((category) => category.documentId === form.categoryDocumentId));
const seoScore = computed(() => {
  const checks = [form.title.length >= 20, form.description.length >= 80, images.value.length > 0,
    form.seo.metaTitle.length >= 30, form.seo.metaDescription.length >= 100,
    images.value.every((image) => image.alternativeText.trim().length > 0)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
});

function notice(message: string, type: "success" | "error" = "success") {
  emit("notice", { message, type });
}

function statusLabel(status?: string) {
  if (status === "published") return "Publicada";
  if (status === "modified") return "Cambios pendientes";
  return "Borrador";
}

function revokeDrafts() {
  images.value.forEach((image) => {
    if (image.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview);
  });
}

function resetForm() {
  revokeDrafts();
  Object.assign(form, emptyForm());
  images.value = [];
  errorMessage.value = "";
  previewOpen.value = false;
  stopAutoplay();
}

function newGallery() {
  resetForm();
  editorOpen.value = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mergeImages(detail: EditorGallery) {
  const mediaById = new Map((detail.images || []).map((image) => [Number(image.id), image]));
  const details = Array.isArray(detail.imageDetails) && detail.imageDetails.length
    ? detail.imageDetails
    : detail.images || [];
  return details.flatMap((item) => {
    const media = mediaById.get(Number(item.id)) || item;
    if (!media?.id) return [];
    return [{
      key: key(), media, file: null, preview: mediaUrl(props.cmsUrl, media),
      alternativeText: item.alternativeText || media.alternativeText || "",
      caption: item.caption || media.caption || "",
    }];
  });
}

function applyDetail(detail: EditorGallery, asCopy = false) {
  Object.assign(form, {
    documentId: asCopy ? "" : detail.documentId,
    title: asCopy ? `Copia de ${detail.title}`.slice(0, 140) : detail.title || "",
    slug: asCopy ? `${detail.slug}-copia`.slice(0, 140) : detail.slug || "",
    description: detail.description || "",
    categoryDocumentId: detail.category?.documentId || "",
    tagsText: Array.isArray(detail.tags) ? detail.tags.join(", ") : "",
    featured: asCopy ? false : Boolean(detail.featured),
    publishDate: asCopy ? today() : detail.publishDate || today(),
    seo: {
      metaTitle: asCopy ? `Copia de ${detail.seo?.metaTitle || detail.title}`.slice(0, 60) : detail.seo?.metaTitle || "",
      metaDescription: detail.seo?.metaDescription || "",
      keywords: detail.seo?.keywords || "",
    },
  });
  images.value = mergeImages(detail);
}

async function openGallery(gallery: EditorGallery, asCopy = false) {
  editorOpen.value = true;
  loading.value = true;
  errorMessage.value = "";
  resetForm();
  editorOpen.value = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    applyDetail(await props.api.gallery(gallery.documentId), asCopy);
    if (asCopy) notice("La galería se cargó como una copia nueva. Revisa título, slug y fecha.");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "No se pudo abrir la galería.";
  } finally {
    loading.value = false;
  }
}

function titleChanged() {
  if (!form.documentId || !form.slug) form.slug = slugify(form.title);
  if (!form.seo.metaTitle) form.seo.metaTitle = form.title.slice(0, 60);
}

function addImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  const existing = new Set(images.value.map((item) => item.file ? `${item.file.name}:${item.file.size}:${item.file.lastModified}` : ""));
  files.forEach((file) => {
    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (existing.has(signature)) return;
    images.value.push({
      key: key(), media: null, file, preview: URL.createObjectURL(file),
      alternativeText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), caption: "",
    });
    existing.add(signature);
  });
}

function removeImage(index: number) {
  const image = images.value[index];
  if (image?.preview.startsWith("blob:")) URL.revokeObjectURL(image.preview);
  images.value.splice(index, 1);
  if (previewIndex.value >= images.value.length) previewIndex.value = Math.max(0, images.value.length - 1);
}

function moveImage(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= images.value.length) return;
  const [image] = images.value.splice(index, 1);
  images.value.splice(target, 0, image);
}

function dragStart(index: number) { draggedIndex.value = index; }
function dropImage(target: number) {
  if (draggedIndex.value === null || draggedIndex.value === target) return;
  const [image] = images.value.splice(draggedIndex.value, 1);
  images.value.splice(target, 0, image);
  draggedIndex.value = null;
}

function validate(publish: boolean) {
  if (!form.title.trim()) return "Agrega el título de la galería.";
  if (!form.slug.trim()) return "Agrega el slug público.";
  if (!form.description.trim()) return "Agrega una descripción.";
  if (!form.categoryDocumentId) return "Selecciona una categoría.";
  if (publish && !images.value.length) return "Agrega al menos una imagen antes de publicar.";
  if (!form.seo.metaTitle.trim() || !form.seo.metaDescription.trim()) return "Completa el título y la descripción SEO.";
  return "";
}

async function save(publish: boolean) {
  errorMessage.value = validate(publish);
  if (errorMessage.value) return;
  saving.value = true;
  const wait = startBusy(publish ? "Publicando la galería" : "Guardando la galería", `Subiendo ${images.value.filter((image) => image.file).length} imágenes…`);
  try {
    const resolved = await Promise.all(images.value.map(async (image) => ({
      ...image,
      media: image.file ? await props.api.upload(image.file) : image.media,
    })));
    const data = {
      title: form.title,
      slug: slugify(form.slug),
      description: form.description,
      categoryDocumentId: form.categoryDocumentId,
      tags: form.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      featured: form.featured,
      publishDate: form.publishDate,
      imageIds: resolved.map((image) => image.media?.id).filter(Boolean),
      imageDetails: resolved.map((image) => ({
        ...image.media,
        alternativeText: image.alternativeText,
        caption: image.caption,
      })),
      seo: { ...form.seo, shareImageId: resolved[0]?.media?.id || null },
    };
    if (form.documentId) await props.api.updateGallery(form.documentId, data, publish);
    else await props.api.createGallery(data, publish);
    emit("refresh");
    editorOpen.value = false;
    resetForm();
    notice(publish ? "Galería guardada y publicada." : "Borrador de galería guardado.");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "No se pudo guardar la galería.";
  } finally {
    wait.done();
    saving.value = false;
  }
}

async function quickPublish(gallery: EditorGallery) {
  try {
    await props.api.publishGallery(gallery.documentId);
    emit("refresh");
    notice("La galería ya está disponible en el blog.");
  } catch (error) { notice(error instanceof Error ? error.message : "No se pudo publicar.", "error"); }
}

async function quickUnpublish(gallery: EditorGallery) {
  if (!await askConfirm({ title: `¿Retirar “${gallery.title}” del blog?`, text: "La galería seguirá guardada como borrador.", confirmText: "Retirar" })) return;
  try {
    await props.api.unpublishGallery(gallery.documentId);
    emit("refresh");
    notice("La galería fue retirada y permanece como borrador.");
  } catch (error) { notice(error instanceof Error ? error.message : "No se pudo retirar.", "error"); }
}

async function removeGallery(gallery: EditorGallery) {
  if (!await askConfirm({ title: `¿Eliminar definitivamente “${gallery.title}”?`, text: "Esta acción no se puede deshacer.", confirmText: "Eliminar", tone: "danger" })) return;
  try {
    await props.api.deleteGallery(gallery.documentId);
    emit("refresh");
    notice("La galería fue eliminada.");
  } catch (error) { notice(error instanceof Error ? error.message : "No se pudo eliminar.", "error"); }
}

function openPreview(index = 0) {
  if (!images.value.length) return;
  previewIndex.value = Math.max(0, Math.min(index, images.value.length - 1));
  previewOpen.value = true;
}

function stepPreview(direction: -1 | 1) {
  if (!images.value.length) return;
  previewIndex.value = (previewIndex.value + direction + images.value.length) % images.value.length;
}

function stopAutoplay() {
  autoplay.value = false;
  if (autoplayTimer) window.clearInterval(autoplayTimer);
  autoplayTimer = undefined;
}

function toggleAutoplay() {
  if (autoplay.value) return stopAutoplay();
  autoplay.value = true;
  autoplayTimer = window.setInterval(() => stepPreview(1), 5000);
}

function handleKeys(event: KeyboardEvent) {
  if (!previewOpen.value) return;
  if (event.key === "Escape") { previewOpen.value = false; stopAutoplay(); }
  if (event.key === "ArrowLeft") stepPreview(-1);
  if (event.key === "ArrowRight") stepPreview(1);
}

onMounted(() => window.addEventListener("keydown", handleKeys));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeys);
  revokeDrafts();
  stopAutoplay();
});
</script>

<template>
  <section class="gallery-admin">
    <template v-if="editorOpen">
      <header class="gallery-heading">
        <div><button type="button" @click="editorOpen = false; resetForm()">← Galerías</button><p>DOCUMENTO VISUAL</p><h1>{{ form.documentId ? "Editar galería" : "Nueva galería" }}</h1></div>
        <div><button type="button" class="secondary" @click="openPreview()">Presentación</button><button type="button" class="secondary" :disabled="saving" @click="save(false)">Guardar borrador</button><button type="button" class="primary" :disabled="saving" @click="save(true)">{{ saving ? "Procesando…" : "Publicar" }} ↑</button></div>
      </header>

      <p v-if="errorMessage" class="gallery-error" role="alert">{{ errorMessage }}</p>
      <div v-if="loading" class="gallery-loading">Cargando galería…</div>
      <form v-else class="gallery-editor" @submit.prevent="save(false)">
        <div class="gallery-canvas">
          <section class="panel panel--lead">
            <header><span>01</span><div><h2>La historia visual</h2><p>Identifica la colección y explica por qué vale la pena recorrerla.</p></div></header>
            <label><span>Título</span><textarea v-model="form.title" rows="2" maxlength="140" @input="titleChanged"></textarea><small>{{ form.title.length }}/140</small></label>
            <label><span>Slug público</span><div class="slug"><b>/blog/galerias/</b><input v-model="form.slug" maxlength="140" @blur="form.slug = slugify(form.slug)" /><i>/</i></div></label>
            <label><span>Descripción</span><textarea v-model="form.description" rows="4" maxlength="500"></textarea><small>{{ form.description.length }}/500</small></label>
          </section>

          <section class="panel">
            <header><span>02</span><div><h2>Secuencia de imágenes</h2><p>Carga varias, cambia el orden y completa el contexto accesible de cada una.</p></div></header>
            <label class="image-drop">＋ Seleccionar imágenes<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" @change="addImages" /></label>
            <div v-if="images.length" class="image-grid">
              <article v-for="(image, index) in images" :key="image.key" draggable="true" @dragstart="dragStart(index)" @dragover.prevent @drop="dropImage(index)">
                <button type="button" class="image-preview" @click="openPreview(index)"><img :src="image.preview" :alt="image.alternativeText" /><span>{{ String(index + 1).padStart(2, "0") }}</span></button>
                <label><span>Texto alternativo</span><input v-model="image.alternativeText" maxlength="160" placeholder="Describe lo que ocurre" /></label>
                <label><span>Pie o crédito</span><input v-model="image.caption" maxlength="220" placeholder="Contexto opcional" /></label>
                <footer><button type="button" :disabled="index === 0" @click="moveImage(index, -1)">←</button><i>ARRASTRAR PARA ORDENAR</i><button type="button" :disabled="index === images.length - 1" @click="moveImage(index, 1)">→</button><button type="button" class="remove" @click="removeImage(index)">×</button></footer>
              </article>
            </div>
            <div v-else class="image-empty"><b>{ 00 }</b><p>Aún no hay imágenes en esta galería.</p></div>
          </section>

          <section class="panel">
            <header><span>03</span><div><h2>Posicionamiento</h2><p>Información para buscadores, redes y sistemas de recomendación.</p></div></header>
            <label><span>Título SEO</span><input v-model="form.seo.metaTitle" maxlength="60" /><small>{{ form.seo.metaTitle.length }}/60</small></label>
            <label><span>Descripción SEO</span><textarea v-model="form.seo.metaDescription" rows="4" maxlength="160"></textarea><small>{{ form.seo.metaDescription.length }}/160</small></label>
            <label><span>Palabras clave</span><input v-model="form.seo.keywords" placeholder="campus, talleres, comunidad" /></label>
          </section>
        </div>

        <aside>
          <section class="panel inspector">
            <h3>PUBLICACIÓN</h3>
            <label><span>Categoría</span><select v-model="form.categoryDocumentId"><option value="" disabled>Seleccionar</option><option v-for="category in categories" :key="category.documentId" :value="category.documentId">{{ category.name }}</option></select></label>
            <label><span>Fecha</span><input v-model="form.publishDate" type="date" /></label>
            <label><span>Temas</span><input v-model="form.tagsText" placeholder="talleres, comunidad, IA" /></label>
            <label class="switch"><input v-model="form.featured" type="checkbox" /><i></i><span>Galería destacada</span></label>
          </section>
          <section class="panel score"><header><h3>CONTROL VISUAL</h3><strong>{{ seoScore }}%</strong></header><div><i :style="`width:${seoScore}%`"></i></div><p>{{ images.length }} imágenes · {{ images.filter((image) => image.alternativeText.trim()).length }} accesibles</p></section>
          <button type="button" class="mobile-save" :disabled="saving" @click="save(true)">Publicar galería ↑</button>
        </aside>
      </form>
    </template>

    <template v-else>
      <header class="gallery-heading"><div><p>PULSO / GALERÍAS</p><h1>Archivo visual</h1><span>Administra colecciones, su secuencia, contexto y publicación pública.</span></div><button type="button" class="primary" @click="newGallery">Nueva galería ＋</button></header>
      <div class="gallery-stats"><article><span>TOTAL</span><strong>{{ galleries.length.toString().padStart(2, "0") }}</strong></article><article><span>PUBLICADAS</span><strong>{{ galleries.filter((item) => item.publicationState === 'published').length.toString().padStart(2, "0") }}</strong></article><article><span>IMÁGENES</span><strong>{{ galleries.reduce((total, item) => total + (item.images?.length || 0), 0).toString().padStart(2, "0") }}</strong></article></div>
      <section class="gallery-console">
        <div class="gallery-filters"><input v-model="search" type="search" placeholder="Buscar galería o categoría" /><select v-model="statusFilter"><option value="all">Todos los estados</option><option value="published">Publicadas</option><option value="draft">Borradores</option><option value="modified">Cambios pendientes</option></select><select v-model="categoryFilter"><option value="all">Todas las categorías</option><option v-for="category in categories" :key="category.documentId" :value="category.documentId">{{ category.name }}</option></select></div>
        <div v-if="filteredGalleries.length" class="gallery-list">
          <article v-for="gallery in filteredGalleries" :key="gallery.documentId" :style="`--category:${gallery.category?.color || '#2CAAFF'}`">
            <button type="button" class="gallery-cover" @click="openGallery(gallery)"><img v-if="gallery.images?.[0]" :src="mediaUrl(cmsUrl, gallery.images[0])" :alt="gallery.title" /><span v-else>{ 00 }</span><b>{{ gallery.images?.length || 0 }} imágenes</b></button>
            <div><p><i></i>{{ gallery.category?.name }}</p><h2>{{ gallery.title }}</h2><span>{{ gallery.description }}</span><small>{{ statusLabel(gallery.publicationState) }} · {{ gallery.publishDate }}</small></div>
            <footer><button @click="openGallery(gallery)">Editar</button><button @click="openGallery(gallery, true)">Usar como base</button><a v-if="gallery.publicationState !== 'draft'" :href="`/blog/galerias/${gallery.slug}/`" target="_blank" rel="noopener">Ver ↗</a><button v-if="gallery.publicationState !== 'published'" @click="quickPublish(gallery)">Publicar</button><button v-if="gallery.publicationState !== 'draft'" @click="quickUnpublish(gallery)">Retirar</button><button class="danger" @click="removeGallery(gallery)">Eliminar</button></footer>
          </article>
        </div>
        <div v-else class="image-empty"><b>{ 00 }</b><h2>No encontramos galerías.</h2><p>Cambia los filtros o crea una nueva colección visual.</p></div>
      </section>
    </template>

    <div v-if="previewOpen && images.length" class="gallery-modal" role="dialog" aria-modal="true" @click.self="previewOpen = false; stopAutoplay()">
      <header><div><span>{{ form.title || "VISTA PREVIA DE GALERÍA" }}</span><small>{{ previewIndex + 1 }} / {{ images.length }}</small></div><nav><button type="button" @click="toggleAutoplay">{{ autoplay ? "Pausar" : "Auto 5s" }}</button><button type="button" @click="previewOpen = false; stopAutoplay()">×</button></nav></header>
      <figure><img :src="images[previewIndex].preview" :alt="images[previewIndex].alternativeText" /><figcaption v-if="images[previewIndex].caption">{{ images[previewIndex].caption }}</figcaption></figure>
      <button type="button" class="previous" aria-label="Imagen anterior" @click="stepPreview(-1)">←</button><button type="button" class="next" aria-label="Imagen siguiente" @click="stepPreview(1)">→</button>
      <div class="gallery-thumbs"><button v-for="(image, index) in images" :key="image.key" type="button" :class="{ active: index === previewIndex }" @click="previewIndex = index"><img :src="image.preview" alt="" /></button></div>
    </div>
  </section>
</template>

<style scoped>
*{box-sizing:border-box}.gallery-admin{--line:rgba(87,187,255,.16);--muted:rgba(247,249,255,.52);--green:#00d9a4;color:#f7f9ff}.gallery-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.gallery-heading>div:first-child{display:grid;gap:8px}.gallery-heading p,.panel>header>span,.panel h3{margin:0;color:#57bbff;font:700 10px/1 ui-monospace,monospace;letter-spacing:.15em}.gallery-heading h1{margin:0;font-size:clamp(34px,4.8vw,64px);line-height:1;letter-spacing:-.055em}.gallery-heading>div>span{color:var(--muted);font-size:12px}.gallery-heading>div>button{width:max-content;padding:0;border:0;color:#79d5ff;background:none;cursor:pointer}.gallery-heading>div:last-child{display:flex;gap:9px}.primary,.secondary,.mobile-save{min-height:44px;padding:0 16px;border-radius:11px;cursor:pointer;font-weight:750}.primary,.mobile-save{border:0;color:#021a21;background:linear-gradient(90deg,#50c8ff,var(--green))}.secondary{border:1px solid rgba(87,187,255,.22);color:#fff;background:rgba(87,187,255,.07)}button:disabled{opacity:.45;cursor:default}.gallery-error{padding:12px 14px;border:1px solid rgba(255,90,110,.25);border-radius:10px;color:#ff9aa7;background:rgba(255,70,90,.07)}.gallery-loading{display:grid;min-height:400px;place-content:center;color:var(--muted)}.gallery-editor{display:grid;margin-top:32px;grid-template-columns:minmax(0,1fr)320px;align-items:start;gap:20px}.gallery-canvas{display:grid;gap:17px}.panel{padding:clamp(18px,2.5vw,28px);border:1px solid var(--line);border-radius:22px;background:rgba(6,16,49,.67)}.panel--lead{background:linear-gradient(145deg,rgba(11,28,73,.82),rgba(5,15,47,.7))}.panel>header{display:flex;margin-bottom:22px;align-items:flex-start;gap:13px}.panel>header>span{display:grid;width:30px;height:30px;place-content:center;border:1px solid rgba(0,217,164,.22);border-radius:50%;color:var(--green)}.panel>header h2{margin:0;font-size:17px}.panel>header p{margin:4px 0 0;color:var(--muted);font-size:10px}.panel>label,.image-grid label,.inspector label{display:grid;position:relative;margin-top:14px;gap:7px;color:rgba(255,255,255,.58);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.panel input,.panel textarea,.panel select,.gallery-filters input,.gallery-filters select{width:100%;min-height:45px;padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;outline:0;color:#fff;background:rgba(2,9,34,.7);font:inherit}.panel textarea{resize:vertical;font-size:14px;line-height:1.55;text-transform:none}.panel label>small{position:absolute;right:7px;bottom:5px;color:rgba(255,255,255,.25);font-size:8px}.panel--lead>label:first-of-type textarea{font-size:27px;font-weight:700;line-height:1.15}.slug{display:flex;min-height:45px;align-items:center;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(2,9,34,.7);overflow:hidden}.slug b,.slug i{padding:0 10px;color:rgba(255,255,255,.34);font:600 9px/1 ui-monospace,monospace;font-style:normal}.slug input{min-height:43px;padding-inline:0;border:0;background:transparent}.image-drop{display:grid!important;min-height:90px!important;place-content:center;border:1px dashed rgba(0,217,164,.33)!important;border-radius:13px!important;color:#7debd0!important;background:rgba(0,217,164,.04)!important;cursor:pointer}.image-drop input{display:none}.image-grid{display:grid;margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.image-grid>article{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(0,0,20,.18)}.image-preview{display:block;position:relative;width:100%;padding:0;border:0;border-radius:10px;background:#02091e;overflow:hidden;cursor:zoom-in}.image-preview img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.image-preview span{position:absolute;top:8px;left:8px;padding:5px 7px;border-radius:99px;color:#001a21;background:var(--green);font:800 8px/1 ui-monospace,monospace}.image-grid label{margin-top:9px}.image-grid label span{font-size:8px}.image-grid input{min-height:38px;padding:8px 9px;font-size:10px;text-transform:none}.image-grid footer{display:flex;margin-top:8px;align-items:center;gap:5px}.image-grid footer button{width:27px;height:27px;border:1px solid rgba(255,255,255,.09);border-radius:7px;color:#fff;background:rgba(255,255,255,.04)}.image-grid footer i{flex:1;color:rgba(255,255,255,.24);font:600 7px/1 ui-monospace,monospace;font-style:normal;text-align:center}.image-grid footer .remove{color:#ff8393}.image-empty{display:grid;min-height:180px;margin-top:14px;place-content:center;justify-items:center;color:var(--muted);text-align:center}.image-empty b{color:#57bbff;font:700 22px/1 ui-monospace,monospace}.image-empty h2{margin:15px 0 0}.image-empty p{font-size:10px}.gallery-editor>aside{display:grid;position:sticky;top:22px;gap:14px}.inspector h3{margin-bottom:18px}.switch{display:flex!important;align-items:center;grid-template-columns:auto auto 1fr}.switch input{position:absolute;opacity:0}.switch i{width:34px;height:19px;border-radius:99px;background:rgba(255,255,255,.12)}.switch i:after{display:block;width:13px;height:13px;margin:3px;border-radius:50%;background:#aaa;content:"";transition:transform .2s}.switch input:checked+i{background:rgba(0,217,164,.32)}.switch input:checked+i:after{transform:translateX(15px);background:var(--green)}.score header{display:flex;margin:0 0 13px;justify-content:space-between}.score header strong{color:var(--green)}.score>div{height:4px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.score>div i{display:block;height:100%;background:linear-gradient(90deg,#57bbff,var(--green))}.score p{margin:10px 0 0;color:var(--muted);font-size:8px}.mobile-save{display:none}.gallery-stats{display:grid;margin-top:30px;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:18px;background:rgba(6,16,49,.58);overflow:hidden}.gallery-stats article{display:grid;min-height:110px;padding:18px;align-content:space-between;border-right:1px solid var(--line)}.gallery-stats article:last-child{border:0}.gallery-stats span{color:var(--muted);font:700 8px/1 ui-monospace,monospace;letter-spacing:.12em}.gallery-stats strong{font-size:36px;font-weight:400}.gallery-console{margin-top:18px;border:1px solid var(--line);border-radius:20px;background:rgba(6,16,49,.54);overflow:hidden}.gallery-filters{display:grid;padding:13px;grid-template-columns:1fr 180px 190px;gap:8px;border-bottom:1px solid var(--line)}.gallery-list{display:grid}.gallery-list>article{display:grid;padding:14px;grid-template-columns:220px minmax(0,1fr);gap:17px;border-bottom:1px solid rgba(255,255,255,.07)}.gallery-list>article:last-child{border:0}.gallery-cover{display:block;position:relative;padding:0;border:0;border-radius:13px;background:#02091e;overflow:hidden;cursor:pointer}.gallery-cover img{display:block;width:100%;height:150px;object-fit:cover}.gallery-cover>span{display:grid;height:150px;place-content:center;color:#57bbff;font:700 22px/1 ui-monospace,monospace}.gallery-cover b{position:absolute;right:7px;bottom:7px;padding:5px 7px;border-radius:99px;color:#fff;background:rgba(2,8,27,.78);font-size:8px}.gallery-list>article>div{min-width:0;padding-top:5px}.gallery-list p{display:flex;margin:0;align-items:center;gap:7px;color:var(--category);font:700 8px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.gallery-list p i{width:18px;height:1px;background:currentColor}.gallery-list h2{margin:12px 0 6px;font-size:20px}.gallery-list>article>div>span{display:-webkit-box;color:var(--muted);font-size:10px;line-height:1.55;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.gallery-list small{display:block;margin-top:10px;color:rgba(255,255,255,.28);font:600 8px/1 ui-monospace,monospace}.gallery-list footer{display:flex;grid-column:1/-1;justify-content:flex-end;gap:6px}.gallery-list footer button,.gallery-list footer a{padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.66);background:rgba(255,255,255,.035);font-size:8px;text-decoration:none;cursor:pointer}.gallery-list footer .danger{color:#ff8393}.gallery-modal{display:grid;position:fixed;inset:0;z-index:110;padding:18px 80px 88px;background:rgba(0,3,16,.96);place-items:center}.gallery-modal>header{display:flex;position:absolute;top:0;left:0;width:100%;min-height:68px;padding:13px 22px;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.1)}.gallery-modal>header>div{display:grid;gap:4px}.gallery-modal>header span{color:#fff;font-weight:700}.gallery-modal>header small{color:var(--muted)}.gallery-modal nav{display:flex;gap:6px}.gallery-modal button{border:1px solid rgba(255,255,255,.12);border-radius:9px;color:#fff;background:rgba(255,255,255,.05);cursor:pointer}.gallery-modal nav button{min-height:34px;padding:0 10px}.gallery-modal figure{display:grid;max-width:min(1150px,100%);max-height:calc(100vh - 180px);margin:70px 0 0;justify-items:center}.gallery-modal figure img{display:block;max-width:100%;max-height:calc(100vh - 220px);object-fit:contain}.gallery-modal figcaption{margin-top:10px;color:rgba(255,255,255,.6);font-size:11px}.gallery-modal>.previous,.gallery-modal>.next{position:absolute;top:50%;width:48px;height:48px;border-radius:50%;font-size:20px}.gallery-modal>.previous{left:20px}.gallery-modal>.next{right:20px}.gallery-thumbs{display:flex;position:absolute;right:0;bottom:0;left:0;height:78px;padding:9px;justify-content:center;gap:6px;border-top:1px solid rgba(255,255,255,.08);overflow-x:auto}.gallery-thumbs button{width:78px;flex:0 0 auto;padding:2px;border-color:transparent;opacity:.45}.gallery-thumbs button.active{border-color:var(--green);opacity:1}.gallery-thumbs img{display:block;width:100%;height:54px;object-fit:cover}
@media(max-width:980px){.gallery-editor{grid-template-columns:1fr}.gallery-editor>aside{position:static;grid-template-columns:repeat(2,1fr)}.mobile-save{display:block}.gallery-filters{grid-template-columns:1fr 1fr}.gallery-filters input{grid-column:1/-1}.gallery-list>article{grid-template-columns:180px minmax(0,1fr)}}
@media(max-width:650px){.gallery-heading{align-items:flex-start;flex-direction:column}.gallery-heading>div:last-child{width:100%;flex-wrap:wrap}.gallery-heading>div:last-child>*{flex:1}.gallery-editor>aside{grid-template-columns:1fr}.image-grid{grid-template-columns:1fr}.gallery-stats{grid-template-columns:1fr}.gallery-stats article{min-height:78px;border-right:0;border-bottom:1px solid var(--line)}.gallery-filters{grid-template-columns:1fr}.gallery-filters input{grid-column:auto}.gallery-list>article{grid-template-columns:1fr}.gallery-cover img,.gallery-cover>span{height:190px}.gallery-modal{padding:16px 50px 88px}.gallery-modal>.previous{left:5px}.gallery-modal>.next{right:5px}}
</style>
