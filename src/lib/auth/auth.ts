import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { handleSignIn, GoogleProfile } from "./signin";
import { env } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({})],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      const result = await handleSignIn(getDb(), profile as GoogleProfile, env.companyDomain());
      return result.ok;
    },
    async jwt({ token, profile }) {
      if (profile?.email) {
        const [u] = await getDb()
          .select()
          .from(users)
          .where(eq(users.email, profile.email));
        if (u) token.userId = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) (session as { userId?: string }).userId = token.userId as string;
      return session;
    },
  },
});
