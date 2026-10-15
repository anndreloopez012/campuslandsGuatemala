// Diálogos del sitio y del panel (confirmaciones, avisos, texto y copiar) con SweetAlert2,
// en lugar de los alert/confirm/prompt del navegador. Todos devuelven promesas.
import Swal from "sweetalert2";
import "../styles/dialogs.css";

export type DialogTone = "question" | "danger" | "success" | "error" | "info";

const ICONS: Record<DialogTone, string> = {
  question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.4 9.2a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.3"/><path d="M12 17h.01"/></svg>',
  danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 9.5v4.5"/><path d="M12 17h.01"/></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.4 2.8 2.8 5.6-6"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><path d="M12 7.5h.01"/></svg>',
};

const base = (tone: DialogTone) => ({
  iconHtml: ICONS[tone],
  buttonsStyling: false,
  heightAuto: false,
  reverseButtons: true,
  focusConfirm: false,
  focusCancel: tone === "danger",
  showClass: { popup: "dlg__pop-in", backdrop: "dlg__fade-in" },
  hideClass: { popup: "dlg__pop-out", backdrop: "dlg__fade-out" },
  customClass: {
    container: "dlg",
    popup: `dlg__popup dlg__popup--${tone}`,
    icon: "dlg__icon",
    title: "dlg__title",
    htmlContainer: "dlg__text",
    actions: "dlg__actions",
    confirmButton: `dlg__btn dlg__btn--confirm${tone === "danger" ? " dlg__btn--danger" : ""}`,
    cancelButton: "dlg__btn dlg__btn--cancel",
    input: "dlg__input",
    validationMessage: "dlg__validation",
  },
});

// Pregunta de sí o no. Con tone "danger" el botón principal se pinta en rojo y el foco cae en Cancelar.
export async function askConfirm(options: { title: string; text?: string; confirmText?: string; cancelText?: string; tone?: DialogTone }) {
  const tone = options.tone ?? "question";
  const result = await Swal.fire({
    ...base(tone),
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Sí, continuar",
    cancelButtonText: options.cancelText ?? "Cancelar",
  });
  return result.isConfirmed;
}

// Aviso con un solo botón.
export async function showAlert(options: { title: string; text?: string; tone?: DialogTone; okText?: string }) {
  await Swal.fire({ ...base(options.tone ?? "info"), title: options.title, text: options.text, confirmButtonText: options.okText ?? "Entendido" });
}

// Pide un texto. Devuelve null si se cancela.
export async function askText(options: { title: string; text?: string; value?: string; placeholder?: string; confirmText?: string; inputType?: "text" | "url" }) {
  const result = await Swal.fire({
    ...base("info"),
    title: options.title,
    text: options.text,
    input: options.inputType ?? "text",
    inputValue: options.value ?? "",
    inputPlaceholder: options.placeholder ?? "",
    inputAttributes: { autocapitalize: "off", autocorrect: "off", spellcheck: "false" },
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Aceptar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (value.trim() ? undefined : "Escribe un valor."),
  });
  return result.isConfirmed ? String(result.value ?? "").trim() : null;
}

// Muestra un valor para copiarlo a mano (cuando el portapapeles no está disponible).
export async function showCopy(options: { title: string; value: string; text?: string }) {
  await Swal.fire({
    ...base("info"),
    title: options.title,
    text: options.text ?? "Selecciona el texto y cópialo.",
    input: "text",
    inputValue: options.value,
    inputAttributes: { readonly: "readonly" },
    confirmButtonText: "Listo",
    didOpen: () => { Swal.getInput()?.select(); },
  });
}
