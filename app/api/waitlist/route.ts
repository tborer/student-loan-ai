import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistPayload {
  email?: unknown;
  /** Honeypot: real visitors never see this field. Filled = bot. */
  company?: unknown;
}

/**
 * POST /api/waitlist
 *
 * Relays a waitlist signup over SMTP, reusing the same transport
 * configuration and destination inbox as /api/contact.
 */
export async function POST(req: NextRequest) {
  if (process.env.ENABLE_WAITLIST === 'false') {
    return NextResponse.json({ error: 'The waitlist is not open right now.' }, { status: 503 });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM;
  const contactTo = process.env.CONTACT_TO_EMAIL;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom || !contactTo) {
    console.error(
      'Waitlist signup is not fully configured. Need SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and CONTACT_TO_EMAIL.'
    );
    return NextResponse.json({ error: 'The waitlist is not available right now.' }, { status: 500 });
  }

  let body: WaitlistPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';

  // Honeypot tripped: report success without sending, so the bot has no
  // signal to distinguish this from a real submission.
  if (company.length > 0) {
    return NextResponse.json({ sent: true });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    await transport.sendMail({
      from: smtpFrom,
      to: contactTo,
      replyTo: email,
      subject: 'Waitlist signup',
      text: `New waitlist signup: ${email}`,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('Waitlist signup send failed:', error);
    return NextResponse.json(
      { error: 'Could not join the waitlist. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
