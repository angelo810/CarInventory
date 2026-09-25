"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { movePartType, renamePartType } from "../actions";

type ZoneKey = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE" | "OTHER";
type TypeRow = { id: string; name: string; zone: ZoneKey; count: number };

const ZONES: { value: ZoneKey; label: string }[] = [
  { value: "OTHER", label: "Otras" },
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "DOCUMENTS", label: "Documentos" },
  { value: "SCRAP", label: "Chatarra" },
  { value: "COMPLETE", label: "Completo" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TypesManager({ types }: { types: TypeRow[] }) {
  const [rows, setRows] = useState(types);
  const [zone, setZone] = useState<ZoneKey>("OTHER");
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [, startTransition] = useTransition();

  const tokens = norm(filter).split(/\s+/).filter(Boolean);
  const visible = rows
    .filter((r) => r.zone === zone)
    .filter((r) => tokens.every((t) => norm(r.name).includes(t)));

  function move(row: TypeRow, to: ZoneKey) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, zone: to } : r)));
    startTransition(async () => {
      const res = await movePartType(row.id, to);
      if (res.error) {
        toast.error(res.error);
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, zone: row.zone } : r)));
        return;
      }
      toast.success(`"${row.name}" → ${ZONES.find((z) => z.value === to)?.label}`);
    });
  }

  function startEdit(row: TypeRow) {
    setEditingId(row.id);
    setEditValue(row.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function confirmEdit(row: TypeRow) {
    const newName = editValue.trim();
    if (!newName || newName === row.name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      const res = await renamePartType(row.id, newName);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.mergedInto) {
        // Se fusionó con un tipo existente: desaparece de esta lista y sus unidades pasan al otro,
        // así que sumamos su conteo al tipo destino para que no quede desactualizado en pantalla.
        setRows((rs) =>
          rs
            .filter((r) => r.id !== row.id)
            .map((r) => (r.name === res.mergedInto ? { ...r, count: r.count + row.count } : r)),
        );
        toast.success(`Se unió con "${res.mergedInto}"`);
      } else {
        setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: newName } : r)));
        toast.success("Nombre actualizado");
      }
      cancelEdit();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ZONES.map((z) => (
          <Button
            key={z.value}
            type="button"
            size="sm"
            variant={zone === z.value ? "default" : "outline"}
            onClick={() => setZone(z.value)}
          >
            {z.label}
            <span className="ml-1 text-xs opacity-70">{rows.filter((r) => r.zone === z.value).length}</span>
          </Button>
        ))}
      </div>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Escribe para buscar…"
        autoComplete="off"
      />
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {visible.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                {editingId === r.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit(r);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-8 max-w-sm"
                    />
                    <Button type="button" size="icon-sm" onClick={() => confirmEdit(r)} title="Guardar">
                      <Check className="size-4" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={cancelEdit} title="Cancelar">
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {r.count} unidad{r.count === 1 ? "" : "es"}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => startEdit(r)}
                      title="Renombrar"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )}
                {editingId !== r.id && (
                  <div className="flex gap-1">
                    {ZONES.filter((z) => z.value !== r.zone).map((z) => (
                      <Button key={z.value} type="button" size="xs" variant="outline" onClick={() => move(r, z.value)}>
                        → {z.label}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {visible.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No hay piezas en esta lista.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
