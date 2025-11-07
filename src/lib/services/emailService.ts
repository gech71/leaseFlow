"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { encryptionService } from "./encryptionService";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string; // Add optional 'from' field
}

// SMTP configuration is now built dynamically
async function getTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const encryptedPassword = await prisma.secret.findUnique({
    where: { key: "SMTP_PASS" },
  });

  if (!smtpUser || !encryptedPassword) {
    console.error("❌ SMTP user or password is not configured in the system.");
    return null;
  }

  try {
    const smtpPass = encryptionService.decrypt(encryptedPassword.value);

    const smtpConfig = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };

    return nodemailer.createTransport(smtpConfig);
  } catch (error) {
    console.error(
      "❌ Failed to create transporter due to decryption error:",
      error,
    );
    return null;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
}: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const transporter = await getTransporter();

  if (!transporter) {
    const errorMsg =
      "Email service is not configured correctly (check user, password, and encryption key).";
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  const defaultFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = {
    from: from || defaultFrom, // Use provided 'from' or fallback to default
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return {
      success: false,
      error:
        error.message || "An unknown error occurred while sending the email.",
    };
  }
}
