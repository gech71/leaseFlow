
import Credentials from 'next-auth/providers/credentials';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcryptjs';
import type { User } from 'next-auth';
import { prisma } from './lib/prisma';
import { addMinutes, formatDistanceToNow } from 'date-fns';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 1;

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
      throw new Error('Invalid phone number or password.');
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const timeLeft = formatDistanceToNow(user.lockedUntil, { addSuffix: true });
      throw new Error(`Account is locked. Please try again ${timeLeft}.`);
    }

    let isPasswordCorrect = false;
    let isTempPassword = false;

    // First, check if a temporary password exists and matches.
    if (user.tempPassword && credentials.password === user.tempPassword) {
        isPasswordCorrect = true;
        isTempPassword = true;
    } 
    // If not, check the permanent password (if it exists).
    else if (user.password) {
      isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
    }
    
    if (isPasswordCorrect) {
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      }
      
      const { password, tempPassword, ...userWithoutPasswords } = user;
      
      if (isTempPassword) {
        return { ...userWithoutPasswords, forceChangePass: true };
      }
      
      return userWithoutPasswords;
    } else {
      const newAttemptCount = (user.failedLoginAttempts || 0) + 1;
      let updateData: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
        failedLoginAttempts: newAttemptCount,
      };
      
      let errorMessage: string;

      if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = addMinutes(new Date(), LOCKOUT_DURATION_MINUTES);
         await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });
        const timeLeft = formatDistanceToNow(updateData.lockedUntil, { addSuffix: true });
        errorMessage = `Account locked due to too many failed attempts. Please try again ${timeLeft}.`;
      } else {
         await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttemptCount;
        errorMessage = `Invalid credentials. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`;
      }

      // Throw an error with the specific message
      throw new Error(errorMessage);
    }
  },
});
