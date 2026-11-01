import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authorizeCredentials } from "@/lib/credentials";
import prisma from "@/lib/prisma";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  throw new Error("Missing AUTH_SECRET. Set AUTH_SECRET or NEXTAUTH_SECRET before starting the app.");
}

const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  trustHost: true,
  ...(authUrl ? { url: authUrl } : {}),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.userId !== "string") {
          throw new Error("Session token is missing a user identifier.");
        }
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
