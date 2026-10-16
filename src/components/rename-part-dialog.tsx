"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renamePartType } from "@/app/(app)/piezas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Cambia el nombre de una pieza del catálogo. El cambio aplica a todas las piezas ya registradas o
 * vendidas con ese nombre. Si el nombre nuevo ya existe, se fusionan (la server action lo resuelve).
 */
type Props = {
  target: { id: string; name: string } | null;
  onClose: () => void;
  onRenamed: (id: string, newName: string) => void;
  onMerged: (id: string, mergedInto: string) => void;
};

export function RenamePartDialog(props: Props) {
  const { target, onClose } = props;
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{target && <RenameForm key={target.id} {...props} target={target} />}</DialogContent>
    </Dialog>
  );
}

function RenameForm({ target, onClose, onRenamed, onMerged }: Props & { target: { id: string; name: string } }) {
  const [name, setName] = useState(target.name);
  const [isPending, startTransition] = useTransition();

  function save() {
    const next = name.trim().replace(/\s+/g, " ");
    if (!next) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }
    if (next === target.name) {
      onClose();
      return;
    }
    const source = target;
    startTransition(async () => {
      const result = await renamePartType(source.id, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.mergedInto) {
        toast.success(`Ya existía "${result.mergedInto}": "${source.name}" se fusionó con esa pieza.`);
        onMerged(source.id, result.mergedInto);
      } else {
        toast.success(`"${source.name}" ahora se llama "${next}".`);
        onRenamed(source.id, next);
      }
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cambiar nombre</DialogTitle>
        <DialogDescription>
          El nombre nuevo se aplica a todas las piezas ya registradas y vendidas como &quot;{target.name}&quot; (en
          todos los vehículos). Si ya existe otra pieza con ese nombre, se fusionan.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        placeholder="Nuevo nombre"
        className="mt-1"
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={isPending} onClick={save}>
          {isPending ? "Guardando…" : "Guardar nombre"}
        </Button>
      </div>
    </>
  );
}
