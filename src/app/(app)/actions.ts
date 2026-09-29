"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { BUSINESS_COOKIE } from "@/lib/business";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function setActiveBusinessAction(formData: FormData) {
  const business = formData.get("business");
  if (business !== "MONEYCARS" && business !== "INNOMUNDO") return;
  const store = await cookies();
  store.set(BUSINESS_COOKIE, business, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
