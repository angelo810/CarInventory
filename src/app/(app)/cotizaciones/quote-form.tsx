"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { createQuote } from "./actions";

export function QuoteForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      const r = await createQuote(text);
      if (r.error) toast.error(r.error);
      if (r.whatsappUrl) {
        window.open(r.whatsappUrl, "_blank", "noopener,noreferrer");
        toast.success("Solicitud enviada por WhatsApp");
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solicitar cotización</CardTitle>
        <p className="text-sm text-muted-foreground">
          Describe la pieza que necesitas (auto, modelo, año, lado, etc.) y se enviará un mensaje de WhatsApp
          pidiendo imágenes y cotización.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          ref={formRef}
          action={submit}
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej: Faro delantero derecho de Chevrolet Optra 2012"
            rows={3}
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/500</span>
            <Button type="submit" disabled={isPending || !text.trim()}>
              <MessageCircle className="size-4" />
              {isPending ? "Enviando…" : "Enviar por WhatsApp"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
