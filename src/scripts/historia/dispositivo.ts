export interface PerfilDispositivo {
  restringido: boolean;
  admiteHd: boolean;
  ahorroDatos: boolean;
  anchoBandaEstimado: number | null;
}

type NavegadorExtendido = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; downlink?: number };
};

// Motor y precarga deben decidir igual, o se descargaría una calidad que no se usa.
export function perfilDispositivo(): PerfilDispositivo {
  const nav = navigator as NavegadorExtendido;
  const ahorroDatos = Boolean(nav.connection?.saveData);
  const restringido =
    Boolean(nav.deviceMemory && nav.deviceMemory <= 4) ||
    Boolean(nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) ||
    ahorroDatos ||
    window.innerWidth < 1440;
  const admiteHd =
    !restringido &&
    window.innerWidth >= 1600 &&
    Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2) >= 2200;
  const downlink = nav.connection?.downlink;
  return {
    restringido,
    admiteHd,
    ahorroDatos,
    anchoBandaEstimado: typeof downlink === "number" && downlink > 0 ? downlink : null,
  };
}
