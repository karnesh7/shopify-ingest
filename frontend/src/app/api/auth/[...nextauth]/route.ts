import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";

const authOptions: NextAuthOptions = {
  providers: [],
  session: { strategy: "jwt" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };