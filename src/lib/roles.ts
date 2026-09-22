// Rutas visibles para el rol "vendedor": solo inventario (consulta) y cotizaciones.
// El Panel ("/") es exclusivo del administrador, igual que todo lo que no empiece
// con uno de estos prefijos.
export const SELLER_ALLOWED_PREFIXES = ["/buscar", "/piezas", "/cotizaciones"];

// Dentro de lo permitido, estas rutas de piezas son de gestión (crear/editar/reorganizar)
// y quedan reservadas al administrador aunque el prefijo /piezas esté permitido.
export const SELLER_BLOCKED_EXACT_OR_PREFIX = ["/piezas/nuevo", "/piezas/tipos"];

export function isAllowedForSeller(pathname: string): boolean {
  if (SELLER_BLOCKED_EXACT_OR_PREFIX.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return SELLER_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}
