"use server";

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { sendEmail } from '@/lib/services/emailService';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

interface CreateUserAndAccountData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
}

export async function createUserAndAccountAction(data: CreateUserAndAccountData) {
  try {
    const { currentUser: adminUser } = await getUserAndPermissions();

    if (!adminUser) {
      return { success: false, error: "Admin session not found." };
    }

    const { firstName, lastName, phoneNumber, email, password } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    if (existingUser) {
      return { success: false, error: "A user with this email or phone number already exists." };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const userCreateInput: Prisma.UserCreateInput = {
      userId: `local-${crypto.randomUUID()}`, // Use a local unique ID
      email: email,
      name: `${firstName} ${lastName}`.trim(),
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      password: hashedPassword,
      createdBy: { connect: { id: adminUser.id } },
    };

    const localUser = await prisma.user.create({ data: userCreateInput });

    // Send welcome email (without password)
    const emailHtml = `
      <h1>Welcome to LeaseFlow!</h1>
      <p>Hello ${firstName},</p>
      <p>A new account has been created for you by an administrator. You can now log in with the credentials they provided.</p>
      <p>You can access the portal here: <a href="${process.env.NEXTAUTH_URL}/login">${process.env.NEXTAUTH_URL}/login</a></p>
      <p><strong>Login Phone Number:</strong> ${phoneNumber}</p>
      <p>Thank you,</p>
      <p>The Management Team</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Your New Account for LeaseFlow',
      html: emailHtml
    });
    
    return { success: true, message: "User registered successfully.", user: localUser };

  } catch (dbError: any) {
    console.error("Error creating user in local database:", dbError);
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
      return { success: false, error: "A user with this email or phone number already exists." };
    }
    return { success: false, error: "Failed to create user due to a database error." };
  }
}
