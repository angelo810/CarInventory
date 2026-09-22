import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isAllowedForSeller } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Las rutas /api/* (fuera de /api/auth, ya excluida del matcher) se protegen a nivel de cada
  // ruta/acción, no aquí: son llamadas fetch del propio cliente (ej. /api/search) y redirigirlas
  // rompería la página que las usa en vez de bloquear nada.
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");

  if (isLoggedIn && !isApiRoute && req.auth?.user?.role === "SELLER" && !isAllowedForSeller(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/cotizaciones", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
