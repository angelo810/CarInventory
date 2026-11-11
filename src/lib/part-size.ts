/**
 * Piezas que llevan medida: llantas y aros/rines. Se excluyen las que solo nombran la llanta
 * (sensores, seguros, tuercas, tapicería, cubre...).
 */
export function needsSize(partName: string): boolean {
  const n = partName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(sensor|seguro|tuerca|tapicer|cubre|tapa)/.test(n)) return false;
  return /\b(llantas?|aros?|rin|rines|neumaticos?)\b/.test(n);
}
