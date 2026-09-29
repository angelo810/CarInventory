import type { Business } from "@/generated/prisma/enums";

export const BUSINESS_COOKIE = "activeBusiness";

export const BUSINESS_LABELS: Record<Business, string> = {
  MONEYCARS: "MoneyCars",
  INNOMUNDO: "Innomundo",
};
