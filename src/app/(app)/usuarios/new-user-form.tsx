"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_LABELS = { SELLER: "Vendedor", ADMIN: "Administrador" };

export function NewUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) {
      toast.success("Usuario creado");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nuevo usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre (opcional)</Label>
            <Input id="name" name="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select name="role" defaultValue="SELLER" items={ROLE_LABELS}>
              <SelectTrigger className="w-full" id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELLER">Vendedor</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state?.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
