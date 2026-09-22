"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateQuoteStatus } from "./actions";
import { quoteStatusLabels } from "@/lib/labels";
import { QuoteStatus } from "@/generated/prisma/enums";

const STATUSES = Object.values(QuoteStatus);

export function QuoteStatusSelect({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      items={quoteStatusLabels}
      disabled={isPending}
      onValueChange={(value) =>
        startTransition(async () => {
          await updateQuoteStatus(quoteId, value as QuoteStatus);
        })
      }
    >
      <SelectTrigger className="w-[150px] h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {quoteStatusLabels[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
