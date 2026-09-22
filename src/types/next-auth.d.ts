import { Role } from "@/generated/prisma/enums";

declare module "@auth/core/types" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    uid?: string;
  }
}
