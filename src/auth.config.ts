import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
    jwt: ({ token, user }) => {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.uid ?? session.user.id;
        session.user.role = token.role ?? "SELLER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
