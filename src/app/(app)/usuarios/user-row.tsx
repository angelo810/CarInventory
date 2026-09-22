"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteUser, resetUserPassword, updateUserRole } from "./actions";
import { Role } from "@/generated/prisma/enums";

const ROLE_LABELS = { SELLER: "Vendedor", ADMIN: "Administrador" };

export function UserRow({
  id,
  email,
  name,
  role,
  isSelf,
}: {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function changeRole(value: string | null) {
    if (!value || value === role) return;
    startTransition(async () => {
      const r = await updateUserRole(id, value as Role);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Rol actualizado");
      router.refresh();
    });
  }

  function confirmReset() {
    startTransition(async () => {
      const r = await resetUserPassword(id, newPassword);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Contraseña actualizada");
      setResetOpen(false);
      setNewPassword("");
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const r = await deleteUser(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Usuario eliminado");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{name || "—"}</div>
        <div className="text-xs text-muted-foreground">{email}</div>
      </TableCell>
      <TableCell>
        <Select value={role} items={ROLE_LABELS} disabled={isPending} onValueChange={changeRole}>
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SELLER">Vendedor</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button type="button" variant="ghost" size="icon-sm" title="Restablecer contraseña" onClick={() => setResetOpen(true)}>
          <KeyRound className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
          disabled={isSelf}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer contraseña de {name || email}</AlertDialogTitle>
            <AlertDialogDescription>Escribe la nueva contraseña (mínimo 6 caracteres).</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={isPending || newPassword.length < 6} onClick={confirmReset}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {name || email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrá iniciar sesión. Esta acción no se puede deshacer.
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
    </TableRow>
  );
}
