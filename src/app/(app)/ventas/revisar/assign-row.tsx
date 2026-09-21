"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignCatalogPart } from "./actions";

type ZoneKey = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "OTHER";
export type CatalogOption = { name: string; zone: ZoneKey };

const ZONES: { value: ZoneKey; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "OTHER", label: "Otras" },
];

const OptionsContext = createContext<CatalogOption[]>([]);

export function CatalogProvider({ options, children }: { options: CatalogOption[]; children: React.ReactNode }) {
  return <OptionsContext.Provider value={options}>{children}</OptionsContext.Provider>;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AssignRow({
  text,
  kind,
  initial,
}: {
  text: string;
  kind: "unmatched" | "review";
  initial?: string;
}) {
  const router = useRouter();
  const options = useContext(OptionsContext);
  const [value, setValue] = useState(initial ?? "");
  const [zone, setZone] = useState<ZoneKey>(() => options.find((o) => o.name === initial)?.zone ?? "INTERIOR");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof MouseEvent && wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function openPanel() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      setPos({
        top: below > 340 ? r.bottom + 4 : Math.max(8, r.top - 336),
        left: Math.min(r.left, Math.max(8, window.innerWidth - 400)),
        width: 392,
      });
    }
    setOpen(true);
  }

  const tokens = norm(value).split(/\s+/).filter(Boolean);
  const visible = options
    .filter((o) => o.zone === zone)
    .filter((o) => {
      const n = norm(o.name);
      return tokens.every((t) => n.includes(t));
    });

  function assign() {
    startTransition(async () => {
      const r = await assignCatalogPart({ text, kind, catalogName: value });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Asignadas ${r.updated} pieza${r.updated === 1 ? "" : "s"}`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2" ref={wrapRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (!open) openPanel();
        }}
        onFocus={openPanel}
        placeholder="Escribe o elige una pieza…"
        autoComplete="off"
        className="h-8 w-72"
      />
      {open && (
        <div
          className="fixed z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {ZONES.map((z) => (
              <Button
                key={z.value}
                type="button"
                size="xs"
                variant={zone === z.value ? "default" : "outline"}
                onClick={() => setZone(z.value)}
              >
                {z.label}
                <span className="ml-1 opacity-70">{options.filter((o) => o.zone === z.value).length}</span>
              </Button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visible.map((o) => (
              <button
                key={`${o.zone}-${o.name}`}
                type="button"
                onClick={() => {
                  setValue(o.name);
                  setOpen(false);
                }}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                  o.name === value ? "bg-muted font-medium" : ""
                }`}
              >
                {o.name}
              </button>
            ))}
            {visible.length === 0 && (
              <p className="p-3 text-center text-sm text-muted-foreground">Sin resultados en esta lista.</p>
            )}
          </div>
        </div>
      )}
      <Button type="button" size="sm" disabled={isPending || !value.trim()} onClick={assign}>
        {kind === "review" ? "Confirmar" : "Asignar"}
      </Button>
    </div>
  );
}
