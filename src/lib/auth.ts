import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { DEMO_USERS, DEMO_PASSWORD, findDemoUser } from "./demo-users";
import type { Role } from "./types";

/**
 * Open sign-in, on purpose.
 *
 * There is no corporate directory behind this build, so anyone can get in: pick one of the ten
 * demo accounts, or sign in as yourself by choosing a department and role. Nothing here is a
 * security boundary — it exists so the permission model can be exercised by whoever you hand the
 * link to.
 *
 * For a real deployment, replace this file's providers with an SSO provider and map directory
 * group claims to roles inside the jwt callback. Nothing else in the app needs to change.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "demo",
      name: "Demo account",
      credentials: {
        userId: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(creds) {
        const user = findDemoUser(String(creds?.userId ?? ""));
        if (!user) return null;
        // The password is uniform and published in the README; an empty one is accepted too so a
        // one-click switch from inside the app does not need to carry it around.
        const given = String(creds?.password ?? "");
        if (given && given !== DEMO_PASSWORD) return null;
        const { id: _demoId, blurb: _blurb, ...profile } = user;
        return { id: user.email, ...profile };
      }
    }),
    CredentialsProvider({
      id: "guest",
      name: "Sign in as anyone",
      credentials: {
        name: { label: "Name", type: "text" },
        department: { label: "Department", type: "text" },
        role: { label: "Role", type: "text" }
      },
      async authorize(creds) {
        const name = String(creds?.name ?? "").trim();
        if (!name) return null;
        const role = (String(creds?.role ?? "reporter") as Role) || "reporter";
        const department = String(creds?.department ?? "Flight Operations");
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
        return {
          id: `${slug}@airindia.com`,
          name,
          email: `${slug}@airindia.com`,
          staffNo: String(20000000 + (slug.length * 7919) % 9999999),
          department,
          role,
          groups: role === "gatekeeper" ? ["safety-gatekeepers"] : [],
          scope: role === "reporter" ? "department" : "all"
        };
      }
    })
  ],
  // Production must set NEXTAUTH_SECRET. Locally, next-auth would derive a different secret for
  // API routes and server pages, so pages could never read the session; a fixed dev value avoids that.
  secret: process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "airindia-local-dev-only"),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as unknown as (typeof DEMO_USERS)[number];
        token.role = u.role;
        token.staffNo = u.staffNo;
        token.department = u.department;
        token.groups = u.groups;
        token.scope = u.scope;
      }
      // The in-app persona switcher updates the session rather than bouncing through sign-in.
      if (trigger === "update" && session?.personaId) {
        const next = findDemoUser(String(session.personaId));
        if (next) {
          token.name = next.name;
          token.email = next.email;
          token.role = next.role;
          token.staffNo = next.staffNo;
          token.department = next.department;
          token.groups = next.groups;
          token.scope = next.scope;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        name: (token.name as string) || session.user?.name || "",
        email: (token.email as string) || session.user?.email || "",
        role: (token.role as Role) ?? "reporter",
        staffNo: (token.staffNo as string) ?? "00000000",
        department: (token.department as string) ?? "Flight Operations",
        groups: (token.groups as string[]) ?? [],
        scope: (token.scope as "all" | "department") ?? "department"
      };
      return session;
    }
  }
};
