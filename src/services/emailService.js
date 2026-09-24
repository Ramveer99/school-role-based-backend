import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
const sentEmailsLog = [];

function getTransporter() {
  if (transporter) return transporter;

  if (env.smtp.host && env.smtp.user) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  } else {
    // Fallback: Mock transport for development / testing without live SMTP server
    transporter = {
      sendMail: async (mailOptions) => {
        const info = {
          messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          response: '250 Mock email accepted',
          ...mailOptions,
        };
        sentEmailsLog.push(info);
        if (env.nodeEnv !== 'test') {
          console.log(`[emailService:mock] Sent to: ${mailOptions.to} | Subject: "${mailOptions.subject}"`);
        }
        return info;
      },
    };
  }

  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const mailer = getTransporter();
  const mailOptions = {
    from: env.smtp.from,
    to: to.toLowerCase().trim(),
    subject,
    text: text || html?.replace(/<[^>]+>/g, ' '),
    html,
  };

  try {
    const result = await mailer.sendMail(mailOptions);
    sentEmailsLog.push({ ...mailOptions, messageId: result.messageId, timestamp: new Date() });
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    console.error(`[emailService] Failed to send email to ${to}:`, err.message);
    // In dev / test, record in log rather than throwing fatal error
    sentEmailsLog.push({ ...mailOptions, error: err.message, timestamp: new Date() });
    return { ok: false, error: err.message };
  }
}

export async function sendStudentCredentials({
  email,
  fullName,
  temporaryPassword,
  schoolName = 'EduCore School',
  loginUrl = `${env.frontendUrl}/login`,
}) {
  const subject = `Your Student Login Credentials — ${schoolName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0F172A; margin-top: 0;">Welcome to ${schoolName}, ${fullName}!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">Your student portal account has been created. Use the temporary credentials below to log in:</p>
      
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color: #2563EB;">${loginUrl}</a></p>
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Login Email:</strong> <span style="font-family: monospace; font-weight: bold;">${email}</span></p>
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-weight: bold; background: #E2E8F0; padding: 2px 8px; border-radius: 4px;">${temporaryPassword}</span></p>
      </div>

      <p style="color: #EF4444; font-size: 13px; font-weight: 500;">Security Reminder: Please change your password immediately upon your first login under Profile &gt; Settings.</p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
      <p style="color: #94A3B8; font-size: 12px; margin: 0;">EduCore School Management System</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

export async function sendParentCredentials({
  email,
  fullName,
  studentName,
  temporaryPassword,
  schoolName = 'EduCore School',
  loginUrl = `${env.frontendUrl}/login`,
}) {
  const subject = `Your Parent Portal Account — ${schoolName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0F172A; margin-top: 0;">Welcome, ${fullName}!</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">Your Parent/Guardian account for <strong>${studentName}</strong> has been created at <strong>${schoolName}</strong>.</p>
      
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color: #2563EB;">${loginUrl}</a></p>
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Login Email:</strong> <span style="font-family: monospace; font-weight: bold;">${email}</span></p>
        <p style="margin: 6px 0; color: #334155; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; font-weight: bold; background: #E2E8F0; padding: 2px 8px; border-radius: 4px;">${temporaryPassword}</span></p>
      </div>

      <p style="color: #EF4444; font-size: 13px; font-weight: 500;">Security Reminder: Please change your password immediately upon first login.</p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
      <p style="color: #94A3B8; font-size: 12px; margin: 0;">EduCore School Management System</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

export async function sendPasswordResetEmail({
  email,
  resetToken,
  resetUrl = `${env.frontendUrl}/login?resetToken=${resetToken}`,
}) {
  const subject = 'Password Reset Request — EduCore';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0F172A; margin-top: 0;">Password Reset Request</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">We received a request to reset your password. You can reset it using the token below or by clicking the button:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetUrl}" style="background: #2563EB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset My Password</a>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px; margin: 20px 0;">
        <p style="margin: 0; color: #64748B; font-size: 12px;">Reset Token (valid for 1 hour):</p>
        <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 13px; word-break: break-all; font-weight: bold; color: #0F172A;">${resetToken}</p>
      </div>

      <p style="color: #94A3B8; font-size: 12px; margin-top: 20px;">If you did not request this password reset, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

export function getSentEmails() {
  return [...sentEmailsLog];
}

export function clearSentEmails() {
  sentEmailsLog.length = 0;
}

export default {
  sendEmail,
  sendStudentCredentials,
  sendParentCredentials,
  sendPasswordResetEmail,
  getSentEmails,
  clearSentEmails,
};
