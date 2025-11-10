
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
      // Use a custom error class that Auth.js can catch and pass to the client
      throw new Error('Invalid phone number or password.');
    }

    // Check if the account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const timeLeft = formatDistanceToNow(user.lockedUntil, { addSuffix: true });
      throw new Error(`Account is locked. Please try again ${timeLeft}.`);
    }

    let isPasswordCorrect = false;
    let isTempPassword = false;

    // Check main password first
    if (user.password) {
      isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
    }
    
    // If main password doesn't match, check temporary password
    if (!isPasswordCorrect && user.tempPassword) {
      if (credentials.password === user.tempPassword) {
        isPasswordCorrect = true;
        isTempPassword = true;
      }
    }
    
    if (isPasswordCorrect) {
      // Reset failed attempts on successful login
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
      // Handle failed login attempt
      const newAttemptCount = (user.failedLoginAttempts || 0) + 1;
      let updateData: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
        failedLoginAttempts: newAttemptCount,
      };

      if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = addMinutes(new Date(), LOCKOUT_DURATION_MINUTES);
         await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });
        const timeLeft = formatDistanceToNow(updateData.lockedUntil, { addSuffix: true });
        throw new Error(`Account locked due to too many failed attempts. Please try again ${timeLeft}.`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttemptCount;
      throw new Error(`Invalid credentials. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`);
    }
  },
});
