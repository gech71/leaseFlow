
"use server";

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.error("❌ SMTP configuration is missing. Cannot send email.");
    // In a real app, you might want to avoid exposing this detailed error to the client.
    // For this prototype, we'll log it and return a generic message.
    return { success: false, error: "Email service is not configured on the server." };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} with subject "${subject}"`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error: error.message || "An unknown error occurred while sending the email." };
  }
}
