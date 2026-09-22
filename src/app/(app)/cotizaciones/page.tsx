import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { quoteStatusBadgeVariant, quoteStatusLabels } from "@/lib/labels";
import { QuoteForm } from "./quote-form";
import { QuoteStatusSelect } from "./quote-status-select";

export default async function CotizacionesPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const quotes = await prisma.quote.findMany({
    where: isAdmin ? undefined : { requesterId: session?.user?.id },
    include: { requester: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Solicitudes de imágenes y cotización enviadas por WhatsApp."
            : "Pide imágenes y cotización de una pieza. Se abre WhatsApp con el mensaje listo para enviar."}
        </p>
      </div>

      <QuoteForm />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                {isAdmin && <TableHead>Vendedor</TableHead>}
                <TableHead>Pieza solicitada</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(q.createdAt)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="whitespace-nowrap text-sm">
                      {q.requester.name || q.requester.email}
                    </TableCell>
                  )}
                  <TableCell className="max-w-sm whitespace-normal">{q.description}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <QuoteStatusSelect quoteId={q.id} status={q.status} />
                    ) : (
                      <Badge variant={quoteStatusBadgeVariant[q.status]}>{quoteStatusLabels[q.status]}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-muted-foreground py-10">
                    Todavía no hay solicitudes de cotización.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
