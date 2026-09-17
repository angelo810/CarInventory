import { SaleForm } from "./sale-form";

export default function NuevaVentaPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>
        <p className="text-sm text-muted-foreground">
          Busca las piezas vendidas, ajusta el precio final si se negoció, y registra al cliente.
        </p>
      </div>
      <SaleForm />
    </div>
  );
}
