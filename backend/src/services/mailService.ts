import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';

// ============================================
// SMTP TRANSPORTER
// ============================================

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false, // MailHog does not use TLS
    });
  }
  return transporter;
}

// ============================================
// SEND EMAIL
// ============================================

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, subject, html } = params;

  // Memory mode — just log, don't actually send
  if (config.useMemoryDb) {
    console.log('========================================');
    console.log('[MailService - MemoryMode] Email logged:');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log('========================================');
    return true;
  }

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromAddress}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return false;
  }
}
