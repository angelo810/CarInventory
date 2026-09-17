import { VehicleForm } from "../vehicle-form";

export default function NuevoVehiculoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo vehículo</h1>
        <p className="text-sm text-muted-foreground">
          Registra el vehículo comprado para empezar a extraer piezas.
        </p>
      </div>
      <VehicleForm />
    </div>
  );
}
