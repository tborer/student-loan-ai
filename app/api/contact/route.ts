import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot: real visitors never see this field. Filled = bot. */
  company?: unknown;
}

/**
 * POST /api/contact
 *
 * Relays a contact-form message over SMTP. The destination inbox
 * (CONTACT_TO_EMAIL) is read only here, server-side, and is never present in
 * client code, the rendered page, or any response sent back to the browser.
 */
export async function POST(req: NextRequest) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM;
  const contactTo = process.env.CONTACT_TO_EMAIL;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom || !contactTo) {
    console.error(
      'Contact form is not fully configured. Need SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and CONTACT_TO_EMAIL.'
    );
    return NextResponse.json({ error: 'The contact form is not available right now.' }, { status: 500 });
  }

  let body: ContactPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';

  // Honeypot tripped: report success without sending, so the bot has no
  // signal to distinguish this from a real submission.
  if (company.length > 0) {
    return NextResponse.json({ sent: true });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (message.length === 0) {
    return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 }
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
  }

  try {
    // Constructed per request, not at module scope: the transport reads env
    // vars that are absent at build time (see create-checkout-session for
    // the same pattern with the Stripe client).
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    await transport.sendMail({
      from: smtpFrom,
      to: contactTo,
      // Replying to the notification goes straight to the sender.
      replyTo: email,
      subject: `Contact form: ${name || email}`,
      text: `From: ${name || '(no name given)'} <${email}>\n\n${message}`,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('Contact form send failed:', error);
    return NextResponse.json(
      { error: 'Could not send your message. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
