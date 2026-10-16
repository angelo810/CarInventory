"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addCatalogPartTypes, type NewCatalogItem } from "@/app/(app)/piezas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZONE_OPTIONS, type PartZoneValue } from "@/lib/zone";

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  open: boolean;
  defaultZone: PartZoneValue;
  defaultName?: string;
  onClose: () => void;
  onAdded: (items: NewCatalogItem[]) => void;
};

/** Agrega piezas nuevas a la lista del catálogo: una por línea, todas en la zona elegida. */
export function AddPartTypesDialog(props: Props) {
  const { open, onClose } = props;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{open && <AddForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function AddForm({ defaultZone, defaultName, onClose, onAdded }: Props) {
  const [text, setText] = useState(defaultName ?? "");
  const [zone, setZone] = useState<PartZoneValue>(defaultZone);
  const [isPending, startTransition] = useTransition();

  function save() {
    const names = text.split("\n");
    startTransition(async () => {
      const result = await addCatalogPartTypes(names, zone);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const created = result.created ?? [];
      if (created.length) {
        toast.success(
          `${created.length} pieza${created.length > 1 ? "s" : ""} agregada${created.length > 1 ? "s" : ""} al catálogo.`,
        );
        onAdded(created);
      }
      if (result.existing?.length) {
        toast.info(`Ya existían en el catálogo: ${result.existing.join(", ")}.`);
      }
      if (created.length || !result.existing?.length) onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Añadir piezas al catálogo</DialogTitle>
        <DialogDescription>
          Escribe una pieza por línea (por ejemplo, Luz de salón delantera, Luz de salón central y Luz de salón
          posterior). Quedan en la zona elegida y aparecen en la lista de todos los vehículos.
        </DialogDescription>
      </DialogHeader>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"Luz de salón delantera\nLuz de salón central\nLuz de salón posterior"}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <label className="flex items-center gap-2 text-sm">
        Zona
        <select value={zone} onChange={(e) => setZone(e.target.value as PartZoneValue)} className={selectClass}>
          {ZONE_OPTIONS.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={isPending || !text.trim()} onClick={save}>
          {isPending ? "Agregando…" : "Agregar"}
        </Button>
      </div>
    </>
  );
}
