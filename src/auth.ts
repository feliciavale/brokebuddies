import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/** Google sign-in only turns on when both keys are set. */
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Guest sign-in (Credentials) needs JWT sessions: the session lives in an
  // encrypted cookie in the browser instead of a database row.
  session: { strategy: "jwt", maxAge: 365 * 24 * 60 * 60 },
  providers: [
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: { name: { label: "Your name", type: "text" } },
      async authorize(credentials) {
        const name = String(credentials?.name ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 60);
        if (!name) return null;
        const user = await prisma.user.create({ data: { name } });
        return { id: user.id, name: user.name };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  pages: { signIn: "/" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    // Only expose the basics to the browser (never rek no / QRIS)
    session({ session, token }) {
      return {
        expires: session.expires,
        user: { id: token.sub!, name: token.name ?? null, email: token.email ?? null, image: token.picture ?? null },
      } as typeof session;
    },
  },
});