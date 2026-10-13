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
import { deleteVehicle } from "./actions";

export function DeleteVehicleButton({
  vehicleId,
  name,
  partCount,
}: {
  vehicleId: string;
  name: string;
  partCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteVehicle(vehicleId);
      if (result.error) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success(`"${name}" eliminado`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" title="Eliminar vehículo" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el vehículo y sus {partCount} pieza{partCount === 1 ? "" : "s"} registrada{partCount === 1 ? "" : "s"}. Los gastos
              asociados se conservan como gastos generales. Si alguna de sus piezas ya se vendió no se podrá eliminar
              (se pierde la venta); en ese caso archívalo. Esta acción no se puede deshacer.
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
