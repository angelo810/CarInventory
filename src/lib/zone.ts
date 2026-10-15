export type PartZoneValue = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE";

export const ZONE_OPTIONS: { value: PartZoneValue; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "DOCUMENTS", label: "Documentos" },
  { value: "SCRAP", label: "Chatarra" },
  { value: "COMPLETE", label: "Completo" },
];

const ZONE_VALUES = new Set<string>(ZONE_OPTIONS.map((z) => z.value));

export function isZone(value: string | undefined | null): value is PartZoneValue {
  return !!value && ZONE_VALUES.has(value);
}

/** Zona sugerida según la categoría de la pieza (null si no hay una obvia). */
export function zoneFromCategory(categoryName: string | undefined | null): PartZoneValue | null {
  switch (categoryName) {
    case "Interior":
      return "INTERIOR";
    case "Carrocería":
      return "EXTERIOR";
    case "Chatarra":
      return "SCRAP";
    case "Motor":
    case "Eléctrico":
    case "Transmisión":
    case "Suspensión":
    case "Frenos":
    case "Dirección":
      return "MECHANICAL";
    default:
      return null;
  }
}
