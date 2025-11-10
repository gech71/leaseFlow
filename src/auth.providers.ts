import Credentials from "next-auth/providers/credentials";
import { databaseService } from "@/lib/services/databaseService";
import bcrypt from "bcryptjs";
import type { User } from "next-auth";

export const credentialsProvider = Credentials({
  name: "Credentials",
  credentials: {
    phone: { label: "Phone Number", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials): Promise<User | null> {
    if (
      typeof credentials.phone !== "string" ||
      typeof credentials.password !== "string"
    ) {
      return null;
    }

    const user = await databaseService.findUserByPhoneNumber(credentials.phone);
    if (!user) {
      return null;
    }

    // Check main password
    if (
      user.password &&
      (await bcrypt.compare(credentials.password, user.password))
    ) {
      const { password, tempPassword, ...userWithoutPasswords } = user;
      return userWithoutPasswords;
    }

    // Check temp password
    if (user.tempPassword && credentials.password === user.tempPassword) {
      const { password, tempPassword, ...userWithoutPasswords } = user;
      return { ...userWithoutPasswords, forceChangePass: true };
    }

    // No match
    return null;
  },
});
