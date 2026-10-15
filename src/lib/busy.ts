// Estado «ocupado» del panel: mientras hay un proceso largo (emitir o regenerar diplomas, subir
// archivos, preparar un ZIP) se muestra una pantalla que bloquea el resto de la interfaz y se avisa
// al cerrar o recargar la pestaña, para que nadie interrumpa el proceso a medias.
import { reactive, readonly } from "vue";

type Job = { id: number; title: string; detail: string };
const state = reactive({ jobs: [] as Job[] });
let sequence = 0;

export const busyState = readonly(state);

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Los navegadores modernos muestran su propio texto; este valor solo activa el aviso.
  event.returnValue = "Hay un proceso en curso.";
}

export function startBusy(title: string, detail = "") {
  const job: Job = { id: ++sequence, title, detail };
  state.jobs.push(job);
  if (state.jobs.length === 1) window.addEventListener("beforeunload", warnBeforeLeaving);
  return {
    update(nextDetail: string) { job.detail = nextDetail; },
    done() {
      const index = state.jobs.findIndex((item) => item.id === job.id);
      if (index >= 0) state.jobs.splice(index, 1);
      if (!state.jobs.length) window.removeEventListener("beforeunload", warnBeforeLeaving);
    },
  };
}

// Ejecuta una tarea larga con la pantalla de espera. `progress` cambia el texto secundario.
export async function withBusy<T>(title: string, task: (progress: (detail: string) => void) => Promise<T>, detail = ""): Promise<T> {
  const job = startBusy(title, detail);
  try {
    return await task(job.update);
  } finally {
    job.done();
  }
}
