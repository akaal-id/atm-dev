import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";

import { createSignupRequest } from "@/lib/server/account-requests";
import { listResourceByField } from "@/lib/server/store";
import type { User } from "@/lib/types";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return "/signup?error=oauth_email";

      const users = await listResourceByField("Users", "email", user.email.toLowerCase(), { limit: 1 });
      const existing = users.find((candidate) => candidate.email.toLowerCase() === user.email?.toLowerCase()) as User | undefined;

      if (existing?.is_active) return true;

      await createSignupRequest({
        full_name: user.name ?? user.email,
        email: user.email,
        profile_photo: user.image ?? "",
        signup_provider: account.provider,
      });

      return "/signup/requested";
    },
    async session({ session }) {
      if (!session.user?.email) return session;

      const users = await listResourceByField("Users", "email", session.user.email.toLowerCase(), { limit: 1 });
      const appUser = users.find((candidate) => candidate.email.toLowerCase() === session.user?.email?.toLowerCase() && candidate.is_active) as User | undefined;

      if (appUser) {
        session.user.name = appUser.full_name;
        session.user.image = appUser.profile_photo || session.user.image;
      }

      return session;
    },
  },
};
