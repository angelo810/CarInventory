import { cookies } from "next/headers";
import type { Business } from "@/generated/prisma/enums";
import { BUSINESS_COOKIE } from "@/lib/business-shared";

export { BUSINESS_COOKIE, BUSINESS_LABELS } from "@/lib/business-shared";

export async function getActiveBusiness(): Promise<Business> {
  const store = await cookies();
  const value = store.get(BUSINESS_COOKIE)?.value;
  return value === "INNOMUNDO" ? "INNOMUNDO" : "MONEYCARS";
}
