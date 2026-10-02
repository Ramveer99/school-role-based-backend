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
      requireTLS: env.smtp.port === 587,
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

function formatFromAddress(from, fallbackUser) {
  const raw = String(from || '').trim().replace(/^"|"$/g, '');
  if (raw.includes('<') && raw.includes('>')) return raw;
  const address = (fallbackUser || raw.match(/[^\s<>]+@[^\s<>]+/)?.[0] || '').trim();
  const name = raw.replace(address, '').replace(/[<>"]/g, '').trim() || 'EduCore School ERP';
  return address ? `${name} <${address}>` : name;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendEmail({ to, subject, html, text }) {
  const mailer = getTransporter();
  const mailOptions = {
    from: formatFromAddress(env.smtp.from, env.smtp.user),
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
  resetUrl = `${String(env.frontendUrl || '').replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`,
}) {
  const recipient = (email || '').toLowerCase().trim();
  if (!recipient) {
    return { ok: false, error: 'Recipient email is required' };
  }

  const accountEmail = escapeHtml(recipient);
  const safeUrl = escapeHtml(resetUrl);
  const subject = 'Reset your EduCore password';
  const html = `
    <div style="margin:0;padding:0;background:#F1F5F9;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E2E8F0;">
              <tr>
                <td style="background:#0F172A;padding:28px 32px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;color:#93C5FD;font-weight:700;">EDUCORE</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Reset your password</div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#334155;">
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">A password reset was requested for this account:</p>
                  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin:0 0 24px;">
                    <div style="font-size:12px;color:#64748B;font-weight:700;letter-spacing:0.4px;">ACCOUNT</div>
                    <div style="font-size:15px;color:#0F172A;font-weight:700;margin-top:4px;">${accountEmail}</div>
                  </div>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Use the button below to choose a new password. This link expires in 1 hour and can be used once.</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center" bgcolor="#2563EB" style="border-radius:12px;">
                        <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Reset password</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:12px;color:#64748B;">If the button does not open, copy this link into your browser:</p>
                  <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#2563EB;text-decoration:none;">${safeUrl}</a></p>
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;">If you did not ask for this, you can ignore this email. The password will stay the same.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94A3B8;border-top:1px solid #E2E8F0;">EduCore School Management</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
  const text = `Reset your EduCore password\n\nAccount: ${email}\n\nOpen this link to choose a new password (expires in 1 hour):\n${resetUrl}\n\nIf you did not ask for this, ignore this email.`;

  console.log(`[email] forgot-password to ${recipient}`);
  return sendEmail({ to: recipient, subject, html, text });
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
