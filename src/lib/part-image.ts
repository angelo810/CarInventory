/**
 * Las fotos de las piezas están en un almacén privado de Vercel Blob: el navegador no puede abrirlas
 * directo, se piden a la app (que exige sesión). `v` cambia con cada foto nueva para no ver la vieja en caché.
 */
export function partImageSrc(partTypeId: string, blobUrl: string | null | undefined): string | null {
  if (!blobUrl) return null;
  return `/api/piezas/${partTypeId}/imagen?v=${encodeURIComponent(blobUrl.slice(-14))}`;
}
