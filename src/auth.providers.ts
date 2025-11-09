
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { databaseService } from '@/lib/services/databaseService';

// Define a simple user type for the authorize callback.
// This ensures we don't return complex Prisma objects.
interface AuthorizeUser {
  id: string;
  name: string | null;
  email: string | null;
  forceChangePass?: boolean;
}

export const credentialsProvider = Credentials({
  async authorize(credentials): Promise<AuthorizeUser | null> {
    const parsedCredentials = z
      .object({ phoneNumber: z.string(), password: z.string().min(1) })
      .safeParse(credentials);

    if (parsedCredentials.success) {
      const { phoneNumber, password } = parsedCredentials.data;
      
      const user = await databaseService.findUserByPhoneNumber(phoneNumber);
      if (!user) return null; // User not found

      // Handle temporary password login
      if (user.tempPassword && user.password === null) {
        // NOTE: We do not bcrypt compare temporary passwords. They are stored in plain text.
        if (password === user.tempPassword) {
          // THIS IS THE CRITICAL FIX: Return the object with the forceChangePass flag.
          return { id: user.id, name: user.name, email: user.email, forceChangePass: true };
        } else {
          return null; // Incorrect temp password
        }
      }

      // Handle regular password login
      if (user.password) {
        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (passwordsMatch) {
          // Return a simple object for a regular successful login.
          return { id: user.id, name: user.name, email: user.email };
        }
      }
    }
    
    return null; // Return null if credentials are not valid for any case
  },
});
