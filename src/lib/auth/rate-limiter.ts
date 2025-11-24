import 'server-only';
import { prisma } from '@/lib/prisma';
import { differenceInMinutes } from 'date-fns';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 1;

/**
 * Checks and updates the rate limit for a given identifier (IP or phone number).
 * @param identifier - The string to rate limit on.
 * @returns {Promise<{ success: boolean; limit: number; remaining: number; reset: number }>}
 */
export async function rateLimiter(identifier: string) {
  const now = new Date();
  let record = await prisma.rateLimit.findUnique({
    where: { identifier },
  });

  if (record) {
    const minutesSinceLastUpdate = differenceInMinutes(now, record.updatedAt);
    // If the window has passed, reset the tokens.
    if (minutesSinceLastUpdate >= LOCKOUT_MINUTES) {
      record.tokens = 0;
    }
  }

  const currentTokens = record?.tokens || 0;

  if (currentTokens >= MAX_ATTEMPTS) {
    // Block the request
    return {
      success: false,
      limit: MAX_ATTEMPTS,
      remaining: 0,
      reset: (record?.updatedAt.getTime() ?? now.getTime()) + (LOCKOUT_MINUTES * 60 * 1000),
    };
  }

  // Allow the request and update the record
  const newTokens = currentTokens + 1;
  await prisma.rateLimit.upsert({
    where: { identifier },
    create: { identifier, tokens: newTokens, updatedAt: now },
    update: { tokens: newTokens, updatedAt: now },
  });

  return {
    success: true,
    limit: MAX_ATTEMPTS,
    remaining: MAX_ATTEMPTS - newTokens,
    reset: now.getTime() + (LOCKOUT_MINUTES * 60 * 1000),
  };
}
