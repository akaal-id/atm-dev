import NextAuth from "next-auth";

import { authOptions } from "@/lib/server/next-auth-options";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
