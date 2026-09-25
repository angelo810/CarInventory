"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
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
import { confirmAllReviewMatches } from "./actions";

export function ConfirmAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmAll() {
    startTransition(async () => {
      const r = await confirmAllReviewMatches();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Confirmadas ${r.confirmed} piezas`);
      setOpen(false);
      router.refresh();
    });
  }

  if (count === 0) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CheckCheck className="size-4" />
        Confirmar todas ({count})
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar las {count} coincidencias propuestas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se dan por buenas tal como están asignadas ahora mismo, sin cambiar a qué pieza del catálogo quedó cada
              una. Si alguna está mal asignada, corrígela primero escribiendo el nombre correcto en su fila antes de
              confirmar todas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={isPending} onClick={confirmAll}>
              {isPending ? "Confirmando…" : "Sí, confirmar todas"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
