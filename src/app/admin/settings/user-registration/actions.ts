
"use server";

import { databaseService } from "@/lib/services/databaseService";
import { Prisma } from '@prisma/client';
import { sendEmail } from '@/lib/services/emailService';
import { auth } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const registrationFormSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1).regex(/^(09|07)\d{8}$/),
  email: z.string().email(),
  password: z.string().min(6),
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export async function registerUserAction(values: RegistrationFormValues) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required." };
  }

  const adminUser = await databaseService.getUserById(session.user.id, { roles: true });
  if (!adminUser) {
    return { success: false, error: "Admin user not found in local system." };
  }
  
  const isSuperAdmin = adminUser.roles.some(r => r.name === 'SUPER_ADMIN');
  const effectivePermissions = new Set<string>(adminUser.roles.flatMap(role => role.permissions));
  const canRegisterUsers = isSuperAdmin || effectivePermissions.has('settings:user_registration:manage');

  if (!canRegisterUsers) {
    return { success: false, error: "Unauthorized: You do not have permission to register users." };
  }

  try {
    const hashedPassword = await bcrypt.hash(values.password, 10);

    const userCreateInput: Prisma.UserCreateInput = {
      email: values.email,
      name: `${values.firstName} ${values.lastName}`.trim(),
      firstName: values.firstName,
      lastName: values.lastName,
      phoneNumber: values.phoneNumber,
      password: hashedPassword,
      tempPassword: values.password, 
      createdBy: { connect: { id: adminUser.id } },
    };

    const localUser = await databaseService.createUser(userCreateInput);

     const emailHtml = `
      <h1>Welcome to NIB Building Management Solution!</h1>
      <p>Hello ${values.firstName},</p>
      <p>A new account has been created for you. You can now log in with the credentials provided by your administrator.</p>
      <p><strong>Login Phone Number:</strong> ${values.phoneNumber}</p>
      <p>Thank you,</p>
      <p>The Management Team</p>
    `;

    await sendEmail({
      to: values.email,
      subject: 'Your New Account Credentials',
      html: emailHtml
    });
    
    return { success: true, user: localUser };

  } catch (dbError: any) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
         const target = (dbError.meta?.target as string[]) || [];
         return { success: false, error: `A user with this ${target.join(', ')} already exists.` };
    }
    return { success: false, error: `Failed to create user: ${dbError.message}` };
  }
}
