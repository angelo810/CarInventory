import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Search, Package, Car, ShoppingCart, Wallet, MessageCircle, Users } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard, adminOnly: true },
  { href: "/buscar", label: "Buscar pieza", icon: Search },
  { href: "/piezas", label: "Piezas", icon: Package },
  { href: "/vehiculos", label: "Vehículos", icon: Car, adminOnly: true },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, adminOnly: true },
  { href: "/finanzas", label: "Finanzas", icon: Wallet, adminOnly: true },
  { href: "/cotizaciones", label: "Cotizaciones", icon: MessageCircle },
  { href: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];

export function navForRole(role: "ADMIN" | "SELLER" | undefined): NavLink[] {
  return NAV_LINKS.filter((l) => !l.adminOnly || role === "ADMIN");
}
