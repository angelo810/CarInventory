"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveBusinessAction } from "@/app/(app)/actions";
import { BUSINESS_LABELS } from "@/lib/business-shared";
import type { Business } from "@/generated/prisma/enums";

export function BusinessSwitcher({ active, className }: { active: Business; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState<Business>(active);
  const [isPending, startTransition] = useTransition();

  function change(next: Business) {
    setValue(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("business", next);
      await setActiveBusinessAction(formData);
      router.refresh();
    });
  }

  return (
    <select
      value={value}
      disabled={isPending}
      onChange={(e) => change(e.target.value as Business)}
      className={`w-full rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5 text-xs font-medium text-sidebar-foreground ${className ?? ""}`}
    >
      {(Object.entries(BUSINESS_LABELS) as [Business, string][]).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
