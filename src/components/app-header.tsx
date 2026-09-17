"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Search,
  Package,
  Car,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/(app)/actions";

const links = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/buscar", label: "Buscar pieza", icon: Search },
  { href: "/piezas", label: "Piezas", icon: Package },
  { href: "/vehiculos", label: "Vehículos", icon: Car },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];

export function AppHeader({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="h-14 shrink-0 border-b flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <div className="h-14 flex items-center px-4 border-b font-semibold">
              CarInventory
            </div>
            <nav className="p-2 space-y-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      active ? "bg-accent text-accent-foreground" : "text-foreground/70",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="font-semibold">CarInventory</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="text-sm text-muted-foreground hidden sm:inline">{userEmail}</span>
        )}
        <form action={signOutAction}>
          <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
