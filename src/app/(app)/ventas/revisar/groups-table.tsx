"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/format";
import { AssignRow } from "./assign-row";
import { deleteUnmatchedGroup } from "./actions";

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
  const router = useRouter();
  const [rows, setRows] = useState(groups);
  const [filter, setFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [isPending, startTransition] = useTransition();

  const tokens = norm(filter).split(/\s+/).filter(Boolean);
  const visible = rows.filter((g) => {
    const n = norm(g.text);
    return tokens.every((t) => n.includes(t));
  });

  function confirmDelete() {
    if (!deleteTarget) return;
    const text = deleteTarget.text;
    startTransition(async () => {
      const r = await deleteUnmatchedGroup(text);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setRows((rs) => rs.filter((g) => g.text !== text));
      toast.success(`Eliminadas ${r.deleted} pieza${r.deleted === 1 ? "" : "s"}`);
      setDeleteTarget(null);
      router.refresh();
    });
  }

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
            {visible.length} de {rows.length}
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
            {kind === "unmatched" && <TableHead />}
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
              {kind === "unmatched" && (
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Eliminar (no es una pieza real)"
                    onClick={() => setDeleteTarget(g)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={kind === "unmatched" ? 6 : 4} className="text-center text-muted-foreground py-8">
                {rows.length === 0 ? emptyMessage : "Sin resultados para esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{deleteTarget?.text}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              No es una pieza real, así que se borra por completo de las {deleteTarget?.count} venta
              {deleteTarget && deleteTarget.count > 1 ? "s" : ""} donde aparece (ajustando el total de cada una). Si
              alguna venta se queda sin piezas, se elimina también. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirmDelete}>
              {isPending ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
