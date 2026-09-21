"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { movePartType } from "../actions";

type ZoneKey = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "OTHER";
type TypeRow = { id: string; name: string; zone: ZoneKey; count: number };

const ZONES: { value: ZoneKey; label: string }[] = [
  { value: "OTHER", label: "Otras" },
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TypesManager({ types }: { types: TypeRow[] }) {
  const [rows, setRows] = useState(types);
  const [zone, setZone] = useState<ZoneKey>("OTHER");
  const [filter, setFilter] = useState("");
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
                <div className="text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.count} unidad{r.count === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="flex gap-1">
                  {ZONES.filter((z) => z.value !== r.zone).map((z) => (
                    <Button key={z.value} type="button" size="xs" variant="outline" onClick={() => move(r, z.value)}>
                      → {z.label}
                    </Button>
                  ))}
                </div>
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
