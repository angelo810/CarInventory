"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Package,
  Car,
  ShoppingCart,
  Wallet,
} from "lucide-react";

const links = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/buscar", label: "Buscar pieza", icon: Search },
  { href: "/piezas", label: "Piezas", icon: Package },
  { href: "/vehiculos", label: "Vehículos", icon: Car },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <span className="font-semibold tracking-tight">CarInventory</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
