"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { AssignRow } from "./assign-row";

type Group = { text: string; count: number; revenue: number; vehicles: string[]; current?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GroupsTable({
  kind,
  groups,
  emptyMessage,
}: {
  kind: "unmatched" | "review";
  groups: Group[];
  emptyMessage: string;
}) {
  const [filter, setFilter] = useState("");

  const tokens = norm(filter).split(/\s+/).filter(Boolean);
  const visible = groups.filter((g) => {
    const n = norm(g.text);
    return tokens.every((t) => n.includes(t));
  });

  return (
    <div className="space-y-3">
      <div className="relative px-6 pt-2">
        <Search className="absolute left-8 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por texto del chat…"
          autoComplete="off"
          className="pl-9 max-w-sm"
        />
        {filter && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {visible.length} de {groups.length}
          </p>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Texto del chat</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {kind === "unmatched" && <TableHead>Autos</TableHead>}
            <TableHead>{kind === "unmatched" ? "Asignar a" : "Asignada a"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((g) => (
            <TableRow key={kind === "review" ? `${g.text}${g.current}` : g.text}>
              <TableCell className="max-w-xs whitespace-normal">{g.text}</TableCell>
              <TableCell className="text-right">{g.count}</TableCell>
              <TableCell className="text-right">{formatCurrency(g.revenue)}</TableCell>
              {kind === "unmatched" && (
                <TableCell className="max-w-48 whitespace-normal text-xs text-muted-foreground">
                  {g.vehicles.slice(0, 3).join(", ")}
                </TableCell>
              )}
              <TableCell>
                <AssignRow text={g.text} kind={kind} initial={g.current} />
              </TableCell>
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={kind === "unmatched" ? 5 : 4} className="text-center text-muted-foreground py-8">
                {groups.length === 0 ? emptyMessage : "Sin resultados para esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
