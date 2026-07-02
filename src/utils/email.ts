import axios from 'axios';
import { CONFIG } from '../config/environment';

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends an email via Resend's HTTP API. If no RESEND_API_KEY is configured
 * (dev/local), it logs a warning and no-ops — mirroring the Cloudinary helper —
 * so the app keeps working without an email provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { resendApiKey, from } = CONFIG.email;

  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send. Would have emailed:', input.to);
    return { delivered: false, error: 'Email service not configured' };
  }

  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from,
        to: input.to,
        subject: input.subject,
        ...(input.text ? { text: input.text } : {}),
        ...(input.html ? { html: input.html } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { delivered: true, id: res.data?.id };
  } catch (err: any) {
    const error = err?.response?.data?.message || err?.message || 'Failed to send email';
    console.error('[email] send failed:', error);
    return { delivered: false, error };
  }
}
