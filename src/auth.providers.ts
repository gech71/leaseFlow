
import Credentials from 'next-auth/providers/credentials';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcryptjs';
import type { User } from 'next-auth';

export const credentialsProvider = Credentials({
  name: 'Credentials',
  credentials: {
    phone: { label: 'Phone Number', type: 'text' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials): Promise<User | null> {
    if (typeof credentials.phone !== 'string' || typeof credentials.password !== 'string') {
      return null;
    }

    const user = await databaseService.findUserByPhoneNumber(credentials.phone);
    if (!user) {
      return null;
    }
    
    // Check main password first
    if (user.password) {
        const passwordsMatch = await bcrypt.compare(credentials.password, user.password);
        if (passwordsMatch) {
            // Password is correct, return user object without passwords
            const { password, tempPassword, ...userWithoutPasswords } = user;
            return userWithoutPasswords;
        }
    }
    
    // If main password doesn't match or doesn't exist, check temporary password
    if (user.tempPassword) {
      // NOTE: Temp password is not hashed, direct comparison.
      if (credentials.password === user.tempPassword) {
        // Password is correct, return user object with a flag to force change
        const { password, tempPassword, ...userWithoutPasswords } = user;
        return { ...userWithoutPasswords, forceChangePass: true };
      }
    }
    
    // No password matched
    return null;
  },
});
