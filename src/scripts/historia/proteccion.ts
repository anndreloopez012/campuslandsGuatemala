const EDITABLE = "input, textarea, select, [contenteditable='true']";

const isEditable = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(EDITABLE));

export function protegerContenido(): () => void {
  const block = (event: Event) => {
    if (isEditable(event.target)) return;
    event.preventDefault();
  };

  const blockDrag = (event: DragEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest("img, video, a, svg, canvas")) {
      event.preventDefault();
    }
  };

  const listeners: Array<[string, EventListener]> = [
    ["contextmenu", block],
    ["selectstart", block],
    ["copy", block],
    ["cut", block],
    ["dragstart", blockDrag as EventListener],
  ];

  listeners.forEach(([type, handler]) => document.addEventListener(type, handler, { capture: true }));
  window.getSelection()?.removeAllRanges();

  return () => {
    listeners.forEach(([type, handler]) =>
      document.removeEventListener(type, handler, { capture: true }),
    );
  };
}
