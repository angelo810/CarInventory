"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

export type ZoneKey = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE" | "OTHER";
export type PartTypeOption = { id: string; name: string; category: string; zone: Exclude<ZoneKey, "OTHER"> | null };

export const ZONES: { value: Exclude<ZoneKey, "OTHER">; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "DOCUMENTS", label: "Documentos" },
  { value: "SCRAP", label: "Chatarra" },
  { value: "COMPLETE", label: "Completo" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Selector de tipo de pieza por zona + búsqueda, usado en Nueva pieza y Editar pieza. */
export function PartTypePicker({
  partTypes,
  value,
  onChange,
  initialZone = "INTERIOR",
  label = "Elige la pieza",
}: {
  partTypes: PartTypeOption[];
  value: string;
  onChange: (id: string) => void;
  initialZone?: ZoneKey;
  label?: string;
}) {
  const [zone, setZone] = useState<ZoneKey>(initialZone);
  const [filter, setFilter] = useState("");

  const tokens = norm(filter).split(/\s+/).filter(Boolean);
  const visible = partTypes
    .filter((pt) => (zone === "OTHER" ? !pt.zone : pt.zone === zone))
    .filter((pt) => {
      const n = norm(pt.name);
      return tokens.every((t) => n.includes(t));
    });
  const selected = partTypes.find((pt) => pt.id === value);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ZONES.map((z) => (
          <Button
            key={z.value}
            type="button"
            size="sm"
            variant={zone === z.value ? "default" : "outline"}
            onClick={() => {
              setZone(z.value);
              setFilter("");
            }}
          >
            {z.label}
            <span className="ml-1 text-xs opacity-70">{partTypes.filter((pt) => pt.zone === z.value).length}</span>
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={zone === "OTHER" ? "default" : "outline"}
          onClick={() => {
            setZone("OTHER");
            setFilter("");
          }}
        >
          Otras
          <span className="ml-1 text-xs opacity-70">{partTypes.filter((pt) => !pt.zone).length}</span>
        </Button>
      </div>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Buscar en ${zone === "OTHER" ? "otras" : ZONES.find((z) => z.value === zone)?.label.toLowerCase()}… (ej: faro, lh, espejo)`}
        autoComplete="off"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        {visible.map((pt) => (
          <button
            key={pt.id}
            type="button"
            onClick={() => onChange(pt.id)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
              pt.id === value ? "bg-muted font-medium" : ""
            }`}
          >
            <span>{pt.name}</span>
            {pt.id === value && <Check className="size-4" />}
          </button>
        ))}
        {visible.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">Sin resultados.</p>
        )}
      </div>
      <p className="text-sm">
        {selected ? (
          <>
            Seleccionada: <strong>{selected.name}</strong>
          </>
        ) : (
          <span className="text-muted-foreground">Aún no has elegido una pieza.</span>
        )}
      </p>
    </div>
  );
}
