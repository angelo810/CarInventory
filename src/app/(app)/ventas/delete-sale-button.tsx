"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteSale } from "./actions";

export function DeleteSaleButton({
  saleId,
  summary,
  redirectTo,
  iconOnly,
}: {
  saleId: string;
  summary: string;
  redirectTo?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteSale(saleId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Venta eliminada");
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      {iconOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Eliminar venta"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      ) : (
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Eliminar venta
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary} Esta acción no se puede deshacer.
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
    </>
  );
}
