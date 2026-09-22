import type { Role } from "@/lib/types";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name: string;
      email: string;
      image?: string | null;
      role: Role;
      staffNo: string;
      department: string;
      groups: string[];
      scope: "all" | "department";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    staffNo?: string;
    department?: string;
    groups?: string[];
    scope?: "all" | "department";
  }
}
