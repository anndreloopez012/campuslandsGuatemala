// Contenido y posiciones del diploma oficial de AI Academy para la réplica web (campus, verificación y admin).
// El PDF lo genera el CMS (src/api/academy/diploma-pdf.ts) con estas mismas medidas en puntos Carta horizontal.

export type DiplomaDesign = { issuer?: string; place: string; signer: string; signerRole: string };
export const DEFAULT_DIPLOMA_DESIGN: DiplomaDesign = { issuer: "Campuslands GT", place: "Campus Tec, Zona 4", signer: "Jorge Alberto Matamoros Galindo", signerRole: "Director Ejecutivo" };

export type DiplomaData = { fullName: string; title: string; hours: number; issuedAt: string; credentialId: string; verifyUrl: string };
export type DiplomaLine = { key: string; text: string; y: number; s: number; w?: number; min?: number; strong?: boolean; className?: string; wrap?: boolean };

// "el 8 de octubre de 2026"
export function diplomaDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("es-GT", { month: "long", timeZone: "UTC" }).format(date);
  return `el ${date.getUTCDate()} de ${month} de ${date.getUTCFullYear()}`;
}

export function diplomaLines(data: DiplomaData, design: DiplomaDesign = DEFAULT_DIPLOMA_DESIGN): DiplomaLine[] {
  return [
    { key: "intro", text: "Hace constar que", y: 454.96, s: 13.6 },
    { key: "name", text: data.fullName, y: 424.96, s: 23.3, w: 530, min: 13, strong: true, className: "dpl__name" },
    { key: "credential", text: `Credencial No. ${data.credentialId}`, y: 401.96, s: 12 },
    { key: "course", text: "Cursó y aprobó la formación en", y: 357.96, s: 13.6 },
    { key: "title", text: data.title, y: 316.96, s: 32, w: 640, min: 22, strong: true, className: "dpl__title", wrap: true },
    { key: "hours", text: `Con intensidad horaria de ${data.hours} horas`, y: 289.96, s: 13.5 },
    { key: "issuer", text: `Emitido por ${design.issuer || DEFAULT_DIPLOMA_DESIGN.issuer}`, y: 252, s: 13.6 },
    { key: "place", text: `Sede ${design.place}`, y: 231.1, s: 13.6 },
    { key: "date", text: diplomaDate(data.issuedAt), y: 210.2, s: 13.6 },
    { key: "signer", text: design.signer, y: 99.86, s: 13.6, strong: true },
    { key: "role", text: design.signerRole, y: 83.66, s: 11.6 },
    { key: "verify", text: `Verifica su autenticidad en ${data.verifyUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`, y: 32, s: 7.5, w: 760, className: "dpl__verify" },
  ];
}

function shrink(element: HTMLElement, from: number, min: number) {
  let size = from;
  element.style.setProperty("--s", String(size));
  while (element.scrollWidth > element.clientWidth + 1 && size > min) {
    size -= 0.5;
    element.style.setProperty("--s", String(size));
  }
  return size;
}

// Igual que el PDF: los textos largos se reducen hasta caber y el título, como último recurso, pasa a dos líneas.
export function fitDiploma(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-fit]").forEach((element) => {
    element.classList.remove("is-wrapped");
    shrink(element, Number(element.dataset.s), Number(element.dataset.min || 9));
    if (element.scrollWidth > element.clientWidth + 1 && element.dataset.wrap) {
      element.classList.add("is-wrapped");
      shrink(element, 22, 14);
    }
  });
}
