'use client';

import React, { useState } from 'react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;

/**
 * A contact form that posts to /api/contact, which relays the message over
 * SMTP server-side. The destination inbox is never present in this
 * component, the rendered page, or anything sent to the browser -- it lives
 * only in a server-only env var read inside the API route.
 */
const ContactForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot: real visitors never see or fill this field. A filled value
  // means a bot, so the route reports success without actually sending.
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError('Please enter a valid email address so we can reply.');
      return;
    }
    if (message.trim().length === 0) {
      setError('Please enter a message.');
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long (max ${MAX_MESSAGE_LENGTH.toLocaleString()} characters).`);
      return;
    }

    setStatus('sending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, company }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send your message.');
      }

      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="contact-success" role="status">
        <p>Thanks — your message has been sent. We&apos;ll get back to you by email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form" noValidate>
      <p className="contact-intro">
        Have a question or found a problem? Send us a message and we&apos;ll reply to the email
        address you provide.
      </p>

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="form-row">
        <label htmlFor="contact-name">Name (optional)</label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      <div className="form-row">
        <label htmlFor="contact-email">Email *</label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="form-row">
        <label htmlFor="contact-message">Message *</label>
        <textarea
          id="contact-message"
          required
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* Honeypot: kept out of the tab order and off-screen, not display:none
          (some bots skip display:none but still fill hidden fields). */}
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};

export default ContactForm;
