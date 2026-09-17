"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateVehicleStatus } from "../actions";
import { sourceVehicleStatusLabels } from "@/lib/labels";

const STATUSES = ["IN_PROGRESS", "DISMANTLED", "ARCHIVED"] as const;

export function StatusSelect({
  vehicleId,
  status,
}: {
  vehicleId: string;
  status: (typeof STATUSES)[number];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      items={sourceVehicleStatusLabels}
      disabled={isPending}
      onValueChange={(value) =>
        startTransition(() => updateVehicleStatus(vehicleId, value as (typeof STATUSES)[number]))
      }
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {sourceVehicleStatusLabels[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
